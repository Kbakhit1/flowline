"use client";

import { useMemo, useState } from "react";
import { useEngine, selectMe } from "@/lib/engine/store";
import { useInbox, useNow } from "@/lib/engine/hooks";
import { subtreeIds } from "@/lib/engine/rules";
import { useT, useFmt } from "@/lib/i18n";
import { Empty, PersonAvatar, Segmented } from "@/components/common";
import { BubbleCard } from "@/components/bubbles/bubble-card";
import { Composer } from "@/components/bubbles/composer";

type Tab = "mine" | "approvals" | "awaiting" | "sent" | "team";

export default function InboxPage() {
  const { t, tl } = useT();
  const { fmtNum } = useFmt();
  const now = useNow();
  const me = useEngine(selectMe);
  const users = useEngine((s) => s.db.users);
  const groups = useInbox();
  const [tab, setTab] = useState<Tab>("mine");

  const hasTeam = useMemo(() => subtreeIds(users, me.id).size > 0, [users, me.id]);

  const options = [
    { value: "mine" as Tab, label: t.inbox.mine, count: groups.mine.length },
    ...(groups.approvals.length ? [{ value: "approvals" as Tab, label: t.inbox.approvals, count: groups.approvals.length }] : []),
    { value: "awaiting" as Tab, label: t.inbox.awaiting, count: groups.awaiting.length },
    { value: "sent" as Tab, label: t.inbox.sent, count: groups.sent.length },
    ...(hasTeam ? [{ value: "team" as Tab, label: t.inbox.team, count: groups.team.length }] : []),
  ];
  const active: Tab = options.some((o) => o.value === tab) ? tab : "mine";
  const list = groups[active];

  // supervisors read their team grouped by person (spec 9.3: owner + how long)
  const teamGroups = useMemo(() => {
    if (active !== "team") return [];
    const map = new Map<string, typeof list>();
    for (const r of list) map.set(r.ownerId, [...(map.get(r.ownerId) ?? []), r]);
    return [...map.entries()].map(([id, rs]) => ({ user: users.find((u) => u.id === id)!, rs }));
  }, [active, list, users]);

  const empty: Record<Tab, string> = {
    mine: t.inbox.emptyMine,
    approvals: t.inbox.emptyMine,
    awaiting: t.inbox.emptyAwaiting,
    sent: t.inbox.emptySent,
    team: t.inbox.emptyTeam,
  };

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-1 flex-col px-3 sm:px-5">
      <div className="sticky top-14 z-20 -mx-3 bg-background/95 px-3 pt-3 pb-2 backdrop-blur sm:-mx-5 sm:px-5">
        <Segmented value={active} onChange={setTab} options={options} className="w-full sm:w-auto" />
      </div>

      <div className="flex flex-1 flex-col gap-2 py-2 pb-4">
        {list.length === 0 && <Empty>{empty[active]}</Empty>}

        {active !== "team" &&
          list.map((r) => <BubbleCard key={r.id} r={r} now={now} mode={active === "sent" ? "sent" : active === "awaiting" ? "awaiting" : "mine"} />)}

        {active === "team" &&
          teamGroups.map((g) => (
            <section key={g.user.id} className="flex flex-col gap-1.5">
              <div className="mt-2 flex items-center gap-2 px-1 text-xs text-muted-foreground">
                <PersonAvatar user={g.user} size={22} />
                <span className="font-semibold text-foreground">{tl(g.user.name)}</span>
                <span>· {tl(g.user.title)}</span>
                <span className="ms-auto tabular">
                  {fmtNum(g.rs.length)} {t.common.requests}
                </span>
              </div>
              {g.rs.map((r) => (
                <BubbleCard key={r.id} r={r} now={now} mode="team" />
              ))}
            </section>
          ))}
      </div>

      <div className="sticky bottom-16 z-20 -mx-3 bg-gradient-to-t from-background via-background to-transparent px-3 pt-3 pb-3 md:bottom-0 sm:-mx-5 sm:px-5">
        <Composer />
      </div>
    </div>
  );
}
