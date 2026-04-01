from rest_framework import status
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from rest_framework.views import APIView
from rest_framework.parsers import MultiPartParser, FormParser, JSONParser
from django.db.models import Q, Prefetch
from django.db import models
from django.utils import timezone
from django.core.files.base import ContentFile
import base64
import uuid
import json
from django.shortcuts import get_object_or_404

from user.permissions import HasRequiredPermission
from group_role.permission_constants import (
    PERMISSION_ADD_NOTICE_BOARD,
    PERMISSION_EDIT_NOTICE_BOARD,
    PERMISSION_VIEW_NOTICE_BOARD,
    PERMISSION_EXPIRE_NOTICE_BOARD,
)

from .models import Notice, NoticeAttachment
from .serializers import (
    NoticeSerializer,
    NoticeListSerializer,
    NoticeAttachmentSerializer
)
from towers.models import Tower, Unit


class NoticeListCreateView(APIView):
    permission_classes = [IsAuthenticated, HasRequiredPermission]
    parser_classes = [MultiPartParser, FormParser, JSONParser]

    def get_permissions(self):
        if self.request.method == "GET":
            self.required_permission_id = [
                PERMISSION_VIEW_NOTICE_BOARD,
                PERMISSION_ADD_NOTICE_BOARD,
                PERMISSION_EDIT_NOTICE_BOARD,
            ]
        elif self.request.method == "POST":
            self.required_permission_id = [PERMISSION_ADD_NOTICE_BOARD]
        else:
            self.required_permission_id = []
        return super().get_permissions()

    def get(self, request):
        # Build optimized queryset with minimal data loading
        queryset = Notice.objects.select_related(
            'creator',
            'posted_group',
            'posted_member'
        ).prefetch_related(
            Prefetch('attachments', queryset=NoticeAttachment.objects.only(
                'id', 'notice_id', 'file', 'file_name', 'file_type', 'file_size', 'created_at'
            )),
            Prefetch('target_towers', queryset=Tower.objects.only('id', 'tower_name', 'tower_number')),
            Prefetch('target_units', queryset=Unit.objects.select_related('floor__tower').only(
                'id', 'unit_name', 'floor__tower__id', 'floor__tower__tower_name'
            ))
        ).only(
            'id', 'internal_title', 'creator', 'post_as', 'posted_group', 'posted_member',
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
                Q(internal_title__icontains=search) |
                Q(creator__full_name__icontains=search) |
                Q(posted_group__name__icontains=search) |
                Q(posted_member__full_name__icontains=search)
            )
        
        priority = request.query_params.get('priority', None)
        if priority:
            # Handle comma-separated priority values for OR filtering
            priority_list = [p.strip().lower() for p in priority.split(',') if p.strip()]
            if priority_list:
                queryset = queryset.filter(priority__in=priority_list)
        
        label = request.query_params.get('label', None)
        if label:
            # Handle comma-separated label values for OR filtering
            label_list = [l.strip() for l in label.split(',') if l.strip()]
            if label_list:
                label_q = Q()
                for label_item in label_list:
                    label_q |= Q(label__icontains=label_item)
                queryset = queryset.filter(label_q)
        
        my_posts = request.query_params.get('my_posts', None)
        if my_posts and my_posts.lower() == 'true':
            try:
                member = request.user.member
            except Exception:
                from user.models import Member
                member = Member.objects.filter(user=request.user).first()

            if member:
                from group_role.models import GroupMembers
                # Get groups where the member belongs
                member_groups = GroupMembers.objects.filter(member=member).values_list('group', flat=True)

                queryset = queryset.filter(
                    Q(creator=member) |
                    Q(posted_member=member) |
                    Q(posted_group__in=member_groups)
                ).distinct()
            else:
                # If user has no member record, return empty queryset
                queryset = queryset.none()
        else:
            # Apply Tower/Unit-based filtering for targeted delivery (only when not filtering by my_posts)
            # Filter notices based on the logged-in user's tower/unit assignments
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
                print(f"Error filtering notices by tower/unit targeting: {e}")
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
        
        # Use lightweight list serializer for better performance
        serializer = NoticeListSerializer(queryset, many=True, context={'request': request})
        
        # Add cache headers for better performance
        response = Response(serializer.data)
        response['Cache-Control'] = 'max-age=30, must-revalidate'  # Cache for 30 seconds
        return response

    def post(self, request):
        # Debug: Print all request data
        print(f"Request data: {dict(request.data)}")
        print(f"Request FILES: {dict(request.FILES)}")

        files = request.FILES.getlist('attachments')
        base64_attachments = request.data.get('base64_attachments', [])

        # Parse base64_attachments if it's a JSON string
        if isinstance(base64_attachments, str):
            try:
                base64_attachments = json.loads(base64_attachments)
            except json.JSONDecodeError:
                base64_attachments = []

        # Convert QueryDict to regular dict to avoid list wrapping issues
        data = {}
        for key, value in request.data.items():
            if key in ['target_tower_ids', 'target_unit_ids']:
                # Check if it's a JSON string (sent as single value) or multiple values
                raw_value = request.data.get(key)
                # If it's a JSON string, use it directly; otherwise get all values
                if isinstance(raw_value, str) and raw_value.strip().startswith('['):
                    # It's a JSON array string, use it directly
                    data[key] = raw_value
                else:
                    # Multiple values or single non-JSON value, get as list
                    data[key] = request.data.getlist(key)
            else:
                # For other fields, get single value
                data[key] = value

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
            tower_ids = data['target_tower_ids']
            print(f"Before processing target_tower_ids: {tower_ids}")
            data['target_tower_ids'] = process_ids(tower_ids)
            print(f"After processing target_tower_ids: {data['target_tower_ids']}")
        if 'target_unit_ids' in data:
            unit_ids = data['target_unit_ids']
            print(f"Before processing target_unit_ids: {unit_ids}")
            data['target_unit_ids'] = process_ids(unit_ids)
            print(f"After processing target_unit_ids: {data['target_unit_ids']}")

        print(f"Final data being sent to serializer: {data}")

        serializer = NoticeSerializer(data=data, context={'request': request})
        if not serializer.is_valid():
            print(f"Serializer validation errors: {serializer.errors}")
            return Response({'error': 'Validation failed', 'details': serializer.errors}, status=status.HTTP_400_BAD_REQUEST)
        notice = serializer.save(creator=request.user.member)
        for file in files:
            if not self._is_valid_file(file):
                continue
            NoticeAttachment.objects.create(
                notice=notice,
                file=file,
                file_name=file.name,
                file_type=file.content_type,
                file_size=file.size
            )
        for attachment_data in base64_attachments:
            try:
                self._create_attachment_from_base64(notice, attachment_data)
            except Exception as e:
                print(f"Error processing base64 attachment: {e}")
                continue
        
        # Send notification when notice is created
        # Re-fetch notice from database to ensure many-to-many relationships are loaded
        try:
            from noticeboard.models import Notice
            from notifications.utils import create_notice_posted_notification
            # Re-fetch notice to ensure many-to-many relationships are accessible
            notice_with_relations = Notice.objects.prefetch_related('target_towers', 'target_units').get(id=notice.id)
            create_notice_posted_notification(notice_with_relations)
        except Exception as e:
            print(f"Error creating notice notification: {e}")
            import traceback
            traceback.print_exc()
        
        return Response(serializer.data, status=status.HTTP_201_CREATED)

    def _is_valid_file(self, file):
        if file.size > 10 * 1024 * 1024:  # Increased to 10MB to match bulletins
            return False
        # Allow both image files and PDFs for notices
        allowed_types = [
            'image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp',
            'image/bmp', 'image/tiff', 'image/svg+xml', 'image/heic', 'image/heif',
            'application/pdf'
        ]
        return file.content_type in allowed_types

    def _create_attachment_from_base64(self, notice, attachment_data):
        try:
            print(f"Creating attachment from base64 for notice {notice.id}")
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

            if file_size > 10 * 1024 * 1024:
                print("File size exceeds 10MB limit")
                return False

            django_file = ContentFile(file_data, name=file_name)
            attachment = NoticeAttachment.objects.create(
                notice=notice,
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


class NoticeDetailView(APIView):
    permission_classes = [IsAuthenticated, HasRequiredPermission]
    parser_classes = [MultiPartParser, FormParser, JSONParser]

    def get_permissions(self):
        if self.request.method == "GET":
            self.required_permission_id = [
                PERMISSION_VIEW_NOTICE_BOARD,
                PERMISSION_ADD_NOTICE_BOARD,
                PERMISSION_EDIT_NOTICE_BOARD,
            ]
        else:
            self.required_permission_id = [PERMISSION_EDIT_NOTICE_BOARD]
        return super().get_permissions()

    def get_object(self, pk):
        return get_object_or_404(Notice, pk=pk)

    def _is_valid_file(self, file):
        if file.size > 10 * 1024 * 1024:  # Increased to 10MB to match bulletins
            return False
        # Allow both image files and PDFs for notices
        allowed_types = [
            'image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp',
            'image/bmp', 'image/tiff', 'image/svg+xml', 'image/heic', 'image/heif',
            'application/pdf'
        ]
        return file.content_type in allowed_types

    def _create_attachment_from_base64(self, notice, attachment_data):
        try:
            print(f"Creating attachment from base64 for notice {notice.id}")
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

            if file_size > 10 * 1024 * 1024:
                print("File size exceeds 10MB limit")
                return False

            django_file = ContentFile(file_data, name=file_name)
            attachment = NoticeAttachment.objects.create(
                notice=notice,
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

    def get(self, request, pk):
        notice = self.get_object(pk)
        serializer = NoticeSerializer(notice, context={'request': request})
        return Response(serializer.data)

    def put(self, request, pk):
        return self._update(request, pk, partial=False)

    def patch(self, request, pk):
        return self._update(request, pk, partial=True)

    def _update(self, request, pk, partial):
        notice = self.get_object(pk)
        files = request.FILES.getlist('attachments')
        base64_attachments = request.data.get('base64_attachments', [])
        # Get attachments_to_delete as a list (FormData can send multiple values with same key)
        attachments_to_delete = request.data.getlist('attachments_to_delete')
        # Convert QueryDict to regular dict to avoid issues with list modifications
        # Handle JSON arrays for tower/unit IDs specially
        data = {}
        for key, value in request.data.items():
            if key in ['target_tower_ids', 'target_unit_ids']:
                # Check if it's a JSON string (sent as single value) or multiple values
                raw_value = request.data.get(key)
                # If it's a JSON string, use it directly; otherwise convert to dict normally
                if isinstance(raw_value, str) and raw_value.strip().startswith('['):
                    # It's a JSON array string, use it directly
                    data[key] = raw_value
                else:
                    # Multiple values or single non-JSON value, get as list
                    values = request.data.getlist(key)
                    data[key] = values if len(values) > 1 else (values[0] if values else '')
            else:
                # For other fields, convert normally (dict() keeps last value for duplicates)
                values = request.data.getlist(key)
                data[key] = values if len(values) > 1 else (values[0] if values else '')

        # Debug logging
        # print(f"=== BACKEND UPDATE DEBUG ===")
        # print(f"Notice ID: {pk}")
        # print(f"Files received: {len(files)}")
        # print(f"Base64 attachments received: {len(base64_attachments)}")
        # print(f"Attachments to delete: {attachments_to_delete} (type: {type(attachments_to_delete)}, length: {len(attachments_to_delete)})")
        # print(f"Original data type: {type(request.data)}")
        # print(f"Converted data type: {type(data)}")

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
                    parsed = json.loads(value)
                    # If parsed successfully, process the parsed value
                    if isinstance(parsed, list):
                        return [int(id) for id in parsed if id is not None and (isinstance(id, int) or (isinstance(id, str) and id.strip().isdigit()))]
                    elif isinstance(parsed, (int, str)) and str(parsed).strip().isdigit():
                        return [int(parsed)]
                    else:
                        return []
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
                        # Try to parse as JSON first
                        try:
                            parsed = json.loads(item)
                            if isinstance(parsed, list):
                                ids.extend([int(id) for id in parsed if id is not None and (isinstance(id, int) or (isinstance(id, str) and id.strip().isdigit()))])
                            elif isinstance(parsed, (int, str)) and str(parsed).strip().isdigit():
                                ids.append(int(parsed))
                        except json.JSONDecodeError:
                            # Handle individual string values from FormData
                            if item.strip().isdigit():
                                ids.append(int(item))
                            else:
                                # Try comma-separated within the string
                                ids.extend([int(id.strip()) for id in item.split(',') if id.strip().isdigit()])
                    elif isinstance(item, int):
                        ids.append(item)
                    elif isinstance(item, str) and item.strip().isdigit():
                        ids.append(int(item))
                return ids

            # Handle single integer value
            if isinstance(value, int):
                return [value]
            
            # Handle single string value
            if isinstance(value, str) and value.strip().isdigit():
                return [int(value)]

            return []

        # Process tower and unit IDs
        for field in ['target_tower_ids', 'target_unit_ids']:
            if field in data:
                field_values = data[field]
                data[field] = process_ids(field_values)
                print(f"Processed {field}: {data[field]}")

        # Debug: Print data being sent to serializer
        print(f"Data being sent to serializer:")
        for key, value in data.items():
            if key in ['target_tower_ids', 'target_unit_ids']:
                print(f"  {key}: {value} (type: {type(value)})")
                if isinstance(value, list) and len(value) > 0:
                    print(f"    First element: {value[0]} (type: {type(value[0])})")

        # Validate and save notice
        serializer = NoticeSerializer(
            notice,
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

        notice = serializer.save()

        # Update relationships - always process these fields to allow clearing
        # If field is not present, treat as empty array to clear selections
        tower_ids = data.get('target_tower_ids', [])
        notice.target_towers.set(Tower.objects.filter(id__in=tower_ids))

        unit_ids = data.get('target_unit_ids', [])
        notice.target_units.set(Unit.objects.filter(id__in=unit_ids))

        # Handle attachments to delete
        print(f"Processing {len(attachments_to_delete)} attachments for deletion")
        for attachment_id in attachments_to_delete:
            print(f"Attempting to delete attachment ID: {attachment_id}")
            try:
                attachment = NoticeAttachment.objects.get(
                    id=attachment_id,
                    notice=notice
                )
                print(f"Found attachment: {attachment.file_name}, deleting...")
                attachment.file.delete(save=False)
                attachment.delete()
                print(f"Successfully deleted attachment ID: {attachment_id}")
            except NoticeAttachment.DoesNotExist:
                print(f"Attachment {attachment_id} not found for notice {notice.id}")

        # Add new file attachments (images and PDFs)
        for file in files:
            if not self._is_valid_file(file):
                continue
            NoticeAttachment.objects.create(
                notice=notice,
                file=file,
                file_name=file.name,
                file_type=file.content_type,
                file_size=file.size
            )

        # Add base64 attachments
        for attachment_data in base64_attachments:
            try:
                self._create_attachment_from_base64(notice, attachment_data)
            except Exception as e:
                print(f"Error processing base64 attachment: {e}")
                continue
        
        # Check for status changes and send notifications
        try:
            from notifications.utils import create_notice_posted_notification
            
            # Reload notice to ensure relationships are up to date
            notice = Notice.objects.prefetch_related('target_towers', 'target_units').get(pk=notice.pk)
            
            # 1. New Notice Logic (Status Change)
            # If status changed to ongoing/current (assuming 'ongoing' is the active status for notices)
            # Note: Notice model uses 'ongoing', 'upcoming', 'expired'
            if notice.status == 'ongoing':
                # Check if it was just created or status changed
                # Since we don't track old_status here easily without fetching before save,
                # we can rely on the fact that notifications are idempotent (handle duplicates)
                # But for EDIT updates, we specifically want to handle targeting changes.
                
                # For edits, we pass is_update=True to handle re-targeting
                print(f"Notice {notice.id} updated. Checking for targeting changes...")
                notifications = create_notice_posted_notification(notice)
                print(f"Created/Updated {len(notifications)} notifications for notice {notice.id}")
                
        except Exception as e:
            print(f"Error sending notice notifications on update: {e}")
            import traceback
            traceback.print_exc()

        return Response(serializer.data)



    def delete(self, request, pk):
        notice = self.get_object(pk)
        notice.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)


class NoticeByStatusView(APIView):
    permission_classes = [IsAuthenticated, HasRequiredPermission]

    def get_permissions(self):
        self.required_permission_id = [
            PERMISSION_VIEW_NOTICE_BOARD,
            PERMISSION_ADD_NOTICE_BOARD,
            PERMISSION_EDIT_NOTICE_BOARD,
        ]
        return super().get_permissions()
    def get(self, request):
        base_queryset = Notice.objects.select_related('creator', 'posted_group', 'posted_member').prefetch_related('attachments', 'target_towers', 'target_units', 'history')
        ongoing = base_queryset.filter(status='ongoing')
        upcoming = base_queryset.filter(status='upcoming')
        expired = base_queryset.filter(status='expired')
        return Response({
            'ongoing': NoticeListSerializer(ongoing, many=True, context={'request': request}).data,
            'upcoming': NoticeListSerializer(upcoming, many=True, context={'request': request}).data,
            'expired': NoticeListSerializer(expired, many=True, context={'request': request}).data,
        })


class NoticeTogglePinView(APIView):
    permission_classes = [IsAuthenticated, HasRequiredPermission]

    def get_permissions(self):
        self.required_permission_id = [PERMISSION_EDIT_NOTICE_BOARD]
        return super().get_permissions()
    def post(self, request, pk):
        notice = get_object_or_404(Notice, pk=pk)
        notice.is_pinned = not notice.is_pinned
        notice.save()
        return Response({'message': f'Notice {"pinned" if notice.is_pinned else "unpinned"} successfully', 'is_pinned': notice.is_pinned})


class NoticeIncrementViewsView(APIView):
    permission_classes = [IsAuthenticated, HasRequiredPermission]

    def get_permissions(self):
        self.required_permission_id = [
            PERMISSION_VIEW_NOTICE_BOARD,
            PERMISSION_ADD_NOTICE_BOARD,
            PERMISSION_EDIT_NOTICE_BOARD,
        ]
        return super().get_permissions()
    def post(self, request, pk):
        notice = get_object_or_404(Notice, pk=pk)
        notice.views += 1
        notice.save(update_fields=['views'])
        return Response({'views': notice.views})


class NoticeForceExpireView(APIView):
    permission_classes = [IsAuthenticated, HasRequiredPermission]

    def get_permissions(self):
        self.required_permission_id = [PERMISSION_EXPIRE_NOTICE_BOARD]
        return super().get_permissions()
    def post(self, request, pk):
        notice = get_object_or_404(Notice, pk=pk)
        notice.status = 'expired'
        notice.manually_expired = True
        notice.save(update_fields=['status', 'manually_expired'])
        return Response({'message': 'Notice moved to expired status'})


class NoticeRestoreView(APIView):
    permission_classes = [IsAuthenticated, HasRequiredPermission]

    def get_permissions(self):
        self.required_permission_id = [PERMISSION_EDIT_NOTICE_BOARD]
        return super().get_permissions()
    def post(self, request, pk):
        notice = get_object_or_404(Notice, pk=pk)
        notice.manually_expired = False
        notice.update_status()
        notice.save()
        return Response({'message': 'Notice restored successfully', 'status': notice.status})


class NoticeUpdateStatusesView(APIView):
    permission_classes = [IsAuthenticated, HasRequiredPermission]

    def get_permissions(self):
        self.required_permission_id = [PERMISSION_EDIT_NOTICE_BOARD]
        return super().get_permissions()
    def post(self, request):
        notices = Notice.objects.all()
        updated_count = 0
        for notice in notices:
            old_status = notice.status
            notice.update_status()
            if notice.status != old_status:
                updated_count += 1
        return Response({'message': f'Updated {updated_count} notice statuses', 'updated_count': updated_count})


class NoticeAttachmentListCreateView(APIView):
    permission_classes = [IsAuthenticated, HasRequiredPermission]
    parser_classes = [MultiPartParser, FormParser]

    def get_permissions(self):
        if self.request.method == "GET":
            self.required_permission_id = [
                PERMISSION_VIEW_NOTICE_BOARD,
                PERMISSION_ADD_NOTICE_BOARD,
                PERMISSION_EDIT_NOTICE_BOARD,
            ]
        else:
            self.required_permission_id = [
                PERMISSION_ADD_NOTICE_BOARD,
                PERMISSION_EDIT_NOTICE_BOARD,
            ]
        return super().get_permissions()

    def get(self, request):
        notice_id = request.query_params.get('notice_id')
        if notice_id:
            attachments = NoticeAttachment.objects.filter(notice_id=notice_id)
        else:
            attachments = NoticeAttachment.objects.all()
        serializer = NoticeAttachmentSerializer(attachments, many=True, context={'request': request})
        return Response(serializer.data)

    def post(self, request):
        serializer = NoticeAttachmentSerializer(data=request.data, context={'request': request})
        if serializer.is_valid():
            serializer.save()
            return Response(serializer.data, status=status.HTTP_201_CREATED)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


class NoticeAttachmentDetailView(APIView):
    permission_classes = [IsAuthenticated, HasRequiredPermission]

    def get_object(self, pk):
        return get_object_or_404(NoticeAttachment, pk=pk)

    def get_permissions(self):
        if self.request.method == "GET":
            self.required_permission_id = [
                PERMISSION_VIEW_NOTICE_BOARD,
                PERMISSION_ADD_NOTICE_BOARD,
                PERMISSION_EDIT_NOTICE_BOARD,
            ]
        else:
            self.required_permission_id = [PERMISSION_EDIT_NOTICE_BOARD]
        return super().get_permissions()

    def get(self, request, pk):
        attachment = self.get_object(pk)
        serializer = NoticeAttachmentSerializer(attachment, context={'request': request})
        return Response(serializer.data)

    def delete(self, request, pk):
        attachment = self.get_object(pk)
        attachment.file.delete(save=False)
        attachment.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)


class TowerListView(APIView):
    """
    API view to get all towers for notice targeting
    """
    permission_classes = [IsAuthenticated, HasRequiredPermission]

    def get_permissions(self):
        self.required_permission_id = [
            PERMISSION_VIEW_NOTICE_BOARD,
            PERMISSION_ADD_NOTICE_BOARD,
            PERMISSION_EDIT_NOTICE_BOARD,
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
            PERMISSION_VIEW_NOTICE_BOARD,
            PERMISSION_ADD_NOTICE_BOARD,
            PERMISSION_EDIT_NOTICE_BOARD,
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
            PERMISSION_VIEW_NOTICE_BOARD,
            PERMISSION_ADD_NOTICE_BOARD,
            PERMISSION_EDIT_NOTICE_BOARD,
        ]
        return super().get_permissions()

    def post(self, request):
        unit_ids = request.data.get('unit_ids', [])

        # Filter out non-numeric values like 'All'
        try:
            unit_ids = [int(uid) for uid in unit_ids if str(uid).isdigit()]
        except (ValueError, TypeError):
            return Response({'error': 'Invalid unit_ids format'}, status=status.HTTP_400_BAD_REQUEST)

        if not unit_ids:
            return Response({}, status=status.HTTP_200_OK)  # Return empty dict instead of error

        try:
            # Import here to avoid circular imports
            from towers.models import Unit, Resident, Owner, UnitStaff
            from django.db import models

            # Optimized bulk fetch with only necessary fields
            # Bulk fetch all data - only include active community members
            residents = list(Resident.objects.filter(
                unit_id__in=unit_ids,
                is_active=True,
                member__is_comm_member=True
            ).values('unit_id').annotate(count=models.Count('id')))
            
            owners = list(Owner.objects.filter(
                unit_id__in=unit_ids,
                member__is_comm_member=True
            ).values('unit_id').annotate(count=models.Count('id')))
            
            unit_staff = list(UnitStaff.objects.filter(
                unit_id__in=unit_ids,
                is_active=True,
                member__is_comm_member=True
            ).values('unit_id').annotate(count=models.Count('id')))

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


class NoticeLabelsView(APIView):
    """
    API view to get all unique notice labels
    """
    permission_classes = [IsAuthenticated, HasRequiredPermission]

    def get_permissions(self):
        self.required_permission_id = [
            PERMISSION_VIEW_NOTICE_BOARD,
            PERMISSION_ADD_NOTICE_BOARD,
            PERMISSION_EDIT_NOTICE_BOARD,
        ]
        return super().get_permissions()

    def get(self, request):
        # Get all label strings from notices
        label_strings = Notice.objects.exclude(
            models.Q(label__isnull=True) | models.Q(label__exact='')
        ).values_list('label', flat=True).distinct()

        # Split comma-separated labels and create a unique set
        unique_labels = set()
        for label_string in label_strings:
            if label_string:
                # Split by comma and clean up each label
                individual_labels = [label.strip() for label in label_string.split(',')]
                # Add non-empty labels to the set
                for label in individual_labels:
                    if label:  # Only add non-empty labels
                        unique_labels.add(label)

        # Convert set to sorted list for consistent ordering
        return Response(sorted(list(unique_labels)))
