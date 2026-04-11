'use client';

import Sidebar from './Sidebar';
import ProxyBanner from './ProxyBanner';

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen bg-gray-50">
      <Sidebar />
      <main className="flex-1 overflow-auto flex flex-col">
        <ProxyBanner />
        <div className="flex-1">
          {children}
        </div>
      </main>
    </div>
  );
}
