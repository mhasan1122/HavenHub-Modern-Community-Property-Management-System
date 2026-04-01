import { useState, useEffect, useCallback, useRef } from "react";
import { useDispatch } from "react-redux";
import { fetchResidents } from "../../../../redux/slices/residents/residentSlice";
import { fetchOwnerList } from "../../../../redux/slices/owner/ownerSlice";

// Cache for unit statuses
const unitStatusCache = new Map();

export const useUnitStatus = (towers) => {
  const dispatch = useDispatch();
  const [unitStatusMap, setUnitStatusMap] = useState({});
  const isMounted = useRef(true);

  const getUnitStatus = useCallback((hasOwners, hasResidents) => {
    if (!hasOwners) {
      return { className: "bg-white text-black", tooltip: "No owner" };
    }
    if (hasOwners && !hasResidents) {
      return { className: "bg-[#FF8682] text-white", tooltip: "Available" };
    }
    if (hasOwners && hasResidents) {
      return { className: "bg-[#3D9D9B] text-white", tooltip: "Occupied" };
    }
    return { className: "bg-gray-200 text-black", tooltip: "Unknown" };
  }, []);

  // Clear cache when towers data changes
  useEffect(() => {
    unitStatusCache.clear();
  }, [towers]);

  useEffect(() => {
    let isSubscribed = true;

    const fetchUnitData = async () => {
      try {
        const towersData = towers || [];

        // Collect all unit IDs
        const unitIds = new Set();
        towersData.forEach((tower) =>
          tower.floors.forEach((floor) =>
            floor.units.forEach((unit) => unitIds.add(unit.id))
          )
        );

        // Batch fetch data for all units
        const [residentsData, ownersData] = await Promise.all([
          Promise.all(
            [...unitIds].map(async (unitId) => {
              const cacheKey = `residents_${unitId}`;
              if (unitStatusCache.has(cacheKey)) {
                return unitStatusCache.get(cacheKey);
              }
              const res = await dispatch(fetchResidents(unitId)).unwrap();
              const data = {
                unitId,
                hasResidents: res?.some((r) => r.unit === unitId)
              };
              unitStatusCache.set(cacheKey, data);
              return data;
            })
          ),
          Promise.all(
            [...unitIds].map(async (unitId) => {
              const cacheKey = `owners_${unitId}`;
              if (unitStatusCache.has(cacheKey)) {
                return unitStatusCache.get(cacheKey);
              }
              const res = await dispatch(fetchOwnerList(unitId)).unwrap();
              const data = { unitId, hasOwners: res?.owners?.length > 0 };
              unitStatusCache.set(cacheKey, data);
              return data;
            })
          )
        ]);

        if (!isSubscribed) return;

        // Create lookup maps
        const residentsMap = Object.fromEntries(
          residentsData.map(({ unitId, hasResidents }) => [
            unitId,
            hasResidents
          ])
        );
        const ownersMap = Object.fromEntries(
          ownersData.map(({ unitId, hasOwners }) => [unitId, hasOwners])
        );

        // Generate status map
        const newUnitStatusMap = {};
        unitIds.forEach((unitId) => {
          newUnitStatusMap[unitId] = getUnitStatus(
            ownersMap[unitId],
            residentsMap[unitId]
          );
        });

        setUnitStatusMap(newUnitStatusMap);
      } catch (error) {
        console.error("Error fetching unit data:", error);
      }
    };

    fetchUnitData();

    return () => {
      isSubscribed = false;
      isMounted.current = false;
      // Clear cache on cleanup
      unitStatusCache.clear();
    };
  }, [dispatch, getUnitStatus, towers]);

  return unitStatusMap;
};
