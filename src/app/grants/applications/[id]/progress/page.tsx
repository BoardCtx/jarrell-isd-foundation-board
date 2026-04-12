'use client';

import { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import AppLayout from '@/components/layout/AppLayout';
import { createClient } from '@/lib/supabase';
import { cn } from '@/lib/utils';
import { AlertCircle, ChevronDown, ChevronUp, Eye } from 'lucide-react';

interface CommitteeMemberProgress {
  profile_id: string;
  full_name: string;
  email: string;
  total_scored: number;
  total_requests: number;
  expanded: boolean;
}

interface RequestSummary {
  id: string;
  applicant_name: string;
  total_scores: number;
  average_score?: number;
  votes?: Record<string, number>;
}

interface GrantScore {
  id: string;
  scorer_id: string;
  score_data: Record<string, any>;
  profile?: { full_name: string };
}

interface Profile {
  id: string;
  full_name: string;
  email: string;
}

export default function ProgressPage() {
  const router = useRouter();
  const params = useParams();
  const applicationId = params.id as string;
  const supabase = createClient();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);

  const [memberProgress, setMemberProgress] = useState<CommitteeMemberProgress[]>([]);
  const [requestSummaries, setRequestSummaries] = useState<RequestSummary[]>([]);
  const [scoringSchema, setScoringSchema] = useState<any>(null);
  const [expandedMembers, setExpandedMembers] = useState<Set<string>>(new Set());
  const [memberScores, setMemberScores] = useState<Record<string, GrantScore[]>>({});

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

      // Check permission - must be Grant Admin
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
        setError('You do not have permission to view progress');
        setLoading(false);
        return;
      }

      setIsAdmin(true);

      // Load application scoring schema
      const { data: app, error: appError } = await supabase
        .from('grant_applications')
        .select('scoring_schema')
        .eq('id', applicationId)
        .single();

      if (appError) throw appError;
      setScoringSchema(app.scoring_schema);

      // Get committee members
      const { data: committeeGroup } = await supabase
        .from('groups')
        .select('id')
        .eq('name', 'Grant Committee')
        .single();

      if (!committeeGroup) throw new Error('Grant Committee group not found');

      const { data: memberIds } = await supabase
        .from('group_members')
        .select('profile_id')
        .eq('group_id', committeeGroup.id);

      // Load profiles for all members
      const profileIds = memberIds?.map(m => m.profile_id) || [];
      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, full_name, email')
        .in('id', profileIds);

      // Load total requests
      const { count: totalRequests } = await supabase
        .from('grant_requests')
        .select('*', { count: 'exact', head: true })
        .eq('application_id', applicationId)
        .eq('status', 'submitted');

      const total = totalRequests || 0;

      // Load scores for all members
      const { data: allScores, error: scoresError } = await supabase
        .from('grant_scores')
        .select('scorer_id, request_id, score_data')
        .eq('application_id', applicationId);

      if (scoresError) throw scoresError;

      // Calculate member progress
      const scoresByMember: Record<string, Set<string>> = {};
      const scoresByRequest: Record<string, GrantScore[]> = {};

      (allScores || []).forEach(score => {
        if (!scoresByMember[score.scorer_id]) {
          scoresByMember[score.scorer_id] = new Set();
        }
        scoresByMember[score.scorer_id].add(score.request_id);

        if (!scoresByRequest[score.request_id]) {
          scoresByRequest[score.request_id] = [];
        }
        scoresByRequest[score.request_id].push(score);
      });

      setMemberScores(scoresByRequest);

      const memberProgressData: CommitteeMemberProgress[] = (profiles || [])
        .map(prof => ({
          profile_id: prof.id,
          full_name: prof.full_name,
          email: prof.email,
          total_scored: scoresByMember[prof.id]?.size || 0,
          total_requests: total,
          expanded: false,
        }))
        .sort((a, b) => b.total_scored - a.total_scored);

      setMemberProgress(memberProgressData);

      // Load request summaries
      const { data: requests, error: requestsError } = await supabase
        .from('grant_requests')
        .select('id, applicant_id, status')
        .eq('application_id', applicationId)
        .eq('status', 'submitted');

      if (requestsError) throw requestsError;

      // Load applicant names
      const applicantIds = requests?.map(r => r.applicant_id) || [];
      const { data: applicants } = await supabase
        .from('grant_applicants')
        .select('id, full_name')
        .in('id', applicantIds);

      const applicantMap: Record<string, string> = {};
      (applicants || []).forEach(a => {
        applicantMap[a.id] = a.full_name;
      });

      // Build request summaries
      const requestSummaries: RequestSummary[] = (requests || []).map(req => {
        const scores = scoresByRequest[req.id] || [];
        const summary: RequestSummary = {
          id: req.id,
          applicant_name: applicantMap[req.applicant_id] || 'Unknown',
          total_scores: scores.length,
        };

        if (scoringSchema?.type === 'score_range' && scoringSchema.criteria) {
          const validScores = scores
            .map(s => {
              const criteria = s.score_data.criteria || {};
              const weightedTotal = scoringSchema.criteria.reduce((total: number, c: any) => {
                return total + ((criteria[c.id] || 0) * c.weight) / 100;
              }, 0);
              return weightedTotal;
            })
            .filter((s: number) => !isNaN(s));

          summary.average_score = validScores.length > 0
            ? validScores.reduce((a, b) => a + b, 0) / validScores.length
            : undefined;
        } else if (scoringSchema?.type === 'approve_reject' || scoringSchema?.type === 'fund_options' || scoringSchema?.type === 'custom') {
          const votes: Record<string, number> = {};
          scores.forEach(s => {
            const option = s.score_data.option;
            if (option) {
              votes[option] = (votes[option] || 0) + 1;
            }
          });
          summary.votes = votes;
        }

        return summary;
      });

      requestSummaries.sort((a, b) => b.total_scores - a.total_scores);
      setRequestSummaries(requestSummaries);

      setLoading(false);
    } catch (err) {
      console.error('Error loading progress:', err);
      setError(err instanceof Error ? err.message : 'Failed to load progress data');
      setLoading(false);
    }
  };

  const toggleMemberExpanded = (profileId: string) => {
    const newExpanded = new Set(expandedMembers);
    if (newExpanded.has(profileId)) {
      newExpanded.delete(profileId);
    } else {
      newExpanded.add(profileId);
    }
    setExpandedMembers(newExpanded);
  };

  if (loading) {
    return (
      <AppLayout>
        <div className="p-8 flex items-center justify-center h-full">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
            <p className="text-gray-600">Loading progress...</p>
          </div>
        </div>
      </AppLayout>
    );
  }

  if (error) {
    return (
      <AppLayout>
        <div className="p-8">
          <div className="text-center">
            <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
            <h1 className="page-header text-red-900">Error</h1>
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
      <div className="p-8 max-w-6xl">
        <div className="mb-8">
          <button
            onClick={() => router.back()}
            className="text-primary hover:text-primary-dark mb-4 text-sm"
          >
            ← Back
          </button>
          <h1 className="page-header mb-2">Scoring Progress</h1>
          <p className="text-gray-600">Track committee member progress and request scoring status</p>
        </div>

        <div className="space-y-8">
          {/* Committee Member Progress */}
          <div className="card">
            <h2 className="text-lg font-semibold mb-4 text-gray-900">Committee Member Progress</h2>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-gray-200">
                    <th className="text-left py-3 px-4 font-semibold text-gray-900 text-sm">Member</th>
                    <th className="text-left py-3 px-4 font-semibold text-gray-900 text-sm">Scored</th>
                    <th className="text-left py-3 px-4 font-semibold text-gray-900 text-sm">Progress</th>
                    <th className="text-left py-3 px-4 font-semibold text-gray-900 text-sm">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {memberProgress.map((member) => {
                    const percentage = member.total_requests > 0
                      ? Math.round((member.total_scored / member.total_requests) * 100)
                      : 0;

                    return (
                      <React.Fragment key={member.profile_id}>
                        <tr
                          className="border-b border-gray-200 hover:bg-gray-50 cursor-pointer"
                          onClick={() => toggleMemberExpanded(member.profile_id)}
                        >
                          <td className="py-3 px-4">
                            <div className="flex items-center gap-3">
                              <div>
                                <p className="font-medium text-gray-900">{member.full_name}</p>
                                <p className="text-xs text-gray-500">{member.email}</p>
                              </div>
                            </div>
                          </td>
                          <td className="py-3 px-4 text-sm">
                            {member.total_scored} / {member.total_requests}
                          </td>
                          <td className="py-3 px-4">
                            <div className="flex items-center gap-3">
                              <div className="w-24 bg-gray-200 rounded-full h-2">
                                <div
                                  className="bg-primary h-2 rounded-full transition-all"
                                  style={{ width: `${percentage}%` }}
                                />
                              </div>
                              <span className="text-sm font-medium text-gray-900 w-12">{percentage}%</span>
                            </div>
                          </td>
                          <td className="py-3 px-4">
                            <span className="text-sm text-gray-500">
                              {percentage === 100 ? '✓ Complete' : 'In Progress'}
                            </span>
                          </td>
                        </tr>
                        {expandedMembers.has(member.profile_id) && (
                          <tr className="bg-gray-50">
                            <td colSpan={4} className="py-4 px-4">
                              <p className="text-sm font-medium text-gray-900 mb-3">Scored Requests:</p>
                              <div className="space-y-2 max-h-64 overflow-y-auto">
                                {/* Would load and display scored requests for this member */}
                                <p className="text-xs text-gray-500">
                                  Showing {member.total_scored} of {member.total_requests} scored requests
                                </p>
                              </div>
                            </td>
                          </tr>
                        )}
                      </React.Fragment>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* Request Summary */}
          <div className="card">
            <h2 className="text-lg font-semibold mb-4 text-gray-900">Request Scoring Summary</h2>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-gray-200">
                    <th className="text-left py-3 px-4 font-semibold text-gray-900 text-sm">Applicant</th>
                    <th className="text-left py-3 px-4 font-semibold text-gray-900 text-sm">Scores Received</th>
                    {scoringSchema?.type === 'score_range' && (
                      <th className="text-left py-3 px-4 font-semibold text-gray-900 text-sm">Average Score</th>
                    )}
                    {(scoringSchema?.type === 'approve_reject' ||
                      scoringSchema?.type === 'fund_options' ||
                      scoringSchema?.type === 'custom') && (
                      <th className="text-left py-3 px-4 font-semibold text-gray-900 text-sm">Vote Distribution</th>
                    )}
                  </tr>
                </thead>
                <tbody>
                  {requestSummaries.map((summary) => (
                    <tr key={summary.id} className="border-b border-gray-200 hover:bg-gray-50">
                      <td className="py-3 px-4 text-sm font-medium text-gray-900">
                        {summary.applicant_name}
                      </td>
                      <td className="py-3 px-4 text-sm text-gray-600">
                        {summary.total_scores} score{summary.total_scores !== 1 ? 's' : ''}
                      </td>
                      {scoringSchema?.type === 'score_range' && (
                        <td className="py-3 px-4 text-sm text-gray-900">
                          {summary.average_score !== undefined
                            ? summary.average_score.toFixed(1)
                            : 'N/A'}
                        </td>
                      )}
                      {(scoringSchema?.type === 'approve_reject' ||
                        scoringSchema?.type === 'fund_options' ||
                        scoringSchema?.type === 'custom') && (
                        <td className="py-3 px-4 text-sm text-gray-600">
                          {summary.votes
                            ? Object.entries(summary.votes)
                              .map(([vote, count]) => {
                                const option = scoringSchema.options?.find((o: any) => o.value === vote);
                                return `${count} ${option?.label || vote}`;
                              })
                              .join(', ')
                            : 'N/A'}
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex gap-4">
            <button
              onClick={() => router.push(`/grants/applications/${applicationId}/results`)}
              className="btn-primary flex items-center gap-2"
            >
              <Eye className="w-4 h-4" />
              View Full Results
            </button>
            <button
              onClick={() => router.back()}
              className="btn-secondary"
            >
              Back
            </button>
          </div>
        </div>
      </div>
    </AppLayout>
  );
}

import React from 'react';
