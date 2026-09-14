"use client";

import { useEffect, useMemo, useState } from "react";
import { cn } from "cn";
import { Pause, Play, Sparkles } from "lucide-react";
import type { AuditEntry, Request } from "@/lib/engine/types";
import { useEngine } from "@/lib/engine/store";
import { useT, useFmt, fill } from "@/lib/i18n";
import { Button } from "@/components/ui/button";
import { PersonAvatar, StageDot } from "@/components/common";
import { chainOf } from "@/components/tree/flow-canvas";
import { stageOf } from "@/lib/engine/rules";

/**
 * The story of one chain: every audit step of every request in it, in order,
 * with a player that walks the canvas through them.
 */
export function LineStory({
  requests,
  selectedId,
  activeId,
  onActive,
}: {
  requests: Request[];
  selectedId: string | null;
  activeId: string | null;
  onActive: (id: string | null) => void;
}) {
  const { t, tl } = useT();
  const { fmtNum, fmtRelative } = useFmt();
  const users = useEngine((s) => s.db.users);
  const audit = useEngine((s) => s.db.audit);
  const openRequest = useEngine((s) => s.openRequest);
  const [playing, setPlaying] = useState(false);
  const [cursor, setCursor] = useState(-1);

  const chain = useMemo(() => (selectedId ? chainOf(requests, selectedId) : null), [requests, selectedId]);
  const steps = useMemo(() => {
    if (!chain) return [] as AuditEntry[];
    return audit.filter((a) => chain.has(a.requestId)).sort((a, b) => a.at.localeCompare(b.at));
  }, [audit, chain]);
  const chainRequests = useMemo(() => (chain ? requests.filter((r) => chain.has(r.id)) : []), [requests, chain]);
  const returned = chainRequests.filter((r) => r.status === "closed" || r.status === "complete").length;
  const pending = chainRequests.filter((r) => stageOf(r.status) === "you" || stageOf(r.status) === "waiting").length;

  // player
  useEffect(() => {
    if (!playing) return;
    if (cursor >= steps.length - 1) {
      setPlaying(false);
      return;
    }
    const id = setTimeout(() => setCursor((c) => c + 1), 1100);
    return () => clearTimeout(id);
  }, [playing, cursor, steps.length]);

  useEffect(() => {
    const step = steps[cursor];
    onActive(step ? step.requestId : null);
  }, [cursor, steps, onActive]);

  useEffect(() => {
    setCursor(-1);
    setPlaying(false);
  }, [selectedId]);

  if (!selectedId || !chain) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-2 p-6 text-center text-xs text-muted-foreground">
        <Sparkles className="size-6 opacity-40" />
        {t.flow.storyHint}
      </div>
    );
  }

  const root = chainRequests.find((r) => !r.parentId) ?? chainRequests[0];

  return (
    <div className="flex h-full flex-col">
      <div className="border-b p-3">
        <div className="flex items-center gap-2">
          <h3 className="text-sm font-bold">{t.flow.story}</h3>
          <Button
            size="xs"
            variant={playing ? "outline" : "default"}
            className="ms-auto"
            onClick={() => {
              if (playing) {
                setPlaying(false);
              } else {
                setCursor(cursor >= steps.length - 1 ? 0 : cursor + 1);
                setPlaying(true);
              }
            }}
          >
            {playing ? <Pause className="size-3" /> : <Play className="size-3 rtl:-scale-x-100" />}
            {playing ? t.flow.stop : t.flow.play}
          </Button>
        </div>
        {root && (
          <button onClick={() => openRequest(root.id)} className="mt-1.5 flex w-full items-center gap-1.5 text-start text-xs">
            <StageDot stage={stageOf(root.status)} />
            <span className="min-w-0 flex-1 truncate">{tl(root.text)}</span>
            <span className="font-mono text-[10px] text-muted-foreground">{root.ref}</span>
          </button>
        )}
        <div className="mt-2 flex flex-wrap gap-1.5 text-[10px]">
          <span className="rounded-full bg-muted px-2 py-0.5 tabular">{fill(t.flow.requestsCount, { n: fmtNum(chainRequests.length) })}</span>
          <span className="rounded-full bg-stage-done-soft px-2 py-0.5 text-stage-done tabular">{fill(t.flow.returned, { n: fmtNum(returned) })}</span>
          {pending > 0 && <span className="rounded-full bg-stage-wait-soft px-2 py-0.5 text-stage-wait tabular">{fill(t.flow.pending, { n: fmtNum(pending) })}</span>}
        </div>
      </div>

      <ol className="min-h-0 flex-1 overflow-y-auto p-3 thin-scroll">
        {steps.map((a, i) => {
          const actor = users.find((u) => u.id === a.actorId);
          const to = users.find((u) => u.id === a.toUserId);
          const r = requests.find((x) => x.id === a.requestId);
          const isActive = i === cursor;
          const passed = i < cursor;
          return (
            <li
              key={a.id}
              onClick={() => {
                setPlaying(false);
                setCursor(i);
              }}
              className={cn(
                "relative flex cursor-pointer gap-2.5 rounded-lg px-2 py-2 transition-colors",
                isActive ? "bg-primary/10" : passed ? "opacity-70" : "",
                activeId === a.requestId && !isActive && "bg-muted/50",
              )}
            >
              <span
                className={cn(
                  "mt-0.5 inline-flex size-5 shrink-0 items-center justify-center rounded-full text-[10px] font-semibold tabular",
                  isActive ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground",
                )}
              >
                {fmtNum(i + 1)}
              </span>
              <div className="min-w-0 flex-1 text-xs">
                <div className="flex flex-wrap items-center gap-x-1">
                  {actor && <PersonAvatar user={actor} size={16} />}
                  <span className="font-semibold">{actor && tl(actor.name)}</span>
                  <span className="text-muted-foreground">{t.audit[a.action]}</span>
                  {to && a.action !== "rejected" && <span className="font-semibold">{tl(to.name)}</span>}
                </div>
                {r && <div className="mt-0.5 truncate text-[11px] text-muted-foreground">{r.ref} · {tl(r.text)}</div>}
                {tl(a.note) && <div className="mt-0.5 rounded-md bg-muted/60 px-2 py-1 text-[11px]">{tl(a.note)}</div>}
                <div className="mt-0.5 text-[10px] text-muted-foreground">{fmtRelative(a.at)}</div>
              </div>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
