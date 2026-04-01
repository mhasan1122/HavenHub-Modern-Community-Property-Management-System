
import React, { useState } from 'react';
import { X, Zap, Flame, Droplet, Wifi, Trash2 } from 'lucide-react';
import ErrorMessage from '../../../../Components/MessageBox/ErrorMessage';

const iconOptions = [
  { name: 'zap', component: Zap, label: 'Electricity' },
  { name: 'flame', component: Flame, label: 'Gas' },
  { name: 'droplet', component: Droplet, label: 'Water' },
  { name: 'wifi', component: Wifi, label: 'Internet' },
  { name: 'trash', component: Trash2, label: 'Waste' },
];

const colorOptions = [
  { name: 'orange', value: '#FB923C', bg: 'bg-[#FB923C]' },
  { name: 'red', value: '#EF4444', bg: 'bg-[#EF4444]' },
  { name: 'blue', value: '#3B82F6', bg: 'bg-[#3B82F6]' },
  { name: 'purple', value: '#A855F7', bg: 'bg-[#A855F7]' },
  { name: 'green', value: '#10B981', bg: 'bg-[#10B981]' },
  { name: 'teal', value: '#14B8A6', bg: 'bg-[#14B8A6]' },
];

const AddCategoryModal = ({ isOpen, onClose, onSubmit }) => {
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    icon: 'zap',
    color: 'teal',
  });

  const [errors, setErrors] = useState({});

  const handleChange = (field, value) => {
    // Enforce 255 character limit for description
    if (field === 'description' && value.length > 255) {
      setErrors(prev => ({ ...prev, description: 'Description cannot exceed 255 characters' }));
      return;
    }
    
    setFormData(prev => ({ ...prev, [field]: value }));
    // Clear error when user starts typing
    if (errors[field] || errors._general) {
      setErrors(prev => {
        const newErrors = { ...prev };
        if (newErrors[field]) delete newErrors[field];
        if (newErrors._general) delete newErrors._general;
        return newErrors;
      });
    }
  };

  const validateForm = () => {
    const newErrors = {};
    if (!formData.name.trim()) {
      newErrors.name = 'Category name is required';
    }
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (validateForm()) {
      try {
        await onSubmit(formData);
        handleClose();
      } catch (error) {
        // Handle API validation errors (400 status) - show inline
        if (error.response && error.response.status === 400 && error.response.data) {
          const apiErrors = error.response.data;
          const newErrors = {};
          
          // Extract field-specific errors
          if (apiErrors.name) {
            newErrors.name = Array.isArray(apiErrors.name) 
              ? apiErrors.name[0] 
              : apiErrors.name;
          }
          if (apiErrors.description) {
            newErrors.description = Array.isArray(apiErrors.description) 
              ? apiErrors.description[0] 
              : apiErrors.description;
          }
          
          // If there are field errors, set them
          if (Object.keys(newErrors).length > 0) {
            setErrors(newErrors);
          }
          // Don't close modal on validation error - let user fix and retry
        } else {
          // For non-validation errors, show a simple error message
          console.error('Failed to create category:', error);
          const errorMessage = error.response?.data?.detail || error.message || 'An unexpected error occurred';
          setErrors({ _general: errorMessage });
        }
      }
    }
  };

  const handleClose = () => {
    setFormData({
      name: '',
      description: '',
      icon: 'zap',
      color: 'teal',
    });
    setErrors({});
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-3 md:p-4">
      <div className="bg-white rounded-xl md:rounded-2xl shadow-xl max-w-lg w-full max-h-[95vh] md:max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex justify-between items-start sm:items-center p-4 md:p-6 border-b border-gray-200 gap-3">
          <div className="flex-1 min-w-0">
            <h2 className="text-xl md:text-2xl font-bold text-gray-900">Add New Category</h2>
            <p className="text-xs md:text-sm text-gray-600 mt-1">
              Create a new bill category for utility charges
            </p>
          </div>
          <button
            onClick={handleClose}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors flex-shrink-0"
          >
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        {/* General Error Message */}
        {errors._general && (
          <div className="mx-4 md:mx-6 mt-3 md:mt-4 p-3 bg-red-50 border border-red-200 rounded-lg">
            <p className="text-xs md:text-sm text-red-600">{errors._general}</p>
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-4 md:p-6 space-y-4 md:space-y-6">
          {/* Category Name */}
          <div>
            <label className="block text-xs md:text-sm font-medium text-gray-700 mb-2">
              Category Name
            </label>
            <input
              type="text"
              value={formData.name}
              onChange={(e) => handleChange('name', e.target.value)}
              placeholder="e.g., Electricity, Gas, Water"
              className={`w-full px-3 md:px-4 py-2.5 md:py-3 text-sm md:text-base border ${
                errors.name ? 'border-red-500' : 'border-gray-300'
              } rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent outline-none transition-all`}
            />
            <ErrorMessage message={errors.name} />
          </div>

          {/* Description */}
          <div>
            <label className="block text-xs md:text-sm font-medium text-gray-700 mb-2">
              Description
            </label>
            <div className="login-field">
              <textarea
                name="description"
                value={formData.description}
                onChange={(e) => handleChange('description', e.target.value)}
                placeholder="Brief description of this bill category"
                rows={4}
                className={`login-field-input text-sm md:text-base ${
                  errors.description ? 'border-red-500' : ''
                }`}
              />
              {errors.description && (
                <span className="text-red-500 text-xs mt-1 block">
                  {errors.description}
                </span>
              )}
            </div>
          </div>

          {/* Icon Selection */}
          <div>
            <label className="block text-xs md:text-sm font-medium text-gray-700 mb-2 md:mb-3">
              Icon
            </label>
            <div className="flex gap-2 md:gap-3 flex-wrap">
              {iconOptions.map((icon) => {
                const IconComponent = icon.component;
                const isSelected = formData.icon === icon.name;
                return (
                  <button
                    key={icon.name}
                    type="button"
                    onClick={() => handleChange('icon', icon.name)}
                    className={`p-3 md:p-4 rounded-lg border-2 transition-all flex-shrink-0 ${
                      isSelected
                        ? 'border-teal-500 bg-teal-50'
                        : 'border-gray-200 bg-white hover:border-gray-300'
                    }`}
                    title={icon.label}
                  >
                    <IconComponent
                      className={`w-5 h-5 md:w-6 md:h-6 ${
                        isSelected ? 'text-teal-600' : 'text-gray-600'
                      }`}
                    />
                  </button>
                );
              })}
            </div>
          </div>

          {/* Color Selection */}
          <div>
            <label className="block text-xs md:text-sm font-medium text-gray-700 mb-2 md:mb-3">
              Color
            </label>
            <div className="flex gap-2 md:gap-3 flex-wrap">
              {colorOptions.map((color) => {
                const isSelected = formData.color === color.name;
                return (
                  <button
                    key={color.name}
                    type="button"
                    onClick={() => handleChange('color', color.name)}
                    className={`w-14 h-10 md:w-20 md:h-10 rounded-lg ${color.bg} transition-all flex-shrink-0 ${
                      isSelected
                        ? 'ring-2 ring-offset-1 md:ring-offset-2 ring-black'
                        : 'hover:scale-110'
                    }`}
                    title={color.name}
                  />
                );
              })}
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex flex-col sm:flex-row gap-3 pt-4">
            <button
              type="button"
              onClick={handleClose}
              className="flex-1 px-4 md:px-6 py-2.5 md:py-3 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors font-medium text-sm md:text-base w-full sm:w-auto"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="flex-1 px-4 md:px-6 py-2.5 md:py-3 bg-teal-600 text-white rounded-lg hover:bg-teal-700 transition-colors font-medium text-sm md:text-base w-full sm:w-auto"
            >
              Create Category
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default AddCategoryModal;
