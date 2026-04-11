'use client';

import { useEffect, useState } from 'react';
import { getProxyUserName, isProxyActive, endProxy } from '@/lib/proxy';
import { Eye, X } from 'lucide-react';

export default function ProxyBanner() {
  const [active, setActive] = useState(false);
  const [name, setName] = useState<string | null>(null);

  const sync = () => {
    setActive(isProxyActive());
    setName(getProxyUserName());
  };

  useEffect(() => {
    sync();
    window.addEventListener('proxy-change', sync);
    return () => window.removeEventListener('proxy-change', sync);
  }, []);

  if (!active || !name) return null;

  const handleEnd = () => {
    endProxy();
    window.location.reload();
  };

  return (
    <div className="bg-amber-500 text-white px-4 py-2 flex items-center justify-center gap-3 text-sm font-medium shadow-md z-50 relative">
      <Eye className="w-4 h-4 flex-shrink-0" />
      <span>
        Proxy Mode — Viewing as <strong>{name}</strong>
      </span>
      <button
        onClick={handleEnd}
        className="ml-2 inline-flex items-center gap-1 bg-white/20 hover:bg-white/30 text-white px-3 py-1 rounded-md text-xs font-semibold transition-colors"
      >
        <X className="w-3.5 h-3.5" />
        End Proxy
      </button>
    </div>
  );
}
