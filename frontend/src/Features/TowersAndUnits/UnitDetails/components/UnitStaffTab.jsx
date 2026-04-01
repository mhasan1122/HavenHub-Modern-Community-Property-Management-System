import React, { useState, useEffect, useRef } from "react";
import { FaPlus } from "react-icons/fa";
import { GrUserWorker } from "react-icons/gr";
import { FiUpload } from "react-icons/fi";
import { CiEdit } from "react-icons/ci";
import Button from "../../../../Components/FormComponent/ButtonComponent/Button";
import { useNavigate, useLocation } from "react-router-dom";
import { useDispatch, useSelector } from "react-redux";
import {
  fetchUnitStaff,
  resetUnitStaffState,
  bulkDeleteUnitStaff
} from "../../../../redux/slices/unitStaff/unitStaffSlice";
import user from "../../../../assets/user/user.png";
import MessageBox from "../../../../Components/MessageBox/MessageBox";
import ModernLoadingAnimation from "../../../../Components/Loaders/ModernLoadingAnimation";
import TableSkeleton from "../../../../Components/Loaders/TableSkeleton";
import { setActiveTabs } from "../../../../redux/slices/memberSlice";
import axios from "axios";
import { checkPermission } from "../../../../utils/permissionUtils";
import TabTable from "../../../../Components/TabTable/TabTable";
import useSkeletonLoading from "../../../../hooks/useSkeletonLoading";
import { SKELETON_MIN_DISPLAY_TIME } from "../../../../config/skeletonLoadingConfig";
import ImportDataModal from "./ImportDataModal";
import EmptyState from "../../../../Components/Ui/EmptyState";

const api = axios.create({
  baseURL: import.meta.env.VITE_BASE_API
});
const UnitStaffTab = ({ unitId }) => {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const location = useLocation();
  const highlightRef = useRef(null);

  const [selectedStaff, setSelectedStaff] = useState([]);
  const [successMessage, setSuccessMessage] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const [highlightedStaffId, setHighlightedStaffId] = useState(null);
  
  // Import modal state
  const [showImportModal, setShowImportModal] = useState(false);

  const {
    residents: staffList,
    loadingUnitStaffList,
    errorUnitStaffsList,
    loading
  } = useSelector((state) => state.unitStaff);

  // Permission state
  const [hasPermission, setHasPermission] = useState(false);
  const [hasDeletePermission, setHasDeletePermission] = useState(false);
  const [loadingPermission, setLoadingPermission] = useState(true);

  useEffect(() => {
    const fetchPermissions = async () => {
      const viewPermission = await checkPermission("org", 21); // VIEW_UNIT_STAFF
      const deletePermission = await checkPermission("org", 23); // EDIT_UNIT_STAFF (covers deletion)
      setHasPermission(viewPermission);
      setHasDeletePermission(deletePermission);
      setLoadingPermission(false);
    };
    fetchPermissions();
  }, []);

  useEffect(() => {
    if (unitId) {
      dispatch(fetchUnitStaff(unitId));
    }
    return () => {
      dispatch(resetUnitStaffState());
    };
  }, [dispatch, unitId]);

  // Handle highlighting unit staff from notification
  useEffect(() => {
    const highlightUnitStaffId = location.state?.highlightUnitStaffId;
    const timestamp = location.state?.timestamp;

    if (highlightUnitStaffId && staffList.length > 0) {
      console.log('[UnitStaffTab] Highlighting unit staff:', highlightUnitStaffId);
      setHighlightedStaffId(highlightUnitStaffId);

      // Scroll to the highlighted row
      setTimeout(() => {
        if (highlightRef.current) {
          highlightRef.current.scrollIntoView({
            behavior: 'smooth',
            block: 'center'
          });
        }
      }, 100);

      // Clear highlight after 3 seconds
      const timer = setTimeout(() => {
        setHighlightedStaffId(null);
      }, 3000);

      return () => clearTimeout(timer);
    }
  }, [location.state, staffList]);

  const handleRemoveStaff = () => {
    if (!selectedStaff.length) return;

    setSuccessMessage("");
    setErrorMessage("");
    dispatch(bulkDeleteUnitStaff(selectedStaff))
      .unwrap()
      .then(() => {
        dispatch(fetchUnitStaff(unitId));
        setSelectedStaff([]);
        setSuccessMessage("Unit staff has been successfully Removed.");
      })
      .catch(() => {
        setErrorMessage("Failed to remove staff");
      });
  };

  const clearMessage = () => {
    setSuccessMessage("");
    setErrorMessage("");
  };

  // Use skeleton loading hook for the table only - MUST be called before any conditional returns
  const showSkeleton = useSkeletonLoading(
    loadingUnitStaffList,
    staffList,
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
        type="staff"
      />
      {(successMessage || errorMessage) && (
        <MessageBox
          message={successMessage}
          error={errorMessage}
          clearMessage={clearMessage}
          onOk={clearMessage}
        />
      )}

      {loading && (
        <div className="absolute inset-0 flex items-center justify-center bg-white bg-opacity-75 z-50">
          <ModernLoadingAnimation />
        </div>
      )}

      {(() => {
        const columns = [
          { header: "", align: "center" },
          { header: "Name", align: "left" },
          { header: "Contact", align: "left" },
          { header: "Email", align: "left" },
          { header: "Occupation", align: "left" }
        ];

        const renderRow = (s) => {
          const isHighlighted = s.id === highlightedStaffId;
          return (
          <tr 
            key={s.id}
            ref={isHighlighted ? highlightRef : null}
            className={`border-b transition-all duration-300 h-11 cursor-pointer ${
              isHighlighted 
                ? 'bg-primary/20 border-primary/40 border-2 shadow-lg' 
                : 'bg-white hover:bg-gray-50'
            }`}
            onClick={() => {
              if (s.member?.id) {
                dispatch(setActiveTabs(1));
                navigate(`/member-profile/${s.member.id}`);
              }
            }}
          >
            <td className="px-2 py-2" onClick={(e) => e.stopPropagation()}>
              <input
                type="checkbox"
                className="mr-3 accent-primary w-5 h-5"
                checked={selectedStaff.includes(s.id)}
                onChange={(e) => {
                  e.stopPropagation();
                  setSelectedStaff((prev) =>
                    e.target.checked
                      ? [...prev, s.id]
                      : prev.filter((id) => id !== s.id)
                  );
                }}
              />
            </td>
            <td className="px-2 py-2 text-sm whitespace-nowrap">
              <div className="flex items-center">
                <img
                  src={
                    s.member?.photo
                      ? `${api.defaults.baseURL}${s.member.photo}`
                      : s.member?.photo_low_quality
                      ? `${api.defaults.baseURL}${s.member.photo_low_quality}`
                      : user
                  }
                  alt=""
                  className="w-10 h-10 rounded-full mr-2 object-cover"
                />
                {s.member?.full_name || "N/A"}
              </div>
            </td>
            <td className="px-2 py-2 text-sm whitespace-nowrap">{s.member?.general_contact || "N/A"}</td>
            <td className="px-2 py-2 text-sm whitespace-nowrap">{s.member?.general_email || "N/A"}</td>
            <td className="px-2 py-2 text-sm whitespace-nowrap">{s.member?.occupation || "N/A"}</td>
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
              disabled={!selectedStaff.length || loading || !hasDeletePermission}
              onClick={handleRemoveStaff}
              className={`flex flex-row justify-center items-center gap-1.5 w-full sm:w-auto min-w-[120px] h-12 px-4 bg-red-600 text-white rounded-lg text-sm sm:text-base font-medium leading-[140%] ${
                !selectedStaff.length || loading || !hasDeletePermission
                  ? "opacity-50 cursor-not-allowed"
                  : "hover:bg-red-700 cursor-pointer"
              }`}
              style={{
                boxShadow: 'inset 0px 7px 12px rgba(255, 255, 255, 0.08), inset 0px -2px 2px rgba(48, 48, 48, 0.1)'
              }}
            >
              {loading ? "Removing…" : "Remove"}
            </button>
            <button
              onClick={() => {
                dispatch(resetUnitStaffState());
                navigate(`/addUnitStaff/${unitId}`);
              }}
              className="flex flex-row justify-center items-center gap-1.5 w-full sm:w-auto min-w-[120px] h-12 px-4 bg-primary text-white rounded-lg text-sm sm:text-base font-medium leading-[140%] hover:bg-primaryDark cursor-pointer"
              style={{
                boxShadow: 'inset 0px 7px 12px rgba(255, 255, 255, 0.08), inset 0px -2px 2px rgba(48, 48, 48, 0.1)'
              }}
            >
              <FaPlus className="w-4 h-4" />
              Add Unit Staff
            </button>
          </div>
        );

        return showSkeleton ? (
          <div className="mb-6">
            <div className="bg-white shadow-sm rounded-lg py-5 px-4 mb-4">
              <div className="flex justify-between items-center">
                <h2 className="text-lg font-bold text-black">Unit Staff List</h2>
                {headerActions && (
                  <div className="flex items-center gap-6">{headerActions}</div>
                )}
              </div>
            </div>
            <TableSkeleton rows={5} columns={5} />
          </div>
        ) : errorUnitStaffsList ? (
          <p className="text-red-500">{errorUnitStaffsList}</p>
        ) : (
          <>
            <TabTable
              title="Unit Staff List"
              columns={columns}
              data={staffList}
              renderRow={renderRow}
              emptyMessage="No Unit Staff Found"
              headerActions={headerActions}
              maxHeight={400}
              emptyStateIcon={GrUserWorker }
            />
            
            {/* Mobile Card View */}
            <div className="lg:hidden space-y-3 mt-4">
              {staffList.length === 0 ? (
                <div className="bg-white rounded-lg p-6">
                  <EmptyState icon={GrUserWorker} title="No Unit Staff Found" />
                </div>
              ) : (
                staffList.map((s) => {
                  const isHighlighted = s.id === highlightedStaffId;
                  return (
                    <div
                      key={s.id}
                      ref={isHighlighted ? highlightRef : null}
                      className={`bg-white rounded-lg border-2 p-4 cursor-pointer transition-all duration-300 ${
                        isHighlighted 
                          ? 'border-primary bg-primary/10 ring-2 ring-primary ring-inset' 
                          : 'border-gray-200 hover:border-primary/50 hover:shadow-md'
                      }`}
                      onClick={() => {
                        if (s.member?.id) {
                          dispatch(setActiveTabs(1));
                          navigate(`/member-profile/${s.member.id}`);
                        }
                      }}
                    >
                      <div className="flex items-start justify-between mb-3">
                        <div className="flex items-center flex-1 min-w-0">
                          <div onClick={(e) => e.stopPropagation()}>
                            <input
                              type="checkbox"
                              className="mr-3 accent-primary w-5 h-5 flex-shrink-0"
                              checked={selectedStaff.includes(s.id)}
                              onChange={(e) => {
                                e.stopPropagation();
                                setSelectedStaff((prev) =>
                                  e.target.checked
                                    ? [...prev, s.id]
                                    : prev.filter((id) => id !== s.id)
                                );
                              }}
                              onClick={(e) => e.stopPropagation()}
                            />
                          </div>
                          <img
                            src={
                              s.member?.photo
                                ? `${api.defaults.baseURL}${s.member.photo}`
                                : s.member?.photo_low_quality
                                ? `${api.defaults.baseURL}${s.member.photo_low_quality}`
                                : user
                            }
                            alt=""
                            className="w-12 h-12 mr-3 rounded-full object-cover flex-shrink-0"
                          />
                          <div className="flex-1 min-w-0">
                            <h3 className={`text-base font-semibold text-gray-900 truncate ${isHighlighted ? 'font-bold' : ''}`}>
                              {s.member?.full_name || "N/A"}
                            </h3>
                          </div>
                        </div>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            const staffStatus = s.unit_staff_status ? "true" : "false";
                            navigate(`/unit-staff-edit/${s.id}/${staffStatus}`);
                          }}
                          className="inline-flex items-center justify-center p-2 rounded-md hover:bg-primaryLight transition-colors flex-shrink-0 ml-2"
                          title="Edit Unit Staff"
                        >
                          <CiEdit className="w-5 h-5 text-primary" style={{ strokeWidth: 1 }} />
                        </button>
                      </div>
                      
                      <div className="space-y-2 pt-3 border-t border-gray-100">
                        {s.member?.general_contact && (
                          <div className="flex items-center text-sm">
                            <span className="text-gray-500 font-medium w-20 flex-shrink-0">Contact:</span>
                            <span className="text-gray-900 truncate">{s.member.general_contact}</span>
                          </div>
                        )}
                        {s.member?.general_email && (
                          <div className="flex items-center text-sm">
                            <span className="text-gray-500 font-medium w-20 flex-shrink-0">Email:</span>
                            <span className="text-gray-900 truncate">{s.member.general_email}</span>
                          </div>
                        )}
                        {s.member?.occupation && (
                          <div className="flex items-center text-sm">
                            <span className="text-gray-500 font-medium w-20 flex-shrink-0">Occupation:</span>
                            <span className="text-gray-900">{s.member.occupation}</span>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </>
        );
      })()}
    </div>
  );
};

export default UnitStaffTab;
