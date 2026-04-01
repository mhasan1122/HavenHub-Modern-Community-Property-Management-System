import React from 'react';
import { Modal, View, Text, TouchableOpacity, ScrollView, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Ionicons from '@expo/vector-icons/Ionicons';
import AntDesign from '@expo/vector-icons/AntDesign';

interface AllocatedBill {
  month: string;
  year: number;
  amountDue: number;
  paying: number;
  status: 'Fully Paid' | 'Partially Paid';
}

interface AllocationData {
  totalPayment: number;
  totalOutstanding: number;
  allocatedBills: AllocatedBill[];
  advanceAmount: number;
}

interface PaymentAllocationModalProps {
  visible: boolean;
  onClose: () => void;
  onConfirm: () => void;
  data: AllocationData | null;
}

const PaymentAllocationModal: React.FC<PaymentAllocationModalProps> = ({
  visible,
  onClose,
  onConfirm,
  data
}) => {
  if (!data) return null;

  const { totalPayment, totalOutstanding, allocatedBills, advanceAmount } = data;

  return (
    <Modal
      visible={visible}
      transparent={true}
      animationType="slide"
      onRequestClose={onClose}
    >
      <View className="flex-1 justify-end bg-black/50">
        <View className="bg-white rounded-t-3xl max-h-[90%] w-full flex-1 mt-10">
          <SafeAreaView edges={['top']} className="flex-1 bg-white rounded-t-3xl">
            <View className="p-4 border-b border-gray-100 flex-row justify-between items-center">
              <View className="flex-1 mr-4">
                <Text className="text-2xl font-bold text-gray-900">Confirm Payment Allocation</Text>
                <Text className="text-base text-gray-500 mt-1">
                  Review how your payment of ৳{totalPayment.toLocaleString()} will be allocated
                </Text>
              </View>
              <TouchableOpacity onPress={onClose} className="p-2 bg-gray-100 rounded-full">
                <Ionicons name="close" size={28} color="#374151" />
              </TouchableOpacity>
            </View>

            <ScrollView className="p-4 flex-1" showsVerticalScrollIndicator={false}>
              {/* Summary Cards */}
              <View className="flex-row gap-3 mb-6">
                <View className="flex-1 bg-blue-50 p-4 rounded-xl border border-blue-100">
                  <Text className="text-sm text-blue-600 font-medium mb-1">Total Payment</Text>
                  <Text className="text-xl font-bold text-blue-900">৳{totalPayment.toLocaleString()}</Text>
                </View>
                <View className="flex-1 bg-orange-50 p-4 rounded-xl border border-orange-100">
                  <Text className="text-sm text-orange-600 font-medium mb-1">Total Outstanding</Text>
                  <Text className="text-xl font-bold text-orange-900">৳{totalOutstanding.toLocaleString()}</Text>
                </View>
              </View>

              {/* Allocated to Bills */}
              {allocatedBills.length > 0 && (
                <View className="mb-6">
                  <View className="flex-row items-center gap-2 mb-3">
                    <View className="w-10 h-10 bg-green-100 rounded-full items-center justify-center">
                      <Ionicons name="receipt-outline" size={22} color="#166534" />
                    </View>
                    <View>
                      <Text className="text-lg font-bold text-gray-900">Allocated to Bills</Text>
                      <Text className="text-sm text-gray-500">{allocatedBills.length} Bill{allocatedBills.length !== 1 ? 's' : ''}</Text>
                    </View>
                  </View>

                  <View className="space-y-3">
                    {allocatedBills.map((bill, index) => (
                      <View key={index} className="bg-white border border-gray-200 rounded-xl p-4 shadow-sm">
                        <View className="flex-row justify-between items-start mb-2">
                          <Text className="text-lg font-bold text-gray-800">{bill.month} {bill.year}</Text>
                          <View className={`px-3 py-1.5 rounded-full ${bill.status === 'Fully Paid' ? 'bg-green-100' : 'bg-yellow-100'}`}>
                            <Text className={`text-xs font-bold ${bill.status === 'Fully Paid' ? 'text-green-700' : 'text-yellow-700'}`}>
                              {bill.status}
                            </Text>
                          </View>
                        </View>

                        <View className="flex-row justify-between items-center text-base mb-1">
                          <Text className="text-gray-500 text-base">Amount Due: <Text className="text-gray-900 font-medium">৳{bill.amountDue.toLocaleString()}</Text></Text>
                        </View>
                        <View className="flex-row justify-between items-center">
                          <Text className="text-gray-500 text-base">Paying: <Text className="text-green-600 font-bold">৳{bill.paying.toLocaleString()}</Text></Text>
                        </View>
                      </View>
                    ))}
                  </View>
                </View>
              )}

              {/* Advance Payment Section */}
              {advanceAmount > 0 && (
                <View className="mb-6">
                  <View className="bg-indigo-50 border border-indigo-100 rounded-xl overflow-hidden">
                    <View className="p-5 bg-indigo-100/50 flex-row items-center gap-3">
                      <View className="w-12 h-12 bg-indigo-600 rounded-full items-center justify-center shadow-sm">
                        <Ionicons name="wallet-outline" size={24} color="white" />
                      </View>
                      <View className="flex-1">
                        <Text className="text-lg font-bold text-indigo-900">Advance Payment</Text>
                        <Text className="text-sm text-indigo-700 leading-5">The remaining amount will be saved as advance credit toward future bills</Text>
                      </View>
                    </View>

                    <View className="p-5">
                      <View className="flex-row justify-between items-center mb-5">
                        <Text className="text-indigo-900 text-lg font-medium">Advance Amount</Text>
                        <View className="items-end">
                          <Text className="text-sm text-indigo-500 mb-0.5">Available for future bills</Text>
                          <Text className="text-2xl font-bold text-indigo-700">৳{advanceAmount.toLocaleString()}/-</Text>
                        </View>
                      </View>

                      <View className="bg-white/60 rounded-lg p-4">
                        <Text className="text-sm font-bold text-indigo-900 mb-3">How advance payments work:</Text>
                        <View className="space-y-2">
                          <View className="flex-row items-start gap-2">
                            <Ionicons name="checkmark-circle" size={18} color="#4F46E5" style={{ marginTop: 1 }} />
                            <Text className="text-sm text-indigo-800 flex-1">Automatically applied to future service fee bills</Text>
                          </View>
                          <View className="flex-row items-start gap-2">
                            <Ionicons name="checkmark-circle" size={18} color="#4F46E5" style={{ marginTop: 1 }} />
                            <Text className="text-sm text-indigo-800 flex-1">Reduces amount due on upcoming invoices</Text>
                          </View>
                          <View className="flex-row items-start gap-2">
                            <Ionicons name="checkmark-circle" size={18} color="#4F46E5" style={{ marginTop: 1 }} />
                            <Text className="text-sm text-indigo-800 flex-1">Visible in unit's payment history and balance</Text>
                          </View>
                        </View>
                      </View>
                    </View>
                  </View>
                </View>
              )}

              {/* Allocation Breakdown */}
              <View className="bg-gray-50 rounded-xl p-5 mb-8">
                <Text className="text-lg font-bold text-gray-900 mb-4">Allocation Breakdown</Text>
                <View className="space-y-3">
                  <View className="flex-row justify-between">
                    <Text className="text-base text-gray-600">Payment Amount Entered</Text>
                    <Text className="text-base font-medium text-gray-900">৳{totalPayment.toLocaleString()}</Text>
                  </View>
                  {allocatedBills.length > 0 && (
                    <View className="flex-row justify-between">
                      <Text className="text-base text-gray-600">Applied to Bills</Text>
                      <Text className="text-base font-medium text-red-500">-৳{(totalPayment - advanceAmount).toLocaleString()}</Text>
                    </View>
                  )}
                  {advanceAmount > 0 && (
                    <View className="flex-row justify-between">
                      <Text className="text-base text-gray-600">Saved as Advance (New Credit)</Text>
                      <Text className="text-base font-medium text-green-600">-৳{advanceAmount.toLocaleString()}</Text>
                    </View>
                  )}
                  <View className="h-[1px] bg-gray-200 my-2" />
                  <View className="flex-row justify-between">
                    <Text className="text-lg font-bold text-gray-900">Total Accounted For</Text>
                    <Text className="text-lg font-bold text-gray-900">৳{totalPayment.toLocaleString()}</Text>
                  </View>
                </View>
              </View>

            </ScrollView>

            {/* Footer Actions */}
            <View className="p-6 border-t border-gray-100 bg-white shadow-lg">
              <View className="flex-row gap-4">
                <TouchableOpacity
                  onPress={onClose}
                  className="flex-1 py-4 bg-gray-100 rounded-xl items-center"
                >
                  <Text className="text-lg font-semibold text-gray-700">Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={onConfirm}
                  className="flex-1 py-4 bg-primary rounded-xl items-center shadow-md "
                >
                  <Text className="text-lg font-bold text-white">Confirm Payment</Text>
                </TouchableOpacity>
              </View>
            </View>
          </SafeAreaView>
        </View>
      </View>
    </Modal>
  );
};

export default PaymentAllocationModal;
