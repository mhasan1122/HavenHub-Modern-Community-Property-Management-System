import React from 'react';
import ErrorMessage from '../../../../Components/MessageBox/ErrorMessage';

/**
 * PriorityDropdown Component
 * Dropdown for selecting bulletin priority
 */
const PriorityDropdown = ({
  register,
  errors,
  watch,
  setValue,
  priorityError
}) => {
  const priorities = [
    { value: 'low', label: 'Low', color: 'text-gray-600' },
    { value: 'normal', label: 'Normal', color: 'text-blue-600' },
    { value: 'high', label: 'High', color: 'text-orange-600' },
    { value: 'urgent', label: 'Urgent', color: 'text-red-600' }
  ];

  const selectedPriority = watch('priority');
  const currentPriority = priorities.find(p => p.value === selectedPriority);

  return (
    <div>
      <select
        {...register('priority')}
        className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
          errors.priority || priorityError ? 'border-red-500' : 'border-gray-300'
        }`}
      >
        <option value="">Select priority...</option>
        {priorities.map((priority) => (
          <option key={priority.value} value={priority.value}>
            {priority.label}
          </option>
        ))}
      </select>
      
      {currentPriority && (
        <div className="mt-2">
          <span className={`text-sm font-medium ${currentPriority.color}`}>
            Selected: {currentPriority.label}
          </span>
        </div>
      )}
      
      {(errors.priority || priorityError) && (
        <ErrorMessage message={errors.priority?.message || priorityError} />
      )}
    </div>
  );
};

export default PriorityDropdown;
