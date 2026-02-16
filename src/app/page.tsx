import Link from "next/link";
import { getTranslations } from "next-intl/server";

import { Button } from "~/components/ui/button";
import { Github } from "~/components/icons/Github";
import { LandingPreview } from "~/components/landing-preview";
import { Navbar } from "~/components/navbar";

export default async function Home() {
  const t = await getTranslations("Home");

  return (
    <div className="flex flex-col min-h-dvh relative overflow-hidden">
      <Navbar showViewerButton showSettingsButton={false} borderless />

      <main className="flex-1 flex flex-col items-center px-4 sm:px-6 relative">
        {/* Background glow */}
        <div className="landing-glow" />

        {/* Hero content */}
        <div className="max-w-4xl mx-auto text-center space-y-6 pt-16 sm:pt-24 lg:pt-32 relative z-10">
          {/* Badge */}
          <div className="flex justify-center">
            <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full border border-primary/30 bg-primary/5 text-sm text-primary font-medium">
              <span className="size-1.5 rounded-full bg-primary animate-pulse" />
              {t("hero.badge")}
            </div>
          </div>

          {/* Heading */}
          <h1 className="text-4xl sm:text-5xl md:text-6xl lg:text-7xl font-bold tracking-tight leading-[1.1]">
            {t("hero.title")}
            <br />
            <span className="font-display italic text-primary decoration-primary underline decoration-2 underline-offset-8">
              {t("hero.titleHighlight")}
            </span>
          </h1>

          {/* Subtitle */}
          <p className="text-base sm:text-lg text-muted-foreground max-w-2xl mx-auto leading-relaxed">
            {t("hero.description")}
          </p>

          {/* CTA Buttons */}
          <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-2">
            <Link href="/viewer">
              <Button size="lg" className="text-base px-8 h-12 font-semibold">
                {t("cta.title")}
              </Button>
            </Link>
            <Link
              href="https://github.com/dan5py/mbox-viewer"
              target="_blank"
              rel="noopener noreferrer nofollow"
            >
              <Button
                size="lg"
                variant="outline"
                className="text-base px-8 h-12 font-semibold"
              >
                <Github className="size-4" />
                {t("cta.github")}
              </Button>
            </Link>
          </div>
        </div>

        {/* App preview */}
        <div className="relative mt-16 sm:mt-20 lg:mt-24 max-w-5xl mx-auto w-full pb-16">
          <div className="preview-glow" />
          <div className="relative rounded-xl border border-border/40 overflow-hidden shadow-2xl shadow-primary/5 ring-1 ring-white/5">
            <LandingPreview />
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-border/40 bg-background/95 relative z-10">
        <div className="px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <p className="text-sm text-muted-foreground">
              {t("footer.description")}
            </p>
            <div className="flex gap-4">
              <Button variant="ghost" asChild>
                <Link
                  href="https://github.com/dan5py/mbox-viewer"
                  target="_blank"
                  rel="noopener noreferrer nofollow"
                >
                  <Github className="size-4" />
                  {t("footer.github")}
                </Link>
              </Button>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
