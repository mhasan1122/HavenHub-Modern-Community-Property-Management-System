import React, { useState, useEffect } from "react";
import {
  FaPlus,
  FaSearch,
  FaFilter,
  FaMoneyCheckAlt,
  FaArrowLeft
} from "react-icons/fa";
import { useSelector } from "react-redux";
import { PERMISSIONS } from "../../../../constants/permissions";
import { useNavigate } from "react-router-dom";
import paymentMethodService from "../services/paymentMethodService";
import PaymentMethodCard from "./PaymentMethodCard";
import AddPaymentMethodModal from "./AddPaymentMethodModal";
import EditPaymentMethodModal from "./EditPaymentMethodModal";
import PageContainer from "../../../../Components/Ui/PageContainer";
import ContentBox from "../../../../Components/Ui/ContentBox";
import Heading from "../../../../Components/HeadingComponent/Heading";
import MessageBox from "../../../../Components/MessageBox/MessageBox";
import SelectComponent from "../../../../Components/FormComponent/SelectComponent";

const paymentOptions = [
  { label: "All Channels", value: "all" },
  { label: "Cash", value: "cash" },
  { label: "Bank Transfer", value: "bank" },
  { label: "MFS", value: "mfs" },
  { label: "Card", value: "card" }
];

const PaymentMethods = () => {
  const navigate = useNavigate();
  const [methods, setMethods] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [filterType, setFilterType] = useState("all");
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [selectedMethod, setSelectedMethod] = useState(null);
  const [message, setMessage] = useState("");
  const [isSuccess, setIsSuccess] = useState(true);

  // Permission checks
  const user = useSelector((state) => state.auth.user);
  const permissionIds = React.useMemo(
    () => new Set((user?.permission_ids || []).map((id) => Number(id))),
    [user?.permission_ids]
  );

  const hasPermission = (permissionId) =>
    permissionId ? permissionIds.has(Number(permissionId)) : false;

  const isAdmin = user?.member_roles?.some(
    (role) => (role.role_name || "").toLowerCase() === "admin"
  );

  const canAdd = hasPermission(PERMISSIONS.ADD_PAYMENT_METHODS) || isAdmin;
  const canEdit = hasPermission(PERMISSIONS.EDIT_PAYMENT_METHODS) || isAdmin;

  const fetchMethods = async () => {
    setLoading(true);
    try {
      const response = await paymentMethodService.getPaymentMethods();
      if (response.success) {
        setMethods(response.data);
      }
    } catch (err) {
      console.error("Error fetching payment methods:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMethods();
  }, []);

  const handleToggleStatus = async (method) => {
    try {
      const response = await paymentMethodService.deletePaymentMethod(
        method.id
      );
      if (response.success) {
        setMessage(response.message);
        setIsSuccess(true);
        fetchMethods();
      }
    } catch (err) {
      setMessage("Failed to toggle status");
      setIsSuccess(false);
    }
  };

  const filteredMethods = methods.filter((method) => {
    const matchesSearch =
      method.method_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      method.method_type.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesFilter =
      filterType === "all" || method.method_type === filterType;
    return matchesSearch && matchesFilter;
  });

  return (
    <PageContainer>
      <ContentBox>
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
          <div>
            <div className="flex items-center gap-4 mb-2">
              <button
                onClick={() => navigate(-1)}
                className="p-2 bg-gray-50 hover:bg-gray-100 rounded-full text-gray-400 hover:text-teal-600 transition-all border border-gray-100"
              >
                <FaArrowLeft size={16} />
              </button>
              <Heading title="Payment Methods" size="2xl" color="black" />
            </div>
            <p className="text-gray-500 font-semibold ml-12">
              Manage your payment channels and reception methods
            </p>
          </div>

          {canAdd && (
            <button
              onClick={() => setShowAddModal(true)}
              className="flex items-center justify-center gap-2 px-4 py-2.5 md:px-6 md:py-3.5 bg-teal-600 text-white rounded-xl md:rounded-2xl font-bold hover:bg-teal-700 shadow-lg shadow-teal-100 transition-all active:scale-95 text-sm md:text-base"
            >
              <FaPlus size={14} className="md:size-4" />
              <span>Add New Method</span>
            </button>
          )}
        </div>

        {/* Filters & Search */}
        <div className="bg-gray-50 p-4 rounded-3xl border border-gray-100 mb-8 flex flex-col md:flex-row gap-4">
          <div className="relative flex-1">
            <FaSearch className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              placeholder="Search methods name or type..."
              className="w-full pl-12 pr-4 py-3 bg-white border border-gray-200 rounded-2xl focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 outline-none transition-all font-semibold"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>

          <div className="w-full md:w-64">
            <SelectComponent
              options={paymentOptions}
              value={filterType}
              onChange={(e) => setFilterType(e.target.value)}
              className="!mt-0"
            />
          </div>
        </div>

        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 animate-pulse">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="bg-gray-100 h-48 rounded-3xl"></div>
            ))}
          </div>
        ) : filteredMethods.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {filteredMethods.map((method) => (
              <PaymentMethodCard
                key={method.id}
                method={method}
                onEdit={canEdit ? (m) => {
                  setSelectedMethod(m);
                  setShowEditModal(true);
                } : null}
                onToggleStatus={canEdit ? handleToggleStatus : null}
              />
            ))}
          </div>
        ) : (
          <div className="text-center py-20 bg-gray-50 rounded-3xl border-2 border-dashed border-gray-200">
            <div className="bg-white w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-6 shadow-sm border border-gray-100">
              <FaMoneyCheckAlt size={32} className="text-gray-300" />
            </div>
            <h3 className="text-xl font-black text-gray-900 mb-2">
              No Payment Methods Found
            </h3>
            <p className="text-gray-500 font-bold mb-8">
              Start by adding your first payment channel
            </p>
            {canAdd && (
              <button
                onClick={() => setShowAddModal(true)}
                className="px-8 py-3 bg-white text-teal-600 border-2 border-teal-600 rounded-2xl font-bold hover:bg-teal-50 transition-colors inline-flex items-center gap-2"
              >
                <FaPlus /> Add First Method
              </button>
            )}
          </div>
        )}
      </ContentBox>

      {message && (
        <MessageBox
          message={message}
          type={isSuccess ? "success" : "error"}
          clearMessage={() => setMessage("")}
        />
      )}

      <AddPaymentMethodModal
        isOpen={showAddModal}
        onClose={() => setShowAddModal(false)}
        onAdded={(newMethod) => {
          setMethods([...methods, newMethod]);
          setMessage("Payment method added successfully");
          setIsSuccess(true);
        }}
      />

      <EditPaymentMethodModal
        isOpen={showEditModal}
        method={selectedMethod}
        onClose={() => setShowEditModal(false)}
        onUpdated={(updatedMethod) => {
          setMethods(
            methods.map((m) => (m.id === updatedMethod.id ? updatedMethod : m))
          );
          setMessage("Payment method updated successfully");
          setIsSuccess(true);
        }}
      />
    </PageContainer>
  );
};

export default PaymentMethods;
