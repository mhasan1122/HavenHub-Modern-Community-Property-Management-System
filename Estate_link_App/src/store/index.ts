import { configureStore } from '@reduxjs/toolkit';
import { persistStore, persistReducer } from 'redux-persist';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { combineReducers } from '@reduxjs/toolkit';
import authReducer from './slices/authSlice';
import forgotPasswordReducer from './slices/forgotPasswordSlice';
import announcementReducer from './slices/announcementSlice';
import noticeReducer from './slices/noticeSlice';
import bulletinReducer from './slices/bulletinSlice';
import profileReducer from './slices/profileSlice';
import serviceFeeReducer from './slices/serviceFeeSlice';
import contactReducer from './slices/contactSlice';
import companySettingsReducer from './slices/companySettingsSlice';

// Persist configuration
const persistConfig = {
  key: 'root',
  storage: AsyncStorage,
  whitelist: ['auth', 'companySettings'], // Persist auth and company settings
};

// Combine reducers
const rootReducer = combineReducers({
  auth: authReducer,
  forgotPassword: forgotPasswordReducer,
  announcements: announcementReducer,
  notices: noticeReducer,
  bulletins: bulletinReducer,
  profile: profileReducer,
  serviceFee: serviceFeeReducer,
  contacts: contactReducer,
  companySettings: companySettingsReducer,
});

// Create persisted reducer
const persistedReducer = persistReducer(persistConfig, rootReducer);

export const store = configureStore({
  reducer: persistedReducer,
  middleware: (getDefaultMiddleware) =>
    getDefaultMiddleware({
      serializableCheck: {
        ignoredActions: [
          'persist/PERSIST',
          'persist/REHYDRATE',
          'persist/PAUSE',
          'persist/PURGE',
          'persist/REGISTER',
          'persist/FLUSH',
          'auth/setLoading', 
          'auth/setError',
          'announcements/fetchAnnouncements/fulfilled',
          'notices/fetchNotices/fulfilled',
          'bulletins/fetchBulletins/fulfilled',
          'bulletins/createNewBulletin/fulfilled',
          'bulletins/updateExistingBulletin/fulfilled',
          'profile/fetchProfile/fulfilled',
          'profile/fetchMemberDetails/fulfilled',
          'profile/updateProfile/fulfilled',
          'serviceFee/checkServiceFeeAccess/fulfilled',
          'serviceFee/fetchUnits/fulfilled',
          'serviceFee/fetchPayments/fulfilled',
          'serviceFee/createPayment/fulfilled',
          'serviceFee/updatePayment/fulfilled',
          'contacts/fetchContacts/fulfilled',
          'contacts/fetchContactById/fulfilled',
          'contacts/createContact/fulfilled',
          'contacts/updateContact/fulfilled',
          'companySettings/fetchCompanySettings/fulfilled',
        ],
        ignoredPaths: ['register'],
      },
    }),
});

export const persistor = persistStore(store);

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch; 