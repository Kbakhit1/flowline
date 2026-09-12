"use client";

import { useMemo, useState } from "react";
import { cn } from "cn";
import { ChevronLeft, ChevronRight, SendHorizontal } from "lucide-react";
import type { User } from "@/lib/engine/types";
import { useEngine, selectMe } from "@/lib/engine/store";
import { useIsDesktop, useNow } from "@/lib/engine/hooks";
import { directReports, isLate, isOpen, sortInbox, subtreeIds } from "@/lib/engine/rules";
import { useT, useFmt } from "@/lib/i18n";
import { Empty, PersonAvatar, SectionTitle } from "@/components/common";
import { BubbleCard } from "@/components/bubbles/bubble-card";
import { Button } from "@/components/ui/button";
import { OrgTree, type PersonStats } from "@/components/tree/org-tree";

export default function TreePage() {
  const { t, tl } = useT();
  const { fmtNum } = useFmt();
  const now = useNow();
  const desktop = useIsDesktop();
  const me = useEngine(selectMe);
  const allUsers = useEngine((s) => s.db.users);
  const users = useMemo(() => allUsers.filter((u) => u.active), [allUsers]);
  const requests = useEngine((s) => s.db.requests);
  const projectId = useEngine((s) => s.session.projectId);
  const project = useEngine((s) => s.db.projects.find((p) => p.id === projectId));
  const selectedId = useEngine((s) => s.session.treeFocusId);
  const setSelected = useEngine((s) => s.setTreeFocus);
  const setComposer = useEngine((s) => s.setComposer);

  const inProject = useMemo(() => requests.filter((r) => r.projectId === projectId && isOpen(r.status)), [requests, projectId]);
  const stats = useMemo(() => {
    const m = new Map<string, PersonStats>();
    for (const r of inProject) {
      const s = m.get(r.ownerId) ?? { open: 0, late: 0 };
      s.open += 1;
      if (isLate(r, now)) s.late += 1;
      m.set(r.ownerId, s);
    }
    return m;
  }, [inProject, now]);

  const selected = users.find((u) => u.id === selectedId) ?? null;
  const selectedRequests = useMemo(() => (selected ? sortInbox(inProject.filter((r) => r.ownerId === selected.id), now) : []), [selected, inProject, now]);
  const branchOpen = selected ? [...subtreeIds(users, selected.id)].reduce((s, id) => s + (stats.get(id)?.open ?? 0), 0) : 0;

  const sendTo = (u: User) =>
    setComposer({
      projectId,
      text: "",
      recipientId: u.id,
      typeId: "t_task",
      priority: "normal",
      deadline: null,
      fields: {},
      parentId: null,
      lineId: null,
      returnToId: null,
      fromMessageId: null,
    });

  const panel = selected && (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-3">
        <PersonAvatar user={selected} size={44} />
        <div className="min-w-0 flex-1">
          <div className="truncate font-semibold">{tl(selected.name)}</div>
          <div className="truncate text-xs text-muted-foreground">
            {tl(selected.title)} · {t.roles[selected.role]}
          </div>
        </div>
        {selected.id !== me.id && (
          <Button size="sm" onClick={() => sendTo(selected)}>
            <SendHorizontal className="size-3.5 rtl:-scale-x-100" />
            {t.inbox.send}
          </Button>
        )}
      </div>
      <div className="grid grid-cols-3 gap-2 text-center text-xs">
        <Tile label={t.tree.openReqs} value={fmtNum(stats.get(selected.id)?.open ?? 0)} />
        <Tile label={t.tree.lateReqs} value={fmtNum(stats.get(selected.id)?.late ?? 0)} tone={stats.get(selected.id)?.late ? "late" : undefined} />
        <Tile label={t.inbox.team} value={fmtNum(branchOpen)} />
      </div>
      <SectionTitle count={selectedRequests.length}>
        {t.tree.requestsOf} {tl(selected.name)}
      </SectionTitle>
      <div className="flex flex-col gap-2">
        {selectedRequests.length === 0 && <Empty>{t.tree.none}</Empty>}
        {selectedRequests.map((r) => (
          <BubbleCard key={r.id} r={r} now={now} mode="team" />
        ))}
      </div>
    </div>
  );

  if (!desktop) {
    return <TreeMobile users={users} stats={stats} selected={selected} setSelected={setSelected} panel={panel} />;
  }

  return (
    <div className="relative flex h-[calc(100dvh-3.5rem)] min-h-0">
      <div className="relative min-w-0 flex-1">
        <div className="pointer-events-none absolute top-3 start-3 z-10">
          <h1 className="text-lg font-bold">{t.tree.title}</h1>
          <p className="text-xs text-muted-foreground">
            {t.tree.subtitle} · {project && tl(project.name)}
          </p>
          <p className="mt-1 text-[10px] text-muted-foreground">{t.tree.legend}</p>
        </div>
        <div className="absolute inset-0">
          <OrgTree stats={stats} selectedId={selectedId} onSelect={setSelected} />
        </div>
      </div>
      {panel ? (
        <aside className="w-[340px] shrink-0 overflow-y-auto border-s p-4 thin-scroll">{panel}</aside>
      ) : (
        <p className="pointer-events-none absolute bottom-4 start-1/2 -translate-x-1/2 rounded-full bg-card/90 px-3 py-1.5 text-[11px] text-muted-foreground ring-1 ring-foreground/10 backdrop-blur">
          {t.tree.showBubbles}
        </p>
      )}
    </div>
  );
}

function Tile({ label, value, tone }: { label: string; value: string; tone?: "late" }) {
  return (
    <div className="rounded-lg bg-muted/60 py-1.5">
      <div className={cn("tabular text-base font-bold", tone === "late" && "text-late")}>{value}</div>
      <div className="text-[10px] text-muted-foreground">{label}</div>
    </div>
  );
}

/** Phones drill down level by level instead of pinching a canvas. */
function TreeMobile({
  users,
  stats,
  selected,
  setSelected,
  panel,
}: {
  users: User[];
  stats: Map<string, PersonStats>;
  selected: User | null;
  setSelected: (id: string | null) => void;
  panel: React.ReactNode;
}) {
  const { t, tl } = useT();
  const { fmtNum } = useFmt();
  const [focus, setFocus] = useState<string | null>(null);
  const focusUser = users.find((u) => u.id === focus) ?? null;
  const roots = users.filter((u) => u.managerId === null);
  const list = focusUser ? directReports(users, focusUser.id) : roots;
  const parent = focusUser ? users.find((u) => u.id === focusUser.managerId) ?? null : null;

  return (
    <div className="flex flex-1 flex-col gap-3 px-3 py-3">
      <div>
        <h1 className="text-lg font-bold">{t.tree.title}</h1>
        <p className="text-xs text-muted-foreground">{t.tree.mobileHint}</p>
      </div>

      <div className="flex items-center gap-2 text-xs">
        <Button variant="outline" size="sm" disabled={!focusUser} onClick={() => setFocus(parent?.id ?? null)}>
          <ChevronRight className="size-3.5 ltr:hidden" />
          <ChevronLeft className="size-3.5 rtl:hidden" />
          {t.tree.up}
        </Button>
        <span className="truncate text-muted-foreground">{focusUser ? tl(focusUser.name) : t.tree.root}</span>
      </div>

      <ul className="flex flex-col gap-1.5">
        {list.map((u) => {
          const s = stats.get(u.id) ?? { open: 0, late: 0 };
          const kids = directReports(users, u.id).length;
          return (
            <li key={u.id} className={cn("flex items-center gap-2.5 rounded-xl border bg-card px-3 py-2", selected?.id === u.id && "border-primary")}>
              <button onClick={() => setSelected(selected?.id === u.id ? null : u.id)} className="flex min-w-0 flex-1 items-center gap-2.5 text-start">
                <PersonAvatar user={u} size={32} />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-semibold">{tl(u.name)}</span>
                  <span className="block truncate text-[11px] text-muted-foreground">{tl(u.title)}</span>
                </span>
                <span className="flex items-center gap-1 text-[10px] tabular">
                  <span className={cn("rounded-full px-1.5", s.open ? "bg-stage-you-soft text-stage-you" : "bg-muted text-muted-foreground")}>{fmtNum(s.open)}</span>
                  {s.late > 0 && <span className="rounded-full bg-late-soft px-1.5 font-semibold text-late">{fmtNum(s.late)}</span>}
                </span>
              </button>
              {kids > 0 && (
                <Button variant="ghost" size="icon-sm" onClick={() => setFocus(u.id)} aria-label={t.tree.expand}>
                  <ChevronLeft className="size-4 ltr:hidden" />
                  <ChevronRight className="size-4 rtl:hidden" />
                </Button>
              )}
            </li>
          );
        })}
      </ul>

      {panel && <div className="rounded-2xl border bg-card p-3">{panel}</div>}
    </div>
  );
}
