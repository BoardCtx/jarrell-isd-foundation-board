'use client';

import { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import AppLayout from '@/components/layout/AppLayout';
import { createClient } from '@/lib/supabase';
import { cn } from '@/lib/utils';
import {
  ChevronDown,
  Copy,
  Plus,
  Trash2,
  Save,
  AlertCircle,
  Check,
  Sliders,
} from 'lucide-react';

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

interface GrantApplication {
  id: string;
  title: string;
  status: string;
}

const DEFAULT_SCHEMAS = {
  approve_reject: {
    type: 'approve_reject' as const,
    options: [
      { value: 'approve', label: 'Approve', color: 'bg-green-100 text-green-800' },
      { value: 'reject', label: 'Reject', color: 'bg-red-100 text-red-800' },
    ],
  },
  fund_options: {
    type: 'fund_options' as const,
    options: [
      { value: 'fund', label: 'Fund', color: 'bg-green-100 text-green-800' },
      { value: 'dont_fund', label: "Don't Fund", color: 'bg-red-100 text-red-800' },
      { value: 'partial', label: 'Partial Funding', color: 'bg-yellow-100 text-yellow-800' },
    ],
  },
  score_range: {
    type: 'score_range' as const,
    min: 0,
    max: 100,
    criteria: [] as ScoringCriterion[],
  },
};

export default function ScoringSetupPage() {
  const router = useRouter();
  const params = useParams();
  const applicationId = params.id as string;
  const supabase = createClient();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [application, setApplication] = useState<GrantApplication | null>(null);

  const [scoringType, setScoringType] = useState<ScoringSchema['type']>('approve_reject');
  const [scoringSchema, setScoringSchema] = useState<ScoringSchema>(DEFAULT_SCHEMAS.approve_reject);

  useEffect(() => {
    loadApplication();
  }, []);

  const loadApplication = async () => {
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
        setError('You do not have permission to configure scoring');
        setLoading(false);
        return;
      }

      // Load application
      const { data: app, error: appError } = await supabase
        .from('grant_applications')
        .select('id, title, status, scoring_schema')
        .eq('id', applicationId)
        .single();

      if (appError) throw appError;

      setApplication(app);

      // Load existing scoring schema if present
      if (app?.scoring_schema) {
        setScoringSchema(app.scoring_schema);
        setScoringType(app.scoring_schema.type);
      }

      setLoading(false);
    } catch (err) {
      console.error('Error loading application:', err);
      setError(err instanceof Error ? err.message : 'Failed to load application');
      setLoading(false);
    }
  };

  const handleScoringTypeChange = (type: ScoringSchema['type']) => {
    setScoringType(type);
    setScoringSchema(DEFAULT_SCHEMAS[type] || { type, options: [] });
  };

  const updateOption = (index: number, field: keyof ScoringOption, value: any) => {
    const options = scoringSchema.options ? [...scoringSchema.options] : [];
    if (!options[index]) options[index] = { value: '', label: '' };
    (options[index] as any)[field] = value;
    setScoringSchema({ ...scoringSchema, options });
  };

  const addOption = () => {
    const options = scoringSchema.options ? [...scoringSchema.options] : [];
    options.push({ value: `option_${Date.now()}`, label: '', color: 'bg-gray-100 text-gray-800' });
    setScoringSchema({ ...scoringSchema, options });
  };

  const removeOption = (index: number) => {
    const options = scoringSchema.options ? [...scoringSchema.options] : [];
    options.splice(index, 1);
    setScoringSchema({ ...scoringSchema, options });
  };

  const updateCriterion = (index: number, field: keyof ScoringCriterion, value: any) => {
    const criteria = scoringSchema.criteria ? [...scoringSchema.criteria] : [];
    if (!criteria[index]) criteria[index] = { id: `criterion_${Date.now()}`, label: '', weight: 0 };
    (criteria[index] as any)[field] = value;
    setScoringSchema({ ...scoringSchema, criteria });
  };

  const addCriterion = () => {
    const criteria = scoringSchema.criteria ? [...scoringSchema.criteria] : [];
    criteria.push({
      id: `criterion_${Date.now()}`,
      label: '',
      weight: 0,
      description: '',
    });
    setScoringSchema({ ...scoringSchema, criteria });
  };

  const removeCriterion = (index: number) => {
    const criteria = scoringSchema.criteria ? [...scoringSchema.criteria] : [];
    criteria.splice(index, 1);
    setScoringSchema({ ...scoringSchema, criteria });
  };

  const handleSave = async () => {
    try {
      setSaving(true);
      setError(null);

      // Validate scoring schema
      if (scoringSchema.type === 'score_range' && (!scoringSchema.criteria || scoringSchema.criteria.length === 0)) {
        setError('Score range scoring must have at least one criterion');
        setSaving(false);
        return;
      }

      // Update application with scoring schema
      const { error: updateError } = await supabase
        .from('grant_applications')
        .update({
          scoring_schema: scoringSchema,
          status: 'scoring',
          updated_at: new Date().toISOString(),
        })
        .eq('id', applicationId);

      if (updateError) throw updateError;

      // Notify committee members
      const response = await fetch('/api/grants/notify-committee', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ applicationId }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to notify committee');
      }

      router.push(`/grants/applications/${applicationId}`);
    } catch (err) {
      console.error('Error saving scoring schema:', err);
      setError(err instanceof Error ? err.message : 'Failed to save scoring schema');
    } finally {
      setSaving(false);
    }
  };

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

  if (!application) {
    return (
      <AppLayout>
        <div className="p-8">
          <div className="text-center">
            <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
            <h1 className="page-header text-red-900">Application Not Found</h1>
            <button onClick={() => router.push('/grants')} className="btn-primary mt-4">
              Back to Grants
            </button>
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
      <div className="p-8 max-w-5xl">
        <div className="mb-8">
          <button
            onClick={() => router.back()}
            className="text-primary hover:text-primary-dark mb-4 text-sm"
          >
            ← Back
          </button>
          <h1 className="page-header mb-2">{application.title}</h1>
          <p className="text-gray-600">Configure committee scoring criteria</p>
        </div>

        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg flex gap-3">
            <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
            <p className="text-red-800">{error}</p>
          </div>
        )}

        <div className="space-y-8">
          {/* Scoring Type Selection */}
          <div className="card">
            <h2 className="font-semibold text-lg mb-4">Scoring Method</h2>
            <div className="space-y-3">
              {(['approve_reject', 'fund_options', 'score_range', 'custom'] as const).map((type) => (
                <label key={type} className="flex items-center gap-3 p-3 rounded border border-gray-200 hover:bg-gray-50 cursor-pointer">
                  <input
                    type="radio"
                    name="scoring-type"
                    value={type}
                    checked={scoringType === type}
                    onChange={() => handleScoringTypeChange(type)}
                    className="w-4 h-4"
                  />
                  <div>
                    <div className="font-medium text-gray-900">
                      {type === 'approve_reject' && 'Approve/Reject'}
                      {type === 'fund_options' && 'Funding Options'}
                      {type === 'score_range' && 'Score Range (Weighted Criteria)'}
                      {type === 'custom' && 'Custom Options'}
                    </div>
                    <div className="text-sm text-gray-600">
                      {type === 'approve_reject' && 'Simple approval or rejection decision'}
                      {type === 'fund_options' && 'Fund, don\'t fund, or partial funding options'}
                      {type === 'score_range' && 'Score requests on multiple weighted criteria'}
                      {type === 'custom' && 'Define your own custom scoring options'}
                    </div>
                  </div>
                </label>
              ))}
            </div>
          </div>

          {/* Configuration for selected type */}
          {scoringType === 'approve_reject' && (
            <div className="card">
              <h2 className="font-semibold text-lg mb-4">Options</h2>
              <p className="text-sm text-gray-600 mb-4">Customize the approval/rejection labels</p>
              <div className="space-y-3">
                {scoringSchema.options?.map((option, idx) => (
                  <div key={idx} className="flex gap-3 items-end">
                    <div className="flex-1">
                      <label className="label">Option Label</label>
                      <input
                        type="text"
                        className="input"
                        value={option.label}
                        onChange={(e) => updateOption(idx, 'label', e.target.value)}
                        placeholder="e.g., Approve"
                      />
                    </div>
                    <button
                      onClick={() => removeOption(idx)}
                      disabled={scoringSchema.options!.length <= 2}
                      className="btn-secondary px-3 py-2 disabled:opacity-50"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {scoringType === 'fund_options' && (
            <div className="card">
              <h2 className="font-semibold text-lg mb-4">Options</h2>
              <p className="text-sm text-gray-600 mb-4">Add or remove funding options</p>
              <div className="space-y-3 mb-4">
                {scoringSchema.options?.map((option, idx) => (
                  <div key={idx} className="flex gap-3 items-end">
                    <div className="flex-1">
                      <label className="label">Option Label</label>
                      <input
                        type="text"
                        className="input"
                        value={option.label}
                        onChange={(e) => updateOption(idx, 'label', e.target.value)}
                        placeholder="e.g., Fund"
                      />
                    </div>
                    <button
                      onClick={() => removeOption(idx)}
                      className="btn-secondary px-3 py-2"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
              <button
                onClick={addOption}
                className="btn-primary flex items-center gap-2 text-sm"
              >
                <Plus className="w-4 h-4" />
                Add Option
              </button>
            </div>
          )}

          {scoringType === 'score_range' && (
            <div className="card">
              <h2 className="font-semibold text-lg mb-4">Scoring Range & Criteria</h2>
              <div className="grid grid-cols-2 gap-4 mb-6">
                <div>
                  <label className="label">Minimum Score</label>
                  <input
                    type="number"
                    className="input"
                    value={scoringSchema.min ?? 0}
                    onChange={(e) => setScoringSchema({ ...scoringSchema, min: parseInt(e.target.value) })}
                  />
                </div>
                <div>
                  <label className="label">Maximum Score</label>
                  <input
                    type="number"
                    className="input"
                    value={scoringSchema.max ?? 100}
                    onChange={(e) => setScoringSchema({ ...scoringSchema, max: parseInt(e.target.value) })}
                  />
                </div>
              </div>

              <h3 className="font-medium text-gray-900 mb-4">Weighted Criteria</h3>
              <p className="text-sm text-gray-600 mb-4">
                Each criterion will be scored separately, then combined using weights (must total 100%)
              </p>

              <div className="space-y-4 mb-4">
                {scoringSchema.criteria?.map((criterion, idx) => (
                  <div key={criterion.id} className="p-4 border border-gray-200 rounded-lg">
                    <div className="flex gap-3 mb-3">
                      <div className="flex-1">
                        <label className="label">Criterion Label</label>
                        <input
                          type="text"
                          className="input"
                          value={criterion.label}
                          onChange={(e) => updateCriterion(idx, 'label', e.target.value)}
                          placeholder="e.g., Impact"
                        />
                      </div>
                      <div className="w-20">
                        <label className="label">Weight %</label>
                        <input
                          type="number"
                          className="input"
                          min="0"
                          max="100"
                          value={criterion.weight}
                          onChange={(e) => updateCriterion(idx, 'weight', parseInt(e.target.value))}
                        />
                      </div>
                      <button
                        onClick={() => removeCriterion(idx)}
                        className="btn-secondary px-3 py-2 mt-6"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                    <div>
                      <label className="label">Description (optional)</label>
                      <input
                        type="text"
                        className="input"
                        value={criterion.description || ''}
                        onChange={(e) => updateCriterion(idx, 'description', e.target.value)}
                        placeholder="Guidance for evaluating this criterion"
                      />
                    </div>
                  </div>
                ))}
              </div>

              <div className="mb-4 p-3 bg-blue-50 rounded-lg">
                <p className="text-sm text-blue-800">
                  Total weight: {scoringSchema.criteria?.reduce((sum, c) => sum + (c.weight || 0), 0) || 0}%
                </p>
              </div>

              <button
                onClick={addCriterion}
                className="btn-primary flex items-center gap-2 text-sm"
              >
                <Plus className="w-4 h-4" />
                Add Criterion
              </button>
            </div>
          )}

          {scoringType === 'custom' && (
            <div className="card">
              <h2 className="font-semibold text-lg mb-4">Custom Options</h2>
              <p className="text-sm text-gray-600 mb-4">Define your own custom scoring options</p>
              <div className="space-y-3 mb-4">
                {scoringSchema.options?.map((option, idx) => (
                  <div key={idx} className="flex gap-3 items-end">
                    <div className="flex-1">
                      <label className="label">Label</label>
                      <input
                        type="text"
                        className="input"
                        value={option.label}
                        onChange={(e) => updateOption(idx, 'label', e.target.value)}
                        placeholder="e.g., Excellent"
                      />
                    </div>
                    <div className="flex-1">
                      <label className="label">Value (for API)</label>
                      <input
                        type="text"
                        className="input"
                        value={option.value}
                        onChange={(e) => updateOption(idx, 'value', e.target.value)}
                        placeholder="e.g., excellent"
                      />
                    </div>
                    <button
                      onClick={() => removeOption(idx)}
                      className="btn-secondary px-3 py-2"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
              <button
                onClick={addOption}
                className="btn-primary flex items-center gap-2 text-sm"
              >
                <Plus className="w-4 h-4" />
                Add Option
              </button>
            </div>
          )}

          {/* Preview */}
          <div className="card">
            <h2 className="font-semibold text-lg mb-4">Preview</h2>
            <p className="text-sm text-gray-600 mb-4">How committee members will see the scoring interface:</p>
            <div className="p-4 bg-gray-50 rounded-lg border border-gray-200">
              {scoringType === 'approve_reject' || scoringType === 'fund_options' || scoringType === 'custom' ? (
                <div className="space-y-2">
                  <p className="text-sm text-gray-600 mb-3">Choose one option:</p>
                  {scoringSchema.options?.map((option) => (
                    <label key={option.value} className="flex items-center gap-3 p-3 border border-gray-200 rounded hover:bg-gray-100 cursor-pointer">
                      <input type="radio" name="preview" className="w-4 h-4" disabled />
                      <span className="text-sm">{option.label}</span>
                    </label>
                  ))}
                </div>
              ) : (
                <div className="space-y-4">
                  <p className="text-sm text-gray-600 mb-3">Score each criterion ({scoringSchema.min ?? 0} - {scoringSchema.max ?? 100}):</p>
                  {scoringSchema.criteria?.map((criterion) => (
                    <div key={criterion.id}>
                      <div className="flex justify-between items-center mb-2">
                        <label className="text-sm font-medium text-gray-900">{criterion.label}</label>
                        <span className="text-xs text-gray-500">{criterion.weight}% weight</span>
                      </div>
                      {criterion.description && (
                        <p className="text-xs text-gray-500 mb-2">{criterion.description}</p>
                      )}
                      <input
                        type="range"
                        min={scoringSchema.min ?? 0}
                        max={scoringSchema.max ?? 100}
                        className="w-full"
                        disabled
                      />
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex gap-4">
            <button
              onClick={() => router.back()}
              className="btn-secondary"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={saving}
              className="btn-primary flex items-center gap-2"
            >
              <Save className="w-4 h-4" />
              {saving ? 'Saving...' : 'Save & Notify Committee'}
            </button>
          </div>
        </div>
      </div>
    </AppLayout>
  );
}
