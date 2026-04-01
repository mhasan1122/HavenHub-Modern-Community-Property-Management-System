from django.db import migrations

def fix_visa_method(apps, schema_editor):
    PaymentMethod = apps.get_model('service_fee_management', 'PaymentMethod')
    # Update Visa method (ID 9 or name 'Visa')
    PaymentMethod.objects.filter(method_name__iexact='Visa').update(
        method_type='card',
        account_name='Estate Link Management',
        account_number='9876543210987'
    )

def reverse_fix_visa_method(apps, schema_editor):
    PaymentMethod = apps.get_model('service_fee_management', 'PaymentMethod')
    # Revert to cash and NULLs if needed
    PaymentMethod.objects.filter(method_name__iexact='Visa').update(
        method_type='cash',
        account_name=None,
        account_number=None
    )

class Migration(migrations.Migration):

    dependencies = [
        ('service_fee_management', '0130_servicefeepayment_bill_number_and_more'),
    ]

    operations = [
        migrations.RunPython(fix_visa_method, reverse_fix_visa_method),
    ]
