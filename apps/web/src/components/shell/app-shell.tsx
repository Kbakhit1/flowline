"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "cn";
import { Bell, ChevronDown, LayoutGrid, MessageSquare, Network, Settings, Inbox } from "lucide-react";
import { useEngine, selectMe, selectUnreadCount } from "@/lib/engine/store";
import { useT } from "@/lib/i18n";
import { useHydrated } from "@/components/providers";
import { LangToggle, PersonAvatar, ThemeToggle } from "@/components/common";
import { Logo, LogoLockup } from "@/components/logo";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { RequestSheet } from "@/components/bubbles/request-sheet";
import { ComposerSheet } from "@/components/bubbles/composer";
import { Tour } from "@/components/tour";
import { useTour } from "@/lib/engine/tour";
import { Columns2, Compass, MessageSquareReply } from "lucide-react";

const NAV = [
  { href: "/app", key: "inbox", icon: Inbox },
  { href: "/app/tree", key: "tree", icon: Network },
  { href: "/app/chat", key: "chat", icon: MessageSquare },
  { href: "/app/notifications", key: "notifications", icon: Bell },
  { href: "/app/dashboard", key: "dashboard", icon: LayoutGrid },
  { href: "/app/settings", key: "settings", icon: Settings },
] as const;

export function AppShell({ children }: { children: React.ReactNode }) {
  const hydrated = useHydrated();
  const { t } = useT();
  const pathname = usePathname();
  const unread = useEngine(selectUnreadCount);
  const touring = useTour((s) => s.active);

  if (!hydrated) {
    return (
      <div className="flex flex-1 items-center justify-center text-sm text-muted-foreground">
        <Logo size={36} />
      </div>
    );
  }

  const isActive = (href: string) => (href === "/app" ? pathname === "/app" : pathname.startsWith(href));

  return (
    <div className="flex min-h-dvh flex-1">
      {/* desktop sidebar */}
      <aside className="hidden w-60 shrink-0 flex-col border-e bg-sidebar md:flex">
        <div className="flex h-14 items-center px-4">
          <LogoLockup height={26} />
        </div>
        <nav className="flex flex-col gap-0.5 px-2">
          {NAV.map((n) => (
            <Link
              key={n.href}
              href={n.href}
              className={cn(
                "flex h-9 items-center gap-2.5 rounded-lg px-2.5 text-sm font-medium transition-colors",
                isActive(n.href) ? "bg-sidebar-accent text-sidebar-accent-foreground" : "text-muted-foreground hover:bg-sidebar-accent/60 hover:text-foreground",
              )}
            >
              <n.icon className="size-4" />
              <span className="flex-1">{t.nav[n.key]}</span>
              {n.key === "notifications" && unread > 0 && (
                <span className="tabular rounded-full bg-primary px-1.5 text-[11px] font-semibold text-primary-foreground">{unread}</span>
              )}
            </Link>
          ))}
        </nav>
        <div className="mt-auto p-3">
          <ProjectPicker />
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <TopBar />
        <main className={cn("flex min-h-0 flex-1 flex-col pb-16 md:pb-0", touring && "tour-pad")}>{children}</main>
      </div>

      {/* mobile bottom nav */}
      <nav className="fixed inset-x-0 bottom-0 z-40 flex h-16 items-stretch border-t bg-background pb-[env(safe-area-inset-bottom)] md:hidden">
        {NAV.map((n) => (
          <Link
            key={n.href}
            href={n.href}
            className={cn(
              "relative flex flex-1 flex-col items-center justify-center gap-0.5 text-[10px] font-medium",
              isActive(n.href) ? "text-primary" : "text-muted-foreground",
            )}
          >
            <n.icon className="size-5" />
            <span>{t.nav[n.key]}</span>
            {n.key === "notifications" && unread > 0 && (
              <span className="absolute top-2 end-[calc(50%-16px)] size-2 rounded-full bg-primary" />
            )}
          </Link>
        ))}
      </nav>

      <RequestSheet />
      <ComposerSheet />
      <Tour />
    </div>
  );
}

function TopBar() {
  const { t, tl } = useT();
  const me = useEngine(selectMe);
  return (
    <header className="sticky top-0 z-30 flex h-14 shrink-0 items-center gap-2 border-b bg-background px-3 sm:px-4">
      <div className="flex items-center gap-2 md:hidden">
        <Logo size={24} />
      </div>
      <div className="md:hidden">
        <ProjectPicker compact />
      </div>
      <div className="ms-auto flex items-center gap-1">
        <TourButton />
        <LangToggle className="hidden sm:inline-flex" />
        <ThemeToggle />
        <PersonaMenu />
      </div>
      <span className="sr-only">{tl(me.name)}</span>
      <span className="sr-only">{t.common.viewAs}</span>
    </header>
  );
}

function TourButton() {
  const { t } = useT();
  const active = useTour((s) => s.active);
  const start = useTour((s) => s.start);
  const resetDemo = useEngine((s) => s.resetDemo);
  const mode = useEngine((s) => s.session.mode);
  const framed = useEngine((s) => !!s.pinnedUserId);
  if (active || framed) return null;
  const go = (id: "cycle" | "replies") => {
    if (mode === "blank") resetDemo();
    start(id);
  };
  return (
    <DropdownMenu>
      <DropdownMenuTrigger render={<Button variant="ghost" size="sm" />}>
        <Compass />
        <span className="hidden sm:inline">{t.tour.menu}</span>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-72">
        <DropdownMenuItem onClick={() => go("cycle")} className="gap-2.5">
          <Compass className="size-4 text-primary" />
          <span className="flex min-w-0 flex-col">
            <span className="text-sm">{t.tour.cycle.title}</span>
            <span className="truncate text-[10px] text-muted-foreground">{t.tour.cycle.ctaText}</span>
          </span>
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => go("replies")} className="gap-2.5">
          <MessageSquareReply className="size-4 text-primary" />
          <span className="flex min-w-0 flex-col">
            <span className="text-sm">{t.tour.replies.title}</span>
            <span className="truncate text-[10px] text-muted-foreground">{t.tour.replies.ctaText}</span>
          </span>
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={() => (window.location.href = `${process.env.NEXT_PUBLIC_BASE_PATH ?? ""}/split/`)} className="gap-2.5">
          <Columns2 className="size-4 text-primary" />
          <span className="flex min-w-0 flex-col">
            <span className="text-sm">{t.split.title}</span>
            <span className="truncate text-[10px] text-muted-foreground">{t.split.ctaText}</span>
          </span>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function ProjectPicker({ compact = false }: { compact?: boolean }) {
  const { t, tl } = useT();
  const projects = useEngine((s) => s.db.projects);
  const projectId = useEngine((s) => s.session.projectId);
  const setProject = useEngine((s) => s.setProject);
  const me = useEngine(selectMe);
  const mine = projects.filter((p) => p.memberIds.includes(me.id) || me.role === "executive" || me.role === "sysadmin");
  const current = projects.find((p) => p.id === projectId) ?? mine[0];
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button variant="outline" size={compact ? "sm" : "default"} className={cn("justify-between", compact ? "max-w-[190px]" : "w-full")} />
        }
      >
        <span className="truncate text-start">
          {!compact && <span className="block text-[10px] font-normal text-muted-foreground">{t.inbox.project}</span>}
          <span className="block truncate">{current ? tl(current.name) : "—"}</span>
        </span>
        <ChevronDown className="size-3.5 opacity-60" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-64">
        <DropdownMenuGroup>
          <DropdownMenuLabel>{t.inbox.project}</DropdownMenuLabel>
          {mine.map((p) => (
            <DropdownMenuItem key={p.id} onClick={() => setProject(p.id)} className={cn(p.id === current?.id && "bg-accent")}>
              <span className="flex flex-col">
                <span className="text-sm">{tl(p.name)}</span>
                <span className="font-mono text-[10px] text-muted-foreground">
                  {p.ref} · {t.dashboard.phase[p.phase]}
                </span>
              </span>
            </DropdownMenuItem>
          ))}
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function PersonaMenu() {
  const { t, tl } = useT();
  const users = useEngine((s) => s.db.users);
  const me = useEngine(selectMe);
  const setCurrentUser = useEngine((s) => s.setCurrentUser);
  return (
    <DropdownMenu>
      <DropdownMenuTrigger render={<Button variant="ghost" className="h-9 gap-2 px-1.5" data-tour="persona" />}>
        <PersonAvatar user={me} size={28} />
        <span className="hidden max-w-[140px] flex-col items-start leading-tight sm:flex">
          <span className="truncate text-xs font-semibold">{tl(me.name)}</span>
          <span className="truncate text-[10px] text-muted-foreground">{t.roles[me.role]}</span>
        </span>
        <ChevronDown className="size-3.5 opacity-60" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="max-h-[70vh] w-64 overflow-y-auto thin-scroll">
        <DropdownMenuGroup>
          <DropdownMenuLabel>{t.settings.viewAs}</DropdownMenuLabel>
          <DropdownMenuSeparator />
          {users.map((u) => (
            <DropdownMenuItem key={u.id} onClick={() => setCurrentUser(u.id)} className={cn("gap-2", u.id === me.id && "bg-accent")}>
              <PersonAvatar user={u} size={24} />
              <span className="flex min-w-0 flex-col">
                <span className="truncate text-sm">{tl(u.name)}</span>
                <span className="truncate text-[10px] text-muted-foreground">
                  {tl(u.title)} · {t.roles[u.role]}
                </span>
              </span>
            </DropdownMenuItem>
          ))}
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
