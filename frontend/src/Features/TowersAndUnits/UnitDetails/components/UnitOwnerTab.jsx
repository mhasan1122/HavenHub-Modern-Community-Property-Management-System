import React, { useEffect, useState, useRef } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { FaPlus, FaUser } from "react-icons/fa";
import { CiEdit } from "react-icons/ci";
import { FiUpload } from "react-icons/fi";
import Button from "../../../../Components/FormComponent/ButtonComponent/Button";
import { useDispatch, useSelector } from "react-redux";
import { fetchOwnerList } from "../../../../redux/slices/owner/ownerSlice";
import axios from "axios";
import userImage from "../../../../assets/user/user.png";
import { setActiveTabs } from "../../../../redux/slices/memberSlice";
import { checkPermission } from "utils/permissionUtils";
import TabTable from "../../../../Components/TabTable/TabTable";
import TableSkeleton from "../../../../Components/Loaders/TableSkeleton";
import useSkeletonLoading from "../../../../hooks/useSkeletonLoading";
import { SKELETON_MIN_DISPLAY_TIME } from "../../../../config/skeletonLoadingConfig";
import ImportDataModal from "./ImportDataModal";
import EmptyState from "../../../../Components/Ui/EmptyState";

// Create an axios instance to use the base URL for images.
const api = axios.create({
  baseURL: import.meta.env.VITE_BASE_API
});

const UnitOwnerTab = ({ unitId }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const dispatch = useDispatch();
  const highlightedRowRef = useRef(null);

  // Permission state
  const [hasPermission, setHasPermission] = useState(false);
  const [loadingPermission, setLoadingPermission] = useState(true);
  
  // Import modal state
  const [showImportModal, setShowImportModal] = useState(false);
  
  // Highlighting state from notification
  const [highlightOwnerId, setHighlightOwnerId] = useState(null);

  useEffect(() => {
    const fetchPermission = async () => {
      const permissionGranted = await checkPermission("org", 15);
      setHasPermission(permissionGranted);
      setLoadingPermission(false);
    };
    fetchPermission();
  }, []);

  const { ownerList, loading, error } = useSelector((state) => state.owner);

  useEffect(() => {
    if (unitId && hasPermission) {
      dispatch(fetchOwnerList(unitId));
    }
  }, [dispatch, unitId, hasPermission]);

  const owners = ownerList?.owners || [];
  
  // Handle highlighting from notification click
  useEffect(() => {
    const highlightOwnerIdFromState = location.state?.highlightOwnerId;
    const timestamp = location.state?.timestamp;
    
    if (highlightOwnerIdFromState && owners.length > 0) {
      console.log('[UnitOwnerTab] Highlighting owner:', {
        highlightOwnerIdFromState,
        owners: owners.map(o => ({ id: o.id, name: o.member?.full_name })),
        timestamp
      });
      
      // Convert to number for consistent comparison
      const ownerId = Number(highlightOwnerIdFromState);
      setHighlightOwnerId(ownerId);
      
      // Scroll to highlighted owner after a short delay
      setTimeout(() => {
        if (highlightedRowRef.current) {
          highlightedRowRef.current.scrollIntoView({
            behavior: 'smooth',
            block: 'center'
          });
        }
      }, 500);
      
      // Clear highlight after 3 seconds
      const timer = setTimeout(() => {
        setHighlightOwnerId(null);
      }, 3000);
      
      return () => clearTimeout(timer);
    }
  }, [location.state, owners]);
  
  // Use skeleton loading hook for the table only - MUST be called before any conditional returns
  const showSkeleton = useSkeletonLoading(
    loading,
    owners,
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

  const columns = [
    { header: "Name", align: "left" },
    { header: "Contact", align: "left" },
    { header: "Email", align: "left" },
    { header: "Ownership", align: "center" },
    { header: "Actions", align: "center" }
  ];

  const renderRow = (owner, index) => {
    const member = owner.member;
    // Convert both to numbers for consistent comparison
    const isHighlighted = highlightOwnerId !== null && Number(highlightOwnerId) === Number(owner.id);
    
    if (isHighlighted) {
      console.log('[UnitOwnerTab] Owner is highlighted:', {
        highlightOwnerId,
        ownerId: owner.id,
        ownerName: member?.full_name
      });
    }
    
    return (
      <tr 
        key={index}
        ref={isHighlighted ? highlightedRowRef : null}
        className={`transition-all duration-300 h-11 cursor-pointer ${
          isHighlighted 
            ? 'bg-primary/20 ring-2 ring-primary ring-inset' 
            : 'bg-white hover:bg-gray-50'
        }`}
        onClick={() => {
          dispatch(setActiveTabs(1));
          navigate(`/member-profile/${member.id}`, {
            state: { from: location.pathname }
          });
        }}
      >
        <td className="px-2 py-2 text-sm whitespace-nowrap">
          <div className="flex items-center">
            <img
              src={
                member.photo
                  ? member.photo.startsWith("http")
                    ? member.photo
                    : `${api.defaults.baseURL}${member.photo}`
                  : member.photo_low_quality
                  ? member.photo_low_quality.startsWith("http")
                    ? member.photo_low_quality
                    : `${api.defaults.baseURL}${member.photo_low_quality}`
                  : userImage
              }
              className="w-10 h-10 rounded-full mr-2 object-cover"
              alt="user"
            />
            {member.full_name}
          </div>
        </td>
        <td className="px-2 py-2 text-sm whitespace-nowrap">{member.general_contact}</td>
        <td className="px-2 py-2 text-sm whitespace-nowrap">{member.general_email}</td>
        <td className="px-2 py-2 text-sm whitespace-nowrap text-center">{owner.ownership_percentage} %</td>
        <td className="px-2 py-2 text-sm whitespace-nowrap text-center" onClick={(e) => e.stopPropagation()}>
          <button
            onClick={() => navigate(`/unit/${unitId}/edit-owner/${owner.id}`)}
            className="inline-flex items-center justify-center p-2 rounded-md hover:bg-primaryLight transition-colors"
            title="Edit Owner"
          >
            <CiEdit className="w-5 h-5 text-primary" style={{ strokeWidth: 1 }} />
          </button>
        </td>
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
      {owners.length > 0 ? (
        <button
          className="flex flex-row justify-center items-center gap-1.5 w-full sm:w-auto min-w-[140px] h-12 px-4 bg-primary text-white rounded-lg text-sm sm:text-base font-medium leading-[140%]"
          style={{
            boxShadow: 'inset 0px 7px 12px rgba(255, 255, 255, 0.08), inset 0px -2px 2px rgba(48, 48, 48, 0.1)'
          }}
          onClick={() => navigate(`/unit/${unitId}/change-owner`)}
        >
          <span className="hidden sm:inline">Change Ownership</span>
          <span className="sm:hidden">Change</span>
        </button>
      ) : (
        <button
          className="flex flex-row justify-center items-center gap-1.5 w-full sm:w-auto min-w-[120px] h-12 px-4 bg-primary text-white rounded-lg text-sm sm:text-base font-medium leading-[140%]"
          style={{
            boxShadow: 'inset 0px 7px 12px rgba(255, 255, 255, 0.08), inset 0px -2px 2px rgba(48, 48, 48, 0.1)'
          }}
          onClick={() => navigate(`/unit/${unitId}/add-owner`)}
        >
          <FaPlus className="w-4 h-4" />
          Add Owner
        </button>
      )}
    </div>
  );

  return (
    <div>
      <ImportDataModal
        isOpen={showImportModal}
        onClose={() => setShowImportModal(false)}
        unitId={unitId}
        type="owner"
      />
      {showSkeleton ? (
        <div className="mb-6">
          <div className="bg-white shadow-sm rounded-lg py-5 px-4 mb-4">
            <div className="flex justify-between items-center">
              <h2 className="text-lg font-bold text-black">Owners List</h2>
              {headerActions && (
                <div className="flex items-center gap-6">{headerActions}</div>
              )}
            </div>
          </div>
          <TableSkeleton rows={5} columns={5} />
        </div>
      ) : error ? (
        <div className="p-4 text-red-500">Error: {error}</div>
      ) : (
        <>
          <TabTable
            title="Owners List"
            columns={columns}
            data={owners}
            renderRow={renderRow}
            emptyMessage="No Owners Found"
            headerActions={headerActions}
            maxHeight={400}
            emptyStateIcon={FaUser}
          />
          
          {/* Mobile Card View */}
          <div className="lg:hidden space-y-3 mt-4">
            {owners.length === 0 ? (
              <div className="bg-white rounded-lg p-6">
                <EmptyState icon={FaUser} title="No Owners Found" />
              </div>
            ) : (
              owners.map((owner, index) => {
                const member = owner.member;
                const isHighlighted = highlightOwnerId === owner.id;
                return (
                  <div
                    key={index}
                    ref={isHighlighted ? highlightedRowRef : null}
                    className={`bg-white rounded-lg border-2 p-4 cursor-pointer transition-all duration-300 ${
                      isHighlighted 
                        ? 'border-primary bg-primary/10 ring-2 ring-primary ring-inset' 
                        : 'border-gray-200 hover:border-primary/50 hover:shadow-md'
                    }`}
                    onClick={() => {
                      dispatch(setActiveTabs(1));
                      navigate(`/member-profile/${member.id}`, {
                        state: { from: location.pathname }
                      });
                    }}
                  >
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex items-center flex-1 min-w-0">
                        <img
                          src={
                            member.photo
                              ? member.photo.startsWith("http")
                                ? member.photo
                                : `${api.defaults.baseURL}${member.photo}`
                              : member.photo_low_quality
                              ? member.photo_low_quality.startsWith("http")
                                ? member.photo_low_quality
                                : `${api.defaults.baseURL}${member.photo_low_quality}`
                              : userImage
                          }
                          className="w-12 h-12 mr-3 rounded-full object-cover flex-shrink-0"
                          alt="user"
                        />
                        <div className="flex-1 min-w-0">
                          <h3 className={`text-base font-semibold text-gray-900 truncate ${isHighlighted ? 'font-bold' : ''}`}>
                            {member.full_name}
                          </h3>
                        </div>
                      </div>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          navigate(`/unit/${unitId}/edit-owner/${owner.id}`);
                        }}
                        className="inline-flex items-center justify-center p-2 rounded-md hover:bg-primaryLight transition-colors flex-shrink-0"
                        title="Edit Owner"
                      >
                        <CiEdit className="w-5 h-5 text-primary" style={{ strokeWidth: 1 }} />
                      </button>
                    </div>
                    
                    <div className="space-y-2 pt-3 border-t border-gray-100">
                      {member.general_contact && (
                        <div className="flex items-center text-sm">
                          <span className="text-gray-500 font-medium w-20 flex-shrink-0">Contact:</span>
                          <span className="text-gray-900 truncate">{member.general_contact}</span>
                        </div>
                      )}
                      {member.general_email && (
                        <div className="flex items-center text-sm">
                          <span className="text-gray-500 font-medium w-20 flex-shrink-0">Email:</span>
                          <span className="text-gray-900 truncate">{member.general_email}</span>
                        </div>
                      )}
                      <div className="flex items-center text-sm">
                        <span className="text-gray-500 font-medium w-20 flex-shrink-0">Ownership:</span>
                        <span className="text-gray-900 font-semibold">{owner.ownership_percentage}%</span>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </>
      )}
    </div>
  );
};

export default UnitOwnerTab;
