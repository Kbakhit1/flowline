"use client";

import { create } from "zustand";
import type { DbSnapshot, Request } from "./types";
import { useEngine } from "./store";

/**
 * Guided tours. Every step names the persona, where to be, what to press — and
 * can also perform the action itself. Completion is detected from the data, so
 * the user may do each step by hand instead.
 */

export type TourId = "cycle" | "replies";

/** Texts the tours write on the user's behalf, in the UI language. */
const COPY = {
  ar: {
    request: "15 عاملاً لأعمال التشطيب في الدور الثالث، ابتداءً من الأحد",
    approve: "معتمد. التنسيق مع مشرف الموقع على موعد الحضور.",
    subA: "10 عمال من المقاول الفرعي الأمانة، تأكيد الحضور يوم الأحد",
    subB: "5 عمال من شركة التوريد المتحدة",
    complete: "تم التأكيد، العمال في الموقع يوم الأحد.",
    finish: "تم توفير 15 عاملاً كاملاً من مصدرين.",
    clarifyQ: "أي مورد؟ وهل السعر شامل النقل إلى الموقع؟",
    clarifyA: "المورد: الجزيرة للسيراميك. السعر شامل النقل والتنزيل.",
    approveMaterial: "معتمد بعد التوضيح. المشتريات تكمل التعاقد.",
    permitA: "الإغلاق يوم السبت القادم من 6 صباحاً حتى 2 ظهراً.",
    rejectPermit: "الرافعة ستُركّب من داخل الموقع، لا حاجة لإغلاق الشارع.",
    returnReason: "الملف المرفق ناقص صفحات 7 إلى 12. أرجو إرسال النسخة الكاملة.",
    reopenNote: "أرجو إضافة الدرجة الرابعة التي طلبها العميل هاتفياً.",
    transferNote: "سارة، أكملي التقرير بدلاً مني هذا الأسبوع لسفري.",
    extendReason: "الاستشاري لم يعتمد النسخة النهائية بعد.",
    threadReply: "أرسلت النسخة المختومة للاستشاري صباح اليوم، بانتظار الرد.",
    chatMsg: "نحتاج صور تقدم الأعمال اليومية في القناة ابتداءً من الغد.",
  },
  en: {
    request: "15 workers for finishing works on the 3rd floor, starting Sunday",
    approve: "Approved. Coordinate the arrival date with the site supervisor.",
    subA: "10 workers from Al-Amana subcontractor, confirm attendance for Sunday",
    subB: "5 workers from United Supply",
    complete: "Confirmed, the workers are on site on Sunday.",
    finish: "All 15 workers provided from two sources.",
    clarifyQ: "Which supplier? And does the price include delivery to site?",
    clarifyA: "Supplier: Al-Jazeera Ceramics. Price includes delivery and unloading.",
    approveMaterial: "Approved after clarification. Procurement completes the contract.",
    permitA: "Closure next Saturday from 6 am to 2 pm.",
    rejectPermit: "The crane will be installed from inside the site; no street closure needed.",
    returnReason: "The attached file is missing pages 7 to 12. Please send the full copy.",
    reopenNote: "Please add the fourth shade the client asked for by phone.",
    transferNote: "Sara, please finish the report for me this week while I travel.",
    extendReason: "The consultant has not approved the final version yet.",
    threadReply: "Sent the stamped copy to the consultant this morning, awaiting reply.",
    chatMsg: "We need daily progress photos in the channel starting tomorrow.",
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

/** Personas of the seeded company that play the stories. */
export const CAST = { site: "u6", pm: "u2", laborSup: "u7", coordinator: "u8", finishing: "u5", civil: "u3", mep: "u4" } as const;

export interface TourRefs {
  rootId: string | null;
  subIds: string[];
}

interface TourState {
  active: boolean;
  tourId: TourId;
  index: number;
  startedAt: string | null;
  refs: TourRefs;
  start: (id?: TourId) => void;
  stop: () => void;
  next: () => void;
  prev: () => void;
  setRefs: (r: Partial<TourRefs>) => void;
}

export const useTour = create<TourState>()((set) => ({
  active: false,
  tourId: "cycle",
  index: 0,
  startedAt: null,
  refs: { rootId: null, subIds: [] },
  start: (id = "cycle") =>
    set({ active: true, tourId: id, index: 0, startedAt: new Date().toISOString(), refs: { rootId: null, subIds: [] } }),
  stop: () => set({ active: false }),
  next: () => set((s) => ({ index: Math.min(TOURS[s.tourId].steps.length - 1, s.index + 1) })),
  prev: () => set((s) => ({ index: Math.max(0, s.index - 1) })),
  setRefs: (r) => set((s) => ({ refs: { ...s.refs, ...r } })),
}));

/* ---------- step specs ---------- */

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
  /** steps that only look (no run button) */
  passive?: boolean;
}

export interface TourDef {
  steps: string[];
  specs: Record<string, StepSpec>;
}

const req = (db: DbSnapshot, id: string | null) => (id ? db.requests.find((r) => r.id === id) : undefined);
const kids = (db: DbSnapshot, id: string | null) => (id ? db.requests.filter((r) => r.parentId === id) : []);
const has = (db: DbSnapshot, requestId: string, action: string, since: string) =>
  db.audit.some((a) => a.requestId === requestId && a.action === action && a.at >= since);
const as = (userId: string) => {
  const st = useEngine.getState();
  st.setCurrentUser(userId);
  return useEngine.getState();
};

/** Finds the request the cycle tour is following, even if the user created it by hand. */
export function discoverRoot(db: DbSnapshot, refs: TourRefs, startedAt: string): Request | undefined {
  if (refs.rootId) return req(db, refs.rootId);
  return db.requests.find((r) => r.creatorId === CAST.site && r.typeId === "t_labor" && !r.parentId && r.createdAt >= startedAt);
}

const look = (persona: string | null, route: string, target: string | null = null): StepSpec => ({
  persona,
  route,
  open: () => null,
  target,
  done: () => true,
  run: () => {},
  passive: true,
});

/* ---------- tour 1: the full cycle ---------- */

const cycle: TourDef = {
  steps: ["intro", "create", "approve", "split", "complete", "closeSubs", "finish", "close", "lines", "notifications", "end"],
  specs: {
    intro: look(CAST.site, "/app"),
    create: {
      persona: CAST.site,
      route: "/app",
      open: () => null,
      target: "composer",
      done: (db, refs, startedAt) => !!discoverRoot(db, refs, startedAt),
      run: () => {
        const st = as(CAST.site);
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
        const st = as(CAST.pm);
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
        const st = as(CAST.laborSup);
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
        const st = as(CAST.coordinator);
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
        const st = as(CAST.laborSup);
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
        const st = as(CAST.laborSup);
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
        const st = as(CAST.site);
        if (refs.rootId) st.close(refs.rootId);
      },
    },
    lines: {
      ...look(CAST.site, "/app/tree", "lines-toggle"),
      run: (refs) => {
        const st = useEngine.getState();
        st.setTreeView("lines");
        st.setLinesFocus(refs.rootId);
      },
    },
    notifications: look(CAST.site, "/app/notifications"),
    end: look(null, "/app"),
  },
};

/* ---------- tour 2: every kind of reply, on the seeded requests ---------- */

const R = { material: "r5", permit: "r7", drawings: "r2", paint: "r6", weekly: "r11", loads: "r3" } as const;

const replies: TourDef = {
  steps: ["intro", "askClarify", "answerClarify", "approveAfter", "answerPermit", "rejectPermit", "returnSender", "reopen", "transfer", "extend", "thread", "chat", "notifications", "end"],
  specs: {
    intro: look(CAST.pm, "/app"),
    askClarify: {
      persona: CAST.pm,
      route: "/app",
      open: () => R.material,
      target: "sheet-actions",
      done: (db, _r, since) => has(db, R.material, "clarification_requested", since),
      run: () => as(CAST.pm).requestClarification(R.material, copy().clarifyQ),
    },
    answerClarify: {
      persona: CAST.finishing,
      route: "/app",
      open: () => R.material,
      target: "sheet-actions",
      done: (db, _r, since) => has(db, R.material, "clarified", since),
      run: () => as(CAST.finishing).clarify(R.material, copy().clarifyA),
    },
    approveAfter: {
      persona: CAST.pm,
      route: "/app",
      open: () => R.material,
      target: "sheet-actions",
      done: (db, _r, since) => has(db, R.material, "approved", since),
      run: () => as(CAST.pm).approve(R.material, copy().approveMaterial),
    },
    answerPermit: {
      persona: CAST.site,
      route: "/app",
      open: () => R.permit,
      target: "sheet-actions",
      done: (db, _r, since) => has(db, R.permit, "clarified", since),
      run: () => as(CAST.site).clarify(R.permit, copy().permitA),
    },
    rejectPermit: {
      persona: CAST.pm,
      route: "/app",
      open: () => R.permit,
      target: "sheet-actions",
      done: (db) => req(db, R.permit)?.status === "rejected",
      run: () => as(CAST.pm).reject(R.permit, copy().rejectPermit),
    },
    returnSender: {
      persona: CAST.civil,
      route: "/app",
      open: () => R.drawings,
      target: "sheet-actions",
      done: (db, _r, since) => has(db, R.drawings, "returned", since),
      run: () => as(CAST.civil).returnToSender(R.drawings, copy().returnReason),
    },
    reopen: {
      persona: CAST.pm,
      route: "/app",
      open: () => R.paint,
      target: "sheet-actions",
      done: (db, _r, since) => has(db, R.paint, "reopened", since),
      run: () => as(CAST.pm).reopen(R.paint, copy().reopenNote),
    },
    transfer: {
      persona: CAST.pm,
      route: "/app",
      open: () => R.weekly,
      target: "sheet-actions",
      done: (db, _r, since) => has(db, R.weekly, "transferred", since),
      run: () => as(CAST.pm).transfer(R.weekly, CAST.civil, copy().transferNote),
    },
    extend: {
      persona: CAST.mep,
      route: "/app",
      open: () => R.loads,
      target: "sheet-actions",
      done: (db, _r, since) => has(db, R.loads, "extended", since),
      run: () => {
        const st = as(CAST.mep);
        const d = new Date();
        d.setDate(d.getDate() + 3);
        d.setHours(17, 0, 0, 0);
        st.extend(R.loads, d.toISOString(), copy().extendReason);
      },
    },
    thread: {
      persona: CAST.mep,
      route: "/app",
      open: () => R.loads,
      target: "sheet-thread",
      done: (db, _r, since) => db.messages.some((m) => m.requestId === R.loads && m.senderId === CAST.mep && m.at >= since),
      run: () => as(CAST.mep).sendMessage("p1", R.loads, copy().threadReply),
    },
    chat: {
      persona: CAST.pm,
      route: "/app/chat",
      open: () => null,
      target: "chat-list",
      done: (db, _r, since) => db.messages.some((m) => m.requestId === null && m.convertedToRequestId && m.at >= since),
      run: () => {
        const st = as(CAST.pm);
        st.sendMessage("p1", null, copy().chatMsg);
        const msg = [...useEngine.getState().db.messages].reverse().find((m) => m.requestId === null && m.senderId === CAST.pm);
        if (!msg) return;
        useEngine.getState().createRequest({
          projectId: "p1",
          typeId: "t_task",
          text: msg.text.ar,
          recipientId: CAST.site,
          priority: "normal",
          deadline: null,
          fields: {},
          parentId: null,
          lineId: null,
          returnToId: null,
          fromMessageId: msg.id,
        });
      },
    },
    notifications: look(CAST.finishing, "/app/notifications"),
    end: look(null, "/app"),
  },
};

export const TOURS: Record<TourId, TourDef> = { cycle, replies };
