# Generated manually for bill_categories

from django.db import migrations, models


class Migration(migrations.Migration):

    initial = True

    dependencies = [
    ]

    operations = [
        migrations.CreateModel(
            name='BillCategory',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('name', models.CharField(help_text='Name of the bill category (e.g., Electricity, Gas, Water)', max_length=100, unique=True)),
                ('description', models.TextField(help_text='Brief description of this bill category')),
                ('icon', models.CharField(choices=[('zap', 'Electricity'), ('flame', 'Gas'), ('droplet', 'Water'), ('wifi', 'Internet'), ('trash', 'Waste')], default='zap', help_text='Icon representing this category', max_length=20)),
                ('color', models.CharField(choices=[('orange', 'Orange'), ('red', 'Red'), ('blue', 'Blue'), ('purple', 'Purple'), ('green', 'Green'), ('teal', 'Teal')], default='teal', help_text='Color theme for this category', max_length=20)),
                ('is_active', models.BooleanField(default=True, help_text='Whether this category is currently active')),
                ('created_at', models.DateTimeField(auto_now_add=True, help_text='Date and time when this category was created')),
                ('updated_at', models.DateTimeField(auto_now=True, help_text='Date and time when this category was last updated')),
            ],
            options={
                'verbose_name': 'Bill Category',
                'verbose_name_plural': 'Bill Categories',
                'db_table': 'bill_category',
                'ordering': ['-created_at'],
            },
        ),
        migrations.AddIndex(
            model_name='billcategory',
            index=models.Index(fields=['is_active'], name='bill_cat_active_idx'),
        ),
        migrations.AddIndex(
            model_name='billcategory',
            index=models.Index(fields=['created_at'], name='bill_cat_created_idx'),
        ),
    ]
