# Data migration to populate payment_result_status for existing payments
from django.db import migrations


def populate_payment_result_status(apps, schema_editor):
    """
    Populate payment_result_status for existing completed payments
    by analyzing the billing state at the time each payment was made - robust version
    """
    if schema_editor.connection.vendor != 'mysql':
        return
    
    try:
        from django.db import connection
        from collections import defaultdict
        
        # Use raw SQL to avoid issues with removed fields
        with connection.cursor() as cursor:
            # Check if payment table exists
            cursor.execute("""
                SELECT COUNT(*) 
                FROM information_schema.TABLES 
                WHERE TABLE_SCHEMA = DATABASE() 
                AND TABLE_NAME = 'service_fee_management_servicefeepayment'
            """)
            if cursor.fetchone()[0] == 0:
                print("Table service_fee_management_servicefeepayment does not exist, skipping")
                return
            
            # Check if payment_result_status column exists
            cursor.execute("""
                SELECT COUNT(*) 
                FROM information_schema.COLUMNS 
                WHERE TABLE_SCHEMA = DATABASE() 
                AND TABLE_NAME = 'service_fee_management_servicefeepayment'
                AND COLUMN_NAME = 'payment_result_status'
            """)
            if cursor.fetchone()[0] == 0:
                print("Column payment_result_status does not exist yet, skipping")
                return
            
            # Determine billing table name
            billing_table_names = ['service_fee_payment_details', 'service_fee_billings']
            billing_table = None
            for table_name in billing_table_names:
                cursor.execute("""
                    SELECT COUNT(*) 
                    FROM information_schema.TABLES 
                    WHERE TABLE_SCHEMA = DATABASE() 
                    AND TABLE_NAME = %s
                """, [table_name])
                if cursor.fetchone()[0] > 0:
                    billing_table = table_name
                    break
            
            if not billing_table:
                print("Billing table not found, skipping payment_result_status population")
                return
            
            # First, handle payments with billing
            cursor.execute(f"""
                SELECT 
                    p.id, 
                    p.amount, 
                    p.billing_id,
                    b.billing_amount
                FROM service_fee_management_servicefeepayment p
                LEFT JOIN {billing_table} b ON p.billing_id = b.id
                WHERE p.payment_status = 'completed'
                AND p.payment_result_status IS NULL
                AND p.billing_id IS NOT NULL
                ORDER BY p.billing_id, p.created_at
            """)
            
            payments_data = cursor.fetchall()
            
            # Group payments by billing
            billing_payments = defaultdict(list)
            billing_amounts = {}
            
            for payment_id, amount, billing_id, billing_amount in payments_data:
                billing_payments[billing_id].append((payment_id, float(amount)))
                billing_amounts[billing_id] = float(billing_amount) if billing_amount else 0
            
            # Process each billing's payments in chronological order
            for billing_id, payment_list in billing_payments.items():
                billing_amount = billing_amounts.get(billing_id, 0)
                if billing_amount == 0:
                    continue
                    
                # Track cumulative total as we process payments chronologically
                cumulative_total = 0
                
                for payment_id, payment_amount in payment_list:
                    try:
                        new_total = cumulative_total + payment_amount
                        
                        # Determine if this payment made it partial or full
                        if new_total >= billing_amount:
                            result_status = 'full'
                        else:
                            result_status = 'partial'
                        
                        cursor.execute("""
                            UPDATE service_fee_management_servicefeepayment
                            SET payment_result_status = %s
                            WHERE id = %s
                        """, [result_status, payment_id])
                        
                        # Update cumulative total for next iteration
                        cumulative_total = new_total
                    except Exception as e:
                        print(f"Error updating payment {payment_id}: {e}")
                        continue
            
            # Handle payments without billing (legacy data)
            try:
                cursor.execute("""
                    UPDATE service_fee_management_servicefeepayment
                    SET payment_result_status = 'full'
                    WHERE payment_status = 'completed'
                    AND payment_result_status IS NULL
                    AND (billing_id IS NULL OR billing_id = 0)
                """)
            except Exception as e:
                print(f"Error updating legacy payments: {e}")
    except Exception as e:
        print(f"Error in populate_payment_result_status: {e}")
        # Continue migration even if this fails


def reverse_populate(apps, schema_editor):
    """
    Reverse migration: clear payment_result_status - robust version
    """
    if schema_editor.connection.vendor != 'mysql':
        return
    
    try:
        ServiceFeePayment = apps.get_model('service_fee_management', 'ServiceFeePayment')
        ServiceFeePayment.objects.all().update(payment_result_status=None)
    except Exception as e:
        print(f"Error in reverse_populate: {e}")
        # Continue migration even if this fails


class Migration(migrations.Migration):

    dependencies = [
        ('service_fee_management', '0021_add_payment_result_status'),
    ]

    operations = [
        migrations.RunPython(populate_payment_result_status, reverse_populate),
    ]

