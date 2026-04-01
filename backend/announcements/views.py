from rest_framework import status
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from rest_framework.views import APIView
from rest_framework.parsers import MultiPartParser, FormParser, JSONParser
from rest_framework.pagination import PageNumberPagination
from django.db.models import Q, Prefetch, Count
from django.db import models
from django.utils import timezone
from django.core.files.base import ContentFile
from django.core.cache import cache
from django.views.decorators.cache import cache_page
from django.utils.decorators import method_decorator
import base64
import uuid
import json
from django.shortcuts import get_object_or_404

from user.permissions import HasRequiredPermission
from group_role.permission_constants import (
    PERMISSION_ADD_ANNOUNCEMENTS,
    PERMISSION_EDIT_ANNOUNCEMENTS,
    PERMISSION_VIEW_ANNOUNCEMENTS,
)

from .models import Announcement, AnnouncementAttachment
from .serializers import (
    AnnouncementSerializer,
    AnnouncementListSerializer,
    AnnouncementAttachmentSerializer
)
from towers.models import Tower, Unit


class AnnouncementPagination(PageNumberPagination):
    """
    Custom pagination for announcements with configurable page size
    """
    page_size = 50
    page_size_query_param = 'page_size'
    max_page_size = 100


class AnnouncementListCreateView(APIView):
    permission_classes = [IsAuthenticated, HasRequiredPermission]
    parser_classes = [MultiPartParser, FormParser, JSONParser]

    def get_permissions(self):
        if self.request.method == "GET":
            self.required_permission_id = [
                PERMISSION_VIEW_ANNOUNCEMENTS,
                PERMISSION_EDIT_ANNOUNCEMENTS,
                PERMISSION_ADD_ANNOUNCEMENTS,
            ]
        elif self.request.method == "POST":
            self.required_permission_id = [PERMISSION_ADD_ANNOUNCEMENTS]
        else:
            self.required_permission_id = []
        return super().get_permissions()

    def get(self, request):
        # Build optimized queryset with minimal data loading
        queryset = Announcement.objects.select_related(
            'creator',
            'posted_group',
            'posted_member'
        ).prefetch_related(
            Prefetch('attachments', queryset=AnnouncementAttachment.objects.only(
                'id', 'announcement_id', 'file', 'file_name', 'file_type', 'file_size', 'created_at'
            )),
            Prefetch('target_towers', queryset=Tower.objects.only('id', 'tower_name')),
            Prefetch('target_units', queryset=Unit.objects.select_related('floor__tower').only(
                'id', 'unit_name', 'floor__tower__id', 'floor__tower__tower_name'
            ))
        ).only(
            'id', 'title', 'description', 'creator', 'post_as', 'posted_group', 'posted_member',
            'group_name', 'member_name', 'priority', 'label', 'start_date', 'start_time',
            'end_date', 'end_time', 'status', 'views', 'is_pinned', 'manually_expired',
            'created_at', 'updated_at'
        )

        # Apply filters early to reduce dataset size
        status_filter = request.query_params.get('status', None)
        if status_filter:
            queryset = queryset.filter(status=status_filter)
        
        search = request.query_params.get('search', None)
        if search:
            queryset = queryset.filter(
                Q(title__icontains=search) |
                Q(description__icontains=search) |
                Q(creator__full_name__icontains=search) |
                Q(posted_group__name__icontains=search) |
                Q(posted_member__full_name__icontains=search)
            )
        
        priority = request.query_params.get('priority', None)
        if priority:
            priority_list = [p.strip().lower() for p in priority.split(',') if p.strip()]
            if priority_list:
                queryset = queryset.filter(priority__in=priority_list)
        
        label = request.query_params.get('label', None)
        if label:
            label_list = [l.strip() for l in label.split(',') if l.strip()]
            if label_list:
                queryset = queryset.filter(label__in=label_list)
        
        my_posts = request.query_params.get('my_posts', None)
        if my_posts and my_posts.lower() == 'true':
            queryset = queryset.filter(
                Q(creator=request.user.member) |
                Q(posted_member=request.user.member) |
                Q(posted_group__members=request.user.member)
            ).distinct()
        
        # Apply Tower/Unit-based filtering for targeted delivery
        # Filter announcements based on the logged-in user's tower/unit assignments
        try:
            from notifications.utils import get_communication_access_q_object
            member = request.user.member
            
            # Detect mobile requests by X-App-Source header
            is_mobile = request.headers.get('X-App-Source', '').lower() == 'mobile'
            
            # Get access Q object (mobile users see only their tower/unit items)
            access_q = get_communication_access_q_object(member, is_mobile=is_mobile)
            
            # Apply filter
            queryset = queryset.filter(access_q).distinct()
                
        except Exception as e:
            print(f"Error filtering announcements by tower/unit targeting: {e}")
            import traceback
            traceback.print_exc()
            # On error, don't filter (show all) for backward compatibility
        
        # Order by pinned status and creation date (uses indexes)
        queryset = queryset.order_by('-is_pinned', '-created_at')
        
        # Limit results to prevent excessive data transfer
        limit = request.query_params.get('limit', None)
        if limit:
            try:
                queryset = queryset[:int(limit)]
            except ValueError:
                pass
        
        # Use lightweight serializer for list view
        serializer = AnnouncementListSerializer(queryset, many=True, context={'request': request})
        
        # Add cache headers for better performance
        response = Response(serializer.data)
        response['Cache-Control'] = 'max-age=30, must-revalidate'  # Cache for 30 seconds
        return response

    def post(self, request):
        files = request.FILES.getlist('attachments')
        base64_attachments = request.data.get('base64_attachments', [])
        data = request.data.copy()
        post_as = data.get('post_as')
        if post_as == 'group':
            group_id = data.get('posted_group')
            if not group_id:
                return Response({'error': 'Validation failed', 'details': {'posted_group': 'Group is required when posting as a group'}}, status=status.HTTP_400_BAD_REQUEST)
            data['posted_group'] = group_id
            data['posted_member'] = None
        elif post_as == 'member':
            member_id = data.get('posted_member')
            if not member_id:
                return Response({'error': 'Validation failed', 'details': {'posted_member': 'Member is required when posting as a member'}}, status=status.HTTP_400_BAD_REQUEST)
            data['posted_member'] = member_id
            data['posted_group'] = None
        else:
            data['posted_group'] = None
            data['posted_member'] = None
        # Use the same process_ids function for consistency
        def process_ids(value):
            """Process tower/unit IDs from various formats to a flat list of integers"""
            result = []

            if isinstance(value, str):
                try:
                    # Try to parse as JSON first (from FormData JSON string)
                    parsed = json.loads(value)
                    if isinstance(parsed, list):
                        result = [int(id) for id in parsed if str(id).strip() and str(id).strip() != 'All' and str(id).strip().isdigit()]
                    else:
                        result = [int(parsed)] if str(parsed).strip() and str(parsed).strip() != 'All' and str(parsed).strip().isdigit() else []
                except (json.JSONDecodeError, ValueError):
                    # Handle comma-separated string
                    result = [int(id.strip()) for id in value.split(',') if id.strip() and id.strip() != 'All' and id.strip().isdigit()]
            elif isinstance(value, list):
                # Flatten nested lists and convert to integers
                for item in value:
                    if isinstance(item, list):
                        result.extend(process_ids(item))
                    elif isinstance(item, str):
                        try:
                            # Try to parse as JSON
                            parsed = json.loads(item)
                            if isinstance(parsed, list):
                                result.extend([int(id) for id in parsed if str(id).strip() and str(id).strip() != 'All' and str(id).strip().isdigit()])
                            else:
                                if str(parsed).strip() and str(parsed).strip() != 'All' and str(parsed).strip().isdigit():
                                    result.append(int(parsed))
                        except (json.JSONDecodeError, ValueError):
                            # Handle as regular string/number
                            if str(item).strip() and str(item).strip() != 'All' and str(item).strip().isdigit():
                                result.append(int(item))
                    elif str(item).strip() and str(item).strip() != 'All' and str(item).strip().isdigit():
                        result.append(int(item))
            elif isinstance(value, int):
                result = [value]

            return result

        if 'target_tower_ids' in data:
            data['target_tower_ids'] = process_ids(data.get('target_tower_ids'))
        if 'target_unit_ids' in data:
            data['target_unit_ids'] = process_ids(data.get('target_unit_ids'))

        serializer = AnnouncementSerializer(data=data, context={'request': request})
        if not serializer.is_valid():
            return Response({'error': 'Validation failed', 'details': serializer.errors}, status=status.HTTP_400_BAD_REQUEST)
        announcement = serializer.save(creator=request.user.member)
        for file in files:
            if not self._is_valid_file(file):
                continue
            AnnouncementAttachment.objects.create(
                announcement=announcement,
                file=file,
                file_name=file.name,
                file_type=file.content_type,
                file_size=file.size
            )
        for attachment_data in base64_attachments:
            try:
                self._create_attachment_from_base64(announcement, attachment_data)
            except Exception as e:
                print(f"Error processing base64 attachment: {e}")
                continue
        
        # Send notifications
        # NOTE: Signals are disabled for announcements to ensure M2M targeting is saved first
        try:
            from notifications.utils import (
                send_announcement_published_notification,
                send_announcement_scheduled_notification
            )
            
            # Reload announcement with relationships to ensure target_units and target_towers are loaded
            # This is CRITICAL for targeted notifications
            announcement = Announcement.objects.prefetch_related('target_units', 'target_towers').get(pk=announcement.pk)
            
            # Ensure status is up to date (recalculate based on current dates)
            announcement.update_status()
            announcement.refresh_from_db()
            
            print(f"Announcement created with status: {announcement.status}")
            
            if announcement.status == 'ongoing':
                notifications = send_announcement_published_notification(announcement)
                print(f"Created {len(notifications)} notifications for new ongoing announcement {announcement.id}")
            elif announcement.status == 'upcoming':
                notifications = send_announcement_scheduled_notification(announcement)
                print(f"Created {len(notifications)} notifications for new upcoming announcement {announcement.id}")
            else:
                print(f"Announcement status is '{announcement.status}' - no immediate notifications")
                
        except Exception as e:
            import traceback
            print(f"Error sending announcement notifications: {e}")
            traceback.print_exc()
            # Don't fail the request if notification fails
        
        return Response(serializer.data, status=status.HTTP_201_CREATED)

    def _is_valid_file(self, file):
        if file.size > 5 * 1024 * 1024:
            return False
        allowed_types = [
            'image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp',
            'image/bmp', 'image/tiff', 'image/svg+xml',
            'application/pdf',
            'application/msword',
            'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
        ]
        return file.content_type in allowed_types

    def _create_attachment_from_base64(self, announcement, attachment_data):
        try:
            print(f"Creating attachment from base64 for announcement {announcement.id}")
            print(f"Attachment data keys: {list(attachment_data.keys()) if isinstance(attachment_data, dict) else 'Not a dict'}")

            base64_string = attachment_data.get('base64', '')
            file_name = attachment_data.get('name', f'attachment_{uuid.uuid4().hex[:8]}')
            file_type = attachment_data.get('type', 'application/octet-stream')

            print(f"File name: {file_name}")
            print(f"File type: {file_type}")
            print(f"Base64 string length: {len(base64_string)}")

            if ',' in base64_string:
                base64_string = base64_string.split(',')[1]
                print(f"Cleaned base64 string length: {len(base64_string)}")

            file_data = base64.b64decode(base64_string)
            file_size = len(file_data)
            print(f"File size: {file_size} bytes")

            if file_size > 5 * 1024 * 1024:
                print("File size exceeds 5MB limit")
                return False

            django_file = ContentFile(file_data, name=file_name)
            attachment = AnnouncementAttachment.objects.create(
                announcement=announcement,
                file=django_file,
                file_name=file_name,
                file_type=file_type,
                file_size=file_size
            )
            print(f"Successfully created attachment with ID: {attachment.id}")
            return True
        except Exception as e:
            print(f"Error creating attachment from base64: {e}")
            import traceback
            traceback.print_exc()
            return False


class AnnouncementDetailView(APIView):
    permission_classes = [IsAuthenticated, HasRequiredPermission]
    parser_classes = [MultiPartParser, FormParser, JSONParser]

    def get_permissions(self):
        if self.request.method == "GET":
            self.required_permission_id = [
                PERMISSION_VIEW_ANNOUNCEMENTS,
                PERMISSION_EDIT_ANNOUNCEMENTS,
                PERMISSION_ADD_ANNOUNCEMENTS,
            ]
        else:
            self.required_permission_id = [PERMISSION_EDIT_ANNOUNCEMENTS]
        return super().get_permissions()

    def get_object(self, pk):
        return get_object_or_404(Announcement, pk=pk)

    def get(self, request, pk):
        announcement = self.get_object(pk)
        serializer = AnnouncementSerializer(announcement, context={'request': request})
        return Response(serializer.data)

    def put(self, request, pk):
        return self._update(request, pk, partial=False)

    def patch(self, request, pk):
        return self._update(request, pk, partial=True)

    def _update(self, request, pk, partial):
        announcement = self.get_object(pk)
        # Store old status and priority to detect changes
        old_status = announcement.status
        old_priority = announcement.priority
        files = request.FILES.getlist('attachments')
        base64_attachments = request.data.get('base64_attachments', [])
        # Get attachments_to_delete as a list (FormData can send multiple values with same key)
        attachments_to_delete = request.data.getlist('attachments_to_delete')
        # Convert QueryDict to regular dict to avoid issues with list modifications
        data = dict(request.data)

        # Debug logging
        print(f"=== BACKEND UPDATE DEBUG ===")
        print(f"Announcement ID: {pk}")
        print(f"Files received: {len(files)}")
        print(f"Base64 attachments received: {len(base64_attachments)}")
        print(f"Attachments to delete: {attachments_to_delete} (type: {type(attachments_to_delete)}, length: {len(attachments_to_delete)})")
        print(f"Original data type: {type(request.data)}")
        print(f"Converted data type: {type(data)}")

        # Debug: Print original data for tower/unit IDs
        for field in ['target_tower_ids', 'target_unit_ids']:
            if field in data:
                print(f"Original {field}: {data[field]} (type: {type(data[field])})")

        # Flatten single-value lists in form data
        for key, value in list(data.items()):
            if key not in ['target_tower_ids', 'target_unit_ids', 'attachments_to_delete', 'base64_attachments']:
                if isinstance(value, list) and len(value) == 1:
                    data[key] = value[0]

        def process_ids(value):
            """Convert various ID formats to flat list of integers"""
            if not value:
                return []

            # Handle JSON string input
            if isinstance(value, str):
                try:
                    value = json.loads(value)
                except json.JSONDecodeError:
                    # Handle comma-separated string
                    return [int(id.strip()) for id in value.split(',') if id.strip().isdigit()]

            # Handle list input (including nested lists from FormData)
            if isinstance(value, list):
                ids = []
                for item in value:
                    if isinstance(item, list):
                        ids.extend(process_ids(item))
                    elif isinstance(item, str):
                        # Handle individual string values from FormData
                        if item.strip().isdigit():
                            ids.append(int(item))
                        else:
                            # Try comma-separated within the string
                            ids.extend([int(id.strip()) for id in item.split(',') if id.strip().isdigit()])
                    elif str(item).strip().isdigit():
                        ids.append(int(item))
                return ids

            # Handle single value
            if str(value).strip().isdigit():
                return [int(value)]

            return []

        # Process tower and unit IDs
        for field in ['target_tower_ids', 'target_unit_ids']:
            if field in data:
                data[field] = process_ids(data[field])
                print(f"Processed {field}: {data[field]}")

        # Debug: Print data being sent to serializer
        print(f"Data being sent to serializer:")
        for key, value in data.items():
            if key in ['target_tower_ids', 'target_unit_ids']:
                print(f"  {key}: {value} (type: {type(value)})")
                if isinstance(value, list) and len(value) > 0:
                    print(f"    First element: {value[0]} (type: {type(value[0])})")

        # Validate and save announcement
        serializer = AnnouncementSerializer(
            announcement,
            data=data,
            partial=partial,
            context={'request': request}
        )

        if not serializer.is_valid():
            print(f"Validation errors: {serializer.errors}")
            # Additional debug for serializer validation
            for field, errors in serializer.errors.items():
                if field in ['target_tower_ids', 'target_unit_ids']:
                    print(f"  Field {field} errors: {errors}")
                    print(f"  Field {field} value in serializer: {serializer.initial_data.get(field)}")
            return Response(
                {'error': 'Validation failed', 'details': serializer.errors},
                status=status.HTTP_400_BAD_REQUEST
            )

        announcement = serializer.save()

        # Update relationships - always process these fields to allow clearing
        # If field is not present, treat as empty array to clear selections
        tower_ids = data.get('target_tower_ids', [])
        announcement.target_towers.set(Tower.objects.filter(id__in=tower_ids))

        unit_ids = data.get('target_unit_ids', [])
        announcement.target_units.set(Unit.objects.filter(id__in=unit_ids))
        
        # Refresh announcement to get updated status (model's save() updates status based on dates)
        announcement.refresh_from_db()

        # Handle attachments to delete
        print(f"Processing {len(attachments_to_delete)} attachments for deletion")
        for attachment_id in attachments_to_delete:
            print(f"Attempting to delete attachment ID: {attachment_id}")
            try:
                attachment = AnnouncementAttachment.objects.get(
                    id=attachment_id,
                    announcement=announcement
                )
                print(f"Found attachment: {attachment.file_name}, deleting...")
                attachment.file.delete(save=False)
                attachment.delete()
                print(f"Successfully deleted attachment ID: {attachment_id}")
            except AnnouncementAttachment.DoesNotExist:
                print(f"Attachment {attachment_id} not found for announcement {announcement.id}")

        # Add new file attachments
        for file in files:
            if file.size > 5 * 1024 * 1024:  # 5MB limit
                continue
            AnnouncementAttachment.objects.create(
                announcement=announcement,
                file=file,
                file_name=file.name,
                file_type=file.content_type,
                file_size=file.size
            )

        # Add base64 attachments
        for attachment_data in base64_attachments:
            try:
                file_name = attachment_data.get('name', 'attachment')
                file_data = attachment_data.get('data', '')
                if ',' in file_data:  # Remove data URI prefix if present
                    file_data = file_data.split(',')[1]
                file_content = base64.b64decode(file_data)

                django_file = ContentFile(file_content, name=file_name)
                AnnouncementAttachment.objects.create(
                    announcement=announcement,
                    file=django_file,
                    file_name=file_name,
                    file_type=attachment_data.get('type', 'application/octet-stream'),
                    file_size=len(file_content)
                )
            except Exception as e:
                print(f"Error processing base64 attachment: {e}")

        # Check for status changes and send notifications
        try:
            from notifications.utils import (
                send_announcement_published_notification,
                send_announcement_scheduled_notification,
                send_announcement_ongoing_notification,
                send_announcement_updated_notification,
                send_announcement_priority_changed_notification
            )
            # Reload announcement from DB to ensure all relationships are properly loaded
            from announcements.models import Announcement
            announcement = Announcement.objects.prefetch_related('target_units', 'target_towers').get(pk=announcement.pk)
            
            # Ensure status is up to date (recalculate based on current dates)
            announcement.update_status()
            announcement.refresh_from_db()
            new_status = announcement.status
            new_priority = announcement.priority
            
            print(f"Status change check for announcement {announcement.id}: old_status='{old_status}', new_status='{new_status}'")
            print(f"Priority change check for announcement {announcement.id}: old_priority='{old_priority}', new_priority='{new_priority}'")
            
            # Check for priority changes first (highest priority)
            # Send notification if priority increased (e.g., Low → High/Urgent/Normal)
            priority_changed = (old_priority and new_priority and 
                               old_priority.lower() != new_priority.lower())
            
            if priority_changed:
                print(f"Priority changed for announcement {announcement.id}: {old_priority} → {new_priority}")
                notifications = send_announcement_priority_changed_notification(announcement, old_priority)
                print(f"Created {len(notifications)} notifications for announcement {announcement.id} priority change")
            # If status changed from upcoming to ongoing, send ongoing notification
            elif old_status == 'upcoming' and new_status == 'ongoing':
                notifications = send_announcement_ongoing_notification(announcement)
                print(f"Created {len(notifications)} notifications for announcement {announcement.id} transitioning from upcoming to ongoing")
            # If status changed to ongoing (from draft or expired), send published notification
            elif old_status != 'ongoing' and new_status == 'ongoing':
                notifications = send_announcement_published_notification(announcement)
                print(f"Created {len(notifications)} notifications for announcement {announcement.id} becoming ongoing (was {old_status})")
            # If status changed to upcoming (from draft, expired, or ongoing), send scheduled notification
            elif old_status != 'upcoming' and new_status == 'upcoming':
                notifications = send_announcement_scheduled_notification(announcement)
                print(f"Created {len(notifications)} notifications for announcement {announcement.id} becoming upcoming (was {old_status})")
            # If announcement was updated but status didn't change, send update notification
            elif old_status == new_status and new_status in ['ongoing', 'upcoming']:
                # CRITICAL: If targeting changed, we need to ensure new recipients get the notification
                # send_announcement_updated_notification will create/update notifications for the current audience
                notifications = send_announcement_updated_notification(announcement)
                print(f"Created {len(notifications)} notifications for announcement {announcement.id} update (status: {new_status})")
            else:
                # Fallback: If status is ongoing, ensure notifications exist (handles retargeting)
                if new_status == 'ongoing':
                    notifications = send_announcement_published_notification(announcement)
                    print(f"Refreshed {len(notifications)} notifications for ongoing announcement {announcement.id} (targeting check)")
                else:
                    print(f"No status change detected for announcement {announcement.id} (status remains '{new_status}')")
        except Exception as e:
            import traceback
            print(f"Error sending announcement notifications: {e}")
            traceback.print_exc()
            # Don't fail the request if notification fails

        return Response(serializer.data)

    def delete(self, request, pk):
        announcement = self.get_object(pk)
        announcement.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)

    def _is_valid_file(self, file):
        """
        Validate file type and size for attachments
        """
        if file.size > 5 * 1024 * 1024:  # 5MB limit
            return False
        allowed_types = [
            'image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp',
            'image/bmp', 'image/tiff', 'image/svg+xml',
            'application/pdf',
            'application/msword',
            'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
        ]
        return file.content_type in allowed_types

    def _create_attachment_from_base64(self, announcement, attachment_data):
        """
        Create attachment from base64 data
        """
        try:
            file_name = attachment_data.get('name', 'attachment')
            file_data = attachment_data.get('data', '')
            file_type = attachment_data.get('type', 'application/octet-stream')

            # Decode base64 data
            if ',' in file_data:
                file_data = file_data.split(',')[1]

            file_content = base64.b64decode(file_data)
            file_obj = ContentFile(file_content, name=file_name)

            # Create attachment
            attachment = AnnouncementAttachment.objects.create(
                announcement=announcement,
                file=file_obj,
                file_name=file_name,
                file_type=file_type,
                file_size=len(file_content)
            )
            return attachment
        except Exception as e:
            print(f"Error creating attachment from base64: {e}")
            raise


class AnnouncementByStatusView(APIView):
    permission_classes = [IsAuthenticated, HasRequiredPermission]

    def get_permissions(self):
        self.required_permission_id = [
            PERMISSION_VIEW_ANNOUNCEMENTS,
            PERMISSION_EDIT_ANNOUNCEMENTS,
            PERMISSION_ADD_ANNOUNCEMENTS,
        ]
        return super().get_permissions()
    def get(self, request):
        base_queryset = Announcement.objects.select_related('creator', 'posted_group', 'posted_member').prefetch_related('attachments', 'target_towers', 'target_units', 'history')
        ongoing = base_queryset.filter(status='ongoing')
        upcoming = base_queryset.filter(status='upcoming')
        expired = base_queryset.filter(status='expired')
        return Response({
            'ongoing': AnnouncementListSerializer(ongoing, many=True, context={'request': request}).data,
            'upcoming': AnnouncementListSerializer(upcoming, many=True, context={'request': request}).data,
            'expired': AnnouncementListSerializer(expired, many=True, context={'request': request}).data,
        })


class AnnouncementTogglePinView(APIView):
    permission_classes = [IsAuthenticated, HasRequiredPermission]

    def get_permissions(self):
        self.required_permission_id = [PERMISSION_EDIT_ANNOUNCEMENTS]
        return super().get_permissions()
    def post(self, request, pk):
        announcement = get_object_or_404(Announcement, pk=pk)
        announcement.is_pinned = not announcement.is_pinned
        announcement.save()
        return Response({'message': f'Announcement {"pinned" if announcement.is_pinned else "unpinned"} successfully', 'is_pinned': announcement.is_pinned})


class AnnouncementIncrementViewsView(APIView):
    permission_classes = [IsAuthenticated, HasRequiredPermission]

    def get_permissions(self):
        self.required_permission_id = [
            PERMISSION_VIEW_ANNOUNCEMENTS,
            PERMISSION_EDIT_ANNOUNCEMENTS,
            PERMISSION_ADD_ANNOUNCEMENTS,
        ]
        return super().get_permissions()
    def post(self, request, pk):
        announcement = get_object_or_404(Announcement, pk=pk)
        announcement.views += 1
        announcement.save(update_fields=['views'])
        
        # Mark all notifications for this announcement as read for the current user
        try:
            from notifications.models import Notification
            from django.utils import timezone
            
            updated_count = Notification.objects.filter(
                announcement_id=announcement.id,
                recipient=request.user.member,
                is_read=False
            ).update(
                is_read=True,
                read_at=timezone.now()
            )
            if updated_count > 0:
                print(f"Marked {updated_count} notifications as read for announcement {announcement.id}")
        except Exception as e:
            print(f"Error marking notifications as read for announcement {announcement.id}: {e}")
            # Don't fail the request if notification update fails
        
        return Response({'views': announcement.views})


class AnnouncementForceExpireView(APIView):
    permission_classes = [IsAuthenticated, HasRequiredPermission]

    def get_permissions(self):
        self.required_permission_id = [PERMISSION_EDIT_ANNOUNCEMENTS]
        return super().get_permissions()
    def post(self, request, pk):
        announcement = get_object_or_404(Announcement, pk=pk)
        announcement.status = 'expired'
        announcement.manually_expired = True
        announcement.save(update_fields=['status', 'manually_expired'])
        
        # Delete all notifications related to this announcement
        try:
            from notifications.utils import delete_announcement_notifications
            deleted_count = delete_announcement_notifications(announcement.id)
            print(f"Deleted {deleted_count} notifications for expired announcement {announcement.id}")
        except Exception as e:
            print(f"Error deleting notifications for announcement {announcement.id}: {e}")
            # Don't fail the request if notification deletion fails
        
        return Response({'message': 'Announcement moved to expired status'})


class AnnouncementRestoreView(APIView):
    permission_classes = [IsAuthenticated, HasRequiredPermission]

    def get_permissions(self):
        self.required_permission_id = [PERMISSION_EDIT_ANNOUNCEMENTS]
        return super().get_permissions()
    def post(self, request, pk):
        announcement = get_object_or_404(Announcement, pk=pk)
        old_status = announcement.status
        
        # Clear the manually_expired flag
        announcement.manually_expired = False
        
        # Recalculate status based on current date/time
        announcement.update_status()
        
        # Save the changes
        announcement.save()
        
        # Reload announcement with relationships for notifications
        try:
            from notifications.utils import restore_announcement_notifications
            # Reload announcement with relationships to ensure target_units and target_towers are loaded
            announcement = Announcement.objects.prefetch_related('target_units', 'target_towers').get(pk=announcement.pk)
            
            # Ensure manually_expired is still False (in case it was reset)
            if announcement.manually_expired:
                announcement.manually_expired = False
            
            # Ensure status is up to date (recalculate based on current time)
            announcement.update_status()
            
            # Save the final status
            announcement.save()
            
            # Send notifications if announcement is no longer expired
            if announcement.status != 'expired':
                notifications = restore_announcement_notifications(announcement)
                print(f"Sent {len(notifications)} notifications after restoring announcement {announcement.id} from {old_status} to {announcement.status}")
            else:
                print(f"Announcement {announcement.id} is still expired after restore, skipping notifications")
        except Exception as e:
            import traceback
            print(f"Error sending notifications after restoring announcement {announcement.id}: {e}")
            traceback.print_exc()
            # Don't fail the request if notification fails
        
        # Return the updated status - reload one more time to ensure we have the latest
        announcement.refresh_from_db()
        return Response({
            'message': 'Announcement restored successfully', 
            'status': announcement.status,
            'manually_expired': announcement.manually_expired
        })


class AnnouncementUpdateStatusesView(APIView):
    permission_classes = [IsAuthenticated, HasRequiredPermission]

    def get_permissions(self):
        self.required_permission_id = [PERMISSION_EDIT_ANNOUNCEMENTS]
        return super().get_permissions()
    def post(self, request):
        announcements = Announcement.objects.all()
        updated_count = 0
        for announcement in announcements:
            old_status = announcement.status
            announcement.update_status()
            if announcement.status != old_status:
                updated_count += 1
        return Response({'message': f'Updated {updated_count} announcement statuses', 'updated_count': updated_count})


class AnnouncementAttachmentListCreateView(APIView):
    permission_classes = [IsAuthenticated, HasRequiredPermission]
    parser_classes = [MultiPartParser, FormParser, JSONParser]

    def get_permissions(self):
        if self.request.method == "GET":
            self.required_permission_id = [
                PERMISSION_VIEW_ANNOUNCEMENTS,
                PERMISSION_EDIT_ANNOUNCEMENTS,
                PERMISSION_ADD_ANNOUNCEMENTS,
            ]
        else:
            self.required_permission_id = [
                PERMISSION_EDIT_ANNOUNCEMENTS,
                PERMISSION_ADD_ANNOUNCEMENTS,
            ]
        return super().get_permissions()
    def get(self, request):
        announcement_id = request.query_params.get('announcement_id', None)
        if announcement_id:
            attachments = AnnouncementAttachment.objects.filter(announcement_id=announcement_id)
        else:
            attachments = AnnouncementAttachment.objects.all()
        serializer = AnnouncementAttachmentSerializer(attachments, many=True, context={'request': request})
        return Response(serializer.data)
    def post(self, request):
        serializer = AnnouncementAttachmentSerializer(data=request.data, context={'request': request})
        if serializer.is_valid():
            file = request.FILES.get('file')
            if file:
                serializer.save(file_name=file.name, file_type=file.content_type, file_size=file.size)
            else:
                serializer.save()
            return Response(serializer.data, status=status.HTTP_201_CREATED)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


class AnnouncementAttachmentDetailView(APIView):
    permission_classes = [IsAuthenticated, HasRequiredPermission]

    def get_permissions(self):
        if self.request.method == "GET":
            self.required_permission_id = [
                PERMISSION_VIEW_ANNOUNCEMENTS,
                PERMISSION_EDIT_ANNOUNCEMENTS,
                PERMISSION_ADD_ANNOUNCEMENTS,
            ]
        else:
            self.required_permission_id = [PERMISSION_EDIT_ANNOUNCEMENTS]
        return super().get_permissions()
    def get_object(self, pk):
        return get_object_or_404(AnnouncementAttachment, pk=pk)
    def get(self, request, pk):
        attachment = self.get_object(pk)
        serializer = AnnouncementAttachmentSerializer(attachment, context={'request': request})
        return Response(serializer.data)
    def put(self, request, pk):
        attachment = self.get_object(pk)
        serializer = AnnouncementAttachmentSerializer(attachment, data=request.data, context={'request': request})
        if serializer.is_valid():
            serializer.save()
            return Response(serializer.data)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
    def patch(self, request, pk):
        attachment = self.get_object(pk)
        serializer = AnnouncementAttachmentSerializer(attachment, data=request.data, partial=True, context={'request': request})
        if serializer.is_valid():
            serializer.save()
            return Response(serializer.data)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
    def delete(self, request, pk):
        attachment = self.get_object(pk)
        attachment.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)


class TowerListView(APIView):
    """
    API view to get all towers for announcement targeting
    """
    permission_classes = [IsAuthenticated, HasRequiredPermission]

    def get_permissions(self):
        self.required_permission_id = [
            PERMISSION_VIEW_ANNOUNCEMENTS,
            PERMISSION_EDIT_ANNOUNCEMENTS,
            PERMISSION_ADD_ANNOUNCEMENTS,
        ]
        return super().get_permissions()

    def get(self, request):
        towers = Tower.objects.all().values('id', 'tower_name', 'tower_number')
        return Response(list(towers))


class UnitListView(APIView):
    """
    API view to get units, optionally filtered by tower IDs
    """
    permission_classes = [IsAuthenticated, HasRequiredPermission]

    def get_permissions(self):
        self.required_permission_id = [
            PERMISSION_VIEW_ANNOUNCEMENTS,
            PERMISSION_EDIT_ANNOUNCEMENTS,
            PERMISSION_ADD_ANNOUNCEMENTS,
        ]
        return super().get_permissions()

    def get(self, request):
        tower_ids = request.query_params.get('tower_ids', None)

        if tower_ids:
            # Parse comma-separated tower IDs
            tower_id_list = [int(id.strip()) for id in tower_ids.split(',') if id.strip().isdigit()]
            units = Unit.objects.filter(floor__tower__id__in=tower_id_list)
        else:
            units = Unit.objects.all()

        # Get units with tower information
        units_data = []
        for unit in units.select_related('floor__tower'):
            units_data.append({
                'id': unit.id,
                'unit_name': unit.unit_name,
                'tower_id': unit.floor.tower.id,
                'tower_name': unit.floor.tower.tower_name,
            })

        return Response(units_data)


class BulkUserCountView(APIView):
    """
    API view to get user counts for multiple units in a single request
    """
    permission_classes = [IsAuthenticated, HasRequiredPermission]

    def get_permissions(self):
        self.required_permission_id = [
            PERMISSION_VIEW_ANNOUNCEMENTS,
            PERMISSION_EDIT_ANNOUNCEMENTS,
            PERMISSION_ADD_ANNOUNCEMENTS,
        ]
        return super().get_permissions()

    def post(self, request):
        unit_ids = request.data.get('unit_ids', [])

        if not unit_ids:
            return Response({'error': 'unit_ids is required'}, status=status.HTTP_400_BAD_REQUEST)

        try:
            # Import here to avoid circular imports
            from towers.models import Unit, Resident, Owner, UnitStaff

            # Get all units
            units = Unit.objects.filter(id__in=unit_ids)

            # Bulk fetch all data - only include active community members
            residents = Resident.objects.filter(
                unit__in=units,
                is_active=True,
                member__is_comm_member=True
            ).values('unit_id').annotate(count=models.Count('id'))
            owners = Owner.objects.filter(
                unit__in=units,
                member__is_comm_member=True  # Only include active community members
            ).values('unit_id').annotate(count=models.Count('id'))
            unit_staff = UnitStaff.objects.filter(
                unit__in=units,
                is_active=True,
                member__is_comm_member=True
            ).values('unit_id').annotate(count=models.Count('id'))

            # Create lookup dictionaries
            residents_count = {item['unit_id']: item['count'] for item in residents}
            owners_count = {item['unit_id']: item['count'] for item in owners}
            unit_staff_count = {item['unit_id']: item['count'] for item in unit_staff}

            # Calculate total counts for each unit
            result = {}
            for unit_id in unit_ids:
                total_count = (
                    residents_count.get(unit_id, 0) +
                    owners_count.get(unit_id, 0) +
                    unit_staff_count.get(unit_id, 0)
                )
                result[str(unit_id)] = total_count

            return Response(result)

        except Exception as e:
            return Response(
                {'error': f'Error calculating user counts: {str(e)}'},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )


class AnnouncementLabelsView(APIView):
    """
    API view to get all unique labels from announcements
    """
    permission_classes = [IsAuthenticated, HasRequiredPermission]

    def get_permissions(self):
        self.required_permission_id = [
            PERMISSION_VIEW_ANNOUNCEMENTS,
            PERMISSION_EDIT_ANNOUNCEMENTS,
            PERMISSION_ADD_ANNOUNCEMENTS,
        ]
        return super().get_permissions()

    def get(self, request):
        # Get all unique labels from announcements, excluding empty/null labels
        label_strings = Announcement.objects.exclude(
            Q(label__isnull=True) | Q(label__exact='')
        ).values_list('label', flat=True).distinct()

        # Split comma-separated labels and create a unique set
        unique_labels = set()
        for label_string in label_strings:
            if label_string:
                # Split by comma and strip whitespace from each label
                individual_labels = [label.strip() for label in label_string.split(',') if label.strip()]
                unique_labels.update(individual_labels)

        # Convert to sorted list
        sorted_labels = sorted(list(unique_labels))
        return Response(sorted_labels)

