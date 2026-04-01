import threading
import logging
from datetime import datetime
from apscheduler.schedulers.background import BackgroundScheduler
from apscheduler.triggers.cron import CronTrigger
from django.core.management import call_command

logger = logging.getLogger(__name__)

# Global scheduler instance
_penalty_tier_scheduler = None
_scheduler_lock = threading.Lock()


def run_penalty_tier_update():
    """
    Background job: Update penalty tiers for all overdue payments
    Called daily at 12:00 PM (noon)
    """
    try:
        logger.info("[PenaltyTierScheduler] 🔄 Starting penalty tier update...")
        # print(f"\n[PenaltyTierScheduler] 🔄 Starting penalty tier update at {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
        
        # Run the management command
        call_command('update_penalty_tiers')
        
        logger.info("[PenaltyTierScheduler] ✅ Penalty tier update completed successfully")
        # print("[PenaltyTierScheduler] ✅ Penalty tier update completed\n")
        
    except Exception as e:
        logger.error(f"[PenaltyTierScheduler] ❌ Error during penalty tier update: {str(e)}", exc_info=True)
        print(f"[PenaltyTierScheduler] ❌ Error during penalty tier update: {str(e)}\n")


def start_penalty_tier_scheduler():
    """
    Start the penalty tier scheduler as a background daemon thread
    Runs daily at 12:00 PM (noon)
    """
    global _penalty_tier_scheduler
    
    with _scheduler_lock:
        # Only start if not already running
        if _penalty_tier_scheduler is not None and _penalty_tier_scheduler.running:
            logger.info("[PenaltyTierScheduler] Already running; skipping restart")
            return
        
        try:
            _penalty_tier_scheduler = BackgroundScheduler(daemon=True)
            
            # Schedule for daily run at midnight instead of every minute to reduce dev spam
            _penalty_tier_scheduler.add_job(
                run_penalty_tier_update,
                trigger=CronTrigger(hour=0, minute=0),
                id='penalty_tier_update',
                name='Daily Penalty Tier Update',
                replace_existing=True,
                max_instances=1  # Prevent concurrent executions
            )
            
            _penalty_tier_scheduler.start()
            
            logger.info("[PenaltyTierScheduler] ✅ Penalty tier scheduler started (Scheduled for daily at 00:00)")
            # print("[PenaltyTierScheduler] ✅ Penalty tier scheduler started (running every minute for testing)")
            # print("[PenaltyTierScheduler] 📅 Next run will be at the start of the next minute")
            
        except Exception as e:
            logger.error(f"[PenaltyTierScheduler] ❌ Failed to start scheduler: {str(e)}", exc_info=True)
            print(f"[PenaltyTierScheduler] ❌ Failed to start scheduler: {str(e)}")
            raise


def stop_penalty_tier_scheduler():
    """
    Stop the penalty tier scheduler (called on Django shutdown)
    """
    global _penalty_tier_scheduler
    
    with _scheduler_lock:
        if _penalty_tier_scheduler is not None and _penalty_tier_scheduler.running:
            try:
                _penalty_tier_scheduler.shutdown()
                logger.info("[PenaltyTierScheduler] ✅ Penalty tier scheduler stopped")
                print("[PenaltyTierScheduler] ✅ Penalty tier scheduler stopped")
            except Exception as e:
                logger.error(f"[PenaltyTierScheduler] ❌ Error stopping scheduler: {str(e)}", exc_info=True)
            
            _penalty_tier_scheduler = None
