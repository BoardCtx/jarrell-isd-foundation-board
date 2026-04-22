'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase';
import Link from 'next/link';
import {
  ClipboardCheck, FileText, Calendar, CheckCircle2, Clock,
  AlertCircle, ChevronRight, BarChart3,
} from 'lucide-react';

interface AssignedApplication {
  id: string;
  title: string;
  description: string | null;
  status: string;
  deadline: string | null;
  scoring_schema: any;
  request_count: number;
  scored_count: number;
}

export default function EvaluatorPortalHome() {
  const [applications, setApplications] = useState<AssignedApplication[]>([]);
  const [loading, setLoading] = useState(true);
  const supabase = createClient();

  useEffect(() => {
    loadAssignedApplications();
  }, []);

  const loadAssignedApplications = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    // Get applications this evaluator is assigned to
    const { data: assignments } = await supabase
      .from('grant_evaluator_assignments')
      .select('application_id')
      .eq('evaluator_id', user.id);

    if (!assignments || assignments.length === 0) {
      setApplications([]);
      setLoading(false);
      return;
    }

    const appIds = assignments.map(a => a.application_id);

    // Load application details
    const { data: apps } = await supabase
      .from('grant_applications')
      .select('id, title, description, status, deadline, scoring_schema, external_evaluator_past_visibility')
      .in('id', appIds)
      .order('created_at', { ascending: false });

    if (!apps) {
      setApplications([]);
      setLoading(false);
      return;
    }

    // Filter: show active scoring apps always, show past only if visibility is on
    const visibleApps = apps.filter(app => {
      if (app.status === 'scoring') return true;
      if (['decided', 'awarded', 'closed', 'archived'].includes(app.status)) {
        return app.external_evaluator_past_visibility === true;
      }
      return app.status === 'open'; // show open apps so evaluator sees context
    });

    // For each app, count requests and scores by this evaluator
    const enriched: AssignedApplication[] = [];
    for (const app of visibleApps) {
      const { count: requestCount } = await supabase
        .from('grant_requests')
        .select('id', { count: 'exact', head: true })
        .eq('application_id', app.id)
        .in('status', ['submitted', 'under_review', 'approved', 'rejected', 'partial_funding', 'awarded']);

      const { count: scoredCount } = await supabase
        .from('grant_scores')
        .select('id', { count: 'exact', head: true })
        .eq('application_id', app.id)
        .eq('scorer_id', user.id);

      enriched.push({
        ...app,
        request_count: requestCount || 0,
        scored_count: scoredCount || 0,
      });
    }

    setApplications(enriched);
    setLoading(false);
  };

  const activeApps = applications.filter(a => a.status === 'scoring');
  const pastApps = applications.filter(a => a.status !== 'scoring');

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-gray-500">Loading your assignments...</div>
      </div>
    );
  }

  return (
    <div>
      {/* Welcome */}
      <div className="mb-8">
        <h2 className="text-2xl font-bold text-gray-900">Welcome, Evaluator</h2>
        <p className="text-gray-600 mt-1">Review and score grant applications assigned to you.</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
        <div className="card p-5 flex items-center gap-4">
          <div className="w-12 h-12 bg-emerald-100 rounded-xl flex items-center justify-center">
            <ClipboardCheck className="w-6 h-6 text-emerald-600" />
          </div>
          <div>
            <p className="text-2xl font-bold text-gray-900">{activeApps.length}</p>
            <p className="text-sm text-gray-500">Active Reviews</p>
          </div>
        </div>
        <div className="card p-5 flex items-center gap-4">
          <div className="w-12 h-12 bg-blue-100 rounded-xl flex items-center justify-center">
            <FileText className="w-6 h-6 text-blue-600" />
          </div>
          <div>
            <p className="text-2xl font-bold text-gray-900">
              {activeApps.reduce((sum, a) => sum + a.request_count, 0)}
            </p>
            <p className="text-sm text-gray-500">Total Requests</p>
          </div>
        </div>
        <div className="card p-5 flex items-center gap-4">
          <div className="w-12 h-12 bg-amber-100 rounded-xl flex items-center justify-center">
            <BarChart3 className="w-6 h-6 text-amber-600" />
          </div>
          <div>
            <p className="text-2xl font-bold text-gray-900">
              {activeApps.reduce((sum, a) => sum + a.scored_count, 0)}
            </p>
            <p className="text-sm text-gray-500">Reviews Completed</p>
          </div>
        </div>
      </div>

      {/* Active Applications to Review */}
      {activeApps.length > 0 && (
        <div className="mb-8">
          <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
            <AlertCircle className="w-5 h-5 text-amber-500" />
            Applications Awaiting Your Review
          </h3>
          <div className="space-y-4">
            {activeApps.map(app => {
              const progress = app.request_count > 0 ? Math.round((app.scored_count / app.request_count) * 100) : 0;
              const isComplete = app.scored_count >= app.request_count && app.request_count > 0;

              return (
                <Link
                  key={app.id}
                  href={`/grants/evaluator/portal/review/${app.id}`}
                  className="card p-6 block hover:shadow-md transition group"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <h4 className="text-lg font-semibold text-gray-900 group-hover:text-emerald-600 transition">
                        {app.title}
                      </h4>
                      {app.description && (
                        <p className="text-gray-600 mt-1 line-clamp-2">{app.description}</p>
                      )}
                      <div className="flex items-center gap-4 mt-3 text-sm">
                        <span className="flex items-center gap-1.5 text-gray-500">
                          <FileText className="w-4 h-4" />
                          {app.request_count} request{app.request_count !== 1 ? 's' : ''}
                        </span>
                        {app.deadline && (
                          <span className="flex items-center gap-1.5 text-gray-500">
                            <Calendar className="w-4 h-4" />
                            Deadline: {new Date(app.deadline).toLocaleDateString()}
                          </span>
                        )}
                        {isComplete ? (
                          <span className="flex items-center gap-1.5 text-green-600 font-medium">
                            <CheckCircle2 className="w-4 h-4" />
                            All scored
                          </span>
                        ) : (
                          <span className="flex items-center gap-1.5 text-amber-600 font-medium">
                            <Clock className="w-4 h-4" />
                            {app.scored_count}/{app.request_count} scored
                          </span>
                        )}
                      </div>
                    </div>
                    <ChevronRight className="w-5 h-5 text-gray-400 group-hover:text-emerald-500 mt-1" />
                  </div>

                  {/* Progress bar */}
                  <div className="mt-4">
                    <div className="w-full bg-gray-100 rounded-full h-2">
                      <div
                        className={`h-2 rounded-full transition-all ${isComplete ? 'bg-green-500' : 'bg-emerald-500'}`}
                        style={{ width: `${progress}%` }}
                      />
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        </div>
      )}

      {/* No active assignments */}
      {activeApps.length === 0 && (
        <div className="card p-12 text-center mb-8">
          <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <ClipboardCheck className="w-8 h-8 text-gray-400" />
          </div>
          <h3 className="text-lg font-semibold text-gray-700 mb-2">No Active Reviews</h3>
          <p className="text-gray-500">You don't have any applications assigned for review right now. You'll receive an email when new assignments are available.</p>
        </div>
      )}

      {/* Past/Completed Applications */}
      {pastApps.length > 0 && (
        <div>
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Past Reviews</h3>
          <div className="space-y-3">
            {pastApps.map(app => (
              <div key={app.id} className="card p-4 flex items-center justify-between">
                <div>
                  <h4 className="font-medium text-gray-900">{app.title}</h4>
                  <p className="text-sm text-gray-500">
                    {app.scored_count} review{app.scored_count !== 1 ? 's' : ''} completed
                    <span className="mx-2">&middot;</span>
                    <span className="capitalize">{app.status}</span>
                  </p>
                </div>
                <span className="badge bg-gray-100 text-gray-600 capitalize">{app.status}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
