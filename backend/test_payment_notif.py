import os
import django
import sys

os.environ.setdefault("DJANGO_SETTINGS_MODULE", "estate_link.settings")
django.setup()

from service_fee_management.models import ServiceFeePayment
from notifications.utils import create_service_fee_payment_received_notification

# find a payment paid from mobile
payment = ServiceFeePayment.objects.filter(service_status='paid').order_by('-id').first()

if payment:
    print(f"Testing with payment ID: {payment.id}, Unit: {payment.unit.unit_name}")
    try:
        notifs = create_service_fee_payment_received_notification(
            payment=payment,
            payment_amount=1000,
            payment_method="bkash",
            recorded_by=None,
            transaction_id=999999
        )
        print(f"Result logic returned: {len(notifs)} notifications.")
        for notif in notifs:
            print(f" - Notif {notif.id}: recipient={notif.recipient.id}, title='{notif.title}', channel='{notif.channel}'")
    except Exception as e:
        print(f"Exception during notification creation: {e}")
        import traceback
        traceback.print_exc()
else:
    print("No paid payment found")
