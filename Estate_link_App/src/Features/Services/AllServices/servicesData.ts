import type { ServiceItem } from './types';

export const servicesData: ServiceItem[] = [
  {
    id: '1',
    title: 'Announcements',
    iconName: 'bullhorn',
    route: 'AnnouncementNotice',
    description: 'View community announcements',
  },
  // UPCOMING - Commented out
  // {
  //   id: '2',
  //   title: 'Complaints',
  //   iconName: 'message-alert',
  //   route: 'Complaints',
  //   description: 'Submit and track complaints',
  //   isComingSoon: true,
  // },
  {
    id: '3',
    title: 'Bulletin Board',
    iconName: 'clipboard-text',
    route: 'AnnouncementNotice',
    params: { activeTab: 'bulletin' },
    description: 'Community bulletin board',
  },
  // UPCOMING - Commented out
  // {
  //   id: '4',
  //   title: 'Suggestions',
  //   iconName: 'lightbulb-on',
  //   route: 'Suggestions',
  //   description: 'Share your suggestions',
  //   isComingSoon: true,
  // },
  {
    id: '5',
    title: 'Notice Board',
    iconName: 'newspaper-variant',
    route: 'AnnouncementNotice',
    params: { activeTab: 'announcements' },
    description: 'Official notices',
  },
  // UPCOMING - Commented out
  // {
  //   id: '6',
  //   title: 'Surveys',
  //   iconName: 'clipboard-check',
  //   route: 'Surveys',
  //   description: 'Participate in surveys',
  //   isComingSoon: true,
  // },
  // UPCOMING - Commented out
  // {
  //   id: '7',
  //   title: 'Amenities',
  //   iconName: 'home-group',
  //   route: 'Amenities',
  //   description: 'Book amenities',
  //   isComingSoon: true,
  // },
  // UPCOMING - Commented out
  // {
  //   id: '8',
  //   title: 'Event Calendar',
  //   iconName: 'calendar-month',
  //   route: 'EventCalendar',
  //   description: 'View upcoming events',
  //   isComingSoon: true,
  // },
  {
    id: '9',
    title: 'Service Fees',
    iconName: 'cash-multiple',
    route: 'ServiceFeePayment',
    description: 'Manage service fees',
    
  },
  // UPCOMING - Commented out
  // {
  //   id: '10',
  //   title: 'Visitors',
  //   iconName: 'account-group',
  //   route: 'Visitors',
  //   description: 'Manage visitor access',
  //   isComingSoon: true,
  // },
  // UPCOMING - Commented out
  // {
  //   id: '11',
  //   title: 'Maintenance Requests',
  //   iconName: 'wrench',
  //   route: 'MaintenanceRequests',
  //   description: 'Submit maintenance requests',
  //   isComingSoon: true,
  // },
];
