"use client";

import { useEffect, useMemo, useState } from "react";
import { cn } from "cn";
import { ArrowDown, ArrowUp, ArrowLeftRight, CalendarDays, CornerDownLeft, Flame, MessageSquareQuote, SendHorizontal } from "lucide-react";
import type { CompanySettings, FieldDef, Priority } from "@/lib/engine/types";
import { addDeadlineDays, directionOf, resolveFirstRecipient } from "@/lib/engine/rules";
import { useEngine, selectMe, type ComposerDraft } from "@/lib/engine/store";
import { usePeople, useIsDesktop } from "@/lib/engine/hooks";
import { useT, useFmt, useLocale } from "@/lib/i18n";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { Chip, PersonPicker, TypePicker } from "@/components/bubbles/pickers";

function emptyDraft(projectId: string): ComposerDraft {
  return {
    projectId,
    text: "",
    recipientId: null,
    typeId: "t_task",
    priority: "normal",
    deadline: null,
    fields: {},
    parentId: null,
    lineId: null,
    returnToId: null,
    fromMessageId: null,
  };
}

/** The bubble. Docked under the inbox, or inside a sheet for sub-requests / chat conversions. */
export function Composer({
  initial,
  onDone,
  autoFocus,
  className,
}: {
  initial?: ComposerDraft | null;
  onDone?: (id: string) => void;
  autoFocus?: boolean;
  className?: string;
}) {
  const { t, tl } = useT();
  const { fmtDue, fmtDate } = useFmt();
  const me = useEngine(selectMe);
  const projectId = useEngine((s) => s.session.projectId);
  const types = useEngine((s) => s.db.requestTypes);
  const users = useEngine((s) => s.db.users);
  const departments = useEngine((s) => s.db.departments);
  const projects = useEngine((s) => s.db.projects);
  const settings = useEngine((s) => s.db.company.settings);
  const requests = useEngine((s) => s.db.requests);
  const createRequest = useEngine((s) => s.createRequest);
  const openRequest = useEngine((s) => s.openRequest);

  const [d, setD] = useState<ComposerDraft>(() => initial ?? emptyDraft(projectId));
  useEffect(() => {
    if (initial) setD(initial);
  }, [initial]);
  useEffect(() => {
    if (!initial) setD((x) => ({ ...x, projectId }));
  }, [projectId, initial]);

  const type = types.find((x) => x.id === d.typeId) ?? types[0];
  const project = projects.find((p) => p.id === d.projectId) ?? projects[0];
  const people = usePeople(project?.id ?? "");
  const parent = d.parentId ? requests.find((r) => r.id === d.parentId) : null;

  // default recipient follows the routing rule; the user can still override it
  const ruleRecipient = useMemo(
    () =>
      project
        ? resolveFirstRecipient(type, {
            creator: me,
            users,
            projectManagerId: project.managerId,
            departmentSupervisor: (id) => departments.find((x) => x.id === id)?.supervisorId,
          })
        : null,
    [type, me, users, project, departments],
  );
  const recipientId = d.recipientId ?? ruleRecipient;
  const recipient = users.find((u) => u.id === recipientId) ?? null;
  const deadline = d.deadline ?? addDeadlineDays(new Date(), type.routing.defaultDeadlineDays, settings).toISOString();
  const needsApproval = type.routing.approval === "project_manager" && me.id !== project?.managerId;
  const direction = recipient ? directionOf(users, me.id, recipient.id) : null;
  const canSend = d.text.trim().length > 0 && !!recipient && !!project;

  const send = () => {
    if (!canSend || !recipient || !project) return;
    const id = createRequest({
      projectId: project.id,
      typeId: type.id,
      text: d.text,
      recipientId: recipient.id,
      priority: d.priority,
      deadline,
      fields: d.fields,
      parentId: d.parentId,
      lineId: d.lineId,
      returnToId: d.returnToId,
      fromMessageId: d.fromMessageId,
    });
    setD(emptyDraft(d.projectId));
    onDone?.(id);
    openRequest(id);
  };

  if (!project) return <p className="rounded-2xl border border-dashed p-4 text-center text-sm text-muted-foreground">{t.landing.noProject}</p>;

  return (
    <div className={cn("relative rounded-2xl border bg-card p-2.5 shadow-sm", className)} data-tour="composer">
      {(parent || d.fromMessageId) && (
        <div className="mb-1.5 flex flex-wrap items-center gap-1.5 px-1 text-[11px] text-muted-foreground">
          {parent && (
            <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5">
              <CornerDownLeft className="size-3" />
              {t.inbox.subOf} <span className="font-mono">{parent.ref}</span>
            </span>
          )}
          {parent && (
            <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5">
              {t.inbox.returnsTo} {t.inbox.me}
            </span>
          )}
          {d.fromMessageId && (
            <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5">
              <MessageSquareQuote className="size-3" />
              {t.inbox.fromMessage}
            </span>
          )}
        </div>
      )}

      <Textarea
        autoFocus={autoFocus}
        value={d.text}
        onChange={(e) => setD({ ...d, text: e.target.value })}
        onKeyDown={(e) => {
          if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) send();
        }}
        placeholder={parent ? t.inbox.placeholderSub : t.inbox.placeholder}
        className="min-h-[56px] resize-none border-0 bg-transparent px-1.5 py-1 text-[15px] shadow-none focus-visible:ring-0 dark:bg-transparent"
        rows={2}
      />

      {type.fields.length > 0 && (
        <div className="mb-2 grid gap-2 px-1 sm:grid-cols-3">
          {type.fields.map((f) => (
            <FieldInput key={f.key} f={f} value={d.fields[f.key]} onChange={(v) => setD({ ...d, fields: { ...d.fields, [f.key]: v } })} />
          ))}
        </div>
      )}

      <div className="flex flex-wrap items-center gap-1.5">
        <PersonPicker people={people} value={recipient} onChange={(u) => setD({ ...d, recipientId: u.id })} />

        <TypePicker types={types} value={type} onChange={(ty) => setD({ ...d, typeId: ty.id, fields: {}, recipientId: null, deadline: null })} />

        <DeadlinePicker value={deadline} label={fmtDue(deadline)} full={fmtDate(deadline)} onChange={(iso) => setD({ ...d, deadline: iso })} settings={settings} />

        <Chip
          active={d.priority === "urgent"}
          activeClass="bg-urgent-soft text-urgent border-urgent/30"
          onClick={() => setD({ ...d, priority: d.priority === "urgent" ? "normal" : "urgent" })}
        >
          <Flame className="size-3.5" />
          {d.priority === "urgent" ? t.inbox.urgent : t.inbox.normal}
        </Chip>

        <Button size="sm" className="ms-auto gap-1.5" disabled={!canSend} onClick={send}>
          {t.inbox.send}
          <SendHorizontal className="size-3.5 rtl:-scale-x-100" />
        </Button>
      </div>

      <p className="mt-1.5 flex min-h-4 flex-wrap items-center gap-x-3 gap-y-0.5 px-1 text-[11px] text-muted-foreground">
        {direction === "down" && (
          <span className="inline-flex items-center gap-1"><ArrowDown className="size-3" />{t.inbox.downHint}</span>
        )}
        {direction === "up" && (
          <span className="inline-flex items-center gap-1"><ArrowUp className="size-3" />{t.inbox.upHint}</span>
        )}
        {direction === "cross" && (
          <span className="inline-flex items-center gap-1"><ArrowLeftRight className="size-3" />{t.inbox.offPathHint}</span>
        )}
        <span>{needsApproval ? t.inbox.needsApproval : direction ? t.inbox.goesDirect : ""}</span>
      </p>
    </div>
  );
}

/* ---------- pieces ---------- */

function DeadlinePicker({
  value,
  label,
  full,
  onChange,
  settings,
}: {
  value: string;
  label: string;
  full: string;
  onChange: (iso: string) => void;
  settings: CompanySettings;
}) {
  const { t } = useT();
  const [open, setOpen] = useState(false);
  const plus = (days: number) => {
    onChange(addDeadlineDays(new Date(), days, settings).toISOString());
    setOpen(false);
  };
  const dateValue = value.slice(0, 10);
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger render={<Chip />}>
        <CalendarDays className="size-3.5" />
        {label}
        <span className="hidden text-muted-foreground sm:inline">· {full}</span>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-64">
        <div className="text-xs font-semibold text-muted-foreground">{t.inbox.pickDeadline}</div>
        <div className="grid grid-cols-2 gap-1.5">
          <Button variant="outline" size="sm" onClick={() => plus(1)}>{t.inbox.plus.d1}</Button>
          <Button variant="outline" size="sm" onClick={() => plus(3)}>{t.inbox.plus.d3}</Button>
          <Button variant="outline" size="sm" onClick={() => plus(7)}>{t.inbox.plus.d7}</Button>
          <Button variant="outline" size="sm" onClick={() => plus(14)}>{t.inbox.plus.d14}</Button>
        </div>
        <input
          type="date"
          value={dateValue}
          onChange={(e) => {
            if (!e.target.value) return;
            const d = new Date(e.target.value + "T17:00:00");
            onChange(d.toISOString());
            setOpen(false);
          }}
          className="h-8 w-full rounded-md border bg-transparent px-2 text-sm"
        />
      </PopoverContent>
    </Popover>
  );
}

export function FieldInput({ f, value, onChange }: { f: FieldDef; value: string | number | undefined; onChange: (v: string | number) => void }) {
  const { tl } = useT();
  const base = "h-8 w-full rounded-md border bg-transparent px-2 text-sm placeholder:text-muted-foreground focus-visible:ring-3 focus-visible:ring-ring/50 outline-none";
  const label = tl(f.label) + (f.required ? " *" : "");
  if (f.kind === "select") {
    return (
      <label className="flex flex-col gap-0.5 text-[11px] text-muted-foreground">
        {label}
        <select value={String(value ?? "")} onChange={(e) => onChange(e.target.value)} className={cn(base, "text-foreground")}>
          <option value="">—</option>
          {f.options?.map((o) => (
            <option key={o.ar} value={o.ar}>
              {tl(o)}
            </option>
          ))}
        </select>
      </label>
    );
  }
  return (
    <label className="flex flex-col gap-0.5 text-[11px] text-muted-foreground">
      {label}
      <input
        type={f.kind === "number" ? "number" : f.kind === "date" ? "date" : "text"}
        value={value ?? ""}
        onChange={(e) => onChange(f.kind === "number" ? Number(e.target.value) : e.target.value)}
        className={cn(base, "text-foreground")}
      />
    </label>
  );
}

/** Sub-requests and chat conversions open the same bubble inside a sheet. */
export function ComposerSheet() {
  const { t } = useT();
  const draft = useEngine((s) => s.session.composer);
  const setComposer = useEngine((s) => s.setComposer);
  const desktop = useIsDesktop();
  const locale = useLocale();
  const open = !!draft;
  return (
    <Sheet open={open} onOpenChange={(o) => !o && setComposer(null)} modal={false}>
      <SheetContent side={desktop ? (locale === "ar" ? "left" : "right") : "bottom"} className="gap-0 overflow-y-auto p-4 sm:max-w-md data-[side=bottom]:max-h-[85dvh]">
        <SheetTitle className="mb-3 text-base">{draft?.parentId ? t.action.subrequest : t.nav.inbox}</SheetTitle>
        {draft && <Composer initial={draft} autoFocus onDone={() => setComposer(null)} />}
      </SheetContent>
    </Sheet>
  );
}

export type { Priority };
