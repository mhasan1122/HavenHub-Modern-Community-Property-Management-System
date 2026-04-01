# Organization Member Notifications Implementation

## Overview

This document describes the implementation of organization member notifications with strict permission-based visibility for the Estate Link application.

## Features Implemented

### Three Notification Types

1. **New Organization Member Added**
   - Triggered when a new organization member is created
   - Only shown to users with "View Member List" permission
   - Message format: "New organization member added – {Full Name}"
   - Entity type: `member`
   - Notification code: `org_member_added`

2. **New Role Assigned**
   - Triggered when a role is assigned to a member
   - Shown to the member who received the role
   - Message format: "You have been assigned a new role – {Role Name}"
   - Entity type: `other`
   - Notification code: `role_assigned`

3. **Added to a New Group**
   - Triggered when a member is added to a group
   - Shown to the member who was added to the group
   - Message format: "You have been added to a new group – {Group Name}"
   - Entity type: `other`
   - Notification code: `group_added`

## Security Features

### Permission-Based Visibility

- **"View Member List" Permission Required**: Only users with this permission (ID: 3) receive organization member notifications
- **Non-Retroactive**: Users who receive permissions later do NOT see notifications for past events
- **Real-Time Permission Checks**: Notifications are filtered at both creation and display time
- **No Information Leakage**: Users without permission cannot see any organization member notifications

### Retroactive Filtering

The system implements strict non-retroactive notification logic:

1. When a member is added, notifications are ONLY sent to users who have the permission AT THAT TIME
2. If a user gets the permission later, they will NOT see notifications for members added before they got the permission
3. They will ONLY see notifications for members added AFTER they received the permission

Example:
- Member A added on Jan 1
- Member B added on Jan 5
- User gets "View Member List" permission on Jan 10
- Member C added on Jan 12
- **Result**: User only sees notification for Member C (not A or B)

## Implementation Details

### Files Modified

1. **backend/notifications/models.py**
   - Added 'role' and 'group' to `ENTITY_TYPES` in `NotificationType`

2. **backend/notifications/utils.py**
   - Added `create_org_member_added_notification()` function
   - Added `create_role_assigned_notification()` function
   - Added `create_group_added_notification()` function
   - Updated `has_view_permission()` to handle 'member', 'role', and 'group' entity types
   - Updated `should_show_notification()` to handle organization member notifications with retroactive filtering
   - Added `PERMISSION_VIEW_MEMBER_LIST` import

3. **backend/user/signals.py** (NEW FILE)
   - Created signal handler for `post_save` on `Member` model
   - Triggers organization member notification when a new org member is created

4. **backend/user/apps.py**
   - Added `ready()` method to import signals when app starts

5. **backend/group_role/signals.py**
   - Added `notify_member_role_assigned()` signal handler for role assignment
   - Added `notify_member_group_added()` signal handler for group membership
   - Updated imports to include `GroupMembers` and `PERMISSION_VIEW_MEMBER_LIST`

### Database Changes

**Migration**: `notifications/migrations/0009_alter_notificationtype_entity_type.py`

Added new entity types to `NotificationType.ENTITY_TYPES`:
- `('role', 'Role')`
- `('group', 'Group')`

## Signal Flow

### 1. New Organization Member Added

```
Member.objects.create(..., is_org_member=True)
    ↓
post_save signal triggered (user/signals.py)
    ↓
notify_org_member_added()
    ↓
create_org_member_added_notification()
    ↓
Notifications sent to all users with "View Member List" permission
```

### 2. New Role Assigned

```
MembersRole.objects.create(member=..., role=...)
    ↓
post_save signal triggered (group_role/signals.py)
    ↓
notify_member_role_assigned()
    ↓
create_role_assigned_notification()
    ↓
Notification sent to the member who got the role
```

### 3. Added to a New Group

```
GroupMembers.objects.create(member=..., group=...)
    ↓
post_save signal triggered (group_role/signals.py)
    ↓
notify_member_group_added()
    ↓
create_group_added_notification()
    ↓
Notification sent to the member who was added to the group
```

## Permission Checking Logic

### At Notification Creation Time

1. **Organization Member Added**:
   - Query all members with `is_org_member=True`
   - Check each member for `PERMISSION_VIEW_MEMBER_LIST` (ID: 3)
   - Create notifications ONLY for members with the permission

2. **Role Assigned**:
   - No permission check required
   - Notification sent directly to the member who received the role

3. **Added to Group**:
   - No permission check required
   - Notification sent directly to the member who was added to the group

### At Notification Display Time

The `should_show_notification()` function performs additional checks:

1. **Permission Check**: Verify the user still has the required permission
2. **Retroactive Filter**: Compare entity creation time with permission grant time
3. **Special Cases**:
   - Role/group notifications always shown (user is the target)
   - Members don't see notifications about themselves being added

## API Response

Notifications are returned through the existing notification API endpoints with these fields:

```json
{
  "id": 123,
  "notification_type_code": "org_member_added",
  "notification_type_name": "Organization Member Added",
  "notification_type_icon": "👤",
  "entity_type": "member",
  "entity_id": 456,
  "title": "New Organization Member Added",
  "message": "New organization member added – John Doe",
  "is_read": false,
  "metadata": {
    "member_id": 456,
    "member_name": "John Doe",
    "created_at": "2026-01-04T12:00:00Z"
  },
  "created_at": "2026-01-04T12:00:01Z"
}
```

## Frontend Integration

### Notification Click Actions

1. **Organization Member Added**:
   - Preferred: Navigate to `/members/{member_id}` (member profile page)
   - Alternative: Navigate to `/members` (member list page)

2. **Role Assigned**:
   - Navigate to `/profile` (personal profile page)
   - Open the "Organization Member" tab by default

3. **Added to Group**:
   - Navigate to `/groups/{group_id}` (group profile page)

### Frontend Implementation Example

```javascript
const handleNotificationClick = (notification) => {
  switch (notification.notification_type_code) {
    case 'org_member_added':
      // Navigate to member profile
      const memberId = notification.entity_id;
      navigate(`/members/${memberId}`);
      break;
      
    case 'role_assigned':
      // Navigate to personal profile with org member tab
      navigate('/profile', { state: { activeTab: 'organization' } });
      break;
      
    case 'group_added':
      // Navigate to group profile
      const groupId = notification.entity_id;
      navigate(`/groups/${groupId}`);
      break;
  }
};
```

## Testing

A comprehensive test script is provided: `test_org_member_notifications.py`

### Test Coverage

1. ✅ New organization member notification sent to users with permission
2. ✅ New organization member notification NOT sent to users without permission
3. ✅ Role assignment notification sent to the member
4. ✅ Group addition notification sent to the member
5. ✅ Retroactive filtering prevents notifications for past events
6. ✅ Users who get permission later only see future notifications

### Running Tests

```bash
cd backend
source venv/bin/activate
python test_org_member_notifications.py
```

## Security Considerations

1. **Permission Enforcement**: Dual-layer permission checks (creation + display)
2. **No Retroactive Data**: Users cannot see historical data by gaining permissions
3. **No Self-Notifications**: Members don't see notifications about themselves being added
4. **Audit Trail**: All notification creations are logged in console output
5. **Database Constraints**: Uses `get_or_create` to prevent duplicate notifications

## Performance Optimization

1. **Bulk Query**: Permission checks use `get_permission_ids()` method efficiently
2. **Database Indexes**: Notification model has indexes on recipient and entity type
3. **Selective Filtering**: Only org members are queried for permission checks
4. **Signal Efficiency**: Signals only trigger for new records (created=True)

## Future Enhancements

Potential improvements for future iterations:

1. **Batch Notifications**: Queue notifications for bulk processing
2. **Email Notifications**: Send email alerts for organization changes
3. **Notification Preferences**: Allow users to customize notification types
4. **Real-Time Updates**: WebSocket integration for instant notifications
5. **Notification History**: Archive old notifications after a certain period

## Troubleshooting

### No Notifications Appearing

1. Check if signals are registered (verify `apps.py` has `ready()` method)
2. Verify permission ID 3 exists in database
3. Check user has `is_org_member=True` and the permission
4. Review console logs for signal execution

### Retroactive Notifications Showing

1. Verify `should_show_notification()` is being called
2. Check `get_permission_grant_timestamp()` returns correct timestamp
3. Ensure entity creation timestamp is available

### Permission Checks Failing

1. Verify `PERMISSION_VIEW_MEMBER_LIST = 3` matches database
2. Check role has the permission assigned
3. Verify `is_active=True` on role and role_permission

## Conclusion

This implementation provides a secure, scalable, and maintainable notification system for organization member changes. All security requirements are met, including strict permission-based visibility and non-retroactive notification logic.
