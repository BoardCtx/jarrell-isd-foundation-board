'use client';

import { useEffect, useState, useCallback } from 'react';
import { createClient } from '@/lib/supabase';
import { getProxyUserId, isProxyActive } from '@/lib/proxy';
import type { Profile } from '@/lib/database.types';

/**
 * Returns the "effective" user — either the real authenticated user or
 * the proxied user if an admin has activated View As mode.
 *
 * Also returns `realUserId` and `realRole` so callers can still check
 * whether the *actual* logged-in user is an admin (e.g. for showing
 * admin-only controls that should always be visible to the admin even
 * while proxying).
 */
export function useEffectiveUser() {
  const supabase = createClient();
  const [effectiveProfile, setEffectiveProfile] = useState<Profile | null>(null);
  const [realUserId, setRealUserId] = useState<string | null>(null);
  const [realRole, setRealRole] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [proxying, setProxying] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setLoading(false); return; }

    // Always fetch the real user's role
    const { data: realProfile } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', user.id)
      .single();

    setRealUserId(user.id);
    setRealRole(realProfile?.role ?? null);

    const proxyId = getProxyUserId();
    if (proxyId && proxyId !== user.id) {
      // Fetch the proxied user's profile
      const { data: proxyProfile } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', proxyId)
        .single();

      if (proxyProfile) {
        setEffectiveProfile(proxyProfile);
        setProxying(true);
      } else {
        // Proxy target doesn't exist; fall back to real user
        setEffectiveProfile(realProfile);
        setProxying(false);
      }
    } else {
      setEffectiveProfile(realProfile);
      setProxying(false);
    }

    setLoading(false);
  }, []);

  useEffect(() => {
    load();
    // Re-load when proxy changes
    const handler = () => load();
    window.addEventListener('proxy-change', handler);
    return () => window.removeEventListener('proxy-change', handler);
  }, [load]);

  return { effectiveProfile, realUserId, realRole, loading, proxying, reload: load };
}
