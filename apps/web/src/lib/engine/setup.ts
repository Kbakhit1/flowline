"use client";

import { useMemo } from "react";
import { useEngine, selectMe } from "./store";

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
