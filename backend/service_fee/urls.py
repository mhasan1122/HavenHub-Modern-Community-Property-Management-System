from django.urls import path
from .views import (
    ServiceFeeListCreateView,
    ServiceFeeDetailView,
    ServiceFeeStatusChangeView,
    ServiceFeeValidationView,
    TowerUnitsView,
    ServiceFeeTowerListView,
    ServiceFeeHistoryView,
    ServiceFeePermanentDeleteView
)

urlpatterns = [
    # Service fee CRUD operations
    path('', ServiceFeeListCreateView.as_view(), name='service-fee-list-create'),
    path('<int:pk>/', ServiceFeeDetailView.as_view(), name='service-fee-detail'),
    path('<int:pk>/status/', ServiceFeeStatusChangeView.as_view(), name='service-fee-status-change'),
    
    # Permanent deletion (only for archived service fees)
    path('<int:pk>/permanent-delete/', ServiceFeePermanentDeleteView.as_view(), name='service-fee-permanent-delete'),
    
    # Validation endpoint
    path('validate/', ServiceFeeValidationView.as_view(), name='service-fee-validate'),
    
    # Helper endpoints
    path('towers/', ServiceFeeTowerListView.as_view(), name='service-fee-towers'),
    path('tower-units/', TowerUnitsView.as_view(), name='tower-units'),
    
    # History endpoint
    path('<int:service_fee_id>/history/', ServiceFeeHistoryView.as_view(), name='service-fee-history'),
]
