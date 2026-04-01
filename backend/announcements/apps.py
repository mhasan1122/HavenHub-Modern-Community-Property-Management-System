from django.apps import AppConfig
import sys
import logging

logger = logging.getLogger(__name__)


class AnnouncementsConfig(AppConfig):
    default_auto_field = 'django.db.models.BigAutoField'
    name = 'announcements'
    
    def ready(self):
        """
        Start background scheduler when Django server runs and import signals
        """
        # Import signals to register them
        import announcements.signals
        
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
                    logger.info("✅ Announcement Status Scheduler initialized")
            except Exception as e:
                logger.error(f"❌ Failed to start announcement status scheduler: {e}", exc_info=True)
