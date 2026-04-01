"""
Firebase Cloud Messaging (FCM) service for sending push notifications
Uses single Firebase project: estatelink-9ac38 (Android + iOS)
"""
import logging
from typing import List, Dict, Optional
from django.conf import settings
from django.utils import timezone

logger = logging.getLogger(__name__)

# Try to import firebase_admin
try:
    import firebase_admin
    from firebase_admin import credentials, messaging
    FCM_AVAILABLE = True
except ImportError:
    FCM_AVAILABLE = False
    logger.warning("firebase-admin not installed. FCM functionality will be disabled.")


def initialize_fcm():
    """
    Initialize Firebase Admin SDK for estatelink-9ac38 (Android + iOS).
    Should be called once at Django startup.
    """
    if not FCM_AVAILABLE:
        logger.warning("FCM not available - firebase-admin not installed")
        return False

    try:
        firebase_admin.get_app()
        logger.info("Firebase Admin SDK (estatelink-9ac38) already initialized")
    except ValueError:
        fcm_credentials_path = getattr(settings, 'FCM_CREDENTIALS_PATH', None)
        if not fcm_credentials_path:
            logger.warning("FCM_CREDENTIALS_PATH not set. FCM will not be available.")
            return False
        try:
            cred = credentials.Certificate(fcm_credentials_path)
            firebase_admin.initialize_app(cred)
            logger.info("Firebase Admin SDK (estatelink-9ac38) initialized")
        except Exception as e:
            logger.error(f"Failed to initialize Firebase: {str(e)}")
            return False

    return True


def is_fcm_token(token: str) -> bool:
    """
    Check if a token is an FCM token (not Expo token)
    FCM tokens are typically longer and don't start with 'ExponentPushToken'
    """
    if not token:
        return False
    
    # Expo tokens start with 'ExponentPushToken[' or 'ExpoPushToken['
    if token.startswith('ExponentPushToken[') or token.startswith('ExpoPushToken['):
        return False
    
    # FCM tokens are typically base64-like strings, longer than Expo tokens
    # They don't have the ExponentPushToken prefix
    return True


def send_fcm_notification(
    token: str,
    title: str,
    body: str,
    data: Optional[Dict] = None,
    sound: str = 'default',
    priority: str = 'high',
    badge: Optional[int] = None,
    icon: Optional[str] = None
) -> Dict:
    """
    Send a single FCM push notification
    
    Args:
        token: FCM device token
        title: Notification title
        body: Notification body/message
        data: Optional data payload (dict)
        sound: Sound to play ('default' or None)
        priority: Priority level ('high' or 'normal')
        badge: Badge count (iOS only)
        icon: Optional icon name for Android notifications (e.g., 'notification_icon', 'ic_notification')
    
    Returns:
        Dict with 'success' (bool) and 'message_id' or 'error'
    """
    if not FCM_AVAILABLE:
        return {
            'success': False,
            'error': 'FCM not available - firebase-admin not installed'
        }
    
    # Ensure Firebase is initialized
    try:
        firebase_admin.get_app()
    except ValueError:
        if not initialize_fcm():
            return {
                'success': False,
                'error': 'Firebase Admin SDK not initialized'
            }
    
    try:
        # Build Android notification
        # AndroidNotification.priority: 'default', 'min', 'low', 'high', 'max'
        android_priority = 'high' if priority == 'high' else 'default'
        android_notification = messaging.AndroidNotification(
            title=title,
            body=body,
            sound=sound if sound else None,
            priority=android_priority,
            icon=icon if icon else None,  # Set custom icon if provided
        )
        
        # Build Android config
        android_config = messaging.AndroidConfig(
            priority='high' if priority == 'high' else 'normal',
            notification=android_notification,
        )
        
        # Build APNS config for iOS
        # apns-push-type: "alert" is required for iOS 13+ for user-visible notifications
        apns_config = messaging.APNSConfig(
            headers={
                'apns-priority': '10' if priority == 'high' else '5',
                'apns-push-type': 'alert',
            },
            payload=messaging.APNSPayload(
                aps=messaging.Aps(
                    alert=messaging.ApsAlert(
                        title=title,
                        body=body,
                    ),
                    sound=sound if sound else None,
                    badge=badge,
                )
            ),
        )
        
        # Convert all data values to strings (FCM requirement)
        # FCM data payload only accepts string values
        string_data = {}
        if data:
            for key, value in data.items():
                if value is None:
                    string_data[key] = ''
                elif isinstance(value, bool):
                    string_data[key] = 'true' if value else 'false'
                elif isinstance(value, (int, float)):
                    string_data[key] = str(value)
                elif isinstance(value, dict):
                    # Convert dict to JSON string
                    import json
                    string_data[key] = json.dumps(value)
                else:
                    string_data[key] = str(value)
        
        # Build the message
        message = messaging.Message(
            token=token,
            notification=messaging.Notification(
                title=title,
                body=body,
            ),
            data=string_data or {},
            android=android_config,
            apns=apns_config,
        )
        
        # Send the message
        response = messaging.send(message)
        
        logger.info(f"Successfully sent FCM notification: {response}")
        return {
            'success': True,
            'message_id': response,
            'token': token[:20] + '...'  # Log partial token for debugging
        }
    
    except Exception as e:
        error_str = str(e)
        logger.error(f"Error sending FCM notification: {error_str}")
        
        # Check for unregistered token
        if 'NOT_FOUND' in error_str or 'Requested entity was not found' in error_str:
            logger.warning(f"FCM token is unregistered: {token[:20]}...")
            return {
                'success': False,
                'error': 'Token unregistered',
                'should_remove': True
            }
        
        return {
            'success': False,
            'error': error_str
        }


def _build_fcm_message(token: str, title: str, body: str, data: Optional[Dict], sound: str,
                       priority: str, badge: Optional[int], icon: Optional[str]) -> 'messaging.Message':
    """Build a single FCM Message (shared by single and batch send)."""
    android_priority = 'high' if priority == 'high' else 'default'
    android_notification = messaging.AndroidNotification(
        title=title,
        body=body,
        sound=sound if sound else None,
        priority=android_priority,
        icon=icon if icon else None,
    )
    android_config = messaging.AndroidConfig(
        priority='high' if priority == 'high' else 'normal',
        notification=android_notification,
    )
    apns_config = messaging.APNSConfig(
        headers={
            'apns-priority': '10' if priority == 'high' else '5',
            'apns-push-type': 'alert',
        },
        payload=messaging.APNSPayload(
            aps=messaging.Aps(
                alert=messaging.ApsAlert(title=title, body=body),
                sound=sound if sound else None,
                badge=badge,
            )
        ),
    )
    string_data = {}
    if data:
        import json
        for key, value in data.items():
            if value is None:
                string_data[key] = ''
            elif isinstance(value, bool):
                string_data[key] = 'true' if value else 'false'
            elif isinstance(value, (int, float)):
                string_data[key] = str(value)
            elif isinstance(value, dict):
                string_data[key] = json.dumps(value)
            else:
                string_data[key] = str(value)
    return messaging.Message(
        token=token,
        notification=messaging.Notification(title=title, body=body),
        data=string_data or {},
        android=android_config,
        apns=apns_config,
    )


def _get_firebase_app():
    """Return the default Firebase app (estatelink-9ac38 for Android + iOS)."""
    return firebase_admin.get_app()


def send_fcm_notifications_batch(
    tokens: List[str],
    title: str,
    body: str,
    data: Optional[Dict] = None,
    sound: str = 'default',
    priority: str = 'high',
    badge: Optional[int] = None,
    icon: Optional[str] = None,
    token_platform_map: Optional[Dict[str, str]] = None,
) -> Dict:
    """
    Send FCM push notifications to multiple tokens using batch API.
    Uses single Firebase project estatelink-9ac38 for Android + iOS.

    Args:
        tokens: List of FCM device tokens
        title: Notification title
        body: Notification body/message
        data: Optional data payload (dict)
        sound: Sound to play
        priority: Priority level
        badge: Badge count
        icon: Optional icon name for Android notifications
        token_platform_map: Optional dict mapping token -> 'ios'|'android' (for logging).

    Returns:
        Dict with 'success' (bool), 'success_count', 'error_count', and 'results'
    """
    if not FCM_AVAILABLE:
        return {
            'success': False,
            'error': 'FCM not available - firebase-admin not installed',
            'success_count': 0,
            'error_count': len(tokens)
        }

    if not tokens:
        logger.warning("No tokens provided for FCM batch notification")
        return {
            'success': False,
            'error': 'No tokens provided',
            'success_count': 0,
            'error_count': 0
        }

    try:
        firebase_admin.get_app()
    except ValueError:
        if not initialize_fcm():
            return {
                'success': False,
                'error': 'Firebase Admin SDK not initialized',
                'success_count': 0,
                'error_count': len(tokens)
            }

    # Group tokens by Firebase app (platform)
    tokens_by_app: Dict[str, List[str]] = {'android': [], 'ios': []}
    for token in tokens:
        platform = (token_platform_map or {}).get(token, 'android')
        platform = 'ios' if str(platform).lower() == 'ios' else 'android'
        tokens_by_app[platform].append(token)

    BATCH_SIZE = 500
    results = []
    success_count = 0
    error_count = 0
    tokens_to_remove = []

    app = _get_firebase_app()
    try:
        for platform, platform_tokens in tokens_by_app.items():
            if not platform_tokens:
                continue
            logger.info(f"Sending FCM to {len(platform_tokens)} {platform} token(s) via estatelink-9ac38")

            for i in range(0, len(platform_tokens), BATCH_SIZE):
                batch_tokens = platform_tokens[i:i + BATCH_SIZE]
                messages = [
                    _build_fcm_message(token, title, body, data, sound, priority, badge, icon)
                    for token in batch_tokens
                ]
                batch_response = messaging.send_each(messages, dry_run=False, app=app)

                # Process responses
                for idx, response in enumerate(batch_response.responses):
                    token = batch_tokens[idx]
                    result = {
                        'token': token[:20] + '...',
                        'success': response.success
                    }

                    if response.success:
                        success_count += 1
                        result['message_id'] = response.message_id
                    else:
                        error_count += 1
                        result['error'] = response.exception.code if response.exception else 'Unknown error'

                        # Check if token should be removed
                        if response.exception:
                            error_code = getattr(response.exception, 'code', None)
                            if error_code in ['NOT_FOUND', 'INVALID_ARGUMENT', 'UNREGISTERED']:
                                tokens_to_remove.append(token)
                                result['should_remove'] = True

                    results.append(result)

        logger.info(f"Sent FCM batch: {success_count} successful, {error_count} failed out of {len(tokens)}")

        return {
            'success': True,
            'success_count': success_count,
            'error_count': error_count,
            'results': results,
            'tokens_to_remove': tokens_to_remove
        }

    except Exception as exc:
        logger.error(f"Error sending FCM batch notifications: {str(exc)}")
        return {
            'success': False,
            'error': str(exc),
            'success_count': success_count,
            'error_count': error_count + (len(tokens) - success_count - error_count),
            'results': results
        }
