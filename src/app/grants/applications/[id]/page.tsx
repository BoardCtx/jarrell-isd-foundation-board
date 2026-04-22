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
  Shield,
  UserPlus,
  Check,
  Loader2,
  Mail,
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

type TabType = 'requests' | 'preview' | 'evaluators' | 'settings';

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
              active={activeTab === 'evaluators'}
              onClick={() => setActiveTab('evaluators')}
              label="Evaluators"
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

          {activeTab === 'evaluators' && (
            <EvaluatorsTab applicationId={application.id} />
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
  const supabase = createClient();
  const [internalVis, setInternalVis] = useState(false);
  const [externalVis, setExternalVis] = useState(false);
  const [savingVis, setSavingVis] = useState(false);

  useEffect(() => {
    // Load current visibility settings
    const loadVis = async () => {
      const { data } = await supabase
        .from('grant_applications')
        .select('internal_evaluator_past_visibility, external_evaluator_past_visibility')
        .eq('id', application.id)
        .single();
      if (data) {
        setInternalVis(data.internal_evaluator_past_visibility);
        setExternalVis(data.external_evaluator_past_visibility);
      }
    };
    loadVis();
  }, [application.id]);

  const saveVisibility = async (field: string, value: boolean) => {
    setSavingVis(true);
    await supabase
      .from('grant_applications')
      .update({ [field]: value })
      .eq('id', application.id);
    setSavingVis(false);
  };

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
            <p>{application.description || '\u2014'}</p>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-xs text-gray-600 uppercase">Deadline</p>
              <p>{application.deadline ? formatDate(application.deadline) : '\u2014'}</p>
            </div>
            <div>
              <p className="text-xs text-gray-600 uppercase">Max Award Amount</p>
              <p>
                {application.max_award_amount ? `$${application.max_award_amount.toFixed(2)}` : '\u2014'}
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

      {/* Evaluator Visibility Settings */}
      <div>
        <h3 className="font-semibold mb-3 flex items-center gap-2">
          <Eye className="w-4 h-4 text-gray-600" />
          Evaluator Visibility (Past/Closed)
        </h3>
        <p className="text-sm text-gray-500 mb-4">
          Control whether evaluators can see this application after scoring is complete.
        </p>
        <div className="space-y-3">
          <label className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg cursor-pointer">
            <input
              type="checkbox"
              checked={internalVis}
              onChange={(e) => {
                setInternalVis(e.target.checked);
                saveVisibility('internal_evaluator_past_visibility', e.target.checked);
              }}
              className="w-4 h-4 rounded"
            />
            <div>
              <p className="text-sm font-medium text-gray-900">Internal evaluators (Committee)</p>
              <p className="text-xs text-gray-500">Allow internal committee members to view past/closed requests</p>
            </div>
          </label>
          <label className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg cursor-pointer">
            <input
              type="checkbox"
              checked={externalVis}
              onChange={(e) => {
                setExternalVis(e.target.checked);
                saveVisibility('external_evaluator_past_visibility', e.target.checked);
              }}
              className="w-4 h-4 rounded"
            />
            <div>
              <p className="text-sm font-medium text-gray-900">External evaluators</p>
              <p className="text-xs text-gray-500">Allow external evaluators to view past/closed requests</p>
            </div>
          </label>
        </div>
      </div>

      {/* Applicant Invite Links */}
      <InviteLinksSection applicationId={application.id} />

      {/* Email Invite */}
      <EmailInviteSection applicationId={application.id} />
    </div>
  );
}

// ── Invite Links Section ─────────────────────────────────────────────────────

function InviteLinksSection({ applicationId }: { applicationId: string }) {
  const [invites, setInvites] = useState<any[]>([]);
  const [creating, setCreating] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  useEffect(() => {
    loadInvites();
  }, []);

  const loadInvites = async () => {
    const res = await fetch(`/api/grants/invite-links?applicationId=${applicationId}`);
    const data = await res.json();
    if (data.invites) setInvites(data.invites);
  };

  const createLink = async () => {
    setCreating(true);
    const res = await fetch('/api/grants/invite-links', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ applicationId }),
    });
    if (res.ok) await loadInvites();
    setCreating(false);
  };

  const deactivateLink = async (inviteId: string) => {
    await fetch('/api/grants/invite-links', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ inviteId }),
    });
    await loadInvites();
  };

  const copyLink = (token: string, id: string) => {
    const url = `${window.location.origin}/grants/apply/${token}`;
    navigator.clipboard.writeText(url);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const activeInvites = invites.filter(i => i.is_active);

  return (
    <div>
      <h3 className="font-semibold mb-3 flex items-center gap-2">
        <UserPlus className="w-4 h-4 text-gray-600" />
        Shareable Apply Links
      </h3>
      <p className="text-sm text-gray-500 mb-4">
        Create links that anyone can use to register and apply to this grant.
      </p>

      {activeInvites.length > 0 && (
        <div className="space-y-2 mb-4">
          {activeInvites.map(invite => (
            <div key={invite.id} className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
              <div className="flex-1 min-w-0">
                <p className="text-xs font-mono text-gray-500 truncate">
                  {window.location.origin}/grants/apply/{invite.invite_token}
                </p>
                <p className="text-xs text-gray-400 mt-1">
                  Used {invite.use_count} time{invite.use_count !== 1 ? 's' : ''}
                  {invite.max_uses ? ` / max ${invite.max_uses}` : ''}
                  {' \u00b7 '}Created {new Date(invite.created_at).toLocaleDateString()}
                </p>
              </div>
              <button
                onClick={() => copyLink(invite.invite_token, invite.id)}
                className="btn-secondary text-xs px-2 py-1"
              >
                {copiedId === invite.id ? 'Copied!' : 'Copy'}
              </button>
              <button
                onClick={() => deactivateLink(invite.id)}
                className="text-red-500 hover:text-red-700 text-xs"
              >
                Deactivate
              </button>
            </div>
          ))}
        </div>
      )}

      <button onClick={createLink} disabled={creating} className="btn-secondary text-sm flex items-center gap-2">
        <UserPlus className="w-4 h-4" />
        {creating ? 'Creating...' : 'Generate New Link'}
      </button>
    </div>
  );
}

// ── Email Invite Section ─────────────────────────────────────────────────────

function EmailInviteSection({ applicationId }: { applicationId: string }) {
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [sending, setSending] = useState(false);
  const [message, setMessage] = useState('');

  const handleSend = async () => {
    if (!email) return;
    setSending(true);
    setMessage('');

    try {
      const res = await fetch('/api/grants/send-applicant-invite', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ applicationId, email, fullName: name }),
      });

      const data = await res.json();
      if (res.ok) {
        setMessage(`Invitation sent to ${email}`);
        setEmail('');
        setName('');
      } else {
        setMessage(data.error || 'Failed to send');
      }
    } catch (err) {
      setMessage('Failed to send invite');
    }
    setSending(false);
  };

  return (
    <div>
      <h3 className="font-semibold mb-3 flex items-center gap-2">
        <Mail className="w-4 h-4 text-gray-600" />
        Email Invitation
      </h3>
      <p className="text-sm text-gray-500 mb-4">
        Send a personalized invitation to a specific applicant.
      </p>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-3">
        <div>
          <label className="label">Email *</label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="input"
            placeholder="applicant@example.com"
          />
        </div>
        <div>
          <label className="label">Name (optional)</label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="input"
            placeholder="Jane Doe"
          />
        </div>
      </div>
      {message && (
        <p className={`text-sm mb-3 ${message.includes('sent') ? 'text-green-600' : 'text-red-600'}`}>
          {message}
        </p>
      )}
      <button onClick={handleSend} disabled={sending || !email} className="btn-primary text-sm flex items-center gap-2">
        <Mail className="w-4 h-4" />
        {sending ? 'Sending...' : 'Send Invitation'}
      </button>
    </div>
  );
}

// ── Evaluators Tab ───────────────────────────────────────────────────────────

function EvaluatorsTab({ applicationId }: { applicationId: string }) {
  const supabase = createClient();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);
  const [approvedEvaluators, setApprovedEvaluators] = useState<any[]>([]);
  const [assignedIds, setAssignedIds] = useState<Set<string>>(new Set());
  const [notifying, setNotifying] = useState(false);
  const [notifyMessage, setNotifyMessage] = useState('');

  useEffect(() => {
    loadEvaluators();
  }, []);

  const loadEvaluators = async () => {
    // Get all approved evaluators
    const { data: evals } = await supabase
      .from('grant_evaluators')
      .select('*')
      .eq('status', 'approved')
      .order('full_name');

    // Get current assignments for this application
    const { data: assignments } = await supabase
      .from('grant_evaluator_assignments')
      .select('evaluator_id')
      .eq('application_id', applicationId);

    setApprovedEvaluators(evals || []);
    setAssignedIds(new Set((assignments || []).map(a => a.evaluator_id)));
    setLoading(false);
  };

  const toggleAssignment = async (evaluatorId: string) => {
    setSaving(evaluatorId);
    const isAssigned = assignedIds.has(evaluatorId);

    if (isAssigned) {
      // Remove assignment
      await supabase
        .from('grant_evaluator_assignments')
        .delete()
        .eq('application_id', applicationId)
        .eq('evaluator_id', evaluatorId);

      setAssignedIds(prev => {
        const next = new Set(prev);
        next.delete(evaluatorId);
        return next;
      });
    } else {
      // Add assignment
      const { data: { user } } = await supabase.auth.getUser();
      await supabase
        .from('grant_evaluator_assignments')
        .insert({
          application_id: applicationId,
          evaluator_id: evaluatorId,
          assigned_by: user?.id || null,
        });

      setAssignedIds(prev => new Set([...prev, evaluatorId]));
    }
    setSaving(null);
  };

  const notifyAssigned = async () => {
    setNotifying(true);
    setNotifyMessage('');
    try {
      // Get assigned evaluator emails
      const assigned = approvedEvaluators.filter(e => assignedIds.has(e.id));
      if (assigned.length === 0) {
        setNotifyMessage('No evaluators are assigned.');
        setNotifying(false);
        return;
      }

      const res = await fetch('/api/grants/invite-evaluator', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'notify_assigned',
          applicationId,
          evaluatorEmails: assigned.map(e => e.email),
          evaluatorNames: assigned.map(e => e.full_name),
        }),
      });

      setNotifyMessage(`Notification sent to ${assigned.length} evaluator(s)`);
    } catch (err) {
      setNotifyMessage('Failed to send notifications');
    }
    setNotifying(false);
  };

  if (loading) {
    return <div className="py-8 text-center text-gray-500">Loading evaluators...</div>;
  }

  return (
    <div className="max-w-2xl">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="font-semibold text-gray-900 flex items-center gap-2">
            <Shield className="w-5 h-5 text-emerald-600" />
            External Evaluator Assignments
          </h3>
          <p className="text-sm text-gray-500 mt-1">
            {assignedIds.size} of {approvedEvaluators.length} evaluator{approvedEvaluators.length !== 1 ? 's' : ''} assigned
          </p>
        </div>
        {assignedIds.size > 0 && (
          <button
            onClick={notifyAssigned}
            disabled={notifying}
            className="btn-secondary text-sm flex items-center gap-2"
          >
            <Mail className="w-4 h-4" />
            {notifying ? 'Sending...' : 'Notify Assigned'}
          </button>
        )}
      </div>

      {notifyMessage && (
        <div className={`mb-4 p-3 rounded-lg text-sm ${notifyMessage.includes('sent') ? 'bg-green-50 text-green-700 border border-green-200' : 'bg-red-50 text-red-700 border border-red-200'}`}>
          {notifyMessage}
        </div>
      )}

      {approvedEvaluators.length === 0 ? (
        <div className="bg-gray-50 rounded-lg p-8 text-center">
          <Shield className="w-10 h-10 text-gray-300 mx-auto mb-3" />
          <p className="text-gray-500 mb-2">No approved evaluators yet.</p>
          <p className="text-sm text-gray-400">
            <a href="/grants/evaluators" className="text-primary hover:underline">Manage evaluators</a> to invite and approve external reviewers.
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {approvedEvaluators.map(evaluator => {
            const isAssigned = assignedIds.has(evaluator.id);
            return (
              <label
                key={evaluator.id}
                className={cn(
                  'flex items-center gap-4 p-4 rounded-lg border-2 cursor-pointer transition-all',
                  isAssigned ? 'border-emerald-300 bg-emerald-50' : 'border-gray-200 hover:border-gray-300 bg-white'
                )}
              >
                {saving === evaluator.id ? (
                  <Loader2 className="w-5 h-5 animate-spin text-gray-400 flex-shrink-0" />
                ) : (
                  <input
                    type="checkbox"
                    checked={isAssigned}
                    onChange={() => toggleAssignment(evaluator.id)}
                    className="w-5 h-5 rounded flex-shrink-0"
                  />
                )}
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-gray-900">{evaluator.full_name}</p>
                  <p className="text-sm text-gray-500">{evaluator.email}</p>
                </div>
                {evaluator.organization && (
                  <span className="text-xs text-gray-400">{evaluator.organization}</span>
                )}
                {isAssigned && (
                  <span className="badge bg-emerald-100 text-emerald-700">Assigned</span>
                )}
              </label>
            );
          })}
        </div>
      )}
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
