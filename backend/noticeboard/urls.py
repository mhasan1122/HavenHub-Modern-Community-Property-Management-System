from django.urls import path
from .views import (
    NoticeListCreateView,
    NoticeDetailView,
    NoticeByStatusView,
    NoticeTogglePinView,
    NoticeIncrementViewsView,
    NoticeForceExpireView,
    NoticeRestoreView,
    NoticeUpdateStatusesView,
    NoticeAttachmentListCreateView,
    NoticeAttachmentDetailView,
    TowerListView,
    UnitListView,
    BulkUserCountView,
    NoticeLabelsView
)

urlpatterns = [
    # Notice endpoints
    path('notices/', NoticeListCreateView.as_view(), name='notice-list-create'),
    path('notices/<int:pk>/', NoticeDetailView.as_view(), name='notice-detail'),
    path('notices/by_status/', NoticeByStatusView.as_view(), name='notice-by-status'),
    path('notices/<int:pk>/toggle_pin/', NoticeTogglePinView.as_view(), name='notice-toggle-pin'),
    path('notices/<int:pk>/increment_views/', NoticeIncrementViewsView.as_view(), name='notice-increment-views'),
    path('notices/<int:pk>/force_expire/', NoticeForceExpireView.as_view(), name='notice-force-expire'),
    path('notices/<int:pk>/restore/', NoticeRestoreView.as_view(), name='notice-restore'),
    path('notices/update_statuses/', NoticeUpdateStatusesView.as_view(), name='notice-update-statuses'),
    
    # Notice attachment endpoints
    path('notice-attachments/', NoticeAttachmentListCreateView.as_view(), name='notice-attachment-list-create'),
    path('notice-attachments/<int:pk>/', NoticeAttachmentDetailView.as_view(), name='notice-attachment-detail'),
    
    # Utility endpoints (shared with announcements)
    path('towers/', TowerListView.as_view(), name='tower-list'),
    path('units/', UnitListView.as_view(), name='unit-list'),
    path('bulk-user-count/', BulkUserCountView.as_view(), name='bulk-user-count'),
    path('notice-labels/', NoticeLabelsView.as_view(), name='notice-labels'),
]
