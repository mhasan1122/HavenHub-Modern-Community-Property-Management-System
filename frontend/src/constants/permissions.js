export const PERMISSIONS = {
  CREATE_MEMBER: 1,
  EDIT_MEMBER: 2,
  VIEW_MEMBER_LIST: 3,

  CREATE_ROLE: 4,
  EDIT_ROLE: 5,
  VIEW_ROLE_LIST: 6,

  CREATE_GROUP: 7,
  EDIT_GROUP: 8,
  VIEW_GROUP_LIST: 9,

  CREATE_TOWER: 10,
  EDIT_TOWER: 11,
  VIEW_TOWER: 12,

  VIEW_UNIT_DETAILS: 13,
  EDIT_UNIT_DETAILS: 14,

  VIEW_UNIT_OWNERSHIP: 15,
  ADD_OWNERSHIP: 16,
  CHANGE_OWNERSHIP: 17,

  VIEW_UNIT_RESIDENT: 18,
  ADD_RESIDENT: 19,
  EDIT_RESIDENT_INFO: 20,

  VIEW_UNIT_STAFF: 21,
  ADD_UNIT_STAFF: 22,
  EDIT_UNIT_STAFF: 23,

  VIEW_COMMUNITY_MEMBER_LIST: 24,

  ADD_ANNOUNCEMENTS: 25,
  VIEW_ANNOUNCEMENTS: 26,
  EDIT_ANNOUNCEMENTS: 27,

  ADD_BULLETIN_BOARD: 28,
  VIEW_BULLETIN_BOARD: 29,
  EDIT_BULLETIN_BOARD: 30,

  ADD_NOTICE_BOARD: 31,
  VIEW_NOTICE_BOARD: 32,
  EDIT_NOTICE_BOARD: 33,
  VIEW_IMPORTANT_CONTACTS: 34,
  VIEW_SERVICE_FEE_SETTINGS: 35,
  ADD_IMPORTANT_CONTACTS: 36,
  EDIT_IMPORTANT_CONTACTS: 37,
  ADD_SERVICE_FEE_SETTINGS: 38,
  EDIT_SERVICE_FEE_SETTINGS: 39,
  // Granular Service Fee page permissions
  VIEW_SERVICE_FEE_OVERVIEW: 40,
  VIEW_UNIT_PAYMENT_HISTORY: 41,
  RECORD_SERVICE_FEE_PAYMENT: 44,
  GENERATE_SERVICE_FEES: 45,
  MANAGE_SCHEDULE_CONFIGURATION: 42,
  MANAGE_REMINDERS: 43,
  // Additional Announcement permissions
  EXPIRE_ANNOUNCEMENTS: 54,
  PIN_ANNOUNCEMENTS: 55,
  // Additional Bulletin Board permissions
  ARCHIVE_BULLETIN_BOARD: 56,
  APPROVE_REJECT_BULLETIN_BOARD: 57,
  // Additional Notice Board permissions
  EXPIRE_NOTICE_BOARD: 58,
  // Company Settings permissions
  VIEW_COMPANY_SETTINGS: 59,  // Actual DB ID
  // Bill Categories permissions  
  VIEW_BILL_CATEGORIES: 60,   // Actual DB ID
  ADD_BILL_CATEGORIES: 61,    // Actual DB ID
  EDIT_BILL_CATEGORIES: 62,   // Actual DB ID
  // Chart of Accounts permissions
  VIEW_CHART_OF_ACCOUNTS: 63,   // Actual DB ID
  ADD_CHART_OF_ACCOUNTS: 64,    // Actual DB ID
  EDIT_CHART_OF_ACCOUNTS: 65,   // Actual DB ID
  // Service Fee Management permissions
  VIEW_BILLING_MANAGEMENT: 66,  // Actual DB ID
  // Bill Uploads permissions
  BILL_UPLOADS: 69,        // Actual DB ID
  VIEW_UNIT_RECEIVABLES: 70, // Actual DB ID
  VIEW_SERVICE_FEE_PAYMENTS: 71, // Actual DB ID
  VIEW_PAYMENT_METHODS: 72,     // Actual DB ID
  ADD_PAYMENT_METHODS: 73,      // Actual DB ID
  EDIT_PAYMENT_METHODS: 74,     // Actual DB ID
};

export const COMMUNICATION_PERMISSION_NAMES = {
  announcements: [
    "Add Announcements",
    "View Announcements",
    "Edit Announcements",
    "Expire Announcements",
    "Pin Announcements",
  ],
  bulletinBoard: [
    "Add Bulletin Board",
    "View Bulletin Board",
    "Edit Bulletin Board",
    "Archive Bulletin Posts",
    "Approve/Reject Bulletin Posts",
  ],
  noticeBoard: [
    "Add Notice Board",
    "View Notice Board",
    "Edit Notice Board",
    "Expire Notices",
  ],
};

export const PERMISSION_GROUPS = [
  {
    title: "Settings",
    names: [
      "Edit Company Settings",
      "View Payment Methods",
      "Add Payment Methods",
      "Edit Payment Methods",
    ],
    ids: [59, 72, 73, 74],
  },
  {
    title: "Member Management",
    names: [
      "Create Member",
      "Edit Member",
      "View Member List",
      "Create Role",
      "Edit Role",
      "View Role List",
      "Create Group",
      "Edit Group",
      "View Group List",
      "Add Important Contacts",
      "Edit Important Contacts",
      "View Important Contacts",
    ],
    ids: [
      1, // CREATE_MEMBER
      2, // EDIT_MEMBER
      3, // VIEW_MEMBER_LIST
      4, // CREATE_ROLE
      5, // EDIT_ROLE
      6, // VIEW_ROLE_LIST
      7, // CREATE_GROUP
      8, // EDIT_GROUP
      9, // VIEW_GROUP_LIST
      36, // ADD_IMPORTANT_CONTACTS
      37, // EDIT_IMPORTANT_CONTACTS
      34, // VIEW_IMPORTANT_CONTACTS
    ],
  },
  {
    title: "Tower & Unit Management",
    names: [
      "Create Tower",
      "Edit Tower",
      "View Tower",
      "View Unit Details",
      "Edit Unit Details",
      "View Unit Ownership",
      "Add Ownership",
      "Change Ownership",
      "View Unit Resident",
      "Add Resident",
      "Edit Resident Info",
      "View Unit Staff",
      "Add Unit Staff",
      "Edit Unit Staff",
      "View Community Member List",
    ],
    ids: [
      10, // CREATE_TOWER
      11, // EDIT_TOWER
      12, // VIEW_TOWER
      13, // VIEW_UNIT_DETAILS
      14, // EDIT_UNIT_DETAILS
      15, // VIEW_UNIT_OWNERSHIP
      16, // ADD_OWNERSHIP
      17, // CHANGE_OWNERSHIP
      18, // VIEW_UNIT_RESIDENT
      19, // ADD_RESIDENT
      20, // EDIT_RESIDENT_INFO
      21, // VIEW_UNIT_STAFF
      22, // ADD_UNIT_STAFF
      23, // EDIT_UNIT_STAFF
      24, // VIEW_COMMUNITY_MEMBER_LIST
    ],
  },
  {
    title: "Announcements",
    names: COMMUNICATION_PERMISSION_NAMES.announcements,
    ids: [
      25, // ADD_ANNOUNCEMENTS
      26, // VIEW_ANNOUNCEMENTS
      27, // EDIT_ANNOUNCEMENTS
      54, // EXPIRE_ANNOUNCEMENTS
      55, // PIN_ANNOUNCEMENTS
    ],
  },
  {
    title: "Bulletin Board",
    names: COMMUNICATION_PERMISSION_NAMES.bulletinBoard,
    ids: [
      28, // ADD_BULLETIN_BOARD
      29, // VIEW_BULLETIN_BOARD
      30, // EDIT_BULLETIN_BOARD
      56, // ARCHIVE_BULLETIN_BOARD - Actual DB ID
      57, // APPROVE_REJECT_BULLETIN_BOARD - Actual DB ID
    ],
  },
  {
    title: "Notice Board",
    names: COMMUNICATION_PERMISSION_NAMES.noticeBoard,
    ids: [
      31, // ADD_NOTICE_BOARD
      32, // VIEW_NOTICE_BOARD
      33, // EDIT_NOTICE_BOARD
      58, // EXPIRE_NOTICE_BOARD - Actual DB ID
    ],
  },
  {
    title: "Service Fee Management",
    names: [
      // Service Fee Settings permissions
      "View Service Fee Settings",
      "Add Service Fee Settings",
      "Edit Service Fee Settings",
      "Archive Service Fee Settings",
      // Service Fee Overview permissions
      "View Service Fee Overview",
      // Payment permissions
      "Record Service Fee Payment",
      "View Unit Payment History",
      // Bill Categories permissions
      "View Bill Categories",
      "Add Bill Categories",
      "Edit Bill Categories",
      // Billing Management permissions
      "View Billing Management",
      "Add Billing Management",
      "Generate Service Fees",
      "Edit Billing Management",
      // Bill Uploads permissions
      "Bill Uploads",
      "View Unit Receivables",
      "View Service Fee Payments Page",
      "Manage Schedule Configuration",
      "Manage Service Fee Reminders",
    ],
    // Match by IDs to avoid name drift between environments
    ids: [
      35, // VIEW_SERVICE_FEE_SETTINGS
      38, // ADD_SERVICE_FEE_SETTINGS
      39, // EDIT_SERVICE_FEE_SETTINGS
      40, // VIEW_SERVICE_FEE_OVERVIEW
      44, // RECORD_SERVICE_FEE_PAYMENT
      41, // VIEW_UNIT_PAYMENT_HISTORY
      60, // VIEW_BILL_CATEGORIES
      61, // ADD_BILL_CATEGORIES
      62, // EDIT_BILL_CATEGORIES
      66, // VIEW_BILLING_MANAGEMENT
      45, // GENERATE_SERVICE_FEES
      69, // BILL_UPLOADS
      70, // VIEW_UNIT_RECEIVABLES
      71, // VIEW_SERVICE_FEE_PAYMENTS
      42, // MANAGE_SCHEDULE_CONFIGURATION
      43, // MANAGE_REMINDERS
    ],
  },
  {
    title: "Chart of Accounts",
    names: [
      "View Chart of Accounts",
      "Add Chart of Accounts",
      "Edit Chart of Accounts",
    ],
    ids: [
      63, // VIEW_CHART_OF_ACCOUNTS - Actual DB ID
      64, // ADD_CHART_OF_ACCOUNTS - Actual DB ID
      65, // EDIT_CHART_OF_ACCOUNTS - Actual DB ID
    ],
  },
];
