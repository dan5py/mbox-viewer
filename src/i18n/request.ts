import { cookies } from "next/headers";
import { localeCookieName } from "~/i18n/config";
import { getPreferredLocale, resolveSupportedLocale } from "~/i18n/locale";
import { getRequestConfig } from "next-intl/server";

export default getRequestConfig(async () => {
  const store = await cookies();
  const preferredLocale = await getPreferredLocale();
  const locale = resolveSupportedLocale(
    store.get(localeCookieName)?.value,
    preferredLocale
  );

  return {
    locale,
    messages: (await import(`../../messages/${locale}.json`)).default,
  };
});
