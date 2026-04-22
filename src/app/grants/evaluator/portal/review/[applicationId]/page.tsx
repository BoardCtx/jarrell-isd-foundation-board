'use client';

import { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { createClient } from '@/lib/supabase';
import { cn } from '@/lib/utils';
import { Check, AlertCircle, ArrowLeft } from 'lucide-react';

interface FormField {
  id: string;
  type: string;
  label: string;
  required: boolean;
  placeholder?: string;
  helpText?: string;
  options?: { label: string; value: string }[];
}

interface FormSection {
  id: string;
  title: string;
  description?: string;
  fields: FormField[];
}

interface ScoringOption {
  value: string;
  label: string;
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

export default function EvaluatorReviewPage() {
  const router = useRouter();
  const params = useParams();
  const applicationId = params.applicationId as string;
  const supabase = createClient();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState('');

  const [userId, setUserId] = useState('');
  const [appTitle, setAppTitle] = useState('');
  const [currentRequestIdx, setCurrentRequestIdx] = useState(0);
  const [requests, setRequests] = useState<(GrantRequest & { applicant?: GrantApplicant })[]>([]);
  const [formSchema, setFormSchema] = useState<{ sections: FormSection[] }>({ sections: [] });
  const [scoringSchema, setScoringSchema] = useState<ScoringSchema | null>(null);
  const [scoreData, setScoreData] = useState<Record<string, any>>({});
  const [notes, setNotes] = useState('');
  const [scoredRequestIds, setScoredRequestIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    if (requests.length > 0 && userId) {
      loadScoreForCurrentRequest();
    }
  }, [currentRequestIdx, requests, userId]);

  const loadData = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { router.push('/grants/evaluator/login'); return; }
      setUserId(user.id);

      // Verify this evaluator is assigned to this application
      const { data: assignment } = await supabase
        .from('grant_evaluator_assignments')
        .select('id')
        .eq('application_id', applicationId)
        .eq('evaluator_id', user.id)
        .single();

      if (!assignment) {
        setError('You are not assigned to review this application.');
        setLoading(false);
        return;
      }

      // Load application
      const { data: app } = await supabase
        .from('grant_applications')
        .select('title, form_schema, scoring_schema')
        .eq('id', applicationId)
        .single();

      if (!app) { setError('Application not found'); setLoading(false); return; }

      setAppTitle(app.title);
      setFormSchema(app.form_schema as any);
      setScoringSchema(app.scoring_schema as any);

      // Load submitted requests
      const { data: requestsData } = await supabase
        .from('grant_requests')
        .select('id, applicant_id, form_data, status')
        .eq('application_id', applicationId)
        .in('status', ['submitted', 'under_review', 'approved', 'rejected', 'partial_funding', 'awarded']);

      // Load applicant info for each request
      const requestsWithApplicants = await Promise.all(
        (requestsData || []).map(async (req) => {
          const { data: applicant } = await supabase
            .from('grant_applicants')
            .select('full_name, email, organization')
            .eq('id', req.applicant_id)
            .single();
          return { ...req, applicant: applicant || undefined };
        })
      );

      // Load all scores by this evaluator to know which are scored
      const { data: existingScores } = await supabase
        .from('grant_scores')
        .select('request_id')
        .eq('application_id', applicationId)
        .eq('scorer_id', user.id);

      setScoredRequestIds(new Set((existingScores || []).map(s => s.request_id)));
      setRequests(requestsWithApplicants);
      setLoading(false);
    } catch (err) {
      console.error('Error loading data:', err);
      setError('Failed to load application data');
      setLoading(false);
    }
  };

  const loadScoreForCurrentRequest = async () => {
    if (requests.length === 0 || !userId) return;
    const request = requests[currentRequestIdx];

    const { data: score } = await supabase
      .from('grant_scores')
      .select('score_data, notes')
      .eq('request_id', request.id)
      .eq('scorer_id', userId)
      .single();

    if (score) {
      setScoreData(score.score_data as any || {});
      setNotes(score.notes || '');
    } else {
      setScoreData({});
      setNotes('');
    }
  };

  const handleSave = async () => {
    try {
      setSaving(true);
      setSuccessMessage('');
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
            scorer_type: 'external',
            updated_at: new Date().toISOString(),
          },
          { onConflict: 'request_id,scorer_id' }
        );

      if (upsertError) throw upsertError;

      setScoredRequestIds(prev => new Set([...prev, request.id]));
      setSuccessMessage('Score saved!');
      setSaving(false);
      setTimeout(() => setSuccessMessage(''), 2000);
    } catch (err) {
      console.error('Error saving score:', err);
      setError('Failed to save score');
      setSaving(false);
    }
  };

  const handleSaveAndNext = async () => {
    await handleSave();
    if (currentRequestIdx < requests.length - 1) {
      setCurrentRequestIdx(currentRequestIdx + 1);
    }
  };

  const renderFormValue = (field: FormField, value: any): string => {
    if (value === null || value === undefined) return '\u2014';
    if (Array.isArray(value)) return value.join(', ');
    if (typeof value === 'object') return JSON.stringify(value);
    return String(value);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-gray-500">Loading review...</div>
      </div>
    );
  }

  if (error && (error.includes('not assigned') || error.includes('not found'))) {
    return (
      <div className="text-center py-16">
        <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
        <h1 className="text-xl font-bold text-gray-900 mb-2">Access Denied</h1>
        <p className="text-gray-600 mb-4">{error}</p>
        <button onClick={() => router.push('/grants/evaluator/portal')} className="btn-primary">
          Back to Portal
        </button>
      </div>
    );
  }

  if (requests.length === 0) {
    return (
      <div className="text-center py-16">
        <AlertCircle className="w-12 h-12 text-gray-300 mx-auto mb-4" />
        <h1 className="text-xl font-bold text-gray-900 mb-2">No Requests</h1>
        <p className="text-gray-600 mb-4">There are no requests to review for this application.</p>
        <button onClick={() => router.push('/grants/evaluator/portal')} className="btn-primary">
          Back to Portal
        </button>
      </div>
    );
  }

  const currentRequest = requests[currentRequestIdx];
  const scoredCount = scoredRequestIds.size;
  const progress = requests.length > 0 ? Math.round((scoredCount / requests.length) * 100) : 0;

  return (
    <div>
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <button
          onClick={() => router.push('/grants/evaluator/portal')}
          className="p-2 hover:bg-gray-100 rounded-lg transition"
        >
          <ArrowLeft className="w-5 h-5 text-gray-600" />
        </button>
        <div>
          <h1 className="text-xl font-bold text-gray-900">{appTitle}</h1>
          <p className="text-sm text-gray-500">{scoredCount} of {requests.length} scored</p>
        </div>
      </div>

      <div className="flex gap-6" style={{ minHeight: 'calc(100vh - 250px)' }}>
        {/* Left: Request List */}
        <div className="w-72 flex-shrink-0">
          <div className="card p-0 sticky top-32 overflow-hidden">
            {/* Progress */}
            <div className="p-4 border-b border-gray-200">
              <div className="w-full bg-gray-100 rounded-full h-2">
                <div
                  className={`h-2 rounded-full transition-all ${progress === 100 ? 'bg-green-500' : 'bg-emerald-500'}`}
                  style={{ width: `${progress}%` }}
                />
              </div>
            </div>

            {/* Request buttons */}
            <div className="p-2 max-h-[60vh] overflow-y-auto">
              {requests.map((req, idx) => (
                <button
                  key={req.id}
                  onClick={() => setCurrentRequestIdx(idx)}
                  className={cn(
                    'w-full text-left p-3 rounded-lg mb-1 transition-all text-sm',
                    idx === currentRequestIdx
                      ? 'bg-emerald-600 text-white'
                      : 'hover:bg-gray-50 text-gray-900'
                  )}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex-1 min-w-0">
                      <p className="font-medium truncate">{req.applicant?.full_name || 'Unknown'}</p>
                      {req.applicant?.organization && (
                        <p className={cn('text-xs truncate', idx === currentRequestIdx ? 'text-emerald-100' : 'text-gray-500')}>
                          {req.applicant.organization}
                        </p>
                      )}
                    </div>
                    {scoredRequestIds.has(req.id) && (
                      <Check className={cn('w-4 h-4 flex-shrink-0 ml-2', idx === currentRequestIdx ? 'text-white' : 'text-green-500')} />
                    )}
                  </div>
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Right: Review Content */}
        <div className="flex-1 min-w-0">
          {/* Applicant Info */}
          <div className="card mb-6">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-lg font-semibold text-gray-900">{currentRequest.applicant?.full_name}</h2>
                {currentRequest.applicant?.organization && (
                  <p className="text-gray-600">{currentRequest.applicant.organization}</p>
                )}
                {currentRequest.applicant?.email && (
                  <p className="text-sm text-gray-500 mt-1">{currentRequest.applicant.email}</p>
                )}
              </div>
              <span className="text-sm text-gray-500">
                Request {currentRequestIdx + 1} of {requests.length}
              </span>
            </div>
          </div>

          {/* Form Responses */}
          <div className="mb-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Application Responses</h3>
            <div className="space-y-4">
              {formSchema.sections?.map((section) => (
                <div key={section.id} className="card">
                  <h4 className="font-semibold text-gray-900 mb-3">{section.title}</h4>
                  {section.description && <p className="text-sm text-gray-600 mb-3">{section.description}</p>}
                  <div className="space-y-3">
                    {section.fields?.map((field) => {
                      const value = currentRequest.form_data?.[field.id];
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
            <div className="mb-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Your Evaluation</h3>
              <div className="card">
                {/* Options-based scoring */}
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
                            ? 'border-emerald-500 bg-emerald-50'
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

                {/* Score range */}
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
                            <label className="font-medium text-gray-900 text-sm">{criterion.label}</label>
                            <span className="text-sm font-semibold text-emerald-600">
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
                      <div className="p-3 bg-emerald-50 rounded-lg border border-emerald-200">
                        <p className="text-xs text-emerald-800 font-medium">Weighted Total</p>
                        <p className="text-lg font-bold text-emerald-900">
                          {(
                            scoringSchema.criteria.reduce((total, c) => {
                              const s = scoreData.criteria?.[c.id] ?? 0;
                              return total + (s * c.weight) / 100;
                            }, 0)
                          ).toFixed(1)}
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
                    placeholder="Any additional comments..."
                    className="input h-24"
                  />
                </div>
              </div>
            </div>
          )}

          {/* Messages */}
          {error && !error.includes('not assigned') && (
            <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg flex gap-3">
              <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0" />
              <p className="text-red-800 text-sm">{error}</p>
            </div>
          )}

          {successMessage && (
            <div className="mb-4 p-3 bg-green-50 border border-green-200 rounded-lg text-green-700 text-sm font-medium text-center">
              {successMessage}
            </div>
          )}

          {/* Actions */}
          <div className="flex gap-4">
            <button onClick={handleSave} disabled={saving} className="btn-secondary">
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
  );
}
