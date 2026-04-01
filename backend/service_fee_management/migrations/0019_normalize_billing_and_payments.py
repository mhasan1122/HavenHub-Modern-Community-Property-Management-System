# Generated migration for normalizing service fee billing and payment structure
from django.db import migrations, models
import django.db.models.deletion
import django.core.validators
from django.conf import settings


def create_billing_table_if_not_exists(apps, schema_editor):
    """Create service_fee_billings table if it doesn't exist - robust version"""
    if schema_editor.connection.vendor != 'mysql':
        return
    
    try:
        from django.db import connection
        
        with connection.cursor() as cursor:
            # Check if table exists (check both possible names)
            cursor.execute("""
                SELECT COUNT(*) 
                FROM information_schema.TABLES 
                WHERE TABLE_SCHEMA = DATABASE() 
                AND TABLE_NAME IN ('service_fee_billings', 'service_fee_payment_details')
            """)
            exists = cursor.fetchone()[0]
            
            if not exists:
                # Create the table
                try:
                    cursor.execute("""
                        CREATE TABLE service_fee_billings (
                            id BIGINT AUTO_INCREMENT PRIMARY KEY,
                            billing_id VARCHAR(100) UNIQUE NOT NULL,
                            billing_amount DECIMAL(10, 2) NOT NULL,
                            total_paid DECIMAL(10, 2) DEFAULT 0 NOT NULL,
                            remaining_amount DECIMAL(10, 2) NOT NULL,
                            currency VARCHAR(3) DEFAULT 'BDT',
                            service_period_month INT NOT NULL,
                            service_period_year INT NOT NULL,
                            service_status VARCHAR(20) DEFAULT 'due',
                            due_date DATE NOT NULL,
                            created_at DATETIME(6) NOT NULL,
                            updated_at DATETIME(6) NOT NULL,
                            created_by_id BIGINT NULL,
                            resident_id BIGINT NULL,
                            service_fee_id BIGINT NOT NULL,
                            unit_id BIGINT NOT NULL,
                            updated_by_id BIGINT NULL,
                            FOREIGN KEY (created_by_id) REFERENCES user_member(id),
                            FOREIGN KEY (resident_id) REFERENCES user_member(id),
                            FOREIGN KEY (service_fee_id) REFERENCES service_fee_servicefee(id),
                            FOREIGN KEY (unit_id) REFERENCES towers_unit(id),
                            FOREIGN KEY (updated_by_id) REFERENCES user_member(id)
                        )
                    """)
                    print("Created service_fee_billings table")
                except Exception as e:
                    print(f"Error creating service_fee_billings table (may already exist): {e}")
            else:
                print("Table service_fee_billings or service_fee_payment_details already exists, skipping creation")
    except Exception as e:
        print(f"Error in create_billing_table_if_not_exists: {e}")
        # Continue migration even if this fails


def reverse_create_billing_table(apps, schema_editor):
    """Drop service_fee_billings table if it exists"""
    from django.db import connection
    
    with connection.cursor() as cursor:
        cursor.execute("DROP TABLE IF EXISTS service_fee_billings")


def add_receipt_id_if_not_exists(apps, schema_editor):
    """Add receipt_id field to ServiceFeePayment table if it doesn't exist"""
    from django.db import connection
    
    with connection.cursor() as cursor:
        # Determine the actual table name
        cursor.execute("""
            SELECT TABLE_NAME 
            FROM information_schema.TABLES 
            WHERE TABLE_SCHEMA = DATABASE() 
            AND TABLE_NAME IN ('service_fee_payments', 'service_fee_management_servicefeepayment')
            LIMIT 1
        """)
        result = cursor.fetchone()
        if not result:
            return  # Table doesn't exist yet, skip
        
        table_name = result[0]
        
        # Check if column exists
        cursor.execute("""
            SELECT COUNT(*) 
            FROM information_schema.COLUMNS 
            WHERE TABLE_SCHEMA = DATABASE() 
            AND TABLE_NAME = %s 
            AND COLUMN_NAME = 'receipt_id'
        """, [table_name])
        exists = cursor.fetchone()[0]
        
        if not exists:
            cursor.execute(f"""
                ALTER TABLE {table_name} 
                ADD COLUMN receipt_id VARCHAR(100) NULL UNIQUE
            """)


def add_billing_fk_if_not_exists(apps, schema_editor):
    """Add billing_id foreign key to ServiceFeePayment table if it doesn't exist"""
    from django.db import connection
    
    with connection.cursor() as cursor:
        # Determine the actual ServiceFeePayment table name
        cursor.execute("""
            SELECT TABLE_NAME 
            FROM information_schema.TABLES 
            WHERE TABLE_SCHEMA = DATABASE() 
            AND TABLE_NAME IN ('service_fee_payments', 'service_fee_management_servicefeepayment')
            LIMIT 1
        """)
        payment_table_result = cursor.fetchone()
        if not payment_table_result:
            return  # Payment table doesn't exist yet, skip
        
        payment_table_name = payment_table_result[0]
        
        # Check if column exists
        cursor.execute("""
            SELECT COUNT(*) 
            FROM information_schema.COLUMNS 
            WHERE TABLE_SCHEMA = DATABASE() 
            AND TABLE_NAME = %s 
            AND COLUMN_NAME = 'billing_id'
        """, [payment_table_name])
        exists = cursor.fetchone()[0]
        
        if not exists:
            # First check if the billing table exists
            cursor.execute("""
                SELECT COUNT(*) 
                FROM information_schema.TABLES 
                WHERE TABLE_SCHEMA = DATABASE() 
                AND TABLE_NAME IN ('service_fee_billings', 'service_fee_payment_details')
            """)
            billing_table_exists = cursor.fetchone()[0]
            
            if billing_table_exists:
                # Find the actual billing table name
                cursor.execute("""
                    SELECT TABLE_NAME 
                    FROM information_schema.TABLES 
                    WHERE TABLE_SCHEMA = DATABASE() 
                    AND TABLE_NAME IN ('service_fee_billings', 'service_fee_payment_details')
                    LIMIT 1
                """)
                billing_table_name = cursor.fetchone()[0]
                
                # Add the column first
                cursor.execute(f"""
                    ALTER TABLE {payment_table_name} 
                    ADD COLUMN billing_id BIGINT NULL
                """)
                
                # Then add the foreign key constraint separately
                try:
                    cursor.execute(f"""
                        ALTER TABLE {payment_table_name} 
                        ADD CONSTRAINT fk_billing_id 
                        FOREIGN KEY (billing_id) REFERENCES {billing_table_name}(id)
                    """)
                except Exception as e:
                    # If foreign key creation fails, it's okay - it might already exist or will be added later
                    print(f"Warning: Could not add foreign key: {e}")


def reverse_fields(apps, schema_editor):
    """Reverse the field additions"""
    from django.db import connection
    
    with connection.cursor() as cursor:
        # Determine the actual ServiceFeePayment table name
        cursor.execute("""
            SELECT TABLE_NAME 
            FROM information_schema.TABLES 
            WHERE TABLE_SCHEMA = DATABASE() 
            AND TABLE_NAME IN ('service_fee_payments', 'service_fee_management_servicefeepayment')
            LIMIT 1
        """)
        result = cursor.fetchone()
        if not result:
            return  # Table doesn't exist, nothing to reverse
        
        table_name = result[0]
        
        # Drop billing_id column if exists
        cursor.execute("""
            SELECT COUNT(*) 
            FROM information_schema.COLUMNS 
            WHERE TABLE_SCHEMA = DATABASE() 
            AND TABLE_NAME = %s 
            AND COLUMN_NAME = 'billing_id'
        """, [table_name])
        if cursor.fetchone()[0]:
            # Find and drop the foreign key constraint first
            cursor.execute(f"""
                SELECT CONSTRAINT_NAME 
                FROM information_schema.KEY_COLUMN_USAGE 
                WHERE TABLE_SCHEMA = DATABASE() 
                AND TABLE_NAME = %s 
                AND COLUMN_NAME = 'billing_id'
                AND REFERENCED_TABLE_NAME IS NOT NULL
            """, [table_name])
            fk_result = cursor.fetchone()
            if fk_result:
                cursor.execute(f"ALTER TABLE {table_name} DROP FOREIGN KEY {fk_result[0]}")
            cursor.execute(f"ALTER TABLE {table_name} DROP COLUMN billing_id")
        
        # Drop receipt_id column if exists
        cursor.execute("""
            SELECT COUNT(*) 
            FROM information_schema.COLUMNS 
            WHERE TABLE_SCHEMA = DATABASE() 
            AND TABLE_NAME = %s 
            AND COLUMN_NAME = 'receipt_id'
        """, [table_name])
        if cursor.fetchone()[0]:
            cursor.execute(f"ALTER TABLE {table_name} DROP COLUMN receipt_id")


class Migration(migrations.Migration):

    dependencies = [
        ('service_fee_management', '0018_add_original_remaining_amount_fields'),
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
        ('user', '0002_delete_mymodel'),  # Explicitly reference 0002 instead of __latest__ to avoid dependency conflicts
        ('towers', '0011_alter_owner_unique_together_delete_vehicle'),  # Explicitly reference 0011 (last migration before 0012/0013)
        ('service_fee', '0015_alter_servicefee_service_fee_date'),  # Explicitly reference 0015 instead of __latest__
    ]

    operations = [
        migrations.SeparateDatabaseAndState(
            database_operations=[
                migrations.RunPython(create_billing_table_if_not_exists, reverse_create_billing_table),
                migrations.RunPython(add_receipt_id_if_not_exists, reverse_fields),
                migrations.RunPython(add_billing_fk_if_not_exists, reverse_fields),
            ],
            state_operations=[
                # Step 1: Create ServiceFeeBilling model
                migrations.CreateModel(
                    name='ServiceFeeBilling',
                    fields=[
                        ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                        ('billing_id', models.CharField(help_text='Unique billing identifier (e.g., BILL-2024-01-00001)', max_length=100, unique=True)),
                        ('billing_amount', models.DecimalField(decimal_places=2, help_text='Original billing amount for the period', max_digits=10, validators=[django.core.validators.MinValueValidator(0)])),
                        ('total_paid', models.DecimalField(decimal_places=2, default=0, help_text='Total amount paid so far', max_digits=10, validators=[django.core.validators.MinValueValidator(0)])),
                        ('remaining_amount', models.DecimalField(decimal_places=2, help_text='Remaining amount to be paid', max_digits=10, validators=[django.core.validators.MinValueValidator(0)])),
                        ('currency', models.CharField(default='BDT', max_length=3)),
                        ('service_period_month', models.IntegerField(help_text='Month for which service fee is billed (1-12)')),
                        ('service_period_year', models.IntegerField(help_text='Year for which service fee is billed')),
                        ('service_status', models.CharField(choices=[('due', 'Due'), ('partial', 'Partial'), ('paid', 'Paid'), ('overdue', 'Overdue')], default='due', max_length=20)),
                        ('due_date', models.DateField(help_text='Service fee due date')),
                        ('created_at', models.DateTimeField(auto_now_add=True)),
                        ('updated_at', models.DateTimeField(auto_now=True)),
                        ('created_by', models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='created_billings', to='user.member')),
                        ('resident', models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='service_fee_billings', to='user.member')),
                        ('service_fee', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='billings', to='service_fee.servicefee')),
                        ('unit', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='service_fee_billings', to='towers.unit')),
                        ('updated_by', models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='updated_billings', to='user.member')),
                    ],
                    options={
                        'db_table': 'service_fee_billings',
                        'ordering': ['-created_at'],
                    },
                ),
                
                # Step 2: Add unique constraint to ServiceFeeBilling
                migrations.AddConstraint(
                    model_name='servicefeebilling',
                    constraint=models.UniqueConstraint(fields=('unit', 'service_period_month', 'service_period_year', 'service_fee'), name='unique_billing_per_month'),
                ),
                
                # Step 3: Add receipt_id field to ServiceFeePayment
                migrations.AddField(
                    model_name='servicefeepayment',
                    name='receipt_id',
                    field=models.CharField(help_text='Unique receipt identifier (e.g., RCP-2024-01-00001)', max_length=100, null=True, blank=True, unique=True),
                ),
                
                # Step 4: Add billing foreign key to ServiceFeePayment (nullable for now)
                migrations.AddField(
                    model_name='servicefeepayment',
                    name='billing',
                    field=models.ForeignKey(blank=True, help_text='Related billing record', null=True, on_delete=django.db.models.deletion.CASCADE, related_name='payments', to='service_fee_management.servicefeebilling'),
                ),
            ],
        ),
    ]

