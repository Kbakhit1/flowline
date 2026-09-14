"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowDown, ArrowUp, ClipboardList, Compass, CornerDownLeft, MoveRight } from "lucide-react";
import { useMemo } from "react";
import { useEngine } from "@/lib/engine/store";
import { buildSeed } from "@/lib/engine/seed";
import { useT } from "@/lib/i18n";
import { useHydrated } from "@/components/providers";
import { LangToggle, PersonAvatar, StageChip, ThemeToggle } from "@/components/common";
import { LogoLockup } from "@/components/logo";
import { useTour } from "@/lib/engine/tour";

const PERSONAS = ["u2", "u6", "u3", "u7", "u1"] as const;

export default function Landing() {
  const { t, tl } = useT();
  const hydrated = useHydrated();
  // the landing always shows the seeded company, whatever state the demo is in
  const seed = useMemo(() => buildSeed(), []);
  const users = seed.users;
  const requests = seed.requests;
  const setCurrentUser = useEngine((s) => s.setCurrentUser);
  const resetDemo = useEngine((s) => s.resetDemo);
  const startBlank = useEngine((s) => s.startBlank);
  const mode = useEngine((s) => s.session.mode);
  const router = useRouter();

  const blank = () => {
    startBlank();
    router.push("/app/setup");
  };

  const startTour = useTour((s) => s.start);
  const tour = () => {
    resetDemo();
    startTour();
    router.push("/app");
  };

  const enter = (id: string) => {
    if (mode === "blank") resetDemo();
    setCurrentUser(id);
    router.push("/app");
  };

  const chain = ["r1", "r1a", "r1b"].map((id) => requests.find((r) => r.id === id)!).filter(Boolean);

  return (
    <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col px-5 py-6 sm:px-8">
      <header className="flex items-center justify-between">
        <LogoLockup height={30} />
        <div className="flex items-center gap-1">
          <LangToggle />
          <ThemeToggle />
        </div>
      </header>

      <section className="mt-12 grid items-start gap-10 lg:grid-cols-[1.1fr_0.9fr] lg:gap-16">
        <div>
          <p className="text-xs font-semibold tracking-widest text-primary uppercase">{t.landing.kicker}</p>
          <h1 className="mt-3 text-balance text-3xl leading-[1.25] font-bold sm:text-4xl">{t.landing.title}</h1>
          <p className="mt-4 max-w-xl text-pretty text-base leading-relaxed text-muted-foreground">{t.landing.subtitle}</p>

          <button
            onClick={tour}
            disabled={!hydrated}
            className="mt-10 flex w-full items-center gap-4 rounded-2xl bg-primary p-4 text-start text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-60"
          >
            <span className="inline-flex size-11 shrink-0 items-center justify-center rounded-xl bg-primary-foreground/15">
              <Compass className="size-5" />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-sm font-semibold">{t.tour.cta}</span>
              <span className="block text-xs opacity-80">{t.tour.ctaText}</span>
            </span>
          </button>

          <button
            onClick={blank}
            disabled={!hydrated}
            className="mt-3 flex w-full items-center gap-4 rounded-2xl border-2 border-dashed border-primary/40 bg-primary/5 p-4 text-start transition-colors hover:border-primary hover:bg-primary/10 disabled:opacity-60"
          >
            <span className="inline-flex size-11 shrink-0 items-center justify-center rounded-xl bg-primary text-primary-foreground">
              <ClipboardList className="size-5" />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-sm font-semibold">{t.landing.blankTitle}</span>
              <span className="block text-xs text-muted-foreground">{t.landing.blankText}</span>
            </span>
            <span className="shrink-0 text-xs font-semibold text-primary">{t.landing.blankCta}</span>
          </button>

          <h2 className="mt-8 text-sm font-semibold text-muted-foreground">{t.landing.demoTitle}</h2>
          <div className="mt-3 grid gap-2 sm:grid-cols-2">
            {PERSONAS.map((id) => {
              const u = users.find((x) => x.id === id)!;
              return (
                <button
                  key={id}
                  onClick={() => enter(id)}
                  disabled={!hydrated}
                  className="group flex items-center gap-3 rounded-xl border bg-card p-3 text-start transition-colors hover:border-primary/40 hover:bg-accent/40 focus-visible:ring-3 focus-visible:ring-ring/50 disabled:opacity-60"
                >
                  <PersonAvatar user={u} size={40} />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-semibold">{tl(u.name)}</span>
                    <span className="block truncate text-xs text-muted-foreground">{tl(u.title)}</span>
                  </span>
                  <span className="text-xs font-medium text-primary opacity-0 transition-opacity group-hover:opacity-100">{t.landing.open}</span>
                </button>
              );
            })}
          </div>
          <p className="mt-4 text-xs leading-relaxed text-muted-foreground">{t.landing.note}</p>
        </div>

        <aside className="rounded-2xl border bg-card/60 p-5">
          <p className="text-xs leading-relaxed text-muted-foreground">{t.landing.scenario}</p>
          <ol className="mt-4 space-y-2">
            {chain.map((r, i) => {
              const owner = users.find((u) => u.id === r.ownerId)!;
              const creator = users.find((u) => u.id === r.creatorId)!;
              return (
                <li key={r.id} className="relative">
                  {i > 0 && (
                    <span className="absolute -top-2.5 start-5 text-muted-foreground/60">
                      <ArrowDown className="size-3" />
                    </span>
                  )}
                  <div className={i > 0 ? "ms-6 rounded-xl border bg-card p-3" : "rounded-xl border bg-card p-3"}>
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-mono text-[11px] text-muted-foreground">{r.ref}</span>
                      <StageChip stage={r.status === "complete" ? "done" : r.status === "awaiting_subrequests" ? "waiting" : "you"} />
                    </div>
                    <p className="mt-1 text-sm leading-snug">{tl(r.text)}</p>
                    <div className="mt-2 flex items-center gap-1.5 text-xs text-muted-foreground">
                      <PersonAvatar user={creator} size={18} />
                      <span>{tl(creator.name)}</span>
                      <MoveRight className="size-3.5 opacity-50 rtl:-scale-x-100" />
                      <PersonAvatar user={owner} size={18} />
                      <span>{tl(owner.name)}</span>
                    </div>
                  </div>
                </li>
              );
            })}
          </ol>
          <div className="mt-3 flex items-center gap-2 text-xs text-muted-foreground">
            <ArrowUp className="size-3.5" />
            <CornerDownLeft className="size-3.5" />
            <span>{t.app.tagline}</span>
          </div>
        </aside>
      </section>

      <footer className="mt-auto pt-12 text-xs text-muted-foreground">
        <Link href="/app" className="underline-offset-4 hover:underline">
          /app
        </Link>
      </footer>
    </main>
  );
}
