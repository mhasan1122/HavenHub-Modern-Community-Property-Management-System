import { useState, useCallback, useEffect } from 'react';

interface BulletinFormData {
  title: string;
  content?: string; // Optional - can be empty or undefined
  priority: string;
  target_towers: string[];
  target_units: string[];
  labels: string[];
  attachments: Array<{
    id: string;
    file: string;
    file_name: string;
    file_type: string;
  }>;
}

interface BulletinFormErrors {
  title?: string;
  content?: string;
  priority?: string;
  target_towers?: string;
  target_units?: string;
  labels?: string;
  attachments?: string;
}

interface UseBulletinFormProps {
  initialData?: Partial<BulletinFormData>;
  onSubmit: (data: BulletinFormData) => void;
  onCancel?: () => void;
}

const initialFormData: BulletinFormData = {
  title: '',
  content: undefined, // Optional - can be undefined
  priority: 'medium',
  target_towers: [],
  target_units: [],
  labels: [],
  attachments: [],
};

export const useBulletinForm = ({
  initialData = {},
  onSubmit,
  onCancel,
}: UseBulletinFormProps) => {
  const [formData, setFormData] = useState<BulletinFormData>({
    ...initialFormData,
    ...initialData,
  });
  const [errors, setErrors] = useState<BulletinFormErrors>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isDirty, setIsDirty] = useState(false);

  // Check if form is dirty
  useEffect(() => {
    const hasChanges = JSON.stringify(formData) !== JSON.stringify({
      ...initialFormData,
      ...initialData,
    });
    setIsDirty(hasChanges);
  }, [formData, initialData]);

  // Update form field
  const updateField = useCallback((field: keyof BulletinFormData, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    // Clear error for this field
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: undefined }));
    }
  }, [errors]);

  // Update multiple fields at once
  const updateFields = useCallback((updates: Partial<BulletinFormData>) => {
    setFormData(prev => ({ ...prev, ...updates }));
    // Clear errors for updated fields
    const updatedErrors = { ...errors };
    Object.keys(updates).forEach(key => {
      if (updatedErrors[key as keyof BulletinFormErrors]) {
        updatedErrors[key as keyof BulletinFormErrors] = undefined;
      }
    });
    setErrors(updatedErrors);
  }, [errors]);

  // Add attachment
  const addAttachment = useCallback((attachment: BulletinFormData['attachments'][0]) => {
    setFormData(prev => ({
      ...prev,
      attachments: [...prev.attachments, attachment],
    }));
  }, []);

  // Remove attachment
  const removeAttachment = useCallback((attachmentId: string) => {
    setFormData(prev => ({
      ...prev,
      attachments: prev.attachments.filter(att => att.id !== attachmentId),
    }));
  }, []);

  // Add label
  const addLabel = useCallback((label: string) => {
    if (label.trim() && !formData.labels.includes(label.trim())) {
      setFormData(prev => ({
        ...prev,
        labels: [...prev.labels, label.trim()],
      }));
    }
  }, [formData.labels]);

  // Remove label
  const removeLabel = useCallback((labelToRemove: string) => {
    setFormData(prev => ({
      ...prev,
      labels: prev.labels.filter(label => label !== labelToRemove),
    }));
  }, []);

  // Add tower
  const addTower = useCallback((towerId: string) => {
    if (!formData.target_towers.includes(towerId)) {
      setFormData(prev => ({
        ...prev,
        target_towers: [...prev.target_towers, towerId],
      }));
    }
  }, [formData.target_towers]);

  // Remove tower
  const removeTower = useCallback((towerId: string) => {
    setFormData(prev => ({
      ...prev,
      target_towers: prev.target_towers.filter(id => id !== towerId),
    }));
  }, [formData.target_towers]);

  // Add unit
  const addUnit = useCallback((unitId: string) => {
    if (!formData.target_units.includes(unitId)) {
      setFormData(prev => ({
        ...prev,
        target_units: [...prev.target_units, unitId],
      }));
    }
  }, [formData.target_units]);

  // Remove unit
  const removeUnit = useCallback((unitId: string) => {
    setFormData(prev => ({
      ...prev,
      target_units: prev.target_units.filter(id => id !== unitId),
    }));
  }, [formData.target_units]);

  // Validate form
  const validateForm = useCallback((): boolean => {
    const newErrors: BulletinFormErrors = {};

    if (!formData.title.trim()) {
      newErrors.title = 'Title is required';
    } else if (formData.title.trim().length < 5) {
      newErrors.title = 'Title must be at least 5 characters';
    }

    // Content is optional, but if provided, it must be at least 10 characters
    if (formData.content && formData.content.trim() && formData.content.trim().length < 10) {
      newErrors.content = 'Content must be at least 10 characters if provided';
    }

    if (!formData.priority) {
      newErrors.priority = 'Priority is required';
    }

    if (formData.target_towers.length === 0 && formData.target_units.length === 0) {
      newErrors.target_towers = 'Please select at least one tower or unit';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  }, [formData]);

  // Handle form submission
  const handleSubmit = useCallback(async () => {
    if (!validateForm()) {
      return;
    }

    setIsSubmitting(true);
    try {
      await onSubmit(formData);
      // Reset form after successful submission
      setFormData({ ...initialFormData, ...initialData });
      setErrors({});
      setIsDirty(false);
    } catch (error) {
      console.error('Form submission error:', error);
    } finally {
      setIsSubmitting(false);
    }
  }, [formData, validateForm, onSubmit, initialData]);

  // Reset form
  const resetForm = useCallback(() => {
    setFormData({ ...initialFormData, ...initialData });
    setErrors({});
    setIsDirty(false);
  }, [initialData]);

  // Handle cancel
  const handleCancel = useCallback(() => {
    if (isDirty) {
      // You might want to show a confirmation dialog here
      resetForm();
    }
    onCancel?.();
  }, [isDirty, resetForm, onCancel]);

  return {
    formData,
    errors,
    isSubmitting,
    isDirty,
    updateField,
    updateFields,
    addAttachment,
    removeAttachment,
    addLabel,
    removeLabel,
    addTower,
    removeTower,
    addUnit,
    removeUnit,
    validateForm,
    handleSubmit,
    resetForm,
    handleCancel,
  };
};
