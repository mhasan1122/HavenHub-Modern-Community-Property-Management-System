import os, django
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'backend.settings')
django.setup()

from service_fee_management.models import ServiceFeePayment, ServiceFeeBilling

p = ServiceFeePayment.objects.get(id=1)
billings = list(ServiceFeeBilling.objects.filter(servicefeepaymentid=p))
total_paid = sum(b.total_paid for b in billings)

print(f'December 2025 Payment (ID: {p.id}):')
print(f'  Base: ৳{p.base_service_amount}')
print(f'  Additional: ৳{p.additional_bill_charges}')
print(f'  Penalty: ৳{p.penalty_amount}')
print(f'  Total: ৳{p.amount}')
print(f'  Paid: ৳{total_paid}')
print(f'  Remaining: ৳{p.remaining_amount}')
print(f'  % Paid: {int(total_paid / p.amount * 100)}%')
