import Link from "next/link";
import { WifiOff } from "lucide-react";
import { getTranslations } from "next-intl/server";

import { Button } from "~/components/ui/button";
import { Navbar } from "~/components/navbar";

export default async function OfflinePage() {
  const t = await getTranslations("Offline");

  return (
    <div className="flex flex-col min-h-dvh">
      <Navbar />
      <main className="flex-1 flex items-center justify-center p-6">
        <div className="max-w-md w-full text-center space-y-5">
          <div className="mx-auto size-16 rounded-full bg-muted flex items-center justify-center">
            <WifiOff className="size-8 text-muted-foreground" />
          </div>
          <h1 className="text-2xl font-semibold">{t("title")}</h1>
          <p className="text-muted-foreground">{t("description")}</p>
          <Button asChild>
            <Link href="/viewer">{t("retry")}</Link>
          </Button>
        </div>
      </main>
    </div>
  );
}
