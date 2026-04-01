import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  Modal,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  RefreshControl,
} from 'react-native';
import { useServiceFee } from '../../hooks/useServiceFee';

interface PaymentHistoryModalProps {
  visible: boolean;
  onClose: () => void;
  unit: any;
}

const PaymentHistoryModal: React.FC<PaymentHistoryModalProps> = ({
  visible,
  onClose,
  unit,
}) => {
  const { payments, isLoadingPayments, loadPayments } = useServiceFee();
  const [unitPayments, setUnitPayments] = useState<any[]>([]);
  const [refreshing, setRefreshing] = useState(false);

  // Debug logging for PaymentHistoryModal
  console.log('📱 PaymentHistoryModal render:', {
    visible,
    unit: unit ? `${unit.tower_name}, ${unit.unit_name}` : 'none',
    unitId: unit?.id,
    paymentsCount: payments?.length || 0,
    unitPaymentsCount: unitPayments?.length || 0,
    isLoadingPayments,
    refreshing
  });

  useEffect(() => {
    console.log('🔄 PaymentHistoryModal useEffect - visible/unit changed:', {
      visible,
      unit: unit ? `${unit.tower_name}, ${unit.unit_name}` : 'none',
      unitId: unit?.id,
      willLoadPayments: visible && unit
    });
    
    if (visible && unit) {
      console.log('📡 PaymentHistoryModal loading payments for unit:', unit.id);
      loadPayments({ unit: unit.id });
    }
  }, [visible, unit, loadPayments]);

  useEffect(() => {
    console.log('🔄 PaymentHistoryModal useEffect - payments/unit changed:', {
      paymentsCount: payments.length,
      unit: unit ? `${unit.tower_name}, ${unit.unit_name}` : 'none',
      unitId: unit?.id,
      willFilter: unit && payments.length > 0
    });
    
    if (unit && payments.length > 0) {
      const filtered = payments.filter(payment => payment.unit === unit.id);
      console.log('📊 PaymentHistoryModal filtered payments:', {
        totalPayments: payments.length,
        filteredCount: filtered.length,
        unitId: unit.id
      });
      setUnitPayments(filtered);
    }
  }, [payments, unit]);

  const onRefresh = async () => {
    setRefreshing(true);
    try {
      console.log('🔄 PaymentHistoryModal refresh triggered');
      if (unit) {
        await loadPayments({ unit: unit.id });
      }
      console.log('✅ Payment history data refreshed successfully');

      // Add a small delay to show refresh indicator
      await new Promise(resolve => setTimeout(resolve, 500));
    } catch (error) {
      console.error('❌ Error during payment history refresh:', error);
    } finally {
      setRefreshing(false);
    }
  };

  const formatDate = (dateString: string) => {
    if (!dateString) return 'N/A';
    try {
      const date = new Date(dateString);
      return date.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      });
    } catch {
      return 'N/A';
    }
  };

  const getPaymentStatus = (payment: any) => {
    const dueAmount = parseFloat(payment.outstanding_amount || '0');
    const feeAmount = parseFloat(payment.service_fee_amount || '0');
    const isOverdue = payment.is_overdue;
    const isFullyPaid = payment.is_fully_paid;
    const isPartialPayment = payment.is_partial_payment;

    // Fully paid
    if (isFullyPaid || dueAmount === 0) {
      return {
        label: 'Paid',
        color: '#10B981',
        bgColor: '#D1FAE5',
      };
    }

    // Partial payment
    if (isPartialPayment || (dueAmount > 0 && dueAmount < feeAmount)) {
      if (isOverdue) {
        return {
          label: 'Overdue',
          color: '#EF4444',
          bgColor: '#FEE2E2',
        };
      }
      return {
        label: 'Partial',
        color: '#F59E0B',
        bgColor: '#FEF3C7',
      };
    }

    // Overdue
    if (isOverdue) {
      return {
        label: 'Overdue',
        color: '#EF4444',
        bgColor: '#FEE2E2',
      };
    }

    // Due
    return {
      label: 'Due',
      color: '#3B82F6',
      bgColor: '#DBEAFE',
    };
  };

  const getPaymentMethodDisplay = (method: string) => {
    switch (method?.toLowerCase()) {
      case 'bkash':
        return 'bKash';
      case 'nagad':
        return 'Nagad';
      case 'rocket':
        return 'Rocket';
      case 'bank_transfer':
        return 'Bank Transfer';
      case 'sslcommerz':
        return 'SSLCommerz';
      case 'cash':
        return 'Cash';
      default:
        return method || 'N/A';
    }
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <View className="flex-1 bg-white">
        {/* Header */}
        <View className="bg-teal-500 px-4 py-3 flex-row items-center justify-between">
          <Text className="text-white text-lg font-semibold font-['Oxanium-SemiBold']">
            Payment History
          </Text>
          <TouchableOpacity onPress={onClose}>
            <Text className="text-white text-lg font-bold">✕</Text>
          </TouchableOpacity>
        </View>

        {/* Unit Info */}
        {unit && (
          <View className="bg-gray-50 px-4 py-3 border-b border-gray-200">
            <Text className="text-black text-base font-bold font-['Oxanium-Bold']">
              {unit.tower_name}, {unit.unit_name}
            </Text>
            <Text className="text-gray-600 text-sm font-['Oxanium-Regular']">
              Current Balance: Tk {unit.due_amount || '0'}
            </Text>
          </View>
        )}

        {/* Content */}
        <ScrollView 
          className="flex-1"
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              colors={['#3C9D9B']}
              tintColor="#3C9D9B"
            />
          }
        >
          {isLoadingPayments ? (
            <View className="flex-1 items-center justify-center py-8">
              <ActivityIndicator size="large" color="#3D9D9B" />
              <Text className="text-gray-600 mt-4 font-['Oxanium-Regular']">
                Loading payment history...
              </Text>
            </View>
          ) : unitPayments.length === 0 ? (
            <View className="flex-1 items-center justify-center py-8 px-6">
              <View className="w-20 h-20 rounded-full bg-gray-100 items-center justify-center mb-4">
                <Text className="text-gray-400 text-2xl">📋</Text>
              </View>
              <Text className="text-gray-600 text-lg text-center font-['Oxanium-Medium'] mb-2">
                No Payment History
              </Text>
              <Text className="text-gray-500 text-sm text-center font-['Oxanium-Regular']">
                No payments have been made for this unit yet.
              </Text>
            </View>
          ) : (
            <View className="p-4">
              {unitPayments.map((payment, index) => {
                const paymentStatus = getPaymentStatus(payment);
                return (
                  <View
                    key={payment.id || index}
                    className="bg-white rounded-lg p-4 mb-4 border border-gray-200"
                  >
                    {/* Header */}
                    <View className="flex-row justify-between items-start mb-3">
                      <View className="flex-1">
                        <Text className="text-black text-base font-bold font-['Oxanium-Bold']">
                          {payment.service_period_display || 'N/A'}
                        </Text>
                        <Text className="text-gray-600 text-sm font-['Oxanium-Regular']">
                          Transaction: {payment.transaction_id || 'N/A'}
                        </Text>
                      </View>
                      <View style={{ backgroundColor: paymentStatus.bgColor }} className="px-3 py-1 rounded-full">
                        <Text style={{ color: paymentStatus.color }} className="text-xs font-bold font-['Oxanium-SemiBold'] uppercase">
                          {paymentStatus.label}
                        </Text>
                      </View>
                    </View>

                  {/* Payment Details */}
                  <View className="space-y-2">
                    <View className="flex-row justify-between">
                      <Text className="text-gray-600 text-sm font-['Oxanium-Regular']">
                        Amount Paid:
                      </Text>
                      <Text className="text-black text-sm font-bold font-['Oxanium-Bold']">
                        Tk {payment.amount || '0'}
                      </Text>
                    </View>

                    {payment.original_amount && (
                      <View className="flex-row justify-between">
                        <Text className="text-gray-600 text-sm font-['Oxanium-Regular']">
                          Original Amount:
                        </Text>
                        <Text className="text-gray-700 text-sm font-['Oxanium-Medium']">
                          Tk {payment.original_amount}
                        </Text>
                      </View>
                    )}

                    {payment.remaining_amount && parseFloat(payment.remaining_amount) > 0 && (
                      <View className="flex-row justify-between">
                        <Text className="text-gray-600 text-sm font-['Oxanium-Regular']">
                          Remaining:
                        </Text>
                        <Text className="text-orange-600 text-sm font-bold font-['Oxanium-Bold']">
                          Tk {payment.remaining_amount}
                        </Text>
                      </View>
                    )}

                    <View className="flex-row justify-between">
                      <Text className="text-gray-600 text-sm font-['Oxanium-Regular']">
                        Payment Method:
                      </Text>
                      <Text className="text-black text-sm font-['Oxanium-Medium']">
                        {getPaymentMethodDisplay(payment.payment_method)}
                      </Text>
                    </View>

                    <View className="flex-row justify-between">
                      <Text className="text-gray-600 text-sm font-['Oxanium-Regular']">
                        Payment Date:
                      </Text>
                      <Text className="text-black text-sm font-['Oxanium-Medium']">
                        {formatDate(payment.payment_date)}
                      </Text>
                    </View>

                    {payment.payment_status && (
                      <View className="flex-row justify-between">
                        <Text className="text-gray-600 text-sm font-['Oxanium-Regular']">
                          Status:
                        </Text>
                        <Text className="text-black text-sm font-['Oxanium-Medium'] capitalize">
                          {payment.payment_status}
                        </Text>
                      </View>
                    )}

                    {payment.reference_number && (
                      <View className="flex-row justify-between">
                        <Text className="text-gray-600 text-sm font-['Oxanium-Regular']">
                          Reference:
                        </Text>
                        <Text className="text-black text-sm font-['Oxanium-Medium']">
                          {payment.reference_number}
                        </Text>
                      </View>
                    )}

                    {payment.notes && (
                      <View className="mt-2 pt-2 border-t border-gray-100">
                        <Text className="text-gray-600 text-sm font-['Oxanium-Regular'] mb-1">
                          Notes:
                        </Text>
                        <Text className="text-gray-800 text-sm font-['Oxanium-Regular']">
                          {payment.notes}
                        </Text>
                      </View>
                    )}
                  </View>

                  {/* Payment Progress */}
                  {payment.payment_percentage !== undefined && (
                    <View className="mt-3 pt-3 border-t border-gray-100">
                      <View className="flex-row justify-between mb-1">
                        <Text className="text-gray-600 text-xs font-['Oxanium-Regular']">
                          Payment Progress
                        </Text>
                        <Text className="text-gray-600 text-xs font-['Oxanium-Regular']">
                          {payment.payment_percentage.toFixed(1)}%
                        </Text>
                      </View>
                      <View className="w-full bg-gray-200 rounded-full h-2">
                        <View
                          className="bg-teal-500 h-2 rounded-full"
                          style={{ width: `${Math.min(payment.payment_percentage, 100)}%` }}
                        />
                      </View>
                    </View>
                  )}
                </View>
                );
              })}
            </View>
          )}
        </ScrollView>

        {/* Footer */}
        <View className="bg-gray-50 px-4 py-3 border-t border-gray-200">
          <TouchableOpacity
            className="bg-teal-500 rounded-lg p-3 items-center"
            onPress={onClose}
          >
            <Text className="text-white text-base font-bold font-['Oxanium-Bold']">
              Close
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
};

export default PaymentHistoryModal;
