// Routes configuration update for UI refinement
import { createBrowserRouter, useLocation } from "react-router-dom";
import { Suspense, lazy, useLayoutEffect } from "react";
import ProtectedRoute from "./ProtectedRoute";
import { PERMISSIONS } from "../constants/permissions";
import ModernLoadingAnimation from "../Components/Loaders/ModernLoadingAnimation";
import ErrorBoundary from "../Components/Error/ErrorBoundary";

// Route-level Error Boundary Wrapper Component
// This wraps each route's element with an ErrorBoundary to catch runtime errors
import PropTypes from "prop-types";

const RouteErrorBoundary = ({ children }) => {
  return (
    <ErrorBoundary>
      {children}
    </ErrorBoundary>
  );
};

RouteErrorBoundary.propTypes = {
  children: PropTypes.node.isRequired,
};



// Simple wrapper component to update the browser tab title per route
// Note: Routes inside Main layout use TitleManager instead
const Page = ({ title, children }) => {
  const location = useLocation();

  // Only set title for routes outside Main layout (e.g., login, forgot password)
  // Main layout routes are handled by TitleManager in Main.jsx
  useLayoutEffect(() => {
    // Check if this is a route outside Main (public routes)
    const isPublicRoute = [
      "/login",
      "/forgotPassword",
      "/verifyCode",
      "/setNewPassword",
      "/logindummy"
    ].includes(location.pathname);

    if (isPublicRoute && title) {
      document.title = `EstateLink - ${title}`;
    }
  }, [title, location.pathname]);

  return children;
};

// Auth Pages - Lazy Loaded
const Login = lazy(() => import("../Authentication/Login/Login"));
const ForgotPassword = lazy(() =>
  import("../Authentication/ForgotPassword/ForgotPassword")
);
const VerifyCode = lazy(() =>
  import("../Authentication/VerifyCode/VerifyCode")
);
const SetNewPassword = lazy(() =>
  import("../Authentication/SetNewPassword/SetNewPassword")
);
const Logindummy = lazy(() => import("../Authentication/Login/Logindummy"));
const About = lazy(() => import("../Authentication/Login/About"));

// Shared - Lazy Loaded
const Dashboard = lazy(() => import("../Layout/Dashboard"));
const MessageBox = lazy(() => import("../Components/MessageBox/MessageBox"));
const NotAuthorized = lazy(() => import("../Features/NotFound/NotAuthorized"));
const NotFound = lazy(() => import("../Features/NotFound/NotFound"));
const Main = lazy(() => import("../Layout/Main"));

// Tower & Unit Features - Lazy Loaded
const AddTower = lazy(() => import("../Features/TowersAndUnits/Towers/pages/AddTower"));
const ViewTowers = lazy(() => import("../Features/TowersAndUnits/Towers/pages/ViewTowers"));
const EditTower = lazy(() => import("../Features/TowersAndUnits/Towers/pages/EditTower"));
const AddOwner = lazy(() => import("../Features/TowersAndUnits/Owner/AddOwner/AddOwner"));
const EditOwner = lazy(() => import("../Features/TowersAndUnits/Owner/EditOwner/EditOwner"));
const ChangeOwner = lazy(() => import("../Features/TowersAndUnits/Owner/ChangeOwner/ChangeOwner"));
const OwnerDetails = lazy(() => import("../Features/TowersAndUnits/Owner/OwnerDetails/OwnerDetails"));
const AddResident = lazy(() => import("../Features/TowersAndUnits/Resident/AddResident/AddResident"));
const AddUnitStaff = lazy(() => import("../Features/TowersAndUnits/UnitStaff/AddUnitStaff/AddUnitStaff"));
const UnitDetails = lazy(() => import("../Features/TowersAndUnits/UnitDetails/pages/UnitDetails"));
const UnitHistory = lazy(() => import("../Features/TowersAndUnits/UnitDetails/pages/UnitHistory"));
const UnitStaffHistory = lazy(() => import("../Features/TowersAndUnits/UnitDetails/pages/UnitStaffHistory"));

// Member & Group Management - Lazy Loaded
const AddMemberPage = lazy(() => import("../pages/AddMemberPage"));
const MemberListPage = lazy(() => import("../pages/MemberListPage"));
const MemberProfilePage = lazy(() =>
  import("../pages/Members/MemberProfilePage")
);
const GeneralInformationEditPage = lazy(() =>
  import("../pages/Members/GeneralInformationEditPage")
);
const MemberTypeAndRoleEditPage = lazy(() =>
  import("../pages/Members/MemberTypeAndRoleEditPage")
);
const GroupsPage = lazy(() => import("../pages/Groups/GroupsPage"));
const GroupProfilePage = lazy(() => import("../pages/Groups/GroupProfilePage"));
const AddGroup = lazy(() => import("../Features/Groups/AddGroup/AddGroup"));

// Role Management - Lazy Loaded
const RoleList = lazy(() => import("../Features/Roles/RoleList/RoleList"));
const AddRole = lazy(() => import("../Features/Roles/AddRole/AddRole"));
const RoleProfile = lazy(() =>
  import("../Features/Roles/RoleProfile/RoleProfile")
);

// Login Credentials - Lazy Loaded
const LoginCredentialEdit = lazy(() =>
  import("../Features/Login/LoginCredential/LoginCredentialEdit")
);

// Misc - Lazy Loaded
const DemoPage = lazy(() => import("../pages/DemoPage"));
const TestErrorPage = lazy(() => import("../pages/TestErrorPage"));


const ResidentDetails = lazy(() =>
  import("../Features/TowersAndUnits/Resident/ResidentDetails/ResidentDetails")
);
const ResidentInfoEdit = lazy(() =>
  import(
    "../Features/TowersAndUnits/Resident/ResidentInfoEdit/ResidentInfoEdit"
  )
);
const UnitEdit = lazy(() =>
  import("../Features/TowersAndUnits/Units/AddUnits/UnitEdit")
);
const UnitGeneralInfoEdit = lazy(() =>
  import("../Features/TowersAndUnits/Units/AddUnits/UnitGeneralInfoEdit")
);
const UnitPrimaryContactEdit = lazy(() =>
  import("../Features/TowersAndUnits/Units/AddUnits/UnitPrimaryContactEdit")
);
const UnitSecondaryContactEdit = lazy(() =>
  import("../Features/TowersAndUnits/Units/AddUnits/UnitSecondaryContactEdit")
);
const CommunityMemberList = lazy(() =>
  import("../Features/Members/CommunityMember/CommunityMemberList")
);
const UnitStaffInformationEdit = lazy(() =>
  import(
    "../Features/Members/MemberEdit/UnitStaffInformationEdit/UnitStaffInformationEdit"
  )
);
const ImportantContactsPage = lazy(() =>
  import("../pages/ImportantContactsPage")
);
const SettingsPage = lazy(() => import("../pages/SettingsPage"));
const GlobalOptionsPage = lazy(() => import("../Features/GlobalOptions/GlobalOptionsPage"));
const DatabaseTruncatePage = lazy(() =>
  import("../pages/DatabaseTruncatePage")
);

// Communication Portal - Lazy Loaded
const AnnouncementList = lazy(() =>
  import(
    "../Features/CommunicationPortal/Announcements/AnnouncementList/AnnouncementList"
  )
);
const CreateAnnouncement = lazy(() =>
  import(
    "../Features/CommunicationPortal/Announcements/AddAnnouncement/AddAnnouncement"
  )
);
const EditAnnouncement = lazy(() =>
  import(
    "../Features/CommunicationPortal/Announcements/EditAnnouncement/EditAnnouncement"
  )
);
const BulletinList = lazy(() =>
  import("../Features/CommunicationPortal/Bulletins/BulletinList/BulletinList")
);
const CreateBulletin = lazy(() =>
  import("../Features/CommunicationPortal/Bulletins/AddBulletin/AddBulletin")
);
const EditBulletin = lazy(() =>
  import("../Features/CommunicationPortal/Bulletins/EditBulletin/EditBulletin")
);
const NoticeList = lazy(() =>
  import("../Features/CommunicationPortal/NoticeBoard/NoticeList/NoticeList")
);
const AddNotice = lazy(() =>
  import("../Features/CommunicationPortal/NoticeBoard/AddNotice/AddNotice")
);
const EditNotice = lazy(() =>
  import("../Features/CommunicationPortal/NoticeBoard/EditNotice/EditNotice")
);

// Vehicles - Lazy Loaded
const UnitVehicles = lazy(() =>
  import("../Features/TowersAndUnits/UnitDetails/components/UnitVehicles")
);
const AddVehicle = lazy(() =>
  import("../Features/TowersAndUnits/Vehicles/AddVehicle")
);
const CommunityVehiclesList = lazy(() =>
  import("../Features/Members/CommunityMember/CommunityVehiclesList")
);

// Service Fee - Lazy Loaded
const ServiceFeeSettingsList = lazy(() => import("../Features/ServiceFeeSettings/ServiceFeeSettings/ServiceFeeList/ServiceFeeSettingsList"));
const ViewServiceFeeSettings = lazy(() => import("../Features/ServiceFeeSettings/ServiceFeeSettings/PreviewServiceFeeSettings/ViewServiceFeeSettings"));
const ServiceFeePaymentsPage = lazy(() => import("../pages/ServiceFeePaymentPage"));
const ServiceFeeScheduleConfigurationPage = lazy(() => import("../pages/ServiceFeeScheduleConfigurationPage"));
const ServiceFeeOverviewPage = lazy(() => import("../pages/ServiceFeeOverviewPage"));
const ServiceFeeReportsPage = lazy(() => import("../pages/ServiceFeeReportsPage"));
const BillingManagementPage = lazy(() => import("../pages/BillingManagementPage"));
const UnitReceivablesPage = lazy(() => import("../pages/UnitReceivablesPage"));
const UnitLedgerPage = lazy(() => import("../pages/UnitLedgerPage"));
const UnitPaymentHistoryPage = lazy(() => import("../pages/UnitPaymentHistoryPage"));
const RemindersPage = lazy(() => import("../pages/RemindersPage"));
const CancelledServiceFeesList = lazy(() => import("../Features/ServiceFeeSettings/ServiceFeeSettings/ServiceFeeList/CancelledServiceFeesList"));
const BillCategoriesPage = lazy(() => import("../Features/ServiceFeeManagement/BillCategories/components/BillCategories"));
const PaymentMethodsPage = lazy(() => import("../Features/ServiceFeeManagement/PaymentMethods/components/PaymentMethods"));
// Bill Uploads (unprotected route)
const BillUploadPage = lazy(() => import("../Features/ServiceFeeManagement/BillUploads/BillUploadPage"));
const ChartOfAccountsPage = lazy(() => import("../Features/ChartOfAccounts/ChartOfAccountsPage"));
const AccountsLedgerPage = lazy(() => import("../Features/AccountsLedger/AccountsLedgerPage"));

const VoucherListPage = lazy(() =>
  import("../Features/Vouchers/VoucherListPage")
);
const FinancialEntryPage = lazy(() =>
  import("../Features/FinancialEntry/FinancialEntryPage")
);
const DefaultAccountHeadConfiguration = lazy(() =>
  import(
    "../Features/GlobalOptions/DefaultAccountHeads/DefaultAccountHeadConfiguration"
  )
);
const TrialBalancePage = lazy(() =>
  import("../Features/TrialBalance/TrialBalancePage")
);
const ReportConfigPage = lazy(() =>
  import("../Features/TrialBalance/TrialBalanceConfig")
);
const ProfitAndLossPage = lazy(() =>
  import("../Features/ProfitAndLoss/ProfitAndLossPage")
);
const BalanceSheetPage = lazy(() =>
  import("../Features/BalanceSheet/BalanceSheetPage")
);
const ReceivedAndPaymentPage = lazy(() =>
  import("../Features/ReceivedAndPayment/ReceivedAndPaymentPage")
);

const {
  CREATE_MEMBER,
  EDIT_MEMBER,
  VIEW_MEMBER_LIST,
  CREATE_ROLE,
  EDIT_ROLE,
  VIEW_ROLE_LIST,
  CREATE_GROUP,
  EDIT_GROUP,
  VIEW_GROUP_LIST,
  CREATE_TOWER,
  EDIT_TOWER,
  VIEW_TOWER,
  VIEW_UNIT_DETAILS,
  EDIT_UNIT_DETAILS,
  VIEW_UNIT_OWNERSHIP,
  ADD_OWNERSHIP,
  CHANGE_OWNERSHIP,
  VIEW_UNIT_RESIDENT,
  ADD_RESIDENT,
  EDIT_RESIDENT_INFO,
  ADD_UNIT_STAFF,
  EDIT_UNIT_STAFF,
  VIEW_COMMUNITY_MEMBER_LIST,
  ADD_ANNOUNCEMENTS,
  VIEW_ANNOUNCEMENTS,
  EDIT_ANNOUNCEMENTS,
  ADD_BULLETIN_BOARD,
  VIEW_BULLETIN_BOARD,
  EDIT_BULLETIN_BOARD,
  ADD_NOTICE_BOARD,
  VIEW_NOTICE_BOARD,
  EDIT_NOTICE_BOARD,
  VIEW_IMPORTANT_CONTACTS,
  VIEW_SERVICE_FEE_SETTINGS,
  VIEW_SERVICE_FEE_OVERVIEW,
  VIEW_UNIT_PAYMENT_HISTORY,
  RECORD_SERVICE_FEE_PAYMENT,
  VIEW_SERVICE_FEE_PAYMENTS,
  VIEW_COMPANY_SETTINGS,
  VIEW_BILL_CATEGORIES,
  VIEW_CHART_OF_ACCOUNTS,
  ADD_CHART_OF_ACCOUNTS,
  VIEW_BILLING_MANAGEMENT,
  GENERATE_SERVICE_FEES,
  MANAGE_SCHEDULE_CONFIGURATION,
  MANAGE_REMINDERS,
  BILL_UPLOADS,
  VIEW_UNIT_RECEIVABLES,
  VIEW_PAYMENT_METHODS,
} = PERMISSIONS;

export const router = createBrowserRouter([
  {
    path: "/",
    element: (
      <RouteErrorBoundary>
        <Suspense fallback={<ModernLoadingAnimation />}>
          <Main />
        </Suspense>
      </RouteErrorBoundary>
    ),
    children: [
      // Default route
      {
        path: "/",
        element: (
          <RouteErrorBoundary>
            <Suspense fallback={<ModernLoadingAnimation />}>
              <Page title="Dashboard">
                <ProtectedRoute>
                  <Dashboard />
                </ProtectedRoute>
              </Page>
            </Suspense>
          </RouteErrorBoundary>
        )
      },

      // Members
      {
        path: "member-list",
        element: (
          <RouteErrorBoundary>
            <Suspense fallback={<ModernLoadingAnimation />}>
              <Page title="Member List">
                <ProtectedRoute requiredPermission={VIEW_MEMBER_LIST}>
                  <MemberListPage />
                </ProtectedRoute>
              </Page>
            </Suspense>
          </RouteErrorBoundary>
        )
      },
      {
        path: "create-member",
        element: (
          <RouteErrorBoundary>
            <Suspense fallback={<ModernLoadingAnimation />}>
              <Page title="Create Member">
                <ProtectedRoute requiredPermission={CREATE_MEMBER}>
                  <AddMemberPage />
                </ProtectedRoute>
              </Page>
            </Suspense>
          </RouteErrorBoundary>
        )
      },
      {
        path: "member-profile/:id",
        element: (
          <RouteErrorBoundary>
            <Suspense fallback={<ModernLoadingAnimation />}>
              <Page title="Member Profile">
                <ProtectedRoute requiredPermission={VIEW_MEMBER_LIST}>
                  <MemberProfilePage />
                </ProtectedRoute>
              </Page>
            </Suspense>
          </RouteErrorBoundary>
        )
      },
      {
        path: "general-information-edit/:id",
        element: (
          <RouteErrorBoundary>
            <Suspense fallback={<ModernLoadingAnimation />}>
              <Page title="Edit Member - General Information">
                <ProtectedRoute requiredPermission={EDIT_MEMBER}>
                  <GeneralInformationEditPage />
                </ProtectedRoute>
              </Page>
            </Suspense>
          </RouteErrorBoundary>
        )
      },
      {
        path: "MemberTypeAndRoleEdit/:id",
        element: (
          <RouteErrorBoundary>
            <Suspense fallback={<ModernLoadingAnimation />}>
              <Page title="Edit Member - Type & Role">
                <ProtectedRoute requiredPermission={EDIT_MEMBER}>
                  <MemberTypeAndRoleEditPage />
                </ProtectedRoute>
              </Page>
            </Suspense>
          </RouteErrorBoundary>
        )
      },
      {
        path: "important-contacts",
        element: (
          <RouteErrorBoundary>
            <Suspense fallback={<ModernLoadingAnimation />}>
              <Page title="Important Contacts">
                <ProtectedRoute requiredPermission={VIEW_IMPORTANT_CONTACTS}>
                  <ImportantContactsPage />
                </ProtectedRoute>
              </Page>
            </Suspense>
          </RouteErrorBoundary>
        )
      },

      // Groups
      {
        path: "group-list",
        element: (
          <RouteErrorBoundary>
            <Suspense fallback={<ModernLoadingAnimation />}>
              <Page title="Group List">
                <ProtectedRoute requiredPermission={VIEW_GROUP_LIST}>
                  <GroupsPage />
                </ProtectedRoute>
              </Page>
            </Suspense>
          </RouteErrorBoundary>
        )
      },
      {
        path: "add-group",
        element: (
          <RouteErrorBoundary>
            <Suspense fallback={<ModernLoadingAnimation />}>
              <Page title="Add Group">
                <ProtectedRoute requiredPermission={CREATE_GROUP}>
                  <AddGroup />
                </ProtectedRoute>
              </Page>
            </Suspense>
          </RouteErrorBoundary>
        )
      },
      {
        path: "edit-group/:id",
        element: (
          <RouteErrorBoundary>
            <Suspense fallback={<ModernLoadingAnimation />}>
              <Page title="Edit Group">
                <ProtectedRoute requiredPermission={EDIT_GROUP}>
                  <AddGroup />
                </ProtectedRoute>
              </Page>
            </Suspense>
          </RouteErrorBoundary>
        )
      },

      {
        path: "groupProfile/:id",
        element: (
          <RouteErrorBoundary>
            <Suspense fallback={<ModernLoadingAnimation />}>
              <Page title="Group Profile">
                <ProtectedRoute requiredPermission={VIEW_GROUP_LIST}>
                  <GroupProfilePage />
                </ProtectedRoute>
              </Page>
            </Suspense>
          </RouteErrorBoundary>
        )
      },

      // Roles
      {
        path: "role-list",
        element: (
          <RouteErrorBoundary>
            <Suspense fallback={<ModernLoadingAnimation />}>
              <Page title="Role List">
                <ProtectedRoute requiredPermission={VIEW_ROLE_LIST}>
                  <RoleList />
                </ProtectedRoute>
              </Page>
            </Suspense>
          </RouteErrorBoundary>
        )
      },
      {
        path: "addRole",
        element: (
          <RouteErrorBoundary>
            <Suspense fallback={<ModernLoadingAnimation />}>
              <Page title="Add Role">
                <ProtectedRoute requiredPermission={CREATE_ROLE}>
                  <AddRole />
                </ProtectedRoute>
              </Page>
            </Suspense>
          </RouteErrorBoundary>
        )
      },
      {
        path: "addRole/:id",
        element: (
          <RouteErrorBoundary>
            <Suspense fallback={<ModernLoadingAnimation />}>
              <Page title="Edit Role">
                <ProtectedRoute requiredPermission={EDIT_ROLE}>
                  <AddRole />
                </ProtectedRoute>
              </Page>
            </Suspense>
          </RouteErrorBoundary>
        )
      },
      {
        path: "roleProfile/:id",
        element: (
          <RouteErrorBoundary>
            <Suspense fallback={<ModernLoadingAnimation />}>
              <Page title="Role Profile">
                <ProtectedRoute requiredPermission={VIEW_ROLE_LIST}>
                  <RoleProfile />
                </ProtectedRoute>
              </Page>
            </Suspense>
          </RouteErrorBoundary>
        )
      },

      // Towers
      {
        path: "ViewTowers",
        element: (
          <RouteErrorBoundary>
            <Suspense fallback={<ModernLoadingAnimation />}>
              <Page title="Towers">
                <ProtectedRoute requiredPermission={VIEW_TOWER}>
                  <ViewTowers />
                </ProtectedRoute>
              </Page>
            </Suspense>
          </RouteErrorBoundary>
        )
      },
      {
        path: "addTower",
        element: (
          <RouteErrorBoundary>
            <Suspense fallback={<ModernLoadingAnimation />}>
              <Page title="Add Tower">
                <ProtectedRoute requiredPermission={CREATE_TOWER}>
                  <AddTower />
                </ProtectedRoute>
              </Page>
            </Suspense>
          </RouteErrorBoundary>
        )
      },
      {
        path: "editTower/:id",
        element: (
          <RouteErrorBoundary>
            <Suspense fallback={<ModernLoadingAnimation />}>
              <Page title="Edit Tower">
                <ProtectedRoute requiredPermission={EDIT_TOWER}>
                  <EditTower />
                </ProtectedRoute>
              </Page>
            </Suspense>
          </RouteErrorBoundary>
        )
      },

      // Units & Details
      {
        path: "add-unit/:id",
        element: (
          <RouteErrorBoundary>
            <Suspense fallback={<ModernLoadingAnimation />}>
              <Page title="Add / Edit Unit">
                <ProtectedRoute requiredPermission={EDIT_UNIT_DETAILS}>
                  <UnitEdit />
                </ProtectedRoute>
              </Page>
            </Suspense>
          </RouteErrorBoundary>
        )
      },
      {
        path: "edit-unit-general/:id",
        element: (
          <RouteErrorBoundary>
            <Suspense fallback={<ModernLoadingAnimation />}>
              <Page title="Edit General Information">
                <ProtectedRoute requiredPermission={EDIT_UNIT_DETAILS}>
                  <UnitGeneralInfoEdit />
                </ProtectedRoute>
              </Page>
            </Suspense>
          </RouteErrorBoundary>
        )
      },
      {
        path: "edit-unit-primary-contact/:id",
        element: (
          <RouteErrorBoundary>
            <Suspense fallback={<ModernLoadingAnimation />}>
              <Page title="Edit Primary Contact">
                <ProtectedRoute requiredPermission={EDIT_UNIT_DETAILS}>
                  <UnitPrimaryContactEdit />
                </ProtectedRoute>
              </Page>
            </Suspense>
          </RouteErrorBoundary>
        )
      },
      {
        path: "edit-unit-secondary-contact/:id",
        element: (
          <RouteErrorBoundary>
            <Suspense fallback={<ModernLoadingAnimation />}>
              <Page title="Edit Secondary Contact">
                <ProtectedRoute requiredPermission={EDIT_UNIT_DETAILS}>
                  <UnitSecondaryContactEdit />
                </ProtectedRoute>
              </Page>
            </Suspense>
          </RouteErrorBoundary>
        )
      },
      {
        path: "unit-details/:id",
        element: (
          <RouteErrorBoundary>
            <Suspense fallback={<ModernLoadingAnimation />}>
              <Page title="Unit Details">
                <ProtectedRoute requiredPermission={VIEW_UNIT_DETAILS}>
                  <UnitDetails />
                </ProtectedRoute>
              </Page>
            </Suspense>
          </RouteErrorBoundary>
        )
      },
      {
        path: "unit-history/:id",
        element: (
          <RouteErrorBoundary>
            <Suspense fallback={<ModernLoadingAnimation />}>
              <Page title="Unit History">
                <ProtectedRoute requiredPermission={VIEW_UNIT_DETAILS}>
                  <UnitHistory />
                </ProtectedRoute>
              </Page>
            </Suspense>
          </RouteErrorBoundary>
        )
      },
      {
        path: "unit-staff-history/:id",
        element: (
          <RouteErrorBoundary>
            <Suspense fallback={<ModernLoadingAnimation />}>
              <Page title="Unit Staff History">
                <ProtectedRoute requiredPermission={VIEW_UNIT_DETAILS}>
                  <UnitStaffHistory />
                </ProtectedRoute>
              </Page>
            </Suspense>
          </RouteErrorBoundary>
        )
      },
      {
        path: "Unit-vehicles/:id",
        element: (
          <RouteErrorBoundary>
            <Suspense fallback={<ModernLoadingAnimation />}>
              <Page title="Unit Vehicles">
                <ProtectedRoute requiredPermission={VIEW_UNIT_DETAILS}>
                  <UnitVehicles />
                </ProtectedRoute>
              </Page>
            </Suspense>
          </RouteErrorBoundary>
        )
      },

      // Unit Owner, Resident, Staff
      {
        path: "unit/:unitId/add-owner",
        element: (
          <RouteErrorBoundary>
            <Suspense fallback={<ModernLoadingAnimation />}>
              <Page title="Add Owner">
                <ProtectedRoute requiredPermission={ADD_OWNERSHIP}>
                  <AddOwner />
                </ProtectedRoute>
              </Page>
            </Suspense>
          </RouteErrorBoundary>
        )
      },
      {
        path: "unit/:unitId/edit-owner/:ownerId",
        element: (
          <RouteErrorBoundary>
            <Suspense fallback={<ModernLoadingAnimation />}>
              <Page title="Edit Owner">
                <ProtectedRoute requiredPermission={CHANGE_OWNERSHIP}>
                  <EditOwner />
                </ProtectedRoute>
              </Page>
            </Suspense>
          </RouteErrorBoundary>
        )
      },
      // Unit Owner, Resident, Staff
      {
        path: "unit/:unitId/change-owner",
        element: (
          <RouteErrorBoundary>
            <Suspense fallback={<ModernLoadingAnimation />}>
              <Page title="Change Owner">
                <ProtectedRoute requiredPermission={CHANGE_OWNERSHIP}>
                  <ChangeOwner />
                </ProtectedRoute>
              </Page>
            </Suspense>
          </RouteErrorBoundary>
        )
      },
      {
        path: "resident_info_edit/:unitId/:residentId",
        element: (
          <RouteErrorBoundary>
            <Suspense fallback={<ModernLoadingAnimation />}>
              <Page title="Edit Resident Info">
                <ProtectedRoute requiredPermission={EDIT_RESIDENT_INFO}>
                  <ResidentInfoEdit />
                </ProtectedRoute>
              </Page>
            </Suspense>
          </RouteErrorBoundary>
        )
      },
      {
        path: "owner-details/:unitId/:ownerId",
        element: (
          <RouteErrorBoundary>
            <Suspense fallback={<ModernLoadingAnimation />}>
              <Page title="Owner Details">
                <ProtectedRoute requiredPermission={VIEW_UNIT_OWNERSHIP}>
                  <OwnerDetails />
                </ProtectedRoute>
              </Page>
            </Suspense>
          </RouteErrorBoundary>
        )
      },
      {
        path: "addResident/:id",
        element: (
          <RouteErrorBoundary>
            <Suspense fallback={<ModernLoadingAnimation />}>
              <Page title="Add Resident">
                <ProtectedRoute requiredPermission={ADD_RESIDENT}>
                  <AddResident />
                </ProtectedRoute>
              </Page>
            </Suspense>
          </RouteErrorBoundary>
        )
      },
      {
        path: "resident-details/:unitId/:residentId",
        element: (
          <RouteErrorBoundary>
            <Suspense fallback={<ModernLoadingAnimation />}>
              <Page title="Resident Details">
                <ProtectedRoute requiredPermission={VIEW_UNIT_RESIDENT}>
                  <ResidentDetails />
                </ProtectedRoute>
              </Page>
            </Suspense>
          </RouteErrorBoundary>
        )
      },
      {
        path: "addUnitStaff/:id",
        element: (
          <RouteErrorBoundary>
            <Suspense fallback={<ModernLoadingAnimation />}>
              <Page title="Add Unit Staff">
                <ProtectedRoute requiredPermission={ADD_UNIT_STAFF}>
                  <AddUnitStaff />
                </ProtectedRoute>
              </Page>
            </Suspense>
          </RouteErrorBoundary>
        )
      },
      {
        path: "add-vehicle/:id",
        element: (
          <RouteErrorBoundary>
            <Suspense fallback={<ModernLoadingAnimation />}>
              <Page title="Add Vehicle">
                <ProtectedRoute requiredPermission={EDIT_UNIT_DETAILS}>
                  <AddVehicle />
                </ProtectedRoute>
              </Page>
            </Suspense>
          </RouteErrorBoundary>
        )
      },
      {
        path: "edit-vehicle/:vehicleId/:brandVehicleId",
        element: (
          <RouteErrorBoundary>
            <Suspense fallback={<ModernLoadingAnimation />}>
              <Page title="Edit Vehicle">
                <ProtectedRoute requiredPermission={EDIT_UNIT_DETAILS}>
                  <AddVehicle />
                </ProtectedRoute>
              </Page>
            </Suspense>
          </RouteErrorBoundary>
        )
      },
      // Login Credentials
      {
        path: "login-credential-edit/:id",
        element: (
          <RouteErrorBoundary>
            <Suspense fallback={<ModernLoadingAnimation />}>
              <Page title="Edit Login Credential">
                <ProtectedRoute requiredPermission={EDIT_MEMBER}>
                  <LoginCredentialEdit />
                </ProtectedRoute>
              </Page>
            </Suspense>
          </RouteErrorBoundary>
        )
      },

      // Misc Pages
      {
        path: "demoPage",
        element: (
          <RouteErrorBoundary>
            <Suspense fallback={<ModernLoadingAnimation />}>
              <Page title="Demo">
                <DemoPage />
              </Page>
            </Suspense>
          </RouteErrorBoundary>
        )
      },
      {
        path: "test-error",
        element: (
          <ErrorBoundary>
            <Suspense fallback={<ModernLoadingAnimation />}>
              <Page title="Test Error">
                <TestErrorPage />
              </Page>
            </Suspense>
          </ErrorBoundary>
        )
      },

      {
        path: "announcements",
        element: (
          <RouteErrorBoundary>
            <Suspense fallback={<ModernLoadingAnimation />}>
              <Page title="Announcements">
                <ProtectedRoute requiredPermission={VIEW_ANNOUNCEMENTS}>
                  <AnnouncementList />
                </ProtectedRoute>
              </Page>
            </Suspense>
          </RouteErrorBoundary>
        )
      },
      {
        path: "create-announcement",
        element: (
          <RouteErrorBoundary>
            <Suspense fallback={<ModernLoadingAnimation />}>
              <Page title="Create Announcement">
                <ProtectedRoute requiredPermission={ADD_ANNOUNCEMENTS}>
                  <CreateAnnouncement />
                </ProtectedRoute>
              </Page>
            </Suspense>
          </RouteErrorBoundary>
        )
      },
      {
        path: "edit-announcement/:id",
        element: (
          <RouteErrorBoundary>
            <Suspense fallback={<ModernLoadingAnimation />}>
              <Page title="Edit Announcement">
                <ProtectedRoute requiredPermission={EDIT_ANNOUNCEMENTS}>
                  <EditAnnouncement />
                </ProtectedRoute>
              </Page>
            </Suspense>
          </RouteErrorBoundary>
        )
      },

      // Bulletin routes
      {
        path: "bulletins",
        element: (
          <RouteErrorBoundary>
            <Suspense fallback={<ModernLoadingAnimation />}>
              <Page title="Bulletins">
                <ProtectedRoute requiredPermission={VIEW_BULLETIN_BOARD}>
                  <BulletinList />
                </ProtectedRoute>
              </Page>
            </Suspense>
          </RouteErrorBoundary>
        )
      },
      {
        path: "create-bulletin",
        element: (
          <RouteErrorBoundary>
            <Suspense fallback={<ModernLoadingAnimation />}>
              <Page title="Create Bulletin">
                <ProtectedRoute requiredPermission={ADD_BULLETIN_BOARD}>
                  <CreateBulletin />
                </ProtectedRoute>
              </Page>
            </Suspense>
          </RouteErrorBoundary>
        )
      },
      {
        path: "edit-bulletin/:id",
        element: (
          <RouteErrorBoundary>
            <Suspense fallback={<ModernLoadingAnimation />}>
              <Page title="Edit Bulletin">
                <ProtectedRoute requiredPermission={EDIT_BULLETIN_BOARD}>
                  <EditBulletin />
                </ProtectedRoute>
              </Page>
            </Suspense>
          </RouteErrorBoundary>
        )
      },

      // Notice Board routes
      {
        path: "notice-board",
        element: (
          <RouteErrorBoundary>
            <Suspense fallback={<ModernLoadingAnimation />}>
              <Page title="Notice Board">
                <ProtectedRoute requiredPermission={VIEW_NOTICE_BOARD}>
                  <NoticeList />
                </ProtectedRoute>
              </Page>
            </Suspense>
          </RouteErrorBoundary>
        )
      },
      {
        path: "notice-board/add",
        element: (
          <RouteErrorBoundary>
            <Suspense fallback={<ModernLoadingAnimation />}>
              <Page title="Add Notice">
                <ProtectedRoute requiredPermission={ADD_NOTICE_BOARD}>
                  <AddNotice />
                </ProtectedRoute>
              </Page>
            </Suspense>
          </RouteErrorBoundary>
        )
      },
      {
        path: "notice-board/edit/:id",
        element: (
          <RouteErrorBoundary>
            <Suspense fallback={<ModernLoadingAnimation />}>
              <Page title="Edit Notice">
                <ProtectedRoute requiredPermission={EDIT_NOTICE_BOARD}>
                  <EditNotice />
                </ProtectedRoute>
              </Page>
            </Suspense>
          </RouteErrorBoundary>
        )
      },
      {
        path: "about",
        element: (
          <RouteErrorBoundary>
            <Suspense fallback={<ModernLoadingAnimation />}>
              <Page title="About">
                <About />
              </Page>
            </Suspense>
          </RouteErrorBoundary>
        )
      },
      {
        path: "/community-member-list",
        element: (
          <RouteErrorBoundary>
            <Suspense fallback={<ModernLoadingAnimation />}>
              <Page title="Community Members">
                <ProtectedRoute requiredPermission={VIEW_COMMUNITY_MEMBER_LIST}>
                  <CommunityMemberList />
                </ProtectedRoute>
              </Page>
            </Suspense>
          </RouteErrorBoundary>
        )
      },
      {
        path: "/community-Vehicle-list",
        element: (
          <RouteErrorBoundary>
            <Suspense fallback={<ModernLoadingAnimation />}>
              <Page title="Community Vehicles">
                <ProtectedRoute requiredPermission={VIEW_COMMUNITY_MEMBER_LIST}>
                  <CommunityVehiclesList />
                </ProtectedRoute>
              </Page>
            </Suspense>
          </RouteErrorBoundary>
        )
      },
      {
        path: "unit-staff-edit/:staffid/:staffstatus",
        element: (
          <RouteErrorBoundary>
            <Suspense fallback={<ModernLoadingAnimation />}>
              <Page title="Edit Unit Staff">
                <ProtectedRoute requiredPermission={EDIT_UNIT_STAFF}>
                  <UnitStaffInformationEdit />
                </ProtectedRoute>
              </Page>
            </Suspense>
          </RouteErrorBoundary>
        )
      },
      // ============================================
      // SERVICE FEE MANAGEMENT
      // ============================================
      // Service Fee Settings
      {
        path: "service-fee-settings",
        element: (
          <RouteErrorBoundary>
            <Suspense fallback={<ModernLoadingAnimation />}>
              <Page title="Service Fee Settings">
                <ProtectedRoute requiredPermission={VIEW_SERVICE_FEE_SETTINGS}>
                  <ServiceFeeSettingsList />
                </ProtectedRoute>
              </Page>
            </Suspense>
          </RouteErrorBoundary>
        )
      },
      {
        path: "service-fee-settings/cancelled",
        element: (
          <RouteErrorBoundary>
            <Suspense fallback={<ModernLoadingAnimation />}>
              <Page title="Archive List">
                <ProtectedRoute requiredPermission={VIEW_SERVICE_FEE_SETTINGS}>
                  <CancelledServiceFeesList />
                </ProtectedRoute>
              </Page>
            </Suspense>
          </RouteErrorBoundary>
        )
      },
      {
        path: "service-fee-settings/:id",
        element: (
          <RouteErrorBoundary>
            <Suspense fallback={<ModernLoadingAnimation />}>
              <Page title="View Service Fee Settings">
                <ProtectedRoute requiredPermission={VIEW_SERVICE_FEE_SETTINGS}>
                  <ViewServiceFeeSettings />
                </ProtectedRoute>
              </Page>
            </Suspense>
          </RouteErrorBoundary>
        )
      },

      // Service Fee Payments & Operations
      {
        path: "service-fee-list",
        element: (
          <RouteErrorBoundary>
            <Suspense fallback={<ModernLoadingAnimation />}>
              <Page title="Service Fees Payments">
                <ProtectedRoute requiredPermission={[VIEW_SERVICE_FEE_PAYMENTS, VIEW_UNIT_PAYMENT_HISTORY]}>
                  <ServiceFeePaymentsPage />
                </ProtectedRoute>
              </Page>
            </Suspense>
          </RouteErrorBoundary>
        )
      },
      {
        path: "unit-payment-history",
        element: (
          <RouteErrorBoundary>
            <Suspense fallback={<ModernLoadingAnimation />}>
              <Page title="Unit Payment History">
                <ProtectedRoute requiredPermission={VIEW_UNIT_PAYMENT_HISTORY}>
                  <UnitPaymentHistoryPage />
                </ProtectedRoute>
              </Page>
            </Suspense>
          </RouteErrorBoundary>
        )
      },
      {
        path: "unit-payment-history/:unitId",
        element: (
          <RouteErrorBoundary>
            <Suspense fallback={<ModernLoadingAnimation />}>
              <Page title="Unit Payment History">
                <ProtectedRoute requiredPermission={VIEW_UNIT_PAYMENT_HISTORY}>
                  <UnitPaymentHistoryPage />
                </ProtectedRoute>
              </Page>
            </Suspense>
          </RouteErrorBoundary>
        )
      },
      {
        path: "unit-receivables",
        element: (
          <RouteErrorBoundary>
            <Suspense fallback={<ModernLoadingAnimation />}>
              <Page title="Unit Receivables">
                <ProtectedRoute requiredPermission={VIEW_UNIT_RECEIVABLES}>
                  <UnitReceivablesPage />
                </ProtectedRoute>
              </Page>
            </Suspense>
          </RouteErrorBoundary>
        )
      },
      {
        path: "unit-ledger/:unitId",
        element: (
          <RouteErrorBoundary>
            <Suspense fallback={<ModernLoadingAnimation />}>
              <Page title="Unit Ledger">
                <ProtectedRoute requiredPermission={VIEW_UNIT_RECEIVABLES}>
                  <UnitLedgerPage />
                </ProtectedRoute>
              </Page>
            </Suspense>
          </RouteErrorBoundary>
        )
      },

      // Service Fee Overview & Reports
      {
        path: "service-fee-overview",
        element: (
          <RouteErrorBoundary>
            <Suspense fallback={<ModernLoadingAnimation />}>
              <Page title="Service Fee Overview">
                <ProtectedRoute requiredPermission={VIEW_SERVICE_FEE_OVERVIEW}>
                  <ServiceFeeOverviewPage />
                </ProtectedRoute>
              </Page>
            </Suspense>
          </RouteErrorBoundary>
        )
      },
      {
        path: "billing-management",
        element: (
          <RouteErrorBoundary>
            <Suspense fallback={<ModernLoadingAnimation />}>
              <Page title="Billing Management">
                <ProtectedRoute requiredPermission={[VIEW_BILLING_MANAGEMENT, GENERATE_SERVICE_FEES]}>
                  <BillingManagementPage />
                </ProtectedRoute>
              </Page>
            </Suspense>
          </RouteErrorBoundary>
        )
      },

      {
        path: "service-fee-reports",
        element: (
          <RouteErrorBoundary>
            <Suspense fallback={<ModernLoadingAnimation />}>
              <Page title="Service Fee Reports">
                <ProtectedRoute requiredPermission={VIEW_SERVICE_FEE_OVERVIEW}>
                  <ServiceFeeReportsPage />
                </ProtectedRoute>
              </Page>
            </Suspense>
          </RouteErrorBoundary>
        )
      },

      // Service Fee Configuration & Reminders
      {
        path: "service-fee-schedule-configuration",
        element: (
          <RouteErrorBoundary>
            <Suspense fallback={<ModernLoadingAnimation />}>
              <Page title="Service Fee Schedule Configuration">
                <ProtectedRoute requiredPermission={MANAGE_SCHEDULE_CONFIGURATION}>
                  <ServiceFeeScheduleConfigurationPage />
                </ProtectedRoute>
              </Page>
            </Suspense>
          </RouteErrorBoundary>
        )
      },
      {
        path: "service-fee-reminders",
        element: (
          <RouteErrorBoundary>
            <Suspense fallback={<ModernLoadingAnimation />}>
              <Page title="Send Reminder">
                <ProtectedRoute requiredPermission={MANAGE_REMINDERS}>
                  <RemindersPage />
                </ProtectedRoute>
              </Page>
            </Suspense>
          </RouteErrorBoundary>
        )
      },
      // Service Fee Bill Uploads (protected route)
      {
        path: "service-fee-bill-uploads",
        element: (
          <RouteErrorBoundary>
            <Suspense fallback={<ModernLoadingAnimation />}>
              <Page title="Bill Uploads">
                <ProtectedRoute requiredPermission={BILL_UPLOADS}>
                  <BillUploadPage />
                </ProtectedRoute>
              </Page>
            </Suspense>
          </RouteErrorBoundary>
        )
      },
      {
        path: "bill-categories",
        element: (
          <RouteErrorBoundary>
            <Suspense fallback={<ModernLoadingAnimation />}>
              <Page title="Bill Categories">
                <ProtectedRoute requiredPermission={VIEW_BILL_CATEGORIES}>
                  <BillCategoriesPage />
                </ProtectedRoute>
              </Page>
            </Suspense>
          </RouteErrorBoundary>
        )
      },
      {
        path: "payment-methods",
        element: (
          <RouteErrorBoundary>
            <Suspense fallback={<ModernLoadingAnimation />}>
              <Page title="Payment Methods">
                <ProtectedRoute requiredPermission={VIEW_PAYMENT_METHODS}>
                  <PaymentMethodsPage />
                </ProtectedRoute>
              </Page>
            </Suspense>
          </RouteErrorBoundary>
        )
      },
      {
        path: "chart-of-accounts",
        element: (
          <RouteErrorBoundary>
            <Suspense fallback={<ModernLoadingAnimation />}>
              <Page title="Chart of Accounts">
                <ProtectedRoute requiredPermission={VIEW_CHART_OF_ACCOUNTS}>
                  <ChartOfAccountsPage />
                </ProtectedRoute>
              </Page>
            </Suspense>
          </RouteErrorBoundary>
        )
      },

      {
        path: "accounting/financial-entry",
        element: (
          <RouteErrorBoundary>
            <Suspense fallback={<ModernLoadingAnimation />}>
              <Page title="Financial Entry">
                <ProtectedRoute requiredPermission={ADD_CHART_OF_ACCOUNTS}>
                  <FinancialEntryPage />
                </ProtectedRoute>
              </Page>
            </Suspense>
          </RouteErrorBoundary>
        )
      },
      {
        path: "accounting/voucher-list",
        element: (
          <RouteErrorBoundary>
            <Suspense fallback={<ModernLoadingAnimation />}>
              <Page title="Voucher List">
                <ProtectedRoute requiredPermission={VIEW_CHART_OF_ACCOUNTS}>
                  <VoucherListPage />
                </ProtectedRoute>
              </Page>
            </Suspense>
          </RouteErrorBoundary>
        )
      },
      {
        path: "accounting/trial-balance",
        element: (
          <RouteErrorBoundary>
            <Suspense fallback={<ModernLoadingAnimation />}>
              <Page title="Trial Balance">
                <ProtectedRoute requiredPermission={VIEW_CHART_OF_ACCOUNTS}>
                  <TrialBalancePage />
                </ProtectedRoute>
              </Page>
            </Suspense>
          </RouteErrorBoundary>
        )
      },
      {
        path: "accounting/profit-loss",
        element: (
          <RouteErrorBoundary>
            <Suspense fallback={<ModernLoadingAnimation />}>
              <Page title="Profit & Loss">
                <ProtectedRoute requiredPermission={VIEW_CHART_OF_ACCOUNTS}>
                  <ProfitAndLossPage />
                </ProtectedRoute>
              </Page>
            </Suspense>
          </RouteErrorBoundary>
        )
      },
      {
        path: "accounting/balance-sheet",
        element: (
          <RouteErrorBoundary>
            <Suspense fallback={<ModernLoadingAnimation />}>
              <Page title="Balance Sheet">
                <ProtectedRoute requiredPermission={VIEW_CHART_OF_ACCOUNTS}>
                  <BalanceSheetPage />
                </ProtectedRoute>
              </Page>
            </Suspense>
          </RouteErrorBoundary>
        )
      },
      {
        path: "accounting/received-payment",
        element: (
          <RouteErrorBoundary>
            <Suspense fallback={<ModernLoadingAnimation />}>
              <Page title="Received & Payment">
                <ProtectedRoute requiredPermission={VIEW_CHART_OF_ACCOUNTS}>
                  <ReceivedAndPaymentPage />
                </ProtectedRoute>
              </Page>
            </Suspense>
          </RouteErrorBoundary>
        )
      },
      {
        path: "accounting/report-config",
        element: (
          <RouteErrorBoundary>
            <Suspense fallback={<ModernLoadingAnimation />}>
              <Page title="Report Configuration">
                <ProtectedRoute requiredPermission={VIEW_CHART_OF_ACCOUNTS}>
                  <ReportConfigPage />
                </ProtectedRoute>
              </Page>
            </Suspense>
          </RouteErrorBoundary>
        )
      },
      {
        path: "accounting/accounts-ledger",
        element: (
          <RouteErrorBoundary>
            <Suspense fallback={<ModernLoadingAnimation />}>
              <Page title="Accounts Ledger">
                <ProtectedRoute requiredPermission={VIEW_CHART_OF_ACCOUNTS}>
                  <AccountsLedgerPage />
                </ProtectedRoute>
              </Page>
            </Suspense>
          </RouteErrorBoundary>
        )
      },
      {
        path: "settings",
        element: (
          <RouteErrorBoundary>
            <Suspense fallback={<ModernLoadingAnimation />}>
              <Page title="Settings">
                <ProtectedRoute requiredPermission={VIEW_COMPANY_SETTINGS}>
                  <SettingsPage />
                </ProtectedRoute>
              </Page>
            </Suspense>
          </RouteErrorBoundary>
        )
      },

      {
        path: "global-options",
        element: (
          <RouteErrorBoundary>
            <Suspense fallback={<ModernLoadingAnimation />}>
              <Page title="Global Options">
                <ProtectedRoute>
                  <GlobalOptionsPage />
                </ProtectedRoute>
              </Page>
            </Suspense>
          </RouteErrorBoundary>
        )
      },
      {
        path: "default-account-heads",
        element: (
          <RouteErrorBoundary>
            <Suspense fallback={<ModernLoadingAnimation />}>
              <Page title="Default Account Heads">
                <ProtectedRoute requiredPermission={VIEW_CHART_OF_ACCOUNTS}>
                  <DefaultAccountHeadConfiguration />
                </ProtectedRoute>
              </Page>
            </Suspense>
          </RouteErrorBoundary>
        )
      },

      {
        path: "database/truncate",
        element: (
          <RouteErrorBoundary>
            <Suspense fallback={<ModernLoadingAnimation />}>
              <Page title="Database Truncate">
                <ProtectedRoute>
                  <DatabaseTruncatePage />
                </ProtectedRoute>
              </Page>
            </Suspense>
          </RouteErrorBoundary>
        )
      }
    ]
  },

  // Public/Unprotected Routes
  {
    path: "/login",
    element: (
      <RouteErrorBoundary>
        <Suspense fallback={<ModernLoadingAnimation />}>
          <Page title="Login">
            <Login />
          </Page>
        </Suspense>
      </RouteErrorBoundary>
    )
  },

  {
    path: "forgotPassword",
    element: (
      <RouteErrorBoundary>
        <Suspense fallback={<ModernLoadingAnimation />}>
          <Page title="Forgot Password">
            <ForgotPassword />
          </Page>
        </Suspense>
      </RouteErrorBoundary>
    )
  },
  // {
  //   path: "excelUploader",
  //   element: <ExcelUploader />
  // },
  {
    path: "verifyCode",
    element: (
      <RouteErrorBoundary>
        <Suspense fallback={<ModernLoadingAnimation />}>
          <Page title="Verify Code">
            <VerifyCode />
          </Page>
        </Suspense>
      </RouteErrorBoundary>
    )
  },
  {
    path: "setNewPassword",
    element: (
      <RouteErrorBoundary>
        <Suspense fallback={<ModernLoadingAnimation />}>
          <Page title="Set New Password">
            <SetNewPassword />
          </Page>
        </Suspense>
      </RouteErrorBoundary>
    )
  },

  {
    path: "logindummy",
    element: (
      <RouteErrorBoundary>
        <Suspense fallback={<ModernLoadingAnimation />}>
          <Page title="Login (Dummy)">
            <Logindummy />
          </Page>
        </Suspense>
      </RouteErrorBoundary>
    )
  },
  {
    path: "messageBox",
    element: (
      <RouteErrorBoundary>
        <Suspense fallback={<ModernLoadingAnimation />}>
          <Page title="Message Box">
            <MessageBox />
          </Page>
        </Suspense>
      </RouteErrorBoundary>
    )
  },
  {
    path: "not-authorized",
    element: (
      <RouteErrorBoundary>
        <Suspense fallback={<ModernLoadingAnimation />}>
          <Page title="Not Authorized">
            <NotAuthorized />
          </Page>
        </Suspense>
      </RouteErrorBoundary>
    )
  },
  {
    path: "*",
    element: (
      <RouteErrorBoundary>
        <Suspense fallback={<ModernLoadingAnimation />}>
          <Page title="Page Not Found">
            <NotFound />
          </Page>
        </Suspense>
      </RouteErrorBoundary>
    )
  }
]);
