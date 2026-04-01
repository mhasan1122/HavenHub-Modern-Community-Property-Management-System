import React, { useState, useEffect } from 'react';
import { useSelector } from 'react-redux';
import CategoryCard from './CategoryCard';
import AddCategoryModal from './AddCategoryModal';
import EditCategoryModal from './EditCategoryModal';
import { Plus } from 'lucide-react';
import { FaTags } from 'react-icons/fa';
import * as billCategoriesApi from '../../../../api/billCategoriesApi';
import MessageBox from '../../../../Components/MessageBox/MessageBox';
import ConfirmationMessageBox from '../../../../Components/MessageBox/ConfirmationMessageBox';
import EmptyState from '../../../../Components/Ui/EmptyState';
import { PERMISSIONS } from '../../../../constants/permissions';

const BillCategories = () => {
  const [categories, setCategories] = useState([]);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState(null);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState(null);
  const [error, setError] = useState(null);
  const [confirmationMessage, setConfirmationMessage] = useState(null);
  const [pendingToggleCategoryId, setPendingToggleCategoryId] = useState(null);

  // Get user permissions
  const user = useSelector((state) => state.auth.user);
  const permissionIds = user?.permission_ids?.map(String) || [];
  
  // Permission checks - Only check permission IDs
  const canAdd = permissionIds.includes(String(PERMISSIONS.ADD_BILL_CATEGORIES));
  const canEdit = permissionIds.includes(String(PERMISSIONS.EDIT_BILL_CATEGORIES));

  useEffect(() => {
    fetchCategories();
  }, []);

  // Helper function to extract error message from API error
  const extractErrorMessage = (error) => {
    if (!error) return 'An unexpected error occurred';
    
    // Handle axios error response
    if (error.response) {
      const data = error.response.data;
      // If error response has a message field
      if (data.message) return data.message;
      // If error response has error field
      if (data.error) return data.error;
      // If error response has non_field_errors or detail
      if (data.non_field_errors) return Array.isArray(data.non_field_errors) ? data.non_field_errors.join(', ') : data.non_field_errors;
      if (data.detail) return data.detail;
      // If error response has field-specific errors
      if (typeof data === 'object') {
        const errorMessages = Object.values(data).flat().filter(msg => msg);
        if (errorMessages.length > 0) return errorMessages.join(', ');
      }
      return `Error: ${error.response.status} ${error.response.statusText}`;
    }
    
    // Handle network errors
    if (error.message) return error.message;
    
    return 'An unexpected error occurred. Please try again.';
  };

  const fetchCategories = async () => {
    try {
      setLoading(true);
      const data = await billCategoriesApi.fetchBillCategories();
      setCategories(data);
    } catch (error) {
      console.error('Failed to fetch categories:', error);
      setCategories([]);
      setError(extractErrorMessage(error));
    } finally {
      setLoading(false);
    }
  };

  const handleAddCategory = async (categoryData) => {
    const newCategory = await billCategoriesApi.createBillCategory(categoryData);
    setCategories([...categories, newCategory]);
    setIsAddModalOpen(false);
    setError(null); // Clear any previous errors
    setMessage('Bill category created successfully!');
    // Errors are handled in the modal component
  };

  const handleEditCategory = async (categoryData) => {
    const updatedCategory = await billCategoriesApi.updateBillCategory(selectedCategory.id, categoryData);
    setCategories(categories.map(cat => 
      cat.id === selectedCategory.id ? updatedCategory : cat
    ));
    setIsEditModalOpen(false);
    setSelectedCategory(null);
    setError(null); // Clear any previous errors
    setMessage('Bill category updated successfully!');
    // Errors are handled in the modal component
  };

  const handleToggleStatus = async (categoryId) => {
    if (!canEdit) {
      setError('You do not have permission to edit bill categories.');
      return;
    }
    
    const category = categories.find(cat => cat.id === categoryId);
    const action = category?.isActive ? 'deactivate' : 'activate';
    const categoryName = category?.name || 'this category';
    
    setPendingToggleCategoryId(categoryId);
    setConfirmationMessage(`Are you sure you want to ${action} "${categoryName}"?`);
  };

  const confirmToggleStatus = async () => {
    if (!pendingToggleCategoryId) return;
    
    try {
      // Get current category state before toggle
      const category = categories.find(cat => cat.id === pendingToggleCategoryId);
      const wasActive = category?.isActive;
      const newStatus = wasActive ? 'deactivated' : 'activated';
      
      await billCategoriesApi.toggleBillCategoryStatus(pendingToggleCategoryId);
      setCategories(categories.map(cat => 
        cat.id === pendingToggleCategoryId ? { ...cat, isActive: !cat.isActive } : cat
      ));
      setMessage(`Bill category ${newStatus} successfully!`);
      setConfirmationMessage(null);
      setPendingToggleCategoryId(null);
    } catch (error) {
      console.error('Failed to toggle category status:', error);
      setError(extractErrorMessage(error));
      setConfirmationMessage(null);
      setPendingToggleCategoryId(null);
    }
  };

  const cancelToggleStatus = () => {
    setConfirmationMessage(null);
    setPendingToggleCategoryId(null);
  };

  const handleEditClick = (category) => {
    if (!canEdit) {
      setError('You do not have permission to edit bill categories.');
      return;
    }
    setSelectedCategory(category);
    setIsEditModalOpen(true);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-gray-500">Loading categories...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 p-4 md:p-8">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:justify-between md:items-start mb-6 md:mb-8 gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-gray-900">Bill Categories</h1>
          <p className="text-gray-600 mt-1 text-sm md:text-base">Manage utility and service bill categories</p>
        </div>
        {canAdd && (
          <button
            onClick={() => setIsAddModalOpen(true)}
            className="flex items-center justify-center gap-2 bg-teal-600 hover:bg-teal-700 text-white px-4 md:px-6 py-2.5 md:py-3 rounded-lg transition-colors duration-200 shadow-sm w-full md:w-auto"
          >
            <Plus size={20} />
            <span className="text-sm md:text-base">Add Category</span>
          </button>
        )}
      </div>

      {/* Categories Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6">
        {categories.map(category => (
          <CategoryCard
            key={category.id}
            category={category}
            onToggleStatus={handleToggleStatus}
            onEdit={handleEditClick}
            canEdit={canEdit}
          />
        ))}
      </div>

      {/* Empty State */}
      {categories.length === 0 && (
        <div className="bg-white border border-gray-200 rounded-xl p-12">
          <EmptyState
            icon={FaTags}
            title="No Bill Categories Found"
          />
        </div>
      )}

      {/* Modals */}
      <AddCategoryModal
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
        onSubmit={handleAddCategory}
      />

      <EditCategoryModal
        isOpen={isEditModalOpen}
        onClose={() => {
          setIsEditModalOpen(false);
          setSelectedCategory(null);
        }}
        onSubmit={handleEditCategory}
        category={selectedCategory}
      />

      {/* Success/Error Message Box */}
      <MessageBox
        message={message}
        error={error}
        clearMessage={() => {
          setMessage(null);
          setError(null);
        }}
      />

      {/* Confirmation Message Box for Toggle Status */}
      <ConfirmationMessageBox
        message={confirmationMessage}
        onConfirm={confirmToggleStatus}
        onCancel={cancelToggleStatus}
        confirmText="Confirm"
        cancelText="Cancel"
        showCancel={true}
      />
    </div>
  );
};

export default BillCategories;
