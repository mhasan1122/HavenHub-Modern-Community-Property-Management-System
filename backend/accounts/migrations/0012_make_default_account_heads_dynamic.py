# Generated manually for dynamic default account heads

from django.db import migrations, models


def populate_custom_labels(apps, schema_editor):
    """Populate customLabel for existing records"""
    DefaultAccountHead = apps.get_model('accounts', 'DefaultAccountHead')
    
    # Map old transaction types to their display labels
    type_labels = {
        'income': 'Income',
        'expense': 'Expense',
        'sales': 'Sales',
        'purchase': 'Purchase',
        'cash': 'Cash',
        'bank': 'Bank',
        'mfs': 'Mobile Financial Service (MFS)',
    }
    
    for obj in DefaultAccountHead.objects.all():
        obj.customLabel = type_labels.get(obj.transactionType, obj.transactionType.title())
        obj.save(update_fields=['customLabel'])


class Migration(migrations.Migration):

    dependencies = [
        ('accounts', '0011_add_default_account_head'),
    ]

    operations = [
        # Add the customLabel field (nullable first for existing data)
        migrations.AddField(
            model_name='defaultaccounthead',
            name='customLabel',
            field=models.CharField(help_text='Display name for this default account head', max_length=200, null=True, blank=True),
        ),
        # Populate customLabel for existing records
        migrations.RunPython(populate_custom_labels, migrations.RunPython.noop),
        # Make customLabel required
        migrations.AlterField(
            model_name='defaultaccounthead',
            name='customLabel',
            field=models.CharField(help_text='Display name for this default account head', max_length=200),
        ),
        # Remove choices constraint and increase max_length for transactionType
        migrations.AlterField(
            model_name='defaultaccounthead',
            name='transactionType',
            field=models.CharField(help_text='Type of financial transaction (can be custom)', max_length=100, unique=True),
        ),
    ]
