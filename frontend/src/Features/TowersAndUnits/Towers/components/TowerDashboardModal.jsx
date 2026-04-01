import { useEffect, useState } from "react";
import PropTypes from "prop-types";
import { RxCross1 } from "react-icons/rx";
import { useDispatch, useSelector } from "react-redux";
import {
  fetchTowerById,
  clearMessages
} from "../../../../redux/slices/towers/towerSlice";
import { fetchResidents } from "../../../../redux/slices/residents/residentSlice";
import { fetchOwnerList } from "../../../../redux/slices/owner/ownerSlice";
import { fetchUnitStaff } from "../../../../redux/slices/unitStaff/unitStaffSlice";
import TableSkeleton from "../../../../Components/Loaders/TableSkeleton";
import TowerFloorTable from "./TowerFloorTable";

const TowerDashboardModal = ({ isOpen, onClose, towerId }) => {
  const dispatch = useDispatch();
  const { singleTower, loading, error } = useSelector((state) => state.tower);
  const [statistics, setStatistics] = useState({
    totalUnits: 0,
    totalOwners: 0,
    totalResidents: 0,
    totalUnitStaff: 0,
    loading: false,
    error: null
  });

  // Fetch tower details when modal opens
  useEffect(() => {
    if (isOpen && towerId) {
      dispatch(fetchTowerById(towerId));
    }
  }, [isOpen, towerId, dispatch]);

  // Fetch statistics when tower data is loaded
  useEffect(() => {
    const fetchStatistics = async () => {
      if (!singleTower || !singleTower.floors) return;

      setStatistics(prev => ({ ...prev, loading: true, error: null }));

      try {
        // Collect all unit IDs from all floors
        const unitIds = [];
        singleTower.floors.forEach(floor => {
          if (floor.units && Array.isArray(floor.units)) {
            floor.units.forEach(unit => {
              if (unit.id) {
                unitIds.push(unit.id);
              }
            });
          }
        });

        if (unitIds.length === 0) {
          setStatistics({
            totalUnits: 0,
            totalOwners: 0,
            totalResidents: 0,
            totalUnitStaff: 0,
            loading: false,
            error: null
          });
          return;
        }

        // Fetch all statistics in parallel for all units
        const promises = unitIds.map(async (unitId) => {
          try {
            const [ownersResult, residentsResult, staffResult] = await Promise.allSettled([
              dispatch(fetchOwnerList(unitId)).unwrap(),
              dispatch(fetchResidents(unitId)).unwrap(),
              dispatch(fetchUnitStaff(unitId)).unwrap()
            ]);

            return {
              unitId,
              owners: ownersResult.status === 'fulfilled' 
                ? (ownersResult.value?.owners || []).length 
                : 0,
              residents: residentsResult.status === 'fulfilled' 
                ? (Array.isArray(residentsResult.value) ? residentsResult.value : []).length 
                : 0,
              staff: staffResult.status === 'fulfilled' 
                ? (Array.isArray(staffResult.value) ? staffResult.value : []).length 
                : 0
            };
          } catch (error) {
            console.warn(`Error fetching statistics for unit ${unitId}:`, error);
            return {
              unitId,
              owners: 0,
              residents: 0,
              staff: 0
            };
          }
        });

        const results = await Promise.all(promises);

        // Aggregate statistics - use actual unit count from floors structure
        const aggregated = results.reduce(
          (acc, result) => ({
            totalOwners: acc.totalOwners + result.owners,
            totalResidents: acc.totalResidents + result.residents,
            totalUnitStaff: acc.totalUnitStaff + result.staff
          }),
          { totalOwners: 0, totalResidents: 0, totalUnitStaff: 0 }
        );

        setStatistics({
          totalUnits: unitIds.length, // Use actual count from floors structure
          ...aggregated,
          loading: false,
          error: null
        });
      } catch (error) {
        console.error("Error fetching statistics:", error);
        setStatistics(prev => ({
          ...prev,
          loading: false,
          error: "Failed to load statistics"
        }));
      }
    };

    if (singleTower && !loading) {
      fetchStatistics();
    }
  }, [singleTower, loading, dispatch]);

  // Clear messages when modal closes
  useEffect(() => {
    if (!isOpen) {
      dispatch(clearMessages());
    }
  }, [isOpen, dispatch]);

  // Handle backdrop click
  const handleBackdropClick = (e) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  // Handle escape key
  useEffect(() => {
    const handleEscape = (e) => {
      if (e.key === "Escape" && isOpen) {
        onClose();
      }
    };

    if (isOpen) {
      document.addEventListener("keydown", handleEscape);
      document.body.style.overflow = "hidden";
    }

    return () => {
      document.removeEventListener("keydown", handleEscape);
      document.body.style.overflow = "hidden";
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-black/60 backdrop-blur-sm p-4"
      onClick={handleBackdropClick}
    >
      <div className="relative z-10 w-full max-w-7xl bg-white rounded-3xl shadow-2xl mx-auto my-4 max-h-[calc(100vh-2rem)] flex flex-col overflow-hidden border border-gray-100">
        {/* Close Button */}
        <button
          className="absolute top-5 right-5 p-2 rounded-full bg-white text-gray-400 shadow-lg hover:bg-gray-50 hover:text-gray-700 transition-all z-20 border border-gray-200 hover:scale-110"
          onClick={onClose}
          aria-label="Close modal"
        >
          <RxCross1 className="w-5 h-5" />
        </button>

        {/* Modal Content */}
        <div className="p-6 md:p-8 overflow-y-auto flex-1">
          {loading ? (
            <div className="flex items-center justify-center py-16">
              <TableSkeleton />
            </div>
          ) : error ? (
            <div className="flex flex-col items-center justify-center py-16">
              <div className="w-16 h-16 rounded-full bg-red-100 flex items-center justify-center mb-4">
                <RxCross1 className="w-8 h-8 text-red-500" />
              </div>
              <p className="text-error text-lg font-semibold mb-2">
                Error Loading Tower
              </p>
              <p className="text-gray-600 text-sm">{error}</p>
            </div>
          ) : singleTower ? (
            <div className="space-y-6">
              {/* Header Section */}
              <div className="pb-4 border-b-2 border-gray-100">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-primary to-subprimary flex items-center justify-center shadow-lg">
                    <span className="text-white font-bold text-lg">
                      {singleTower.tower_name?.charAt(0)?.toUpperCase() || "T"}
                    </span>
                  </div>
                  <div>
                    <h2 className="text-2xl font-bold text-gray-900">
                      {singleTower.tower_name}
                    </h2>
                    {singleTower.tower_number && (
                      <p className="text-sm font-medium text-gray-500 mt-0.5">
                        Tower #{singleTower.tower_number}
                      </p>
                    )}
                  </div>
                </div>
              </div>

              {/* Statistics Section - Enhanced */}
              <div className="bg-gradient-to-br from-primary/5 via-subprimary/5 to-primaryLight/10 rounded-2xl p-6 border border-primaryLight/30 shadow-lg">
                <div className="flex items-center gap-2 mb-5">
                  <div className="w-1 h-6 bg-gradient-to-b from-primary to-subprimary rounded-full"></div>
                  <h3 className="text-sm font-bold text-gray-800 uppercase tracking-wider">
                    Tower Overview
                  </h3>
                </div>
                {statistics.loading ? (
                  <div className="flex items-center justify-center py-8">
                    <div className="animate-spin rounded-full h-6 w-6 border-3 border-primary border-t-transparent"></div>
                    <span className="ml-3 text-sm text-gray-600 font-medium">Loading statistics...</span>
                  </div>
                ) : statistics.error ? (
                  <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                    <p className="text-sm text-red-600 font-medium">{statistics.error}</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div className="bg-white rounded-xl p-5 shadow-md border border-gray-100 hover:shadow-xl hover:scale-105 transition-all duration-200 group">
                      <div className="flex items-center justify-between mb-2">
                        <div className="w-10 h-10 rounded-lg bg-blue-100 flex items-center justify-center group-hover:bg-blue-200 transition-colors">
                          <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
                          </svg>
                        </div>
                      </div>
                      <p className="text-xs text-gray-500 mb-1 font-semibold uppercase tracking-wide">Total Units</p>
                      <p className="text-3xl font-bold text-gray-900">
                        {statistics.totalUnits}
                      </p>
                    </div>
                    <div className="bg-white rounded-xl p-5 shadow-md border border-gray-100 hover:shadow-xl hover:scale-105 transition-all duration-200 group">
                      <div className="flex items-center justify-between mb-2">
                        <div className="w-10 h-10 rounded-lg bg-green-100 flex items-center justify-center group-hover:bg-green-200 transition-colors">
                          <svg className="w-5 h-5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                          </svg>
                        </div>
                      </div>
                      <p className="text-xs text-gray-500 mb-1 font-semibold uppercase tracking-wide">Unit Owners</p>
                      <p className="text-3xl font-bold text-primary">
                        {statistics.totalOwners}
                      </p>
                    </div>
                    <div className="bg-white rounded-xl p-5 shadow-md border border-gray-100 hover:shadow-xl hover:scale-105 transition-all duration-200 group">
                      <div className="flex items-center justify-between mb-2">
                        <div className="w-10 h-10 rounded-lg bg-purple-100 flex items-center justify-center group-hover:bg-purple-200 transition-colors">
                          <svg className="w-5 h-5 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
                          </svg>
                        </div>
                      </div>
                      <p className="text-xs text-gray-500 mb-1 font-semibold uppercase tracking-wide">Residents</p>
                      <p className="text-3xl font-bold text-primary">
                        {statistics.totalResidents}
                      </p>
                    </div>
                    <div className="bg-white rounded-xl p-5 shadow-md border border-gray-100 hover:shadow-xl hover:scale-105 transition-all duration-200 group">
                      <div className="flex items-center justify-between mb-2">
                        <div className="w-10 h-10 rounded-lg bg-orange-100 flex items-center justify-center group-hover:bg-orange-200 transition-colors">
                          <svg className="w-5 h-5 text-orange-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 13.255A23.931 23.931 0 0112 15c-3.183 0-6.22-.62-9-1.745M16 6V4a2 2 0 00-2-2h-4a2 2 0 00-2 2v2m4 6h.01M5 20h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                          </svg>
                        </div>
                      </div>
                      <p className="text-xs text-gray-500 mb-1 font-semibold uppercase tracking-wide">Unit Staff</p>
                      <p className="text-3xl font-bold text-primary">
                        {statistics.totalUnitStaff}
                      </p>
                    </div>
                  </div>
                )}
              </div>

              {/* Main Content Grid - Redesigned */}
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Left Column - Tower Information */}
                <div className="lg:col-span-1 space-y-4">
                  <div className="bg-gradient-to-br from-gray-50 to-white rounded-2xl p-5 border border-gray-200 shadow-md">
                    <div className="flex items-center gap-2 mb-4">
                      <div className="w-1 h-5 bg-gradient-to-b from-primary to-subprimary rounded-full"></div>
                      <h3 className="text-sm font-bold text-gray-800 uppercase tracking-wide">
                        Tower Details
                      </h3>
                    </div>
                    <div className="space-y-4">
                      <div className="pb-4 border-b border-gray-200 last:border-0">
                        <p className="text-xs text-gray-500 mb-2 font-semibold uppercase tracking-wide flex items-center gap-2">
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                          </svg>
                          Number of Floors
                        </p>
                        <p className="text-xl font-bold text-gray-900">
                          {singleTower.num_floors || 0}
                        </p>
                      </div>
                      
                      <div className="pb-4 border-b border-gray-200 last:border-0">
                        <p className="text-xs text-gray-500 mb-2 font-semibold uppercase tracking-wide flex items-center gap-2">
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
                          </svg>
                          Unit Naming Type
                        </p>
                        <p className="text-sm font-semibold text-gray-800 bg-primaryLight/20 px-3 py-1.5 rounded-lg inline-block">
                          {singleTower.unit_naming_type || "N/A"}
                        </p>
                      </div>
                      
                      <div className="pb-4 border-b border-gray-200 last:border-0">
                        <p className="text-xs text-gray-500 mb-2 font-semibold uppercase tracking-wide flex items-center gap-2">
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                          </svg>
                          Units Per Floor
                        </p>
                        <p className="text-sm font-semibold text-gray-800 bg-primaryLight/20 px-3 py-1.5 rounded-lg inline-block">
                          {singleTower.units_per_floor || "N/A"}
                        </p>
                      </div>
                      
                      {singleTower.add_tower_number_to_unit_name !== undefined && (
                        <div>
                          <p className="text-xs text-gray-500 mb-2 font-semibold uppercase tracking-wide flex items-center gap-2">
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                            Add Tower Number to Unit Name
                          </p>
                          <p className="text-sm font-semibold text-gray-800">
                            <span className={`px-3 py-1.5 rounded-lg inline-block ${
                              singleTower.add_tower_number_to_unit_name 
                                ? "bg-green-100 text-green-700" 
                                : "bg-gray-100 text-gray-700"
                            }`}>
                              {singleTower.add_tower_number_to_unit_name ? "Yes" : "No"}
                            </span>
                          </p>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Timestamps */}
                  {(singleTower.created_at || singleTower.updated_at) && (
                    <div className="bg-gray-50 rounded-xl p-4 border border-gray-200">
                      <h4 className="text-xs font-bold text-gray-700 mb-3 uppercase tracking-wide">Timestamps</h4>
                      <div className="space-y-3">
                        {singleTower.created_at && (
                          <div>
                            <p className="text-xs text-gray-500 mb-1 font-medium">Created At</p>
                            <p className="text-sm text-gray-700 font-semibold">
                              {new Date(singleTower.created_at).toLocaleString()}
                            </p>
                          </div>
                        )}
                        {singleTower.updated_at && (
                          <div>
                            <p className="text-xs text-gray-500 mb-1 font-medium">Last Updated</p>
                            <p className="text-sm text-gray-700 font-semibold">
                              {new Date(singleTower.updated_at).toLocaleString()}
                            </p>
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>

                {/* Right Column - Description and Floor Table */}
                <div className="lg:col-span-2 space-y-4">
                  {/* Description */}
                  {singleTower.description && (
                    <div className="bg-gradient-to-br from-gray-50 to-white rounded-2xl p-5 border border-gray-200 shadow-md">
                      <div className="flex items-center gap-2 mb-4">
                        <div className="w-1 h-5 bg-gradient-to-b from-primary to-subprimary rounded-full"></div>
                        <h3 className="text-sm font-bold text-gray-800 uppercase tracking-wide">
                          Description
                        </h3>
                      </div>
                      <p className="text-sm text-gray-700 leading-relaxed">
                        {singleTower.description}
                      </p>
                    </div>
                  )}

                  {/* Floor Table */}
                  <div className="bg-white rounded-2xl border border-gray-200 shadow-md overflow-hidden">
                    <div className="p-5 bg-gradient-to-r from-gray-50 to-white border-b border-gray-200">
                      <div className="flex items-center gap-2">
                        <div className="w-1 h-5 bg-gradient-to-b from-primary to-subprimary rounded-full"></div>
                        <h3 className="text-sm font-bold text-gray-800 uppercase tracking-wide">
                          Floors & Units
                        </h3>
                      </div>
                    </div>
                    {singleTower.floors && singleTower.floors.length > 0 ? (
                      <div className="overflow-auto">
                        <TowerFloorTable
                          floors={singleTower.floors}
                          unitNamingType={singleTower.unit_naming_type}
                          addTowerNumberToUnitName={
                            singleTower.add_tower_number_to_unit_name
                          }
                          towerNumber={singleTower.tower_number}
                        />
                      </div>
                    ) : (
                      <div className="p-8 text-center">
                        <div className="w-16 h-16 rounded-full bg-gray-100 flex items-center justify-center mx-auto mb-3">
                          <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" />
                          </svg>
                        </div>
                        <p className="text-sm text-gray-500 font-medium">
                          No floors or units available
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-16">
              <div className="w-16 h-16 rounded-full bg-gray-100 flex items-center justify-center mb-4">
                <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" />
                </svg>
              </div>
              <p className="text-sm text-gray-500 font-medium">No tower data available</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

TowerDashboardModal.propTypes = {
  isOpen: PropTypes.bool.isRequired,
  onClose: PropTypes.func.isRequired,
  towerId: PropTypes.number
};

export default TowerDashboardModal;