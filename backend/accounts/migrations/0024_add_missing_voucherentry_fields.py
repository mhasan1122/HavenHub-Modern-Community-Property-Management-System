from django.db import migrations, models
import django.db.models.deletion

class Migration(migrations.Migration):

    dependencies = [
        ('accounts', '0023_add_tracking_fields_to_vouchers'),
        ('towers', '0025_floor_towers_floo_tower_i_35871b_idx_and_more'),
    ]

    operations = [
        migrations.SeparateDatabaseAndState(
            state_operations=[],
            database_operations=[
                migrations.AddField(
                    model_name='voucherentry',
                    name='account_holder_id',
                    field=models.PositiveBigIntegerField(blank=True, null=True),
                ),
                migrations.AddField(
                    model_name='voucherentry',
                    name='account_holder_type',
                    field=models.CharField(blank=True, choices=[('resident', 'Resident'), ('owner', 'Owner')], max_length=20, null=True),
                ),
                migrations.AddField(
                    model_name='voucherentry',
                    name='unit',
                    field=models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='voucher_entries', to='towers.unit'),
                ),
                migrations.AddIndex(
                    model_name='voucherentry',
                    index=models.Index(fields=['unit'], name='accounts_vo_unit_id_d83f42_idx'),
                ),
                migrations.AddIndex(
                    model_name='voucherentry',
                    index=models.Index(fields=['account_holder_type', 'account_holder_id'], name='accounts_vo_account_534eab_idx'),
                ),
            ],
        ),
    ]
