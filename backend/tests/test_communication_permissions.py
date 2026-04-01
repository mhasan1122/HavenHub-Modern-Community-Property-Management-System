from datetime import date, time, timedelta

from django.contrib.auth.models import User
from django.urls import reverse
from rest_framework import status
from rest_framework.test import APITestCase

from announcements.models import Announcement
from bulletins.models import Bulletin
from noticeboard.models import Notice
from group_role.models import (
    MembersRole,
    Permission,
    Role,
    RolePermission,
)
from group_role.permission_constants import (
    PERMISSION_ADD_ANNOUNCEMENTS,
    PERMISSION_ADD_BULLETIN_BOARD,
    PERMISSION_ADD_NOTICE_BOARD,
    PERMISSION_EDIT_ANNOUNCEMENTS,
    PERMISSION_EDIT_BULLETIN_BOARD,
    PERMISSION_EDIT_NOTICE_BOARD,
    PERMISSION_VIEW_ANNOUNCEMENTS,
    PERMISSION_VIEW_BULLETIN_BOARD,
    PERMISSION_VIEW_NOTICE_BOARD,
)
from user.models import Member, MemberType


class CommunicationPermissionMixin:
    """
    Helper mixin that provides utilities for creating members, assigning
    permissions, and building minimal payloads used across the communication
    portal permission tests.
    """

    permission_name_by_id = {
        PERMISSION_ADD_ANNOUNCEMENTS: "Add Announcements",
        PERMISSION_VIEW_ANNOUNCEMENTS: "View Announcements",
        PERMISSION_EDIT_ANNOUNCEMENTS: "Edit Announcements",
        PERMISSION_ADD_BULLETIN_BOARD: "Add Bulletin Board",
        PERMISSION_VIEW_BULLETIN_BOARD: "View Bulletin Board",
        PERMISSION_EDIT_BULLETIN_BOARD: "Edit Bulletin Board",
        PERMISSION_ADD_NOTICE_BOARD: "Add Notice Board",
        PERMISSION_VIEW_NOTICE_BOARD: "View Notice Board",
        PERMISSION_EDIT_NOTICE_BOARD: "Edit Notice Board",
    }

    def setUp(self):
        super().setUp()
        self.member_type = MemberType.objects.create(type_name="Org Member")
        self._contact_counter = 0
        self._role_sequence = 0

    def _next_contact(self) -> str:
        self._contact_counter += 1
        return f"01700{self._contact_counter:06d}"

    def create_member(self, username: str):
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
            is_org_member=True,
            org_member_ever_created=True,
        )
        return user, member

    def assign_permissions(self, member: Member, permission_ids):
        role = Role.objects.create(
            role_name=f"Role {self._role_sequence}",
            role_description="Auto generated for tests",
        )
        self._role_sequence += 1
        MembersRole.objects.create(
            member=member,
            role=role,
            is_active=True,
            is_member=True,
        )
        for perm_id in permission_ids:
            permission, _ = Permission.objects.get_or_create(
                id=perm_id,
                defaults={"permission_name": self.permission_name_by_id[perm_id]},
            )
            RolePermission.objects.create(
                role=role,
                permission=permission,
                is_active=True,
            )
        return role

    @staticmethod
    def default_dates():
        today = date.today()
        return {
            "start_date": today.isoformat(),
            "start_time": time(9, 0).isoformat(),
            "end_date": (today + timedelta(days=1)).isoformat(),
            "end_time": time(10, 0).isoformat(),
        }


class AnnouncementPermissionTests(CommunicationPermissionMixin, APITestCase):
    def setUp(self):
        super().setUp()
        self.list_url = reverse("announcement-list-create")
        self.payload = {
            "title": "Test Announcement",
            "description": "Automated test announcement",
            "post_as": "creator",
            "priority": "normal",
            "label": "",
            "target_tower_ids": [],
            "target_unit_ids": [],
            **self.default_dates(),
        }

    def test_list_requires_permission(self):
        user, _ = self.create_member("ann_noperms")
        self.client.force_authenticate(user=user)

        response = self.client.get(self.list_url)

        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    def test_list_with_view_permission(self):
        user, member = self.create_member("ann_view")
        self.assign_permissions(member, [PERMISSION_VIEW_ANNOUNCEMENTS])
        self.client.force_authenticate(user=user)

        response = self.client.get(self.list_url)

        self.assertEqual(response.status_code, status.HTTP_200_OK)

    def test_create_requires_add_permission(self):
        user, _ = self.create_member("ann_create_denied")
        self.client.force_authenticate(user=user)

        response = self.client.post(self.list_url, self.payload, format="json")

        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    def test_create_with_add_permission(self):
        user, member = self.create_member("ann_create_allowed")
        self.assign_permissions(member, [PERMISSION_ADD_ANNOUNCEMENTS])
        self.client.force_authenticate(user=user)

        response = self.client.post(self.list_url, self.payload, format="json")

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertTrue(
            Announcement.objects.filter(title=self.payload["title"]).exists()
        )


class BulletinPermissionTests(CommunicationPermissionMixin, APITestCase):
    def setUp(self):
        super().setUp()
        self.list_url = reverse("bulletin-list-create")
        self.payload = {
            "title": "Test Bulletin",
            "description": "Automated test bulletin",
            "post_as": "creator",
            "priority": "normal",
            "label": "",
            "target_tower_ids": [],
            "target_unit_ids": [],
        }

    def test_list_requires_permission(self):
        user, _ = self.create_member("bulletin_noperms")
        self.client.force_authenticate(user=user)

        response = self.client.get(self.list_url)

        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    def test_list_with_view_permission(self):
        user, member = self.create_member("bulletin_view")
        self.assign_permissions(member, [PERMISSION_VIEW_BULLETIN_BOARD])
        self.client.force_authenticate(user=user)

        response = self.client.get(self.list_url)

        self.assertEqual(response.status_code, status.HTTP_200_OK)

    def test_create_requires_add_permission(self):
        user, _ = self.create_member("bulletin_create_denied")
        self.client.force_authenticate(user=user)

        response = self.client.post(self.list_url, self.payload, format="json")

        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    def test_create_with_add_permission(self):
        user, member = self.create_member("bulletin_create_allowed")
        self.assign_permissions(member, [PERMISSION_ADD_BULLETIN_BOARD])
        self.client.force_authenticate(user=user)

        response = self.client.post(self.list_url, self.payload, format="json")

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertTrue(Bulletin.objects.filter(title=self.payload["title"]).exists())


class NoticePermissionTests(CommunicationPermissionMixin, APITestCase):
    def setUp(self):
        super().setUp()
        self.list_url = reverse("notice-list-create")
        self.payload = {
            "internal_title": "Test Notice",
            "post_as": "creator",
            "priority": "normal",
            "label": "",
            "target_tower_ids": [],
            "target_unit_ids": [],
            **self.default_dates(),
        }

    def test_list_requires_permission(self):
        user, _ = self.create_member("notice_noperms")
        self.client.force_authenticate(user=user)

        response = self.client.get(self.list_url)

        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    def test_list_with_view_permission(self):
        user, member = self.create_member("notice_view")
        self.assign_permissions(member, [PERMISSION_VIEW_NOTICE_BOARD])
        self.client.force_authenticate(user=user)

        response = self.client.get(self.list_url)

        self.assertEqual(response.status_code, status.HTTP_200_OK)

    def test_create_requires_add_permission(self):
        user, _ = self.create_member("notice_create_denied")
        self.client.force_authenticate(user=user)

        response = self.client.post(self.list_url, self.payload, format="json")

        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    def test_create_with_add_permission(self):
        user, member = self.create_member("notice_create_allowed")
        self.assign_permissions(member, [PERMISSION_ADD_NOTICE_BOARD])
        self.client.force_authenticate(user=user)

        response = self.client.post(self.list_url, self.payload, format="json")

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertTrue(
            Notice.objects.filter(creator=member, priority="normal").exists()
        )

