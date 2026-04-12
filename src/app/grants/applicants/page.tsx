'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import AppLayout from '@/components/layout/AppLayout';
import { createClient } from '@/lib/supabase';
import { formatDate } from '@/lib/utils';
import { Search, Eye, EyeOff, AlertCircle } from 'lucide-react';

interface GrantApplicant {
  id: string;
  full_name: string;
  email: string;
  organization?: string;
  is_active: boolean;
  created_at: string;
  request_count?: number;
}

export default function ApplicantsPage() {
  const router = useRouter();
  const supabase = createClient();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);

  const [applicants, setApplicants] = useState<GrantApplicant[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [toggleLoading, setToggleLoading] = useState<string | null>(null);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        router.push('/login');
        return;
      }

      // Check permission - must be Grant Admin or foundation admin
      const { data: profile } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', user.id)
        .single();

      const { data: adminGroups } = await supabase
        .from('groups')
        .select('id')
        .eq('name', 'Grant Admin');

      let isGrantAdmin = profile?.role === 'admin' || profile?.role === 'president';
      if (!isGrantAdmin && adminGroups?.[0]) {
        const { data: membership } = await supabase
          .from('group_members')
          .select('id')
          .eq('group_id', adminGroups[0].id)
          .eq('profile_id', user.id)
          .single();
        isGrantAdmin = !!membership;
      }

      if (!isGrantAdmin) {
        setError('You do not have permission to manage applicants');
        setLoading(false);
        return;
      }

      setIsAdmin(true);

      // Load all grant applicants
      const { data: applicantsData, error: applicantsError } = await supabase
        .from('grant_applicants')
        .select('id, full_name, email, organization, is_active, created_at')
        .order('created_at', { ascending: false });

      if (applicantsError) throw applicantsError;

      // Get request counts
      const applicantsWithCounts = await Promise.all(
        (applicantsData || []).map(async (applicant) => {
          const { count } = await supabase
            .from('grant_requests')
            .select('*', { count: 'exact', head: true })
            .eq('applicant_id', applicant.id);

          return {
            ...applicant,
            request_count: count || 0,
          };
        })
      );

      setApplicants(applicantsWithCounts);
      setLoading(false);
    } catch (err) {
      console.error('Error loading applicants:', err);
      setError(err instanceof Error ? err.message : 'Failed to load applicants');
      setLoading(false);
    }
  };

  const handleToggleActive = async (applicantId: string, currentActive: boolean) => {
    try {
      setToggleLoading(applicantId);

      const { error: updateError } = await supabase
        .from('grant_applicants')
        .update({ is_active: !currentActive })
        .eq('id', applicantId);

      if (updateError) throw updateError;

      setApplicants(applicants.map(a =>
        a.id === applicantId ? { ...a, is_active: !currentActive } : a
      ));
    } catch (err) {
      console.error('Error toggling applicant status:', err);
      setError(err instanceof Error ? err.message : 'Failed to update applicant');
    } finally {
      setToggleLoading(null);
    }
  };

  const filteredApplicants = applicants.filter(applicant =>
    applicant.full_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    applicant.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (applicant.organization?.toLowerCase() || '').includes(searchQuery.toLowerCase())
  );

  if (loading) {
    return (
      <AppLayout>
        <div className="p-8 flex items-center justify-center h-full">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
            <p className="text-gray-600">Loading applicants...</p>
          </div>
        </div>
      </AppLayout>
    );
  }

  if (error && error.includes('do not have permission')) {
    return (
      <AppLayout>
        <div className="p-8">
          <div className="text-center">
            <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
            <h1 className="page-header text-red-900">Access Denied</h1>
            <p className="text-gray-600 mt-2">{error}</p>
            <button onClick={() => router.push('/grants')} className="btn-primary mt-4">
              Back to Grants
            </button>
          </div>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="p-8">
        <div className="mb-8">
          <button
            onClick={() => router.back()}
            className="text-primary hover:text-primary-dark mb-4 text-sm"
          >
            ← Back
          </button>
          <h1 className="page-header mb-2">Grant Applicants</h1>
          <p className="text-gray-600">Manage grant applicant accounts and status</p>
        </div>

        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg flex gap-3">
            <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
            <p className="text-red-800 text-sm">{error}</p>
          </div>
        )}

        <div className="card">
          {/* Search Bar */}
          <div className="mb-6 relative">
            <Search className="absolute left-3 top-3 w-5 h-5 text-gray-400" />
            <input
              type="text"
              placeholder="Search by name, email, or organization..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="input pl-10"
            />
          </div>

          {/* Stats */}
          <div className="grid grid-cols-3 gap-4 mb-6 pb-6 border-b border-gray-200">
            <div>
              <p className="text-sm text-gray-600">Total Applicants</p>
              <p className="text-2xl font-bold text-gray-900">{applicants.length}</p>
            </div>
            <div>
              <p className="text-sm text-gray-600">Active</p>
              <p className="text-2xl font-bold text-green-600">
                {applicants.filter(a => a.is_active).length}
              </p>
            </div>
            <div>
              <p className="text-sm text-gray-600">Inactive</p>
              <p className="text-2xl font-bold text-red-600">
                {applicants.filter(a => !a.is_active).length}
              </p>
            </div>
          </div>

          {/* Table */}
          {filteredApplicants.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-gray-200">
                    <th className="text-left py-3 px-4 font-semibold text-gray-900 text-sm">Name</th>
                    <th className="text-left py-3 px-4 font-semibold text-gray-900 text-sm">Email</th>
                    <th className="text-left py-3 px-4 font-semibold text-gray-900 text-sm">Organization</th>
                    <th className="text-left py-3 px-4 font-semibold text-gray-900 text-sm">Requests</th>
                    <th className="text-left py-3 px-4 font-semibold text-gray-900 text-sm">Status</th>
                    <th className="text-left py-3 px-4 font-semibold text-gray-900 text-sm">Created</th>
                    <th className="text-left py-3 px-4 font-semibold text-gray-900 text-sm">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredApplicants.map((applicant) => (
                    <tr key={applicant.id} className="border-b border-gray-200 hover:bg-gray-50">
                      <td className="py-3 px-4">
                        <p className="font-medium text-gray-900">{applicant.full_name}</p>
                      </td>
                      <td className="py-3 px-4 text-sm text-gray-600">
                        {applicant.email}
                      </td>
                      <td className="py-3 px-4 text-sm text-gray-600">
                        {applicant.organization || '—'}
                      </td>
                      <td className="py-3 px-4 text-sm text-gray-900">
                        <span className="font-semibold">{applicant.request_count}</span>
                      </td>
                      <td className="py-3 px-4">
                        <span
                          className={`px-3 py-1 rounded-full text-xs font-medium ${
                            applicant.is_active
                              ? 'bg-green-100 text-green-800'
                              : 'bg-gray-100 text-gray-800'
                          }`}
                        >
                          {applicant.is_active ? 'Active' : 'Inactive'}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-sm text-gray-600">
                        {formatDate(applicant.created_at)}
                      </td>
                      <td className="py-3 px-4">
                        <button
                          onClick={() => handleToggleActive(applicant.id, applicant.is_active)}
                          disabled={toggleLoading === applicant.id}
                          className="p-2 hover:bg-gray-200 rounded transition-colors disabled:opacity-50"
                          title={applicant.is_active ? 'Deactivate' : 'Activate'}
                        >
                          {applicant.is_active ? (
                            <Eye className="w-4 h-4 text-gray-600" />
                          ) : (
                            <EyeOff className="w-4 h-4 text-gray-400" />
                          )}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="text-center py-12">
              <AlertCircle className="w-12 h-12 text-gray-300 mx-auto mb-4" />
              <p className="text-gray-500">
                {searchQuery ? 'No applicants match your search' : 'No applicants yet'}
              </p>
            </div>
          )}
        </div>
      </div>
    </AppLayout>
  );
}
