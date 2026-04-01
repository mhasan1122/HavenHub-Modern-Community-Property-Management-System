import React, { useState, useEffect } from 'react';
import { FaBuilding, FaChevronDown, FaTimes } from 'react-icons/fa';
import ErrorMessage from '../../../../Components/MessageBox/ErrorMessage';

/**
 * TowerUnitSelector Component
 * Allows selection of towers and units for bulletin targeting
 */
const TowerUnitSelector = ({
  register,
  errors,
  watch,
  setValue,
  trigger,
  towerError,
  unitError,
  selectedTowers,
  isEditing = false,
  bulletin = null
}) => {
  const [showTowerDropdown, setShowTowerDropdown] = useState(false);
  const [showUnitDropdown, setShowUnitDropdown] = useState(false);
  const [towers, setTowers] = useState([]);
  const [units, setUnits] = useState([]);
  const [loadingTowers, setLoadingTowers] = useState(false);
  const [loadingUnits, setLoadingUnits] = useState(false);

  const selectedUnits = watch('selectedUnits') || [];

  // Load towers on component mount
  useEffect(() => {
    loadTowers();
  }, []);

  // Load units when towers are selected
  useEffect(() => {
    if (selectedTowers && selectedTowers.length > 0) {
      const towerIds = selectedTowers.map(t => t.id);
      loadUnits(towerIds);
    } else {
      setUnits([]);
      setValue('selectedUnits', []);
    }
  }, [selectedTowers, setValue]);

  // Initialize from bulletin data when editing
  useEffect(() => {
    if (isEditing && bulletin) {
      if (bulletin.target_towers_data) {
        setValue('selectedTowers', bulletin.target_towers_data);
      }
      if (bulletin.target_units_data) {
        setValue('selectedUnits', bulletin.target_units_data);
      }
    }
  }, [isEditing, bulletin, setValue]);

  // Load towers (mock data - replace with actual API call)
  const loadTowers = async () => {
    setLoadingTowers(true);
    try {
      // Replace with actual API call
      const mockTowers = [
        { id: 1, tower_name: "Tower A", tower_number: 1 },
        { id: 2, tower_name: "Tower B", tower_number: 2 },
        { id: 3, tower_name: "Tower C", tower_number: 3 }
      ];
      setTowers(mockTowers);
    } catch (error) {
      console.error('Error loading towers:', error);
    } finally {
      setLoadingTowers(false);
    }
  };

  // Load units by tower IDs (mock data - replace with actual API call)
  const loadUnits = async (towerIds) => {
    setLoadingUnits(true);
    try {
      // Replace with actual API call
      const mockUnits = [
        { id: 1, unit_name: "A101", tower_name: "Tower A" },
        { id: 2, unit_name: "A102", tower_name: "Tower A" },
        { id: 3, unit_name: "B101", tower_name: "Tower B" },
        { id: 4, unit_name: "B102", tower_name: "Tower B" },
        { id: 5, unit_name: "C101", tower_name: "Tower C" },
        { id: 6, unit_name: "C102", tower_name: "Tower C" }
      ];
      
      // Filter units based on selected towers
      const filteredUnits = mockUnits.filter(unit => 
        towerIds.some(towerId => {
          const tower = towers.find(t => t.id === towerId);
          return tower && unit.tower_name === tower.tower_name;
        })
      );
      
      setUnits(filteredUnits);
    } catch (error) {
      console.error('Error loading units:', error);
    } finally {
      setLoadingUnits(false);
    }
  };

  // Handle tower selection
  const handleTowerSelection = (tower) => {
    const currentTowers = selectedTowers || [];
    const isSelected = currentTowers.some(t => t.id === tower.id);
    
    let newTowers;
    if (isSelected) {
      newTowers = currentTowers.filter(t => t.id !== tower.id);
    } else {
      newTowers = [...currentTowers, tower];
    }
    
    setValue('selectedTowers', newTowers);
    trigger('selectedTowers');
  };

  // Handle unit selection
  const handleUnitSelection = (unit) => {
    const currentUnits = selectedUnits || [];
    const isSelected = currentUnits.some(u => u.id === unit.id);
    
    let newUnits;
    if (isSelected) {
      newUnits = currentUnits.filter(u => u.id !== unit.id);
    } else {
      newUnits = [...currentUnits, unit];
    }
    
    setValue('selectedUnits', newUnits);
    trigger('selectedUnits');
  };

  // Remove selected tower
  const removeTower = (towerId) => {
    const newTowers = selectedTowers.filter(t => t.id !== towerId);
    setValue('selectedTowers', newTowers);
    trigger('selectedTowers');
  };

  // Remove selected unit
  const removeUnit = (unitId) => {
    const newUnits = selectedUnits.filter(u => u.id !== unitId);
    setValue('selectedUnits', newUnits);
    trigger('selectedUnits');
  };

  return (
    <div className="space-y-4">
      {/* Tower Selection */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Select Towers
        </label>
        
        <div className="relative">
          <button
            type="button"
            onClick={() => {
              setShowTowerDropdown(!showTowerDropdown);
              setShowUnitDropdown(false);
            }}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-left flex items-center justify-between hover:bg-gray-50"
          >
            <span className="text-gray-700">
              {selectedTowers && selectedTowers.length > 0 
                ? `${selectedTowers.length} tower(s) selected`
                : "Choose towers..."
              }
            </span>
            <FaChevronDown className="w-4 h-4 text-gray-400" />
          </button>
          
          {showTowerDropdown && (
            <div className="absolute z-10 w-full mt-1 bg-white border border-gray-300 rounded-lg shadow-lg max-h-60 overflow-y-auto">
              {loadingTowers ? (
                <div className="p-3 text-center text-gray-500">Loading towers...</div>
              ) : towers.length === 0 ? (
                <div className="p-3 text-center text-gray-500">No towers available</div>
              ) : (
                towers.map((tower) => {
                  const isSelected = selectedTowers?.some(t => t.id === tower.id);
                  return (
                    <button
                      key={tower.id}
                      type="button"
                      onClick={() => handleTowerSelection(tower)}
                      className={`w-full px-3 py-2 text-left hover:bg-gray-50 border-b border-gray-100 last:border-b-0 flex items-center gap-2 ${
                        isSelected ? 'bg-blue-50 text-blue-700' : ''
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => {}} // Handled by button click
                        className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                      />
                      <FaBuilding className="w-4 h-4" />
                      <span>{tower.tower_name}</span>
                    </button>
                  );
                })
              )}
            </div>
          )}
        </div>

        {/* Selected towers display */}
        {selectedTowers && selectedTowers.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-2">
            {selectedTowers.map((tower) => (
              <div
                key={tower.id}
                className="flex items-center gap-1 px-2 py-1 bg-blue-100 text-blue-800 rounded-lg text-sm"
              >
                <FaBuilding className="w-3 h-3" />
                <span>{tower.tower_name}</span>
                <button
                  type="button"
                  onClick={() => removeTower(tower.id)}
                  className="text-blue-600 hover:text-blue-800"
                >
                  <FaTimes className="w-3 h-3" />
                </button>
              </div>
            ))}
          </div>
        )}

        {towerError && <ErrorMessage message={towerError} />}
      </div>

      {/* Unit Selection */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Select Units
        </label>
        
        <div className="relative">
          <button
            type="button"
            onClick={() => {
              setShowUnitDropdown(!showUnitDropdown);
              setShowTowerDropdown(false);
            }}
            disabled={!selectedTowers || selectedTowers.length === 0}
            className={`w-full px-3 py-2 border border-gray-300 rounded-lg text-left flex items-center justify-between ${
              selectedTowers && selectedTowers.length > 0 
                ? 'hover:bg-gray-50' 
                : 'bg-gray-100 cursor-not-allowed'
            }`}
          >
            <span className={selectedTowers && selectedTowers.length > 0 ? 'text-gray-700' : 'text-gray-500'}>
              {selectedUnits && selectedUnits.length > 0 
                ? `${selectedUnits.length} unit(s) selected`
                : selectedTowers && selectedTowers.length > 0 
                  ? "Choose units..."
                  : "Select towers first"
              }
            </span>
            <FaChevronDown className="w-4 h-4 text-gray-400" />
          </button>
          
          {showUnitDropdown && selectedTowers && selectedTowers.length > 0 && (
            <div className="absolute z-10 w-full mt-1 bg-white border border-gray-300 rounded-lg shadow-lg max-h-60 overflow-y-auto">
              {loadingUnits ? (
                <div className="p-3 text-center text-gray-500">Loading units...</div>
              ) : units.length === 0 ? (
                <div className="p-3 text-center text-gray-500">No units available</div>
              ) : (
                units.map((unit) => {
                  const isSelected = selectedUnits?.some(u => u.id === unit.id);
                  return (
                    <button
                      key={unit.id}
                      type="button"
                      onClick={() => handleUnitSelection(unit)}
                      className={`w-full px-3 py-2 text-left hover:bg-gray-50 border-b border-gray-100 last:border-b-0 flex items-center gap-2 ${
                        isSelected ? 'bg-blue-50 text-blue-700' : ''
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => {}} // Handled by button click
                        className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                      />
                      <span>{unit.unit_name}</span>
                      <span className="text-xs text-gray-500">({unit.tower_name})</span>
                    </button>
                  );
                })
              )}
            </div>
          )}
        </div>

        {/* Selected units display */}
        {selectedUnits && selectedUnits.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-2">
            {selectedUnits.map((unit) => (
              <div
                key={unit.id}
                className="flex items-center gap-1 px-2 py-1 bg-green-100 text-green-800 rounded-lg text-sm"
              >
                <span>{unit.unit_name}</span>
                <button
                  type="button"
                  onClick={() => removeUnit(unit.id)}
                  className="text-green-600 hover:text-green-800"
                >
                  <FaTimes className="w-3 h-3" />
                </button>
              </div>
            ))}
          </div>
        )}

        {unitError && <ErrorMessage message={unitError} />}
      </div>

      {/* Validation message */}
      {(!selectedTowers || selectedTowers.length === 0) && (!selectedUnits || selectedUnits.length === 0) && (
        <ErrorMessage message="Please select at least one tower or unit." />
      )}

      {/* Hidden inputs for form validation */}
      <input type="hidden" {...register('selectedTowers')} />
      <input type="hidden" {...register('selectedUnits')} />
    </div>
  );
};

export default TowerUnitSelector;
