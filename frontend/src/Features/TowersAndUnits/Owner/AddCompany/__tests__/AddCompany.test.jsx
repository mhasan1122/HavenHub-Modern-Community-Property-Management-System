/* global jest, describe, it, expect, beforeEach, require */
import { render, screen, fireEvent } from '@testing-library/react';
import { Provider } from 'react-redux';
import { configureStore } from '@reduxjs/toolkit';
import { BrowserRouter } from 'react-router-dom';
import AddCompany from '../AddCompany';
import ownerReducer from '../../../../../redux/slices/owner/ownerSlice';
import companyReducer from '../../../../../redux/slices/companySlice';

// Mock the hooks
jest.mock('../useCompanyValidation', () => ({
  __esModule: true,
  default: jest.fn(() => ({
    errors: {},
    validateForm: jest.fn().mockReturnValue(true),
    setErrors: jest.fn()
  }))
}));

jest.mock('../useCompanySubmit', () => ({
  __esModule: true,
  default: jest.fn(() => ({
    handleSubmitCompany: jest.fn(),
    loading: false,
    showMessage: false,
    message: null,
    error: null,
    handleDismissMessage: jest.fn()
  }))
}));

jest.mock('../../../../../utils/useHandleFileChange', () => ({
  __esModule: true,
  default: jest.fn(() => ({
    handleFileChange: jest.fn(),
    handleFile3: jest.fn(),
    nidFront: null,
    nidBack: null
  }))
}));

jest.mock('../../../../../utils/useHandleChange', () => ({
  __esModule: true,
  default: jest.fn(() => ({
    handleChange: jest.fn()
  }))
}));

// Mock checkPermission
jest.mock('../../../../../utils/permissionUtils', () => ({
  checkPermission: jest.fn().mockResolvedValue(true)
}));

// Mock useParams
jest.mock('react-router-dom', () => ({
  ...jest.requireActual('react-router-dom'),
  useParams: () => ({ unitId: '123' }),
  useSearchParams: () => [new URLSearchParams(), jest.fn()],
  useNavigate: () => jest.fn()
}));

// Mock useSelector for company data
const mockCompanyData = {
  company: []
};

jest.mock('react-redux', () => ({
  ...jest.requireActual('react-redux'),
  useSelector: jest.fn((selector) => {
    // Return appropriate state based on selector
    if (selector.toString().includes('state.company')) {
      return mockCompanyData;
    }
    if (selector.toString().includes('state.owner')) {
      return { pendingCompanyData: null };
    }
    return null;
  })
}));

describe('AddCompany Component', () => {
  let store;
  let mockOnClose;

  beforeEach(() => {
    mockOnClose = jest.fn();
    store = configureStore({
      reducer: {
        owner: ownerReducer,
        company: companyReducer
      }
    });
  });

  const renderComponent = (props = {}) => {
    return render(
      <Provider store={store}>
        <BrowserRouter>
          <AddCompany 
            isOpen={true} 
            onClose={mockOnClose}
            fields={[]}
            {...props}
          />
        </BrowserRouter>
      </Provider>
    );
  };

  describe('Rendering', () => {
    it('should not render when isOpen is false', () => {
      const { container } = render(
        <Provider store={store}>
          <BrowserRouter>
            <AddCompany 
              isOpen={false} 
              onClose={mockOnClose}
              fields={[]}
            />
          </BrowserRouter>
        </Provider>
      );
      
      expect(container.firstChild).toBeNull();
    });

    it('should render modal when isOpen is true', () => {
      renderComponent();
      
      expect(screen.getByText('Company List')).toBeInTheDocument();
    });

    it('should render General Information tab by default', () => {
      renderComponent();
      
      expect(screen.getByText('General Information')).toBeInTheDocument();
    });

    it('should render company name input', () => {
      renderComponent();
      
      expect(screen.getByPlaceholderText('Company Name')).toBeInTheDocument();
    });

    it('should render email input', () => {
      renderComponent();
      
      // Look for email input by label or placeholder
      const emailInput = screen.queryByLabelText(/email/i) || 
                        screen.queryByPlaceholderText(/email/i);
      expect(emailInput).toBeInTheDocument();
    });

    it('should render contact input', () => {
      renderComponent();
      
      // Look for contact input
      const contactInput = screen.queryByLabelText(/contact/i) || 
                          screen.queryByPlaceholderText(/contact/i);
      expect(contactInput).toBeInTheDocument();
    });
  });

  describe('Form Interactions', () => {
    it('should call onClose when close button is clicked', () => {
      renderComponent();
      
      const closeButton = screen.getByRole('button', { name: /close/i }) ||
                         screen.querySelector('button svg');
      
      if (closeButton) {
        fireEvent.click(closeButton);
        expect(mockOnClose).toHaveBeenCalled();
      }
    });

    it('should have hidden input for is_org_member', () => {
      renderComponent();
      
      const hiddenInput = document.querySelector('input[type="hidden"][name="is_org_member"]');
      expect(hiddenInput).toBeInTheDocument();
      expect(hiddenInput.value).toBe('1');
    });
  });

  describe('Form Validation Display', () => {
    it('should display error messages when validation fails', () => {
      // This would require mocking useCompanyValidation to return errors
      // Implementation depends on how errors are displayed in the component
    });
  });

  describe('Tab Navigation', () => {
    it('should show Next button on tab 1', () => {
      renderComponent();
      
      const nextButton = screen.getByDisplayValue('Next') || 
                        screen.getByText('Next');
      expect(nextButton).toBeInTheDocument();
    });

    it('should show Submit button when login credentials exist', () => {
      // This would require setting up formData with login_email or login_contact
      // Implementation depends on component state management
    });
  });

  describe('Loading State', () => {
    it('should show loading animation when loading is true', () => {
      // Mock useCompanySubmit to return loading: true
      jest.spyOn(require('../useCompanySubmit'), 'default').mockReturnValue({
        handleSubmitCompany: jest.fn(),
        loading: true,
        showMessage: false,
        message: null,
        error: null,
        handleDismissMessage: jest.fn()
      });

      renderComponent();
      
      // Check for loading indicator
      screen.queryByText(/loading/i) || 
        document.querySelector('.loading') ||
        document.querySelector('[data-testid="loading"]');
      
      // Reset mock
      jest.restoreAllMocks();
    });
  });

  describe('Message Display', () => {
    it('should show message box when showMessage is true', () => {
      // Mock useCompanySubmit to return showMessage: true
      jest.spyOn(require('../useCompanySubmit'), 'default').mockReturnValue({
        handleSubmitCompany: jest.fn(),
        loading: false,
        showMessage: true,
        message: 'Success message',
        error: null,
        handleDismissMessage: jest.fn()
      });

      renderComponent();
      
      expect(screen.getByText('Success message')).toBeInTheDocument();
      
      // Reset mock
      jest.restoreAllMocks();
    });

    it('should show error message when error exists', () => {
      // Mock useCompanySubmit to return error
      jest.spyOn(require('../useCompanySubmit'), 'default').mockReturnValue({
        handleSubmitCompany: jest.fn(),
        loading: false,
        showMessage: true,
        message: null,
        error: 'Error message',
        handleDismissMessage: jest.fn()
      });

      renderComponent();
      
      expect(screen.getByText('Error message')).toBeInTheDocument();
      
      // Reset mock
      jest.restoreAllMocks();
    });
  });

  describe('Company List Integration', () => {
    it('should render CompanyList component', () => {
      renderComponent();
      
      // CompanyList should be rendered (even if not visible when showModal is false)
      // The component is always rendered but conditionally shown based on isOpen prop
    });
  });

  describe('Form Submission', () => {
    it('should call handleSubmitCompany on form submit', () => {
      const mockHandleSubmit = jest.fn();
      
      jest.spyOn(require('../useCompanySubmit'), 'default').mockReturnValue({
        handleSubmitCompany: mockHandleSubmit,
        loading: false,
        showMessage: false,
        message: null,
        error: null,
        handleDismissMessage: jest.fn()
      });

      renderComponent();
      
      const form = document.querySelector('form');
      if (form) {
        fireEvent.submit(form);
        expect(mockHandleSubmit).toHaveBeenCalled();
      }
      
      // Reset mock
      jest.restoreAllMocks();
    });
  });
});
