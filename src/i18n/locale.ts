import { headers } from "next/headers";
import { match } from "@formatjs/intl-localematcher";
import { defaultLocale, locales } from "~/i18n/config";
import Negotiator from "negotiator";

export async function getPreferredLocale() {
  const acceptLanguage = (await headers()).get("accept-language") ?? undefined;
  const languages = new Negotiator({
    headers: {
      "accept-language": acceptLanguage,
    },
  }).languages();
  return match(languages, locales, defaultLocale);
}
