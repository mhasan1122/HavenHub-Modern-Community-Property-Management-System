/* global jest, describe, it, expect, beforeEach, afterEach */
import { renderHook, act } from '@testing-library/react';
import { Provider } from 'react-redux';
import { configureStore } from '@reduxjs/toolkit';
import useCompanySubmit from '../useCompanySubmit';
import ownerReducer from '../../../../../redux/slices/owner/ownerSlice';
import companyReducer from '../../../../../redux/slices/companySlice';

// Mock the companyApi
jest.mock('../../../../../redux/slices/api/companyApi', () => ({
  createCompany: jest.fn((formData) => ({
    type: 'company/create/pending',
    payload: formData,
    meta: { arg: formData }
  }))
}));

// Mock react-redux
const mockDispatch = jest.fn();
const mockSelector = jest.fn();

jest.mock('react-redux', () => ({
  ...jest.requireActual('react-redux'),
  useDispatch: () => mockDispatch,
  useSelector: () => mockSelector()
}));

describe('useCompanySubmit Hook', () => {
  let store;
  let mockOnClose;
  let mockValidateForm;

  beforeEach(() => {
    mockDispatch.mockClear();
    mockSelector.mockClear();
    mockOnClose = jest.fn();
    mockValidateForm = jest.fn().mockReturnValue(true);
    
    store = configureStore({
      reducer: {
        owner: ownerReducer,
        company: companyReducer
      }
    });

    // Default selector return value
    mockSelector.mockReturnValue({
      message: null,
      error: null,
      company: null
    });
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  const wrapper = ({ children }) => (
    <Provider store={store}>{children}</Provider>
  );

  describe('Form Validation', () => {
    it('should validate form before submission', () => {
      const formData = {
        company_name: 'Test Company',
        general_email: 'test@example.com',
        general_contact: '01712345678'
      };

      const { result } = renderHook(
        () => useCompanySubmit(formData, mockValidateForm, 1, '123', mockOnClose),
        { wrapper }
      );

      const mockEvent = { preventDefault: jest.fn() };
      
      act(() => {
        result.current.handleSubmitCompany(mockEvent);
      });

      expect(mockValidateForm).toHaveBeenCalledWith(formData, 1);
      expect(mockEvent.preventDefault).toHaveBeenCalled();
    });

    it('should not proceed if validation fails', () => {
      mockValidateForm.mockReturnValue(false);
      
      const formData = {
        company_name: '',
        general_email: 'invalid-email',
        general_contact: ''
      };

      const { result } = renderHook(
        () => useCompanySubmit(formData, mockValidateForm, 1, '123', mockOnClose),
        { wrapper }
      );

      const mockEvent = { preventDefault: jest.fn() };
      
      act(() => {
        result.current.handleSubmitCompany(mockEvent);
      });

      expect(mockOnClose).not.toHaveBeenCalled();
      expect(mockDispatch).not.toHaveBeenCalledWith(
        expect.objectContaining({ type: expect.stringContaining('setPendingCompanyData') })
      );
    });
  });

  describe('Existing Company Flow', () => {
    it('should handle existing company with member_id', () => {
      const formData = {
        company_name: 'Existing Company',
        member_id: '456',
        is_first_login: true,
        delivery_method: 'test@example.com',
        general_email: 'test@example.com',
        general_contact: '01712345678'
      };

      const { result } = renderHook(
        () => useCompanySubmit(formData, mockValidateForm, 1, '123', mockOnClose),
        { wrapper }
      );

      const mockEvent = { preventDefault: jest.fn() };
      
      act(() => {
        result.current.handleSubmitCompany(mockEvent);
      });

      // Should dispatch setCreatedMember with existing member
      expect(mockDispatch).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'owner/setCreatedMember',
          payload: expect.objectContaining({
            id: '456',
            full_name: 'Existing Company'
          })
        })
      );

      expect(mockOnClose).toHaveBeenCalled();
    });

    it('should handle existing company with login credentials', () => {
      const formData = {
        company_name: 'Existing Company',
        member_id: '789',
        login: 'email',
        login_email: 'existing@example.com',
        is_first_login: true
      };

      const { result } = renderHook(
        () => useCompanySubmit(formData, mockValidateForm, 1, '123', mockOnClose),
        { wrapper }
      );

      const mockEvent = { preventDefault: jest.fn() };
      
      act(() => {
        result.current.handleSubmitCompany(mockEvent);
      });

      expect(mockDispatch).toHaveBeenCalled();
      expect(mockOnClose).toHaveBeenCalled();
    });
  });

  describe('New Company Flow', () => {
    it('should store pending company data for new companies', () => {
      const formData = {
        company_name: 'New Company',
        general_email: 'new@example.com',
        general_contact: '01712345678',
        full_name: 'New Company',
        login: 'email',
        email: 'new@example.com',
        is_org_member: 1
      };

      const { result } = renderHook(
        () => useCompanySubmit(formData, mockValidateForm, 2, '123', mockOnClose),
        { wrapper }
      );

      const mockEvent = { preventDefault: jest.fn() };
      
      act(() => {
        result.current.handleSubmitCompany(mockEvent);
      });

      // Should dispatch setPendingCompanyData
      expect(mockDispatch).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'owner/setPendingCompanyData'
        })
      );

      // Should dispatch setCreatedMember with temp ID
      expect(mockDispatch).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'owner/setCreatedMember',
          payload: expect.objectContaining({
            full_name: 'New Company',
            isPending: true,
            pendingData: expect.any(Object)
          })
        })
      );

      expect(mockOnClose).toHaveBeenCalled();
    });

    it('should normalize form data correctly', () => {
      const formData = {
        company_name: 'Test Company',
        general_email: 'test@example.com',
        general_contact: '01712345678',
        full_name: 'Test Company',
        login: 'email',
        email: 'login@example.com',
        unit_id: '123'
      };

      const { result } = renderHook(
        () => useCompanySubmit(formData, mockValidateForm, 2, '123', mockOnClose),
        { wrapper }
      );

      const mockEvent = { preventDefault: jest.fn() };
      
      act(() => {
        result.current.handleSubmitCompany(mockEvent);
      });

      // Check that setPendingCompanyData was called with normalized data
      const setPendingCall = mockDispatch.mock.calls.find(
        call => call[0]?.type === 'owner/setPendingCompanyData'
      );

      expect(setPendingCall).toBeTruthy();
      expect(setPendingCall[0].payload).toMatchObject({
        company_name: 'Test Company',
        full_name: 'Test Company',
        is_org_member: 0,
        is_comm_member: 1,
        comm_member_ever_created: 1,
        unit_id: '123'
      });
    });

    it('should handle login_email login type correctly', () => {
      const formData = {
        company_name: 'Email Login Company',
        general_email: 'general@example.com',
        login: 'email',
        email: 'login@example.com',
        general_contact: '01712345678'
      };

      const { result } = renderHook(
        () => useCompanySubmit(formData, mockValidateForm, 2, '123', mockOnClose),
        { wrapper }
      );

      const mockEvent = { preventDefault: jest.fn() };
      
      act(() => {
        result.current.handleSubmitCompany(mockEvent);
      });

      const setPendingCall = mockDispatch.mock.calls.find(
        call => call[0]?.type === 'owner/setPendingCompanyData'
      );

      expect(setPendingCall[0].payload).toMatchObject({
        login_email: 'login@example.com'
      });
    });

    it('should handle login_contact login type correctly', () => {
      const formData = {
        company_name: 'Contact Login Company',
        general_email: 'general@example.com',
        login: 'contact',
        contact: '01812345678',
        general_contact: '01712345678'
      };

      const { result } = renderHook(
        () => useCompanySubmit(formData, mockValidateForm, 2, '123', mockOnClose),
        { wrapper }
      );

      const mockEvent = { preventDefault: jest.fn() };
      
      act(() => {
        result.current.handleSubmitCompany(mockEvent);
      });

      const setPendingCall = mockDispatch.mock.calls.find(
        call => call[0]?.type === 'owner/setPendingCompanyData'
      );

      expect(setPendingCall[0].payload).toMatchObject({
        login_contact: '01812345678'
      });
    });
  });

  describe('Error Handling', () => {
    it('should handle message display when error occurs', () => {
      mockSelector.mockReturnValue({
        message: null,
        error: { message: 'API Error' },
        company: null
      });

      const { result } = renderHook(
        () => useCompanySubmit({}, mockValidateForm, 1, '123', mockOnClose),
        { wrapper }
      );

      expect(result.current.showMessage).toBe(true);
      expect(result.current.error).toEqual({ message: 'API Error' });
    });

    it('should handle message display when success occurs', () => {
      mockSelector.mockReturnValue({
        message: 'Company created successfully',
        error: null,
        company: { id: 1, company_name: 'Test' }
      });

      const { result } = renderHook(
        () => useCompanySubmit({}, mockValidateForm, 1, '123', mockOnClose),
        { wrapper }
      );

      expect(result.current.showMessage).toBe(true);
      expect(result.current.message).toBe('Company created successfully');
    });

    it('should clear message on dismiss', () => {
      const { result } = renderHook(
        () => useCompanySubmit({}, mockValidateForm, 1, '123', mockOnClose),
        { wrapper }
      );

      act(() => {
        result.current.handleDismissMessage();
      });

      expect(mockDispatch).toHaveBeenCalledWith(
        expect.objectContaining({ type: 'company/clearMessage' })
      );
    });
  });

  describe('Loading State', () => {
    it('should track loading state', () => {
      const { result } = renderHook(
        () => useCompanySubmit({}, mockValidateForm, 1, '123', mockOnClose),
        { wrapper }
      );

      // Initial state should not be loading
      expect(result.current.loading).toBe(false);
    });
  });
});
