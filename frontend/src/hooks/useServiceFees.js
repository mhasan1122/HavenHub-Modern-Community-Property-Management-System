import { useSelector, useDispatch } from 'react-redux';
import { useCallback, useEffect } from 'react';
import {
  fetchServiceFees,
  fetchServiceFeeById,
  createServiceFee,
  updateServiceFee,
  deleteServiceFee,
  permanentlyDeleteServiceFee,
  validateServiceFee,
  fetchTowers,
  fetchUnitsByTower,
  fetchAllUnits,
  getTowerUnits
} from '../redux/slices/api/serviceFeeApi';
import {
  clearErrors,
  clearSuccess,
  setActiveTab,
  clearSelectedServiceFee,
  resetCreateState,
  resetUpdateState,
  clearAllStates,
  clearUnits,
} from '../redux/slices/serviceFee/serviceFeeSlice';

export const useServiceFees = () => {
  const dispatch = useDispatch();

  // Selectors
  const {
    serviceFees,
    selectedServiceFee,
    loading,
    creating,
    updating,
    deleting,
    validating,
    error,
    createError,
    updateError,
    deleteError,
    validationError,
    message,
    createSuccess,
    updateSuccess,
    deleteSuccess,
    validationSuccess,
    towers,
    units,
    allUnits,
    towersLoading,
    unitsLoading,
    activeTab,
  } = useSelector((state) => state.serviceFees);

  // Actions
  const actions = {
    // Load service fees
    loadServiceFees: useCallback(async (params = {}) => {
      return await dispatch(fetchServiceFees(params));
    }, [dispatch]),

    // Load service fee by ID
    loadServiceFee: useCallback(async (id) => {
      return await dispatch(fetchServiceFeeById(id));
    }, [dispatch]),

    // Create service fee
    createNewServiceFee: useCallback(async (serviceFeeData) => {
      return await dispatch(createServiceFee(serviceFeeData));
    }, [dispatch]),

    // Update service fee
    updateExistingServiceFee: useCallback(async (id, serviceFeeData) => {
      return await dispatch(updateServiceFee({ id, serviceFeeData }));
    }, [dispatch]),

    // Delete service fee
    removeServiceFee: useCallback(async (id) => {
      return await dispatch(deleteServiceFee(id));
    }, [dispatch]),

    // Permanently delete service fee (only for archived/cancelled service fees)
    permanentlyRemoveServiceFee: useCallback(async (id) => {
      return await dispatch(permanentlyDeleteServiceFee(id));
    }, [dispatch]),

    // Validate service fee
    validateServiceFeeData: useCallback(async (serviceFeeData) => {
      return await dispatch(validateServiceFee(serviceFeeData));
    }, [dispatch]),

    // Load towers
    loadTowers: useCallback(async () => {
      // Only load towers if not already loaded
      if (towers.length === 0 && !towersLoading) {
        return await dispatch(fetchTowers());
      }
    }, [dispatch]),

    // Load units by tower
    loadUnitsByTower: useCallback(async (towerIds) => {
      return await dispatch(fetchUnitsByTower(towerIds));
    }, [dispatch]),

    // Load all units
    loadAllUnits: useCallback(async () => {
      return await dispatch(fetchAllUnits());
    }, [dispatch]),

    // Get tower units
    getTowerUnitsData: useCallback(async (towerIds) => {
      return await dispatch(getTowerUnits(towerIds));
    }, [dispatch]),

    // Clear errors
    clearAllErrors: useCallback(() => {
      dispatch(clearErrors());
    }, [dispatch]),

    // Clear success messages
    clearSuccessMessages: useCallback(() => {
      dispatch(clearSuccess());
    }, [dispatch]),

    // Set active tab
    changeActiveTab: useCallback((tab) => {
      dispatch(setActiveTab(tab));
    }, [dispatch]),

    // Clear selected service fee
    clearSelection: useCallback(() => {
      dispatch(clearSelectedServiceFee());
    }, [dispatch]),

    // Reset create state
    resetCreate: useCallback(() => {
      dispatch(resetCreateState());
    }, [dispatch]),

    // Reset update state
    resetUpdate: useCallback(() => {
      dispatch(resetUpdateState());
    }, [dispatch]),

    // Clear units
    clearUnitsData: useCallback(() => {
      dispatch(clearUnits());
    }, [dispatch]),

    // Clear all states
    clearAll: useCallback(() => {
      dispatch(clearAllStates());
    }, [dispatch]),
  };

  // Computed values
  const computed = {
    // Filter service fees by status
    activeServiceFees: serviceFees.filter(fee => fee.is_active),
    inactiveServiceFees: serviceFees.filter(fee => !fee.is_active),

    // Get service fees by tab
    serviceFeesForActiveTab: activeTab === 1
      ? serviceFees.filter(fee => fee.is_active)
      : serviceFees.filter(fee => !fee.is_active),

    // Check if any operation is in progress
    isLoading: loading || creating || updating || deleting || validating,

    // Check if there are any errors
    hasErrors: !!(error || createError || updateError || deleteError || validationError),

    // Get current error message
    currentError: error || createError || updateError || deleteError || validationError,

    // Check if there are any success states
    hasSuccess: createSuccess || updateSuccess || deleteSuccess || validationSuccess,

    // Get current success message
    currentMessage: message,

    // Format towers for dropdown
    towerOptions: towers.map(tower => ({
      id: tower.id,
      name: tower.tower_name || tower.name,
      value: tower.id,
      label: tower.tower_name || tower.name
    })),

    // Format units for dropdown
    unitOptions: units.map(unit => ({
      id: unit.id,
      name: unit.unit_name || unit.name,
      value: unit.id,
      label: `${unit.unit_name || unit.name} (Floor ${unit.floor_no || unit.floor_number || 'N/A'})`
    })),

    // Format all units for dropdown
    allUnitOptions: allUnits.map(unit => ({
      id: unit.id,
      name: unit.unit_name || unit.name,
      value: unit.id,
      label: `${unit.unit_name || unit.name} (Floor ${unit.floor_no || unit.floor_number || 'N/A'})`
    })),
  };

  return {
    // State
    serviceFees,
    selectedServiceFee,
    loading,
    creating,
    updating,
    deleting,
    validating,
    error,
    createError,
    updateError,
    deleteError,
    validationError,
    message,
    createSuccess,
    updateSuccess,
    deleteSuccess,
    validationSuccess,
    towers,
    units,
    allUnits,
    towersLoading,
    unitsLoading,
    activeTab,

    // Actions
    ...actions,

    // Computed values
    ...computed,
  };
};

// Hook specifically for service fee creation
export const useServiceFeeCreate = () => {
  const dispatch = useDispatch();
  const { creating, createError, createSuccess, message, towers, units, towersLoading, unitsLoading } = useSelector(
    (state) => state.serviceFees
  );

  const createServiceFeeAction = useCallback(async (serviceFeeData) => {
    return await dispatch(createServiceFee(serviceFeeData));
  }, [dispatch]);

  const resetState = useCallback(() => {
    dispatch(resetCreateState());
  }, [dispatch]);

  const loadTowers = useCallback(async () => {
    // Only load towers if not already loaded
    if (towers.length === 0 && !towersLoading) {
      return await dispatch(fetchTowers());
    }
  }, [dispatch]);

  const loadUnitsByTower = useCallback(async (towerIds) => {
    return await dispatch(fetchUnitsByTower(towerIds));
  }, [dispatch]);

  const clearUnitsData = useCallback(() => {
    dispatch(clearUnits());
  }, [dispatch]);

  const validateData = useCallback(async (serviceFeeData) => {
    return await dispatch(validateServiceFee(serviceFeeData));
  }, [dispatch]);

  return {
    creating,
    createError,
    createSuccess,
    message,
    towers,
    units,
    towersLoading,
    unitsLoading,
    createServiceFee: createServiceFeeAction,
    resetState,
    loadTowers,
    loadUnitsByTower,
    clearUnitsData,
    validateData,
  };
};

// Hook specifically for service fee editing
export const useServiceFeeEdit = () => {
  const dispatch = useDispatch();
  const {
    selectedServiceFee,
    updating,
    updateError,
    updateSuccess,
    message,
    loading,
    error,
    towers,
    units,
    towersLoading,
    unitsLoading,
    unitsCache
  } = useSelector((state) => state.serviceFees);

  const loadServiceFee = useCallback(async (id) => {
    return await dispatch(fetchServiceFeeById(id));
  }, [dispatch]);

  const updateServiceFeeAction = useCallback(async (id, serviceFeeData) => {
    return await dispatch(updateServiceFee({ id, serviceFeeData }));
  }, [dispatch]);

  const resetState = useCallback(() => {
    dispatch(resetUpdateState());
  }, [dispatch]);

  const loadTowers = useCallback(async () => {
    // Only load towers if not already loaded
    if (towers.length === 0 && !towersLoading) {
      return await dispatch(fetchTowers());
    }
  }, [dispatch]);

  const loadUnitsByTower = useCallback(async (params) => {
    // Check cache first to avoid unnecessary loading
    const towerIds = params?.towerIds || params;
    const excludeId = params?.excludeServiceFeeId || null;
    const baseKey = Array.isArray(towerIds) ? towerIds.sort().join(',') : String(towerIds);
    const cacheKey = excludeId ? `${baseKey}|exclude:${excludeId}` : baseKey;
    
    // If we have cached units for this tower combination, use them immediately
    if (unitsCache[cacheKey] && unitsCache[cacheKey].length > 0) {
      console.log('Using cached units for towers:', towerIds, 'exclude:', excludeId);
      // Dispatch a fulfilled action to update the units state with cached data
      dispatch({
        type: 'serviceFees/setCachedUnits',
        payload: unitsCache[cacheKey]
      });
      return unitsCache[cacheKey];
    }
    
    // Otherwise load from API
    return await dispatch(fetchUnitsByTower(params));
  }, [dispatch, unitsCache]);

  const clearUnitsData = useCallback(() => {
    dispatch(clearUnits());
  }, [dispatch]);

  return {
    selectedServiceFee,
    updating,
    updateError,
    updateSuccess,
    message,
    loading,
    error,
    towers,
    units,
    towersLoading,
    unitsLoading,
    loadServiceFee,
    updateServiceFee: updateServiceFeeAction,
    resetState,
    loadTowers,
    loadUnitsByTower,
    clearUnitsData,
  };
};
