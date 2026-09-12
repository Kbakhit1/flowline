"use client";

import { cn } from "cn";
import { Check, CheckCheck, CornerDownLeft, GitBranch, Paperclip } from "lucide-react";
import type { Request } from "@/lib/engine/types";
import { isLate, lineProgress, stageOf } from "@/lib/engine/rules";
import { useEngine, selectMe } from "@/lib/engine/store";
import { useT, useFmt } from "@/lib/i18n";
import { Flags, PersonAvatar, StageChip } from "@/components/common";

export function BubbleCard({
  r,
  now,
  mode = "mine",
  className,
}: {
  r: Request;
  now: number;
  mode?: "mine" | "sent" | "team" | "awaiting";
  className?: string;
}) {
  const { t, tl } = useT();
  const { fmtDue, fmtNum } = useFmt();
  const me = useEngine(selectMe);
  const users = useEngine((s) => s.db.users);
  const requests = useEngine((s) => s.db.requests);
  const attachments = useEngine((s) => s.db.attachments);
  const openRequest = useEngine((s) => s.openRequest);

  const creator = users.find((u) => u.id === r.creatorId);
  const owner = users.find((u) => u.id === r.ownerId);
  const children = requests.filter((c) => c.parentId === r.id);
  const closedChildren = children.filter((c) => c.status === "closed" || c.status === "cancelled").length;
  const prog = lineProgress(r);
  const late = isLate(r, now);
  const stage = stageOf(r.status);
  const seen = owner ? r.seenBy.includes(owner.id) : false;
  const attCount = attachments.filter((a) => a.requestId === r.id).length;
  const unseenByMe = !r.seenBy.includes(me.id);

  // whose face goes on the card: sender when it's mine, receiver when I sent it
  const face = mode === "mine" ? creator : owner;
  const faceLabel = mode === "mine" ? (creator ? tl(creator.name) : "") : owner ? `${t.inbox.with} ${tl(owner.name)}` : "";

  return (
    <button
      onClick={() => openRequest(r.id)}
      className={cn(
        "group relative w-full rounded-2xl border bg-card p-3 text-start shadow-[0_1px_0_rgba(0,0,0,0.02)] transition-colors hover:border-primary/40 focus-visible:ring-3 focus-visible:ring-ring/50",
        late && "border-late/40",
        unseenByMe && mode === "mine" && "border-primary/50",
        className,
      )}
    >
      <div className="flex items-center gap-1.5">
        <StageChip stage={stage} label={mode === "sent" || mode === "team" ? t.status[r.status] : undefined} />
        <Flags r={r} now={now} />
        <span className="ms-auto font-mono text-[10px] text-muted-foreground">{r.ref}</span>
      </div>

      <p className={cn("mt-2 text-[15px] leading-snug", unseenByMe && mode === "mine" && "font-semibold")}>{tl(r.text)}</p>

      {prog && (
        <div className="mt-2 flex items-center gap-2">
          <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted">
            <div className="h-full rounded-full bg-stage-you" style={{ width: `${Math.round((prog.done / prog.total) * 100)}%` }} />
          </div>
          <span className="tabular text-[11px] text-muted-foreground">
            {fmtNum(prog.done)}/{fmtNum(prog.total)}
          </span>
        </div>
      )}

      <div className="mt-2.5 flex items-center gap-2 text-xs text-muted-foreground">
        {face && (
          <span className="flex min-w-0 items-center gap-1.5">
            <PersonAvatar user={face} size={20} />
            <span className="truncate">{faceLabel}</span>
          </span>
        )}
        {mode !== "mine" && owner && (
          <span className="inline-flex items-center" title={seen ? t.inbox.seen : t.inbox.notSeen}>
            {seen ? <CheckCheck className="size-3.5 text-primary" /> : <Check className="size-3.5 opacity-50" />}
          </span>
        )}
        {children.length > 0 && (
          <span className="inline-flex items-center gap-1 tabular">
            <GitBranch className="size-3.5" />
            {fmtNum(closedChildren)}/{fmtNum(children.length)}
          </span>
        )}
        {r.parentId && (
          <span className="inline-flex items-center gap-1">
            <CornerDownLeft className="size-3.5" />
          </span>
        )}
        {attCount > 0 && (
          <span className="inline-flex items-center gap-0.5 tabular">
            <Paperclip className="size-3.5" />
            {fmtNum(attCount)}
          </span>
        )}
        <span className={cn("ms-auto whitespace-nowrap", late ? "font-semibold text-late" : "")}>{fmtDue(r.deadline, now)}</span>
      </div>
    </button>
  );
}
