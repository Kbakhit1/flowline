"use client";

import { useMemo } from "react";
import { create } from "zustand";
import { useEngine, selectMe, type ComposerDraft } from "./store";

export const STEPS = ["company", "departments", "people", "project", "types", "first"] as const;
export type Step = (typeof STEPS)[number];

/** Which steps are satisfied by the data itself (the sheet never stores "done" flags). */
export function useSetupStatus() {
  const company = useEngine((s) => s.db.company);
  const users = useEngine((s) => s.db.users);
  const departments = useEngine((s) => s.db.departments);
  const projects = useEngine((s) => s.db.projects);
  const types = useEngine((s) => s.db.requestTypes);
  const requests = useEngine((s) => s.db.requests);
  const me = useEngine(selectMe);
  return useMemo(() => {
    const done: Record<Step, boolean> = {
      company: company.name.ar.trim().length > 0 && me.name.ar.trim().length > 0,
      departments: departments.length > 0,
      people: users.filter((u) => u.active).length >= 2,
      project: projects.length > 0,
      types: types.length > 0,
      first: requests.length > 0,
    };
    const count = STEPS.filter((s) => done[s]).length;
    return { done, count, complete: count === STEPS.length };
  }, [company, users, departments, projects, types, requests, me]);
}

/** The first-bubble draft the sheet hands to its composer (filled by autofill, cleared on send). Not persisted. */
export const useSetupDraft = create<{ draft: ComposerDraft | null; setDraft: (d: ComposerDraft | null) => void }>()((set) => ({
  draft: null,
  setDraft: (draft) => set({ draft }),
}));

/* ---------- sample data for the "fill automatically" buttons ---------- */

const SAMPLE = {
  company: "شركة النماء للمقاولات",
  owner: { name: "م. ماجد العتيبي", title: "المدير العام" },
  departments: ["الهندسة", "العمالة", "المشتريات", "المالية"],
  people: [
    // [name, title, department, manager (by name or "owner"), role]
    ["م. سلمان الحربي", "مسؤول المشروع", "الهندسة", "owner", "project_manager"],
    ["م. ريم القحطاني", "مهندسة مدني", "الهندسة", "م. سلمان الحربي", "employee"],
    ["م. عمر السيد", "مهندس كهرباء", "الهندسة", "م. سلمان الحربي", "employee"],
    ["ناصر الدوسري", "مشرف الموقع", "الهندسة", "م. سلمان الحربي", "site_supervisor"],
    ["عبدالرحمن المطيري", "مشرف قسم العمالة", "العمالة", "owner", "dept_supervisor"],
    ["هاني يوسف", "منسق عمالة", "العمالة", "عبدالرحمن المطيري", "employee"],
    ["سارة الشمري", "محاسبة المشروع", "المالية", "owner", "employee"],
    ["فيصل العنزي", "مسؤول المشتريات", "المشتريات", "owner", "employee"],
  ] as const,
  supervisors: { الهندسة: "م. سلمان الحربي", العمالة: "عبدالرحمن المطيري", المالية: "سارة الشمري", المشتريات: "فيصل العنزي" } as Record<string, string>,
  project: { name: "مجمع الياسمين السكني", client: "شركة الياسمين العقارية", manager: "م. سلمان الحربي", site: "ناصر الدوسري" },
  types: [
    { name: "طلب عمالة", approval: "project_manager" as const, days: 5, hasLines: true, fields: [{ label: "التخصص", kind: "select" as const, options: ["عامل عادي", "حداد", "نجار", "كهربائي"] }, { label: "العدد", kind: "number" as const, options: [] }] },
    { name: "شراء مواد", approval: "project_manager" as const, days: 7, hasLines: false, fields: [{ label: "الصنف", kind: "text" as const, options: [] }, { label: "الكمية", kind: "number" as const, options: [] }] },
  ],
  first: { text: "إعداد جدول التنفيذ الأسبوعي وإرساله قبل الخميس", to: "م. سلمان الحربي" },
};

/**
 * Fills one step of the sheet with sample data. Safe to call more than once: it only adds what is missing.
 * "fields" (the step button) fills what the user sees and leaves the sending to them;
 * "commit" (fill the whole sheet) finishes the step outright.
 */
export function autofill(step: Step, mode: "fields" | "commit" = "fields") {
  const st = useEngine.getState();
  const db = st.db;
  const owner = db.users.find((u) => u.id === (st.pinnedUserId ?? st.session.currentUserId)) ?? db.users[0];
  const byName = (name: string) => useEngine.getState().db.users.find((u) => u.name.ar === name);
  const deptByName = (name: string) => useEngine.getState().db.departments.find((d) => d.name.ar === name);

  switch (step) {
    case "company": {
      if (!db.company.name.ar.trim()) st.updateCompanyName(SAMPLE.company);
      if (!owner.name.ar.trim()) st.updateUser(owner.id, { name: SAMPLE.owner.name, title: SAMPLE.owner.title });
      else if (!owner.title.ar.trim()) st.updateUser(owner.id, { title: SAMPLE.owner.title });
      return;
    }
    case "departments": {
      for (const name of SAMPLE.departments) if (!deptByName(name)) st.addDepartment(name, owner.id);
      return;
    }
    case "people": {
      autofill("departments");
      for (const [name, title, dept, mgr, role] of SAMPLE.people) {
        if (byName(name)) continue;
        const managerId = mgr === "owner" ? owner.id : byName(mgr)?.id ?? owner.id;
        useEngine.getState().addUser({ name, title, departmentId: deptByName(dept)?.id ?? owner.departmentId, managerId, role });
      }
      // hand each department to its natural supervisor
      for (const [dept, sup] of Object.entries(SAMPLE.supervisors)) {
        const d = deptByName(dept);
        const u = byName(sup);
        if (d && u && d.supervisorId !== u.id) useEngine.getState().updateDepartment(d.id, { supervisorId: u.id });
      }
      return;
    }
    case "project": {
      autofill("people");
      const cur = useEngine.getState();
      const current = cur.db.projects.find((p) => p.id === cur.session.projectId) ?? cur.db.projects[0];
      if (current) {
        // the form is bound to this project, so only its empty fields get sample values
        if (!current.client.ar.trim()) cur.updateProject(current.id, { client: SAMPLE.project.client });
        if (cur.session.projectId !== current.id) cur.setProject(current.id);
        return;
      }
      const members = cur.db.users.filter((u) => u.active).map((u) => u.id);
      cur.addProject({
        name: SAMPLE.project.name,
        client: SAMPLE.project.client,
        phase: "execution",
        managerId: byName(SAMPLE.project.manager)?.id ?? owner.id,
        siteSupervisorId: byName(SAMPLE.project.site)?.id ?? owner.id,
        memberIds: members,
      });
      return;
    }
    case "types": {
      for (const ty of SAMPLE.types) {
        if (useEngine.getState().db.requestTypes.some((x) => x.name.ar === ty.name)) continue;
        useEngine.getState().addRequestType({ name: ty.name, approval: ty.approval, defaultDeadlineDays: ty.days, hasLines: ty.hasLines, fields: ty.fields.map((f) => ({ ...f, options: [...f.options] })) });
      }
      return;
    }
    case "first": {
      autofill("project");
      const cur = useEngine.getState();
      const to = byName(SAMPLE.first.to) ?? cur.db.users.find((u) => u.id !== owner.id && u.active);
      if (!to || !cur.session.projectId) return;
      const taskType = cur.db.requestTypes.find((t) => t.id === "t_task") ?? cur.db.requestTypes[0];
      const draft: ComposerDraft = {
        projectId: cur.session.projectId,
        typeId: taskType.id,
        text: SAMPLE.first.text,
        recipientId: to.id,
        priority: "normal",
        deadline: null,
        fields: {},
        parentId: null,
        lineId: null,
        returnToId: null,
        fromMessageId: null,
      };
      if (mode === "fields") {
        // put the bubble in front of the user; pressing "send" is the point of the step
        if (!useSetupDraft.getState().draft?.text.trim()) useSetupDraft.getState().setDraft(draft);
        return;
      }
      if (cur.db.requests.length) return;
      cur.createRequest(draft);
      useSetupDraft.getState().setDraft(null);
      return;
    }
  }
}

export function autofillAll() {
  for (const s of STEPS) autofill(s, "commit");
}
