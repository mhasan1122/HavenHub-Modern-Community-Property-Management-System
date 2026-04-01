from django.urls import path

from .views import (
    ImportantContactListCreateView,
    ImportantContactRetrieveUpdateDestroyView,
)

app_name = "contacts"

urlpatterns = [
    path(
        "",
        ImportantContactListCreateView.as_view(),
        name="important-contact-list-create",
    ),
    path(
        "<int:pk>/",
        ImportantContactRetrieveUpdateDestroyView.as_view(),
        name="important-contact-detail",
    ),
]

