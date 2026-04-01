import { BsCalendar } from 'react-icons/bs';
import { Building2, Home, DollarSign, AlertCircle, Zap, Flame, Droplet, Wifi, Trash2 } from 'lucide-react';
import { naturalSort } from '../../../../utils/serviceFeeUtils';

const ReviewStep = ({
  selectedMonth,
  towers,
  selectedTower,
  units,
  selectedUnits,
  billCategories,
  selectedCategories,
}) => {
  // Transform towers the same way as SelectScopeStep
  const transformedTowers = (towers || []).map(tower => {
    const primaryTower = tower.towers && tower.towers.length > 0 ? tower.towers[0] : {};
    return {
      service_fee_id: tower.service_fee_id,
      id: tower.service_fee_id,
      tower_name: primaryTower.name || primaryTower.tower_name || tower.tower_name || 'Unknown Tower',
      tower_id: primaryTower.id || primaryTower.tower_id || tower.tower_id,
      unit_count: tower.total_unit_count || 0,
      fee_amount: tower.fee_amount,
      is_active: tower.is_active,
      all_towers: tower.towers || [],
      all_units: tower.units || []
    };
  });

  const selectedTowerData = transformedTowers.find(t =>
    String(t.service_fee_id || t.id) === String(selectedTower)
  );

  // Fallback: Get tower name from first selected unit if not found in tower data
  const getTowerName = () => {
    console.log('selectedTowerData:', selectedTowerData);
    console.log('selectedTower:', selectedTower);
    console.log('towers:', towers);

    // Check if tower_name exists and is valid (not a weird value)
    const invalidNames = ['Unknown Tower', 'servicefeeBillCategory', 'undefined', 'null', ''];

    // Check selectedTowerData - it might not have tower_name directly
    let towerName = selectedTowerData?.tower_name;

    // If not found, check nested towers array
    if (!towerName && selectedTowerData?.towers && selectedTowerData.towers.length > 0) {
      const primaryTower = selectedTowerData.towers[0];
      towerName = primaryTower?.name || primaryTower?.tower_name;
      console.log('Tower name from selectedTowerData.towers[0]:', towerName);
    }

    if (towerName && !invalidNames.includes(towerName)) {
      console.log('✅ Using tower name from selectedTowerData:', towerName);
      return towerName;
    } else {
      console.log('❌ selectedTowerData tower name is invalid:', towerName);
    }

    // Try to get from first selected unit
    const firstUnit = units.find(u => selectedUnits.includes(u.id));
    console.log('firstUnit:', firstUnit);

    if (firstUnit) {
      const towerName = firstUnit.tower_name ||
        firstUnit.floor?.tower?.tower_name ||
        firstUnit.floor?.tower?.name ||
        firstUnit.tower?.name ||
        firstUnit.tower?.tower_name;
      console.log('Tower name from unit:', towerName);
      if (towerName && !invalidNames.includes(towerName)) {
        return towerName;
      }
    }

    return 'N/A';
  };

  const selectedUnitsData = units.filter(u => selectedUnits.includes(u.id));
  const selectedCategoriesData = (billCategories || []).filter(c =>
    (selectedCategories || []).some(sc => String(sc) === String(c.id))
  );
  const baseFeePerUnit = Number(selectedTowerData?.fee_amount || 0);

  // Enhanced calculation logic to include selected bill category amounts from units
  const calculateTotals = () => {
    const totalUnitsCount = selectedUnits.length;
    const baseTotal = totalUnitsCount * baseFeePerUnit;

    let totalAdditionalAmount = 0;
    const categoryTotalsMap = {};

    // Get amounts from selected units' bill_categories instead of static billCategories prop
    selectedUnits.forEach(unitId => {
      const unit = (units || []).find(u => String(u.id) === String(unitId));
      if (unit && unit.bill_categories) {
        unit.bill_categories.forEach(uc => {
          const categoryId = uc.id || uc.category_id;
          // Only include if the category is selected in the wizard
          // Convert both to strings for comparison to handle type mismatches
          if (categoryId && (selectedCategories || []).some(sc => String(sc) === String(categoryId))) {
            const amount = Number(uc.amount) || 0;
            totalAdditionalAmount += amount;

            if (!categoryTotalsMap[categoryId]) {
              const categoryName = uc.name || uc.category_name || 'Additional Charge';
              categoryTotalsMap[categoryId] = {
                id: categoryId,
                name: categoryName,
                total: 0
              };
            }
            categoryTotalsMap[categoryId].total += amount;
          }
        });
      }
    });

    return {
      totalUnitsCount,
      baseTotal,
      totalAdditionalAmount,
      grandTotal: baseTotal + totalAdditionalAmount,
      categorySummaries: Object.values(categoryTotalsMap)
    };
  };

  const totals = calculateTotals();

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-semibold text-gray-900 mb-1">Review Billing Summary</h2>
        <p className="text-gray-600 text-sm">
          Confirm the details before generating bills.
        </p>
      </div>

      {/* Billing Period */}
      <div className="bg-white border border-gray-200 rounded-lg p-4">
        <div className="flex items-center gap-3">
          <BsCalendar className="w-5 h-5 text-gray-600" />
          <div className="flex-1">
            <p className="text-sm text-gray-600 mb-1">Billing Period</p>
            <div className="inline-block px-3 py-1 bg-blue-50 rounded-md">
              <span className="text-sm font-medium text-blue-900">{selectedMonth}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Selected Scope */}
      <div className="bg-white border border-gray-200 rounded-lg p-4 space-y-3">
        <p className="text-sm font-medium text-gray-700 mb-3">Selected Scope</p>

        <div className="flex items-center gap-3">
          <Building2 className="w-5 h-5 text-gray-600" />
          <div>
            <p className="text-xs text-gray-500">Tower</p>
            <p className="text-sm font-medium text-gray-900">{getTowerName()}</p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <Home className="w-5 h-5 text-gray-600" />
          <div>
            <p className="text-xs text-gray-500">Number of Units</p>
            <p className="text-sm font-medium text-gray-900">{selectedUnits.length} units</p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <DollarSign className="w-5 h-5 text-gray-600" />
          <div>
            <p className="text-xs text-gray-500">Base Fee per Unit</p>
            <p className="text-sm font-medium text-gray-900">৳{baseFeePerUnit.toLocaleString()}</p>
          </div>
        </div>
      </div>

      {/* Selected Units */}
      <div className="bg-white border border-gray-200 rounded-lg p-4">
        <p className="text-sm font-medium text-gray-700 mb-3">Selected Units</p>
        <div className="flex flex-wrap gap-2">
          {[...selectedUnitsData].sort((a, b) => naturalSort(a.unit_name || a.name, b.unit_name || b.name)).map((unit) => (
            <span
              key={unit.id}
              className="px-3 py-1.5 bg-gray-100 hover:bg-gray-200 rounded-md text-sm font-medium text-gray-700 cursor-pointer transition-colors"
            >
              {unit.unit_name || unit.name}
            </span>
          ))}
        </div>
      </div>

      {/* Additional Bill Categories with Amounts */}
      {selectedCategoriesData.length > 0 && (
        <div className="bg-white border border-gray-200 rounded-lg p-4">
          <p className="text-sm font-medium text-gray-700 mb-3">Additional Bill Categories</p>
          <div className="space-y-3">
            {selectedCategoriesData.map((category) => {
              const iconMap = {
                zap: Zap,
                flame: Flame,
                droplet: Droplet,
                wifi: Wifi,
                trash: Trash2,
              };
              const normalizedIcon = category.icon?.toString().trim().toLowerCase() || 'zap';
              const IconComponent = iconMap[normalizedIcon] || Zap;

              // Calculate total amount for this category across selected units
              const categoryTotal = totals.categorySummaries.find(c => c.id === category.id)?.total || 0;

              return (
                <div key={category.id} className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <IconComponent className="w-4 h-4 text-gray-600" />
                    <span className="text-sm text-gray-900">{category.name}</span>
                  </div>
                  {categoryTotal > 0 && (
                    <span className="text-sm font-medium text-gray-900">৳{categoryTotal.toLocaleString()}</span>
                  )}
                </div>
              );
            })}
          </div>
          {totals.totalAdditionalAmount === 0 && (
            <p className="text-xs text-gray-500 mt-3 italic">
              No additional charges for selected categories in these units
            </p>
          )}
        </div>
      )}

      {/* Total Billing Amount */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-6">
        <div className="flex justify-between items-center">
          <div>
            <p className="text-sm text-blue-800 font-medium uppercase tracking-wider mb-1">Total Billing Amount</p>
            <p className="text-xs text-blue-600">
              {selectedUnits.length} units × ৳{baseFeePerUnit.toLocaleString()}
              {totals.totalAdditionalAmount > 0 && ` + ৳${totals.totalAdditionalAmount.toLocaleString()} (Additional Bills)`}
            </p>
          </div>
          <div className="text-right">
            <p className="text-3xl font-bold text-blue-900">৳{totals.grandTotal.toLocaleString()}</p>
          </div>
        </div>
      </div>

      {/* Before you continue warning */}
      <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
        <div className="flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-yellow-600 flex-shrink-0 mt-0.5" />
          <div className="flex-1">
            <p className="text-sm font-medium text-yellow-900 mb-2">Before you continue</p>
            <ul className="space-y-1.5 text-sm text-yellow-800">
              <li className="flex items-start gap-2">
                <span className="mt-1">•</span>
                <span>Bills will be generated for all selected units</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="mt-1">•</span>
                <span>Residents will be notified via email</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="mt-1">•</span>
                <span>Bills cannot be deleted once generated</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="mt-1">•</span>
                <span>You can add late fees to bills later if needed</span>
              </li>
              <li className="flex items-start gap-2 font-semibold">
                <span className="mt-1 text-red-600">•</span>
                <span>If any units are skipped, you will stay on this page to see the reasons.</span>
              </li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ReviewStep;
