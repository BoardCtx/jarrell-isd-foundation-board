'use client';

import { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { createClient } from '@/lib/supabase';
import { Shield, Loader2, CheckCircle2, Clock } from 'lucide-react';

function RegisterForm() {
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [organization, setOrganization] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [mounted, setMounted] = useState(false);
  const router = useRouter();
  const searchParams = useSearchParams();
  const supabase = createClient();

  useEffect(() => {
    setMounted(true);
    // Pre-fill from invite params
    const inviteEmail = searchParams.get('email');
    const inviteName = searchParams.get('name');
    if (inviteEmail) setEmail(inviteEmail);
    if (inviteName) setFullName(inviteName);

    checkExistingSession();
  }, []);

  const checkExistingSession = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
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

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!fullName.trim()) { setError('Full name is required'); return; }
    if (!email.trim()) { setError('Email is required'); return; }
    if (password.length < 6) { setError('Password must be at least 6 characters'); return; }
    if (password !== confirmPassword) { setError('Passwords do not match'); return; }

    setLoading(true);

    try {
      // Sign up the user
      const { data: { user }, error: signUpError } = await supabase.auth.signUp({
        email,
        password,
      });

      if (signUpError) {
        setError(signUpError.message);
        setLoading(false);
        return;
      }

      if (!user) {
        setError('Failed to create account');
        setLoading(false);
        return;
      }

      // Insert into grant_evaluators table with 'pending' status
      const { error: insertError } = await supabase
        .from('grant_evaluators')
        .insert({
          id: user.id,
          email,
          full_name: fullName,
          organization: organization || null,
          phone: phone || null,
          status: 'pending',
          is_active: true,
        });

      if (insertError) {
        setError('Failed to create evaluator profile: ' + insertError.message);
        setLoading(false);
        return;
      }

      // Notify grant admins about pending evaluator request
      try {
        await fetch('/api/grants/approve-evaluator', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'notify_pending', evaluator_name: fullName, evaluator_email: email }),
        });
      } catch (err) {
        // Non-critical — don't block registration
        console.error('Failed to notify admins:', err);
      }

      setSuccess(true);
      setLoading(false);
    } catch (err) {
      setError('An error occurred. Please try again.');
      setLoading(false);
    }
  };

  if (!mounted) return null;

  if (success) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-emerald-50 to-white flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-8 text-center">
          <div className="w-16 h-16 bg-amber-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <Clock className="w-9 h-9 text-amber-600" />
          </div>
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Account Pending Approval</h1>
          <p className="text-gray-600 mb-4">
            Your evaluator account has been created and is awaiting approval from the grant administrator.
          </p>
          <p className="text-gray-600 mb-6">
            You will receive an email once your account has been approved. Please also check your email to verify your account.
          </p>
          <a href="/grants/evaluator/login" className="btn-primary block text-center">
            Go to Sign In
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-emerald-50 to-white flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-8">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="w-16 h-16 bg-emerald-600 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <Shield className="w-9 h-9 text-white" />
          </div>
          <h1 className="text-2xl font-bold text-gray-900">Create Evaluator Account</h1>
          <p className="text-gray-600 text-sm mt-1">Join the Grant Evaluation Portal</p>
          <p className="text-amber-600 text-xs mt-2 bg-amber-50 rounded-lg px-3 py-2 inline-block">
            Your account will require approval before you can access the portal.
          </p>
        </div>

        {/* Form */}
        <form onSubmit={handleRegister} className="space-y-4">
          <div>
            <label className="label" htmlFor="fullName">Full Name *</label>
            <input
              id="fullName"
              type="text"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              className="input"
              placeholder="John Doe"
              required
            />
          </div>

          <div>
            <label className="label" htmlFor="email">Email Address *</label>
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
            <label className="label" htmlFor="organization">Organization</label>
            <input
              id="organization"
              type="text"
              value={organization}
              onChange={(e) => setOrganization(e.target.value)}
              className="input"
              placeholder="Your organization (optional)"
            />
          </div>

          <div>
            <label className="label" htmlFor="phone">Phone</label>
            <input
              id="phone"
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              className="input"
              placeholder="(555) 555-5555"
            />
          </div>

          <div>
            <label className="label" htmlFor="password">Password *</label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="input"
              placeholder="••••••••"
              required
            />
            <p className="text-xs text-gray-500 mt-1">Minimum 6 characters</p>
          </div>

          <div>
            <label className="label" htmlFor="confirmPassword">Confirm Password *</label>
            <input
              id="confirmPassword"
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
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
                Creating account...
              </>
            ) : (
              'Create Account'
            )}
          </button>
        </form>

        {/* Sign In Link */}
        <p className="text-center text-sm text-gray-600 mt-6">
          Already have an account?{' '}
          <a href="/grants/evaluator/login" className="text-emerald-600 hover:underline font-medium">
            Sign In
          </a>
        </p>
      </div>
    </div>
  );
}

export default function EvaluatorRegisterPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-gradient-to-br from-emerald-50 to-white flex items-center justify-center">
        <p className="text-gray-400">Loading...</p>
      </div>
    }>
      <RegisterForm />
    </Suspense>
  );
}
