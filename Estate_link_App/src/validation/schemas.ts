import * as yup from 'yup';

// Login validation schema
export const loginSchema = yup.object().shape({
  username: yup
    .string()
    .required('Username, email, or phone number is required')
    .min(3, 'Must be at least 3 characters')
    .max(50, 'Must be less than 50 characters'),
  rememberMe: yup.boolean().default(false),
});

// Forgot password validation schema
export const forgotPasswordSchema = yup.object().shape({
  contactInfo: yup
    .string()
    .required('Contact information is required')
    .test('email-validation', 'Please enter a valid email address', function (value) {
      const { method } = this.parent;
      if (method === 'email') {
        const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
        return emailRegex.test(value || '');
      }
      return true;
    })
    .test('phone-validation', 'Please enter a valid phone number', function (value) {
      const { method } = this.parent;
      if (method === 'phone' || method === 'whatsapp') {
        const cleanedPhone = (value || '').replace(/[^\d+]/g, '');
        if (cleanedPhone.startsWith('+')) {
          return /^\+[1-9]\d{6,14}$/.test(cleanedPhone);
        } else {
          return /^[1-9]\d{6,14}$/.test(cleanedPhone);
        }
      }
      return true;
    }),
  method: yup
    .string()
    .oneOf(['email', 'phone', 'whatsapp'], 'Invalid recovery method')
    .required('Recovery method is required'),
});

// OTP verification schema
export const otpSchema = yup.object().shape({
  otp: yup
    .string()
    .required('OTP is required')
    .matches(/^\d{4,6}$/, 'OTP must be 4-6 digits'),
});

// Password validation schema
export const passwordSchema = yup.object().shape({
  password: yup
    .string()
    .required('Password is required')
    .min(8, 'Password must be at least 8 characters')
    .matches(
      /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/,
      'Password must contain at least one uppercase letter, one lowercase letter, one number, and one special character'
    ),
  confirmPassword: yup
    .string()
    .required('Please confirm your password')
    .oneOf([yup.ref('password')], 'Passwords must match'),
});

// Set password schema (for first-time users)
export const setPasswordSchema = yup.object().shape({
  oldPassword: yup
    .string()
    .required('Old password is required')
    .min(1, 'Old password is required'),
  newPassword: yup
    .string()
    .required('New password is required')
    .min(8, 'Password must be at least 8 characters')
    .matches(
      /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/,
      'Password must contain at least one uppercase letter, one lowercase letter, one number, and one special character'
    ),
  confirmPassword: yup
    .string()
    .required('Please confirm your password')
    .oneOf([yup.ref('newPassword')], 'Passwords must match'),
});

// Welcome back password schema
export const welcomeBackSchema = yup.object().shape({
  password: yup
    .string()
    .required('Password is required')
    .min(1, 'Password is required'),
  rememberMe: yup.boolean().default(false),
});

// Email validation helper
export const emailValidation = yup
  .string()
  .email('Please enter a valid email address')
  .required('Email is required');

// Phone validation helper
export const phoneValidation = yup
  .string()
  .test('phone-format', 'Please enter a valid phone number', (value) => {
    if (!value) return false;
    const cleanedPhone = value.replace(/[^\d+]/g, '');

    // Handle international format (+880...)
    if (cleanedPhone.startsWith('+')) {
      return /^\+[1-9]\d{6,14}$/.test(cleanedPhone);
    }

    // Handle Bangladeshi phone numbers
    // Can start with 0 (like 01623398837) or without 0 (like 1623398837)
    // Should be 10-11 digits total
    if (cleanedPhone.startsWith('0')) {
      // Numbers starting with 0 should be 11 digits (0 + 10 digits)
      return /^0\d{10}$/.test(cleanedPhone);
    } else {
      // Numbers without 0 should be 10 digits
      return /^[1-9]\d{9}$/.test(cleanedPhone);
    }
  })
  .required('Phone number is required');

// Username validation helper
export const usernameValidation = yup
  .string()
  .min(3, 'Username must be at least 3 characters')
  .max(30, 'Username must be less than 30 characters')
  .matches(/^[a-zA-Z0-9._-]+$/, 'Username can only contain letters, numbers, dots, underscores, and hyphens')
  .required('Username is required');

// Initial screen validation schema (for user, email, and phone)
export const initialScreenSchema = yup.object().shape({
  username: yup
    .string()
    .required('Username, email, or phone number is required')
    .test('spelling-validation', 'Please check your spelling and use valid characters', function (value) {
      // If value is empty or undefined, let the required() validation handle it
      if (!value || value.trim() === '') {
        return true; // Let required() handle empty values
      }

      const trimmedValue = value.trim();

      // Check for invalid characters that suggest spelling errors
      // Allow valid email characters: letters, numbers, dots, underscores, hyphens, plus signs, @
      const validEmailPattern = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
      if (validEmailPattern.test(trimmedValue)) {
        return true; // Valid email format
      }

      // Check for invalid characters that are definitely wrong
      const definitelyInvalidChars = /[<>()[\]{}|\\:;"'`~!#$%^&*+=?/]/g;
      if (definitelyInvalidChars.test(trimmedValue)) {
        return false;
      }

      // Check for consecutive special characters (like commas, dots, etc.)
      if (/[,.]{2,}/.test(trimmedValue)) {
        return false;
      }

      // For non-email inputs, check if they contain invalid characters
      if (!trimmedValue.includes('@')) {
        // For usernames and phone numbers, check for invalid characters
        const invalidForUsername = /[^a-zA-Z0-9._-]/g;
        if (invalidForUsername.test(trimmedValue)) {
          return false;
        }
      }

      return true;
    })
    .test('valid-input', 'Please enter a valid username, email, or phone number', function (value) {
      // If value is empty or undefined, let the required() validation handle it
      if (!value || value.trim() === '') {
        return true; // Let required() handle empty values
      }

      const trimmedValue = value.trim();

      // Check if it's an email
      const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
      if (emailRegex.test(trimmedValue)) {
        return true;
      }

      // Check if it's a phone number
      const cleanedPhone = trimmedValue.replace(/[^\d+]/g, '');
      if (cleanedPhone.length >= 7) {
        if (cleanedPhone.startsWith('+')) {
          if (/^\+[1-9]\d{6,14}$/.test(cleanedPhone)) {
            return true;
          }
        } else {
          // Handle Bangladeshi phone numbers
          if (cleanedPhone.startsWith('0')) {
            // Numbers starting with 0 should be 11 digits (0 + 10 digits)
            if (/^0\d{10}$/.test(cleanedPhone)) {
              return true;
            }
          } else {
            // Numbers without 0 should be 10 digits
            if (/^[1-9]\d{9}$/.test(cleanedPhone)) {
              return true;
            }
          }
        }
      }

      // Check if it's a username
      if (trimmedValue.length >= 3 && trimmedValue.length <= 30 && /^[a-zA-Z0-9._-]+$/.test(trimmedValue)) {
        return true;
      }

      return false;
    }),
  rememberMe: yup.boolean().default(false),
});

// Bulletin validation schemas
export const bulletinSchema = yup.object().shape({
  title: yup
    .string()
    .required('Please enter a title for the bulletin')
    .test('word-count', 'Title cannot exceed 10 words', function (value) {
      if (!value) return true; // Let required() handle empty values
      const words = value.trim().split(/\s+/).filter(Boolean).length;
      return words <= 10;
    }),
  description: yup
    .string()
    .test('word-count', 'Description cannot exceed 100 words', function (value) {
      if (!value) return true; // Description is optional
      const words = value.trim().split(/\s+/).filter(Boolean).length;
      return words <= 100;
    }),
  priority: yup
    .string()
    .oneOf(['urgent', 'high', 'normal', 'low'], 'Invalid priority level')
    .required('Priority is required'),
  label: yup
    .string()
    .test('label-count', 'Maximum 5 labels can be selected', function (value) {
      if (!value) return true; // Labels are optional
      const labels = value.split(',').map(label => label.trim()).filter(Boolean);
      return labels.length <= 5;
    })
    .test('label-word-count', 'Label cannot exceed 5 words', function (value) {
      if (!value) return true; // Labels are optional
      const labels = value.split(',').map(label => label.trim()).filter(Boolean);
      return labels.every(label => {
        const words = label.split(/\s+/).filter(Boolean).length;
        return words <= 5;
      });
    }),
  attachments: yup
    .array()
    .of(
      yup.object().shape({
        id: yup.string().required(),
        file: yup.string().required(),
        file_name: yup.string().required(),
        file_type: yup.string().required(),
      })
    )
    .test('max-attachments', 'Maximum 5 attachments allowed', function (attachments) {
      return !attachments || attachments.length <= 5;
    })
    .test('total-size', 'Total attachment size would exceed 5MB limit', async function (attachments) {
      if (!attachments || attachments.length === 0) return true;

      // This is a simplified check - in real implementation, you'd calculate actual file sizes
      // For now, we'll assume the frontend handles size validation before submission
      return true;
    }),
  target_tower_ids: yup
    .array()
    .of(yup.number().required())
    .default([]),
  target_unit_ids: yup
    .array()
    .of(yup.number().required())
    .default([]),
});

// New label validation schema
export const newLabelSchema = yup.object().shape({
  labelText: yup
    .string()
    .required('Label name is required')
    .test('word-count', 'Label cannot exceed 5 words', function (value) {
      if (!value) return true;
      const words = value.trim().split(/\s+/).filter(Boolean).length;
      return words <= 5;
    })
    .min(1, 'Label name cannot be empty')
    .max(50, 'Label name must be less than 50 characters'),
});

// Attachment validation schema
export const attachmentSchema = yup.object().shape({
  id: yup.string().required(),
  file: yup.string().required(),
  file_name: yup.string().required(),
  file_type: yup.string().required(),
});

// Bulletin form validation schema (for both create and edit)
export const bulletinFormSchema = yup.object().shape({
  title: yup
    .string()
    .required('Please enter a title')
    .test('word-count', function (value) {
      if (!value) return true;
      const words = value.trim().split(/\s+/).filter(Boolean).length;
      if (words > 10) {
        return this.createError({
          message: `Title cannot exceed 10 words (currently ${words}).`,
          path: this.path,
        });
      }
      return true;
    }),
  description: yup
    .string()
    .test('word-count', function (value) {
      if (!value) return true;
      const words = value.trim().split(/\s+/).filter(Boolean).length;
      if (words > 100) {
        return this.createError({
          message: `Description cannot exceed 100 words (currently ${words}).`,
          path: this.path,
        });
      }
      return true;
    }),
  priority: yup
    .string()
    .oneOf(['urgent', 'high', 'normal', 'low'], 'Invalid priority level')
    .required('Priority is required'),
  selectedLabels: yup
    .array()
    .of(yup.string().required())
    .required('Please select at least one label')
    .min(1, 'Please select at least one label')
    .test('max-labels', 'Maximum 5 labels can be selected', function (labels) {
      return !labels || labels.length <= 5;
    }),
  attachments: yup
    .array()
    .of(attachmentSchema)
    .test('max-attachments', 'Maximum 5 attachments allowed', function (attachments) {
      return !attachments || attachments.length <= 5;
    }),
  target_tower_ids: yup
    .array()
    .of(yup.number().required())
    .default([]),
  target_unit_ids: yup
    .array()
    .of(yup.number().required())
    .default([]),
});

// Edit General Info validation schema
export const editGeneralInfoSchema = yup.object().shape({
  fullName: yup
    .string()
    .required('Full name is required')
    .min(2, 'Full name must be at least 2 characters')
    .max(100, 'Full name must be less than 100 characters')
    .matches(/^[a-zA-Z\s.-]+$/, 'Full name can only contain letters, spaces, dots, and hyphens'),
  email: yup
    .string()
    .email('Please enter a valid email address')
    .required('Email is required')
    .max(255, 'Email must be less than 255 characters'),
  contactNumber: yup
    .string()
    .optional()
    .nullable(),
  nidNumber: yup
    .string()
    .optional()
    .nullable(),
  permanentAddress: yup
    .string()
    .max(500, 'Permanent address must be less than 500 characters'),
  presentAddress: yup
    .string()
    .max(500, 'Present address must be less than 500 characters'),
  gender: yup
    .string()
    .oneOf(['Male', 'Female', 'Others'], 'Please select a valid gender')
    .required('Gender is required'),
  dateOfBirth: yup
    .string()
    .test('date-format', 'Please enter a valid date', (value) => {
      if (!value || value.trim() === '') return true; // Date is optional
      // Check if it's in DD-MMM-YYYY format
      if (value.match(/^\d{2}-[A-Za-z]{3}-\d{4}$/)) {
        return true;
      }
      // Try to parse as regular date
      const date = new Date(value);
      return !isNaN(date.getTime());
    }),
  occupation: yup
    .string()
    .max(100, 'Occupation must be less than 100 characters'),
  maritalStatus: yup
    .string()
    .oneOf(['Single', 'Married', 'Divorced', 'Widowed', ''], 'Please select a valid marital status')
    .nullable()
    .optional(),
  religion: yup
    .string()
    .oneOf(['Islam', 'Christianity', 'Hinduism', 'Buddhism', 'Judaism', 'Other', ''], 'Please select a valid religion')
    .nullable()
    .optional(),
});

// Export all schemas
export const validationSchemas = {
  login: loginSchema,
  forgotPassword: forgotPasswordSchema,
  otp: otpSchema,
  password: passwordSchema,
  setPassword: setPasswordSchema,
  welcomeBack: welcomeBackSchema,
  initialScreen: initialScreenSchema,
  email: emailValidation,
  phone: phoneValidation,
  username: usernameValidation,
  bulletin: bulletinSchema,
  newLabel: newLabelSchema,
  attachment: attachmentSchema,
  bulletinForm: bulletinFormSchema,
  editGeneralInfo: editGeneralInfoSchema,
};