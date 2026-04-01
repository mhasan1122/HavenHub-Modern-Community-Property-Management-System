# Generated migration to update allocation_type from cash/waiver to debit/credit

from django.db import migrations


def update_allocation_types(apps, schema_editor):
    """Update existing allocation types from old to new terminology"""
    ServiceFeePaymentAllocation = apps.get_model('service_fee_management', 'ServiceFeePaymentAllocation')
    
    # Update 'cash' to 'debit'
    ServiceFeePaymentAllocation.objects.filter(allocation_type='cash').update(allocation_type='debit')
    
    # Update 'waiver' to 'credit'
    ServiceFeePaymentAllocation.objects.filter(allocation_type='waiver').update(allocation_type='credit')


def reverse_allocation_types(apps, schema_editor):
    """Reverse migration - change back to old terminology"""
    ServiceFeePaymentAllocation = apps.get_model('service_fee_management', 'ServiceFeePaymentAllocation')
    
    # Update 'debit' to 'cash'
    ServiceFeePaymentAllocation.objects.filter(allocation_type='debit').update(allocation_type='cash')
    
    # Update 'credit' to 'waiver'
    ServiceFeePaymentAllocation.objects.filter(allocation_type='credit').update(allocation_type='waiver')


class Migration(migrations.Migration):

    dependencies = [
        ('service_fee_management', '0099_alter_servicefeeitem_add_sql_defaults'),
    ]

    operations = [
        migrations.RunPython(update_allocation_types, reverse_allocation_types),
    ]
