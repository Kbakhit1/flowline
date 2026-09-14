"use client";

import Link from "next/link";
import { ClipboardList } from "lucide-react";
import { useEngine } from "@/lib/engine/store";
import { useSetupStatus } from "@/lib/engine/setup";
import { useT, useFmt, fill } from "@/lib/i18n";

/** Shown on the inbox while the training sheet is still incomplete. */
export function SetupBanner() {
  const { t } = useT();
  const { fmtNum } = useFmt();
  const mode = useEngine((s) => s.session.mode);
  const status = useSetupStatus();
  if (mode !== "blank" || status.complete) return null;
  return (
    <Link href="/app/setup" className="flex items-center gap-3 rounded-xl border border-primary/30 bg-primary/5 px-3 py-2.5 text-sm transition-colors hover:bg-primary/10">
      <ClipboardList className="size-4 text-primary" />
      <span className="flex-1">{fill(t.setup.banner, { n: fmtNum(status.count) })}</span>
      <span className="text-xs font-semibold text-primary">{t.setup.open}</span>
    </Link>
  );
}
