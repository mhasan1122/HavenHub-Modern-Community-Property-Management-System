/* global describe, it, expect, beforeEach */
import { renderHook, act } from '@testing-library/react';
import useCompanyValidation from '../useCompanyValidation';

describe('useCompanyValidation Hook', () => {
  let result;

  beforeEach(() => {
    const { result: hookResult } = renderHook(() => useCompanyValidation());
    result = hookResult;
  });

  describe('Company Name Validation', () => {
    it('should return error when company name is empty', () => {
      const formData = {
        company_name: '',
        general_email: 'test@example.com',
        general_contact: '01712345678'
      };

      act(() => {
        result.current.validateForm(formData, 1);
      });

      expect(result.current.errors.company_name).toBe('Company name is required');
    });

    it('should return error when company name is undefined', () => {
      const formData = {
        general_email: 'test@example.com',
        general_contact: '01712345678'
      };

      act(() => {
        result.current.validateForm(formData, 1);
      });

      expect(result.current.errors.company_name).toBe('Company name is required');
    });

    it('should pass validation when company name is provided', () => {
      const formData = {
        company_name: 'Test Company',
        general_email: 'test@example.com',
        general_contact: '01712345678'
      };

      let isValid;
      act(() => {
        isValid = result.current.validateForm(formData, 1);
      });

      expect(isValid).toBe(true);
      expect(result.current.errors.company_name).toBeUndefined();
    });
  });

  describe('Email Validation', () => {
    it('should return error when email is empty', () => {
      const formData = {
        company_name: 'Test Company',
        general_email: '',
        general_contact: '01712345678'
      };

      act(() => {
        result.current.validateForm(formData, 1);
      });

      expect(result.current.errors.general_email).toBe('Email is required');
    });

    it('should return error when email format is invalid', () => {
      const formData = {
        company_name: 'Test Company',
        general_email: 'invalid-email',
        general_contact: '01712345678'
      };

      act(() => {
        result.current.validateForm(formData, 1);
      });

      expect(result.current.errors.general_email).toBe('Invalid email format');
    });

    it('should return error when email format is invalid (missing domain)', () => {
      const formData = {
        company_name: 'Test Company',
        general_email: 'test@',
        general_contact: '01712345678'
      };

      act(() => {
        result.current.validateForm(formData, 1);
      });

      expect(result.current.errors.general_email).toBe('Invalid email format');
    });

    it('should return error when email format is invalid (missing @)', () => {
      const formData = {
        company_name: 'Test Company',
        general_email: 'testexample.com',
        general_contact: '01712345678'
      };

      act(() => {
        result.current.validateForm(formData, 1);
      });

      expect(result.current.errors.general_email).toBe('Invalid email format');
    });

    it('should pass validation with valid email format', () => {
      const formData = {
        company_name: 'Test Company',
        general_email: 'test@example.com',
        general_contact: '01712345678'
      };

      let isValid;
      act(() => {
        isValid = result.current.validateForm(formData, 1);
      });

      expect(isValid).toBe(true);
      expect(result.current.errors.general_email).toBeUndefined();
    });

    it('should pass validation with valid email containing dots', () => {
      const formData = {
        company_name: 'Test Company',
        general_email: 'test.user@example.co.uk',
        general_contact: '01712345678'
      };

      let isValid;
      act(() => {
        isValid = result.current.validateForm(formData, 1);
      });

      expect(isValid).toBe(true);
      expect(result.current.errors.general_email).toBeUndefined();
    });
  });

  describe('Contact Number Validation', () => {
    it('should return error when contact is empty', () => {
      const formData = {
        company_name: 'Test Company',
        general_email: 'test@example.com',
        general_contact: ''
      };

      act(() => {
        result.current.validateForm(formData, 1);
      });

      expect(result.current.errors.general_contact).toBe('Contact Number is required');
    });

    it('should return error when contact has invalid prefix', () => {
      const formData = {
        company_name: 'Test Company',
        general_email: 'test@example.com',
        general_contact: '01112345678'
      };

      act(() => {
        result.current.validateForm(formData, 1);
      });

      expect(result.current.errors.general_contact).toBe(
        'Invalid contact number. Must be 11 digits starting with a valid prefix (013-019).'
      );
    });

    it('should return error when contact is too short', () => {
      const formData = {
        company_name: 'Test Company',
        general_email: 'test@example.com',
        general_contact: '0171234567'
      };

      act(() => {
        result.current.validateForm(formData, 1);
      });

      expect(result.current.errors.general_contact).toBe(
        'Invalid contact number. Must be 11 digits starting with a valid prefix (013-019).'
      );
    });

    it('should return error when contact is too long', () => {
      const formData = {
        company_name: 'Test Company',
        general_email: 'test@example.com',
        general_contact: '017123456789'
      };

      act(() => {
        result.current.validateForm(formData, 1);
      });

      expect(result.current.errors.general_contact).toBe(
        'Invalid contact number. Must be 11 digits starting with a valid prefix (013-019).'
      );
    });

    it('should pass validation with valid contact (017)', () => {
      const formData = {
        company_name: 'Test Company',
        general_email: 'test@example.com',
        general_contact: '01712345678'
      };

      let isValid;
      act(() => {
        isValid = result.current.validateForm(formData, 1);
      });

      expect(isValid).toBe(true);
      expect(result.current.errors.general_contact).toBeUndefined();
    });

    it('should pass validation with valid contact (018)', () => {
      const formData = {
        company_name: 'Test Company',
        general_email: 'test@example.com',
        general_contact: '01812345678'
      };

      let isValid;
      act(() => {
        isValid = result.current.validateForm(formData, 1);
      });

      expect(isValid).toBe(true);
    });

    it('should pass validation with valid contact (019)', () => {
      const formData = {
        company_name: 'Test Company',
        general_email: 'test@example.com',
        general_contact: '01912345678'
      };

      let isValid;
      act(() => {
        isValid = result.current.validateForm(formData, 1);
      });

      expect(isValid).toBe(true);
    });

    it('should pass validation with valid contact (013)', () => {
      const formData = {
        company_name: 'Test Company',
        general_email: 'test@example.com',
        general_contact: '01312345678'
      };

      let isValid;
      act(() => {
        isValid = result.current.validateForm(formData, 1);
      });

      expect(isValid).toBe(true);
    });

    it('should pass validation with valid contact (014)', () => {
      const formData = {
        company_name: 'Test Company',
        general_email: 'test@example.com',
        general_contact: '01412345678'
      };

      let isValid;
      act(() => {
        isValid = result.current.validateForm(formData, 1);
      });

      expect(isValid).toBe(true);
    });

    it('should pass validation with valid contact (015)', () => {
      const formData = {
        company_name: 'Test Company',
        general_email: 'test@example.com',
        general_contact: '01512345678'
      };

      let isValid;
      act(() => {
        isValid = result.current.validateForm(formData, 1);
      });

      expect(isValid).toBe(true);
    });

    it('should pass validation with valid contact (016)', () => {
      const formData = {
        company_name: 'Test Company',
        general_email: 'test@example.com',
        general_contact: '01612345678'
      };

      let isValid;
      act(() => {
        isValid = result.current.validateForm(formData, 1);
      });

      expect(isValid).toBe(true);
    });
  });

  describe('Tab 2 Validation - Login Credentials', () => {
    it('should validate email login type on tab 2', () => {
      const formData = {
        company_name: 'Test Company',
        general_email: 'test@example.com',
        general_contact: '01712345678',
        login: 'email',
        email: 'invalid-email'
      };

      act(() => {
        result.current.validateForm(formData, 2);
      });

      expect(result.current.errors.email).toBe('Please enter a valid email address');
    });

    it('should pass email validation on tab 2 with valid email', () => {
      const formData = {
        company_name: 'Test Company',
        general_email: 'test@example.com',
        general_contact: '01712345678',
        login: 'email',
        email: 'valid@example.com'
      };

      let isValid;
      act(() => {
        isValid = result.current.validateForm(formData, 2);
      });

      expect(isValid).toBe(true);
      expect(result.current.errors.email).toBeUndefined();
    });

    it('should validate contact login type on tab 2', () => {
      const formData = {
        company_name: 'Test Company',
        general_email: 'test@example.com',
        general_contact: '', // Empty general_contact so contact field is required
        login: 'contact',
        contact: ''
      };

      act(() => {
        result.current.validateForm(formData, 2);
      });

      expect(result.current.errors.contact).toBe('Contact number is required');
    });

    it('should validate contact contains only digits on tab 2', () => {
      const formData = {
        company_name: 'Test Company',
        general_email: 'test@example.com',
        general_contact: '01712345678',
        login: 'contact',
        contact: 'abc123'
      };

      act(() => {
        result.current.validateForm(formData, 2);
      });

      expect(result.current.errors.contact).toBe('Contact number must contain only digits');
    });

    it('should pass contact validation on tab 2 with valid contact', () => {
      const formData = {
        company_name: 'Test Company',
        general_email: 'test@example.com',
        general_contact: '01712345678',
        login: 'contact',
        contact: '01812345678'
      };

      let isValid;
      act(() => {
        isValid = result.current.validateForm(formData, 2);
      });

      expect(isValid).toBe(true);
      expect(result.current.errors.contact).toBeUndefined();
    });

    it('should not validate login fields on tab 1', () => {
      const formData = {
        company_name: 'Test Company',
        general_email: 'test@example.com',
        general_contact: '01712345678',
        login: 'email',
        email: 'invalid-email'
      };

      let isValid;
      act(() => {
        isValid = result.current.validateForm(formData, 1);
      });

      expect(isValid).toBe(true);
      expect(result.current.errors.email).toBeUndefined();
    });
  });

  describe('setErrors Function', () => {
    it('should allow manual error setting', () => {
      act(() => {
        result.current.setErrors({ customError: 'Custom error message' });
      });

      expect(result.current.errors.customError).toBe('Custom error message');
    });

    it('should clear errors when empty object is set', () => {
      act(() => {
        result.current.setErrors({ company_name: 'Error' });
      });

      expect(result.current.errors.company_name).toBe('Error');

      act(() => {
        result.current.setErrors({});
      });

      expect(result.current.errors).toEqual({});
    });
  });

  describe('Multiple Validation Errors', () => {
    it('should collect all validation errors at once', () => {
      const formData = {
        company_name: '',
        general_email: 'invalid',
        general_contact: '011'
      };

      act(() => {
        result.current.validateForm(formData, 1);
      });

      expect(result.current.errors).toEqual({
        company_name: 'Company name is required',
        general_email: 'Invalid email format',
        general_contact: 'Invalid contact number. Must be 11 digits starting with a valid prefix (013-019).'
      });
    });

    it('should return false when multiple errors exist', () => {
      const formData = {
        company_name: '',
        general_email: 'invalid',
        general_contact: '011'
      };

      let isValid;
      act(() => {
        isValid = result.current.validateForm(formData, 1);
      });

      expect(isValid).toBe(false);
    });
  });

  describe('Complete Valid Form Data', () => {
    it('should pass validation with complete valid data for tab 1', () => {
      const formData = {
        company_name: 'Test Company Ltd',
        general_email: 'contact@testcompany.com',
        general_contact: '01712345678',
        present_address: '123 Test Street'
      };

      let isValid;
      act(() => {
        isValid = result.current.validateForm(formData, 1);
      });

      expect(isValid).toBe(true);
      expect(Object.keys(result.current.errors)).toHaveLength(0);
    });

    it('should pass validation with complete valid data for tab 2 with email login', () => {
      const formData = {
        company_name: 'Test Company Ltd',
        general_email: 'contact@testcompany.com',
        general_contact: '01712345678',
        login: 'email',
        email: 'login@testcompany.com'
      };

      let isValid;
      act(() => {
        isValid = result.current.validateForm(formData, 2);
      });

      expect(isValid).toBe(true);
      expect(Object.keys(result.current.errors)).toHaveLength(0);
    });

    it('should pass validation with complete valid data for tab 2 with contact login', () => {
      const formData = {
        company_name: 'Test Company Ltd',
        general_email: 'contact@testcompany.com',
        general_contact: '01712345678',
        login: 'contact',
        contact: '01812345678'
      };

      let isValid;
      act(() => {
        isValid = result.current.validateForm(formData, 2);
      });

      expect(isValid).toBe(true);
      expect(Object.keys(result.current.errors)).toHaveLength(0);
    });
  });
});
