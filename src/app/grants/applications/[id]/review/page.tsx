'use client';

import { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import AppLayout from '@/components/layout/AppLayout';
import { createClient } from '@/lib/supabase';
import { cn } from '@/lib/utils';
import { Check, AlertCircle, ChevronDown, ChevronUp } from 'lucide-react';

interface FormField {
  id: string;
  type: string;
  label: string;
  required: boolean;
  placeholder?: string;
  helpText?: string;
  options?: { label: string; value: string }[];
  maxLength?: number;
}

interface FormSection {
  id: string;
  title: string;
  description?: string;
  fields: FormField[];
}

interface FormSchema {
  sections: FormSection[];
}

interface ScoringOption {
  value: string;
  label: string;
  color?: string;
}

interface ScoringCriterion {
  id: string;
  label: string;
  weight: number;
  description?: string;
}

interface ScoringSchema {
  type: 'approve_reject' | 'fund_options' | 'score_range' | 'custom';
  options?: ScoringOption[];
  min?: number;
  max?: number;
  criteria?: ScoringCriterion[];
}

interface GrantRequest {
  id: string;
  applicant_id: string;
  form_data: Record<string, any>;
  status: string;
}

interface GrantApplicant {
  full_name: string;
  email: string;
  organization?: string;
}

interface GrantScore {
  score_data: Record<string, any>;
  notes?: string;
}

export default function ReviewPage() {
  const router = useRouter();
  const params = useParams();
  const applicationId = params.id as string;
  const supabase = createClient();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [userId, setUserId] = useState<string>('');
  const [currentRequestIdx, setCurrentRequestIdx] = useState(0);
  const [requests, setRequests] = useState<(GrantRequest & { applicant?: GrantApplicant })[]>([]);
  const [formSchema, setFormSchema] = useState<FormSchema>({ sections: [] });
  const [scoringSchema, setScoringSchema] = useState<ScoringSchema | null>(null);

  const [scoreData, setScoreData] = useState<Record<string, any>>({});
  const [notes, setNotes] = useState('');

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    loadScoreForCurrentRequest();
  }, [currentRequestIdx]);

  const loadData = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        router.push('/login');
        return;
      }

      setUserId(user.id);

      // Check permission - must be Grant Committee
      const { data: profile } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', user.id)
        .single();

      const { data: committeeGroups } = await supabase
        .from('groups')
        .select('id')
        .eq('name', 'Grant Committee');

      let isCommittee = false;
      if (committeeGroups?.[0]) {
        const { data: membership } = await supabase
          .from('group_members')
          .select('id')
          .eq('group_id', committeeGroups[0].id)
          .eq('profile_id', user.id)
          .single();
        isCommittee = !!membership;
      }

      if (!isCommittee && profile?.role !== 'admin' && profile?.role !== 'president') {
        setError('You do not have permission to review applications');
        setLoading(false);
        return;
      }

      // Load application
      const { data: app, error: appError } = await supabase
        .from('grant_applications')
        .select('form_schema, scoring_schema')
        .eq('id', applicationId)
        .single();

      if (appError) throw appError;

      setFormSchema(app.form_schema);
      setScoringSchema(app.scoring_schema);

      // Load requests
      const { data: requestsData, error: requestsError } = await supabase
        .from('grant_requests')
        .select('id, applicant_id, form_data, status')
        .eq('application_id', applicationId)
        .eq('status', 'submitted');

      if (requestsError) throw requestsError;

      // Load applicant info for each request
      const requestsWithApplicants = await Promise.all(
        (requestsData || []).map(async (req) => {
          const { data: applicant } = await supabase
            .from('grant_applicants')
            .select('full_name, email, organization')
            .eq('id', req.applicant_id)
            .single();

          return { ...req, applicant };
        })
      );

      setRequests(requestsWithApplicants);
      setLoading(false);
    } catch (err) {
      console.error('Error loading data:', err);
      setError(err instanceof Error ? err.message : 'Failed to load application');
      setLoading(false);
    }
  };

  const loadScoreForCurrentRequest = async () => {
    if (requests.length === 0) return;

    try {
      const request = requests[currentRequestIdx];

      // Load existing score
      const { data: score } = await supabase
        .from('grant_scores')
        .select('score_data, notes')
        .eq('request_id', request.id)
        .eq('scorer_id', userId)
        .single();

      if (score) {
        setScoreData(score.score_data);
        setNotes(score.notes || '');
      } else {
        setScoreData({});
        setNotes('');
      }
    } catch (err) {
      console.error('Error loading score:', err);
      setScoreData({});
      setNotes('');
    }
  };

  const handleSave = async () => {
    try {
      setSaving(true);
      const request = requests[currentRequestIdx];

      const { error: upsertError } = await supabase
        .from('grant_scores')
        .upsert(
          {
            request_id: request.id,
            application_id: applicationId,
            scorer_id: userId,
            score_data: scoreData,
            notes: notes || null,
            updated_at: new Date().toISOString(),
          },
          {
            onConflict: 'request_id,scorer_id',
          }
        );

      if (upsertError) throw upsertError;

      setSaving(false);
    } catch (err) {
      console.error('Error saving score:', err);
      setError(err instanceof Error ? err.message : 'Failed to save score');
      setSaving(false);
    }
  };

  const handleSaveAndNext = async () => {
    await handleSave();
    if (currentRequestIdx < requests.length - 1) {
      setCurrentRequestIdx(currentRequestIdx + 1);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowUp' && currentRequestIdx > 0) {
      setCurrentRequestIdx(currentRequestIdx - 1);
    } else if (e.key === 'ArrowDown' && currentRequestIdx < requests.length - 1) {
      setCurrentRequestIdx(currentRequestIdx + 1);
    }
  };

  const getFormFieldValue = (section: FormSection, field: FormField) => {
    const current = requests[currentRequestIdx];
    return current?.form_data?.[field.id];
  };

  const renderFormValue = (field: FormField, value: any): string => {
    if (value === null || value === undefined) return '—';
    if (Array.isArray(value)) return value.join(', ');
    if (typeof value === 'object') return JSON.stringify(value);
    return String(value);
  };

  const isRequestScored = (requestId: string) => {
    // This is a simple check - in real app would need to load actual scores
    return false;
  };

  const countScored = () => {
    return requests.filter(r => isRequestScored(r.id)).length;
  };

  if (loading) {
    return (
      <AppLayout>
        <div className="p-8 flex items-center justify-center h-full">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
            <p className="text-gray-600">Loading requests...</p>
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

  if (requests.length === 0) {
    return (
      <AppLayout>
        <div className="p-8">
          <div className="text-center">
            <AlertCircle className="w-12 h-12 text-gray-300 mx-auto mb-4" />
            <h1 className="page-header">No Requests</h1>
            <p className="text-gray-600 mt-2">There are no requests to review for this application</p>
            <button onClick={() => router.push('/grants')} className="btn-primary mt-4">
              Back to Grants
            </button>
          </div>
        </div>
      </AppLayout>
    );
  }

  const currentRequest = requests[currentRequestIdx];

  return (
    <AppLayout>
      <div className="flex h-screen bg-gray-50" onKeyDown={handleKeyDown} tabIndex={0}>
        {/* Left Sidebar */}
        <div className="w-1/3 border-r border-gray-200 bg-white overflow-y-auto">
          <div className="p-4 border-b border-gray-200 sticky top-0 bg-white">
            <p className="text-sm text-gray-600 font-medium">
              {countScored()} of {requests.length} scored
            </p>
            <div className="w-full bg-gray-200 rounded-full h-2 mt-2">
              <div
                className="bg-primary h-2 rounded-full transition-all"
                style={{ width: `${(countScored() / requests.length) * 100}%` }}
              />
            </div>
          </div>

          <div className="p-2">
            {requests.map((request, idx) => (
              <button
                key={request.id}
                onClick={() => setCurrentRequestIdx(idx)}
                className={cn(
                  'w-full text-left p-3 rounded-lg mb-2 transition-all',
                  idx === currentRequestIdx
                    ? 'bg-primary text-white'
                    : 'hover:bg-gray-50 text-gray-900'
                )}
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <p className="font-medium text-sm">
                      {request.applicant?.full_name || 'Unknown'}
                    </p>
                    {request.applicant?.organization && (
                      <p className="text-xs opacity-75">
                        {request.applicant.organization}
                      </p>
                    )}
                  </div>
                  {isRequestScored(request.id) && (
                    <Check className="w-4 h-4 mt-1" />
                  )}
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* Main Content */}
        <div className="flex-1 overflow-y-auto">
          <div className="p-8 max-w-3xl">
            {/* Applicant Info */}
            <div className="mb-8">
              <div className="card">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h1 className="page-header mb-1">{currentRequest.applicant?.full_name}</h1>
                    {currentRequest.applicant?.organization && (
                      <p className="text-gray-600">{currentRequest.applicant.organization}</p>
                    )}
                  </div>
                  <div className="text-right">
                    <p className="text-sm text-gray-500">Request {currentRequestIdx + 1} of {requests.length}</p>
                  </div>
                </div>
                {currentRequest.applicant?.email && (
                  <p className="text-sm text-gray-600">
                    {currentRequest.applicant.email}
                  </p>
                )}
              </div>
            </div>

            {/* Form Responses */}
            <div className="mb-8">
              <h2 className="text-lg font-semibold mb-4 text-gray-900">Application Responses</h2>
              <div className="space-y-6">
                {formSchema.sections?.map((section) => (
                  <div key={section.id} className="card">
                    <h3 className="font-semibold text-gray-900 mb-4">{section.title}</h3>
                    {section.description && (
                      <p className="text-sm text-gray-600 mb-4">{section.description}</p>
                    )}
                    <div className="space-y-4">
                      {section.fields?.map((field) => {
                        const value = getFormFieldValue(section, field);
                        return (
                          <div key={field.id}>
                            <label className="label">{field.label}</label>
                            <div className="bg-gray-50 p-3 rounded border border-gray-200 text-sm text-gray-700">
                              {renderFormValue(field, value)}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Scoring Panel */}
            {scoringSchema && (
              <div className="mb-8">
                <h2 className="text-lg font-semibold mb-4 text-gray-900">Your Evaluation</h2>
                <div className="card">
                  {(scoringSchema.type === 'approve_reject' ||
                    scoringSchema.type === 'fund_options' ||
                    scoringSchema.type === 'custom') && (
                    <div className="space-y-3">
                      <p className="text-sm text-gray-600 mb-4">Select one option:</p>
                      {scoringSchema.options?.map((option) => (
                        <label
                          key={option.value}
                          className={cn(
                            'flex items-center gap-3 p-3 border-2 rounded-lg cursor-pointer transition-all',
                            scoreData.option === option.value
                              ? 'border-primary bg-primary bg-opacity-5'
                              : 'border-gray-200 hover:border-gray-300'
                          )}
                        >
                          <input
                            type="radio"
                            name="score-option"
                            value={option.value}
                            checked={scoreData.option === option.value}
                            onChange={(e) => setScoreData({ ...scoreData, option: e.target.value })}
                            className="w-4 h-4"
                          />
                          <span className="text-sm font-medium">{option.label}</span>
                        </label>
                      ))}
                    </div>
                  )}

                  {scoringSchema.type === 'score_range' && (
                    <div className="space-y-6">
                      <p className="text-sm text-gray-600">
                        Score each criterion from {scoringSchema.min ?? 0} to {scoringSchema.max ?? 100}
                      </p>
                      {scoringSchema.criteria?.map((criterion) => {
                        const score = scoreData.criteria?.[criterion.id] ?? 0;
                        return (
                          <div key={criterion.id}>
                            <div className="flex justify-between items-center mb-2">
                              <label className="font-medium text-gray-900 text-sm">
                                {criterion.label}
                              </label>
                              <span className="text-sm font-semibold text-primary">
                                {score} / {scoringSchema.max ?? 100}
                              </span>
                            </div>
                            {criterion.description && (
                              <p className="text-xs text-gray-500 mb-2">{criterion.description}</p>
                            )}
                            <input
                              type="range"
                              min={scoringSchema.min ?? 0}
                              max={scoringSchema.max ?? 100}
                              value={score}
                              onChange={(e) =>
                                setScoreData({
                                  ...scoreData,
                                  criteria: {
                                    ...scoreData.criteria,
                                    [criterion.id]: parseInt(e.target.value),
                                  },
                                })
                              }
                              className="w-full"
                            />
                            <div className="flex justify-between text-xs text-gray-500 mt-1">
                              <span>{scoringSchema.min ?? 0}</span>
                              <span>{scoringSchema.max ?? 100}</span>
                            </div>
                          </div>
                        );
                      })}
                      {scoringSchema.criteria && scoreData.criteria && (
                        <div className="p-3 bg-blue-50 rounded-lg border border-blue-200">
                          <p className="text-xs text-blue-800 font-medium">Weighted Total</p>
                          <p className="text-lg font-bold text-blue-900">
                            {scoringSchema.criteria.length > 0
                              ? (
                                  scoringSchema.criteria.reduce((total, c) => {
                                    const score = scoreData.criteria?.[c.id] ?? 0;
                                    return total + (score * c.weight) / 100;
                                  }, 0)
                                ).toFixed(1)
                              : '0'}
                          </p>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Notes */}
                  <div className="mt-6 pt-6 border-t border-gray-200">
                    <label className="label">Notes (Optional)</label>
                    <textarea
                      value={notes}
                      onChange={(e) => setNotes(e.target.value)}
                      placeholder="Any additional comments for the committee..."
                      className="input h-24"
                    />
                  </div>
                </div>
              </div>
            )}

            {error && (
              <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg flex gap-3">
                <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
                <p className="text-red-800 text-sm">{error}</p>
              </div>
            )}

            {/* Action Buttons */}
            <div className="flex gap-4">
              <button
                onClick={handleSave}
                disabled={saving}
                className="btn-secondary"
              >
                {saving ? 'Saving...' : 'Save Score'}
              </button>
              <button
                onClick={handleSaveAndNext}
                disabled={saving || currentRequestIdx >= requests.length - 1}
                className="btn-primary"
              >
                {saving ? 'Saving...' : 'Save & Next'}
              </button>
            </div>
          </div>
        </div>
      </div>
    </AppLayout>
  );
}
