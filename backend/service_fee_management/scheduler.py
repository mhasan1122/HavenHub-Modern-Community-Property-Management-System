import logging
from service_fee_management.utils.service_fee_generator import generate_all_missing_months

logger = logging.getLogger(__name__)

# Keep track of last run to avoid duplicates
_last_run_time = None

def monthly_service_fee_scheduler():
    """
    Background thread: Automatically generates all missing service fee months
    - Runs every 5 seconds
    - Generates all missing months from service fee start date to current month
    - Skips already generated months automatically
    """
    global _last_run_time

    logger.info("[ServiceFeeScheduler] 🚀 Auto-Generator Started")
    logger.info("[ServiceFeeScheduler] Will check every 5 seconds for missing service fees")
    
    while True:
        now = datetime.now()
        
        # Run every 5 seconds (or on first run)
        should_run = (
            _last_run_time is None or 
            (now - _last_run_time).total_seconds() >= 5  # 5 seconds
        )
        
        if should_run:
            try:
                logger.info(f"\n[ServiceFeeScheduler] 🔍 Checking for missing service fees at {now.strftime('%Y-%m-%d %H:%M:%S')}")
                
                with transaction.atomic():
                    # Generate all missing months from service start to current month
                    # This will automatically handle:
                    # - New service fees that were just created
                    # - New months that need to be generated
                    # - Skip already generated months
                    result = generate_all_missing_months(
                        from_month=None,  # Will use earliest service fee date
                        from_year=None,
                        to_month=now.month,  # Current month
                        to_year=now.year,
                        force_regenerate=False
                    )
                    
                    if result['success']:
                        if result['total_created'] > 0:
                            logger.info(f"[ServiceFeeScheduler] ✅ Generated {result['total_created']} new service fee records")
                            logger.info(f"   Months processed: {result['months_generated']}")
                        else:
                            # Too noisy for heartbeat
                            # logger.info(f"[ServiceFeeScheduler] ✓ All service fees up to date (checked {result['months_generated']} months)")
                            pass
                    else:
                        logger.error(f"[ServiceFeeScheduler] ❌ Error: {result.get('error', 'Unknown error')}")
                    
                    _last_run_time = now
                    
            except Exception as e:
                logger.error(f"[ServiceFeeScheduler] ❌ Error: {e}")
                import traceback
                traceback.print_exc()

        time.sleep(5)  # Check every 5 seconds
        

def start_service_fee_scheduler():
    """
    Start scheduler thread only once per process
    """
    # if not getattr(start_service_fee_scheduler, '_started', False):
    #     print("[ServiceFeeScheduler] Starting auto-generation scheduler...")
    #     t = threading.Thread(target=monthly_service_fee_scheduler, daemon=True)
    #     t.start()
    #     start_service_fee_scheduler._started = True

