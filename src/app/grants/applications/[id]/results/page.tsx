'use client';

import { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import AppLayout from '@/components/layout/AppLayout';
import { createClient } from '@/lib/supabase';
import { formatCurrency } from '@/lib/utils';
import { AlertCircle, ChevronDown, ChevronUp, Save, Mail } from 'lucide-react';

interface GrantRequest {
  id: string;
  applicant_id: string;
  form_data: Record<string, any>;
  status: string;
  awarded_amount?: number;
  decision_visible: boolean;
}

interface GrantApplicant {
  id: string;
  full_name: string;
  email: string;
  organization?: string;
}

interface GrantScore {
  scorer_id: string;
  score_data: Record<string, any>;
  notes?: string;
  profile?: { full_name: string };
}

interface RequestResult {
  request: GrantRequest;
  applicant: GrantApplicant;
  scores: GrantScore[];
  decision: 'approved' | 'rejected' | 'partial_funding' | null;
  awardAmount: number | null;
  decisionVisible: boolean;
  expanded: boolean;
  scoresExpanded: boolean;
  notesExpanded: boolean;
}

export default function ResultsPage() {
  const router = useRouter();
  const params = useParams();
  const applicationId = params.id as string;
  const supabase = createClient();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [notifying, setNotifying] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);

  const [results, setResults] = useState<RequestResult[]>([]);
  const [scoringSchema, setScoringSchema] = useState<any>(null);
  const [applicantMap, setApplicantMap] = useState<Record<string, GrantApplicant>>({});

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

      // Check permission
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
        setError('You do not have permission to view results');
        setLoading(false);
        return;
      }

      setIsAdmin(true);

      // Load application
      const { data: app, error: appError } = await supabase
        .from('grant_applications')
        .select('scoring_schema')
        .eq('id', applicationId)
        .single();

      if (appError) throw appError;
      setScoringSchema(app.scoring_schema);

      // Load all requests
      const { data: requests, error: requestsError } = await supabase
        .from('grant_requests')
        .select('id, applicant_id, form_data, status, awarded_amount, decision_visible')
        .eq('application_id', applicationId)
        .eq('status', 'submitted');

      if (requestsError) throw requestsError;

      // Load all applicants
      const applicantIds = (requests || []).map(r => r.applicant_id);
      const { data: applicants } = await supabase
        .from('grant_applicants')
        .select('id, full_name, email, organization')
        .in('id', applicantIds);

      const applicantMapData: Record<string, GrantApplicant> = {};
      (applicants || []).forEach(a => {
        applicantMapData[a.id] = a;
      });
      setApplicantMap(applicantMapData);

      // Load scores for all requests
      const { data: scores } = await supabase
        .from('grant_scores')
        .select('request_id, scorer_id, score_data, notes')
        .eq('application_id', applicationId);

      const scoresByRequest: Record<string, GrantScore[]> = {};
      (scores || []).forEach(score => {
        if (!scoresByRequest[score.request_id]) {
          scoresByRequest[score.request_id] = [];
        }
        scoresByRequest[score.request_id].push(score);
      });

      // Load scorer names
      const scorerIds = (scores || []).map(s => s.scorer_id);
      const { data: scorerProfiles } = await supabase
        .from('profiles')
        .select('id, full_name')
        .in('id', scorerIds);

      const scorerMap: Record<string, string> = {};
      (scorerProfiles || []).forEach(p => {
        scorerMap[p.id] = p.full_name;
      });

      // Build results
      const resultsList: RequestResult[] = (requests || []).map(req => {
        const reqScores = scoresByRequest[req.id] || [];
        reqScores.forEach(s => {
          if (!s.profile && scorerMap[s.scorer_id]) {
            s.profile = { full_name: scorerMap[s.scorer_id] };
          }
        });

        return {
          request: req,
          applicant: applicantMapData[req.applicant_id],
          scores: reqScores,
          decision: null,
          awardAmount: req.awarded_amount || null,
          decisionVisible: req.decision_visible || false,
          expanded: false,
          scoresExpanded: false,
          notesExpanded: false,
        };
      });

      setResults(resultsList);
      setLoading(false);
    } catch (err) {
      console.error('Error loading results:', err);
      setError(err instanceof Error ? err.message : 'Failed to load results');
      setLoading(false);
    }
  };

  const toggleExpanded = (requestId: string, field: 'expanded' | 'scoresExpanded' | 'notesExpanded') => {
    setResults(results.map(r =>
      r.request.id === requestId
        ? { ...r, [field]: !r[field] }
        : r
    ));
  };

  const updateDecision = (requestId: string, decision: 'approved' | 'rejected' | 'partial_funding') => {
    setResults(results.map(r =>
      r.request.id === requestId
        ? { ...r, decision }
        : r
    ));
  };

  const updateAwardAmount = (requestId: string, amount: number | null) => {
    setResults(results.map(r =>
      r.request.id === requestId
        ? { ...r, awardAmount: amount }
        : r
    ));
  };

  const updateDecisionVisible = (requestId: string, visible: boolean) => {
    setResults(results.map(r =>
      r.request.id === requestId
        ? { ...r, decisionVisible: visible }
        : r
    ));
  };

  const handleSaveDecisions = async () => {
    try {
      setSaving(true);
      setError(null);

      // Validate decisions
      const hasDecisions = results.some(r => r.decision);
      if (!hasDecisions) {
        setError('Please make at least one decision before saving');
        setSaving(false);
        return;
      }

      // Batch update all requests
      const updates = results
        .filter(r => r.decision)
        .map(r => ({
          id: r.request.id,
          status: r.decision === 'approved' ? 'approved' : r.decision === 'rejected' ? 'rejected' : 'partial_funding',
          decision_visible: r.decisionVisible,
          awarded_amount: (r.decision === 'approved' || r.decision === 'partial_funding') ? r.awardAmount : null,
          decided_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        }));

      for (const update of updates) {
        const { error: updateError } = await supabase
          .from('grant_requests')
          .update(update)
          .eq('id', update.id);

        if (updateError) throw updateError;
      }

      setSaving(false);
      alert('Decisions saved successfully');
    } catch (err) {
      console.error('Error saving decisions:', err);
      setError(err instanceof Error ? err.message : 'Failed to save decisions');
      setSaving(false);
    }
  };

  const handleNotifyApplicants = async () => {
    try {
      setNotifying(true);
      setError(null);

      const visibleResults = results.filter(r => r.decisionVisible && r.decision);
      if (visibleResults.length === 0) {
        setError('No visible decisions to notify about');
        setNotifying(false);
        return;
      }

      const response = await fetch('/api/grants/notify-applicants', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          applicationId,
          requestIds: visibleResults.map(r => r.request.id),
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to notify applicants');
      }

      setNotifying(false);
      alert('Applicants notified successfully');
    } catch (err) {
      console.error('Error notifying applicants:', err);
      setError(err instanceof Error ? err.message : 'Failed to notify applicants');
      setNotifying(false);
    }
  };

  const getConsensus = (result: RequestResult): string => {
    if (!result.scores || result.scores.length === 0) return 'No scores';

    if (scoringSchema?.type === 'score_range') {
      const scores = result.scores
        .map(s => {
          const criteria = s.score_data.criteria || {};
          return scoringSchema.criteria.reduce((total: number, c: any) => {
            return total + ((criteria[c.id] || 0) * c.weight) / 100;
          }, 0);
        })
        .filter((s: number) => !isNaN(s));

      if (scores.length === 0) return 'No valid scores';
      const avg = scores.reduce((a, b) => a + b, 0) / scores.length;
      return `Average: ${avg.toFixed(1)}`;
    } else {
      const votes: Record<string, number> = {};
      result.scores.forEach(s => {
        const option = s.score_data.option;
        if (option) {
          votes[option] = (votes[option] || 0) + 1;
        }
      });

      return Object.entries(votes)
        .map(([vote, count]) => {
          const option = scoringSchema?.options?.find((o: any) => o.value === vote);
          return `${count} ${option?.label || vote}`;
        })
        .join(', ');
    }
  };

  if (loading) {
    return (
      <AppLayout>
        <div className="p-8 flex items-center justify-center h-full">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
            <p className="text-gray-600">Loading results...</p>
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
      <div className="p-8 max-w-4xl">
        <div className="mb-8">
          <button
            onClick={() => router.back()}
            className="text-primary hover:text-primary-dark mb-4 text-sm"
          >
            ← Back
          </button>
          <h1 className="page-header mb-2">Grant Results</h1>
          <p className="text-gray-600">Review and finalize grant award decisions</p>
        </div>

        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg flex gap-3">
            <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
            <p className="text-red-800 text-sm">{error}</p>
          </div>
        )}

        <div className="space-y-4">
          {results.map((result) => (
            <div key={result.request.id} className="card">
              {/* Header */}
              <button
                onClick={() => toggleExpanded(result.request.id, 'expanded')}
                className="w-full text-left flex items-center justify-between hover:bg-gray-50 p-4 -m-4 rounded"
              >
                <div className="flex-1">
                  <h3 className="font-semibold text-lg text-gray-900">
                    {result.applicant?.full_name || 'Unknown'}
                  </h3>
                  {result.applicant?.organization && (
                    <p className="text-sm text-gray-500">{result.applicant.organization}</p>
                  )}
                </div>
                <div className="flex items-center gap-4">
                  <div className="text-right text-sm">
                    <p className="text-gray-600">{result.scores.length} scores</p>
                    <p className="text-gray-900 font-medium">{getConsensus(result)}</p>
                  </div>
                  {result.expanded ? (
                    <ChevronUp className="w-5 h-5 text-gray-400" />
                  ) : (
                    <ChevronDown className="w-5 h-5 text-gray-400" />
                  )}
                </div>
              </button>

              {result.expanded && (
                <div className="border-t border-gray-200 pt-4 mt-4 space-y-4">
                  {/* Committee Consensus */}
                  <div>
                    <label className="label">Committee Consensus</label>
                    <div className="bg-gray-50 p-3 rounded border border-gray-200 text-sm text-gray-700">
                      {getConsensus(result)}
                    </div>
                  </div>

                  {/* Scores Breakdown */}
                  {result.scores.length > 0 && (
                    <div>
                      <button
                        onClick={() => toggleExpanded(result.request.id, 'scoresExpanded')}
                        className="flex items-center gap-2 text-sm font-medium text-gray-900 hover:text-primary"
                      >
                        {result.scoresExpanded ? (
                          <ChevronUp className="w-4 h-4" />
                        ) : (
                          <ChevronDown className="w-4 h-4" />
                        )}
                        Show Individual Scores
                      </button>
                      {result.scoresExpanded && (
                        <div className="mt-3 space-y-2 pl-6">
                          {result.scores.map((score, idx) => (
                            <div key={idx} className="text-sm text-gray-600">
                              <p className="font-medium">{score.profile?.full_name || 'Unknown'}</p>
                              {scoringSchema?.type === 'score_range' ? (
                                <p className="text-gray-600">
                                  Score: {
                                    scoringSchema.criteria.reduce((total: number, c: any) => {
                                      return total + ((score.score_data.criteria?.[c.id] || 0) * c.weight) / 100;
                                    }, 0).toFixed(1)
                                  }
                                </p>
                              ) : (
                                <p className="text-gray-600">
                                  Vote: {
                                    scoringSchema?.options?.find((o: any) => o.value === score.score_data.option)?.label || score.score_data.option
                                  }
                                </p>
                              )}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}

                  {/* Committee Notes */}
                  {result.scores.some(s => s.notes) && (
                    <div>
                      <button
                        onClick={() => toggleExpanded(result.request.id, 'notesExpanded')}
                        className="flex items-center gap-2 text-sm font-medium text-gray-900 hover:text-primary"
                      >
                        {result.notesExpanded ? (
                          <ChevronUp className="w-4 h-4" />
                        ) : (
                          <ChevronDown className="w-4 h-4" />
                        )}
                        Committee Notes
                      </button>
                      {result.notesExpanded && (
                        <div className="mt-3 space-y-2 pl-6">
                          {result.scores.filter(s => s.notes).map((score, idx) => (
                            <div key={idx} className="text-sm bg-gray-50 p-2 rounded border border-gray-200">
                              <p className="font-medium text-gray-900">{score.profile?.full_name}</p>
                              <p className="text-gray-700">{score.notes}</p>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}

                  {/* Decision Section */}
                  <div className="border-t border-gray-200 pt-4 space-y-4">
                    <div>
                      <label className="label">Decision</label>
                      <select
                        value={result.decision || ''}
                        onChange={(e) => updateDecision(result.request.id, e.target.value as any)}
                        className="input"
                      >
                        <option value="">— Select decision —</option>
                        <option value="approved">Approved</option>
                        <option value="rejected">Rejected</option>
                        <option value="partial_funding">Partial Funding</option>
                      </select>
                    </div>

                    {(result.decision === 'approved' || result.decision === 'partial_funding') && (
                      <div>
                        <label className="label">Award Amount</label>
                        <input
                          type="number"
                          step="0.01"
                          min="0"
                          value={result.awardAmount || ''}
                          onChange={(e) => updateAwardAmount(result.request.id, e.target.value ? parseFloat(e.target.value) : null)}
                          className="input"
                          placeholder="0.00"
                        />
                        {result.awardAmount && (
                          <p className="text-sm text-gray-600 mt-1">{formatCurrency(result.awardAmount)}</p>
                        )}
                      </div>
                    )}

                    <label className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={result.decisionVisible}
                        onChange={(e) => updateDecisionVisible(result.request.id, e.target.checked)}
                        className="w-4 h-4"
                      />
                      <span className="text-sm font-medium text-gray-900">
                        Decision visible to applicant
                      </span>
                    </label>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>

        {/* Action Buttons */}
        <div className="mt-8 flex gap-4">
          <button
            onClick={handleSaveDecisions}
            disabled={saving}
            className="btn-primary flex items-center gap-2"
          >
            <Save className="w-4 h-4" />
            {saving ? 'Saving...' : 'Save All Decisions'}
          </button>
          <button
            onClick={handleNotifyApplicants}
            disabled={notifying || !results.some(r => r.decisionVisible && r.decision)}
            className="btn-secondary flex items-center gap-2"
          >
            <Mail className="w-4 h-4" />
            {notifying ? 'Notifying...' : 'Notify Applicants'}
          </button>
          <button
            onClick={() => router.back()}
            className="btn-secondary"
          >
            Cancel
          </button>
        </div>
      </div>
    </AppLayout>
  );
}
