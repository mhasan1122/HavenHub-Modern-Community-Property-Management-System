// src/components/VehicleManager.jsx

import React, { useEffect } from "react";
import { useDispatch, useSelector } from "react-redux";
import {
  fetchVehiclesByUnit,
  deleteVehicle,
  clearVehicleMessages
} from "../../../../redux/slices/vehicle/vehicleSlice";
import LoadingAnimation from "../../../../Components/Loaders/LoadingAnimation";
import TableSkeleton from "../../../../Components/Loaders/TableSkeleton";
import MessageBox from "../../../../Components/MessageBox/MessageBox";
import { FaPlus } from "react-icons/fa";
import { useNavigate } from "react-router-dom";
import { MdEdit } from "react-icons/md";

const VehicleManager = ({ unitId }) => {
  const dispatch = useDispatch();
  const navigate = useNavigate();

  const { unitVehicles, loading, error, successMessage } = useSelector(
    (state) => state.vehicle
  );

  useEffect(() => {
    if (unitId) {
      dispatch(fetchVehiclesByUnit(unitId));
    }
  }, [dispatch, unitId]);

  useEffect(() => {
    if (successMessage || error) {
      const timer = setTimeout(() => dispatch(clearVehicleMessages()), 2000);
      return () => clearTimeout(timer);
    }
  }, [successMessage, error, dispatch]);

  const handleDelete = (id) => {
    if (!window.confirm("Really delete this vehicle?")) return;
    dispatch(deleteVehicle(id)).then(() => {
      dispatch(fetchVehiclesByUnit(unitId));
    });
  };

  return (
    <div className="mx-auto">
      {loading && (
        <div className="flex justify-center items-center py-12">
          <TableSkeleton rows={5} columns={6} />
        </div>
      )}

      <div className="flex justify-between items-center mb-4 px-2">
        <h2 className="text-lg font-bold text-[#3C9D9B]">Vehicle List</h2>
        <button
          onClick={() => navigate(`/add-vehicle/${unitId}`)}
          className="flex items-center bg-primary text-white p-2 rounded"
        >
          <FaPlus className="mr-2" /> Add New Vehicle
        </button>
      </div>

      <div className="overflow-y-auto max-h-[300px]">
        <table className="w-full text-sm text-left">
          <thead className="bg-[#3C9D9B1A] shadow-lg py-1">
            <tr>
              {["Licence Plate", "Type", "Make", "Color", "Status", "Actions"].map((h) => (
                <th key={h} className="px-2 py-2">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {unitVehicles?.filter((v) => v.unit_id == unitId).length == 0 ? (
              <tr>
                <td colSpan="6" className="p-4 text-center text-gray-500">
                  No vehicles found.
                </td>
              </tr>
            ) : (
              unitVehicles
                ?.filter((v) => v.unit_id == unitId) // ✅ Filter by current unitId
                .map((v) => (
                  <tr key={v.id} className="bg-white border-b hover:bg-gray-50">
                    <td className="px-2 py-2">{v.license_plate}</td>
                    <td className="px-2 py-2">{v.vehicle_type}</td>
                    <td className="px-2 py-2">{v.brand}</td>
                    <td className="px-2 py-2">{v.color}</td>
                    <td className="">
                    <span
  className={`mx-2 py-1 px-3 rounded-8 text-base border ${
    v.status === "inactive"
      ? "border-error text-error"
      : "border-primary text-primary"
  }`}
>
  {v.status}
</span>

                    </td>
                    <td className="px-2 py-2">
                      <button
                        onClick={() => navigate(`/edit-vehicle/${v.id}/${unitId}`)}
                        className="text-primary"
                      >
                        <MdEdit className="inline w-[25px] h-[20px]" />
                      </button>
                    </td>
                  </tr>
                ))
            )}
          </tbody>
        </table>
      </div>

      {(successMessage || error) && (
        <MessageBox
          type={successMessage ? "success" : "error"}
          message={successMessage || error}
        />
      )}
    </div>
  );
};

export default VehicleManager;
