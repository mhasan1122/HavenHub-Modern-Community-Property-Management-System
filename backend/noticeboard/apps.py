from django.apps import AppConfig
import sys
import logging

logger = logging.getLogger(__name__)


class NoticeboardConfig(AppConfig):
    default_auto_field = 'django.db.models.BigAutoField'
    name = 'noticeboard'
    
    def ready(self):
        """
        Start background scheduler when Django server runs and import signals
        """
        # Import signals to register them
        import noticeboard.signals
        
        is_management_command = any(cmd in sys.argv for cmd in [
            'makemigrations', 'migrate', 'shell', 'createsuperuser', 
            'collectstatic', 'test', 'check', 'showmigrations', 'sqlmigrate'
        ])
        
        if not is_management_command:
            try:
                from .scheduler import get_scheduler
                
                scheduler = get_scheduler()
                
                if not scheduler.running:
                    scheduler.start()
                    logger.info("✅ Notice Status Scheduler initialized")
            except Exception as e:
                logger.error(f"❌ Failed to start notice status scheduler: {e}", exc_info=True)
