import React, { useState, useEffect, useRef } from "react";
import { FaPlus } from "react-icons/fa";
import { FiUpload } from "react-icons/fi";
import { FaUsersLine } from "react-icons/fa6";
import { CiEdit } from "react-icons/ci";
import Button from "../../../../Components/FormComponent/ButtonComponent/Button";
import { useNavigate, useLocation } from "react-router-dom";
import { useDispatch, useSelector } from "react-redux";
import {
  deleteResidents,
  fetchResidents
} from "../../../../redux/slices/residents/residentSlice";
import axios from "axios";
import user from "../../../../assets/user/user.png";
import MessageBox from "../../../../Components/MessageBox/MessageBox";
import ModernLoadingAnimation from "../../../../Components/Loaders/ModernLoadingAnimation";
import TableSkeleton from "../../../../Components/Loaders/TableSkeleton";
import { fetchOwnerList } from "../../../../redux/slices/owner/ownerSlice";
import { setActiveTabs } from "../../../../redux/slices/memberSlice";
import { checkPermission } from "../../../../utils/permissionUtils";
import TabTable from "../../../../Components/TabTable/TabTable";
import useSkeletonLoading from "../../../../hooks/useSkeletonLoading";
import { SKELETON_MIN_DISPLAY_TIME } from "../../../../config/skeletonLoadingConfig";
import ImportDataModal from "./ImportDataModal";
import EmptyState from "../../../../Components/Ui/EmptyState";

const api = axios.create({
  baseURL: import.meta.env.VITE_BASE_API
});

const ResidentsTab = ({ unitId, showExcelUploadModal = false }) => {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const location = useLocation();
  const highlightedRowRef = useRef(null);

  // Permission state
  const [hasPermission, setHasPermission] = useState(false);
  const [hasDeletePermission, setHasDeletePermission] = useState(false);
  const [loadingPermission, setLoadingPermission] = useState(true);

  // Local UI state
  const [selectedStatus, setSelectedStatus] = useState("Vacant");
  const [selectedResidents, setSelectedResidents] = useState([]);
  const [successMessage, setSuccessMessage] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  
  // Import modal state
  const [showImportModal, setShowImportModal] = useState(false);
  
  // Highlighting state from notification
  const [highlightResidentId, setHighlightResidentId] = useState(null);

  // Redux state
  const { residents, loadingResidentsList, errorResidentsList, loadingDelete } =
    useSelector((state) => state.resident);
  const { ownerList } = useSelector((state) => state.owner);

  const hasOwner = ownerList?.owners?.length > 0;
  const isVacant = residents.length === 0;

  useEffect(() => {
    if (unitId) {
      dispatch(fetchResidents(unitId));
      dispatch(fetchOwnerList(unitId));
    }
  }, [dispatch, unitId]);

  useEffect(() => {
    if (!loadingResidentsList) {
      setSelectedStatus(isVacant ? "Vacant" : "Occupied");
    }
  }, [isVacant, loadingResidentsList]);

  useEffect(() => {
    const fetchPermissions = async () => {
      const viewPermission = await checkPermission("org", 18); // VIEW_UNIT_RESIDENT
      const deletePermission = await checkPermission("org", 20); // EDIT_RESIDENT_INFO (covers deletion)
      setHasPermission(viewPermission);
      setHasDeletePermission(deletePermission);
      setLoadingPermission(false);
    };
    fetchPermissions();
  }, []);

  // Handle highlighting from notification click
  useEffect(() => {
    if (location.state?.highlightResidentId && residents.length > 0) {
      const residentId = location.state.highlightResidentId;
      setHighlightResidentId(residentId);
      
      // Scroll to highlighted resident after a short delay
      setTimeout(() => {
        if (highlightedRowRef.current) {
          highlightedRowRef.current.scrollIntoView({
            behavior: 'smooth',
            block: 'center'
          });
        }
      }, 300);
      
      // Clear highlight after 3 seconds
      const timer = setTimeout(() => {
        setHighlightResidentId(null);
      }, 3000);
      
      return () => clearTimeout(timer);
    }
  }, [location.state, residents]);

  const handleRemoveResidents = () => {
    if (selectedResidents.length === 0) return;

    // Clear old messages
    setSuccessMessage("");
    setErrorMessage("");

    dispatch(deleteResidents({ selectedResidents, unitId }))
      .unwrap()
      .then((response) => {
        dispatch(fetchResidents(unitId));
        setSelectedResidents([]);
        setSuccessMessage(response.message || "Residents removed successfully");
      })
      .catch((error) => {
        // Show backend error message or fallback to generic message
        setErrorMessage(error?.message || "Failed to remove residents");
      });
  };

  const clearMessage = () => {
    setSuccessMessage("");
    setErrorMessage("");
  };

  // Use skeleton loading hook for the table only - MUST be called before any conditional returns
  const showSkeleton = useSkeletonLoading(
    loadingResidentsList && !showExcelUploadModal,
    residents,
    SKELETON_MIN_DISPLAY_TIME
  );

  // Only block rendering if permission is still loading
  if (loadingPermission) {
    return null;
  }

  if (!hasPermission) {
    navigate("/not-authorized");
    return null;
  }

  return (
    <div className="relative">
      <ImportDataModal
        isOpen={showImportModal}
        onClose={() => setShowImportModal(false)}
        unitId={unitId}
        type="resident"
      />
      {/* Success/Error MessageBox */}
      {(successMessage || errorMessage) && (
        <MessageBox
          message={successMessage}
          error={errorMessage}
          clearMessage={clearMessage}
        />
      )}

      {/* Status selection section */}
      <div className="mr-[10px] mb-4">
        <div className="mb-3">
          <h2 className="text-sm font-semibold text-textDark uppercase tracking-wide">Status</h2>
        </div>
        <div className="flex items-center gap-2">
          {["Vacant", "Occupied"].map((status) => (
            <label key={status} className="flex items-center gap-2 cursor-pointer">
              <input
                type="radio"
                name="status"
                value={status}
                checked={selectedStatus === status}
                onChange={(e) => setSelectedStatus(e.target.value)}
                className="w-6 h-6 px-2 accent-primary"
                disabled={!hasOwner || (status ==='Vacant' && residents.length != 0)}
              />
              <span className={!hasOwner || (status ==='Vacant' && residents.length != 0) ? "text-gray-400 cursor-not-allowed" : ""}>{status}</span>
            </label>
          ))}
        </div>
      </div>

      {(() => {
        // Format resident type to show "Resident (Tenant)" for tenants
        const formatResidentType = (type) => {
          if (!type) return "—";
          const normalizedType = String(type).toLowerCase().trim();
          
          if (normalizedType === "tenant" || normalizedType === "resident_tenant") {
            return "Resident (Tenant)";
          }
          
          // Capitalize first letter for other types
          return type.charAt(0).toUpperCase() + type.slice(1).toLowerCase();
        };

        const columns = [
          { header: "", align: "center" },
          { header: "Name", align: "left" },
          { header: "Contact", align: "left" },
          { header: "Email", align: "left" },
          { header: "Type", align: "left" }
        ];

        const renderRow = (r) => {
          const isHighlighted = highlightResidentId === r.id;
          
          return (
            <tr 
              key={r.id}
              ref={isHighlighted ? highlightedRowRef : null}
              className={`border-b transition-all duration-300 h-11 cursor-pointer ${
                isHighlighted 
                  ? 'bg-primary/20 ring-2 ring-primary ring-inset' 
                  : 'bg-white hover:bg-gray-50'
              }`}
              onClick={() => {
                dispatch(setActiveTabs(1));
                navigate(`/member-profile/${r.member.id}`);
              }}
            >
              <td className="px-2 py-2" onClick={(e) => e.stopPropagation()}>
                <input
                  type="checkbox"
                  className="mr-3 accent-primary w-5 h-5"
                  checked={selectedResidents.includes(r.id)}
                  onChange={(e) => {
                    e.stopPropagation();
                    setSelectedResidents((prev) =>
                      e.target.checked
                        ? [...prev, r.id]
                        : prev.filter((id) => id !== r.id)
                    );
                  }}
                />
              </td>
              <td className="px-2 py-2 text-sm whitespace-nowrap">
                <div className="flex items-center">
                  <img
                    src={
                      r.member.photo
                        ? `${api.defaults.baseURL}${r.member.photo}`
                        : r.member.photo_low_quality
                        ? `${api.defaults.baseURL}${r.member.photo_low_quality}`
                        : user
                    }
                    alt=""
                    className="w-10 h-10 rounded-full mr-2 object-cover"
                  />
                  {r.member.full_name}
                </div>
              </td>
              <td className="px-2 py-2 text-sm whitespace-nowrap">{r.member.general_contact}</td>
              <td className="px-2 py-2 text-sm whitespace-nowrap">{r.member.general_email}</td>
              <td className="px-2 py-2 text-sm whitespace-nowrap">{formatResidentType(r.resident_type)}</td>
            </tr>
          );
        };

        const headerActions = (
          <div className="flex flex-wrap gap-2">
            <button
              className="flex flex-row justify-center items-center gap-1.5 w-full sm:w-auto min-w-[120px] h-12 px-4 bg-primary text-white rounded-lg text-sm sm:text-base font-medium leading-[140%]"
              style={{
                boxShadow: 'inset 0px 7px 12px rgba(255, 255, 255, 0.08), inset 0px -2px 2px rgba(48, 48, 48, 0.1)'
              }}
              onClick={() => setShowImportModal(true)}
            >
              <FiUpload className="w-4 h-4" />
              <span className="hidden sm:inline">Import Data</span>
              <span className="sm:hidden">Import</span>
            </button>
            <button
              disabled={
                !hasOwner ||
                isVacant ||
                selectedResidents.length === 0 ||
                loadingDelete ||
                !hasDeletePermission
              }
              onClick={handleRemoveResidents}
              className={`flex flex-row justify-center items-center gap-1.5 w-full sm:w-auto min-w-[120px] h-12 px-4 bg-red-600 text-white rounded-lg text-sm sm:text-base font-medium leading-[140%] ${
                !hasOwner ||
                isVacant ||
                selectedResidents.length === 0 ||
                loadingDelete ||
                !hasDeletePermission
                  ? "opacity-50 cursor-not-allowed"
                  : "hover:bg-red-700 cursor-pointer"
              }`}
              style={{
                boxShadow: 'inset 0px 7px 12px rgba(255, 255, 255, 0.08), inset 0px -2px 2px rgba(48, 48, 48, 0.1)'
              }}
            >
              Remove
            </button>
            <button
              disabled={!hasOwner || selectedStatus === "Vacant"}
              onClick={() => navigate(`/addResident/${unitId}`)}
              className={`flex flex-row justify-center items-center gap-1.5 w-full sm:w-auto min-w-[120px] h-12 px-4 bg-primary text-white rounded-lg text-sm sm:text-base font-medium leading-[140%] ${
                !hasOwner || selectedStatus === "Vacant"
                  ? "opacity-50 cursor-not-allowed"
                  : "hover:bg-primaryDark cursor-pointer"
              }`}
              style={{
                boxShadow: 'inset 0px 7px 12px rgba(255, 255, 255, 0.08), inset 0px -2px 2px rgba(48, 48, 48, 0.1)'
              }}
            >
              <FaPlus className="w-4 h-4" />
              Add Resident
            </button>
          </div>
        );

        return showSkeleton ? (
          <div className="mb-6">
            <div className="bg-white shadow-sm rounded-lg py-5 px-4 mb-4">
              <div className="flex justify-between items-center">
                <h2 className="text-lg font-bold text-black">Residents List</h2>
                {headerActions && (
                  <div className="flex items-center gap-6">{headerActions}</div>
                )}
              </div>
            </div>
            <TableSkeleton rows={5} columns={5} />
          </div>
        ) : errorResidentsList ? (
          <p className="text-red-500">{errorResidentsList}</p>
        ) : (
          <>
            <TabTable
              title="Residents List"
              columns={columns}
              data={isVacant ? [] : residents}
              renderRow={renderRow}
              emptyMessage="No Residents Found"
              headerActions={headerActions}
              maxHeight={400}
              emptyStateIcon={FaUsersLine}
            />
            
            {/* Mobile Card View */}
            <div className="lg:hidden space-y-3 mt-4">
              {(isVacant ? [] : residents).length === 0 ? (
                <div className="bg-white rounded-lg p-6">
                  <EmptyState icon={FaUsersLine} title="No Residents Found" />
                </div>
              ) : (
                residents.map((r) => {
                  const isHighlighted = highlightResidentId === r.id;
                  return (
                    <div
                      key={r.id}
                      ref={isHighlighted ? highlightedRowRef : null}
                      className={`bg-white rounded-lg border-2 p-4 cursor-pointer transition-all duration-300 ${
                        isHighlighted 
                          ? 'border-primary bg-primary/10 ring-2 ring-primary ring-inset' 
                          : 'border-gray-200 hover:border-primary/50 hover:shadow-md'
                      }`}
                      onClick={() => {
                        dispatch(setActiveTabs(1));
                        navigate(`/member-profile/${r.member.id}`);
                      }}
                    >
                      <div className="flex items-start justify-between mb-3">
                        <div className="flex items-center flex-1 min-w-0">
                          <div onClick={(e) => e.stopPropagation()}>
                            <input
                              type="checkbox"
                              className="mr-3 accent-primary w-5 h-5 flex-shrink-0"
                              checked={selectedResidents.includes(r.id)}
                              onChange={(e) => {
                                e.stopPropagation();
                                setSelectedResidents((prev) =>
                                  e.target.checked
                                    ? [...prev, r.id]
                                    : prev.filter((id) => id !== r.id)
                                );
                              }}
                              onClick={(e) => e.stopPropagation()}
                            />
                          </div>
                          <img
                            src={
                              r.member.photo
                                ? `${api.defaults.baseURL}${r.member.photo}`
                                : r.member.photo_low_quality
                                ? `${api.defaults.baseURL}${r.member.photo_low_quality}`
                                : user
                            }
                            alt=""
                            className="w-12 h-12 mr-3 rounded-full object-cover flex-shrink-0"
                          />
                          <div className="flex-1 min-w-0">
                            <h3 className={`text-base font-semibold text-gray-900 truncate ${isHighlighted ? 'font-bold' : ''}`}>
                              {r.member.full_name}
                            </h3>
                          </div>
                        </div>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            navigate(`/resident_info_edit/${unitId}/${r.id}`);
                          }}
                          className="inline-flex items-center justify-center p-2 rounded-md hover:bg-primaryLight transition-colors flex-shrink-0 ml-2"
                          title="Edit Resident"
                        >
                          <CiEdit className="w-5 h-5 text-primary" style={{ strokeWidth: 1 }} />
                        </button>
                      </div>
                      
                      <div className="space-y-2 pt-3 border-t border-gray-100">
                        {r.member.general_contact && (
                          <div className="flex items-center text-sm">
                            <span className="text-gray-500 font-medium w-20 flex-shrink-0">Contact:</span>
                            <span className="text-gray-900 truncate">{r.member.general_contact}</span>
                          </div>
                        )}
                        {r.member.general_email && (
                          <div className="flex items-center text-sm">
                            <span className="text-gray-500 font-medium w-20 flex-shrink-0">Email:</span>
                            <span className="text-gray-900 truncate">{r.member.general_email}</span>
                          </div>
                        )}
                        <div className="flex items-center text-sm">
                          <span className="text-gray-500 font-medium w-20 flex-shrink-0">Type:</span>
                          <span className="text-gray-900">{formatResidentType(r.resident_type)}</span>
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </>
        );
      })()}

      {loadingDelete && (
        <div className="absolute inset-0 flex items-center justify-center bg-white bg-opacity-50">
          <ModernLoadingAnimation />
        </div>
      )}
    </div>
  );
};

export default ResidentsTab;
