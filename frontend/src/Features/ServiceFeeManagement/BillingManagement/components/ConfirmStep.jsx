import { CheckCircle } from 'lucide-react';

const ConfirmStep = ({
  selectedMonth,
  towers = [],
  selectedTower,
  units = [],
  selectedUnits = [],
  selectedCategories = [],
  onViewBillsList,
  onGenerateMore
}) => {
  const selectedTowerData = (towers || []).find(t =>
    String(t.service_fee_id || t.id) === String(selectedTower)
  );

  const baseFeePerUnit = Number(selectedTowerData?.fee_amount || 0);

  // Use the same aggregation logic as ReviewStep for consistency
  const calculateGrandTotal = () => {
    let grandTotal = selectedUnits.length * baseFeePerUnit;

    selectedUnits.forEach(unitId => {
      const unit = units.find(u => u.id === unitId);
      if (unit && unit.bill_categories) {
        unit.bill_categories.forEach(cat => {
          const categoryId = cat.id || cat.category_id;
          const isCatSelected = (selectedCategories || []).some(sc => String(sc) === String(categoryId));
          if (isCatSelected) {
            console.log(`ConfirmStep: Adding category ${cat.name} amount: ৳${cat.amount}`);
            grandTotal += (cat.amount || 0);
          }
        });
      }
    });

    return grandTotal;
  };

  // Get tower name with fallback logic
  const getTowerName = () => {
 
    const invalidNames = ['Unknown Tower', 'servicefeeBillCategory', 'undefined', 'null', ''];

    // Check selectedTowerData - it might not have tower_name directly
    // Need to check the nested towers array
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

    // Fallback to first unit
    const firstUnit = units.find(u => selectedUnits.includes(u.id));
    console.log('firstUnit:', firstUnit);

    if (firstUnit) {
      const towerName = firstUnit.tower_name ||
        firstUnit.floor?.tower?.tower_name ||
        firstUnit.floor?.tower?.name ||
        firstUnit.tower?.name ||
        firstUnit.tower?.tower_name;
      console.log('Tower name from unit:', towerName);
      console.log('firstUnit.tower_name:', firstUnit.tower_name);
      console.log('firstUnit.floor:', firstUnit.floor);
      console.log('firstUnit.tower:', firstUnit.tower);

      if (towerName && !invalidNames.includes(towerName)) {
        console.log('✅ Using tower name from unit:', towerName);
        return towerName;
      } else {
        console.log('❌ Tower name from unit is invalid:', towerName);
      }
    } else {
      console.log('❌ No firstUnit found');
    }

    console.log('⚠️ Returning N/A');

    return 'N/A';
  };

  const totalAmount = calculateGrandTotal();
  console.log('ConfirmStep totalAmount:', totalAmount);

  return (
    <div className="space-y-6 py-8">
      {/* Success Icon */}
      <div className="flex justify-center">
        <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center">
          <CheckCircle className="w-12 h-12 text-green-600" />
        </div>
      </div>

      {/* Success Message */}
      <div className="text-center">
        <h2 className="text-2xl font-bold text-gray-900 mb-2">Bills Generated Successfully!</h2>
        <p className="text-gray-600">
          {selectedUnits.length} {selectedUnits.length === 1 ? 'bill has' : 'bills have'} been generated and {selectedUnits.length === 1 ? 'is' : 'are'} now available in the Bills List
        </p>
      </div>

      {/* Summary Grid */}
      <div className="grid grid-cols-2 gap-6 max-w-lg mx-auto py-4">
        <div className="text-center">
          <p className="text-sm text-gray-600 mb-2">Billing Period</p>
          <p className="text-base font-semibold text-gray-900">{selectedMonth}</p>
        </div>
        <div className="text-center">
          <p className="text-sm text-gray-600 mb-2">Tower</p>
          <p className="text-base font-semibold text-gray-900">{getTowerName()}</p>
        </div>
        <div className="text-center">
          <p className="text-sm text-gray-600 mb-2">Units</p>
          <p className="text-base font-semibold text-gray-900">{selectedUnits.length} {selectedUnits.length === 1 ? 'unit' : 'units'}</p>
        </div>
        <div className="text-center">
          <p className="text-sm text-gray-600 mb-2">Total Amount</p>
          <p className="text-base font-semibold text-gray-900">৳{totalAmount.toLocaleString()}</p>
        </div>
      </div>

      {/* What happens next */}
      <div className="border-t border-gray-200 pt-6">
        <h3 className="text-center text-base font-semibold text-gray-900 mb-4">What happens next?</h3>
        <div className="space-y-2 max-w-md mx-auto">
          <div className="flex items-start gap-3">
            <CheckCircle className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
            <p className="text-sm text-gray-700">Bills are now visible in the Bills List</p>
          </div>
          <div className="flex items-start gap-3">
            <CheckCircle className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
            <p className="text-sm text-gray-700">Residents can view and pay their bills</p>
          </div>
          <div className="flex items-start gap-3">
            <CheckCircle className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
            <p className="text-sm text-gray-700">Email notifications sent to all residents</p>
          </div>
          <div className="flex items-start gap-3">
            <CheckCircle className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
            <p className="text-sm text-gray-700">You can track payment status in real-time</p>
          </div>
        </div>
      </div>

      {/* Action Buttons */}
      <div className="flex justify-center gap-4 pt-4">
        <button
          onClick={onGenerateMore}
          className="px-6 py-2.5 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors font-medium"
        >
          Generate More Bills
        </button>
        <button
          onClick={onViewBillsList}
          className="px-6 py-2.5 bg-teal-500 text-white rounded-lg hover:bg-teal-600 transition-colors font-medium"
        >
          View Bills List
        </button>
      </div>
    </div>
  );
};

export default ConfirmStep;
