"use client";

import { useTheme } from "next-themes";
import { useEffect, useState } from "react";
import { cn } from "cn";
import { useEngine, selectMe } from "@/lib/engine/store";
import { useT, useUi, useFmt } from "@/lib/i18n";
import { PersonAvatar, SectionTitle, Segmented } from "@/components/common";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { ClipboardList } from "lucide-react";

export default function SettingsPage() {
  const { t, tl } = useT();
  const { fmtNum } = useFmt();
  const locale = useUi((s) => s.locale);
  const setLocale = useUi((s) => s.setLocale);
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const company = useEngine((s) => s.db.company);
  const users = useEngine((s) => s.db.users);
  const departments = useEngine((s) => s.db.departments);
  const types = useEngine((s) => s.db.requestTypes);
  const me = useEngine(selectMe);
  const updateSettings = useEngine((s) => s.updateSettings);
  const resetDemo = useEngine((s) => s.resetDemo);
  const setCurrentUser = useEngine((s) => s.setCurrentUser);
  const s = company.settings;

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-7 px-3 py-4 sm:px-5">
      <div>
        <h1 className="text-lg font-bold">{t.settings.title}</h1>
        <p className="text-xs text-muted-foreground">{tl(company.name)}</p>
      </div>

      <Link href="/app/setup" className="flex items-center gap-3 rounded-xl border bg-card px-3 py-2.5 text-sm transition-colors hover:border-primary/40">
        <ClipboardList className="size-4 text-primary" />
        <span className="flex-1 font-medium">{t.setup.title}</span>
        <span className="text-xs text-muted-foreground">{t.setup.open}</span>
      </Link>

      <section className="flex flex-col gap-4">
        <Row label={t.settings.language}>
          <Segmented value={locale} onChange={setLocale} options={[{ value: "ar", label: "العربية" }, { value: "en", label: "English" }]} />
        </Row>
        <Row label={t.settings.theme}>
          {mounted && (
            <Segmented
              value={(theme ?? "system") as "light" | "dark" | "system"}
              onChange={setTheme}
              options={[
                { value: "light", label: t.settings.light },
                { value: "dark", label: t.settings.dark },
                { value: "system", label: t.settings.system },
              ]}
            />
          )}
        </Row>
        <Row label={t.settings.numerals}>
          <Segmented
            value={s.numerals}
            onChange={(v) => updateSettings({ numerals: v })}
            options={[
              { value: "latin", label: t.settings.latin },
              { value: "arabic", label: t.settings.arabic },
            ]}
          />
        </Row>
        <Row label={t.settings.calendar}>
          <Segmented
            value={s.calendar}
            onChange={(v) => updateSettings({ calendar: v })}
            options={[
              { value: "gregory", label: t.settings.gregory },
              { value: "islamic-umalqura", label: t.settings.hijri },
            ]}
          />
        </Row>
        <Row label={t.settings.deadlineMode}>
          <Segmented
            value={s.deadlineMode}
            onChange={(v) => updateSettings({ deadlineMode: v })}
            options={[
              { value: "working", label: t.settings.working },
              { value: "calendar", label: t.settings.calendarDays },
            ]}
          />
        </Row>
        <Row label={t.settings.workingDays}>
          <div className="flex flex-wrap gap-1">
            {t.common.days.map((d, i) => {
              const on = s.workingDays.includes(i);
              return (
                <button
                  key={d}
                  onClick={() => updateSettings({ workingDays: on ? s.workingDays.filter((x) => x !== i) : [...s.workingDays, i].sort() })}
                  className={cn("h-7 rounded-full border px-2.5 text-xs font-medium", on ? "border-primary/40 bg-primary/10 text-primary" : "text-muted-foreground")}
                >
                  {d}
                </button>
              );
            })}
          </div>
        </Row>
        <Row label={t.settings.projectChat} hint={t.settings.projectChatHint}>
          <Switch checked={s.projectChatEnabled} onCheckedChange={(v) => updateSettings({ projectChatEnabled: v })} />
        </Row>
      </section>

      <section>
        <SectionTitle count={types.length}>{t.settings.types}</SectionTitle>
        <ul className="mt-2 grid gap-1.5 sm:grid-cols-2">
          {types.map((ty) => (
            <li key={ty.id} className="rounded-xl border bg-card px-3 py-2 text-sm">
              <div className="font-semibold">{tl(ty.name)}</div>
              <div className="mt-0.5 text-[11px] text-muted-foreground">
                {t.settings.typeApproval}: {ty.routing.approval === "none" ? t.common.none : t.roles[ty.routing.approval]} · {t.settings.typeDeadline}:{" "}
                {fmtNum(ty.routing.defaultDeadlineDays)} · {fmtNum(ty.fields.length)} {t.settings.typeFields}
              </div>
            </li>
          ))}
        </ul>
      </section>

      <section>
        <SectionTitle count={users.length}>{t.settings.members}</SectionTitle>
        <ul className="mt-2 flex flex-col gap-1">
          {users.map((u) => {
            const mgr = users.find((x) => x.id === u.managerId);
            const dept = departments.find((d) => d.id === u.departmentId);
            return (
              <li key={u.id} className="flex items-center gap-2.5 rounded-xl border bg-card px-3 py-2 text-sm">
                <PersonAvatar user={u} size={28} />
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-medium">{tl(u.name)}</span>
                  <span className="block truncate text-[11px] text-muted-foreground">
                    {tl(u.title)} · {dept && tl(dept.name)} {mgr && `· ↑ ${tl(mgr.name)}`}
                  </span>
                </span>
                <span className="rounded-full bg-muted px-2 text-[10px] font-medium text-muted-foreground">{t.roles[u.role]}</span>
                {u.id !== me.id && (
                  <Button size="xs" variant="ghost" onClick={() => setCurrentUser(u.id)}>
                    {t.settings.viewAs}
                  </Button>
                )}
              </li>
            );
          })}
        </ul>
      </section>

      <section className="rounded-xl border border-dashed p-3">
        <div className="text-sm font-semibold">{t.settings.reset}</div>
        <p className="mt-0.5 text-xs text-muted-foreground">{t.settings.resetHint}</p>
        <Button variant="destructive" size="sm" className="mt-2" onClick={() => resetDemo()}>
          {t.settings.reset}
        </Button>
        <p className="mt-3 text-[11px] text-muted-foreground">{t.settings.installed}</p>
      </section>
    </div>
  );
}

function Row({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5">
      <div className="min-w-32">
        <div className="text-sm font-medium">{label}</div>
        {hint && <div className="text-[11px] text-muted-foreground">{hint}</div>}
      </div>
      <div className="ms-auto">{children}</div>
    </div>
  );
}
