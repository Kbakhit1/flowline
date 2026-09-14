"use client";

import { useMemo, useState } from "react";
import { useShallow } from "zustand/react/shallow";
import { cn } from "cn";
import { ArrowLeftRight, Check, CheckCheck, CornerDownLeft, GitBranch, Paperclip, Plus, SendHorizontal } from "lucide-react";
import type { AuditEntry, Request, RequestLine, User } from "@/lib/engine/types";
import { durationMs, isLate, isOpen, lineProgress, permittedActions, stageOf, type RequestAction } from "@/lib/engine/rules";
import { useEngine, selectMe } from "@/lib/engine/store";
import { useIsDesktop, useNow, usePeople, useUser } from "@/lib/engine/hooks";
import { useTour } from "@/lib/engine/tour";
import { useT, useFmt, useLocale, fill } from "@/lib/i18n";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Flags, PersonAvatar, SectionTitle, StageChip, StageDot } from "@/components/common";

export function RequestSheet() {
  const id = useEngine((s) => s.session.openRequestId);
  const openRequest = useEngine((s) => s.openRequest);
  const r = useEngine((s) => (id ? s.db.requests.find((x) => x.id === id) ?? null : null));
  const desktop = useIsDesktop();
  const locale = useLocale();
  const touring = useTour((s) => s.active);
  return (
    <Sheet open={!!r} onOpenChange={(o) => !o && openRequest(null)} modal={false}>
      <SheetContent
        side={desktop ? (locale === "ar" ? "left" : "right") : "bottom"}
        className={cn(
          "gap-0 overflow-y-auto p-0 thin-scroll",
          desktop
            ? "data-[side=left]:sm:max-w-lg data-[side=right]:sm:max-w-lg"
            : touring
              ? "rounded-t-2xl data-[side=bottom]:h-[68dvh]"
              : "rounded-t-2xl data-[side=bottom]:h-[92dvh]",
        )}
      >
        {r && <RequestDetail r={r} key={r.id} />}
      </SheetContent>
    </Sheet>
  );
}

function RequestDetail({ r }: { r: Request }) {
  const { t, tl } = useT();
  const { fmtDue, fmtDateLong, fmtRelative, fmtNum, fmtDuration } = useFmt();
  const now = useNow();
  const me = useEngine(selectMe);
  const users = useEngine((s) => s.db.users);
  const requests = useEngine((s) => s.db.requests);
  const types = useEngine((s) => s.db.requestTypes);
  const projects = useEngine((s) => s.db.projects);
  const audit = useEngine((s) => s.db.audit);
  const deadlineLogs = useEngine((s) => s.db.deadlineLogs);
  const attachments = useEngine((s) => s.db.attachments);
  const messages = useEngine((s) => s.db.messages);
  const openRequest = useEngine((s) => s.openRequest);
  const setComposer = useEngine((s) => s.setComposer);
  const sendMessage = useEngine((s) => s.sendMessage);
  const actions = useEngine(
    useShallow((s) => ({
      approve: s.approve, reject: s.reject, requestClarification: s.requestClarification, clarify: s.clarify,
      start: s.start, complete: s.complete, close: s.close, reopen: s.reopen, cancel: s.cancel,
      transfer: s.transfer, returnToSender: s.returnToSender, extend: s.extend, recordProgress: s.recordProgress,
    })),
  );

  const type = types.find((x) => x.id === r.typeId);
  const project = projects.find((p) => p.id === r.projectId);
  const creator = users.find((u) => u.id === r.creatorId);
  const owner = users.find((u) => u.id === r.ownerId);
  const returnTo = users.find((u) => u.id === r.returnToId);
  const parent = r.parentId ? requests.find((x) => x.id === r.parentId) : null;
  const children = requests.filter((x) => x.parentId === r.id);
  const openChildren = children.filter((c) => stageOf(c.status) !== "done" && stageOf(c.status) !== "stopped").length;
  const trail = audit.filter((a) => a.requestId === r.id).sort((a, b) => a.at.localeCompare(b.at));
  const logs = deadlineLogs.filter((d) => d.requestId === r.id);
  const files = attachments.filter((a) => a.requestId === r.id);
  const thread = messages.filter((m) => m.requestId === r.id).sort((a, b) => a.at.localeCompare(b.at));
  const allowed = permittedActions(r, me.id, openChildren);
  const late = isLate(r, now);
  const prog = lineProgress(r);
  const [reply, setReply] = useState("");
  const [dialog, setDialog] = useState<RequestAction | null>(null);

  const primary: RequestAction[] = ["approve", "clarify", "complete", "close", "start"];
  const ordered = [...allowed].sort((a, b) => (primary.includes(a) ? 0 : 1) - (primary.includes(b) ? 0 : 1));

  const run = (action: RequestAction) => {
    if (action === "subrequest") {
      setComposer({
        projectId: r.projectId,
        text: "",
        recipientId: null,
        typeId: "t_task",
        priority: r.priority,
        deadline: null,
        fields: {},
        parentId: r.id,
        lineId: r.lines[0]?.id ?? null,
        returnToId: me.id,
        fromMessageId: null,
      });
      return;
    }
    if (action === "start") return actions.start(r.id);
    if (action === "close") return actions.close(r.id);
    setDialog(action);
  };

  return (
    <div className="flex flex-col">
      <div className="sticky top-0 z-10 border-b bg-popover px-4 pt-4 pb-3">
        <div className="flex items-center gap-1.5 pe-8">
          <span className="font-mono text-[11px] text-muted-foreground">{r.ref}</span>
          <StageChip
            stage={stageOf(r.status)}
            label={stageOf(r.status) === "you" && r.ownerId !== me.id && owner ? `${t.inbox.with} ${tl(owner.name)}` : undefined}
          />
          <span className="text-[11px] text-muted-foreground">{t.status[r.status]}</span>
          <Flags r={r} now={now} />
        </div>
        <SheetTitle className="mt-2 text-[17px] leading-snug font-semibold">{tl(r.text)}</SheetTitle>
        <div className="mt-1 text-[11px] text-muted-foreground">
          {type && tl(type.name)} · {project && tl(project.name)}
        </div>
      </div>

      <div className="flex flex-col gap-5 px-4 py-4">
        {/* who / when */}
        <dl className="grid grid-cols-2 gap-x-3 gap-y-3 text-xs">
          <Meta label={t.detail.creator}>{creator && <Person u={creator} />}</Meta>
          <Meta label={t.detail.owner}>
            {owner && (
              <span className="flex items-center gap-1.5">
                <Person u={owner} />
                {r.seenBy.includes(owner.id) ? <CheckCheck className="size-3.5 text-primary" /> : <Check className="size-3.5 opacity-40" />}
              </span>
            )}
          </Meta>
          <Meta label={t.detail.returnTo}>{returnTo && <Person u={returnTo} />}</Meta>
          <Meta label={t.inbox.deadline}>
            <span className={cn(late && "font-semibold text-late")}>{fmtDue(r.deadline, now)}</span>
            <span className="block text-muted-foreground">{fmtDateLong(r.deadline)}</span>
            {logs.length > 0 && <span className="block text-stage-wait">{fill(t.flag.extended, { n: fmtNum(logs.length) })}</span>}
          </Meta>
          <Meta label={t.detail.created}>{fmtRelative(r.createdAt, now)}</Meta>
          {r.closedAt ? (
            <Meta label={t.detail.closed}>
              {fmtRelative(r.closedAt, now)} · {t.detail.duration} {fmtDuration(durationMs(r.createdAt, r.closedAt))}
            </Meta>
          ) : (
            <Meta label={t.detail.version}>
              <span className="tabular">{fmtNum(r.version)}</span>
            </Meta>
          )}
        </dl>

        {/* type fields + lines */}
        {(Object.keys(r.fields).length > 0 || r.lines.length > 0) && (
          <section>
            <SectionTitle>{t.detail.fields}</SectionTitle>
            {Object.keys(r.fields).length > 0 && type && (
              <dl className="mt-2 grid grid-cols-2 gap-2 text-xs sm:grid-cols-3">
                {type.fields.filter((f) => r.fields[f.key] !== undefined && r.fields[f.key] !== "").map((f) => (
                  <div key={f.key} className="rounded-lg bg-muted/60 px-2.5 py-1.5">
                    <dt className="text-[10px] text-muted-foreground">{tl(f.label)}</dt>
                    <dd className="font-medium">{typeof r.fields[f.key] === "number" ? fmtNum(r.fields[f.key] as number) : String(r.fields[f.key])}</dd>
                  </div>
                ))}
              </dl>
            )}
            {prog && (
              <div className="mt-2 rounded-lg border p-2.5">
                {r.lines.map((ln) => (
                  <LineRow key={ln.id} ln={ln} />
                ))}
                <div className="mt-2 flex items-center gap-2">
                  <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted">
                    <div className="h-full rounded-full bg-stage-you" style={{ width: `${Math.round((prog.done / prog.total) * 100)}%` }} />
                  </div>
                  <span className="tabular text-[11px] text-muted-foreground">
                    {fmtNum(prog.done)}/{fmtNum(prog.total)}
                  </span>
                </div>
              </div>
            )}
          </section>
        )}

        {/* actions */}
        {allowed.length > 0 ? (
          <div className="flex flex-wrap gap-1.5" data-tour="sheet-actions">
            {ordered.map((a) => (
              <Button
                key={a}
                size="sm"
                variant={primary.includes(a) ? "default" : a === "cancel" || a === "reject" ? "destructive" : "outline"}
                onClick={() => run(a)}
              >
                {a === "subrequest" && <Plus className="size-3.5" />}
                {t.action[a]}
              </Button>
            ))}
          </div>
        ) : isOpen(r.status) ? (
          <p className="rounded-lg bg-muted/60 px-3 py-2 text-xs text-muted-foreground">{t.detail.readOnly}</p>
        ) : null}

        {/* tree links */}
        {(parent || children.length > 0) && (
          <section>
            <SectionTitle count={children.length || undefined}>{parent && !children.length ? t.detail.parent : t.detail.subrequests}</SectionTitle>
            <div className="mt-2 flex flex-col gap-1.5">
              {parent && (
                <MiniRow r={parent} icon={<CornerDownLeft className="size-3.5" />} onClick={() => openRequest(parent.id)} label={t.detail.parent} />
              )}
              {children.map((c) => (
                <MiniRow key={c.id} r={c} icon={<GitBranch className="size-3.5" />} onClick={() => openRequest(c.id)} />
              ))}
            </div>
          </section>
        )}

        {/* path */}
        <section>
          <SectionTitle>{t.detail.path}</SectionTitle>
          <ol className="mt-2 flex flex-col">
            {trail.map((a, i) => (
              <PathStep key={a.id} a={a} prev={trail[i - 1]} last={i === trail.length - 1} />
            ))}
          </ol>
        </section>

        {logs.length > 0 && (
          <section>
            <SectionTitle>{t.detail.deadlineLog}</SectionTitle>
            <ul className="mt-2 flex flex-col gap-1.5 text-xs">
              {logs.map((d) => (
                <li key={d.id} className="rounded-lg border px-2.5 py-2">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-stage-wait">{fill(t.flag.extended, { n: fmtNum(d.seq) })}</span>
                    <span className="text-muted-foreground">
                      {fmtDateLong(d.from)} → {fmtDateLong(d.to)}
                    </span>
                  </div>
                  <div className="mt-0.5 text-muted-foreground">{tl(d.reason)}</div>
                </li>
              ))}
            </ul>
          </section>
        )}

        {files.length > 0 && (
          <section>
            <SectionTitle count={files.length}>{t.detail.attachments}</SectionTitle>
            <ul className="mt-2 flex flex-col gap-1 text-xs">
              {files.map((f) => {
                const by = users.find((u) => u.id === f.byId);
                return (
                  <li key={f.id} className="flex items-center gap-2 rounded-lg border px-2.5 py-2">
                    <Paperclip className="size-3.5 text-muted-foreground" />
                    <span className="min-w-0 flex-1 truncate" dir="auto">{f.name}</span>
                    <span className="text-muted-foreground">{fmtNum(Math.round(f.size / 1024))} KB</span>
                    {by && <PersonAvatar user={by} size={18} />}
                  </li>
                );
              })}
            </ul>
          </section>
        )}

        {/* thread */}
        <section>
          <SectionTitle count={thread.length || undefined}>{t.detail.thread}</SectionTitle>
          <div className="mt-2 flex flex-col gap-2">
            {thread.length === 0 && <p className="text-xs text-muted-foreground">{t.detail.noThread}</p>}
            {thread.map((m) => {
              const s = users.find((u) => u.id === m.senderId);
              const mine = m.senderId === me.id;
              return (
                <div key={m.id} className={cn("flex max-w-[92%] gap-2", mine && "self-end flex-row-reverse")}>
                  {s && <PersonAvatar user={s} size={22} className="mt-1" />}
                  <div className={cn("rounded-2xl px-3 py-2 text-sm", mine ? "bg-primary text-primary-foreground" : "bg-muted")}>
                    {!mine && s && <div className="mb-0.5 text-[10px] font-semibold opacity-70">{tl(s.name)}</div>}
                    <div>{tl(m.text)}</div>
                    <div className={cn("mt-0.5 text-[10px]", mine ? "opacity-70" : "text-muted-foreground")}>{fmtRelative(m.at, now)}</div>
                  </div>
                </div>
              );
            })}
          </div>
          <form
            data-tour="sheet-thread"
            className="mt-2 flex items-end gap-1.5"
            onSubmit={(e) => {
              e.preventDefault();
              if (!reply.trim()) return;
              sendMessage(r.projectId, r.id, reply);
              setReply("");
            }}
          >
            <Textarea
              value={reply}
              onChange={(e) => setReply(e.target.value)}
              placeholder={t.detail.replyPlaceholder}
              rows={1}
              className="min-h-9 resize-none py-1.5 text-sm"
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  (e.currentTarget.form as HTMLFormElement | null)?.requestSubmit();
                }
              }}
            />
            <Button size="icon" type="submit" disabled={!reply.trim()} aria-label={t.inbox.send}>
              <SendHorizontal className="size-4 rtl:-scale-x-100" />
            </Button>
          </form>
        </section>
      </div>

      <ActionDialog r={r} action={dialog} onClose={() => setDialog(null)} actions={actions} />
    </div>
  );
}

/* ---------- small pieces ---------- */

function Meta({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <dt className="text-[10px] text-muted-foreground">{label}</dt>
      <dd className="mt-0.5">{children}</dd>
    </div>
  );
}

function Person({ u }: { u: { id: string; name: { ar: string; en: string }; hue: number; companyId: string; title: { ar: string; en: string }; departmentId: string; managerId: string | null; role: "employee" | "site_supervisor" | "dept_supervisor" | "project_manager" | "executive" | "sysadmin"; active: boolean } }) {
  const { tl } = useT();
  return (
    <span className="inline-flex items-center gap-1.5">
      <PersonAvatar user={u} size={18} />
      <span className="truncate">{tl(u.name)}</span>
    </span>
  );
}

function LineRow({ ln }: { ln: RequestLine }) {
  const { tl } = useT();
  const { fmtNum } = useFmt();
  return (
    <div className="flex items-center justify-between text-xs">
      <span>{tl(ln.description) || "—"}</span>
      <span className="tabular text-muted-foreground">
        {fmtNum(ln.qtyDone)} / {fmtNum(ln.qtyRequested)} {tl(ln.unit)}
      </span>
    </div>
  );
}

function MiniRow({ r, icon, onClick, label }: { r: Request; icon: React.ReactNode; onClick: () => void; label?: string }) {
  const { tl } = useT();
  const owner = useUser(r.ownerId);
  return (
    <button onClick={onClick} className="flex items-center gap-2 rounded-lg border px-2.5 py-2 text-start text-xs hover:bg-muted/60">
      <span className="text-muted-foreground">{icon}</span>
      <StageDot stage={stageOf(r.status)} />
      <span className="min-w-0 flex-1 truncate">
        {label && <span className="me-1 text-muted-foreground">{label}:</span>}
        {tl(r.text)}
      </span>
      {owner && <PersonAvatar user={owner} size={18} />}
      <span className="font-mono text-[10px] text-muted-foreground">{r.ref}</span>
    </button>
  );
}

function PathStep({ a, prev, last }: { a: AuditEntry; prev?: AuditEntry; last: boolean }) {
  const { t, tl } = useT();
  const { fmtRelative, fmtDuration } = useFmt();
  const actor = useUser(a.actorId);
  const to = useUser(a.toUserId);
  const note = tl(a.note);
  const gap = prev ? durationMs(prev.at, a.at) : 0;
  return (
    <li className="relative flex gap-2.5 pb-3">
      {!last && <span className="absolute top-6 bottom-0 start-[9px] w-px bg-border" />}
      {actor && <PersonAvatar user={actor} size={20} className="relative z-10 mt-0.5" />}
      <div className="min-w-0 flex-1 text-xs">
        <div className="flex flex-wrap items-center gap-x-1">
          <span className="font-semibold">{actor && tl(actor.name)}</span>
          <span className="text-muted-foreground">{t.audit[a.action]}</span>
          {to && a.action !== "rejected" && <span className="font-semibold">{tl(to.name)}</span>}
          {a.offPath && (
            <span className="inline-flex items-center gap-0.5 rounded-full bg-stage-wait-soft px-1.5 text-[10px] font-semibold text-stage-wait">
              <ArrowLeftRight className="size-3" /> {t.flag.offPath}
            </span>
          )}
        </div>
        {note && <div className="mt-0.5 rounded-lg bg-muted/60 px-2 py-1 text-foreground/80">{note}</div>}
        <div className="mt-0.5 text-[10px] text-muted-foreground">
          {fmtRelative(a.at)}
          {prev && gap > 60_000 && (
            <>
              {" · "}
              {t.detail.duration} {fmtDuration(gap)}
            </>
          )}
        </div>
      </div>
    </li>
  );
}

/* ---------- action dialogs ---------- */

type Actions = {
  approve: (id: string, note: string) => void;
  reject: (id: string, note: string) => void;
  requestClarification: (id: string, note: string) => void;
  clarify: (id: string, note: string) => void;
  complete: (id: string, note: string) => void;
  reopen: (id: string, note: string) => void;
  cancel: (id: string, note: string) => void;
  transfer: (id: string, to: string, note: string) => void;
  returnToSender: (id: string, note: string) => void;
  extend: (id: string, iso: string, reason: string) => void;
  recordProgress: (id: string, lineId: string, qty: number) => void;
};

function ActionDialog({ r, action, onClose, actions }: { r: Request; action: RequestAction | null; onClose: () => void; actions: Actions }) {
  const { t, tl } = useT();
  const people = usePeople(r.projectId);
  const settings = useEngine((s) => s.db.company.settings);
  const [note, setNote] = useState("");
  const [to, setTo] = useState<string | null>(null);
  const [date, setDate] = useState<string>(() => r.deadline.slice(0, 10));
  const [qty, setQty] = useState<Record<string, number>>(() => Object.fromEntries(r.lines.map((l) => [l.id, l.qtyDone])));

  const cfg = useMemo(() => {
    const m: Partial<Record<RequestAction, { title: string; noteRequired: boolean; noteLabel: string }>> = {
      approve: { title: t.dialog.approveTitle, noteRequired: false, noteLabel: t.dialog.note },
      reject: { title: t.dialog.rejectTitle, noteRequired: true, noteLabel: t.dialog.reason },
      request_clarification: { title: t.dialog.clarifyTitle, noteRequired: true, noteLabel: t.dialog.note },
      clarify: { title: t.dialog.clarifyAnswerTitle, noteRequired: true, noteLabel: t.dialog.note },
      complete: { title: t.dialog.completeTitle, noteRequired: false, noteLabel: t.dialog.note },
      reopen: { title: t.dialog.reopenTitle, noteRequired: true, noteLabel: t.dialog.reason },
      cancel: { title: t.dialog.cancelTitle, noteRequired: true, noteLabel: t.dialog.reason },
      transfer: { title: t.dialog.transferTitle, noteRequired: true, noteLabel: t.dialog.note },
      return: { title: t.dialog.returnTitle, noteRequired: true, noteLabel: t.dialog.reason },
      extend: { title: t.dialog.extendTitle, noteRequired: true, noteLabel: t.dialog.reason },
      progress: { title: t.dialog.progressTitle, noteRequired: false, noteLabel: t.dialog.note },
    };
    return action ? m[action] : undefined;
  }, [action, t]);

  if (!action || !cfg) return null;

  const valid =
    (!cfg.noteRequired || note.trim().length > 0) &&
    (action !== "transfer" || !!to) &&
    (action !== "extend" || !!date);

  const submit = () => {
    const n = note.trim();
    switch (action) {
      case "approve": actions.approve(r.id, n); break;
      case "reject": actions.reject(r.id, n); break;
      case "request_clarification": actions.requestClarification(r.id, n); break;
      case "clarify": actions.clarify(r.id, n); break;
      case "complete": actions.complete(r.id, n); break;
      case "reopen": actions.reopen(r.id, n); break;
      case "cancel": actions.cancel(r.id, n); break;
      case "transfer": if (to) actions.transfer(r.id, to, n); break;
      case "return": actions.returnToSender(r.id, n); break;
      case "extend": actions.extend(r.id, new Date(date + "T17:00:00").toISOString(), n); break;
      case "progress": for (const l of r.lines) actions.recordProgress(r.id, l.id, qty[l.id] ?? l.qtyDone); break;
    }
    setNote("");
    setTo(null);
    onClose();
  };

  const allPeople = [...people.team, ...(people.manager ? [people.manager] : []), ...people.others];

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{cfg.title}</DialogTitle>
          {action === "transfer" && <p className="text-xs text-muted-foreground">{t.dialog.transferHint}</p>}
        </DialogHeader>

        {action === "transfer" && (
          <div className="max-h-56 overflow-y-auto rounded-lg border p-1 thin-scroll">
            {allPeople.map((u) => (
              <button
                key={u.id}
                onClick={() => setTo(u.id)}
                className={cn("flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-start hover:bg-muted", to === u.id && "bg-accent")}
              >
                <PersonAvatar user={u} size={22} />
                <span className="min-w-0">
                  <span className="block truncate text-sm">{tl(u.name)}</span>
                  <span className="block truncate text-[11px] text-muted-foreground">{tl(u.title)}</span>
                </span>
              </button>
            ))}
          </div>
        )}

        {action === "extend" && (
          <label className="flex flex-col gap-1 text-xs text-muted-foreground">
            {t.dialog.newDeadline}
            <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="h-9 rounded-md border bg-transparent px-2 text-sm text-foreground" />
            <span className="text-[10px]">{settings.deadlineMode === "working" ? t.settings.working : t.settings.calendarDays}</span>
          </label>
        )}

        {action === "progress" && (
          <div className="flex flex-col gap-2">
            {r.lines.map((l) => (
              <label key={l.id} className="flex items-center gap-2 text-sm">
                <span className="min-w-0 flex-1 truncate">{tl(l.description) || l.id}</span>
                <input
                  type="number"
                  min={0}
                  max={l.qtyRequested}
                  value={qty[l.id] ?? 0}
                  onChange={(e) => setQty({ ...qty, [l.id]: Number(e.target.value) })}
                  className="h-9 w-20 rounded-md border bg-transparent px-2 text-end tabular"
                />
                <span className="text-xs text-muted-foreground">
                  {t.dialog.of} {l.qtyRequested}
                </span>
              </label>
            ))}
          </div>
        )}

        {action !== "progress" && (
          <label className="flex flex-col gap-1 text-xs text-muted-foreground">
            <span>
              {cfg.noteLabel} {cfg.noteRequired ? "*" : `(${t.dialog.optional})`}
            </span>
            <Textarea value={note} onChange={(e) => setNote(e.target.value)} rows={3} className="text-sm text-foreground" autoFocus={action !== "transfer"} />
          </label>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>{t.dialog.cancel}</Button>
          <Button onClick={submit} disabled={!valid} variant={action === "reject" || action === "cancel" ? "destructive" : "default"}>
            {t.action[action]}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
