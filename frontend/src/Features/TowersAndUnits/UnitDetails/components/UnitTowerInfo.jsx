import { useEffect } from "react";
import { useDispatch, useSelector } from "react-redux";
import { fetchUnitById } from "../../../../redux/slices/units/unitSlice";
import { fetchOwnerList } from "../../../../redux/slices/owner/ownerSlice";
import { fetchResidents } from "../../../../redux/slices/residents/residentSlice";
import { fetchUnitStaff } from "../../../../redux/slices/unitStaff/unitStaffSlice";

const UnitTowerInfo = ({ id }) => {
  const dispatch = useDispatch();
  const { selectedUnit } = useSelector((state) => state.unit);
  const { ownerList } = useSelector((state) => state.owner);
  const { residents } = useSelector((state) => state.resident);
  const { residents: staffList } = useSelector((state) => state.unitStaff);

  // Fetch unit and related data when the component is mounted
  useEffect(() => {
    if (id) {
      dispatch(fetchUnitById(id));
      dispatch(fetchOwnerList(id));
      dispatch(fetchResidents(id));
      dispatch(fetchUnitStaff(id));
    }
  }, [dispatch, id]);

  const unitName = selectedUnit?.unit_name || "No unit name";
  const towerName = selectedUnit?.tower_name || "";
  const towerNumber = selectedUnit?.tower_number;

  // Calculate counts
  const ownersCount = ownerList?.owners?.length || 0;
  const residentsCount = residents?.length || 0;
  const staffCount = staffList?.length || 0;

  // Determine vacancy status
  const isVacant = residentsCount === 0;
  const vacancyStatus = isVacant ? "Vacant" : "Occupied";

  // Format tower info
  const towerInfo = towerNumber
    ? `${towerName} #${towerNumber}`
    : towerName || "";

  return (
    <div className="w-full md:w-1/4 p-4 sm:p-6">
      {/* Unit Name as Prominent Title */}
      <div className="mb-6 sm:mb-8">
        {towerInfo && (
          <p className="text-xs font-medium text-ink uppercase tracking-wide mb-2">
            {towerInfo}
          </p>
        )}
        <h2 className="text-2xl sm:text-3xl md:text-4xl font-bold text-textDark mb-2 leading-tight">{unitName}</h2>
        <div className="h-1.5 w-24 bg-primary rounded-full mt-3"></div>
      </div>

      {/* Dashboard Section */}
      <div className="space-y-3 sm:space-y-4">
        <h3 className="text-sm font-semibold text-textDark uppercase tracking-wide mb-3 sm:mb-4">
          Overview
        </h3>

        {/* Stats Cards */}
        <div className="flex flex-wrap md:flex-col gap-3">
          {/* Owners Card */}
          <div className="border border-borderLight rounded-lg p-4 bg-white shadow-sm hover:shadow-md transition-shadow">
            <p className="text-xs font-medium text-ink uppercase tracking-wide mb-2">
              Owners
            </p>
            <p className="text-lg md:text-2xl font-bold text-textDark">
              {ownersCount}
            </p>
          </div>

          {/* Residents Card */}
          <div className="border border-borderLight rounded-lg p-4 bg-white shadow-sm hover:shadow-md transition-shadow">
            <p className="text-xs font-medium text-ink uppercase tracking-wide mb-2">
              Residents
            </p>
            <p className="text-lg md:text-2xl font-bold text-textDark">
              {residentsCount}
            </p>
          </div>

          {/* Staff Card */}
          <div className="border border-borderLight rounded-lg p-4 bg-white shadow-sm hover:shadow-md transition-shadow">
            <p className="text-xs font-medium text-ink uppercase tracking-wide mb-2">
              Staff
            </p>
            <p className="text-lg md:text-2xl font-bold text-textDark">
              {staffCount}
            </p>
          </div>

          {/* Vacancy Status Card */}
          <div className={`border rounded-lg p-4 shadow-sm hover:shadow-md transition-shadow ${isVacant
              ? "border-red-200 bg-red-50"
              : "border-green-200 bg-green-50"
            }`}>
            <p className={`text-xs font-medium uppercase tracking-wide mb-2 ${isVacant ? "text-red-600" : "text-green-600"
              }`}>
              Status
            </p>
            <p className={`text-lg md:text-2xl font-semibold ${isVacant ? "text-red-600" : "text-green-600"
              }`}>
              {vacancyStatus}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default UnitTowerInfo;
