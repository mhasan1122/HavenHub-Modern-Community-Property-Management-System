import { Link, NavLink, useNavigate } from "react-router-dom";
import PropTypes from "prop-types";
import { BsMegaphone } from "react-icons/bs";
import {
  FaAngleDown,
  FaAngleRight,
  FaChartBar,
  FaChartLine,
  FaBalanceScale,
  FaUniversity,
  FaSitemap,
  FaFileInvoice,
  FaEdit,
  FaBookOpen,
  FaCog
} from "react-icons/fa";
import { useCallback, useEffect, useMemo, useState } from "react";
import { TbBuildingEstate } from "react-icons/tb";
import { HiMiniUserGroup } from "react-icons/hi2";
import {
  IoBarChartOutline,
  IoBookOutline,
  IoBusinessOutline,
  IoCashOutline,
  IoClipboardOutline,
  IoDocumentTextOutline,
  IoMegaphoneOutline,
  IoNewspaperOutline,
  IoNotificationsOutline,
  IoPeopleCircleOutline,
  IoPeopleOutline,
  IoLayersOutline,
  IoSettingsOutline,
  IoTimeOutline,
  IoShieldCheckmarkOutline,
  IoWalletOutline,
  IoServerOutline,
  IoCloudDownloadOutline,
  IoPricetagsOutline,
} from "react-icons/io5";
import { CiLogout } from "react-icons/ci";
import { RiDashboardHorizontalLine } from "react-icons/ri";
import {
  FiChevronsLeft,
  FiChevronsRight,
  FiHelpCircle,
  FiPhone
} from "react-icons/fi";
import { useDispatch, useSelector } from "react-redux";
import { logoutUser } from "../../api/authApi/authApi";
import { pullAppUpdate } from "../../api/systemApi";
import { resetReceivablesFilters } from "../../redux/slices/serviceFeeManagement/serviceFeeManagementSlice";
import { PERMISSIONS } from "../../constants/permissions";
import { motion, AnimatePresence } from "framer-motion";
import {
  AnimatedLi,
  AnimatedUl,
  AnimatedButton,
  menuSlide,
  staggerContainer,
  staggerItem,
  transition,
  transitionFast,
  hoverScale,
  buttonTap
} from "../../utils/animations";

const Sidebar = ({ onNavigate, isCollapsed = false, onToggleCollapse }) => {
  const [activeMenu, setActiveMenu] = useState(null);
  const [isUpdating, setIsUpdating] = useState(false);
  const [updateMessage, setUpdateMessage] = useState(null);

  const dispatch = useDispatch();
  const navigate = useNavigate();
  const user = useSelector((state) => state.auth.user);
  const permissionIds = useMemo(
    () => new Set((user?.permission_ids || []).map((id) => Number(id))),
    [user?.permission_ids]
  );

  const hasPermission = useCallback(
    (permissionId) =>
      permissionId ? permissionIds.has(Number(permissionId)) : false,
    [permissionIds]
  );

  const hasAnyPermission = useCallback(
    (permissionList = []) =>
      permissionList.some((permissionId) => hasPermission(permissionId)),
    [hasPermission]
  );

  const isAdmin = user?.member_roles?.some(
    (role) => (role.role_name || "").toLowerCase() === "admin"
  );
  const canViewDashboard = true; // Dashboard is visible to everyone
  const showMemberList = hasPermission(PERMISSIONS.VIEW_MEMBER_LIST);
  const showRoleList = hasPermission(PERMISSIONS.VIEW_ROLE_LIST);
  const showGroupList = hasPermission(PERMISSIONS.VIEW_GROUP_LIST);
  const showImportantContacts = hasPermission(
    PERMISSIONS.VIEW_IMPORTANT_CONTACTS
  );

  const showMemberSection =
    showMemberList ||
    showRoleList ||
    showGroupList ||
    showImportantContacts ||
    isAdmin;

  const showTowerManagementButton = hasAnyPermission([
    PERMISSIONS.VIEW_TOWER,
    PERMISSIONS.VIEW_UNIT_DETAILS,
    PERMISSIONS.VIEW_UNIT_OWNERSHIP,
    PERMISSIONS.VIEW_COMMUNITY_MEMBER_LIST,
    PERMISSIONS.VIEW_UNIT_RESIDENT,
    PERMISSIONS.VIEW_UNIT_STAFF
  ]);
  const showViewTowers = hasPermission(PERMISSIONS.VIEW_TOWER);
  const showCommunityMembers = hasPermission(
    PERMISSIONS.VIEW_COMMUNITY_MEMBER_LIST
  );
  // const showCommunityVehicles = showCommunityMembers;
  const showCommunicationAnnouncements = hasPermission(
    PERMISSIONS.VIEW_ANNOUNCEMENTS
  );
  const showCommunicationBulletins = hasPermission(
    PERMISSIONS.VIEW_BULLETIN_BOARD
  );
  const showCommunicationNotice = hasPermission(PERMISSIONS.VIEW_NOTICE_BOARD);
  const showCommunicationSection =
    showCommunicationAnnouncements ||
    showCommunicationBulletins ||
    showCommunicationNotice;
  const showServiceFeeSettings = hasPermission(
    PERMISSIONS.VIEW_SERVICE_FEE_SETTINGS
  );
  const showBillCategories = hasAnyPermission([
    PERMISSIONS.VIEW_BILL_CATEGORIES,
    PERMISSIONS.ADD_BILL_CATEGORIES,
    PERMISSIONS.EDIT_BILL_CATEGORIES
  ]);

  const showPaymentMethods = hasPermission(PERMISSIONS.VIEW_PAYMENT_METHODS);

  const showBillUploads = hasPermission(PERMISSIONS.BILL_UPLOADS);

  const showBillingManagement = hasAnyPermission([
    PERMISSIONS.VIEW_BILLING_MANAGEMENT,
    PERMISSIONS.GENERATE_SERVICE_FEES
  ]);

  // Finance Management Section
  const showChartOfAccounts = hasAnyPermission([
    PERMISSIONS.VIEW_CHART_OF_ACCOUNTS,
    PERMISSIONS.ADD_CHART_OF_ACCOUNTS,
    PERMISSIONS.EDIT_CHART_OF_ACCOUNTS
  ]);

  const showVoucherEntries = hasAnyPermission([
    PERMISSIONS.VIEW_CHART_OF_ACCOUNTS,
    PERMISSIONS.ADD_CHART_OF_ACCOUNTS,
    PERMISSIONS.EDIT_CHART_OF_ACCOUNTS
  ]);

  const showServiceFeeOverview = hasPermission(
    PERMISSIONS.VIEW_SERVICE_FEE_OVERVIEW
  );
  const showRecordPayment = hasPermission(
    PERMISSIONS.RECORD_SERVICE_FEE_PAYMENT
  );
  const showUnitPaymentHistory = hasPermission(
    PERMISSIONS.VIEW_UNIT_PAYMENT_HISTORY
  );
  const showServiceFeePayments = hasAnyPermission([
    PERMISSIONS.VIEW_SERVICE_FEE_PAYMENTS,
    PERMISSIONS.VIEW_UNIT_PAYMENT_HISTORY
  ]);
  const showUnitReceivables = hasPermission(
    PERMISSIONS.VIEW_UNIT_RECEIVABLES
  );
  const showSendReminder = hasPermission(PERMISSIONS.MANAGE_REMINDERS);
  const showScheduleConfiguration = hasPermission(
    PERMISSIONS.MANAGE_SCHEDULE_CONFIGURATION
  );

  const showFinanceSection = showChartOfAccounts || showVoucherEntries;

  const showServiceFeeSection =
    showServiceFeeSettings ||
    showBillCategories ||
    showBillUploads ||
    showBillingManagement ||
    showServiceFeeOverview ||
    showRecordPayment ||
    showUnitPaymentHistory ||
    showUnitReceivables ||
    showSendReminder ||
    showScheduleConfiguration;
  const showCompanySettings =
    hasAnyPermission([
      PERMISSIONS.VIEW_COMPANY_SETTINGS,
      PERMISSIONS.EDIT_COMPANY_SETTINGS
    ]) ||
    isAdmin ||
    showPaymentMethods;

  const handleLogout = useCallback(
    (event) => {
      event.preventDefault();
      dispatch(logoutUser(navigate));
      if (typeof onNavigate === "function") {
        onNavigate();
      }
    },
    [dispatch, navigate, onNavigate]
  );

  const handleAppUpdate = useCallback(
    async (event) => {
      event.preventDefault();

      if (isUpdating) return;

      setIsUpdating(true);
      setUpdateMessage(null);

      // Set a safety timeout to ensure we always reset the loading state
      // This is a fallback in case something goes wrong
      const safetyTimeout = setTimeout(() => {
        setIsUpdating(false);
        setUpdateMessage({
          type: "error",
          title: "Update Timeout",
          messages: [
            "The update operation is taking longer than expected. Please check the server or try again."
          ]
        });
      }, 200000); // 200 seconds safety net (longer than axios timeout)

      try {
        const result = await pullAppUpdate("estatelink-testing");

        clearTimeout(safetyTimeout);

        if (result && result.success) {
          setUpdateMessage({
            type: "success",
            title: "Update Successful",
            messages: result.messages || ["App updated successfully"],
            commit: result.latest_commit
          });
        } else {
          // Combine errors and messages for better visibility
          const allMessages = [
            ...(result?.errors || []),
            ...(result?.messages || [])
          ];
          setUpdateMessage({
            type: "error",
            title: result?.error || "Update Failed",
            messages:
              allMessages.length > 0 ? allMessages : ["Failed to update app"]
          });
        }
      } catch (error) {
        clearTimeout(safetyTimeout);

        // Handle different error formats
        let errorMessages = [];
        let errorTitle = "Update Error";

        if (error?.response?.data) {
          const errorData = error.response.data;
          if (errorData.errors && Array.isArray(errorData.errors)) {
            errorMessages = errorData.errors;
          } else if (errorData.error) {
            errorMessages = [errorData.error];
          } else if (typeof errorData === "string") {
            errorMessages = [errorData];
          }
          errorTitle = errorData.error || errorTitle;
        } else if (error?.error) {
          errorTitle = error.error;
          if (error.errors && Array.isArray(error.errors)) {
            errorMessages = error.errors;
          } else if (error.message) {
            errorMessages = [error.message];
          }
        } else if (error?.message) {
          errorMessages = [error.message];
        } else if (typeof error === "string") {
          errorMessages = [error];
        } else {
          errorMessages = ["An error occurred while updating"];
        }

        setUpdateMessage({
          type: "error",
          title: errorTitle,
          messages: errorMessages
        });
      } finally {
        // Always reset updating state, even if there's an error
        clearTimeout(safetyTimeout);
        setIsUpdating(false);
        // Clear message after 10 seconds for errors, 5 seconds for success
        setTimeout(() => {
          setUpdateMessage(null);
        }, 10000);
      }
    },
    [isUpdating]
  );

  const handleNavigate = useCallback(() => {
    if (typeof onNavigate === "function") {
      onNavigate();
    }
  }, [onNavigate]);

  const toggleMenu = useCallback((menuName) => {
    setActiveMenu((prev) => (prev === menuName ? null : menuName));
  }, []);

  useEffect(() => {
    if (isCollapsed) {
      setActiveMenu(null);
    }
  }, [isCollapsed]);

  const getLinkClass = useCallback(
    (isActive, level = "base") => {
      const isNested = level === "nested";
      const baseClasses = isCollapsed
        ? "flex w-full flex-col items-center justify-center gap-1 px-2 py-2.5 sm:py-3 text-xs"
        : isNested
          ? "flex w-full items-center gap-2 py-2.5 pl-6 pr-3 sm:py-2 sm:pl-10 sm:pr-4 text-sm sm:text-sm md:text-base min-h-[44px] lg:min-h-0"
          : "flex w-full items-center gap-2 sm:gap-3 px-4 sm:px-6 py-3 sm:py-2.5 text-sm sm:text-base min-h-[48px] lg:min-h-0";

      const rounding = isCollapsed ? "rounded-full" : "rounded-r-full";
      const hoverState = isActive
        ? "bg-primary text-white shadow-sm"
        : "text-primary hover:bg-primary hover:text-white active:scale-[0.98] lg:active:scale-100";

      return `${baseClasses} ${rounding} transition-all duration-200 ${hoverState}`;
    },
    [isCollapsed]
  );

  const getSectionButtonClass = useCallback(
    (isActive) => {
      const baseClasses = isCollapsed
        ? "flex w-full items-center justify-center gap-1 px-2 py-2.5 sm:py-3 text-xs"
        : "flex w-full items-center justify-between gap-2 px-4 sm:px-6 py-3 sm:py-2.5 text-left text-sm sm:text-base min-h-[48px] lg:min-h-0";

      const rounding = isCollapsed ? "rounded-full" : "rounded-r-full";
      const hoverState = isActive
        ? "bg-primary text-white shadow-sm"
        : "text-primary hover:bg-primary hover:text-white active:scale-[0.98] lg:active:scale-100";

      return `${baseClasses} ${rounding} transition-all duration-200 ${hoverState}`;
    },
    [isCollapsed]
  );

  const iconClass = isCollapsed ? "w-5 h-5 sm:w-6 sm:h-6" : "w-5 h-5 sm:w-5 sm:h-5 lg:w-6 lg:h-6";
  const labelClass = useMemo(
    () =>
      `block truncate transition-all duration-200 text-xs sm:text-sm ${isCollapsed ? "lg:hidden" : ""
      }`,
    [isCollapsed]
  );
  const nestedIconClass = useMemo(
    () => (isCollapsed ? "h-3.5 w-3.5 sm:h-4 sm:w-4" : "h-4 w-4 sm:h-4 sm:w-4 md:h-5 md:w-5"),
    [isCollapsed]
  );

  return (
    <nav
      className="relative flex h-full flex-col bg-white pt-3 sm:pt-4 lg:pt-8 overflow-hidden"
      aria-label="Sidebar navigation"
    >
      {typeof onToggleCollapse === "function" && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={transition}
          className="hidden flex-shrink-0 items-center justify-end px-4 pb-4 lg:flex"
        >
          <motion.button
            type="button"
            onClick={onToggleCollapse}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                onToggleCollapse();
              }
            }}
            aria-label={isCollapsed ? "Expand sidebar" : "Collapse sidebar"}
            aria-expanded={!isCollapsed}
            title={isCollapsed ? "Expand sidebar" : "Collapse sidebar"}
            whileHover={hoverScale}
            whileTap={buttonTap}
            className="group relative rounded-lg border border-primary/30 bg-white text-primary shadow-sm transition-all duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 flex h-9 w-9 items-center justify-center hover:border-primary hover:bg-primary hover:text-white hover:shadow-md"
          >
            <AnimatePresence mode="wait" initial={false}>
              <motion.div
                key={isCollapsed ? "expand" : "collapse"}
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.8 }}
                transition={transitionFast}
                className="flex items-center justify-center"
              >
                {isCollapsed ? (
                  <FiChevronsRight className="h-4 w-4" aria-hidden="true" />
                ) : (
                  <FiChevronsLeft className="h-4 w-4" aria-hidden="true" />
                )}
              </motion.div>
            </AnimatePresence>
            <span className="sr-only">
              {isCollapsed ? "Expand sidebar" : "Collapse sidebar"}
            </span>
          </motion.button>
        </motion.div>
      )}
      <div className="flex-1 overflow-y-auto custom-scrollbar pr-1 sm:pr-2 min-h-0">
        <AnimatedUl
          variants={staggerContainer}
          initial="initial"
          animate="animate"
          className="space-y-0.5 sm:space-y-1 lg:space-y-2 pb-2 text-primary pt-3 sm:pt-2 lg:pt-0 px-2 sm:px-0 lg:px-0"
        >
          {canViewDashboard && (
            <AnimatedLi variants={staggerItem}>
              <NavLink
                to="/"
                onClick={handleNavigate}
                aria-label="Dashboard"
                title="Dashboard"
                className={({ isActive }) => getLinkClass(isActive)}
              >
                {({ isActive }) => (
                  <motion.div
                    className="flex items-center gap-3"
                    whileHover={{ x: 4 }}
                    transition={transition}
                  >
                    <motion.div
                      animate={isActive ? { scale: 1.1 } : { scale: 1 }}
                      transition={transition}
                    >
                      <RiDashboardHorizontalLine className={iconClass} />
                    </motion.div>
                    <span className={labelClass}>Dashboard</span>
                  </motion.div>
                )}
              </NavLink>
            </AnimatedLi>
          )}

          {showMemberSection && (
            <AnimatedLi variants={staggerItem}>
              <AnimatedButton
                type="button"
                onClick={() => toggleMenu("memberManagement")}
                className={getSectionButtonClass(
                  activeMenu === "memberManagement"
                )}
                aria-expanded={activeMenu === "memberManagement"}
                aria-label="Member Management"
                title="Member Management"
                whileHover={{ x: 4 }}
                whileTap={buttonTap}
                transition={transition}
              >
                <span
                  className={`flex items-center ${isCollapsed ? "flex-col gap-1 text-center" : "gap-3"
                    }`}
                >
                  <motion.div
                    animate={
                      activeMenu === "memberManagement"
                        ? { rotate: [0, -10, 10, 0] }
                        : {}
                    }
                    transition={{ duration: 0.5 }}
                  >
                    <HiMiniUserGroup className={iconClass} />
                  </motion.div>
                  <span className={labelClass}>Member Management</span>
                </span>
                {!isCollapsed && (
                  <motion.div
                    animate={{
                      rotate: activeMenu === "memberManagement" ? 0 : -90
                    }}
                    transition={transition}
                  >
                    {activeMenu === "memberManagement" ? (
                      <FaAngleDown className="w-4 h-4" />
                    ) : (
                      <FaAngleRight className="w-4 h-4" />
                    )}
                  </motion.div>
                )}
              </AnimatedButton>

              <AnimatePresence>
                {activeMenu === "memberManagement" && (
                  <motion.ul
                    variants={menuSlide}
                    initial="initial"
                    animate="animate"
                    exit="exit"
                    className="mt-1 space-y-1"
                  >
                    {showMemberList && (
                      <motion.li
                        variants={staggerItem}
                        initial="initial"
                        animate="animate"
                      >
                        <NavLink
                          to="/member-list"
                          onClick={handleNavigate}
                          aria-label="Organization Members"
                          title="Organization Members"
                          className={({ isActive }) =>
                            getLinkClass(isActive, "nested")
                          }
                        >
                          {({ isActive }) => (
                            <motion.div
                              className="flex items-center gap-2"
                              whileHover={{ x: 4 }}
                              transition={transition}
                            >
                              <motion.div
                                animate={
                                  isActive ? { scale: 1.1 } : { scale: 1 }
                                }
                                transition={transition}
                              >
                                <IoPeopleCircleOutline
                                  className={nestedIconClass}
                                />
                              </motion.div>
                              <span className={labelClass}>
                                Organization Members
                              </span>
                            </motion.div>
                          )}
                        </NavLink>
                      </motion.li>
                    )}
                    {showRoleList && (
                      <motion.li
                        variants={staggerItem}
                        initial="initial"
                        animate="animate"
                      >
                        <NavLink
                          to="/role-list"
                          onClick={handleNavigate}
                          aria-label="Role Management"
                          title="Role Management"
                          className={({ isActive }) =>
                            getLinkClass(isActive, "nested")
                          }
                        >
                          {({ isActive }) => (
                            <motion.div
                              className="flex items-center gap-2"
                              whileHover={{ x: 4 }}
                              transition={transition}
                            >
                              <motion.div
                                animate={
                                  isActive ? { scale: 1.1 } : { scale: 1 }
                                }
                                transition={transition}
                              >
                                <IoShieldCheckmarkOutline
                                  className={nestedIconClass}
                                />
                              </motion.div>
                              <span className={labelClass}>
                                Role Management
                              </span>
                            </motion.div>
                          )}
                        </NavLink>
                      </motion.li>
                    )}
                    {showGroupList && (
                      <motion.li
                        variants={staggerItem}
                        initial="initial"
                        animate="animate"
                      >
                        <NavLink
                          to="/group-list"
                          onClick={handleNavigate}
                          aria-label="Groups"
                          title="Groups"
                          className={({ isActive }) =>
                            getLinkClass(isActive, "nested")
                          }
                        >
                          {({ isActive }) => (
                            <motion.div
                              className="flex items-center gap-2"
                              whileHover={{ x: 4 }}
                              transition={transition}
                            >
                              <motion.div
                                animate={
                                  isActive ? { scale: 1.1 } : { scale: 1 }
                                }
                                transition={transition}
                              >
                                <IoLayersOutline className={nestedIconClass} />
                              </motion.div>
                              <span className={labelClass}>Groups</span>
                            </motion.div>
                          )}
                        </NavLink>
                      </motion.li>
                    )}
                    {(showImportantContacts || isAdmin) && (
                      <motion.li
                        variants={staggerItem}
                        initial="initial"
                        animate="animate"
                      >
                        <NavLink
                          to="/important-contacts"
                          onClick={handleNavigate}
                          aria-label="Important Contacts"
                          title="Important Contacts"
                          className={({ isActive }) =>
                            getLinkClass(isActive, "nested")
                          }
                        >
                          {({ isActive }) => (
                            <motion.div
                              className="flex items-center gap-2"
                              whileHover={{ x: 4 }}
                              transition={transition}
                            >
                              <motion.div
                                animate={
                                  isActive ? { scale: 1.1 } : { scale: 1 }
                                }
                                transition={transition}
                              >
                                <IoBookOutline className={nestedIconClass} />
                              </motion.div>
                              <span className={labelClass}>
                                Important Contacts
                              </span>
                            </motion.div>
                          )}
                        </NavLink>
                      </motion.li>
                    )}
                  </motion.ul>
                )}
              </AnimatePresence>
            </AnimatedLi>
          )}

          {showTowerManagementButton && (
            <AnimatedLi variants={staggerItem}>
              <AnimatedButton
                type="button"
                onClick={() => toggleMenu("towerManagement")}
                className={getSectionButtonClass(
                  activeMenu === "towerManagement"
                )}
                aria-expanded={activeMenu === "towerManagement"}
                aria-label="Tower and Unit Management"
                title="Tower & Unit Management"
                whileHover={{ x: 4 }}
                whileTap={buttonTap}
                transition={transition}
              >
                <span
                  className={`flex items-center ${isCollapsed ? "flex-col gap-1 text-center" : "gap-3"
                    }`}
                >
                  <motion.div
                    animate={
                      activeMenu === "towerManagement"
                        ? { rotate: [0, -10, 10, 0] }
                        : {}
                    }
                    transition={{ duration: 0.5 }}
                  >
                    <TbBuildingEstate className={iconClass} />
                  </motion.div>
                  <span className={labelClass}>
                    Tower &amp; Unit Management
                  </span>
                </span>
                {!isCollapsed && (
                  <motion.div
                    animate={{
                      rotate: activeMenu === "towerManagement" ? 0 : -90
                    }}
                    transition={transition}
                  >
                    {activeMenu === "towerManagement" ? (
                      <FaAngleDown className="w-4 h-4" />
                    ) : (
                      <FaAngleRight className="w-4 h-4" />
                    )}
                  </motion.div>
                )}
              </AnimatedButton>

              <AnimatePresence>
                {activeMenu === "towerManagement" && (
                  <motion.ul
                    variants={menuSlide}
                    initial="initial"
                    animate="animate"
                    exit="exit"
                    className="mt-1 space-y-1"
                  >
                    {showViewTowers && (
                      <motion.li
                        variants={staggerItem}
                        initial="initial"
                        animate="animate"
                      >
                        <NavLink
                          to="/ViewTowers"
                          onClick={handleNavigate}
                          aria-label="Tower and Unit Management"
                          title="Tower and Unit Management"
                          className={({ isActive }) =>
                            getLinkClass(isActive, "nested")
                          }
                        >
                          {({ isActive }) => (
                            <motion.div
                              className="flex items-center gap-2"
                              whileHover={{ x: 4 }}
                              transition={transition}
                            >
                              <motion.div
                                animate={
                                  isActive ? { scale: 1.1 } : { scale: 1 }
                                }
                                transition={transition}
                              >
                                <IoBusinessOutline
                                  className={nestedIconClass}
                                />
                              </motion.div>
                              <span className={labelClass}>
                                Tower &amp; Unit Management
                              </span>
                            </motion.div>
                          )}
                        </NavLink>
                      </motion.li>
                    )}
                    {showCommunityMembers && (
                      <motion.li
                        variants={staggerItem}
                        initial="initial"
                        animate="animate"
                      >
                        <NavLink
                          to="/community-member-list"
                          onClick={handleNavigate}
                          aria-label="Community Member Management"
                          title="Community Member Management"
                          className={({ isActive }) =>
                            getLinkClass(isActive, "nested")
                          }
                        >
                          {({ isActive }) => (
                            <motion.div
                              className="flex items-center gap-2"
                              whileHover={{ x: 4 }}
                              transition={transition}
                            >
                              <motion.div
                                animate={
                                  isActive ? { scale: 1.1 } : { scale: 1 }
                                }
                                transition={transition}
                              >
                                <IoPeopleOutline className={nestedIconClass} />
                              </motion.div>
                              <span className={labelClass}>
                                Community Member Management
                              </span>
                            </motion.div>
                          )}
                        </NavLink>
                      </motion.li>
                    )}
                    {/* Vehicles tab disabled per request */}
                    {/* {showCommunityVehicles && (
                    <motion.li
                      variants={staggerItem}
                      initial="initial"
                      animate="animate"
                    >
                      <NavLink
                        to="/community-Vehicle-list"
                        onClick={handleNavigate}
                        aria-label="Community Vehicles"
                        title="Community Vehicles"
                        className={({ isActive }) =>
                          getLinkClass(isActive, "nested")
                        }
                      >
                        {isCollapsed && (
                          <span
                            className="hidden lg:inline-flex h-2 w-2 rounded-full bg-primary/70"
                            aria-hidden="true"
                          />
                        )}
                        <span className={labelClass}>Community Vehicles</span>
                      </NavLink>
                    </motion.li>
                  )} */}
                  </motion.ul>
                )}
              </AnimatePresence>
            </AnimatedLi>
          )}

          {showCommunicationSection && (
            <AnimatedLi variants={staggerItem}>
              <AnimatedButton
                type="button"
                onClick={() => toggleMenu("communication")}
                className={getSectionButtonClass(
                  activeMenu === "communication"
                )}
                aria-expanded={activeMenu === "communication"}
                aria-label="Communication Portal"
                title="Communication Portal"
                whileHover={{ x: 4 }}
                whileTap={buttonTap}
                transition={transition}
              >
                <span
                  className={`flex items-center ${isCollapsed ? "flex-col gap-1 text-center" : "gap-3"
                    }`}
                >
                  <motion.div
                    animate={
                      activeMenu === "communication"
                        ? { rotate: [0, -10, 10, 0] }
                        : {}
                    }
                    transition={{ duration: 0.5 }}
                  >
                    <BsMegaphone className={iconClass} />
                  </motion.div>
                  <span className={labelClass}>Communication Portal</span>
                </span>
                {!isCollapsed && (
                  <motion.div
                    animate={{
                      rotate: activeMenu === "communication" ? 0 : -90
                    }}
                    transition={transition}
                  >
                    {activeMenu === "communication" ? (
                      <FaAngleDown className="w-4 h-4" />
                    ) : (
                      <FaAngleRight className="w-4 h-4" />
                    )}
                  </motion.div>
                )}
              </AnimatedButton>

              <AnimatePresence>
                {activeMenu === "communication" && (
                  <motion.ul
                    variants={menuSlide}
                    initial="initial"
                    animate="animate"
                    exit="exit"
                    className="mt-1 space-y-1"
                  >
                    {showCommunicationAnnouncements && (
                      <motion.li
                        variants={staggerItem}
                        initial="initial"
                        animate="animate"
                      >
                        <NavLink
                          to="/announcements"
                          onClick={handleNavigate}
                          aria-label="Announcements"
                          title="Announcements"
                          className={({ isActive }) =>
                            getLinkClass(isActive, "nested")
                          }
                        >
                          {({ isActive }) => (
                            <motion.div
                              className="flex items-center gap-2"
                              whileHover={{ x: 4 }}
                              transition={transition}
                            >
                              <motion.div
                                animate={
                                  isActive ? { scale: 1.1 } : { scale: 1 }
                                }
                                transition={transition}
                              >
                                <IoMegaphoneOutline
                                  className={nestedIconClass}
                                />
                              </motion.div>
                              <span className={labelClass}>Announcements</span>
                            </motion.div>
                          )}
                        </NavLink>
                      </motion.li>
                    )}
                    {showCommunicationBulletins && (
                      <motion.li
                        variants={staggerItem}
                        initial="initial"
                        animate="animate"
                      >
                        <NavLink
                          to="/bulletins"
                          onClick={handleNavigate}
                          aria-label="Bulletin Board"
                          title="Bulletin Board"
                          className={({ isActive }) =>
                            getLinkClass(isActive, "nested")
                          }
                        >
                          {({ isActive }) => (
                            <motion.div
                              className="flex items-center gap-2"
                              whileHover={{ x: 4 }}
                              transition={transition}
                            >
                              <motion.div
                                animate={
                                  isActive ? { scale: 1.1 } : { scale: 1 }
                                }
                                transition={transition}
                              >
                                <IoNewspaperOutline
                                  className={nestedIconClass}
                                />
                              </motion.div>
                              <span className={labelClass}>Bulletin Board</span>
                            </motion.div>
                          )}
                        </NavLink>
                      </motion.li>
                    )}
                    {showCommunicationNotice && (
                      <motion.li
                        variants={staggerItem}
                        initial="initial"
                        animate="animate"
                      >
                        <NavLink
                          to="/notice-board"
                          onClick={handleNavigate}
                          aria-label="Notice Board"
                          title="Notice Board"
                          className={({ isActive }) =>
                            getLinkClass(isActive, "nested")
                          }
                        >
                          {({ isActive }) => (
                            <motion.div
                              className="flex items-center gap-2"
                              whileHover={{ x: 4 }}
                              transition={transition}
                            >
                              <motion.div
                                animate={
                                  isActive ? { scale: 1.1 } : { scale: 1 }
                                }
                                transition={transition}
                              >
                                <IoClipboardOutline
                                  className={nestedIconClass}
                                />
                              </motion.div>
                              <span className={labelClass}>Notice Board</span>
                            </motion.div>
                          )}
                        </NavLink>
                      </motion.li>
                    )}
                  </motion.ul>
                )}
              </AnimatePresence>
            </AnimatedLi>
          )}

          {showServiceFeeSection && (
            <AnimatedLi variants={staggerItem}>
              <AnimatedButton
                type="button"
                onClick={() => toggleMenu("serviceFeeManagement")}
                className={getSectionButtonClass(
                  activeMenu === "serviceFeeManagement"
                )}
                aria-expanded={activeMenu === "serviceFeeManagement"}
                aria-label="Service Fee Management"
                title="Service Fee Management"
                whileHover={{ x: 4 }}
                whileTap={buttonTap}
                transition={transition}
              >
                <span
                  className={`flex items-center ${isCollapsed ? "flex-col gap-1 text-center" : "gap-3"
                    }`}
                >
                  <motion.div
                    animate={
                      activeMenu === "serviceFeeManagement"
                        ? { rotate: [0, -10, 10, 0] }
                        : {}
                    }
                    transition={{ duration: 0.5 }}
                  >
                    <IoWalletOutline className={iconClass} />
                  </motion.div>
                  <span className={labelClass}>Service Fee Management</span>
                </span>
                {!isCollapsed && (
                  <motion.div
                    animate={{
                      rotate: activeMenu === "serviceFeeManagement" ? 0 : -90
                    }}
                    transition={transition}
                  >
                    {activeMenu === "serviceFeeManagement" ? (
                      <FaAngleDown className="w-4 h-4" />
                    ) : (
                      <FaAngleRight className="w-4 h-4" />
                    )}
                  </motion.div>
                )}
              </AnimatedButton>

              <AnimatePresence>
                {activeMenu === "serviceFeeManagement" && (
                  <motion.ul
                    variants={menuSlide}
                    initial="initial"
                    animate="animate"
                    exit="exit"
                    className="mt-1 space-y-1"
                  >
                    {/* Bill Categories - First Priority */}
                    {showBillCategories && (
                      <motion.li
                        variants={staggerItem}
                        initial="initial"
                        animate="animate"
                      >
                        <NavLink
                          to="/bill-categories"
                          onClick={handleNavigate}
                          aria-label="Bill Categories"
                          title="Bill Categories"
                          className={({ isActive }) =>
                            getLinkClass(isActive, "nested")
                          }
                        >
                          {({ isActive }) => (
                            <motion.div
                              className="flex items-center gap-2"
                              whileHover={{ x: 4 }}
                              transition={transition}
                            >
                              <motion.div
                                animate={
                                  isActive ? { scale: 1.1 } : { scale: 1 }
                                }
                                transition={transition}
                              >
                                <IoPricetagsOutline
                                  className={nestedIconClass}
                                />
                              </motion.div>
                              <span className={labelClass}>
                                Bill Categories
                              </span>
                            </motion.div>
                          )}
                        </NavLink>
                      </motion.li>
                    )}


                    {/* Bill Uploads - Second Priority */}
                    {showBillUploads && (
                      <motion.li
                        variants={staggerItem}
                        initial="initial"
                        animate="animate"
                      >
                        <NavLink
                          to="/service-fee-bill-uploads"
                          onClick={handleNavigate}
                          aria-label="Bill Uploads"
                          title="Bill Uploads"
                          className={({ isActive }) =>
                            getLinkClass(isActive, "nested")
                          }
                        >
                          {({ isActive }) => (
                            <motion.div
                              className="flex items-center gap-2"
                              whileHover={{ x: 4 }}
                              transition={transition}
                            >
                              <motion.div
                                animate={isActive ? { scale: 1.1 } : { scale: 1 }}
                                transition={transition}
                              >
                                <IoClipboardOutline className={nestedIconClass} />
                              </motion.div>
                              <span className={labelClass}>Bill Uploads</span>
                            </motion.div>
                          )}
                        </NavLink>
                      </motion.li>
                    )}

                    {/* Billing Management - Third Priority */}
                    {showBillingManagement && (
                      <motion.li
                        variants={staggerItem}
                        initial="initial"
                        animate="animate"
                      >
                        <NavLink
                          to="/billing-management"
                          onClick={handleNavigate}
                          aria-label="Billing Management"
                          title="Billing Management"
                          className={({ isActive }) =>
                            getLinkClass(isActive, "nested")
                          }
                        >
                          {({ isActive }) => (
                            <motion.div
                              className="flex items-center gap-2"
                              whileHover={{ x: 4 }}
                              transition={transition}
                            >
                              <motion.div
                                animate={isActive ? { scale: 1.1 } : { scale: 1 }}
                                transition={transition}
                              >
                                <IoNewspaperOutline className={nestedIconClass} />
                              </motion.div>
                              <span className={labelClass}>
                                Billing Management
                              </span>
                            </motion.div>
                          )}
                        </NavLink>
                      </motion.li>
                    )}

                    {/* Service Fee Settings */}
                    {showServiceFeeSettings && (
                      <motion.li
                        variants={staggerItem}
                        initial="initial"
                        animate="animate"
                      >
                        <NavLink
                          to="/service-fee-settings"
                          onClick={handleNavigate}
                          aria-label="Service Fee Settings"
                          title="Service Fee Settings"
                          className={({ isActive }) =>
                            getLinkClass(isActive, "nested")
                          }
                        >
                          {({ isActive }) => (
                            <motion.div
                              className="flex items-center gap-2"
                              whileHover={{ x: 4 }}
                              transition={transition}
                            >
                              <motion.div
                                animate={isActive ? { scale: 1.1 } : { scale: 1 }}
                                transition={transition}
                              >
                                <IoSettingsOutline
                                  className={nestedIconClass}
                                />
                              </motion.div>
                              <span className={labelClass}>
                                Service Fee Settings
                              </span>
                            </motion.div>
                          )}
                        </NavLink>
                      </motion.li>
                    )}

                    {/* Service Fee Overview */}
                    {showServiceFeeOverview && (
                      <motion.li
                        variants={staggerItem}
                        initial="initial"
                        animate="animate"
                      >
                        <NavLink
                          to="/service-fee-overview"
                          onClick={handleNavigate}
                          aria-label="Service Fee Overview"
                          title="Service Fee Overview"
                          className={({ isActive }) =>
                            getLinkClass(isActive, "nested")
                          }
                        >
                          {({ isActive }) => (
                            <motion.div
                              className="flex items-center gap-2"
                              whileHover={{ x: 4 }}
                              transition={transition}
                            >
                              <motion.div
                                animate={isActive ? { scale: 1.1 } : { scale: 1 }}
                                transition={transition}
                              >
                                <IoBarChartOutline
                                  className={nestedIconClass}
                                />
                              </motion.div>
                              <span className={labelClass}>
                                Service Fee Overview
                              </span>
                            </motion.div>
                          )}
                        </NavLink>
                      </motion.li>
                    )}

                    {/* Service Fees */}
                    {showServiceFeePayments && (
                      <motion.li
                        variants={staggerItem}
                        initial="initial"
                        animate="animate"
                      >
                        <NavLink
                          to="/service-fee-list"
                          onClick={handleNavigate}
                          aria-label="Service Fees Payments"
                          title="Service Fees Payments"
                          className={({ isActive }) =>
                            getLinkClass(isActive, "nested")
                          }
                        >
                          {({ isActive }) => (
                            <motion.div
                              className="flex items-center gap-2"
                              whileHover={{ x: 4 }}
                              transition={transition}
                            >
                              <motion.div
                                animate={isActive ? { scale: 1.1 } : { scale: 1 }}
                                transition={transition}
                              >
                                <IoCashOutline className={nestedIconClass} />
                              </motion.div>
                              <span className={labelClass}>Service Fees Payments</span>
                            </motion.div>
                          )}
                        </NavLink>
                      </motion.li>
                    )}

                    {/* Unit Payment History */}
                    {/* {showUnitPaymentHistory && (
                      <motion.li
                        variants={staggerItem}
                        initial="initial"
                        animate="animate"
                      >
                        <NavLink
                          to="/unit-payment-history"
                          onClick={handleNavigate}
                          aria-label="Unit Payment History"
                          title="Unit Payment History"
                          className={({ isActive }) =>
                            getLinkClass(isActive, "nested")
                          }
                        >
                          {({ isActive }) => (
                            <motion.div
                              className="flex items-center gap-2"
                              whileHover={{ x: 4 }}
                              transition={transition}
                            >
                              <motion.div
                                animate={isActive ? { scale: 1.1 } : { scale: 1 }}
                                transition={transition}
                              >
                                <IoTimeOutline className={nestedIconClass} />
                              </motion.div>
                              <span className={labelClass}>
                                Unit Payment History
                              </span>
                            </motion.div>
                          )}
                        </NavLink>
                      </motion.li>
                    )} */}

                    {/* Unit Receivables */}
                    {showUnitReceivables && (
                      <motion.li
                        variants={staggerItem}
                        initial="initial"
                        animate="animate"
                      >
                        <NavLink
                          to="/unit-receivables"
                          onClick={(e) => {
                            dispatch(resetReceivablesFilters());
                            handleNavigate(e);
                          }}
                          aria-label="Unit Receivables"
                          title="Unit Receivables"
                          className={({ isActive }) =>
                            getLinkClass(isActive, "nested")
                          }
                        >
                          {({ isActive }) => (
                            <motion.div
                              className="flex items-center gap-2"
                              whileHover={{ x: 4 }}
                              transition={transition}
                            >
                              <motion.div
                                animate={isActive ? { scale: 1.1 } : { scale: 1 }}
                                transition={transition}
                              >
                                <IoWalletOutline className={nestedIconClass} />
                              </motion.div>
                              <span className={labelClass}>
                                Unit Receivables
                              </span>
                            </motion.div>
                          )}
                        </NavLink>
                      </motion.li>
                    )}

                    {/* Schedule Configuration */}
                    {/* {showScheduleConfiguration && (
                      <motion.li
                        variants={staggerItem}
                        initial="initial"
                        animate="animate"
                      >
                        <NavLink
                          to="/service-fee-schedule-configuration"
                          onClick={handleNavigate}
                          aria-label="Schedule Configuration"
                          title="Schedule Configuration"
                          className={({ isActive }) =>
                            getLinkClass(isActive, "nested")
                          }
                        >
                          {({ isActive }) => (
                            <motion.div
                              className="flex items-center gap-2"
                              whileHover={{ x: 4 }}
                              transition={transition}
                            >
                              <motion.div
                                animate={isActive ? { scale: 1.1 } : { scale: 1 }}
                                transition={transition}
                              >
                                <IoTimeOutline className={nestedIconClass} />
                              </motion.div>
                              <span className={labelClass}>
                                Schedule Config
                              </span>
                            </motion.div>
                          )}
                        </NavLink>
                      </motion.li>
                    )} */}

                    {/* Send Reminder */}
                    {/* {showSendReminder && (
                      <motion.li
                        variants={staggerItem}
                        initial="initial"
                        animate="animate"
                      >
                        <NavLink
                          to="/service-fee-reminders"
                          onClick={handleNavigate}
                          aria-label="Send Reminder"
                          title="Send Reminder"
                          className={({ isActive }) =>
                            getLinkClass(isActive, "nested")
                          }
                        >
                          {({ isActive }) => (
                            <motion.div
                              className="flex items-center gap-2"
                              whileHover={{ x: 4 }}
                              transition={transition}
                            >
                              <motion.div
                                animate={isActive ? { scale: 1.1 } : { scale: 1 }}
                                transition={transition}
                              >
                                <IoNotificationsOutline
                                  className={nestedIconClass}
                                />
                              </motion.div>
                              <span className={labelClass}>Send Reminder</span>
                            </motion.div>
                          )}
                        </NavLink>
                      </motion.li>
                    )} */}
                  </motion.ul>
                )}
              </AnimatePresence>
            </AnimatedLi>
          )}

          {showFinanceSection && (
            <AnimatedLi variants={staggerItem}>
              <AnimatedButton
                type="button"
                onClick={() => toggleMenu("financeManagement")}
                className={getSectionButtonClass(
                  activeMenu === "financeManagement"
                )}
                aria-expanded={activeMenu === "financeManagement"}
                aria-label="Finance Management"
                title="Finance Management"
                whileHover={{ x: 4 }}
                whileTap={buttonTap}
                transition={transition}
              >
                <span
                  className={`flex items-center ${isCollapsed ? "flex-col gap-1 text-center" : "gap-3"
                    }`}
                >
                  <motion.div
                    animate={
                      activeMenu === "financeManagement"
                        ? { rotate: [0, -10, 10, 0] }
                        : {}
                    }
                    transition={{ duration: 0.5 }}
                  >
                    <IoWalletOutline className={iconClass} />
                  </motion.div>
                  <span className={labelClass}>Finance Management</span>
                </span>
                {!isCollapsed && (
                  <motion.div
                    animate={{
                      rotate: activeMenu === "financeManagement" ? 0 : -90
                    }}
                    transition={transition}
                  >
                    {activeMenu === "financeManagement" ? (
                      <FaAngleDown className="w-4 h-4" />
                    ) : (
                      <FaAngleRight className="w-4 h-4" />
                    )}
                  </motion.div>
                )}
              </AnimatedButton>

              <AnimatePresence>
                {activeMenu === "financeManagement" && (
                  <motion.ul
                    variants={menuSlide}
                    initial="initial"
                    animate="animate"
                    exit="exit"
                    className="mt-1 space-y-1"
                  >
                    {showChartOfAccounts && (
                      <motion.li
                        variants={staggerItem}
                        initial="initial"
                        animate="animate"
                      >
                        <NavLink
                          to="/chart-of-accounts"
                          onClick={handleNavigate}
                          aria-label="Chart of Accounts"
                          title="Chart of Accounts"
                          className={({ isActive }) =>
                            getLinkClass(isActive, "nested")
                          }
                        >
                          {({ isActive }) => (
                            <motion.div
                              className="flex items-center gap-2"
                              whileHover={{ x: 4 }}
                              transition={transition}
                            >
                              <motion.div
                                animate={
                                  isActive ? { scale: 1.1 } : { scale: 1 }
                                }
                                transition={transition}
                              >
                                <FaSitemap className={nestedIconClass} />
                              </motion.div>
                              <span className={labelClass}>
                                Chart of Accounts
                              </span>
                            </motion.div>
                          )}
                        </NavLink>
                      </motion.li>
                    )}



                    {showVoucherEntries && (
                      <motion.li
                        variants={staggerItem}
                        initial="initial"
                        animate="animate"
                      >
                        <NavLink
                          to="/accounting/voucher-list"
                          onClick={handleNavigate}
                          aria-label="Voucher List"
                          title="Voucher List"
                          className={({ isActive }) =>
                            getLinkClass(isActive, "nested")
                          }
                        >
                          {({ isActive }) => (
                            <motion.div
                              className="flex items-center gap-2"
                              whileHover={{ x: 4 }}
                              transition={transition}
                            >
                              <motion.div
                                animate={
                                  isActive ? { scale: 1.1 } : { scale: 1 }
                                }
                                transition={transition}
                              >
                                <FaFileInvoice className={nestedIconClass} />
                              </motion.div>
                              <span className={labelClass}>
                                Voucher List
                              </span>
                            </motion.div>
                          )}
                        </NavLink>
                      </motion.li>
                    )}

                    {showVoucherEntries && (
                      <motion.li
                        variants={staggerItem}
                        initial="initial"
                        animate="animate"
                      >
                        <NavLink
                          to="/accounting/financial-entry"
                          onClick={handleNavigate}
                          aria-label="Financial Entry"
                          title="Financial Entry"
                          className={({ isActive }) =>
                            getLinkClass(isActive, "nested")
                          }
                        >
                          {({ isActive }) => (
                            <motion.div
                              className="flex items-center gap-2"
                              whileHover={{ x: 4 }}
                              transition={transition}
                            >
                              <motion.div
                                animate={
                                  isActive ? { scale: 1.1 } : { scale: 1 }
                                }
                                transition={transition}
                              >
                                <FaEdit className={nestedIconClass} />
                              </motion.div>
                              <span className={labelClass}>
                                Financial Entry
                              </span>
                            </motion.div>
                          )}
                        </NavLink>
                      </motion.li>
                    )}

                    {showChartOfAccounts && (
                      <motion.li
                        variants={staggerItem}
                        initial="initial"
                        animate="animate"
                      >
                        <NavLink
                          to="/accounting/accounts-ledger"
                          onClick={handleNavigate}
                          aria-label="Accounts Ledger"
                          title="Accounts Ledger"
                          className={({ isActive }) =>
                            getLinkClass(isActive, "nested")
                          }
                        >
                          {({ isActive }) => (
                            <motion.div
                              className="flex items-center gap-2"
                              whileHover={{ x: 4 }}
                              transition={transition}
                            >
                              <motion.div
                                animate={
                                  isActive ? { scale: 1.1 } : { scale: 1 }
                                }
                                transition={transition}
                              >
                                <FaBookOpen className={nestedIconClass} />
                              </motion.div>
                              <span className={labelClass}>
                                Accounts Ledger
                              </span>
                            </motion.div>
                          )}
                        </NavLink>
                      </motion.li>
                    )}

                    {showChartOfAccounts && (
                      <motion.li
                        variants={staggerItem}
                        initial="initial"
                        animate="animate"
                      >
                        <NavLink
                          to="/accounting/trial-balance"
                          onClick={handleNavigate}
                          aria-label="Trial Balance"
                          title="Trial Balance"
                          className={({ isActive }) =>
                            getLinkClass(isActive, "nested")
                          }
                        >
                          {({ isActive }) => (
                            <motion.div
                              className="flex items-center gap-2"
                              whileHover={{ x: 4 }}
                              transition={transition}
                            >
                              <motion.div
                                animate={
                                  isActive ? { scale: 1.1 } : { scale: 1 }
                                }
                                transition={transition}
                              >
                                <FaChartBar className={nestedIconClass} />
                              </motion.div>
                              <span className={labelClass}>
                                Trial Balance
                              </span>
                            </motion.div>
                          )}
                        </NavLink>
                      </motion.li>
                    )}

                    {showChartOfAccounts && (
                      <motion.li
                        variants={staggerItem}
                        initial="initial"
                        animate="animate"
                      >
                        <NavLink
                          to="/accounting/profit-loss"
                          onClick={handleNavigate}
                          aria-label="Profit & Loss"
                          title="Profit & Loss"
                          className={({ isActive }) =>
                            getLinkClass(isActive, "nested")
                          }
                        >
                          {({ isActive }) => (
                            <motion.div
                              className="flex items-center gap-2"
                              whileHover={{ x: 4 }}
                              transition={transition}
                            >
                              <motion.div
                                animate={
                                  isActive ? { scale: 1.1 } : { scale: 1 }
                                }
                                transition={transition}
                              >
                                <FaChartLine className={nestedIconClass} />
                              </motion.div>
                              <span className={labelClass}>
                                Profit & Loss
                              </span>
                            </motion.div>
                          )}
                        </NavLink>
                      </motion.li>
                    )}

                    {showChartOfAccounts && (
                      <motion.li
                        variants={staggerItem}
                        initial="initial"
                        animate="animate"
                      >
                        <NavLink
                          to="/accounting/balance-sheet"
                          onClick={handleNavigate}
                          aria-label="Balance Sheet"
                          title="Balance Sheet"
                          className={({ isActive }) =>
                            getLinkClass(isActive, "nested")
                          }
                        >
                          {({ isActive }) => (
                            <motion.div
                              className="flex items-center gap-2"
                              whileHover={{ x: 4 }}
                              transition={transition}
                            >
                              <motion.div
                                animate={
                                  isActive ? { scale: 1.1 } : { scale: 1 }
                                }
                                transition={transition}
                              >
                                <FaBalanceScale className={nestedIconClass} />
                              </motion.div>
                              <span className={labelClass}>
                                Balance Sheet
                              </span>
                            </motion.div>
                          )}
                        </NavLink>
                      </motion.li>
                    )}

                    {showChartOfAccounts && (
                      <motion.li
                        variants={staggerItem}
                        initial="initial"
                        animate="animate"
                      >
                        <NavLink
                          to="/accounting/received-payment"
                          onClick={handleNavigate}
                          aria-label="Received & Payment"
                          title="Received & Payment"
                          className={({ isActive }) =>
                            getLinkClass(isActive, "nested")
                          }
                        >
                          {({ isActive }) => (
                            <motion.div
                              className="flex items-center gap-2"
                              whileHover={{ x: 4 }}
                              transition={transition}
                            >
                              <motion.div
                                animate={
                                  isActive ? { scale: 1.1 } : { scale: 1 }
                                }
                                transition={transition}
                              >
                                <FaUniversity className={nestedIconClass} />
                              </motion.div>
                              <span className={labelClass}>
                                Received & Payment
                              </span>
                            </motion.div>
                          )}
                        </NavLink>
                      </motion.li>
                    )}

                    {showChartOfAccounts && (
                      <motion.li
                        variants={staggerItem}
                        initial="initial"
                        animate="animate"
                      >
                        <NavLink
                          to="/accounting/report-config"
                          onClick={handleNavigate}
                          aria-label="Report Configuration"
                          title="Report Configuration"
                          className={({ isActive }) =>
                            getLinkClass(isActive, "nested")
                          }
                        >
                          {({ isActive }) => (
                            <motion.div
                              className="flex items-center gap-2"
                              whileHover={{ x: 4 }}
                              transition={transition}
                            >
                              <motion.div
                                animate={
                                  isActive ? { scale: 1.1 } : { scale: 1 }
                                }
                                transition={transition}
                              >
                                <FaCog className={nestedIconClass} />
                              </motion.div>
                              <span className={labelClass}>
                                Report Configuration
                              </span>
                            </motion.div>
                          )}
                        </NavLink>
                      </motion.li>
                    )}
                  </motion.ul>
                )}
              </AnimatePresence>
            </AnimatedLi>
          )}

          {showCompanySettings && (
            <AnimatedLi variants={staggerItem}>
              <AnimatedButton
                type="button"
                onClick={() => toggleMenu("settings")}
                className={getSectionButtonClass(activeMenu === "settings")}
                aria-expanded={activeMenu === "settings"}
                aria-label="Settings"
                title="Settings"
                whileHover={{ x: 4 }}
                whileTap={buttonTap}
                transition={transition}
              >
                <span
                  className={`flex items-center ${isCollapsed ? "flex-col gap-1 text-center" : "gap-3"
                    }`}
                >
                  <motion.div
                    animate={
                      activeMenu === "settings"
                        ? { rotate: [0, -10, 10, 0] }
                        : {}
                    }
                    transition={{ duration: 0.5 }}
                  >
                    <IoSettingsOutline className={iconClass} />
                  </motion.div>
                  <span className={labelClass}>Settings</span>
                </span>
                {!isCollapsed && (
                  <motion.div
                    animate={{
                      rotate: activeMenu === "settings" ? 0 : -90
                    }}
                    transition={transition}
                  >
                    {activeMenu === "settings" ? (
                      <FaAngleDown className="w-4 h-4" />
                    ) : (
                      <FaAngleRight className="w-4 h-4" />
                    )}
                  </motion.div>
                )}
              </AnimatedButton>

              <AnimatePresence>
                {activeMenu === "settings" && (
                  <motion.ul
                    variants={menuSlide}
                    initial="initial"
                    animate="animate"
                    exit="exit"
                    className="mt-1 space-y-1"
                  >
                    <motion.li
                      variants={staggerItem}
                      initial="initial"
                      animate="animate"
                    >
                      <NavLink
                        to="/settings"
                        onClick={handleNavigate}
                        aria-label="Company Settings"
                        title="Company Settings"
                        className={({ isActive }) =>
                          getLinkClass(isActive, "nested")
                        }
                      >
                        {({ isActive }) => (
                          <motion.div
                            className="flex items-center gap-2"
                            whileHover={{ x: 4 }}
                            transition={transition}
                          >
                            <motion.div
                              animate={isActive ? { scale: 1.1 } : { scale: 1 }}
                              transition={transition}
                            >
                              <IoBusinessOutline className={nestedIconClass} />
                            </motion.div>
                            <span className={labelClass}>Company Settings</span>
                          </motion.div>
                        )}
                      </NavLink>
                    </motion.li>
                    <motion.li
                      variants={staggerItem}
                      initial="initial"
                      animate="animate"
                    >
                      <NavLink
                        to="/global-options"
                        onClick={handleNavigate}
                        aria-label="Global Options"
                        title="Global Options"
                        className={({ isActive }) =>
                          getLinkClass(isActive, "nested")
                        }
                      >
                        {({ isActive }) => (
                          <motion.div
                            className="flex items-center gap-2"
                            whileHover={{ x: 4 }}
                            transition={transition}
                          >
                            <motion.div
                              animate={isActive ? { scale: 1.1 } : { scale: 1 }}
                              transition={transition}
                            >
                              <IoSettingsOutline className={nestedIconClass} />
                            </motion.div>
                            <span className={labelClass}>Global Options</span>
                          </motion.div>
                        )}
                      </NavLink>
                    </motion.li>
                    {showPaymentMethods && (
                      <motion.li
                        variants={staggerItem}
                        initial="initial"
                        animate="animate"
                      >
                        <NavLink
                          to="/payment-methods"
                          onClick={handleNavigate}
                          aria-label="Payment Methods"
                          title="Payment Methods"
                          className={({ isActive }) =>
                            getLinkClass(isActive, "nested")
                          }
                        >
                          {({ isActive }) => (
                            <motion.div
                              className="flex items-center gap-2"
                              whileHover={{ x: 4 }}
                              transition={transition}
                            >
                              <motion.div
                                animate={
                                  isActive ? { scale: 1.1 } : { scale: 1 }
                                }
                                transition={transition}
                              >
                                <IoWalletOutline
                                  className={nestedIconClass}
                                />
                              </motion.div>
                              <span className={labelClass}>
                                Payment Methods
                              </span>
                            </motion.div>
                          )}
                        </NavLink>
                      </motion.li>
                    )}
                    <motion.li
                      variants={staggerItem}
                      initial="initial"
                      animate="animate"
                    >
                      <NavLink
                        to="/database/truncate"
                        onClick={handleNavigate}
                        aria-label="Database Truncate"
                        title="Database Truncate"
                        className={({ isActive }) =>
                          getLinkClass(isActive, "nested")
                        }
                      >
                        {({ isActive }) => (
                          <motion.div
                            className="flex items-center gap-2"
                            whileHover={{ x: 4 }}
                            transition={transition}
                          >
                            <motion.div
                              animate={isActive ? { scale: 1.1 } : { scale: 1 }}
                              transition={transition}
                            >
                              <IoServerOutline className={nestedIconClass} />
                            </motion.div>
                            <span className={labelClass}>
                              Database Truncate
                            </span>
                          </motion.div>
                        )}
                      </NavLink>
                    </motion.li>
                    {isAdmin && (
                      <motion.li
                        variants={staggerItem}
                        initial="initial"
                        animate="animate"
                      >
                        <button
                          type="button"
                          onClick={handleAppUpdate}
                          disabled={isUpdating}
                          aria-label="Update App"
                          title="Update App from GitHub (estatelink-testing branch)"
                          className={getLinkClass(false, "nested")}
                        >
                          <motion.div
                            className="flex items-center gap-2"
                            whileHover={{ x: 4 }}
                            transition={transition}
                          >
                            <motion.div
                              animate={
                                isUpdating ? { rotate: 360 } : { scale: 1 }
                              }
                              transition={
                                isUpdating
                                  ? {
                                    duration: 1,
                                    repeat: Infinity,
                                    ease: "linear"
                                  }
                                  : transition
                              }
                            >
                              <IoCloudDownloadOutline
                                className={nestedIconClass}
                              />
                            </motion.div>
                            <span className={labelClass}>
                              {isUpdating ? "Updating..." : "Update App"}
                            </span>
                          </motion.div>
                        </button>
                      </motion.li>
                    )}
                  </motion.ul>
                )}
              </AnimatePresence>
            </AnimatedLi>
          )}

          {updateMessage && (
            <AnimatedLi variants={staggerItem}>
              <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className={`mx-4 mb-2 rounded-lg p-3 text-sm ${updateMessage.type === "success"
                  ? "bg-green-50 text-green-800 border border-green-200"
                  : "bg-red-50 text-red-800 border border-red-200"
                  }`}
              >
                <div className="font-semibold mb-1">{updateMessage.title}</div>
                <ul className="list-disc list-inside space-y-1 text-xs">
                  {updateMessage.messages.map((msg, idx) => (
                    <li key={idx}>{msg}</li>
                  ))}
                </ul>
                {updateMessage.commit && (
                  <div className="mt-2 pt-2 border-t border-current/20 text-xs">
                    <div>
                      Latest commit: {updateMessage.commit.hash.substring(0, 7)}
                    </div>
                    <div className="truncate">
                      {updateMessage.commit.message}
                    </div>
                  </div>
                )}
              </motion.div>
            </AnimatedLi>
          )}

          <AnimatedLi variants={staggerItem}>
            <motion.div
              whileHover={{ x: 4 }}
              whileTap={buttonTap}
              transition={transition}
            >
              <Link
                to="#"
                onClick={handleLogout}
                aria-label="Logout"
                title="Logout"
                className={`flex items-center text-primary transition-colors duration-200 ${isCollapsed
                  ? "flex-col gap-1 px-2 py-3 text-xs rounded-full"
                  : "gap-2 px-6 py-3 text-sm md:text-base rounded-r-full"
                  } hover:bg-primary hover:text-white`}
              >
                <motion.div
                  whileHover={{ rotate: [0, -15, 15, 0] }}
                  transition={{ duration: 0.5 }}
                >
                  <CiLogout className={iconClass} />
                </motion.div>
                <span className={labelClass}>Logout</span>
              </Link>
            </motion.div>
          </AnimatedLi>
        </AnimatedUl>
        {!isCollapsed ? (
          <div className="px-3 sm:px-4 pb-3 sm:pb-4 pt-4">
            <div className="relative mx-auto w-full max-w-[200px] sm:max-w-[210px] rounded-2xl bg-primary/90 px-3 sm:px-4 pb-4 sm:pb-5 pt-8 sm:pt-9 text-center text-white shadow-lg">
              <div className="absolute -top-4 sm:-top-5 left-1/2 flex h-9 w-9 sm:h-10 sm:w-10 -translate-x-1/2 items-center justify-center rounded-full border-4 border-white bg-primary shadow-md">
                <FiHelpCircle className="h-4 w-4 sm:h-5 sm:w-5" />
              </div>
              <h3 className="text-sm sm:text-base font-semibold">
                Help Center
              </h3>
              <p className="mt-1 sm:mt-2 text-[10px] sm:text-xs text-white/85">
                Facing difficulty?
              </p>
              <p className="text-[10px] sm:text-xs text-white/75">
                Please contact our support team.
              </p>
              <a
                href="tel:+8801706401778"
                className="mt-3 sm:mt-4 inline-flex w-full items-center justify-center gap-1.5 sm:gap-2 rounded-full bg-white/95 px-2.5 sm:px-3 py-1.5 sm:py-2 text-primary shadow transition-colors duration-200 hover:bg-white text-xs sm:text-sm"
              >
                <FiPhone className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                <span className="font-semibold tracking-wide">
                  +8801706 401778
                </span>
              </a>
            </div>
          </div>
        ) : (
          <div className="hidden flex-col items-center gap-1.5 sm:gap-2 px-2 pb-3 sm:pb-4 pt-4 lg:flex">
            <a
              href="tel:+8801706401778"
              className="flex h-10 w-10 sm:h-11 sm:w-11 items-center justify-center rounded-full bg-primary text-white shadow-lg transition-transform duration-200 hover:scale-105"
              aria-label="Call helpline"
              title="+8801706 401778"
            >
              <FiPhone className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
            </a>
            <span className="text-[9px] sm:text-[10px] font-medium text-primary/70">
              Helpline
            </span>
          </div>
        )}
      </div>
    </nav>
  );
};

export default Sidebar;

Sidebar.propTypes = {
  onNavigate: PropTypes.func,
  isCollapsed: PropTypes.bool,
  onToggleCollapse: PropTypes.func
};
