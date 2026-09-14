"use client";

import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import type {
  AuditAction,
  AuditEntry,
  CompanySettings,
  DbSnapshot,
  FieldKind,
  L,
  Message,
  Notification,
  NotificationKind,
  NotificationTier,
  Priority,
  Request,
  RequestLine,
  RequestStatus,
  RoleKey,
  User,
} from "./types";
import { buildBlank, buildSeed, SEED_VERSION } from "./seed";
import {
  addDeadlineDays,
  directionOf,
  isLate,
  isOpen,
  resolveFirstRecipient,
} from "./rules";

/**
 * The demo "API". Every mutation here is the shape of a future Hono endpoint on
 * Cloudflare Workers: same inputs, same audit + notification side effects.
 * Swapping the store for real HTTP calls should not touch the components.
 */

export interface ComposerDraft {
  projectId: string;
  text: string;
  recipientId: string | null;
  typeId: string;
  priority: Priority;
  deadline: string | null;
  fields: Record<string, string | number>;
  parentId: string | null;
  lineId: string | null;
  returnToId: string | null;
  fromMessageId: string | null;
}

export interface CreateRequestInput {
  projectId: string;
  typeId: string;
  text: string;
  recipientId: string | null;
  priority: Priority;
  deadline: string | null;
  fields: Record<string, string | number>;
  parentId: string | null;
  lineId: string | null;
  returnToId: string | null;
  fromMessageId: string | null;
}

interface Session {
  currentUserId: string;
  projectId: string;
  openRequestId: string | null;
  composer: ComposerDraft | null;
  treeFocusId: string | null;
  /** demo = seeded company; blank = the training sheet built from scratch */
  mode: "demo" | "blank";
}

export interface EngineState {
  db: DbSnapshot;
  session: Session;
  hydrated: boolean;

  // session
  setCurrentUser: (id: string) => void;
  setProject: (id: string) => void;
  openRequest: (id: string | null) => void;
  setComposer: (draft: ComposerDraft | null) => void;
  setTreeFocus: (id: string | null) => void;

  // requests
  createRequest: (input: CreateRequestInput) => string;
  approve: (id: string, note: string) => void;
  reject: (id: string, note: string) => void;
  requestClarification: (id: string, note: string) => void;
  clarify: (id: string, note: string) => void;
  start: (id: string) => void;
  complete: (id: string, note: string) => void;
  close: (id: string) => void;
  reopen: (id: string, note: string) => void;
  cancel: (id: string, note: string) => void;
  transfer: (id: string, toUserId: string, note: string) => void;
  returnToSender: (id: string, note: string) => void;
  extend: (id: string, newDeadline: string, reason: string) => void;
  recordProgress: (id: string, lineId: string, qtyDone: number) => void;
  markSeen: (id: string) => void;

  // chat + notifications
  sendMessage: (projectId: string, requestId: string | null, text: string) => void;
  markNotificationRead: (id: string) => void;
  markAllRead: () => void;
  runEscalations: () => void;

  // admin
  updateSettings: (patch: Partial<CompanySettings>) => void;
  updateCompanyName: (name: string) => void;
  updateUser: (id: string, patch: { name?: string; title?: string; departmentId?: string; managerId?: string | null; role?: RoleKey }) => void;
  addUser: (input: NewUserInput) => string;
  addDepartment: (name: string, supervisorId: string) => string;
  addProject: (input: NewProjectInput) => string;
  addRequestType: (input: NewTypeInput) => string;
  resetDemo: () => void;
  startBlank: () => void;
}

export interface NewProjectInput {
  name: string;
  client: string;
  phase: "study" | "execution";
  managerId: string;
  siteSupervisorId: string;
  memberIds: string[];
}

export interface NewUserInput {
  name: string;
  title: string;
  departmentId: string;
  managerId: string | null;
  role: RoleKey;
}

export interface NewTypeInput {
  name: string;
  approval: "none" | "project_manager";
  defaultDeadlineDays: number;
  hasLines: boolean;
  fields: { label: string; kind: FieldKind; options: string[] }[];
}

const uid = () => Math.random().toString(36).slice(2, 10);
const nowIso = () => new Date().toISOString();
const same = (s: string): L => ({ ar: s, en: s });

function fresh(): { db: DbSnapshot; session: Session } {
  const db = buildSeed();
  return {
    db,
    session: {
      currentUserId: "u2",
      projectId: "p1",
      openRequestId: null,
      composer: null,
      treeFocusId: null,
      mode: "demo",
    },
  };
}

function blank(): { db: DbSnapshot; session: Session } {
  return {
    db: buildBlank(),
    session: { currentUserId: "owner", projectId: "", openRequestId: null, composer: null, treeFocusId: null, mode: "blank" },
  };
}

export const useEngine = create<EngineState>()(
  persist(
    (set, get) => {
      /* ---------- internal helpers (work on a draft copy of db) ---------- */

      const audit = (
        db: DbSnapshot,
        requestId: string,
        action: AuditAction,
        actorId: string,
        toUserId: string | null,
        note: string,
        offPath = false,
      ) => {
        const entry: AuditEntry = {
          id: uid(),
          requestId,
          action,
          actorId,
          toUserId,
          at: nowIso(),
          note: same(note),
          offPath,
        };
        db.audit = [...db.audit, entry];
      };

      const notify = (
        db: DbSnapshot,
        userId: string,
        tier: NotificationTier,
        kind: NotificationKind,
        requestId: string | null,
        text: L,
      ) => {
        if (!userId) return;
        const n: Notification = {
          id: uid(),
          userId,
          tier,
          kind,
          requestId,
          text,
          at: nowIso(),
          readAt: null,
        };
        db.notifications = [n, ...db.notifications];
      };

      const patch = (db: DbSnapshot, id: string, p: Partial<Request>) => {
        db.requests = db.requests.map((r) =>
          r.id === id ? { ...r, ...p, version: r.version + 1 } : r,
        );
      };

      const userOf = (db: DbSnapshot, id: string): User | undefined =>
        db.users.find((u) => u.id === id);

      const nameOf = (db: DbSnapshot, id: string): L =>
        userOf(db, id)?.name ?? same("?");

      const reqOf = (db: DbSnapshot, id: string): Request | undefined =>
        db.requests.find((r) => r.id === id);

      /** After a child changes, re-evaluate the parent: back to its owner when all children closed. */
      const settleParent = (db: DbSnapshot, parentId: string | null, actorId: string) => {
        if (!parentId) return;
        const parent = reqOf(db, parentId);
        if (!parent || parent.status !== "awaiting_subrequests") return;
        const open = db.requests.filter(
          (c) => c.parentId === parentId && isOpen(c.status),
        );
        if (open.length === 0) {
          patch(db, parentId, { status: "in_progress", ownerId: parent.returnToId });
          audit(db, parentId, "subrequest_returned", actorId, parent.returnToId, "");
          notify(db, parent.returnToId, "direct", "subrequest_returned", parentId, {
            ar: `أُغلقت كل الطلبات الفرعية وعاد إليك: ${parent.text.ar}`,
            en: `All sub-requests are closed and back with you: ${parent.text.en}`,
          });
        }
      };

      const escalate = (db: DbSnapshot, r: Request, at: string) => {
        const owner = userOf(db, r.ownerId);
        if (!owner) return;
        const dept = db.departments.find((d) => d.id === owner.departmentId);
        let target = dept?.supervisorId ?? owner.managerId ?? null;
        if (target === owner.id) target = owner.managerId;
        const project = db.projects.find((p) => p.id === r.projectId);
        patch(db, r.id, { escalatedAt: at });
        audit(db, r.id, "escalated", r.ownerId, target, "");
        const text: L = {
          ar: `متأخر: ${r.text.ar} لدى ${nameOf(db, r.ownerId).ar}`,
          en: `Late: ${r.text.en} with ${nameOf(db, r.ownerId).en}`,
        };
        if (target) notify(db, target, "escalation", "escalated", r.id, text);
        if (project && project.managerId !== target)
          notify(db, project.managerId, "escalation", "escalated", r.id, text);
        notify(db, r.ownerId, "direct", "overdue", r.id, {
          ar: `انتهت المهلة: ${r.text.ar}`,
          en: `Deadline passed: ${r.text.en}`,
        });
      };

      const mutate = (fn: (db: DbSnapshot) => void) => {
        const db: DbSnapshot = { ...get().db };
        fn(db);
        set({ db });
      };

      return {
        ...fresh(),
        hydrated: false,

        /* ---------- session ---------- */
        setCurrentUser: (id) =>
          set((s) => ({ session: { ...s.session, currentUserId: id, openRequestId: null, composer: null } })),
        setProject: (id) => set((s) => ({ session: { ...s.session, projectId: id } })),
        openRequest: (id) => {
          set((s) => ({ session: { ...s.session, openRequestId: id } }));
          if (id) get().markSeen(id);
        },
        setComposer: (draft) => set((s) => ({ session: { ...s.session, composer: draft } })),
        setTreeFocus: (id) => set((s) => ({ session: { ...s.session, treeFocusId: id } })),

        /* ---------- requests ---------- */
        createRequest: (input) => {
          const id = uid();
          mutate((db) => {
            const me = get().session.currentUserId;
            const creator = userOf(db, me)!;
            const type = db.requestTypes.find((t) => t.id === input.typeId)!;
            const project = db.projects.find((p) => p.id === input.projectId)!;
            const ownerByRule = resolveFirstRecipient(type, {
              creator,
              users: db.users,
              projectManagerId: project.managerId,
              departmentSupervisor: (d) => db.departments.find((x) => x.id === d)?.supervisorId,
            });
            const recipient = input.recipientId ?? ownerByRule ?? project.managerId;
            const needsApproval =
              type.routing.approval === "project_manager" && me !== project.managerId;
            const approverId =
              type.routing.approval === "dept_supervisor"
                ? db.departments.find((d) => d.id === creator.departmentId)?.supervisorId ?? project.managerId
                : project.managerId;
            const status: RequestStatus = needsApproval ? "pending_approval" : "approved";
            const owner = needsApproval ? approverId : recipient;
            const created = nowIso();
            const deadline =
              input.deadline ??
              addDeadlineDays(new Date(created), type.routing.defaultDeadlineDays, db.company.settings).toISOString();
            const seq = db.requests.length + 1048;
            const parent = input.parentId ? reqOf(db, input.parentId) : undefined;
            const ref = parent
              ? `${parent.ref}-${db.requests.filter((r) => r.parentId === parent.id).length + 1}`
              : `REQ-${seq}`;
            const lines: RequestLine[] =
              type.routing.hasLines && typeof input.fields.count === "number"
                ? [{ id: uid(), description: same(String(input.fields.trade ?? "")), unit: same(""), qtyRequested: Number(input.fields.count), qtyDone: 0 }]
                : [];

            const r: Request = {
              id,
              companyId: db.company.id,
              projectId: input.projectId,
              typeId: input.typeId,
              ref,
              parentId: input.parentId,
              lineId: input.lineId,
              creatorId: me,
              ownerId: owner,
              returnToId: input.returnToId ?? me,
              status,
              priority: input.priority,
              text: same(input.text.trim()),
              fields: input.fields,
              lines,
              deadline,
              createdAt: created,
              closedAt: null,
              escalatedAt: null,
              version: 1,
              seenBy: [me],
            };
            db.requests = [...db.requests, r];
            audit(db, id, "created", me, needsApproval ? null : recipient, "");
            if (needsApproval) {
              audit(db, id, "submitted", me, approverId, "");
              notify(db, approverId, "direct", "new_request", id, {
                ar: `${creator.name.ar} يطلب اعتماد: ${r.text.ar}`,
                en: `${creator.name.en} requests approval: ${r.text.en}`,
              });
            } else if (recipient !== me) {
              notify(db, recipient, "direct", "new_request", id, {
                ar: `${creator.name.ar} أرسل إليك: ${r.text.ar}${r.priority === "urgent" ? " (عاجل)" : ""}`,
                en: `${creator.name.en} sent you: ${r.text.en}${r.priority === "urgent" ? " (urgent)" : ""}`,
              });
            }
            if (parent) {
              audit(db, parent.id, "subrequest_created", me, recipient, "");
              if (parent.status !== "awaiting_subrequests")
                patch(db, parent.id, { status: "awaiting_subrequests" });
            }
            if (input.fromMessageId) {
              db.messages = db.messages.map((m) =>
                m.id === input.fromMessageId ? { ...m, convertedToRequestId: id } : m,
              );
            }
          });
          return id;
        },

        approve: (id, note) =>
          mutate((db) => {
            const me = get().session.currentUserId;
            const r = reqOf(db, id);
            if (!r) return;
            const type = db.requestTypes.find((t) => t.id === r.typeId)!;
            const project = db.projects.find((p) => p.id === r.projectId)!;
            const creator = userOf(db, r.creatorId)!;
            const recipient =
              resolveFirstRecipient(type, {
                creator,
                users: db.users,
                projectManagerId: project.managerId,
                departmentSupervisor: (d) => db.departments.find((x) => x.id === d)?.supervisorId,
              }) ?? r.returnToId;
            patch(db, id, { status: "approved", ownerId: recipient });
            audit(db, id, "approved", me, recipient, note);
            notify(db, r.creatorId, "direct", "approved", id, {
              ar: `اعتُمد طلبك: ${r.text.ar}. وُجّه إلى ${nameOf(db, recipient).ar}`,
              en: `Your request was approved: ${r.text.en}. Routed to ${nameOf(db, recipient).en}`,
            });
            if (recipient !== r.creatorId)
              notify(db, recipient, "direct", "new_request", id, {
                ar: `وصلك طلب معتمد: ${r.text.ar}`,
                en: `Approved request arrived: ${r.text.en}`,
              });
          }),

        reject: (id, note) =>
          mutate((db) => {
            const me = get().session.currentUserId;
            const r = reqOf(db, id);
            if (!r) return;
            patch(db, id, { status: "rejected", closedAt: nowIso() });
            audit(db, id, "rejected", me, r.creatorId, note);
            notify(db, r.creatorId, "direct", "rejected", id, {
              ar: `رُفض طلبك: ${r.text.ar}`,
              en: `Your request was rejected: ${r.text.en}`,
            });
          }),

        requestClarification: (id, note) =>
          mutate((db) => {
            const me = get().session.currentUserId;
            const r = reqOf(db, id);
            if (!r) return;
            patch(db, id, { status: "pending_clarification", ownerId: r.creatorId });
            audit(db, id, "clarification_requested", me, r.creatorId, note);
            notify(db, r.creatorId, "direct", "clarification", id, {
              ar: `${nameOf(db, me).ar} طلب توضيحاً على: ${r.text.ar}`,
              en: `${nameOf(db, me).en} asked for clarification on: ${r.text.en}`,
            });
          }),

        clarify: (id, note) =>
          mutate((db) => {
            const me = get().session.currentUserId;
            const r = reqOf(db, id);
            if (!r) return;
            const project = db.projects.find((p) => p.id === r.projectId)!;
            patch(db, id, { status: "pending_approval", ownerId: project.managerId });
            audit(db, id, "clarified", me, project.managerId, note);
            notify(db, project.managerId, "direct", "new_request", id, {
              ar: `${nameOf(db, me).ar} ردّ على طلب التوضيح: ${r.text.ar}`,
              en: `${nameOf(db, me).en} answered the clarification: ${r.text.en}`,
            });
          }),

        start: (id) =>
          mutate((db) => {
            patch(db, id, { status: "in_progress" });
            audit(db, id, "started", get().session.currentUserId, null, "");
          }),

        complete: (id, note) =>
          mutate((db) => {
            const me = get().session.currentUserId;
            const r = reqOf(db, id);
            if (!r) return;
            patch(db, id, { status: "complete", ownerId: r.returnToId });
            audit(db, id, "completed", me, r.returnToId, note);
            if (r.returnToId !== me)
              notify(db, r.returnToId, "direct", "returned", id, {
                ar: `${nameOf(db, me).ar} أنجز: ${r.text.ar}. للمراجعة والإغلاق`,
                en: `${nameOf(db, me).en} completed: ${r.text.en}. Review and close`,
              });
          }),

        close: (id) =>
          mutate((db) => {
            const me = get().session.currentUserId;
            const r = reqOf(db, id);
            if (!r) return;
            patch(db, id, { status: "closed", closedAt: nowIso() });
            audit(db, id, "closed", me, null, "");
            settleParent(db, r.parentId, me);
          }),

        reopen: (id, note) =>
          mutate((db) => {
            const me = get().session.currentUserId;
            const r = reqOf(db, id);
            if (!r) return;
            const last = [...db.audit].reverse().find((a) => a.requestId === id && a.action === "completed");
            const backTo = last?.actorId ?? r.creatorId;
            patch(db, id, { status: "in_progress", ownerId: backTo });
            audit(db, id, "reopened", me, backTo, note);
            notify(db, backTo, "direct", "returned", id, {
              ar: `${nameOf(db, me).ar} أعاد إليك الطلب: ${r.text.ar}`,
              en: `${nameOf(db, me).en} sent the request back: ${r.text.en}`,
            });
          }),

        cancel: (id, note) =>
          mutate((db) => {
            const me = get().session.currentUserId;
            const r = reqOf(db, id);
            if (!r) return;
            patch(db, id, { status: "cancelled", closedAt: nowIso() });
            audit(db, id, "cancelled", me, null, note);
            // spec 6.1: cancelling closes every open sub-request
            for (const c of db.requests.filter((x) => x.parentId === id && isOpen(x.status))) {
              patch(db, c.id, { status: "cancelled", closedAt: nowIso() });
              audit(db, c.id, "cancelled", me, null, "");
            }
            if (r.ownerId !== me)
              notify(db, r.ownerId, "direct", "rejected", id, {
                ar: `أُلغي الطلب: ${r.text.ar}`,
                en: `Request cancelled: ${r.text.en}`,
              });
          }),

        transfer: (id, toUserId, note) =>
          mutate((db) => {
            const me = get().session.currentUserId;
            const r = reqOf(db, id);
            if (!r) return;
            const offPath = directionOf(db.users, me, toUserId) === "cross";
            patch(db, id, { ownerId: toUserId, status: r.status === "approved" ? "approved" : "in_progress" });
            audit(db, id, "transferred", me, toUserId, note, offPath);
            notify(db, toUserId, "direct", "new_request", id, {
              ar: `${nameOf(db, me).ar} حوّل إليك: ${r.text.ar}`,
              en: `${nameOf(db, me).en} transferred to you: ${r.text.en}`,
            });
          }),

        returnToSender: (id, note) =>
          mutate((db) => {
            const me = get().session.currentUserId;
            const r = reqOf(db, id);
            if (!r) return;
            const prev = [...db.audit]
              .reverse()
              .find((a) => a.requestId === id && a.toUserId === me && a.actorId !== me);
            const backTo = prev?.actorId ?? r.creatorId;
            patch(db, id, { ownerId: backTo, status: "in_progress" });
            audit(db, id, "returned", me, backTo, note);
            notify(db, backTo, "direct", "returned", id, {
              ar: `${nameOf(db, me).ar} أعاد إليك: ${r.text.ar}`,
              en: `${nameOf(db, me).en} returned to you: ${r.text.en}`,
            });
          }),

        extend: (id, newDeadline, reason) =>
          mutate((db) => {
            const me = get().session.currentUserId;
            const r = reqOf(db, id);
            if (!r) return;
            const seq = db.deadlineLogs.filter((d) => d.requestId === id).length + 1;
            db.deadlineLogs = [
              ...db.deadlineLogs,
              { id: uid(), requestId: id, seq, from: r.deadline, to: newDeadline, reason: same(reason), actorId: me, at: nowIso() },
            ];
            patch(db, id, { deadline: newDeadline, escalatedAt: null });
            audit(db, id, "extended", me, null, reason);
          }),

        recordProgress: (id, lineId, qtyDone) =>
          mutate((db) => {
            const me = get().session.currentUserId;
            const r = reqOf(db, id);
            if (!r) return;
            const lines = r.lines.map((ln) => (ln.id === lineId ? { ...ln, qtyDone } : ln));
            const total = lines.reduce((s, x) => s + x.qtyRequested, 0);
            const done = lines.reduce((s, x) => s + Math.min(x.qtyDone, x.qtyRequested), 0);
            const status: RequestStatus =
              done > 0 && done < total && r.status === "in_progress" ? "partially_done" : r.status;
            patch(db, id, { lines, status });
            audit(db, id, "progress", me, null, `${done}/${total}`);
          }),

        markSeen: (id) =>
          mutate((db) => {
            const me = get().session.currentUserId;
            const r = reqOf(db, id);
            if (!r || r.seenBy.includes(me)) return;
            db.requests = db.requests.map((x) => (x.id === id ? { ...x, seenBy: [...x.seenBy, me] } : x));
          }),

        /* ---------- chat + notifications ---------- */
        sendMessage: (projectId, requestId, text) =>
          mutate((db) => {
            const m: Message = {
              id: uid(),
              projectId,
              requestId,
              senderId: get().session.currentUserId,
              text: same(text.trim()),
              at: nowIso(),
              convertedToRequestId: null,
            };
            db.messages = [...db.messages, m];
          }),

        markNotificationRead: (id) =>
          mutate((db) => {
            db.notifications = db.notifications.map((n) =>
              n.id === id && !n.readAt ? { ...n, readAt: nowIso() } : n,
            );
          }),

        markAllRead: () =>
          mutate((db) => {
            const me = get().session.currentUserId;
            db.notifications = db.notifications.map((n) =>
              n.userId === me && !n.readAt ? { ...n, readAt: nowIso() } : n,
            );
          }),

        runEscalations: () => {
          const now = Date.now();
          const due = get().db.requests.filter((r) => isLate(r, now) && !r.escalatedAt);
          if (!due.length) return;
          mutate((db) => {
            for (const r of due) escalate(db, r, nowIso());
          });
        },

        /* ---------- admin ---------- */
        updateSettings: (p) =>
          mutate((db) => {
            db.company = { ...db.company, settings: { ...db.company.settings, ...p } };
          }),

        addUser: (input) => {
          const id = `u_${uid()}`;
          mutate((db) => {
            const u: User = {
              id,
              companyId: db.company.id,
              name: same(input.name.trim()),
              title: same(input.title.trim()),
              departmentId: input.departmentId,
              managerId: input.managerId,
              role: input.role,
              hue: Math.floor(Math.random() * 360),
              active: true,
            };
            db.users = [...db.users, u];
            const pid = get().session.projectId;
            if (pid) db.projects = db.projects.map((p) => (p.id === pid ? { ...p, memberIds: [...p.memberIds, id] } : p));
          });
          return id;
        },

        updateCompanyName: (name) =>
          mutate((db) => {
            db.company = { ...db.company, name: same(name.trim()) };
          }),

        updateUser: (id, patch) =>
          mutate((db) => {
            db.users = db.users.map((u) =>
              u.id === id
                ? {
                    ...u,
                    ...(patch.name !== undefined ? { name: same(patch.name.trim()) } : {}),
                    ...(patch.title !== undefined ? { title: same(patch.title.trim()) } : {}),
                    ...(patch.departmentId !== undefined ? { departmentId: patch.departmentId } : {}),
                    ...(patch.managerId !== undefined ? { managerId: patch.managerId } : {}),
                    ...(patch.role !== undefined ? { role: patch.role } : {}),
                  }
                : u,
            );
          }),

        addDepartment: (name, supervisorId) => {
          const id = `d_${uid()}`;
          mutate((db) => {
            db.departments = [...db.departments, { id, companyId: db.company.id, name: same(name.trim()), supervisorId }];
          });
          return id;
        },

        addProject: (input) => {
          const id = `p_${uid()}`;
          mutate((db) => {
            const seq = db.projects.length + 1;
            db.projects = [
              ...db.projects,
              {
                id,
                companyId: db.company.id,
                ref: `PRJ-${new Date().getFullYear().toString().slice(2)}-${String(seq).padStart(3, "0")}`,
                name: same(input.name.trim()),
                client: same(input.client.trim()),
                phase: input.phase,
                managerId: input.managerId,
                siteSupervisorId: input.siteSupervisorId,
                memberIds: Array.from(new Set([...input.memberIds, input.managerId, input.siteSupervisorId])),
              },
            ];
          });
          set((st) => ({ session: { ...st.session, projectId: id } }));
          return id;
        },

        addRequestType: (input) => {
          const id = `t_${uid()}`;
          mutate((db) => {
            db.requestTypes = [
              ...db.requestTypes,
              {
                id,
                companyId: db.company.id,
                name: same(input.name.trim()),
                fields: input.fields
                  .filter((f) => f.label.trim())
                  .map((f, i) => ({
                    key: `f${i + 1}`,
                    label: same(f.label.trim()),
                    kind: f.kind,
                    options: f.kind === "select" ? f.options.map((o) => same(o.trim())).filter((o) => o.ar) : undefined,
                  })),
                routing: {
                  firstRecipient: { kind: "chosen" },
                  approval: input.approval,
                  defaultDeadlineDays: Math.max(1, input.defaultDeadlineDays || 3),
                  requiredAttachments: [],
                  hasLines: input.hasLines,
                },
              },
            ];
          });
          return id;
        },

        resetDemo: () => set({ ...fresh() }),
        startBlank: () => set({ ...blank() }),
      };
    },
    {
      name: "flowline-demo",
      version: SEED_VERSION,
      // an older seed on the device is simply replaced
      migrate: () => fresh() as unknown as EngineState,
      storage: createJSONStorage(() => localStorage),
      // transient UI (open sheet, composer draft) is not persisted
      partialize: (s) => ({
        db: s.db,
        session: { ...s.session, openRequestId: null, composer: null },
      }),
      skipHydration: true,
      onRehydrateStorage: () => (state) => {
        state?.runEscalations();
      },
    },
  ),
);

/* ---------- selectors (pure, memo-friendly) ---------- */

export const selectMe = (s: EngineState): User =>
  s.db.users.find((u) => u.id === s.session.currentUserId) ?? s.db.users[0];

export const selectUnreadCount = (s: EngineState): number =>
  s.db.notifications.filter((n) => n.userId === s.session.currentUserId && !n.readAt).length;
