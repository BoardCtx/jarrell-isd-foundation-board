'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase';
import AppLayout from '@/components/layout/AppLayout';
import type { Profile } from '@/lib/database.types';
import { Loader2, Save, Lock, CheckCircle, AlertCircle, Globe } from 'lucide-react';
import { roleLabels } from '@/lib/utils';

export default function SettingsPage() {
  const supabase = createClient();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [updatingPassword, setUpdatingPassword] = useState(false);

  // Profile form state
  const [fullName, setFullName] = useState('');
  const [title, setTitle] = useState('');
  const [phone, setPhone] = useState('');
  const [timeZone, setTimeZone] = useState('America/Chicago');
  const [profileMessage, setProfileMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const commonTimeZones = [
    { value: 'America/New_York', label: 'Eastern Time (ET)' },
    { value: 'America/Chicago', label: 'Central Time (CT)' },
    { value: 'America/Denver', label: 'Mountain Time (MT)' },
    { value: 'America/Los_Angeles', label: 'Pacific Time (PT)' },
    { value: 'America/Anchorage', label: 'Alaska Time (AKT)' },
    { value: 'Pacific/Honolulu', label: 'Hawaii Time (HT)' },
    { value: 'America/Phoenix', label: 'Arizona (no DST)' },
    { value: 'UTC', label: 'UTC' },
  ];

  // Password form state
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passwordMessage, setPasswordMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const fetchProfile = async () => {
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        setProfileMessage({ type: 'error', text: 'Not authenticated' });
        return;
      }

      const { data: profileData, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .single();

      if (error) throw error;

      if (profileData) {
        setProfile(profileData);
        setFullName(profileData.full_name);
        setTitle(profileData.title || '');
        setPhone(profileData.phone || '');
        setTimeZone((profileData as any).time_zone || 'America/Chicago');
      }
    } catch (error) {
      console.error('Error fetching profile:', error);
      setProfileMessage({ type: 'error', text: 'Failed to load profile' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProfile();
  }, []);

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile) return;

    setSaving(true);
    setProfileMessage(null);

    try {
      const { error } = await supabase
        .from('profiles')
        .update({
          full_name: fullName,
          title: title || null,
          phone: phone || null,
          time_zone: timeZone,
        })
        .eq('id', profile.id);

      if (error) throw error;

      setProfile({
        ...profile,
        full_name: fullName,
        title: title || null,
        phone: phone || null,
      });

      setProfileMessage({ type: 'success', text: 'Profile updated successfully' });
    } catch (error) {
      console.error('Error saving profile:', error);
      setProfileMessage({ type: 'error', text: 'Failed to update profile' });
    } finally {
      setSaving(false);
    }
  };

  const handleUpdatePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setPasswordMessage(null);

    // Validation
    if (newPassword.length < 8) {
      setPasswordMessage({ type: 'error', text: 'Password must be at least 8 characters' });
      return;
    }

    if (newPassword !== confirmPassword) {
      setPasswordMessage({ type: 'error', text: 'Passwords do not match' });
      return;
    }

    setUpdatingPassword(true);

    try {
      const { error } = await supabase.auth.updateUser({ password: newPassword });

      if (error) throw error;

      setPasswordMessage({ type: 'success', text: 'Password updated successfully' });
      setNewPassword('');
      setConfirmPassword('');
    } catch (error) {
      console.error('Error updating password:', error);
      setPasswordMessage({ type: 'error', text: 'Failed to update password' });
    } finally {
      setUpdatingPassword(false);
    }
  };

  if (loading) {
    return (
      <AppLayout>
        <div className="p-8 flex justify-center">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="p-8 max-w-2xl">
        {/* Page Header */}
        <div className="mb-8">
          <h1 className="page-header">Settings</h1>
          <p className="text-gray-500 mt-1">Manage your profile and account settings.</p>
        </div>

        {/* Profile Section */}
        <div className="card mb-6">
          <div className="mb-6">
            <h2 className="font-semibold text-lg text-gray-900">Profile Information</h2>
            <p className="text-sm text-gray-500 mt-1">Update your personal information</p>
          </div>

          {profileMessage && (
            <div
              className={`mb-4 p-3 rounded-lg flex items-start gap-2 ${
                profileMessage.type === 'success'
                  ? 'bg-green-50 text-green-800'
                  : 'bg-red-50 text-red-800'
              }`}
            >
              {profileMessage.type === 'success' ? (
                <CheckCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
              ) : (
                <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
              )}
              <span className="text-sm">{profileMessage.text}</span>
            </div>
          )}

          <form onSubmit={handleSaveProfile} className="space-y-4">
            {/* Full Name */}
            <div>
              <label className="label">Full Name</label>
              <input
                type="text"
                className="input"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                required
              />
            </div>

            {/* Email (Read-only) */}
            <div>
              <label className="label">Email Address</label>
              <input
                type="email"
                className="input bg-gray-50 cursor-not-allowed"
                value={profile?.email || ''}
                disabled
              />
              <p className="text-xs text-gray-500 mt-1">Email cannot be changed</p>
            </div>

            {/* Title */}
            <div>
              <label className="label">Title / Position</label>
              <input
                type="text"
                className="input"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g., Chair of Scholarships"
              />
            </div>

            {/* Phone */}
            <div>
              <label className="label">Phone Number</label>
              <input
                type="tel"
                className="input"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="(555) 123-4567"
              />
            </div>

            {/* Time Zone */}
            <div>
              <label className="label flex items-center gap-1.5">
                <Globe className="w-3.5 h-3.5" /> Default Time Zone
              </label>
              <select
                className="input"
                value={timeZone}
                onChange={(e) => setTimeZone(e.target.value)}
              >
                {commonTimeZones.map(tz => (
                  <option key={tz.value} value={tz.value}>{tz.label}</option>
                ))}
              </select>
              <p className="text-xs text-gray-500 mt-1">Used as the default when creating meetings and viewing times</p>
            </div>

            {/* Role (Read-only) */}
            <div>
              <label className="label">Role</label>
              <div className="flex items-center gap-2">
                <span
                  className={`badge ${
                    profile?.role === 'admin'
                      ? 'bg-red-100 text-red-800'
                      : profile?.role === 'president'
                      ? 'bg-purple-100 text-purple-800'
                      : profile?.role === 'secretary'
                      ? 'bg-blue-100 text-blue-800'
                      : profile?.role === 'treasurer'
                      ? 'bg-green-100 text-green-800'
                      : 'bg-gray-100 text-gray-700'
                  }`}
                >
                  {roleLabels[profile?.role || 'member']}
                </span>
                <p className="text-xs text-gray-500">Cannot be changed</p>
              </div>
            </div>

            {/* Save Button */}
            <div className="pt-4">
              <button type="submit" disabled={saving} className="btn-primary flex items-center gap-2">
                {saving ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Saving...
                  </>
                ) : (
                  <>
                    <Save className="w-4 h-4" />
                    Save Changes
                  </>
                )}
              </button>
            </div>
          </form>
        </div>

        {/* Password Section */}
        <div className="card">
          <div className="mb-6">
            <h2 className="font-semibold text-lg text-gray-900 flex items-center gap-2">
              <Lock className="w-5 h-5" />
              Change Password
            </h2>
            <p className="text-sm text-gray-500 mt-1">Update your password to keep your account secure</p>
          </div>

          {passwordMessage && (
            <div
              className={`mb-4 p-3 rounded-lg flex items-start gap-2 ${
                passwordMessage.type === 'success'
                  ? 'bg-green-50 text-green-800'
                  : 'bg-red-50 text-red-800'
              }`}
            >
              {passwordMessage.type === 'success' ? (
                <CheckCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
              ) : (
                <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
              )}
              <span className="text-sm">{passwordMessage.text}</span>
            </div>
          )}

          <form onSubmit={handleUpdatePassword} className="space-y-4">
            {/* New Password */}
            <div>
              <label className="label">New Password</label>
              <input
                type="password"
                className="input"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="At least 8 characters"
                required
              />
              <p className="text-xs text-gray-500 mt-1">Minimum 8 characters</p>
            </div>

            {/* Confirm Password */}
            <div>
              <label className="label">Confirm Password</label>
              <input
                type="password"
                className="input"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Re-enter your password"
                required
              />
            </div>

            {/* Update Button */}
            <div className="pt-4">
              <button type="submit" disabled={updatingPassword} className="btn-primary flex items-center gap-2">
                {updatingPassword ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Updating...
                  </>
                ) : (
                  <>
                    <Lock className="w-4 h-4" />
                    Update Password
                  </>
                )}
              </button>
            </div>
          </form>
        </div>
      </div>
    </AppLayout>
  );
}
