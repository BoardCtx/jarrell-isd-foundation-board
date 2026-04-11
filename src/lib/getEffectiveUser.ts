'use client';

import { getProxyUserId } from '@/lib/proxy';

/**
 * Given the real authenticated user ID, return the effective user ID
 * (the proxy target if proxy mode is active, otherwise the real user).
 *
 * Use this in client-side pages that filter/display based on user ID.
 * API routes should ALWAYS use the real user for authorization.
 */
export function getEffectiveUserId(realUserId: string): string {
  const proxyId = getProxyUserId();
  return proxyId || realUserId;
}
