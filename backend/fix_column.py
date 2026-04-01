#!/usr/bin/env python
import os
import django

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'backend.settings')
django.setup()

from django.db import connection

print("=== Adding generation_config_id column ===\n")

with connection.cursor() as cursor:
    try:
        # Check if generation_config_id column already exists
        cursor.execute("""
            SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS 
            WHERE TABLE_NAME = 'service_fee_management_servicefeepayment' 
            AND COLUMN_NAME = 'generation_config_id'
        """)
        
        if cursor.fetchone():
            print("✓ Column 'generation_config_id' already exists")
        else:
            print("Step 1: Creating ServiceFeeGenerationConfig table...\n")
            
            # Create the table
            cursor.execute("""
                CREATE TABLE IF NOT EXISTS service_fee_management_servicefeegenerationconfig (
                    id BIGINT AUTO_INCREMENT PRIMARY KEY,
                    service_fee_id BIGINT NOT NULL,
                    year INT NOT NULL,
                    month INT NOT NULL,
                    fee_amount DECIMAL(15, 2) NOT NULL,
                    currency VARCHAR(3) DEFAULT 'BDT',
                    frequency VARCHAR(20) DEFAULT 'Monthly',
                    billing_cycle VARCHAR(20) DEFAULT 'Monthly',
                    due_day INT NOT NULL,
                    accepts_cash BOOLEAN DEFAULT FALSE,
                    accepts_mfs BOOLEAN DEFAULT FALSE,
                    accepts_bank BOOLEAN DEFAULT FALSE,
                    reminder_before_days INT DEFAULT 0,
                    reminder_after_days INT DEFAULT 0,
                    created_at DATETIME(6) DEFAULT CURRENT_TIMESTAMP(6),
                    UNIQUE KEY unique_config (service_fee_id, year, month),
                    CONSTRAINT fk_gen_config_service_fee 
                        FOREIGN KEY (service_fee_id) 
                        REFERENCES service_fee_servicefee(id) 
                        ON DELETE CASCADE
                )
            """)
            print("✓ ServiceFeeGenerationConfig table created\n")
            
            # Step 2: Add the column 
            print("Step 2: Adding generation_config_id column...")
            cursor.execute("""
                ALTER TABLE service_fee_management_servicefeepayment
                ADD COLUMN generation_config_id BIGINT NULL
            """)
            print("✓ Column added\n")
            
            # Step 3: Add the FK constraint
            print("Step 3: Adding foreign key constraint...")
            cursor.execute("""
                ALTER TABLE service_fee_management_servicefeepayment
                ADD FOREIGN KEY (generation_config_id) 
                REFERENCES service_fee_management_servicefeegenerationconfig(id) 
                ON DELETE SET NULL
            """)
            print("✓ Foreign key added")
            
    except Exception as e:
        print(f"✗ Error: {e}")
        import traceback
        traceback.print_exc()

print("\n=== Final Verification ===\n")

with connection.cursor() as cursor:
    cursor.execute("""
        SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS 
        WHERE TABLE_NAME = 'service_fee_management_servicefeepayment' 
        AND COLUMN_NAME = 'generation_config_id'
    """)
    
    if cursor.fetchone():
        print("✅ Column 'generation_config_id' successfully added!")
        print("\n✅ ServiceFeePayment can now reference ServiceFeeGenerationConfig")
        print("✅ Ready to run service fee generation!")
    else:
        print("❌ Column still missing!")
