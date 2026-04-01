import React, { useState, useEffect } from 'react';
import { Controller } from 'react-hook-form';
import { Building, Home } from 'lucide-react';

/**
 * TowerUnitSelector Component
 * Handles tower and unit selection with checkboxes
 */
const TowerUnitSelector = ({ control, errors, setValue, watch }) => {
  const [towers, setTowers] = useState([]);
  const [units, setUnits] = useState({});
  const [loading, setLoading] = useState(true);

  const selectedTowers = watch('selectedTowers') || [];
  const selectedUnits = watch('selectedUnits') || [];

  // Fetch real towers and units from API
  useEffect(() => {
    const fetchTowersAndUnits = async () => {
      try {
        // Fetch towers from API
        const towersResponse = await fetch('/api/towers/');
        const towersData = await towersResponse.json();

        // Transform towers data to match expected format
        const transformedTowers = towersData.map(tower => ({
          id: tower.id,
          name: tower.tower_name || tower.name,
          description: tower.description || ''
        }));

        setTowers(transformedTowers);

        // Fetch units for each tower
        const unitsData = {};
        for (const tower of transformedTowers) {
          try {
            const unitsResponse = await fetch(`/api/units/?tower_ids=${tower.id}`);
            const towerUnits = await unitsResponse.json();

            // Transform units data to match expected format
            unitsData[tower.id] = towerUnits.map(unit => ({
              id: unit.id,
              name: unit.unit_name || unit.name,
              floor: unit.floor_number || 1,
              type: unit.unit_type || 'Residential'
            }));
          } catch (error) {
            console.error(`Error fetching units for tower ${tower.id}:`, error);
            unitsData[tower.id] = [];
          }
        }

        setUnits(unitsData);
      } catch (error) {
        console.error('Error fetching towers and units:', error);
        // Set empty data on error
        setTowers([]);
        setUnits({});
      } finally {
        setLoading(false);
      }
    };

    fetchTowersAndUnits();
  }, []);

  // Handle tower selection
  const handleTowerChange = (towerId, isChecked) => {
    let updatedTowers;

    if (towerId === 'All') {
      if (isChecked) {
        // Select all towers
        updatedTowers = ['All', ...towers.map(tower => tower.id)];
      } else {
        // Deselect all towers and units
        updatedTowers = [];
        setValue('selectedUnits', []);
      }
    } else {
      if (isChecked) {
        updatedTowers = [...selectedTowers, towerId];
        // Check if all individual towers are now selected
        const allIndividualTowersSelected = towers.every(tower =>
          [...selectedTowers, towerId].includes(tower.id)
        );
        if (allIndividualTowersSelected && !selectedTowers.includes('All')) {
          updatedTowers = ['All', ...updatedTowers];
        }
      } else {
        updatedTowers = selectedTowers.filter(id => id !== towerId);
        // Remove 'All' if it was selected
        updatedTowers = updatedTowers.filter(id => id !== 'All');
        // Also remove all units from this tower
        const towerUnits = units[towerId] || [];
        const towerUnitIds = towerUnits.map(unit => unit.id);
        const updatedUnits = selectedUnits.filter(unitId => !towerUnitIds.includes(unitId));
        setValue('selectedUnits', updatedUnits);
      }
    }
    setValue('selectedTowers', updatedTowers);
  };

  // Handle unit selection
  const handleUnitChange = (unitId, isChecked) => {
    let updatedUnits;
    if (isChecked) {
      updatedUnits = [...selectedUnits, unitId];
    } else {
      updatedUnits = selectedUnits.filter(id => id !== unitId);
    }
    setValue('selectedUnits', updatedUnits);
  };

  // Handle select all units for a tower
  const handleSelectAllUnits = (towerId, isChecked) => {
    const towerUnits = units[towerId] || [];
    const towerUnitIds = towerUnits.map(unit => unit.id);
    
    let updatedUnits;
    if (isChecked) {
      // Add all units from this tower
      updatedUnits = [...new Set([...selectedUnits, ...towerUnitIds])];
    } else {
      // Remove all units from this tower
      updatedUnits = selectedUnits.filter(unitId => !towerUnitIds.includes(unitId));
    }
    setValue('selectedUnits', updatedUnits);
  };

  // Check if all units in a tower are selected
  const areAllUnitsSelected = (towerId) => {
    const towerUnits = units[towerId] || [];
    const towerUnitIds = towerUnits.map(unit => unit.id);
    return towerUnitIds.length > 0 && towerUnitIds.every(unitId => selectedUnits.includes(unitId));
  };

  // Get available units for selected towers
  const getAvailableUnits = () => {
    const availableUnits = [];

    // If "All towers" is selected, show units from all towers
    if (selectedTowers.includes('All')) {
      towers.forEach(tower => {
        const towerUnits = units[tower.id] || [];
        availableUnits.push(...towerUnits.map(unit => ({ ...unit, towerId: tower.id })));
      });
    } else {
      // Show units only from specifically selected towers
      selectedTowers.forEach(towerId => {
        const towerUnits = units[towerId] || [];
        availableUnits.push(...towerUnits.map(unit => ({ ...unit, towerId })));
      });
    }

    return availableUnits;
  };

  // Check if all available units are selected
  const areAllAvailableUnitsSelected = () => {
    const availableUnits = getAvailableUnits();
    if (availableUnits.length === 0) return false;
    return availableUnits.every(unit => selectedUnits.includes(unit.id));
  };

  // Handle "All Unit" selection
  const handleAllUnitsToggle = (isChecked) => {
    if (isChecked) {
      // Select all available units
      const availableUnits = getAvailableUnits();
      const allUnitIds = availableUnits.map(unit => unit.id);
      setValue('selectedUnits', allUnitIds);
    } else {
      // Deselect all units
      setValue('selectedUnits', []);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <div className="text-gray-500">Loading towers and units...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Tower Selection */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-3">
          Select Towers <span className="text-primary">*</span>
        </label>
        <div className="space-y-2 max-h-48 overflow-y-auto border border-gray-200 rounded-md p-3">
          {/* All Towers Option */}
          <label className="flex items-center space-x-3 p-2 hover:bg-gray-50 rounded cursor-pointer border-b border-gray-100 mb-2">
            <input
              type="checkbox"
              checked={selectedTowers.includes('All')}
              onChange={(e) => handleTowerChange('All', e.target.checked)}
              className="w-4 h-4 text-primary border-gray-300 rounded focus:ring-primary accent-primary"
            />
            <Building className="w-4 h-4 text-primary" />
            <div className="flex-1">
              <p className="text-sm font-medium text-primary">All Towers</p>
              <p className="text-xs text-gray-500">Select all available towers</p>
            </div>
          </label>

          {/* Individual Towers */}
          {towers.map((tower) => (
            <label key={tower.id} className="flex items-center space-x-3 p-2 hover:bg-gray-50 rounded cursor-pointer">
              <input
                type="checkbox"
                checked={selectedTowers.includes(tower.id)}
                onChange={(e) => handleTowerChange(tower.id, e.target.checked)}
                className="w-4 h-4 text-primary border-gray-300 rounded focus:ring-primary accent-primary"
              />
              <Building className="w-4 h-4 text-primary" />
              <div className="flex-1">
                <p className="text-sm font-medium text-gray-700">{tower.name}</p>
                <p className="text-xs text-gray-500">{tower.description}</p>
              </div>
            </label>
          ))}
        </div>
        {errors.selectedTowers && (
          <p className="mt-1 text-sm text-red-600">{errors.selectedTowers.message}</p>
        )}
      </div>

      {/* Unit Selection */}
      {selectedTowers.length > 0 && (
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-3">
            Select Units <span className="text-primary">*</span>
          </label>

          <div className="border border-gray-200 rounded-md p-3">
            {/* All Unit Option */}
            <div className="mb-3">
              <label className="flex items-center space-x-2 text-sm text-primary cursor-pointer">
                <input
                  type="checkbox"
                  checked={areAllAvailableUnitsSelected()}
                  onChange={(e) => handleAllUnitsToggle(e.target.checked)}
                  className="w-4 h-4 text-primary border-gray-300 rounded focus:ring-primary accent-primary"
                />
                <span className="font-medium">All Unit</span>
              </label>
            </div>

            {/* Individual Units */}
            {!areAllAvailableUnitsSelected() && (
              <div className="space-y-3">
                {selectedTowers.includes('All') ? (
                  // Show all towers and their units when "All towers" is selected
                  towers.map((tower) => {
                    const towerUnits = units[tower.id] || [];

                    return (
                      <div key={tower.id}>
                        <h4 className="text-sm font-medium text-gray-700 flex items-center space-x-2 mb-2">
                          <Building className="w-4 h-4 text-primary" />
                          <span>{tower.name}</span>
                        </h4>

                        <div className="grid grid-cols-2 md:grid-cols-3 gap-2 max-h-32 overflow-y-auto ml-6">
                          {towerUnits.map((unit) => (
                            <label key={unit.id} className="flex items-center space-x-2 p-2 hover:bg-gray-50 rounded cursor-pointer">
                              <input
                                type="checkbox"
                                checked={selectedUnits.includes(unit.id)}
                                onChange={(e) => handleUnitChange(unit.id, e.target.checked)}
                                className="w-4 h-4 text-primary border-gray-300 rounded focus:ring-primary accent-primary"
                              />
                              <Home className="w-3 h-3 text-gray-400" />
                              <span className="text-sm text-gray-700">{unit.name}</span>
                            </label>
                          ))}
                        </div>
                      </div>
                    );
                  })
                ) : (
                  // Show only specifically selected towers and their units
                  selectedTowers.map((towerId) => {
                    const tower = towers.find(t => t.id === towerId);
                    const towerUnits = units[towerId] || [];

                    return (
                      <div key={towerId}>
                        <h4 className="text-sm font-medium text-gray-700 flex items-center space-x-2 mb-2">
                          <Building className="w-4 h-4 text-primary" />
                          <span>{tower?.name}</span>
                        </h4>

                        <div className="grid grid-cols-2 md:grid-cols-3 gap-2 max-h-32 overflow-y-auto ml-6">
                          {towerUnits.map((unit) => (
                            <label key={unit.id} className="flex items-center space-x-2 p-2 hover:bg-gray-50 rounded cursor-pointer">
                              <input
                                type="checkbox"
                                checked={selectedUnits.includes(unit.id)}
                                onChange={(e) => handleUnitChange(unit.id, e.target.checked)}
                                className="w-4 h-4 text-primary border-gray-300 rounded focus:ring-primary accent-primary"
                              />
                              <Home className="w-3 h-3 text-gray-400" />
                              <span className="text-sm text-gray-700">{unit.name}</span>
                            </label>
                          ))}
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            )}
          </div>

          {errors.selectedUnits && (
            <p className="mt-1 text-sm text-red-600">{errors.selectedUnits.message}</p>
          )}
        </div>
      )}


    </div>
  );
};

export default TowerUnitSelector;
