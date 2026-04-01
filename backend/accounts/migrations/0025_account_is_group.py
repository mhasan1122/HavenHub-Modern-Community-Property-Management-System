from django.db import migrations, models


def set_group_flags(apps, schema_editor):
    Account = apps.get_model('accounts', 'Account')
    parent_ids = list(
        Account.objects.filter(subAccounts__isnull=False)
        .values_list('id', flat=True)
        .distinct()
    )
    if parent_ids:
        Account.objects.filter(id__in=parent_ids).update(isGroup=True)
    Account.objects.filter(hasSubAccounts=True).update(isGroup=True)


class Migration(migrations.Migration):

    dependencies = [
        ('accounts', '0024_add_missing_voucherentry_fields'),
    ]

    operations = [
        migrations.AddField(
            model_name='account',
            name='isGroup',
            field=models.BooleanField(default=False),
        ),
        migrations.RunPython(set_group_flags, migrations.RunPython.noop),
    ]
