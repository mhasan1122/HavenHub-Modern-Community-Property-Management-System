from django.core.management.base import BaseCommand
import time
import signal
import sys
from service_fee_management.reminder_scheduler import ReminderScheduler

class Command(BaseCommand):
    help = 'Runs the Service Fee Reminder Scheduler'

    def handle(self, *args, **options):
        # Force flush stdout to ensure visible output
        self.stdout.write(self.style.SUCCESS('🚀 Starting Service Fee Reminder Scheduler...'))
        self.stdout.flush()
        print("Checking every 5 seconds...", flush=True)
        
        try:
            scheduler = ReminderScheduler()
            scheduler.start()
            
            # Keep main thread alive
            print("✅ Scheduler running. Press Ctrl+C to stop.", flush=True)
            while True:
                time.sleep(1)
                
        except KeyboardInterrupt:
            self.stdout.write(self.style.WARNING('\nStopping scheduler...'))
            scheduler.stop()
            self.stdout.write(self.style.SUCCESS('Scheduler stopped successfully'))
