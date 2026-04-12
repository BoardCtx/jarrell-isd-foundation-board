'use client';

import { useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { createClient } from '@/lib/supabase';
import { Calendar, AlertCircle, CheckCircle2, Loader2, Upload, X } from 'lucide-react';

interface GrantFollowup {
  id: string;
  request_id: string;
  status: string;
  report_data: {
    funds_used: string;
    budget_summary: string;
    outcomes: string;
    successes: string;
    challenges: string;
    files?: Array<{ name: string; path: string }>;
  };
  submitted_at: string | null;
}

interface GrantRequest {
  id: string;
  application_id: string;
  status: string;
}

interface GrantApplication {
  id: string;
  title: string;
  followup_deadline: string | null;
  followup_closed: boolean;
}

export default function FollowupPage() {
  const [followup, setFollowup] = useState<GrantFollowup | null>(null);
  const [request, setRequest] = useState<GrantRequest | null>(null);
  const [application, setApplication] = useState<GrantApplication | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Form state
  const [fundsUsed, setFundsUsed] = useState('');
  const [budgetSummary, setBudgetSummary] = useState('');
  const [outcomes, setOutcomes] = useState('');
  const [successes, setSuccesses] = useState('');
  const [challenges, setChallenges] = useState('');
  const [files, setFiles] = useState<Array<{ name: string; path: string }>>([]);
  const [uploadingFiles, setUploadingFiles] = useState(false);
  const [saving, setSaving] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [validationErrors, setValidationErrors] = useState<Record<string, string>>({});

  const router = useRouter();
  const params = useParams();
  const requestId = params.requestId as string;
  const supabase = createClient();

  useEffect(() => {
    loadFollowupData();
  }, [requestId]);

  const loadFollowupData = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();

      if (!user) {
        router.push('/grants/login');
        return;
      }

      // Load request
      const { data: requestData, error: requestError } = await supabase
        .from('grant_requests')
        .select('id, application_id, status')
        .eq('id', requestId)
        .eq('applicant_id', user.id)
        .single();

      if (requestError) {
        setError('Request not found');
        setLoading(false);
        return;
      }

      setRequest(requestData);

      // Load application
      const { data: appData, error: appError } = await supabase
        .from('grant_applications')
        .select('id, title, followup_deadline, followup_closed')
        .eq('id', requestData.application_id)
        .single();

      if (appError) {
        setError('Application not found');
        setLoading(false);
        return;
      }

      setApplication(appData);

      // Load existing followup if it exists
      const { data: followupData } = await supabase
        .from('grant_followups')
        .select('id, request_id, status, report_data, submitted_at')
        .eq('request_id', requestId)
        .maybeSingle();

      if (followupData) {
        setFollowup(followupData);
        setFundsUsed(followupData.report_data?.funds_used || '');
        setBudgetSummary(followupData.report_data?.budget_summary || '');
        setOutcomes(followupData.report_data?.outcomes || '');
        setSuccesses(followupData.report_data?.successes || '');
        setChallenges(followupData.report_data?.challenges || '');
        setFiles(followupData.report_data?.files || []);
      }

      setLoading(false);
    } catch (err) {
      console.error('Error loading:', err);
      setError('Failed to load follow-up data');
      setLoading(false);
    }
  };

  const handleFileUpload = async (fileList: FileList) {
    if (!fileList.length || !request) return;

    setUploadingFiles(true);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const newFiles = [];

      for (const file of Array.from(fileList)) {
        const fileExtension = file.name.split('.').pop();
        const fileName = `${Date.now()}_${Math.random().toString(36).substring(7)}.${fileExtension}`;
        const filePath = `${user.id}/followup/${requestId}/${fileName}`;

        const { error: uploadError } = await supabase.storage
          .from('grant-files')
          .upload(filePath, file);

        if (uploadError) throw uploadError;

        newFiles.push({
          name: file.name,
          path: filePath,
        });
      }

      setFiles(prev => [...prev, ...newFiles]);
    } catch (err) {
      console.error('Upload error:', err);
      setError('Failed to upload files');
    } finally {
      setUploadingFiles(false);
    }
  };

  const handleRemoveFile = (index: number) => {
    setFiles(prev => prev.filter((_, i) => i !== index));
  };

  const validateForm = (): boolean => {
    const errors: Record<string, string> = {};

    if (!fundsUsed.trim()) {
      errors.fundsUsed = 'How funds were used is required';
    }

    if (!outcomes.trim()) {
      errors.outcomes = 'Outcomes & Impact is required';
    }

    setValidationErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const buildReportData = () => ({
    funds_used: fundsUsed,
    budget_summary: budgetSummary,
    outcomes,
    successes,
    challenges,
    files,
  });

  const handleSaveProgress = async () => {
    if (!request) return;

    setSaving(true);
    try {
      const reportData = buildReportData();

      if (followup) {
        // Update existing followup
        const { error } = await supabase
          .from('grant_followups')
          .update({
            report_data: reportData,
            updated_at: new Date().toISOString(),
          })
          .eq('id', followup.id);

        if (error) throw error;
      } else {
        // Create new followup
        const { data: newFollowup, error } = await supabase
          .from('grant_followups')
          .insert({
            request_id: requestId,
            status: 'draft',
            report_data: reportData,
          })
          .select('id')
          .single();

        if (error) throw error;

        if (newFollowup) {
          setFollowup({
            id: newFollowup.id,
            request_id: requestId,
            status: 'draft',
            report_data: reportData,
            submitted_at: null,
          });
        }
      }
    } catch (err) {
      console.error('Save error:', err);
      setError('Failed to save progress');
    } finally {
      setSaving(false);
    }
  };

  const handleSubmitFollowup = async () => {
    if (!validateForm() || !request) return;

    setSubmitting(true);
    try {
      const reportData = buildReportData();
      const now = new Date().toISOString();

      if (followup) {
        // Update existing followup to submitted
        const { error } = await supabase
          .from('grant_followups')
          .update({
            report_data: reportData,
            status: 'submitted',
            submitted_at: now,
            updated_at: now,
          })
          .eq('id', followup.id);

        if (error) throw error;
      } else {
        // Create new followup as submitted
        const { error } = await supabase
          .from('grant_followups')
          .insert({
            request_id: requestId,
            status: 'submitted',
            report_data: reportData,
            submitted_at: now,
          });

        if (error) throw error;
      }

      router.push(`/grants/portal/requests/${requestId}`);
      router.refresh();
    } catch (err) {
      console.error('Submit error:', err);
      setError('Failed to submit follow-up');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-gray-600">Loading follow-up form...</div>
      </div>
    );
  }

  if (error || !request || !application) {
    return (
      <div className="card bg-red-50 border border-red-200">
        <div className="flex gap-3">
          <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
          <div>
            <h3 className="font-semibold text-red-900">{error || 'Data not found'}</h3>
            <button
              onClick={() => router.back()}
              className="text-sm text-red-600 hover:underline mt-2"
            >
              Go back
            </button>
          </div>
        </div>
      </div>
    );
  }

  const isReadOnly = application.followup_closed || followup?.status === 'submitted';

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="page-header">{application.title} — Follow-Up Report</h1>
        <p className="text-gray-600 mt-2">
          {followup?.submitted_at
            ? `Submitted on ${new Date(followup.submitted_at).toLocaleDateString()}`
            : 'Complete this report to show how the grant funds were used'}
        </p>
      </div>

      {/* Deadline */}
      {application.followup_deadline && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 flex items-start gap-3">
          <Calendar className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
          <div>
            <p className="font-medium text-blue-900">Follow-up Deadline</p>
            <p className="text-sm text-blue-800">
              {new Date(application.followup_deadline).toLocaleDateString('en-US', {
                weekday: 'long',
                year: 'numeric',
                month: 'long',
                day: 'numeric',
              })}
            </p>
          </div>
        </div>
      )}

      {/* Closed Notice */}
      {application.followup_closed && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-yellow-600 flex-shrink-0 mt-0.5" />
          <div>
            <p className="font-medium text-yellow-900">Follow-up Period Closed</p>
            <p className="text-sm text-yellow-800">
              {followup?.status === 'submitted'
                ? 'Your follow-up report has been submitted.'
                : 'The follow-up period for this grant has closed. You can no longer submit a report.'}
            </p>
          </div>
        </div>
      )}

      {/* Error Alert */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <p className="text-sm text-red-700">{error}</p>
        </div>
      )}

      {/* Form */}
      <div className="card">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleSubmitFollowup();
          }}
          className="space-y-6"
        >
          {/* Funds Used */}
          <div>
            <label className="label" htmlFor="fundsUsed">
              How were the funds used? *
            </label>
            <textarea
              id="fundsUsed"
              value={fundsUsed}
              onChange={(e) => setFundsUsed(e.target.value)}
              disabled={isReadOnly}
              className="input"
              placeholder="Describe how the grant funds were used..."
              rows={4}
            />
            {validationErrors.fundsUsed && (
              <p className="text-red-600 text-sm mt-1">{validationErrors.fundsUsed}</p>
            )}
          </div>

          {/* Budget Summary */}
          <div>
            <label className="label" htmlFor="budgetSummary">
              Budget Summary
            </label>
            <textarea
              id="budgetSummary"
              value={budgetSummary}
              onChange={(e) => setBudgetSummary(e.target.value)}
              disabled={isReadOnly}
              className="input"
              placeholder="Describe any variations from the original budget..."
              rows={4}
            />
            <p className="text-gray-500 text-sm mt-1">Optional: Explain any budget changes or adjustments</p>
          </div>

          {/* Outcomes & Impact */}
          <div>
            <label className="label" htmlFor="outcomes">
              Outcomes & Impact *
            </label>
            <textarea
              id="outcomes"
              value={outcomes}
              onChange={(e) => setOutcomes(e.target.value)}
              disabled={isReadOnly}
              className="input"
              placeholder="Describe the outcomes and impact of the grant..."
              rows={4}
            />
            {validationErrors.outcomes && (
              <p className="text-red-600 text-sm mt-1">{validationErrors.outcomes}</p>
            )}
          </div>

          {/* Successes */}
          <div>
            <label className="label" htmlFor="successes">
              Successes
            </label>
            <textarea
              id="successes"
              value={successes}
              onChange={(e) => setSuccesses(e.target.value)}
              disabled={isReadOnly}
              className="input"
              placeholder="What went well? What were the highlights?"
              rows={3}
            />
          </div>

          {/* Challenges */}
          <div>
            <label className="label" htmlFor="challenges">
              Challenges
            </label>
            <textarea
              id="challenges"
              value={challenges}
              onChange={(e) => setChallenges(e.target.value)}
              disabled={isReadOnly}
              className="input"
              placeholder="What challenges did you face? What would you do differently?"
              rows={3}
            />
          </div>

          {/* File Upload */}
          {!isReadOnly && (
            <div>
              <label className="label">Photos / Supporting Documents</label>
              <div className="relative border-2 border-dashed border-gray-300 rounded-lg p-6 hover:border-primary transition">
                <input
                  type="file"
                  multiple
                  onChange={(e) => handleFileUpload(e.currentTarget.files!)}
                  className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                  disabled={uploadingFiles}
                />
                <div className="text-center pointer-events-none">
                  {uploadingFiles ? (
                    <>
                      <Loader2 className="w-8 h-8 text-gray-400 mx-auto animate-spin" />
                      <p className="text-sm text-gray-500 mt-2">Uploading...</p>
                    </>
                  ) : (
                    <>
                      <Upload className="w-8 h-8 text-gray-400 mx-auto" />
                      <p className="text-sm text-gray-600 mt-2">Drop files here or click to upload</p>
                    </>
                  )}
                </div>
              </div>

              {files.length > 0 && (
                <div className="space-y-2 mt-3">
                  {files.map((file, idx) => (
                    <div key={idx} className="flex items-center justify-between p-2 bg-gray-50 rounded">
                      <span className="text-sm text-gray-600 truncate">{file.name}</span>
                      <button
                        type="button"
                        onClick={() => handleRemoveFile(idx)}
                        className="p-1 hover:bg-red-100 rounded transition"
                      >
                        <X className="w-4 h-4 text-red-600" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {isReadOnly && files.length > 0 && (
            <div>
              <label className="label">Supporting Documents</label>
              <div className="space-y-2">
                {files.map((file, idx) => (
                  <div key={idx} className="flex items-center gap-2 p-2 bg-gray-50 rounded">
                    <span className="text-sm text-gray-600">{file.name}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Buttons */}
          {!isReadOnly && (
            <div className="flex gap-3 pt-6 border-t border-gray-200">
              <button
                type="button"
                onClick={handleSaveProgress}
                disabled={saving}
                className="btn-secondary flex items-center gap-2"
              >
                {saving ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Saving...
                  </>
                ) : (
                  'Save Progress'
                )}
              </button>

              <button
                type="submit"
                disabled={submitting}
                className="btn-primary flex items-center gap-2"
              >
                {submitting ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Submitting...
                  </>
                ) : (
                  'Submit Follow-Up'
                )}
              </button>
            </div>
          )}
        </form>
      </div>
    </div>
  );
}
