import type {
  CompanySettings,
  Request,
  RequestStatus,
  RequestType,
  Stage,
  User,
} from "./types";

/* ---------- status ↔ stage ---------- */

const STAGE_OF: Record<RequestStatus, Stage> = {
  draft: "waiting",
  pending_approval: "waiting",
  pending_clarification: "waiting",
  awaiting_subrequests: "waiting",
  approved: "you",
  in_progress: "you",
  partially_done: "you",
  complete: "done",
  closed: "done",
  rejected: "stopped",
  cancelled: "stopped",
};

export const stageOf = (status: RequestStatus): Stage => STAGE_OF[status];

export const isOpen = (status: RequestStatus): boolean =>
  stageOf(status) === "you" || stageOf(status) === "waiting";

export const isTerminal = (status: RequestStatus): boolean =>
  status === "closed" || status === "cancelled" || status === "rejected";

/* ---------- time ---------- */

export const HOUR = 3_600_000;
export const DAY = 24 * HOUR;

export function isLate(r: Request, now: number): boolean {
  if (!isOpen(r.status)) return false;
  return new Date(r.deadline).getTime() < now;
}

export function isDueSoon(r: Request, now: number): boolean {
  if (!isOpen(r.status)) return false;
  const dl = new Date(r.deadline).getTime();
  return dl >= now && dl - now < DAY;
}

/** Add N days honoring the company calendar (skips non-working days). */
export function addDeadlineDays(
  from: Date,
  days: number,
  settings: CompanySettings,
): Date {
  const d = new Date(from);
  if (settings.deadlineMode === "calendar") {
    d.setDate(d.getDate() + days);
    return d;
  }
  let left = days;
  while (left > 0) {
    d.setDate(d.getDate() + 1);
    if (settings.workingDays.includes(d.getDay())) left -= 1;
  }
  return d;
}

/** Whole steps of a request's path with the time spent on each. */
export function durationMs(a: string, b: string): number {
  return new Date(b).getTime() - new Date(a).getTime();
}

/* ---------- org tree ---------- */

export function directReports(users: User[], managerId: string): User[] {
  return users.filter((u) => u.managerId === managerId && u.active);
}

export function subtreeIds(users: User[], rootId: string): Set<string> {
  const out = new Set<string>();
  const stack = [rootId];
  while (stack.length) {
    const id = stack.pop()!;
    for (const u of users) {
      if (u.managerId === id && !out.has(u.id)) {
        out.add(u.id);
        stack.push(u.id);
      }
    }
  }
  return out;
}

export function ancestorIds(users: User[], userId: string): string[] {
  const byId = new Map(users.map((u) => [u.id, u]));
  const out: string[] = [];
  let cur = byId.get(userId)?.managerId ?? null;
  while (cur) {
    out.push(cur);
    cur = byId.get(cur)?.managerId ?? null;
  }
  return out;
}

/** Lowest common manager of two people (or null when one manages the other). */
export function commonManager(
  users: User[],
  a: string,
  b: string,
): string | null {
  const aAnc = new Set(ancestorIds(users, a));
  if (aAnc.has(b)) return null;
  const bAnc = ancestorIds(users, b);
  if (bAnc.includes(a)) return null;
  for (const id of bAnc) if (aAnc.has(id)) return id;
  return null;
}

export type Direction = "down" | "up" | "cross";

/** Where a bubble travels relative to the org tree. */
export function directionOf(users: User[], from: string, to: string): Direction {
  if (subtreeIds(users, from).has(to)) return "down";
  if (ancestorIds(users, from).includes(to)) return "up";
  return "cross";
}

/* ---------- routing ---------- */

export function resolveFirstRecipient(
  type: RequestType,
  ctx: {
    creator: User;
    users: User[];
    projectManagerId: string;
    departmentSupervisor: (departmentId: string) => string | undefined;
  },
): string | null {
  const fr = type.routing.firstRecipient;
  switch (fr.kind) {
    case "chosen":
      return null;
    case "creator_manager":
      return ctx.creator.managerId;
    case "project_manager":
      return ctx.projectManagerId;
    case "department":
      return ctx.departmentSupervisor(fr.departmentId) ?? null;
  }
}

/* ---------- permitted actions ---------- */

export type RequestAction =
  | "approve"
  | "reject"
  | "request_clarification"
  | "clarify"
  | "start"
  | "complete"
  | "transfer"
  | "subrequest"
  | "extend"
  | "return"
  | "close"
  | "reopen"
  | "cancel"
  | "progress";

export function permittedActions(
  r: Request,
  userId: string,
  openChildren: number,
): RequestAction[] {
  const mine = r.ownerId === userId;
  const creator = r.creatorId === userId;
  const returnTo = r.returnToId === userId;
  const out: RequestAction[] = [];

  switch (r.status) {
    case "pending_approval":
      if (mine) out.push("approve", "request_clarification", "reject");
      break;
    case "pending_clarification":
      if (mine) out.push("clarify");
      break;
    case "approved":
      if (mine) out.push("start", "complete", "transfer", "subrequest", "extend", "return");
      if (r.lines.length && mine) out.push("progress");
      break;
    case "in_progress":
    case "partially_done":
      if (mine) out.push("complete", "transfer", "subrequest", "extend", "return");
      if (r.lines.length && mine) out.push("progress");
      break;
    case "awaiting_subrequests":
      if (mine) out.push("subrequest", "extend");
      if (mine && openChildren === 0) out.push("complete");
      break;
    case "complete":
      if (returnTo) out.push("close", "reopen");
      break;
    default:
      break;
  }
  if (creator && isOpen(r.status) && r.status !== "draft") out.push("cancel");
  return out;
}

/* ---------- ordering (spec 9.1: priority, then lateness, then received) ---------- */

export function sortInbox(list: Request[], now: number): Request[] {
  return [...list].sort((a, b) => {
    const pa = a.priority === "urgent" ? 0 : 1;
    const pb = b.priority === "urgent" ? 0 : 1;
    if (pa !== pb) return pa - pb;
    const la = isLate(a, now) ? 0 : 1;
    const lb = isLate(b, now) ? 0 : 1;
    if (la !== lb) return la - lb;
    return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
  });
}

export function lineProgress(r: Request): { done: number; total: number } | null {
  if (!r.lines.length) return null;
  const total = r.lines.reduce((s, l) => s + l.qtyRequested, 0);
  const done = r.lines.reduce((s, l) => s + Math.min(l.qtyDone, l.qtyRequested), 0);
  return { done, total };
}
