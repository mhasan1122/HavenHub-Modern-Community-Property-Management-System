import React from 'react';
import { Controller } from 'react-hook-form';

/**
 * PostAsSelector Component
 * Standalone component for post as radio button selection
 */
const PostAsSelector = ({ control, errors, onChange, canPostAsGroup = false, canPostAsMember = false }) => {
  const options = [
    { value: 'Creator', label: 'Creator', disabled: false },
    { value: 'Group', label: 'Group', disabled: !canPostAsGroup },
    { value: 'Member', label: 'Member', disabled: !canPostAsMember }
  ];

  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-2">
        Post as <span className="text-primary">*</span>
      </label>
      <Controller
        name="postAs"
        control={control}
        render={({ field: { onChange: fieldOnChange, value } }) => (
          <div className="flex items-center space-x-6">
            {options.map((option) => (
              <label key={option.value} className={`flex items-center ${option.disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}>
                <input
                  type="radio"
                  value={option.value}
                  checked={value === option.value}
                  disabled={option.disabled}
                  onChange={(e) => {
                    if (!option.disabled) {
                      fieldOnChange(e.target.value);
                      if (onChange) onChange(e.target.value);
                    }
                  }}
                  className="w-4 h-4 text-primary border-gray-300 focus:ring-primary accent-primary disabled:cursor-not-allowed"
                />
                <span className={`ml-2 text-sm ${option.disabled ? 'text-gray-400' : 'text-gray-700'}`}>{option.label}</span>
              </label>
            ))}
          </div>
        )}
      />
      {errors.postAs && (
        <p className="mt-1 text-sm text-red-600">{errors.postAs.message}</p>
      )}
    </div>
  );
};

export default PostAsSelector;
