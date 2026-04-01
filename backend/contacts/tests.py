from typing import Optional

from django.contrib.auth.models import User
from django.urls import reverse
from rest_framework import status
from rest_framework.test import APITestCase

from group_role.models import MembersRole, Role
from user.models import Member, MemberType

from .models import ImportantContact


class ImportantContactAPITests(APITestCase):
    def setUp(self):
        self.member_type = MemberType.objects.create(type_name="Default")
        self.admin_role = Role.objects.create(
            role_name="Admin", role_description="Administrator"
        )
        self.staff_role = Role.objects.create(
            role_name="Staff", role_description="Staff"
        )
        self.contact_sequence = 0
        self.url = reverse("contacts:important-contact-list-create")

    def _next_contact(self) -> str:
        self.contact_sequence += 1
        return f"01700{self.contact_sequence:06d}"

    def detail_url(self, contact_id: int) -> str:
        return reverse("contacts:important-contact-detail", args=[contact_id])

    def create_member(self, username: str, role: Optional[Role] = None):
        user = User.objects.create_user(
            username=username,
            password="pass1234!",
            email=f"{username}@example.com",
        )
        member = Member.objects.create(
            user=user,
            member_type=self.member_type,
            full_name=f"{username.title()} User",
            general_contact=self._next_contact(),
            general_email=f"{username}@example.com",
        )

        if role:
            MembersRole.objects.create(
                member=member,
                role=role,
                is_active=True,
                is_member=True,
            )
        return user, member

    def test_admin_can_create_contact(self):
        admin_user, admin_member = self.create_member("admin", self.admin_role)
        self.client.force_authenticate(admin_user)

        payload = {
            "name": "John Smith",
            "phone_number": "+8801712345678",
            "email": "john.smith@example.com",
            "designation": "Security Lead",
        }

        response = self.client.post(self.url, payload, format="json")

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(response.data["message"], "Contact added successfully.")
        contact = response.data["contact"]
        self.assertEqual(contact["name"], payload["name"])
        self.assertEqual(contact["phone_number"], "+8801712345678")
        self.assertEqual(contact["designation"], payload["designation"])
        self.assertEqual(contact["created_by"], admin_member.id)

        # Ensure the contact appears in list
        list_response = self.client.get(self.url)
        self.assertEqual(list_response.status_code, status.HTTP_200_OK)
        self.assertGreaterEqual(len(list_response.data), 1)

    def test_non_admin_cannot_create_contact(self):
        staff_user, _ = self.create_member("staff", self.staff_role)
        self.client.force_authenticate(staff_user)

        payload = {
            "name": "Jane Doe",
            "phone_number": "+8801812345678",
            "email": "jane.doe@example.com",
            "designation": "Operations",
        }

        response = self.client.post(self.url, payload, format="json")

        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    def test_invalid_phone_number_rejected(self):
        admin_user, _ = self.create_member("admin2", self.admin_role)
        self.client.force_authenticate(admin_user)

        payload = {
            "name": "Invalid Phone",
            "phone_number": "12345",
            "email": "invalid@example.com",
            "designation": "Support",
        }

        response = self.client.post(self.url, payload, format="json")

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("phone_number", response.data)

    def test_admin_can_update_contact(self):
        admin_user, admin_member = self.create_member("admin-update", self.admin_role)
        self.client.force_authenticate(admin_user)

        create_payload = {
            "name": "Original Name",
            "phone_number": "+8801711111111",
            "email": "original@example.com",
            "designation": "Original Role",
        }
        create_response = self.client.post(self.url, create_payload, format="json")
        contact_id = create_response.data["contact"]["id"]

        update_payload = {
            "name": "Updated Name",
            "phone_number": "+8801999999999",
            "email": "updated@example.com",
            "designation": "Updated Role",
        }

        response = self.client.patch(
            self.detail_url(contact_id), update_payload, format="json"
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        updated_contact = response.data["contact"]
        self.assertEqual(updated_contact["name"], update_payload["name"])
        self.assertEqual(updated_contact["phone_number"], "+8801999999999")
        self.assertEqual(updated_contact["designation"], "Updated Role")

        contact = ImportantContact.objects.get(pk=contact_id)
        self.assertEqual(contact.updated_by_id, admin_member.id)

    def test_admin_can_delete_contact(self):
        admin_user, _ = self.create_member("admin-delete", self.admin_role)
        self.client.force_authenticate(admin_user)

        create_payload = {
            "name": "Contact To Delete",
            "phone_number": "+8801812340000",
            "email": "delete-me@example.com",
            "designation": "Temp Role",
        }
        create_response = self.client.post(self.url, create_payload, format="json")
        contact_id = create_response.data["contact"]["id"]

        response = self.client.delete(self.detail_url(contact_id))

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertFalse(
            ImportantContact.objects.filter(pk=contact_id).exists()
        )

