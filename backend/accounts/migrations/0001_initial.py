from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    initial = True

    dependencies = [
        ('user', '0002_delete_mymodel'),
    ]

    operations = [
        migrations.CreateModel(
            name='Account',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('accountCode', models.CharField(max_length=20, unique=True)),
                ('accountName', models.CharField(max_length=255)),
                ('description', models.TextField(blank=True, null=True)),
                ('accountType', models.CharField(choices=[('asset', 'Asset'), ('liability', 'Liability'), ('equity', 'Equity'), ('revenue', 'Revenue'), ('expense', 'Expense')], default='expense', max_length=20)),
                ('currentBalance', models.DecimalField(decimal_places=2, default=0, max_digits=15)),
                ('isActive', models.BooleanField(default=True)),
                ('isSystemAccount', models.BooleanField(default=False)),
                ('hasSubAccounts', models.BooleanField(default=False)),
                ('createdAt', models.DateTimeField(auto_now_add=True)),
                ('updatedAt', models.DateTimeField(auto_now=True)),
                ('createdBy', models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='created_accounts', to='user.member')),
                ('parentAccount', models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='subAccounts', to='accounts.account')),
                ('updatedBy', models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='updated_accounts', to='user.member')),
            ],
            options={
                'ordering': ['accountCode'],
            },
        ),
        migrations.AddIndex(
            model_name='account',
            index=models.Index(fields=['accountCode'], name='chart_of_ac_account_6f8d8e_idx'),
        ),
        migrations.AddIndex(
            model_name='account',
            index=models.Index(fields=['isActive'], name='chart_of_ac_isActiv_3k9e5c_idx'),
        ),
        migrations.AddIndex(
            model_name='account',
            index=models.Index(fields=['accountType'], name='chart_of_ac_account_8m2l9n_idx'),
        ),
    ]
