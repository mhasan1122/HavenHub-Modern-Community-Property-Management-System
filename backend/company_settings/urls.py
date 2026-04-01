from django.urls import path
from .views import (
    CompanySettingsView,
    CompanySettingsPublicView,
    CompanyImageListView,
    CompanyImageDetailView,
    SetActiveImageView
)

urlpatterns = [
    path('', CompanySettingsView.as_view(), name='company-settings'),
    path('public/', CompanySettingsPublicView.as_view(), name='company-settings-public'),
    path('images/', CompanyImageListView.as_view(), name='company-images-list'),
    path('images/<int:pk>/', CompanyImageDetailView.as_view(), name='company-image-detail'),
    path('images/<int:pk>/set-active/', SetActiveImageView.as_view(), name='set-active-image'),
]

