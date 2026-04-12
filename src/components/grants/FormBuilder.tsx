'use client';

import { useState, useCallback } from 'react';
import { createClient } from '@/lib/supabase';
import { Upload, X, Loader2 } from 'lucide-react';

export interface FormField {
  id: string;
  type: 'text' | 'textarea' | 'number' | 'currency' | 'date' | 'select' | 'radio' | 'checkbox' | 'file' | 'email' | 'phone' | 'heading';
  label: string;
  required: boolean;
  placeholder?: string;
  helpText?: string;
  options?: { label: string; value: string }[];
}

export interface FormSection {
  id: string;
  title: string;
  description?: string;
  fields: FormField[];
}

export interface FormSchema {
  sections: FormSection[];
}

interface FormBuilderProps {
  schema: FormSchema;
  initialData?: Record<string, any>;
  onSave: (data: Record<string, any>) => Promise<void>;
  onSubmit: (data: Record<string, any>) => Promise<void>;
  showSaveButton?: boolean;
  showSubmitButton?: boolean;
  submitButtonText?: string;
  isReadOnly?: boolean;
}

export default function FormBuilder({
  schema,
  initialData = {},
  onSave,
  onSubmit,
  showSaveButton = true,
  showSubmitButton = true,
  submitButtonText = 'Submit Request',
  isReadOnly = false,
}: FormBuilderProps) {
  const [formData, setFormData] = useState<Record<string, any>>(initialData);
  const [savedIndicator, setSavedIndicator] = useState(false);
  const [saving, setSaving] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [uploadingFiles, setUploadingFiles] = useState<Record<string, boolean>>({});
  const supabase = createClient();

  const handleInputChange = (fieldId: string, value: any) => {
    setFormData(prev => ({
      ...prev,
      [fieldId]: value,
    }));
  };

  const handleFileUpload = async (fieldId: string, files: FileList) => {
    if (!files.length) return;

    setUploadingFiles(prev => ({ ...prev, [fieldId]: true }));

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const uploadedFiles = [];

      for (const file of Array.from(files)) {
        const fileExtension = file.name.split('.').pop();
        const fileName = `${Date.now()}_${Math.random().toString(36).substring(7)}.${fileExtension}`;
        const filePath = `${user.id}/${fieldId}/${fileName}`;

        const { error: uploadError } = await supabase.storage
          .from('grant-files')
          .upload(filePath, file);

        if (uploadError) throw uploadError;

        uploadedFiles.push({
          name: file.name,
          path: filePath,
          size: file.size,
          type: file.type,
        });
      }

      setFormData(prev => ({
        ...prev,
        [fieldId]: (prev[fieldId] || []).concat(uploadedFiles),
      }));
    } catch (err) {
      console.error('Upload error:', err);
      setErrors(prev => ({
        ...prev,
        [fieldId]: 'Failed to upload file',
      }));
    } finally {
      setUploadingFiles(prev => ({ ...prev, [fieldId]: false }));
    }
  };

  const handleRemoveFile = (fieldId: string, index: number) => {
    setFormData(prev => ({
      ...prev,
      [fieldId]: prev[fieldId].filter((_: any, i: number) => i !== index),
    }));
  };

  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {};

    schema.sections.forEach(section => {
      section.fields.forEach(field => {
        if (field.required && !formData[field.id]) {
          newErrors[field.id] = `${field.label} is required`;
        }
      });
    });

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSaveProgress = async () => {
    setSaving(true);
    try {
      await onSave(formData);
      setSavedIndicator(true);
      setTimeout(() => setSavedIndicator(false), 3000);
    } catch (err) {
      console.error('Save error:', err);
    } finally {
      setSaving(false);
    }
  };

  const handleSubmit = async () => {
    if (!validateForm()) {
      return;
    }

    setSubmitting(true);
    try {
      await onSubmit(formData);
    } catch (err) {
      console.error('Submit error:', err);
    } finally {
      setSubmitting(false);
    }
  };

  const renderField = (field: FormField) => {
    const fieldValue = formData[field.id];
    const hasError = errors[field.id];

    if (field.type === 'heading') {
      return (
        <div key={field.id} className="pt-4 mt-4 border-t border-gray-200">
          <h3 className="text-lg font-semibold text-gray-900">{field.label}</h3>
          {field.helpText && <p className="text-sm text-gray-600 mt-1">{field.helpText}</p>}
        </div>
      );
    }

    if (isReadOnly && field.type === 'file') {
      return (
        <div key={field.id} className="mb-4">
          <label className="label">{field.label}</label>
          {Array.isArray(fieldValue) && fieldValue.length > 0 ? (
            <div className="space-y-2">
              {fieldValue.map((file: any, idx: number) => (
                <div key={idx} className="flex items-center gap-2 p-2 bg-gray-50 rounded">
                  <span className="text-sm text-gray-600">{file.name}</span>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-gray-500">No files uploaded</p>
          )}
        </div>
      );
    }

    if (isReadOnly) {
      return (
        <div key={field.id} className="mb-4">
          <label className="label">{field.label}</label>
          <div className="p-3 bg-gray-50 rounded-lg text-gray-700 text-sm">
            {field.type === 'textarea' ? (
              <pre className="whitespace-pre-wrap break-words font-sans">{fieldValue || '(not filled)'}</pre>
            ) : (
              <span>{fieldValue || '(not filled)'}</span>
            )}
          </div>
        </div>
      );
    }

    return (
      <div key={field.id} className="mb-4">
        <label className="label" htmlFor={field.id}>
          {field.label} {field.required && <span className="text-red-600">*</span>}
        </label>

        {field.type === 'text' && (
          <input
            id={field.id}
            type="text"
            value={fieldValue || ''}
            onChange={(e) => handleInputChange(field.id, e.target.value)}
            className="input"
            placeholder={field.placeholder}
          />
        )}

        {field.type === 'email' && (
          <input
            id={field.id}
            type="email"
            value={fieldValue || ''}
            onChange={(e) => handleInputChange(field.id, e.target.value)}
            className="input"
            placeholder={field.placeholder}
          />
        )}

        {field.type === 'phone' && (
          <input
            id={field.id}
            type="tel"
            value={fieldValue || ''}
            onChange={(e) => handleInputChange(field.id, e.target.value)}
            className="input"
            placeholder={field.placeholder}
          />
        )}

        {field.type === 'number' && (
          <input
            id={field.id}
            type="number"
            value={fieldValue || ''}
            onChange={(e) => handleInputChange(field.id, e.target.value)}
            className="input"
            placeholder={field.placeholder}
          />
        )}

        {field.type === 'currency' && (
          <div className="relative">
            <span className="absolute left-3 top-2.5 text-gray-500">$</span>
            <input
              id={field.id}
              type="number"
              step="0.01"
              min="0"
              value={fieldValue || ''}
              onChange={(e) => handleInputChange(field.id, e.target.value)}
              className="input pl-8"
              placeholder="0.00"
            />
          </div>
        )}

        {field.type === 'date' && (
          <input
            id={field.id}
            type="date"
            value={fieldValue || ''}
            onChange={(e) => handleInputChange(field.id, e.target.value)}
            className="input"
          />
        )}

        {field.type === 'textarea' && (
          <textarea
            id={field.id}
            value={fieldValue || ''}
            onChange={(e) => handleInputChange(field.id, e.target.value)}
            className="input"
            placeholder={field.placeholder}
            rows={4}
          />
        )}

        {field.type === 'select' && (
          <select
            id={field.id}
            value={fieldValue || ''}
            onChange={(e) => handleInputChange(field.id, e.target.value)}
            className="input"
          >
            <option value="">Select an option...</option>
            {field.options?.map(opt => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        )}

        {field.type === 'radio' && (
          <div className="space-y-2">
            {field.options?.map(opt => (
              <label key={opt.value} className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name={field.id}
                  value={opt.value}
                  checked={fieldValue === opt.value}
                  onChange={(e) => handleInputChange(field.id, e.target.value)}
                  className="w-4 h-4"
                />
                <span className="text-sm text-gray-700">{opt.label}</span>
              </label>
            ))}
          </div>
        )}

        {field.type === 'checkbox' && (
          <div className="space-y-2">
            {field.options?.map(opt => (
              <label key={opt.value} className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  value={opt.value}
                  checked={(fieldValue || []).includes(opt.value)}
                  onChange={(e) => {
                    const currentValues = fieldValue || [];
                    if (e.target.checked) {
                      handleInputChange(field.id, [...currentValues, opt.value]);
                    } else {
                      handleInputChange(field.id, currentValues.filter((v: string) => v !== opt.value));
                    }
                  }}
                  className="w-4 h-4"
                />
                <span className="text-sm text-gray-700">{opt.label}</span>
              </label>
            ))}
          </div>
        )}

        {field.type === 'file' && (
          <div className="space-y-3">
            <div className="relative border-2 border-dashed border-gray-300 rounded-lg p-6 hover:border-primary transition">
              <input
                id={field.id}
                type="file"
                multiple
                onChange={(e) => handleFileUpload(field.id, e.currentTarget.files!)}
                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
              />
              <div className="text-center pointer-events-none">
                {uploadingFiles[field.id] ? (
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

            {Array.isArray(fieldValue) && fieldValue.length > 0 && (
              <div className="space-y-2">
                {fieldValue.map((file: any, idx: number) => (
                  <div key={idx} className="flex items-center justify-between p-2 bg-gray-50 rounded">
                    <span className="text-sm text-gray-600 truncate">{file.name}</span>
                    <button
                      type="button"
                      onClick={() => handleRemoveFile(field.id, idx)}
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

        {hasError && (
          <p className="text-red-600 text-sm mt-1">{hasError}</p>
        )}

        {field.helpText && !hasError && (
          <p className="text-gray-500 text-sm mt-1">{field.helpText}</p>
        )}
      </div>
    );
  };

  return (
    <div>
      {schema.sections.map(section => (
        <div key={section.id} className="mb-8">
          <div className="mb-6">
            <h2 className="text-xl font-bold text-gray-900">{section.title}</h2>
            {section.description && (
              <p className="text-gray-600 text-sm mt-2">{section.description}</p>
            )}
          </div>

          <div className="space-y-0">
            {section.fields.map(field => renderField(field))}
          </div>
        </div>
      ))}

      {!isReadOnly && (
        <div className="flex gap-3 pt-6 border-t border-gray-200 mt-8">
          {showSaveButton && (
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
          )}

          {showSubmitButton && (
            <button
              type="button"
              onClick={handleSubmit}
              disabled={submitting}
              className="btn-primary flex items-center gap-2"
            >
              {submitting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  {submitButtonText}...
                </>
              ) : (
                submitButtonText
              )}
            </button>
          )}

          {savedIndicator && (
            <div className="flex items-center gap-2 text-green-600 text-sm">
              ✓ Saved
            </div>
          )}
        </div>
      )}
    </div>
  );
}
