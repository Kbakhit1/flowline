"use client";

import { useEffect, useMemo, useState } from "react";
import { useEngine, selectMe } from "./store";
import type { Request, User } from "./types";
import { ancestorIds, directReports, isOpen, sortInbox, subtreeIds } from "./rules";

/** Ticks every minute so relative times and lateness stay honest. */
export function useNow(): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 60_000);
    return () => clearInterval(id);
  }, []);
  return now;
}

export interface InboxGroups {
  mine: Request[];
  approvals: Request[];
  awaiting: Request[];
  sent: Request[];
  team: Request[];
}

/** The inbox partition per spec 9.1 (+ "sent" and "team" from our design). */
export function useInbox(): InboxGroups {
  const me = useEngine(selectMe);
  const requests = useEngine((s) => s.db.requests);
  const users = useEngine((s) => s.db.users);
  const projectId = useEngine((s) => s.session.projectId);
  const now = useNow();

  return useMemo(() => {
    const inProject = requests.filter((r) => r.projectId === projectId);
    const owned = inProject.filter((r) => r.ownerId === me.id);

    const approvals = owned.filter((r) => r.status === "pending_approval");
    const awaiting = owned.filter((r) => r.status === "awaiting_subrequests");
    // "complete" requests sit with return-to for review, so they belong in "mine" (action: close)
    const mine = owned.filter(
      (r) =>
        (isOpen(r.status) || r.status === "complete") &&
        r.status !== "pending_approval" &&
        r.status !== "awaiting_subrequests" &&
        r.status !== "draft",
    );
    const sent = inProject.filter(
      (r) => r.creatorId === me.id && r.ownerId !== me.id && (isOpen(r.status) || recent(r, now)),
    );
    const below = subtreeIds(users, me.id);
    const team = inProject.filter((r) => below.has(r.ownerId) && isOpen(r.status));

    return {
      mine: sortInbox(mine, now),
      approvals: sortInbox(approvals, now),
      awaiting: sortInbox(awaiting, now),
      sent: sortInbox(sent, now),
      team: sortInbox(team, now),
    };
  }, [requests, users, me.id, projectId, now]);
}

function recent(r: Request, now: number): boolean {
  return !!r.closedAt && now - new Date(r.closedAt).getTime() < 3 * 24 * 3_600_000;
}

export interface PeopleGroups {
  team: User[];
  manager: User | null;
  others: User[];
}

/** Recipient groups for the bubble: my direct reports, my manager, everyone else in the project. */
export function usePeople(projectId: string): PeopleGroups {
  const me = useEngine(selectMe);
  const users = useEngine((s) => s.db.users);
  const project = useEngine((s) => s.db.projects.find((p) => p.id === projectId));
  return useMemo(() => {
    const members = users.filter((u) => u.active && u.id !== me.id && (project?.memberIds.includes(u.id) ?? true));
    // my whole branch, direct reports first
    const below = subtreeIds(users, me.id);
    const direct = directReports(members, me.id);
    const deeper = members.filter((u) => below.has(u.id) && u.managerId !== me.id);
    const team = [...direct, ...deeper];
    const manager = members.find((u) => u.id === me.managerId) ?? null;
    const anc = new Set(ancestorIds(users, me.id));
    const others = members.filter((u) => !below.has(u.id) && u.id !== me.managerId && !anc.has(u.id));
    return { team, manager, others };
  }, [users, me, project]);
}

export function useRequest(id: string | null) {
  return useEngine((s) => (id ? s.db.requests.find((r) => r.id === id) ?? null : null));
}

export function useUser(id: string | null | undefined): User | undefined {
  return useEngine((s) => (id ? s.db.users.find((u) => u.id === id) : undefined));
}

export function useIsDesktop(): boolean {
  const [desktop, setDesktop] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(min-width: 768px)");
    const on = () => setDesktop(mq.matches);
    on();
    mq.addEventListener("change", on);
    return () => mq.removeEventListener("change", on);
  }, []);
  return desktop;
}
