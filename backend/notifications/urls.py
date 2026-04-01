from django.urls import path
from .views import (
    NotificationListView,
    NotificationDetailView,
    NotificationMarkAllReadView,
    NotificationUnreadCountView,
    BatchOwnerNotificationView,
    RegisterDeviceTokenView,
    UnregisterDeviceTokenView,
)

urlpatterns = [
    path('', NotificationListView.as_view(), name='notification-list'),
    path('<int:pk>/', NotificationDetailView.as_view(), name='notification-detail'),
    path('mark-all-read/', NotificationMarkAllReadView.as_view(), name='notification-mark-all-read'),
    path('unread-count/', NotificationUnreadCountView.as_view(), name='notification-unread-count'),
    path('batch_owner_notification/', BatchOwnerNotificationView.as_view(), name='batch-owner-notification'),
    path('register-device/', RegisterDeviceTokenView.as_view(), name='register-device-token'),
    path('unregister-device/', UnregisterDeviceTokenView.as_view(), name='unregister-device-token'),
]

