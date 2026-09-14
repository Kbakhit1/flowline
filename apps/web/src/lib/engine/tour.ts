"use client";

import { create } from "zustand";
import type { DbSnapshot, Request } from "./types";
import { useEngine } from "./store";

/** Texts the tour writes on the user's behalf, in the UI language. */
const COPY = {
  ar: {
    request: "15 عاملاً لأعمال التشطيب في الدور الثالث، ابتداءً من الأحد",
    approve: "معتمد. التنسيق مع مشرف الموقع على موعد الحضور.",
    subA: "10 عمال من المقاول الفرعي الأمانة، تأكيد الحضور يوم الأحد",
    subB: "5 عمال من شركة التوريد المتحدة",
    complete: "تم التأكيد، العمال في الموقع يوم الأحد.",
    finish: "تم توفير 15 عاملاً كاملاً من مصدرين.",
  },
  en: {
    request: "15 workers for finishing works on the 3rd floor, starting Sunday",
    approve: "Approved. Coordinate the arrival date with the site supervisor.",
    subA: "10 workers from Al-Amana subcontractor, confirm attendance for Sunday",
    subB: "5 workers from United Supply",
    complete: "Confirmed, the workers are on site on Sunday.",
    finish: "All 15 workers provided from two sources.",
  },
} as const;

function copy() {
  try {
    const raw = localStorage.getItem("flowline-ui-v1");
    const locale = raw ? (JSON.parse(raw)?.state?.locale as "ar" | "en" | undefined) : undefined;
    return COPY[locale === "en" ? "en" : "ar"];
  } catch {
    return COPY.ar;
  }
}

/**
 * Guided tour: one request travels the whole cycle. Every step names the persona,
 * where to be, what to press — and can also perform the action itself. Completion
 * is detected from the data, so the user may do each step by hand instead.
 */

export type TourStepId =
  | "intro"
  | "create"
  | "approve"
  | "split"
  | "complete"
  | "closeSubs"
  | "finish"
  | "close"
  | "lines"
  | "notifications"
  | "end";

export const TOUR_STEPS: TourStepId[] = [
  "intro",
  "create",
  "approve",
  "split",
  "complete",
  "closeSubs",
  "finish",
  "close",
  "lines",
  "notifications",
  "end",
];

/** Personas of the seeded company that play the story. */
export const CAST = { site: "u6", pm: "u2", laborSup: "u7", coordinator: "u8" } as const;

export interface TourRefs {
  rootId: string | null;
  subIds: string[];
}

interface TourState {
  active: boolean;
  index: number;
  startedAt: string | null;
  refs: TourRefs;
  start: () => void;
  stop: () => void;
  next: () => void;
  prev: () => void;
  setRefs: (r: Partial<TourRefs>) => void;
}

export const useTour = create<TourState>()((set) => ({
  active: false,
  index: 0,
  startedAt: null,
  refs: { rootId: null, subIds: [] },
  start: () => set({ active: true, index: 0, startedAt: new Date().toISOString(), refs: { rootId: null, subIds: [] } }),
  stop: () => set({ active: false }),
  next: () => set((s) => ({ index: Math.min(TOUR_STEPS.length - 1, s.index + 1) })),
  prev: () => set((s) => ({ index: Math.max(0, s.index - 1) })),
  setRefs: (r) => set((s) => ({ refs: { ...s.refs, ...r } })),
}));

/* ---------- where each step lives ---------- */

export interface StepSpec {
  persona: string | null;
  route: string;
  /** request to open in the detail sheet, resolved from refs */
  open: (refs: TourRefs) => string | null;
  target: string | null;
  /** true when the data shows the step was done (by hand or automatically) */
  done: (db: DbSnapshot, refs: TourRefs, startedAt: string) => boolean;
  /** performs the step */
  run: (refs: TourRefs) => void;
}

const req = (db: DbSnapshot, id: string | null) => (id ? db.requests.find((r) => r.id === id) : undefined);
const kids = (db: DbSnapshot, id: string | null) => (id ? db.requests.filter((r) => r.parentId === id) : []);

/** Finds the request the tour is following, even if the user created it by hand. */
export function discoverRoot(db: DbSnapshot, refs: TourRefs, startedAt: string): Request | undefined {
  if (refs.rootId) return req(db, refs.rootId);
  return db.requests.find((r) => r.creatorId === CAST.site && r.typeId === "t_labor" && !r.parentId && r.createdAt >= startedAt);
}

export const STEP_SPECS: Record<TourStepId, StepSpec> = {
  intro: {
    persona: CAST.site,
    route: "/app",
    open: () => null,
    target: null,
    done: () => true,
    run: () => {},
  },
  create: {
    persona: CAST.site,
    route: "/app",
    open: () => null,
    target: "composer",
    done: (db, refs, startedAt) => !!discoverRoot(db, refs, startedAt),
    run: () => {
      const st = useEngine.getState();
      st.setCurrentUser(CAST.site);
      const id = st.createRequest({
        projectId: "p1",
        typeId: "t_labor",
        text: copy().request,
        recipientId: null,
        priority: "urgent",
        deadline: null,
        fields: { trade: "عامل عادي", count: 15, days: 10 },
        parentId: null,
        lineId: null,
        returnToId: null,
        fromMessageId: null,
      });
      useTour.getState().setRefs({ rootId: id });
    },
  },
  approve: {
    persona: CAST.pm,
    route: "/app",
    open: (refs) => refs.rootId,
    target: "sheet-actions",
    done: (db, refs) => {
      const r = req(db, refs.rootId);
      return !!r && r.status !== "pending_approval" && r.status !== "pending_clarification" && r.status !== "draft";
    },
    run: (refs) => {
      const st = useEngine.getState();
      st.setCurrentUser(CAST.pm);
      if (refs.rootId) st.approve(refs.rootId, copy().approve);
    },
  },
  split: {
    persona: CAST.laborSup,
    route: "/app",
    open: (refs) => refs.rootId,
    target: "sheet-actions",
    done: (db, refs) => kids(db, refs.rootId).length >= 2,
    run: (refs) => {
      const st = useEngine.getState();
      st.setCurrentUser(CAST.laborSup);
      if (!refs.rootId) return;
      const root = req(st.db, refs.rootId);
      const base = {
        projectId: "p1",
        typeId: "t_task",
        recipientId: CAST.coordinator,
        priority: "urgent" as const,
        deadline: null,
        fields: {},
        parentId: refs.rootId,
        lineId: root?.lines[0]?.id ?? null,
        returnToId: CAST.laborSup,
        fromMessageId: null,
      };
      const a = st.createRequest({ ...base, text: copy().subA });
      const b = useEngine.getState().createRequest({ ...base, text: copy().subB });
      useTour.getState().setRefs({ subIds: [a, b] });
    },
  },
  complete: {
    persona: CAST.coordinator,
    route: "/app",
    open: (refs) => refs.subIds[0] ?? null,
    target: "sheet-actions",
    done: (db, refs) => {
      const ks = kids(db, refs.rootId);
      return ks.length >= 2 && ks.every((k) => k.status === "complete" || k.status === "closed");
    },
    run: (refs) => {
      const st = useEngine.getState();
      st.setCurrentUser(CAST.coordinator);
      for (const id of kids(st.db, refs.rootId).map((k) => k.id)) {
        const r = req(useEngine.getState().db, id);
        if (r && (r.status === "approved" || r.status === "in_progress")) useEngine.getState().complete(id, copy().complete);
      }
    },
  },
  closeSubs: {
    persona: CAST.laborSup,
    route: "/app",
    open: (refs) => refs.subIds[0] ?? null,
    target: "sheet-actions",
    done: (db, refs) => {
      const r = req(db, refs.rootId);
      return !!r && kids(db, refs.rootId).every((k) => k.status === "closed") && r.status !== "awaiting_subrequests";
    },
    run: (refs) => {
      const st = useEngine.getState();
      st.setCurrentUser(CAST.laborSup);
      for (const k of kids(st.db, refs.rootId)) {
        const r = req(useEngine.getState().db, k.id);
        if (r?.status === "complete") useEngine.getState().close(k.id);
      }
    },
  },
  finish: {
    persona: CAST.laborSup,
    route: "/app",
    open: (refs) => refs.rootId,
    target: "sheet-actions",
    done: (db, refs) => {
      const r = req(db, refs.rootId);
      return !!r && (r.status === "complete" || r.status === "closed");
    },
    run: (refs) => {
      const st = useEngine.getState();
      st.setCurrentUser(CAST.laborSup);
      if (refs.rootId) st.complete(refs.rootId, copy().finish);
    },
  },
  close: {
    persona: CAST.site,
    route: "/app",
    open: (refs) => refs.rootId,
    target: "sheet-actions",
    done: (db, refs) => req(db, refs.rootId)?.status === "closed",
    run: (refs) => {
      const st = useEngine.getState();
      st.setCurrentUser(CAST.site);
      if (refs.rootId) st.close(refs.rootId);
    },
  },
  lines: {
    persona: CAST.site,
    route: "/app/tree",
    open: () => null,
    target: "lines-toggle",
    done: () => true,
    run: (refs) => {
      const st = useEngine.getState();
      st.setTreeView("lines");
      st.setLinesFocus(refs.rootId);
    },
  },
  notifications: {
    persona: CAST.site,
    route: "/app/notifications",
    open: () => null,
    target: null,
    done: () => true,
    run: () => {},
  },
  end: {
    persona: null,
    route: "/app",
    open: () => null,
    target: null,
    done: () => true,
    run: () => {},
  },
};
