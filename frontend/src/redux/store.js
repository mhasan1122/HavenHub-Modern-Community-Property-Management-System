import { configureStore } from '@reduxjs/toolkit';
import authReducer from './slices/authSlice/authSlice';
import aboutReducer from './slices/aboutSlice';
import forgotPasswordReducer from './slices/forgotPasswordSlice/forgotPasswordSlice';
import memberReducer from './slices/memberSlice';
import roleReducer from './slices/roles/rolesSlice';
import groupReducer from './slices/groups/groupSlice';
import towerReducer from './slices/towers/towerSlice';
import ownerReducer from './slices/owner/ownerSlice';
import residentReducer from './slices/residents/residentSlice';
import unitReducer from './slices/units/unitSlice';
import companyReducer from './slices/companySlice';
import unitStaffReducer from "./slices/unitStaff/unitStaffSlice";
import commMemberReducer from "./slices/commMember/commMemberSlice";
import announcementReducer from "./slices/announcements/announcementSlice";
import bulletinReducer from "./slices/bulletins/bulletinSlice";
import noticeReducer from "./slices/notices/noticeSlice";
import vehicleReducer from "./slices/vehicle/vehicleSlice";
import serviceFeeReducer from "./slices/serviceFee/serviceFeeSlice";
import serviceFeeManagementReducer from "./slices/serviceFeeManagement/serviceFeeManagementSlice";
import paymentReducer from "./slices/payments/paymentSlice";
import contactsReducer from "./slices/contacts/contactSlice";
import companySettingsReducer from "./slices/companySettingsSlice/companySettingsSlice";
import notificationReducer from "./slices/notifications/notificationSlice";
import chartOfAccountsReducer from "./slices/chartOfAccounts/chartOfAccountsSlice";
import errorResetMiddleware from "./middleware/errorResetMiddleware";
const store = configureStore({
  reducer: {
    auth: authReducer,
    about: aboutReducer,
    forgotPassword: forgotPasswordReducer,
    member: memberReducer,
    role: roleReducer,
    group: groupReducer,
    tower: towerReducer,
    owner: ownerReducer,
    resident: residentReducer,
    unit: unitReducer,
    company: companyReducer,
    unitStaff: unitStaffReducer,
    commMember: commMemberReducer,
    announcements: announcementReducer,
    bulletins: bulletinReducer,
    notices: noticeReducer,
    vehicle: vehicleReducer,
    serviceFees: serviceFeeReducer,
    serviceFeeManagement: serviceFeeManagementReducer,
    payments: paymentReducer,
    contacts: contactsReducer,
    companySettings: companySettingsReducer,
    notifications: notificationReducer,
    chartOfAccounts: chartOfAccountsReducer,


  },
  middleware: (getDefaultMiddleware) =>
    getDefaultMiddleware({
      serializableCheck: false,
    }).concat(errorResetMiddleware),
});

export default store;
