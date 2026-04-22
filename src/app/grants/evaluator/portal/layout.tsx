'use client';

import { useEffect, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { createClient } from '@/lib/supabase';
import { LogOut, ChevronLeft, Shield, Building2 } from 'lucide-react';

interface EvaluatorInfo {
  id: string;
  full_name: string;
  email: string;
  organization: string | null;
}

export default function EvaluatorPortalLayout({ children }: { children: React.ReactNode }) {
  const [evaluator, setEvaluator] = useState<EvaluatorInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [signingOut, setSigningOut] = useState(false);
  const router = useRouter();
  const pathname = usePathname();
  const supabase = createClient();

  useEffect(() => {
    loadEvaluatorInfo();
  }, []);

  const loadEvaluatorInfo = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();

      if (!user) {
        router.push('/grants/evaluator/login');
        return;
      }

      const { data, error } = await supabase
        .from('grant_evaluators')
        .select('id, full_name, email, organization, status')
        .eq('id', user.id)
        .single();

      if (error || !data) {
        router.push('/grants/evaluator/login');
        return;
      }

      // If not approved, redirect to pending page
      if (data.status !== 'approved') {
        router.push('/grants/evaluator/pending');
        return;
      }

      setEvaluator(data);
      setLoading(false);
    } catch (err) {
      console.error('Error:', err);
      router.push('/grants/evaluator/login');
    }
  };

  const handleSignOut = async () => {
    setSigningOut(true);
    await supabase.auth.signOut();
    router.push('/grants/evaluator/login');
  };

  const showBackButton = pathname !== '/grants/evaluator/portal';

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
                <div className="w-8 h-8 bg-emerald-600 rounded-lg flex items-center justify-center">
                  <Shield className="w-5 h-5 text-white" />
                </div>
                <div>
                  <h1 className="font-bold text-gray-900">Evaluator Portal</h1>
                  <p className="text-xs text-gray-500">Jarrell ISD Foundation</p>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-4">
              {evaluator && (
                <div className="text-right hidden sm:block">
                  <p className="text-sm font-medium text-gray-900">{evaluator.full_name}</p>
                  <p className="text-xs text-gray-500">{evaluator.email}</p>
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

      {/* Board Selector Banner — future multi-tenancy ready */}
      <div className="bg-emerald-50 border-b border-emerald-100">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-2">
          <div className="flex items-center gap-2 text-sm text-emerald-700">
            <Building2 className="w-4 h-4" />
            <span className="font-medium">Jarrell ISD Education Foundation</span>
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
