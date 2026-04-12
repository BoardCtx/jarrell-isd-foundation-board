'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase';
import AppLayout from '@/components/layout/AppLayout';
import { cn } from '@/lib/utils';
import {
  Plus,
  Trash2,
  ArrowUp,
  ArrowDown,
  Type,
  AlignLeft,
  Hash,
  DollarSign,
  Calendar,
  ChevronDown,
  Circle,
  CheckSquare,
  Upload,
  Mail,
  Phone,
  Heading2,
  Copy,
  AlertCircle,
} from 'lucide-react';

interface FormField {
  id: string;
  type: 'text' | 'textarea' | 'number' | 'currency' | 'date' | 'select' | 'radio' | 'checkbox' | 'file' | 'email' | 'phone' | 'heading';
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

interface ApplicationData {
  title: string;
  description: string;
  deadline?: string;
  maxAwardAmount?: number;
}

const FIELD_TYPES: { type: FormField['type']; label: string; icon: React.ReactNode }[] = [
  { type: 'text', label: 'Text', icon: <Type size={16} /> },
  { type: 'textarea', label: 'Textarea', icon: <AlignLeft size={16} /> },
  { type: 'number', label: 'Number', icon: <Hash size={16} /> },
  { type: 'currency', label: 'Currency', icon: <DollarSign size={16} /> },
  { type: 'date', label: 'Date', icon: <Calendar size={16} /> },
  { type: 'email', label: 'Email', icon: <Mail size={16} /> },
  { type: 'phone', label: 'Phone', icon: <Phone size={16} /> },
  { type: 'select', label: 'Select', icon: <ChevronDown size={16} /> },
  { type: 'radio', label: 'Radio', icon: <Circle size={16} /> },
  { type: 'checkbox', label: 'Checkbox', icon: <CheckSquare size={16} /> },
  { type: 'file', label: 'File', icon: <Upload size={16} /> },
  { type: 'heading', label: 'Heading', icon: <Heading2 size={16} /> },
];

export default function NewApplicationPage() {
  const router = useRouter();
  const supabase = createClient();

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [previousApps, setPreviousApps] = useState<any[]>([]);

  const [appData, setAppData] = useState<ApplicationData>({
    title: '',
    description: '',
  });

  const [formSchema, setFormSchema] = useState<FormSchema>({
    sections: [],
  });

  const [editingField, setEditingField] = useState<{ sectionId: string; fieldId: string } | null>(null);

  // Load previous applications for duplication
  useEffect(() => {
    const loadPreviousApps = async () => {
      const { data } = await supabase
        .from('grant_applications')
        .select('id, title, status')
        .order('created_at', { ascending: false })
        .limit(10);

      if (data) {
        setPreviousApps(data);
      }
    };

    loadPreviousApps();
  }, [supabase]);

  const handleDuplicateApp = async (appId: string) => {
    const { data } = await supabase
      .from('grant_applications')
      .select('form_schema')
      .eq('id', appId)
      .single();

    if (data?.form_schema) {
      setFormSchema(data.form_schema);
    }
  };

  const addSection = () => {
    const newSection: FormSection = {
      id: crypto.randomUUID(),
      title: `Section ${formSchema.sections.length + 1}`,
      fields: [],
    };
    setFormSchema({
      sections: [...formSchema.sections, newSection],
    });
  };

  const updateSection = (sectionId: string, updates: Partial<FormSection>) => {
    setFormSchema({
      sections: formSchema.sections.map((s) =>
        s.id === sectionId ? { ...s, ...updates } : s
      ),
    });
  };

  const deleteSection = (sectionId: string) => {
    setFormSchema({
      sections: formSchema.sections.filter((s) => s.id !== sectionId),
    });
  };

  const moveSection = (sectionId: string, direction: 'up' | 'down') => {
    const idx = formSchema.sections.findIndex((s) => s.id === sectionId);
    if ((direction === 'up' && idx === 0) || (direction === 'down' && idx === formSchema.sections.length - 1)) {
      return;
    }

    const newSections = [...formSchema.sections];
    if (direction === 'up') {
      [newSections[idx], newSections[idx - 1]] = [newSections[idx - 1], newSections[idx]];
    } else {
      [newSections[idx], newSections[idx + 1]] = [newSections[idx + 1], newSections[idx]];
    }

    setFormSchema({ sections: newSections });
  };

  const addField = (sectionId: string, fieldType: FormField['type']) => {
    const newField: FormField = {
      id: crypto.randomUUID(),
      type: fieldType,
      label: '',
      required: false,
      ...(fieldType === 'heading' ? {} : { placeholder: '', helpText: '' }),
      ...(fieldType === 'select' || fieldType === 'radio' || fieldType === 'checkbox'
        ? { options: [{ label: 'Option 1', value: 'opt1' }] }
        : {}),
    };

    setFormSchema({
      sections: formSchema.sections.map((s) =>
        s.id === sectionId
          ? { ...s, fields: [...s.fields, newField] }
          : s
      ),
    });

    setEditingField({ sectionId, fieldId: newField.id });
  };

  const updateField = (sectionId: string, fieldId: string, updates: Partial<FormField>) => {
    setFormSchema({
      sections: formSchema.sections.map((s) =>
        s.id === sectionId
          ? {
              ...s,
              fields: s.fields.map((f) =>
                f.id === fieldId ? { ...f, ...updates } : f
              ),
            }
          : s
      ),
    });
  };

  const deleteField = (sectionId: string, fieldId: string) => {
    setFormSchema({
      sections: formSchema.sections.map((s) =>
        s.id === sectionId
          ? {
              ...s,
              fields: s.fields.filter((f) => f.id !== fieldId),
            }
          : s
      ),
    });
  };

  const moveField = (sectionId: string, fieldId: string, direction: 'up' | 'down') => {
    setFormSchema({
      sections: formSchema.sections.map((s) => {
        if (s.id !== sectionId) return s;

        const idx = s.fields.findIndex((f) => f.id === fieldId);
        if ((direction === 'up' && idx === 0) || (direction === 'down' && idx === s.fields.length - 1)) {
          return s;
        }

        const newFields = [...s.fields];
        if (direction === 'up') {
          [newFields[idx], newFields[idx - 1]] = [newFields[idx - 1], newFields[idx]];
        } else {
          [newFields[idx], newFields[idx + 1]] = [newFields[idx + 1], newFields[idx]];
        }

        return { ...s, fields: newFields };
      }),
    });
  };

  const addOption = (sectionId: string, fieldId: string) => {
    setFormSchema({
      sections: formSchema.sections.map((s) =>
        s.id === sectionId
          ? {
              ...s,
              fields: s.fields.map((f) => {
                if (f.id === fieldId && f.options) {
                  return {
                    ...f,
                    options: [...f.options, { label: `Option ${f.options.length + 1}`, value: `opt${f.options.length + 1}` }],
                  };
                }
                return f;
              }),
            }
          : s
      ),
    });
  };

  const updateOption = (sectionId: string, fieldId: string, optionIdx: number, label: string, value: string) => {
    setFormSchema({
      sections: formSchema.sections.map((s) =>
        s.id === sectionId
          ? {
              ...s,
              fields: s.fields.map((f) => {
                if (f.id === fieldId && f.options) {
                  const newOptions = [...f.options];
                  newOptions[optionIdx] = { label, value };
                  return { ...f, options: newOptions };
                }
                return f;
              }),
            }
          : s
      ),
    });
  };

  const deleteOption = (sectionId: string, fieldId: string, optionIdx: number) => {
    setFormSchema({
      sections: formSchema.sections.map((s) =>
        s.id === sectionId
          ? {
              ...s,
              fields: s.fields.map((f) => {
                if (f.id === fieldId && f.options && f.options.length > 1) {
                  const newOptions = f.options.filter((_, idx) => idx !== optionIdx);
                  return { ...f, options: newOptions };
                }
                return f;
              }),
            }
          : s
      ),
    });
  };

  const handleSave = async (status: 'draft' | 'open') => {
    if (!appData.title.trim()) {
      setError('Application title is required');
      return;
    }

    if (formSchema.sections.length === 0 || formSchema.sections.every((s) => s.fields.length === 0)) {
      setError('At least one field is required in the form');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const { data: user } = await supabase.auth.getUser();

      const { error: insertError } = await supabase
        .from('grant_applications')
        .insert({
          title: appData.title,
          description: appData.description || null,
          deadline: appData.deadline || null,
          max_award_amount: appData.maxAwardAmount || null,
          form_schema: formSchema,
          status,
          created_by: user.user?.id,
        });

      if (insertError) throw insertError;

      router.push('/grants/applications');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save application');
    } finally {
      setLoading(false);
    }
  };

  const getFieldIcon = (type: FormField['type']) => {
    const item = FIELD_TYPES.find((ft) => ft.type === type);
    return item?.icon;
  };

  return (
    <AppLayout>
      <div className="p-8 max-w-7xl mx-auto">
        <div className="page-header mb-8">
          <h1 className="text-3xl font-bold mb-2">Create New Application</h1>
          <p className="text-gray-600">Build a grant application form for applicants to complete.</p>
        </div>

        {error && (
          <div className="mb-6 bg-red-50 border border-red-200 rounded-lg p-4 flex gap-3">
            <AlertCircle className="text-red-600 flex-shrink-0" size={20} />
            <p className="text-red-700">{error}</p>
          </div>
        )}

        <div className="grid grid-cols-3 gap-6 mb-8">
          <div className="col-span-2">
            {/* Application Details */}
            <div className="card mb-6">
              <h2 className="font-semibold mb-4 text-lg">Application Details</h2>

              <div className="space-y-4">
                <div>
                  <label className="label">
                    Title <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    className="input w-full"
                    placeholder="Grant Application Title"
                    value={appData.title}
                    onChange={(e) => setAppData({ ...appData, title: e.target.value })}
                  />
                </div>

                <div>
                  <label className="label">Description</label>
                  <textarea
                    className="input w-full"
                    placeholder="Describe this grant opportunity..."
                    rows={3}
                    value={appData.description}
                    onChange={(e) => setAppData({ ...appData, description: e.target.value })}
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="label">Deadline (optional)</label>
                    <input
                      type="datetime-local"
                      className="input w-full"
                      value={appData.deadline || ''}
                      onChange={(e) => setAppData({ ...appData, deadline: e.target.value })}
                    />
                  </div>

                  <div>
                    <label className="label">Max Award Amount (optional)</label>
                    <input
                      type="number"
                      className="input w-full"
                      placeholder="0.00"
                      min="0"
                      step="0.01"
                      value={appData.maxAwardAmount || ''}
                      onChange={(e) =>
                        setAppData({ ...appData, maxAwardAmount: e.target.value ? parseFloat(e.target.value) : undefined })
                      }
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Duplicate From Previous */}
            {previousApps.length > 0 && (
              <div className="card mb-6">
                <h3 className="font-semibold mb-3 flex items-center gap-2">
                  <Copy size={18} />
                  Duplicate from Existing
                </h3>
                <select
                  className="input w-full"
                  defaultValue=""
                  onChange={(e) => {
                    if (e.target.value) {
                      handleDuplicateApp(e.target.value);
                      e.target.value = '';
                    }
                  }}
                >
                  <option value="">Select an application to copy from...</option>
                  {previousApps.map((app) => (
                    <option key={app.id} value={app.id}>
                      {app.title} ({app.status})
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>

          {/* Sidebar Actions */}
          <div>
            <div className="card sticky top-8">
              <h3 className="font-semibold mb-4">Actions</h3>
              <div className="space-y-3">
                <button
                  onClick={() => handleSave('draft')}
                  disabled={loading}
                  className="btn-secondary w-full"
                >
                  {loading ? 'Saving...' : 'Save as Draft'}
                </button>
                <button
                  onClick={() => handleSave('open')}
                  disabled={loading}
                  className="btn-primary w-full"
                >
                  {loading ? 'Publishing...' : 'Publish Application'}
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Form Builder */}
        <div className="card">
          <div className="flex items-center justify-between mb-6 pb-4 border-b">
            <h2 className="font-semibold text-lg">Form Builder</h2>
            <button onClick={addSection} className="btn-primary flex items-center gap-2">
              <Plus size={18} />
              Add Section
            </button>
          </div>

          {formSchema.sections.length === 0 ? (
            <div className="text-center py-12 bg-gray-50 rounded-lg border-2 border-dashed border-gray-300">
              <p className="text-gray-600 mb-4">No sections yet. Click "Add Section" to get started.</p>
            </div>
          ) : (
            <div className="space-y-6">
              {formSchema.sections.map((section, sectionIdx) => (
                <div
                  key={section.id}
                  className="border border-gray-200 rounded-lg p-4 bg-gray-50"
                >
                  {/* Section Header */}
                  <div className="flex gap-3 mb-4">
                    <div className="flex-1">
                      <input
                        type="text"
                        className="input w-full font-semibold"
                        placeholder="Section Title"
                        value={section.title}
                        onChange={(e) => updateSection(section.id, { title: e.target.value })}
                      />
                      <input
                        type="text"
                        className="input w-full text-sm mt-2"
                        placeholder="Section Description (optional)"
                        value={section.description || ''}
                        onChange={(e) => updateSection(section.id, { description: e.target.value })}
                      />
                    </div>

                    <div className="flex gap-1 flex-shrink-0">
                      <button
                        onClick={() => moveSection(section.id, 'up')}
                        disabled={sectionIdx === 0}
                        className={cn(
                          'p-2 rounded border',
                          sectionIdx === 0
                            ? 'bg-gray-100 text-gray-300 cursor-not-allowed'
                            : 'bg-white text-gray-600 hover:bg-gray-100'
                        )}
                        title="Move up"
                      >
                        <ArrowUp size={16} />
                      </button>
                      <button
                        onClick={() => moveSection(section.id, 'down')}
                        disabled={sectionIdx === formSchema.sections.length - 1}
                        className={cn(
                          'p-2 rounded border',
                          sectionIdx === formSchema.sections.length - 1
                            ? 'bg-gray-100 text-gray-300 cursor-not-allowed'
                            : 'bg-white text-gray-600 hover:bg-gray-100'
                        )}
                        title="Move down"
                      >
                        <ArrowDown size={16} />
                      </button>
                      <button
                        onClick={() => deleteSection(section.id)}
                        className="p-2 rounded border bg-white text-red-600 hover:bg-red-50"
                        title="Delete section"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </div>

                  {/* Fields in Section */}
                  <div className="space-y-3 mb-4">
                    {section.fields.length === 0 ? (
                      <div className="text-center py-6 bg-white rounded border-2 border-dashed">
                        <p className="text-gray-400 text-sm mb-3">No fields in this section yet</p>
                      </div>
                    ) : (
                      section.fields.map((field, fieldIdx) => (
                        <div
                          key={field.id}
                          className={cn(
                            'bg-white p-3 rounded border-l-4 flex items-start gap-3 cursor-pointer transition-colors',
                            editingField?.fieldId === field.id ? 'border-blue-500 bg-blue-50' : 'border-gray-300 hover:bg-gray-50'
                          )}
                          onClick={() => setEditingField({ sectionId: section.id, fieldId: field.id })}
                        >
                          <div className="flex-shrink-0 mt-1 text-gray-400">{getFieldIcon(field.type)}</div>

                          <div className="flex-1 min-w-0">
                            <p className="font-medium text-sm">
                              {field.label || `(Untitled ${field.type})`}{' '}
                              {field.required && <span className="text-red-500">*</span>}
                            </p>
                            {field.helpText && <p className="text-xs text-gray-500 mt-1">{field.helpText}</p>}
                          </div>

                          <div className="flex gap-1 flex-shrink-0">
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                moveField(section.id, field.id, 'up');
                              }}
                              disabled={fieldIdx === 0}
                              className={cn(
                                'p-1.5 rounded border text-xs',
                                fieldIdx === 0
                                  ? 'bg-gray-100 text-gray-300 cursor-not-allowed'
                                  : 'bg-white text-gray-600 hover:bg-gray-100'
                              )}
                            >
                              <ArrowUp size={14} />
                            </button>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                moveField(section.id, field.id, 'down');
                              }}
                              disabled={fieldIdx === section.fields.length - 1}
                              className={cn(
                                'p-1.5 rounded border text-xs',
                                fieldIdx === section.fields.length - 1
                                  ? 'bg-gray-100 text-gray-300 cursor-not-allowed'
                                  : 'bg-white text-gray-600 hover:bg-gray-100'
                              )}
                            >
                              <ArrowDown size={14} />
                            </button>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                deleteField(section.id, field.id);
                                if (editingField?.fieldId === field.id) {
                                  setEditingField(null);
                                }
                              }}
                              className="p-1.5 rounded border bg-white text-red-600 hover:bg-red-50 text-xs"
                            >
                              <Trash2 size={14} />
                            </button>
                          </div>
                        </div>
                      ))
                    )}
                  </div>

                  {/* Add Field Button */}
                  <div className="relative">
                    <button
                      className="relative group w-full py-2 px-3 text-sm text-gray-600 border border-gray-300 rounded bg-white hover:bg-gray-50 flex items-center gap-2 justify-center"
                      onClick={() => {
                        const menu = document.getElementById(`field-menu-${section.id}`);
                        if (menu) {
                          menu.classList.toggle('hidden');
                        }
                      }}
                    >
                      <Plus size={16} />
                      Add Field
                    </button>

                    <div
                      id={`field-menu-${section.id}`}
                      className="hidden absolute z-10 top-full left-0 right-0 mt-2 bg-white border border-gray-300 rounded shadow-lg"
                    >
                      <div className="grid grid-cols-3 gap-2 p-3">
                        {FIELD_TYPES.map((ft) => (
                          <button
                            key={ft.type}
                            onClick={() => {
                              addField(section.id, ft.type);
                              const menu = document.getElementById(`field-menu-${section.id}`);
                              if (menu) {
                                menu.classList.add('hidden');
                              }
                            }}
                            className="flex items-center gap-2 px-3 py-2 text-xs text-gray-700 hover:bg-gray-100 rounded border border-transparent hover:border-gray-200"
                          >
                            {ft.icon}
                            <span>{ft.label}</span>
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>

                  {/* Field Editor */}
                  {editingField?.sectionId === section.id && (
                    <FieldEditor
                      field={section.fields.find((f) => f.id === editingField.fieldId)!}
                      sectionId={section.id}
                      onUpdate={(updates) => updateField(section.id, editingField.fieldId, updates)}
                      onAddOption={() => addOption(section.id, editingField.fieldId)}
                      onUpdateOption={(idx, label, value) =>
                        updateOption(section.id, editingField.fieldId, idx, label, value)
                      }
                      onDeleteOption={(idx) => deleteOption(section.id, editingField.fieldId, idx)}
                    />
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </AppLayout>
  );
}

interface FieldEditorProps {
  field: FormField;
  sectionId: string;
  onUpdate: (updates: Partial<FormField>) => void;
  onAddOption: () => void;
  onUpdateOption: (idx: number, label: string, value: string) => void;
  onDeleteOption: (idx: number) => void;
}

function FieldEditor({
  field,
  onUpdate,
  onAddOption,
  onUpdateOption,
  onDeleteOption,
}: FieldEditorProps) {
  return (
    <div className="mt-4 p-4 bg-blue-50 border border-blue-200 rounded-lg">
      <h4 className="font-semibold text-sm mb-3 text-blue-900">Field Configuration</h4>

      <div className="space-y-3">
        {field.type !== 'heading' && (
          <>
            <div>
              <label className="label text-sm">
                Label <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                className="input w-full text-sm"
                placeholder="Field label shown to applicants"
                value={field.label}
                onChange={(e) => onUpdate({ label: e.target.value })}
              />
            </div>

            <div>
              <label className="flex items-center gap-2 text-sm cursor-pointer">
                <input
                  type="checkbox"
                  checked={field.required}
                  onChange={(e) => onUpdate({ required: e.target.checked })}
                  className="rounded"
                />
                <span>Required field</span>
              </label>
            </div>

            <div>
              <label className="label text-sm">Placeholder</label>
              <input
                type="text"
                className="input w-full text-sm"
                placeholder="e.g., Enter your name..."
                value={field.placeholder || ''}
                onChange={(e) => onUpdate({ placeholder: e.target.value })}
              />
            </div>

            <div>
              <label className="label text-sm">Help Text</label>
              <textarea
                className="input w-full text-sm"
                rows={2}
                placeholder="Additional guidance for applicants (optional)"
                value={field.helpText || ''}
                onChange={(e) => onUpdate({ helpText: e.target.value })}
              />
            </div>

            {(field.type === 'text' || field.type === 'email') && (
              <div>
                <label className="label text-sm">Max Length</label>
                <input
                  type="number"
                  className="input w-full text-sm"
                  min="1"
                  placeholder="Leave blank for unlimited"
                  value={field.maxLength || ''}
                  onChange={(e) => onUpdate({ maxLength: e.target.value ? parseInt(e.target.value) : undefined })}
                />
              </div>
            )}

            {field.type === 'file' && (
              <div>
                <label className="label text-sm">Accepted File Types</label>
                <input
                  type="text"
                  className="input w-full text-sm"
                  placeholder="e.g., .pdf,.doc,.docx or .jpg,.png"
                  value={field.accept || ''}
                  onChange={(e) => onUpdate({ accept: e.target.value })}
                />
              </div>
            )}
          </>
        )}

        {field.type === 'heading' && (
          <div>
            <label className="label text-sm">Heading Text</label>
            <input
              type="text"
              className="input w-full text-sm font-semibold"
              placeholder="Section heading"
              value={field.label}
              onChange={(e) => onUpdate({ label: e.target.value })}
            />
          </div>
        )}

        {(field.type === 'select' || field.type === 'radio' || field.type === 'checkbox') && (
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="label text-sm">Options</label>
              <button
                onClick={onAddOption}
                className="text-xs text-blue-600 hover:text-blue-700 font-medium flex items-center gap-1"
              >
                <Plus size={14} />
                Add Option
              </button>
            </div>

            <div className="space-y-2 max-h-48 overflow-y-auto">
              {field.options?.map((option, idx) => (
                <div key={idx} className="flex gap-2">
                  <input
                    type="text"
                    className="input flex-1 text-sm"
                    placeholder="Option label"
                    value={option.label}
                    onChange={(e) => onUpdateOption(idx, e.target.value, option.value)}
                  />
                  <input
                    type="text"
                    className="input flex-1 text-sm"
                    placeholder="Value"
                    value={option.value}
                    onChange={(e) => onUpdateOption(idx, option.label, e.target.value)}
                  />
                  <button
                    onClick={() => onDeleteOption(idx)}
                    disabled={field.options!.length === 1}
                    className={cn(
                      'p-2 rounded border',
                      field.options!.length === 1
                        ? 'bg-gray-100 text-gray-300 cursor-not-allowed'
                        : 'bg-white text-red-600 hover:bg-red-50'
                    )}
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
