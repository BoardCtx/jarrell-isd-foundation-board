'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase';
import Link from 'next/link';
import {
  Calendar,
  Clock,
  CheckCircle2,
  AlertCircle,
  ChevronRight,
  FileText,
} from 'lucide-react';

interface GrantApplication {
  id: string;
  title: string;
  description: string | null;
  deadline: string | null;
  status: string;
}

interface GrantRequest {
  id: string;
  application_id: string;
  status: string;
  submitted_at: string | null;
  created_at: string;
  application: {
    title: string;
  } | null;
  decision_visible: boolean;
  decision: string | null;
}

const statusColors: Record<string, { bg: string; text: string; icon: React.ReactNode }> = {
  draft: {
    bg: 'bg-yellow-50',
    text: 'text-yellow-700',
    icon: <AlertCircle className="w-4 h-4" />,
  },
  submitted: {
    bg: 'bg-blue-50',
    text: 'text-blue-700',
    icon: <Clock className="w-4 h-4" />,
  },
  approved: {
    bg: 'bg-green-50',
    text: 'text-green-700',
    icon: <CheckCircle2 className="w-4 h-4" />,
  },
  rejected: {
    bg: 'bg-red-50',
    text: 'text-red-700',
    icon: <AlertCircle className="w-4 h-4" />,
  },
};

const badgeColors: Record<string, string> = {
  draft: 'bg-yellow-100 text-yellow-800',
  submitted: 'bg-blue-100 text-blue-800',
  approved: 'bg-green-100 text-green-800',
  rejected: 'bg-red-100 text-red-800',
};

function getDaysUntilDeadline(deadline: string | null): string | null {
  if (!deadline) return null;
  const now = new Date();
  const deadlineDate = new Date(deadline);
  const diffTime = deadlineDate.getTime() - now.getTime();
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

  if (diffDays < 0) return null;
  if (diffDays === 0) return 'Today';
  if (diffDays === 1) return 'Tomorrow';
  if (diffDays <= 7) return `${diffDays} days left`;
  if (diffDays <= 30) return `${Math.ceil(diffDays / 7)} weeks left`;
  return `${Math.ceil(diffDays / 30)} months left`;
}

export default function GrantsPortalPage() {
  const [applications, setApplications] = useState<GrantApplication[]>([]);
  const [requests, setRequests] = useState<GrantRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedPastApplications, setExpandedPastApplications] = useState(false);
  const router = useRouter();
  const supabase = createClient();

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();

      if (!user) {
        router.push('/grants/login');
        return;
      }

      // Load open applications
      const { data: appsData, error: appsError } = await supabase
        .from('grant_applications')
        .select('id, title, description, deadline, status')
        .eq('status', 'open')
        .order('deadline', { ascending: true, nullsFirst: false });

      if (!appsError && appsData) {
        setApplications(appsData);
      }

      // Load user's requests
      const { data: requestsData, error: requestsError } = await supabase
        .from('grant_requests')
        .select(`
          id,
          application_id,
          status,
          submitted_at,
          created_at,
          decision_visible,
          decision,
          grant_applications:application_id (
            title
          )
        `)
        .eq('applicant_id', user.id)
        .order('created_at', { ascending: false });

      if (!requestsError && requestsData) {
        // Transform the data to match our interface
        const transformedRequests = requestsData.map((req: any) => ({
          id: req.id,
          application_id: req.application_id,
          status: req.status,
          submitted_at: req.submitted_at,
          created_at: req.created_at,
          decision_visible: req.decision_visible,
          decision: req.decision,
          application: req.grant_applications ? { title: req.grant_applications.title } : null,
        }));
        setRequests(transformedRequests);
      }

      setLoading(false);
    } catch (err) {
      console.error('Error loading data:', err);
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-gray-600">Loading...</div>
      </div>
    );
  }

  const myRequests = requests.filter(r => r.status !== 'archived' && r.application);
  const pastApplications = requests.filter(r => {
    const app = applications.find(a => a.id === r.application_id);
    return !app || app.status !== 'open';
  });

  const draftCount = myRequests.filter(r => r.status === 'draft').length;
  const submittedCount = myRequests.filter(r => r.status === 'submitted').length;
  const approvedCount = myRequests.filter(r => r.status === 'approved').length;

  return (
    <div className="space-y-8">
      {/* Welcome Section */}
      <div>
        <h2 className="page-header mb-2">Welcome to the Grant Portal</h2>
        <p className="text-gray-600">Browse open grant applications and manage your submissions.</p>
      </div>

      {/* Summary Stats */}
      {myRequests.length > 0 && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="card text-center py-4">
            <p className="text-2xl font-bold text-gray-900">{applications.length}</p>
            <p className="text-xs text-gray-500 mt-1">Open Applications</p>
          </div>
          <div className="card text-center py-4">
            <p className="text-2xl font-bold text-yellow-600">{draftCount}</p>
            <p className="text-xs text-gray-500 mt-1">Drafts</p>
          </div>
          <div className="card text-center py-4">
            <p className="text-2xl font-bold text-blue-600">{submittedCount}</p>
            <p className="text-xs text-gray-500 mt-1">Submitted</p>
          </div>
          <div className="card text-center py-4">
            <p className="text-2xl font-bold text-green-600">{approvedCount}</p>
            <p className="text-xs text-gray-500 mt-1">Approved</p>
          </div>
        </div>
      )}

      {/* Open Applications Section */}
      <div>
        <h3 className="text-xl font-bold text-gray-900 mb-4 flex items-center gap-2">
          <FileText className="w-5 h-5 text-primary" />
          Open Applications
        </h3>
        {applications.length === 0 ? (
          <div className="card text-center py-12">
            <p className="text-gray-500">No open grant applications at this time.</p>
            <p className="text-sm text-gray-400 mt-2">Check back soon for new opportunities.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {applications.map((app) => {
              const daysLeft = getDaysUntilDeadline(app.deadline);
              const isUrgent = app.deadline && new Date(app.deadline) < new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

              return (
                <div key={app.id} className="card hover:shadow-md transition">
                  <div className="space-y-3">
                    <div>
                      <h4 className="font-semibold text-gray-900">{app.title}</h4>
                      {app.description && (
                        <p className="text-sm text-gray-600 mt-2 line-clamp-2">{app.description}</p>
                      )}
                    </div>

                    {app.deadline && (
                      <div className={`flex items-center gap-2 text-sm ${isUrgent ? 'text-red-600 font-medium' : 'text-gray-600'}`}>
                        <Calendar className="w-4 h-4" />
                        <span>Deadline: {new Date(app.deadline).toLocaleDateString()}</span>
                        {daysLeft && (
                          <span className={`ml-auto px-2 py-1 rounded text-xs font-medium ${isUrgent ? 'bg-red-100' : 'bg-blue-100'}`}>
                            {daysLeft}
                          </span>
                        )}
                      </div>
                    )}

                    <div className="pt-2">
                      <Link
                        href={`/grants/portal/apply/${app.id}`}
                        className="btn-primary inline-block w-full text-center"
                      >
                        Apply Now
                      </Link>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* My Requests Section */}
      {myRequests.length > 0 && (
        <div>
          <h3 className="text-xl font-bold text-gray-900 mb-4 flex items-center gap-2">
            <FileText className="w-5 h-5 text-primary" />
            My Requests
          </h3>
          <div className="space-y-2">
            {myRequests.map((request) => {
              const statusInfo = statusColors[request.status] || statusColors.draft;

              return (
                <Link
                  key={request.id}
                  href={`/grants/portal/requests/${request.id}`}
                  className={`block card hover:shadow-md transition ${statusInfo.bg}`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3 flex-1">
                      <div className={`${statusInfo.text}`}>
                        {statusInfo.icon}
                      </div>
                      <div>
                        <p className="font-medium text-gray-900">{request.application?.title}</p>
                        <p className="text-sm text-gray-600 mt-1">
                          {request.status === 'draft' && 'Draft'}
                          {request.status === 'submitted' && `Submitted on ${new Date(request.submitted_at!).toLocaleDateString()}`}
                          {request.status === 'approved' && 'Approved'}
                          {request.status === 'rejected' && 'Rejected'}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className={`badge ${badgeColors[request.status]}`}>
                        {request.status.charAt(0).toUpperCase() + request.status.slice(1)}
                      </span>
                      <ChevronRight className="w-5 h-5 text-gray-400" />
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        </div>
      )}

      {/* Past Applications Section */}
      {pastApplications.length > 0 && (
        <div>
          <button
            onClick={() => setExpandedPastApplications(!expandedPastApplications)}
            className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2 hover:text-primary transition"
          >
            <FileText className="w-5 h-5" />
            Past Applications
            <span className="text-sm text-gray-500 font-normal">({pastApplications.length})</span>
            <span className={`ml-auto text-gray-400 transition ${expandedPastApplications ? 'rotate-180' : ''}`}>
              ▼
            </span>
          </button>

          {expandedPastApplications && (
            <div className="space-y-2">
              {pastApplications.map((request) => {
                const statusInfo = statusColors[request.status] || statusColors.draft;

                return (
                  <Link
                    key={request.id}
                    href={`/grants/portal/requests/${request.id}`}
                    className={`block card hover:shadow-md transition ${statusInfo.bg}`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3 flex-1">
                        <div className={`${statusInfo.text}`}>
                          {statusInfo.icon}
                        </div>
                        <div>
                          <p className="font-medium text-gray-900">{request.application?.title || 'Unknown Application'}</p>
                          <p className="text-sm text-gray-600 mt-1">
                            Submitted on {new Date(request.created_at).toLocaleDateString()}
                          </p>
                          {request.decision_visible && request.decision && (
                            <p className={`text-sm font-medium mt-2 ${request.decision === 'approved' ? 'text-green-700' : 'text-red-700'}`}>
                              Decision: {request.decision.charAt(0).toUpperCase() + request.decision.slice(1)}
                            </p>
                          )}
                        </div>
                      </div>
                      <ChevronRight className="w-5 h-5 text-gray-400" />
                    </div>
                  </Link>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
