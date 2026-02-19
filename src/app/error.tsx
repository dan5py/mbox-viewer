"use client";

import { useEffect } from "react";
import { useTranslations } from "next-intl";

import { Button } from "~/components/ui/button";
import { Navbar } from "~/components/navbar";

export default function ErrorBoundary({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const t = useTranslations("Home.error");

  return (
    <div className="flex flex-col min-h-dvh bg-background text-foreground font-sans selection:bg-primary selection:text-primary-foreground relative overflow-hidden">
      {/* Background pattern */}
      <div
        className="absolute inset-0 z-0 opacity-[0.03] dark:opacity-[0.05] pointer-events-none"
        style={{
          backgroundImage:
            "linear-gradient(currentColor 1px, transparent 1px), linear-gradient(90deg, currentColor 1px, transparent 1px)",
          backgroundSize: "32px 32px",
        }}
      />

      <div className="relative z-10 border-b-4 border-foreground bg-background">
        <Navbar showViewerButton showSettingsButton={false} borderless />
      </div>

      <main className="flex-1 w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 lg:py-20 relative z-10 flex flex-col items-center justify-center text-center">
        {/* Error Container */}
        <div className="w-full max-w-3xl flex flex-col items-center justify-center space-y-8">
          {/* Badge */}
          <div className="inline-flex w-fit items-center gap-2 px-3 py-1.5 border-2 border-foreground bg-destructive text-destructive-foreground font-black uppercase tracking-widest text-xs sm:text-sm shadow-[4px_4px_0_0_currentColor] -rotate-2">
            CRITICAL_ERROR.EXE
          </div>

          {/* Heading */}
          <h1 className="text-5xl sm:text-6xl md:text-7xl lg:text-[5.5rem] font-black uppercase tracking-tighter leading-[0.85]">
            {t("title")}
          </h1>

          {/* Subtitle */}
          <div className="border-l-4 border-destructive pl-6 py-2 my-4">
            <p className="text-lg sm:text-xl font-medium leading-relaxed">
              {t("description")}
            </p>
          </div>

          {/* CTA Button */}
          <div className="pt-6">
            <Button
              onClick={() => reset()}
              size="lg"
              className="w-full sm:w-auto text-base sm:text-lg h-14 sm:h-16 px-12 font-black uppercase tracking-widest rounded-none border-4 border-foreground bg-primary text-primary-foreground hover:bg-primary/90 shadow-[6px_6px_0_0_var(--color-foreground)] hover:translate-y-[2px] hover:translate-x-[2px] hover:shadow-[4px_4px_0_0_var(--color-foreground)] transition-all"
            >
              {t("tryAgain")}
            </Button>
          </div>
        </div>
      </main>

      {/* Feature separator */}
      <div className="border-y-4 border-foreground bg-destructive text-destructive-foreground py-4 relative z-10 overflow-hidden my-12">
        <div className="max-w-7xl mx-auto px-4 flex flex-wrap justify-center sm:justify-between items-center gap-4 font-black uppercase tracking-widest text-xs sm:text-sm lg:text-base">
          <span>SYSTEM FAILURE</span>
          <span className="hidden sm:inline">•</span>
          <span>RUNTIME EXCEPTION</span>
          <span className="hidden md:inline">•</span>
          <span className="hidden md:inline">UNEXPECTED STATE</span>
          <span className="hidden lg:inline">•</span>
          <span className="hidden lg:inline">ABORT RETRY FAIL</span>
        </div>
      </div>
    </div>
  );
}
