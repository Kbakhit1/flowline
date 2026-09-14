"use client";

import { useMemo, useState } from "react";
import { cn } from "cn";
import { ChevronDown, Plus, Search, Tag, UserRound, X } from "lucide-react";
import type { FieldKind, RequestType, RoleKey, User } from "@/lib/engine/types";
import { useEngine, selectMe } from "@/lib/engine/store";
import type { usePeople } from "@/lib/engine/hooks";
import { useT } from "@/lib/i18n";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import { PersonAvatar } from "@/components/common";

/* ---------- shared chip ---------- */

export function Chip({
  children,
  active,
  activeClass,
  onClick,
  className,
  ...rest
}: React.ComponentProps<"button"> & { active?: boolean; activeClass?: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "inline-flex h-7 max-w-[200px] items-center gap-1 rounded-full border px-2.5 text-xs font-medium whitespace-nowrap transition-colors hover:bg-muted",
        active ? activeClass : "border-border text-foreground/80",
        className,
      )}
      {...rest}
    >
      {children}
    </button>
  );
}

const inputCls =
  "h-8 w-full rounded-md border bg-transparent px-2 text-sm text-foreground placeholder:text-muted-foreground outline-none focus-visible:ring-3 focus-visible:ring-ring/50";

function SearchBox({ value, onChange, placeholder }: { value: string; onChange: (v: string) => void; placeholder: string }) {
  return (
    <div className="relative">
      <Search className="pointer-events-none absolute top-1/2 start-2 size-3.5 -translate-y-1/2 text-muted-foreground" />
      <input
        autoFocus
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className={cn(inputCls, "ps-7")}
      />
      {value && (
        <button type="button" onClick={() => onChange("")} className="absolute top-1/2 end-1.5 -translate-y-1/2 text-muted-foreground hover:text-foreground" aria-label="clear">
          <X className="size-3.5" />
        </button>
      )}
    </div>
  );
}

const norm = (s: string) => s.toLowerCase().replace(/[أإآ]/g, "ا").replace(/ة/g, "ه").replace(/ى/g, "ي").replace(/[ً-ْ]/g, "");

/* ---------- person picker ---------- */

export function PersonPicker({ people, value, onChange }: { people: ReturnType<typeof usePeople>; value: User | null; onChange: (u: User) => void }) {
  const { t, tl } = useT();
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const [adding, setAdding] = useState(false);

  const groups = useMemo(() => {
    const match = (u: User) => !q || norm(tl(u.name) + " " + tl(u.title)).includes(norm(q));
    return [
      { label: t.inbox.myTeam, list: people.team.filter(match) },
      { label: t.inbox.myManager, list: (people.manager ? [people.manager] : []).filter(match) },
      { label: t.inbox.others, list: people.others.filter(match) },
    ].filter((g) => g.list.length);
  }, [people, q, t, tl]);

  const pick = (u: User) => {
    onChange(u);
    setOpen(false);
    setQ("");
  };

  return (
    <>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger render={<Chip active={!!value} activeClass="border-primary/40 bg-primary/5 text-primary" />}>
          {value ? <PersonAvatar user={value} size={18} /> : <UserRound className="size-3.5" />}
          <span className="truncate">{value ? tl(value.name) : t.inbox.pickPerson}</span>
          <ChevronDown className="size-3 opacity-60" />
        </PopoverTrigger>
        <PopoverContent align="start" className="w-72 gap-1.5 p-1.5">
          <SearchBox value={q} onChange={setQ} placeholder={t.inbox.search} />
          <div className="max-h-[48vh] overflow-y-auto thin-scroll">
            {groups.length === 0 && <p className="px-2 py-3 text-center text-xs text-muted-foreground">{t.inbox.noMatch}</p>}
            {groups.map((g) => (
              <div key={g.label} className="mb-1">
                <div className="px-2 py-1 text-[10px] font-semibold tracking-wide text-muted-foreground uppercase">{g.label}</div>
                {g.list.map((u) => (
                  <button
                    key={u.id}
                    type="button"
                    onClick={() => pick(u)}
                    className={cn("flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-start hover:bg-muted", value?.id === u.id && "bg-accent")}
                  >
                    <PersonAvatar user={u} size={24} />
                    <span className="min-w-0">
                      <span className="block truncate text-sm">{tl(u.name)}</span>
                      <span className="block truncate text-[11px] text-muted-foreground">{tl(u.title)}</span>
                    </span>
                  </button>
                ))}
              </div>
            ))}
          </div>
          <button
            type="button"
            onClick={() => {
              setOpen(false);
              setAdding(true);
            }}
            className="flex w-full items-center gap-2 rounded-md border border-dashed px-2 py-1.5 text-sm text-primary hover:bg-primary/5"
          >
            <Plus className="size-4" />
            {t.inbox.addPerson}
            {q && <span className="truncate text-xs text-muted-foreground">· {q}</span>}
          </button>
        </PopoverContent>
      </Popover>
      {adding && <AddPersonDialog initialName={q} onClose={() => setAdding(false)} onCreated={(u) => { setAdding(false); pick(u); }} />}
    </>
  );
}

export function AddPersonDialog({ initialName, onClose, onCreated }: { initialName: string; onClose: () => void; onCreated: (u: User) => void }) {
  const { t, tl } = useT();
  const me = useEngine(selectMe);
  const users = useEngine((s) => s.db.users);
  const departments = useEngine((s) => s.db.departments);
  const addUser = useEngine((s) => s.addUser);
  const [name, setName] = useState(initialName);
  const [title, setTitle] = useState("");
  const [departmentId, setDepartmentId] = useState(me.departmentId);
  const [managerId, setManagerId] = useState<string>(me.id);
  const [role, setRole] = useState<RoleKey>("employee");
  const valid = name.trim().length > 1;

  const submit = () => {
    if (!valid) return;
    const id = addUser({ name, title: title || t.roles[role], departmentId, managerId: managerId || null, role });
    const u = useEngine.getState().db.users.find((x) => x.id === id);
    if (u) onCreated(u);
  };

  const roles: RoleKey[] = ["employee", "site_supervisor", "dept_supervisor", "project_manager", "executive", "sysadmin"];

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{t.person.title}</DialogTitle>
          <p className="text-xs text-muted-foreground">{t.person.hint}</p>
        </DialogHeader>
        <div className="grid gap-3">
          <Field label={t.person.name}>
            <input autoFocus value={name} onChange={(e) => setName(e.target.value)} className={inputCls} />
          </Field>
          <Field label={t.person.jobTitle}>
            <input value={title} onChange={(e) => setTitle(e.target.value)} className={inputCls} />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label={t.person.department}>
              <select value={departmentId} onChange={(e) => setDepartmentId(e.target.value)} className={inputCls}>
                {departments.map((d) => (
                  <option key={d.id} value={d.id}>{tl(d.name)}</option>
                ))}
              </select>
            </Field>
            <Field label={t.person.role}>
              <select value={role} onChange={(e) => setRole(e.target.value as RoleKey)} className={inputCls}>
                {roles.map((r) => (
                  <option key={r} value={r}>{t.roles[r]}</option>
                ))}
              </select>
            </Field>
          </div>
          <Field label={t.person.manager}>
            <select value={managerId} onChange={(e) => setManagerId(e.target.value)} className={inputCls}>
              <option value="">—</option>
              {users.filter((u) => u.active).map((u) => (
                <option key={u.id} value={u.id}>{tl(u.name)} · {tl(u.title)}</option>
              ))}
            </select>
          </Field>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>{t.dialog.cancel}</Button>
          <Button onClick={submit} disabled={!valid}>{t.person.save}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/* ---------- type picker ---------- */

export function TypePicker({ types, value, onChange }: { types: RequestType[]; value: RequestType; onChange: (t: RequestType) => void }) {
  const { t, tl } = useT();
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const [adding, setAdding] = useState(false);
  const list = types.filter((ty) => !q || norm(tl(ty.name)).includes(norm(q)));

  const pick = (ty: RequestType) => {
    onChange(ty);
    setOpen(false);
    setQ("");
  };

  return (
    <>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger render={<Chip active={value.id !== "t_task"} activeClass="border-primary/40 bg-primary/5 text-primary" />}>
          <Tag className="size-3.5" />
          {tl(value.name)}
          <ChevronDown className="size-3 opacity-60" />
        </PopoverTrigger>
        <PopoverContent align="start" className="w-64 gap-1.5 p-1.5">
          <SearchBox value={q} onChange={setQ} placeholder={t.inbox.searchType} />
          <div className="max-h-[40vh] overflow-y-auto thin-scroll">
            {list.length === 0 && <p className="px-2 py-3 text-center text-xs text-muted-foreground">{t.inbox.noMatch}</p>}
            {list.map((ty) => (
              <button
                key={ty.id}
                type="button"
                onClick={() => pick(ty)}
                className={cn("flex w-full flex-col items-start rounded-md px-2 py-1.5 text-start hover:bg-muted", ty.id === value.id && "bg-accent")}
              >
                <span className="text-sm">{tl(ty.name)}</span>
                <span className="text-[10px] text-muted-foreground">
                  {ty.routing.approval === "none" ? t.inbox.goesDirect : t.inbox.needsApproval}
                  {ty.fields.length ? ` · ${ty.fields.length} ${t.settings.typeFields}` : ""}
                </span>
              </button>
            ))}
          </div>
          <button
            type="button"
            onClick={() => {
              setOpen(false);
              setAdding(true);
            }}
            className="flex w-full items-center gap-2 rounded-md border border-dashed px-2 py-1.5 text-sm text-primary hover:bg-primary/5"
          >
            <Plus className="size-4" />
            {t.inbox.addType}
            {q && <span className="truncate text-xs text-muted-foreground">· {q}</span>}
          </button>
        </PopoverContent>
      </Popover>
      {adding && <AddTypeDialog initialName={q} onClose={() => setAdding(false)} onCreated={(ty) => { setAdding(false); pick(ty); }} />}
    </>
  );
}

type Kind = Exclude<FieldKind, "attachment">;
type FieldRow = { label: string; kind: Kind; options: string };

export function AddTypeDialog({ initialName, onClose, onCreated }: { initialName: string; onClose: () => void; onCreated: (t: RequestType) => void }) {
  const { t } = useT();
  const addRequestType = useEngine((s) => s.addRequestType);
  const [name, setName] = useState(initialName);
  const [approval, setApproval] = useState<"none" | "project_manager">("none");
  const [days, setDays] = useState(3);
  const [hasLines, setHasLines] = useState(false);
  const [fields, setFields] = useState<FieldRow[]>([]);
  const valid = name.trim().length > 1;
  const kinds: Kind[] = ["text", "number", "date", "select"];

  const submit = () => {
    if (!valid) return;
    const id = addRequestType({
      name,
      approval,
      defaultDeadlineDays: days,
      hasLines,
      fields: fields.map((f) => ({ label: f.label, kind: f.kind, options: f.options.split(/[,،]/).map((s) => s.trim()).filter(Boolean) })),
    });
    const ty = useEngine.getState().db.requestTypes.find((x) => x.id === id);
    if (ty) onCreated(ty);
  };

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{t.typeForm.title}</DialogTitle>
          <p className="text-xs text-muted-foreground">{t.typeForm.hint}</p>
        </DialogHeader>
        <div className="grid gap-3">
          <Field label={t.typeForm.name}>
            <input autoFocus value={name} onChange={(e) => setName(e.target.value)} className={inputCls} />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label={t.typeForm.approval}>
              <select value={approval} onChange={(e) => setApproval(e.target.value as "none" | "project_manager")} className={inputCls}>
                <option value="none">{t.typeForm.none}</option>
                <option value="project_manager">{t.typeForm.pm}</option>
              </select>
            </Field>
            <Field label={t.typeForm.deadline}>
              <input type="number" min={1} value={days} onChange={(e) => setDays(Number(e.target.value))} className={cn(inputCls, "tabular")} />
            </Field>
          </div>
          <label className="flex items-center justify-between gap-3 text-sm">
            {t.typeForm.hasLines}
            <Switch checked={hasLines} onCheckedChange={setHasLines} />
          </label>
          <div>
            <div className="mb-1 flex items-center justify-between">
              <span className="text-xs text-muted-foreground">{t.typeForm.fields}</span>
              <Button size="xs" variant="ghost" onClick={() => setFields([...fields, { label: "", kind: "text", options: "" }])}>
                <Plus className="size-3" />
                {t.typeForm.addField}
              </Button>
            </div>
            <div className="flex flex-col gap-1.5">
              {fields.map((f, i) => (
                <div key={i} className="grid grid-cols-[1fr_110px_auto] gap-1.5">
                  <input
                    placeholder={t.typeForm.fieldLabel}
                    value={f.label}
                    onChange={(e) => setFields(fields.map((x, j) => (j === i ? { ...x, label: e.target.value } : x)))}
                    className={inputCls}
                  />
                  <select value={f.kind} onChange={(e) => setFields(fields.map((x, j) => (j === i ? { ...x, kind: e.target.value as Kind } : x)))} className={inputCls}>
                    {kinds.map((k) => (
                      <option key={k} value={k}>{t.typeForm.kinds[k]}</option>
                    ))}
                  </select>
                  <Button size="icon-sm" variant="ghost" onClick={() => setFields(fields.filter((_, j) => j !== i))} aria-label="remove">
                    <X className="size-3.5" />
                  </Button>
                  {f.kind === "select" && (
                    <input
                      placeholder={t.typeForm.options}
                      value={f.options}
                      onChange={(e) => setFields(fields.map((x, j) => (j === i ? { ...x, options: e.target.value } : x)))}
                      className={cn(inputCls, "col-span-3")}
                    />
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>{t.dialog.cancel}</Button>
          <Button onClick={submit} disabled={!valid}>{t.typeForm.save}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-1 text-xs text-muted-foreground">
      {label}
      {children}
    </label>
  );
}
