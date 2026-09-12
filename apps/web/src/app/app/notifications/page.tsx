"use client";

import { useState } from "react";
import { cn } from "cn";
import { Bell, BellRing, ListChecks, TriangleAlert } from "lucide-react";
import type { NotificationTier } from "@/lib/engine/types";
import { useEngine, selectMe } from "@/lib/engine/store";
import { useNow } from "@/lib/engine/hooks";
import { useT, useFmt } from "@/lib/i18n";
import { Empty, Segmented } from "@/components/common";
import { Button } from "@/components/ui/button";

type Filter = "all" | NotificationTier;

const ICON: Record<NotificationTier, typeof Bell> = { direct: BellRing, digest: ListChecks, escalation: TriangleAlert };
const TONE: Record<NotificationTier, string> = {
  direct: "bg-stage-you-soft text-stage-you",
  digest: "bg-muted text-muted-foreground",
  escalation: "bg-late-soft text-late",
};

export default function NotificationsPage() {
  const { t, tl } = useT();
  const { fmtRelative } = useFmt();
  const now = useNow();
  const me = useEngine(selectMe);
  const all = useEngine((s) => s.db.notifications);
  const openRequest = useEngine((s) => s.openRequest);
  const markRead = useEngine((s) => s.markNotificationRead);
  const markAll = useEngine((s) => s.markAllRead);
  const [filter, setFilter] = useState<Filter>("all");

  const mine = all.filter((n) => n.userId === me.id).sort((a, b) => b.at.localeCompare(a.at));
  const list = filter === "all" ? mine : mine.filter((n) => n.tier === filter);
  const count = (tier: NotificationTier) => mine.filter((n) => n.tier === tier && !n.readAt).length;

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-1 flex-col px-3 py-3 sm:px-5">
      <div className="flex flex-wrap items-center gap-2">
        <h1 className="text-lg font-bold">{t.notif.title}</h1>
        <Button variant="ghost" size="sm" className="ms-auto" onClick={markAll} disabled={!mine.some((n) => !n.readAt)}>
          {t.notif.markAll}
        </Button>
      </div>
      <p className="mt-1 text-xs text-muted-foreground">{t.notif.tierHint}</p>
      <Segmented
        className="mt-3"
        value={filter}
        onChange={setFilter}
        options={[
          { value: "all", label: t.notif.all },
          { value: "direct", label: t.notif.direct, count: count("direct") },
          { value: "digest", label: t.notif.digest, count: count("digest") },
          { value: "escalation", label: t.notif.escalation, count: count("escalation") },
        ]}
      />

      <ul className="mt-3 flex flex-col gap-1.5">
        {list.length === 0 && (
          <li>
            <Empty>{t.notif.empty}</Empty>
          </li>
        )}
        {list.map((n) => {
          const Icon = ICON[n.tier];
          return (
            <li key={n.id}>
              <button
                onClick={() => {
                  markRead(n.id);
                  if (n.requestId) openRequest(n.requestId);
                }}
                className={cn(
                  "flex w-full items-start gap-3 rounded-xl border bg-card px-3 py-2.5 text-start transition-colors hover:border-primary/40",
                  !n.readAt && "border-primary/30",
                )}
              >
                <span className={cn("mt-0.5 inline-flex size-7 shrink-0 items-center justify-center rounded-full", TONE[n.tier])}>
                  <Icon className="size-3.5" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className={cn("block text-sm leading-snug", !n.readAt && "font-semibold")}>{tl(n.text)}</span>
                  <span className="mt-0.5 block text-[11px] text-muted-foreground">
                    {t.notif[n.tier]} · {fmtRelative(n.at, now)}
                  </span>
                </span>
                {!n.readAt && <span className="mt-2 size-2 shrink-0 rounded-full bg-primary" />}
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
