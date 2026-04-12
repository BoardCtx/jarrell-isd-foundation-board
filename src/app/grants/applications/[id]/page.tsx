'use client';

import { useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { createClient } from '@/lib/supabase';
import AppLayout from '@/components/layout/AppLayout';
import { formatDate, cn } from '@/lib/utils';
import {
  ArrowLeft,
  Edit,
  Trash2,
  Play,
  CheckCircle,
  Lock,
  Zap,
  Archive,
  Eye,
  EyeOff,
  X,
  Calendar,
  User,
  Clock,
  AlertCircle,
} from 'lucide-react';

interface FormField {
  id: string;
  type: string;
  label: string;
  required: boolean;
  placeholder?: string;
  helpText?: string;
  options?: { label: string; value: string }[];
  maxLength?: number;
  accept?: string;
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

interface Application {
  id: string;
  title: string;
  description: string | null;
  status: 'draft' | 'open' | 'closed' | 'scoring' | 'decided';
  deadline: string | null;
  max_award_amount: number | null;
  form_schema: FormSchema;
  created_at: string;
  created_by: string;
}

interface ApplicationRequest {
  id: string;
  applicant_id: string;
  applicant_name: string;
  applicant_org: string;
  submitted_at: string;
  status: string;
  form_data: Record<string, any>;
}

type TabType = 'requests' | 'preview' | 'settings';

export default function ApplicationDetailPage() {
  const router = useRouter();
  const params = useParams();
  const applicationId = params.id as string;
  const supabase = createClient();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [application, setApplication] = useState<Application | null>(null);
  const [requests, setRequests] = useState<ApplicationRequest[]>([]);
  const [activeTab, setActiveTab] = useState<TabType>('requests');
  const [selectedRequest, setSelectedRequest] = useState<ApplicationRequest | null>(null);
  const [isEditMode, setIsEditMode] = useState(false);

  useEffect(() => {
    const loadApplication = async () => {
      try {
        const { data, error: fetchError } = await supabase
          .from('grant_applications')
          .select('*')
          .eq('id', applicationId)
          .single();

        if (fetchError) throw fetchError;
        setApplication(data);

        // Load requests
        const { data: requestsData, error: requestsError } = await supabase
          .from('grant_requests')
          .select('*')
          .eq('application_id', applicationId)
          .order('submitted_at', { ascending: false });

        if (requestsError) throw requestsError;

        // Load applicant info
        const applicantIds = [...new Set((requestsData || []).map((r: any) => r.applicant_id))];
        const { data: applicants } = applicantIds.length > 0
          ? await supabase.from('grant_applicants').select('id, full_name, organization').in('id', applicantIds)
          : { data: [] };
        const applicantMap = new Map((applicants || []).map((a: any) => [a.id, a]));

        setRequests((requestsData || []).map((r: any) => {
          const applicant = applicantMap.get(r.applicant_id);
          return {
            ...r,
            applicant_name: applicant?.full_name || 'Unknown',
            applicant_org: applicant?.organization || '',
          };
        }));
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load application');
      } finally {
        setLoading(false);
      }
    };

    loadApplication();
  }, [applicationId, supabase]);

  const handleStatusChange = async (newStatus: Application['status']) => {
    if (!application) return;

    try {
      const { error: updateError } = await supabase
        .from('grant_applications')
        .update({ status: newStatus })
        .eq('id', applicationId);

      if (updateError) throw updateError;

      setApplication({ ...application, status: newStatus });

      if (newStatus === 'scoring') {
        router.push(`/grants/applications/${applicationId}/scoring`);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update status');
    }
  };

  const handleDelete = async () => {
    if (!confirm('Are you sure you want to delete this application? This action cannot be undone.')) {
      return;
    }

    try {
      const { error: deleteError } = await supabase
        .from('grant_applications')
        .delete()
        .eq('id', applicationId);

      if (deleteError) throw deleteError;

      router.push('/grants/applications');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete application');
    }
  };

  if (loading) {
    return (
      <AppLayout>
        <div className="flex items-center justify-center min-h-screen">
          <div className="text-center">
            <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mb-4"></div>
            <p className="text-gray-600">Loading application...</p>
          </div>
        </div>
      </AppLayout>
    );
  }

  if (!application) {
    return (
      <AppLayout>
        <div className="p-8">
          <div className="card">
            <p className="text-red-600">Application not found</p>
            <button
              onClick={() => router.push('/grants/applications')}
              className="btn-primary mt-4 flex items-center gap-2"
            >
              <ArrowLeft size={18} />
              Back to Applications
            </button>
          </div>
        </div>
      </AppLayout>
    );
  }

  const statusColors: Record<string, string> = {
    draft: 'bg-gray-100 text-gray-800',
    open: 'bg-green-100 text-green-800',
    closed: 'bg-blue-100 text-blue-800',
    scoring: 'bg-purple-100 text-purple-800',
    decided: 'bg-indigo-100 text-indigo-800',
  };

  const statusIcons: Record<string, React.ReactNode> = {
    draft: <AlertCircle size={16} />,
    open: <Play size={16} />,
    closed: <Lock size={16} />,
    scoring: <Zap size={16} />,
    decided: <CheckCircle size={16} />,
  };

  return (
    <AppLayout>
      <div className="p-8 max-w-6xl mx-auto">
        {/* Header */}
        <div className="flex items-start justify-between mb-8 pb-6 border-b">
          <div>
            <div className="flex items-center gap-3 mb-3">
              <button
                onClick={() => router.push('/grants/applications')}
                className="p-2 hover:bg-gray-100 rounded transition-colors"
                title="Back"
              >
                <ArrowLeft size={20} />
              </button>
              <h1 className="text-3xl font-bold">{application.title}</h1>
            </div>

            <div className="flex items-center gap-4 ml-12">
              <span className={cn('badge', statusColors[application.status], 'flex items-center gap-2')}>
                {statusIcons[application.status]}
                {application.status.charAt(0).toUpperCase() + application.status.slice(1)}
              </span>

              <span className="text-sm text-gray-600 flex items-center gap-2">
                <Calendar size={16} />
                Created {formatDate(application.created_at)}
              </span>
            </div>
          </div>

          <div className="flex gap-2">
            <button
              onClick={() => setIsEditMode(!isEditMode)}
              className="btn-secondary flex items-center gap-2"
            >
              <Edit size={18} />
              {isEditMode ? 'Done' : 'Edit'}
            </button>
            <button
              onClick={handleDelete}
              className="p-2 hover:bg-red-50 text-red-600 rounded border border-red-200 transition-colors"
              title="Delete"
            >
              <Trash2 size={18} />
            </button>
          </div>
        </div>

        {error && (
          <div className="mb-6 bg-red-50 border border-red-200 rounded-lg p-4 flex gap-3">
            <AlertCircle className="text-red-600 flex-shrink-0" size={20} />
            <p className="text-red-700">{error}</p>
          </div>
        )}

        {/* Status Actions */}
        {!isEditMode && (
          <div className="mb-8">
            <StatusActions application={application} onStatusChange={handleStatusChange} />
          </div>
        )}

        {/* Edit Mode */}
        {isEditMode && (
          <div className="card mb-8">
            <h2 className="font-semibold mb-4 text-lg">Edit Application</h2>
            <EditApplicationForm application={application} onSave={() => setIsEditMode(false)} />
          </div>
        )}

        {/* Tabs */}
        <div className="card">
          <div className="border-b mb-6 flex gap-4">
            <TabButton
              active={activeTab === 'requests'}
              onClick={() => setActiveTab('requests')}
              label={`Requests (${requests.length})`}
            />
            <TabButton
              active={activeTab === 'preview'}
              onClick={() => setActiveTab('preview')}
              label="Form Preview"
            />
            <TabButton
              active={activeTab === 'settings'}
              onClick={() => setActiveTab('settings')}
              label="Settings"
            />
          </div>

          {activeTab === 'requests' && (
            <RequestsTab
              requests={requests}
              selectedRequest={selectedRequest}
              onSelectRequest={setSelectedRequest}
              application={application}
            />
          )}

          {activeTab === 'preview' && (
            <FormPreviewTab formSchema={application.form_schema} />
          )}

          {activeTab === 'settings' && (
            <SettingsTab application={application} />
          )}
        </div>
      </div>
    </AppLayout>
  );
}

interface StatusActionsProps {
  application: Application;
  onStatusChange: (status: Application['status']) => void;
}

function StatusActions({ application, onStatusChange }: StatusActionsProps) {
  return (
    <div className="card flex items-center justify-between">
      <div>
        <p className="text-sm text-gray-600">
          {application.status === 'draft' && 'This application is not yet published. Publish to make it available to applicants.'}
          {application.status === 'open' && application.deadline && (
            <>Deadline: {formatDate(application.deadline)}</>
          )}
          {application.status === 'closed' && 'Application is closed. No more submissions are accepted.'}
          {application.status === 'scoring' && 'Applications are being reviewed and scored.'}
          {application.status === 'decided' && 'All decisions have been made.'}
        </p>
      </div>

      <div className="flex gap-3">
        {application.status === 'draft' && (
          <button
            onClick={() => onStatusChange('open')}
            className="btn-primary flex items-center gap-2"
          >
            <Play size={18} />
            Publish
          </button>
        )}

        {application.status === 'open' && (
          <button
            onClick={() => onStatusChange('closed')}
            className="btn-primary flex items-center gap-2"
          >
            <Lock size={18} />
            Close Application
          </button>
        )}

        {application.status === 'closed' && (
          <button
            onClick={() => onStatusChange('scoring')}
            className="btn-primary flex items-center gap-2"
          >
            <Zap size={18} />
            Begin Scoring
          </button>
        )}

        {application.status === 'scoring' && (
          <button
            onClick={() => router.push(`/grants/applications/${application.id}/results`)}
            className="btn-primary flex items-center gap-2"
          >
            <Eye size={18} />
            View Results
          </button>
        )}

        {application.status === 'decided' && (
          <>
            <button
              onClick={() => router.push(`/grants/applications/${application.id}/awards`)}
              className="btn-primary flex items-center gap-2"
            >
              <CheckCircle size={18} />
              Award Grants
            </button>
            <button
              onClick={() => onStatusChange('decided')}
              className="btn-secondary flex items-center gap-2"
            >
              <Archive size={18} />
              Archive
            </button>
          </>
        )}
      </div>
    </div>
  );
}

interface TabButtonProps {
  active: boolean;
  onClick: () => void;
  label: string;
}

function TabButton({ active, onClick, label }: TabButtonProps) {
  return (
    <button
      onClick={onClick}
      className={cn(
        'pb-3 px-2 font-medium transition-colors border-b-2',
        active
          ? 'border-blue-600 text-blue-600'
          : 'border-transparent text-gray-600 hover:text-gray-900'
      )}
    >
      {label}
    </button>
  );
}

interface RequestsTabProps {
  requests: ApplicationRequest[];
  selectedRequest: ApplicationRequest | null;
  onSelectRequest: (request: ApplicationRequest | null) => void;
  application: Application;
}

function RequestsTab({
  requests,
  selectedRequest,
  onSelectRequest,
  application,
}: RequestsTabProps) {
  if (requests.length === 0) {
    return (
      <div className="text-center py-12 bg-gray-50 rounded-lg">
        <AlertCircle className="mx-auto mb-3 text-gray-400" size={32} />
        <p className="text-gray-600">No applications submitted yet.</p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-3 gap-6">
      {/* Request List */}
      <div className="col-span-1 border-r">
        <div className="space-y-2">
          {requests.map((request) => (
            <button
              key={request.id}
              onClick={() => onSelectRequest(request)}
              className={cn(
                'w-full text-left p-3 rounded border transition-colors',
                selectedRequest?.id === request.id
                  ? 'bg-blue-50 border-blue-300'
                  : 'border-gray-200 hover:bg-gray-50'
              )}
            >
              <p className="font-medium text-sm">{request.applicant_name}</p>
              <p className="text-xs text-gray-600">{request.applicant_org}</p>
              <p className="text-xs text-gray-500 mt-1 flex items-center gap-1">
                <Clock size={12} />
                {formatDate(request.submitted_at)}
              </p>
            </button>
          ))}
        </div>
      </div>

      {/* Request Detail */}
      <div className="col-span-2">
        {selectedRequest ? (
          <RequestDetail request={selectedRequest} formSchema={application.form_schema} />
        ) : (
          <div className="text-center py-12 bg-gray-50 rounded-lg">
            <p className="text-gray-600">Select a request to view details</p>
          </div>
        )}
      </div>
    </div>
  );
}

interface RequestDetailProps {
  request: ApplicationRequest;
  formSchema: FormSchema;
}

function RequestDetail({ request, formSchema }: RequestDetailProps) {
  return (
    <div>
      <div className="mb-6 pb-4 border-b">
        <h3 className="text-lg font-semibold mb-2">{request.applicant_name}</h3>
        <p className="text-sm text-gray-600 mb-3">{request.applicant_org}</p>
        <p className="text-xs text-gray-500 flex items-center gap-2">
          <Clock size={14} />
          Submitted {formatDate(request.submitted_at)}
        </p>
      </div>

      <div className="space-y-8">
        {formSchema.sections.map((section) => (
          <div key={section.id}>
            <h4 className="font-semibold text-sm uppercase text-gray-600 mb-3">
              {section.title}
            </h4>
            {section.description && (
              <p className="text-sm text-gray-600 mb-3">{section.description}</p>
            )}

            <div className="space-y-4 bg-gray-50 rounded-lg p-4">
              {section.fields.map((field) => {
                const value = request.form_data[field.id];

                return (
                  <div key={field.id}>
                    <p className="text-sm font-medium text-gray-700 mb-1">
                      {field.label}
                    </p>

                    {value ? (
                      <p className="text-sm text-gray-600 p-2 bg-white rounded border">
                        {typeof value === 'string' ? value : JSON.stringify(value)}
                      </p>
                    ) : (
                      <p className="text-sm text-gray-400 italic">Not provided</p>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

interface FormPreviewTabProps {
  formSchema: FormSchema;
}

function FormPreviewTab({ formSchema }: FormPreviewTabProps) {
  return (
    <div className="space-y-8 max-w-2xl">
      {formSchema.sections.map((section) => (
        <div key={section.id}>
          <h3 className="text-lg font-semibold mb-2">{section.title}</h3>
          {section.description && (
            <p className="text-sm text-gray-600 mb-4">{section.description}</p>
          )}

          <div className="space-y-4 bg-gray-50 p-4 rounded-lg">
            {section.fields.map((field) => (
              <FieldPreview key={field.id} field={field} />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

interface FieldPreviewProps {
  field: FormField;
}

function FieldPreview({ field }: FieldPreviewProps) {
  const renderField = () => {
    const baseLabel = (
      <label className="label">
        {field.label}
        {field.required && <span className="text-red-500">*</span>}
      </label>
    );

    switch (field.type) {
      case 'heading':
        return <h4 className="font-semibold text-base">{field.label}</h4>;

      case 'text':
      case 'email':
      case 'phone':
        return (
          <div>
            {baseLabel}
            <input
              type={field.type === 'text' ? 'text' : field.type}
              className="input w-full"
              placeholder={field.placeholder}
              disabled
            />
            {field.helpText && <p className="text-xs text-gray-600 mt-1">{field.helpText}</p>}
          </div>
        );

      case 'number':
      case 'currency':
        return (
          <div>
            {baseLabel}
            <input
              type="number"
              className="input w-full"
              placeholder={field.placeholder}
              disabled
            />
            {field.helpText && <p className="text-xs text-gray-600 mt-1">{field.helpText}</p>}
          </div>
        );

      case 'date':
        return (
          <div>
            {baseLabel}
            <input type="date" className="input w-full" disabled />
            {field.helpText && <p className="text-xs text-gray-600 mt-1">{field.helpText}</p>}
          </div>
        );

      case 'textarea':
        return (
          <div>
            {baseLabel}
            <textarea
              className="input w-full"
              placeholder={field.placeholder}
              rows={4}
              disabled
            />
            {field.helpText && <p className="text-xs text-gray-600 mt-1">{field.helpText}</p>}
          </div>
        );

      case 'select':
        return (
          <div>
            {baseLabel}
            <select className="input w-full" disabled>
              <option>{field.placeholder || 'Select an option...'}</option>
              {field.options?.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
            {field.helpText && <p className="text-xs text-gray-600 mt-1">{field.helpText}</p>}
          </div>
        );

      case 'radio':
        return (
          <div>
            {baseLabel}
            <div className="space-y-2">
              {field.options?.map((opt) => (
                <label key={opt.value} className="flex items-center gap-2 cursor-pointer">
                  <input type="radio" name={field.id} disabled />
                  <span className="text-sm">{opt.label}</span>
                </label>
              ))}
            </div>
            {field.helpText && <p className="text-xs text-gray-600 mt-1">{field.helpText}</p>}
          </div>
        );

      case 'checkbox':
        return (
          <div>
            {baseLabel}
            <div className="space-y-2">
              {field.options?.map((opt) => (
                <label key={opt.value} className="flex items-center gap-2 cursor-pointer">
                  <input type="checkbox" disabled />
                  <span className="text-sm">{opt.label}</span>
                </label>
              ))}
            </div>
            {field.helpText && <p className="text-xs text-gray-600 mt-1">{field.helpText}</p>}
          </div>
        );

      case 'file':
        return (
          <div>
            {baseLabel}
            <input
              type="file"
              className="input w-full"
              disabled
              accept={field.accept}
            />
            {field.helpText && <p className="text-xs text-gray-600 mt-1">{field.helpText}</p>}
          </div>
        );

      default:
        return null;
    }
  };

  return <div>{renderField()}</div>;
}

interface SettingsTabProps {
  application: Application;
}

function SettingsTab({ application }: SettingsTabProps) {
  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h3 className="font-semibold mb-3">Application Details</h3>
        <div className="space-y-3 bg-gray-50 p-4 rounded-lg">
          <div>
            <p className="text-xs text-gray-600 uppercase">Title</p>
            <p className="font-medium">{application.title}</p>
          </div>
          <div>
            <p className="text-xs text-gray-600 uppercase">Description</p>
            <p>{application.description || '—'}</p>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-xs text-gray-600 uppercase">Deadline</p>
              <p>{application.deadline ? formatDate(application.deadline) : '—'}</p>
            </div>
            <div>
              <p className="text-xs text-gray-600 uppercase">Max Award Amount</p>
              <p>
                {application.max_award_amount ? `$${application.max_award_amount.toFixed(2)}` : '—'}
              </p>
            </div>
          </div>
        </div>
      </div>

      <div>
        <h3 className="font-semibold mb-3">Form Configuration</h3>
        <p className="text-sm text-gray-600 mb-4">
          {application.form_schema.sections.length} section{application.form_schema.sections.length !== 1 ? 's' : ''} with{' '}
          {application.form_schema.sections.reduce((sum, s) => sum + s.fields.length, 0)} field
          {application.form_schema.sections.reduce((sum, s) => sum + s.fields.length, 0) !== 1 ? 's' : ''}
        </p>
      </div>
    </div>
  );
}

interface EditApplicationFormProps {
  application: Application;
  onSave: () => void;
}

function EditApplicationForm({ application, onSave }: EditApplicationFormProps) {
  const [title, setTitle] = useState(application.title);
  const [description, setDescription] = useState(application.description || '');
  const [deadline, setDeadline] = useState(application.deadline || '');
  const [maxAmount, setMaxAmount] = useState(application.max_award_amount?.toString() || '');
  const [loading, setLoading] = useState(false);

  const supabase = createClient();

  const handleSave = async () => {
    setLoading(true);

    try {
      const { error } = await supabase
        .from('grant_applications')
        .update({
          title,
          description: description || null,
          deadline: deadline || null,
          max_award_amount: maxAmount ? parseFloat(maxAmount) : null,
        })
        .eq('id', application.id);

      if (error) throw error;

      onSave();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to save');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-4 max-w-2xl">
      <div>
        <label className="label">Title</label>
        <input
          type="text"
          className="input w-full"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
        />
      </div>

      <div>
        <label className="label">Description</label>
        <textarea
          className="input w-full"
          rows={3}
          value={description}
          onChange={(e) => setDescription(e.target.value)}
        />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="label">Deadline</label>
          <input
            type="datetime-local"
            className="input w-full"
            value={deadline}
            onChange={(e) => setDeadline(e.target.value)}
          />
        </div>

        <div>
          <label className="label">Max Award Amount</label>
          <input
            type="number"
            className="input w-full"
            placeholder="0.00"
            min="0"
            step="0.01"
            value={maxAmount}
            onChange={(e) => setMaxAmount(e.target.value)}
          />
        </div>
      </div>

      <div className="flex gap-3">
        <button onClick={handleSave} disabled={loading} className="btn-primary">
          {loading ? 'Saving...' : 'Save Changes'}
        </button>
      </div>
    </div>
  );
}
