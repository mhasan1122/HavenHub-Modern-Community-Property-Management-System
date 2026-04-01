from django.urls import path
from .views import (
    BulletinListCreateView,
    BulletinDetailView,
    BulletinByStatusView,
    BulletinTogglePinView,
    BulletinIncrementViewsView,
    BulletinApproveView,
    BulletinRejectView,
    BulletinAddCommentView,
    BulletinMoveToArchiveView,
    BulletinRestoreView,
    BulletinAttachmentListCreateView,
    BulletinAttachmentDetailView,
    BulletinHistoryView,
    BulletinLabelsView,
    BulletinReportView,
)

urlpatterns = [
    # Bulletin endpoints
    path('bulletins/', BulletinListCreateView.as_view(), name='bulletin-list-create'),
    path('bulletins/<int:pk>/', BulletinDetailView.as_view(), name='bulletin-detail'),
    path('bulletins/<int:pk>/history/', BulletinHistoryView.as_view(), name='bulletin-history'),
    path('bulletins/by_status/', BulletinByStatusView.as_view(), name='bulletin-by-status'),
    path('bulletins/<int:pk>/toggle_pin/', BulletinTogglePinView.as_view(), name='bulletin-toggle-pin'),
    path('bulletins/<int:pk>/increment_views/', BulletinIncrementViewsView.as_view(), name='bulletin-increment-views'),
    path('bulletins/<int:pk>/approve/', BulletinApproveView.as_view(), name='bulletin-approve'),
    path('bulletins/<int:pk>/reject/', BulletinRejectView.as_view(), name='bulletin-reject'),
    path('bulletins/<int:pk>/add_comment/', BulletinAddCommentView.as_view(), name='bulletin-add-comment'),
    path('bulletins/<int:pk>/move_to_archive/', BulletinMoveToArchiveView.as_view(), name='bulletin-move-to-archive'),
    path('bulletins/<int:pk>/restore/', BulletinRestoreView.as_view(), name='bulletin-restore'),
    path('bulletins/labels/', BulletinLabelsView.as_view(), name='bulletin-labels'),
    path('bulletins/<int:pk>/report/', BulletinReportView.as_view(), name='bulletin-report'),

    # Attachment endpoints
    path('bulletin-attachments/', BulletinAttachmentListCreateView.as_view(), name='bulletin-attachment-list-create'),
    path('bulletin-attachments/<int:pk>/', BulletinAttachmentDetailView.as_view(), name='bulletin-attachment-detail'),
]
