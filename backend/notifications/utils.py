"""
Utility functions for creating and managing notifications
"""
from .models import Notification, NotificationType
from announcements.models import Announcement
from towers.models import Unit, Resident, Owner, UnitStaff
from django.db.models import Q
from django.utils import timezone
from group_role.permission_constants import (
    PERMISSION_VIEW_ANNOUNCEMENTS,
    PERMISSION_VIEW_BULLETIN_BOARD,
    PERMISSION_VIEW_NOTICE_BOARD,
    PERMISSION_VIEW_MEMBER_LIST,
)
import requests
import json
import os
import logging

logger = logging.getLogger(__name__)


def validate_notification_push_settings(channel, metadata):
    """
    Validate that channel and should_send_push settings are consistent.
    Returns corrected channel if mismatch detected.
    
    Args:
        channel: 'web', 'mobile', or 'both'
        metadata: dict containing 'should_send_push' flag
        
    Returns:
        tuple: (corrected_channel, warning_message or None)
    """
    should_send_push = metadata.get('should_send_push', False)
    
    # If should_send_push is True, channel must be 'mobile' or 'both' (not 'web')
    if should_send_push and channel == 'web':
        logger.warning(f"⚠️ Mismatch detected: should_send_push=True but channel='web'. Auto-correcting to 'mobile'")
        return 'mobile', "Auto-corrected channel from 'web' to 'mobile' due to should_send_push=True"
    
    # If should_send_push is False, and channel includes mobile, log warning
    if not should_send_push and channel in ['mobile', 'both']:
        logger.info(f"ℹ️ Note: channel='{channel}' but should_send_push=False. Push will be skipped.")
    
    return channel, None


def is_user_targeted_by_communication(member, entity):
    """
    Check if a member should see a communication (announcement/bulletin/notice)
    based on tower/unit targeting rules.
    
    Rules:
    1. No tower AND no unit → ALL members can see it
    2. Creator always sees their own posts
    3. Tower AND unit selected → ONLY members of those specific tower+unit combinations
    4. Only tower (no unit) → ALL members of that tower
    5. Only unit → ALL members of that unit
    6. Organization members with view permission always see targeted communications
    
    Args:
        member: Member instance to check
        entity: The communication entity (Announcement, Bulletin, or Notice) instance
    
    Returns:
        bool: True if member should see this communication, False otherwise
    """
    try:
        # Rule 2: Creator always sees their own posts
        if hasattr(entity, 'creator') and entity.creator == member:
            return True
        
        # Get target towers and units
        target_units = list(entity.target_units.all())
        target_towers = list(entity.target_towers.all())
        
        # Rule 1: No tower AND no unit → ALL members can see it
        if not target_towers and not target_units:
            return True
        
        # Rule 6: Organization members with view permission always see targeted communications
        if member.is_org_member:
            return True
        
        # For targeted communications, check if member belongs to targeted tower/unit
        # Get all units the member is associated with (as resident, owner, or staff)
        member_units = set()
        
        # Get units where member is a resident
        resident_units = Resident.objects.filter(
            member=member,
            is_active=True
        ).values_list('unit_id', flat=True)
        member_units.update(resident_units)
        
        # Get units where member is an owner
        owner_units = Owner.objects.filter(
            member=member
        ).values_list('unit_id', flat=True)
        member_units.update(owner_units)
        
        # Get units where member is staff
        staff_units = UnitStaff.objects.filter(
            member=member,
            is_active=True
        ).values_list('unit_id', flat=True)
        member_units.update(staff_units)
        
        if not member_units:
            # Member has no unit assignments
            return False
        
        # Get the actual Unit objects for member's units
        member_unit_objects = Unit.objects.filter(id__in=member_units).select_related('floor__tower')
        member_tower_ids = set(unit.floor.tower.id for unit in member_unit_objects)
        
        # Rule 3: Tower AND unit selected → Check specific combinations
        if target_towers and target_units:
            target_unit_ids = set(unit.id for unit in target_units)
            # Member must be in one of the targeted units
            return bool(member_units.intersection(target_unit_ids))
        
        # Rule 4: Only tower (no unit) → Check if member is in any of the targeted towers
        elif target_towers and not target_units:
            target_tower_ids = set(tower.id for tower in target_towers)
            return bool(member_tower_ids.intersection(target_tower_ids))
        
        # Rule 5: Only unit → Check if member is in any of the targeted units
        elif target_units and not target_towers:
            target_unit_ids = set(unit.id for unit in target_units)
            return bool(member_units.intersection(target_unit_ids))
        
        return False
        
    except Exception as e:
        print(f"Error checking if user is targeted by communication: {e}")
        import traceback
        traceback.print_exc()
        # On error, allow access (fail-open for better user experience)
        return True


def get_communication_access_q_object(member, is_mobile=False):
    """
    Generate a Q object for filtering communications (Announcement/Notice/Bulletin)
    based on the member's tower and unit assignments.
    
    Args:
        member: Member instance
        is_mobile: True when request comes from the mobile app.
                   Mobile users NEVER see global (no tower/no unit) communications.
        
    Returns:
        Q object: To be used in queryset.filter()

    Visibility Rules:
        Web (is_mobile=False):
          - Org Members  → see ONLY global (no tower, no unit) communications
          - Residents    → see ONLY tower/unit-specific communications they belong to
        Mobile (is_mobile=True):
          - ALL users    → see ONLY tower/unit-specific communications they belong to
                           Global (no tower, no unit) is NEVER shown on mobile
    """
    try:
        # ── Web panel: Org members (staff/admins) see ALL communications ──────
        if member.is_org_member and not is_mobile:
            # Org members (pure or dual-role) on web see all items (global + targeted)
            return Q()

        # ── Resident / App user path ──────────────────────────────────────────
        # Get all units the member is associated with
        member_units = set()
        
        # Get units where member is a resident
        resident_units = Resident.objects.filter(
            member=member,
            is_active=True
        ).values_list('unit_id', flat=True)
        member_units.update(resident_units)
        
        # Get units where member is an owner
        owner_units = Owner.objects.filter(
            member=member
        ).values_list('unit_id', flat=True)
        member_units.update(owner_units)
        
        # Get units where member is staff
        staff_units = UnitStaff.objects.filter(
            member=member,
            is_active=True
        ).values_list('unit_id', flat=True)
        member_units.update(staff_units)
        
        if not member_units:
            # Resident with no unit assignments → only see own posts
            # (NOT global/internal — those are for org members only)
            if is_mobile:
                # On mobile, even own posts must be targeted (not global)
                return Q(creator=member) & (Q(target_towers__isnull=False) | Q(target_units__isnull=False))
            return Q(creator=member)

        # Get the actual Unit objects for member's units to find towers
        member_unit_objects = Unit.objects.filter(id__in=member_units).select_related('floor__tower')
        member_tower_ids = set(unit.floor.tower.id for unit in member_unit_objects)
        
        # Construct Q object for residents:
        # 1. Global: Communications with no tower/unit targets are for everyone (Rule 1)
        # Note: We only allow global for residents on WEB. Mobile remains targeted-only.
        q_global = Q(target_towers__isnull=True, target_units__isnull=True)
        
        # 2. Creator: Always see own posts
        q_creator = Q(creator=member)
        
        # 3. Targeted Unit: Communication targets a specific unit the member belongs to
        q_unit_match = Q(target_units__id__in=member_units)
        
        # 4. Targeted Tower only: Communication targets the member's tower with no specific unit
        q_tower_match = Q(target_towers__id__in=member_tower_ids) & Q(target_units__isnull=True)
        
        if is_mobile:
            # Mobile users should NEVER see global (no tower/no unit) communications,
            # including notices/announcements they created themselves.
            q_creator_mobile = Q(creator=member) & (
                Q(target_towers__isnull=False) | Q(target_units__isnull=False)
            )
            return q_creator_mobile | q_unit_match | q_tower_match
        else:
            return q_global | q_creator | q_unit_match | q_tower_match
        
    except Exception as e:
        print(f"Error generating communication access Q object: {e}")
        import traceback
        traceback.print_exc()
        # On error, allow access (fail-open)
        return Q()



def is_member_in_targeted_units(member, entity):
    """
    Check if a member is associated with the entity's targeted towers/units.
    Association = Resident (active) OR Owner OR UnitStaff (active).

    Used to determine if a member should receive push notifications for targeted content.

    Args:
        member: Member instance
        entity: Announcement, Bulletin, or Notice with target_units / target_towers

    Returns:
        bool: True if member is a Resident, Owner, or UnitStaff in a targeted unit.
    """
    try:
        target_units = list(entity.target_units.all())
        target_towers = list(entity.target_towers.all())
        if not target_towers and not target_units:
            return True  # Global – no targeting, so everyone is "in"

        target_unit_ids = set()
        
        # Match logic from get_targeted_recipients:
        # 1. If units are selected, they override tower selection (refinement)
        # 2. If only towers are selected, include all units in those towers
        
        if target_units:
             # Rule 2 & 4: Units selected (whether towers are selected or not)
             target_unit_ids.update(u.id for u in target_units)
        elif target_towers:
             # Rule 3: Only towers selected
             units_from_towers = Unit.objects.filter(
                floor__tower__in=target_towers
             ).values_list('id', flat=True)
             target_unit_ids.update(units_from_towers)
             
        if not target_unit_ids:
            return False

        # Check if member is Resident, Owner, or UnitStaff in targeted units
        in_resident = Resident.objects.filter(
            member=member, unit_id__in=target_unit_ids, is_active=True
        ).exists()
        in_owner = Owner.objects.filter(
            member=member, unit_id__in=target_unit_ids
        ).exists()
        in_staff = UnitStaff.objects.filter(
            member=member, unit_id__in=target_unit_ids, is_active=True
        ).exists()
        return in_resident or in_owner or in_staff
    except Exception as e:
        print(f"Error in is_member_in_targeted_units: {e}")
        return False


def _should_send_push_for_notification(notification):
    """
    Safety check before sending push: for tower/unit-targeted announcement/bulletin/notice,
    only send push if recipient is still in the targeted tower/unit.
    Keeps push in sync with in-app (should_show_notification): no push if they wouldn't see it in-app.
    
    Exception: Community members (is_comm_member=True) will always receive push notifications
    to ensure they don't miss important updates.
    """
    if notification.entity_type not in ('announcement', 'bulletin', 'notice'):
        return True
    try:
        entity = None
        if notification.entity_type == 'announcement':
            entity = Announcement.objects.filter(id=notification.entity_id).first()
        elif notification.entity_type == 'bulletin':
            from bulletins.models import Bulletin
            entity = Bulletin.objects.filter(id=notification.entity_id).first()
        elif notification.entity_type == 'notice':
            from noticeboard.models import Notice
            entity = Notice.objects.filter(id=notification.entity_id).first()
        if not entity:
            return True
        # Global notices and bulletins (no tower, no unit) should NOT trigger push
        # because mobile app does not display global notices/bulletins
        if not (entity.target_towers.exists() or entity.target_units.exists()):
            if notification.entity_type in ('notice', 'bulletin'):
                print(f"[PUSH] Skipping push for global {notification.entity_type} {entity.id} (no tower/unit)")
                return False
            return True
        
        return is_member_in_targeted_units(notification.recipient, entity)
    except Exception as e:
        print(f"Error in _should_send_push_for_notification: {e}")
        return True  # allow push on error to avoid blocking


def should_show_notification(member, notification):
    """
    Check if a notification should be shown to a member based on:
    1. Whether they have view permission for the entity type
    2. Whether the entity was created/posted AFTER they received the permission (non-retroactive)
    
    For bulletin_posted notifications, uses the approval timestamp instead of creation timestamp
    to ensure users receive notifications for bulletins approved after they get permission.
    
    For organization member notifications, checks "View Member List" permission.
    
    Args:
        member: Member instance
        notification: Notification instance
    
    Returns:
        bool: True if notification should be shown, False if it should be hidden
    """
    # 0. STRICT ROLE-CHANNEL VALIDATION
    # Web notifications should only be visible to users in their Organization Member capacity
    if notification.channel == 'web' and not getattr(member, 'is_org_member', False):
        return False
    
    # Mobile notifications should only be visible to users in their Community Member capacity
    if notification.channel == 'mobile' and not getattr(member, 'is_comm_member', False):
        return False

    # For role and group notifications, the user receiving them is the target
    # No need for retroactive filtering - they should always see their own role/group changes
    # Also include owner_added_self - users should always see when they add themselves as owner
    notif_code = notification.notification_type.code if notification.notification_type else None
    if notif_code in ['role_assigned', 'group_added', 'owner_added_self']:
        return True

    # Always show unit_staff add/remove notifications to the staff member themself
    if notif_code in ['unit_staff_added', 'unit_staff_removed']:
        member_id_in_metadata = None
        try:
            if notification.metadata:
                member_id_in_metadata = (
                    notification.metadata.get('member_id')
                    or notification.metadata.get('staff_member_id')
                    or notification.metadata.get('unit_staff_member_id')
                )
        except Exception:
            member_id_in_metadata = None

        if member_id_in_metadata and member_id_in_metadata == member.id:
            return True
            
    # SuperAdmins should always see all system notifications
    if member.is_org_member:
        try:
            from group_role.models import MembersRole
            is_superadmin = MembersRole.objects.filter(
                member=member,
                role__role_name__iexact="SuperAdmin",
                role__is_active=True,
                is_active=True
            ).exists()
            if is_superadmin:
                return True
        except Exception:
            pass
    
    # Check if member has view permission for this entity type
    if not has_view_permission(member, notification.entity_type):
        return False
    
    # Get the entity's creation timestamp (or approval timestamp for bulletin_posted)
    entity_timestamp = None
    try:
        if notification.entity_type == 'announcement':
            entity = Announcement.objects.filter(id=notification.entity_id).first()
            if entity:
                entity_timestamp = entity.created_at
                # Creators always see their own announcements
                if entity.creator == member:
                    return True
        elif notification.entity_type == 'bulletin':
            from bulletins.models import Bulletin
            entity = Bulletin.objects.filter(id=notification.entity_id).first()
            if entity:
                # For bulletin_posted notifications, check if approval_timestamp is in metadata
                # This ensures users receive notifications for bulletins approved after permission grant
                if (notification.notification_type and 
                    notification.notification_type.code == 'bulletin_posted' and 
                    notification.metadata and 
                    'approval_timestamp' in notification.metadata):
                    entity_timestamp = notification.metadata['approval_timestamp']
                    # Convert string to datetime if needed
                    if isinstance(entity_timestamp, str):
                        from django.utils.dateparse import parse_datetime
                        entity_timestamp = parse_datetime(entity_timestamp)
                    print(f"Using approval timestamp {entity_timestamp} for bulletin_posted notification {notification.id}")
                else:
                    entity_timestamp = entity.created_at
                # Creators always see their own bulletins
                if entity.creator == member:
                    return True
        elif notification.entity_type == 'notice':
            from noticeboard.models import Notice
            entity = Notice.objects.filter(id=notification.entity_id).first()
            if entity:
                import datetime
                # Use start_date/time as the effective timestamp for visibility check
                entity_timestamp = datetime.datetime.combine(entity.start_date, entity.start_time)
                # Creators always see their own notices
                if entity.creator == member:
                    return True
        elif notification.entity_type == 'member':
            # For organization member notifications, check "View Member List" permission
            # and ensure member was added AFTER permission was granted
            from user.models import Member as MemberModel
            entity = MemberModel.objects.filter(id=notification.entity_id).first()
            if entity:
                entity_timestamp = entity.created_at
                # Members should not see notifications about themselves being added
                if entity.id == member.id:
                    return False
        elif notification.entity_type == 'resident':
            # For resident/owner notifications, use created_at from metadata
            # Entity might not exist anymore if it was removed
            if notification.metadata and 'created_at' in notification.metadata:
                from django.utils.dateparse import parse_datetime
                entity_timestamp = parse_datetime(notification.metadata['created_at'])
            elif notification.metadata and 'removed_at' in notification.metadata:
                # For removal notifications, use removed_at timestamp
                from django.utils.dateparse import parse_datetime
                entity_timestamp = parse_datetime(notification.metadata['removed_at'])
            else:
                # Fallback to notification created_at
                entity_timestamp = notification.created_at
        elif notification.entity_type == 'unit':
            # For unit notifications (resident/owner/unit_staff removed or added), check notification type
            notif_type_code = notification.notification_type.code if notification.notification_type else None
            
            if notif_type_code in ['unit_staff_added', 'unit_staff_removed']:
                # For unit staff notifications, use created_at or removed_at from metadata
                if notification.metadata and 'created_at' in notification.metadata:
                    from django.utils.dateparse import parse_datetime
                    entity_timestamp = parse_datetime(notification.metadata['created_at'])
                elif notification.metadata and 'removed_at' in notification.metadata:
                    from django.utils.dateparse import parse_datetime
                    entity_timestamp = parse_datetime(notification.metadata['removed_at'])
                else:
                    # Fallback to notification created_at
                    entity_timestamp = notification.created_at
            else:
                # For resident/owner removed notifications, use removed_at from metadata
                if notification.metadata and 'removed_at' in notification.metadata:
                    from django.utils.dateparse import parse_datetime
                    entity_timestamp = parse_datetime(notification.metadata['removed_at'])
                else:
                    # Fallback to notification created_at
                    entity_timestamp = notification.created_at
        elif notification.entity_type == 'unit_staff':
            # For unit staff notifications, use created_at or removed_at from metadata
            if notification.metadata and 'created_at' in notification.metadata:
                from django.utils.dateparse import parse_datetime
                entity_timestamp = parse_datetime(notification.metadata['created_at'])
            elif notification.metadata and 'removed_at' in notification.metadata:
                from django.utils.dateparse import parse_datetime
                entity_timestamp = parse_datetime(notification.metadata['removed_at'])
            else:
                # Fallback to notification created_at
                entity_timestamp = notification.created_at
        elif notification.entity_type == 'bill':
            # For bill generation notifications, check if it's an individual bill or bulk
            notif_type_code = notification.notification_type.code if notification.notification_type else None
            if notif_type_code == 'service_fee_bill_issued':
                # Individual bill - fetch the payment object
                from service_fee_management.models import ServiceFeePayment
                payment = ServiceFeePayment.objects.filter(id=notification.entity_id).first()
                if payment:
                    entity_timestamp = payment.created_at
            
            # If we still don't have a timestamp, use notification's created_at (for bulk notifications)
            if not entity_timestamp:
                entity_timestamp = notification.created_at
        elif notification.entity_type == 'payment':
            # For payment received notifications, fetch the payment object
            from service_fee_management.models import ServiceFeePayment
            payment = ServiceFeePayment.objects.filter(id=notification.entity_id).first()
            if payment:
                # Use the payment's created_at (when payment was recorded)
                entity_timestamp = payment.created_at
            
            if not entity_timestamp:
                entity_timestamp = notification.created_at
    except Exception as e:
        print(f"Error getting entity timestamp for notification {notification.id}: {e}")
        # If we can't determine entity timestamp, show the notification (backward compatibility)
        return True
    
    # If we couldn't get entity timestamp, show the notification
    if not entity_timestamp:
        return True
    
    # Get permission grant timestamp
    from group_role.permission_constants import (
        PERMISSION_VIEW_UNIT_RESIDENT, PERMISSION_VIEW_UNIT_STAFF, 
        PERMISSION_VIEW_BILLING_MANAGEMENT, PERMISSION_RECORD_PAYMENT,
        PERMISSION_VIEW_SERVICE_FEE_PAYMENTS, PERMISSION_VIEW_SERVICE_FEE_OVERVIEW,
        PERMISSION_GENERATE_SERVICE_FEES
    )
    
    # Determine required permission based on entity_type and notification_type
    notif_type_code = notification.notification_type.code if notification.notification_type else None
    
    # Map entity types to their view permission IDs
    # If multiple permissions are specified in a list, the user only needs ANY ONE of them
    permission_map = {
        'announcement': PERMISSION_VIEW_ANNOUNCEMENTS,
        'bulletin': PERMISSION_VIEW_BULLETIN_BOARD,
        'notice': PERMISSION_VIEW_NOTICE_BOARD,
        'member': PERMISSION_VIEW_MEMBER_LIST,
        'resident': PERMISSION_VIEW_UNIT_RESIDENT,
        'unit_staff': PERMISSION_VIEW_UNIT_STAFF,
        'bill': [PERMISSION_VIEW_BILLING_MANAGEMENT, PERMISSION_GENERATE_SERVICE_FEES, PERMISSION_VIEW_SERVICE_FEE_OVERVIEW],  # Bill generation notifications
        'payment': [PERMISSION_RECORD_PAYMENT, PERMISSION_VIEW_SERVICE_FEE_PAYMENTS, PERMISSION_VIEW_SERVICE_FEE_OVERVIEW],  # Payment received notifications
    }
    
    # Special handling for 'unit' entity type - check notification type code
    if notification.entity_type == 'unit' and notif_type_code in ['unit_staff_added', 'unit_staff_removed']:
        required_permission = PERMISSION_VIEW_UNIT_STAFF
    else:
        required_permission = permission_map.get(notification.entity_type)
        # Default for 'unit' entity type (resident/owner notifications)
        if notification.entity_type == 'unit' and not required_permission:
            required_permission = PERMISSION_VIEW_UNIT_RESIDENT
    
    # Bypassing retroactive check for Community Members (Personal notifications)
    # or notifications with NO required view permissions (like individual bills)
    if not required_permission:
        return True
        
    # Community members should always see personal notifications (bills, payments, etc.) 
    # regardless of when they joined, as these are targeted specifically to them.
    if member.is_comm_member and notification.entity_type in ['announcement', 'bulletin', 'notice', 'service_fee', 'bill', 'payment']:
        return True
    
    # Determine permission grant timestamp
    if isinstance(required_permission, list):
        # For multiple permissions, find the earliest grant timestamp among the ones the user possesses
        member_permission_ids = member.get_permission_ids()
        applicable_permissions = [p for p in required_permission if p in member_permission_ids]
        
        if not applicable_permissions:
            return False
            
        timestamps = []
        for p in applicable_permissions:
            ts = member.get_permission_grant_timestamp(p)
            if ts:
                timestamps.append(ts)
        
        if not timestamps:
            return True # Show if we can't find timestamps definitively
            
        permission_grant_timestamp = min(timestamps)
    else:
        permission_grant_timestamp = member.get_permission_grant_timestamp(required_permission)
    
    if not permission_grant_timestamp:
        # If we can't determine permission timestamp, show the notification
        return True
    
    # Only show notification if entity was created/posted AFTER permission was granted
    # This applies to ALL users (including org members) - no one sees retroactive notifications
    if entity_timestamp > permission_grant_timestamp:
        # For tower/unit-targeted announcements, bulletins, notices: hide if member no longer in that tower
        if notification.entity_type in ('announcement', 'bulletin', 'notice'):
            entity = None
            if notification.entity_type == 'announcement':
                entity = Announcement.objects.filter(id=notification.entity_id).first()
            elif notification.entity_type == 'bulletin':
                from bulletins.models import Bulletin
                entity = Bulletin.objects.filter(id=notification.entity_id).first()
            elif notification.entity_type == 'notice':
                from noticeboard.models import Notice
                entity = Notice.objects.filter(id=notification.entity_id).first()
            if entity and (entity.target_towers.exists() or entity.target_units.exists()):
                # Skip tower/unit membership check for admin-facing notifications
                # Admins need to see these regardless of their tower/unit assignment
                admin_notification_types = ['bulletin_needs_approval', 'bulletin_updated']
                notif_type_code = notification.notification_type.code if notification.notification_type else None
                if notif_type_code not in admin_notification_types and not is_member_in_targeted_units(member, entity):
                    print(f"Hiding notification {notification.id} for member {member.id} - no longer in targeted tower/unit")
                    return False
        return True
    else:
        # Entity was created BEFORE permission grant - this is a retroactive notification
        print(f"Hiding retroactive notification {notification.id} for member {member.id} - entity timestamp {entity_timestamp} before permission grant {permission_grant_timestamp}")
        return False


def has_view_permission(member, entity_type):
    """
    Check if a member has view permission for a specific entity type.
    
    Args:
        member: Member instance
        entity_type: One of 'announcement', 'bulletin', 'notice', 'member', 'resident', 'unit'
    
    Returns:
        bool: True if member has view permission, False otherwise
    
    Note:
        - SuperAdmin role members always have view permission for all entity types
        - Community members (is_org_member=False) can view announcements, bulletins, and notices by default
        - Organization members need explicit view permissions for restricted access
    """
    # Check if member has SuperAdmin role - SuperAdmins have all permissions
    try:
        from group_role.models import MembersRole, Role
        has_superadmin_role = MembersRole.objects.filter(
            member=member,
            role__role_name__iexact="SuperAdmin",
            role__is_active=True,
            is_active=True
        ).exists()
        if has_superadmin_role:
            # print(f"Member {member.id} ({member.full_name}) has SuperAdmin role - granting view permission for {entity_type}")
            return True
    except Exception as e:
        print(f"Error checking SuperAdmin role for member {member.id}: {e}")
        import traceback
        traceback.print_exc()
        # Continue with normal permission check if SuperAdmin check fails
    
    # Community members (mobile app users) can view announcements, bulletins, notices,
    # and service fee related notifications by default.
    # Service fee notifications (bill issued, payment confirmed, overdue) are personal
    # notifications meant for the community member who owns/resides in the unit.
    # Check is_comm_member flag - users can be both org and comm members
    if member.is_comm_member and entity_type in ['announcement', 'bulletin', 'notice', 'service_fee', 'bill', 'payment']:
        print(f"[OK] Community member {member.id} ({member.full_name}) can view {entity_type} (no permission required)")
        return True
    
    # Get the member's permission IDs
    try:
        permission_ids = member.get_permission_ids()
    except Exception as e:
        print(f"Error getting permission IDs for member {member.id}: {e}")
        return False
    
    # Map entity types to their view permission IDs
    from group_role.permission_constants import (
        PERMISSION_VIEW_UNIT_RESIDENT, PERMISSION_VIEW_UNIT_STAFF, 
        PERMISSION_RECORD_PAYMENT, PERMISSION_VIEW_BILLING_MANAGEMENT,
        PERMISSION_VIEW_SERVICE_FEE_PAYMENTS, PERMISSION_VIEW_SERVICE_FEE_OVERVIEW,
        PERMISSION_GENERATE_SERVICE_FEES
    )
    permission_map = {
        'announcement': PERMISSION_VIEW_ANNOUNCEMENTS,
        'bulletin': PERMISSION_VIEW_BULLETIN_BOARD,
        'notice': PERMISSION_VIEW_NOTICE_BOARD,
        'member': PERMISSION_VIEW_MEMBER_LIST,
        'resident': PERMISSION_VIEW_UNIT_RESIDENT,
        'unit': PERMISSION_VIEW_UNIT_RESIDENT,  # Unit notifications use same permission (for resident removal)
        'unit_staff': PERMISSION_VIEW_UNIT_STAFF,  # Unit staff notifications
        'service_fee': PERMISSION_RECORD_PAYMENT,  # Service fee notifications (community member: bill issued, payment confirmed, overdue)
        'bill': [PERMISSION_VIEW_BILLING_MANAGEMENT, PERMISSION_GENERATE_SERVICE_FEES, PERMISSION_VIEW_SERVICE_FEE_OVERVIEW],  # Bill generation notifications (admin: monthly bills generated)
        'payment': [PERMISSION_RECORD_PAYMENT, PERMISSION_VIEW_SERVICE_FEE_PAYMENTS, PERMISSION_VIEW_SERVICE_FEE_OVERVIEW],  # Payment received notifications (admin: payment received)
    }
    
    required_permission = permission_map.get(entity_type)
    if required_permission:
        if isinstance(required_permission, list):
            has_permission = any(p in permission_ids for p in required_permission)
        else:
            has_permission = required_permission in permission_ids
        
        # Special case: allow bill generator to view bill notifications even if they don't have view permission
        if entity_type == 'bill':
            from group_role.permission_constants import PERMISSION_GENERATE_SERVICE_FEES
            if PERMISSION_GENERATE_SERVICE_FEES in permission_ids:
                has_permission = True
                
        if not has_permission:
            print(f"Member {member.id} ({member.full_name}) does not have view permission for {entity_type} (required: {required_permission}, has: {permission_ids})")
        return has_permission
    
    # Unknown entity type - for 'other' or new types, allow by default
    # This ensures role and group notifications work without additional permission checks
    if entity_type in ['other', 'role', 'group', 'owner']:
        return True
    
    # Unknown entity type - deny by default
    print(f"Unknown entity type: {entity_type}")
    return False


def filter_recipients_by_permission(recipients, entity_type, creator=None, entity_created_at=None):
    """
    Filter a list of recipients to only include those with view permission.
    Creators are always included regardless of permission check.
    Organization members (is_org_member=True) are always allowed to see org-level content.
    
    IMPORTANT: Notifications are NOT retroactive. Recipients only receive notifications
    for items created AFTER they were granted the view permission.
    
    Args:
        recipients: List of Member instances
        entity_type: One of 'announcement', 'bulletin', 'notice'
        creator: Optional Member instance who created the entity (always included)
        entity_created_at: Timestamp when the entity was created (for non-retroactive filtering)
    
    Returns:
        List of Member instances with view permission (plus creator if provided)
    """
    if not recipients:
        return []
    
    # Map entity types to their view permission IDs
    permission_map = {
        'announcement': PERMISSION_VIEW_ANNOUNCEMENTS,
        'bulletin': PERMISSION_VIEW_BULLETIN_BOARD,
        'notice': PERMISSION_VIEW_NOTICE_BOARD,
    }
    required_permission = permission_map.get(entity_type)
    
    filtered = []
    creator_ids = set()
    if creator:
        creator_ids.add(creator.id)
        # Always include creator, even if they don't have explicit view permission
        filtered.append(creator)
        print(f"Including creator {creator.id} ({creator.full_name}) in recipients (bypassing permission check)")
    
    for recipient in recipients:
        # Skip if already added (creator)
        if recipient.id in creator_ids:
            continue
        
        # Organization members are always allowed to see org-level content (announcements, bulletins, notices)
        if recipient.is_org_member:
            filtered.append(recipient)
            print(f"Including org member {recipient.id} ({recipient.full_name}) for {entity_type} (is_org_member=True)")
        elif has_view_permission(recipient, entity_type):
            # User has permission - now check if notification should be sent based on timestamp
            if entity_created_at and required_permission:
                permission_grant_timestamp = recipient.get_permission_grant_timestamp(required_permission)
                
                if permission_grant_timestamp:
                    # Only include if entity was created AFTER permission was granted
                    if entity_created_at > permission_grant_timestamp:
                        filtered.append(recipient)
                        print(f"Including recipient {recipient.id} ({recipient.full_name}) - entity created after permission grant")
                    else:
                        print(f"Filtered out recipient {recipient.id} ({recipient.full_name}) - entity created BEFORE permission grant (retroactive filter)")
                        print(f"  Entity created: {entity_created_at}, Permission granted: {permission_grant_timestamp}")
                else:
                    # If we can't determine permission timestamp, include the recipient
                    # This handles edge cases and maintains backward compatibility
                    filtered.append(recipient)
                    print(f"Including recipient {recipient.id} ({recipient.full_name}) - permission timestamp unavailable")
            else:
                # No entity timestamp provided, use old behavior
                filtered.append(recipient)
        else:
            print(f"Filtered out recipient {recipient.id} ({recipient.full_name}) - no view permission for {entity_type}")
    
    return filtered


def get_targeted_recipients(entity, entity_type='announcement'):
    """
    Get recipients based on conditional tower/unit targeting rules.
    
    Rules:
    1. No tower AND no unit → Send to ALL organization members
    2. Tower AND unit → Send ONLY to members of that specific tower+unit
    3. Only tower (no unit) → Send to ALL members of that tower
    4. Only unit (with tower implied) → Send to ALL members of that unit
    
    Args:
        entity: The entity (Announcement, Bulletin, or Notice) instance
        entity_type: Type of entity ('announcement', 'bulletin', 'notice')
    
    Returns:
        set: Set of Member instances who should receive notifications
    """
    recipients = set()
    
    try:
        # Get target towers and units
        target_units = list(entity.target_units.all())
        target_towers = list(entity.target_towers.all())
        
        # RULE 1: No tower AND no unit → ALL members (org + community)
        if not target_towers and not target_units:
            print(f"[{entity_type.upper()}] RULE 1: No towers/units selected → Sending to ALL members (org + community)")
            from user.models import Member
            from django.db.models import Q
            
            # Include BOTH organization members AND community members
            # Community members (is_comm_member=True) are mobile app users who should receive
            # global announcements, bulletins, and notices just like org members
            all_members = Member.objects.filter(
                Q(is_org_member=True) | Q(is_comm_member=True)
            )
            recipients.update(all_members)
            
            print(f"[{entity_type.upper()}] Found {len(recipients)} members (org + community)")
            return recipients
        
        # RULE 2 & 3 & 4: Targeted selection
        # Collect all unit IDs based on selection
        target_unit_ids = set()
        
        # RULE 2: Both tower AND unit selected → specific members of those tower+unit combinations
        if target_towers and target_units:
            print(f"[{entity_type.upper()}] RULE 2: Both towers ({len(target_towers)}) AND units ({len(target_units)}) selected")
            # Only include the specific units that were selected
            target_unit_ids.update([unit.id for unit in target_units])
            print(f"[{entity_type.upper()}] Targeting {len(target_unit_ids)} specific units")
        
        # RULE 3: Only tower selected (no unit) → ALL members of selected towers
        elif target_towers and not target_units:
            print(f"[{entity_type.upper()}] RULE 3: Only towers selected ({len(target_towers)}) → ALL members of these towers")
            # Get all units from selected towers
            units_from_towers = Unit.objects.filter(
                floor__tower__in=target_towers
            ).values_list('id', flat=True)
            target_unit_ids.update(units_from_towers)
            print(f"[{entity_type.upper()}] Found {len(target_unit_ids)} units in selected towers")
        
        # RULE 4: Only unit selected → ALL members of selected units
        elif target_units and not target_towers:
            print(f"[{entity_type.upper()}] RULE 4: Only units selected ({len(target_units)}) → Members of these units")
            target_unit_ids.update([unit.id for unit in target_units])
            print(f"[{entity_type.upper()}] Targeting {len(target_unit_ids)} selected units")
        
        # Safety check
        if not target_unit_ids:
            print(f"[{entity_type.upper()}] WARNING: No target units determined, returning empty set")
            return recipients
        
        # Get the actual Unit objects
        final_units = Unit.objects.filter(id__in=list(target_unit_ids))
        
        # Get all members associated with these units
        # Include: Residents, Owners, and Unit Staff
        residents = Resident.objects.filter(
            unit__in=final_units,
            is_active=True
        ).select_related('member')
        
        owners = Owner.objects.filter(
            unit__in=final_units
        ).select_related('member')
        
        unit_staff = UnitStaff.objects.filter(
            unit__in=final_units,
            is_active=True
        ).select_related('member')
        
        # Add all members to recipients
        for resident in residents:
            if resident.member:
                recipients.add(resident.member)
        
        for owner in owners:
            if owner.member:
                recipients.add(owner.member)
        
        for staff in unit_staff:
            if staff.member:
                recipients.add(staff.member)
        
        print(f"[{entity_type.upper()}] Found {len(recipients)} members in targeted units")
        
        # FIXED: For targeted communications, only include org members who are
        # actually assigned to the targeted towers/units
        # This prevents org members from receiving push notifications for ALL announcements
        # while still allowing them to VIEW all announcements in the app (controlled by is_user_targeted_by_communication)
        from group_role.models import MembersRole, RolePermission
        from user.models import Member
        
        # Get permission ID based on entity type
        if entity_type == 'announcement':
            permission_id = PERMISSION_VIEW_ANNOUNCEMENTS
        elif entity_type == 'bulletin':
            permission_id = PERMISSION_VIEW_BULLETIN_BOARD
        elif entity_type == 'notice':
            permission_id = PERMISSION_VIEW_NOTICE_BOARD
        else:
            permission_id = None
        
        if permission_id:
            roles_with_permission = RolePermission.objects.filter(
                permission_id=permission_id,
                is_active=True
            ).values_list('role_id', flat=True)
            
            if roles_with_permission:
                org_members_with_permission = MembersRole.objects.filter(
                    role_id__in=roles_with_permission,
                    is_active=True
                ).select_related('member').values_list('member', flat=True).distinct()
                
                # Check if each org member is actually assigned to the targeted towers/units
                for member_id in org_members_with_permission:
                    try:
                        member = Member.objects.get(id=member_id)
                        if member.is_org_member:
                            # Check if this org member is assigned to any of the targeted units
                            member_unit_ids = set()
                            
                            # Get member's units from Resident, Owner, and UnitStaff
                            resident_units = Resident.objects.filter(
                                member=member,
                                is_active=True
                            ).values_list('unit_id', flat=True)
                            member_unit_ids.update(resident_units)
                            
                            owner_units = Owner.objects.filter(
                                member=member
                            ).values_list('unit_id', flat=True)
                            member_unit_ids.update(owner_units)
                            
                            staff_units = UnitStaff.objects.filter(
                                member=member,
                                is_active=True
                            ).values_list('unit_id', flat=True)
                            member_unit_ids.update(staff_units)
                            
                            # Only add org member if they have at least one unit in the targeted units
                            # This ensures org members only receive notifications for bulletins targeted to their towers/units
                            if member_unit_ids.intersection(target_unit_ids):
                                recipients.add(member)
                                print(f"[{entity_type.upper()}] Added org member {member.full_name} - assigned to targeted unit")
                            else:
                                print(f"[{entity_type.upper()}] Skipping org member {member.full_name} - not in targeted unit")
                    except Exception as e:
                        print(f"Error checking org member {member_id}: {e}")
                        continue
        
        print(f"[{entity_type.upper()}] Final recipient count: {len(recipients)} (including relevant org members)")
        return recipients
        
    except Exception as e:
        print(f"[{entity_type.upper()}] ERROR in get_targeted_recipients: {e}")
        import traceback
        traceback.print_exc()
        return recipients


def get_bulletin_recipients(bulletin):
    """
    Get all members who should receive notifications for a bulletin
    based on conditional tower/unit targeting rules.
    
    Rules:
    1. No tower AND no unit → ALL organization members
    2. Tower AND unit → ONLY members of that specific tower+unit
    3. Only tower (no unit) → ALL members of that tower
    4. Only unit → ALL members of that unit
    """
    try:
        # Use the new unified targeting function
        recipients = get_targeted_recipients(bulletin, entity_type='bulletin')
        
        # Convert to list for filtering
        recipients_list = list(recipients)
        
        # Filter by view permission
        # NOTE: During notification CREATION, we do NOT filter by entity_created_at
        # We send notifications to ALL users who currently have permission
        # Retroactive filtering happens later during DISPLAY (in should_show_notification)
        # 
        # FIXED: Do NOT pass creator parameter for notifications
        # Creator should only receive notification if they're in the targeted recipients
        filtered_recipients = filter_recipients_by_permission(
            recipients_list, 
            'bulletin', 
            creator=None,  # Don't auto-add creator for push notifications
            entity_created_at=None
        )
        
        print(f"[BULLETIN] Filtered to {len(filtered_recipients)} recipients with view permission")
        
        # Log recipient user IDs for tracking
        recipient_ids = [r.id for r in filtered_recipients]
        print(f"[BULLETIN] Recipient IDs: {recipient_ids}")
        
        return filtered_recipients
        
    except Exception as e:
        print(f"Error getting bulletin recipients: {e}")
        import traceback
        traceback.print_exc()
        return []


def get_notice_recipients(notice):
    """
    Get all members who should receive notifications for a notice
    based on conditional tower/unit targeting rules.
    
    Rules:
    1. No tower AND no unit → ALL organization members
    2. Tower AND unit → ONLY members of that specific tower+unit
    3. Only tower (no unit) → ALL members of that tower
    4. Only unit → ALL members of that unit
    """
    try:
        # Use the new unified targeting function
        recipients = get_targeted_recipients(notice, entity_type='notice')
        
        # Convert to list for filtering
        recipients_list = list(recipients)
        
        # Filter by view permission
        # NOTE: During notification CREATION, we do NOT filter by entity_created_at
        # We send notifications to ALL users who currently have permission
        # Retroactive filtering happens later during DISPLAY (in should_show_notification)
        # 
        # FIXED: Do NOT pass creator parameter for notifications
        # Creator should only receive notification if they're in the targeted recipients
        filtered_recipients = filter_recipients_by_permission(
            recipients_list, 
            'notice', 
            creator=None,  # Don't auto-add creator for push notifications
            entity_created_at=None
        )
        
        print(f"[NOTICE] Filtered to {len(filtered_recipients)} recipients with view permission")
        
        # Log recipient user IDs for tracking
        recipient_ids = [r.id for r in filtered_recipients]
        print(f"[NOTICE] Recipient IDs: {recipient_ids}")
        
        return filtered_recipients
        
    except Exception as e:
        print(f"Error getting notice recipients: {e}")
        import traceback
        traceback.print_exc()
        return []


def get_members_with_bulletin_approval_permission():
    """
    Get all members who have permission to approve/reject bulletins
    """
    from group_role.models import Role, RolePermission, MembersRole
    from group_role.permission_constants import PERMISSION_APPROVE_REJECT_BULLETIN_BOARD
    
    try:
        # Get all roles that have the approve/reject bulletin permission
        role_permissions = RolePermission.objects.filter(
            permission_id=PERMISSION_APPROVE_REJECT_BULLETIN_BOARD,
            is_active=True
        ).values_list('role_id', flat=True)
        
        if not role_permissions:
            print("No roles found with bulletin approval permission")
            return []
        
        # Get all active roles with this permission
        roles = Role.objects.filter(
            id__in=role_permissions,
            is_active=True
        )
        
        if not roles.exists():
            print("No active roles found with bulletin approval permission")
            return []
        
        # Get all members who have these roles
        members_roles = MembersRole.objects.filter(
            role_id__in=roles.values_list('id', flat=True),
            is_active=True
        ).select_related('member')
        
        members = set()
        for mr in members_roles:
            # Include both community members (is_comm_member) and organization members (is_org_member)
            # who have approval permission
            if mr.member and (mr.member.is_comm_member or mr.member.is_org_member):
                members.add(mr.member)
        
        print(f"Found {len(members)} members with bulletin approval permission")
        return list(members)
        
    except Exception as e:
        print(f"Error getting members with bulletin approval permission: {e}")
        import traceback
        traceback.print_exc()
        return []


def get_announcement_recipients(announcement):
    """
    Get all members who should receive notifications for an announcement
    based on conditional tower/unit targeting rules.
    
    Rules:
    1. No tower AND no unit → ALL organization members
    2. Tower AND unit → ONLY members of that specific tower+unit
    3. Only tower (no unit) → ALL members of that tower
    4. Only unit → ALL members of that unit
    """
    try:
        # Use the new unified targeting function
        recipients = get_targeted_recipients(announcement, entity_type='announcement')
        
        # FIXED: Only include creator if they're targeted
        # For GLOBAL announcements (no targeting), creator is already included by get_targeted_recipients
        # For TARGETED announcements, only include creator if they're assigned to the targeted tower/unit
        target_towers = list(announcement.target_towers.all())
        target_units = list(announcement.target_units.all())
        
        if announcement.creator and (target_towers or target_units):
            # This is a targeted announcement - check if creator is assigned to targeted tower/unit
            creator_in_targeted = announcement.creator in recipients
            if creator_in_targeted:
                print(f"[ANNOUNCEMENT] Creator {announcement.creator.full_name} already in targeted recipients")
            else:
                print(f"[ANNOUNCEMENT] Creator {announcement.creator.full_name} NOT in targeted recipients - will not receive push notification")
        
        # Convert to list for filtering
        recipients_list = list(recipients)
        
        # Filter by view permission
        # NOTE: During notification CREATION, we do NOT filter by entity_created_at
        # We send notifications to ALL users who currently have permission
        # Retroactive filtering happens later during DISPLAY (in should_show_notification)
        # 
        # FIXED: Do NOT pass creator parameter for notifications
        # Creator should only receive notification if they're in the targeted recipients
        # (The filter_recipients_by_permission function automatically adds creator, which we don't want for push notifications)
        filtered_recipients = filter_recipients_by_permission(
            recipients_list, 
            'announcement', 
            creator=None,  # Don't auto-add creator for push notifications
            entity_created_at=None
        )
        
        print(f"[ANNOUNCEMENT] Filtered to {len(filtered_recipients)} recipients with view permission")
        
        # Log recipient user IDs for tracking
        recipient_ids = [r.id for r in filtered_recipients]
        print(f"[ANNOUNCEMENT] Recipient IDs: {recipient_ids}")
        
        return filtered_recipients
    except Exception as e:
        print(f"Error getting announcement recipients: {e}")
        import traceback
        traceback.print_exc()
        return []


def get_or_create_notification_type(code, name, entity_type='announcement', description=None, icon=None, priority=0):
    """
    Get or create a notification type dynamically
    
    Args:
        code: Unique code for the notification type (e.g., 'announcement_published')
        name: Display name (e.g., 'Announcement Published')
        entity_type: Type of entity (e.g., 'announcement', 'bulletin', 'member')
        description: Optional description
        icon: Optional icon/emoji
        priority: Priority level (default: 0)
    
    Returns:
        NotificationType instance
    """
    notification_type, created = NotificationType.objects.get_or_create(
        code=code,
        defaults={
            'name': name,
            'entity_type': entity_type,
            'description': description or f"Notification for {name}",
            'icon': icon,
            'priority': priority,
            'is_active': True
        }
    )
    if created:
        print(f"Created new notification type: {code} ({name})")
    return notification_type


def create_announcement_notification(announcement, notification_type_code, is_update=False):
    """
    Create notifications for all recipients of an announcement
    Uses unified format for both push and in-app notifications:
    - Title: "Important Announcement" for Urgent/High, "New Announcement" for Medium/Low
    - Body: [Announcement Title]\nPosted by: [Admin/Group Name]\n#[Label]
    - Delivery: Push + In-app for Urgent/High/Medium, In-app only for Low
    
    Args:
        announcement: The Announcement instance
        notification_type_code: One of 'announcement_published', 'announcement_scheduled', 'announcement_updated'
        is_update: Boolean indicating if this is an update to an existing announcement
    """
    try:
        # Get or create the notification type
        notification_type_map = {
            'announcement_published': {
                'name': 'Announcement Published',
                'description': 'Notification when an announcement is published',
                'icon': '📢',
                'priority': 5
            },
            'announcement_scheduled': {
                'name': 'Announcement Scheduled',
                'description': 'Notification when an announcement is scheduled',
                'icon': '⏰',
                'priority': 3
            },
            'announcement_updated': {
                'name': 'Announcement Updated',
                'description': 'Notification when an announcement is updated',
                'icon': '🔄',
                'priority': 4
            },
            'announcement_ongoing': {
                'name': 'Announcement Now Ongoing',
                'description': 'Notification when an announcement becomes ongoing',
                'icon': '🔔',
                'priority': 4
            }
        }
        
        type_info = notification_type_map.get(notification_type_code, {
            'name': notification_type_code.replace('_', ' ').title(),
            'description': f'Notification for {notification_type_code}',
            'icon': '📋',
            'priority': 0
        })
        
        notification_type = get_or_create_notification_type(
            code=notification_type_code,
            name=type_info['name'],
            entity_type='announcement',
            description=type_info['description'],
            icon=type_info['icon'],
            priority=type_info['priority']
        )
        
        # Get the poster's name (Admin/Group Name)
        if announcement.post_as == 'group' and announcement.group_name:
            poster_name = announcement.group_name
        elif announcement.post_as == 'member' and announcement.member_name:
            poster_name = announcement.member_name
        else:
            poster_name = announcement.creator.full_name if announcement.creator else "Unknown"
        
        priority = announcement.priority.lower() if announcement.priority else 'low'
        
        # UNIFIED FORMAT (same for both push and in-app notifications)
        # Title: "Important Announcement" for Urgent/High, "New Announcement" for Medium/Low
        if priority in ['urgent', 'high']:
            title = "Important Announcement"
        else:  # medium, low, normal
            title = "New Announcement"
        
        # Body: [Announcement Title]\nPosted by: [Admin/Group Name]\n#[Label]
        label_tag = f"#{announcement.label}" if announcement.label else ""
        if label_tag:
            message = f"{announcement.title}\nPosted by: {poster_name}\n{label_tag}"
        else:
            message = f"{announcement.title}\nPosted by: {poster_name}"
        
        # Use same format for mobile (push notifications)
        mobile_title = title
        mobile_message = message
        
        # Get all recipients
        recipients = get_announcement_recipients(announcement)
        
        # Only add creator if they are in targeted tower/unit or announcement is global.
        # For tower-targeted announcements, do NOT add creator if they don't stay in that tower (no push to them).
        recipients_set = set(recipients) if recipients else set()
        if announcement.creator:
            if announcement.creator in recipients_set:
                print(f"DEBUG: Creator {announcement.creator.full_name} already in recipients")
            else:
                target_towers = list(announcement.target_towers.all())
                target_units = list(announcement.target_units.all())
                if not target_towers and not target_units:
                    recipients_set.add(announcement.creator)
                    print(f"DEBUG: Ensured creator {announcement.creator.full_name} (id: {announcement.creator.id}) is in recipients (global announcement)")
                else:
                    print(f"DEBUG: Creator {announcement.creator.full_name} not in targeted tower/unit - not adding to push recipients")
        
        recipients = list(recipients_set)
        
        # Check for Internal Announcement (No Tower/Unit)
        target_towers_exist = announcement.target_towers.exists()
        target_units_exist = announcement.target_units.exists()
        is_internal_announcement = not target_towers_exist and not target_units_exist
        
        # CORRECT LOGIC:
        # 1. Global announcements (no tower, no unit) → Org members ONLY via admin notifications
        # 2. Targeted announcements (tower/unit selected) → All members in those towers/units via regular notifications
        # For global announcements, SKIP regular notifications (only admin notifications will be created)
        if is_internal_announcement and notification_type_code in ['announcement_published', 'announcement_ongoing']:
            print(f"Global announcement detected - skipping regular notifications (only admin notifications will be sent)")
            return []
        
        if not recipients:
            print(f"No recipients found for announcement {announcement.id}, skipping notification creation")
            print(f"DEBUG: Announcement creator: {announcement.creator.full_name if announcement.creator else 'None'} (id: {announcement.creator.id if announcement.creator else 'N/A'})")
            return []
        
        # Determine if push notification should be sent based on priority
        # Urgent/High/Medium (normal): Push + In-app, Low: In-app only
        should_send_push = priority in ['urgent', 'high', 'normal']
        
        # Debug: Check if creator is in recipients
        creator_in_recipients = announcement.creator in recipients if announcement.creator else False
        print(f"DEBUG: Creator {announcement.creator.full_name if announcement.creator else 'None'} in recipients: {creator_in_recipients}")
        print(f"DEBUG: Total recipients: {len(recipients)}, Recipient IDs: {[r.id for r in recipients]}")
        print(f"DEBUG: Priority: {priority}, Should send push: {should_send_push}")
        
        # Prepare metadata (unified format for both push and in-app)
        metadata = {
            'announcement_title': announcement.title,
            'poster_name': poster_name,
            'post_as': announcement.post_as,
            'priority': priority,
            'label': announcement.label or '',
            'should_send_push': should_send_push,
            # Unified format (same for push and in-app)
            'mobile_title': mobile_title,
            'short_message': mobile_message  # Use 'short_message' to match push service expectations
        }
        
        # Exclude admins from regular notifications (they'll get admin notifications instead)
        # Get admin members who should receive admin notifications
        from group_role.models import MembersRole, RolePermission
        from group_role.permission_constants import PERMISSION_VIEW_ANNOUNCEMENTS
        
        roles_with_permission = RolePermission.objects.filter(
            permission_id=PERMISSION_VIEW_ANNOUNCEMENTS,
            is_active=True
        ).values_list('role_id', flat=True)
        
        admin_member_ids = set()
        if roles_with_permission:
            admin_member_ids = set(MembersRole.objects.filter(
                role_id__in=roles_with_permission,
                is_active=True
            ).values_list('member_id', flat=True).distinct())
        
        # Filter out admins (org members) from regular notifications
        # They will receive admin notifications instead
        # MODIFIED: For dual-role users (Org + Community), we MUST allow them to receive
        # the regular community notification on their Mobile App.
        # However, they should NOT see this notification on the Web Dashboard (which is for Admin work).
        
        # Strategy:
        # 1. Regular Residents -> 'both' channel (Web + Mobile)
        # 2. Dual-Role Users (Admins) -> 'mobile' channel ONLY (so they see it on app, but not on web dashboard)
        
        notifications = []
        
        # Helper to check if user is an admin
        def is_admin(member):
            return member.id in admin_member_ids or member.is_org_member

        for recipient in recipients:
            # Check target filtering first
            # For targeted communications, check if recipient is in targeted units
            # BUT allow committee members who are residents to always receive notifications
            if (announcement.target_towers.exists() or announcement.target_units.exists()):
                # Check if recipient is a committee member
                is_committee_member = getattr(recipient, 'is_comm_member', False)
                
                if not is_committee_member:
                    # For non-committee members, check if they're in targeted units
                    if not is_member_in_targeted_units(recipient, announcement):
                        continue
                # Committee members who are residents will pass through (they'll receive notifications)

            try:
                # Determine channel based on role
                # For targeted announcements:
                # - Non-admins: 'both' (web + mobile)  
                # - Admins: 'mobile' only (they get separate admin notification on 'web')
                # For internal announcements (no tower/unit):
                # - Everyone: 'web' only
                
                is_internal_announcement = not announcement.target_towers.exists() and not announcement.target_units.exists()
                
                if is_internal_announcement:
                    # Internal org announcement → web only
                    channel = 'web'
                elif is_admin(recipient):
                    # Admin with targeted announcement → mobile only (admin notification handles web)
                    channel = 'mobile'
                else:
                    # Non-admin with targeted announcement → both channels
                    channel = 'both'
                
                # For updates, delete existing notifications first
                if is_update:
                    Notification.objects.filter(
                        recipient=recipient,
                        entity_type='announcement',
                        entity_id=announcement.id
                    ).delete()
                
                notification, created = Notification.objects.get_or_create(
                    recipient=recipient,
                    notification_type=notification_type,
                    entity_type='announcement',
                    entity_id=announcement.id,
                    defaults={
                        'title': title,
                        'message': message,
                        'metadata': metadata,
                        'channel': channel, 
                    }
                )
                
                # If notification existed but channel was different, update it
                if not created and notification.channel != channel:
                    notification.channel = channel
                    notification.save(update_fields=['channel'])
                    
                notifications.append(notification)
                if created:
                    print(f"DEBUG: Created notification {notification.id} for recipient {recipient.id} ({recipient.full_name}) - Channel: {channel}")
            except Exception as e:
                print(f"Error creating notification for recipient {recipient.id}: {e}")
                import traceback
                traceback.print_exc()
                continue
        
        # Send push notifications if required (use unified push service like notices)
        # Only send push to recipients still in targeted tower (same rule as in-app should_show_notification)
        if should_send_push and notifications:
            try:
                notifications_to_send = [n for n in notifications if _should_send_push_for_notification(n)]
                skipped = len(notifications) - len(notifications_to_send)
                if skipped:
                    print(f"DEBUG: Skipping push for {skipped} recipient(s) - no longer in targeted tower/unit (push would not show in-app)")
                if notifications_to_send:
                    from .unified_push_service import send_unified_push_for_notifications as send_push_for_notifications
                    print(f"DEBUG: Sending push notifications for {len(notifications_to_send)} recipients")
                    result = send_push_for_notifications(notifications_to_send)
                    if result.get('success'):
                        print(f"Successfully sent push notifications for announcement {announcement.id}")
                        if result.get('total_sent'):
                            print(f"✅ Push notifications sent to {result.get('total_sent')} device(s)")
                        if result.get('error_count', 0) > 0:
                            print(f"⚠️  Push had {result.get('error_count')} errors")
                    else:
                        print(f"❌ WARNING: Push notification failed: {result.get('error', 'Unknown error')}")
                        import traceback
                        print(traceback.format_exc())
                else:
                    print(f"DEBUG: No notifications to send after filtering (should_send_push_for_notification check)")
            except Exception as e:
                print(f"❌ ERROR: Exception sending push notifications: {e}")
                import traceback
                traceback.print_exc()
                # Don't fail the entire operation if push fails
        
        print(f"Successfully created {len(notifications)} notifications for announcement {announcement.id}")
        if announcement.creator:
            creator_notifications = [n for n in notifications if n.recipient.id == announcement.creator.id]
            print(f"DEBUG: Creator {announcement.creator.full_name} received {len(creator_notifications)} notification(s)")
        return notifications
    except Exception as e:
        print(f"Error in create_announcement_notification: {e}")
        import traceback
        traceback.print_exc()
        return []


def send_announcement_published_notification(announcement):
    """
    Send notification when an announcement is published (status is 'ongoing')
    Sends to both residents and admins
    """
    # Refresh from database to ensure we have the latest status
    announcement.refresh_from_db()
    print(f"send_announcement_published_notification called for announcement {announcement.id} with status '{announcement.status}'")
    if announcement.status == 'ongoing':
        # Send to residents
        notifications = create_announcement_notification(
            announcement,
            'announcement_published'
        )
        print(f"Sent {len(notifications)} published notifications for announcement {announcement.id}")
        
        # Send to admins
        admin_notifications = create_admin_announcement_notification(
            announcement,
            'announcement_published'
        )
        print(f"Sent {len(admin_notifications)} admin notifications for announcement {announcement.id}")
        
        # Send push notifications to admins (only those in targeted tower - same as regular push)
        if admin_notifications:
            try:
                admin_to_send = [n for n in admin_notifications if _should_send_push_for_notification(n)]
                skipped_admin = len(admin_notifications) - len(admin_to_send)
                if skipped_admin:
                    print(f"DEBUG: Skipping push for {skipped_admin} admin(s) - not in targeted tower/unit")
                if admin_to_send:
                    from .unified_push_service import send_unified_push_for_notifications as send_push_for_notifications
                    result = send_push_for_notifications(admin_to_send)
                    if result.get('success'):
                        print(f"Successfully sent push notifications to admins for announcement {announcement.id}")
                        if result.get('total_sent'):
                            print(f"Push notifications sent to {result.get('total_sent')} admin device(s)")
                    else:
                        print(f"WARNING: Push notification to admins failed: {result.get('error', 'Unknown error')}")
            except Exception as e:
                print(f"Error sending push notifications to admins: {e}")
        
        return notifications
    else:
        print(f"Announcement {announcement.id} status is '{announcement.status}', not 'ongoing', skipping published notification")
    return []


def send_announcement_scheduled_notification(announcement):
    """
    Send notification when an announcement is scheduled (status is 'upcoming')
    Sends ONLY to admins (Web App)
    """
    # Refresh from database to ensure we have the latest status
    announcement.refresh_from_db()
    print(f"send_announcement_scheduled_notification called for announcement {announcement.id} with status '{announcement.status}'")
    if announcement.status == 'upcoming':
        # Send to admins only (Web App)
        admin_notifications = create_admin_announcement_notification(
            announcement,
            'announcement_scheduled'
        )
        print(f"Sent {len(admin_notifications)} admin scheduled notifications for announcement {announcement.id}")
        return admin_notifications
    else:
        print(f"Announcement {announcement.id} status is '{announcement.status}', not 'upcoming', skipping scheduled notification")
    return []


def send_announcement_ongoing_notification(announcement):
    """
    Send notification when an announcement moves from 'upcoming' to 'ongoing'
    Sends to both residents and admins
    """
    # Refresh from database to ensure we have the latest status
    announcement.refresh_from_db()
    print(f"send_announcement_ongoing_notification called for announcement {announcement.id} with status '{announcement.status}'")
    if announcement.status == 'ongoing':
        # Send to residents
        notifications = create_announcement_notification(
            announcement,
            'announcement_ongoing'
        )
        print(f"Sent {len(notifications)} ongoing notifications for announcement {announcement.id}")
        
        # Send to admins
        admin_notifications = create_admin_announcement_notification(
            announcement,
            'announcement_ongoing'
        )
        print(f"Sent {len(admin_notifications)} admin notifications for announcement {announcement.id}")
        
        # Send push to admins only if in targeted tower
        if admin_notifications:
            try:
                admin_to_send = [n for n in admin_notifications if _should_send_push_for_notification(n)]
                if admin_to_send:
                    from .unified_push_service import send_unified_push_for_notifications as send_push_for_notifications
                    result = send_push_for_notifications(admin_to_send)
                    if result.get('success') and result.get('total_sent'):
                        print(f"Successfully sent push notifications to admins for announcement {announcement.id}")
            except Exception as e:
                print(f"Error sending push notifications to admins: {e}")
        
        return notifications
    else:
        print(f"Announcement {announcement.id} status is '{announcement.status}', not 'ongoing', skipping ongoing notification")
    return []


def send_announcement_updated_notification(announcement):
    """
    Send notification when an announcement is updated
    """
    print(f"send_announcement_updated_notification called for announcement {announcement.id}")
    notifications = create_announcement_notification(
        announcement,
        'announcement_updated',
        is_update=True
    )
    print(f"Sent {len(notifications)} updated notifications for announcement {announcement.id}")
    return notifications


def send_announcement_priority_changed_notification(announcement, old_priority):
    """
    Send notification when an announcement's priority changes to a higher level.
    Only sends notifications when priority increases (e.g., Low → High/Urgent/Normal).
    Sends push notifications for High, Urgent, and Normal priorities.
    
    Args:
        announcement: The Announcement instance
        old_priority: The previous priority level (before update)
    
    Returns:
        List of created Notification instances
    """
    print(f"send_announcement_priority_changed_notification called for announcement {announcement.id}: {old_priority} → {announcement.priority}")
    
    # Priority hierarchy (higher number = higher priority)
    priority_levels = {
        'low': 1,
        'normal': 2,
        'high': 3,
        'urgent': 4
    }
    
    old_level = priority_levels.get(old_priority.lower() if old_priority else 'low', 1)
    new_level = priority_levels.get(announcement.priority.lower() if announcement.priority else 'low', 1)
    
    # Only send notifications if priority increased
    if new_level <= old_level:
        print(f"Priority did not increase ({old_priority} → {announcement.priority}), skipping notification")
        return []
    
    # Create notification with priority-specific details
    try:
        # Get notification type for priority change
        notification_type = get_or_create_notification_type(
            code='announcement_priority_changed',
            name='Announcement Priority Changed',
            entity_type='announcement',
            description='Notification when announcement priority is increased',
            icon='⚡',
            priority=5
        )
        
        # Determine notification content based on new priority
        new_priority_lower = announcement.priority.lower() if announcement.priority else 'normal'
        old_priority_lower = old_priority.lower() if old_priority else 'low'
        
        # FIXED: Use simple format as requested
        title = f"Announcement priority changed: {announcement.title}"
        message = f"Priority changed from {old_priority_lower} to {new_priority_lower}"
        
        # Get poster name
        if announcement.post_as == 'group' and announcement.posted_group:
            poster_name = announcement.group_name or announcement.posted_group.name
        elif announcement.post_as == 'member' and announcement.posted_member:
            poster_name = announcement.member_name or announcement.posted_member.full_name
        else:
            poster_name = announcement.creator.full_name if announcement.creator else "Admin"
            
        # Get all recipients
        recipients = get_announcement_recipients(announcement)
        
        # Always include creator
        recipients_set = set(recipients) if recipients else set()
        if announcement.creator:
            recipients_set.add(announcement.creator)
        
        recipients = list(recipients_set)
        
        if not recipients:
            print(f"No recipients found for announcement priority change {announcement.id}")
            return []
        
        # Determine if push notification should be sent (High, Urgent, Normal get push)
        should_send_push = new_priority_lower in ['urgent', 'high', 'normal']
        
        # Prepare metadata
        metadata = {
            'announcement_title': announcement.title,
            'poster_name': poster_name,
            'post_as': announcement.post_as,
            'old_priority': old_priority,
            'new_priority': announcement.priority,
            'priority': new_priority_lower,
            'label': announcement.label or '',
            'should_send_push': should_send_push,
            'mobile_title': title,
            'short_message': message,
            'is_priority_change': True
        }
        
        # Exclude admins from regular notifications
        from group_role.models import MembersRole, RolePermission
        from group_role.permission_constants import PERMISSION_VIEW_ANNOUNCEMENTS
        
        roles_with_permission = RolePermission.objects.filter(
            permission_id=PERMISSION_VIEW_ANNOUNCEMENTS,
            is_active=True
        ).values_list('role_id', flat=True)
        
        admin_member_ids = set()
        if roles_with_permission:
            admin_member_ids = set(MembersRole.objects.filter(
                role_id__in=roles_with_permission,
                is_active=True
            ).values_list('member_id', flat=True).distinct())
        
        regular_recipients = [r for r in recipients if r.id not in admin_member_ids or not r.is_org_member]
        
        # Only create notifications for people who stay in the tower (same rule as publish)
        if announcement.target_towers.exists() or announcement.target_units.exists():
            regular_recipients = [r for r in regular_recipients if is_member_in_targeted_units(r, announcement)]
        
        # Create notifications for each recipient
        notifications = []
        for recipient in regular_recipients:
            try:
                # Delete existing notifications for this announcement to avoid duplicates
                Notification.objects.filter(
                    recipient=recipient,
                    entity_type='announcement',
                    entity_id=announcement.id
                ).delete()
                
                notification = Notification.objects.create(
                    recipient=recipient,
                    notification_type=notification_type,
                    entity_type='announcement',
                    entity_id=announcement.id,
                    title=title,
                    message=message,
                    channel='mobile',  # Mobile only as requested
                    metadata=metadata,
                    is_read=False
                )
                notifications.append(notification)
                print(f"Created priority change notification {notification.id} for recipient {recipient.id} ({recipient.full_name})")
            except Exception as e:
                print(f"Error creating priority change notification for recipient {recipient.id}: {e}")
                import traceback
                traceback.print_exc()
                continue
        
        # Send push only to recipients who stay in the tower
        if should_send_push and notifications:
            try:
                to_send = [n for n in notifications if _should_send_push_for_notification(n)]
                if to_send:
                    from .unified_push_service import send_unified_push_for_notifications as send_push_for_notifications
                    result = send_push_for_notifications(to_send)
                    if result.get('success'):
                        print(f"Successfully sent push notifications for announcement priority change {announcement.id}")
                    if result.get('total_sent'):
                        print(f"Push notifications sent to {result.get('total_sent')} device(s)")
                else:
                    print(f"WARNING: Push notification failed: {result.get('error', 'Unknown error')}")
            except Exception as e:
                print(f"Error sending push notifications for priority change: {e}")
                import traceback
                traceback.print_exc()
        
        # Also send admin notifications
        admin_notifications = create_admin_announcement_priority_changed_notification(announcement, old_priority)
        print(f"Sent {len(admin_notifications)} admin notifications for priority change")
        
        # Send push to admins only if in targeted tower
        if admin_notifications:
            try:
                admin_to_send = [n for n in admin_notifications if _should_send_push_for_notification(n)]
                if admin_to_send:
                    from .unified_push_service import send_unified_push_for_notifications as send_push_for_notifications
                    result = send_push_for_notifications(admin_to_send)
                    if result.get('success'):
                        print(f"Successfully sent push notifications to admins for priority change")
            except Exception as e:
                print(f"Error sending push notifications to admins: {e}")
        
        print(f"Successfully created {len(notifications)} priority change notifications for announcement {announcement.id}")
        return notifications
    except Exception as e:
        print(f"Error in send_announcement_priority_changed_notification: {e}")
        import traceback
        traceback.print_exc()
        return []


def create_admin_announcement_priority_changed_notification(announcement, old_priority):
    """
    Create admin notifications when announcement priority is changed
    
    Args:
        announcement: The Announcement instance
        old_priority: The previous priority level
    
    Returns:
        List of created Notification instances for admins
    """
    try:
        from group_role.models import MembersRole, RolePermission
        from group_role.permission_constants import PERMISSION_VIEW_ANNOUNCEMENTS
        
        # Get priority in lowercase for comparison
        priority_lower = announcement.priority.lower() if announcement.priority else 'low'
        should_send_push = priority_lower in ['urgent', 'high', 'normal']
        
        # Get notification type
        notification_type = get_or_create_notification_type(
            code='admin_announcement_priority_changed',
            name='Announcement Priority Changed',
            entity_type='announcement',
            description='Admin notification when announcement priority is changed',
            icon='⚡',
            priority=5
        )
        
        title = f"Announcement priority changed: {announcement.title}"
        message = f"Priority changed from {old_priority} to {announcement.priority}"
        
        # Get all admins with view permission
        roles_with_permission = RolePermission.objects.filter(
            permission_id=PERMISSION_VIEW_ANNOUNCEMENTS,
            is_active=True
        ).values_list('role_id', flat=True)
        
        if not roles_with_permission:
            return []
        
        admin_member_ids = MembersRole.objects.filter(
            role_id__in=roles_with_permission,
            is_active=True
        ).values_list('member_id', flat=True).distinct()
        
        from user.models import Member
        all_admins = Member.objects.filter(id__in=admin_member_ids, is_org_member=True)
        
        if not all_admins.exists():
            return []
        
        # For tower-targeted announcements, only notify admins who are in that tower (same rule: no push if not in tower)
        target_towers = list(announcement.target_towers.all())
        target_units = list(announcement.target_units.all())
        if target_towers or target_units:
            admins = [a for a in all_admins if is_member_in_targeted_units(a, announcement)]
        else:
            admins = list(all_admins)
        
        # Create notifications for each admin
        notifications = []
        for admin in admins:
            try:
                notification, created = Notification.objects.get_or_create(
                    recipient=admin,
                    notification_type=notification_type,
                    entity_type='announcement',
                    entity_id=announcement.id,
                    defaults={
                        'title': title,
                        'message': message,
                        'channel': 'mobile',
                        'metadata': {
                            'announcement_title': announcement.title,
                            'old_priority': old_priority,
                            'new_priority': announcement.priority,
                            'priority': priority_lower,
                            'should_send_push': should_send_push,
                            'short_message': message,
                            'is_admin_notification': True,
                            'is_priority_change': True
                        }
                    }
                )
                if created:
                    notifications.append(notification)
            except Exception as e:
                print(f"Error creating admin priority change notification: {e}")
                continue
        
        return notifications
    except Exception as e:
        print(f"Error in create_admin_announcement_priority_changed_notification: {e}")
        import traceback
        traceback.print_exc()
        return []


def create_admin_announcement_notification(announcement, notification_type_code):
    """
    Create admin notifications for community posts requiring action
    Shows notifications to admins when announcements are published or scheduled
    
    Args:
        announcement: The Announcement instance
        notification_type_code: 'announcement_published' or 'announcement_scheduled'
    
    Returns:
        List of created Notification instances for admins
    """
    try:
        from group_role.models import MembersRole, Role, RolePermission
        from group_role.permission_constants import PERMISSION_VIEW_ANNOUNCEMENTS
        
        # Get priority in lowercase for comparison
        priority_lower = announcement.priority.lower() if announcement.priority else 'low'
        should_send_push = priority_lower in ['urgent', 'high', 'normal']
        
        # Get notification type
        if notification_type_code == 'announcement_published':
            notification_type = get_or_create_notification_type(
                code='admin_announcement_published',
                name='New Announcement Published',
                entity_type='announcement',
                description='Admin notification when a new announcement is published',
                icon='📢',
                priority=5
            )
            title = f"New announcement published by: {announcement.creator.full_name if announcement.creator else 'Unknown'}"
            message = f"Announcement '{announcement.title}' has been published"
            active_tab = 1  # Ongoing tab
        elif notification_type_code == 'announcement_scheduled':
            notification_type = get_or_create_notification_type(
                code='admin_announcement_scheduled',
                name='New Announcement Scheduled',
                entity_type='announcement',
                description='Admin notification when a new announcement is scheduled',
                icon='⏰',
                priority=3
            )
            title = f"New announcement scheduled by – {announcement.creator.full_name if announcement.creator else 'Unknown'}"
            message = f"Announcement '{announcement.title}' has been scheduled"
            active_tab = 2  # Upcoming tab
        elif notification_type_code == 'announcement_ongoing':
            notification_type = get_or_create_notification_type(
                code='admin_announcement_ongoing',
                name='Announcement Now Ongoing',
                entity_type='announcement',
                description='Admin notification when a scheduled announcement becomes ongoing',
                icon='🔔',
                priority=4
            )
            title = f"Scheduled announcement now ongoing: {announcement.title}"
            message = f"Announcement '{announcement.title}' is now active"
            active_tab = 1  # Ongoing tab
        else:
            return []
        
        # FIXED: Get admins who are assigned to the targeted towers/units
        # For global announcements, send to all admins
        # For targeted announcements, only send to admins assigned to those towers/units
        
        # First, get all admins with view permission
        roles_with_permission = RolePermission.objects.filter(
            permission_id=PERMISSION_VIEW_ANNOUNCEMENTS,
            is_active=True
        ).values_list('role_id', flat=True)
        
        if not roles_with_permission:
            print(f"No roles with announcement view permission found")
            return []
        
        # Get all members with these roles (admins)
        admin_members = MembersRole.objects.filter(
            role_id__in=roles_with_permission,
            is_active=True
        ).select_related('member').values_list('member', flat=True).distinct()
        
        # Convert to Member objects
        from user.models import Member
        all_admins = Member.objects.filter(id__in=admin_members, is_org_member=True)
        
        if not all_admins.exists():
            print(f"No admin members found for announcement notification")
            return []
        
        # Check if this is a targeted announcement
        target_towers = list(announcement.target_towers.all())
        target_units = list(announcement.target_units.all())
        
        # IMPORTANT: For SCHEDULED announcements, notify ALL admins (web dashboard management)
        # For PUBLISHED/ONGOING, only notify admins in targeted towers (they need to know it's active in their area)
        if notification_type_code == 'announcement_scheduled':
            # Scheduled announcements: Notify ALL admins regardless of tower
            # (They need to see what's scheduled for management purposes)
            admins = list(all_admins)
            print(f"[ADMIN] Scheduled announcement - sending to all {len(admins)} admins (management notification)")
        elif target_towers or target_units:
            # Published/Ongoing with targeting: Only notify admins assigned to those towers/units
            # ALWAYS include the creator (they need to see their own announcement notifications)
            admins = [admin for admin in all_admins if is_member_in_targeted_units(admin, announcement)]
            if announcement.creator and announcement.creator.is_org_member and announcement.creator not in admins:
                admins.append(announcement.creator)
                print(f"[ADMIN] Added creator {announcement.creator.full_name} to admin recipients (creator should always see their announcements)")
            print(f"[ADMIN] Targeted active announcement - sending to {len(admins)} admins in targeted tower/unit (+ creator)")
        else:
            # Global announcement - notify all admins
            admins = list(all_admins)
            print(f"[ADMIN] Global announcement - sending to all {len(admins)} admins")
        
        if not admins:
            print(f"[ADMIN] No admins found for announcement {announcement.id}")
            return []
        
        # Create notifications for each admin
        notifications = []
        for admin in admins:
            try:
                notification, created = Notification.objects.get_or_create(
                    recipient=admin,
                    notification_type=notification_type,
                    entity_type='announcement',
                    entity_id=announcement.id,
                    defaults={
                        'title': title,
                        'message': message,
                        'channel': 'web',  # Admin notifications strictly for Web Dashboard (Mobile gets the 'resident' version)
                        'metadata': {
                            'announcement_title': announcement.title,
                            'creator_name': announcement.creator.full_name if announcement.creator else 'Unknown',
                            'creator_id': announcement.creator.id if announcement.creator else None,
                            'active_tab': active_tab,
                            'is_admin_notification': True,
                            'priority': priority_lower,
                            'should_send_push': False, # Admin notifications don't need push (Mobile version handles it)
                            'short_message': message
                        }
                    }
                )
                
                # If notification existed but channel was 'both' or 'mobile', fix it to 'web'
                if not created and notification.channel != 'web':
                    notification.channel = 'web'
                    notification.save(update_fields=['channel'])
                if created:
                    notifications.append(notification)
                    print(f"Created admin notification {notification.id} for admin {admin.id} ({admin.full_name})")
            except Exception as e:
                print(f"Error creating admin notification for admin {admin.id}: {e}")
                continue
        
        print(f"Successfully created {len(notifications)} admin notifications for announcement {announcement.id}")
        return notifications
    except Exception as e:
        print(f"Error in create_admin_announcement_notification: {e}")
        import traceback
        traceback.print_exc()
        return []


def send_push_notifications_for_announcement(announcement, notifications, title, message, icon=None):
    """
    DEPRECATED: Use send_push_for_notifications from push_service.py instead
    
    This function is kept for backwards compatibility but is no longer used.
    New code should use the unified push service: push_service.send_push_for_notifications()
    
    Send push notifications to mobile devices for an announcement
    Uses Expo Push Notification service
    
    Args:
        announcement: The Announcement instance
        notifications: List of Notification instances created
        title: Notification title (unified format)
        message: Notification message (unified format)
        icon: Optional icon/emoji for the notification
    """
    try:
        from .models import DeviceToken
        
        # Get all push tokens for recipients
        recipient_ids = [n.recipient.id for n in notifications]
        
        # Get active device tokens for recipients
        device_tokens = DeviceToken.objects.filter(
            member_id__in=recipient_ids,
            is_active=True
        ).values_list('push_token', flat=True).distinct()
        
        push_tokens = list(device_tokens)
        
        if not push_tokens:
            print(f"No push tokens found for announcement {announcement.id} recipients")
            return
        
        print(f"Found {len(push_tokens)} push tokens for announcement {announcement.id}")
        
        # Prepare push notification payload with unified format
        push_messages = []
        # Get priority in lowercase for comparison
        priority_lower = announcement.priority.lower() if announcement.priority else 'low'
        for push_token in push_tokens:
            push_payload = {
                'to': push_token,
                'sound': 'default',
                'title': title,  # Unified format: "Important Announcement" or "New Announcement"
                'body': message,  # Unified format: [Title]\nPosted by: [Name]\n#[Label]
                'data': {
                    'type': 'announcement',
                    'announcement_id': announcement.id,
                    'priority': announcement.priority,
                    'entity_type': 'announcement',
                    'entity_id': announcement.id
                },
                'priority': 'high' if priority_lower in ['urgent', 'high'] else 'default'
            }
            # Add icon if available (for Android notification icon)
            if icon:
                push_payload['icon'] = icon
            push_messages.append(push_payload)
        
        # Send via Expo Push Notification API
        expo_push_url = 'https://exp.host/--/api/v2/push/send'
        response = requests.post(
            expo_push_url,
            headers={
                'Content-Type': 'application/json',
                'Accept': 'application/json',
                'Accept-Encoding': 'gzip, deflate'
            },
            data=json.dumps(push_messages),
            timeout=10
        )
        
        if response.status_code == 200:
            result = response.json()
            print(f"Successfully sent push notifications for announcement {announcement.id}")
            print(f"Expo response: {result}")
        else:
            print(f"Failed to send push notifications: {response.status_code} - {response.text}")
        
    except Exception as e:
        print(f"Error sending push notifications: {e}")
        import traceback
        traceback.print_exc()


def delete_announcement_notifications(announcement_id):
    """
    Delete all notifications related to a specific announcement
    """
    deleted_count = Notification.objects.filter(
        entity_type='announcement',
        entity_id=announcement_id
    ).delete()[0]
    return deleted_count


def create_notification(recipient, notification_type_code, entity_type, entity_id, title, message, metadata=None):
    """
    Generic function to create a notification for any entity type
    
    Args:
        recipient: Member instance who will receive the notification
        notification_type_code: Code for the notification type (e.g., 'bulletin_created', 'member_created')
        entity_type: Type of entity (e.g., 'bulletin', 'member', 'notice')
        entity_id: ID of the entity
        title: Notification title
        message: Notification message
        metadata: Optional dictionary with additional metadata
    
    Returns:
        Notification instance or None
    """
    try:
        # Get or create the notification type
        notification_type = get_or_create_notification_type(
            code=notification_type_code,
            name=notification_type_code.replace('_', ' ').title(),
            entity_type=entity_type,
            description=f"Notification for {notification_type_code}",
            priority=0
        )
        
        notification, created = Notification.objects.get_or_create(
            recipient=recipient,
            notification_type=notification_type,
            entity_type=entity_type,
            entity_id=entity_id,
            defaults={
                'title': title,
                'message': message,
                'metadata': metadata or {}
            }
        )
        
        if not created:
            print(f"DEBUG: Notification already exists for recipient {recipient.id}, entity {entity_type}:{entity_id}, skipping duplicate")
        
        return notification
    except Exception as e:
        print(f"Error creating notification: {e}")
        import traceback
        traceback.print_exc()
        return None


def create_bulk_notifications(recipients, notification_type_code, entity_type, entity_id, title, message, metadata=None):
    """
    Create notifications for multiple recipients at once
    
    Args:
        recipients: List of Member instances
        notification_type_code: Code for the notification type
        entity_type: Type of entity
        entity_id: ID of the entity
        title: Notification title
        message: Notification message
        metadata: Optional dictionary with additional metadata
    
    Returns:
        List of created Notification instances
    """
    if not recipients:
        return []
    
    try:
        # Get or create the notification type
        notification_type = get_or_create_notification_type(
            code=notification_type_code,
            name=notification_type_code.replace('_', ' ').title(),
            entity_type=entity_type,
            description=f"Notification for {notification_type_code}",
            priority=0
        )
        
        notifications = []
        for recipient in recipients:
            try:
                notification, created = Notification.objects.get_or_create(
                    recipient=recipient,
                    notification_type=notification_type,
                    entity_type=entity_type,
                    entity_id=entity_id,
                    defaults={
                        'title': title,
                        'message': message,
                        'metadata': metadata or {}
                    }
                )
                notifications.append(notification)
            except Exception as e:
                print(f"Error creating notification for recipient {recipient.id}: {e}")
                continue
        
        return notifications
    except Exception as e:
        print(f"Error in create_bulk_notifications: {e}")
        import traceback
        traceback.print_exc()
        return []


def restore_announcement_notifications(announcement):
    """
    Restore notifications for an announcement when it's restored from expired
    Creates notifications based on the current status of the announcement
    Always creates new notifications when called (doesn't check for existing ones)
    """
    print(f"restore_announcement_notifications called for announcement {announcement.id} with status '{announcement.status}'")
    
    # Only create notifications if announcement is not expired
    if announcement.status == 'expired':
        print(f"Announcement {announcement.id} is still expired, skipping notification creation")
        return []
    
    # Always create new notifications based on current status
    # This ensures notifications are sent every time an announcement is restored
    if announcement.status == 'ongoing':
        print(f"Creating published notifications for restored announcement {announcement.id} (status: ongoing)")
        notifications = send_announcement_published_notification(announcement)
        print(f"Created {len(notifications)} published notifications for restored announcement {announcement.id}")
        return notifications
    elif announcement.status == 'upcoming':
        print(f"Creating scheduled notifications for restored announcement {announcement.id} (status: upcoming)")
        notifications = send_announcement_scheduled_notification(announcement)
        print(f"Created {len(notifications)} scheduled notifications for restored announcement {announcement.id}")
        return notifications
    
    print(f"Announcement {announcement.id} has status '{announcement.status}', no notifications created")
    return []


def create_bulletin_posted_notification(bulletin, approval_timestamp=None):
    """
    Create notification when a bulletin is posted (status is 'current')
    Sends to all targeted community members
    
    Args:
        bulletin: Bulletin instance
        approval_timestamp: Optional datetime when the bulletin was approved.
                          If provided, this timestamp will be used for retroactive filtering
                          instead of the bulletin's creation timestamp. This ensures users
                          receive notifications for bulletins approved after they get permission.
    """
    try:
        print(f"Creating bulletin posted notification for bulletin {bulletin.id}")
        
        # Get or create notification type
        notification_type = get_or_create_notification_type(
            code='bulletin_posted',
            name='Bulletin Posted',
            entity_type='bulletin',
            description='Notification when a bulletin is posted',
            icon='📋',
            priority=5
        )
        
        # Get the poster's full name (always use creator's full name as per requirements)
        poster_name = bulletin.creator.full_name if bulletin.creator else "Admin"
        
        title = f"New bulletin published by: {poster_name}"
        message = f"Bulletin '{bulletin.title}' has been published"
        
        # Get all recipients (includes all active members in targeted units/towers, or all active members if no target)
        recipients = get_bulletin_recipients(bulletin)
        
        if not recipients:
            print(f"No recipients found for bulletin {bulletin.id}, skipping notification creation")
            return []
        
        print(f"Found {len(recipients)} recipients for bulletin posted notification")
        
        # Notifications for published bulletins are only for web portal
        should_send_push = False
        
        # Prepare metadata
        metadata = {
            'bulletin_title': bulletin.title,
            'poster_name': poster_name,
             'post_as': bulletin.post_as,
             'status': 'current',
             'priority': bulletin.priority,
             'should_send_push': should_send_push  # Disable mobile push notifications
         }
        
        # Add approval timestamp to metadata if provided
        # This will be used for retroactive filtering to ensure users only see
        # notifications for bulletins approved after they received permission
        if approval_timestamp:
            metadata['approval_timestamp'] = approval_timestamp.isoformat()
            print(f"Including approval timestamp in metadata: {approval_timestamp.isoformat()}")
        
        # Create notifications for each recipient
        notifications = []
        for recipient in recipients:
            try:
                print(f"DEBUG: Creating notification for recipient {recipient.id} ({recipient.full_name})")
                notification, created = Notification.objects.get_or_create(
                    recipient=recipient,
                    notification_type=notification_type,
                    entity_type='bulletin',
                    entity_id=bulletin.id,
                    defaults={
                        'title': title,
                        'message': message,
                        'channel': 'web',  # Restricted to Web only
                        'metadata': metadata
                    }
                )
                notifications.append(notification)
                if created:
                    print(f"DEBUG: Successfully created notification {notification.id} for recipient {recipient.id}")
                else:
                    print(f"DEBUG: Notification {notification.id} already exists for recipient {recipient.id}, skipping duplicate")
            except Exception as e:
                print(f"ERROR: Error creating notification for recipient {recipient.id}: {e}")
                import traceback
                traceback.print_exc()
                continue
        
        print(f"SUCCESS: Created {len(notifications)} notifications for bulletin {bulletin.id}")
        
        # Send push notifications
        if notifications:
            try:
                # FIX: Only send push to recipients who are actually in the targeted tower/unit
                # This prevents admins (who are added for in-app visibility) from getting spam pushes
                notifications_to_send = [n for n in notifications if _should_send_push_for_notification(n)]
                skipped = len(notifications) - len(notifications_to_send)
                if skipped:
                    print(f"[NOTIFICATION] Skipping push for {skipped} recipient(s) - not in targeted tower/unit")
                
                if notifications_to_send:
                    from .unified_push_service import send_unified_push_for_notifications as send_push_for_notifications
                    result = send_push_for_notifications(notifications_to_send)
                    if result.get('success'):
                        print(f"SUCCESS: Sent push notifications for bulletin {bulletin.id}")
                        if result.get('total_sent'):
                            print(f"Push notifications sent to {result.get('total_sent')} device(s)")
            except Exception as e:
                print(f"Error sending push notifications for bulletin: {e}")
                import traceback
                traceback.print_exc()

        if len(notifications) > 0:
            print(f"DEBUG: Notification IDs created: {[n.id for n in notifications]}")
            print(f"DEBUG: Recipient IDs: {[n.recipient.id for n in notifications]}")
        return notifications
    except Exception as e:
        print(f"Error in create_bulletin_posted_notification: {e}")
        import traceback
        traceback.print_exc()
        return []


def create_bulletin_needs_approval_notification(bulletin):
    """
    Create notification when a bulletin needs approval (status is 'pending')
    Sends only to users with bulletin approval permission
    Works regardless of whether towers/units are selected
    """
    try:
        print(f"DEBUG: Creating bulletin needs approval notification for bulletin {bulletin.id}")
        print(f"DEBUG: Bulletin status: {bulletin.status}, has towers: {bulletin.target_towers.exists()}, has units: {bulletin.target_units.exists()}")
        
        # Get or create notification type
        notification_type = get_or_create_notification_type(
            code='bulletin_needs_approval',
            name='Bulletin Needs Approval',
            entity_type='bulletin',
            description='Notification when a bulletin needs approval',
            icon='⏳',
            priority=6
        )
        print(f"DEBUG: Notification type: {notification_type.code} (id: {notification_type.id})")
        
        # Get the poster's full name (always use creator's full name regardless of post_as)
        poster_name = bulletin.creator.full_name if bulletin.creator else "Admin"
        print(f"DEBUG: Poster name: {poster_name}")
        
        title = f"Bulletin needs approval from: {poster_name}"
        message = f"Bulletin '{bulletin.title}' is awaiting approval"
        
        # Get all members with approval permission (this doesn't depend on towers/units)
        recipients = get_members_with_bulletin_approval_permission()
        print(f"DEBUG: Found {len(recipients)} members with approval permission")
        
        # Always include the creator in recipients (use set to avoid duplicates)
        recipients_set = set(recipients) if recipients else set()
        
        # CRITICAL: Always add creator - this ensures notifications are created even with no approvers
        if bulletin.creator:
            recipients_set.add(bulletin.creator)
            print(f"DEBUG: Added creator {bulletin.creator.full_name} (id: {bulletin.creator.id}) to recipients")
        else:
            print(f"ERROR: Bulletin {bulletin.id} has no creator! Cannot create notification.")
            print(f"ERROR: This should not happen - bulletin.creator should always be set during creation.")
            return []
        
        if not recipients_set:
            print(f"ERROR: No recipients found for bulletin {bulletin.id} even after adding creator!")
            print(f"ERROR: This should not happen if bulletin.creator is set correctly.")
            return []
        
        print(f"DEBUG: Final recipients set has {len(recipients_set)} members")
        for r in recipients_set:
            print(f"DEBUG:   - Recipient: {r.full_name} (id: {r.id}, is_comm_member: {r.is_comm_member})")
        
        # Create notifications for each approver (including creator)
        notifications = []
        for recipient in recipients_set:
            try:
                print(f"DEBUG: Creating notification for approver: {recipient.full_name} (id: {recipient.id})")
                notification, created = Notification.objects.get_or_create(
                    recipient=recipient,
                    notification_type=notification_type,
                    entity_type='bulletin',
                    entity_id=bulletin.id,
                    defaults={
                        'title': title,
                        'message': message,
                        'channel': 'web',  # Restricted to Web only
                        'metadata': {
                            'bulletin_title': bulletin.title,
                            'poster_name': poster_name,
                            'post_as': bulletin.post_as,
                            'status': 'pending',
                            'priority': bulletin.priority,
                            'should_send_push': False  # Disable mobile push notifications
                        }
                    }
                )
                notifications.append(notification)
                if created:
                    print(f"DEBUG: Successfully created notification {notification.id} for recipient {recipient.id}")
                else:
                    print(f"DEBUG: Notification {notification.id} already exists for recipient {recipient.id}, skipping duplicate")
            except Exception as e:
                print(f"ERROR: Failed to create notification for recipient {recipient.id} ({recipient.full_name}): {e}")
                import traceback
                traceback.print_exc()
                continue
        
        print(f"SUCCESS: Created {len(notifications)} approval notifications for bulletin {bulletin.id}")
        if len(notifications) > 0:
            print(f"DEBUG: Notification IDs created: {[n.id for n in notifications]}")
            print(f"DEBUG: Recipient IDs: {[n.recipient.id for n in notifications]}")
        return notifications
    except Exception as e:
        print(f"CRITICAL ERROR in create_bulletin_needs_approval_notification: {e}")
        import traceback
        traceback.print_exc()
        return []


def create_bulletin_updated_notification(bulletin, original_status='pending'):
    """
    Create notification when a bulletin is updated
    Sends only to users with bulletin approval permission
    
    Args:
        bulletin: The bulletin that was updated
        original_status: The status of the bulletin before it was edited (default: 'pending')
    """
    try:
        print(f"Creating bulletin updated notification for bulletin {bulletin.id} (original status: {original_status})")
        
        # Get or create notification type
        notification_type = get_or_create_notification_type(
            code='bulletin_updated',
            name='Bulletin Updated',
            entity_type='bulletin',
            description='Notification when a bulletin is updated',
            icon='✏️',
            priority=5
        )
        
        # Get the poster's full name (always use creator's full name regardless of post_as)
        poster_name = bulletin.creator.full_name if bulletin.creator else "Unknown"
        
        # Determine the status label based on original status
        status_label = "Current" if original_status == 'current' else "Pending"
        
        title = "Bulletin Updated"
        message = f"{status_label} bulletin post updated by {poster_name} needs approval."
        
        # Get all members with approval permission
        # Core rule: Only notify admins, NOT the post owner when they update their bulletin
        recipients = get_members_with_bulletin_approval_permission()
        
        # Do NOT include the creator in recipients - per core rule
        # Notifications should only be sent when admin takes action, not when user updates
        recipients_set = set(recipients) if recipients else set()
        
        # Remove creator from recipients if they're in the set (they might have approval permission)
        # Core rule: No notifications to post owner when they update their own bulletin
        if bulletin.creator and bulletin.creator in recipients_set:
            recipients_set.remove(bulletin.creator)
            print(f"DEBUG: Removed creator {bulletin.creator.full_name} (id: {bulletin.creator.id}) from recipients - no notifications for own updates")
        
        if not recipients_set:
            print(f"No approvers found for bulletin {bulletin.id}, skipping notification creation")
            return []
        
        print(f"DEBUG: Final recipients set has {len(recipients_set)} members: {[r.id for r in recipients_set]}")
        
        # Create notifications for each approver (NOT including creator - per core rule)
        # Core rule: No notifications to post owner when they update their own bulletin
        # Only notify admins that a bulletin needs approval
        notifications = []
        for recipient in recipients_set:
            # Skip the creator - they should not receive notifications for their own updates
            if recipient.id == bulletin.creator.id:
                print(f"DEBUG: Skipping creator {recipient.full_name} (id: {recipient.id}) - no notifications for own updates")
                continue
                
            try:
                notification, created = Notification.objects.get_or_create(
                    recipient=recipient,
                    notification_type=notification_type,
                    entity_type='bulletin',
                    entity_id=bulletin.id,
                    defaults={
                        'title': title,
                        'message': message,
                        'channel': 'both',
                        'metadata': {
                            'bulletin_title': bulletin.title,
                            'poster_name': poster_name,
                            'post_as': bulletin.post_as,
                            'status': 'pending',
                            'should_send_push': True  # Enable push notification for admins
                        }
                    }
                )
                
                # Update metadata if notification already exists
                if not created:
                    notification.metadata = notification.metadata or {}
                    notification.metadata.update({
                        'bulletin_title': bulletin.title,
                        'poster_name': poster_name,
                        'post_as': bulletin.post_as,
                        'status': 'pending',
                        'should_send_push': True
                    })
                    notification.save()
                
                notifications.append(notification)
                
                # Send push notification for admin notifications
                if notification.metadata.get('should_send_push', False):
                    try:
                        from .unified_push_service import send_unified_push_for_notification as send_push_for_notification
                        notification.refresh_from_db()
                        result = send_push_for_notification(notification)
                        if result.get('success'):
                            print(f"✅ Sent push notification for update notification {notification.id} to admin {recipient.id}")
                    except Exception as e:
                        print(f"WARNING: Failed to send push notification to admin {recipient.id}: {e}")
                
                if not created:
                    print(f"DEBUG: Notification {notification.id} already exists for recipient {recipient.id}, updated metadata")
            except Exception as e:
                print(f"Error creating notification for recipient {recipient.id}: {e}")
                continue
        
        print(f"Successfully created {len(notifications)} update notifications for bulletin {bulletin.id} (admins only, not creator)")
        return notifications
    except Exception as e:
        print(f"Error in create_bulletin_updated_notification: {e}")
        import traceback
        traceback.print_exc()
        return []


def create_bulletin_approved_notification(bulletin, approver=None, comment=''):
    """
    Create notification when a bulletin is approved
    Sends only to the bulletin creator to inform them of the approval
    
    Unified Format:
    - Title: "Bulletin Post Approved"
    - Body: "Your post has been approved and is now visible.\n\nTap to view your post."
    """
    try:
        print(f"Creating bulletin approved notification for bulletin {bulletin.id}")
        
        # Get or create notification type
        notification_type = get_or_create_notification_type(
            code='bulletin_approved',
            name='Bulletin Approved',
            entity_type='bulletin',
            description='Notification when a bulletin is approved',
            icon='✅',
            priority=6
        )
        
        # Get the bulletin creator
        if not bulletin.creator:
            print(f"WARNING: Bulletin {bulletin.id} has no creator! Cannot create approval notification.")
            return []
        
        # Unified notification format
        title = "Bulletin Post Approved"
        message = "Your post has been approved and is now visible.\n\nTap to view your post."
        short_message = "Your post has been approved and is now visible. Tap to view your post."
        
        # Create notification for the creator only
        try:
            print(f"DEBUG: Creating approval notification for creator: {bulletin.creator.full_name} (id: {bulletin.creator.id})")
            notification, created = Notification.objects.get_or_create(
                recipient=bulletin.creator,
                notification_type=notification_type,
                entity_type='bulletin',
                entity_id=bulletin.id,
                defaults={
                    'title': title,
                    'message': message,
                    'channel': 'both',  # Show on both web and mobile
                    'metadata': {
                        'bulletin_title': bulletin.title,
                        'approver_name': approver.full_name if approver else "Admin",
                        'approval_comment': comment,
                        'status': 'current',
                        'should_send_push': True  # Enabled for mobile channel
                    }
                }
            )
            
            # Update metadata if notification already exists
            if not created:
                notification.metadata = notification.metadata or {}
                notification.metadata.update({
                    'bulletin_title': bulletin.title,
                    'approver_name': approver.full_name if approver else "Admin",
                    'approval_comment': comment,
                    'status': 'current',
                    'should_send_push': True
                })
                notification.save()
            
            # Send push notification
            # Refresh notification from DB to ensure metadata is loaded
            notification.refresh_from_db()
            metadata = notification.metadata or {}
            
            if metadata.get('should_send_push', False):
                try:
                    from .push_service import send_push_for_notifications
                    result = send_push_for_notifications([notification])
                    if result.get('success'):
                        print(f"SUCCESS: Sent push notification for approval notification {notification.id}")
                        if result.get('success_count'):
                            print(f"SUCCESS: Push notification sent to {result.get('success_count')} device(s)")
                    else:
                        print(f"WARNING: Push notification failed: {result.get('error', 'Unknown error')}")
                except Exception as e:
                    print(f"ERROR: Failed to send push notification: {e}")
                    import traceback
                    traceback.print_exc()
            else:
                print(f"DEBUG: Push notification not enabled for approval notification {notification.id} (should_send_push={metadata.get('should_send_push', False)})")
            
            if created:
                print(f"SUCCESS: Created approval notification {notification.id} for bulletin {bulletin.id}")
            else:
                print(f"DEBUG: Approval notification {notification.id} already exists for bulletin {bulletin.id}, updated metadata")
            return [notification]
        except Exception as e:
            print(f"ERROR: Failed to create approval notification: {e}")
            import traceback
            traceback.print_exc()
            return []
            
    except Exception as e:
        print(f"CRITICAL ERROR in create_bulletin_approved_notification: {e}")
        import traceback
        traceback.print_exc()
        return []


def create_bulletin_approved_member_notification(bulletin, approval_timestamp=None):
    """
    Create push notification for targeted tower/unit members when a bulletin is approved.
    This is separate from create_bulletin_approved_notification (which notifies the creator).
    
    Only sends to members in the targeted tower/unit. If bulletin has no targets,
    sends to all org + community members.
    
    Args:
        bulletin: Bulletin instance (must have status='current')
        approval_timestamp: Optional datetime for retroactive filtering
    """
    try:
        # Skip mobile notifications for global bulletins (no tower/unit targeting)
        # Mobile app does not display global bulletins, so no push should be sent
        if not bulletin.target_towers.exists() and not bulletin.target_units.exists():
            print(f"[BULLETIN] Skipping member notifications for global bulletin {bulletin.id} (no tower/unit targeting)")
            return []
        
        print(f"Creating bulletin approved member notifications for bulletin {bulletin.id}")
        
        # Get or create notification type
        notification_type = get_or_create_notification_type(
            code='bulletin_approved_member',
            name='Bulletin Approved For Members',
            entity_type='bulletin',
            description='Push notification sent to tower members when a bulletin is approved',
            icon='📋',
            priority=5
        )
        
        poster_name = bulletin.creator.full_name if bulletin.creator else "Admin"
        
        title = "Bulletin Post Approved"
        message = f"{bulletin.title}"
        short_message = f"{bulletin.title}"
        
        # Get targeted recipients (tower/unit members)
        recipients = get_bulletin_recipients(bulletin)
        
        if not recipients:
            print(f"No recipients found for bulletin {bulletin.id} member notification")
            return []
        
        # Exclude the creator — they already get their own approval notification
        if bulletin.creator:
            recipients = [r for r in recipients if r.id != bulletin.creator.id]
        
        if not recipients:
            print(f"No recipients left after excluding creator for bulletin {bulletin.id}")
            return []
        
        print(f"Found {len(recipients)} tower member recipients for bulletin approved notification")
        
        # Prepare metadata
        metadata = {
            'bulletin_title': bulletin.title,
            'poster_name': poster_name,
            'post_as': bulletin.post_as,
            'status': 'current',
            'priority': bulletin.priority,
            'should_send_push': True,
            'short_message': short_message,
        }
        
        if approval_timestamp:
            metadata['approval_timestamp'] = approval_timestamp.isoformat()
        
        # Create notifications for each tower member
        notifications = []
        for recipient in recipients:
            try:
                notification, created = Notification.objects.get_or_create(
                    recipient=recipient,
                    notification_type=notification_type,
                    entity_type='bulletin',
                    entity_id=bulletin.id,
                    defaults={
                        'title': title,
                        'message': message,
                        'channel': 'mobile',  # Mobile-only push notification
                        'metadata': metadata
                    }
                )
                if created:
                    notifications.append(notification)
                    print(f"Created member approval notification {notification.id} for member {recipient.id}")
                else:
                    print(f"Notification already exists for member {recipient.id}, skipping")
            except Exception as e:
                print(f"Error creating notification for member {recipient.id}: {e}")
                continue
        
        # Send push notifications
        if notifications:
            try:
                from .unified_push_service import send_unified_push_for_notifications as send_push_for_notifications
                
                # Filter: only send push to members actually in targeted tower/unit
                notifications_to_send = [n for n in notifications if _should_send_push_for_notification(n)]
                skipped = len(notifications) - len(notifications_to_send)
                if skipped:
                    print(f"[MEMBER APPROVAL] Skipping push for {skipped} recipient(s) - not in targeted tower/unit")
                
                if notifications_to_send:
                    result = send_push_for_notifications(notifications_to_send)
                    if result.get('success'):
                        print(f"SUCCESS: Sent {result.get('total_sent', 0)} push notifications for bulletin {bulletin.id} approval")
            except Exception as e:
                print(f"Error sending push notifications for bulletin approval: {e}")
                import traceback
                traceback.print_exc()
        
        print(f"Created {len(notifications)} member approval notifications for bulletin {bulletin.id}")
        return notifications
    except Exception as e:
        print(f"Error in create_bulletin_approved_member_notification: {e}")
        import traceback
        traceback.print_exc()
        return []


def create_bulletin_admin_comment_notification(bulletin, commenter=None, comment=''):
    """
    Create notification when an admin comments on a bulletin post
    Sends only to the bulletin creator to inform them of the admin comment
    
    Unified Format:
    - Title: "Update on Your Bulletin Post"
    - Body: "Admin has commented on your post. Please review.\n\nTap to view details."
    """
    try:
        print(f"Creating bulletin admin comment notification for bulletin {bulletin.id}")
        
        # Get or create notification type
        notification_type = get_or_create_notification_type(
            code='bulletin_admin_comment',
            name='Bulletin Admin Comment',
            entity_type='bulletin',
            description='Notification when an admin comments on a bulletin',
            icon='📝',
            priority=6
        )
        
        # Get the bulletin creator
        if not bulletin.creator:
            print(f"WARNING: Bulletin {bulletin.id} has no creator! Cannot create admin comment notification.")
            return []
        
        # Get the commenter's name
        commenter_name = commenter.full_name if commenter else "Admin"
        
        # Unified notification format
        title = "Update on Your Bulletin Post"
        message = "Admin has commented on your post. Please review."
        short_message = "Admin has commented on your post. Please review."
        
        # Create notification for the creator only
        try:
            print(f"DEBUG: Creating admin comment notification for creator: {bulletin.creator.full_name} (id: {bulletin.creator.id})")
            # Using create() instead of get_or_create() to ensure EVERY comment triggers a new notification
            # as requested: "Every new comment added by the admin... should trigger a notification"
            notification = Notification.objects.create(
                recipient=bulletin.creator,
                notification_type=notification_type,
                entity_type='bulletin',
                entity_id=bulletin.id,
                title=title,
                message=message,
                channel='mobile', # Mobile-only in-app and push (consistent with approval/rejection)
                metadata={
                    'bulletin_title': bulletin.title,
                    'commenter_name': commenter_name,
                    'admin_comment': comment,
                    'status': bulletin.status,
                    'short_message': short_message,
                    'should_send_push': True  # Enable push notification
                }
            )
            
            # Send push notification
            # Refresh notification from DB to ensure metadata is loaded
            notification.refresh_from_db()
            metadata = notification.metadata or {}
            
            if metadata.get('should_send_push', False):
                try:
                    # Use push_service (not unified_push_service) to bypass tower targeting check
                    # This is a personal notification to the creator, not a broadcast
                    from .push_service import send_push_for_notifications
                    result = send_push_for_notifications([notification])
                    if result.get('success'):
                        print(f"SUCCESS: Sent push notification for admin comment notification {notification.id}")
                        if result.get('success_count'):
                            print(f"SUCCESS: Push notification sent to {result.get('success_count')} device(s)")
                    else:
                        print(f"WARNING: Push notification failed: {result.get('error', 'Unknown error')}")
                except Exception as e:
                    print(f"ERROR: Failed to send push notification: {e}")
                    import traceback
                    traceback.print_exc()
            else:
                print(f"DEBUG: Push notification not enabled for admin comment notification {notification.id} (should_send_push={metadata.get('should_send_push', False)})")
            
            print(f"SUCCESS: Created admin comment notification {notification.id} for bulletin {bulletin.id}")
            return [notification]
        except Exception as e:
            print(f"ERROR: Failed to create admin comment notification: {e}")
            import traceback
            traceback.print_exc()
            return []
            
    except Exception as e:
        print(f"CRITICAL ERROR in create_bulletin_admin_comment_notification: {e}")
        import traceback
        traceback.print_exc()
        return []


def create_bulletin_rejected_notification(bulletin, rejector=None, comment=''):
    """
    Create notification when a bulletin is rejected
    Sends only to the bulletin creator to inform them of the rejection
    
    Unified Format:
    - Title: "Bulletin Post Rejected"
    - Body: "Your post was rejected. Please review admin comments.\n\nTap to view details."
    """
    try:
        print(f"Creating bulletin rejected notification for bulletin {bulletin.id}")
        
        # Get or create notification type
        notification_type = get_or_create_notification_type(
            code='bulletin_rejected',
            name='Bulletin Rejected',
            entity_type='bulletin',
            description='Notification when a bulletin is rejected',
            icon='❌',
            priority=6
        )
        
        # Get the rejector's name
        rejector_name = rejector.full_name if rejector else "Admin"
        
        # Get the bulletin creator
        if not bulletin.creator:
            print(f"WARNING: Bulletin {bulletin.id} has no creator! Cannot create rejection notification.")
            return []
        
        # Unified notification format
        title = "Bulletin Post Rejected"
        message = "Your post was rejected. Please review admin comments.\n\nTap to view details."
        short_message = "Your post was rejected. Please review admin comments. Tap to view details."
        
        # Create notification for the creator only
        try:
            print(f"DEBUG: Creating rejection notification for creator: {bulletin.creator.full_name} (id: {bulletin.creator.id})")
            notification, created = Notification.objects.get_or_create(
                recipient=bulletin.creator,
                notification_type=notification_type,
                entity_type='bulletin',
                entity_id=bulletin.id,
                defaults={
                    'title': title,
                    'message': message,
                    'channel': 'both',  # Show on both web and mobile
                    'metadata': {
                        'bulletin_title': bulletin.title,
                        'rejector_name': rejector_name,
                        'rejection_comment': comment,
                        'status': 'archive',
                        'should_send_push': True  # Enable push notification
                    }
                }
            )
            
            # Update metadata if notification already exists
            if not created:
                notification.metadata = notification.metadata or {}
                notification.metadata.update({
                    'bulletin_title': bulletin.title,
                    'rejector_name': rejector_name,
                    'rejection_comment': comment,
                    'status': 'archive',
                    'should_send_push': True
                })
                notification.save()
            
            # Send push notification
            # Refresh notification from DB to ensure metadata is loaded
            notification.refresh_from_db()
            metadata = notification.metadata or {}
            
            if metadata.get('should_send_push', False):
                try:
                    from .push_service import send_push_for_notifications
                    result = send_push_for_notifications([notification])
                    if result.get('success'):
                        print(f"SUCCESS: Sent push notification for rejection notification {notification.id}")
                        if result.get('success_count'):
                            print(f"SUCCESS: Push notification sent to {result.get('success_count')} device(s)")
                    else:
                        print(f"WARNING: Push notification failed: {result.get('error', 'Unknown error')}")
                except Exception as e:
                    print(f"ERROR: Failed to send push notification: {e}")
                    import traceback
                    traceback.print_exc()
            else:
                print(f"DEBUG: Push notification not enabled for rejection notification {notification.id} (should_send_push={metadata.get('should_send_push', False)})")
            
            if created:
                print(f"SUCCESS: Created rejection notification {notification.id} for bulletin {bulletin.id}")
            else:
                print(f"DEBUG: Rejection notification {notification.id} already exists for bulletin {bulletin.id}, updated metadata")
            return [notification]
        except Exception as e:
            print(f"ERROR: Failed to create rejection notification: {e}")
            import traceback
            traceback.print_exc()
            return []
            
    except Exception as e:
        print(f"CRITICAL ERROR in create_bulletin_rejected_notification: {e}")
        import traceback
        traceback.print_exc()
        return []


def create_notice_posted_notification(notice):
    """
    Create notification when a notice is posted.
    Sends to all targeted community members.

    Notification format (web, mobile, push):
    - Title: High/Urgent → "Important Notice"; Medium/Low → "New Notice"
    - Body: Label tag if available (e.g. #Safety), else notice internal title
    - Delivery: Push + in-app for urgent/high/normal; in-app only for low
    """
    try:
        print(f"[NOTIFICATION] Creating notice posted notification for notice {notice.id}")
        
        # Get or create notification type
        notification_type = get_or_create_notification_type(
            code='notice_posted',
            name='Notice Posted',
            entity_type='notice',
            description='Notification when a notice is posted',
            icon='📢',
            priority=5
        )
        print(f"[NOTIFICATION] Notification type: {notification_type.code} (id: {notification_type.id})")
        print(f"[NOTIFICATION] Notice status: {notice.status}")
        print(f"[NOTIFICATION] Notice priority: {notice.priority}")
        print(f"[NOTIFICATION] Notice label: {notice.label}")
        print(f"[NOTIFICATION] Notice start_date: {notice.start_date}, start_time: {notice.start_time}")
        print(f"[NOTIFICATION] Notice end_date: {notice.end_date}, end_time: {notice.end_time}")
        
        # Skip notification if notice is in 'upcoming' status
        # Notifications for upcoming notices will be triggered when they become 'ongoing'
        if notice.status == 'upcoming':
            print(f"[NOTIFICATION] Notice {notice.id} is in 'upcoming' status, skipping notification creation")
            print(f"[NOTIFICATION] Notification will be created when notice transitions to 'ongoing' status")
            return []
        
        print(f"[NOTIFICATION] Notice {notice.id} has status '{notice.status}', proceeding with notification creation")
        
        # Get the poster's name (for metadata only)
        poster_name = notice.creator.full_name if notice.creator else "Admin"
        
        # Determine if push notification should be sent based on priority
        # urgent/high/normal → Push + In-app (so mobile gets push for notice board)
        # low → In-app only
        priority_lower = notice.priority.lower() if notice.priority else 'low'
        should_send_push = priority_lower in ['urgent', 'high', 'normal']

        # -------------------------------------------------------------------------
        # 1. DEFINE WEB CONTENT (Explicitly requested format)
        # -------------------------------------------------------------------------
        web_title = f"New Notice has been posted by - {poster_name}"
        web_message = "Click to go to the notice itself"

        # -------------------------------------------------------------------------
        # 2. DEFINE MOBILE CONTENT (Priority-based format)
        # -------------------------------------------------------------------------
        # Title: High/Urgent → Important Notice, Medium/Low → New Notice
        if priority_lower in ['urgent', 'high']:
            mobile_title = "Important Notice"
        else:
            mobile_title = "New Notice"
        # Body: Label tag if available (e.g. #Safety), else notice internal title
        mobile_message = f"#{notice.label}" if notice.label else (notice.internal_title or "Notice has been published")

        # Get all recipients
        
        # Get all recipients
        print(f"[NOTIFICATION] Getting recipients for notice {notice.id}")
        recipients = get_notice_recipients(notice)
        print(f"[NOTIFICATION] Found {len(recipients)} recipients for notice {notice.id}")
        
        # Always ensure creator is included (even if they were filtered out by permission check)
        # This ensures creators always receive notifications for their own notices
        recipients_set = set(recipients) if recipients else set()
        if notice.creator:
            recipients_set.add(notice.creator)
            print(f"[NOTIFICATION] Ensured creator {notice.creator.full_name} (id: {notice.creator.id}) is in recipients")
        
        if not recipients_set:
            print(f"[NOTIFICATION] WARNING: No recipients found for notice {notice.id}, skipping notification creation")
            return []
        
        print(f"[NOTIFICATION] Final recipients set has {len(recipients_set)} members")
        for r in recipients_set:
            print(f"[NOTIFICATION]   - Recipient: {r.full_name} (id: {r.id}, is_comm_member: {r.is_comm_member})")
        
        # Create TWO notifications per recipient: one for 'web' and one for 'mobile'
        # First, clean up any old notifications with channel='both' for this notice
        old_notifications = Notification.objects.filter(
            notification_type=notification_type,
            entity_type='notice',
            entity_id=notice.id,
            channel='both'
        )
        if old_notifications.exists():
            print(f"[NOTIFICATION] Found {old_notifications.count()} old notification(s) with channel='both', deleting them")
            old_notifications.delete()
        
        notifications = []
        errors = []
        for recipient in recipients_set:
            # Create web notification
            try:
                web_notification, web_created = Notification.objects.get_or_create(
                    recipient=recipient,
                    notification_type=notification_type,
                    entity_type='notice',
                    entity_id=notice.id,
                    channel='web',
                    defaults={
                        'title': web_title,
                        'message': web_message,
                        'metadata': {
                            'notice_title': notice.internal_title,
                            'poster_name': poster_name,
                            'post_as': notice.post_as,
                            'priority': priority_lower,
                            'label': notice.label or '',
                            'start_date': str(notice.start_date),
                            'end_date': str(notice.end_date),
                            'should_send_push': False,  # Web notifications don't send push
                        }
                    }
                )
                
                # Update metadata if notification already exists
                if not web_created:
                    web_notification.metadata = web_notification.metadata or {}
                    web_notification.metadata.update({
                        'notice_title': notice.internal_title,
                        'poster_name': poster_name,
                        'post_as': notice.post_as,
                        'priority': priority_lower,
                        'label': notice.label or '',
                        'start_date': str(notice.start_date),
                        'end_date': str(notice.end_date),
                        'should_send_push': False,
                    })
                    # Remove mobile-specific fields from web notification if they exist
                    if 'mobile_title' in web_notification.metadata:
                        del web_notification.metadata['mobile_title']
                    if 'short_message' in web_notification.metadata:
                        del web_notification.metadata['short_message']
                        
                    web_notification.title = web_title
                    web_notification.message = web_message
                    web_notification.channel = 'web'
                    web_notification.save()
                
                notifications.append(web_notification)
                if web_created:
                    print(f"[NOTIFICATION] Created WEB notification {web_notification.id} for recipient {recipient.id} ({recipient.full_name})")
                else:
                    print(f"[NOTIFICATION] Updated WEB notification {web_notification.id} for recipient {recipient.id} ({recipient.full_name})")
            except Exception as e:
                error_msg = f"Error creating web notification for recipient {recipient.id}: {e}"
                print(f"[NOTIFICATION] {error_msg}")
                errors.append(error_msg)
                import traceback
                traceback.print_exc()
            
            # Create mobile notification — skip for global notices (no tower/unit)
            # because mobile app does not display global notices
            is_global_notice = not notice.target_towers.exists() and not notice.target_units.exists()
            if is_global_notice:
                print(f"[NOTIFICATION] Skipping MOBILE notification for recipient {recipient.id} ({recipient.full_name}) — global notice (no tower/unit)")
                continue
            try:
                mobile_notification, mobile_created = Notification.objects.get_or_create(
                    recipient=recipient,
                    notification_type=notification_type,
                    entity_type='notice',
                    entity_id=notice.id,
                    channel='mobile',
                    defaults={
                        'title': web_title,
                        'message': web_message,
                        'metadata': {
                            'notice_title': notice.internal_title,
                            'poster_name': poster_name,
                            'post_as': notice.post_as,
                            'priority': priority_lower,
                            'label': notice.label or '',
                            'start_date': str(notice.start_date),
                            'end_date': str(notice.end_date),
                            'should_send_push': should_send_push,  # Mobile notifications can send push
                            'mobile_title': mobile_title,
                            'short_message': mobile_message
                        }
                    }
                )
                
                # Update metadata if notification already exists
                if not mobile_created:
                    mobile_notification.metadata = mobile_notification.metadata or {}
                    mobile_notification.metadata.update({
                        'notice_title': notice.internal_title,
                        'poster_name': poster_name,
                        'post_as': notice.post_as,
                        'priority': priority_lower,
                        'label': notice.label or '',
                        'start_date': str(notice.start_date),
                        'end_date': str(notice.end_date),
                        'should_send_push': should_send_push,
                        'mobile_title': mobile_title,
                        'short_message': mobile_message
                    })
                    mobile_notification.title = web_title
                    mobile_notification.message = web_message
                    mobile_notification.channel = 'mobile'
                    mobile_notification.save()
                
                notifications.append(mobile_notification)
                if mobile_created:
                    print(f"[NOTIFICATION] Created MOBILE notification {mobile_notification.id} for recipient {recipient.id} ({recipient.full_name})")
                else:
                    print(f"[NOTIFICATION] Updated MOBILE notification {mobile_notification.id} for recipient {recipient.id} ({recipient.full_name})")
            except Exception as e:
                error_msg = f"Error creating mobile notification for recipient {recipient.id}: {e}"
                print(f"[NOTIFICATION] {error_msg}")
                errors.append(error_msg)
                import traceback
                traceback.print_exc()
                continue
        
        # Send push notifications for mobile notifications only (Critical/Urgent priorities)
        # Only send push for mobile channel notifications, not web
        mobile_notifications = [n for n in notifications if n.channel == 'mobile']
        # Skip push for global notices (no tower/unit) — mobile doesn't show them
        is_global_notice = not notice.target_towers.exists() and not notice.target_units.exists()
        if should_send_push and mobile_notifications and not is_global_notice:
            try:
                # FIX: Only send push to recipients who are actually in the targeted tower/unit
                # This prevents admins (who are added for in-app visibility) from getting spam pushes
                notifications_to_send = [n for n in mobile_notifications if _should_send_push_for_notification(n)]
                skipped = len(mobile_notifications) - len(notifications_to_send)
                if skipped:
                    print(f"[NOTIFICATION] Skipping push for {skipped} mobile notification(s) - not in targeted tower/unit")
                
                if notifications_to_send:
                    from .unified_push_service import send_unified_push_for_notifications as send_push_for_notifications
                    result = send_push_for_notifications(notifications_to_send)
                    if result.get('success'):
                        print(f"[NOTIFICATION] SUCCESS: Sent push notifications for notice {notice.id}")
                        if result.get('total_sent'):
                            print(f"[NOTIFICATION] Push notifications sent to {result.get('total_sent')} device(s)")
                    else:
                        print(f"[NOTIFICATION] WARNING: Push notification failed: {result.get('error', 'Unknown error')}")
            except Exception as e:
                print(f"[NOTIFICATION] ERROR: Failed to send push notifications: {e}")
                import traceback
                traceback.print_exc()
        
        print(f"[NOTIFICATION] Successfully created {len(notifications)} notifications for notice {notice.id}")
        if errors:
            print(f"[NOTIFICATION] {len(errors)} errors occurred during notification creation")
        return notifications
    except Exception as e:
        print(f"[NOTIFICATION] ERROR in create_notice_posted_notification: {e}")
        import traceback
        traceback.print_exc()
        return []


def ensure_bulletin_posted_notifications(bulletin):
    """
    Automatically ensure a bulletin has posted notifications.
    If notifications are missing, create them.
    This function is idempotent - safe to call multiple times.
    
    Args:
        bulletin: Bulletin instance with status 'current'
    
    Returns:
        int: Number of notifications created (0 if already exist)
    """
    from bulletins.models import Bulletin
    
    # Only process bulletins with status 'current'
    if bulletin.status != 'current':
        return 0
    
    try:
        # Check if bulletin_posted notifications already exist
        existing_count = Notification.objects.filter(
            entity_type='bulletin',
            entity_id=bulletin.id,
            notification_type__code='bulletin_posted'
        ).count()
        
        # If notifications already exist, don't create duplicates
        if existing_count > 0:
            return 0
        
        # Create missing notifications
        print(f"[AUTO-FIX] Bulletin {bulletin.id} has no posted notifications. Creating them now...")
        notifications = create_bulletin_posted_notification(bulletin)
        print(f"[AUTO-FIX] Created {len(notifications)} notifications for bulletin {bulletin.id}")
        return len(notifications)
        
    except Exception as e:
        print(f"[AUTO-FIX] Error ensuring notifications for bulletin {bulletin.id}: {e}")
        import traceback
        traceback.print_exc()
        return 0


def create_notifications_for_new_bulletin_permission(member, permission_grant_timestamp):
    """
    Create notifications for a member who just received bulletin view permission.
    This function finds current bulletins created AFTER permission was granted and creates notifications for them IF:
    1. The bulletin is currently active (status='current')
    2. The bulletin was created AFTER the permission was granted (non-retroactive)
    3. The member should receive the bulletin based on targeting (units/towers)
    4. The notification doesn't already exist
    
    This solves the issue where users who previously had no bulletin permission don't receive
    notifications after permission is granted.
    
    IMPORTANT: We only send notifications for bulletins created AFTER permission was granted.
    This ensures notifications are non-retroactive - users don't receive notifications for
    bulletins that existed before they got permission.
    
    Args:
        member: Member instance who just received the permission
        permission_grant_timestamp: datetime when the permission was granted
    
    Returns:
        int: Number of notifications created
    """
    from bulletins.models import Bulletin
    from django.utils import timezone
    
    try:
        print(f"[PERMISSION-GRANT] Creating notifications for member {member.id} ({member.full_name}) who just received bulletin permission at {permission_grant_timestamp}")
        
        # Get only current bulletins created AFTER permission was granted
        # Users only receive notifications for bulletins created after they got permission (non-retroactive)
        current_bulletins = Bulletin.objects.filter(
            status='current',
            created_at__gt=permission_grant_timestamp
        )
        
        notifications_created = 0
        
        for bulletin in current_bulletins:
            # Check if this bulletin is relevant to this member
            # IMPORTANT: We bypass the normal get_bulletin_recipients because it has retroactive filtering logic
            # Since we're explicitly creating notifications for a new permission grant,
            # and we've already filtered by created_at > permission_grant_timestamp,
            # we can safely check if member should receive based on targeting
            # Use a direct check instead
            should_receive = False
            
            # Check if member has view permission (they should, since we just granted it)
            if not has_view_permission(member, 'bulletin'):
                continue
            
            # Check if member is the creator (creators always receive notifications)
            if bulletin.creator == member:
                should_receive = True
            else:
                # Check if member is in the target units/towers
                target_units = list(bulletin.target_units.all())
                target_towers = list(bulletin.target_towers.all())
                
                # If no specific units/towers, all members with permission should receive
                if not target_units and not target_towers:
                    should_receive = True
                else:
                    # Check if member is associated with any target units
                    target_unit_ids = set()
                    if target_towers:
                        units_from_towers = Unit.objects.filter(floor__tower__in=target_towers).values_list('id', flat=True)
                        target_unit_ids.update(units_from_towers)
                    if target_units:
                        target_unit_ids.update([u.id for u in target_units])
                    
                    # Check if member is resident, owner, or staff of any target unit
                    if target_unit_ids:
                        is_resident = Resident.objects.filter(member=member, unit_id__in=target_unit_ids, is_active=True).exists()
                        is_owner = Owner.objects.filter(member=member, unit_id__in=target_unit_ids).exists()
                        is_staff = UnitStaff.objects.filter(member=member, unit_id__in=target_unit_ids, is_active=True).exists()
                        should_receive = is_resident or is_owner or is_staff
                    
                    # Org members always receive if they have permission
                    if member.is_org_member:
                        should_receive = True
            
            if should_receive:
                # Check if notification already exists for this member and bulletin
                existing_notification = Notification.objects.filter(
                    recipient=member,
                    entity_type='bulletin',
                    entity_id=bulletin.id,
                    notification_type__code='bulletin_posted'
                ).first()
                
                if not existing_notification:
                    # Create notification using the existing function
                    # We'll create it directly to ensure it's created for this specific member
                    try:
                        notification_type = get_or_create_notification_type(
                            code='bulletin_posted',
                            name='Bulletin Posted',
                            entity_type='bulletin',
                            description='Notification when a bulletin is posted',
                            icon='📋',
                            priority=5
                        )
                        
                        poster_name = bulletin.creator.full_name if bulletin.creator else "Unknown"
                        title = "New Bulletin Posted"
                        message = f"New bulletin has been posted by {poster_name}"
                        
                        notification, created = Notification.objects.get_or_create(
                            recipient=member,
                            notification_type=notification_type,
                            entity_type='bulletin',
                            entity_id=bulletin.id,
                            defaults={
                                'title': title,
                                'message': message,
                                'metadata': {
                                    'bulletin_title': bulletin.title,
                                    'poster_name': poster_name,
                                    'post_as': bulletin.post_as,
                                    'status': 'current'
                                }
                            }
                        )
                        
                        if created:
                            notifications_created += 1
                            print(f"[PERMISSION-GRANT] Created notification {notification.id} for member {member.id} for bulletin {bulletin.id}")
                        else:
                            print(f"[PERMISSION-GRANT] Notification already exists for member {member.id} for bulletin {bulletin.id}")
                    except Exception as e:
                        print(f"[PERMISSION-GRANT] Error creating notification for member {member.id}, bulletin {bulletin.id}: {e}")
                        import traceback
                        traceback.print_exc()
                        continue
        
        print(f"[PERMISSION-GRANT] Created {notifications_created} notifications for member {member.id} ({member.full_name})")
        return notifications_created
        
    except Exception as e:
        print(f"[PERMISSION-GRANT] Error creating notifications for member {member.id}: {e}")
        import traceback
        traceback.print_exc()
        return 0


def create_notifications_for_new_announcement_permission(member, permission_grant_timestamp):
    """
    Create notifications for a member who just received announcement view permission.
    This function finds ongoing announcements created AFTER permission was granted and creates notifications for them IF:
    1. The announcement is currently ongoing (status='ongoing')
    2. The announcement was created AFTER the permission was granted (non-retroactive)
    3. The member should receive the announcement based on targeting (units/towers)
    4. The notification doesn't already exist
    
    This solves the issue where users who previously had no announcement permission don't receive
    notifications after permission is granted.
    
    IMPORTANT: We only send notifications for announcements created AFTER permission was granted.
    This ensures notifications are non-retroactive - users don't receive notifications for
    announcements that existed before they got permission.
    
    Args:
        member: Member instance who just received the permission
        permission_grant_timestamp: datetime when the permission was granted
    
    Returns:
        int: Number of notifications created
    """
    from announcements.models import Announcement
    from django.utils import timezone
    
    try:
        print(f"[PERMISSION-GRANT] Creating notifications for member {member.id} ({member.full_name}) who just received announcement permission at {permission_grant_timestamp}")
        
        # Get only ongoing announcements created AFTER permission was granted
        # Users only receive notifications for announcements created after they got permission (non-retroactive)
        ongoing_announcements = Announcement.objects.filter(
            status='ongoing',
            created_at__gt=permission_grant_timestamp
        )
        
        notifications_created = 0
        
        for announcement in ongoing_announcements:
            # Check if this announcement is relevant to this member
            # IMPORTANT: We bypass the normal get_announcement_recipients because it has retroactive filtering logic
            # Since we're explicitly creating notifications for a new permission grant,
            # and we've already filtered by created_at > permission_grant_timestamp,
            # we can safely check if member should receive based on targeting
            should_receive = False
            
            # Check if member has view permission (they should, since we just granted it)
            if not has_view_permission(member, 'announcement'):
                continue
            
            # Check if member is the creator (creators always receive notifications)
            if announcement.creator == member:
                should_receive = True
            else:
                # Check if member is in the target units/towers
                target_units = list(announcement.target_units.all())
                target_towers = list(announcement.target_towers.all())
                
                # If no specific units/towers, all members with permission should receive
                if not target_units and not target_towers:
                    should_receive = True
                else:
                    # Check if member is associated with any target units
                    target_unit_ids = set()
                    if target_towers:
                        units_from_towers = Unit.objects.filter(floor__tower__in=target_towers).values_list('id', flat=True)
                        target_unit_ids.update(units_from_towers)
                    if target_units:
                        target_unit_ids.update([u.id for u in target_units])
                    
                    # Check if member is resident, owner, or staff of any target unit
                    if target_unit_ids:
                        is_resident = Resident.objects.filter(member=member, unit_id__in=target_unit_ids, is_active=True).exists()
                        is_owner = Owner.objects.filter(member=member, unit_id__in=target_unit_ids).exists()
                        is_staff = UnitStaff.objects.filter(member=member, unit_id__in=target_unit_ids, is_active=True).exists()
                        should_receive = is_resident or is_owner or is_staff
                    
                    # Org members always receive if they have permission
                    if member.is_org_member:
                        should_receive = True
            
            if should_receive:
                # Check if notification already exists for this member and announcement
                # Check for any announcement notification type (published, scheduled, ongoing)
                existing_notification = Notification.objects.filter(
                    recipient=member,
                    entity_type='announcement',
                    entity_id=announcement.id
                ).first()
                
                if not existing_notification:
                    # Create notification - use 'announcement_published' for ongoing announcements
                    try:
                        notification_type = get_or_create_notification_type(
                            code='announcement_published',
                            name='Announcement Published',
                            entity_type='announcement',
                            description='Notification when an announcement is published',
                            icon='📢',
                            priority=5
                        )
                        
                        # Get the poster's name
                        if announcement.post_as == 'group' and announcement.group_name:
                            poster_name = announcement.group_name
                        elif announcement.post_as == 'member' and announcement.member_name:
                            poster_name = announcement.member_name
                        else:
                            poster_name = announcement.creator.full_name if announcement.creator else "Unknown"
                        
                        title = "New announcement published"
                        message = f"New announcement '{announcement.title}' published by {poster_name}"
                        
                        notification, created = Notification.objects.get_or_create(
                            recipient=member,
                            notification_type=notification_type,
                            entity_type='announcement',
                            entity_id=announcement.id,
                            defaults={
                                'title': title,
                                'message': message,
                                'metadata': {
                                    'announcement_title': announcement.title,
                                    'poster_name': poster_name,
                                    'post_as': announcement.post_as
                                }
                            }
                        )
                        
                        if created:
                            notifications_created += 1
                            print(f"[PERMISSION-GRANT] Created notification {notification.id} for member {member.id} for announcement {announcement.id}")
                        else:
                            print(f"[PERMISSION-GRANT] Notification already exists for member {member.id} for announcement {announcement.id}")
                    except Exception as e:
                        print(f"[PERMISSION-GRANT] Error creating notification for member {member.id}, announcement {announcement.id}: {e}")
                        import traceback
                        traceback.print_exc()
                        continue
        
        print(f"[PERMISSION-GRANT] Created {notifications_created} notifications for member {member.id} ({member.full_name})")
        return notifications_created
        
    except Exception as e:
        print(f"[PERMISSION-GRANT] Error creating notifications for member {member.id}: {e}")
        import traceback
        traceback.print_exc()
        return 0


def create_notifications_for_new_notice_permission(member, permission_grant_timestamp):
    """
    Create notifications for a member who just received notice view permission.
    This function finds ongoing notices created AFTER permission was granted and creates notifications for them IF:
    1. The notice is currently ongoing (status='ongoing')
    2. The notice was created AFTER the permission was granted (non-retroactive)
    3. The member should receive the notice based on targeting (units/towers)
    4. The notification doesn't already exist
    
    This solves the issue where users who previously had no notice permission don't receive
    notifications after permission is granted.
    
    IMPORTANT: We only send notifications for notices created AFTER permission was granted.
    This ensures notifications are non-retroactive - users don't receive notifications for
    notices that existed before they got permission.
    
    Args:
        member: Member instance who just received the permission
        permission_grant_timestamp: datetime when the permission was granted
    
    Returns:
        int: Number of notifications created
    """
    from noticeboard.models import Notice
    from django.utils import timezone
    
    try:
        print(f"[PERMISSION-GRANT] Creating notifications for member {member.id} ({member.full_name}) who just received notice permission at {permission_grant_timestamp}")
        
        # Get only ongoing notices created AFTER permission was granted
        # Users only receive notifications for notices created after they got permission (non-retroactive)
        ongoing_notices = Notice.objects.filter(
            status='ongoing',
            created_at__gt=permission_grant_timestamp
        )
        
        notifications_created = 0
        
        for notice in ongoing_notices:
            # Check if this notice is relevant to this member
            # IMPORTANT: We bypass the normal get_notice_recipients because it has retroactive filtering logic
            # Since we're explicitly creating notifications for a new permission grant,
            # and we've already filtered by created_at > permission_grant_timestamp,
            # we can safely check if member should receive based on targeting
            should_receive = False
            
            # Check if member has view permission (they should, since we just granted it)
            if not has_view_permission(member, 'notice'):
                continue
            
            # Check if member is the creator (creators always receive notifications)
            if notice.creator == member:
                should_receive = True
            else:
                # Check if member is in the target units/towers
                target_units = list(notice.target_units.all())
                target_towers = list(notice.target_towers.all())
                
                # If no specific units/towers, all members with permission should receive
                if not target_units and not target_towers:
                    should_receive = True
                else:
                    # Check if member is associated with any target units
                    target_unit_ids = set()
                    if target_towers:
                        units_from_towers = Unit.objects.filter(floor__tower__in=target_towers).values_list('id', flat=True)
                        target_unit_ids.update(units_from_towers)
                    if target_units:
                        target_unit_ids.update([u.id for u in target_units])
                    
                    # Check if member is resident, owner, or staff of any target unit
                    if target_unit_ids:
                        is_resident = Resident.objects.filter(member=member, unit_id__in=target_unit_ids, is_active=True).exists()
                        is_owner = Owner.objects.filter(member=member, unit_id__in=target_unit_ids).exists()
                        is_staff = UnitStaff.objects.filter(member=member, unit_id__in=target_unit_ids, is_active=True).exists()
                        should_receive = is_resident or is_owner or is_staff
                    
                    # Org members always receive if they have permission
                    if member.is_org_member:
                        should_receive = True
            
            if should_receive:
                # Check if notification already exists for this member and notice
                existing_notification = Notification.objects.filter(
                    recipient=member,
                    entity_type='notice',
                    entity_id=notice.id,
                    notification_type__code='notice_posted'
                ).first()
                
                if not existing_notification:
                    # Create notification
                    try:
                        notification_type = get_or_create_notification_type(
                            code='notice_posted',
                            name='Notice Posted',
                            entity_type='notice',
                            description='Notification when a notice is posted',
                            icon='📌',
                            priority=5
                        )
                        
                        # Get the poster's name (for metadata only)
                        if notice.post_as == 'group' and notice.group_name:
                            poster_name = notice.group_name
                        elif notice.post_as == 'member' and notice.member_name:
                            poster_name = notice.member_name
                        else:
                            poster_name = notice.creator.full_name if notice.creator else "Unknown"
                        
                        # Use same priority-based format as create_notice_posted_notification
                        priority_lower = notice.priority.lower() if notice.priority else 'low'
                        should_send_push = priority_lower in ['urgent', 'high', 'normal']
                        
                        # Priority-based notification format
                        if priority_lower in ['urgent', 'high']:
                            title = "Important Notice"
                        else:
                            title = "New Notice"
                        message = f"#{notice.label}" if notice.label else (notice.internal_title or "Notice has been published")
                        
                        mobile_title = title
                        mobile_message = message
                        
                        # Create web notification
                        web_notification, web_created = Notification.objects.get_or_create(
                            recipient=member,
                            notification_type=notification_type,
                            entity_type='notice',
                            entity_id=notice.id,
                            channel='web',
                            defaults={
                                'title': title,
                                'message': message,
                                'metadata': {
                                    'notice_title': notice.internal_title,
                                    'poster_name': poster_name,
                                    'post_as': notice.post_as,
                                    'priority': priority_lower,
                                    'label': notice.label or '',
                                    'start_date': str(notice.start_date),
                                    'end_date': str(notice.end_date),
                                    'should_send_push': False,
                                    'mobile_title': mobile_title,
                                    'short_message': mobile_message
                                }
                            }
                        )
                        
                        if web_created:
                            notifications_created += 1
                            print(f"[PERMISSION-GRANT] Created WEB notification {web_notification.id} for member {member.id} for notice {notice.id}")
                        else:
                            # Update existing web notification
                            web_notification.title = title
                            web_notification.message = message
                            web_notification.channel = 'web'
                            web_notification.metadata = web_notification.metadata or {}
                            web_notification.metadata.update({
                                'notice_title': notice.internal_title,
                                'poster_name': poster_name,
                                'post_as': notice.post_as,
                                'priority': priority_lower,
                                'label': notice.label or '',
                                'start_date': str(notice.start_date),
                                'end_date': str(notice.end_date),
                                'should_send_push': False,
                                'mobile_title': mobile_title,
                                'short_message': mobile_message
                            })
                            web_notification.save()
                            print(f"[PERMISSION-GRANT] Updated WEB notification {web_notification.id} for member {member.id} for notice {notice.id}")
                        
                        # Create mobile notification — skip for global notices (no tower/unit)
                        is_global_notice = not notice.target_towers.exists() and not notice.target_units.exists()
                        if not is_global_notice:
                            mobile_notification, mobile_created = Notification.objects.get_or_create(
                                recipient=member,
                                notification_type=notification_type,
                                entity_type='notice',
                                entity_id=notice.id,
                                channel='mobile',
                                defaults={
                                    'title': title,
                                    'message': message,
                                    'metadata': {
                                        'notice_title': notice.internal_title,
                                        'poster_name': poster_name,
                                        'post_as': notice.post_as,
                                        'priority': priority_lower,
                                        'label': notice.label or '',
                                        'start_date': str(notice.start_date),
                                        'end_date': str(notice.end_date),
                                        'should_send_push': should_send_push,
                                        'mobile_title': mobile_title,
                                        'short_message': mobile_message
                                    }
                                }
                            )
                            
                            if mobile_created:
                                notifications_created += 1
                                print(f"[PERMISSION-GRANT] Created MOBILE notification {mobile_notification.id} for member {member.id} for notice {notice.id}")
                            else:
                                # Update existing mobile notification
                                mobile_notification.title = title
                                mobile_notification.message = message
                                mobile_notification.channel = 'mobile'
                                mobile_notification.metadata = mobile_notification.metadata or {}
                                mobile_notification.metadata.update({
                                    'notice_title': notice.internal_title,
                                    'poster_name': poster_name,
                                    'post_as': notice.post_as,
                                    'priority': priority_lower,
                                    'label': notice.label or '',
                                    'start_date': str(notice.start_date),
                                    'end_date': str(notice.end_date),
                                    'should_send_push': should_send_push,
                                    'mobile_title': mobile_title,
                                    'short_message': mobile_message
                                })
                                mobile_notification.save()
                                print(f"[PERMISSION-GRANT] Updated MOBILE notification {mobile_notification.id} for member {member.id} for notice {notice.id}")
                        else:
                            print(f"[PERMISSION-GRANT] Skipping MOBILE notification for member {member.id} — global notice {notice.id} (no tower/unit)")
                    except Exception as e:
                        print(f"[PERMISSION-GRANT] Error creating notification for member {member.id}, notice {notice.id}: {e}")
                        import traceback
                        traceback.print_exc()
                        continue
        
        print(f"[PERMISSION-GRANT] Created {notifications_created} notifications for member {member.id} ({member.full_name})")
        return notifications_created
        
    except Exception as e:
        print(f"[PERMISSION-GRANT] Error creating notifications for member {member.id}: {e}")
        import traceback
        traceback.print_exc()
        return 0


def handle_new_member_notifications(member):
    """
    Handle notifications for a newly created member based on their permissions.
    
    IMPORTANT: This function implements non-retroactive notification logic for new members.
    When a new member is created and assigned permissions, they should only receive 
    notifications for announcements, bulletins, and notices created AFTER they joined,
    not for existing ones.
    
    Example scenarios:
    - Announcement A created on Jan 1 (status='ongoing')
    - Announcement B created on Jan 5 (status='ongoing')
    - New member created on Jan 10 with announcement view permission
    - Announcement C created on Jan 12 (status='ongoing')
    - Result: Member receives notification only for Announcement C (created after Jan 10)
    
    Same logic applies to bulletins and notices.
    
    This function should be called after a new member is created and their roles/permissions
    are assigned. It checks what permissions the member has and creates notifications 
    for relevant active entities (bulletins, announcements, notices) that were created
    AFTER the member was created.
    
    Args:
        member: Member instance that was just created
    
    Returns:
        dict: Summary of notifications created for each entity type
    """
    try:
        # Use the member's creation timestamp as the reference point
        # Only entities created AFTER this timestamp will trigger notifications
        member_created_at = member.created_at
        
        if not member_created_at:
            print(f"[NEW-MEMBER] Member {member.id} has no created_at timestamp, cannot create notifications")
            return {'bulletins': 0, 'announcements': 0, 'notices': 0}
        
        print(f"[NEW-MEMBER] Processing notifications for new member {member.id} ({member.full_name}) created at {member_created_at}")
        
        # Get the member's permissions
        permission_ids = member.get_permission_ids()
        
        if not permission_ids:
            print(f"[NEW-MEMBER] Member {member.id} has no permissions, skipping notification creation")
            return {'bulletins': 0, 'announcements': 0, 'notices': 0}
        
        print(f"[NEW-MEMBER] Member {member.id} has permissions: {permission_ids}")
        
        summary = {
            'bulletins': 0,
            'announcements': 0,
            'notices': 0
        }
        
        # Check for bulletin view permission
        if PERMISSION_VIEW_BULLETIN_BOARD in permission_ids:
            print(f"[NEW-MEMBER] Member {member.id} has bulletin view permission, creating bulletin notifications")
            bulletin_count = create_notifications_for_new_bulletin_permission(member, member_created_at)
            summary['bulletins'] = bulletin_count
            print(f"[NEW-MEMBER] Created {bulletin_count} bulletin notifications for member {member.id}")
        
        # Check for announcement view permission
        if PERMISSION_VIEW_ANNOUNCEMENTS in permission_ids:
            print(f"[NEW-MEMBER] Member {member.id} has announcement view permission, creating announcement notifications")
            announcement_count = create_notifications_for_new_announcement_permission(member, member_created_at)
            summary['announcements'] = announcement_count
            print(f"[NEW-MEMBER] Created {announcement_count} announcement notifications for member {member.id}")
        
        # Check for notice view permission
        if PERMISSION_VIEW_NOTICE_BOARD in permission_ids:
            print(f"[NEW-MEMBER] Member {member.id} has notice view permission, creating notice notifications")
            notice_count = create_notifications_for_new_notice_permission(member, member_created_at)
            summary['notices'] = notice_count
            print(f"[NEW-MEMBER] Created {notice_count} notice notifications for member {member.id}")
        
        total_notifications = sum(summary.values())
        print(f"[NEW-MEMBER] SUMMARY: Created total of {total_notifications} notifications for new member {member.id} ({member.full_name})")
        print(f"[NEW-MEMBER]   - Bulletins: {summary['bulletins']}")
        print(f"[NEW-MEMBER]   - Announcements: {summary['announcements']}")
        print(f"[NEW-MEMBER]   - Notices: {summary['notices']}")
        
        return summary
        
    except Exception as e:
        print(f"[NEW-MEMBER] Error handling notifications for new member {member.id}: {e}")
        import traceback
        traceback.print_exc()
        return {'bulletins': 0, 'announcements': 0, 'notices': 0}


def create_org_member_added_notification(new_member):
    """
    Create notifications for all users with "View Member List" permission when a new 
    organization member is added.
    
    IMPORTANT: Only users who have "View Member List" permission should receive this notification.
    Notifications are NOT retroactive - only sent to users who have the permission at the time
    the member is added. Users who get the permission later will NOT see notifications for
    existing members.
    
    Args:
        new_member: Member instance that was just added/created
    
    Returns:
        int: Number of notifications created
    """
    from group_role.permission_constants import PERMISSION_VIEW_MEMBER_LIST
    from user.models import Member
    
    try:
        # Only send notifications for organization members
        if not new_member.is_org_member:
            print(f"[ORG-MEMBER] Member {new_member.id} is not an org member, skipping notification")
            return 0
        
        print(f"[ORG-MEMBER] Creating notifications for new org member {new_member.id} ({new_member.full_name})")
        
        # Get all members who have "View Member List" permission
        potential_recipients = Member.objects.filter(is_org_member=True).exclude(id=new_member.id)
        
        recipients_with_permission = []
        for member in potential_recipients:
            permission_ids = member.get_permission_ids()
            if PERMISSION_VIEW_MEMBER_LIST in permission_ids:
                recipients_with_permission.append(member)
        
        if not recipients_with_permission:
            print(f"[ORG-MEMBER] No members with 'View Member List' permission found")
            return 0
        
        print(f"[ORG-MEMBER] Found {len(recipients_with_permission)} members with permission")
        
        # Create notification type if it doesn't exist
        notification_type = get_or_create_notification_type(
            code='org_member_added',
            name='Organization Member Added',
            entity_type='member',
            description='Notification when a new organization member is added',
            icon='👤',
            priority=50
        )
        
        # Create notifications for all recipients
        notifications_created = 0
        for recipient in recipients_with_permission:
            try:
                notification, created = Notification.objects.get_or_create(
                    recipient=recipient,
                    notification_type=notification_type,
                    entity_type='member',
                    entity_id=new_member.id,
                    defaults={
                        'title': 'New Organization Member Added',
                        'message': f'New organization member added – {new_member.full_name}',
                        'metadata': {
                            'member_id': new_member.id,
                            'member_name': new_member.full_name,
                            'created_at': str(new_member.created_at) if new_member.created_at else None
                        }
                    }
                )
                
                if created:
                    notifications_created += 1
                    print(f"[ORG-MEMBER] Created notification {notification.id} for member {recipient.id}")
                    
            except Exception as e:
                print(f"[ORG-MEMBER] Error creating notification for member {recipient.id}: {e}")
                continue
        
        print(f"[ORG-MEMBER] Created {notifications_created} notifications for new member {new_member.id}")
        return notifications_created
        
    except Exception as e:
        print(f"[ORG-MEMBER] Error in create_org_member_added_notification: {e}")
        import traceback
        traceback.print_exc()
        return 0


def create_role_assigned_notification(member, role, assigner=None, from_group=False, group_name=None):
    """
    Create notifications when a role is assigned to a member.
    Creates two notifications:
    1. For the member who received the role
    2. For the assigner (if provided and different from recipient)
    
    Args:
        member: Member instance who was assigned the role
        role: Role instance that was assigned
        assigner: Optional Member instance who assigned the role
        from_group: Boolean indicating if role came from group membership
        group_name: Name of the group (if from_group is True)
    
    Returns:
        Tuple of (recipient_notification, assigner_notification) or (notification, None)
    """
    try:
        print(f"[ROLE-ASSIGNED] Creating notifications for member {member.id} assigned role {role.role_name} (from_group={from_group})")
        
        # Create notification type for role assignment
        notification_type = get_or_create_notification_type(
            code='role_assigned',
            name='Role Assigned',
            entity_type='other',
            description='Notification when a role is assigned to a member',
            icon='🎭',
            priority=60
        )
        
        # Customize title and message based on whether role came from group
        if from_group:
            title = 'New Role Assigned from Group'
            message = f'You have been assigned a new role – {role.role_name}'
            if group_name:
                message += f' (from group "{group_name}")'
        else:
            title = 'New Role Assigned'
            message = f'You have been assigned a new role – {role.role_name}'
        
        # 1. Create notification for the RECIPIENT (person who received the role)
        try:
            recipient_notification = Notification.objects.create(
                recipient=member,
                notification_type=notification_type,
                entity_type='other',
                entity_id=role.id,
                title=title,
                message=message,
                channel='web',  # Explicitly set as web-only
                metadata={
                    'role_id': role.id,
                    'role_name': role.role_name,
                    'member_id': member.id,
                    'member_name': member.full_name,
                    'assigner_id': assigner.id if assigner else None,
                    'assigner_name': assigner.full_name if assigner else None,
                    'from_group': from_group,
                    'group_name': group_name,
                    'notification_for': 'recipient'
                },
                is_read=False
            )
            recipient_notification.refresh_from_db()
            print(f"[ROLE-ASSIGNED] ✅ Created notification {recipient_notification.id} for RECIPIENT {member.id} ({member.full_name})")
        except Exception as create_error:
            print(f"[ROLE-ASSIGNED] ❌ Error creating recipient notification: {create_error}")
            import traceback
            traceback.print_exc()
            raise
        
        # 2. Create notification for the ASSIGNER (person who assigned the role) if different from recipient
        assigner_notification = None
        if assigner and assigner.id != member.id:
            try:
                if from_group:
                    assigner_title = 'Group Member Role Assignment'
                    assigner_message = f'{member.full_name} received role "{role.role_name}" by being added to group "{group_name}"'
                else:
                    assigner_title = 'Role Assignment Confirmation'
                    assigner_message = f'You assigned role "{role.role_name}" to {member.full_name}'
                
                assigner_notification = Notification.objects.create(
                    recipient=assigner,
                    notification_type=notification_type,
                    entity_type='other',
                    entity_id=role.id,
                    title=assigner_title,
                    message=assigner_message,
                    channel='web',  # Explicitly set as web-only
                    metadata={
                        'role_id': role.id,
                        'role_name': role.role_name,
                        'member_id': member.id,
                        'member_name': member.full_name,
                        'assigner_id': assigner.id,
                        'assigner_name': assigner.full_name,
                        'from_group': from_group,
                        'group_name': group_name,
                        'notification_for': 'assigner'
                    },
                    is_read=False
                )
                assigner_notification.refresh_from_db()
                print(f"[ROLE-ASSIGNED] ✅ Created notification {assigner_notification.id} for ASSIGNER {assigner.id} ({assigner.full_name})")
            except Exception as create_error:
                print(f"[ROLE-ASSIGNED] ⚠️ Error creating assigner notification: {create_error}")
                # Don't raise - recipient notification was created successfully
        
        return (recipient_notification, assigner_notification)
            
    except Exception as e:
        print(f"[ROLE-ASSIGNED] Error creating role assigned notification: {e}")
        import traceback
        traceback.print_exc()
        return None


def create_group_added_notification(member, group, assigner=None):
    """
    Create notifications when a member is added to a group.
    Creates two notifications:
    1. For the member who was added to the group
    2. For the assigner (if provided and different from member)
    
    Args:
        member: Member instance who was added to the group
        group: Group instance the member was added to
        assigner: Optional Member instance who added the member to the group
    
    Returns:
        Tuple of (recipient_notification, assigner_notification) or (notification, None)
    """
    try:
        print(f"[GROUP-ADDED] Creating notifications for member {member.id} added to group {group.group_name}")
        
        # Create notification type if it doesn't exist
        notification_type = get_or_create_notification_type(
            code='group_added',
            name='Added to Group',
            entity_type='other',
            description='Notification when a member is added to a group',
            icon='👥',
            priority=55
        )
        
        # 1. Create notification for the RECIPIENT (person who was added to the group)
        try:
            recipient_notification = Notification.objects.create(
                recipient=member,
                notification_type=notification_type,
                entity_type='other',
                entity_id=group.id,
                title='Added to New Group',
                message=f'You have been added to a new group – {group.group_name}',
                channel='web',  # Explicitly set as web-only
                metadata={
                    'group_id': group.id,
                    'group_name': group.group_name,
                    'member_id': member.id,
                    'member_name': member.full_name,
                    'assigner_id': assigner.id if assigner else None,
                    'assigner_name': assigner.full_name if assigner else None,
                    'notification_for': 'recipient'
                },
                is_read=False
            )
            recipient_notification.refresh_from_db()
            print(f"[GROUP-ADDED] ✅ Created notification {recipient_notification.id} for RECIPIENT {member.id} ({member.full_name})")
        except Exception as create_error:
            print(f"[GROUP-ADDED] ❌ Error creating recipient notification: {create_error}")
            import traceback
            traceback.print_exc()
            raise
        
        # 2. Create notification for the ASSIGNER (person who added them) if different from member
        assigner_notification = None
        if assigner and assigner.id != member.id:
            try:
                assigner_notification = Notification.objects.create(
                    recipient=assigner,
                    notification_type=notification_type,
                    entity_type='other',
                    entity_id=group.id,
                    title='Group Member Addition Confirmation',
                    message=f'You added {member.full_name} to group "{group.group_name}"',
                    channel='web',  # Explicitly set as web-only
                    metadata={
                        'group_id': group.id,
                        'group_name': group.group_name,
                        'member_id': member.id,
                        'member_name': member.full_name,
                        'assigner_id': assigner.id,
                        'assigner_name': assigner.full_name,
                        'notification_for': 'assigner'
                    },
                    is_read=False
                )
                assigner_notification.refresh_from_db()
                print(f"[GROUP-ADDED] ✅ Created notification {assigner_notification.id} for ASSIGNER {assigner.id} ({assigner.full_name})")
            except Exception as create_error:
                print(f"[GROUP-ADDED] ⚠️ Error creating assigner notification: {create_error}")
                # Don't raise - recipient notification was created successfully
        
        return (recipient_notification, assigner_notification)
            
    except Exception as e:
        print(f"[GROUP-ADDED] Error creating group added notification: {e}")
        import traceback
        traceback.print_exc()
        return (None, None)


def create_resident_added_notification(resident, creator=None):
    """
    Create notifications for managers with "View Unit Resident" permission when a 
    resident is added to a unit.
    
    IMPORTANT: Only managers who have "View Unit Resident" permission should receive 
    this notification. Notifications are NOT retroactive - only sent to managers who 
    have the permission at the time the resident is added.
    
    Args:
        resident: Resident instance that was just created
        creator: Optional Member instance who added the resident
    
    Returns:
        int: Number of notifications created
    """
    from group_role.permission_constants import PERMISSION_VIEW_UNIT_RESIDENT
    from user.models import Member
    
    try:
        print(f"[RESIDENT-ADDED] Creating notifications for new resident {resident.id} ({resident.member.full_name}) in unit {resident.unit.unit_name}")
        
        # Get the unit and tower information
        unit = resident.unit
        tower_name = unit.floor.tower.tower_name if unit.floor and unit.floor.tower else "Unknown Tower"
        unit_name = unit.unit_name
        resident_name = resident.member.full_name
        
        # Get all organization members who have "View Unit Resident" permission
        # Exclude the resident themselves from receiving the notification
        potential_recipients = Member.objects.filter(is_org_member=True).exclude(id=resident.member.id)
        
        recipients_with_permission = []
        for member in potential_recipients:
            permission_ids = member.get_permission_ids()
            if PERMISSION_VIEW_UNIT_RESIDENT in permission_ids:
                recipients_with_permission.append(member)
        
        if not recipients_with_permission:
            print(f"[RESIDENT-ADDED] No members with 'View Unit Resident' permission found")
            return 0
        
        print(f"[RESIDENT-ADDED] Found {len(recipients_with_permission)} members with permission")
        
        # Create notification type if it doesn't exist
        notification_type = get_or_create_notification_type(
            code='resident_added',
            name='Resident Added',
            entity_type='resident',
            description='Notification when a new resident is added to a unit',
            icon='🏠',
            priority=40
        )
        
        # Create notifications for all recipients
        notifications_created = 0
        for recipient in recipients_with_permission:
            try:
                notification, created = Notification.objects.get_or_create(
                    recipient=recipient,
                    notification_type=notification_type,
                    entity_type='resident',
                    entity_id=resident.id,
                    defaults={
                        'title': 'New Resident Added',
                        'message': f'New resident added: {tower_name}, Unit {unit_name} — {resident_name}.',
                        'metadata': {
                            'resident_id': resident.id,
                            'resident_name': resident_name,
                            'unit_id': unit.id,
                            'unit_name': unit_name,
                            'tower_name': tower_name,
                            'created_at': str(resident.created_at) if resident.created_at else None,
                            'creator_id': creator.id if creator else None,
                            'creator_name': creator.full_name if creator else None
                        }
                    }
                )
                
                if created:
                    notifications_created += 1
                    print(f"[RESIDENT-ADDED] Created notification {notification.id} for member {recipient.id}")
                    
            except Exception as e:
                print(f"[RESIDENT-ADDED] Error creating notification for member {recipient.id}: {e}")
                continue
        
        print(f"[RESIDENT-ADDED] Created {notifications_created} notifications for new resident {resident.id}")
        return notifications_created
        
    except Exception as e:
        print(f"[RESIDENT-ADDED] Error in create_resident_added_notification: {e}")
        import traceback
        traceback.print_exc()
        return 0


def create_resident_removed_notification(resident, unit, remover=None):
    """
    Create notifications for managers with "View Unit Resident" permission when a 
    resident is removed from a unit.
    
    IMPORTANT: Only managers who have "View Unit Resident" permission should receive 
    this notification. Notifications are NOT retroactive - only sent to managers who 
    have the permission at the time the resident is removed.
    
    Args:
        resident: Resident instance that was removed (or dict with resident info)
        unit: Unit instance from which the resident was removed
        remover: Optional Member instance who removed the resident
    
    Returns:
        int: Number of notifications created
    """
    from group_role.permission_constants import PERMISSION_VIEW_UNIT_RESIDENT
    from user.models import Member
    
    try:
        # Handle both Resident objects and dict info
        if isinstance(resident, dict):
            resident_id = resident.get('id')
            resident_name = resident.get('name')
            member_id = resident.get('member_id')
        else:
            resident_id = resident.id
            resident_name = resident.member.full_name
            member_id = resident.member.id
        
        print(f"[RESIDENT-REMOVED] Creating notifications for removed resident {resident_id} ({resident_name}) from unit {unit.unit_name}")
        
        # Get the unit and tower information
        tower_name = unit.floor.tower.tower_name if unit.floor and unit.floor.tower else "Unknown Tower"
        unit_name = unit.unit_name
        
        # Get all organization members who have "View Unit Resident" permission
        # Exclude the resident themselves from receiving the notification
        potential_recipients = Member.objects.filter(is_org_member=True).exclude(id=member_id)
        
        recipients_with_permission = []
        for member in potential_recipients:
            permission_ids = member.get_permission_ids()
            if PERMISSION_VIEW_UNIT_RESIDENT in permission_ids:
                recipients_with_permission.append(member)
        
        if not recipients_with_permission:
            print(f"[RESIDENT-REMOVED] No members with 'View Unit Resident' permission found")
            return 0
        
        print(f"[RESIDENT-REMOVED] Found {len(recipients_with_permission)} members with permission")
        
        # Create notification type if it doesn't exist
        notification_type = get_or_create_notification_type(
            code='resident_removed',
            name='Resident Removed',
            entity_type='resident',
            description='Notification when a resident is removed from a unit',
            icon='🏠',
            priority=40
        )
        
        # Create notifications for all recipients
        # Note: We use unit.id as entity_id since the resident no longer exists
        notifications_created = 0
        for recipient in recipients_with_permission:
            try:
                notification, created = Notification.objects.get_or_create(
                    recipient=recipient,
                    notification_type=notification_type,
                    entity_type='unit',  # Use 'unit' since resident is deleted
                    entity_id=unit.id,
                    defaults={
                        'title': 'Resident Removed',
                        'message': f'Resident removed: {tower_name}, Unit {unit_name} — {resident_name}.',
                        'metadata': {
                            'resident_id': resident_id,
                            'resident_name': resident_name,
                            'unit_id': unit.id,
                            'unit_name': unit_name,
                            'tower_name': tower_name,
                            'removed_at': str(timezone.now()),
                            'remover_id': remover.id if remover else None,
                            'remover_name': remover.full_name if remover else None
                        }
                    }
                )
                
                if created:
                    notifications_created += 1
                    print(f"[RESIDENT-REMOVED] Created notification {notification.id} for member {recipient.id}")
                    
            except Exception as e:
                print(f"[RESIDENT-REMOVED] Error creating notification for member {recipient.id}: {e}")
                continue
        
        print(f"[RESIDENT-REMOVED] Created {notifications_created} notifications for removed resident {resident_id}")
        return notifications_created
        
    except Exception as e:
        print(f"[RESIDENT-REMOVED] Error in create_resident_removed_notification: {e}")
        import traceback
        traceback.print_exc()
        return 0


def create_bulk_resident_removed_notification(removed_residents_list, remover=None):
    """
    Create aggregated notifications for managers when multiple residents 
    are removed from one or more units in a bulk operation.
    
    Groups removals by unit and creates a single notification per unit with all removed names.
    Format: "John Doe, Jane Smith, and Bob Johnson removed from Unit 101"
    
    Args:
        removed_residents_list: List of dicts with keys: {'id', 'name', 'member_id', 'unit'}
            or list of Resident objects
        remover: Optional Member instance who performed the bulk removal
    
    Returns:
        int: Total number of notifications created
    """
    from group_role.permission_constants import PERMISSION_VIEW_UNIT_RESIDENT
    from user.models import Member
    
    try:
        if not removed_residents_list:
            return 0
        
        # Group removals by unit
        removals_by_unit = {}
        for resident_item in removed_residents_list:
            # Handle both dict and object formats
            if isinstance(resident_item, dict):
                unit = resident_item.get('unit')
                resident_info = {
                    'id': resident_item.get('id'),
                    'name': resident_item.get('name'),
                    'member_id': resident_item.get('member_id')
                }
            else:
                unit = resident_item.unit
                resident_info = {
                    'id': resident_item.id,
                    'name': resident_item.member.full_name,
                    'member_id': resident_item.member.id
                }
            
            if unit:
                unit_id = unit.id if hasattr(unit, 'id') else unit
                if unit_id not in removals_by_unit:
                    removals_by_unit[unit_id] = {
                        'unit': unit if hasattr(unit, 'id') else Unit.objects.get(id=unit_id),
                        'residents_list': []
                    }
                removals_by_unit[unit_id]['residents_list'].append(resident_info)
        
        if not removals_by_unit:
            return 0
        
        total_notifications = 0
        
        # Process each unit's removals
        for unit_id, unit_data in removals_by_unit.items():
            unit = unit_data['unit']
            residents_list = unit_data['residents_list']
            
            if not residents_list:
                continue
            
            tower_name = unit.floor.tower.tower_name if unit.floor and unit.floor.tower else "Unknown Tower"
            unit_name = unit.unit_name
            
            # Format names: "John Doe, Jane Smith, and Bob Johnson"
            resident_names = [r['name'] for r in residents_list]
            if len(resident_names) == 1:
                names_text = resident_names[0]
            elif len(resident_names) == 2:
                names_text = f"{resident_names[0]} and {resident_names[1]}"
            else:
                names_text = ", ".join(resident_names[:-1]) + f", and {resident_names[-1]}"
            
            # Get all organization members who have "View Unit Resident" permission
            # Exclude removed residents from receiving manager notifications
            excluded_member_ids = [r['member_id'] for r in residents_list]
            potential_recipients = Member.objects.filter(is_org_member=True).exclude(id__in=excluded_member_ids)
            
            recipients_with_permission = []
            for member in potential_recipients:
                permission_ids = member.get_permission_ids()
                if PERMISSION_VIEW_UNIT_RESIDENT in permission_ids:
                    recipients_with_permission.append(member)
            
            if not recipients_with_permission:
                print(f"[BULK-RESIDENT-REMOVED] No members with 'View Unit Resident' permission found for unit {unit_name}")
            else:
                print(f"[BULK-RESIDENT-REMOVED] Found {len(recipients_with_permission)} members with permission for unit {unit_name}")
            
            # Create notification type if it doesn't exist
            notification_type = get_or_create_notification_type(
                code='resident_removed',
                name='Resident Removed',
                entity_type='unit',
                description='Notification when residents are removed from a unit',
                icon='🏠',
                priority=40
            )
            
            # Create aggregated notification for managers (one per unit)
            for recipient in recipients_with_permission:
                try:
                    # Use create instead of get_or_create to allow multiple bulk removal notifications
                    notification = Notification.objects.create(
                        recipient=recipient,
                        notification_type=notification_type,
                        entity_type='unit',
                        entity_id=unit.id,
                        title='Residents Removed',
                        message=f'Residents removed: {tower_name}, Unit {unit_name} — {names_text}.',
                        metadata={
                            'removed_residents': residents_list,  # List of all removed residents
                            'removed_count': len(residents_list),
                            'unit_id': unit.id,
                            'unit_name': unit_name,
                            'tower_name': tower_name,
                            'removed_at': str(timezone.now()),
                            'remover_id': remover.id if remover else None,
                            'remover_name': remover.full_name if remover else None,
                            'is_bulk_removal': True
                        }
                    )
                    total_notifications += 1
                    print(f"[BULK-RESIDENT-REMOVED] Created bulk notification {notification.id} for member {recipient.id} (unit {unit_name}, {len(residents_list)} residents removed)")
                    
                except Exception as e:
                    print(f"[BULK-RESIDENT-REMOVED] Error creating notification for member {recipient.id}: {e}")
                    continue
        
        print(f"[BULK-RESIDENT-REMOVED] Created {total_notifications} total notifications for bulk resident removal")
        return total_notifications
        
    except Exception as e:
        print(f"[BULK-RESIDENT-REMOVED] Error in create_bulk_resident_removed_notification: {e}")
        import traceback
        traceback.print_exc()
        return 0


def create_owner_added_notification(owner, creator=None):
    """
    Create notifications for managers with "View Unit Resident" permission when an 
    owner is added to a unit.
    
    Note: Uses "View Unit Resident" permission as owners are also unit residents.
    
    Args:
        owner: Owner instance that was just created
        creator: Optional Member instance who added the owner
    
    Returns:
        int: Number of notifications created
    """
    from group_role.permission_constants import PERMISSION_VIEW_UNIT_RESIDENT
    from user.models import Member
    
    try:
        print(f"[OWNER-ADDED] Creating notifications for new owner {owner.id} ({owner.member.full_name}) in unit {owner.unit.unit_name}")
        
        # Get the unit and tower information
        unit = owner.unit
        tower_name = unit.floor.tower.tower_name if unit.floor and unit.floor.tower else "Unknown Tower"
        unit_name = unit.unit_name
        owner_name = owner.member.full_name
        
        # Get all organization members who have "View Unit Resident" permission
        # DO NOT exclude the owner - they should receive both self-notification AND manager notification
        potential_recipients = Member.objects.filter(is_org_member=True)
        
        recipients_with_permission = []
        for member in potential_recipients:
            permission_ids = member.get_permission_ids()
            if PERMISSION_VIEW_UNIT_RESIDENT in permission_ids:
                recipients_with_permission.append(member)
        
        if not recipients_with_permission:
            print(f"[OWNER-ADDED] No members with 'View Unit Resident' permission found")
            return 0
        
        print(f"[OWNER-ADDED] Found {len(recipients_with_permission)} members with permission")
        
        # Create notification type if it doesn't exist
        notification_type = get_or_create_notification_type(
            code='owner_added',
            name='Owner Added',
            entity_type='resident',  # Use 'resident' entity type (owners are also residents)
            description='Notification when a new owner is added to a unit',
            icon='🔑',
            priority=40
        )
        
        # Create notifications for all recipients
        notifications_created = 0
        for recipient in recipients_with_permission:
            try:
                notification, created = Notification.objects.get_or_create(
                    recipient=recipient,
                    notification_type=notification_type,
                    entity_type='resident',
                    entity_id=owner.id,
                    defaults={
                        'title': 'New Owner Added',
                        'message': f'New owner added: {tower_name}, Unit {unit_name} — {owner_name}.',
                        'metadata': {
                            'owner_id': owner.id,
                            'owner_name': owner_name,
                            'unit_id': unit.id,
                            'unit_name': unit_name,
                            'tower_name': tower_name,
                            'ownership_percentage': float(owner.ownership_percentage) if owner.ownership_percentage else 0,
                            'created_at': str(owner.created_at) if owner.created_at else None,
                            'creator_id': creator.id if creator else None,
                            'creator_name': creator.full_name if creator else None
                        }
                    }
                )
                
                if created:
                    notifications_created += 1
                    print(f"[OWNER-ADDED] Created notification {notification.id} for member {recipient.id}")
                    
            except Exception as e:
                print(f"[OWNER-ADDED] Error creating notification for member {recipient.id}: {e}")
                continue
        
        print(f"[OWNER-ADDED] Created {notifications_created} notifications for new owner {owner.id}")
        return notifications_created
        
    except Exception as e:
        print(f"[OWNER-ADDED] Error in create_owner_added_notification: {e}")
        import traceback
        traceback.print_exc()
        return 0


def create_bulk_owner_added_notification(owners_list, creator=None):
    """
    Create a single notification for multiple owners added to a unit.
    This prevents duplicate notifications when adding multiple owners at once.
    
    Args:
        owners_list: List of Owner instances that were just created
        creator: Optional Member instance who added the owners
    
    Returns:
        int: Number of notifications created
    """
    from group_role.permission_constants import PERMISSION_VIEW_UNIT_RESIDENT
    from user.models import Member
    
    try:
        if not owners_list or len(owners_list) == 0:
            print(f"[BULK-OWNER-ADDED] No owners provided")
            return 0
        
        # Get the unit from the first owner (all owners should be from the same unit)
        unit = owners_list[0].unit
        tower_name = unit.floor.tower.tower_name if unit.floor and unit.floor.tower else "Unknown Tower"
        unit_name = unit.unit_name
        
        # Collect all owner names
        owner_names = [owner.member.full_name for owner in owners_list]
        owner_names_str = ", ".join(owner_names)
        
        print(f"[BULK-OWNER-ADDED] Creating notification for {len(owners_list)} new owners in unit {unit_name}: {owner_names_str}")
        
        # Get all organization members who have "View Unit Resident" permission
        # DO NOT exclude owners - they should receive both self-notification AND manager notification
        potential_recipients = Member.objects.filter(is_org_member=True)
        
        recipients_with_permission = []
        for member in potential_recipients:
            permission_ids = member.get_permission_ids()
            if PERMISSION_VIEW_UNIT_RESIDENT in permission_ids:
                recipients_with_permission.append(member)
        
        if not recipients_with_permission:
            print(f"[BULK-OWNER-ADDED] No members with 'View Unit Resident' permission found")
            return 0
        
        print(f"[BULK-OWNER-ADDED] Found {len(recipients_with_permission)} members with permission")
        
        # Create notification type if it doesn't exist
        notification_type = get_or_create_notification_type(
            code='owner_added',
            name='Owner Added',
            entity_type='resident',
            description='Notification when new owners are added to a unit',
            icon='🔑',
            priority=40
        )
        
        # Create notifications for all recipients
        notifications_created = 0
        for recipient in recipients_with_permission:
            try:
                # Store all owner IDs in metadata as an array
                owner_ids = [owner.id for owner in owners_list]
                
                # Create notification with all owner names in the message
                notification, created = Notification.objects.get_or_create(
                    recipient=recipient,
                    notification_type=notification_type,
                    entity_type='resident',
                    entity_id=owners_list[0].id,  # Use first owner's ID as entity_id
                    defaults={
                        'title': 'New Owner Added' if len(owners_list) == 1 else 'New Owners Added',
                        'message': f'New owner added: {tower_name}, Unit {unit_name} — {owner_names_str}',
                        'metadata': {
                            'owner_ids': owner_ids,
                            'owner_names': owner_names,
                            'owner_count': len(owners_list),
                            'unit_id': unit.id,
                            'unit_name': unit_name,
                            'tower_name': tower_name,
                            'created_at': str(owners_list[0].created_at) if owners_list[0].created_at else None,
                            'creator_id': creator.id if creator else None,
                            'creator_name': creator.full_name if creator else None
                        }
                    }
                )
                
                if created:
                    notifications_created += 1
                    print(f"[BULK-OWNER-ADDED] Created notification {notification.id} for member {recipient.id}")
                    
            except Exception as e:
                print(f"[BULK-OWNER-ADDED] Error creating notification for member {recipient.id}: {e}")
                continue
        
        print(f"[BULK-OWNER-ADDED] Created {notifications_created} notifications for {len(owners_list)} new owners")
        return notifications_created
        
    except Exception as e:
        print(f"[BULK-OWNER-ADDED] Error in create_bulk_owner_added_notification: {e}")
        import traceback
        traceback.print_exc()
        return 0


def create_owner_removed_notification(owner, unit, remover=None):
    """
    Create notifications for managers with "View Unit Resident" permission when an 
    owner is removed from a unit.
    
    Note: Uses "View Unit Resident" permission as owners are also unit residents.
    
    Args:
        owner: Owner instance that was removed (or dict with owner info)
        unit: Unit instance from which the owner was removed
        remover: Optional Member instance who removed the owner
    
    Returns:
        int: Number of notifications created
    """
    from group_role.permission_constants import PERMISSION_VIEW_UNIT_RESIDENT
    from user.models import Member
    
    try:
        # Handle both Owner objects and dict info
        if isinstance(owner, dict):
            owner_id = owner.get('id')
            owner_name = owner.get('name')
            member_id = owner.get('member_id')
        else:
            owner_id = owner.id
            owner_name = owner.member.full_name
            member_id = owner.member.id
        
        print(f"[OWNER-REMOVED] Creating notifications for removed owner {owner_id} ({owner_name}) from unit {unit.unit_name}")
        
        # Get the unit and tower information
        tower_name = unit.floor.tower.tower_name if unit.floor and unit.floor.tower else "Unknown Tower"
        unit_name = unit.unit_name
        
        # Get all organization members who have "View Unit Resident" permission
        # Exclude the owner themselves from receiving the notification
        potential_recipients = Member.objects.filter(is_org_member=True).exclude(id=member_id)
        
        recipients_with_permission = []
        for member in potential_recipients:
            permission_ids = member.get_permission_ids()
            if PERMISSION_VIEW_UNIT_RESIDENT in permission_ids:
                recipients_with_permission.append(member)
        
        if not recipients_with_permission:
            print(f"[OWNER-REMOVED] No members with 'View Unit Resident' permission found")
            return 0
        
        print(f"[OWNER-REMOVED] Found {len(recipients_with_permission)} members with permission")
        
        # Create notification type if it doesn't exist
        notification_type = get_or_create_notification_type(
            code='owner_removed',
            name='Owner Removed',
            entity_type='resident',  # Use 'resident' entity type
            description='Notification when an owner is removed from a unit',
            icon='🔑',
            priority=40
        )
        
        # Create notifications for all recipients
        # Note: We use unit.id as entity_id since the owner no longer exists
        notifications_created = 0
        for recipient in recipients_with_permission:
            try:
                notification, created = Notification.objects.get_or_create(
                    recipient=recipient,
                    notification_type=notification_type,
                    entity_type='unit',  # Use 'unit' since owner is deleted
                    entity_id=unit.id,
                    defaults={
                        'title': 'Owner Removed',
                        'message': f'Owner removed: {tower_name}, Unit {unit_name} — {owner_name}.',
                        'metadata': {
                            'owner_id': owner_id,
                            'owner_name': owner_name,
                            'unit_id': unit.id,
                            'unit_name': unit_name,
                            'tower_name': tower_name,
                            'removed_at': str(timezone.now()),
                            'remover_id': remover.id if remover else None,
                            'remover_name': remover.full_name if remover else None
                        }
                    }
                )
                
                if created:
                    notifications_created += 1
                    print(f"[OWNER-REMOVED] Created notification {notification.id} for member {recipient.id}")
                    
            except Exception as e:
                print(f"[OWNER-REMOVED] Error creating notification for member {recipient.id}: {e}")
                continue
        
        print(f"[OWNER-REMOVED] Created {notifications_created} notifications for removed owner {owner_id}")
        return notifications_created
        
    except Exception as e:
        print(f"[OWNER-REMOVED] Error in create_owner_removed_notification: {e}")
        import traceback
        traceback.print_exc()
        return 0


def create_owner_updated_notification(unit, updated_owner=None, updater=None):
    """
    Create notifications for managers with "View Unit Resident" permission when 
    ownership is transferred between owners for a unit.
    
    Note: Uses "View Unit Resident" permission as owners are also unit residents.
    
    Args:
        unit: Unit instance where ownership was transferred
        updated_owner: Optional Owner instance that was updated (recipient of transfer)
        updater: Optional Member instance who updated the ownership
    
    Returns:
        int: Number of notifications created
    """
    from group_role.permission_constants import PERMISSION_VIEW_UNIT_RESIDENT
    from user.models import Member
    
    try:
        print(f"[OWNER-UPDATED] Creating notifications for ownership transfer in unit {unit.unit_name}")
        
        # Get the unit and tower information
        tower_name = unit.floor.tower.tower_name if unit.floor and unit.floor.tower else "Unknown Tower"
        unit_name = unit.unit_name
        
        # Get all organization members who have "View Unit Resident" permission
        potential_recipients = Member.objects.filter(is_org_member=True)
        
        recipients_with_permission = []
        for member in potential_recipients:
            permission_ids = member.get_permission_ids()
            if PERMISSION_VIEW_UNIT_RESIDENT in permission_ids:
                recipients_with_permission.append(member)
        
        if not recipients_with_permission:
            print(f"[OWNER-UPDATED] No members with permission found")
            return 0
        
        print(f"[OWNER-UPDATED] Found {len(recipients_with_permission)} members with permission")
        
        # Create notification type if it doesn't exist
        notification_type = get_or_create_notification_type(
            code='owner_updated',
            name='Owner Updated',
            entity_type='unit',  # Use 'unit' entity type for ownership transfers
            description='Notification when ownership is transferred between owners for a unit',
            icon='🔄',
            priority=40
        )
        
        # Create notifications for all recipients
        # Always create a NEW notification for each transfer (don't reuse existing ones)
        notifications_created = 0
        for recipient in recipients_with_permission:
            try:
                notification = Notification.objects.create(
                    recipient=recipient,
                    notification_type=notification_type,
                    entity_type='unit',
                    entity_id=unit.id,
                    title='Owner Updated',
                    message=f'Owner updated for Unit {unit_name}.',
                    metadata={
                        'unit_id': unit.id,
                        'unit_name': unit_name,
                        'tower_name': tower_name,
                        'owner_id': updated_owner.id if updated_owner else None,
                        'owner_name': updated_owner.member.full_name if updated_owner and updated_owner.member else None,
                        'updated_at': str(timezone.now()),
                        'updater_id': updater.id if updater else None,
                        'updater_name': updater.full_name if updater else None
                    }
                )
                
                notifications_created += 1
                print(f"[OWNER-UPDATED] Created notification {notification.id} for member {recipient.id}")
                    
            except Exception as e:
                print(f"[OWNER-UPDATED] Error creating notification for member {recipient.id}: {e}")
                continue
        
        print(f"[OWNER-UPDATED] Created {notifications_created} notifications for ownership transfer in unit {unit.id}")
        return notifications_created
        
    except Exception as e:
        print(f"[OWNER-UPDATED] Error in create_owner_updated_notification: {e}")
        import traceback
        traceback.print_exc()
        return 0


def create_unit_staff_added_notification(unit_staff, creator=None):
    """
    Create notifications for managers with "View Unit Staff" permission when a 
    unit staff member is added to a unit.
    
    IMPORTANT: Only managers who have "View Unit Staff" permission should receive 
    this notification. Notifications are NOT retroactive - only sent to managers who 
    have the permission at the time the unit staff is added.
    
    Args:
        unit_staff: UnitStaff instance that was just created
        creator: Optional Member instance who added the unit staff
    
    Returns:
        int: Number of notifications created
    """
    from group_role.permission_constants import PERMISSION_VIEW_UNIT_STAFF
    from user.models import Member
    
    try:
        print(f"[UNIT-STAFF-ADDED] Creating notifications for new unit staff {unit_staff.id} ({unit_staff.member.full_name}) in unit {unit_staff.unit.unit_name}")
        
        # Get the unit and tower information
        unit = unit_staff.unit
        tower_name = unit.floor.tower.tower_name if unit.floor and unit.floor.tower else "Unknown Tower"
        unit_name = unit.unit_name
        staff_name = unit_staff.member.full_name
        
        staff_member = unit_staff.member

        # Get all organization members who have "View Unit Staff" permission
        # Exclude the unit staff member themselves from this list to avoid duplicate
        # manager + self notifications (self handled separately below).
        potential_recipients = Member.objects.filter(is_org_member=True).exclude(id=staff_member.id)
        
        recipients_with_permission = []
        for member in potential_recipients:
            permission_ids = member.get_permission_ids()
            if PERMISSION_VIEW_UNIT_STAFF in permission_ids:
                recipients_with_permission.append(member)
        
        if not recipients_with_permission:
            print(f"[UNIT-STAFF-ADDED] No members with 'View Unit Staff' permission found")
            return 0
        
        print(f"[UNIT-STAFF-ADDED] Found {len(recipients_with_permission)} members with permission")
        
        # Create notification type if it doesn't exist
        notification_type = get_or_create_notification_type(
            code='unit_staff_added',
            name='Unit Staff Added',
            entity_type='unit_staff',
            description='Notification when a new unit staff member is added to a unit',
            icon='👷',
            priority=40
        )
        
        # Create notifications for all recipients
        notifications_created = 0

        # 1) Notify the staff member themselves so they see it in their dropdown
        try:
            staff_notification, staff_created = Notification.objects.get_or_create(
                recipient=staff_member,
                notification_type=notification_type,
                entity_type='unit_staff',
                entity_id=unit_staff.id,  # Use unit_staff.id instead of unit.id to allow multiple notifications per unit
                defaults={
                    'title': 'You were added as unit staff',
                    'message': f'You have been added as unit staff: {tower_name}, Unit {unit_name}.',
                    'metadata': {
                        'unit_staff_id': unit_staff.id,
                        'member_id': staff_member.id,
                        'staff_name': staff_name,
                        'unit_id': unit.id,
                        'unit_name': unit_name,
                        'tower_name': tower_name,
                        'staff_status': 'Live-in' if unit_staff.unit_staff_status else 'Part-time',
                        'created_at': str(unit_staff.created_at) if unit_staff.created_at else None,
                        'creator_id': creator.id if creator else None,
                        'creator_name': creator.full_name if creator else None,
                        'notification_for': 'unit_staff_member'
                    }
                }
            )
            if staff_created:
                notifications_created += 1
                print(f"[UNIT-STAFF-ADDED] Created self-notification {staff_notification.id} for staff member {staff_member.id}")
        except Exception as e:
            print(f"[UNIT-STAFF-ADDED] Error creating self-notification for member {staff_member.id}: {e}")

        # 2) Notify managers with permission
        for recipient in recipients_with_permission:
            try:
                notification, created = Notification.objects.get_or_create(
                    recipient=recipient,
                    notification_type=notification_type,
                    entity_type='unit_staff',
                    entity_id=unit_staff.id,  # Use unit_staff.id instead of unit.id to allow multiple notifications per unit
                    defaults={
                        'title': 'New Unit Staff Added',
                        'message': f'New unit staff added: {tower_name}, Unit {unit_name} — {staff_name}.',
                        'metadata': {
                            'unit_staff_id': unit_staff.id,
                            'member_id': staff_member.id,
                            'staff_name': staff_name,
                            'unit_id': unit.id,
                            'unit_name': unit_name,
                            'tower_name': tower_name,
                            'staff_status': 'Live-in' if unit_staff.unit_staff_status else 'Part-time',
                            'created_at': str(unit_staff.created_at) if unit_staff.created_at else None,
                            'creator_id': creator.id if creator else None,
                            'creator_name': creator.full_name if creator else None,
                            'notification_for': 'manager'
                        }
                    }
                )
                
                if created:
                    notifications_created += 1
                    print(f"[UNIT-STAFF-ADDED] Created notification {notification.id} for member {recipient.id}")
                    
            except Exception as e:
                print(f"[UNIT-STAFF-ADDED] Error creating notification for member {recipient.id}: {e}")
                continue
        
        print(f"[UNIT-STAFF-ADDED] Created {notifications_created} notifications for new unit staff {unit_staff.id}")
        return notifications_created
        
    except Exception as e:
        print(f"[UNIT-STAFF-ADDED] Error in create_unit_staff_added_notification: {e}")
        import traceback
        traceback.print_exc()
        return 0


def create_unit_staff_removed_notification(unit_staff, unit, remover=None):
    """
    Create notifications for managers with "View Unit Staff" permission when a 
    unit staff member is removed from a unit.
    
    IMPORTANT: Only managers who have "View Unit Staff" permission should receive 
    this notification. Notifications are NOT retroactive - only sent to managers who 
    have the permission at the time the unit staff is removed.
    
    Args:
        unit_staff: UnitStaff instance or dict with unit staff info that was removed
        unit: Unit instance from which the unit staff was removed
        remover: Optional Member instance who removed the unit staff
    
    Returns:
        int: Number of notifications created
    """
    from group_role.permission_constants import PERMISSION_VIEW_UNIT_STAFF
    from user.models import Member
    
    try:
        # Handle both UnitStaff objects and dict info
        if isinstance(unit_staff, dict):
            staff_id = unit_staff.get('id')
            staff_name = unit_staff.get('name')
            member_id = unit_staff.get('member_id')
        else:
            staff_id = unit_staff.id
            staff_name = unit_staff.member.full_name
            member_id = unit_staff.member.id
        
        print(f"[UNIT-STAFF-REMOVED] Creating notifications for removed unit staff {staff_id} ({staff_name}) from unit {unit.unit_name}")
        
        # Get the unit and tower information
        tower_name = unit.floor.tower.tower_name if unit.floor and unit.floor.tower else "Unknown Tower"
        unit_name = unit.unit_name
        
        # Get all organization members who have "View Unit Staff" permission
        # Exclude the unit staff member themselves from receiving the notification
        potential_recipients = Member.objects.filter(is_org_member=True).exclude(id=member_id)
        
        recipients_with_permission = []
        for member in potential_recipients:
            permission_ids = member.get_permission_ids()
            if PERMISSION_VIEW_UNIT_STAFF in permission_ids:
                recipients_with_permission.append(member)
        
        if not recipients_with_permission:
            print(f"[UNIT-STAFF-REMOVED] No members with 'View Unit Staff' permission found")
            return 0
        
        print(f"[UNIT-STAFF-REMOVED] Found {len(recipients_with_permission)} members with permission")
        
        # Create notification type if it doesn't exist
        notification_type = get_or_create_notification_type(
            code='unit_staff_removed',
            name='Unit Staff Removed',
            entity_type='unit',
            description='Notification when a unit staff member is removed from a unit',
            icon='👷',
            priority=40
        )
        
        # Create notifications for all recipients
        # Note: We use unit.id as entity_id for manager notifications since the unit staff no longer exists
        notifications_created = 0

        # 1) Notify the removed staff member so they see it in their dropdown
        try:
            from user.models import Member as MemberModel
            staff_member_obj = MemberModel.objects.filter(id=member_id).first()
            if staff_member_obj:
                self_notification, self_created = Notification.objects.get_or_create(
                    recipient=staff_member_obj,
                    notification_type=notification_type,
                    entity_type='unit_staff',  # personal notification uses unit_staff entity type
                    entity_id=unit.id,
                    defaults={
                        'title': 'You were removed as unit staff',
                        'message': f'You were removed from unit staff: {tower_name}, Unit {unit_name}.',
                        'metadata': {
                            'unit_staff_id': staff_id,
                            'member_id': member_id,
                            'staff_name': staff_name,
                            'unit_id': unit.id,
                            'unit_name': unit_name,
                            'tower_name': tower_name,
                            'removed_at': str(timezone.now()),
                            'remover_id': remover.id if remover else None,
                            'remover_name': remover.full_name if remover else None,
                            'notification_for': 'unit_staff_member'
                        }
                    }
                )
                if self_created:
                    notifications_created += 1
                    print(f"[UNIT-STAFF-REMOVED] Created self-notification {self_notification.id} for staff member {staff_member_obj.id}")
        except Exception as e:
            print(f"[UNIT-STAFF-REMOVED] Error creating self-notification for member {member_id}: {e}")

        # 2) Notify managers with permission
        for recipient in recipients_with_permission:
            try:
                notification, created = Notification.objects.get_or_create(
                    recipient=recipient,
                    notification_type=notification_type,
                    entity_type='unit',
                    entity_id=unit.id,
                    defaults={
                        'title': 'Unit Staff Removed',
                        'message': f'Unit staff removed: {tower_name}, Unit {unit_name} — {staff_name}.',
                        'metadata': {
                            'unit_staff_id': staff_id,
                            'member_id': member_id,
                            'staff_name': staff_name,
                            'unit_id': unit.id,
                            'unit_name': unit_name,
                            'tower_name': tower_name,
                            'removed_at': str(timezone.now()),
                            'remover_id': remover.id if remover else None,
                            'remover_name': remover.full_name if remover else None,
                            'notification_for': 'manager'
                        }
                    }
                )
                
                if created:
                    notifications_created += 1
                    print(f"[UNIT-STAFF-REMOVED] Created notification {notification.id} for member {recipient.id}")
                    
            except Exception as e:
                print(f"[UNIT-STAFF-REMOVED] Error creating notification for member {recipient.id}: {e}")
                continue
        
        print(f"[UNIT-STAFF-REMOVED] Created {notifications_created} notifications for removed unit staff {staff_id}")
        return notifications_created
        
    except Exception as e:
        print(f"[UNIT-STAFF-REMOVED] Error in create_unit_staff_removed_notification: {e}")
        import traceback
        traceback.print_exc()
        return 0


def create_bulk_unit_staff_removed_notification(removed_staff_list, remover=None):
    """
    Create aggregated notifications for managers when multiple unit staff members 
    are removed from one or more units in a bulk operation.
    
    Groups removals by unit and creates a single notification per unit with all removed names.
    Format: "John Doe, Jane Smith, and Bob Johnson removed from Unit 101"
    
    Args:
        removed_staff_list: List of dicts with keys: {'id', 'name', 'member_id', 'unit'}
            or list of UnitStaff objects
        remover: Optional Member instance who performed the bulk removal
    
    Returns:
        int: Total number of notifications created
    """
    from group_role.permission_constants import PERMISSION_VIEW_UNIT_STAFF
    from user.models import Member
    
    try:
        if not removed_staff_list:
            return 0
        
        # Group removals by unit
        removals_by_unit = {}
        for staff_item in removed_staff_list:
            # Handle both dict and object formats
            if isinstance(staff_item, dict):
                unit = staff_item.get('unit')
                staff_info = {
                    'id': staff_item.get('id'),
                    'name': staff_item.get('name'),
                    'member_id': staff_item.get('member_id')
                }
            else:
                unit = staff_item.unit
                staff_info = {
                    'id': staff_item.id,
                    'name': staff_item.member.full_name,
                    'member_id': staff_item.member.id
                }
            
            if unit:
                unit_id = unit.id if hasattr(unit, 'id') else unit
                if unit_id not in removals_by_unit:
                    removals_by_unit[unit_id] = {
                        'unit': unit if hasattr(unit, 'id') else Unit.objects.get(id=unit_id),
                        'staff_list': []
                    }
                removals_by_unit[unit_id]['staff_list'].append(staff_info)
        
        if not removals_by_unit:
            return 0
        
        total_notifications = 0
        
        # Process each unit's removals
        for unit_id, unit_data in removals_by_unit.items():
            unit = unit_data['unit']
            staff_list = unit_data['staff_list']
            
            if not staff_list:
                continue
            
            tower_name = unit.floor.tower.tower_name if unit.floor and unit.floor.tower else "Unknown Tower"
            unit_name = unit.unit_name
            
            # Format names: "John Doe, Jane Smith, and Bob Johnson"
            staff_names = [s['name'] for s in staff_list]
            if len(staff_names) == 1:
                names_text = staff_names[0]
            elif len(staff_names) == 2:
                names_text = f"{staff_names[0]} and {staff_names[1]}"
            else:
                names_text = ", ".join(staff_names[:-1]) + f", and {staff_names[-1]}"
            
            # Get all organization members who have "View Unit Staff" permission
            # Exclude removed staff members from receiving manager notifications
            excluded_member_ids = [s['member_id'] for s in staff_list]
            potential_recipients = Member.objects.filter(is_org_member=True).exclude(id__in=excluded_member_ids)
            
            recipients_with_permission = []
            for member in potential_recipients:
                permission_ids = member.get_permission_ids()
                if PERMISSION_VIEW_UNIT_STAFF in permission_ids:
                    recipients_with_permission.append(member)
            
            if not recipients_with_permission:
                print(f"[BULK-UNIT-STAFF-REMOVED] No members with 'View Unit Staff' permission found for unit {unit_name}")
                # Still create self-notifications for removed staff
            else:
                print(f"[BULK-UNIT-STAFF-REMOVED] Found {len(recipients_with_permission)} members with permission for unit {unit_name}")
            
            # Create notification type if it doesn't exist
            notification_type = get_or_create_notification_type(
                code='unit_staff_removed',
                name='Unit Staff Removed',
                entity_type='unit',
                description='Notification when unit staff members are removed from a unit',
                icon='👷',
                priority=40
            )
            
            # 1) Create self-notifications for each removed staff member
            for staff_info in staff_list:
                try:
                    from user.models import Member as MemberModel
                    staff_member_obj = MemberModel.objects.filter(id=staff_info['member_id']).first()
                    if staff_member_obj:
                        self_notification, self_created = Notification.objects.get_or_create(
                            recipient=staff_member_obj,
                            notification_type=notification_type,
                            entity_type='unit_staff',
                            entity_id=unit.id,
                            defaults={
                                'title': 'You were removed as unit staff',
                                'message': f'You were removed from unit staff: {tower_name}, Unit {unit_name}.',
                                'metadata': {
                                    'unit_staff_id': staff_info['id'],
                                    'member_id': staff_info['member_id'],
                                    'staff_name': staff_info['name'],
                                    'unit_id': unit.id,
                                    'unit_name': unit_name,
                                    'tower_name': tower_name,
                                    'removed_at': str(timezone.now()),
                                    'remover_id': remover.id if remover else None,
                                    'remover_name': remover.full_name if remover else None,
                                    'notification_for': 'unit_staff_member',
                                    'is_bulk_removal': True
                                }
                            }
                        )
                        if self_created:
                            total_notifications += 1
                            print(f"[BULK-UNIT-STAFF-REMOVED] Created self-notification {self_notification.id} for staff member {staff_info['member_id']}")
                except Exception as e:
                    print(f"[BULK-UNIT-STAFF-REMOVED] Error creating self-notification for member {staff_info['member_id']}: {e}")
            
            # 2) Create aggregated notification for managers (one per unit)
            for recipient in recipients_with_permission:
                try:
                    # Use a unique identifier for bulk removals to avoid conflicts
                    # Include timestamp to make it unique
                    notification, created = Notification.objects.create(
                        recipient=recipient,
                        notification_type=notification_type,
                        entity_type='unit',
                        entity_id=unit.id,
                        title='Unit Staff Removed',
                        message=f'Unit staff removed: {tower_name}, Unit {unit_name} — {names_text}.',
                        metadata={
                            'removed_staff': staff_list,  # List of all removed staff
                            'removed_count': len(staff_list),
                            'unit_id': unit.id,
                            'unit_name': unit_name,
                            'tower_name': tower_name,
                            'removed_at': str(timezone.now()),
                            'remover_id': remover.id if remover else None,
                            'remover_name': remover.full_name if remover else None,
                            'notification_for': 'manager',
                            'is_bulk_removal': True
                        }
                    )
                    total_notifications += 1
                    print(f"[BULK-UNIT-STAFF-REMOVED] Created bulk notification {notification.id} for member {recipient.id} (unit {unit_name}, {len(staff_list)} staff removed)")
                    
                except Exception as e:
                    print(f"[BULK-UNIT-STAFF-REMOVED] Error creating notification for member {recipient.id}: {e}")
                    continue
        
        print(f"[BULK-UNIT-STAFF-REMOVED] Created {total_notifications} total notifications for bulk unit staff removal")
        return total_notifications
        
    except Exception as e:
        print(f"[BULK-UNIT-STAFF-REMOVED] Error in create_bulk_unit_staff_removed_notification: {e}")
        import traceback
        traceback.print_exc()
        return 0


def create_owner_added_self_notification(owner):
    """
    Create a notification for the user when they add themselves as an owner of a unit.
    
    Args:
        owner: Owner instance that was just created
    
    Returns:
        int: Number of notifications created (0 or 1)
    """
    try:
        print(f"[OWNER-ADDED-SELF] Creating self-notification for owner {owner.id} ({owner.member.full_name})")
        
        # Get the unit and tower information
        unit = owner.unit
        tower_name = unit.floor.tower.tower_name if unit.floor and unit.floor.tower else "Unknown Tower"
        unit_name = unit.unit_name
        
        # Create notification type if it doesn't exist
        notification_type = get_or_create_notification_type(
            code='owner_added_self',
            name='You Were Added as Owner',
            entity_type='owner',
            description='Notification when you are added as an owner of a unit',
            icon='🔑',
            priority=50
        )
        
        # Create notification for the owner themselves
        notification, created = Notification.objects.get_or_create(
            recipient=owner.member,
            notification_type=notification_type,
            entity_type='owner',
            entity_id=owner.id,
            defaults={
                'title': 'You Were Added as Owner',
                'message': f'You were added as an owner of Unit {unit_name}.',
                'metadata': {
                    'owner_id': owner.id,
                    'unit_id': unit.id,
                    'unit_name': unit_name,
                    'tower_name': tower_name,
                    'ownership_percentage': float(owner.ownership_percentage) if owner.ownership_percentage else 0,
                    'created_at': str(owner.created_at) if owner.created_at else None
                }
            }
        )
        
        if created:
            print(f"[OWNER-ADDED-SELF] Created notification {notification.id} for owner {owner.member.id}")
            return 1
        else:
            print(f"[OWNER-ADDED-SELF] Notification already exists for owner {owner.member.id}")
            return 0
        
    except Exception as e:
        print(f"[OWNER-ADDED-SELF] Error in create_owner_added_self_notification: {e}")
        import traceback
        traceback.print_exc()
        return 0


def create_owner_removed_self_notification(owner, unit):
    """
    Create a notification for the user when they remove themselves as an owner of a unit.
    
    Args:
        owner: Owner instance that was removed (or dict with owner info)
        unit: Unit instance from which the owner was removed
    
    Returns:
        int: Number of notifications created (0 or 1)
    """
    from user.models import Member
    
    try:
        # Handle both Owner objects and dict info
        if isinstance(owner, dict):
            owner_id = owner.get('id')
            owner_name = owner.get('name')
            member = Member.objects.get(id=owner.get('member_id'))
        else:
            owner_id = owner.id
            owner_name = owner.member.full_name
            member = owner.member
        
        print(f"[OWNER-REMOVED-SELF] Creating self-notification for removed owner {owner_id} ({owner_name})")
        
        # Get the unit and tower information
        tower_name = unit.floor.tower.tower_name if unit.floor and unit.floor.tower else "Unknown Tower"
        unit_name = unit.unit_name
        
        # Create notification type if it doesn't exist
        notification_type = get_or_create_notification_type(
            code='owner_removed_self',
            name='You Were Removed as Owner',
            entity_type='owner',
            description='Notification when you are removed as an owner of a unit',
            icon='🔑',
            priority=50
        )
        
        # Create notification for the owner themselves
        # Note: We use unit.id as entity_id since the owner no longer exists
        notification, created = Notification.objects.get_or_create(
            recipient=member,
            notification_type=notification_type,
            entity_type='unit',
            entity_id=unit.id,
            defaults={
                'title': 'You Were Removed as Owner',
                'message': f'You were removed as an owner of Unit {unit_name}.',
                'metadata': {
                    'owner_id': owner_id,
                    'owner_name': owner_name,
                    'unit_id': unit.id,
                    'unit_name': unit_name,
                    'tower_name': tower_name,
                    'removed_at': str(timezone.now())
                }
            }
        )
        
        if created:
            print(f"[OWNER-REMOVED-SELF] Created notification {notification.id} for owner {member.id}")
            return 1
        else:
            print(f"[OWNER-REMOVED-SELF] Notification already exists for owner {member.id}")
            return 0
        
    except Exception as e:
        print(f"[OWNER-REMOVED-SELF] Error in create_owner_removed_self_notification: {e}")
        import traceback
        traceback.print_exc()
        return 0


def create_owner_changed_self_notification(owner, old_percentage=None, new_percentage=None):
    """
    Create a notification for the user when their ownership percentage changes.
    
    Args:
        owner: Owner instance that was updated
        old_percentage: Optional old ownership percentage
        new_percentage: Optional new ownership percentage
    
    Returns:
        int: Number of notifications created (0 or 1)
    """
    try:
        print(f"[OWNER-CHANGED-SELF] Creating self-notification for owner {owner.id} ({owner.member.full_name})")
        
        # Get the unit and tower information
        unit = owner.unit
        tower_name = unit.floor.tower.tower_name if unit.floor and unit.floor.tower else "Unknown Tower"
        unit_name = unit.unit_name
        
        # Use provided percentages or get from owner
        old_pct = old_percentage if old_percentage is not None else float(owner.ownership_percentage)
        new_pct = new_percentage if new_percentage is not None else float(owner.ownership_percentage)
        
        # Create notification type if it doesn't exist
        notification_type = get_or_create_notification_type(
            code='owner_changed_self',
            name='Your Ownership Changed',
            entity_type='owner',
            description='Notification when your ownership percentage changes',
            icon='🔑',
            priority=50
        )
        
        # Create notification for the owner themselves
        notification, created = Notification.objects.get_or_create(
            recipient=owner.member,
            notification_type=notification_type,
            entity_type='owner',
            entity_id=owner.id,
            defaults={
                'title': 'Your Ownership Changed',
                'message': f'Your ownership of Unit {unit_name} changed from {old_pct}% to {new_pct}%.',
                'metadata': {
                    'owner_id': owner.id,
                    'unit_id': unit.id,
                    'unit_name': unit_name,
                    'tower_name': tower_name,
                    'old_percentage': old_pct,
                    'new_percentage': new_pct,
                    'updated_at': str(timezone.now())
                }
            }
        )
        
        if created:
            print(f"[OWNER-CHANGED-SELF] Created notification {notification.id} for owner {owner.member.id}")
            return 1
        else:
            print(f"[OWNER-CHANGED-SELF] Notification already exists for owner {owner.member.id}")
            return 0
        
    except Exception as e:
        print(f"[OWNER-CHANGED-SELF] Error in create_owner_changed_self_notification: {e}")
        import traceback
        traceback.print_exc()
        return 0


def create_resident_added_self_notification(resident):
    """
    Create a notification for the user when they add themselves as a resident of a unit.
    
    Args:
        resident: Resident instance that was just created
    
    Returns:
        int: Number of notifications created (0 or 1)
    """
    try:
        print(f"[RESIDENT-ADDED-SELF] Creating self-notification for resident {resident.id} ({resident.member.full_name})")
        
        # Get the unit and tower information
        unit = resident.unit
        tower_name = unit.floor.tower.tower_name if unit.floor and unit.floor.tower else "Unknown Tower"
        unit_name = unit.unit_name
        
        # Create notification type if it doesn't exist
        notification_type = get_or_create_notification_type(
            code='resident_added_self',
            name='You Were Added as Resident',
            entity_type='resident',
            description='Notification when you are added as a resident of a unit',
            icon='🏠',
            priority=50
        )
        
        # Create notification for the resident themselves
        notification, created = Notification.objects.get_or_create(
            recipient=resident.member,
            notification_type=notification_type,
            entity_type='resident',
            entity_id=resident.id,
            defaults={
                'title': 'You Were Added as Resident',
                'message': f'You were added as a resident of Unit {unit_name}.',
                'metadata': {
                    'resident_id': resident.id,
                    'unit_id': unit.id,
                    'unit_name': unit_name,
                    'tower_name': tower_name,
                    'is_resident_or_tenant': resident.is_resident_or_tenant,
                    'created_at': str(resident.created_at) if resident.created_at else None
                }
            }
        )
        
        if created:
            print(f"[RESIDENT-ADDED-SELF] Created notification {notification.id} for resident {resident.member.id}")
            return 1
        else:
            print(f"[RESIDENT-ADDED-SELF] Notification already exists for resident {resident.member.id}")
            return 0
        
    except Exception as e:
        print(f"[RESIDENT-ADDED-SELF] Error in create_resident_added_self_notification: {e}")
        import traceback
        traceback.print_exc()
        return 0


def create_resident_removed_self_notification(resident, unit):
    """
    Create a notification for the user when they remove themselves as a resident of a unit.
    
    Args:
        resident: Resident instance that was removed (or dict with resident info)
        unit: Unit instance from which the resident was removed
    
    Returns:
        int: Number of notifications created (0 or 1)
    """
    from user.models import Member
    
    try:
        # Handle both Resident objects and dict info
        if isinstance(resident, dict):
            resident_id = resident.get('id')
            resident_name = resident.get('name')
            member = Member.objects.get(id=resident.get('member_id'))
        else:
            resident_id = resident.id
            resident_name = resident.member.full_name
            member = resident.member
        
        print(f"[RESIDENT-REMOVED-SELF] Creating self-notification for removed resident {resident_id} ({resident_name})")
        
        # Get the unit and tower information
        tower_name = unit.floor.tower.tower_name if unit.floor and unit.floor.tower else "Unknown Tower"
        unit_name = unit.unit_name
        
        # Create notification type if it doesn't exist
        notification_type = get_or_create_notification_type(
            code='resident_removed_self',
            name='You Were Removed as Resident',
            entity_type='resident',
            description='Notification when you are removed as a resident of a unit',
            icon='🏠',
            priority=50
        )
        
        # Create notification for the resident themselves
        # Note: We use unit.id as entity_id since the resident may no longer exist
        notification, created = Notification.objects.get_or_create(
            recipient=member,
            notification_type=notification_type,
            entity_type='unit',
            entity_id=unit.id,
            defaults={
                'title': 'You Were Removed as Resident',
                'message': f'You were removed as a resident of Unit {unit_name}.',
                'metadata': {
                    'resident_id': resident_id,
                    'resident_name': resident_name,
                    'unit_id': unit.id,
                    'unit_name': unit_name,
                    'tower_name': tower_name,
                    'removed_at': str(timezone.now())
                }
            }
        )
        
        if created:
            print(f"[RESIDENT-REMOVED-SELF] Created notification {notification.id} for resident {member.id}")
            return 1
        else:
            print(f"[RESIDENT-REMOVED-SELF] Notification already exists for resident {member.id}")
            return 0
        
    except Exception as e:
        print(f"[RESIDENT-REMOVED-SELF] Error in create_resident_removed_self_notification: {e}")
        import traceback
        traceback.print_exc()
        return 0


def create_resident_changed_self_notification(resident, changes=None):
    """
    Create a notification for the user when their resident information changes.
    
    Args:
        resident: Resident instance that was updated
        changes: Optional list of change descriptions
    
    Returns:
        int: Number of notifications created (0 or 1)
    """
    try:
        print(f"[RESIDENT-CHANGED-SELF] Creating self-notification for resident {resident.id} ({resident.member.full_name})")
        
        # Get the unit and tower information
        unit = resident.unit
        tower_name = unit.floor.tower.tower_name if unit.floor and unit.floor.tower else "Unknown Tower"
        unit_name = unit.unit_name
        
        # Create notification type if it doesn't exist
        notification_type = get_or_create_notification_type(
            code='resident_changed_self',
            name='Your Resident Information Changed',
            entity_type='resident',
            description='Notification when your resident information changes',
            icon='🏠',
            priority=50
        )
        
        # Build message
        if changes and len(changes) > 0:
            changes_text = " | ".join(changes)
            message = f'Your resident information for Unit {unit_name} was updated: {changes_text}.'
        else:
            message = f'Your resident information for Unit {unit_name} was updated.'
        
        # Create notification for the resident themselves
        notification, created = Notification.objects.get_or_create(
            recipient=resident.member,
            notification_type=notification_type,
            entity_type='resident',
            entity_id=resident.id,
            defaults={
                'title': 'Your Resident Information Changed',
                'message': message,
                'metadata': {
                    'resident_id': resident.id,
                    'unit_id': unit.id,
                    'unit_name': unit_name,
                    'tower_name': tower_name,
                    'changes': changes or [],
                    'updated_at': str(timezone.now())
                }
            }
        )
        
        if created:
            print(f"[RESIDENT-CHANGED-SELF] Created notification {notification.id} for resident {resident.member.id}")
            return 1
        else:
            print(f"[RESIDENT-CHANGED-SELF] Notification already exists for resident {resident.member.id}")
            return 0
        
    except Exception as e:
        print(f"[RESIDENT-CHANGED-SELF] Error in create_resident_changed_self_notification: {e}")
        import traceback
        traceback.print_exc()
        return 0


def create_bulk_upload_summary_notification(unit, count, upload_type, creator=None):
    """
    Create a summary notification for bulk Excel uploads (owners, residents, or staff).
    
    Args:
        unit: Unit instance where items were uploaded
        count: Number of items successfully uploaded
        upload_type: Type of upload - 'owner', 'resident', or 'staff'
        creator: Optional Member instance who performed the upload
    
    Returns:
        int: Number of notifications created
    """
    from group_role.permission_constants import PERMISSION_VIEW_UNIT_RESIDENT, PERMISSION_VIEW_UNIT_STAFF
    from user.models import Member
    
    try:
        if not unit or count <= 0:
            print(f"[BULK-UPLOAD-SUMMARY] Invalid parameters: unit={unit}, count={count}")
            return 0
        
        tower_name = unit.floor.tower.tower_name if unit.floor and unit.floor.tower else "Unknown Tower"
        unit_name = unit.unit_name
        creator_name = creator.full_name if creator else "System"
        
        # Determine notification type code, entity type, and permission based on upload type
        if upload_type == 'owner':
            notification_type_code = 'owner_bulk_upload'
            entity_type = 'unit'
            required_permission = PERMISSION_VIEW_UNIT_RESIDENT
            item_name = 'owner' if count == 1 else 'owners'
        elif upload_type == 'resident':
            notification_type_code = 'resident_bulk_upload'
            entity_type = 'unit'
            required_permission = PERMISSION_VIEW_UNIT_RESIDENT
            item_name = 'resident' if count == 1 else 'residents'
        elif upload_type == 'staff':
            notification_type_code = 'staff_bulk_upload'
            entity_type = 'unit'
            required_permission = PERMISSION_VIEW_UNIT_STAFF
            item_name = 'staff member' if count == 1 else 'staff members'
        else:
            print(f"[BULK-UPLOAD-SUMMARY] Invalid upload_type: {upload_type}")
            return 0
        
        print(f"[BULK-UPLOAD-SUMMARY] Creating notification for {count} {item_name} in unit {unit_name} by {creator_name}")
        
        # Get all organization members who have the required permission
        potential_recipients = Member.objects.filter(is_org_member=True)
        
        recipients_with_permission = []
        for member in potential_recipients:
            permission_ids = member.get_permission_ids()
            if required_permission in permission_ids:
                recipients_with_permission.append(member)
        
        if not recipients_with_permission:
            print(f"[BULK-UPLOAD-SUMMARY] No members with required permission found")
            return 0
        
        print(f"[BULK-UPLOAD-SUMMARY] Found {len(recipients_with_permission)} members with permission")
        
        # Create notification type if it doesn't exist
        notification_type = get_or_create_notification_type(
            code=notification_type_code,
            name=f'{upload_type.title()} Bulk Upload',
            entity_type=entity_type,
            description=f'Notification when {item_name} are added via bulk Excel upload',
            icon='📊',
            priority=30
        )
        
        # Create title and message
        title = f'{count} {item_name.title()} Added via Bulk Upload'
        message = f'{count} {item_name} {"was" if count == 1 else "were"} added to {tower_name} Unit {unit_name} via bulk upload by {creator_name}.'
        
        # Create notifications for all recipients
        notifications_created = 0
        for recipient in recipients_with_permission:
            try:
                notification, created = Notification.objects.get_or_create(
                    recipient=recipient,
                    notification_type=notification_type,
                    entity_type=entity_type,
                    entity_id=unit.id,
                    defaults={
                        'title': title,
                        'message': message,
                        'channel': 'web',  # Explicitly set as web-only
                        'metadata': {
                            'unit_id': unit.id,
                            'unit_name': unit_name,
                            'tower_name': tower_name,
                            'count': count,
                            'upload_type': upload_type,
                            'item_name': item_name,
                            'creator_id': creator.id if creator else None,
                            'creator_name': creator_name,
                            'created_at': str(timezone.now())
                        }
                    }
                )
                
                if created:
                    notifications_created += 1
                    print(f"[BULK-UPLOAD-SUMMARY] Created notification {notification.id} for member {recipient.id}")
                else:
                    # Update existing notification if it exists (to refresh timestamp)
                    notification.title = title
                    notification.message = message
                    notification.metadata = {
                        'unit_id': unit.id,
                        'unit_name': unit_name,
                        'tower_name': tower_name,
                        'count': count,
                        'upload_type': upload_type,
                        'item_name': item_name,
                        'creator_id': creator.id if creator else None,
                        'creator_name': creator_name,
                        'created_at': str(timezone.now())
                    }
                    notification.save()
                    notifications_created += 1
                    print(f"[BULK-UPLOAD-SUMMARY] Updated notification {notification.id} for member {recipient.id}")
                    
            except Exception as e:
                print(f"[BULK-UPLOAD-SUMMARY] Error creating notification for member {recipient.id}: {e}")
                continue
        
        print(f"[BULK-UPLOAD-SUMMARY] Created/updated {notifications_created} notifications for bulk upload")
        return notifications_created
        
    except Exception as e:
        print(f"[BULK-UPLOAD-SUMMARY] Error in create_bulk_upload_summary_notification: {e}")
        import traceback
        traceback.print_exc()
        return 0


def get_members_with_all_billing_management_permissions():
    """
    Get all organization members who have relevant billing management permissions.
    Used for recipients of the "Monthly Bills Generated" notification.
    
    Recipients must have ANY of these permissions:
    - View Billing Management (permission ID 66)
    - Generate Service Fees (permission ID 45)
    - View Service Fee Overview (permission ID 40)
    
    This uses OR logic - members with any of these relevant permissions will be notified.
    
    Returns:
        List of Member objects who possess relevant permissions
    """
    from user.models import Member
    from group_role.permission_constants import (
        PERMISSION_VIEW_BILLING_MANAGEMENT,
        PERMISSION_GENERATE_SERVICE_FEES,
        PERMISSION_VIEW_SERVICE_FEE_OVERVIEW
    )
    
    # Define all relevant permissions (OR logic - anyone with any of these should be notified)
    RELEVANT_PERMISSIONS = [
        PERMISSION_VIEW_BILLING_MANAGEMENT,   # 66
        PERMISSION_GENERATE_SERVICE_FEES,     # 45
        PERMISSION_VIEW_SERVICE_FEE_OVERVIEW,   # 40
    ]
    
    try:
        # Get all organization members
        org_members = Member.objects.filter(is_org_member=True)
        
        if not org_members.exists():
            print("No organization members found")
            return []
        
        # Filter members who have ANY of the relevant permissions
        members_to_notify = []
        
        for member in org_members:
            try:
                # 1. Check if member has SuperAdmin role - SuperAdmins get all notifications
                from group_role.models import MembersRole
                is_superadmin = MembersRole.objects.filter(
                    member=member,
                    role__role_name__iexact="SuperAdmin",
                    role__is_active=True,
                    is_active=True
                ).exists()
                
                if is_superadmin:
                    members_to_notify.append(member)
                    print(f"Member {member.full_name} (ID: {member.id}) is SuperAdmin - included in billing notifications")
                    continue

                # 2. Check if member has ANY of the relevant permissions (OR logic)
                member_permission_ids = member.get_permission_ids()
                if any(perm_id in member_permission_ids for perm_id in RELEVANT_PERMISSIONS):
                    members_to_notify.append(member)
                    print(f"Member {member.full_name} (ID: {member.id}) has billing management permissions")
                else:
                    print(f"Member {member.full_name} (ID: {member.id}) missing all relevant billing permissions")
            except Exception as e:
                print(f"Error checking permissions for member {member.id}: {e}")
                continue
        
        print(f"Found {len(members_to_notify)} members with billing management permissions")
        return members_to_notify
        
    except Exception as e:
        print(f"Error getting members with all billing management permissions: {e}")
        import traceback
        traceback.print_exc()
        return []



def get_members_with_record_payment_permission():
    """
    Get all members who have permission to record service fee payments.
    This is used to send notifications when new service fee payments are received.
    
    Recipients must have ANY of these payment-related permissions:
    - Record Service Fee Payment (permission ID 44)
    - View Service Fee Payments Page (permission ID 71)
    - View Service Fee Overview (permission ID 40)
    """
    from user.models import Member
    from group_role.permission_constants import (
        PERMISSION_RECORD_PAYMENT,
        PERMISSION_VIEW_SERVICE_FEE_OVERVIEW,
        PERMISSION_VIEW_SERVICE_FEE_PAYMENTS
    )
    
    # Define all relevant payment permissions (OR logic - anyone with any of these should be notified)
    # This aligns with the requirement that users with any payment-related permissions should receive notifications.
    PAYMENT_PERMISSIONS = [
        PERMISSION_RECORD_PAYMENT,            # 44
        PERMISSION_VIEW_SERVICE_FEE_PAYMENTS,   # 71
        PERMISSION_VIEW_SERVICE_FEE_OVERVIEW,   # 40
    ]
    
    try:
        # Get all organization members
        org_members = Member.objects.filter(is_org_member=True)
        
        if not org_members.exists():
            print("No organization members found")
            return []
        
        # Filter members who have ANY of the required permissions
        members_to_notify = []
        
        for member in org_members:
            try:
                # 1. Check if member has SuperAdmin role - SuperAdmins get all notifications
                from group_role.models import MembersRole
                is_superadmin = MembersRole.objects.filter(
                    member=member,
                    role__role_name__iexact="SuperAdmin",
                    role__is_active=True,
                    is_active=True
                ).exists()
                
                if is_superadmin:
                    members_to_notify.append(member)
                    print(f"Member {member.full_name} (ID: {member.id}) is SuperAdmin - included in payment notifications")
                    continue

                # 2. Check if member has ANY of the payment-related permissions (OR logic)
                member_permission_ids = member.get_permission_ids()
                if any(perm_id in member_permission_ids for perm_id in PAYMENT_PERMISSIONS):
                    members_to_notify.append(member)
                    print(f"Member {member.full_name} (ID: {member.id}) has payment-related permissions")
                else:
                    print(f"Member {member.full_name} (ID: {member.id}) missing all payment-related permissions")
            except Exception as e:
                print(f"Error checking permissions for member {member.id}: {e}")
                continue
        
        print(f"Found {len(members_to_notify)} members with payment-related permissions")
        return members_to_notify
        
    except Exception as e:
        print(f"Error getting members with record payment permissions: {e}")
        import traceback
        traceback.print_exc()
        return []


def get_all_unit_members(unit):
    """
    Get all Owner members and active Resident members for a unit.
    Used to send service fee notifications to ALL owners and residents, not just the primary contact.
    
    Args:
        unit: Unit instance
    
    Returns:
        List of unique Member instances associated with the unit (owners + active residents)
    """
    from towers.models import Owner, Resident
    
    members = set()
    try:
        # Get all owners of this unit
        for owner in Owner.objects.filter(unit=unit).select_related('member'):
            if owner.member:
                members.add(owner.member)
        
        # Get all active residents of this unit
        for resident in Resident.objects.filter(unit=unit, is_active=True).select_related('member'):
            if resident.member:
                members.add(resident.member)
        
        print(f"[get_all_unit_members] Found {len(members)} unique members for unit {unit.unit_name if unit else 'unknown'}")
    except Exception as e:
        print(f"[get_all_unit_members] Error getting members for unit: {e}")
        import traceback
        traceback.print_exc()
    
    return list(members)


def create_service_fee_bills_generated_notification(year, month, units_count, tower_name=None, bill_generator_id=None):
    """
    Create in-app notifications for members with billing management permissions when monthly service fee bills are generated
    
    Recipients must have ANY of these permissions:
    - View Billing Management (permission ID 66)
    - Generate Service Fees (permission ID 45)
    - View Service Fee Overview (permission ID 40)
    
    The bill generator (person who initiated bill generation) is INCLUDED in receiving notifications alongside other users with the same permissions.
    
    Notification: "Monthly Bills Generated"
    Message: "Service fee bills for August have been generated for 240 units of Tower 1."
    Delivery: In-app only (web channel)
    
    Args:
        year: Year of the service fee period
        month: Month of the service fee period (1-12)
        units_count: Number of units for which bills were generated
        tower_name: Optional tower name if bills were generated for a specific tower
        bill_generator_id: Optional ID of the member who generated the bills (currently included in notifications)
    """
    try:
        from datetime import date
        import calendar
        
        # Get or create notification type
        notification_type = get_or_create_notification_type(
            code='service_fee_bills_generated',
            name='Service Fee Bills Generated',
            entity_type='bill',
            description='Notification when monthly service fee bills are successfully generated',
            icon='💰',
            priority=3
        )
        
        # Get month name
        month_name = calendar.month_name[month]
        
        # Build notification title and message
        title = "Monthly Bills Generated"
        
        if tower_name:
            message = f"Service fee bills for {month_name} have been generated for {units_count} units of {tower_name}."
        else:
            message = f"Service fee bills for {month_name} have been generated for {units_count} units."
        
        # Get all organization members with ALL required billing management permissions
        recipients_list = get_members_with_all_billing_management_permissions()
        
        # Convert to list if it's not already
        recipients = list(recipients_list) if recipients_list else []
        
        # Include the bill generator - they should receive the notification along with other eligible members
        if bill_generator_id:
            from user.models import Member
            generator = Member.objects.filter(id=bill_generator_id).first()
            if generator and generator not in recipients:
                recipients.append(generator)
            print(f"Bill generator (ID: {bill_generator_id}) will be INCLUDED in {len(recipients)} eligible recipients")
            
        if not recipients:
            print(f"No eligible recipients found to notify about bill generation")
            return []
        
        # Dual-role safety: Exclude people who are also community members for THIS specific tower
        # if the goal is to avoid redundancy when they also get a "Bill Issued" notification.
        # Actually, let's keep it simple: Ensure all recipients are strictly ORG MEMBERS
        recipients = [r for r in recipients if getattr(r, 'is_org_member', False)]
        
        print(f"Creating service fee bills generated notifications for {len(recipients)} members with billing management permissions")
        
        # Clean up old notifications for this period from ineligible members or the previous bill generator
        # This ensures each bill generation creates fresh notifications only for current eligible members
        entity_id = year * 100 + month
        old_notifications = Notification.objects.filter(
            notification_type__code='service_fee_bills_generated',
            entity_type='bill',
            entity_id=entity_id
        )
        
        if old_notifications.exists():
            deleted_count, _ = old_notifications.delete()
            print(f"Deleted {deleted_count} old 'Monthly Bills Generated' notifications for {year}-{month:02d} to ensure clean notification set")
        
        # Metadata
        metadata = {
            'service_period_year': year,
            'service_period_month': month,
            'month_name': month_name,
            'units_count': units_count,
            'tower_name': tower_name or 'All Towers',
            'bill_generator_id': bill_generator_id,
            'should_send_push': False,  # Admin-wide notification, visible in management dashboard (web only)
        }
        
        # Create notifications for each recipient
        notifications = []
        for recipient in recipients:
            try:
                # Create fresh notification (old ones have been deleted)
                notification = Notification.objects.create(
                    recipient=recipient,
                    notification_type=notification_type,
                    entity_type='bill',
                    entity_id=entity_id,
                    title=title,
                    message=message,
                    metadata=metadata,
                    channel='web'  # Admin notification - web-only (no push)
                )
                
                notifications.append(notification)
                print(f"Created service fee bills generated notification for {recipient.full_name}")
                    
            except Exception as e:
                print(f"Error creating notification for {recipient.full_name}: {e}")
                continue
        
        print(f"Created {len(notifications)} service fee bills generated notifications")
        
        # (Push notifications removed - this notification is now web-only)
        return notifications
        
    except Exception as e:
        print(f"Error creating service fee bills generated notifications: {e}")
        import traceback
        traceback.print_exc()
        return []


def create_community_member_bill_issued_notification(payment, send_push=True):
    """
    Create push + in-app notification for ALL owners and residents of the unit when a bill is issued
    
    Notification: "Service Fee Bill Issued"
    Message: "Your service fee for July is due in 7 days."
    Delivery: Push + In-app
    
    Args:
        payment: ServiceFeePayment instance (the generated bill)
    """
    try:
        import calendar
        from datetime import date, timedelta
        
        # Get or create notification type
        notification_type = get_or_create_notification_type(
            code='service_fee_bill_issued',
            name='Service Fee Bill Issued',
            entity_type='bill',
            description='Notification when a service fee bill is issued to a community member',
            icon='📄',
            priority=3
        )
        
        # Get ALL owners and residents of the unit (not just the primary owner)
        unit = payment.unit
        if not unit:
            print(f"Payment {payment.id} has no unit to notify")
            return []
        
        recipients = get_all_unit_members(unit)
        
        # Role filter check: Mobile notifications should only go to Community Members
        recipients = [r for r in recipients if getattr(r, 'is_comm_member', False)]
        
        # Fallback to primary owner if no members found via unit lookup
        if not recipients and payment.owner and payment.owner.member:
            fallback_member = payment.owner.member
            if getattr(fallback_member, 'is_comm_member', False):
                recipients = [fallback_member]
        
        if not recipients:
            print(f"Payment {payment.id} has no owners/residents to notify")
            return []
        
        # Calculate days until due
        if payment.due_date:
            days_until_due = (payment.due_date - date.today()).days
        else:
            days_until_due = 0
        
        # Get month name
        month_name = calendar.month_name[payment.service_period_month] if payment.service_period_month else "current period"
        
        # Get unit info
        unit_name = unit.unit_name if unit else "your unit"
        tower_name = unit.floor.tower.tower_name if unit and unit.floor and unit.floor.tower else ""
        
        # Build notification
        title = "Service Fee Bill Issued"
        if days_until_due > 0:
            message = f"Your service fee for {month_name} is due in {days_until_due} day{'s' if days_until_due != 1 else ''}."
        else:
            message = f"Your service fee for {month_name} has been issued."
        
        # Format amount
        currency = payment.currency or 'BDT'
        amount_str = f"{currency} {payment.amount:,.0f}"
        
        # Metadata - include bill_id to identify the specific bill to display
        metadata = {
            'bill_id': payment.id,  # The bill/payment ID for direct navigation
            'payment_id': payment.id,
            'bill_number': payment.bill_number,
            'service_period_year': payment.service_period_year,
            'service_period_month': payment.service_period_month,
            'month_name': month_name,
            'unit_id': unit.id if unit else None,
            'unit_name': unit_name,
            'tower_name': tower_name,
            'amount': float(payment.amount),
            'currency': currency,
            'due_date': payment.due_date.isoformat() if payment.due_date else None,
            'days_until_due': days_until_due,
            'should_send_push': True,  # Push + In-app
        }
        
        # Create notification for each recipient (all owners + residents of unit)
        notifications = []
        for recipient in recipients:
            try:
                notification, created = Notification.objects.get_or_create(
                    recipient=recipient,
                    notification_type=notification_type,
                    entity_type='bill',
                    entity_id=payment.id,
                    defaults={
                        'title': title,
                        'message': message,
                        'metadata': metadata,
                        'channel': 'mobile'  # Push + In-app
                    }
                )
                
                if created:
                    print(f"Created bill issued notification for {recipient.full_name} (Unit {unit_name})")
                else:
                    # Update if already exists - ensure channel and metadata are correct
                    notification.title = title
                    notification.message = message
                    notification.metadata = metadata
                    notification.channel = 'mobile'  # Ensure channel is set for push
                    notification.save()
                    print(f"Updated bill issued notification for {recipient.full_name} (Unit {unit_name})")
                
                notifications.append(notification)
            except Exception as e:
                print(f"Error creating bill issued notification for {recipient.full_name}: {e}")
                continue
        
        # Send push notifications for all created notifications if requested
        if send_push and notifications:
            from .unified_push_service import send_unified_push_for_notifications
            push_result = send_unified_push_for_notifications(notifications)
            print(f"  [PUSH] Bill issued push result: {push_result.get('total_sent', 0)} sent, {push_result.get('total_skipped', 0)} skipped")
        
        return notifications
        
    except Exception as e:
        print(f"Error creating community member bill issued notification: {e}")
        import traceback
        traceback.print_exc()
        return []


def create_community_member_bill_overdue_notification(payment):
    """
    Create push + in-app notification for ALL owners and residents of the unit when their bill is overdue
    
    Notification: "Service Fee Overdue"
    Message: "Your July service fee is overdue by 5 days. Please pay to avoid penalties."
    Delivery: Push + In-app
    
    Args:
        payment: ServiceFeePayment instance (the overdue bill)
    """
    try:
        import calendar
        from datetime import date
        
        # Get or create notification type
        notification_type = get_or_create_notification_type(
            code='service_fee_overdue',
            name='Service Fee Overdue',
            entity_type='service_fee',
            description='Notification when a service fee bill becomes overdue',
            icon='⏰',
            priority=4
        )
        
        # Get ALL owners and residents of the unit (not just the primary owner)
        unit = payment.unit
        if not unit:
            print(f"Payment {payment.id} has no unit to notify")
            return []
        
        recipients = get_all_unit_members(unit)
        
        # Role filter check: Mobile notifications should only go to Community Members
        recipients = [r for r in recipients if getattr(r, 'is_comm_member', False)]
        
        # Fallback to primary owner if no members found via unit lookup
        if not recipients and payment.owner and payment.owner.member:
            fallback_member = payment.owner.member
            if getattr(fallback_member, 'is_comm_member', False):
                recipients = [fallback_member]
        
        if not recipients:
            print(f"Payment {payment.id} has no owners/residents to notify")
            return []
        
        # Calculate days overdue
        if payment.due_date:
            days_overdue = (date.today() - payment.due_date).days
        else:
            days_overdue = 0
        
        if days_overdue <= 0:
            print(f"Payment {payment.id} is not overdue yet")
            return []
        
        # Get month name
        month_name = calendar.month_name[payment.service_period_month] if payment.service_period_month else "current period"
        
        # Get unit info
        unit_name = unit.unit_name if unit else "your unit"
        tower_name = unit.floor.tower.tower_name if unit and unit.floor and unit.floor.tower else ""
        
        # Build notification
        title = "Service Fee Overdue"
        message = f"Your {month_name} service fee is overdue by {days_overdue} day{'s' if days_overdue != 1 else ''}. Please pay to avoid penalties."
        
        # Format amount
        currency = payment.currency or 'BDT'
        amount_str = f"{currency} {payment.remaining_amount:,.0f}"
        
        # Metadata
        metadata = {
            'payment_id': payment.id,
            'bill_number': payment.bill_number,
            'service_period_year': payment.service_period_year,
            'service_period_month': payment.service_period_month,
            'month_name': month_name,
            'unit_id': unit.id if unit else None,
            'unit_name': unit_name,
            'tower_name': tower_name,
            'remaining_amount': float(payment.remaining_amount),
            'currency': currency,
            'due_date': payment.due_date.isoformat() if payment.due_date else None,
            'days_overdue': days_overdue,
            'should_send_push': True,  # Push + In-app
        }
        
        # Create notification for each recipient (all owners + residents of unit)
        notifications = []
        for recipient in recipients:
            try:
                notification, created = Notification.objects.get_or_create(
                    recipient=recipient,
                    notification_type=notification_type,
                    entity_type='service_fee',
                    entity_id=payment.id,
                    defaults={
                        'title': title,
                        'message': message,
                        'metadata': metadata,
                        'channel': 'mobile'  # Push + In-app
                    }
                )
                
                if created:
                    print(f"Created overdue notification for {recipient.full_name} (Unit {unit_name}, {days_overdue} days overdue)")
                else:
                    # Update message if days overdue changed - ensure channel is correct
                    notification.title = title
                    notification.message = message
                    notification.metadata = metadata
                    notification.channel = 'mobile'  # Ensure channel is set for push
                    notification.save()
                    print(f"Updated overdue notification for {recipient.full_name} (Unit {unit_name}, {days_overdue} days overdue)")
                
                notifications.append(notification)
            except Exception as e:
                print(f"Error creating overdue notification for {recipient.full_name}: {e}")
                continue
        
        # Send push notifications for all created notifications
        if notifications:
            from .unified_push_service import send_unified_push_for_notifications
            push_result = send_unified_push_for_notifications(notifications)
        
        return notifications
        
    except Exception as e:
        print(f"Error creating community member bill overdue notification: {e}")
        import traceback
        traceback.print_exc()
        return []


def create_community_member_payment_confirmation(payment, payment_amount, transaction_id=None, custom_period=None):
    """
    Create in-app notification for ALL owners and residents of the unit when a payment is successfully received
    
    Notification: "Payment Received"
    Message: "We've received your payment of BDT 5,000 for July service fees."
    Delivery: In-app (push optional)
    
    Args:
        payment: ServiceFeePayment instance
        payment_amount: Amount paid
        transaction_id: Optional ID of the specific payment transaction (ServiceFeeBilling ID)
    """
    try:
        import calendar
        
        # Get or create notification type
        notification_type = get_or_create_notification_type(
            code='service_fee_payment_confirmed',
            name='Payment Confirmed',
            entity_type='service_fee',
            description='Confirmation when a community member payment is successfully received',
            icon='💰',
            priority=3
        )
        
        # Get ALL owners and residents of the unit (not just the primary owner)
        unit = payment.unit
        if not unit:
            print(f"Payment {payment.id} has no unit to notify")
            return []
        
        recipients = get_all_unit_members(unit)
        
        # Role filter check: Mobile notifications should only go to Community Members
        recipients = [r for r in recipients if getattr(r, 'is_comm_member', False)]
        
        # Fallback to primary owner if no members found via unit lookup
        source_owner = getattr(payment, 'owner', None)
        if not recipients and source_owner and source_owner.member:
            fallback_member = source_owner.member
            if getattr(fallback_member, 'is_comm_member', False):
                recipients = [fallback_member]
        
        if not recipients:
            print(f"Payment {payment.id} has no owners/residents to notify")
            return []
        # Safely access service period
        service_period_month = getattr(payment, 'service_period_month', None)
        service_period_year = getattr(payment, 'service_period_year', None)
        
        # Get month name
        if custom_period:
            period_text = custom_period
        elif service_period_month and service_period_year:
            month_name = calendar.month_name[service_period_month]
            period_text = f"{month_name} service fees"
        else:
            period_text = "service fees (advance payment)"
        
        # Get unit info
        unit_name = unit.unit_name if unit else "your unit"
        
        # Build notification
        title = "Payment Received"
        currency = payment.currency or 'BDT'
        amount_str = f"{currency} {payment_amount:,.0f}"
        message = f"We've received your payment of {amount_str} for {period_text}."
        
        # Metadata
        metadata = {
            'payment_id': payment.id,
            'bill_number': getattr(payment, 'bill_number', None),
            'service_period_year': getattr(payment, 'service_period_year', None),
            'service_period_month': getattr(payment, 'service_period_month', None),
            'unit_id': unit.id if unit else None,
            'unit_name': unit_name,
            'payment_amount': float(payment_amount),
            'currency': currency,
            'should_send_push': True,  # Push + In-app for community member confirmation
        }
        
        # Create notification for each recipient (all owners + residents of unit)
        notifications = []
        
        # Determine entity ID - Use transaction_id if provided for uniqueness across multiple partial payments
        if transaction_id:
            entity_id_base = transaction_id
        else:
            # Unique ID per payment transaction. Offset by a large number for advance payments to avoid collision
            is_advance = not getattr(payment, 'service_period_month', None)
            id_multiplier = 2000 if is_advance else 1000
            entity_id_base = payment.id * id_multiplier + (getattr(payment, 'service_period_month', 0) or 0)
        
        for recipient in recipients:
            try:
                notification, created = Notification.objects.get_or_create(
                    recipient=recipient,
                    notification_type=notification_type,
                    entity_type='service_fee',
                    entity_id=entity_id_base,
                    defaults={
                        'title': title,
                        'message': message,
                        'metadata': metadata,
                        'channel': 'mobile'  # Push + In-app
                    }
                )
                
                if created:
                    print(f"Created payment confirmation for {recipient.full_name} (Unit {unit_name}, Amount: {amount_str})")
                else:
                    # Update if already exists - ensure channel and metadata are correct
                    notification.title = title
                    notification.message = message
                    notification.metadata = metadata
                    notification.channel = 'mobile'  # Ensure channel is set for push
                    notification.save()
                    print(f"Updated payment confirmation for {recipient.full_name} (Unit {unit_name}, Amount: {amount_str})")
                
                notifications.append(notification)
            except Exception as e:
                print(f"Error creating payment confirmation for {recipient.full_name}: {e}")
                continue
        
        # Send push notifications for all created notifications
        if notifications:
            from .unified_push_service import send_unified_push_for_notifications
            push_result = send_unified_push_for_notifications(notifications)
        
        return notifications
        
    except Exception as e:
        print(f"Error creating community member payment confirmation: {e}")
        import traceback
        traceback.print_exc()
        return []


def create_service_fee_payment_received_notification(payment, payment_amount, payment_method=None, recorded_by=None, transaction_id=None, custom_period=None):
    """
    Create notifications for admins with 'Record Service Fee Payment' permission when a payment is received
    
    Notification: "Payment Received"
    Message: "BDT 5,000 received from Unit B-203, Tower 1 for month July (2025) service fee."
    Delivery: In-app only
    
    Permission Required: PERMISSION_RECORD_PAYMENT (ID: 44)
    
    The person who recorded the payment is INCLUDED in receiving notifications alongside other users with the same permissions.
    
    Args:
        payment: ServiceFeePayment instance
        payment_amount: Amount received in this payment
        payment_method: Optional payment method name
        recorded_by: Optional member who recorded the payment (currently included in notifications)
        transaction_id: Optional ID of the specific payment transaction (ServiceFeeBilling ID)
    """
    try:
        from decimal import Decimal
        import calendar
        
        # Get or create notification type
        notification_type = get_or_create_notification_type(
            code='service_fee_payment_received',
            name='Service Fee Payment Received',
            entity_type='payment',
            description='Notification when a service fee payment is recorded',
            icon='💵',
            priority=4
        )
        
        # Get recipients - members with PERMISSION_RECORD_PAYMENT
        recipients = get_members_with_record_payment_permission()
        
        # Include the person who recorded the payment - they should receive the notification along with other eligible members
        if recorded_by:
            print(f"Payment recorder (ID: {recorded_by.id}, {recorded_by.full_name}) will be INCLUDED in {len(recipients)} eligible recipients")
        
        if not recipients:
            print(f"No members with record payment permission found to notify")
            return []
        
        # Dual-role safety: For payment alerts (received), exclude members who are PURE
        # community members of the paying unit (they receive a mobile confirmation instead).
        # IMPORTANT: Org members who also hold a community role (dual-role users) must still
        # receive the web notification — only skip if they have NO org role at all.
        unit = getattr(payment, 'unit', None)
        if unit:
            unit_members = get_all_unit_members(unit)
            # Only exclude members who are community members but NOT org members (pure comm members)
            pure_comm_member_ids = set(m.id for m in unit_members if getattr(m, 'is_org_member', False) is False)
            recipients = [r for r in recipients if r.id not in pure_comm_member_ids]
            print(f"Excluded {len(pure_comm_member_ids)} pure community-member unit members from admin payment notification")
        
        print(f"Creating payment received notifications for {len(recipients)} members")
        
        # Safely access service period
        service_period_month = getattr(payment, 'service_period_month', None)
        service_period_year = getattr(payment, 'service_period_year', None)
        
        # Check if this is an advance payment (no service period)
        is_advance_payment = not service_period_month or not service_period_year
        
        # Build notification message
        if is_advance_payment:
            # Advance payment - no service period
            title = "Advance Payment Received"
            
            # Get unit and tower info
            unit = payment.unit
            unit_name = unit.unit_name if unit else "Unknown Unit"
            tower_name = unit.floor.tower.tower_name if unit and unit.floor and unit.floor.tower else "Unknown Tower"
            
            # Format amount
            currency = payment.currency or 'BDT'
            amount_str = f"{currency} {payment_amount:,.0f}"
            
            message = f"{amount_str} advance payment received from Unit {unit_name}, {tower_name}."
            
            # Metadata for advance payment
            metadata = {
                'payment_id': payment.id,
                'payment_type': 'advance',
                'unit_id': unit.id if unit else None,
                'unit_name': unit_name,
                'tower_name': tower_name,
                'payment_amount': float(payment_amount),
                'currency': currency,
                'payment_method': payment_method or 'Not specified',
                'recorded_by_id': recorded_by.id if recorded_by else None,
                'recorded_by_name': recorded_by.full_name if recorded_by else None,
                'should_send_push': False,  # Admin-only notification, web dashboard only
            }
        else:
            # Regular service fee payment with period
            month_name = calendar.month_name[service_period_month]
            year = service_period_year
            
            # Get unit and tower info
            unit = payment.unit
            unit_name = unit.unit_name if unit else "Unknown Unit"
            tower_name = unit.floor.tower.tower_name if unit and unit.floor and unit.floor.tower else "Unknown Tower"
            
            # Format amount
            currency = payment.currency or 'BDT'
            amount_str = f"{currency} {payment_amount:,.0f}"
            
            title = "Payment Received"
            
            if custom_period:
                period_display = custom_period
            else:
                period_display = f"month {month_name} ({year}) service fee"
                
            message = f"{amount_str} received from Unit {unit_name}, {tower_name} for {period_display}."
            
            # Metadata for regular payment
            metadata = {
                'payment_id': payment.id,
                'payment_type': 'service_fee',
                'service_period_year': year,
                'service_period_month': service_period_month,
                'month_name': month_name,
                'unit_id': unit.id if unit else None,
                'unit_name': unit_name,
                'tower_name': tower_name,
                'payment_amount': float(payment_amount),
                'currency': currency,
                'payment_method': payment_method or 'Not specified',
                'recorded_by_id': recorded_by.id if recorded_by else None,
                'recorded_by_name': recorded_by.full_name if recorded_by else None,
                'should_send_push': False,  # Admin-only notification, web dashboard only
            }
        
        # Create notifications for each recipient
        notifications = []
        
        # Determine entity ID - distinguish between ServiceFeePayment and AdvancePayment to avoid collisions
        # Use a generic check that works for both real models and mock objects
        if transaction_id:
            entity_id = transaction_id
        else:
            is_advance = not getattr(payment, 'service_period_month', None)
            if is_advance:
                # For advance payments, use a distinct ID range (offset by 10,000,000)
                entity_id = payment.id + 10000000
            else:
                entity_id = payment.id
            
        for recipient in recipients:
            try:
                notification, created = Notification.objects.get_or_create(
                    recipient=recipient,
                    notification_type=notification_type,
                    entity_type='payment',
                    entity_id=entity_id,
                    defaults={
                        'title': title,
                        'message': message,
                        'metadata': metadata,
                        'channel': 'web'  # Admin notification - web dashboard only
                    }
                )
                
                if created:
                    notifications.append(notification)
                    print(f"Created payment received notification for {recipient.full_name}")
                else:
                    # Update if already exists - ensure channel and metadata are correct
                    notification.title = title
                    notification.message = message
                    notification.metadata = metadata
                    notification.channel = 'web'  # Admin notification - web dashboard only
                    notification.save()
                    notifications.append(notification)
                    print(f"Updated payment received notification for {recipient.full_name}")
                    
            except Exception as e:
                print(f"Error creating notification for {recipient.full_name}: {e}")
                continue
        
        print(f"Created {len(notifications)} payment received notifications")
        
        # Send push notifications for the created notifications
        if notifications:
            try:
                from .unified_push_service import send_unified_push_for_notifications
                print(f"[PaymentReceived] Sending push notifications for {len(notifications)} notifications...")
                push_result = send_unified_push_for_notifications(notifications)
                if push_result.get('success'):
                    print(f"[PaymentReceived] ✅ Push notifications sent: {push_result.get('total_sent', 0)}")
                else:
                    print(f"[PaymentReceived] ⚠️ Push notification result: {push_result}")
            except Exception as push_error:
                print(f"[PaymentReceived] ❌ Error sending push notifications: {push_error}")
                import traceback
                traceback.print_exc()
        
        return notifications
        
    except Exception as e:
        print(f"Error creating service fee payment received notifications: {e}")
        import traceback
        traceback.print_exc()
        return []
