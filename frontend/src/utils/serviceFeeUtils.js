/**
 * Utility functions for service fee management
 */

/**
 * Check if units need to be refreshed based on tower configuration changes
 * @param {Object} currentTowerDetails - Current tower details from service fee
 * @param {Array} latestTowers - Latest tower data from API
 * @returns {boolean} - True if units need to be refreshed
 */
export const shouldRefreshUnits = (currentTowerDetails, latestTowers) => {
  if (!currentTowerDetails || !Array.isArray(currentTowerDetails) || !Array.isArray(latestTowers)) {
    return false;
  }

  // Check each tower for configuration changes that would affect unit names
  for (const currentTower of currentTowerDetails) {
    const latestTower = latestTowers.find(t => t.id === currentTower.id);

    if (!latestTower) {
      // Tower no longer exists, definitely need refresh
      return true;
    }

    // Check if unit naming configuration has changed
    if (
      currentTower.unit_naming_type !== latestTower.unit_naming_type ||
      currentTower.add_tower_number_to_unit_name !== latestTower.add_tower_number_to_unit_name ||
      currentTower.tower_number !== latestTower.tower_number ||
      currentTower.num_floors !== latestTower.num_floors ||
      currentTower.num_units !== latestTower.num_units
    ) {
      return true;
    }
  }

  return false;
};

/**
 * Generate unit names based on tower configuration (matches backend logic)
 * @param {Object} towerConfig - Tower configuration
 * @param {number} floorNumber - Floor number
 * @param {number} unitIndex - Unit index (0-based)
 * @returns {string} - Generated unit name
 */
export const generateUnitName = (towerConfig, floorNumber, unitIndex) => {
  const {
    unit_naming_type,
    add_tower_number_to_unit_name,
    tower_number
  } = towerConfig;

  // Generate unit label based on naming type
  let unitLabel;
  if (unit_naming_type === "Alphabetical") {
    unitLabel = String.fromCharCode(65 + unitIndex); // A, B, C, etc.
  } else {
    unitLabel = (unitIndex + 1).toString().padStart(2, "0"); // 01, 02, 03, etc.
  }

  // Construct full unit name
  const baseUnitName = `${floorNumber}${unitLabel}`;

  if (add_tower_number_to_unit_name && tower_number) {
    return `${tower_number}-${baseUnitName}`;
  }

  return baseUnitName;
};

/**
 * Check if a unit name matches the expected pattern for a tower configuration
 * @param {string} unitName - Unit name to check
 * @param {Object} towerConfig - Tower configuration
 * @returns {boolean} - True if unit name matches the pattern
 */
export const isUnitNameValid = (unitName, towerConfig) => {
  if (!unitName || !towerConfig) {
    return false;
  }

  const {
    unit_naming_type,
    add_tower_number_to_unit_name,
    tower_number,
    num_floors,
    num_units
  } = towerConfig;

  // Check if unit name has tower number prefix when expected
  let nameToCheck = unitName;
  if (add_tower_number_to_unit_name && tower_number) {
    const expectedPrefix = `${tower_number}-`;
    if (!unitName.startsWith(expectedPrefix)) {
      return false;
    }
    nameToCheck = unitName.substring(expectedPrefix.length);
  } else if (!add_tower_number_to_unit_name && tower_number && unitName.includes(`${tower_number}-`)) {
    // Unit name has tower number but shouldn't
    return false;
  }

  // Extract floor and unit parts
  const match = nameToCheck.match(/^(\d+)(.+)$/);
  if (!match) {
    return false;
  }

  const [, floorStr, unitPart] = match;
  const floor = parseInt(floorStr);

  // Check if floor is valid
  if (floor < 1 || floor > num_floors) {
    return false;
  }

  // Check unit part based on naming type
  if (unit_naming_type === "Alphabetical") {
    // Should be A, B, C, etc.
    if (!/^[A-Z]$/.test(unitPart)) {
      return false;
    }
    const unitIndex = unitPart.charCodeAt(0) - 65; // A=0, B=1, etc.
    return unitIndex >= 0 && unitIndex < num_units;
  } else {
    // Should be 01, 02, 03, etc.
    if (!/^\d{2}$/.test(unitPart)) {
      return false;
    }
    const unitNumber = parseInt(unitPart);
    return unitNumber >= 1 && unitNumber <= num_units;
  }
};

/**
 * Filter out invalid unit selections based on current tower configuration
 * @param {Array} selectedUnitIds - Currently selected unit IDs
 * @param {Array} availableUnits - Available units from API
 * @param {Array} towerDetails - Current tower details
 * @returns {Array} - Valid unit IDs
 */
export const filterValidUnits = (selectedUnitIds, availableUnits, towerDetails) => {
  if (!Array.isArray(selectedUnitIds) || !Array.isArray(availableUnits) || !Array.isArray(towerDetails)) {
    return [];
  }

  return selectedUnitIds.filter(unitId => {
    const unit = availableUnits.find(u => String(u.id) === String(unitId));
    if (!unit) {
      return false;
    }

    // Find the tower this unit belongs to
    const towerDetail = towerDetails.find(t => t.id === unit.tower_id ||
      (unit.tower_name && t.tower_name === unit.tower_name));

    if (!towerDetail) {
      return false;
    }

    // Check if unit name is valid for current tower configuration
    return isUnitNameValid(unit.unit_name, towerDetail);
  });
};

/**
 * Natural sort for alphanumeric strings (e.g., 101, 102, 1A, 1B, 2A)
 * @param {string} a 
 * @param {string} b 
 * @returns {number}
 */
export const naturalSort = (a, b) => {
  if (a === null || a === undefined) return 1;
  if (b === null || b === undefined) return -1;
  return String(a).localeCompare(String(b), undefined, { numeric: true, sensitivity: 'base' });
};
