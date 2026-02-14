import { headers } from "next/headers";
import { match } from "@formatjs/intl-localematcher";
import { defaultLocale, Locale, locales } from "~/i18n/config";
import Negotiator from "negotiator";

export function resolveSupportedLocale(
  locale: string | undefined,
  fallback: Locale = defaultLocale
): Locale {
  if (locale && locales.includes(locale as Locale)) {
    return locale as Locale;
  }

  return fallback;
}

export async function getPreferredLocale(): Promise<Locale> {
  const acceptLanguage = (await headers()).get("accept-language") ?? undefined;
  const languages = new Negotiator({
    headers: {
      "accept-language": acceptLanguage,
    },
  }).languages();
  const matchedLocale = match(languages, locales, defaultLocale);
  return resolveSupportedLocale(matchedLocale);
}
