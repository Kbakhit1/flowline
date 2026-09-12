"use client";

import { useMemo } from "react";
import { cn } from "cn";
import { useEngine } from "@/lib/engine/store";
import { useNow } from "@/lib/engine/hooks";
import { durationMs, isLate, isOpen } from "@/lib/engine/rules";
import { useT, useFmt } from "@/lib/i18n";
import { PersonAvatar, SectionTitle } from "@/components/common";
import { BubbleCard } from "@/components/bubbles/bubble-card";

export default function DashboardPage() {
  const { t, tl } = useT();
  const { fmtNum, fmtDuration } = useFmt();
  const now = useNow();
  const projects = useEngine((s) => s.db.projects);
  const requests = useEngine((s) => s.db.requests);
  const users = useEngine((s) => s.db.users);
  const setProject = useEngine((s) => s.setProject);

  const stats = useMemo(
    () =>
      projects.map((p) => {
        const rs = requests.filter((r) => r.projectId === p.id);
        const open = rs.filter((r) => isOpen(r.status));
        const closed = rs.filter((r) => r.status === "closed");
        const late = open.filter((r) => isLate(r, now));
        const approvals = open.filter((r) => r.status === "pending_approval");
        const done = rs.filter((r) => r.status === "closed" || r.status === "complete").length;
        const denom = rs.filter((r) => r.status !== "cancelled" && r.status !== "rejected").length || 1;
        const avg = closed.length ? closed.reduce((s, r) => s + durationMs(r.createdAt, r.closedAt!), 0) / closed.length : 0;
        return { p, open: open.length, closed: closed.length, late: late.length, approvals: approvals.length, pct: Math.round((done / denom) * 100), avg };
      }),
    [projects, requests, now],
  );

  const lateList = requests.filter((r) => isLate(r, now));
  const workload = useMemo(() => {
    const map = new Map<string, number>();
    for (const r of requests) if (isOpen(r.status)) map.set(r.ownerId, (map.get(r.ownerId) ?? 0) + 1);
    const max = Math.max(1, ...map.values());
    return [...map.entries()]
      .map(([id, n]) => ({ user: users.find((u) => u.id === id)!, n, w: n / max }))
      .filter((x) => x.user)
      .sort((a, b) => b.n - a.n);
  }, [requests, users]);

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-6 px-3 py-4 sm:px-5">
      <div>
        <h1 className="text-lg font-bold">{t.dashboard.title}</h1>
        <p className="text-xs text-muted-foreground">{t.dashboard.subtitle}</p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        {stats.map(({ p, open, closed, late, approvals, pct, avg }) => (
          <button key={p.id} onClick={() => setProject(p.id)} className="rounded-2xl border bg-card p-4 text-start transition-colors hover:border-primary/40">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <div className="truncate font-semibold">{tl(p.name)}</div>
                <div className="truncate text-[11px] text-muted-foreground">
                  {p.ref} · {t.dashboard.client}: {tl(p.client)}
                </div>
              </div>
              <span className="shrink-0 rounded-full bg-muted px-2 text-[10px] font-medium">{t.dashboard.phase[p.phase]}</span>
            </div>
            <div className="mt-3 flex items-center gap-2">
              <div className="h-2 flex-1 overflow-hidden rounded-full bg-muted">
                <div className="h-full rounded-full bg-primary" style={{ width: `${pct}%` }} />
              </div>
              <span className="tabular text-xs font-semibold">{fmtNum(pct)}%</span>
            </div>
            <dl className="mt-3 grid grid-cols-4 gap-2 text-center">
              <Stat label={t.dashboard.open} value={fmtNum(open)} />
              <Stat label={t.dashboard.late} value={fmtNum(late)} tone={late ? "late" : undefined} />
              <Stat label={t.dashboard.approvals} value={fmtNum(approvals)} tone={approvals ? "wait" : undefined} />
              <Stat label={t.dashboard.closed} value={fmtNum(closed)} />
            </dl>
            {avg > 0 && (
              <div className="mt-2 text-[11px] text-muted-foreground">
                {t.dashboard.avgClose}: {fmtDuration(avg)}
              </div>
            )}
          </button>
        ))}
      </div>

      <section>
        <SectionTitle count={lateList.length}>{t.dashboard.lateList}</SectionTitle>
        <div className="mt-2 flex flex-col gap-2">
          {lateList.map((r) => (
            <BubbleCard key={r.id} r={r} now={now} mode="team" />
          ))}
          {lateList.length === 0 && <p className="text-xs text-muted-foreground">{t.tree.none}</p>}
        </div>
      </section>

      <section>
        <SectionTitle>{t.dashboard.byPerson}</SectionTitle>
        <ul className="mt-2 flex flex-col gap-1.5">
          {workload.map(({ user, n, w }) => (
            <li key={user.id} className="flex items-center gap-2 text-xs">
              <PersonAvatar user={user} size={22} />
              <span className="w-36 truncate">{tl(user.name)}</span>
              <div className="h-2 flex-1 overflow-hidden rounded-full bg-muted">
                <div className="h-full rounded-full bg-chart-4" style={{ width: `${Math.round(w * 100)}%` }} />
              </div>
              <span className="tabular w-6 text-end font-semibold">{fmtNum(n)}</span>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}

function Stat({ label, value, tone }: { label: string; value: string; tone?: "late" | "wait" }) {
  return (
    <div>
      <dd className={cn("tabular text-lg font-bold leading-tight", tone === "late" && "text-late", tone === "wait" && "text-stage-wait")}>{value}</dd>
      <dt className="text-[10px] text-muted-foreground">{label}</dt>
    </div>
  );
}
