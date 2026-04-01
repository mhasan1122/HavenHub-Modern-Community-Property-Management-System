import { useState, useEffect } from 'react';
import { FaBuilding, FaHome, FaChevronDown, FaChevronRight } from 'react-icons/fa';
import axiosInstance from '../../../../utils/axiosInstance';

/**
 * TowerUnitSelector Component for Notice Board
 * Handles tower and unit selection with checkboxes
 */
const TowerUnitSelector = ({ selectedTowers, selectedUnits, onChange, error }) => {
  const [towers, setTowers] = useState([]);
  const [units, setUnits] = useState({});
  const [loading, setLoading] = useState(true);
  const [expandedTowers, setExpandedTowers] = useState(new Set());
  const [loadingUnits, setLoadingUnits] = useState(new Set());

  // Load towers on mount
  useEffect(() => {
    loadTowers();
  }, []);

  // Load units when towers are selected
  useEffect(() => {
    selectedTowers.forEach(towerId => {
      if (!units[towerId] && !loadingUnits.has(towerId)) {
        loadUnitsForTower(towerId);
      }
    });
  }, [selectedTowers, units, loadingUnits]);

  const loadTowers = async () => {
    setLoading(true);
    try {
      const response = await axiosInstance.get('/api/noticeboard/towers/');
      const towersData = response.data.results || response.data;
      setTowers(Array.isArray(towersData) ? towersData : []);
    } catch (error) {
      console.error('Error loading towers:', error);
      setTowers([]);
    } finally {
      setLoading(false);
    }
  };

  const loadUnitsForTower = async (towerId) => {
    setLoadingUnits(prev => new Set([...prev, towerId]));
    try {
      const response = await axiosInstance.get(`/api/noticeboard/units/?tower_ids=${towerId}`);
      const unitsData = response.data.results || response.data;
      setUnits(prev => ({
        ...prev,
        [towerId]: Array.isArray(unitsData) ? unitsData : []
      }));
    } catch (error) {
      console.error(`Error loading units for tower ${towerId}:`, error);
      setUnits(prev => ({
        ...prev,
        [towerId]: []
      }));
    } finally {
      setLoadingUnits(prev => {
        const newSet = new Set(prev);
        newSet.delete(towerId);
        return newSet;
      });
    }
  };

  const handleTowerChange = (towerId, checked) => {
    let newSelectedTowers;
    let newSelectedUnits = [...selectedUnits];

    if (checked) {
      newSelectedTowers = [...selectedTowers, towerId];
      // Load units for this tower if not already loaded
      if (!units[towerId]) {
        loadUnitsForTower(towerId);
      }
    } else {
      newSelectedTowers = selectedTowers.filter(id => id !== towerId);
      // Remove all units from this tower
      const towerUnits = units[towerId] || [];
      newSelectedUnits = newSelectedUnits.filter(unitId => 
        !towerUnits.some(unit => unit.id === unitId)
      );
    }

    onChange(newSelectedTowers, newSelectedUnits);
  };

  const handleUnitChange = (unitId, checked) => {
    let newSelectedUnits;

    if (checked) {
      newSelectedUnits = [...selectedUnits, unitId];
    } else {
      newSelectedUnits = selectedUnits.filter(id => id !== unitId);
    }

    onChange(selectedTowers, newSelectedUnits);
  };

  const handleSelectAllUnits = (towerId) => {
    const towerUnits = units[towerId] || [];
    const towerUnitIds = towerUnits.map(unit => unit.id);
    const otherUnits = selectedUnits.filter(unitId => 
      !towerUnitIds.includes(unitId)
    );
    const newSelectedUnits = [...otherUnits, ...towerUnitIds];
    onChange(selectedTowers, newSelectedUnits);
  };

  const handleDeselectAllUnits = (towerId) => {
    const towerUnits = units[towerId] || [];
    const towerUnitIds = towerUnits.map(unit => unit.id);
    const newSelectedUnits = selectedUnits.filter(unitId => 
      !towerUnitIds.includes(unitId)
    );
    onChange(selectedTowers, newSelectedUnits);
  };

  const toggleTowerExpansion = (towerId) => {
    setExpandedTowers(prev => {
      const newSet = new Set(prev);
      if (newSet.has(towerId)) {
        newSet.delete(towerId);
      } else {
        newSet.add(towerId);
        // Load units if not already loaded
        if (!units[towerId]) {
          loadUnitsForTower(towerId);
        }
      }
      return newSet;
    });
  };

  const isTowerSelected = (towerId) => selectedTowers.includes(towerId);
  const isUnitSelected = (unitId) => selectedUnits.includes(unitId);
  const isTowerExpanded = (towerId) => expandedTowers.has(towerId);

  const getTowerUnitStats = (towerId) => {
    const towerUnits = units[towerId] || [];
    const selectedCount = towerUnits.filter(unit => isUnitSelected(unit.id)).length;
    const totalCount = towerUnits.length;
    return { selectedCount, totalCount };
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <div className="text-gray-500">Loading towers...</div>
      </div>
    );
  }

  return (
    <div className={`border rounded-lg p-4 ${error ? 'border-red-500' : 'border-gray-300'}`}>
      <div className="space-y-3">
        {towers.length === 0 ? (
          <div className="text-center py-4 text-gray-500">
            No towers available
          </div>
        ) : (
          towers.map((tower) => {
            const { selectedCount, totalCount } = getTowerUnitStats(tower.id);
            const isSelected = isTowerSelected(tower.id);
            const isExpanded = isTowerExpanded(tower.id);
            const isLoadingTowerUnits = loadingUnits.has(tower.id);

            return (
              <div key={tower.id} className="border border-gray-200 rounded-lg">
                {/* Tower Header */}
                <div className="p-3 bg-gray-50 rounded-t-lg">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-3">
                      <label className="flex items-center space-x-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={(e) => handleTowerChange(tower.id, e.target.checked)}
                          className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                        />
                        <FaBuilding className="w-4 h-4 text-blue-600" />
                        <span className="font-medium text-gray-900">
                          {tower.tower_name}
                        </span>
                      </label>
                      
                      {isSelected && totalCount > 0 && (
                        <span className="text-xs text-gray-500">
                          ({selectedCount}/{totalCount} units selected)
                        </span>
                      )}
                    </div>

                    {isSelected && (
                      <button
                        type="button"
                        onClick={() => toggleTowerExpansion(tower.id)}
                        className="p-1 hover:bg-gray-200 rounded transition-colors"
                      >
                        {isExpanded ? (
                          <FaChevronDown className="w-4 h-4 text-gray-500" />
                        ) : (
                          <FaChevronRight className="w-4 h-4 text-gray-500" />
                        )}
                      </button>
                    )}
                  </div>
                </div>

                {/* Units Section */}
                {isSelected && isExpanded && (
                  <div className="p-3 border-t border-gray-200">
                    {isLoadingTowerUnits ? (
                      <div className="text-center py-2 text-gray-500 text-sm">
                        Loading units...
                      </div>
                    ) : units[tower.id] && units[tower.id].length > 0 ? (
                      <div className="space-y-2">
                        {/* Select All/None Buttons */}
                        <div className="flex space-x-2 mb-3">
                          <button
                            type="button"
                            onClick={() => handleSelectAllUnits(tower.id)}
                            className="text-xs px-2 py-1 bg-blue-100 text-blue-700 rounded hover:bg-blue-200 transition-colors"
                          >
                            Select All
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDeselectAllUnits(tower.id)}
                            className="text-xs px-2 py-1 bg-gray-100 text-gray-700 rounded hover:bg-gray-200 transition-colors"
                          >
                            Select None
                          </button>
                        </div>

                        {/* Units Grid */}
                        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2">
                          {units[tower.id].map((unit) => (
                            <label
                              key={unit.id}
                              className="flex items-center space-x-2 p-2 hover:bg-gray-50 rounded cursor-pointer"
                            >
                              <input
                                type="checkbox"
                                checked={isUnitSelected(unit.id)}
                                onChange={(e) => handleUnitChange(unit.id, e.target.checked)}
                                className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                              />
                              <FaHome className="w-3 h-3 text-gray-500" />
                              <span className="text-sm text-gray-700">
                                {unit.unit_number}
                              </span>
                            </label>
                          ))}
                        </div>
                      </div>
                    ) : (
                      <div className="text-center py-2 text-gray-500 text-sm">
                        No units available for this tower
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>

      {/* Summary */}
      {selectedTowers.length > 0 && (
        <div className="mt-4 pt-4 border-t border-gray-200">
          <div className="text-sm text-gray-600">
            <strong>Selected:</strong> {selectedTowers.length} tower(s), {selectedUnits.length} unit(s)
          </div>
        </div>
      )}
    </div>
  );
};

export default TowerUnitSelector;
