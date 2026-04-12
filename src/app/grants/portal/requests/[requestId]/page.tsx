'use client';

import { useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { createClient } from '@/lib/supabase';
import FormBuilder, { FormSchema } from '@/components/grants/FormBuilder';
import Link from 'next/link';
import { AlertCircle, CheckCircle2, XCircle, Loader2 } from 'lucide-react';

interface GrantRequest {
  id: string;
  application_id: string;
  status: string;
  form_data: Record<string, any>;
  submitted_at: string | null;
  created_at: string;
  decision: string | null;
  decision_visible: boolean;
  followup_open: boolean;
  decision_message: string | null;
}

interface GrantApplication {
  id: string;
  title: string;
  description: string | null;
  status: string;
  deadline: string | null;
  followup_deadline: string | null;
  form_schema: FormSchema;
}

export default function RequestPage() {
  const [request, setRequest] = useState<GrantRequest | null>(null);
  const [application, setApplication] = useState<GrantApplication | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const router = useRouter();
  const params = useParams();
  const requestId = params.requestId as string;
  const supabase = createClient();

  useEffect(() => {
    loadRequestAndApplication();
  }, [requestId]);

  const loadRequestAndApplication = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();

      if (!user) {
        router.push('/grants/login');
        return;
      }

      // Load request
      const { data: requestData, error: requestError } = await supabase
        .from('grant_requests')
        .select('id, application_id, status, form_data, submitted_at, created_at, decision, decision_visible, decision_message, followup_open')
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
        .select('id, title, description, status, deadline, followup_deadline, form_schema')
        .eq('id', requestData.application_id)
        .single();

      if (appError) {
        setError('Application not found');
        setLoading(false);
        return;
      }

      setApplication(appData);
      setLoading(false);
    } catch (err) {
      console.error('Error loading:', err);
      setError('Failed to load request');
      setLoading(false);
    }
  };

  const handleSaveProgress = async (formData: Record<string, any>) => {
    if (!request) return;

    try {
      const { error } = await supabase
        .from('grant_requests')
        .update({
          form_data: formData,
          updated_at: new Date().toISOString(),
        })
        .eq('id', request.id);

      if (error) throw error;

      setRequest(prev => prev ? { ...prev, form_data: formData } : null);
    } catch (err) {
      console.error('Save error:', err);
      throw err;
    }
  };

  const handleSubmitRequest = async (formData: Record<string, any>) => {
    if (!request) return;

    try {
      const now = new Date().toISOString();

      const { error } = await supabase
        .from('grant_requests')
        .update({
          form_data: formData,
          status: 'submitted',
          submitted_at: now,
          updated_at: now,
        })
        .eq('id', request.id);

      if (error) throw error;

      router.push('/grants/portal');
      router.refresh();
    } catch (err) {
      console.error('Submit error:', err);
      throw err;
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-gray-600">Loading request...</div>
      </div>
    );
  }

  if (error || !request || !application) {
    return (
      <div className="card bg-red-50 border border-red-200">
        <div className="flex gap-3">
          <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
          <div>
            <h3 className="font-semibold text-red-900">{error || 'Request not found'}</h3>
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

  const isApplicationOpen = application.status === 'open';
  const isEditable = isApplicationOpen && (request.status === 'draft' || request.status === 'submitted');
  const showDecision = request.decision_visible && request.decision;

  const statusConfig: Record<string, { icon: React.ReactNode; color: string; label: string }> = {
    draft: {
      icon: <AlertCircle className="w-5 h-5" />,
      color: 'bg-yellow-50 border-yellow-200 text-yellow-800',
      label: 'Draft',
    },
    submitted: {
      icon: <Loader2 className="w-5 h-5" />,
      color: 'bg-blue-50 border-blue-200 text-blue-800',
      label: 'Submitted',
    },
    approved: {
      icon: <CheckCircle2 className="w-5 h-5" />,
      color: 'bg-green-50 border-green-200 text-green-800',
      label: 'Approved',
    },
    rejected: {
      icon: <XCircle className="w-5 h-5" />,
      color: 'bg-red-50 border-red-200 text-red-800',
      label: 'Rejected',
    },
  };

  const statusInfo = statusConfig[request.status] || statusConfig.draft;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="page-header">{application.title}</h1>
        <p className="text-gray-600 mt-2">
          {request.submitted_at
            ? `Submitted on ${new Date(request.submitted_at).toLocaleDateString()}`
            : 'Draft application'}
        </p>
      </div>

      {/* Status Badge */}
      <div className={`card border ${statusInfo.color} flex items-center gap-3`}>
        {statusInfo.icon}
        <span className="font-medium">{statusInfo.label}</span>
      </div>

      {/* Decision */}
      {showDecision && (
        <div className={`card border ${request.decision === 'approved' ? 'border-green-200 bg-green-50' : 'border-red-200 bg-red-50'}`}>
          <div className="flex gap-3">
            {request.decision === 'approved' ? (
              <CheckCircle2 className="w-6 h-6 text-green-600 flex-shrink-0" />
            ) : (
              <XCircle className="w-6 h-6 text-red-600 flex-shrink-0" />
            )}
            <div>
              <h3 className={`font-semibold ${request.decision === 'approved' ? 'text-green-900' : 'text-red-900'}`}>
                {request.decision === 'approved' ? 'Approved' : 'Not Approved'}
              </h3>
              {request.decision_message && (
                <p className={`text-sm mt-2 ${request.decision === 'approved' ? 'text-green-800' : 'text-red-800'}`}>
                  {request.decision_message}
                </p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Follow-up Link */}
      {request.followup_open && request.decision === 'approved' && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <p className="text-sm text-blue-800 mb-3">
            A follow-up report is required for this grant.
          </p>
          <Link
            href={`/grants/portal/requests/${request.id}/followup`}
            className="btn-primary inline-block"
          >
            Submit Follow-Up Report
          </Link>
        </div>
      )}

      {/* Form */}
      <div className="card">
        <FormBuilder
          schema={application.form_schema}
          initialData={request.form_data || {}}
          onSave={handleSaveProgress}
          onSubmit={handleSubmitRequest}
          showSaveButton={isEditable && request.status === 'draft'}
          showSubmitButton={isEditable && request.status === 'draft'}
          submitButtonText="Submit Application"
          isReadOnly={!isEditable}
        />
      </div>
    </div>
  );
}
