import { useState, useCallback } from 'react';
import * as yup from 'yup';
import { bulletinFormSchema, newLabelSchema } from '../validation/schemas';

interface ValidationErrors {
  title?: string;
  description?: string;
  priority?: string;
  selectedLabels?: string;
  attachments?: string;
  general?: string;
}

interface BulletinFormData {
  title: string;
  description: string;
  priority: 'urgent' | 'high' | 'normal' | 'low';
  selectedLabels: string[];
  attachments: Array<{
    id: string;
    file: string;
    file_name: string;
    file_type: string;
  }>;
  target_tower_ids: number[];
  target_unit_ids: number[];
}

export const useBulletinValidation = () => {
  const [errors, setErrors] = useState<ValidationErrors>({});

  // Clear specific error
  const clearError = useCallback((field: keyof ValidationErrors) => {
    setErrors(prev => ({
      ...prev,
      [field]: undefined
    }));
  }, []);

  // Clear all errors
  const clearAllErrors = useCallback(() => {
    setErrors({});
  }, []);

  // Validate title
  const validateTitle = useCallback(async (title: string) => {
    try {
      await bulletinFormSchema.validateAt('title', { title });
      clearError('title');
      return true;
    } catch (error) {
      if (error instanceof yup.ValidationError) {
        setErrors(prev => ({
          ...prev,
          title: error.message
        }));
      }
      return false;
    }
  }, [clearError]);

  // Validate description
  const validateDescription = useCallback(async (description: string) => {
    try {
      await bulletinFormSchema.validateAt('description', { description });
      clearError('description');
      return true;
    } catch (error) {
      if (error instanceof yup.ValidationError) {
        setErrors(prev => ({
          ...prev,
          description: error.message
        }));
      }
      return false;
    }
  }, [clearError]);

  // Validate labels
  const validateLabels = useCallback(async (selectedLabels: string[]) => {
    try {
      await bulletinFormSchema.validateAt('selectedLabels', { selectedLabels });
      clearError('selectedLabels');
      return true;
    } catch (error) {
      if (error instanceof yup.ValidationError) {
        setErrors(prev => ({
          ...prev,
          selectedLabels: error.message
        }));
      }
      return false;
    }
  }, [clearError]);

  // Validate new label
  const validateNewLabel = useCallback(async (labelText: string) => {
    try {
      await newLabelSchema.validate({ labelText });
      return { isValid: true, error: null };
    } catch (error) {
      if (error instanceof yup.ValidationError) {
        return { isValid: false, error: error.message };
      }
      return { isValid: false, error: 'Invalid label' };
    }
  }, []);

  // Validate attachments
  const validateAttachments = useCallback(async (attachments: Array<any>) => {
    try {
      await bulletinFormSchema.validateAt('attachments', { attachments });
      clearError('attachments');
      return true;
    } catch (error) {
      if (error instanceof yup.ValidationError) {
        setErrors(prev => ({
          ...prev,
          attachments: error.message
        }));
      }
      return false;
    }
  }, [clearError]);

  // Validate entire form
  const validateForm = useCallback(async (formData: BulletinFormData) => {
    try {
      await bulletinFormSchema.validate(formData, { abortEarly: false });
      clearAllErrors();
      return { isValid: true, errors: {} };
    } catch (error) {
      if (error instanceof yup.ValidationError) {
        const validationErrors: ValidationErrors = {};

        error.inner.forEach((err) => {
          if (err.path) {
            validationErrors[err.path as keyof ValidationErrors] = err.message;
          }
        });

        setErrors(validationErrors);
        return { isValid: false, errors: validationErrors };
      }
      return { isValid: false, errors: { general: 'Validation failed' } };
    }
  }, [clearAllErrors]);

  // Real-time validation for title
  const validateTitleRealtime = useCallback(async (title: string) => {
    if (!title.trim()) {
      clearError('title');
      return;
    }
    await validateTitle(title);
  }, [validateTitle, clearError]);

  // Real-time validation for description
  const validateDescriptionRealtime = useCallback(async (description: string) => {
    if (!description.trim()) {
      clearError('description');
      return;
    }
    await validateDescription(description);
  }, [validateDescription, clearError]);

  // Real-time validation for labels
  const validateLabelsRealtime = useCallback(async (selectedLabels: string[]) => {
    // Always validate labels, even when empty, to show required error
    await validateLabels(selectedLabels);
  }, [validateLabels]);

  return {
    errors,
    clearError,
    clearAllErrors,
    validateTitle,
    validateDescription,
    validateLabels,
    validateNewLabel,
    validateAttachments,
    validateForm,
    validateTitleRealtime,
    validateDescriptionRealtime,
    validateLabelsRealtime,
  };
};
