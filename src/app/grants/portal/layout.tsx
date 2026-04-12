'use client';

import { useEffect, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { createClient } from '@/lib/supabase';
import { LogOut, ChevronLeft, GraduationCap } from 'lucide-react';

interface GrantApplicant {
  id: string;
  full_name: string;
  email: string;
}

export default function GrantPortalLayout({ children }: { children: React.ReactNode }) {
  const [applicant, setApplicant] = useState<GrantApplicant | null>(null);
  const [loading, setLoading] = useState(true);
  const [signingOut, setSigningOut] = useState(false);
  const router = useRouter();
  const pathname = usePathname();
  const supabase = createClient();

  useEffect(() => {
    loadApplicantInfo();
  }, []);

  const loadApplicantInfo = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();

      if (!user) {
        router.push('/grants/login');
        return;
      }

      // Get applicant info
      const { data, error } = await supabase
        .from('grant_applicants')
        .select('id, full_name, email')
        .eq('id', user.id)
        .single();

      if (error) {
        console.error('Error loading applicant:', error);
        router.push('/grants/login');
        return;
      }

      setApplicant(data);
      setLoading(false);
    } catch (err) {
      console.error('Error:', err);
      router.push('/grants/login');
    }
  };

  const handleSignOut = async () => {
    setSigningOut(true);
    await supabase.auth.signOut();
    router.push('/grants/login');
  };

  const showBackButton = pathname !== '/grants/portal';

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-gray-600">Loading...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-3">
              {showBackButton && (
                <button
                  onClick={() => router.back()}
                  className="p-2 hover:bg-gray-100 rounded-lg transition"
                  title="Go back"
                >
                  <ChevronLeft className="w-5 h-5 text-gray-600" />
                </button>
              )}
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center">
                  <GraduationCap className="w-5 h-5 text-white" />
                </div>
                <div>
                  <h1 className="font-bold text-gray-900">Grant Portal</h1>
                  <p className="text-xs text-gray-500">Jarrell ISD Foundation</p>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-4">
              {applicant && (
                <div className="text-right">
                  <p className="text-sm font-medium text-gray-900">{applicant.full_name}</p>
                  <p className="text-xs text-gray-500">{applicant.email}</p>
                </div>
              )}
              <button
                onClick={handleSignOut}
                disabled={signingOut}
                className="flex items-center gap-2 px-3 py-2 text-sm text-gray-600 hover:bg-red-50 hover:text-red-700 rounded-lg transition"
              >
                <LogOut className="w-4 h-4" />
                {signingOut ? 'Signing out...' : 'Sign Out'}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {children}
      </main>
    </div>
  );
}
