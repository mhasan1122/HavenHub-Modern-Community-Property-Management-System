import { createNavigationContainerRef, CommonActions } from '@react-navigation/native';
import type { RootStackParamList } from '../types/navigation';

export const navigationRef = createNavigationContainerRef<RootStackParamList>();

/**
 * Navigate to a screen using the navigation ref
 * This can be called from anywhere in the app, including services
 */
export function navigate(name: keyof RootStackParamList, params?: any) {
  if (navigationRef.isReady()) {
    // For tab screens nested in Dashboard, use nested navigation
    if (name === 'AnnouncementNotice') {
      // Navigate to Dashboard first, then to AnnouncementNotice tab
      navigationRef.dispatch(
        CommonActions.navigate({
          name: 'Dashboard',
          params: {
            screen: 'AnnouncementNotice',
            params: params,
          },
        })
      );
    } else {
      navigationRef.navigate(name as any, params as any);
    }
  } else {
    console.warn('Navigation ref is not ready yet');
    // Retry after a short delay if navigation is not ready
    setTimeout(() => {
      if (navigationRef.isReady()) {
        if (name === 'AnnouncementNotice') {
          navigationRef.dispatch(
            CommonActions.navigate({
              name: 'Dashboard',
              params: {
                screen: 'AnnouncementNotice',
                params: params,
              },
            })
          );
        } else {
          navigationRef.navigate(name as any, params as any);
        }
      }
    }, 100);
  }
}
