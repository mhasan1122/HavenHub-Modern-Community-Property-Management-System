import React, { useState, useEffect } from "react";
import {
  FaTimes,
  FaPlus,
  FaMoneyBillWave,
  FaBuilding,
  FaWallet,
  FaCreditCard,
  FaSortNumericDown,
  FaAlignLeft,
  FaCheck
} from "react-icons/fa";
import paymentMethodService from "../services/paymentMethodService";

const AddPaymentMethodModal = ({ isOpen, onClose, onAdded }) => {
  const [formData, setFormData] = useState({
    method_name: "",
    method_type: "mfs",
    is_active: true,
    display_order: 0,
    description: "",
    icon: "",
    default_account: ""
  });
  const [accounts, setAccounts] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchAccounts = async () => {
      try {
        const response = await paymentMethodService.getAccounts();
        if (response.success) {
          setAccounts(response.data || []);
        }
      } catch (err) {
        console.error("Error fetching accounts:", err);
      }
    };
    fetchAccounts();
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const response = await paymentMethodService.createPaymentMethod(formData);
      if (response.success) {
        onAdded(response.data);
        onClose();
        setFormData({
          method_name: "",
          method_type: "mfs",
          is_active: true,
          display_order: 0,
          description: "",
          icon: "",
          default_account: ""
        });
      } else {
        setError(response.message || "Failed to create payment method");
      }
    } catch (err) {
      setError(err.response?.data?.message || "Something went wrong");
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[1000] flex items-center justify-center p-4">
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={onClose}
      ></div>

      <div className="relative bg-white w-full max-w-lg rounded-3xl shadow-2xl overflow-hidden animate-zoomIn max-h-[95vh] md:max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between p-6 border-b shrink-0">
          <div>
            <h2 className="text-xl md:text-2xl font-black text-gray-900">
              Add Payment Method
            </h2>
            <p className="text-sm text-gray-500 font-semibold">
              Create a new channel for receiving payments
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-full transition-colors"
          >
            <FaTimes size={20} className="text-gray-400" />
          </button>
        </div>

        <form
          onSubmit={handleSubmit}
          className="flex flex-col flex-1 overflow-hidden"
        >
          <div className="p-6 space-y-5 overflow-y-auto flex-1">
            {error && (
              <div className="bg-red-50 text-red-600 p-4 rounded-xl text-sm font-semibold border border-red-100 animate-shake">
                {error}
              </div>
            )}

            <div className="space-y-4">
              {/* Method Name */}
              <div>
                <label className="flex items-center gap-2 text-sm font-bold text-gray-700 mb-2">
                  <span className="p-1 px-1.5 bg-gray-100 rounded text-gray-500 italic font-serif">
                    Aa
                  </span>
                  Method Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 outline-none transition-all font-semibold"
                  placeholder="e.g. bKash, Dutch-Bangla Bank"
                  value={formData.method_name}
                  onChange={(e) =>
                    setFormData({ ...formData, method_name: e.target.value })
                  }
                  required
                />
              </div>

              {/* Method Type Selection */}
              <div>
                <label className="text-sm font-bold text-gray-700 mb-3 block">
                  Channel Type <span className="text-red-500">*</span>
                </label>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                  {[
                    { value: 'cash', icon: FaMoneyBillWave, label: 'Cash', color: 'teal' },
                    { value: 'bank', icon: FaBuilding, label: 'Bank', color: 'blue' },
                    { value: 'mfs', icon: FaWallet, label: 'MFS', color: 'pink' },
                    { value: 'card', icon: FaCreditCard, label: 'Card', color: 'purple' },
                  ].map((type) => (
                    <button
                      key={type.value}
                      type="button"
                      onClick={() =>
                        setFormData({ ...formData, method_type: type.value })
                      }
                      className={`flex flex-col items-center justify-center gap-2 py-3 rounded-xl border-2 transition-all ${
                        formData.method_type === type.value
                          ? `border-teal-500 bg-teal-50 text-teal-600 shadow-sm shadow-teal-100 scale-[1.05]`
                          : "border-gray-100 hover:border-gray-300 text-gray-400 hover:bg-gray-50"
                      }`}
                    >
                      <type.icon size={20} />
                      <span className="text-[10px] font-black uppercase tracking-wider">
                        {type.label}
                      </span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Account Name and Number */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="flex items-center gap-2 text-sm font-bold text-gray-700 mb-2">
                    <span className="p-1 px-1.5 bg-gray-100 rounded text-gray-500 italic font-serif text-[10px]">
                      Aa
                    </span>
                    Account/Merchant Name
                  </label>
                  <input
                    type="text"
                    className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 outline-none transition-all font-semibold"
                    placeholder="e.g. Acme Corp"
                    value={formData.account_name || ""}
                    onChange={(e) =>
                      setFormData({ ...formData, account_name: e.target.value })
                    }
                  />
                </div>
                <div>
                  <label className="flex items-center gap-2 text-sm font-bold text-gray-700 mb-2">
                    <span className="p-1 px-1.5 bg-gray-100 rounded text-gray-500 italic font-serif text-[10px]">
                      #
                    </span>
                    Account/Phone Number
                  </label>
                  <input
                    type="text"
                    className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 outline-none transition-all font-semibold"
                    placeholder="e.g. 017..."
                    value={formData.account_number || ""}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        account_number: e.target.value
                      })
                    }
                  />
                </div>
              </div>

              {/* Display Order */}
              <div>
                <label className="flex items-center gap-2 text-sm font-bold text-gray-700 mb-2">
                  <FaSortNumericDown className="text-gray-400" />
                  Display Order
                </label>
                <input
                  type="number"
                  className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 outline-none transition-all font-semibold"
                  value={formData.display_order}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      display_order: parseInt(e.target.value) || 0
                    })
                  }
                  min="0"
                />
              </div>

              {/* Description */}
              <div>
                <label className="flex items-center gap-2 text-sm font-bold text-gray-700 mb-2">
                  <FaAlignLeft className="text-gray-400" />
                  Description
                </label>
                <textarea
                  className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 outline-none transition-all font-medium resize-none"
                  placeholder="Optional details..."
                  rows="3"
                  value={formData.description}
                  onChange={(e) =>
                    setFormData({ ...formData, description: e.target.value })
                  }
                />
              </div>

              {/* Default Account */}
              <div>
                <label className="flex items-center gap-2 text-sm font-bold text-gray-700 mb-2">
                  <span className="p-1 px-1.5 bg-gray-100 rounded text-gray-500 italic font-serif text-[10px]">
                    #
                  </span>
                  Default Accounting Head
                </label>
                <select
                  className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 outline-none transition-all font-semibold"
                  value={formData.default_account}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      default_account: e.target.value
                    })
                  }
                >
                  <option value="">Select an account (Optional)</option>
                  {accounts.map((acc) => (
                    <option key={acc.id} value={acc.id}>
                      {acc.account_code} - {acc.account_name}
                    </option>
                  ))}
                </select>
              </div>

              {/* Active Status */}
              <div className="flex items-center gap-3 bg-gray-50 p-4 rounded-2xl border border-gray-100">
                <button
                  type="button"
                  onClick={() =>
                    setFormData({ ...formData, is_active: !formData.is_active })
                  }
                  className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                    formData.is_active ? "bg-teal-600" : "bg-gray-200"
                  }`}
                >
                  <span
                    className={`inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                      formData.is_active ? "translate-x-5" : "translate-x-0"
                    }`}
                  />
                </button>
                <span className="text-sm font-bold text-gray-700">
                  Currently Active
                </span>
              </div>
            </div>
          </div>

          <div className="p-6 pt-4 flex flex-col sm:flex-row gap-3 border-t bg-gray-50/50 shrink-0">
            <button
              type="button"
              onClick={onClose}
              className="w-full sm:flex-1 px-6 py-3.5 bg-gray-100 text-gray-700 rounded-2xl font-bold hover:bg-gray-200 transition-colors order-2 sm:order-1"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="w-full sm:flex-[2] px-6 py-3.5 bg-teal-600 text-white rounded-2xl font-bold hover:bg-teal-700 shadow-lg shadow-teal-100 disabled:opacity-50 flex items-center justify-center gap-2 order-1 sm:order-2"
            >
              {loading ? (
                <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
              ) : (
                <>
                  <FaPlus size={16} />
                  <span>Create Method</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default AddPaymentMethodModal;
