export type RootStackParamList = {
  Login: undefined;
  WelcomeBack: undefined;
  PasswordReset: undefined;
  InitialScreen: undefined;
  ForgotPassword: undefined;
  VerifyCode: undefined;
  SetPassword: undefined;
  Dashboard: { noticeId?: number } | undefined;
  ProfileManagement: undefined;
  ProfileManagementSettings: undefined;
  BlockedMembers: undefined;
  EditGeneralInfo: undefined;
  InfoAndSupport: undefined;
  TermsAndPrivacy: undefined;
  AnnouncementNotice: { activeTab?: string; announcementId?: number; bulletinId?: number; noticeId?: number; showPendingBulletins?: boolean } | undefined;
  NoticeBoard: undefined;
  ShowNoticeBoard: { notice?: any; selectedAttachmentIndex?: number; allNotices?: any[]; currentNoticeIndex?: number; returnToScreen?: keyof RootStackParamList; };
  CreateBulletin: undefined;
  EditBulletin: { bulletinId: string };
  PendingBulletin: undefined;
  Archive: { bulletinId?: number } | undefined;
  ReportBulletin: { bulletinId: string };
  NotificationFeed: undefined;
  Info: undefined;
  Services: undefined;
  AllServices: undefined;
  Feed: undefined;
  Activity: undefined;
  ServiceFeePayment: undefined;
  MakePayment: { unit: any; amount: string; selectedPayments: Set<number | string>; selectedPaymentData?: Array<{ month: number; year: number; amount: number }> };
  PaymentGateway: { gatewayUrl: string; transactionId: string; amount: string; unitName: string; invoiceNumber?: string; gateway?: string };
  PaymentHistory: { unit: any };
  ReceiptView: { payment: any; unit: any };
  BillDetail: { payment: any; unit: any };
};

declare global {
  namespace ReactNavigation {
    interface RootParamList extends RootStackParamList { }
  }
}
