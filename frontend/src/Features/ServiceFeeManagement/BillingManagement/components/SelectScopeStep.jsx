import { useMemo } from 'react';
import { BsFileText } from 'react-icons/bs';
import { IoCheckmarkCircle } from 'react-icons/io5';
import { Zap, Flame, Droplet, Wifi, Trash2 } from 'lucide-react';
import { naturalSort } from '../../../../utils/serviceFeeUtils';

const SelectScopeStep = ({
  towers,
  selectedTower,
  onTowerSelect,
  units,
  selectedUnits,
  onUnitToggle,
  onSelectAllUnits,
  billCategories,
  selectedCategories,
  onCategoryToggle,
  loadingTowers,
  loadingUnits,
  loadingCategories,
}) => {
  // Transform aggregated API response into display format
  // API returns: { service_fee_id, fee_amount, towers: [{id, name}], units: [{id, name}] }
  const transformedTowers = (towers || []).map(tower => {
    const primaryTower = tower.towers && tower.towers.length > 0 ? tower.towers[0] : {};
    return {
      service_fee_id: tower.service_fee_id,
      id: tower.service_fee_id,
      tower_name: primaryTower.name || 'Unknown Tower',
      tower_id: primaryTower.id,
      unit_count: tower.total_unit_count || 0,
      fee_amount: tower.fee_amount,
      is_active: tower.is_active,
      // Store full tower/unit data for later use
      all_towers: tower.towers || [],
      all_units: tower.units || []
    };
  });

  // Normalize selected tower lookup
  const selectedTowerObj = transformedTowers.find(t =>
    String(t.service_fee_id || t.id) === String(selectedTower)
  );

  const baseFee = Number(selectedTowerObj?.fee_amount || 0);

  // Calculate dynamic category amounts based on selected units
  const categoryAmounts = useMemo(() => {
    const amounts = {};
    selectedUnits.forEach(unitId => {
      const unit = units.find(u => String(u.id) === String(unitId));
      if (unit && unit.bill_categories) {
        unit.bill_categories.forEach(uc => {
          const categoryId = uc.id || uc.category_id;
          if (categoryId) {
            amounts[categoryId] = (amounts[categoryId] || 0) + (Number(uc.amount) || 0);
          }
        });
      }
    });
    return amounts;
  }, [units, selectedUnits]);

  return (
    <div className="space-y-8">
      {/* Select Tower & Units Section */}
      <div className="space-y-4">
        <div>
          <div className="flex items-center gap-2 mb-2">
            <BsFileText className="w-5 h-5 text-gray-700" />
            <h2 className="text-xl font-semibold text-gray-900">Select Tower & Units</h2>
          </div>
          <p className="text-gray-600 text-sm">
            Choose the tower and specific units for billing.
          </p>
        </div>

        {/* Tower Selection */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-3">
            Select Tower
          </label>
          {loadingTowers ? (
            <div className="text-center py-8 text-gray-500">Loading towers...</div>
          ) : (
            <>
              <div className="relative">
                <button
                  type="button"
                  onClick={() => {
                    const dropdown = document.getElementById('tower-dropdown');
                    dropdown.classList.toggle('hidden');
                  }}
                  className="w-full px-4 py-3 rounded-lg border border-gray-200 bg-white hover:border-gray-300 text-left flex items-center justify-between"
                >
                  {selectedTower && selectedTowerObj ? (
                    <div className="flex items-center gap-3">
                      <span className="text-base font-semibold text-gray-900">
                        {selectedTowerObj.tower_name || 'Select a tower'}
                      </span>
                      <span className="text-sm text-gray-600">
                        {selectedTowerObj.unit_count || 0} units
                      </span>
                      <span className="text-sm text-gray-600">
                        • ৳{Number(selectedTowerObj.fee_amount || 0).toLocaleString()}/unit
                      </span>
                    </div>
                  ) : (
                    <span className="text-gray-500">Select a tower</span>
                  )}
                  <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </button>

                <div
                  id="tower-dropdown"
                  className="hidden absolute z-10 w-full mt-2 bg-white border border-gray-200 rounded-lg shadow-lg max-h-60 overflow-y-auto"
                >
                  {transformedTowers.map((tower) => {
                    // Use service_fee_id as the unique identifier if available, otherwise fallback to id
                    const uniqueId = tower.service_fee_id || tower.id;
                    const isSelected = String(selectedTower) === String(uniqueId);

                    return (
                      <button
                        key={uniqueId}
                        onClick={() => {
                          onTowerSelect(uniqueId);
                          document.getElementById('tower-dropdown').classList.add('hidden');
                        }}
                        className={`w-full px-4 py-3 text-left flex items-center justify-between hover:bg-gray-50 ${isSelected ? 'bg-teal-50' : ''
                          }`}
                      >
                        <div className="flex items-center gap-3">
                          <span className="text-base font-semibold text-gray-900">
                            {tower.tower_name}
                          </span>
                          <span className="text-sm text-gray-600">
                            {tower.unit_count || 0} units
                          </span>
                          <span className="text-sm text-gray-600">
                            • ৳{Number(tower.fee_amount || 0).toLocaleString()}/unit
                          </span>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

              {selectedTower && (
                <div className="space-y-3 mt-4">
                  <div className="flex items-center justify-between">
                    <label className="block text-sm font-medium text-gray-700">
                      Select Units
                    </label>
                    <button
                      onClick={onSelectAllUnits}
                      className="text-sm text-gray-600 hover:text-gray-900 px-3 py-1.5 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
                    >
                      Select All
                    </button>
                  </div>

                  {loadingUnits ? (
                    <div className="text-center py-8 text-gray-500">Loading units...</div>
                  ) : units.length > 0 ? (
                    <>
                      <div className="grid grid-cols-4 md:grid-cols-6 lg:grid-cols-8 gap-3">
                        {[...units].sort((a, b) => naturalSort(a.unit_name || a.name, b.unit_name || b.name)).map((unit) => {
                          const isSelected = selectedUnits.includes(unit.id);
                          return (
                            <button
                              key={unit.id}
                              onClick={() => onUnitToggle(unit.id)}
                              className={`flex flex-col items-center justify-center p-3 rounded-lg border transition-all ${isSelected
                                ? 'bg-teal-50 border-teal-200 text-teal-700 shadow-sm'
                                : 'bg-white border-gray-200 text-gray-600 hover:border-teal-200 hover:bg-gray-50'
                                }`}
                            >
                              <span className="text-sm font-medium">{unit.unit_name || unit.name}</span>
                            </button>
                          );
                        })}
                      </div>
                      <p className="text-sm text-gray-600">
                        {selectedUnits.length} of {units.length} units selected
                      </p>
                    </>
                  ) : (
                    <div className="text-center py-8 text-gray-500">No units found for this tower</div>
                  )}
                </div>
              )}
            </>
          )}
        </div>

      </div>

      {/* Additional Bill Categories Section */}
      <div className="space-y-4 pt-6 border-t border-gray-200">
        <div>
          <h2 className="text-xl font-semibold text-gray-900 mb-2">Additional Bill Categories</h2>
          <p className="text-gray-600 text-sm">
            Select categories to include with the service fee (optional)
          </p>
        </div>

        {!selectedTower ? (
          <div className="text-center py-10 bg-gray-50 rounded-xl border-2 border-dashed border-gray-100">
            <p className="text-sm text-gray-400 italic">Select a tower to view available categories</p>
          </div>
        ) : loadingCategories ? (
          <div className="text-center py-8 text-teal-600 font-medium">Loading categories...</div>
        ) : billCategories && billCategories.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {billCategories.map((category) => {
              const isSelected = selectedCategories.includes(category.id);
              const iconMap = {
                zap: Zap,
                flame: Flame,
                droplet: Droplet,
                wifi: Wifi,
                trash: Trash2,
              };
              const normalizedIcon = category.icon?.toString().trim().toLowerCase() || 'zap';
              const IconComponent = iconMap[normalizedIcon] || Zap;

              const colorMap = {
                orange: { bg: 'bg-orange-100', icon: 'text-orange-600', border: 'border-orange-200' },
                red: { bg: 'bg-red-100', icon: 'text-red-600', border: 'border-red-200' },
                blue: { bg: 'bg-blue-100', icon: 'text-blue-600', border: 'border-blue-200' },
                purple: { bg: 'bg-purple-100', icon: 'text-purple-600', border: 'border-purple-200' },
                teal: { bg: 'bg-teal-100', icon: 'text-teal-600', border: 'border-teal-200' },
                green: { bg: 'bg-green-100', icon: 'text-green-600', border: 'border-green-200' },
              };
              const normalizedColor = category.color?.toString().trim().toLowerCase() || 'teal';
              const colors = colorMap[normalizedColor] || colorMap.teal;

              return (
                <button
                  key={category.id}
                  onClick={() => onCategoryToggle(category.id)}
                  className={`p-4 rounded-lg border-2 text-left transition-all ${isSelected
                    ? `${colors.border} bg-white shadow-sm`
                    : 'border-gray-200 bg-white hover:border-gray-300'
                    }`}
                >
                  <div className="flex items-start gap-3">
                    <div className={`${colors.bg} rounded-lg p-2 flex-shrink-0`}>
                      <IconComponent className={`${colors.icon} w-5 h-5`} />
                    </div>
                    <div className="flex-1">
                      <h3 className="font-semibold text-gray-900 mb-1">{category.name}</h3>
                      <p className="text-sm text-gray-600">{category.description}</p>
                      <p className="text-sm font-medium text-gray-900 mt-2">
                        ৳{(categoryAmounts[category.id] || 0).toLocaleString()}
                      </p>
                    </div>
                    {isSelected && (
                      <IoCheckmarkCircle className="w-5 h-5 text-teal-500 flex-shrink-0" />
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        ) : (
          <div className="text-center py-8 text-gray-500 italic">No additional categories found for this selection</div>
        )}
      </div>
    </div>
  );
};

export default SelectScopeStep;
