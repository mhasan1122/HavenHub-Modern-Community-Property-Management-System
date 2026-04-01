from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import (
    AccountViewSet, 
    VoucherEntryViewSet, 
    VoucherTypeViewSet, 
    DefaultAccountHeadViewSet,
    ReportSectionViewSet,
    AccountLedgerView,
    UnitLedgerView,
    ConsolidatedLedgerView,
    TrialBalanceView,
    ProfitLossView,
    BalanceSheetView,
    ReceivedAndPaymentView
)

router = DefaultRouter()
router.register(r'accounts', AccountViewSet, basename='accounts')
router.register(r'voucher-types', VoucherTypeViewSet, basename='voucher-types')
router.register(r'voucher-entries', VoucherEntryViewSet, basename='voucher-entries')
router.register(r'default-account-heads', DefaultAccountHeadViewSet, basename='default-account-heads')
router.register(r'report-sections', ReportSectionViewSet, basename='report-sections')

urlpatterns = [
    path('', include(router.urls)),
    path('ledger/<int:account_id>/', AccountLedgerView.as_view(), name='account-ledger'),
    path('ledger/unit/<int:unit_id>/', UnitLedgerView.as_view(), name='unit-ledger'),
    path('ledger/consolidated/<int:parent_account_id>/', ConsolidatedLedgerView.as_view(), name='consolidated-ledger'),
    path('trial-balance/', TrialBalanceView.as_view(), name='trial-balance'),
    path('profit-loss/', ProfitLossView.as_view(), name='profit-loss'),
    path('balance-sheet/', BalanceSheetView.as_view(), name='balance-sheet'),
    path('received-payment/', ReceivedAndPaymentView.as_view(), name='received-payment'),
]
