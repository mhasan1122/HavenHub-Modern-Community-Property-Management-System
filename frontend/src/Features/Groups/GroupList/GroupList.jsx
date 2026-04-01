import React, { useCallback, useEffect, useState } from "react";
import Heading from "../../../Components/HeadingComponent/Heading";
import Button from "../../../Components/FormComponent/ButtonComponent/Button";
import { FaPrint, FaDownload } from "react-icons/fa";
import { HiMiniUserGroup } from "react-icons/hi2";
import { FaPlus } from "react-icons/fa6";

import { useLocation, useNavigate, useNavigationType, useSearchParams } from "react-router-dom";
import FilterSelect1 from "../../../Components/FilterSelect1/FilterSelect1";
import SearchBar from "../../../Components/Search/SearchBar";
import TableSkeleton from "../../../Components/Loaders/TableSkeleton";
import useGroupList from "../useGroupList";
import { checkPermission } from "../../../utils/permissionUtils";
import useSkeletonLoading from "../../../hooks/useSkeletonLoading";
import { SKELETON_MIN_DISPLAY_TIME } from "../../../config/skeletonLoadingConfig";
import {
  exportToExcel,
  printGroupDetails
} from "../../../utils/exportPrintExcel";
import { generateFileName, withExtension } from "utils/fileNameUtils";
import logo from "./../../../assets/user/user.png";
import GroupTable from "./GroupTable";
import FilterButton from "../../../Components/FormComponent/ButtonComponent/FilterButton";
import EmptyState from "../../../Components/Ui/EmptyState";

const PAGE_NAME = "Group List";

const GroupList = () => {
  const navigate = useNavigate();
  const [hasPermission, setHasPermission] = useState(false);
  const [loadingPermission, setLoadingPermission] = useState(true);
  const [showFilters, setShowFilters] = useState(true); // Toggle filter visibility

  // Hook to get group list data
  const { groupList, loading } = useGroupList();

  const location = useLocation();
  const [searchParams, setSearchParams] = useSearchParams();
  const navType = useNavigationType();

  // Get highlightGroupId from navigation state (from notifications)
  const highlightGroupId = location.state?.highlightGroupId;
  const highlightTimestamp = location.state?.timestamp;

  useEffect(() => {
    if (navType !== 'POP') return;

    const newParams = new URLSearchParams();
    setSearchParams(newParams, { replace: true });
  }, [location.pathname, navType, setSearchParams]);

  const statusOptions = [
    { label: "Active", value: "1" },
    { label: "Inactive", value: "0" }
  ];

  useEffect(() => {
    const fetchPermission = async () => {
      const permissionGranted = await checkPermission("org", 9);
      setHasPermission(permissionGranted);
      setLoadingPermission(false);
    };
    fetchPermission();
  }, []);

  const handleExport = useCallback(() => {
    const exportData = [...groupList] // Create a copy to avoid mutation
      .reverse() // Reverse the array (newest groups first)
      .map((group) => ({
        Name: group.group_name,
        Description: group.group_description,
        Role: group.roles?.map((role) => role.role_name).join(", "),
        Status: Number(group.is_active) === 1 ? "Active" : "Inactive",
      }));

    const fileName = generateFileName(PAGE_NAME);
    exportToExcel(exportData, fileName, PAGE_NAME);
  }, [groupList]);

  const handlePrint = useCallback(() => {
    const fileName = withExtension(generateFileName(PAGE_NAME), ".pdf");
    printGroupDetails([...groupList].reverse(), logo, fileName);
  }, [groupList, logo]);

  // Toggle filter visibility
  const toggleFilters = () => {
    setShowFilters(prev => !prev);
  };

  // Use skeleton loading hook to ensure minimum display time and data validation
  const showSkeleton = useSkeletonLoading(
    loading,
    groupList,
    SKELETON_MIN_DISPLAY_TIME
  );

  // Once permission check is done, redirect unauthorized users
  if (!loadingPermission && !hasPermission) {
    navigate("/not-authorized");
    return null; // Important to return null after navigate
  }


  return (
    <div className="w-full">
      <div className="flex flex-col lg:flex-row lg:justify-between lg:items-center py-2 sm:py-3 lg:py-4 mb-2 sm:mb-3 lg:mb-4 gap-3 sm:gap-4 lg:gap-0">
        <Heading title="Group List" size="xl" color="text-black" />
        <div className="flex flex-wrap items-center gap-2 sm:gap-3 lg:gap-4 lg:space-x-0 min-w-0">
          <Button
            icon={FaDownload}
            variant="download"
            size="large"
            onClick={handleExport}
            disabled={!groupList.length}
            iconSize="medium"
            className="flex-shrink-0"
            tooltip="Excel"
            tooltipId="group-excel-tooltip"
          />
          <Button
            variant="download"
            size="large"
            icon={FaPrint}
            onClick={handlePrint}
            disabled={!groupList.length}
            iconSize="medium"
            className="flex-shrink-0"
            tooltip="Print"
            tooltipId="group-print-tooltip"
          />
          
          <Button
            icon={FaPlus}
            size="large"
            iconSize="medium"
            onClick={() => navigate(`/add-group`)}
            className="bg-primary text-center hover:bg-primary-dark text-white !text-xs sm:!text-sm lg:!text-base !px-2 sm:!px-3 lg:!px-6 whitespace-nowrap"
          >
            Add Group
          </Button>

          <FilterButton className="" active={showFilters} onClick={toggleFilters}>
            Filter
          </FilterButton>
        </div>
      </div>

      {/* Filter section - toggleable */}
      {showFilters && (
        <div className="bg-white flex flex-col lg:flex-row lg:justify-end lg:items-center gap-2 sm:gap-2 lg:gap-2 lg:space-x-4 mb-4 pb-0 lg:pb-4 lg:pt-2">
          <div className="flex gap-2 sm:gap-3 lg:gap-4 w-full lg:w-auto">
            <div className="flex-1 lg:flex-none min-w-0">
              <FilterSelect1
                placeholder="Status"
                options={statusOptions}
                paramKey="status"
                onApply={(filters) => console.log("Applied Filters:", filters)}
              />
            </div>
          </div>

          <div className="w-full lg:w-auto mt-2 lg:mt-0">
            <SearchBar
              placeholder="Search list..."
              updateUrl={true}
            />
          </div>
        </div>
      )}

      {showSkeleton ? (
        <div><TableSkeleton /></div>
      ) : groupList.length === 0 ? (
        <EmptyState
          icon={HiMiniUserGroup}
          title="No Group Found"
        />
      ) : (
        <GroupTable groupList={groupList} highlightGroupId={highlightGroupId} highlightTimestamp={highlightTimestamp} />
      )}
    </div>
  );
};

export default GroupList;
