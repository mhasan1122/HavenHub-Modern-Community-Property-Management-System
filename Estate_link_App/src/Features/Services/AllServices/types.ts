import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';

export interface ServiceItem {
  id: string;
  title: string;
  iconName: keyof typeof MaterialCommunityIcons.glyphMap;
  route: string;
  params?: any; // Optional navigation params
  description?: string;
  isComingSoon?: boolean; // If true, shows "Upcoming Feature" modal instead of navigating
}

