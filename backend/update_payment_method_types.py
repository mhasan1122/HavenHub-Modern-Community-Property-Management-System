import os
import django

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'backend.settings')
django.setup()

from service_fee_management.models import PaymentMethod

def update_types():
    mappings = {
        'Cash': 'cash',
        'bKash': 'mfs',
        'Nagad': 'mfs',
        'Rocket': 'mfs',
        'Bank Transfer': 'bank',
        'SSLCommerz': 'card', # Assuming card as it's a gateway
    }
    
    for name, mtype in mappings.items():
        pm = PaymentMethod.objects.filter(method_name=name).first()
        if pm:
            pm.method_type = mtype
            pm.save()
            print(f"Updated {name} to {mtype}")
        else:
            print(f"Payment method {name} not found")

if __name__ == '__main__':
    update_types()
