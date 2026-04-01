"""
Push notification service for sending push notifications via Expo Push API
"""
import requests
import logging
import json
from typing import List, Dict, Optional
from django.conf import settings
from django.utils import timezone
from .models import DeviceToken, Notification

logger = logging.getLogger(__name__)

# Expo Push API endpoint
EXPO_PUSH_API_URL = 'https://exp.host/--/api/v2/push/send'


def serialize_data_for_fcm(data: Dict) -> Dict:
    """
    Convert all data values to strings for FCM compatibility.
    FCM requires all data values to be strings, not integers or nested objects.
    
    Args:
        data: Dictionary with mixed types
    
    Returns:
        Dictionary with all values converted to strings
    """
    if not data:
        return {}
    
    serialized = {}
    for key, value in data.items():
        if value is None:
            serialized[key] = ''
        elif isinstance(value, (dict, list)):
            # Convert complex types to JSON string
            serialized[key] = json.dumps(value)
        else:
            # Convert everything else to string
            serialized[key] = str(value)
    
    return serialized

# Get Expo access token from settings (optional but recommended for better reliability)
def get_expo_access_token() -> Optional[str]:
    """
    Get Expo access token from Django settings.
    This is optional but recommended for better reliability and higher rate limits.
    To get an access token:
    1. Go to https://expo.dev/accounts/[your-account]/settings/access-tokens
    2. Create a new access token
    3. Add it to your Django settings as EXPO_ACCESS_TOKEN
    """
    return getattr(settings, 'EXPO_ACCESS_TOKEN', None)


def send_push_notification(
    tokens: List[str],
    title: str,
    body: str,
    data: Optional[Dict] = None,
    sound: str = 'default',
    priority: str = 'default',
    badge: Optional[int] = None,
    icon: Optional[str] = None
) -> Dict:
    """
    Send push notification to one or more Expo push tokens
    
    Args:
        tokens: List of Expo push tokens
        title: Notification title
        body: Notification body/message
        data: Optional data payload (dict)
        sound: Sound to play ('default' or None)
        priority: Priority level ('default' or 'high')
        badge: Badge count (iOS only)
        icon: Optional icon name/emoji (for Android, can be emoji or icon resource name)
    
    Returns:
        Dict with 'success' (bool) and 'results' (list of responses)
    """
    if not tokens:
        logger.warning("No tokens provided for push notification")
        return {'success': False, 'error': 'No tokens provided', 'error_count': 0, 'success_count': 0}
    
    # Prepare messages for Expo Push API
    messages = []
    for token in tokens:
        message = {
            'to': token,
            'title': title,
            'body': body,
            'sound': sound,
            'priority': priority,
        }
        
        if data:
            message['data'] = data
        
        if badge is not None:
            message['badge'] = badge
        
        # Add icon if provided (Expo supports icon in data for Android)
        if icon:
            if not message.get('data'):
                message['data'] = {}
            message['data']['icon'] = icon
        
        messages.append(message)
    
    try:
        # Prepare headers
        headers = {
            'Content-Type': 'application/json',
            'Accept': 'application/json',
            'Accept-Encoding': 'gzip, deflate',
        }
        
        # Add Expo access token if available (recommended for better reliability)
        expo_access_token = get_expo_access_token()
        if expo_access_token:
            headers['Authorization'] = f'Bearer {expo_access_token}'
            logger.debug("Using Expo access token for push notification")
        else:
            logger.debug("Sending push notification without access token (using public API)")
        
        # Send to Expo Push API
        response = requests.post(
            EXPO_PUSH_API_URL,
            json=messages,
            headers=headers,
            timeout=10
        )
        
        response.raise_for_status()
        results = response.json()['data']
        
        # Check for errors in results
        errors = [r for r in results if r.get('status') == 'error']
        if errors:
            logger.warning(f"Some push notifications failed: {errors}")
        
        success_count = len([r for r in results if r.get('status') == 'ok'])
        logger.info(f"Sent {success_count}/{len(tokens)} push notifications successfully")
        
        return {
            'success': True,
            'results': results,
            'success_count': success_count,
            'error_count': len(errors)
        }
    
    except requests.exceptions.RequestException as e:
        logger.error(f"Error sending push notification: {str(e)}")
        return {
            'success': False,
            'error': str(e)
        }
    except Exception as e:
        logger.error(f"Unexpected error sending push notification: {str(e)}")
        return {
            'success': False,
            'error': str(e)
        }


def send_push_notification_to_members(
    members: List,
    title: str,
    body: str,
    data: Optional[Dict] = None,
    sound: str = 'default',
    priority: str = 'default',
    badge: Optional[int] = None
) -> Dict:
    """
    Send push notification to multiple members by fetching their active device tokens
    Automatically routes to Expo or FCM based on token type
    
    Args:
        members: List of Member objects
        title: Notification title
        body: Notification body/message
        data: Optional data payload
        sound: Sound to play
        priority: Priority level
        badge: Badge count
    
    Returns:
        Dict with success status and results
    """
    if not members:
        logger.warning("No members provided for push notification")
        return {'success': False, 'error': 'No members provided'}
    
    # Get all active device tokens for these members, grouped by token type
    member_ids = [m.id if hasattr(m, 'id') else m for m in members]
    
    logger.info(f"Fetching device tokens for {len(member_ids)} members")
    
    device_tokens = DeviceToken.objects.filter(
        member_id__in=member_ids,
        is_active=True
    ).values('push_token', 'token_type', 'device_type')
    
    # Separate tokens by type (with device_type for dual Firebase: iOS vs Android)
    expo_tokens = []
    fcm_tokens = []
    fcm_token_platform_map = {}
    
    for device_token in device_tokens:
        token = device_token['push_token']
        token_type = device_token.get('token_type', 'expo')  # Default to expo for backward compatibility
        
        if token_type == 'fcm':
            fcm_tokens.append(token)
            if device_token.get('device_type'):
                fcm_token_platform_map[token] = device_token['device_type']
        else:
            expo_tokens.append(token)
    
    if not expo_tokens and not fcm_tokens:
        logger.warning(f"No active device tokens found for {len(members)} members (member_ids: {member_ids[:10]})")
        return {
            'success': True,
            'results': [],
            'success_count': 0,
            'error_count': 0,
            'message': 'No active device tokens found'
        }
    
    logger.info(f"Sending push notifications: {len(expo_tokens)} Expo tokens, {len(fcm_tokens)} FCM tokens")
    
    # Update last_used_at for all tokens
    all_tokens = expo_tokens + fcm_tokens
    DeviceToken.objects.filter(push_token__in=all_tokens).update(last_used_at=timezone.now())
    
    results = []
    total_success = 0
    total_errors = 0
    
    # Send to Expo tokens
    if expo_tokens:
        logger.info(f"Sending to {len(expo_tokens)} Expo tokens")
        expo_result = send_push_notification(
            tokens=expo_tokens,
            title=title,
            body=body,
            data=data,
            sound=sound,
            priority=priority,
            badge=badge
        )
        results.append({'type': 'expo', 'result': expo_result})
        total_success += expo_result.get('success_count', 0)
        total_errors += expo_result.get('error_count', 0)
    
    # Send to FCM tokens
    if fcm_tokens:
        try:
            from .fcm_service import send_fcm_notifications_batch
            logger.info(f"Sending to {len(fcm_tokens)} FCM tokens")
            
            # Serialize data for FCM (convert all values to strings)
            fcm_data = serialize_data_for_fcm(data) if data else {}
            
            fcm_result = send_fcm_notifications_batch(
                tokens=fcm_tokens,
                title=title,
                body=body,
                data=fcm_data,  # Use serialized data
                priority='high' if priority == 'high' else 'normal',
                sound=sound,
                token_platform_map=fcm_token_platform_map or None,
            )
            results.append({'type': 'fcm', 'result': fcm_result})
            total_success += fcm_result.get('success_count', 0)
            total_errors += fcm_result.get('error_count', 0)
        except ImportError:
            logger.error("FCM service not available but FCM tokens found")
            results.append({'type': 'fcm', 'error': 'FCM service not available'})
            total_errors += len(fcm_tokens)
    
    return {
        'success': total_success > 0,
        'results': results,
        'success_count': total_success,
        'error_count': total_errors,
        'expo_count': len(expo_tokens),
        'fcm_count': len(fcm_tokens)
    }


def send_push_for_notification(notification: Notification) -> Dict:
    """
    Send push notification for a specific Notification object
    Only sends if should_send_push is True in metadata
    
    Args:
        notification: Notification object
    
    Returns:
        Dict with success status
    """
    # Check if push notification should be sent
    metadata = notification.metadata or {}
    should_send_push = metadata.get('should_send_push', False)
    
    # STRICTLY respect the channel configuration
    # If channel is 'web', DO NOT send push notification regardless of other settings
    if notification.channel == 'web':
        logger.debug(f"Skipping push for notification {notification.id} - channel is 'web'")
        return {
            'success': True,
            'skipped': True,
            'message': 'Notification configured for Web only'
        }
    
    if not should_send_push:
        logger.debug(f"Push notification not enabled for notification {notification.id}")
        return {
            'success': True,
            'skipped': True,
            'message': 'Push notification not enabled for this notification'
        }
    
    # Get priority from metadata or use default
    priority = metadata.get('priority', 'normal')
    push_priority = 'high' if priority in ['high', 'urgent'] else 'default'
    
    # For notice notifications, use mobile-specific title and message
    # Web app uses notification.title/message (full context)
    # Mobile push uses mobile_title/short_message (minimal, resident-friendly)
    if notification.entity_type == 'notice':
        push_title = metadata.get('mobile_title', notification.title)
        push_body = metadata.get('short_message', notification.message)
    else:
        # For other notification types, use standard title and short_message if available
        push_title = notification.title
        push_body = metadata.get('short_message', notification.message)
    
    # Prepare data payload
    # Include both camelCase (standard) and snake_case (for compatibility) formats
    data = {
        'notificationId': notification.id,
        'type': notification.notification_type.code,
        'entityType': notification.entity_type,
        'entityId': notification.entity_id,
        # Also include snake_case for backward compatibility
        'entity_type': notification.entity_type,
        'entity_id': notification.entity_id,
    }
    
    # Add announcement ID and metadata if it's an announcement notification
    if notification.entity_type == 'announcement':
        data['announcementId'] = notification.entity_id
        # Include announcement status and notification type for frontend navigation
        if 'announcement_status' in metadata:
            data['metadata'] = {
                'announcement_status': metadata.get('announcement_status'),
                'notification_type': metadata.get('notification_type'),
            }
    
    # Add bulletin ID and metadata if it's a bulletin notification
    if notification.entity_type == 'bulletin':
        data['bulletinId'] = notification.entity_id
        # Include bulletin status and notification type for frontend navigation
        if 'status' in metadata:
            data['metadata'] = {
                'bulletin_status': metadata.get('status'),
                'notification_type': notification.notification_type.code,
            }
    
    # Add notice ID and metadata if it's a notice notification
    if notification.entity_type == 'notice':
        data['noticeId'] = notification.entity_id
        # Include notice metadata for frontend navigation
        data['metadata'] = {
            'notice_title': metadata.get('notice_title', ''),
            'priority': metadata.get('priority', 'normal'),
            'label': metadata.get('label', ''),
            'notification_type': notification.notification_type.code,
        }
    
    # Send push notification
    # Use push_title (mobile-friendly for notices, standard for others)
    return send_push_notification_to_members(
        members=[notification.recipient],
        title=push_title,
        body=push_body,
        data=data,
        priority=push_priority,
        sound='default'
    )


def send_push_for_notifications(notifications: List[Notification]) -> Dict:
    """
    Send push notifications for multiple Notification objects
    Groups by recipient to avoid duplicate sends
    
    Args:
        notifications: List of Notification objects
    
    Returns:
        Dict with success status and summary
    """
    if not notifications:
        return {'success': True, 'message': 'No notifications to send'}
    
    # Group notifications by recipient
    recipients_notifications = {}
    for notification in notifications:
        recipient_id = notification.recipient.id
        if recipient_id not in recipients_notifications:
            recipients_notifications[recipient_id] = []
        recipients_notifications[recipient_id].append(notification)
    
    results = []
    total_sent = 0
    total_skipped = 0
    
    for recipient_id, recipient_notifications in recipients_notifications.items():
        # Use the first notification for this recipient (they should all have same content)
        notification = recipient_notifications[0]
        result = send_push_for_notification(notification)
        results.append(result)
        
        if result.get('skipped'):
            total_skipped += 1
        elif result.get('success'):
            total_sent += result.get('success_count', 0)
    
    return {
        'success': True,
        'total_recipients': len(recipients_notifications),
        'total_sent': total_sent,
        'total_skipped': total_skipped,
        'results': results
    }
