import Link from "next/link";
import { FileText, Mail, Zap } from "lucide-react";
import { getTranslations } from "next-intl/server";

import { Button } from "~/components/ui/button";
import { Github } from "~/components/icons/Github";
import { Navbar } from "~/components/navbar";

const features = [
  {
    icon: Zap,
    title: "Lightning Fast",
    description:
      "Optimized for performance and instant loading of large MBOX files",
  },
  {
    icon: FileText,
    title: "Easy to Use",
    description: "Intuitive interface designed for effortless file navigation",
  },
  {
    icon: Mail,
    title: "Email Archive",
    description: "Perfect for viewing and managing email export archives",
  },
];

export default async function Home() {
  const t = await getTranslations("Home");

  return (
    <div className="flex flex-col min-h-dvh">
      <Navbar showViewerButton showSettingsButton={false} />

      {/* Hero Section */}
      <main className="flex-1 flex flex-col items-center justify-center px-4 py-20 sm:py-32">
        <div className="max-w-3xl mx-auto text-center space-y-8 animate-fade-in">
          {/* Heading */}
          <div className="space-y-4">
            <h1 className="text-5xl sm:text-6xl font-bold tracking-tight">
              {t("hero.title")}
            </h1>
            <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
              {t("hero.description")}
            </p>
          </div>

          {/* Features Grid */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 pt-8">
            {features.map((feature, i) => {
              const Icon = feature.icon;
              return (
                <div
                  key={feature.title}
                  className="flex flex-col items-center gap-3 p-6 rounded-lg border border-border/40 bg-card/50 backdrop-blur supports-backdrop-filter:bg-card/25"
                >
                  <Icon className="size-8 text-primary" />
                  <h3 className="font-semibold text-lg">
                    {t(`features.${i}.title`)}
                  </h3>
                  <p className="text-sm text-muted-foreground">
                    {t(`features.${i}.description`)}
                  </p>
                </div>
              );
            })}
          </div>

          {/* CTA Button */}
          <div className="flex flex-col items-center justify-center gap-6 pt-6">
            <Link href="/viewer">
              <Button size="lg" className="text-base px-8 h-12">
                {t("cta.title")}
              </Button>
            </Link>
            <p className="text-sm text-muted-foreground">
              {t("cta.description")}
            </p>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-border/40 bg-background/95">
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
                  Github
                </Link>
              </Button>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
