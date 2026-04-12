'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function GrantApplicationsRedirect() {
  const router = useRouter();

  useEffect(() => {
    router.replace('/grants');
  }, [router]);

  return (
    <div className="flex items-center justify-center min-h-screen">
      <div className="text-center">
        <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mb-4"></div>
        <p className="text-gray-600">Redirecting...</p>
      </div>
    </div>
  );
}
