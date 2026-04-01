// import NoData from "../../../Components/Table/NoData";
import { FaEye } from "react-icons/fa";
import { Link } from "react-router-dom";
import NoData from "../../../Components/Table/NoData";
const VehiclesTable = ({ loading, error, vehiclesList = [] }) => {
    const hasVehicles = vehiclesList.length > 0;
  
    // No created_at field, so reverse list to bring last item first
    const sortedVehicles = [...vehiclesList].slice().reverse();
  
    return (
      <div className="relative overflow-x-auto max-h-[70vh] overflow-y-auto custom-scrollbar bg-white">
        <table className="w-full text-sm text-left">
          <thead className="bg-subprimary border-b sticky top-0">
            <tr>
              {[
                "License Plate",
                "Type",
                "Brand",
                "Color",
                "Tower",
                "Unit",
                "Status",
                "Actions"
              ].map((h) => (
                <th key={h} className="px-3 py-2 font-bold text-base">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr>
                <td colSpan={8} className="text-center py-4">
                  Loading vehicles...
                </td>
              </tr>
            )}
  
            {!loading && !hasVehicles && (
              <NoData
                message={
                  error?.message === "No results found"
                    ? "No vehicles found"
                    : "No vehicles available"
                }
                colSpan={8}
              />
            )}
  
            {!loading &&
              hasVehicles &&
              sortedVehicles.map((v, i) => (
                <tr key={v.id || i} className="border-b hover:bg-gray-50">
                  <td className="px-3 py-2">{v.license_plate}</td>
                  <td className="px-3 py-2">{v.vehicle_type}</td>
                  <td className="px-3 py-2">{v.brand}</td>
                  <td className="px-3 py-2">{v.color}</td>
                  <td className="px-3 py-2">{v.tower_name}</td>
                  <td className="px-3 py-2">{v.unit_name}</td>
                  <td className="px-3 py-3 text-base border-gray-200">
                    <span
                      className={`mx-2 py-1 px-3 rounded-[8px] text-base border ${
                        v.status === "inactive"
                          ? "border-error text-error"
                          : "border-primary text-primary"
                      }`}
                    >
                      {v.status}
                    </span>
                  </td>
                  <td className="px-3 py-3 text-base text-center border-gray-200">
                    <div className="flex justify-center">
                      <Link to={`/unit-details/${v.unit_id_read}?tab=5`}>
                        <FaEye className="w-[25px] h-[20px] text-primary" />
                      </Link>
                    </div>
                  </td>
                </tr>
              ))}
          </tbody>
        </table>
      </div>
    );
  };
  

export default VehiclesTable;
