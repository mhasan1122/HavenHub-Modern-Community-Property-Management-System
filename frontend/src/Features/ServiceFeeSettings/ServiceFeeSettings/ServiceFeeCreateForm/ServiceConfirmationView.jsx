// ServiceConfirmationView.jsx
import React from "react";

/**
 * Helper function to check if payment settings are configured
 * @param {Object} data - Form data
 * @returns {boolean} - True if any payment settings exist
 */
const hasPaymentSettings = (data) => {
  // Check if MFS is enabled and has accounts
  const hasMfsAccounts = data?.paymentMethods?.mfs &&
    Array.isArray(data?.mfs) &&
    data.mfs.length > 0 &&
    data.mfs.some((mfs) => mfs && typeof mfs === "object" && mfs.provider);

  // Check if Bank is enabled and has details
  const hasBankDetails =
    data?.paymentMethods?.bank &&
    data?.bank &&
    typeof data.bank === "object" &&
    (data.bank.bankName || data.bank.accountName || data.bank.accountNumber);

  return hasMfsAccounts || hasBankDetails;
};

const SectionTitle = ({ children, className = "" }) => (
  <div className={`mb-3 ${className}`}>
    <h3 className="text-base font-medium text-primary">{children}</h3>
  </div>
);

/**
 * Helper function to get ordinal suffix (st, nd, rd, th)
 * @param {number} day - The day number
 * @returns {string} - The ordinal suffix
 */
const getOrdinalSuffix = (day) => {
  const num = parseInt(day, 10) || 1;
  const lastDigit = num % 10;
  const lastTwoDigits = num % 100;

  // Special cases for 11th, 12th, 13th
  if (lastTwoDigits >= 11 && lastTwoDigits <= 13) {
    return "th";
  }

  // Regular cases
  if (lastDigit === 1) return "st";
  if (lastDigit === 2) return "nd";
  if (lastDigit === 3) return "rd";
  return "th";
};

/**
 * Service Fee Confirmation View Component
 * @param {Object} props - Component props
 * @param {Object} props.data - Form data to display
 * @param {Function} props.onBack - Back button handler
 * @param {Function} props.onSubmit - Submit button handler
 */
const ServiceConfirmationView = ({ data, towers = [], units = [], onBack, onSubmit, onClose, isEdit = false }) => {
  // Helper function to get tower name
  const getTowerName = () => {
    if (data?.tower && towers.length > 0) {
      // Find the tower by ID
      const tower = towers.find((t) => String(t.id) === String(data.tower));
      if (tower) {
        return tower.tower_name || tower.name || `Tower ${tower.id} `;
      }
    }
    // If no tower is selected or found, show a meaningful message
    return data?.tower ? "Unknown Tower" : "No Tower Selected";
  };

  // Helper function to get unit display
  const getUnitDisplay = () => {
    console.log("getUnitDisplay called with:", {
      dataUnit: data?.unit,
      unitsLength: units.length,
      units: units.slice(0, 3) // Show first 3 units for debugging
    });

    if (data?.unit && Array.isArray(data.unit)) {
      // If all units are selected (array length equals total units available)
      if (data.unit.length === units.length && units.length > 0) {
        return "All";
      }
      // If specific units are selected, show unit names
      if (data.unit.length > 0) {
        const selectedUnitNames = data.unit.map((unitId) => {
          const unit = units.find((u) => String(u.id) === String(unitId));
          if (unit) {
            // Use enhanced display logic
            let unitName = unit.display_name;
            if (!unitName) {
              const name = unit.unit_name || unit.name || `Unit ${unit.id} `;
              const floor =
                unit.floor_no || unit.floor_number || unit.floor || "N/A";
              const tower = unit.tower_name || "";
              unitName = tower
                ? `${name} (Floor ${floor}, ${tower})`
                : `${name} (Floor ${floor})`;
            }
            console.log("Confirmation view unit display:", {
              unitId,
              unit,
              displayName: unitName,
              hasDisplayName: !!unit.display_name,
              unitName: unit.unit_name,
              floorNo: unit.floor_no,
              towerName: unit.tower_name
            });
            return unitName;
          }
          console.log('Unit not found for ID:', unitId, 'Available units:', units.map(u => u.id));
          return `Unit ${unitId} `;
        });
        return selectedUnitNames.join(", ");
      }
    }
    // If unit is 'all' string or empty, show 'All'
    if (data?.unit === "all" || data?.unit === "All" || !data?.unit) {
      return "All";
    }
    return "All";
  };

  return (
    <div className="fixed inset-0 z-50 flex justify-center items-center bg-black/40 p-2 sm:p-6">
      <div className="w-full max-w-[1188px] max-h-[95vh] sm:max-h-[90vh] bg-white rounded-2xl shadow-2xl flex flex-col overflow-hidden">
        {/* Scrollable Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Service Fee Settings Section */}
          <ServiceFeeSettingsSection
            data={data}
            getTowerName={getTowerName}
            getUnitDisplay={getUnitDisplay}
            isEdit={isEdit}
          />

          {/* Payment Settings Section - Only show if payment methods are configured */}
          {hasPaymentSettings(data) && <PaymentSettingsSection data={data} />}

          {/* Late Payment Penalties Section */}
          <LatePaymentPenaltiesSection data={data} />
        </div>

        {/* Fixed Footer with Action Buttons */}
        <div className="p-6 bg-white">
          <div className="flex items-center justify-center gap-3">
            <button
              type="button"
              onClick={onBack || onClose}
              className="px-6 py-2 rounded-lg border border-gray-300 text-gray-700 hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={onSubmit}
              className="px-6 py-2 rounded-lg bg-teal-600 text-white hover:bg-teal-700"
            >
              {isEdit ? "Update" : "Save"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

/**
 * Service Fee Settings Section Component
 * @param {Object} props - Component props
 * @param {Object} props.data - Form data
 */
const ServiceFeeSettingsSection = ({ data, getTowerName, getUnitDisplay, isEdit = false }) => (
  <div className="bg-white rounded-xl border border-gray-200 p-6">
    <SectionTitle className="text-primary">
      {isEdit ? "Edit Service Fee Settings" : "Service Fee Settings"}
    </SectionTitle>

    {/* Main Info Grid */}
    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4 sm:gap-6 mb-6">
      {/* Tower Name */}
      <div>
        <div className="text-sm font-medium text-primary mb-1">Tower Name</div>
        <div className="text-base font-semibold">{getTowerName()}</div>
      </div>

      {/* Units */}
      <div>
        <div className="text-sm font-medium text-primary mb-1">Units</div>
        <div className="text-base font-semibold">{getUnitDisplay()}</div>
      </div>

      {/* Fee Amount */}
      <div>
        <div className="text-sm font-medium text-primary mb-1">
          Fee Amount (BDT)
        </div>
        <div className="text-base font-semibold">{data?.feeAmount || "0"}</div>
      </div>

      {/* Service Fee Date */}
      <div>
        <div className="text-sm font-medium text-primary mb-1">Service Fee Date</div>
        <div className="text-base font-semibold">
          {data?.serviceFeeDate
            ? new Date(data.serviceFeeDate)
                .toLocaleDateString("en-GB", {
                  day: "2-digit",
                  month: "2-digit",
                  year: "numeric"
                })
                .replace(/\//g, "-")
            : "Not specified"}
        </div>
      </div>
    </div>

    {/* Secondary Info Grid */}
    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4 sm:gap-6">
      {/* Billing Cycle */}
      <div>
        <div className="text-sm font-medium text-primary mb-1">
          Billing Cycle
        </div>
        <div className="text-base">{data?.billingCycle || "Monthly"}</div>
      </div>

      {/* Due Day */}
      <div>
        <div className="text-sm font-medium text-primary mb-1">
          Due Day of the Month
        </div>
        <div className="text-base">
          {data?.dueDay || "1"}
          <sup>{getOrdinalSuffix(data?.dueDay || "1")}</sup> of every month
        </div>
      </div>

      {/* Payment Methods */}
      <div>
        <div className="text-sm font-medium text-primary mb-1">
          Accepted Payment Methods
        </div>
        <div className="text-base">
          {(() => {
            const methods = [];
            if (data?.paymentMethods?.cash) methods.push("Cash");
            if (data?.paymentMethods?.bank) methods.push("Bank");
            if (data?.paymentMethods?.mfs) {
              // Get unique MFS providers from the data
              const mfsProviders = data?.mfs?.map(mfs => mfs.provider).filter(Boolean) || [];
              const uniqueProviders = [...new Set(mfsProviders)];
              if (uniqueProviders.length > 0) {
                methods.push(...uniqueProviders);
              } else {
                methods.push("bKash"); // Default fallback
              }
            }
            return methods.join(", ") || "N/A";
          })()}
        </div>
      </div>

      {/* Empty div for alignment */}
      <div></div>
    </div>
  </div>
);

/**
 * Payment Settings Section Component
 * @param {Object} props - Component props
 * @param {Object} props.data - Form data
 */
const PaymentSettingsSection = ({ data }) => {
  // Ensure data.mfs is an array
  const mfsData = Array.isArray(data?.mfs) ? data.mfs : [];

  // Debug logging
    console.log('PaymentSettingsSection - MFS data:', mfsData);
    console.log('PaymentSettingsSection - Payment methods:', data?.paymentMethods);

  // Filter bKash accounts
    const bkashAccounts = mfsData.filter(mfs =>
        mfs && typeof mfs === 'object' && (
            mfs.provider?.toLowerCase() === 'bkash' ||
            mfs.provider?.toLowerCase() === 'bKash'
        )
  );

  // Filter Nagad accounts
    const nagadAccounts = mfsData.filter(mfs =>
        mfs && typeof mfs === 'object' &&
        mfs.provider?.toLowerCase() === 'nagad'
  );

  // Filter Rocket accounts
    const rocketAccounts = mfsData.filter(mfs =>
        mfs && typeof mfs === 'object' &&
        mfs.provider?.toLowerCase() === 'rocket'
  );

  // Filter iKash accounts (check multiple possible spellings)
    const ikashAccounts = mfsData.filter(mfs =>
        mfs && typeof mfs === 'object' && (
            mfs.provider?.toLowerCase() === 'ikash' ||
            mfs.provider?.toLowerCase() === 'ikcash'
        )
  );

  // Debug logging for each provider
  console.log("bKash accounts:", bkashAccounts);
  console.log("Nagad accounts:", nagadAccounts);
  console.log("Rocket accounts:", rocketAccounts);
  console.log("iKash accounts:", ikashAccounts);

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-6">
      <SectionTitle className="text-primary">Payment Settings</SectionTitle>

      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4 sm:gap-6">
        {/* bKash Detail */}
        {data?.paymentMethods?.mfs && bkashAccounts.length > 0 && (
          <div>
            <div className="text-sm font-medium text-primary mb-3">bKash Detail</div>
            {bkashAccounts.map((mfs, index) => (
              <div key={index} className="space-y-1">
                <div className="flex items-center gap-1">
                  <span className="text-sm font-semibold text-gray-700">Name:</span>
                  <span className="text-sm font-semibold text-gray-700">{String(mfs.name || mfs.account_name || 'Md. Mahafujul Islam')}</span>
                </div>
                <div className="flex items-center gap-1">
                  <span className="text-sm font-semibold text-gray-700">Number:</span>
                  <span className="text-sm font-semibold text-gray-700">{String(mfs.number || mfs.account_number || '01780963872')}</span>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Nagad Detail */}
        {data?.paymentMethods?.mfs && nagadAccounts.length > 0 && (
          <div>
            <div className="text-sm font-medium text-primary mb-3">Nagad Detail</div>
            {nagadAccounts.map((mfs, index) => (
              <div key={index} className="space-y-1">
                <div className="flex items-center gap-1">
                  <span className="text-sm font-semibold text-gray-700">Name:</span>
                  <span className="text-sm font-semibold text-gray-700">{String(mfs.name || mfs.account_name || 'Md. Mahafujul Islam')}</span>
                </div>
                <div className="flex items-center gap-1">
                  <span className="text-sm font-semibold text-gray-700">Number:</span>
                  <span className="text-sm font-semibold text-gray-700">{String(mfs.number || mfs.account_number || '01780963872')}</span>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Rocket Detail */}
        {data?.paymentMethods?.mfs && rocketAccounts.length > 0 && (
          <div>
            <div className="text-sm font-medium text-primary mb-3">Rocket Detail</div>
            {rocketAccounts.map((mfs, index) => (
              <div key={index} className="space-y-1">
                <div className="flex items-center gap-1">
                  <span className="text-sm font-semibold text-gray-700">Name:</span>
                  <span className="text-sm font-semibold text-gray-700">{String(mfs.name || mfs.account_name || 'Md. Mahafujul Islam')}</span>
                </div>
                <div className="flex items-center gap-1">
                  <span className="text-sm font-semibold text-gray-700">Number:</span>
                  <span className="text-sm font-semibold text-gray-700">{String(mfs.number || mfs.account_number || '01780963872')}</span>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* iKash Detail */}
        {data?.paymentMethods?.mfs && ikashAccounts.length > 0 && (
          <div>
            <div className="text-sm font-medium text-primary mb-3">iKash Detail</div>
            {ikashAccounts.map((mfs, index) => (
              <div key={index} className="space-y-1">
                <div className="flex items-center gap-1">
                  <span className="text-sm font-semibold text-gray-700">Name:</span>
                  <span className="text-sm font-semibold text-gray-700">{String(mfs.name || mfs.account_name || 'Md. Mahafujul Islam')}</span>
                </div>
                <div className="flex items-center gap-1">
                  <span className="text-sm font-semibold text-gray-700">Number:</span>
                  <span className="text-sm font-semibold text-gray-700">{String(mfs.number || mfs.account_number || '01780963872')}</span>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Bank Detail */}
        {data?.paymentMethods?.bank && data?.bank && typeof data.bank === 'object' && (
            <div>
              <div className="text-sm font-medium text-primary mb-3">Bank Detail</div>
              <div className="space-y-2">
                <div className="flex items-center gap-1">
                  <span className="text-sm font-semibold text-gray-700">Bank Name:</span>
                  <span className="text-sm font-semibold text-gray-700">{String(data.bank.bankName || 'Prime Bank')}</span>
                </div>

                <div className="flex items-center gap-1">
                  <span className="text-sm font-semibold text-gray-700">Account Name:</span>
                  <span className="text-sm font-semibold text-gray-700">{String(data.bank.accountName || 'Md. Mahafujul Islam')}</span>
                </div>

                <div className="flex items-center gap-1">
                  <span className="text-sm font-semibold text-gray-700">Account Number:</span>
                  <span className="text-sm font-semibold text-gray-700">{String(data.bank.accountNumber || '44164168454541')}</span>
                </div>

                <div className="flex items-center gap-1">
                  <span className="text-sm font-semibold text-gray-700">Branch:</span>
                  <span className="text-sm font-semibold text-gray-700">{String(data.bank.branch || 'Progoti Sarani')}</span>
                </div>

                <div className="flex items-center gap-1">
                  <span className="text-sm font-semibold text-gray-700">Routing Number:</span>
                  <span className="text-sm font-semibold text-gray-700">{String(data.bank.routing || '454165')}</span>
                </div>
              </div>
            </div>
          )}
      </div>
    </div>
  );
};

/**
 * Late Payment Penalties Section Component
 * @param {Object} props - Component props
 * @param {Object} props.data - Form data
 */
const LatePaymentPenaltiesSection = ({ data }) => {
  const isEnabled = data?.latePaymentEnabled || false;
  const penaltyTiers = data?.latePenaltyTiers || [];

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-6">
      <SectionTitle className="text-primary">Late Payment Penalties</SectionTitle>

      <div className="space-y-4">
        {/* Status */}
        <div>
          <div className="text-sm font-medium text-primary mb-2">Status</div>
          <div>
            {isEnabled ? (
              <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-green-100 text-green-800">
                Enabled
              </span>
            ) : (
              <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-gray-100 text-gray-800">
                Disabled
              </span>
            )}
          </div>
        </div>

        {/* Penalty Tiers */}
        {isEnabled && (
          <div>
            <div className="text-sm font-medium text-primary mb-3">Penalty Tiers</div>
            {penaltyTiers && Array.isArray(penaltyTiers) && penaltyTiers.length > 0 ? (
              <div className="space-y-3">
                {[...penaltyTiers]
                  .filter(tier => tier && (tier.daysOverdue || tier.penaltyPercentage))
                  .sort((a, b) => {
                    const daysA = parseInt(a.daysOverdue) || 0;
                    const daysB = parseInt(b.daysOverdue) || 0;
                    return daysA - daysB;
                  })
                  .map((tier, index) => (
                    <div
                      key={index}
                      className="p-4 border border-gray-200 rounded-lg bg-gray-50"
                    >
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <span className="text-sm font-medium text-gray-700">Days Overdue:</span>
                          <span className="text-base text-gray-900 ml-2">{tier.daysOverdue || 'N/A'}</span>
                        </div>
                        <div>
                          <span className="text-sm font-medium text-gray-700">Penalty Percentage:</span>
                          <span className="text-base text-gray-900 ml-2">{tier.penaltyPercentage || 'N/A'}%</span>
                        </div>
                      </div>
                    </div>
                  ))}
              </div>
            ) : (
              <div className="p-4 border border-gray-200 rounded-lg bg-gray-50 text-center text-sm text-gray-500">
                No penalty tiers configured
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

/**
 * Reusable Data Field Component
 * @param {Object} props - Component props
 * @param {string} props.label - Field label
 * @param {string} props.value - Field value
 */
const DataField = ({ label, value }) => (
  <div>
    <p className="text-sm text-gray-500">{label}</p>
    <p className="text-sm">{value}</p>
  </div>
);

export default ServiceConfirmationView;