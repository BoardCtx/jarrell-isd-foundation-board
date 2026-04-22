'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase';
import { Clock, LogOut, RefreshCw, Shield, CheckCircle2, XCircle } from 'lucide-react';

export default function EvaluatorPendingPage() {
  const [status, setStatus] = useState<string>('pending');
  const [loading, setLoading] = useState(true);
  const [checking, setChecking] = useState(false);
  const router = useRouter();
  const supabase = createClient();

  useEffect(() => {
    checkStatus();
  }, []);

  const checkStatus = async () => {
    setChecking(true);
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      router.push('/grants/evaluator/login');
      return;
    }

    const { data: evaluator } = await supabase
      .from('grant_evaluators')
      .select('status')
      .eq('id', user.id)
      .single();

    if (!evaluator) {
      router.push('/grants/evaluator/login');
      return;
    }

    setStatus(evaluator.status);
    setLoading(false);
    setChecking(false);

    if (evaluator.status === 'approved') {
      router.push('/grants/evaluator/portal');
    }
  };

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    router.push('/grants/evaluator/login');
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-emerald-50 to-white flex items-center justify-center">
        <p className="text-gray-500">Checking status...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-emerald-50 to-white flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-8 text-center">
        {status === 'pending' && (
          <>
            <div className="w-20 h-20 bg-amber-100 rounded-full flex items-center justify-center mx-auto mb-6">
              <Clock className="w-10 h-10 text-amber-600" />
            </div>
            <h1 className="text-2xl font-bold text-gray-900 mb-3">Pending Approval</h1>
            <p className="text-gray-600 mb-2">
              Your evaluator account is waiting for approval from the grant administrator.
            </p>
            <p className="text-gray-500 text-sm mb-8">
              You will receive an email notification once your account has been reviewed.
            </p>
            <button
              onClick={checkStatus}
              disabled={checking}
              className="btn-secondary w-full flex items-center justify-center gap-2 mb-3"
            >
              <RefreshCw className={`w-4 h-4 ${checking ? 'animate-spin' : ''}`} />
              {checking ? 'Checking...' : 'Check Status'}
            </button>
          </>
        )}

        {status === 'rejected' && (
          <>
            <div className="w-20 h-20 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-6">
              <XCircle className="w-10 h-10 text-red-600" />
            </div>
            <h1 className="text-2xl font-bold text-gray-900 mb-3">Account Not Approved</h1>
            <p className="text-gray-600 mb-8">
              Unfortunately, your evaluator account was not approved. Please contact the grant administrator for more information.
            </p>
          </>
        )}

        {status === 'suspended' && (
          <>
            <div className="w-20 h-20 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-6">
              <Shield className="w-10 h-10 text-gray-500" />
            </div>
            <h1 className="text-2xl font-bold text-gray-900 mb-3">Account Suspended</h1>
            <p className="text-gray-600 mb-8">
              Your evaluator account has been suspended. Please contact the grant administrator for assistance.
            </p>
          </>
        )}

        <button
          onClick={handleSignOut}
          className="w-full flex items-center justify-center gap-2 text-gray-600 hover:text-red-600 hover:bg-red-50 rounded-lg py-2.5 transition"
        >
          <LogOut className="w-4 h-4" />
          Sign Out
        </button>
      </div>
    </div>
  );
}
