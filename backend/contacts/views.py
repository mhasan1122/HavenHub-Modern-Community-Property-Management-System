from rest_framework import generics, status
from rest_framework.exceptions import ValidationError
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from user.models import Member

from .models import ImportantContact
from .serializers import ImportantContactSerializer
from user.permissions import HasRequiredPermission
from group_role.permission_constants import (
    PERMISSION_VIEW_IMPORTANT_CONTACTS,
    PERMISSION_ADD_IMPORTANT_CONTACTS,
    PERMISSION_EDIT_IMPORTANT_CONTACTS,
)


class ImportantContactListCreateView(generics.ListCreateAPIView):
    serializer_class = ImportantContactSerializer
    permission_classes = [IsAuthenticated, HasRequiredPermission]

    def get_permissions(self):
        if self.request.method in ("GET", "HEAD", "OPTIONS"):
            self.required_permission_id = [
                PERMISSION_VIEW_IMPORTANT_CONTACTS,
                PERMISSION_ADD_IMPORTANT_CONTACTS,
                PERMISSION_EDIT_IMPORTANT_CONTACTS,
            ]
        elif self.request.method == "POST":
            self.required_permission_id = [PERMISSION_ADD_IMPORTANT_CONTACTS]
        else:
            self.required_permission_id = []
        return super().get_permissions()

    def get_queryset(self):
        return (
            ImportantContact.objects.select_related("created_by", "org_member", "org_member__member_type")
            .all()
            .order_by("-created_at")
        )

    def perform_create(self, serializer):
        member = getattr(self.request.user, "member", None)
        if member is None:
            member = Member.objects.filter(user=self.request.user).first()

        if member is None:
            raise ValidationError(
                "Only members with Important Contacts permissions can add contacts."
            )

        # Validate that the selected member is an org member
        selected_member = serializer.validated_data.get('org_member')
        if selected_member is None:
            raise ValidationError(
                "An organization member must be selected. Only organization members can be added as important contacts."
            )
        if not selected_member.is_org_member:
            raise ValidationError(
                "Only organization members can be added as important contacts."
            )

        serializer.save(created_by=member, updated_by=member)

    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        self.perform_create(serializer)
        headers = self.get_success_headers(serializer.data)
        return Response(
            {"message": "Contact added successfully.", "contact": serializer.data},
            status=status.HTTP_201_CREATED,
            headers=headers,
        )


class ImportantContactRetrieveUpdateDestroyView(
    generics.RetrieveUpdateDestroyAPIView
):
    serializer_class = ImportantContactSerializer
    permission_classes = [IsAuthenticated, HasRequiredPermission]

    def get_permissions(self):
        if self.request.method in ("GET", "HEAD", "OPTIONS"):
            self.required_permission_id = [
                PERMISSION_VIEW_IMPORTANT_CONTACTS,
                PERMISSION_ADD_IMPORTANT_CONTACTS,
                PERMISSION_EDIT_IMPORTANT_CONTACTS,
            ]
        elif self.request.method in ("PUT", "PATCH"):
            # Update functionality is disabled - return method not allowed
            self.required_permission_id = []
        elif self.request.method == "DELETE":
            self.required_permission_id = [PERMISSION_EDIT_IMPORTANT_CONTACTS]
        else:
            self.required_permission_id = []
        return super().get_permissions()

    def get_queryset(self):
        return ImportantContact.objects.select_related(
            "created_by", "updated_by", "org_member", "org_member__member_type"
        ).all()

    def update(self, request, *args, **kwargs):
        """Update functionality is disabled"""
        return Response(
            {"error": "Update functionality is not available. Contacts cannot be edited."},
            status=status.HTTP_405_METHOD_NOT_ALLOWED,
        )

    def partial_update(self, request, *args, **kwargs):
        """Partial update functionality is disabled"""
        return Response(
            {"error": "Update functionality is not available. Contacts cannot be edited."},
            status=status.HTTP_405_METHOD_NOT_ALLOWED,
        )

    def destroy(self, request, *args, **kwargs):
        instance = self.get_object()
        self.perform_destroy(instance)
        return Response(
            {"message": "Contact deleted successfully."},
            status=status.HTTP_200_OK,
        )

