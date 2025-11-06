"use server";

import { cookies } from "next/headers";
import { defaultLocale, Locale, localeCookieName } from "~/i18n/config";

export async function getUserLocale() {
  return (await cookies()).get(localeCookieName)?.value || defaultLocale;
}

export async function setUserLocale(locale: Locale) {
  (await cookies()).set(localeCookieName, locale);
}
