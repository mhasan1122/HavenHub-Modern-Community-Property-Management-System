import { useEffect, useRef } from 'react';
import { useSelector } from 'react-redux';
import type { RootState } from '../store';
import { pushNotificationService } from '../services/pushNotificationService';

/**
 * Monitor auth status and sync with push notification service.
 * - On login (or re-login): registers the device push token with the backend.
 * - On logout: clears the badge count.
 * This component must be inside the Redux Provider.
 */
export const AuthMonitor = () => {
    const isAuthenticated = useSelector((state: RootState) => state.auth.isAuthenticated);
    const accessToken = useSelector((state: RootState) => state.auth.accessToken);

    // Track the last access token we successfully registered a push token for.
    // This ensures we re-register on every new login session (new token = new session).
    const registeredForToken = useRef<string | null>(null);

    // Effect 1: Register push token whenever we have a fresh authenticated session.
    // Triggers when accessToken changes (new login) while isAuthenticated is true.
    useEffect(() => {
        if (!isAuthenticated || !accessToken) return;

        // Skip if we already registered for this exact access token
        if (registeredForToken.current === accessToken) return;

        console.log('📱 New authenticated session detected — registering push token with backend...');
        registeredForToken.current = accessToken;

        pushNotificationService
            .registerForPushNotifications()
            .then(token => {
                if (token) {
                    return pushNotificationService.registerDeviceToken(token, accessToken);
                }
            })
            .catch(err => console.warn('⚠️ Failed to register push token on login:', err));
    }, [isAuthenticated, accessToken]);

    // Effect 2: Handle logout — clear badge and reset registration tracker.
    useEffect(() => {
        if (isAuthenticated) {
            // Update badge count when authenticated
            pushNotificationService.updateBadgeCount(accessToken ?? undefined).catch(err =>
                console.warn('Failed to update badge count:', err)
            );
        } else {
            // Clear badge on logout and reset so next login re-registers
            registeredForToken.current = null;
            pushNotificationService.setBadgeCount(0).catch(err =>
                console.warn('Failed to clear badge count:', err)
            );
        }

        pushNotificationService.setLoginStatus(isAuthenticated);
        console.log(`🔐 Auth status: ${isAuthenticated ? 'LOGGED IN' : 'LOGGED OUT'}`);
    }, [isAuthenticated]);

    return null; // This component doesn't render anything
};
