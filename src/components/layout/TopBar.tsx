'use client';

import Link from 'next/link';
import { LifeBuoy, Search } from 'lucide-react';

export default function TopBar({ onOpenSearch }: { onOpenSearch: () => void }) {
  return (
    <div className="h-12 bg-white border-b border-gray-200 flex items-center justify-between px-6 flex-shrink-0">
      {/* Left: search trigger */}
      <button
        onClick={onOpenSearch}
        className="flex items-center gap-2 text-sm text-gray-400 hover:text-gray-600 bg-gray-50 hover:bg-gray-100 border border-gray-200 rounded-lg px-3 py-1.5 transition-colors"
      >
        <Search size={14} />
        <span>Search...</span>
        <kbd className="hidden sm:inline-flex items-center text-xs text-gray-400 border border-gray-200 rounded px-1.5 py-0.5 ml-2 bg-white">Ctrl+K</kbd>
      </button>

      {/* Right: help button */}
      <Link
        href="/support"
        className="flex items-center gap-2 text-sm font-medium text-white bg-accent hover:bg-accent-dark px-4 py-1.5 rounded-lg transition-colors shadow-sm"
      >
        <LifeBuoy size={16} />
        Support & Training
      </Link>
    </div>
  );
}
