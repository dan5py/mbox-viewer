export type Locale = (typeof locales)[number];

export const locales = ["en", "it"] as const;
export const defaultLocale: Locale = "en";

export const localeCookieName = "MBOX_VIEWER_LOCALE";
export const analyticsOptOutCookieName = "MBOX_VIEWER_ANALYTICS_OPT_OUT";
