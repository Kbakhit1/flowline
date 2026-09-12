"use client";

import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import { useCallback, useMemo } from "react";
import { dictOf, type Dict } from "./dict";
import type { L, Locale } from "@/lib/engine/types";
import { useEngine } from "@/lib/engine/store";
import { DAY } from "@/lib/engine/rules";

interface UiState {
  locale: Locale;
  setLocale: (l: Locale) => void;
}

export const useUi = create<UiState>()(
  persist(
    (set) => ({
      locale: "ar",
      setLocale: (locale) => set({ locale }),
    }),
    { name: "mirsal-ui-v1", storage: createJSONStorage(() => localStorage), skipHydration: true },
  ),
);

/** Fill `{n}`-style placeholders. */
export function fill(template: string, vars: Record<string, string | number>): string {
  return template.replace(/\{(\w+)\}/g, (_, k: string) => String(vars[k] ?? ""));
}

export function useLocale(): Locale {
  return useUi((s) => s.locale);
}

/** Translations + bilingual-field resolver. */
export function useT(): { t: Dict; tl: (l: L) => string; locale: Locale; dir: "rtl" | "ltr" } {
  const locale = useLocale();
  const t = useMemo(() => dictOf(locale), [locale]);
  const tl = useCallback((l: L) => (locale === "ar" ? l.ar : l.en), [locale]);
  return { t, tl, locale, dir: locale === "ar" ? "rtl" : "ltr" };
}

/** Locale + company-level formatting (numerals, calendar). */
export function useFmt() {
  const locale = useLocale();
  const numerals = useEngine((s) => s.db.company.settings.numerals);
  const calendar = useEngine((s) => s.db.company.settings.calendar);
  const t = useMemo(() => dictOf(locale), [locale]);

  return useMemo(() => {
    const base = locale === "ar" ? "ar-EG" : "en-GB";
    const numberingSystem = locale === "ar" && numerals === "arabic" ? "arab" : "latn";
    const num = new Intl.NumberFormat(base, { numberingSystem });
    const date = new Intl.DateTimeFormat(base, { numberingSystem, calendar, day: "numeric", month: "short" });
    const dateLong = new Intl.DateTimeFormat(base, { numberingSystem, calendar, day: "numeric", month: "long", year: "numeric" });
    const time = new Intl.DateTimeFormat(base, { numberingSystem, hour: "numeric", minute: "2-digit" });
    const rel = new Intl.RelativeTimeFormat(`${base}-u-nu-${numberingSystem}`, { numeric: "auto" });

    const fmtNum = (n: number) => num.format(n);
    const fmtDate = (iso: string) => date.format(new Date(iso));
    const fmtDateLong = (iso: string) => dateLong.format(new Date(iso));
    const fmtTime = (iso: string) => time.format(new Date(iso));

    const fmtRelative = (iso: string, now = Date.now()) => {
      const diff = new Date(iso).getTime() - now;
      const abs = Math.abs(diff);
      if (abs < 60_000) return rel.format(0, "minute");
      if (abs < 3_600_000) return rel.format(Math.round(diff / 60_000), "minute");
      if (abs < DAY) return rel.format(Math.round(diff / 3_600_000), "hour");
      if (abs < 30 * DAY) return rel.format(Math.round(diff / DAY), "day");
      return fmtDate(iso);
    };

    /** Deadline phrasing on the bubble: today / tomorrow / in N days / N days late. */
    const fmtDue = (iso: string, now = Date.now()) => {
      const start = new Date(now);
      start.setHours(0, 0, 0, 0);
      const target = new Date(iso);
      target.setHours(0, 0, 0, 0);
      const days = Math.round((target.getTime() - start.getTime()) / DAY);
      if (days === 0) return t.inbox.due.today;
      if (days === 1) return t.inbox.due.tomorrow;
      if (days > 1) return fill(t.inbox.due.inDays, { n: fmtNum(days) });
      if (days === -1 && new Date(iso).getTime() > now - DAY) return t.inbox.due.lateToday;
      return fill(t.inbox.due.lateBy, { n: fmtNum(-days) });
    };

    const fmtDuration = (ms: number) => {
      const h = Math.round(ms / 3_600_000);
      if (h < 1) return locale === "ar" ? "أقل من ساعة" : "under an hour";
      if (h < 48) return locale === "ar" ? `${fmtNum(h)} ساعة` : `${fmtNum(h)} h`;
      const d = Math.round(h / 24);
      return locale === "ar" ? `${fmtNum(d)} يوم` : `${fmtNum(d)} d`;
    };

    return { fmtNum, fmtDate, fmtDateLong, fmtTime, fmtRelative, fmtDue, fmtDuration };
  }, [locale, numerals, calendar, t]);
}
