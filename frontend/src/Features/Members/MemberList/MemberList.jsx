import { useCallback, useEffect, useState } from "react";
import PropTypes from "prop-types";
import {
  useLocation,
  useNavigate,
  useNavigationType,
  useSearchParams
} from "react-router-dom";
import { FaPrint, FaDownload } from "react-icons/fa";
import { IoPeople } from "react-icons/io5"
import { useDispatch, useSelector } from "react-redux";
import MemberListTable from "Components/Table/Member/MemberListTable";
import { Div } from "Components/Ui/Div";
import SearchBar from "Components/Search/SearchBar";
import Heading from "Components/HeadingComponent/Heading";
import Button from "../../../Components/FormComponent/ButtonComponent/Button";
import FilterSelect2 from "../../../Components/FilterSelect/FilterSelect2";
import TableSkeleton from "../../../Components/Loaders/TableSkeleton";
import useMemberList from "../useMemberList";
import { fetchMemberTypes } from "../../../redux/slices/api/memberApi";
import { checkPermission } from "../../../utils/permissionUtils";
import useSkeletonLoading from "../../../hooks/useSkeletonLoading";
import { SKELETON_MIN_DISPLAY_TIME } from "../../../config/skeletonLoadingConfig";
import { exportToExcel, printTable } from "utils/exportPrintExcel";
import { generateFileName, withExtension } from "utils/fileNameUtils";
import { FaPlus } from "react-icons/fa6";

import logo from "./../../../assets/user/user.png";
import { fetchRoles } from "../../../redux/slices/groups/groupSlice";
import FilterButton from "../../../Components/FormComponent/ButtonComponent/FilterButton";
import PageContainer from "../../../Components/Ui/PageContainer";
import ContentBox from "../../../Components/Ui/ContentBox";
import EmptyState from "../../../Components/Ui/EmptyState";

const PAGE_NAME = "Member List";

const MemberList = () => {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams, setSearchParams] = useSearchParams();
  const navType = useNavigationType();

  // State declarations
  const [hasPermission, setHasPermission] = useState(false);
  const [loadingPermission, setLoadingPermission] = useState(true);
  const [showFilters, setShowFilters] = useState(true); // Toggle filter visibility - open by default
  const [isDesktop, setIsDesktop] = useState(window.innerWidth >= 1024);
  const [highlightMemberId, setHighlightMemberId] = useState(null);
  const rolesFromRedux = useSelector((state) => state.group.roles);

  // Check if we need to highlight a specific member from notification
  useEffect(() => {
    if (location.state?.highlightMemberId) {
      setHighlightMemberId(location.state.highlightMemberId);
      
      // Show a toast or message if member name is provided
      if (location.state.memberName) {
        console.log(`[MemberList] Highlighting member: ${location.state.memberName} (ID: ${location.state.highlightMemberId})`);
      }
      
      // Clear the highlight after 5 seconds
      const timer = setTimeout(() => {
        setHighlightMemberId(null);
      }, 5000);
      
      return () => clearTimeout(timer);
    }
  }, [location.state]);

  useEffect(() => {
    if (navType !== "POP") return;

    const newParams = new URLSearchParams();
    setSearchParams(newParams, { replace: true });
  }, [location.pathname, navType, setSearchParams]);

  // Track window size for responsive button text
  useEffect(() => {
    const handleResize = () => {
      setIsDesktop(window.innerWidth >= 1024);
    };
    
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Custom hooks and selectors
  const {
    members,
    loading: membersLoading,
    error: membersError
  } = useMemberList();

  const { memberTypes = [], loading: memberTypeLoading } = useSelector(
    (state) => state.member
  );

  // Hooks declarations
  useEffect(() => {
    dispatch(fetchMemberTypes());
    dispatch(fetchRoles());
  }, [dispatch]);

  // Permission check
  useEffect(() => {
    const fetchPermission = async () => {
      const permissionGranted = await checkPermission("org", 3);
      setHasPermission(permissionGranted);
      setLoadingPermission(false);
    };
    fetchPermission();
  }, []);

  // Filters are always visible, no need to check URL parameters

  const handleExport = useCallback(() => {
    const membersArray = Array.isArray(members) ? members : [];
    const exportData = membersArray.map((member) => ({
      Name: member.full_name,
      Contact: member.general_contact,
      Email: member.general_email,
      Type: member.member_type_name,
      Role: member.member_roles?.map((role) => role.role_name).join(", "),
      Status: Number(member.is_org_member) === 1 ? "Active" : "Inactive"
    }));

    const fileName = generateFileName(PAGE_NAME);
    exportToExcel(exportData, fileName, PAGE_NAME);
  }, [members]);

  const handlePrint = useCallback(async () => {
    try {
      const membersArray = Array.isArray(members) ? members : [];
      const title = "Members List";
      const logoUrl = logo;
      const fileName = withExtension(generateFileName(PAGE_NAME), ".pdf");
      const columns = [
        { header: "Name", accessor: (item) => item.full_name },
        { header: "Contact", accessor: (item) => item.general_contact },
        { header: "Email", accessor: (item) => item.general_email },
        { header: "Type", accessor: (item) => item.member_type_name },
        {
          header: "Role",
          accessor: (item) =>
            item.member_roles?.map((role) => role.role_name).join(", ")
        },
        {
          header: "Status",
          accessor: (item) =>
            Number(item.is_org_member) === 1 ? "Active" : "Inactive"
        }
      ];

      await printTable(membersArray, columns, title, logoUrl, fileName);
    } catch (error) {
      console.error("Error generating PDF:", error);
    }
  }, [members]);

  // Derived data
  const memberTypeOptions = memberTypes.map((item) => ({
    value: item.id,
    label: item.type_name
  }));

  // Toggle filter visibility
  const toggleFilters = () => {
    setShowFilters(prev => !prev);
  };

  // Use skeleton loading hook to ensure minimum display time and data validation
  const showSkeleton = useSkeletonLoading(
    membersLoading || memberTypeLoading,
    members,
    SKELETON_MIN_DISPLAY_TIME
  );

  // Conditional redirect once permission check is complete
  if (!loadingPermission && !hasPermission) {
    navigate("/not-authorized");
    return null;
  }

  // const memberRoleOptions = [
  //   ...rolesFromRedux
  //     .filter((role) => role.is_active)
  //     .map((role) => ({
  //       label: role.role_name,
  //       value: role.id.toString()
  //     })),
  //   { label: "Other", value: "other" }
  // ];

  const memberRoleOptions = rolesFromRedux.map((item) => ({
    value: item.id,
    label: item.role_name
  }));

  // Filter bar is always visible, no toggle needed

  return (
    <div>
      <PageContainer>
        <ContentBox>
          <div className="w-full">
            <Div className="flex flex-col lg:flex-row lg:justify-between lg:items-center py-2 sm:py-3 lg:py-4 mb-2 sm:mb-3 lg:mb-4 gap-3 sm:gap-4 lg:gap-0">
          <Heading title="Members List" size="xl" color="text-black" />
          <Div className="flex flex-nowrap items-center gap-2 sm:gap-3 lg:gap-4 lg:space-x-0 min-w-0">
            <Button
              icon={FaDownload}
              variant="download"
              size="large"
              onClick={handleExport}
              disabled={!Array.isArray(members) || members.length === 0}
              iconSize="medium"
              className="flex-shrink-0"
              tooltip="Excel " // Only shows when this is passed
              tooltipId="org-member-excel-tooltip"
            ></Button>
            <Button
              variant="download"
              size="large"
              icon={FaPrint}
              onClick={handlePrint}
              disabled={!Array.isArray(members) || members.length === 0}
              iconSize="medium"
              className="flex-shrink-0"
              tooltip="Print " // Only shows when this is passed
              tooltipId="org-member-print-tooltip"
            ></Button>
            <FilterButton active={showFilters} onClick={toggleFilters}></FilterButton>
            <Button
              icon={FaPlus}
              size="large"
              iconSize="medium"
              onClick={() =>
                navigate("/create-member", {
                  state: { showMessage: false }
                })
              }
              className="bg-primary text-center hover:bg-primary-dark text-white !text-xs sm:!text-sm lg:!text-base !px-2 sm:!px-3 lg:!px-6 whitespace-nowrap"
              tooltip="Add Member"
              tooltipId="add-member-tooltip"
            >
              Add Member
            </Button>
          </Div>
        </Div>

        {/* Filter section - toggleable, open by default */}
        {showFilters && (
          <Div className="bg-white flex flex-col lg:flex-row lg:justify-end lg:items-center gap-2 sm:gap-2 lg:gap-2 lg:space-x-4 mb-4 pb-4 pt-2">
            <div className="flex gap-2 sm:gap-3 lg:gap-4 w-full lg:w-auto">
              <div className="flex-1 lg:flex-none min-w-0">
                <FilterSelect2
                  placeholder="Role"
                  options={memberRoleOptions}
                  paramKey="role"
                  onApply={(filters) => {
                    if (!filters) return;
                    console.log("Applied Filters:", filters);
                  }}
                />
              </div>
              <div className="flex-1 lg:flex-none min-w-0">
                <FilterSelect2
                  placeholder="Member Type"
                  options={memberTypeOptions}
                  paramKey="member_type"
                  className="right-0 lg:left-0"
                  onApply={(filters) => {
                    if (!filters) return;
                    console.log("Applied Filters:", filters);
                  }}
                />
              </div>
            </div>
            <div className="w-full lg:w-auto">
              <SearchBar />
            </div>
          </Div>
        )}

        {/* Loading and Error Handling */}
        {showSkeleton ? (
          <div className="flex items-center justify-center my-6">
            <TableSkeleton />
          </div>
        ) : !Array.isArray(members) || members.length === 0 ? (
          <EmptyState
          icon={IoPeople}
          title="No Members Found"
          />
        ) : (
          <MemberListTable 
            member={members || []} 
            error={membersError}
            highlightMemberId={highlightMemberId}
          />
        )}
          </div>
        </ContentBox>
      </PageContainer>
    </div>
  );
};

MemberList.propTypes = {};

export default MemberList;
