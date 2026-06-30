/**
 * Deprecated compatibility hook.
 *
 * Wildfly no longer performs automatic provider searches from a user's browser.
 * Background inventory belongs to trusted scheduled jobs and must never consume
 * one of a Free user's five deliberate monthly searches.
 */
export function useDayTripAutoFetch() {
  // Intentionally empty. Existing imports remain safe during staged rollouts.
}
