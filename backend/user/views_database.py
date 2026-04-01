"""
Database table management API views for truncating tables.
"""
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status
from rest_framework.permissions import IsAuthenticated
from django.db import connection
from django.conf import settings
from django.http import HttpResponse
import logging
import subprocess
import os
import re
import urllib.parse
from datetime import datetime

logger = logging.getLogger(__name__)


class DatabaseTablesListView(APIView):
    """
    API endpoint to list all database tables with their row counts.
    """
    permission_classes = [IsAuthenticated]

    def get(self, request):
        try:
            db_engine = settings.DATABASES['default']['ENGINE']
            db_name = settings.DATABASES['default']['NAME']
            
            # Get all table names
            with connection.cursor() as cursor:
                if 'mysql' in db_engine.lower():
                    cursor.execute("SHOW TABLES")
                    tables = [row[0] for row in cursor.fetchall()]
                elif 'postgresql' in db_engine.lower():
                    cursor.execute("""
                        SELECT tablename FROM pg_tables 
                        WHERE schemaname = 'public'
                    """)
                    tables = [row[0] for row in cursor.fetchall()]
                elif 'sqlite' in db_engine.lower():
                    cursor.execute("""
                        SELECT name FROM sqlite_master 
                        WHERE type='table' AND name NOT LIKE 'sqlite_%'
                    """)
                    tables = [row[0] for row in cursor.fetchall()]
                else:
                    return Response(
                        {'error': f'Unsupported database engine: {db_engine}'},
                        status=status.HTTP_400_BAD_REQUEST
                    )
            
            # Get row counts for each table
            tables_with_counts = []
            with connection.cursor() as cursor:
                for table in sorted(tables):
                    try:
                        if 'mysql' in db_engine.lower():
                            cursor.execute(f"SELECT COUNT(*) FROM `{table}`")
                        elif 'postgresql' in db_engine.lower():
                            cursor.execute(f'SELECT COUNT(*) FROM "{table}"')
                        elif 'sqlite' in db_engine.lower():
                            cursor.execute(f'SELECT COUNT(*) FROM "{table}"')
                        
                        count = cursor.fetchone()[0]
                        tables_with_counts.append({
                            'name': table,
                            'row_count': count
                        })
                    except Exception as e:
                        logger.warning(f"Could not get row count for table {table}: {str(e)}")
                        tables_with_counts.append({
                            'name': table,
                            'row_count': None
                        })
            
            return Response({
                'database_name': db_name,
                'database_engine': db_engine,
                'tables': tables_with_counts,
                'total_tables': len(tables_with_counts)
            }, status=status.HTTP_200_OK)
            
        except Exception as e:
            logger.error(f"Error fetching database tables: {str(e)}")
            return Response(
                {'error': f'Failed to fetch database tables: {str(e)}'},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )


class DatabaseTablesTruncateView(APIView):
    """
    API endpoint to truncate selected database tables.
    """
    permission_classes = [IsAuthenticated]

    def post(self, request):
        try:
            table_names = request.data.get('tables', [])
            confirm = request.data.get('confirm', False)
            
            if not isinstance(table_names, list) or len(table_names) == 0:
                return Response(
                    {'error': 'Please provide a list of table names to truncate'},
                    status=status.HTTP_400_BAD_REQUEST
                )
            
            if not confirm:
                return Response(
                    {'error': 'Confirmation required. Set "confirm" to true to proceed.'},
                    status=status.HTTP_400_BAD_REQUEST
                )
            
            db_engine = settings.DATABASES['default']['ENGINE']
            
            truncated_tables = []
            errors = []
            
            with connection.cursor() as cursor:
                # Disable foreign key checks for MySQL
                if 'mysql' in db_engine.lower():
                    cursor.execute("SET FOREIGN_KEY_CHECKS = 0")
                
                for table_name in table_names:
                    try:
                        if 'mysql' in db_engine.lower():
                            cursor.execute(f"TRUNCATE TABLE `{table_name}`")
                        elif 'postgresql' in db_engine.lower():
                            cursor.execute(f'TRUNCATE TABLE "{table_name}" RESTART IDENTITY CASCADE')
                        elif 'sqlite' in db_engine.lower():
                            cursor.execute(f'DELETE FROM "{table_name}"')
                            cursor.execute(f"DELETE FROM sqlite_sequence WHERE name='{table_name}'")
                        
                        truncated_tables.append(table_name)
                        logger.info(f"Truncated table: {table_name}")
                    except Exception as e:
                        error_msg = f"Error truncating {table_name}: {str(e)}"
                        errors.append({
                            'table': table_name,
                            'error': str(e)
                        })
                        logger.error(error_msg)
                
                # Re-enable foreign key checks for MySQL
                if 'mysql' in db_engine.lower():
                    cursor.execute("SET FOREIGN_KEY_CHECKS = 1")
            
            return Response({
                'success': True,
                'truncated_tables': truncated_tables,
                'truncated_count': len(truncated_tables),
                'errors': errors,
                'error_count': len(errors)
            }, status=status.HTTP_200_OK)
            
        except Exception as e:
            logger.error(f"Error truncating tables: {str(e)}")
            return Response(
                {'error': f'Failed to truncate tables: {str(e)}'},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )


class DatabaseExportView(APIView):
    """
    API endpoint to export the entire database as SQL dump file.
    Returns a downloadable SQL file with industry-standard naming.
    """
    permission_classes = [IsAuthenticated]

    def get(self, request):
        try:
            db_config = settings.DATABASES['default']
            db_engine = db_config['ENGINE']
            db_name = db_config['NAME']
            db_user = db_config.get('USER', '')
            db_password = db_config.get('PASSWORD', '')
            db_host = db_config.get('HOST', 'localhost')
            db_port = db_config.get('PORT', '3306')
            
            # Generate filename with industry-standard format: database_name_YYYY-MM-DD_HH-MM-SS.sql
            timestamp = datetime.now().strftime('%Y-%m-%d_%H-%M-%S')
            # Sanitize database name for filename (remove special characters)
            safe_db_name = re.sub(r'[^a-zA-Z0-9_-]', '_', db_name)
            filename = f"{safe_db_name}_{timestamp}.sql"
            
            sql_content = None
            
            # Generate SQL dump based on database engine
            if 'mysql' in db_engine.lower():
                sql_content = self._export_mysql(db_name, db_user, db_password, db_host, db_port)
            elif 'postgresql' in db_engine.lower():
                sql_content = self._export_postgresql(db_name, db_user, db_password, db_host, db_port)
            elif 'sqlite' in db_engine.lower():
                sql_content = self._export_sqlite(db_name)
            else:
                return Response(
                    {'error': f'Unsupported database engine: {db_engine}'},
                    status=status.HTTP_400_BAD_REQUEST
                )
            
            if sql_content is None:
                return Response(
                    {'error': 'Failed to generate database export'},
                    status=status.HTTP_500_INTERNAL_SERVER_ERROR
                )
            
            # Create HTTP response with SQL file
            response = HttpResponse(sql_content, content_type='application/sql')
            # Use RFC 5987 encoding for filename to support special characters
            encoded_filename = urllib.parse.quote(filename)
            response['Content-Disposition'] = f'attachment; filename="{filename}"; filename*=UTF-8\'\'{encoded_filename}'
            response['Content-Length'] = len(sql_content.encode('utf-8'))
            # Expose Content-Disposition header for CORS if needed
            response['Access-Control-Expose-Headers'] = 'Content-Disposition'
            
            return response
            
        except Exception as e:
            logger.error(f"Error exporting database: {str(e)}")
            return Response(
                {'error': f'Failed to export database: {str(e)}'},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )
    
    def _export_mysql(self, db_name, db_user, db_password, db_host, db_port):
        """Export MySQL database using mysqldump"""
        try:
            # Build mysqldump command
            cmd = [
                'mysqldump',
                '--host', str(db_host),
                '--port', str(db_port),
                '--user', db_user,
                '--single-transaction',
                '--routines',
                '--triggers',
                '--events',
                '--quick',
                '--lock-tables=false',
                db_name
            ]
            
            # Set password via environment variable for security
            env = os.environ.copy()
            env['MYSQL_PWD'] = db_password
            
            # Execute mysqldump
            result = subprocess.run(
                cmd,
                env=env,
                capture_output=True,
                text=True,
                timeout=300  # 5 minute timeout
            )
            
            if result.returncode != 0:
                logger.error(f"mysqldump error: {result.stderr}")
                return None
            
            # Add header comment
            header = f"""-- MySQL dump for database: {db_name}
-- Generated: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}
-- 
-- Host: {db_host}
-- Database: {db_name}
-- 

SET SQL_MODE = "NO_AUTO_VALUE_ON_ZERO";
SET time_zone = "+00:00";
SET FOREIGN_KEY_CHECKS = 0;
SET AUTOCOMMIT = 0;
START TRANSACTION;
SET time_zone = "+00:00";


"""
            
            return header + result.stdout
            
        except subprocess.TimeoutExpired:
            logger.error("mysqldump timeout")
            return None
        except FileNotFoundError:
            logger.error("mysqldump command not found. Trying alternative method...")
            return self._export_mysql_alternative(db_name)
        except Exception as e:
            logger.error(f"Error in mysqldump: {str(e)}")
            return self._export_mysql_alternative(db_name)
    
    def _export_mysql_alternative(self, db_name):
        """Fallback: Export MySQL database using Django's connection"""
        try:
            sql_parts = []
            
            # Add header
            sql_parts.append(f"-- MySQL dump for database: {db_name}")
            sql_parts.append(f"-- Generated: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
            sql_parts.append("-- Using Django ORM fallback method")
            sql_parts.append("")
            sql_parts.append("SET FOREIGN_KEY_CHECKS = 0;")
            sql_parts.append("SET AUTOCOMMIT = 0;")
            sql_parts.append("START TRANSACTION;")
            sql_parts.append("")
            
            with connection.cursor() as cursor:
                # Get all tables
                cursor.execute("SHOW TABLES")
                tables = [row[0] for row in cursor.fetchall()]
                
                for table in tables:
                    try:
                        # Get table structure
                        cursor.execute(f"SHOW CREATE TABLE `{table}`")
                        create_table = cursor.fetchone()[1]
                        sql_parts.append(f"\n-- Table structure for table `{table}`")
                        sql_parts.append(f"DROP TABLE IF EXISTS `{table}`;")
                        sql_parts.append(f"{create_table};")
                        sql_parts.append("")
                        
                        # Get table data
                        cursor.execute(f"SELECT * FROM `{table}`")
                        rows = cursor.fetchall()
                        
                        if rows:
                            # Get column names
                            cursor.execute(f"DESCRIBE `{table}`")
                            columns = [col[0] for col in cursor.fetchall()]
                            
                            sql_parts.append(f"-- Dumping data for table `{table}`")
                            
                            # Build INSERT statements (batch for efficiency)
                            batch_size = 100
                            for i in range(0, len(rows), batch_size):
                                batch = rows[i:i + batch_size]
                                values_list = []
                                
                                for row in batch:
                                    values = []
                                    for val in row:
                                        if val is None:
                                            values.append('NULL')
                                        elif isinstance(val, (int, float)):
                                            values.append(str(val))
                                        else:
                                            # Escape single quotes
                                            escaped = str(val).replace("'", "''")
                                            values.append(f"'{escaped}'")
                                    values_list.append(f"({', '.join(values)})")
                                
                                columns_str = ', '.join([f"`{col}`" for col in columns])
                                values_str = ',\n    '.join(values_list)
                                sql_parts.append(f"INSERT INTO `{table}` ({columns_str}) VALUES\n    {values_str};")
                            
                            sql_parts.append("")
                    except Exception as e:
                        logger.warning(f"Error exporting table {table}: {str(e)}")
                        sql_parts.append(f"-- Error exporting table {table}: {str(e)}")
                        continue
            
            sql_parts.append("COMMIT;")
            sql_parts.append("SET FOREIGN_KEY_CHECKS = 1;")
            
            return '\n'.join(sql_parts)
            
        except Exception as e:
            logger.error(f"Error in alternative MySQL export: {str(e)}")
            return None
    
    def _export_postgresql(self, db_name, db_user, db_password, db_host, db_port):
        """Export PostgreSQL database using pg_dump"""
        try:
            # Build pg_dump command
            cmd = [
                'pg_dump',
                '--host', str(db_host),
                '--port', str(db_port),
                '--username', db_user,
                '--no-password',
                '--format', 'plain',
                '--verbose',
                '--file', '-'  # Output to stdout
            ]
            
            # Set password via environment variable
            env = os.environ.copy()
            env['PGPASSWORD'] = db_password
            
            # Execute pg_dump
            result = subprocess.run(
                cmd + [db_name],
                env=env,
                capture_output=True,
                text=True,
                timeout=300
            )
            
            if result.returncode != 0:
                logger.error(f"pg_dump error: {result.stderr}")
                return None
            
            return result.stdout
            
        except subprocess.TimeoutExpired:
            logger.error("pg_dump timeout")
            return None
        except FileNotFoundError:
            logger.error("pg_dump command not found")
            return None
        except Exception as e:
            logger.error(f"Error in pg_dump: {str(e)}")
            return None
    
    def _export_sqlite(self, db_path):
        """Export SQLite database"""
        try:
            if not os.path.exists(db_path):
                logger.error(f"SQLite database file not found: {db_path}")
                return None
            
            # Use sqlite3 command to dump
            try:
                cmd = ['sqlite3', db_path, '.dump']
                result = subprocess.run(
                    cmd,
                    capture_output=True,
                    text=True,
                    timeout=300
                )
                
                if result.returncode != 0:
                    logger.error(f"sqlite3 dump error: {result.stderr}")
                    return None
                
                return result.stdout
                
            except FileNotFoundError:
                logger.warning("sqlite3 command not found, reading database file directly")
                # Fallback: read the SQLite file (binary, not ideal)
                with open(db_path, 'rb') as f:
                    return f"-- SQLite database dump\n-- File: {db_path}\n-- Generated: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}\n-- Note: Binary file - use sqlite3 .dump for proper SQL export\n"
                
        except Exception as e:
            logger.error(f"Error exporting SQLite database: {str(e)}")
            return None


class DatabaseImportView(APIView):
    """
    API endpoint to import database from SQL file.
    Accepts a SQL file and executes all SQL statements.
    """
    permission_classes = [IsAuthenticated]

    def post(self, request):
        try:
            # Check if file was uploaded
            if 'file' not in request.FILES:
                return Response(
                    {'error': 'No file provided. Please upload a SQL file.'},
                    status=status.HTTP_400_BAD_REQUEST
                )
            
            sql_file = request.FILES['file']
            
            # Validate file extension
            if not sql_file.name.endswith('.sql'):
                return Response(
                    {'error': 'Invalid file type. Please upload a .sql file.'},
                    status=status.HTTP_400_BAD_REQUEST
                )
            
            # Validate file size (max 100MB)
            max_size = 100 * 1024 * 1024  # 100MB
            if sql_file.size > max_size:
                return Response(
                    {'error': f'File too large. Maximum size is {max_size / (1024*1024)}MB.'},
                    status=status.HTTP_400_BAD_REQUEST
                )
            
            db_config = settings.DATABASES['default']
            db_engine = db_config['ENGINE']
            
            # Read SQL file content
            sql_content = sql_file.read().decode('utf-8', errors='ignore')
            
            # Import based on database engine
            if 'mysql' in db_engine.lower():
                result = self._import_mysql(sql_content, db_config)
            elif 'postgresql' in db_engine.lower():
                result = self._import_postgresql(sql_content, db_config)
            elif 'sqlite' in db_engine.lower():
                result = self._import_sqlite(sql_content, db_config)
            else:
                return Response(
                    {'error': f'Unsupported database engine: {db_engine}'},
                    status=status.HTTP_400_BAD_REQUEST
                )
            
            if result['success']:
                return Response({
                    'success': True,
                    'message': f'Database imported successfully. {result.get("message", "")}',
                    'statements_executed': result.get('statements_executed', 0),
                    'errors': result.get('errors', [])
                }, status=status.HTTP_200_OK)
            else:
                return Response(
                    {'error': result.get('error', 'Failed to import database')},
                    status=status.HTTP_500_INTERNAL_SERVER_ERROR
                )
            
        except Exception as e:
            logger.error(f"Error importing database: {str(e)}")
            return Response(
                {'error': f'Failed to import database: {str(e)}'},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )
    
    def _import_mysql(self, sql_content, db_config):
        """Import MySQL database by executing SQL statements"""
        try:
            db_name = db_config['NAME']
            db_user = db_config.get('USER', '')
            db_password = db_config.get('PASSWORD', '')
            db_host = db_config.get('HOST', 'localhost')
            db_port = db_config.get('PORT', '3306')
            
            # Split SQL content into individual statements
            statements = self._split_sql_statements(sql_content)
            
            errors = []
            statements_executed = 0
            
            with connection.cursor() as cursor:
                # Disable foreign key checks temporarily
                cursor.execute("SET FOREIGN_KEY_CHECKS = 0")
                cursor.execute("SET AUTOCOMMIT = 0")
                cursor.execute("START TRANSACTION")
                
                try:
                    for statement in statements:
                        statement = statement.strip()
                        if not statement or statement.startswith('--') or statement.startswith('/*'):
                            continue
                        
                        try:
                            cursor.execute(statement)
                            statements_executed += 1
                        except Exception as e:
                            error_msg = str(e)
                            errors.append({
                                'statement': statement[:100] + '...' if len(statement) > 100 else statement,
                                'error': error_msg
                            })
                            logger.warning(f"Error executing SQL statement: {error_msg}")
                    
                    # Commit transaction if no critical errors
                    if len(errors) == 0 or all('FOREIGN KEY' not in e.get('error', '') for e in errors):
                        cursor.execute("COMMIT")
                    else:
                        cursor.execute("ROLLBACK")
                        return {
                            'success': False,
                            'error': 'Transaction rolled back due to errors',
                            'errors': errors
                        }
                    
                    # Re-enable foreign key checks
                    cursor.execute("SET FOREIGN_KEY_CHECKS = 1")
                    
                    return {
                        'success': True,
                        'statements_executed': statements_executed,
                        'errors': errors,
                        'message': f'Executed {statements_executed} SQL statements successfully'
                    }
                    
                except Exception as e:
                    cursor.execute("ROLLBACK")
                    raise e
                    
        except Exception as e:
            logger.error(f"Error importing MySQL database: {str(e)}")
            return {
                'success': False,
                'error': f'Failed to import MySQL database: {str(e)}'
            }
    
    def _import_postgresql(self, sql_content, db_config):
        """Import PostgreSQL database"""
        try:
            db_name = db_config['NAME']
            db_user = db_config.get('USER', '')
            db_password = db_config.get('PASSWORD', '')
            db_host = db_config.get('HOST', 'localhost')
            db_port = db_config.get('PORT', '5432')
            
            # Use psql command for PostgreSQL
            env = os.environ.copy()
            env['PGPASSWORD'] = db_password
            
            cmd = [
                'psql',
                '-h', str(db_host),
                '-p', str(db_port),
                '-U', db_user,
                '-d', db_name,
                '-f', '-'  # Read from stdin
            ]
            
            result = subprocess.run(
                cmd,
                input=sql_content.encode('utf-8'),
                env=env,
                capture_output=True,
                text=True,
                timeout=600  # 10 minute timeout
            )
            
            if result.returncode != 0:
                return {
                    'success': False,
                    'error': f'PostgreSQL import failed: {result.stderr}'
                }
            
            return {
                'success': True,
                'message': 'PostgreSQL database imported successfully'
            }
            
        except FileNotFoundError:
            # Fallback to Django ORM method
            return self._import_postgresql_alternative(sql_content)
        except Exception as e:
            logger.error(f"Error importing PostgreSQL database: {str(e)}")
            return {
                'success': False,
                'error': f'Failed to import PostgreSQL database: {str(e)}'
            }
    
    def _import_postgresql_alternative(self, sql_content):
        """Fallback method for PostgreSQL import using Django connection"""
        try:
            statements = self._split_sql_statements(sql_content)
            statements_executed = 0
            errors = []
            
            with connection.cursor() as cursor:
                for statement in statements:
                    statement = statement.strip()
                    if not statement or statement.startswith('--'):
                        continue
                    try:
                        cursor.execute(statement)
                        statements_executed += 1
                    except Exception as e:
                        errors.append({'statement': statement[:100], 'error': str(e)})
            
            return {
                'success': len(errors) == 0,
                'statements_executed': statements_executed,
                'errors': errors
            }
        except Exception as e:
            return {
                'success': False,
                'error': str(e)
            }
    
    def _import_sqlite(self, sql_content, db_config):
        """Import SQLite database"""
        try:
            db_path = db_config['NAME']
            statements = self._split_sql_statements(sql_content)
            statements_executed = 0
            errors = []
            
            with connection.cursor() as cursor:
                for statement in statements:
                    statement = statement.strip()
                    if not statement or statement.startswith('--'):
                        continue
                    try:
                        cursor.execute(statement)
                        statements_executed += 1
                    except Exception as e:
                        errors.append({'statement': statement[:100], 'error': str(e)})
            
            return {
                'success': len(errors) == 0,
                'statements_executed': statements_executed,
                'errors': errors
            }
        except Exception as e:
            return {
                'success': False,
                'error': str(e)
            }
    
    def _split_sql_statements(self, sql_content):
        """Split SQL content into individual statements"""
        # Remove comments and split by semicolon
        lines = sql_content.split('\n')
        cleaned_lines = []
        
        in_comment = False
        for line in lines:
            # Handle multi-line comments
            if '/*' in line:
                in_comment = True
            if '*/' in line:
                in_comment = False
                continue
            if in_comment:
                continue
            
            # Remove single-line comments
            if '--' in line:
                line = line[:line.index('--')]
            
            cleaned_lines.append(line)
        
        # Join and split by semicolon
        content = ' '.join(cleaned_lines)
        statements = [s.strip() + ';' for s in content.split(';') if s.strip()]
        
        return statements

