"use server";

import { cookies } from "next/headers";
import { analyticsOptOutCookieName } from "~/i18n/config";

export async function getAnalyticsOptOut(): Promise<boolean> {
  const optOutCookie = (await cookies()).get(analyticsOptOutCookieName);
  return optOutCookie?.value === "true";
}

export async function setAnalyticsOptOut(optOut: boolean) {
  const cookieStore = await cookies();
  if (optOut) {
    cookieStore.set(analyticsOptOutCookieName, "true", {
      httpOnly: false, // Allow client-side access
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 60 * 60 * 24 * 365, // 1 year
      path: "/",
    });
  } else {
    cookieStore.delete(analyticsOptOutCookieName);
  }
}
