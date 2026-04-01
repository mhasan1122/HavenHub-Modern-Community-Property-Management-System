# New Member Non-Retroactive Notification Logic

## Overview
This document describes the implementation of non-retroactive notification logic for newly created members in the Estate Link system.

## Problem Statement
When a new member is created and given permissions (to view announcements, bulletins, or notices), they should **NOT** receive notifications for content that existed before they joined. They should only receive notifications for content created **AFTER** their membership was created.

## Example Scenarios

### Announcements
- **Announcement A** created on Jan 1 (status='ongoing')
- **Announcement B** created on Jan 5 (status='ongoing')
- **New member created on Jan 10** with announcement view permission
- **Announcement C** created on Jan 12 (status='ongoing')
- **Result**: Member receives notification **ONLY** for Announcement C (created after Jan 10)

### Notices
- **Notice A** created on Jan 1 (status='ongoing')
- **Notice B** created on Jan 5 (status='ongoing')
- **New member created on Jan 10** with notice view permission
- **Notice C** created on Jan 12 (status='ongoing')
- **Result**: Member receives notification **ONLY** for Notice C (created after Jan 10)

### Bulletins
- **Bulletin A** created on Jan 1 (status='current')
- **Bulletin B** created on Jan 5 (status='current')
- **New member created on Jan 10** with bulletin view permission
- **Bulletin C** created on Jan 12 (status='current')
- **Result**: Member receives notification **ONLY** for Bulletin C (created after Jan 10)

## Implementation Details

### 1. New Function: `handle_new_member_notifications(member)`
**Location**: `backend/notifications/utils.py` (lines 1976-2072)

This is the main function that orchestrates notification creation for new members.

**Key Features**:
- Uses the member's `created_at` timestamp as the reference point
- Checks what permissions the member has been assigned
- For each permission type (bulletins, announcements, notices), calls the appropriate notification creation function
- Only creates notifications for entities created **AFTER** the member was created
- Returns a summary dictionary showing how many notifications were created for each entity type

**Logic Flow**:
```python
1. Get member's created_at timestamp
2. Get member's permission IDs
3. If member has PERMISSION_VIEW_BULLETIN_BOARD:
   - Call create_notifications_for_new_bulletin_permission(member, created_at)
4. If member has PERMISSION_VIEW_ANNOUNCEMENTS:
   - Call create_notifications_for_new_announcement_permission(member, created_at)
5. If member has PERMISSION_VIEW_NOTICE_BOARD:
   - Call create_notifications_for_new_notice_permission(member, created_at)
6. Return summary of notifications created
```

### 2. Integration Point: `MemberSerializer.create()`
**Location**: `backend/user/serializers.py` (lines 407-419)

The notification handling is triggered immediately after a new member is created and their roles are assigned.

**Integration Logic**:
```python
# After member.save()
try:
    from notifications.utils import handle_new_member_notifications
    handle_new_member_notifications(member)
except Exception as e:
    # Don't fail member creation if notification handling fails
    print(f"Error handling notifications for new member {member.id}: {e}")
    import traceback
    traceback.print_exc()
```

**Why This Location**:
- Member is fully created and saved
- Roles and permissions are already assigned
- Any exceptions in notification handling won't prevent member creation

### 3. Reused Functions
The implementation leverages existing notification creation functions:

#### `create_notifications_for_new_bulletin_permission(member, permission_grant_timestamp)`
**Location**: `backend/notifications/utils.py` (lines 1528-1671)
- Filters bulletins: `status='current'` AND `created_at > permission_grant_timestamp`
- Checks if member should receive based on targeting (units/towers)
- Creates bulletin_posted notifications

#### `create_notifications_for_new_announcement_permission(member, permission_grant_timestamp)`
**Location**: `backend/notifications/utils.py` (lines 1674-1821)
- Filters announcements: `status='ongoing'` AND `created_at > permission_grant_timestamp`
- Checks if member should receive based on targeting (units/towers)
- Creates announcement_published notifications

#### `create_notifications_for_new_notice_permission(member, permission_grant_timestamp)`
**Location**: `backend/notifications/utils.py` (lines 1824-1973)
- Filters notices: `status='ongoing'` AND `created_at > permission_grant_timestamp`
- Checks if member should receive based on targeting (units/towers)
- Creates notice_posted notifications

## Key Design Principles

### 1. Non-Retroactive by Default
New members NEVER receive notifications for content that existed before they joined. This prevents notification spam and confusion.

### 2. Permission-Based
Notifications are only created for entity types the member has permission to view:
- `PERMISSION_VIEW_BULLETIN_BOARD` (ID: 11)
- `PERMISSION_VIEW_ANNOUNCEMENTS` (ID: 10)
- `PERMISSION_VIEW_NOTICE_BOARD` (ID: 12)

### 3. Targeting Respected
Even if a member has permission, they only receive notifications for entities that target them:
- Entities with no targeting (no units/towers selected) → sent to all with permission
- Entities with specific units/towers → only sent to members in those units/towers
- Organization members with permission → always receive if they have the permission

### 4. Status-Based Filtering
Only active entities trigger notifications:
- Bulletins: `status='current'`
- Announcements: `status='ongoing'`
- Notices: `status='ongoing'`

### 5. Duplicate Prevention
The system uses `get_or_create()` to prevent duplicate notifications if the function is called multiple times.

### 6. Creator Exception
Creators always receive notifications for their own content, regardless of targeting or retroactive rules.

### 7. Graceful Failure
If notification creation fails, it doesn't prevent member creation. Errors are logged but don't break the transaction.

## Testing Scenarios

### Test Case 1: New Member with All Permissions
**Setup**:
- Create 3 bulletins, 3 announcements, 3 notices (all before member creation)
- Create new member with all view permissions
- Create 3 more bulletins, 3 announcements, 3 notices (all after member creation)

**Expected Result**:
- Member receives 0 notifications for pre-existing entities
- Member receives 9 notifications (3 bulletins + 3 announcements + 3 notices) for entities created after

### Test Case 2: New Member with Partial Permissions
**Setup**:
- Create new member with only bulletin view permission
- Create bulletins, announcements, notices after member creation

**Expected Result**:
- Member receives notifications only for bulletins
- Member receives 0 notifications for announcements and notices

### Test Case 3: Targeted Content
**Setup**:
- Create new member in Unit A
- Create bulletin targeting Unit A (after member creation)
- Create bulletin targeting Unit B (after member creation)

**Expected Result**:
- Member receives notification for Unit A bulletin
- Member does NOT receive notification for Unit B bulletin

### Test Case 4: Organization Member
**Setup**:
- Create new org member with all permissions
- Create org-level content (no targeting) after member creation

**Expected Result**:
- Member receives all notifications for org-level content

## Compatibility Notes

### Existing Permission Grant Logic
This implementation is **compatible** with the existing permission grant logic:
- `create_notifications_for_new_bulletin_permission(member, timestamp)` - already existed
- `create_notifications_for_new_announcement_permission(member, timestamp)` - already existed
- `create_notifications_for_new_notice_permission(member, timestamp)` - already existed

These functions were originally designed for when permissions are granted to existing members. The new implementation reuses these functions by passing the member's `created_at` timestamp as the permission grant timestamp.

### Where This Works
The notification logic applies to:
1. **Organization members** - created via `CreateMember` API endpoint
2. **Community members** - created via `CreateMemberForUnit` API endpoint
3. **Any member creation** - as long as it uses `MemberSerializer`

### Edge Cases Handled
1. **Member without created_at**: Returns empty summary, no notifications created
2. **Member without permissions**: Returns empty summary, no notifications created
3. **No active entities exist**: No notifications created (normal behavior)
4. **Notification creation fails**: Error logged but member creation proceeds
5. **Duplicate calls**: `get_or_create()` prevents duplicate notifications

## Monitoring and Debugging

### Log Prefixes
All logs from this feature use the `[NEW-MEMBER]` prefix for easy filtering:
```
[NEW-MEMBER] Processing notifications for new member 123 (John Doe) created at 2026-01-10
[NEW-MEMBER] Member 123 has permissions: {10, 11, 12}
[NEW-MEMBER] Created 5 bulletin notifications for member 123
[NEW-MEMBER] SUMMARY: Created total of 15 notifications for new member 123
```

### Verification Queries

**Check notifications created for a specific member**:
```python
from notifications.models import Notification
from user.models import Member

member = Member.objects.get(id=123)
notifications = Notification.objects.filter(recipient=member)

# Group by entity type
bulletins = notifications.filter(entity_type='bulletin').count()
announcements = notifications.filter(entity_type='announcement').count()
notices = notifications.filter(entity_type='notice').count()

print(f"Bulletins: {bulletins}, Announcements: {announcements}, Notices: {notices}")
```

**Verify non-retroactive logic**:
```python
from notifications.models import Notification
from user.models import Member

member = Member.objects.get(id=123)
member_created = member.created_at

# Check if any notifications are for entities created before member
from bulletins.models import Bulletin
from announcements.models import Announcement
from noticeboard.models import Notice

bulletin_notifications = Notification.objects.filter(
    recipient=member,
    entity_type='bulletin'
)

for notif in bulletin_notifications:
    bulletin = Bulletin.objects.get(id=notif.entity_id)
    if bulletin.created_at <= member_created:
        print(f"ERROR: Retroactive notification found! Bulletin {bulletin.id} created {bulletin.created_at}, Member created {member_created}")
```

## Future Enhancements

1. **Batch Processing**: If many members are created at once, could batch notification creation
2. **Background Processing**: For large communities, could move to Celery task
3. **Notification Preferences**: Allow members to opt-out of certain notification types
4. **Digest Mode**: Instead of individual notifications, send daily/weekly digests

## Related Files

- `/backend/notifications/utils.py` - Main notification logic
- `/backend/user/serializers.py` - Member creation integration
- `/backend/user/models.py` - Member model with `get_permission_ids()` and `get_permission_grant_timestamp()`
- `/backend/group_role/permission_constants.py` - Permission ID constants
- `/backend/notifications/models.py` - Notification and NotificationType models

## Questions or Issues?

If notifications aren't being created for new members:
1. Check member has `created_at` timestamp
2. Verify member has appropriate permissions
3. Ensure entities exist with `created_at > member.created_at`
4. Check entity status (current/ongoing)
5. Review logs with `[NEW-MEMBER]` prefix
6. Verify member matches targeting criteria (units/towers)

