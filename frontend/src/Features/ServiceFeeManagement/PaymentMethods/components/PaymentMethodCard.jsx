import React from 'react';
import { FaEdit, FaTrash, FaCheckCircle, FaTimesCircle, FaMoneyBillWave, FaBuilding, FaWallet, FaCreditCard } from 'react-icons/fa';

const PaymentMethodCard = ({ method, onEdit, onToggleStatus }) => {
    const getIcon = (type) => {
        switch (type?.toLowerCase()) {
            case 'cash':
                return <FaMoneyBillWave className="text-green-500" size={24} />;
            case 'bank':
                return <FaBuilding className="text-blue-500" size={24} />;
            case 'mfs':
                return <FaWallet className="text-pink-500" size={24} />;
            case 'card':
                return <FaCreditCard className="text-purple-500" size={24} />;
            default:
                return <FaMoneyBillWave className="text-gray-500" size={24} />;
        }
    };

    const getStatusColor = (active) => {
        return active ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700';
    };

    return (
        <div className={`bg-white rounded-2xl p-5 border shadow-sm transition-all duration-300 hover:shadow-md ${!method.is_active ? 'opacity-75 grayscale-[0.5]' : ''}`}>
            <div className="flex justify-between items-start mb-4">
                <div className="p-3 bg-gray-50 rounded-xl">
                    {method.icon ? (
                        // Placeholder if icon is string or something else
                        <span className="text-xl">{getIcon(method.method_type)}</span>
                    ) : (
                        getIcon(method.method_type)
                    )}
                </div>
                <div className="flex gap-2">
                    {onEdit && (
                        <button
                            onClick={() => onEdit(method)}
                            className="p-2 text-gray-400 hover:text-teal-600 hover:bg-teal-50 rounded-lg transition-colors"
                            title="Edit Method"
                        >
                            <FaEdit size={16} />
                        </button>
                    )}
                    {onToggleStatus && (
                        <button
                            onClick={() => onToggleStatus(method)}
                            className={`p-2 rounded-lg transition-colors ${method.is_active ? 'text-gray-400 hover:text-red-500 hover:bg-red-50' : 'text-gray-400 hover:text-green-500 hover:bg-green-50'}`}
                            title={method.is_active ? 'Deactivate Method' : 'Activate Method'}
                        >
                            {method.is_active ? <FaTimesCircle size={16} /> : <FaCheckCircle size={16} />}
                        </button>
                    )}
                </div>
            </div>

            <div className="mb-4">
                <h3 className="text-lg font-bold text-gray-900 mb-1">{method.method_name}</h3>
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-widest px-2 py-0.5 bg-gray-100 rounded-full inline-block">
                    {method.method_type}
                </p>
            </div>

            <div className="flex items-center justify-between mt-auto pt-4 border-t border-gray-100">
                <span className={`text-[10px] uppercase font-bold px-3 py-1 rounded-full ${getStatusColor(method.is_active)}`}>
                    {method.is_active ? 'Active' : 'Inactive'}
                </span>
                {method.display_order !== undefined && (
                    <span className="text-[10px] text-gray-400 font-bold">Order: {method.display_order}</span>
                )}
            </div>

            {method.description && (
                <p className="mt-3 text-xs text-gray-500 line-clamp-2 leading-relaxed">
                    {method.description}
                </p>
            )}
        </div>
    );
};

export default PaymentMethodCard;
