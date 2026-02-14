"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { getAnalyticsOptOut, setAnalyticsOptOut } from "~/actions/analytics";
import { setUserLocale } from "~/actions/locale";
import { Locale } from "~/i18n/config";
import {
  ArrowLeft,
  Info,
  Monitor,
  Moon,
  Settings as SettingsIcon,
  Sun,
} from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useTheme } from "next-themes";

import { clearAnalyticsCache } from "~/lib/analytics";
import { APP_VERSION } from "~/lib/config";
import { Button } from "~/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "~/components/ui/card";
import { Label } from "~/components/ui/label";
import { RadioGroup, RadioGroupItem } from "~/components/ui/radio-group";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select";
import { Separator } from "~/components/ui/separator";
import { Switch } from "~/components/ui/switch";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "~/components/ui/tooltip";
import { Navbar } from "~/components/navbar";

export default function SettingsPage() {
  const t = useTranslations("Settings");
  const { theme, setTheme } = useTheme();
  const locale = useLocale();
  const router = useRouter();
  const [mounted, setMounted] = useState(false);
  const [analyticsEnabled, setAnalyticsEnabled] = useState(true);

  // Prevent hydration mismatch and load analytics preference
  useEffect(() => {
    const loadAnalyticsPreference = async () => {
      const optOut = await getAnalyticsOptOut();
      setAnalyticsEnabled(!optOut);
      setMounted(true);
    };
    loadAnalyticsPreference();
  }, []);

  const handleLocaleChange = async (newLocale: string) => {
    setUserLocale(newLocale as Locale);
  };

  const handleAnalyticsChange = async (enabled: boolean) => {
    setAnalyticsEnabled(enabled);
    await setAnalyticsOptOut(!enabled);
    // Clear cache so next check gets fresh value
    clearAnalyticsCache();
  };

  if (!mounted) {
    return null;
  }

  return (
    <div className="flex flex-col min-h-screen">
      <Navbar />
      <div className="flex-1 container max-w-4xl mx-auto px-6 py-8">
        <div className="space-y-6">
          {/* Header */}
          <div className="space-y-4">
            <Button
              variant="ghost"
              onClick={() => router.back()}
              className="gap-2"
            >
              <ArrowLeft className="size-4" />
              {t("goBack")}
            </Button>
            <div className="space-y-2">
              <div className="flex items-center gap-3">
                <SettingsIcon className="size-8 text-primary" />
                <h1 className="text-3xl font-bold">{t("title")}</h1>
              </div>
              <p className="text-muted-foreground">
                Manage your application preferences
              </p>
            </div>
          </div>

          <Separator />

          {/* Appearance Settings */}
          <Card>
            <CardHeader>
              <CardTitle>{t("appearance.title")}</CardTitle>
              <CardDescription>{t("appearance.description")}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>{t("appearance.theme")}</Label>
                <p className="text-sm text-muted-foreground">
                  {t("appearance.themeDescription")}
                </p>
                <RadioGroup
                  value={theme}
                  onValueChange={(value) => setTheme(value)}
                  className="grid grid-cols-3 gap-4"
                >
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="light" id="light" />
                    <Label
                      htmlFor="light"
                      className="flex items-center gap-2 cursor-pointer flex-1"
                    >
                      <Sun className="size-4" />
                      {t("appearance.light")}
                    </Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="dark" id="dark" />
                    <Label
                      htmlFor="dark"
                      className="flex items-center gap-2 cursor-pointer flex-1"
                    >
                      <Moon className="size-4" />
                      {t("appearance.dark")}
                    </Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="system" id="system" />
                    <Label
                      htmlFor="system"
                      className="flex items-center gap-2 cursor-pointer flex-1"
                    >
                      <Monitor className="size-4" />
                      {t("appearance.system")}
                    </Label>
                  </div>
                </RadioGroup>
              </div>
            </CardContent>
          </Card>

          {/* Language Settings */}
          <Card>
            <CardHeader>
              <CardTitle>{t("language.title")}</CardTitle>
              <CardDescription>{t("language.description")}</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                <Label>{t("language.title")}</Label>
                <Select value={locale} onValueChange={handleLocaleChange}>
                  <SelectTrigger className="w-[200px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="en">
                      {t("language.english")} (English)
                    </SelectItem>
                    <SelectItem value="it">
                      {t("language.italian")} (Italiano)
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>

          {/* Analytics Settings */}
          <Card>
            <CardHeader>
              <CardTitle>{t("analytics.title")}</CardTitle>
              <CardDescription>{t("analytics.description")}</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <div className="flex items-center gap-2">
                    <Label>{t("analytics.enableTracking")}</Label>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <button
                          type="button"
                          className="inline-flex items-center justify-center rounded-full focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
                          aria-label={t("analytics.infoAriaLabel")}
                        >
                          <Info className="size-4 text-muted-foreground hover:text-foreground transition-colors" />
                        </button>
                      </TooltipTrigger>
                      <TooltipContent className="max-w-xs">
                        <p>{t("analytics.dataCollected")}</p>
                      </TooltipContent>
                    </Tooltip>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    {t("analytics.enableTrackingDescription")}
                  </p>
                </div>
                <Switch
                  checked={analyticsEnabled}
                  onCheckedChange={handleAnalyticsChange}
                />
              </div>
            </CardContent>
          </Card>

          {/* About */}
          <Card>
            <CardHeader>
              <CardTitle>{t("about.title")}</CardTitle>
              <CardDescription>{t("about.description")}</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label>{t("about.version")}</Label>
                  <span className="text-sm font-mono text-muted-foreground">
                    {APP_VERSION}
                  </span>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
