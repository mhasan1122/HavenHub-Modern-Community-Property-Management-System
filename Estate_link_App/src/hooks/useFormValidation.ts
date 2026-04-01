import { useState, useCallback, useMemo, useRef, useEffect } from 'react';
import * as yup from 'yup';
import { ValidationError } from 'yup';

interface ValidationResult {
  isValid: boolean;
  errors: Record<string, string>;
}

export const useFormValidation = <T extends Record<string, any>>(
  schema: yup.ObjectSchema<T>
) => {
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [touched, setTouched] = useState<Record<string, boolean>>({});
  
  // Use refs to store current state for stable function references
  const errorsRef = useRef(errors);
  const touchedRef = useRef(touched);
  
  // Update refs when state changes
  useEffect(() => {
    errorsRef.current = errors;
  }, [errors]);
  
  useEffect(() => {
    touchedRef.current = touched;
  }, [touched]);

  const validateField = useCallback(
    async (field: keyof T, value: any): Promise<string | null> => {
      try {
        await schema.validateAt(field as string, { [field]: value });
        return null;
      } catch (error) {
        if (error instanceof ValidationError) {
          return error.message;
        }
        return 'Validation error';
      }
    },
    [schema]
  );

  const validateForm = useCallback(
    async (data: T): Promise<ValidationResult> => {
      try {
        await schema.validate(data, { abortEarly: false });
        setErrors({});
        return { isValid: true, errors: {} };
      } catch (error) {
        if (error instanceof ValidationError) {
          const newErrors: Record<string, string> = {};
          error.inner.forEach((err) => {
            if (err.path) {
              newErrors[err.path] = err.message;
            }
          });
          setErrors(newErrors);
          return { isValid: false, errors: newErrors };
        }
        return { isValid: false, errors: {} };
      }
    },
    [schema]
  );

  const setFieldTouched = useCallback((field: keyof T, isTouched: boolean = true) => {
    setTouched((prev) => ({ ...prev, [field]: isTouched }));
  }, []);

  const setFieldError = useCallback((field: keyof T, error: string | null) => {
    setErrors((prev) => {
      if (error === null) {
        const newErrors = { ...prev };
        delete newErrors[field as string];
        return newErrors;
      }
      return { ...prev, [field]: error };
    });
  }, []);

  const clearErrors = useCallback(() => {
    setErrors({});
  }, []);

  const clearTouched = useCallback(() => {
    setTouched({});
  }, []);

  const getFieldError = useCallback(
    (field: keyof T): string | undefined => {
      return errorsRef.current[field as string];
    },
    []
  );

  const isFieldTouched = useCallback(
    (field: keyof T): boolean => {
      return touchedRef.current[field as string] || false;
    },
    []
  );

  const hasErrors = useMemo(() => Object.keys(errors).length > 0, [errors]);

  return {
    errors,
    touched,
    hasErrors,
    validateField,
    validateForm,
    setFieldTouched,
    setFieldError,
    clearErrors,
    clearTouched,
    getFieldError,
    isFieldTouched,
  };
}; 