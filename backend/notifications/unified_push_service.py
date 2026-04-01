"""
Unified push notification service that supports both Expo Push API and FCM
Automatically detects token type and routes to appropriate service
"""
import logging
from typing import List, Dict, Optional
from django.conf import settings
from django.utils import timezone
from .models import DeviceToken, Notification
from .push_service import send_push_notification as send_expo_notification
from .fcm_service import (
    send_fcm_notification,
    send_fcm_notifications_batch,
    is_fcm_token,
    initialize_fcm
)

logger = logging.getLogger(__name__)


# Track push notification statistics for debugging
PUSH_STATS = {
    'total_attempts': 0,
    'total_sent': 0,
    'total_skipped': 0,
    'total_failed': 0,
    'skip_reasons': {}
}


def log_push_skip(reason, notification_id=None):
    """Log why a push notification was skipped"""
    PUSH_STATS['skip_reasons'][reason] = PUSH_STATS['skip_reasons'].get(reason, 0) + 1
    logger.info(f"🔕 Push skipped for notification {notification_id}: {reason}")


def log_push_stats():
    """Log accumulated push statistics"""
    if PUSH_STATS['total_attempts'] > 0:
        logger.info(f"📊 Push Stats - Attempts: {PUSH_STATS['total_attempts']}, "
                   f"Sent: {PUSH_STATS['total_sent']}, "
                   f"Skipped: {PUSH_STATS['total_skipped']}, "
                   f"Failed: {PUSH_STATS['total_failed']}")
        if PUSH_STATS['skip_reasons']:
            logger.info(f"Skip reasons: {PUSH_STATS['skip_reasons']}")


def detect_token_type(token: str) -> str:
    """
    Detect if token is Expo or FCM token
    
    Returns:
        'expo' or 'fcm'
    """
    if not token:
        return 'expo'  # Default to Expo for backward compatibility
    
    if is_fcm_token(token):
        return 'fcm'
    return 'expo'


def send_unified_push_notification(
    tokens: List[str],
    title: str,
    body: str,
    data: Optional[Dict] = None,
    sound: str = 'default',
    priority: str = 'default',
    badge: Optional[int] = None,
    icon: Optional[str] = None,
    token_platform_map: Optional[Dict[str, str]] = None,
) -> Dict:
    """
    Send push notifications using the appropriate service (Expo or FCM)
    Automatically detects token type and routes accordingly
    
    Args:
        tokens: List of push tokens (can be mix of Expo and FCM tokens)
        title: Notification title
        body: Notification body/message
        data: Optional data payload (dict)
        sound: Sound to play ('default' or None)
        priority: Priority level ('default' or 'high')
        badge: Badge count (iOS only)
        icon: Optional icon name/path for Android notifications (e.g., 'icon', 'notification_icon')
    
    Returns:
        Dict with 'success' (bool), 'success_count', 'error_count', and 'results'
    """
    if not tokens:
        logger.warning("No tokens provided for unified push notification")
        return {
            'success': False,
            'error': 'No tokens provided',
            'success_count': 0,
            'error_count': 0
        }
    
    # Separate tokens by type
    expo_tokens = []
    fcm_tokens = []
    
    for token in tokens:
        token_type = detect_token_type(token)
        if token_type == 'fcm':
            fcm_tokens.append(token)
        else:
            expo_tokens.append(token)
    
    logger.info(f"Unified push: {len(expo_tokens)} Expo tokens, {len(fcm_tokens)} FCM tokens")
    
    results = {
        'success': True,
        'expo': {'success_count': 0, 'error_count': 0, 'results': []},
        'fcm': {'success_count': 0, 'error_count': 0, 'results': []},
        'success_count': 0,
        'error_count': 0,
        'tokens_to_remove': []
    }
    
    # Send Expo notifications
    if expo_tokens:
        expo_result = send_expo_notification(
            tokens=expo_tokens,
            title=title,
            body=body,
            data=data,
            sound=sound,
            priority=priority,
            badge=badge,
            icon=icon
        )
        
        if expo_result.get('success'):
            results['expo']['success_count'] = expo_result.get('success_count', 0)
            results['expo']['error_count'] = expo_result.get('error_count', 0)
            results['expo']['results'] = expo_result.get('results', [])
        else:
            results['expo']['error_count'] = len(expo_tokens)
            results['expo']['error'] = expo_result.get('error', 'Unknown error')
    
    # Send FCM notifications
    if fcm_tokens:
        # Check if FCM is enabled
        fcm_enabled = getattr(settings, 'FCM_ENABLED', False)
        
        if not fcm_enabled:
            logger.warning(f"FCM tokens detected but FCM_ENABLED is False. Skipping {len(fcm_tokens)} FCM tokens.")
            results['fcm']['error_count'] = len(fcm_tokens)
            results['fcm']['error'] = 'FCM not enabled in settings'
        else:
            # Initialize FCM if needed
            initialize_fcm()
            
            fcm_result = send_fcm_notifications_batch(
                tokens=fcm_tokens,
                title=title,
                body=body,
                data=data,
                sound=sound,
                priority=priority,
                badge=badge,
                icon=icon,
                token_platform_map=token_platform_map,
            )
            
            if fcm_result.get('success'):
                results['fcm']['success_count'] = fcm_result.get('success_count', 0)
                results['fcm']['error_count'] = fcm_result.get('error_count', 0)
                results['fcm']['results'] = fcm_result.get('results', [])
                
                # Collect tokens that should be removed
                tokens_to_remove = fcm_result.get('tokens_to_remove', [])
                if tokens_to_remove:
                    results['tokens_to_remove'].extend(tokens_to_remove)
            else:
                results['fcm']['error_count'] = len(fcm_tokens)
                results['fcm']['error'] = fcm_result.get('error', 'Unknown error')
    
    # Calculate totals
    results['success_count'] = results['expo']['success_count'] + results['fcm']['success_count']
    results['error_count'] = results['expo']['error_count'] + results['fcm']['error_count']
    
    # Overall success if at least one service succeeded
    if results['success_count'] > 0:
        results['success'] = True
    elif results['error_count'] > 0:
        results['success'] = False
    
    logger.info(
        f"Unified push completed: {results['success_count']} successful, "
        f"{results['error_count']} failed out of {len(tokens)} total tokens"
    )
    
    return results


def send_unified_push_to_members(
    members: List,
    title: str,
    body: str,
    data: Optional[Dict] = None,
    sound: str = 'default',
    priority: str = 'default',
    badge: Optional[int] = None,
    icon: Optional[str] = None
) -> Dict:
    """
    Send unified push notification to multiple members by fetching their active device tokens
    Supports both Expo and FCM tokens
    
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
        logger.warning("No members provided for unified push notification")
        return {'success': False, 'error': 'No members provided'}
    
    # Get all active device tokens for these members (with device_type for dual Firebase routing)
    member_ids = [m.id if hasattr(m, 'id') else m for m in members]
    device_tokens = DeviceToken.objects.filter(
        member_id__in=member_ids,
        is_active=True
    ).values_list('push_token', 'device_type')
    
    token_list = [dt[0] for dt in device_tokens]
    token_platform_map = {dt[0]: dt[1] for dt in device_tokens if dt[1]}
    
    if not token_list:
        logger.info(f"No active device tokens found for {len(members)} members")
        return {
            'success': True,
            'results': [],
            'success_count': 0,
            'error_count': 0,
            'message': 'No active device tokens found'
        }
    
    logger.info(f"Sending unified push notification to {len(token_list)} device tokens for {len(members)} members")
    
    # Update last_used_at for tokens
    DeviceToken.objects.filter(push_token__in=token_list).update(last_used_at=timezone.now())
    
    # Send unified push (with token_platform_map for dual Firebase: iOS vs Android)
    result = send_unified_push_notification(
        tokens=token_list,
        title=title,
        body=body,
        data=data,
        sound=sound,
        priority=priority,
        badge=badge,
        icon=icon,
        token_platform_map=token_platform_map,
    )
    
    # Remove invalid tokens if any
    tokens_to_remove = result.get('tokens_to_remove', [])
    if tokens_to_remove:
        logger.info(f"Removing {len(tokens_to_remove)} invalid FCM tokens")
        DeviceToken.objects.filter(push_token__in=tokens_to_remove).update(is_active=False)
    
    return result


def send_unified_push_for_notification(notification: Notification) -> Dict:
    """
    Send unified push notification for a specific Notification object
    Only sends if should_send_push is True in metadata
    For tower-targeted announcement/bulletin/notice, only sends if recipient is still in that tower
    (so push and in-app list stay in sync: no push if they wouldn't see it in-app)
    Supports both Expo and FCM tokens
    """
    PUSH_STATS['total_attempts'] += 1
    
    # Check if push notification should be sent
    metadata = notification.metadata or {}
    should_send_push = metadata.get('should_send_push', False)

    # STRICTLY respect the channel configuration
    # If channel is 'web', DO NOT send push notification regardless of other settings
    if notification.channel == 'web':
        PUSH_STATS['total_skipped'] += 1
        log_push_skip("channel is 'web'", notification.id)
        return {
            'success': True,
            'skipped': True,
            'message': 'Notification configured for Web only'
        }

    if not should_send_push:
        PUSH_STATS['total_skipped'] += 1
        log_push_skip("should_send_push=False in metadata", notification.id)
        return {
            'success': True,
            'skipped': True,
            'message': 'Push notification not enabled for this notification'
        }

    # For tower/unit-targeted content, only send push if recipient stays in that tower
    try:
        from .utils import _should_send_push_for_notification
        if not _should_send_push_for_notification(notification):
            PUSH_STATS['total_skipped'] += 1
            log_push_skip("recipient not in targeted tower/unit", notification.id)
            return {
                'success': True,
                'skipped': True,
                'message': 'Recipient not in targeted tower/unit'
            }
    except Exception as e:
        PUSH_STATS['total_failed'] += 1
        logger.error(f"Tower check failed for notification {notification.id}: {e} - skipping push to be safe")
        import traceback
        logger.error(traceback.format_exc())
        return {
            'success': True,
            'skipped': True,
            'message': f'Tower check failed: {str(e)}'
        }
    
    # Get priority from metadata or use default
    priority = metadata.get('priority', 'normal')
    push_priority = 'high' if priority in ['high', 'urgent'] else 'default'
    
    # For notice notifications, use mobile-specific title and message
    if notification.entity_type == 'notice':
        push_title = metadata.get('mobile_title', notification.title)
        push_body = metadata.get('short_message', notification.message)
    else:
        push_title = notification.title
        push_body = metadata.get('short_message', notification.message)
    
    # Prepare data payload
    data = {
        'notificationId': notification.id,
        'type': notification.notification_type.code,
        'entityType': notification.entity_type,
        'entityId': notification.entity_id,
        'entity_type': notification.entity_type,
        'entity_id': notification.entity_id,
    }
    
    # Add entity-specific data
    if notification.entity_type == 'announcement':
        data['announcementId'] = notification.entity_id
        if 'announcement_status' in metadata:
            data['metadata'] = {
                'announcement_status': metadata.get('announcement_status'),
                'notification_type': metadata.get('notification_type'),
            }
    
    if notification.entity_type == 'bulletin':
        data['bulletinId'] = notification.entity_id
        if 'status' in metadata:
            data['metadata'] = {
                'bulletin_status': metadata.get('status'),
                'notification_type': notification.notification_type.code,
            }
    
    if notification.entity_type == 'notice':
        data['noticeId'] = notification.entity_id
        data['metadata'] = {
            'notice_title': metadata.get('notice_title', ''),
            'priority': metadata.get('priority', 'normal'),
            'label': metadata.get('label', ''),
            'notification_type': notification.notification_type.code,
        }
    
    # Get icon from notification type if available
    notification_icon = None
    if notification.notification_type and notification.notification_type.icon:
        # Use notification type icon (emoji) - for Expo, this can be passed in data
        notification_icon = notification.notification_type.icon
    
    # Send unified push notification
    try:
        result = send_unified_push_to_members(
            members=[notification.recipient],
            title=push_title,
            body=push_body,
            data=data,
            priority=push_priority,
            sound='default',
            icon=notification_icon
        )
        
        # Log if push failed
        if not result.get('success'):
            logger.error(f"Push failed for notification {notification.id}: {result.get('error', 'Unknown error')}")
        elif result.get('error_count', 0) > 0:
            logger.warning(f"Push partially failed for notification {notification.id}: {result.get('error_count')} errors")
        
        return result
    except Exception as e:
        logger.error(f"Exception sending push for notification {notification.id}: {str(e)}")
        import traceback
        logger.error(traceback.format_exc())
        return {
            'success': False,
            'error': f'Exception: {str(e)}'
        }


def send_unified_push_for_notifications(notifications: List[Notification]) -> Dict:
    """
    Send unified push notifications for multiple Notification objects
    Groups by recipient to avoid duplicate sends
    Supports both Expo and FCM tokens
    
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
        for notification in recipient_notifications:
            result = send_unified_push_for_notification(notification)
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
