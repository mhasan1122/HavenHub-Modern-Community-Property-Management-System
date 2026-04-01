import { useState, useEffect } from "react";
import { FaPlus, FaEye } from "react-icons/fa";
import Heading from "Components/HeadingComponent/Heading";
import { Div } from "Components/Ui/Div";
import Button from "../../../../Components/FormComponent/ButtonComponent/Button";
import CreateServiceFeeForm from "./CreateServiceFeeForm";
import { useServiceFees } from "../../../../hooks/useServiceFees";

const ServiceFeeSettingList = () => {
  const [open, setOpen] = useState(false);

  const {
    serviceFees,
    loading,
    error,
    loadServiceFees,
  } = useServiceFees();

  // Load service fees on component mount
  useEffect(() => {
    loadServiceFees();
  }, [loadServiceFees]);

  return (
    <Div className="p-2">
      <Div className="container">
        <Div className="relative shadow rounded-27  py-4 px-4">
          <Div className="flex justify-between items-center py-4 mb-4">
            <h2 className="text-2xl font-semibold text-black">
              Service Fee Settings List
            </h2>
            
            <Div className="flex items-center space-x-4">
              <Button
                icon={FaPlus}
                onClick={() => setOpen(true)}
                className="bg-teal-600 text-center  text-white px-6 py-2 rounded"
              >
                 Create Service Fee
              </Button>
            </Div>
          </Div>
          <Div className="overflow-x-auto">
            <table className="min-w-full ">
              <thead>
                <tr className="text-black text-left bg-primary">
                  <th className="px-6 py-3 font-semibold">Tower Name</th>
                  <th className="px-6 py-3 font-semibold">Unites</th>
                  <th className="px-6 py-3 font-semibold">Fee Amount (BDT)</th>
                  <th className="px-6 py-3 font-semibold">Billing Cycle</th>
                  <th className="px-6 py-3 font-semibold">
                    Due Day of the Month
                  </th>
                  <th className="px-6 py-3 font-semibold">
                    Accepted Payment Methods
                  </th>
                  <th className="px-6 py-3 font-semibold">Action</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan="7" className="px-6 py-4 text-center">
                    </td>
                  </tr>
                ) : error ? (
                  <tr>
                    <td colSpan="7" className="px-6 py-4 text-center text-red-600">
                      Error: {error.message || error}
                    </td>
                  </tr>
                ) : serviceFees.length === 0 ? (
                  <tr>
                    <td colSpan="7" className="px-6 py-4 text-center">
                      No service fees found
                    </td>
                  </tr>
                ) : (
                  serviceFees.map((fee) => (
                    <tr key={fee.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4">
                        {fee.tower_names?.length > 0 ? fee.tower_names.join(", ") : "N/A"}
                      </td>
                        <td className="px-6 py-4">
                          {(() => {
                            // If specific units are selected, check if it's all units from the tower
                            if (fee.unit_names && fee.unit_names.length > 0) {
                              // If all units from the tower are selected, show "All"
                              if (fee.total_units_in_towers && 
                                  fee.unit_names.length === fee.total_units_in_towers) {
                                return "All";
                              }
                              // Otherwise show the specific unit names
                              return fee.unit_names.join(", ");
                            }
                            // If towers are selected but no specific units, show "All"
                            if (fee.tower_names?.length > 0 && (!fee.unit_names || fee.unit_names.length === 0)) {
                              return "All";
                            }
                            // Fallback to "All"
                            return "All";
                          })()}
                        </td>
                      <td className="px-6 py-4">
                        {fee.currency === 'BDT' ? '৳' : '$'}{fee.fee_amount}
                      </td>
                      <td className="px-6 py-4">
                        {fee.billing_cycle}
                      </td>
                      <td className="px-6 py-4">
                        {fee.due_day}th of every month
                      </td>
                      <td className="px-6 py-4">
                        {(() => {
                          try {
                            // Debug logging
                            console.log('DEBUG: ServiceFee payment_methods:', fee.payment_methods);
                            console.log('DEBUG: ServiceFee accepts_cash:', fee.accepts_cash);
                            console.log('DEBUG: ServiceFee accepts_mfs:', fee.accepts_mfs);
                            console.log('DEBUG: ServiceFee accepts_bank:', fee.accepts_bank);
                            
                            // Safety check for payment_methods
                            if (fee.payment_methods && Array.isArray(fee.payment_methods)) {
                              // Check if it contains objects or strings
                              const methods = fee.payment_methods.map(method => {
                                if (typeof method === 'string') {
                                  return method;
                                } else if (typeof method === 'object' && method !== null) {
                                  // If it's an object, try to extract a meaningful name
                                  console.log('DEBUG: Found object in payment_methods:', method);
                                  return method.provider || method.bank_name || method.name || 'Unknown';
                                }
                                return 'Unknown';
                              });
                              return methods.join(", ");
                            } else if (fee.payment_methods && typeof fee.payment_methods === 'object') {
                              // Fallback: if payment_methods is an object, use the boolean fields
                              console.log('DEBUG: payment_methods is an object, using fallback');
                              const methods = [];
                              if (fee.accepts_cash) methods.push('Cash');
                              if (fee.accepts_mfs) methods.push('MFS');
                              if (fee.accepts_bank) methods.push('Bank');
                              return methods.length > 0 ? methods.join(", ") : "N/A";
                            } else {
                              // Fallback: use the boolean fields directly
                              console.log('DEBUG: Using boolean fields fallback');
                              const methods = [];
                              if (fee.accepts_cash) methods.push('Cash');
                              if (fee.accepts_mfs) methods.push('MFS');
                              if (fee.accepts_bank) methods.push('Bank');
                              return methods.length > 0 ? methods.join(", ") : "N/A";
                            }
                          } catch (error) {
                            console.error('Error rendering payment methods:', error);
                            // Ultimate fallback: use boolean fields
                            const methods = [];
                            if (fee.accepts_cash) methods.push('Cash');
                            if (fee.accepts_mfs) methods.push('MFS');
                            if (fee.accepts_bank) methods.push('Bank');
                            return methods.length > 0 ? methods.join(", ") : "N/A";
                          }
                        })()}
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex justify-center">
                          <button>
                            <FaEye className="w-[25px] h-[20px] text-primary" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </Div>
          {open && <CreateServiceFeeForm onClose={() => setOpen(false)} />}
        </Div>
      </Div>
    </Div>
  );
};

export default ServiceFeeSettingList;
