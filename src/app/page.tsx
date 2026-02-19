import Link from "next/link";
import { getTranslations } from "next-intl/server";

import { Button } from "~/components/ui/button";
import { Github } from "~/components/icons/Github";
import { LandingPreview } from "~/components/landing-preview";
import { Navbar } from "~/components/navbar";

export default async function Home() {
  const t = await getTranslations("Home");

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

      <main className="flex-1 w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 lg:py-20 relative z-10 flex flex-col lg:flex-row gap-12 lg:gap-8 items-center lg:items-stretch">
        {/* Left Column: Typography & CTAs */}
        <div className="flex-1 flex flex-col justify-center space-y-8 w-full lg:max-w-2xl">
          {/* Badge */}
          <div className="inline-flex w-fit items-center gap-2 px-3 py-1.5 border-2 border-foreground bg-primary text-primary-foreground font-black uppercase tracking-widest text-xs sm:text-sm shadow-[4px_4px_0_0_currentColor] -rotate-2">
            <span className="size-2 bg-primary-foreground animate-pulse" />
            {t("hero.badge")}
          </div>

          {/* Heading */}
          <h1 className="text-5xl sm:text-6xl md:text-7xl lg:text-[5.5rem] font-black uppercase tracking-tighter leading-[0.85]">
            {t("hero.title")}
            <br />
            <span className="inline-block mt-4 bg-foreground text-background px-4 py-2 rotate-1">
              {t("hero.titleHighlight")}
            </span>
          </h1>

          {/* Subtitle */}
          <div className="border-l-4 border-primary pl-6 py-2 my-4">
            <p className="text-lg sm:text-xl font-medium leading-relaxed">
              {t("hero.description")}
            </p>
          </div>

          {/* CTA Buttons */}
          <div className="flex flex-col sm:flex-row gap-6 pt-6">
            <Link href="/viewer" className="block w-full sm:w-auto group">
              <Button
                size="lg"
                className="w-full text-base sm:text-lg h-14 sm:h-16 px-8 font-black uppercase tracking-widest rounded-none border-4 border-foreground bg-primary text-primary-foreground hover:bg-primary/90 shadow-[6px_6px_0_0_var(--color-foreground)] group-hover:translate-y-[2px] group-hover:translate-x-[2px] group-hover:shadow-[4px_4px_0_0_var(--color-foreground)] transition-all"
              >
                {t("cta.title")}
              </Button>
            </Link>
            <Link
              href="https://github.com/dan5py/mbox-viewer"
              target="_blank"
              rel="noopener noreferrer nofollow"
              className="block w-full sm:w-auto group"
            >
              <Button
                size="lg"
                variant="outline"
                className="w-full text-base sm:text-lg h-14 sm:h-16 px-8 font-black uppercase tracking-widest rounded-none border-4 border-foreground bg-background text-foreground hover:bg-muted shadow-[6px_6px_0_0_var(--color-foreground)] group-hover:translate-y-[2px] group-hover:translate-x-[2px] group-hover:shadow-[4px_4px_0_0_var(--color-foreground)] transition-all"
              >
                <Github className="size-5 mr-3" />
                {t("cta.github")}
              </Button>
            </Link>
          </div>
        </div>

        {/* Right Column: App preview in a brutalist window */}
        <div className="flex-1 flex w-full items-center justify-center lg:justify-end mt-8 lg:mt-0">
          <div className="relative w-full max-w-2xl border-4 border-foreground bg-background p-2 sm:p-3 shadow-[12px_12px_0_0_var(--color-foreground)] lg:shadow-[20px_20px_0_0_var(--color-foreground)] transform lg:rotate-1 transition-transform hover:rotate-0 duration-300">
            {/* Window bar */}
            <div className="flex items-center gap-2 sm:gap-3 border-b-4 border-foreground pb-2 sm:pb-3 mb-2 sm:mb-3">
              <div className="size-4 sm:size-5 border-2 border-foreground bg-destructive rounded-none"></div>
              <div className="size-4 sm:size-5 border-2 border-foreground bg-primary rounded-none"></div>
              <div className="size-4 sm:size-5 border-2 border-foreground bg-foreground rounded-none"></div>
              <div className="ml-auto font-black uppercase tracking-widest text-xs sm:text-sm pr-2">
                {t("preview.windowTitle")}
              </div>
            </div>

            {/* Preview Image */}
            <div className="relative border-4 border-foreground overflow-hidden bg-muted aspect-video">
              <LandingPreview />
            </div>
          </div>
        </div>
      </main>

      {/* Feature separator */}
      <div className="border-y-4 border-foreground bg-primary text-primary-foreground py-4 relative z-10 overflow-hidden my-12">
        <div className="max-w-7xl mx-auto px-4 flex flex-col sm:flex-row flex-wrap justify-center lg:justify-between items-center gap-2 sm:gap-4 font-black uppercase tracking-widest text-xs sm:text-sm lg:text-base">
          <span>{t("featureStrip.privateByDesign")}</span>
          <span className="inline">•</span>
          <span>{t("featureStrip.noServerUploads")}</span>
          <span className="inline">•</span>
          <span>{t("featureStrip.browserBased")}</span>
          <span className="inline">•</span>
          <span>{t("featureStrip.openSource")}</span>
        </div>
      </div>
    </div>
  );
}
