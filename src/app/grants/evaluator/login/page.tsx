'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase';
import { Shield, Loader2 } from 'lucide-react';

export default function EvaluatorLoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [mounted, setMounted] = useState(false);
  const router = useRouter();
  const supabase = createClient();

  useEffect(() => {
    setMounted(true);
    checkExistingSession();
  }, []);

  const checkExistingSession = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      // Check if they're an evaluator
      const { data: evaluator } = await supabase
        .from('grant_evaluators')
        .select('status')
        .eq('id', user.id)
        .single();

      if (evaluator) {
        if (evaluator.status === 'approved') {
          router.push('/grants/evaluator/portal');
        } else {
          router.push('/grants/evaluator/pending');
        }
      }
    }
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    const { data: authData, error: authError } = await supabase.auth.signInWithPassword({ email, password });

    if (authError) {
      setError(authError.message);
      setLoading(false);
      return;
    }

    if (!authData.user) {
      setError('Login failed');
      setLoading(false);
      return;
    }

    // Check if this user is an evaluator
    const { data: evaluator, error: evalError } = await supabase
      .from('grant_evaluators')
      .select('status')
      .eq('id', authData.user.id)
      .single();

    if (evalError || !evaluator) {
      setError('No evaluator account found for this email. Please contact the grant administrator.');
      await supabase.auth.signOut();
      setLoading(false);
      return;
    }

    if (evaluator.status === 'pending') {
      router.push('/grants/evaluator/pending');
      router.refresh();
      return;
    }

    if (evaluator.status === 'rejected' || evaluator.status === 'suspended') {
      setError('Your evaluator account is no longer active. Please contact the grant administrator.');
      await supabase.auth.signOut();
      setLoading(false);
      return;
    }

    router.push('/grants/evaluator/portal');
    router.refresh();
  };

  if (!mounted) return null;

  return (
    <div className="min-h-screen bg-gradient-to-br from-emerald-50 to-white flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-8">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="w-16 h-16 bg-emerald-600 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <Shield className="w-9 h-9 text-white" />
          </div>
          <h1 className="text-2xl font-bold text-gray-900">Jarrell ISD Foundation</h1>
          <p className="text-gray-600 text-sm mt-1">Grant Evaluator Portal</p>
        </div>

        {/* Form */}
        <form onSubmit={handleLogin} className="space-y-5">
          <div>
            <label className="label" htmlFor="email">Email Address</label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="input"
              placeholder="you@example.com"
              required
            />
          </div>
          <div>
            <label className="label" htmlFor="password">Password</label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="input"
              placeholder="••••••••"
              required
            />
          </div>

          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="btn-primary w-full flex items-center justify-center gap-2 py-3 text-base"
          >
            {loading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Signing in...
              </>
            ) : (
              'Sign In'
            )}
          </button>
        </form>

        {/* Register Link */}
        <p className="text-center text-sm text-gray-600 mt-6">
          Received an invitation?{' '}
          <a href="/grants/evaluator/register" className="text-emerald-600 hover:underline font-medium">
            Create your account
          </a>
        </p>

        <p className="text-center text-xs text-gray-400 mt-6">
          Questions? Contact the grant administrator.
        </p>
      </div>
    </div>
  );
}
