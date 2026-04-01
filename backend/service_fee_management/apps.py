from django.apps import AppConfig
import sys
import logging
import os
import threading
import time

logger = logging.getLogger(__name__)

class ServiceFeeManagementConfig(AppConfig):
    default_auto_field = 'django.db.models.BigAutoField'
    name = 'service_fee_management'
    
    def ready(self):
        """
        Start background schedulers when Django server runs
        """
        # Detect common management commands and avoid running DB-modifying
        # startup logic (like populating payment methods) during those runs.
        management_commands = {
            'makemigrations', 'migrate', 'shell', 'createsuperuser',
            'collectstatic', 'test', 'check', 'showmigrations', 'sqlmigrate'
        }

        is_management_command = False
        if len(sys.argv) > 1:
            invoked = str(sys.argv[1]).lower()
            if invoked in management_commands:
                is_management_command = True
            else:
                # Fallback: check if any known command appears anywhere in argv
                joined = ' '.join(sys.argv[1:]).lower()
                is_management_command = any(cmd in joined for cmd in management_commands)

        # If we're running a management command (eg. `manage.py migrate`),
        # skip startup tasks that touch the DB or start background threads.
        if is_management_command:
            logger.info("[SKIP] Detected management command; skipping scheduler startup and DB population")
            return

        # Allow explicit disabling of schedulers via environment variable.
        # Set `SERVICE_FEE_SCHEDULER_ENABLED=off|false|0|no` to disable.
        scheduler_enabled = os.environ.get('SERVICE_FEE_SCHEDULER_ENABLED', 'true')
        if isinstance(scheduler_enabled, str) and scheduler_enabled.strip().lower() in ('false', '0', 'off', 'no'):
            logger.info('[SKIP] Service Fee schedulers disabled via SERVICE_FEE_SCHEDULER_ENABLED')
            return

        # Only start schedulers in the actual running process.
        # When using Django's autoreloader (`runserver`), the parent process
        # imports apps but the real server runs in the child process where
        # the env var `RUN_MAIN` is set to 'true'.
        should_start = (os.environ.get('RUN_MAIN') == 'true') or ('runserver' not in sys.argv)

        if should_start:
            # Defer database access until after app initialization is complete
            # to avoid RuntimeWarning about accessing DB during app init
            
            # Use a threading event to ensure we only run once
            init_done = threading.Event()
            
            def deferred_init():
                """Run initialization tasks after a short delay to avoid app init warnings"""
                if not init_done.is_set():
                    init_done.set()
                    try:
                        # 1. Populate payment methods on startup
                        self._populate_payment_methods()

                        # 2. Start service fee generation scheduler
                        # from .scheduler import start_service_fee_scheduler
                        # start_service_fee_scheduler()
                        # logger.info("[OK] Service Fee Generation Scheduler initialized")
                        # print("[OK] Service Fee Generation Scheduler initialized")

                        # 3. Start reminder scheduler
                        # from .reminder_scheduler import get_scheduler
                        # reminder_scheduler = get_scheduler()
                        # if not reminder_scheduler.running:
                        #     reminder_scheduler.start()
                        #     logger.info("[EMAIL] Reminder Scheduler initialized")
                        #     print("[EMAIL] Reminder Scheduler initialized")

                        # 4. Start penalty tier scheduler
                        from .penalty_tier_scheduler import start_penalty_tier_scheduler
                        start_penalty_tier_scheduler()
                        logger.info("[PENALTY] Penalty Tier Scheduler initialized")
                        print("[PENALTY] Penalty Tier Scheduler initialized")

                    except Exception as e:
                        logger.error(f"[ERROR] Failed to start schedulers: {e}", exc_info=True)
                        print(f"[ERROR] Failed to start schedulers: {e}")
            
            # Schedule the deferred initialization to run after a short delay (0.5s)
            # This ensures apps are fully loaded before DB access
            timer = threading.Timer(0.5, deferred_init)
            timer.daemon = True
            timer.start()
    
    def _populate_payment_methods(self):
        """
        Automatically populate payment methods on server startup
        Uses get_or_create to safely handle existing methods (idempotent)
        """
        from django.db import connection
        from django.db.utils import OperationalError
        
        # Check if database is ready
        try:
            connection.ensure_connection()
        except OperationalError:
            logger.warning("[SKIP] Database not ready; skipping payment method population")
            return
        
        try:
            from .models import PaymentMethod
            
            payment_methods = [
                {'method_name': 'Cash', 'display_order': 1, 'description': 'Cash payment'},
                # {'method_name': 'bKash', 'display_order': 2, 'description': 'bKash mobile financial service'},
                # {'method_name': 'Nagad', 'display_order': 3, 'description': 'Nagad mobile financial service'},
                # {'method_name': 'Rocket', 'display_order': 4, 'description': 'Rocket mobile financial service'},
                # {'method_name': 'Bank Transfer', 'display_order': 5, 'description': 'Bank transfer payment'},
                # {'method_name': 'SSLCommerz', 'display_order': 6, 'description': 'SSLCommerz payment gateway'},
            ]
            
            created_count = 0
            updated_count = 0
            for method_data in payment_methods:
                payment_method, created = PaymentMethod.objects.get_or_create(
                    method_name=method_data['method_name'],
                    defaults={
                        'display_order': method_data['display_order'],
                        'description': method_data.get('description', ''),
                        'is_active': True
                    }
                )
                
                if created:
                    created_count += 1
                else:
                    # Update existing method to ensure it has correct values
                    updated = False
                    if payment_method.display_order != method_data['display_order']:
                        payment_method.display_order = method_data['display_order']
                        updated = True
                    if payment_method.description != method_data.get('description', ''):
                        payment_method.description = method_data.get('description', '')
                        updated = True
                    if not payment_method.is_active:
                        payment_method.is_active = True
                        updated = True
                    if updated:
                        payment_method.save()
                        updated_count += 1
            
            if created_count > 0 or updated_count > 0:
                logger.info(f"[OK] Payment methods populated: {created_count} created, {updated_count} updated")
            else:
                logger.info(f"[OK] Payment methods already exist and are up to date")
                
        except Exception as e:
            logger.error(f"[ERROR] Failed to populate payment methods: {e}", exc_info=True)
