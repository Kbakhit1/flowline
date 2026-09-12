"use client";

import { useEffect, useState, createContext, useContext } from "react";
import { ThemeProvider } from "next-themes";
import { TooltipProvider } from "@/components/ui/tooltip";
import { useEngine } from "@/lib/engine/store";
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
      useEngine.getState().runEscalations();
      setHydrated(true);
    });
    if (process.env.NODE_ENV === "production" && "serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js").catch(() => {});
    }
  }, []);

  useEffect(() => {
    const el = document.documentElement;
    el.lang = locale;
    el.dir = locale === "ar" ? "rtl" : "ltr";
  }, [locale]);

  return (
    <ThemeProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange>
      <TooltipProvider>
        <HydratedCtx.Provider value={hydrated}>{children}</HydratedCtx.Provider>
      </TooltipProvider>
    </ThemeProvider>
  );
}
