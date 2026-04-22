'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import AppLayout from '@/components/layout/AppLayout';
import { createClient } from '@/lib/supabase';
import { formatDate } from '@/lib/utils';
import {
  Lock,
  CheckCircle2,
  Clock,
  AlertCircle,
  Plus,
  Users,
  ExternalLink,
  Copy,
  Shield,
  UserCheck,
  Bell,
} from 'lucide-react';

interface GrantApplication {
  id: string;
  title: string;
  description: string | null;
  status: 'draft' | 'open' | 'scoring' | 'closed' | 'completed';
  deadline: string | null;
  created_at: string;
  request_count?: number;
}

interface GroupMember {
  id: string;
  profile_id: string;
}

type UserRole = 'admin' | 'president' | 'grant_admin' | 'grant_committee' | 'none';

const statusColors: Record<string, string> = {
  draft: 'bg-gray-100 text-gray-800',
  open: 'bg-green-100 text-green-800',
  scoring: 'bg-blue-100 text-blue-800',
  closed: 'bg-yellow-100 text-yellow-800',
  completed: 'bg-purple-100 text-purple-800',
};

const statusIcons: Record<string, React.ReactNode> = {
  draft: <AlertCircle className="w-4 h-4" />,
  open: <CheckCircle2 className="w-4 h-4" />,
  scoring: <Clock className="w-4 h-4" />,
  closed: <Clock className="w-4 h-4" />,
  completed: <CheckCircle2 className="w-4 h-4" />,
};

export default function GrantsPage() {
  const router = useRouter();
  const supabase = createClient();

  const [userRole, setUserRole] = useState<UserRole>('none');
  const [loading, setLoading] = useState(true);
  const [applications, setApplications] = useState<GrantApplication[]>([]);
  const [activeTab, setActiveTab] = useState<'active' | 'scoring' | 'closed' | 'all'>('active');
  const [stats, setStats] = useState({
    totalApplications: 0,
    openApplications: 0,
    totalRequests: 0,
    pendingScores: 0,
    pendingEvaluators: 0,
    approvedEvaluators: 0,
  });

  useEffect(() => {
    checkAccessAndLoadData();
  }, []);

  const checkAccessAndLoadData = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();

      if (!user) {
        router.push('/login');
        return;
      }

      // Get user profile
      const { data: profile } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', user.id)
        .single();

      if (!profile) {
        setUserRole('none');
        setLoading(false);
        return;
      }

      // Check if user is admin or president
      if (profile.role === 'admin' || profile.role === 'president') {
        setUserRole(profile.role);
        await loadDashboardData();
        setLoading(false);
        return;
      }

      // Check group memberships
      const { data: grantAdminGroups } = await supabase
        .from('groups')
        .select('id')
        .eq('name', 'Grant Admin');

      const { data: grantCommitteeGroups } = await supabase
        .from('groups')
        .select('id')
        .eq('name', 'Grant Committee');

      let isGrantAdmin = false;
      let isGrantCommittee = false;

      if (grantAdminGroups && grantAdminGroups.length > 0) {
        const { data: adminMembership } = await supabase
          .from('group_members')
          .select('id')
          .eq('group_id', grantAdminGroups[0].id)
          .eq('profile_id', user.id)
          .single();

        isGrantAdmin = !!adminMembership;
      }

      if (grantCommitteeGroups && grantCommitteeGroups.length > 0) {
        const { data: committeeMembership } = await supabase
          .from('group_members')
          .select('id')
          .eq('group_id', grantCommitteeGroups[0].id)
          .eq('profile_id', user.id)
          .single();

        isGrantCommittee = !!committeeMembership;
      }

      if (isGrantAdmin) {
        setUserRole('grant_admin');
        await loadDashboardData();
      } else if (isGrantCommittee) {
        setUserRole('grant_committee');
        await loadCommitteeData();
      } else {
        setUserRole('none');
      }

      setLoading(false);
    } catch (error) {
      console.error('Error checking access:', error);
      setUserRole('none');
      setLoading(false);
    }
  };

  const loadDashboardData = async () => {
    try {
      // Load grant applications
      const { data: appsData } = await supabase
        .from('grant_applications')
        .select('*')
        .order('created_at', { ascending: false });

      if (appsData) {
        // Get request counts for each application
        const appsWithCounts = await Promise.all(
          appsData.map(async (app) => {
            const { count } = await supabase
              .from('grant_requests')
              .select('*', { count: 'exact', head: true })
              .eq('application_id', app.id);

            return {
              ...app,
              request_count: count || 0,
            };
          })
        );

        setApplications(appsWithCounts);

        // Calculate stats
        const { count: totalApps } = await supabase
          .from('grant_applications')
          .select('*', { count: 'exact', head: true });

        const { count: openApps } = await supabase
          .from('grant_applications')
          .select('*', { count: 'exact', head: true })
          .eq('status', 'open');

        const { count: totalReqs } = await supabase
          .from('grant_requests')
          .select('*', { count: 'exact', head: true });

        const { count: pendingScores } = await supabase
          .from('grant_requests')
          .select('*', { count: 'exact', head: true })
          .eq('status', 'pending_review');

        const { count: pendingEvals } = await supabase
          .from('grant_evaluators')
          .select('*', { count: 'exact', head: true })
          .eq('status', 'pending');

        const { count: approvedEvals } = await supabase
          .from('grant_evaluators')
          .select('*', { count: 'exact', head: true })
          .eq('status', 'approved');

        setStats({
          totalApplications: totalApps || 0,
          openApplications: openApps || 0,
          totalRequests: totalReqs || 0,
          pendingScores: pendingScores || 0,
          pendingEvaluators: pendingEvals || 0,
          approvedEvaluators: approvedEvals || 0,
        });
      }
    } catch (error) {
      console.error('Error loading dashboard data:', error);
    }
  };

  const loadCommitteeData = async () => {
    try {
      const { data: appsData } = await supabase
        .from('grant_applications')
        .select('*')
        .eq('status', 'scoring')
        .order('created_at', { ascending: false });

      if (appsData) {
        const appsWithCounts = await Promise.all(
          appsData.map(async (app) => {
            const { count } = await supabase
              .from('grant_requests')
              .select('*', { count: 'exact', head: true })
              .eq('application_id', app.id)
              .eq('status', 'pending_review');

            return {
              ...app,
              request_count: count || 0,
            };
          })
        );

        setApplications(appsWithCounts);
      }
    } catch (error) {
      console.error('Error loading committee data:', error);
    }
  };

  const handleRequestAccess = async () => {
    try {
      const response = await fetch('/api/grants/request-access', {
        method: 'POST',
      });

      if (response.ok) {
        alert('Access request sent to administrators');
      } else {
        const data = await response.json();
        alert(`Error: ${data.error}`);
      }
    } catch (error) {
      console.error('Error requesting access:', error);
      alert('Failed to send request');
    }
  };

  const getFilteredApplications = () => {
    if (activeTab === 'all') return applications;
    if (activeTab === 'active') return applications.filter(app => app.status === 'draft' || app.status === 'open');
    return applications.filter(app => app.status === activeTab);
  };

  const filteredApps = getFilteredApplications();

  if (loading) {
    return (
      <AppLayout>
        <div className="p-8 flex items-center justify-center h-full">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
            <p className="text-gray-600">Loading...</p>
          </div>
        </div>
      </AppLayout>
    );
  }

  // Access Denied View
  if (userRole === 'none') {
    return (
      <AppLayout>
        <div className="p-8 flex items-center justify-center min-h-screen">
          <div className="text-center max-w-md">
            <div className="bg-red-50 rounded-lg p-12 mb-6">
              <Lock className="w-16 h-16 text-red-500 mx-auto mb-4" />
              <h1 className="page-header text-red-900 mb-2">Access Denied</h1>
              <p className="text-red-700 mb-6">
                You don't currently have permission to access the Grant Portal.
              </p>
              <button
                onClick={handleRequestAccess}
                className="btn-primary"
              >
                Request Access
              </button>
            </div>
            <p className="text-gray-500 text-sm">
              Your request will be sent to the foundation administrators for review.
            </p>
          </div>
        </div>
      </AppLayout>
    );
  }

  // Grant Committee View
  if (userRole === 'grant_committee') {
    return (
      <AppLayout>
        <div className="p-8">
          <div className="mb-8">
            <h1 className="page-header">Grant Committee Review</h1>
            <p className="text-gray-500 mt-1">
              Review grant applications that require scoring
            </p>
          </div>

          {filteredApps.length > 0 ? (
            <div className="space-y-4">
              {filteredApps.map((app) => (
                <div
                  key={app.id}
                  onClick={() => router.push(`/grants/applications/${app.id}/review`)}
                  className="card hover:shadow-md transition-all cursor-pointer"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <h3 className="font-semibold text-gray-900 mb-1">
                        {app.title}
                      </h3>
                      {app.description && (
                        <p className="text-sm text-gray-500 mb-3">
                          {app.description.substring(0, 100)}...
                        </p>
                      )}
                      <div className="flex items-center gap-4 text-sm text-gray-600">
                        <span>{app.request_count} requests to score</span>
                      </div>
                    </div>
                    <span className={`badge ${statusColors[app.status] || 'bg-gray-100'}`}>
                      {app.status.replace('_', ' ')}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="card text-center py-12">
              <Clock className="w-12 h-12 text-gray-300 mx-auto mb-4" />
              <p className="text-gray-500">No applications requiring review at this time</p>
            </div>
          )}
        </div>
      </AppLayout>
    );
  }

  // Admin / Grant Admin Dashboard
  return (
    <AppLayout>
      <div className="p-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="page-header">Grants Dashboard</h1>
          <p className="text-gray-500 mt-1">
            Manage grant applications and track review progress
          </p>
        </div>

        {/* Stats Row */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <div className="card">
            <p className="text-sm text-gray-500 mb-1">Total Applications</p>
            <p className="text-3xl font-bold text-gray-900">{stats.totalApplications}</p>
          </div>
          <div className="card">
            <p className="text-sm text-gray-500 mb-1">Open Applications</p>
            <p className="text-3xl font-bold text-green-600">{stats.openApplications}</p>
          </div>
          <div className="card">
            <p className="text-sm text-gray-500 mb-1">Total Requests</p>
            <p className="text-3xl font-bold text-blue-600">{stats.totalRequests}</p>
          </div>
          <div className="card">
            <p className="text-sm text-gray-500 mb-1">Pending Scores</p>
            <p className="text-3xl font-bold text-orange-600">{stats.pendingScores}</p>
          </div>
        </div>

        {/* Pending Evaluator Alert */}
        {stats.pendingEvaluators > 0 && (
          <div
            className="card mb-6 border-l-4 border-l-amber-500 bg-amber-50 cursor-pointer hover:shadow-md transition"
            onClick={() => router.push('/grants/evaluators')}
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-amber-100 rounded-full flex items-center justify-center">
                <Bell className="w-5 h-5 text-amber-600" />
              </div>
              <div className="flex-1">
                <p className="font-semibold text-amber-900">
                  {stats.pendingEvaluators} evaluator{stats.pendingEvaluators !== 1 ? 's' : ''} pending approval
                </p>
                <p className="text-sm text-amber-700">Click to review and approve or reject evaluator registrations.</p>
              </div>
              <UserCheck className="w-5 h-5 text-amber-500" />
            </div>
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex flex-wrap gap-4 mb-8">
          <button
            onClick={() => router.push('/grants/applications/new')}
            className="btn-primary flex items-center gap-2"
          >
            <Plus className="w-4 h-4" />
            New Application
          </button>
          <button
            onClick={() => router.push('/grants/applicants')}
            className="btn-secondary flex items-center gap-2"
          >
            <Users className="w-4 h-4" />
            Manage Applicants
          </button>
          <button
            onClick={() => router.push('/grants/evaluators')}
            className="btn-secondary flex items-center gap-2"
          >
            <Shield className="w-4 h-4" />
            Manage Evaluators
            {stats.approvedEvaluators > 0 && (
              <span className="bg-emerald-100 text-emerald-700 text-xs px-1.5 py-0.5 rounded-full">{stats.approvedEvaluators}</span>
            )}
          </button>
        </div>

        {/* Applicant Portal Link */}
        <div className="card mb-8 border-l-4 border-l-blue-500">
          <div className="flex items-start gap-3">
            <ExternalLink className="w-5 h-5 text-blue-500 mt-0.5 flex-shrink-0" />
            <div className="flex-1">
              <h3 className="font-semibold text-gray-900 mb-1">Applicant Portal Link</h3>
              <p className="text-sm text-gray-500 mb-3">
                Share this link with potential grant applicants. They can register, log in, and submit grant requests through this portal.
              </p>
              <div className="flex items-center gap-2">
                <code className="bg-gray-100 px-3 py-1.5 rounded text-sm text-gray-700 flex-1 overflow-x-auto">
                  {typeof window !== 'undefined' ? `${window.location.origin}/grants/login` : '/grants/login'}
                </code>
                <button
                  onClick={() => {
                    const url = `${window.location.origin}/grants/login`;
                    navigator.clipboard.writeText(url);
                    alert('Link copied to clipboard!');
                  }}
                  className="btn-secondary flex items-center gap-1 text-sm whitespace-nowrap"
                >
                  <Copy className="w-4 h-4" />
                  Copy Link
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Evaluator Portal Link */}
        <div className="card mb-8 border-l-4 border-l-emerald-500">
          <div className="flex items-start gap-3">
            <Shield className="w-5 h-5 text-emerald-500 mt-0.5 flex-shrink-0" />
            <div className="flex-1">
              <h3 className="font-semibold text-gray-900 mb-1">Evaluator Portal Link</h3>
              <p className="text-sm text-gray-500 mb-3">
                Share this link with external evaluators. They can register, await approval, and score assigned applications.
              </p>
              <div className="flex items-center gap-2">
                <code className="bg-gray-100 px-3 py-1.5 rounded text-sm text-gray-700 flex-1 overflow-x-auto">
                  {typeof window !== 'undefined' ? `${window.location.origin}/grants/evaluator/login` : '/grants/evaluator/login'}
                </code>
                <button
                  onClick={() => {
                    const url = `${window.location.origin}/grants/evaluator/login`;
                    navigator.clipboard.writeText(url);
                    alert('Link copied to clipboard!');
                  }}
                  className="btn-secondary flex items-center gap-1 text-sm whitespace-nowrap"
                >
                  <Copy className="w-4 h-4" />
                  Copy Link
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-2 mb-6 border-b border-gray-200">
          {(['active', 'scoring', 'closed', 'all'] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-4 py-2 font-medium text-sm border-b-2 transition-colors capitalize ${
                activeTab === tab
                  ? 'border-primary text-primary'
                  : 'border-transparent text-gray-600 hover:text-gray-900'
              }`}
            >
              {tab}
            </button>
          ))}
        </div>

        {/* Applications List */}
        {filteredApps.length > 0 ? (
          <div className="space-y-4">
            {filteredApps.map((app) => (
              <div
                key={app.id}
                onClick={() => router.push(`/grants/applications/${app.id}`)}
                className="card hover:shadow-md transition-all cursor-pointer"
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <h3 className="font-semibold text-gray-900">
                        {app.title}
                      </h3>
                    </div>
                    {app.description && (
                      <p className="text-sm text-gray-500 mb-3">
                        {app.description.substring(0, 100)}...
                      </p>
                    )}
                    <div className="flex flex-wrap items-center gap-4 text-sm text-gray-600">
                      <span className="flex items-center gap-1">
                        <Users className="w-4 h-4" />
                        {app.request_count} requests
                      </span>
                      {app.deadline && (
                        <span className="flex items-center gap-1">
                          <Clock className="w-4 h-4" />
                          Due {formatDate(app.deadline)}
                        </span>
                      )}
                      <span className="text-xs text-gray-400">
                        Created {formatDate(app.created_at)}
                      </span>
                    </div>
                  </div>
                  <span
                    className={`badge flex items-center gap-2 whitespace-nowrap ${
                      statusColors[app.status] || 'bg-gray-100'
                    }`}
                  >
                    {statusIcons[app.status]}
                    {app.status.replace('_', ' ')}
                  </span>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="card text-center py-12">
            <AlertCircle className="w-12 h-12 text-gray-300 mx-auto mb-4" />
            <p className="text-gray-500">
              {activeTab === 'all'
                ? 'No grant applications yet'
                : `No ${activeTab} applications`}
            </p>
          </div>
        )}
      </div>
    </AppLayout>
  );
}
