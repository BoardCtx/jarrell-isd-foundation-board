'use client';

import { useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { createClient } from '@/lib/supabase';
import FormBuilder, { FormSchema } from '@/components/grants/FormBuilder';
import { Calendar, AlertCircle } from 'lucide-react';

interface GrantApplication {
  id: string;
  title: string;
  description: string | null;
  status: string;
  deadline: string | null;
  form_schema: FormSchema;
}

interface GrantRequest {
  id: string;
  form_data: Record<string, any>;
  status: string;
}

export default function ApplyPage() {
  const [application, setApplication] = useState<GrantApplication | null>(null);
  const [existingRequest, setExistingRequest] = useState<GrantRequest | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const router = useRouter();
  const params = useParams();
  const applicationId = params.applicationId as string;
  const supabase = createClient();

  useEffect(() => {
    loadApplicationAndRequest();
  }, [applicationId]);

  const loadApplicationAndRequest = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();

      if (!user) {
        router.push('/grants/login');
        return;
      }

      // Load application
      const { data: appData, error: appError } = await supabase
        .from('grant_applications')
        .select('id, title, description, status, deadline, form_schema')
        .eq('id', applicationId)
        .single();

      if (appError) {
        setError('Application not found');
        setLoading(false);
        return;
      }

      setApplication(appData);

      // Check if user already has a draft request
      const { data: requestData } = await supabase
        .from('grant_requests')
        .select('id, form_data, status')
        .eq('application_id', applicationId)
        .eq('applicant_id', user.id)
        .eq('status', 'draft')
        .maybeSingle();

      if (requestData) {
        setExistingRequest(requestData);
      }

      setLoading(false);
    } catch (err) {
      console.error('Error loading:', err);
      setError('Failed to load application');
      setLoading(false);
    }
  };

  const handleSaveProgress = async (formData: Record<string, any>) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();

      if (!user) {
        throw new Error('Not authenticated');
      }

      if (existingRequest) {
        // Update existing draft
        const { error } = await supabase
          .from('grant_requests')
          .update({
            form_data: formData,
            updated_at: new Date().toISOString(),
          })
          .eq('id', existingRequest.id);

        if (error) throw error;
      } else {
        // Create new draft
        const { data: newRequest, error } = await supabase
          .from('grant_requests')
          .insert({
            application_id: applicationId,
            applicant_id: user.id,
            status: 'draft',
            form_data: formData,
          })
          .select('id')
          .single();

        if (error) throw error;

        if (newRequest) {
          setExistingRequest({
            id: newRequest.id,
            form_data: formData,
            status: 'draft',
          });
        }
      }
    } catch (err) {
      console.error('Save error:', err);
      throw err;
    }
  };

  const handleSubmitRequest = async (formData: Record<string, any>) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();

      if (!user) {
        throw new Error('Not authenticated');
      }

      const now = new Date().toISOString();

      if (existingRequest) {
        // Update existing request to submitted
        const { error } = await supabase
          .from('grant_requests')
          .update({
            form_data: formData,
            status: 'submitted',
            submitted_at: now,
            updated_at: now,
          })
          .eq('id', existingRequest.id);

        if (error) throw error;
      } else {
        // Create new request as submitted
        const { error } = await supabase
          .from('grant_requests')
          .insert({
            application_id: applicationId,
            applicant_id: user.id,
            status: 'submitted',
            form_data: formData,
            submitted_at: now,
          });

        if (error) throw error;
      }

      // Redirect to request view
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
        <div className="text-gray-600">Loading application...</div>
      </div>
    );
  }

  if (error || !application) {
    return (
      <div className="card bg-red-50 border border-red-200">
        <div className="flex gap-3">
          <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
          <div>
            <h3 className="font-semibold text-red-900">{error || 'Application not found'}</h3>
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

  if (application.status !== 'open') {
    return (
      <div className="card bg-yellow-50 border border-yellow-200">
        <div className="flex gap-3">
          <AlertCircle className="w-5 h-5 text-yellow-600 flex-shrink-0 mt-0.5" />
          <div>
            <h3 className="font-semibold text-yellow-900">Application No Longer Open</h3>
            <p className="text-sm text-yellow-800 mt-1">
              This grant application is no longer accepting new requests.
            </p>
            <button
              onClick={() => router.back()}
              className="text-sm text-yellow-600 hover:underline mt-2"
            >
              Go back
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="page-header">{application.title}</h1>
        {application.description && (
          <p className="text-gray-600 mt-2">{application.description}</p>
        )}
      </div>

      {/* Deadline Alert */}
      {application.deadline && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 flex items-start gap-3">
          <Calendar className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
          <div>
            <p className="font-medium text-blue-900">Deadline</p>
            <p className="text-sm text-blue-800">
              {new Date(application.deadline).toLocaleDateString('en-US', {
                weekday: 'long',
                year: 'numeric',
                month: 'long',
                day: 'numeric',
              })}
            </p>
          </div>
        </div>
      )}

      {/* Status Message */}
      {existingRequest && (
        <div className="bg-green-50 border border-green-200 rounded-lg p-4">
          <p className="text-sm text-green-800">
            You have a {existingRequest.status === 'draft' ? 'draft' : existingRequest.status} version of this application.
          </p>
        </div>
      )}

      {/* Form */}
      <div className="card">
        <FormBuilder
          schema={application.form_schema}
          initialData={existingRequest?.form_data || {}}
          onSave={handleSaveProgress}
          onSubmit={handleSubmitRequest}
          showSaveButton={true}
          showSubmitButton={true}
          submitButtonText="Submit Application"
          isReadOnly={false}
        />
      </div>
    </div>
  );
}
