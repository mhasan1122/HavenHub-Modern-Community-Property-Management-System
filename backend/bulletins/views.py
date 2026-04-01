from rest_framework import status
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from rest_framework.views import APIView
from rest_framework.parsers import MultiPartParser, FormParser, JSONParser
from django.db.models import Q, Prefetch
from django.db import models, transaction
from django.core.files.base import ContentFile
import base64
import uuid
import json
from django.shortcuts import get_object_or_404

from user.permissions import HasRequiredPermission
from group_role.permission_constants import (
    PERMISSION_ADD_BULLETIN_BOARD,
    PERMISSION_EDIT_BULLETIN_BOARD,
    PERMISSION_VIEW_BULLETIN_BOARD,
    PERMISSION_APPROVE_REJECT_BULLETIN_BOARD,
)

from .models import Bulletin, BulletinAttachment, BulletinHistory, BulletinReport
from .serializers import (
    BulletinSerializer,
    BulletinListSerializer,
    BulletinAttachmentSerializer,
    BulletinHistorySerializer,
    BulletinReportSerializer
)
from towers.models import Tower, Unit
from user.models import Member


class BulletinListCreateView(APIView):
    permission_classes = [IsAuthenticated, HasRequiredPermission]
    parser_classes = [MultiPartParser, FormParser, JSONParser]

    def get_permissions(self):
        if self.request.method == "GET":
            self.required_permission_id = [
                PERMISSION_VIEW_BULLETIN_BOARD,
                PERMISSION_ADD_BULLETIN_BOARD,
                PERMISSION_EDIT_BULLETIN_BOARD,
            ]
        elif self.request.method == "POST":
            self.required_permission_id = [PERMISSION_ADD_BULLETIN_BOARD]
        else:
            self.required_permission_id = []
        return super().get_permissions()

    def get(self, request):
        # Build optimized queryset with minimal data loading
        queryset = Bulletin.objects.select_related(
            'creator',
            'posted_group',
            'posted_member'
        ).prefetch_related(
            Prefetch('attachments', queryset=BulletinAttachment.objects.only(
                'id', 'bulletin_id', 'file', 'file_name', 'file_type', 'file_size', 'created_at'
            )),
            Prefetch('target_towers', queryset=Tower.objects.only('id', 'tower_name', 'tower_number')),
            Prefetch('target_units', queryset=Unit.objects.select_related('floor__tower').only(
                'id', 'unit_name', 'floor__tower__id', 'floor__tower__tower_name'
            ))
        ).only(
            'id', 'title', 'description', 'creator', 'post_as', 'posted_group', 'posted_member',
            'group_name', 'member_name', 'priority', 'label', 'status', 'views', 'is_pinned',
            'created_at', 'updated_at'
        )

        # Apply filters early to reduce dataset size
        status_filter = request.query_params.get('status', None)
        if status_filter:
            queryset = queryset.filter(status=status_filter)

        # Search functionality - enhanced to search by title, creator name, and description
        search = request.query_params.get('search', None)
        if search:
            queryset = queryset.filter(
                Q(title__icontains=search) |
                Q(description__icontains=search) |
                Q(creator__full_name__icontains=search) |
                Q(posted_group__group_name__icontains=search) |
                Q(posted_member__full_name__icontains=search)
            )

        # Filter by priority if provided
        priority_filter = request.query_params.get('priority', None)
        if priority_filter:
            priorities = [p.strip().lower() for p in priority_filter.split(',')]
            queryset = queryset.filter(priority__in=priorities)

        # Filter by labels if provided - improved label filtering
        label_filter = request.query_params.get('labels', None)
        if label_filter:
            labels = [l.strip() for l in label_filter.split(',') if l.strip()]
            label_q = Q()
            for label in labels:
                label_q |= Q(label__icontains=label)
            queryset = queryset.filter(label_q)

        # Date range filter
        date_from = request.query_params.get('date_from', None)
        date_to = request.query_params.get('date_to', None)
        if date_from:
            try:
                from datetime import datetime
                date_from_obj = datetime.strptime(date_from, '%Y-%m-%d').date()
                queryset = queryset.filter(created_at__date__gte=date_from_obj)
            except ValueError:
                pass
        if date_to:
            try:
                from datetime import datetime
                date_to_obj = datetime.strptime(date_to, '%Y-%m-%d').date()
                queryset = queryset.filter(created_at__date__lte=date_to_obj)
            except ValueError:
                pass

        # Filter by creator name specifically
        creator_filter = request.query_params.get('creator', None)
        if creator_filter:
            queryset = queryset.filter(creator__full_name__icontains=creator_filter)

        # Filter by my_posts if provided OR if status is pending (always show user's own pending posts)
        my_posts = request.query_params.get('my_posts', None)
        status_filter = request.query_params.get('status', None)
        
        # Resolve member BEFORE using it in the conditional check
        try:
            member = request.user.member
        except Exception as e:
            print(f"DEBUG: Exception getting member profile: {e}")
            from user.models import Member
            member = Member.objects.filter(user=request.user).first()
        
        # Always filter to show only user's posts if:
        # 1. my_posts=true is explicitly requested, OR
        # 2. status=pending AND user is NOT an org member (admins see all pending for approval)
        should_filter_my_posts = (my_posts and my_posts.lower() == 'true') or (status_filter == 'pending' and member and not member.is_org_member)
        
        if should_filter_my_posts:
            print(f"DEBUG: Filtering to show user's posts (my_posts={my_posts}, status={status_filter}) for user: {request.user.username}")
            print(f"DEBUG: User has member profile: {member.full_name if member else 'None'}")

            if member:
                from group_role.models import GroupMembers
                # Get groups where the member belongs
                member_groups = GroupMembers.objects.filter(member=member).values_list('group', flat=True)
                print(f"DEBUG: Member belongs to groups: {list(member_groups)}")

                # Count bulletins before filtering
                before_count = queryset.count()
                print(f"DEBUG: Bulletins before user filter: {before_count}")

                queryset = queryset.filter(
                    Q(creator=member) |
                    Q(posted_member=member) |
                    Q(posted_group__in=member_groups)
                ).distinct()
                
                # Count bulletins after filtering
                after_count = queryset.count()
                print(f"DEBUG: Bulletins after user filter: {after_count}")
                print(f"DEBUG: Filter applied: creator={member.id}, posted_member={member.id}, posted_group__in={list(member_groups)}")
            else:
                print(f"DEBUG: No member profile found for user: {request.user.username}")
                # If user has no member record, return empty queryset
                queryset = queryset.none()
        else:
            # Apply Tower/Unit-based filtering for targeted delivery (only when not filtering by my_posts)
            # Filter bulletins based on the logged-in user's tower/unit assignments
            try:
                from notifications.utils import get_communication_access_q_object
                
                # Detect mobile requests by X-App-Source header
                is_mobile = request.headers.get('X-App-Source', '').lower() == 'mobile'
                
                # Get access Q object (mobile users see only their tower/unit items)
                access_q = get_communication_access_q_object(member, is_mobile=is_mobile)
                
                # Apply filter
                queryset = queryset.filter(access_q).distinct()
                    
            except Exception as e:
                print(f"Error filtering bulletins by tower/unit targeting: {e}")
                import traceback
                traceback.print_exc()
                # On error, don't filter (show all) for backward compatibility

        # Order by pinned status first, then by creation date (uses indexes)
        queryset = queryset.order_by('-is_pinned', '-created_at')

        # Filter out bulletins by block relationship (mobile app only; web app sees all)
        is_mobile = request.headers.get('X-App-Source', '').lower() == 'mobile'
        if is_mobile:
            try:
                from user.models import BlockedUser
                if member:
                    # 1) I blocked them: hide their posts from me
                    blocked_by_me = BlockedUser.objects.filter(
                        blocker=member
                    ).values_list('blocked_id', flat=True)
                    if blocked_by_me:
                        queryset = queryset.exclude(creator_id__in=blocked_by_me)
                    # 2) They blocked me: I don't see their posts
                    blocked_me = BlockedUser.objects.filter(
                        blocked=member
                    ).values_list('blocker_id', flat=True)
                    if blocked_me:
                        queryset = queryset.exclude(creator_id__in=blocked_me)
            except Exception as e:
                print(f"Error filtering blocked users from bulletins: {e}")

        
        # Limit results to prevent excessive data transfer
        limit = request.query_params.get('limit', None)
        if limit:
            try:
                queryset = queryset[:int(limit)]
            except ValueError:
                pass
        
        # Use lightweight serializer for list view
        serializer = BulletinListSerializer(queryset, many=True, context={'request': request})
        
        # Add cache headers for better performance
        response = Response(serializer.data)
        response['Cache-Control'] = 'max-age=30, must-revalidate'  # Cache for 30 seconds
        return response

    def _is_valid_file(self, file):
        """
        Validate file type and size
        """
        allowed_extensions = ['jpg', 'jpeg', 'png', 'gif', 'bmp', 'tiff', 'webp', 'pdf', 'doc', 'docx']
        max_size = 10 * 1024 * 1024  # 10MB

        if file.size > max_size:
            return False

        file_extension = file.name.split('.')[-1].lower()
        return file_extension in allowed_extensions

    def _create_attachment_from_base64(self, bulletin, attachment_data):
        """
        Create attachment from base64 data
        """
        file_data = attachment_data.get('file_data')
        file_name = attachment_data.get('file_name')
        file_type = attachment_data.get('file_type', 'application/octet-stream')

        if not file_data or not file_name:
            return None

        try:
            # Decode base64 data
            format, imgstr = file_data.split(';base64,')
            ext = format.split('/')[-1]

            # Create file from base64
            file_content = ContentFile(base64.b64decode(imgstr), name=f"{uuid.uuid4()}.{ext}")

            # Create attachment
            attachment = BulletinAttachment.objects.create(
                bulletin=bulletin,
                file=file_content,
                file_name=file_name,
                file_type=file_type,
                file_size=len(base64.b64decode(imgstr))
            )
            return attachment
        except Exception as e:
            print(f"Error creating attachment from base64: {e}")
            return None

    def _process_ids(self, ids_data):
        """
        Helper function to process ID arrays from form data
        Handles various formats including empty strings, nested lists, and JSON strings
        """
        if not ids_data:
            return []

        processed_ids = []
        for item in ids_data:
            try:
                if isinstance(item, list):
                    # Handle nested lists
                    for nested_item in item:
                        if str(nested_item).strip().isdigit():
                            processed_ids.append(int(nested_item))
                elif isinstance(item, str):
                    # Skip empty strings and whitespace-only strings
                    if item.strip() and str(item).strip().isdigit():
                        processed_ids.append(int(item))
                elif isinstance(item, (int, float)):
                    # Handle numeric types
                    if item > 0:  # Only positive IDs are valid
                        processed_ids.append(int(item))
                elif str(item).strip().isdigit():
                    processed_ids.append(int(item))
            except (ValueError, TypeError):
                # Skip invalid items silently
                continue

        return processed_ids

    def post(self, request):
        """
        Create a new bulletin
        """
        # Don't copy request.data directly as it may contain file objects that can't be pickled
        data = request.data
        files = request.FILES.getlist('attachments', [])

        # Handle base64 attachments
        base64_attachments = []
        if 'base64_attachments' in data:
            try:
                base64_data = data.get('base64_attachments')
                if isinstance(base64_data, list):
                    base64_attachments = json.loads(base64_data[0])
                else:
                    base64_attachments = json.loads(base64_data)
            except (json.JSONDecodeError, IndexError, TypeError):
                base64_attachments = []

        # Debug logging (can be removed in production)
        # print(f"=== BULLETIN CREATE DEBUG ===")
        # print(f"Raw target_tower_ids: {data.getlist('target_tower_ids') if 'target_tower_ids' in data else 'Not present'}")
        # print(f"Raw target_unit_ids: {data.getlist('target_unit_ids') if 'target_unit_ids' in data else 'Not present'}")

        # Create a new dictionary with processed data instead of modifying the original
        processed_data = {}

        # Copy all existing data (excluding file-related keys that can't be copied)
        for key in data.keys():
            if key not in ['target_tower_ids', 'target_unit_ids', 'attachments', 'base64_attachments']:
                value = data.get(key)
                # Handle list values properly
                if hasattr(value, '__iter__') and not isinstance(value, (str, bytes)):
                    processed_data[key] = list(value)
                else:
                    processed_data[key] = value

        # Process tower and unit IDs BEFORE serializer validation
        if 'target_tower_ids' in data:
            raw_tower_ids = data.getlist('target_tower_ids')
            processed_tower_ids = self._process_ids(raw_tower_ids)
            processed_data['target_tower_ids'] = processed_tower_ids
        else:
            processed_data['target_tower_ids'] = []

        if 'target_unit_ids' in data:
            raw_unit_ids = data.getlist('target_unit_ids')
            processed_unit_ids = self._process_ids(raw_unit_ids)
            processed_data['target_unit_ids'] = processed_unit_ids
        else:
            processed_data['target_unit_ids'] = []

        # Handle labels (convert from array to comma-separated string)
        if 'label' in processed_data and isinstance(processed_data['label'], list):
            # Filter out empty labels and join with commas
            labels = [label.strip() for label in processed_data['label'] if label.strip()]
            processed_data['label'] = ', '.join(labels)

        # Debug: Print the final data being sent to serializer (can be removed in production)
        # print(f"=== FINAL PROCESSED DATA SENT TO SERIALIZER ===")
        # for key, value in processed_data.items():
        #     if key in ['target_tower_ids', 'target_unit_ids']:
        #         print(f"  {key}: {value} (type: {type(value)})")
        #         if isinstance(value, list) and len(value) > 0:
        #             print(f"    First few items: {value[:3]}")
        #             for i, item in enumerate(value[:3]):
        #                 print(f"      Item {i}: {item} (type: {type(item)})")
        #     else:
        #         print(f"  {key}: {value} (type: {type(value)})")
        # print(f"===============================================")

        serializer = BulletinSerializer(data=processed_data, context={'request': request})
        if not serializer.is_valid():
            return Response({'error': 'Validation failed', 'details': serializer.errors}, status=status.HTTP_400_BAD_REQUEST)

        bulletin = serializer.save(creator=request.user.member)

        # Handle file attachments
        for file in files:
            if not self._is_valid_file(file):
                continue
            BulletinAttachment.objects.create(
                bulletin=bulletin,
                file=file,
                file_name=file.name,
                file_type=file.content_type,
                file_size=file.size
            )

        # Handle base64 attachments
        for attachment_data in base64_attachments:
            try:
                self._create_attachment_from_base64(bulletin, attachment_data)
            except Exception as e:
                print(f"Error processing base64 attachment: {e}")
                continue

        # Send notifications based on bulletin status
        # This should work regardless of whether towers/units are selected
        try:
            from notifications.utils import create_bulletin_needs_approval_notification
            
            # Refresh bulletin from DB to ensure we have the latest status
            bulletin.refresh_from_db()
            
            print(f"DEBUG: Bulletin {bulletin.id} created with status: {bulletin.status}")
            print(f"DEBUG: Bulletin has {bulletin.target_towers.count()} towers and {bulletin.target_units.count()} units")
            
            if bulletin.status == 'current':
                # Admin created and auto-approved bulletin
                from notifications.utils import create_bulletin_posted_notification
                create_bulletin_posted_notification(bulletin)
            elif bulletin.status == 'pending':
                # Bulletin needs approval, send to approvers only
                # This works regardless of whether towers/units are selected
                print(f"DEBUG: Creating bulletin needs approval notifications for bulletin {bulletin.id}")
                print(f"DEBUG: Bulletin creator: {bulletin.creator} (id: {bulletin.creator.id if bulletin.creator else 'None'})")
                print(f"DEBUG: This notification is sent to users with approval permission, not based on towers/units")
                notifications_created = create_bulletin_needs_approval_notification(bulletin)
                print(f"DEBUG: Created {len(notifications_created)} approval notifications")
                if len(notifications_created) == 0:
                    print(f"WARNING: No approval notifications were created. Check if users have approval permission.")
                    print(f"WARNING: Creator ID: {bulletin.creator.id if bulletin.creator else 'None'}")
                    print(f"WARNING: Request user member ID: {request.user.member.id if hasattr(request.user, 'member') and request.user.member else 'None'}")
            else:
                print(f"DEBUG: Bulletin status is '{bulletin.status}', no notifications sent")
        except Exception as e:
            print(f"ERROR: Error creating bulletin notifications: {e}")
            import traceback
            traceback.print_exc()

        return Response(serializer.data, status=status.HTTP_201_CREATED)


class BulletinDetailView(APIView):
    permission_classes = [IsAuthenticated, HasRequiredPermission]
    parser_classes = [MultiPartParser, FormParser, JSONParser]

    def get_permissions(self):
        if self.request.method == "GET":
            self.required_permission_id = [
                PERMISSION_VIEW_BULLETIN_BOARD,
                PERMISSION_ADD_BULLETIN_BOARD,
                PERMISSION_EDIT_BULLETIN_BOARD,
            ]
        else:
            self.required_permission_id = [PERMISSION_EDIT_BULLETIN_BOARD]
        return super().get_permissions()

    def get_object(self, pk):
        try:
            return Bulletin.objects.select_related('creator', 'posted_group', 'posted_member').prefetch_related('attachments', 'target_towers', 'target_units', 'history').get(pk=pk)
        except Bulletin.DoesNotExist:
            return None

    def _process_ids(self, ids_data):
        """
        Helper function to process ID arrays from form data
        Handles various formats including empty strings, nested lists, and JSON strings
        """
        if not ids_data:
            return []

        processed_ids = []
        for item in ids_data:
            try:
                if isinstance(item, list):
                    # Handle nested lists
                    for nested_item in item:
                        if str(nested_item).strip().isdigit():
                            processed_ids.append(int(nested_item))
                elif isinstance(item, str):
                    # Skip empty strings and whitespace-only strings
                    if item.strip() and str(item).strip().isdigit():
                        processed_ids.append(int(item))
                elif isinstance(item, (int, float)):
                    # Handle numeric types
                    if item > 0:  # Only positive IDs are valid
                        processed_ids.append(int(item))
                elif str(item).strip().isdigit():
                    processed_ids.append(int(item))
            except (ValueError, TypeError):
                # Skip invalid items silently
                continue

        return processed_ids

    def _is_valid_file(self, file):
        """
        Validate file type and size
        """
        allowed_extensions = ['jpg', 'jpeg', 'png', 'gif', 'bmp', 'tiff', 'webp', 'pdf', 'doc', 'docx']
        max_size = 10 * 1024 * 1024  # 10MB

        if file.size > max_size:
            return False

        file_extension = file.name.split('.')[-1].lower()
        return file_extension in allowed_extensions

    def _create_attachment_from_base64(self, bulletin, attachment_data):
        """
        Create attachment from base64 data
        """
        file_data = attachment_data.get('file_data')
        file_name = attachment_data.get('file_name', 'attachment')
        file_type = attachment_data.get('file_type', 'application/octet-stream')

        if not file_data:
            return None

        try:
            # Decode base64 data
            format, imgstr = file_data.split(';base64,')
            ext = format.split('/')[-1]

            # Create file from base64
            file_content = ContentFile(base64.b64decode(imgstr), name=f"{uuid.uuid4()}.{ext}")

            # Create attachment
            attachment = BulletinAttachment.objects.create(
                bulletin=bulletin,
                file=file_content,
                file_name=file_name,
                file_type=file_type,
                file_size=len(base64.b64decode(imgstr))
            )
            return attachment
        except Exception as e:
            print(f"Error creating attachment from base64: {e}")
            return None

    def get(self, request, pk):
        bulletin = self.get_object(pk)
        if not bulletin:
            return Response({'error': 'Bulletin not found'}, status=status.HTTP_404_NOT_FOUND)

        serializer = BulletinSerializer(bulletin, context={'request': request})
        return Response(serializer.data)

    def patch(self, request, pk):
        bulletin = self.get_object(pk)
        if not bulletin:
            return Response({'error': 'Bulletin not found'}, status=status.HTTP_404_NOT_FOUND)

        # Store original values for change tracking
        original_values = {
            'title': bulletin.title,
            'description': bulletin.description,
            'priority': bulletin.priority,
            'label': bulletin.label,
            'post_as': bulletin.post_as,
            'target_towers': list(bulletin.target_towers.values_list('id', flat=True)),
            'target_units': list(bulletin.target_units.values_list('id', flat=True)),
            'attachments': list(bulletin.attachments.values_list('id', flat=True))
        }

        data = request.data
        files = request.FILES.getlist('attachments', [])

        # Capture source tab information for history tracking
        source_tab = data.get('source_tab', '1')  # Default to tab 1 if not provided

        # Create a processed data dictionary
        processed_data = {}

        # Copy basic fields from request data
        for key in ['title', 'description', 'priority', 'label', 'post_as', 'posted_group', 'posted_member']:
            if key in data:
                processed_data[key] = data[key]

        # Handle base64 attachments
        base64_attachments = []
        if 'base64_attachments' in data:
            try:
                base64_attachments = json.loads(data.getlist('base64_attachments')[0])
            except (json.JSONDecodeError, IndexError):
                base64_attachments = []

        # Handle attachment deletions
        attachments_to_delete = data.getlist('attachments_to_delete', [])
        deleted_attachments = []
        if attachments_to_delete:
            deleted_attachments = list(BulletinAttachment.objects.filter(
                id__in=attachments_to_delete, bulletin=bulletin
            ).values_list('file_name', flat=True))
            BulletinAttachment.objects.filter(id__in=attachments_to_delete, bulletin=bulletin).delete()

        # Process tower and unit IDs BEFORE serializer validation
        if 'target_tower_ids' in data:
            raw_tower_ids = data.getlist('target_tower_ids')
            processed_tower_ids = self._process_ids(raw_tower_ids)
            processed_data['target_tower_ids'] = processed_tower_ids
        else:
            processed_data['target_tower_ids'] = []

        if 'target_unit_ids' in data:
            raw_unit_ids = data.getlist('target_unit_ids')
            processed_unit_ids = self._process_ids(raw_unit_ids)
            processed_data['target_unit_ids'] = processed_unit_ids
        else:
            processed_data['target_unit_ids'] = []

        # Handle labels (convert from array to comma-separated string)
        if 'label' in processed_data and isinstance(processed_data['label'], list):
            labels = [label.strip() for label in processed_data['label'] if label.strip()]
            processed_data['label'] = ', '.join(labels)

        serializer = BulletinSerializer(bulletin, data=processed_data, partial=True, context={'request': request})
        if not serializer.is_valid():
            return Response({'error': 'Validation failed', 'details': serializer.errors}, status=status.HTTP_400_BAD_REQUEST)

        # Store the original status before saving
        original_status = bulletin.status

        # Save the bulletin with the updated data
        updated_bulletin = serializer.save()

        # Always set status to 'pending' after any edit, regardless of original status
        if updated_bulletin.status != 'pending':
            updated_bulletin.status = 'pending'
            updated_bulletin.save()

        # Handle new file attachments
        new_attachments = []
        for file in files:
            if not self._is_valid_file(file):
                continue
            attachment = BulletinAttachment.objects.create(
                bulletin=updated_bulletin,
                file=file,
                file_name=file.name,
                file_type=file.content_type,
                file_size=file.size
            )
            new_attachments.append(attachment.file_name)

        # Handle new base64 attachments
        for attachment_data in base64_attachments:
            try:
                attachment = self._create_attachment_from_base64(updated_bulletin, attachment_data)
                if attachment:
                    new_attachments.append(attachment.file_name)
            except Exception as e:
                print(f"Error processing base64 attachment: {e}")
                continue

        # Track changes and create history entry
        changes = {}

        # Check for field changes
        if original_values['title'] != updated_bulletin.title:
            changes['title'] = {'old': original_values['title'], 'new': updated_bulletin.title}
        if original_values['description'] != updated_bulletin.description:
            changes['description'] = {'old': original_values['description'], 'new': updated_bulletin.description}
        if original_values['priority'] != updated_bulletin.priority:
            changes['priority'] = {'old': original_values['priority'], 'new': updated_bulletin.priority}
        if original_values['label'] != updated_bulletin.label:
            changes['label'] = {'old': original_values['label'], 'new': updated_bulletin.label}
        if original_values['post_as'] != updated_bulletin.post_as:
            changes['post_as'] = {'old': original_values['post_as'], 'new': updated_bulletin.post_as}

        # Check tower changes
        new_tower_ids = list(updated_bulletin.target_towers.values_list('id', flat=True))
        if set(original_values['target_towers']) != set(new_tower_ids):
            changes['target_towers'] = {'old': original_values['target_towers'], 'new': new_tower_ids}

        # Check unit changes
        new_unit_ids = list(updated_bulletin.target_units.values_list('id', flat=True))
        if set(original_values['target_units']) != set(new_unit_ids):
            changes['target_units'] = {'old': original_values['target_units'], 'new': new_unit_ids}

        # Always record status change to pending (since we always set it to pending after edit)
        if original_status != 'pending':
            changes['status'] = {'old': original_status, 'new': 'pending'}

        # Check attachment changes
        if deleted_attachments:
            changes['attachments_deleted'] = deleted_attachments
        if new_attachments:
            changes['attachments_added'] = new_attachments

        # Create history entry if there were changes
        if changes:
            print(f"DEBUG: Creating history entry for bulletin {updated_bulletin.id} with changes: {changes}")

            # Add source tab information to changes for history tracking
            changes['source_tab'] = source_tab

            BulletinHistory.objects.create(
                bulletin=updated_bulletin,
                edited_by=request.user.member,
                changes=changes,
                action='updated',
                comment=f'Bulletin updated by {request.user.member.full_name}'
            )
            print(f"DEBUG: History entry created successfully")
        
        # Send notification if bulletin is pending after update
        # Always send notification when a bulletin is updated (regardless of whether changes were detected)
        if updated_bulletin.status == 'pending':
            try:
                from notifications.utils import create_bulletin_updated_notification
                print(f"DEBUG: Sending update notification for bulletin {updated_bulletin.id} (original status: {original_status})")
                notifications_created = create_bulletin_updated_notification(updated_bulletin, original_status=original_status)
                print(f"DEBUG: Created {len(notifications_created)} update notifications")
            except Exception as e:
                print(f"Error creating bulletin update notification: {e}")
                import traceback
                traceback.print_exc()

        return Response(serializer.data)

    def delete(self, request, pk):
        bulletin = self.get_object(pk)
        if not bulletin:
            return Response({'error': 'Bulletin not found'}, status=status.HTTP_404_NOT_FOUND)

        bulletin.delete()
        return Response({'message': 'Bulletin deleted successfully'}, status=status.HTTP_204_NO_CONTENT)


class BulletinByStatusView(APIView):
    permission_classes = [IsAuthenticated, HasRequiredPermission]

    def get_permissions(self):
        self.required_permission_id = [
            PERMISSION_VIEW_BULLETIN_BOARD,
            PERMISSION_ADD_BULLETIN_BOARD,
            PERMISSION_EDIT_BULLETIN_BOARD,
        ]
        return super().get_permissions()

    def get(self, request):
        base_queryset = Bulletin.objects.select_related('creator', 'posted_group', 'posted_member').prefetch_related('attachments', 'target_towers', 'target_units', 'history')
        current = base_queryset.filter(status='current')
        pending = base_queryset.filter(status='pending')
        archive = base_queryset.filter(status='archive')

        return Response({
            'current': BulletinListSerializer(current, many=True, context={'request': request}).data,
            'pending': BulletinListSerializer(pending, many=True, context={'request': request}).data,
            'archive': BulletinListSerializer(archive, many=True, context={'request': request}).data,
        })


class BulletinTogglePinView(APIView):
    permission_classes = [IsAuthenticated, HasRequiredPermission]

    def get_permissions(self):
        self.required_permission_id = [PERMISSION_EDIT_BULLETIN_BOARD]
        return super().get_permissions()

    def post(self, request, pk):
        try:
            bulletin = Bulletin.objects.get(pk=pk)

            # Check if bulletin can be pinned (only current status bulletins can be pinned)
            if not bulletin.is_pinned and bulletin.status != 'current':
                return Response({
                    'error': f'Only current bulletins can be pinned. This bulletin has status: {bulletin.status}',
                }, status=status.HTTP_400_BAD_REQUEST)

            # If trying to pin a bulletin, check the pin limit
            if not bulletin.is_pinned:
                # Count current pinned bulletins in 'current' status
                pinned_count = Bulletin.objects.filter(
                    is_pinned=True,
                    status='current'
                ).count()

                if pinned_count >= 3:
                    return Response({
                        'error': 'Maximum 3 bulletins can be pinned at a time. Please unpin another bulletin first.',
                        'pinned_count': pinned_count,
                        'max_pins': 3
                    }, status=status.HTTP_400_BAD_REQUEST)

            # Toggle pin status with database transaction
            with transaction.atomic():
                old_status = bulletin.is_pinned
                bulletin.is_pinned = not bulletin.is_pinned
                bulletin.save()

                # Create history entry for pin/unpin action
                action_type = "pinned" if bulletin.is_pinned else "unpinned"

                # Get member safely - only create history if member exists
                try:
                    member = request.user.member
                    BulletinHistory.objects.create(
                        bulletin=bulletin,
                        edited_by=member,
                        changes={'is_pinned': {'old': old_status, 'new': bulletin.is_pinned}},
                        action='updated',
                        comment=f'Bulletin {action_type} by admin'
                    )
                except AttributeError:
                    # Skip history creation if user doesn't have a member profile
                    pass
                except Exception:
                    # Don't fail the entire operation if history creation fails
                    pass

            return Response({
                'message': f'Bulletin {action_type} successfully',
                'is_pinned': bulletin.is_pinned
            })
        except Bulletin.DoesNotExist:
            return Response({'error': 'Bulletin not found'}, status=status.HTTP_404_NOT_FOUND)
        except Exception as e:
            return Response({'error': str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


class BulletinIncrementViewsView(APIView):
    permission_classes = [IsAuthenticated, HasRequiredPermission]

    def get_permissions(self):
        self.required_permission_id = [
            PERMISSION_VIEW_BULLETIN_BOARD,
            PERMISSION_ADD_BULLETIN_BOARD,
            PERMISSION_EDIT_BULLETIN_BOARD,
        ]
        return super().get_permissions()

    def post(self, request, pk):
        try:
            bulletin = Bulletin.objects.get(pk=pk)
            bulletin.views += 1
            bulletin.save()
            return Response({'views': bulletin.views})
        except Bulletin.DoesNotExist:
            return Response({'error': 'Bulletin not found'}, status=status.HTTP_404_NOT_FOUND)


class BulletinApproveView(APIView):
    permission_classes = [IsAuthenticated, HasRequiredPermission]

    def get_permissions(self):
        self.required_permission_id = [PERMISSION_APPROVE_REJECT_BULLETIN_BOARD]
        return super().get_permissions()

    def post(self, request, pk):
        try:
            bulletin = Bulletin.objects.get(pk=pk)
            comment = request.data.get('comment', '')

            # Validate comment word count
            if comment and comment.strip():
                word_count = len(comment.strip().split())
                if word_count > 50:
                    return Response({
                        'error': f'Comment cannot exceed 50 words. Current word count: {word_count}'
                    }, status=status.HTTP_400_BAD_REQUEST)

            # Update status to current
            bulletin.status = 'current'
            bulletin.save()
            
            # Capture approval timestamp for notification
            from django.utils import timezone
            approval_timestamp = timezone.now()

            # Create history entry
            BulletinHistory.objects.create(
                bulletin=bulletin,
                edited_by=request.user.member,
                changes={'status': {'old': 'pending', 'new': 'current'}},
                comment=comment,
                action='approved'
            )

            # Send notifications
            try:
                from notifications.utils import create_bulletin_approved_notification, create_bulletin_posted_notification
                # 1. Notify the creator that their post was approved
                create_bulletin_approved_notification(bulletin, approver=request.user.member, comment=comment)
                
                # 2. Notify ALL targeted members that a new bulletin has been published
                create_bulletin_posted_notification(bulletin, approval_timestamp=approval_timestamp)
            except Exception as e:
                print(f"Error creating bulletin notifications: {e}")

            return Response({
                'message': 'Bulletin approved successfully',
                'status': bulletin.status
            })
        except Bulletin.DoesNotExist:
            return Response({'error': 'Bulletin not found'}, status=status.HTTP_404_NOT_FOUND)


class BulletinRejectView(APIView):
    permission_classes = [IsAuthenticated, HasRequiredPermission]

    def get_permissions(self):
        self.required_permission_id = [PERMISSION_APPROVE_REJECT_BULLETIN_BOARD]
        return super().get_permissions()

    def post(self, request, pk):
        try:
            bulletin = Bulletin.objects.get(pk=pk)
            comment = request.data.get('comment', '')

            # Validate comment word count
            if comment and comment.strip():
                word_count = len(comment.strip().split())
                if word_count > 50:
                    return Response({
                        'error': f'Comment cannot exceed 50 words. Current word count: {word_count}'
                    }, status=status.HTTP_400_BAD_REQUEST)

            # Store old status for history
            old_status = bulletin.status

            # Update status to archive
            bulletin.status = 'archive'
            bulletin.save()

            # Create history entry
            BulletinHistory.objects.create(
                bulletin=bulletin,
                edited_by=request.user.member,
                changes={'status': {'old': old_status, 'new': 'archive'}},
                comment=comment,
                action='rejected'
            )
            
            # Send rejection notification to the bulletin creator
            try:
                from notifications.utils import create_bulletin_rejected_notification
                print(f"DEBUG: Sending rejection notification for bulletin {bulletin.id}")
                notifications_created = create_bulletin_rejected_notification(
                    bulletin=bulletin,
                    rejector=request.user.member,
                    comment=comment
                )
                print(f"DEBUG: Created {len(notifications_created)} rejection notifications")
            except Exception as e:
                print(f"ERROR: Error creating bulletin rejection notification: {e}")
                import traceback
                traceback.print_exc()

            return Response({
                'message': 'Bulletin rejected successfully',
                'status': bulletin.status
            })
        except Bulletin.DoesNotExist:
            return Response({'error': 'Bulletin not found'}, status=status.HTTP_404_NOT_FOUND)


class BulletinAddCommentView(APIView):
    permission_classes = [IsAuthenticated, HasRequiredPermission]

    def get_permissions(self):
        self.required_permission_id = [PERMISSION_EDIT_BULLETIN_BOARD]
        return super().get_permissions()

    def post(self, request, pk):
        try:
            bulletin = Bulletin.objects.get(pk=pk)
            comment = request.data.get('comment', '')

            if not comment.strip():
                return Response({'error': 'Comment cannot be empty'}, status=status.HTTP_400_BAD_REQUEST)

            # Validate comment word count
            word_count = len(comment.strip().split())
            if word_count > 50:
                return Response({
                    'error': f'Comment cannot exceed 50 words. Current word count: {word_count}'
                }, status=status.HTTP_400_BAD_REQUEST)

            # Create history entry with comment only
            BulletinHistory.objects.create(
                bulletin=bulletin,
                edited_by=request.user.member,
                changes={},  # No changes, just a comment
                comment=comment,
                action='updated'
            )

            # Send notification to the bulletin creator about the admin comment
            # Only send if the commenter is not the creator (admin commenting on user's post)
            if bulletin.creator and bulletin.creator.id != request.user.member.id:
                try:
                    from notifications.utils import create_bulletin_admin_comment_notification
                    create_bulletin_admin_comment_notification(
                        bulletin=bulletin,
                        commenter=request.user.member,
                        comment=comment
                    )
                except Exception as e:
                    print(f"Error creating admin comment notification: {e}")

            return Response({
                'message': 'Comment added successfully'
            })
        except Bulletin.DoesNotExist:
            return Response({'error': 'Bulletin not found'}, status=status.HTTP_404_NOT_FOUND)


class BulletinMoveToArchiveView(APIView):
    permission_classes = [IsAuthenticated, HasRequiredPermission]

    def get_permissions(self):
        self.required_permission_id = [PERMISSION_EDIT_BULLETIN_BOARD]
        return super().get_permissions()

    def post(self, request, pk):
        try:
            bulletin = Bulletin.objects.get(pk=pk)
            old_status = bulletin.status
            bulletin.status = 'archive'
            bulletin.save()

            # Create history entry for move to archive action
            BulletinHistory.objects.create(
                bulletin=bulletin,
                edited_by=request.user.member,
                changes={'status': {'old': old_status, 'new': 'archive'}},
                comment='',
                action='archived'
            )

            return Response({
                'message': 'Bulletin moved to archive successfully',
                'status': bulletin.status
            })
        except Bulletin.DoesNotExist:
            return Response({'error': 'Bulletin not found'}, status=status.HTTP_404_NOT_FOUND)


class BulletinRestoreView(APIView):
    permission_classes = [IsAuthenticated, HasRequiredPermission]

    def get_permissions(self):
        self.required_permission_id = [PERMISSION_EDIT_BULLETIN_BOARD]
        return super().get_permissions()

    def post(self, request, pk):
        try:
            bulletin = Bulletin.objects.get(pk=pk)

            # Check the last history entry that moved the bulletin to archive
            # This could be either 'rejected' or 'archived' action
            last_archive_entry = bulletin.history.filter(
                action__in=['rejected', 'archived']
            ).order_by('-edited_at').first()

            if last_archive_entry and last_archive_entry.changes:
                # Get the old status from the archive history entry
                old_status = last_archive_entry.changes.get('status', {}).get('old', 'pending')
                bulletin.status = old_status
            else:
                # Default to pending if no archive history found
                bulletin.status = 'pending'

            bulletin.save()

            # Create history entry for restore action
            BulletinHistory.objects.create(
                bulletin=bulletin,
                edited_by=request.user.member,
                changes={'status': {'old': 'archive', 'new': bulletin.status}},
                comment='',
                action='restored'
            )

            return Response({
                'message': 'Bulletin restored successfully',
                'status': bulletin.status
            })
        except Bulletin.DoesNotExist:
            return Response({'error': 'Bulletin not found'}, status=status.HTTP_404_NOT_FOUND)


class BulletinAttachmentListCreateView(APIView):
    permission_classes = [IsAuthenticated, HasRequiredPermission]
    parser_classes = [MultiPartParser, FormParser]

    def get_permissions(self):
        if self.request.method == "GET":
            self.required_permission_id = [
                PERMISSION_VIEW_BULLETIN_BOARD,
                PERMISSION_ADD_BULLETIN_BOARD,
                PERMISSION_EDIT_BULLETIN_BOARD,
            ]
        else:
            self.required_permission_id = [
                PERMISSION_ADD_BULLETIN_BOARD,
                PERMISSION_EDIT_BULLETIN_BOARD,
            ]
        return super().get_permissions()

    def post(self, request):
        bulletin_id = request.data.get('bulletin_id')
        if not bulletin_id:
            return Response({'error': 'Bulletin ID is required'}, status=status.HTTP_400_BAD_REQUEST)

        try:
            bulletin = Bulletin.objects.get(pk=bulletin_id)
        except Bulletin.DoesNotExist:
            return Response({'error': 'Bulletin not found'}, status=status.HTTP_404_NOT_FOUND)

        serializer = BulletinAttachmentSerializer(data=request.data, context={'request': request})
        if serializer.is_valid():
            serializer.save(bulletin=bulletin)
            return Response(serializer.data, status=status.HTTP_201_CREATED)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


class BulletinAttachmentDetailView(APIView):
    permission_classes = [IsAuthenticated, HasRequiredPermission]
    parser_classes = [MultiPartParser, FormParser]

    def get_permissions(self):
        if self.request.method == "GET":
            self.required_permission_id = [
                PERMISSION_VIEW_BULLETIN_BOARD,
                PERMISSION_ADD_BULLETIN_BOARD,
                PERMISSION_EDIT_BULLETIN_BOARD,
            ]
        else:
            self.required_permission_id = [PERMISSION_EDIT_BULLETIN_BOARD]
        return super().get_permissions()

    def get_object(self, pk):
        try:
            return BulletinAttachment.objects.get(pk=pk)
        except BulletinAttachment.DoesNotExist:
            return None

    def get(self, request, pk):
        attachment = self.get_object(pk)
        if not attachment:
            return Response({'error': 'Attachment not found'}, status=status.HTTP_404_NOT_FOUND)

        serializer = BulletinAttachmentSerializer(attachment, context={'request': request})
        return Response(serializer.data)

    def patch(self, request, pk):
        attachment = self.get_object(pk)
        if not attachment:
            return Response({'error': 'Attachment not found'}, status=status.HTTP_404_NOT_FOUND)

        serializer = BulletinAttachmentSerializer(attachment, data=request.data, partial=True, context={'request': request})
        if serializer.is_valid():
            serializer.save()
            return Response(serializer.data)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

    def delete(self, request, pk):
        attachment = self.get_object(pk)
        if not attachment:
            return Response({'error': 'Attachment not found'}, status=status.HTTP_404_NOT_FOUND)

        attachment.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)


class BulletinHistoryView(APIView):
    """
    API view to get bulletin history
    """
    permission_classes = [IsAuthenticated, HasRequiredPermission]

    def get_permissions(self):
        self.required_permission_id = [
            PERMISSION_VIEW_BULLETIN_BOARD,
            PERMISSION_ADD_BULLETIN_BOARD,
            PERMISSION_EDIT_BULLETIN_BOARD,
        ]
        return super().get_permissions()

    def get(self, request, pk):
        try:
            bulletin = Bulletin.objects.prefetch_related('history').get(pk=pk)
            history_items = bulletin.history.all().order_by('-edited_at')
            serializer = BulletinHistorySerializer(history_items, many=True)
            return Response(serializer.data)
        except Bulletin.DoesNotExist:
            return Response({'error': 'Bulletin not found'}, status=status.HTTP_404_NOT_FOUND)


class BulletinLabelsView(APIView):
    """
    API view to get all unique labels from bulletins
    """
    permission_classes = [IsAuthenticated, HasRequiredPermission]

    def get_permissions(self):
        self.required_permission_id = [
            PERMISSION_VIEW_BULLETIN_BOARD,
            PERMISSION_ADD_BULLETIN_BOARD,
            PERMISSION_EDIT_BULLETIN_BOARD,
        ]
        return super().get_permissions()

    def get(self, request):
        # Get all unique labels from bulletins, excluding empty/null labels
        label_strings = Bulletin.objects.exclude(
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


class BulletinReportView(APIView):
    """
    API view to submit a report for a bulletin post
    """
    permission_classes = [IsAuthenticated]

    def post(self, request, pk):
        """
        Submit a report for a bulletin
        """
        try:
            bulletin = Bulletin.objects.get(pk=pk)
        except Bulletin.DoesNotExist:
            return Response({'error': 'Bulletin not found'}, status=status.HTTP_404_NOT_FOUND)

        # Prevent users from reporting their own posts
        creator_id = bulletin.creator.id if bulletin.creator else None
        reporter_id = request.user.member.id if hasattr(request.user, 'member') and request.user.member else None
        
        if creator_id and reporter_id and creator_id == reporter_id:
            return Response({
                'error': 'You cannot report your own bulletin post'
            }, status=status.HTTP_400_BAD_REQUEST)

        # Create report (allow multiple reports from the same user)
        report_data = {
            'bulletin': bulletin.id,
            'reason': request.data.get('reason'),
            'details': request.data.get('details', '')
        }

        serializer = BulletinReportSerializer(data=report_data, context={'request': request})
        if serializer.is_valid():
            report = serializer.save(reported_by=request.user.member)
            return Response({
                'message': 'Report submitted successfully',
                'report': serializer.data
            }, status=status.HTTP_201_CREATED)
        else:
            return Response({
                'error': 'Validation failed',
                'details': serializer.errors
            }, status=status.HTTP_400_BAD_REQUEST)
