'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase';
import { GraduationCap, Calendar, AlertCircle, Loader2, LogIn, UserPlus } from 'lucide-react';

interface InviteData {
  id: string;
  invite_token: string;
  is_active: boolean;
  expires_at: string | null;
  grant_applications: {
    id: string;
    title: string;
    description: string | null;
    status: string;
    deadline: string | null;
  };
}

export default function InviteLandingPage() {
  const params = useParams();
  const router = useRouter();
  const token = params.token as string;
  const supabase = createClient();

  const [loading, setLoading] = useState(true);
  const [invite, setInvite] = useState<InviteData | null>(null);
  const [error, setError] = useState('');
  const [isLoggedIn, setIsLoggedIn] = useState(false);

  useEffect(() => {
    loadInvite();
  }, []);

  const loadInvite = async () => {
    try {
      // Check if user is already logged in
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        // Check if they're an applicant
        const { data: applicant } = await supabase
          .from('grant_applicants')
          .select('id')
          .eq('id', user.id)
          .single();

        if (applicant) {
          setIsLoggedIn(true);
        }
      }

      // Fetch invite details
      const res = await fetch(`/api/grants/invite-links?token=${token}`);
      const data = await res.json();

      if (!res.ok) {
        setError(data.error || 'Invalid invite link');
        setLoading(false);
        return;
      }

      setInvite(data.invite);
      setLoading(false);
    } catch (err) {
      setError('Failed to load invite details');
      setLoading(false);
    }
  };

  const handleGoToApply = () => {
    if (invite?.grant_applications?.id) {
      router.push(`/grants/portal/apply/${invite.grant_applications.id}`);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-white flex items-center justify-center">
        <div className="flex items-center gap-3 text-gray-500">
          <Loader2 className="w-5 h-5 animate-spin" />
          Loading...
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-white flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-8 text-center">
          <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <AlertCircle className="w-9 h-9 text-red-600" />
          </div>
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Invalid Link</h1>
          <p className="text-gray-600 mb-6">{error}</p>
          <a href="/grants/login" className="btn-primary block text-center">
            Go to Grant Portal
          </a>
        </div>
      </div>
    );
  }

  const app = invite?.grant_applications;
  if (!app) return null;

  const isOpen = app.status === 'open';
  const deadlineDate = app.deadline ? new Date(app.deadline) : null;
  const isExpired = deadlineDate && deadlineDate < new Date();
  const daysLeft = deadlineDate ? Math.ceil((deadlineDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24)) : null;

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-white flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg p-8">
        {/* Header */}
        <div className="text-center mb-6">
          <div className="w-16 h-16 bg-primary rounded-2xl flex items-center justify-center mx-auto mb-4">
            <GraduationCap className="w-9 h-9 text-white" />
          </div>
          <p className="text-sm text-gray-500 mb-1">Jarrell ISD Education Foundation</p>
          <h1 className="text-2xl font-bold text-gray-900">{app.title}</h1>
        </div>

        {/* Description */}
        {app.description && (
          <p className="text-gray-600 mb-6 text-center leading-relaxed">{app.description}</p>
        )}

        {/* Deadline */}
        {deadlineDate && (
          <div className={`flex items-center justify-center gap-2 mb-6 p-3 rounded-lg ${
            isExpired
              ? 'bg-red-50 text-red-700'
              : daysLeft !== null && daysLeft <= 7
              ? 'bg-amber-50 text-amber-700'
              : 'bg-blue-50 text-blue-700'
          }`}>
            <Calendar className="w-4 h-4" />
            <span className="text-sm font-medium">
              {isExpired
                ? 'Application deadline has passed'
                : `Deadline: ${deadlineDate.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}${daysLeft !== null ? ` (${daysLeft} day${daysLeft !== 1 ? 's' : ''} left)` : ''}`
              }
            </span>
          </div>
        )}

        {/* Actions */}
        {!isOpen || isExpired ? (
          <div className="text-center">
            <p className="text-gray-500 mb-4">This application is no longer accepting submissions.</p>
            <a href="/grants/login" className="btn-secondary inline-block">
              Visit Grant Portal
            </a>
          </div>
        ) : isLoggedIn ? (
          <div className="space-y-3">
            <button onClick={handleGoToApply} className="btn-primary w-full flex items-center justify-center gap-2 py-3 text-base">
              Start Your Application
            </button>
            <p className="text-center text-xs text-gray-400">You are already signed in</p>
          </div>
        ) : (
          <div className="space-y-3">
            <a
              href={`/grants/register?application=${app.id}&token=${token}`}
              className="btn-primary w-full flex items-center justify-center gap-2 py-3 text-base"
            >
              <UserPlus className="w-4 h-4" />
              Create Account & Apply
            </a>
            <a
              href={`/grants/login?redirect=/grants/portal/apply/${app.id}`}
              className="btn-secondary w-full flex items-center justify-center gap-2 py-3 text-base"
            >
              <LogIn className="w-4 h-4" />
              Sign In & Apply
            </a>
            <p className="text-center text-xs text-gray-400">
              Already have an account? Sign in to continue.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
