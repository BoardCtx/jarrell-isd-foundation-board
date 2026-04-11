'use client';

/**
 * Proxy / "View As" utilities.
 *
 * When an admin activates proxy mode, we store the target profile ID in
 * localStorage.  Every page that needs the "effective" user should call
 * `getProxyUserId()` — if it returns a non-null value the page should
 * load that profile instead of the authenticated user's profile.
 *
 * The real auth session is never touched, so API calls still run as the
 * actual admin — we only swap the *profile* used for display and filtering.
 */

const PROXY_KEY = 'proxy_user_id';
const PROXY_NAME_KEY = 'proxy_user_name';

/** Get the proxied user's profile ID, or null if not proxying. */
export function getProxyUserId(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem(PROXY_KEY);
}

/** Get the proxied user's display name (for the banner). */
export function getProxyUserName(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem(PROXY_NAME_KEY);
}

/** Start proxying as another user. */
export function startProxy(profileId: string, displayName: string) {
  localStorage.setItem(PROXY_KEY, profileId);
  localStorage.setItem(PROXY_NAME_KEY, displayName);
  // Force all components to re-render with new identity
  window.dispatchEvent(new Event('proxy-change'));
}

/** End the proxy session. */
export function endProxy() {
  localStorage.removeItem(PROXY_KEY);
  localStorage.removeItem(PROXY_NAME_KEY);
  window.dispatchEvent(new Event('proxy-change'));
}

/** Check whether proxy mode is active. */
export function isProxyActive(): boolean {
  return getProxyUserId() !== null;
}
