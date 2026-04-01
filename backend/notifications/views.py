from rest_framework import status
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from rest_framework.views import APIView
from rest_framework.pagination import PageNumberPagination
from rest_framework.parsers import JSONParser
from django.db.models import Q
from django.db import transaction
from django.utils import timezone
import time

from .models import Notification, NotificationType, DeviceToken
from .serializers import NotificationSerializer, NotificationListSerializer
from .utils import has_view_permission, should_show_notification


def get_user_member(user):
    """
    Safely get the member associated with a user.
    Returns the member if it exists, None otherwise.
    """
    try:
        return user.member
    except Exception:
        # Catch RelatedObjectDoesNotExist and any other related exceptions
        return None


class NotificationPagination(PageNumberPagination):
    """
    Custom pagination for notifications
    Increased max_page_size to handle large notification volumes (e.g., 100+ announcements)
    """
    page_size = 20
    page_size_query_param = 'page_size'
    max_page_size = 500  # Increased from 100 to handle more notifications


class NotificationListView(APIView):
    """
    API view to list notifications for the authenticated user
    """
    permission_classes = [IsAuthenticated]
    pagination_class = NotificationPagination

    def get(self, request):
        # Track performance metrics
        start_time = time.time()
        
        member = get_user_member(request.user)
        if not member:
            return Response(
                {'error': 'User does not have an associated member profile.'},
                status=status.HTTP_400_BAD_REQUEST
            )
        print(f"[NOTIFICATION-API] Fetching notifications for member {member.id} ({member.full_name})")
        
        # OPTIMIZED: Use database-level filtering instead of Python loops
        # Filter notifications for the current user at the database level
        notifications = Notification.objects.filter(
            recipient=member
        ).select_related('notification_type').order_by('-created_at')
        
        # Filter by channel based on client type
        # client_type parameter: 'web' (default) or 'mobile'
        client_type = request.query_params.get('client_type', 'web')
        
        # Explicitly log the received client_type and User-Agent
        user_agent = request.META.get('HTTP_USER_AGENT', '')
        print(f"[NOTIFICATION-API] Received client_type: '{client_type}', User-Agent: '{user_agent}'")
        
        # INTELLIGENT FALLBACK: If client_type is 'web' (default) but User-Agent indicates a mobile app,
        # force switch to 'mobile' mode. This handles cases where the mobile app fails to send the parameter.
        if client_type == 'web':
            mobile_agents = ['Expo', 'okhttp', 'CFNetwork', 'Dalvik', 'Android', 'iPhone', 'iPad', 'Mobile']
            if any(agent in user_agent for agent in mobile_agents) and 'Mozilla' not in user_agent:
                print(f"[NOTIFICATION-API] ⚠️ Detected Mobile User-Agent '{user_agent}' with client_type='web'. Forcing 'mobile' mode.")
                client_type = 'mobile'
            # Also handle cases where Mozilla is present but it's clearly a webview in a mobile app (less reliable, but worth checking specific app tokens if we had them)
        
        if client_type == 'web':
            # Web: exclude mobile-only notifications
            notifications = notifications.exclude(channel='mobile')
        elif client_type == 'mobile':
            # Mobile: exclude web-only notifications, show mobile and both
            notifications = notifications.exclude(channel='web')
            
            # EXTRA SAFETY: Explicitly exclude known web-only notification types for mobile
            # This handles cases where channel might be misconfigured or legacy data exists
            # Role assignments and bulk uploads are strictly web-admin features
            web_only_types = [
                'role_assigned', 
                'owner_bulk_upload', 
                'resident_bulk_upload', 
                'staff_bulk_upload',
                'group_added',
                'owner_added_self'
            ]
            notifications = notifications.exclude(notification_type__code__in=web_only_types)
            print(f"[NOTIFICATION-API] Filtered out web-only types for mobile client. Remaining count: {notifications.count()}")
            
        # If client_type is 'all' or anything else, show all notifications (no filter)
        
        # Log all notifications before filtering
        all_notifications_count = notifications.count()
        role_assigned_before_filter = notifications.filter(
            notification_type__code='role_assigned'
        ).count()
        print(f"[NOTIFICATION-API] Total notifications for member {member.id} (client_type={client_type}): {all_notifications_count}, role_assigned: {role_assigned_before_filter}")

        # Filter by read/unread status if provided
        is_read = request.query_params.get('is_read', None)
        is_read_bool = None
        if is_read is not None:
            # Handle both string 'true'/'false' and boolean true/false
            if isinstance(is_read, str):
                is_read_bool = is_read.lower() == 'true'
            else:
                is_read_bool = bool(is_read)
            notifications = notifications.filter(is_read=is_read_bool)

        # Filter by notification type if provided (can be code or ID)
        notification_type = request.query_params.get('type', None)
        if notification_type:
            # Try to find by code first, then by ID
            try:
                notification_type_obj = NotificationType.objects.get(code=notification_type)
                notifications = notifications.filter(notification_type=notification_type_obj)
            except NotificationType.DoesNotExist:
                try:
                    notification_type_obj = NotificationType.objects.get(id=int(notification_type))
                    notifications = notifications.filter(notification_type=notification_type_obj)
                except (NotificationType.DoesNotExist, ValueError):
                    pass  # Invalid type, return empty or all
        
        # Filter by entity type if provided
        entity_type = request.query_params.get('entity_type', None)
        if entity_type:
            notifications = notifications.filter(entity_type=entity_type)
        
        # Filter by view permissions at database level
        # Build a list of entity types the user has permission to view
        allowed_entity_types = []
        # Always include personal entity types (role/group/unit_staff/owner) that don't depend on view permissions
        # 'unit_staff' is included to ensure staff members can see their own add/remove notifications
        # 'owner' is included to ensure users can see their own owner_added_self notifications
        always_allowed_types = ['other', 'role', 'group', 'unit_staff', 'owner']
        allowed_entity_types.extend(always_allowed_types)
        
        # Check which entity types user has permission to view
        from group_role.permission_constants import PERMISSION_VIEW_UNIT_STAFF
        user_has_unit_staff_permission = False
        
        for entity_type_choice, _ in NotificationType.ENTITY_TYPES:
            if entity_type_choice not in always_allowed_types and has_view_permission(member, entity_type_choice):
                allowed_entity_types.append(entity_type_choice)
                # Track if user has unit staff permission
                if entity_type_choice == 'unit_staff':
                    user_has_unit_staff_permission = True
        
        # Special case: If user has VIEW_UNIT_STAFF permission, also include 'unit' entity type
        # This is needed because unit_staff_removed notifications use entity_type='unit'
        if user_has_unit_staff_permission and 'unit' not in allowed_entity_types:
            allowed_entity_types.append('unit')
        
        # Filter notifications to only include allowed entity types
        if allowed_entity_types:
            notifications = notifications.filter(entity_type__in=allowed_entity_types)
        else:
            # User has no view permissions, return empty queryset
            notifications = Notification.objects.none()
        
        # IMPORTANT: Filter out retroactive notifications
        # Notifications should only be shown if the entity was created AFTER permission was granted
        # Convert to list to filter in Python (since should_show_notification needs to check entity creation time)
        notifications_list = list(notifications)
        
        # Debug: Check role_assigned notifications before filtering
        role_assigned_before_should_show = [
            n for n in notifications_list 
            if n.notification_type and n.notification_type.code == 'role_assigned'
        ]
        print(f"[NOTIFICATION-API] Role assigned notifications before should_show_notification filter: {len(role_assigned_before_should_show)}")
        for n in role_assigned_before_should_show:
            print(f"  - Notification {n.id}: recipient={n.recipient.id}, entity_type={n.entity_type}, should_show={should_show_notification(member, n)}")
        
        filtered_notifications = [
            notif for notif in notifications_list 
            if should_show_notification(member, notif)
        ]

        # Filter out expired or deleted notifications from the list view
        # We check the entity status using the bulk helper function for performance
        from .status_utils import get_entity_statuses_bulk
        
        # Fetch statuses in bulk (O(1) queries per entity type instead of O(N))
        entity_statuses = get_entity_statuses_bulk(filtered_notifications)
        
        active_notifications = []
        for notif in filtered_notifications:
            status = entity_statuses.get((notif.entity_type, notif.entity_id), 'active')
            # Only include notifications where the entity is active
            # 'unknown' status is also included as it might be a non-entity notification type
            # IMPORTANT: Keep 'archived' bulletin notifications visible even after rejection
            # When admin rejects a bulletin, previously sent notifications should remain visible
            if status in ['active', 'unknown']:
                active_notifications.append(notif)
            elif status == 'archived' and notif.entity_type == 'bulletin':
                # Special case: Keep bulletin notifications even when bulletin is archived/rejected
                active_notifications.append(notif)
            else:
                # Filter out deleted/expired entities
                # Optionally mark these as read so they don't count towards unread badge?
                # For now, just filtering them out of the list view
                pass
                
        filtered_notifications = active_notifications

        # Filter out notifications from blocked users (mobile app only; web app sees all)
        is_mobile = request.headers.get('X-App-Source', '').lower() == 'mobile'
        if is_mobile:
            try:
                from user.models import BlockedUser
                from bulletins.models import Bulletin
                # Users I blocked + users who blocked me
                blocked_member_ids = set(
                    list(BlockedUser.objects.filter(blocker=member).values_list('blocked_id', flat=True)) +
                    list(BlockedUser.objects.filter(blocked=member).values_list('blocker_id', flat=True))
                )
                if blocked_member_ids:
                    blocked_bulletin_ids = set(Bulletin.objects.filter(
                        creator_id__in=blocked_member_ids
                    ).values_list('id', flat=True))
                    if blocked_bulletin_ids:
                        filtered_notifications = [
                            n for n in filtered_notifications
                            if not (n.entity_type == 'bulletin' and n.entity_id in blocked_bulletin_ids)
                        ]
            except Exception as e:
                print(f"[NOTIFICATION-API] Error filtering blocked users from notifications: {e}")
        
        # Debug: Check role_assigned notifications after filtering
        role_assigned_after_filter = [
            n for n in filtered_notifications
            if n.notification_type and n.notification_type.code == 'role_assigned'
        ]
        print(f"[NOTIFICATION-API] Role assigned notifications after filtering: {len(role_assigned_after_filter)}")
        for n in role_assigned_after_filter:
            print(f"  [NOTIFICATION-API] ✅ role_assigned notification {n.id}: title='{n.title}', recipient={n.recipient.id} ({n.recipient.full_name})")
        
        # IMPORTANT: Count after filtering
        total_count = len(filtered_notifications)

        # Paginate results
        paginator = NotificationPagination()
        
        # Get page size from query params or use default
        page_size = request.query_params.get('page_size', paginator.page_size)
        try:
            page_size = int(page_size)
            if page_size > paginator.max_page_size:
                page_size = paginator.max_page_size
        except (ValueError, TypeError):
            page_size = paginator.page_size
        
        from django.core.paginator import Paginator
        paginator_obj = Paginator(filtered_notifications, page_size)
        page_number = request.query_params.get('page', 1)
        try:
            page_number = int(page_number)
            page = paginator_obj.page(page_number)
        except (ValueError, TypeError, Exception):
            page = paginator_obj.page(1)
        
        serializer = NotificationListSerializer(page.object_list, many=True)
        
        # Debug: Check role_assigned in serialized data
        role_assigned_in_response = [
            item for item in serializer.data 
            if item.get('notification_type_code') == 'role_assigned'
        ]
        print(f"[NOTIFICATION-API] role_assigned in API response: {len(role_assigned_in_response)}")
        if role_assigned_in_response:
            for item in role_assigned_in_response:
                print(f"  [NOTIFICATION-API] Returning role_assigned notification {item.get('id')}: {item.get('title')}")
        
        # Calculate performance metrics
        end_time = time.time()
        load_time_ms = round((end_time - start_time) * 1000, 2)
        
        # Calculate pagination metadata
        has_next = page.has_next()
        next_page = page.next_page_number() if has_next else None
        previous_page = page.previous_page_number() if page.has_previous() else None
        total_pages = paginator_obj.num_pages
        
        # Calculate total unread count
        total_unread = None
        if is_read_bool is not None:
            # User is filtering by read status
            if not is_read_bool:
                # User is requesting unread notifications, total unread equals total count
                total_unread = total_count
            else:
                # User is requesting read notifications, total unread is 0
                total_unread = 0
        else:
            # Not filtering by read status, calculate total unread from filtered notifications
            unread_filtered = [n for n in filtered_notifications if not n.is_read]
            total_unread = len(unread_filtered)
        
        return Response({
            'count': paginator_obj.count,
            'next': next_page,
            'previous': previous_page,
            'hasMore': has_next,
            'totalPages': total_pages,
            'currentPage': page_number,
            'totalUnread': total_unread,
            'results': serializer.data,
            'load_metrics': {
                'complexity': 'O(1)',  # Constant complexity - single database query with indexes
                'load_time_ms': load_time_ms,
                'processed_count': total_count,
                'description': f'Processed {total_count} notifications in {load_time_ms}ms'
            }
        })


class NotificationDetailView(APIView):
    """
    API view to get, update, or delete a specific notification
    """
    permission_classes = [IsAuthenticated]

    def get_object(self, pk, user_member):
        try:
            notification = Notification.objects.get(pk=pk)
            # Check if user has view permission for this notification's entity type
            # This allows users with all permissions to access notifications even if they weren't the original recipient
            if not has_view_permission(user_member, notification.entity_type):
                from django.http import Http404
                raise Http404
            return notification
        except Notification.DoesNotExist:
            from django.http import Http404
            raise Http404

    def get(self, request, pk):
        member = get_user_member(request.user)
        if not member:
            return Response(
                {'error': 'User does not have an associated member profile.'},
                status=status.HTTP_400_BAD_REQUEST
            )
        notification = self.get_object(pk, member)
        
        serializer = NotificationSerializer(notification)
        return Response(serializer.data)

    def patch(self, request, pk):
        member = get_user_member(request.user)
        if not member:
            return Response(
                {'error': 'User does not have an associated member profile.'},
                status=status.HTTP_400_BAD_REQUEST
            )
        notification = self.get_object(pk, member)
        
        # If user is not the recipient, check if they have their own notification for this entity
        if notification.recipient != member:
            # Check if user has their own notification for this entity
            user_notification = Notification.objects.filter(
                recipient=member,
                entity_type=notification.entity_type,
                entity_id=notification.entity_id,
                notification_type=notification.notification_type
            ).first()
            
            if not user_notification:
                # Create a notification for this user on-the-fly
                # This ensures users with view permission can mark notifications as read
                try:
                    user_notification, created = Notification.objects.get_or_create(
                        recipient=member,
                        notification_type=notification.notification_type,
                        entity_type=notification.entity_type,
                        entity_id=notification.entity_id,
                        defaults={
                            'title': notification.title,
                            'message': notification.message,
                            'metadata': notification.metadata,
                            'is_read': False  # New notification starts as unread
                        }
                    )
                    if created:
                        print(f"DEBUG: Created on-the-fly notification {user_notification.id} for user {member.id} when marking as read")
                    else:
                        print(f"DEBUG: Found existing notification {user_notification.id} for user {member.id}")
                except Notification.MultipleObjectsReturned:
                    # Multiple duplicate notifications exist - use the first one
                    user_notification = Notification.objects.filter(
                        recipient=member,
                        notification_type=notification.notification_type,
                        entity_type=notification.entity_type,
                        entity_id=notification.entity_id
                    ).first()
                    if user_notification:
                        print(f"DEBUG: Found duplicate notification {user_notification.id} for user {member.id}")
                    else:
                        return Response(
                            {'detail': 'Failed to find notification record.'},
                            status=status.HTTP_500_INTERNAL_SERVER_ERROR
                        )
                except Exception as e:
                    print(f"ERROR: Failed to create on-the-fly notification: {e}")
                    import traceback
                    traceback.print_exc()
                    return Response(
                        {'detail': 'Failed to create notification record.'},
                        status=status.HTTP_500_INTERNAL_SERVER_ERROR
                    )
            
            notification = user_notification
        
        # Only allow updating is_read status
        is_read = request.data.get('is_read', None)
        if is_read is not None:
            if is_read:
                notification.mark_as_read()
            else:
                notification.is_read = False
                notification.read_at = None
                notification.save(update_fields=['is_read', 'read_at'])
        
        serializer = NotificationSerializer(notification)
        return Response(serializer.data)

    def delete(self, request, pk):
        member = get_user_member(request.user)
        if not member:
            return Response(
                {'error': 'User does not have an associated member profile.'},
                status=status.HTTP_400_BAD_REQUEST
            )
        notification = self.get_object(pk, member)
        notification.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)


class NotificationMarkAllReadView(APIView):
    """
    API view to mark all notifications as read for the authenticated user
    """
    permission_classes = [IsAuthenticated]

    def post(self, request):
        """
        Mark all unread notifications as read for the authenticated user.
        Optimized to use bulk updates for better performance.
        """
        from django.utils import timezone
        
        member = get_user_member(request.user)
        if not member:
            return Response(
                {'error': 'User does not have an associated member profile.'},
                status=status.HTTP_400_BAD_REQUEST
            )
        now = timezone.now()
        
        # First, efficiently mark all unread notifications where user is recipient
        # This covers the vast majority of cases and uses bulk update for speed
        user_unread_notifications = Notification.objects.filter(
            recipient=member,
            is_read=False
        )
        
        # Filter by channel based on client type
        client_type = request.query_params.get('client_type', 'web')
        
        # INTELLIGENT FALLBACK for Unread Count
        user_agent = request.META.get('HTTP_USER_AGENT', '')
        if client_type == 'web':
            mobile_agents = ['Expo', 'okhttp', 'CFNetwork', 'Dalvik', 'Android', 'iPhone', 'iPad', 'Mobile']
            if any(agent in user_agent for agent in mobile_agents) and 'Mozilla' not in user_agent:
                client_type = 'mobile'
        
        if client_type == 'web':
            user_unread_notifications = user_unread_notifications.exclude(channel='mobile')
        elif client_type == 'mobile':
            user_unread_notifications = user_unread_notifications.exclude(channel='web')
            # Extra safety for mobile
            web_only_types = [
                'role_assigned', 
                'owner_bulk_upload', 
                'resident_bulk_upload', 
                'staff_bulk_upload',
                'group_added',
                'owner_added_self'
            ]
            user_unread_notifications = user_unread_notifications.exclude(notification_type__code__in=web_only_types)
        
        # Bulk update all user's unread notifications
        updated_count = user_unread_notifications.update(
            is_read=True,
            read_at=now
        )
        
        return Response({
            'message': f'Marked {updated_count} notifications as read',
            'updated_count': updated_count
        })


class NotificationUnreadCountView(APIView):
    """
    API view to get the count of unread notifications for the authenticated user
    """
    permission_classes = [IsAuthenticated]

    def get(self, request):
        # Get unread notifications and filter out retroactive ones
        member = get_user_member(request.user)
        if not member:
            return Response({'unread_count': 0})
        
        # Build a list of entity types the user has permission to view
        # Always include 'other', 'role', 'group', and 'owner' entity types (for role_assigned, group_added, owner_added_self notifications)
        # These are personal notifications that don't require view permissions
        always_allowed_types = ['other', 'role', 'group', 'owner']
        allowed_entity_types = list(always_allowed_types)
        
        # Check which entity types user has permission to view
        from group_role.permission_constants import PERMISSION_VIEW_UNIT_STAFF
        user_has_unit_staff_permission = False
        
        for entity_type_choice, _ in NotificationType.ENTITY_TYPES:
            if entity_type_choice not in always_allowed_types and has_view_permission(member, entity_type_choice):
                allowed_entity_types.append(entity_type_choice)
                # Track if user has unit staff permission
                if entity_type_choice == 'unit_staff':
                    user_has_unit_staff_permission = True
        
        # Special case: If user has VIEW_UNIT_STAFF permission, also include 'unit' entity type
        # This is needed because unit_staff_removed notifications use entity_type='unit'
        if user_has_unit_staff_permission and 'unit' not in allowed_entity_types:
            allowed_entity_types.append('unit')
        
        # Get unread notifications for this user with allowed entity types
        if allowed_entity_types:
            unread_notifications = Notification.objects.filter(
                recipient=member,
                is_read=False,
                entity_type__in=allowed_entity_types
            )
            
            # Filter by channel based on client type
            client_type = request.query_params.get('client_type', 'web')
            
            # INTELLIGENT FALLBACK for Mark All Read
            user_agent = request.META.get('HTTP_USER_AGENT', '')
            if client_type == 'web':
                mobile_agents = ['Expo', 'okhttp', 'CFNetwork', 'Dalvik', 'Android', 'iPhone', 'iPad', 'Mobile']
                if any(agent in user_agent for agent in mobile_agents) and 'Mozilla' not in user_agent:
                    client_type = 'mobile'
            
            if client_type == 'web':
                unread_notifications = unread_notifications.exclude(channel='mobile')
            elif client_type == 'mobile':
                unread_notifications = unread_notifications.exclude(channel='web')
                # Extra safety for mobile
                web_only_types = [
                    'role_assigned', 
                    'owner_bulk_upload', 
                    'resident_bulk_upload', 
                    'staff_bulk_upload',
                    'group_added',
                    'owner_added_self'
                ]
                unread_notifications = unread_notifications.exclude(notification_type__code__in=web_only_types)
            
            # Filter out retroactive notifications (items created before permission grant)
            # Convert to list to apply Python-level filtering
            unread_list = list(unread_notifications)
            
            # First filter by retroactive permission
            retroactive_filtered = [
                n for n in unread_list 
                if should_show_notification(member, n)
            ]
            
            # Use bulk helper to check for expired/deleted entities efficiently
            from .status_utils import get_entity_statuses_bulk
            entity_statuses = get_entity_statuses_bulk(retroactive_filtered)
            
            filtered_unread = []
            for notif in retroactive_filtered:
                status = entity_statuses.get((notif.entity_type, notif.entity_id), 'active')
                if status in ['active', 'unknown']:
                    filtered_unread.append(notif)
                elif status == 'archived' and notif.entity_type == 'bulletin':
                    # Special case: Keep bulletin notifications even when bulletin is archived/rejected
                    filtered_unread.append(notif)
            
            unread_count = len(filtered_unread)
        else:
            unread_count = 0
        
        return Response({'unread_count': unread_count})


class BatchOwnerNotificationView(APIView):
    """
    API view to create batch notification for multiple owners added sequentially
    This is used when owners are created one by one with pending members/companies
    """
    permission_classes = [IsAuthenticated]

    def post(self, request):
        from towers.models import Owner
        from .utils import create_bulk_owner_added_notification
        import logging
        
        logger = logging.getLogger(__name__)
        
        try:
            owner_ids = request.data.get('owner_ids', [])
            unit_id = request.data.get('unit_id')
            
            if not owner_ids:
                return Response(
                    {'error': 'owner_ids is required'},
                    status=status.HTTP_400_BAD_REQUEST
                )
            
            if not unit_id:
                return Response(
                    {'error': 'unit_id is required'},
                    status=status.HTTP_400_BAD_REQUEST
                )
            
            # Retrieve all owner objects (Unit -> Floor -> Tower, so unit__floor__tower)
            owners = Owner.objects.filter(
                id__in=owner_ids,
                unit_id=unit_id
            ).select_related('member', 'unit', 'unit__floor', 'unit__floor__tower')
            
            if not owners.exists():
                return Response(
                    {'error': 'No valid owners found'},
                    status=status.HTTP_404_NOT_FOUND
                )
            
            # Create batch notification for managers
            current_member = get_user_member(request.user)
            if not current_member:
                return Response(
                    {'error': 'User does not have an associated member profile.'},
                    status=status.HTTP_400_BAD_REQUEST
                )
            create_bulk_owner_added_notification(list(owners), creator=current_member)
            
            logger.info(f"Created batch notification for {owners.count()} owners in unit {unit_id}")
            
            return Response(
                {'message': f'Batch notification created for {owners.count()} owners'},
                status=status.HTTP_200_OK
            )
            
        except Exception as e:
            logger.error(f"Error creating batch owner notification: {str(e)}")
            return Response(
                {'error': f'Failed to create batch notification: {str(e)}'},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )


class RegisterDeviceTokenView(APIView):
    """
    API view to register a device push token for push notifications
    """
    permission_classes = [IsAuthenticated]
    parser_classes = [JSONParser]  # Explicitly use JSONParser for JSON requests

    def post(self, request):
        import json
        
        try:
            # Comprehensive debugging - log everything about the request
            print("="*80)
            print("📥 REGISTER DEVICE TOKEN REQUEST DEBUG")
            print("="*80)
            print(f"Request method: {request.method}")
            print(f"Content-Type: {request.content_type}")
            print(f"Request META keys: {list(request.META.keys())}")
            print(f"Content-Length: {request.META.get('CONTENT_LENGTH', 'N/A')}")
            
            # Try to read raw body
            try:
                raw_body = request.body.decode('utf-8')
                print(f"Raw request body: {raw_body[:500]}...")  # First 500 chars
                print(f"Raw body length: {len(raw_body)}")
            except Exception as e:
                print(f"Error reading raw body: {e}")
            
            # Log request.data
            print(f"Request.data type: {type(request.data)}")
            print(f"Request.data content: {request.data}")
            print(f"Request.data keys: {list(request.data.keys()) if hasattr(request.data, 'keys') else 'N/A'}")
            
            # Log request.POST and request.body for comparison
            print(f"Request.POST: {dict(request.POST)}")
            print(f"Request.FILES: {dict(request.FILES)}")
            
            # Fallback: If request.data is empty, try to parse body manually
            request_data = request.data
            if not request_data or (hasattr(request_data, '__len__') and len(request_data) == 0):
                print("⚠️ WARNING: request.data is empty, attempting manual JSON parse...")
                try:
                    raw_body = request.body.decode('utf-8')
                    if raw_body:
                        request_data = json.loads(raw_body)
                        print(f"✅ Successfully parsed JSON from raw body: {request_data}")
                except (json.JSONDecodeError, UnicodeDecodeError) as e:
                    print(f"❌ Failed to parse JSON from raw body: {e}")
                    request_data = {}
            
            member = get_user_member(request.user)
            if not member:
                return Response(
                    {'error': 'User does not have an associated member profile.'},
                    status=status.HTTP_400_BAD_REQUEST
                )
            push_token = request_data.get('push_token') if isinstance(request_data, dict) else request.data.get('push_token')
            device_type = request_data.get('device_type', 'unknown') if isinstance(request_data, dict) else request.data.get('device_type', 'unknown')
            device_id = request_data.get('device_id', '') if isinstance(request_data, dict) else request.data.get('device_id', '')

            print(f"\n📥 Parsed data for member {member.id} ({member.full_name})")
            print(f"   push_token: {push_token[:30] if push_token else 'NONE'}...")
            print(f"   device_type: {device_type}")
            print(f"   device_id: {device_id}")
            print("="*80)

            if not push_token:
                return Response(
                    {'error': 'push_token is required'},
                    status=status.HTTP_400_BAD_REQUEST
                )

            # Normalize push_token (strip whitespace)
            push_token = push_token.strip() if push_token else push_token

            # Normalize device type to match model choices
            if device_type not in ['ios', 'android', 'web']:
                device_type = 'android' if device_type.lower() in ['android', 'unknown'] else 'ios'

            # Detect token type (Expo or FCM)
            from .unified_push_service import detect_token_type
            token_type = detect_token_type(push_token)
            print(f"   token_type detected: {token_type}")

            with transaction.atomic():
                # 1. Deactivate this push token for ANY other member
                # This is CRITICAL for the "switching users on same device" issue.
                # Only one member should be "active" for a specific hardware token at any time.
                old_tokens = DeviceToken.objects.filter(
                    push_token=push_token,
                    is_active=True
                ).exclude(member=member)
                
                if old_tokens.exists():
                    old_members = list(old_tokens.values_list('member__full_name', 'member_id'))
                    deactivated_count = old_tokens.update(is_active=False)
                    
                    print(f"🔄 ACCOUNT SWITCH DETECTED on device {push_token[:20]}...")
                    print(f"   Deactivated {deactivated_count} token(s) for previous user(s):")
                    for old_name, old_id in old_members:
                        print(f"   - {old_name} (ID: {old_id})")
                    print(f"   Now reassigning to: {member.full_name} (ID: {member.id})")
                    
                    # CRITICAL FIX: Mark ALL undelivered notifications for old members as read
                    # This prevents old notifications from showing up on the device after account switch
                    for _, old_member_id in old_members:
                        unread_count = Notification.objects.filter(
                            recipient_id=old_member_id,
                            is_read=False
                        ).update(is_read=True)
                        if unread_count > 0:
                            print(f"   ✓ Marked {unread_count} unread notifications as read for previous user {old_member_id}")

                # 2. Look for ANY existing token record (active or inactive) for THIS member + push_token
                # This handles re-login where the same user uses the same token again
                device_token = DeviceToken.objects.filter(
                    member=member,
                    push_token=push_token,
                ).order_by('-last_used_at', '-created_at').first()
                
                if device_token:
                    # Reactivate and update existing token
                    device_token.device_type = device_type
                    device_token.device_id = device_id
                    device_token.token_type = token_type
                    device_token.is_active = True
                    device_token.last_used_at = timezone.now()
                    device_token.save()
                    created = False
                    print(f"✅ Reactivated EXISTING device token for member {member.id} ({member.full_name}) - Token: {push_token[:20]}... ({token_type.upper()}, ID: {device_token.id})")
                else:
                    # Create new device token (first time registration for this specific user+token pair)
                    device_token = DeviceToken.objects.create(
                        member=member,
                        push_token=push_token,
                        token_type=token_type,
                        device_type=device_type,
                        device_id=device_id,
                        is_active=True,
                        last_used_at=timezone.now()
                    )
                    created = True
                    print(f"✅ Registered NEW device token for member {member.id} ({member.full_name}) - Token: {push_token[:20]}... ({token_type.upper()}, ID: {device_token.id})")

                print(f"💾 Device token ID: {device_token.id} - Committing transaction...")
            
            # Verify it was saved
            verification = DeviceToken.objects.filter(id=device_token.id).first()
            if verification:
                print(f"✅ VERIFIED: Token {device_token.id} exists in database")
            else:
                print(f"❌ WARNING: Token {device_token.id} NOT found after commit!")

            return Response({
                'success': True,
                'message': 'Device token registered successfully',
                'device_token_id': device_token.id,
                'created': created,
                'account_switched': deactivated_count > 0,  # Signal to mobile app that account was switched
                'should_clear_cache': deactivated_count > 0,  # Tell mobile app to clear notification cache
                'member_id': member.id,  # Current member ID for verification
            }, status=status.HTTP_201_CREATED if created else status.HTTP_200_OK)

        except Exception as e:
            print(f"❌ Error registering device token: {e}")
            import traceback
            traceback.print_exc()
            return Response(
                {'error': f'Failed to register device token: {str(e)}'},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )


class UnregisterDeviceTokenView(APIView):
    """
    API view to unregister a device push token.
    Allows unauthenticated requests so the mobile app can always unregister
    even when the access token has expired at logout time.
    - If authenticated: deactivates tokens for the authenticated member.
    - If unauthenticated: deactivates by push_token value directly.
    """
    authentication_classes = []  # Allow unauthenticated requests
    permission_classes = []       # No permission required

    def post(self, request):
        try:
            # Try to get member from auth token (may be None if unauthenticated)
            member = get_user_member(request.user) if request.user and request.user.is_authenticated else None
            push_token = request.data.get('push_token')

            if push_token:
                # Deactivate by push_token (with optional member filter for extra safety)
                qs = DeviceToken.objects.filter(push_token=push_token, is_active=True)
                if member:
                    qs = qs.filter(member=member)
                updated = qs.update(is_active=False)
                if member:
                    print(f"Deactivated {updated} device token(s) for member {member.id} ({member.full_name}) by push_token")
                else:
                    print(f"Deactivated {updated} device token(s) by push_token (unauthenticated logout)")
            elif member:
                # No push_token provided — deactivate ALL tokens for this member
                updated = DeviceToken.objects.filter(member=member, is_active=True).update(is_active=False)
                print(f"Deactivated {updated} device token(s) for member {member.id} ({member.full_name})")
            else:
                # Neither authenticated nor push_token provided
                return Response(
                    {'error': 'push_token is required when not authenticated'},
                    status=status.HTTP_400_BAD_REQUEST
                )

            return Response({
                'success': True,
                'message': 'Device token unregistered successfully'
            }, status=status.HTTP_200_OK)

        except Exception as e:
            print(f"Error unregistering device token: {e}")
            import traceback
            traceback.print_exc()
            return Response(
                {'error': f'Failed to unregister device token: {str(e)}'},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )

