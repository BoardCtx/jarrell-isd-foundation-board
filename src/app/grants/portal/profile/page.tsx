'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase';
import { User, Save, Loader2, CheckCircle2 } from 'lucide-react';

interface ApplicantProfile {
  id: string;
  email: string;
  full_name: string;
  organization: string | null;
  phone: string | null;
  created_at: string;
}

export default function ApplicantProfilePage() {
  const router = useRouter();
  const supabase = createClient();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState('');
  const [profile, setProfile] = useState<ApplicantProfile | null>(null);

  const [fullName, setFullName] = useState('');
  const [organization, setOrganization] = useState('');
  const [phone, setPhone] = useState('');

  useEffect(() => {
    loadProfile();
  }, []);

  const loadProfile = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { router.push('/grants/login'); return; }

    const { data, error } = await supabase
      .from('grant_applicants')
      .select('*')
      .eq('id', user.id)
      .single();

    if (error || !data) {
      router.push('/grants/login');
      return;
    }

    setProfile(data);
    setFullName(data.full_name);
    setOrganization(data.organization || '');
    setPhone(data.phone || '');
    setLoading(false);
  };

  const handleSave = async () => {
    if (!fullName.trim()) {
      setError('Full name is required');
      return;
    }

    setSaving(true);
    setError('');

    const { error: updateError } = await supabase
      .from('grant_applicants')
      .update({
        full_name: fullName.trim(),
        organization: organization.trim() || null,
        phone: phone.trim() || null,
      })
      .eq('id', profile!.id);

    if (updateError) {
      setError(updateError.message);
    } else {
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    }

    setSaving(false);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-gray-600">Loading profile...</div>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto">
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-gray-900 flex items-center gap-3">
          <User className="w-6 h-6 text-primary" />
          My Profile
        </h2>
        <p className="text-gray-600 mt-1">Update your personal information</p>
      </div>

      <div className="card">
        <div className="space-y-5">
          <div>
            <label className="label" htmlFor="fullName">Full Name *</label>
            <input
              id="fullName"
              type="text"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              className="input"
              placeholder="Your full name"
            />
          </div>

          <div>
            <label className="label" htmlFor="email">Email Address</label>
            <input
              id="email"
              type="email"
              value={profile?.email || ''}
              className="input bg-gray-50"
              disabled
            />
            <p className="text-xs text-gray-500 mt-1">Email cannot be changed</p>
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

          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">
              {error}
            </div>
          )}

          <div className="flex items-center gap-3 pt-2">
            <button
              onClick={handleSave}
              disabled={saving}
              className="btn-primary flex items-center gap-2"
            >
              {saving ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : saved ? (
                <CheckCircle2 className="w-4 h-4" />
              ) : (
                <Save className="w-4 h-4" />
              )}
              {saving ? 'Saving...' : saved ? 'Saved!' : 'Save Changes'}
            </button>
          </div>
        </div>
      </div>

      {/* Account Info */}
      <div className="card mt-6">
        <h3 className="font-semibold text-gray-900 mb-3">Account Information</h3>
        <div className="text-sm text-gray-600 space-y-1">
          <p>Member since {profile ? new Date(profile.created_at).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }) : '\u2014'}</p>
        </div>
      </div>
    </div>
  );
}
