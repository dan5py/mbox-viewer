import { getAnalyticsOptOut } from "~/actions/analytics";

let optOutCache: boolean | null = null;
let optOutPromise: Promise<boolean> | null = null;

/**
 * Check if analytics tracking is disabled (client-side)
 * Uses server action to fetch the preference
 */
async function isAnalyticsDisabled(): Promise<boolean> {
  if (typeof window === "undefined") return false;

  // Return cached value if available
  if (optOutCache !== null) {
    return optOutCache;
  }

  // Use existing promise if one is in flight
  if (optOutPromise) {
    return optOutPromise;
  }

  // Fetch from server
  optOutPromise = getAnalyticsOptOut();
  optOutCache = await optOutPromise;
  optOutPromise = null;

  return optOutCache;
}

/**
 * Track an event with Umami, respecting opt-out preference
 */
export async function trackEvent(
  event: string,
  data?: Record<string, unknown>
): Promise<void> {
  if (await isAnalyticsDisabled()) return;
  if (typeof window !== "undefined" && window.umami) {
    window.umami.track(event, data);
  }
}

/**
 * Clear the analytics opt-out cache (call after changing preference)
 */
export function clearAnalyticsCache(): void {
  optOutCache = null;
  optOutPromise = null;
}
