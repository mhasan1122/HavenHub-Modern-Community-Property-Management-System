from django.db import migrations


def column_exists(cursor, table_name, column_name, vendor):
    """Check if a column exists in a table"""
    if vendor == 'mysql':
        cursor.execute("""
            SELECT COUNT(*) 
            FROM information_schema.COLUMNS 
            WHERE TABLE_SCHEMA = DATABASE() 
            AND TABLE_NAME = %s 
            AND COLUMN_NAME = %s
        """, [table_name, column_name])
        return cursor.fetchone()[0] > 0
    elif vendor == 'postgresql':
        cursor.execute("""
            SELECT COUNT(*) 
            FROM information_schema.columns 
            WHERE table_name = %s 
            AND column_name = %s
        """, [table_name, column_name])
        return cursor.fetchone()[0] > 0
    elif vendor == 'sqlite':
        # SQLite PRAGMA doesn't support parameterized queries, but table_name is safe (from Django migrations)
        cursor.execute(f"PRAGMA table_info({table_name})")
        columns = [row[1] for row in cursor.fetchall()]
        return column_name in columns
    return False


def fix_account_field_defaults_forward(apps, schema_editor):
    """Add missing columns and set defaults for account fields"""
    vendor = schema_editor.connection.vendor
    
    with schema_editor.connection.cursor() as cursor:
        # Ensure openingCredit column exists (it might not if migration 0018 didn't create it)
        if not column_exists(cursor, 'accounts_account', 'openingCredit', vendor):
            if vendor == 'mysql':
                cursor.execute("""
                    ALTER TABLE accounts_account 
                    ADD COLUMN openingCredit DECIMAL(15, 2) NOT NULL DEFAULT 0
                """)
            elif vendor == 'postgresql':
                cursor.execute("""
                    ALTER TABLE accounts_account 
                    ADD COLUMN "openingCredit" NUMERIC(15, 2) NOT NULL DEFAULT 0
                """)
            elif vendor == 'sqlite':
                # SQLite doesn't support adding NOT NULL columns easily, so we add nullable first
                cursor.execute("""
                    ALTER TABLE accounts_account 
                    ADD COLUMN openingCredit DECIMAL(15, 2) DEFAULT 0
                """)
                cursor.execute("UPDATE accounts_account SET openingCredit = 0 WHERE openingCredit IS NULL")
        
        # Ensure openingDebit column exists
        if not column_exists(cursor, 'accounts_account', 'openingDebit', vendor):
            if vendor == 'mysql':
                cursor.execute("""
                    ALTER TABLE accounts_account 
                    ADD COLUMN openingDebit DECIMAL(15, 2) NOT NULL DEFAULT 0
                """)
            elif vendor == 'postgresql':
                cursor.execute("""
                    ALTER TABLE accounts_account 
                    ADD COLUMN "openingDebit" NUMERIC(15, 2) NOT NULL DEFAULT 0
                """)
            elif vendor == 'sqlite':
                cursor.execute("""
                    ALTER TABLE accounts_account 
                    ADD COLUMN openingDebit DECIMAL(15, 2) DEFAULT 0
                """)
                cursor.execute("UPDATE accounts_account SET openingDebit = 0 WHERE openingDebit IS NULL")
        
        # Now modify columns to set defaults (only if they exist)
        if vendor == 'mysql':
            sql_statements = []
            
            if column_exists(cursor, 'accounts_account', 'openingBalance', vendor):
                sql_statements.append("ALTER TABLE accounts_account MODIFY COLUMN openingBalance DECIMAL(15, 2) NOT NULL DEFAULT 0")
            if column_exists(cursor, 'accounts_account', 'currentBalance', vendor):
                sql_statements.append("ALTER TABLE accounts_account MODIFY COLUMN currentBalance DECIMAL(15, 2) NOT NULL DEFAULT 0")
            if column_exists(cursor, 'accounts_account', 'openingDebit', vendor):
                sql_statements.append("ALTER TABLE accounts_account MODIFY COLUMN openingDebit DECIMAL(15, 2) NOT NULL DEFAULT 0")
            if column_exists(cursor, 'accounts_account', 'openingCredit', vendor):
                sql_statements.append("ALTER TABLE accounts_account MODIFY COLUMN openingCredit DECIMAL(15, 2) NOT NULL DEFAULT 0")
            if column_exists(cursor, 'accounts_account', 'isActive', vendor):
                sql_statements.append("ALTER TABLE accounts_account MODIFY COLUMN isActive TINYINT(1) NOT NULL DEFAULT 1")
            if column_exists(cursor, 'accounts_account', 'isSystemAccount', vendor):
                sql_statements.append("ALTER TABLE accounts_account MODIFY COLUMN isSystemAccount TINYINT(1) NOT NULL DEFAULT 0")
            if column_exists(cursor, 'accounts_account', 'hasSubAccounts', vendor):
                sql_statements.append("ALTER TABLE accounts_account MODIFY COLUMN hasSubAccounts TINYINT(1) NOT NULL DEFAULT 0")
            
            if column_exists(cursor, 'accounts_voucherentry', 'totalDebit', vendor):
                sql_statements.append("ALTER TABLE accounts_voucherentry MODIFY COLUMN totalDebit DECIMAL(15, 2) NOT NULL DEFAULT 0")
            if column_exists(cursor, 'accounts_voucherentry', 'totalCredit', vendor):
                sql_statements.append("ALTER TABLE accounts_voucherentry MODIFY COLUMN totalCredit DECIMAL(15, 2) NOT NULL DEFAULT 0")
            if column_exists(cursor, 'accounts_voucherentry', 'status', vendor):
                sql_statements.append("ALTER TABLE accounts_voucherentry MODIFY COLUMN status VARCHAR(20) NOT NULL DEFAULT 'draft'")
            
            if column_exists(cursor, 'accounts_voucherentrydetails', 'debitAmount', vendor):
                sql_statements.append("ALTER TABLE accounts_voucherentrydetails MODIFY COLUMN debitAmount DECIMAL(15, 2) NOT NULL DEFAULT 0")
            if column_exists(cursor, 'accounts_voucherentrydetails', 'creditAmount', vendor):
                sql_statements.append("ALTER TABLE accounts_voucherentrydetails MODIFY COLUMN creditAmount DECIMAL(15, 2) NOT NULL DEFAULT 0")
            if column_exists(cursor, 'accounts_voucherentrydetails', 'lineNumber', vendor):
                sql_statements.append("ALTER TABLE accounts_voucherentrydetails MODIFY COLUMN lineNumber INT NOT NULL DEFAULT 1")
            
            if column_exists(cursor, 'accounts_vouchertype', 'isActive', vendor):
                sql_statements.append("ALTER TABLE accounts_vouchertype MODIFY COLUMN isActive TINYINT(1) NOT NULL DEFAULT 1")
            if column_exists(cursor, 'accounts_defaultaccounthead', 'isActive', vendor):
                sql_statements.append("ALTER TABLE accounts_defaultaccounthead MODIFY COLUMN isActive TINYINT(1) NOT NULL DEFAULT 1")
            
            for sql in sql_statements:
                cursor.execute(sql)
        
        elif vendor == 'postgresql':
            # PostgreSQL uses ALTER COLUMN SET DEFAULT
            if column_exists(cursor, 'accounts_account', 'openingBalance', vendor):
                cursor.execute('ALTER TABLE accounts_account ALTER COLUMN "openingBalance" SET DEFAULT 0')
            if column_exists(cursor, 'accounts_account', 'currentBalance', vendor):
                cursor.execute('ALTER TABLE accounts_account ALTER COLUMN "currentBalance" SET DEFAULT 0')
            if column_exists(cursor, 'accounts_account', 'openingDebit', vendor):
                cursor.execute('ALTER TABLE accounts_account ALTER COLUMN "openingDebit" SET DEFAULT 0')
            if column_exists(cursor, 'accounts_account', 'openingCredit', vendor):
                cursor.execute('ALTER TABLE accounts_account ALTER COLUMN "openingCredit" SET DEFAULT 0')
            if column_exists(cursor, 'accounts_account', 'isActive', vendor):
                cursor.execute('ALTER TABLE accounts_account ALTER COLUMN "isActive" SET DEFAULT true')
            if column_exists(cursor, 'accounts_account', 'isSystemAccount', vendor):
                cursor.execute('ALTER TABLE accounts_account ALTER COLUMN "isSystemAccount" SET DEFAULT false')
            if column_exists(cursor, 'accounts_account', 'hasSubAccounts', vendor):
                cursor.execute('ALTER TABLE accounts_account ALTER COLUMN "hasSubAccounts" SET DEFAULT false')
            
            if column_exists(cursor, 'accounts_voucherentry', 'totalDebit', vendor):
                cursor.execute('ALTER TABLE accounts_voucherentry ALTER COLUMN "totalDebit" SET DEFAULT 0')
            if column_exists(cursor, 'accounts_voucherentry', 'totalCredit', vendor):
                cursor.execute('ALTER TABLE accounts_voucherentry ALTER COLUMN "totalCredit" SET DEFAULT 0')
            if column_exists(cursor, 'accounts_voucherentry', 'status', vendor):
                cursor.execute("ALTER TABLE accounts_voucherentry ALTER COLUMN status SET DEFAULT 'draft'")
            
            if column_exists(cursor, 'accounts_voucherentrydetails', 'debitAmount', vendor):
                cursor.execute('ALTER TABLE accounts_voucherentrydetails ALTER COLUMN "debitAmount" SET DEFAULT 0')
            if column_exists(cursor, 'accounts_voucherentrydetails', 'creditAmount', vendor):
                cursor.execute('ALTER TABLE accounts_voucherentrydetails ALTER COLUMN "creditAmount" SET DEFAULT 0')
            if column_exists(cursor, 'accounts_voucherentrydetails', 'lineNumber', vendor):
                cursor.execute('ALTER TABLE accounts_voucherentrydetails ALTER COLUMN "lineNumber" SET DEFAULT 1')
            
            if column_exists(cursor, 'accounts_vouchertype', 'isActive', vendor):
                cursor.execute('ALTER TABLE accounts_vouchertype ALTER COLUMN "isActive" SET DEFAULT true')
            if column_exists(cursor, 'accounts_defaultaccounthead', 'isActive', vendor):
                cursor.execute('ALTER TABLE accounts_defaultaccounthead ALTER COLUMN "isActive" SET DEFAULT true')
        
        elif vendor == 'sqlite':
            # SQLite doesn't support ALTER COLUMN, so we skip setting defaults
            # Defaults are handled at the application level for SQLite
            pass


def fix_account_field_defaults_reverse(apps, schema_editor):
    """Reverse migration - remove defaults"""
    vendor = schema_editor.connection.vendor
    
    with schema_editor.connection.cursor() as cursor:
        if vendor == 'mysql':
            sql_statements = []
            
            if column_exists(cursor, 'accounts_account', 'openingBalance', vendor):
                sql_statements.append("ALTER TABLE accounts_account MODIFY COLUMN openingBalance DECIMAL(15, 2) NOT NULL")
            if column_exists(cursor, 'accounts_account', 'currentBalance', vendor):
                sql_statements.append("ALTER TABLE accounts_account MODIFY COLUMN currentBalance DECIMAL(15, 2) NOT NULL")
            if column_exists(cursor, 'accounts_account', 'openingDebit', vendor):
                sql_statements.append("ALTER TABLE accounts_account MODIFY COLUMN openingDebit DECIMAL(15, 2) NOT NULL")
            if column_exists(cursor, 'accounts_account', 'openingCredit', vendor):
                sql_statements.append("ALTER TABLE accounts_account MODIFY COLUMN openingCredit DECIMAL(15, 2) NOT NULL")
            if column_exists(cursor, 'accounts_account', 'isActive', vendor):
                sql_statements.append("ALTER TABLE accounts_account MODIFY COLUMN isActive TINYINT(1) NOT NULL")
            if column_exists(cursor, 'accounts_account', 'isSystemAccount', vendor):
                sql_statements.append("ALTER TABLE accounts_account MODIFY COLUMN isSystemAccount TINYINT(1) NOT NULL")
            if column_exists(cursor, 'accounts_account', 'hasSubAccounts', vendor):
                sql_statements.append("ALTER TABLE accounts_account MODIFY COLUMN hasSubAccounts TINYINT(1) NOT NULL")
            
            if column_exists(cursor, 'accounts_voucherentry', 'totalDebit', vendor):
                sql_statements.append("ALTER TABLE accounts_voucherentry MODIFY COLUMN totalDebit DECIMAL(15, 2) NOT NULL")
            if column_exists(cursor, 'accounts_voucherentry', 'totalCredit', vendor):
                sql_statements.append("ALTER TABLE accounts_voucherentry MODIFY COLUMN totalCredit DECIMAL(15, 2) NOT NULL")
            if column_exists(cursor, 'accounts_voucherentry', 'status', vendor):
                sql_statements.append("ALTER TABLE accounts_voucherentry MODIFY COLUMN status VARCHAR(20) NOT NULL")
            
            if column_exists(cursor, 'accounts_voucherentrydetails', 'debitAmount', vendor):
                sql_statements.append("ALTER TABLE accounts_voucherentrydetails MODIFY COLUMN debitAmount DECIMAL(15, 2) NOT NULL")
            if column_exists(cursor, 'accounts_voucherentrydetails', 'creditAmount', vendor):
                sql_statements.append("ALTER TABLE accounts_voucherentrydetails MODIFY COLUMN creditAmount DECIMAL(15, 2) NOT NULL")
            if column_exists(cursor, 'accounts_voucherentrydetails', 'lineNumber', vendor):
                sql_statements.append("ALTER TABLE accounts_voucherentrydetails MODIFY COLUMN lineNumber INT NOT NULL")
            
            if column_exists(cursor, 'accounts_vouchertype', 'isActive', vendor):
                sql_statements.append("ALTER TABLE accounts_vouchertype MODIFY COLUMN isActive TINYINT(1) NOT NULL")
            if column_exists(cursor, 'accounts_defaultaccounthead', 'isActive', vendor):
                sql_statements.append("ALTER TABLE accounts_defaultaccounthead MODIFY COLUMN isActive TINYINT(1) NOT NULL")
            
            for sql in sql_statements:
                cursor.execute(sql)
        
        elif vendor == 'postgresql':
            if column_exists(cursor, 'accounts_account', 'openingBalance', vendor):
                cursor.execute('ALTER TABLE accounts_account ALTER COLUMN "openingBalance" DROP DEFAULT')
            if column_exists(cursor, 'accounts_account', 'currentBalance', vendor):
                cursor.execute('ALTER TABLE accounts_account ALTER COLUMN "currentBalance" DROP DEFAULT')
            if column_exists(cursor, 'accounts_account', 'openingDebit', vendor):
                cursor.execute('ALTER TABLE accounts_account ALTER COLUMN "openingDebit" DROP DEFAULT')
            if column_exists(cursor, 'accounts_account', 'openingCredit', vendor):
                cursor.execute('ALTER TABLE accounts_account ALTER COLUMN "openingCredit" DROP DEFAULT')
            if column_exists(cursor, 'accounts_account', 'isActive', vendor):
                cursor.execute('ALTER TABLE accounts_account ALTER COLUMN "isActive" DROP DEFAULT')
            if column_exists(cursor, 'accounts_account', 'isSystemAccount', vendor):
                cursor.execute('ALTER TABLE accounts_account ALTER COLUMN "isSystemAccount" DROP DEFAULT')
            if column_exists(cursor, 'accounts_account', 'hasSubAccounts', vendor):
                cursor.execute('ALTER TABLE accounts_account ALTER COLUMN "hasSubAccounts" DROP DEFAULT')
            
            if column_exists(cursor, 'accounts_voucherentry', 'totalDebit', vendor):
                cursor.execute('ALTER TABLE accounts_voucherentry ALTER COLUMN "totalDebit" DROP DEFAULT')
            if column_exists(cursor, 'accounts_voucherentry', 'totalCredit', vendor):
                cursor.execute('ALTER TABLE accounts_voucherentry ALTER COLUMN "totalCredit" DROP DEFAULT')
            if column_exists(cursor, 'accounts_voucherentry', 'status', vendor):
                cursor.execute('ALTER TABLE accounts_voucherentry ALTER COLUMN status DROP DEFAULT')
            
            if column_exists(cursor, 'accounts_voucherentrydetails', 'debitAmount', vendor):
                cursor.execute('ALTER TABLE accounts_voucherentrydetails ALTER COLUMN "debitAmount" DROP DEFAULT')
            if column_exists(cursor, 'accounts_voucherentrydetails', 'creditAmount', vendor):
                cursor.execute('ALTER TABLE accounts_voucherentrydetails ALTER COLUMN "creditAmount" DROP DEFAULT')
            if column_exists(cursor, 'accounts_voucherentrydetails', 'lineNumber', vendor):
                cursor.execute('ALTER TABLE accounts_voucherentrydetails ALTER COLUMN "lineNumber" DROP DEFAULT')
            
            if column_exists(cursor, 'accounts_vouchertype', 'isActive', vendor):
                cursor.execute('ALTER TABLE accounts_vouchertype ALTER COLUMN "isActive" DROP DEFAULT')
            if column_exists(cursor, 'accounts_defaultaccounthead', 'isActive', vendor):
                cursor.execute('ALTER TABLE accounts_defaultaccounthead ALTER COLUMN "isActive" DROP DEFAULT')
        
        elif vendor == 'sqlite':
            # SQLite doesn't support ALTER COLUMN, so we skip
            pass


class Migration(migrations.Migration):

    dependencies = [
        ('accounts', '0018_account_openingcredit_account_openingdebit'),
    ]

    operations = [
        migrations.RunPython(
            fix_account_field_defaults_forward,
            reverse_code=fix_account_field_defaults_reverse,
        ),
    ]
