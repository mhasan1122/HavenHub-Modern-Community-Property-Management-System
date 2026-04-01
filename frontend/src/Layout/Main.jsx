import { Outlet, useLocation } from "react-router-dom";
import { useCallback, useMemo, useState, useEffect, useLayoutEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import Sidebar from "../pages/Dashboard/SideBar";
import Header from "../pages/Dashboard/Header";

// Route to title mapping with patterns for dynamic routes
const routeTitles = [
  // Exact matches
  { pattern: /^\/$/, title: 'Dashboard' },
  { pattern: /^\/member-list$/, title: 'Organization Members' },
  { pattern: /^\/create-member$/, title: 'Create Member' },
  { pattern: /^\/important-contacts$/, title: 'Important Contacts' },
  { pattern: /^\/group-list$/, title: 'Group List' },
  { pattern: /^\/add-group$/, title: 'Add Group' },
  { pattern: /^\/role-list$/, title: 'Role List' },
  { pattern: /^\/addRole$/, title: 'Add Role' },
  { pattern: /^\/ViewTowers$/, title: 'Tower Management' },
  { pattern: /^\/addTower$/, title: 'Add Tower' },
  { pattern: /^\/announcements$/, title: 'Announcements' },
  { pattern: /^\/create-announcement$/, title: 'Create Announcement' },
  { pattern: /^\/bulletins$/, title: 'Bulletin Board' },
  { pattern: /^\/create-bulletin$/, title: 'Create Bulletin' },
  { pattern: /^\/notice-board$/, title: 'Notice Board' },
  { pattern: /^\/notice-board\/add$/, title: 'Add Notice' },
  { pattern: /^\/service-fee-settings$/, title: 'Service Fee Settings' },
  { pattern: /^\/service-fee-settings\/cancelled$/, title: 'Archive List' },
  { pattern: /^\/service-fee-list$/, title: 'Service Fees Payments' },
  { pattern: /^\/unit-payment-history$/, title: 'Unit Payment History' },
  { pattern: /^\/unit-receivables$/, title: 'Unit Receivables' },
  { pattern: /^\/service-fee-overview$/, title: 'Service Fee Overview' },
  { pattern: /^\/billing-management$/, title: 'Billing Management' },
  { pattern: /^\/service-fee-reports$/, title: 'Service Fee Reports' },
  { pattern: /^\/service-fee-schedule-configuration$/, title: 'Service Fee Schedule Configuration' },
  { pattern: /^\/service-fee-reminders$/, title: 'Send Reminder' },
  { pattern: /^\/service-fee-bill-uploads$/, title: 'Bill Uploads' },
  { pattern: /^\/bill-categories$/, title: 'Bill Categories' },
  { pattern: /^\/payment-methods$/, title: 'Payment Methods' },
  { pattern: /^\/chart-of-accounts$/, title: 'Chart of Accounts' },
  { pattern: /^\/accounting\/voucher-list$/, title: 'Voucher List' },
  { pattern: /^\/accounting\/financial-entry$/, title: 'Financial Entry' },
  { pattern: /^\/accounting\/trial-balance$/, title: 'Trial Balance' },
  { pattern: /^\/accounting\/profit-loss$/, title: 'Profit & Loss' },
  { pattern: /^\/accounting\/balance-sheet$/, title: 'Balance Sheet' },
  { pattern: /^\/accounting\/received-payment$/, title: 'Received & Payment' },
  { pattern: /^\/accounting\/report-config$/, title: 'Report Configuration' },
  { pattern: /^\/accounting\/accounts-ledger$/, title: 'Accounts Ledger' },
  { pattern: /^\/accounting\/journal-entries$/, title: 'Journal Entries' },
  { pattern: /^\/accounting\/journal-entries\/new$/, title: 'New Journal Entry' },
  { pattern: /^\/accounting\/journal-entries\/[^/]+\/edit$/, title: 'Edit Journal Entry' },
  { pattern: /^\/accounting\/journal-entries\/[^/]+$/, title: 'View Journal Entry' },
  { pattern: /^\/settings$/, title: 'Settings' },
  { pattern: /^\/community-member-list$/, title: 'Community Members' },
  { pattern: /^\/community-Vehicle-list$/, title: 'Community Vehicles' },
  { pattern: /^\/about$/, title: 'About' },
  { pattern: /^\/demoPage$/, title: 'Demo' },
  { pattern: /^\/test-error$/, title: 'Test Error' },
  { pattern: /^\/global-options$/, title: 'Global Options' },
  { pattern: /^\/default-account-heads$/, title: 'Default Account Heads' },
  { pattern: /^\/database\/truncate$/, title: 'Database Truncate' },
  { pattern: /^\/messageBox$/, title: 'Message Box' },
  { pattern: /^\/not-authorized$/, title: 'Not Authorized' },
  { pattern: /^\/login$/, title: 'Login' },
  { pattern: /^\/forgotPassword$/, title: 'Forgot Password' },
  { pattern: /^\/verifyCode$/, title: 'Verify Code' },
  { pattern: /^\/setNewPassword$/, title: 'Set New Password' },
  { pattern: /^\/logindummy$/, title: 'Login (Dummy)' },

  // Dynamic routes with parameters
  { pattern: /^\/member-profile\/[^/]+$/, title: 'Member Profile' },
  { pattern: /^\/general-information-edit\/[^/]+$/, title: 'Edit Member - General Information' },
  { pattern: /^\/MemberTypeAndRoleEdit\/[^/]+$/, title: 'Edit Member - Type & Role' },
  { pattern: /^\/edit-group\/[^/]+$/, title: 'Edit Group' },
  { pattern: /^\/groupProfile\/[^/]+$/, title: 'Group Profile' },
  { pattern: /^\/addRole\/[^/]+$/, title: 'Edit Role' },
  { pattern: /^\/roleProfile\/[^/]+$/, title: 'Role Profile' },
  { pattern: /^\/editTower\/[^/]+$/, title: 'Edit Tower' },
  { pattern: /^\/add-unit\/[^/]+$/, title: 'Add / Edit Unit' },
  { pattern: /^\/edit-unit-general\/[^/]+$/, title: 'Edit Unit - General' },
  { pattern: /^\/edit-unit-primary-contact\/[^/]+$/, title: 'Edit Unit - Primary Contact' },
  { pattern: /^\/edit-unit-secondary-contact\/[^/]+$/, title: 'Edit Unit - Secondary Contact' },
  { pattern: /^\/unit-details\/[^/]+$/, title: 'Unit Details' },
  { pattern: /^\/unit-history\/[^/]+$/, title: 'Unit History' },
  { pattern: /^\/unit-staff-history\/[^/]+$/, title: 'Unit Staff History' },
  { pattern: /^\/Unit-vehicles\/[^/]+$/, title: 'Unit Vehicles' },
  { pattern: /^\/unit\/[^/]+\/add-owner$/, title: 'Add Owner' },
  { pattern: /^\/unit\/[^/]+\/edit-owner\/[^/]+$/, title: 'Edit Owner' },
  { pattern: /^\/unit\/[^/]+\/change-owner$/, title: 'Change Owner' },
  { pattern: /^\/resident_info_edit\/[^/]+\/[^/]+$/, title: 'Edit Resident Info' },
  { pattern: /^\/owner-details\/[^/]+\/[^/]+$/, title: 'Owner Details' },
  { pattern: /^\/addResident\/[^/]+$/, title: 'Add Resident' },
  { pattern: /^\/resident-details\/[^/]+\/[^/]+$/, title: 'Resident Details' },
  { pattern: /^\/addUnitStaff\/[^/]+$/, title: 'Add Unit Staff' },
  { pattern: /^\/add-vehicle\/[^/]+$/, title: 'Add Vehicle' },
  { pattern: /^\/edit-vehicle\/[^/]+\/[^/]+$/, title: 'Edit Vehicle' },
  { pattern: /^\/login-credential-edit\/[^/]+$/, title: 'Edit Login Credential' },
  { pattern: /^\/edit-announcement\/[^/]+$/, title: 'Edit Announcement' },
  { pattern: /^\/edit-bulletin\/[^/]+$/, title: 'Edit Bulletin' },
  { pattern: /^\/notice-board\/edit\/[^/]+$/, title: 'Edit Notice' },
  { pattern: /^\/service-fee-settings\/[^/]+$/, title: 'View Service Fee Settings' },
  { pattern: /^\/unit-payment-history\/[^/]+$/, title: 'Unit Payment History' },
  { pattern: /^\/unit-ledger\/[^/]+$/, title: 'Unit Ledger' },
  { pattern: /^\/unit-staff-edit\/[^\/]+\/[^\/]+$/, title: 'Edit Unit Staff' },
];

// Helper function to get title from route path
const getTitleFromPath = (pathname) => {
  // Check all patterns in order
  for (const { pattern, title } of routeTitles) {
    if (pattern.test(pathname)) {
      return title;
    }
  }

  // Default fallback
  return 'Dashboard';
};

// Title Manager Component
const TitleManager = () => {
  const location = useLocation();

  useLayoutEffect(() => {
    const title = getTitleFromPath(location.pathname);
    document.title = title ? `EstateLink - ${title}` : 'EstateLink';
  }, [location.pathname]);

  return null;
};

const HEADER_HEIGHT = 64; // Update this if the header height changes

const Main = () => {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);

  // Prevent body scroll when Main layout is active
  useEffect(() => {
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = '';
    };
  }, []);

  // Close sidebar on mobile when clicking outside
  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth >= 1024 && isSidebarOpen) {
        setIsSidebarOpen(false);
      }
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [isSidebarOpen]);

  const toggleSidebar = useCallback(() => {
    setIsSidebarOpen((prev) => !prev);
  }, []);

  const closeSidebar = useCallback(() => {
    if (typeof window !== "undefined" && window.innerWidth >= 1024) {
      return;
    }
    setIsSidebarOpen(false);
  }, []);

  const toggleSidebarCollapse = useCallback(() => {
    setIsSidebarCollapsed((prev) => !prev);
  }, []);

  const sidebarWidthClass = useMemo(
    () =>
      isSidebarCollapsed ? "lg:w-16 xl:w-20" : "lg:w-[18rem] xl:w-[20rem]",
    [isSidebarCollapsed]
  );

  return (
    <div className="h-dvh w-full bg-stroke flex flex-col overflow-hidden print:overflow-visible print:h-auto print:block">
      <style>{`
        @media print {
          body, html {
            overflow: visible !important;
            height: auto !important;
            min-height: auto !important;
            display: block !important;
          }
        }
      `}</style>
      <TitleManager />
      {/* Fixed Header */}
      <div
        className="flex-shrink-0 z-50 sticky top-0 print:hidden"
        style={{ height: `${HEADER_HEIGHT}px`, minHeight: `${HEADER_HEIGHT}px` }}
      >
        <Header toggleSidebar={toggleSidebar} isSidebarOpen={isSidebarOpen} />
      </div>

      {/* Body container */}
      <div className="flex flex-1 w-full overflow-hidden min-h-0 print:block print:h-auto print:overflow-visible" style={{ height: `calc(100% - ${HEADER_HEIGHT}px)` }}>
        {/* Sidebar */}
        <aside
          id="sidebar-navigation"
          className={`fixed left-0 right-auto z-40 w-[280px] sm:w-[18rem] max-w-[85vw] transform border-r border-gray-200 bg-white shadow-xl lg:shadow-sm transition-transform duration-300 ease-out lg:transition-[width] lg:duration-300 lg:ease-[cubic-bezier(0.4,0,0.2,1)] print:hidden ${isSidebarOpen ? "translate-x-0" : "-translate-x-full"
            } lg:static lg:translate-x-0 lg:flex-shrink-0 ${sidebarWidthClass}`}
          style={{
            top: `${HEADER_HEIGHT}px`,
            height: `calc(100vh - ${HEADER_HEIGHT}px)`,
            maxHeight: `calc(100vh - ${HEADER_HEIGHT}px)`
          }}
        >
          <Sidebar
            onNavigate={closeSidebar}
            isCollapsed={isSidebarCollapsed}
            onToggleCollapse={toggleSidebarCollapse}
          />
        </aside>

        {/* Backdrop for mobile */}
        <AnimatePresence>
          {isSidebarOpen && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.3 }}
              className="fixed inset-0 z-30 bg-black/40 backdrop-blur-md lg:hidden"
              onClick={toggleSidebar}
              role="presentation"
              style={{ top: `${HEADER_HEIGHT}px` }}
            />
          )}
        </AnimatePresence>

        {/* Main content area */}
        <main className="flex-1 w-full bg-stroke px-3 pt-0 pb-4 sm:px-4 sm:py-6 lg:px-6 overflow-y-auto overflow-x-hidden min-h-0 print:block print:overflow-visible print:px-0 print:py-0">
          <Outlet />
        </main>
      </div>
    </div>
  );
};

export default Main;
