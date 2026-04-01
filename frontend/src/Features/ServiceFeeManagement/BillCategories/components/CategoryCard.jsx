import React from 'react';
import { Zap, Flame, Droplet, Wifi, Trash2 } from 'lucide-react';
import { FaRegEdit } from "react-icons/fa";

const iconMap = {
  zap: Zap,
  flame: Flame,
  droplet: Droplet,
  wifi: Wifi,
  trash: Trash2,
};

const colorMap = {
  orange: {
    bg: 'bg-orange-100',
    icon: 'text-orange-600',
    border: 'border-orange-200'
  },
  red: {
    bg: 'bg-red-100',
    icon: 'text-red-600',
    border: 'border-red-200'
  },
  blue: {
    bg: 'bg-blue-100',
    icon: 'text-blue-600',
    border: 'border-blue-200'
  },
  purple: {
    bg: 'bg-purple-100',
    icon: 'text-purple-600',
    border: 'border-purple-200'
  },
  teal: {
    bg: 'bg-teal-100',
    icon: 'text-teal-600',
    border: 'border-teal-200'
  },
  green: {
    bg: 'bg-greenBillCategory',
    icon: 'text-white',
    border: 'border-greenBillCategory'
  }
};

const CategoryCard = ({ category, onToggleStatus, onEdit, canEdit = true }) => {
  // Normalize icon value: trim whitespace and convert to lowercase for case-insensitive lookup
  const normalizedIcon = category.icon?.toString().trim().toLowerCase() || '';
  const IconComponent = iconMap[normalizedIcon] || Zap;
  
  // Normalize color value: trim whitespace and convert to lowercase for case-insensitive lookup
  const normalizedColor = category.color?.toString().trim().toLowerCase() || '';
  const colors = colorMap[normalizedColor] || colorMap.teal;
  
  // Debug: Log color values (remove in production if needed)
  if (process.env.NODE_ENV === 'development') {
    console.log('CategoryCard Debug:', {
      rawColor: category.color,
      normalizedColor,
      colors,
      categoryId: category.id
    });
  }

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 hover:shadow-md transition-all duration-200">
      {/* Header Section */}
      <div className="flex items-start justify-between mb-4">
        {/* Icon */}
        <div className={`${colors?.bg || 'bg-greenBillCategory'} rounded-lg p-3`}>
          <IconComponent className={`${colors?.icon || 'text-greenBillCategory'} w-6 h-6`} />
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-2">
          {/* Toggle Status Switch */}
          {canEdit && (
            <button
              onClick={() => onToggleStatus(category.id)}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                category.isActive ? 'bg-primary' : 'bg-gray-300'
              }`}
              title={category.isActive ? 'Deactivate' : 'Activate'}
              role="switch"
              aria-checked={category.isActive}
            >
              <span
                className={`inline-block h-4 w-4 transform rounded-full bg-white shadow-sm transition-transform ${
                  category.isActive ? 'translate-x-6' : 'translate-x-1'
                }`}
              />
            </button>
          )}

          {/* Edit Button */}
          {canEdit && (
            <button
              onClick={() => onEdit(category)}
              className="p-2 hover:bg-gray-100 rounded-full transition-colors"
              title="Edit category"
            >
              <FaRegEdit className="w-4 h-4 text-gray-600" />
            </button>
          )}
        </div>
      </div>

      {/* Category Info */}
      <div className="mb-4">
        <h3 className="text-xl font-semibold text-gray-900 mb-2">
          {category.name}
        </h3>
        <p className="text-gray-600 text-sm leading-relaxed">
          {category.description}
        </p>
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between pt-4 border-t border-gray-100">
        <span className="text-xs text-gray-500">
          Created: {category.createdAt}
        </span>
        <span
          className={`px-3 py-1 rounded-lg text-xs font-medium ${
            category.isActive
              ? 'bg-primary text-white'
              : 'bg-gray-100 text-gray-600'
          }`}
        >
          {category.isActive ? 'Active' : 'Inactive'}
        </span>
      </div>
    </div>
  );
};

export default CategoryCard;
