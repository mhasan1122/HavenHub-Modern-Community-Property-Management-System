from django.apps import AppConfig
import logging

logger = logging.getLogger(__name__)


class NotificationsConfig(AppConfig):
    default_auto_field = 'django.db.models.BigAutoField'
    name = 'notifications'
    
    def ready(self):
        """
        Initialize FCM when Django starts if FCM is enabled
        """
        from django.conf import settings
        
        # Only initialize FCM if enabled in settings
        fcm_enabled = getattr(settings, 'FCM_ENABLED', False)
        
        if fcm_enabled:
            try:
                from .fcm_service import initialize_fcm
                if initialize_fcm():
                    logger.info("✅ FCM initialized successfully on Django startup")
                else:
                    logger.warning("⚠️ FCM initialization failed - check FCM_CREDENTIALS_PATH in settings")
            except Exception as e:
                logger.error(f"❌ Error initializing FCM: {str(e)}")
        else:
            logger.info("ℹ️ FCM is disabled (FCM_ENABLED=False). Only Expo Push API will be used.")
