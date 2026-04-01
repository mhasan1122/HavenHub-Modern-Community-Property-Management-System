from django.urls import path
from .views import (
    ServiceFeePaymentListCreateView,
    ServiceFeePaymentDetailView,
    ServiceFeeResidentListView,
    ServiceFeeUnitReceivablesView,
    BillingDetailedListView,
    ServiceFeePaymentDetailsView,
    ServiceFeeUnpaidPeriodsView,
    ServiceFeeMultiMonthPaymentView,
    get_payment_choices,
    get_filter_options,
    PenaltyWaiverDetailView,
    # Billing views (normalized model)
    ServiceFeeBillingListCreateView,
    ServiceFeeBillingDetailView,
    # Reminder views
    ReminderListView,
    ReminderDetailView,
    ReminderCreateView,
    ReminderSendView,
    ReminderLogsView,
    ProcessScheduledRemindersView,
    ReminderTestView,
    # Payment completion view
    CompletePendingPaymentView,
    # # SSLCommerz payment views - COMMENTED OUT (replaced with PayStation)
    # SSLCommerzPaymentInitView,
    # SSLCommerzPaymentSuccessView,
    # SSLCommerzPaymentFailView,
    # SSLCommerzPaymentCancelView,
    # SSLCommerzPaymentManualCancelView,
    # SSLCommerzPaymentIPNView,
    # SSLCommerzCallbackTestView,
    # Generate service fee view
    GenerateServiceFeeView,
    GenerateMissingMonthsView,
    service_fee_unit_counts,
    service_fee_payment_by_period,
    DeleteGeneratedServiceFeeView,
    # Service fee generation schedule views
    ServiceFeeGenerationScheduleListCreateView,
    ServiceFeeGenerationScheduleDetailView,
    # Payment history view
    PaymentHistoryView,
    # Mobile views
    MobileAccessCheckView,
    MobileUpcomingBillingView,
    # Bill Upload views
    BillUploadServiceFeeListView,
    BillUploadServiceFeeItemsView,
    BillUploadListCreateView,
    BillUploadDetailView,
    BillUploadCSVParserView,
    PreviousReadingFetchView,
    UnitLedgerView,
    UnitOutstandingSummaryView,
    PaymentMethodListCreateView,
    PaymentMethodDetailView
)
# Import PayStation views
from .paystation_views import (
    PayStationPaymentInitView,
    PayStationPaymentSuccessView,
    PayStationPaymentFailView,
    PayStationPaymentCancelView,
    PayStationPaymentIPNView,
    PayStationStatusCheckView,
)
from .search_views import (
    TowerSearchAPIView,
    UnitSearchAPIView,
    ResidentSearchAPIView,
    UnitFilterListAPIView
)
from .views import ServiceFeeOptionsView
from .views import TowerListOptimizedView

urlpatterns = [
    # Mobile access check endpoint (mobile-only, not for web)
    path('mobile/check-access/', MobileAccessCheckView.as_view(), name='mobile-access-check'),
    
    # Mobile upcoming billing endpoint - fetch next month's billing data
    path('mobile/upcoming-billing/', MobileUpcomingBillingView.as_view(), name='mobile-upcoming-billing'),
    
    # Main residents endpoint with tower, unit, and service fee data
    path('residents/', ServiceFeeResidentListView.as_view(), name='service-fee-resident-list'),
    path('unit-receivables/', ServiceFeeUnitReceivablesView.as_view(), name='service-fee-unit-receivables'),
    path('billing-detailed/', BillingDetailedListView.as_view(), name='billing-detailed-list'),
    path('payment-details/', ServiceFeePaymentDetailsView.as_view(), name='service-fee-payment-details'),
    path('unpaid-periods/', ServiceFeeUnpaidPeriodsView.as_view(), name='service-fee-unpaid-periods'),
    path('multi-month-payment/', ServiceFeeMultiMonthPaymentView.as_view(), name='service-fee-multi-month-payment'),
    path('generate-service-fee/', GenerateServiceFeeView.as_view(), name='generate-service-fee'),
    path('generate-missing-months/', GenerateMissingMonthsView.as_view(), name='generate-missing-months'),
    path('delete-generated-fee/', DeleteGeneratedServiceFeeView.as_view(), name='delete-generated-fee'),
    
    # Billing operations (normalized model)
    path('billings/', ServiceFeeBillingListCreateView.as_view(), name='service-fee-billing-list-create'),
    path('billings/<int:billing_id>/', ServiceFeeBillingDetailView.as_view(), name='service-fee-billing-detail'),
    path('penalty-waivers/<int:pk>/', PenaltyWaiverDetailView.as_view(), name='penalty-waiver-detail'),
    
    # Payment operations (create, update, delete specific payments)
    path('payments/', ServiceFeePaymentListCreateView.as_view(), name='service-fee-payment-create'),
    path('payments/<int:payment_id>/', ServiceFeePaymentDetailView.as_view(), name='service-fee-payment-detail'),
    path('payments/complete-pending/', CompletePendingPaymentView.as_view(), name='complete-pending-payment'),
    
    # Payment history endpoint
    path('payment-history/', PaymentHistoryView.as_view(), name='payment-history'),
    
    # Unit Ledger endpoint
    path('unit-ledger/', UnitLedgerView.as_view(), name='unit-ledger'),
    
    # Unit Outstanding Summary endpoint
    path('outstanding-summary/', UnitOutstandingSummaryView.as_view(), name='unit-outstanding-summary'),
    
    # Choice/Filter endpoints
    path('payment-choices/', get_payment_choices, name='payment-choices'),
    path('filter-options/', get_filter_options, name='filter-options'),
    path('filter-options-units/', UnitFilterListAPIView.as_view(), name='filter-options-units'),
    path('service-fee-options/', ServiceFeeOptionsView.as_view(), name='service-fee-options'),
    # Aggregated service-fee unit counts per tower
    path('service-fee-unit-counts/', service_fee_unit_counts, name='service-fee-unit-counts'),
    # Service fee payment by period (month/year and service_fee_id)
    path('service-fee-payment-by-period/', service_fee_payment_by_period, name='service-fee-payment-by-period'),

    # Payment Methods CRUD
    path('payment-methods/', PaymentMethodListCreateView.as_view(), name='payment-method-list-create'),
    path('payment-methods/<int:pk>/', PaymentMethodDetailView.as_view(), name='payment-method-detail'),

    # Optimized tower + units arrays (duplicated here to avoid changing towers app)
    path('towers/tower_list/', TowerListOptimizedView.as_view(), name='sfm-tower-list'),
    
    # Reminder endpoints
    path('reminders/', ReminderListView.as_view(), name='reminder-list'),
    path('reminders/create/', ReminderCreateView.as_view(), name='reminder-create'),
    path('reminders/<int:pk>/', ReminderDetailView.as_view(), name='reminder-detail'),
    path('reminders/<int:pk>/send/', ReminderSendView.as_view(), name='reminder-send'),
    path('reminders/<int:pk>/logs/', ReminderLogsView.as_view(), name='reminder-logs-specific'),
    path('reminder-logs/', ReminderLogsView.as_view(), name='reminder-logs-all'),
    path('process-scheduled-reminders/', ProcessScheduledRemindersView.as_view(), name='process-scheduled-reminders'),
    
    # Reminder test endpoint
    path('reminders/test/', ReminderTestView.as_view(), name='reminder-test'),
    
    # Search endpoints for reminders
    path('api/towers/', TowerSearchAPIView.as_view(), name='tower-search'),
    path('api/units/', UnitSearchAPIView.as_view(), name='unit-search'),
    path('api/residents/', ResidentSearchAPIView.as_view(), name='resident-search'),
    
    # # SSLCommerz payment gateway endpoints - COMMENTED OUT (replaced with PayStation)
    # path('payments/sslcommerz/init/', SSLCommerzPaymentInitView.as_view(), name='sslcommerz-init'),
    # path('payments/sslcommerz/success/', SSLCommerzPaymentSuccessView.as_view(), name='sslcommerz-success'),
    # path('payments/sslcommerz/fail/', SSLCommerzPaymentFailView.as_view(), name='sslcommerz-fail'),
    # path('payments/sslcommerz/cancel/', SSLCommerzPaymentCancelView.as_view(), name='sslcommerz-cancel'),
    # path('payments/sslcommerz/manual-cancel/', SSLCommerzPaymentManualCancelView.as_view(), name='sslcommerz-manual-cancel'),
    # path('payments/sslcommerz/ipn/', SSLCommerzPaymentIPNView.as_view(), name='sslcommerz-ipn'),
    # path('payments/sslcommerz/test/', SSLCommerzCallbackTestView.as_view(), name='sslcommerz-test'),
    
    # PayStation payment gateway endpoints
    path('payments/paystation/init/', PayStationPaymentInitView.as_view(), name='paystation-init'),
    path('payments/paystation/success/', PayStationPaymentSuccessView.as_view(), name='paystation-success'),
    path('payments/paystation/fail/', PayStationPaymentFailView.as_view(), name='paystation-fail'),
    path('payments/paystation/cancel/', PayStationPaymentCancelView.as_view(), name='paystation-cancel'),
    path('payments/paystation/ipn/', PayStationPaymentIPNView.as_view(), name='paystation-ipn'),
    path('payments/paystation/status/', PayStationStatusCheckView.as_view(), name='paystation-status'),
    
    # Service fee generation schedule endpoints
    path('generation-schedules/', ServiceFeeGenerationScheduleListCreateView.as_view(), name='service-fee-generation-schedule-list-create'),
    path('generation-schedules/<int:pk>/', ServiceFeeGenerationScheduleDetailView.as_view(), name='service-fee-generation-schedule-detail'),
    
    # path('generation-schedules/scheduler-status/', ServiceFeeGenerationSchedulerStatusView.as_view(), name='service-fee-generation-scheduler-status'),
    
    # Bill Upload endpoints
    path('bill-uploads/service-fees/', BillUploadServiceFeeListView.as_view(), name='bill-upload-service-fees'),
    path('bill-uploads/service-fee-items/', BillUploadServiceFeeItemsView.as_view(), name='bill-upload-service-fee-items'),
    path('bill-uploads/', BillUploadListCreateView.as_view(), name='bill-upload-list-create'),
    path('bill-uploads/<int:upload_id>/', BillUploadDetailView.as_view(), name='bill-upload-detail'),
    path('bill-uploads/csv-parser/', BillUploadCSVParserView.as_view(), name='bill-upload-csv-parser'),
    path('bill-uploads/previous-reading/', PreviousReadingFetchView.as_view(), name='bill-upload-previous-reading'),

]