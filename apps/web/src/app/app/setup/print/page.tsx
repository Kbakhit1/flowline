"use client";

import { useMemo } from "react";
import Link from "next/link";
import { Printer, ArrowLeft } from "lucide-react";
import { useEngine, selectMe } from "@/lib/engine/store";
import { useT, useFmt } from "@/lib/i18n";
import { Button } from "@/components/ui/button";

/**
 * Paper version of the setup sheet: the same 6 steps as a form. Rows already
 * entered in the app are printed filled; the rest stay blank for handwriting.
 */

const ROWS = { departments: 6, people: 12, types: 5 };

export default function PrintSetupPage() {
  const { t, tl, locale } = useT();
  const { fmtNum, fmtDateLong } = useFmt();
  const company = useEngine((s) => s.db.company);
  const me = useEngine(selectMe);
  const allUsers = useEngine((s) => s.db.users);
  const users = useMemo(() => allUsers.filter((u) => u.active), [allUsers]);
  const departments = useEngine((s) => s.db.departments);
  const projects = useEngine((s) => s.db.projects);
  const types = useEngine((s) => s.db.requestTypes);
  const requests = useEngine((s) => s.db.requests);
  const project = projects[0];
  const first = requests[0];

  const nameOf = (id: string | null | undefined) => (id ? tl(users.find((u) => u.id === id)?.name ?? { ar: "", en: "" }) : "");
  const deptOf = (id: string) => tl(departments.find((d) => d.id === id)?.name ?? { ar: "", en: "" });
  const pad = <T,>(list: T[], n: number): (T | null)[] => [...list, ...Array(Math.max(0, n - list.length)).fill(null)];

  return (
    <div className="print-page mx-auto w-full max-w-3xl bg-white px-6 py-6 text-black" dir={locale === "ar" ? "rtl" : "ltr"}>
      <div className="no-print mb-4 flex items-center gap-2">
        <Button size="sm" onClick={() => window.print()}>
          <Printer className="size-4" />
          {t.setup.print.printNow}
        </Button>
        <Link href="/app/setup" className="inline-flex h-8 items-center gap-1.5 rounded-lg border px-2.5 text-sm text-foreground">
          <ArrowLeft className="size-3.5 rtl:-scale-x-100" />
          {t.setup.print.backToSheet}
        </Link>
      </div>

      {/* header */}
      <div className="flex items-start justify-between gap-4 border-b-2 border-black pb-3">
        <div>
          <h1 className="text-2xl font-bold leading-tight">{t.setup.print.title}</h1>
          <p className="mt-1 max-w-md text-xs text-neutral-600">{t.setup.print.subtitle}</p>
        </div>
        <div className="flex items-center gap-2" dir="ltr">
          <svg width="30" height="30" viewBox="0 0 64 64" fill="none" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            <path d="M20 54V14h26M20 32h18" stroke="#000" strokeWidth="7" />
            <circle cx="46" cy="14" r="6" fill="#000" />
            <circle cx="38" cy="32" r="6" fill="#000" />
            <circle cx="20" cy="54" r="6" fill="#fff" stroke="#000" strokeWidth="4" />
          </svg>
          <span className="text-xl font-semibold tracking-tight">FlowLine</span>
        </div>
      </div>

      <div className="mt-3 grid grid-cols-2 gap-x-6 text-sm">
        <Line label={t.setup.print.date} value={fmtDateLong(new Date().toISOString())} />
        <Line label={t.setup.print.filledBy} value={tl(me.name)} />
      </div>

      {/* 1 */}
      <Section n={1} title={t.setup.steps.company}>
        <div className="grid grid-cols-2 gap-x-6 gap-y-1 text-sm">
          <Line label={t.setup.company.name} value={tl(company.name)} wide />
          <Line label={t.setup.company.yourName} value={tl(me.name)} />
          <Line label={t.setup.company.yourTitle} value={tl(me.title)} />
        </div>
        <div className="mt-2 flex flex-wrap items-center gap-3 text-sm">
          <span className="text-neutral-600">{t.setup.print.workingDays}:</span>
          {t.common.days.map((d, i) => (
            <span key={d} className="inline-flex items-center gap-1">
              <Box checked={company.settings.workingDays.includes(i)} />
              {d}
            </span>
          ))}
        </div>
      </Section>

      {/* 2 */}
      <Section n={2} title={t.setup.steps.departments}>
        <Table head={[t.setup.print.num, t.setup.departments.name, t.setup.departments.supervisor]} widths={["8%", "52%", "40%"]}>
          {pad(departments, ROWS.departments).map((d, i) => (
            <tr key={i}>
              <Td muted>{fmtNum(i + 1)}</Td>
              <Td>{d ? tl(d.name) : ""}</Td>
              <Td>{d ? nameOf(d.supervisorId) : ""}</Td>
            </tr>
          ))}
        </Table>
      </Section>

      {/* 3 */}
      <Section n={3} title={t.setup.steps.people}>
        <Table
          head={[t.setup.print.num, t.person.name, t.person.jobTitle, t.person.department, t.person.manager, t.person.role]}
          widths={["6%", "24%", "22%", "16%", "18%", "14%"]}
        >
          {pad(users, ROWS.people).map((u, i) => (
            <tr key={i}>
              <Td muted>{fmtNum(i + 1)}</Td>
              <Td>{u ? tl(u.name) : ""}</Td>
              <Td>{u ? tl(u.title) : ""}</Td>
              <Td>{u ? deptOf(u.departmentId) : ""}</Td>
              <Td>{u ? nameOf(u.managerId) || "—" : ""}</Td>
              <Td>{u ? t.roles[u.role] : ""}</Td>
            </tr>
          ))}
        </Table>
      </Section>

      {/* 4 */}
      <Section n={4} title={t.setup.steps.project} breakBefore>
        <div className="grid grid-cols-2 gap-x-6 gap-y-1 text-sm">
          <Line label={t.setup.project.name} value={project ? tl(project.name) : ""} />
          <Line label={t.setup.project.client} value={project ? tl(project.client) : ""} />
          <Line label={t.setup.project.manager} value={project ? nameOf(project.managerId) : ""} />
          <Line label={t.setup.project.site} value={project ? nameOf(project.siteSupervisorId) : ""} />
        </div>
        <div className="mt-2 flex items-center gap-4 text-sm">
          <span className="text-neutral-600">{t.setup.project.phase}:</span>
          <span className="inline-flex items-center gap-1"><Box checked={project?.phase === "study"} />{t.dashboard.phase.study}</span>
          <span className="inline-flex items-center gap-1"><Box checked={project?.phase === "execution"} />{t.dashboard.phase.execution}</span>
        </div>
        <div className="mt-2 text-sm">
          <Line label={t.setup.project.members} value={project ? project.memberIds.map((id) => nameOf(id)).filter(Boolean).join("، ") : ""} wide />
        </div>
      </Section>

      {/* 5 */}
      <Section n={5} title={t.setup.steps.types}>
        <Table head={[t.setup.print.num, t.typeForm.name, t.setup.print.approvalQ, t.setup.print.deadlineDays, t.setup.print.fields]} widths={["6%", "28%", "18%", "16%", "32%"]}>
          {pad(types, ROWS.types).map((ty, i) => (
            <tr key={i}>
              <Td muted>{fmtNum(i + 1)}</Td>
              <Td>{ty ? tl(ty.name) : ""}</Td>
              <Td>{ty ? (ty.routing.approval === "none" ? t.setup.print.no : t.setup.print.yes) : ""}</Td>
              <Td>{ty ? fmtNum(ty.routing.defaultDeadlineDays) : ""}</Td>
              <Td>{ty ? ty.fields.map((f) => tl(f.label)).join("، ") || "—" : ""}</Td>
            </tr>
          ))}
        </Table>
      </Section>

      {/* 6 */}
      <Section n={6} title={t.setup.steps.first}>
        <div className="rounded-lg border border-black p-3 text-sm">
          <div className="text-neutral-600">{t.setup.print.text}</div>
          <div className="mt-1 min-h-14 border-b border-dashed border-neutral-400 pb-1 leading-7">{first ? tl(first.text) : ""}</div>
          <div className="mt-3 grid grid-cols-2 gap-x-6 gap-y-1">
            <Line label={t.setup.print.to} value={first ? nameOf(first.ownerId) : ""} />
            <Line label={t.setup.print.type} value={first ? tl(types.find((x) => x.id === first.typeId)?.name ?? { ar: "", en: "" }) : ""} />
            <Line label={t.setup.print.deadline} value={first ? fmtDateLong(first.deadline) : ""} />
            <div className="flex items-center gap-2 py-1">
              <span className="text-neutral-600">{t.setup.print.urgent}</span>
              <Box checked={first?.priority === "urgent"} />
            </div>
          </div>
        </div>
        <div className="mt-3 text-sm">
          <div className="text-neutral-600">{t.setup.print.notes}</div>
          <div className="mt-1 h-16 border-b border-dashed border-neutral-400" />
          <div className="h-8 border-b border-dashed border-neutral-400" />
        </div>
      </Section>

      <p className="mt-6 border-t border-neutral-300 pt-2 text-[11px] text-neutral-600">{t.setup.print.footer}</p>
    </div>
  );
}

/* ---------- paper primitives ---------- */

function Section({ n, title, children, breakBefore }: { n: number; title: string; children: React.ReactNode; breakBefore?: boolean }) {
  const { fmtNum } = useFmt();
  return (
    <section className={breakBefore ? "mt-6 break-before" : "mt-6"}>
      <h2 className="mb-2 flex items-center gap-2 text-base font-bold">
        <span className="inline-flex size-6 items-center justify-center rounded-full bg-black text-xs text-white tabular">{fmtNum(n)}</span>
        {title}
      </h2>
      {children}
    </section>
  );
}

function Line({ label, value, wide }: { label: string; value: string; wide?: boolean }) {
  return (
    <div className={wide ? "col-span-2 flex items-baseline gap-2 py-1" : "flex items-baseline gap-2 py-1"}>
      <span className="shrink-0 text-neutral-600">{label}:</span>
      <span className="min-h-6 flex-1 border-b border-dashed border-neutral-400 px-1 leading-6">{value}</span>
    </div>
  );
}

function Box({ checked }: { checked?: boolean }) {
  return (
    <span className="inline-flex size-4 items-center justify-center rounded-sm border border-black text-[11px] leading-none" aria-hidden>
      {checked ? "✓" : ""}
    </span>
  );
}

function Table({ head, widths, children }: { head: string[]; widths: string[]; children: React.ReactNode }) {
  return (
    <table className="w-full border-collapse text-sm">
      <colgroup>
        {widths.map((w, i) => (
          <col key={i} style={{ width: w }} />
        ))}
      </colgroup>
      <thead>
        <tr>
          {head.map((h) => (
            <th key={h} className="border border-black bg-neutral-100 px-2 py-1 text-start text-xs font-semibold">
              {h}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>{children}</tbody>
    </table>
  );
}

function Td({ children, muted }: { children: React.ReactNode; muted?: boolean }) {
  return <td className={muted ? "h-8 border border-black px-2 py-1 text-xs text-neutral-500 tabular" : "h-8 border border-black px-2 py-1"}>{children}</td>;
}
