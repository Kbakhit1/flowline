"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { cn } from "cn";
import { Check, ChevronLeft, ChevronRight, Plus, Printer, Wand2 } from "lucide-react";
import Link from "next/link";
import type { RequestType, User } from "@/lib/engine/types";
import { useEngine, selectMe } from "@/lib/engine/store";
import { useT, useFmt, fill } from "@/lib/i18n";
import { Button } from "@/components/ui/button";
import { PersonAvatar, SectionTitle } from "@/components/common";
import { AddPersonDialog, AddTypeDialog } from "@/components/bubbles/pickers";
import { Composer } from "@/components/bubbles/composer";

import { STEPS, autofill, autofillAll, useSetupStatus, type Step } from "@/lib/engine/setup";

const inputCls =
  "h-9 w-full rounded-md border bg-transparent px-2.5 text-sm text-foreground placeholder:text-muted-foreground outline-none focus-visible:ring-3 focus-visible:ring-ring/50";

export default function SetupPage() {
  const { t } = useT();
  const { fmtNum } = useFmt();
  const status = useSetupStatus();
  const firstOpen = STEPS.find((s) => !status.done[s]) ?? "first";
  const [step, setStep] = useState<Step>(firstOpen);
  const idx = STEPS.indexOf(step);

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-5 px-3 py-4 sm:px-5">
      <div className="flex items-start gap-3">
        <div className="min-w-0 flex-1">
          <h1 className="text-lg font-bold">{t.setup.title}</h1>
          <p className="text-xs text-muted-foreground">{t.setup.subtitle}</p>
        </div>
        <div className="flex shrink-0 flex-col items-end gap-1.5">
          <Button size="sm" variant="outline" onClick={() => autofillAll()} title={t.setup.autofillHint}>
            <Wand2 className="size-3.5" />
            {t.setup.autofillAll}
          </Button>
          <Link href="/app/setup/print" className="inline-flex h-8 items-center gap-1.5 rounded-lg border px-2.5 text-xs font-medium hover:bg-muted">
            <Printer className="size-3.5" />
            {t.setup.print.button}
          </Link>
        </div>
      </div>

      {/* the sheet: 6 lines, each ticks itself off */}
      <ol className="grid grid-cols-2 gap-1.5 sm:grid-cols-3">
        {STEPS.map((s, i) => {
          const done = status.done[s];
          return (
            <li key={s}>
              <button
                onClick={() => setStep(s)}
                className={cn(
                  "flex w-full items-center gap-2 rounded-xl border px-2.5 py-2 text-start text-sm transition-colors",
                  step === s ? "border-primary bg-primary/5" : "bg-card hover:border-primary/40",
                )}
              >
                <span
                  className={cn(
                    "inline-flex size-5 shrink-0 items-center justify-center rounded-full text-[10px] font-semibold tabular",
                    done ? "bg-stage-done text-white" : "bg-muted text-muted-foreground",
                  )}
                >
                  {done ? <Check className="size-3" /> : fmtNum(i + 1)}
                </span>
                <span className={cn("truncate", done && "text-muted-foreground")}>{t.setup.steps[s]}</span>
              </button>
            </li>
          );
        })}
      </ol>
      <p className="-mt-3 text-[11px] text-muted-foreground">{fill(t.setup.progress, { n: fmtNum(status.count) })}</p>

      <section className="rounded-2xl border bg-card p-4">
        <div className="mb-3 flex items-center justify-between gap-2">
          <span className="text-[11px] text-muted-foreground">{t.setup.autofillHint}</span>
          <Button size="xs" variant="ghost" className="text-primary" onClick={() => autofill(step)}>
            <Wand2 className="size-3" />
            {t.setup.autofill}
          </Button>
        </div>
        {step === "company" && <CompanyStep />}
        {step === "departments" && <DepartmentsStep />}
        {step === "people" && <PeopleStep />}
        {step === "project" && <ProjectStep />}
        {step === "types" && <TypesStep />}
        {step === "first" && <FirstStep />}
      </section>

      <div className="flex items-center justify-between">
        <Button variant="outline" size="sm" disabled={idx === 0} onClick={() => setStep(STEPS[idx - 1])}>
          <ChevronRight className="size-3.5 ltr:hidden" />
          <ChevronLeft className="size-3.5 rtl:hidden" />
          {t.setup.back}
        </Button>
        {idx < STEPS.length - 1 ? (
          <Button size="sm" onClick={() => setStep(STEPS[idx + 1])}>
            {status.done[step] ? t.setup.next : t.setup.skip}
            <ChevronLeft className="size-3.5 ltr:hidden" />
            <ChevronRight className="size-3.5 rtl:hidden" />
          </Button>
        ) : (
          <FinishButton />
        )}
      </div>
    </div>
  );
}

function FinishButton() {
  const { t } = useT();
  const router = useRouter();
  return (
    <Button size="sm" onClick={() => router.push("/app")}>
      {t.setup.finish}
    </Button>
  );
}

function Hint({ children }: { children: React.ReactNode }) {
  return <p className="mb-3 text-xs leading-relaxed text-muted-foreground">{children}</p>;
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-1 text-xs text-muted-foreground">
      {label}
      {children}
    </label>
  );
}

/* ---------- 1. company + you ---------- */

function CompanyStep() {
  const { t } = useT();
  const company = useEngine((s) => s.db.company);
  const me = useEngine(selectMe);
  const updateCompanyName = useEngine((s) => s.updateCompanyName);
  const updateUser = useEngine((s) => s.updateUser);
  return (
    <div className="grid gap-3">
      <Hint>{t.setup.company.hint}</Hint>
      <Field label={t.setup.company.name}>
        <input autoFocus value={company.name.ar} onChange={(e) => updateCompanyName(e.target.value)} className={inputCls} />
      </Field>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label={t.setup.company.yourName}>
          <input value={me.name.ar} onChange={(e) => updateUser(me.id, { name: e.target.value })} className={inputCls} />
        </Field>
        <Field label={t.setup.company.yourTitle}>
          <input value={me.title.ar} onChange={(e) => updateUser(me.id, { title: e.target.value })} className={inputCls} />
        </Field>
      </div>
    </div>
  );
}

/* ---------- 2. departments ---------- */

function DepartmentsStep() {
  const { t, tl } = useT();
  const departments = useEngine((s) => s.db.departments);
  const users = useEngine((s) => s.db.users);
  const me = useEngine(selectMe);
  const addDepartment = useEngine((s) => s.addDepartment);
  const [name, setName] = useState("");
  const [sup, setSup] = useState(me.id);
  const add = () => {
    if (!name.trim()) return;
    addDepartment(name, sup);
    setName("");
  };
  return (
    <div className="grid gap-3">
      <Hint>{t.setup.departments.hint}</Hint>
      <div className="grid gap-2 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
        <Field label={t.setup.departments.name}>
          <input
            autoFocus
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && add()}
            className={inputCls}
          />
        </Field>
        <Field label={t.setup.departments.supervisor}>
          <select value={sup} onChange={(e) => setSup(e.target.value)} className={inputCls}>
            {users.filter((u) => u.active).map((u) => (
              <option key={u.id} value={u.id}>{tl(u.name) || t.common.you}</option>
            ))}
          </select>
        </Field>
        <Button onClick={add} disabled={!name.trim()}>
          <Plus className="size-4" />
          {t.setup.departments.add}
        </Button>
      </div>
      <SectionTitle count={departments.length}>{t.setup.departments.list}</SectionTitle>
      <ul className="flex flex-wrap gap-1.5">
        {departments.map((d) => {
          const s = users.find((u) => u.id === d.supervisorId);
          return (
            <li key={d.id} className="inline-flex items-center gap-1.5 rounded-full border bg-background px-2.5 py-1 text-xs">
              {tl(d.name)}
              {s && <span className="text-muted-foreground">· {tl(s.name) || t.common.you}</span>}
            </li>
          );
        })}
      </ul>
    </div>
  );
}

/* ---------- 3. people ---------- */

function PeopleStep() {
  const { t, tl } = useT();
  const users = useEngine((s) => s.db.users);
  const departments = useEngine((s) => s.db.departments);
  const [adding, setAdding] = useState(false);
  const active = users.filter((u) => u.active);
  return (
    <div className="grid gap-3">
      <Hint>{t.setup.people.hint}</Hint>
      <div>
        <Button onClick={() => setAdding(true)}>
          <Plus className="size-4" />
          {t.setup.people.add}
        </Button>
      </div>
      {active.length < 2 && <p className="text-xs text-stage-wait">{t.setup.people.need}</p>}
      <SectionTitle count={active.length}>{t.setup.people.list}</SectionTitle>
      <ul className="flex flex-col gap-1">
        {active.map((u) => {
          const mgr = users.find((x) => x.id === u.managerId);
          const dept = departments.find((d) => d.id === u.departmentId);
          return (
            <li key={u.id} className="flex items-center gap-2.5 rounded-xl border bg-background px-3 py-2 text-sm">
              <PersonAvatar user={u} size={28} />
              <span className="min-w-0 flex-1">
                <span className="block truncate font-medium">{tl(u.name) || t.common.you}</span>
                <span className="block truncate text-[11px] text-muted-foreground">
                  {tl(u.title)} {dept && `· ${tl(dept.name)}`} · {t.setup.people.manager}: {mgr ? tl(mgr.name) || t.common.you : t.setup.people.noManager}
                </span>
              </span>
              <span className="rounded-full bg-muted px-2 text-[10px] font-medium text-muted-foreground">{t.roles[u.role]}</span>
            </li>
          );
        })}
      </ul>
      {adding && <AddPersonDialog initialName="" onClose={() => setAdding(false)} onCreated={() => setAdding(false)} />}
    </div>
  );
}

/* ---------- 4. project ---------- */

function ProjectStep() {
  const { t, tl } = useT();
  const users = useEngine((s) => s.db.users);
  const projects = useEngine((s) => s.db.projects);
  const me = useEngine(selectMe);
  const addProject = useEngine((s) => s.addProject);
  const active = users.filter((u) => u.active);
  const [name, setName] = useState("");
  const [client, setClient] = useState("");
  const [phase, setPhase] = useState<"study" | "execution">("execution");
  const [manager, setManager] = useState(me.id);
  const [site, setSite] = useState(active[1]?.id ?? me.id);
  const [members, setMembers] = useState<string[]>(() => active.map((u) => u.id));
  const toggle = (id: string) => setMembers((m) => (m.includes(id) ? m.filter((x) => x !== id) : [...m, id]));
  const add = () => {
    if (!name.trim()) return;
    addProject({ name, client, phase, managerId: manager, siteSupervisorId: site, memberIds: members });
    setName("");
    setClient("");
  };
  return (
    <div className="grid gap-3">
      <Hint>{t.setup.project.hint}</Hint>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label={t.setup.project.name}>
          <input autoFocus value={name} onChange={(e) => setName(e.target.value)} className={inputCls} />
        </Field>
        <Field label={t.setup.project.client}>
          <input value={client} onChange={(e) => setClient(e.target.value)} className={inputCls} />
        </Field>
        <Field label={t.setup.project.phase}>
          <select value={phase} onChange={(e) => setPhase(e.target.value as "study" | "execution")} className={inputCls}>
            <option value="study">{t.dashboard.phase.study}</option>
            <option value="execution">{t.dashboard.phase.execution}</option>
          </select>
        </Field>
        <Field label={t.setup.project.manager}>
          <PersonSelect users={active} value={manager} onChange={setManager} />
        </Field>
        <Field label={t.setup.project.site}>
          <PersonSelect users={active} value={site} onChange={setSite} />
        </Field>
      </div>
      <div>
        <div className="mb-1 text-xs text-muted-foreground">{t.setup.project.members}</div>
        <div className="flex flex-wrap gap-1.5">
          {active.map((u) => (
            <button
              key={u.id}
              type="button"
              onClick={() => toggle(u.id)}
              className={cn(
                "inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-xs",
                members.includes(u.id) ? "border-primary/40 bg-primary/10 text-primary" : "text-muted-foreground",
              )}
            >
              <PersonAvatar user={u} size={16} />
              {tl(u.name) || t.common.you}
            </button>
          ))}
        </div>
      </div>
      <div>
        <Button onClick={add} disabled={!name.trim()}>
          <Plus className="size-4" />
          {t.setup.project.add}
        </Button>
      </div>
      {projects.length > 0 && (
        <>
          <SectionTitle count={projects.length}>{t.setup.project.list}</SectionTitle>
          <ul className="flex flex-col gap-1">
            {projects.map((p) => (
              <li key={p.id} className="rounded-xl border bg-background px-3 py-2 text-sm">
                <span className="font-medium">{tl(p.name)}</span>
                <span className="ms-2 font-mono text-[10px] text-muted-foreground">{p.ref}</span>
                {p.client.ar && <span className="ms-2 text-xs text-muted-foreground">· {tl(p.client)}</span>}
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}

function PersonSelect({ users, value, onChange }: { users: User[]; value: string; onChange: (id: string) => void }) {
  const { t, tl } = useT();
  return (
    <select value={value} onChange={(e) => onChange(e.target.value)} className={inputCls}>
      {users.map((u) => (
        <option key={u.id} value={u.id}>
          {tl(u.name) || t.common.you}{u.title.ar ? ` · ${tl(u.title)}` : ""}
        </option>
      ))}
    </select>
  );
}

/* ---------- 5. request types ---------- */

function TypesStep() {
  const { t, tl } = useT();
  const { fmtNum } = useFmt();
  const types = useEngine((s) => s.db.requestTypes);
  const [adding, setAdding] = useState(false);
  return (
    <div className="grid gap-3">
      <Hint>{t.setup.types.hint}</Hint>
      <div>
        <Button onClick={() => setAdding(true)}>
          <Plus className="size-4" />
          {t.setup.types.add}
        </Button>
      </div>
      <SectionTitle count={types.length}>{t.setup.types.list}</SectionTitle>
      <ul className="grid gap-1.5 sm:grid-cols-2">
        {types.map((ty: RequestType) => (
          <li key={ty.id} className="rounded-xl border bg-background px-3 py-2 text-sm">
            <div className="font-medium">{tl(ty.name)}</div>
            <div className="text-[11px] text-muted-foreground">
              {ty.routing.approval === "none" ? t.inbox.goesDirect : t.inbox.needsApproval} · {t.settings.typeDeadline}: {fmtNum(ty.routing.defaultDeadlineDays)} ·{" "}
              {fmtNum(ty.fields.length)} {t.settings.typeFields}
            </div>
          </li>
        ))}
      </ul>
      {adding && <AddTypeDialog initialName="" onClose={() => setAdding(false)} onCreated={() => setAdding(false)} />}
    </div>
  );
}

/* ---------- 6. first bubble ---------- */

function FirstStep() {
  const { t } = useT();
  const router = useRouter();
  const requests = useEngine((s) => s.db.requests);
  const projectId = useEngine((s) => s.session.projectId);
  const users = useEngine((s) => s.db.users);
  const ready = !!projectId && users.filter((u) => u.active).length >= 2;
  return (
    <div className="grid gap-3">
      <Hint>{t.setup.first.hint}</Hint>
      {!projectId && <p className="text-xs text-stage-wait">{t.landing.noProject}</p>}
      {projectId && users.filter((u) => u.active).length < 2 && <p className="text-xs text-stage-wait">{t.setup.people.need}</p>}
      {ready && <Composer />}
      {requests.length > 0 && (
        <div className="flex flex-wrap items-center gap-2 rounded-xl bg-stage-done-soft px-3 py-2 text-sm text-stage-done">
          <Check className="size-4" />
          {t.setup.first.sent}
          <span className="ms-auto flex gap-1.5">
            <Button size="xs" variant="outline" onClick={() => router.push("/app")}>{t.setup.first.goInbox}</Button>
            <Button size="xs" variant="outline" onClick={() => router.push("/app/tree")}>{t.setup.first.goTree}</Button>
          </span>
        </div>
      )}
    </div>
  );
}
