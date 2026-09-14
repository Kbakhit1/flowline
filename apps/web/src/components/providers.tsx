"use client";

import { useEffect, useState, createContext, useContext } from "react";
import { ThemeProvider } from "next-themes";
import { TooltipProvider } from "@/components/ui/tooltip";
import { DemoErrorBoundary } from "@/components/error-boundary";
import { useEngine } from "@/lib/engine/store";
import type { DbSnapshot } from "@/lib/engine/types";
import { useUi } from "@/lib/i18n";

const HydratedCtx = createContext(false);

/** True once both persisted stores are rehydrated on the client. */
export function useHydrated(): boolean {
  return useContext(HydratedCtx);
}

export function Providers({ children }: { children: React.ReactNode }) {
  const [hydrated, setHydrated] = useState(false);
  const locale = useUi((s) => s.locale);

  useEffect(() => {
    // persisted stores use skipHydration so server + first client render match
    Promise.all([useUi.persist.rehydrate(), useEngine.persist.rehydrate()]).then(() => {
      const persona = new URLSearchParams(window.location.search).get("persona");
      if (persona) useEngine.getState().pinUser(persona);
      useEngine.getState().runEscalations();
      setHydrated(true);
    });
    // split screen: when another frame saves, adopt its data (session stays ours)
    const onStorage = (e: StorageEvent) => {
      if (e.key !== "flowline-demo" || !e.newValue) return;
      try {
        const parsed = JSON.parse(e.newValue) as { state?: { db?: DbSnapshot } };
        if (parsed.state?.db) useEngine.getState().adoptDb(parsed.state.db);
      } catch {
        /* ignore malformed writes */
      }
    };
    window.addEventListener("storage", onStorage);
    if (process.env.NODE_ENV === "production" && "serviceWorker" in navigator) {
      navigator.serviceWorker.register(`${process.env.NEXT_PUBLIC_BASE_PATH ?? ""}/sw.js`).catch(() => {});
    }
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  useEffect(() => {
    const el = document.documentElement;
    el.lang = locale;
    el.dir = locale === "ar" ? "rtl" : "ltr";
  }, [locale]);

  return (
    <ThemeProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange>
      <TooltipProvider>
        <HydratedCtx.Provider value={hydrated}>
          <DemoErrorBoundary>{children}</DemoErrorBoundary>
        </HydratedCtx.Provider>
      </TooltipProvider>
    </ThemeProvider>
  );
}
