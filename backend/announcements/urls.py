from django.urls import path
from .views import (
    AnnouncementListCreateView,
    AnnouncementDetailView,
    AnnouncementByStatusView,
    AnnouncementTogglePinView,
    AnnouncementIncrementViewsView,
    AnnouncementForceExpireView,
    AnnouncementRestoreView,
    AnnouncementUpdateStatusesView,
    AnnouncementAttachmentListCreateView,
    AnnouncementAttachmentDetailView,
    TowerListView,
    UnitListView,
    BulkUserCountView,
    AnnouncementLabelsView
)

urlpatterns = [
    # Announcement endpoints
    path('announcements/', AnnouncementListCreateView.as_view(), name='announcement-list-create'),
    path('announcements/<int:pk>/', AnnouncementDetailView.as_view(), name='announcement-detail'),
    path('announcements/by_status/', AnnouncementByStatusView.as_view(), name='announcement-by-status'),
    path('announcements/<int:pk>/toggle_pin/', AnnouncementTogglePinView.as_view(), name='announcement-toggle-pin'),
    path('announcements/<int:pk>/increment_views/', AnnouncementIncrementViewsView.as_view(), name='announcement-increment-views'),
    path('announcements/<int:pk>/force_expire/', AnnouncementForceExpireView.as_view(), name='announcement-force-expire'),
    path('announcements/<int:pk>/restore/', AnnouncementRestoreView.as_view(), name='announcement-restore'),
    path('announcements/update_statuses/', AnnouncementUpdateStatusesView.as_view(), name='announcement-update-statuses'),
    path('announcements/labels/', AnnouncementLabelsView.as_view(), name='announcement-labels'),

    # Attachment endpoints
    path('attachments/', AnnouncementAttachmentListCreateView.as_view(), name='attachment-list-create'),
    path('attachments/<int:pk>/', AnnouncementAttachmentDetailView.as_view(), name='attachment-detail'),

    # Additional API endpoints
    path('towers/', TowerListView.as_view(), name='tower-list'),
    path('units/', UnitListView.as_view(), name='unit-list'),
    path('bulk-user-count/', BulkUserCountView.as_view(), name='bulk-user-count'),
]
