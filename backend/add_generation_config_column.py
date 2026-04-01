#!/usr/bin/env python
import os
import django

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'backend.settings')
django.setup()

from django.db import connection

print("=== Adding generation_config_id column manually ===\n")

with connection.cursor() as cursor:
    try:
        # Check if column already exists
        cursor.execute("""
            SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS 
            WHERE TABLE_NAME = 'service_fee_management_servicefeepayment' 
            AND COLUMN_NAME = 'generation_config_id'
        """)
        
        if cursor.fetchone():
            print("✓ Column 'generation_config_id' already exists")
        else:
            print("Adding column 'generation_config_id'...\n")
            
            # First, create the ServiceFeeGenerationConfig table if it doesn't exist
            cursor.execute("""
                SELECT TABLE_NAME FROM INFORMATION_SCHEMA.TABLES 
                WHERE TABLE_NAME = 'service_fee_management_servicefeegenerationconfig'
            """)
            
            if not cursor.fetchone():
                print("Creating ServiceFeeGenerationConfig table...")
                cursor.execute("""
                    CREATE TABLE service_fee_management_servicefeegenerationconfig (
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
                        created_at DATETIME(6) AUTO_ON_ADD,
                        UNIQUE KEY unique_config (service_fee_id, year, month),
                        FOREIGN KEY (service_fee_id) REFERENCES service_fee_servicefee(id) ON DELETE CASCADE
                    )
                """)
                print("✓ ServiceFeeGenerationConfig table created")
            
            # Now add the generation_config_id column to ServiceFeePayment
            cursor.execute("""
                ALTER TABLE service_fee_management_servicefeepayment
                ADD COLUMN generation_config_id BIGINT NULL,
                ADD FOREIGN KEY (generation_config_id) 
                REFERENCES service_fee_management_servicefeegenerationconfig(id) 
                ON DELETE SET NULL
            """)
            print("✓ Column 'generation_config_id' added to ServiceFeePayment")
            print("✓ Foreign key constraint added")
            
    except Exception as e:
        print(f"✗ Error: {e}")
        import traceback
        traceback.print_exc()

print("\n=== Verification ===\n")

with connection.cursor() as cursor:
    cursor.execute("""
        SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS 
        WHERE TABLE_NAME = 'service_fee_management_servicefeepayment' 
        ORDER BY ORDINAL_POSITION
    """)
    
    columns = [row[0] for row in cursor.fetchall()]
    
    if 'generation_config_id' in columns:
        print("✅ Column successfully added!")
        print(f"Total columns in ServiceFeePayment: {len(columns)}")
    else:
        print("❌ Column still missing!")
