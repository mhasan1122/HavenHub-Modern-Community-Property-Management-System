"""
Django management command to truncate selected database tables.

This command provides an interactive GUI to select which tables to truncate.
It will:
1. Show all tables with row counts
2. Allow interactive selection of tables to truncate
3. Disable foreign key checks (for MySQL)
4. Truncate selected tables
5. Re-enable foreign key checks

WARNING: This will delete ALL data from selected tables!
Use with extreme caution, especially in production environments.

Usage:
    python manage.py truncate_tables
    python manage.py truncate_tables --no-gui  # Use command-line mode
"""
import sys
from django.core.management.base import BaseCommand
from django.db import connection
from django.conf import settings

try:
    from simple_term_menu import TerminalMenu
    TERMINAL_MENU_AVAILABLE = True
except ImportError:
    TERMINAL_MENU_AVAILABLE = False


class Command(BaseCommand):
    help = 'Truncate selected database tables with interactive GUI (WARNING: This deletes all data!)'

    def add_arguments(self, parser):
        parser.add_argument(
            '--no-gui',
            action='store_true',
            help='Use command-line mode instead of interactive GUI',
        )
        parser.add_argument(
            '--confirm',
            action='store_true',
            help='Skip confirmation prompt (use with caution!)',
        )
        parser.add_argument(
            '--exclude',
            action='append',
            default=[],
            help='Exclude specific tables from selection (can be used multiple times)',
        )
        parser.add_argument(
            '--list-only',
            action='store_true',
            help='Only list tables, do not truncate',
        )

    def get_table_row_count(self, cursor, table_name, db_engine):
        """Get row count for a table."""
        try:
            if 'mysql' in db_engine.lower():
                cursor.execute(f"SELECT COUNT(*) FROM `{table_name}`")
            elif 'postgresql' in db_engine.lower():
                cursor.execute(f'SELECT COUNT(*) FROM "{table_name}"')
            elif 'sqlite' in db_engine.lower():
                cursor.execute(f'SELECT COUNT(*) FROM "{table_name}"')
            else:
                return None
            return cursor.fetchone()[0]
        except Exception:
            return None

    def get_all_tables(self, db_engine):
        """Get all table names from the database."""
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
                return None
        return sorted(tables)

    def get_tables_with_counts(self, tables, db_engine):
        """Get tables with their row counts."""
        tables_with_counts = []
        with connection.cursor() as cursor:
            for table in tables:
                count = self.get_table_row_count(cursor, table, db_engine)
                tables_with_counts.append({
                    'name': table,
                    'count': count if count is not None else 'N/A'
                })
        return tables_with_counts

    def interactive_table_selection(self, tables_with_counts):
        """Show interactive GUI for table selection using terminal menu."""
        if not TERMINAL_MENU_AVAILABLE:
            # Fallback to simple interactive menu
            self.stdout.write(self.style.WARNING(
                '\n⚠ simple-term-menu not installed. Install it with: pip install simple-term-menu\n'
            ))
            return self.simple_interactive_menu(tables_with_counts)

        try:
            selected_tables = []
            selected_indices = set()
            
            while True:
                # Create menu items with selection status
                menu_items = []
                for idx, table_info in enumerate(tables_with_counts):
                    table_name = table_info['name']
                    row_count = table_info['count']
                    count_str = f"{row_count:,} rows" if isinstance(row_count, int) else str(row_count)
                    marker = "✓" if (idx + 1) in selected_indices else " "
                    # Truncate long table names for display
                    display_name = table_name[:45] + "..." if len(table_name) > 45 else table_name
                    menu_items.append(f"[{marker}] {display_name:48s} ({count_str})")
                
                # Add separator and action items
                menu_items.append("─" * 70)
                menu_items.append(f"✓ DONE - Confirm ({len(selected_indices)} selected)")
                menu_items.append("  SELECT ALL")
                menu_items.append("  CLEAR ALL")
                menu_items.append("  CANCEL")
                
                # Create terminal menu
                title = (
                    "\n" + "=" * 70 + "\n" +
                    "  SELECT TABLES TO TRUNCATE\n" +
                    "=" * 70 + "\n" +
                    f"  Selected: {len(selected_indices)} table(s) | Use ↑↓ to navigate, ENTER to toggle\n" +
                    "─" * 70 + "\n"
                )
                
                terminal_menu = TerminalMenu(
                    menu_items,
                    title=title,
                    menu_cursor="> ",
                    menu_cursor_style=("fg_cyan", "bold"),
                    menu_highlight_style=("fg_yellow", "bold"),
                    cycle_cursor=True,
                    clear_screen=True
                )
                
                menu_entry_index = terminal_menu.show()
                
                if menu_entry_index is None:  # User pressed ESC or Ctrl+C
                    return []
                
                total_tables = len(tables_with_counts)
                separator_index = total_tables
                
                # Check if it's an action item
                if menu_entry_index == separator_index + 1:  # Done
                    if len(selected_indices) == 0:
                        self.stdout.write(self.style.WARNING('\n⚠ No tables selected. Please select at least one table.\n'))
                        input('Press Enter to continue...')
                        continue
                    selected_tables = [tables_with_counts[i-1]['name'] for i in selected_indices]
                    break
                elif menu_entry_index == separator_index + 2:  # Select All
                    selected_indices = set(range(1, total_tables + 1))
                elif menu_entry_index == separator_index + 3:  # Clear All
                    selected_indices = set()
                elif menu_entry_index == separator_index + 4:  # Cancel
                    return []
                else:  # Toggle table selection (0-based to 1-based)
                    table_index = menu_entry_index + 1
                    if table_index in selected_indices:
                        selected_indices.remove(table_index)
                    else:
                        selected_indices.add(table_index)
            
            return selected_tables
            
        except KeyboardInterrupt:
            self.stdout.write(self.style.WARNING('\n\nOperation cancelled by user.'))
            return []
        except Exception as e:
            # If terminal menu fails, fallback to simple menu
            self.stdout.write(self.style.WARNING(
                f'\n⚠ GUI mode failed ({str(e)}), using simple menu instead...\n'
            ))
            return self.simple_interactive_menu(tables_with_counts)

    def simple_interactive_menu(self, tables_with_counts):
        """Simple interactive menu for table selection."""
        selected_tables = []
        selected_indices = set()
        
        while True:
            # Clear screen (optional, can be removed if causes issues)
            self.stdout.write('\n' + '=' * 70)
            self.stdout.write('SELECT TABLES TO TRUNCATE')
            self.stdout.write('=' * 70 + '\n')
            
            # Display tables with selection status
            for idx, table_info in enumerate(tables_with_counts, 1):
                table_name = table_info['name']
                row_count = table_info['count']
                count_str = f"{row_count:,} rows" if isinstance(row_count, int) else str(row_count)
                marker = '[✓]' if idx in selected_indices else '[ ]'
                self.stdout.write(f'  {marker} {idx:3d}. {table_name:40s} ({count_str})')
            
            self.stdout.write('\n' + '-' * 70)
            self.stdout.write(f'Selected: {len(selected_indices)} table(s)')
            self.stdout.write('-' * 70)
            self.stdout.write('\nCommands:')
            self.stdout.write('  - Enter number(s) to toggle selection (e.g., 1,3,5 or 1-5)')
            self.stdout.write('  - Type "all" to select all tables')
            self.stdout.write('  - Type "clear" to deselect all')
            self.stdout.write('  - Type "done" to confirm selection')
            self.stdout.write('  - Type "cancel" to exit\n')
            
            response = input('Your choice: ').strip().lower()
            
            if response == 'done':
                selected_tables = [tables_with_counts[i-1]['name'] for i in selected_indices]
                break
            elif response == 'cancel':
                return []
            elif response == 'all':
                selected_indices = set(range(1, len(tables_with_counts) + 1))
            elif response == 'clear':
                selected_indices = set()
            else:
                # Parse number input
                try:
                    # Handle ranges like "1-5" or individual numbers like "1,3,5"
                    parts = response.replace(' ', '').split(',')
                    for part in parts:
                        if '-' in part:
                            # Range
                            start, end = map(int, part.split('-'))
                            for num in range(start, end + 1):
                                if 1 <= num <= len(tables_with_counts):
                                    if num in selected_indices:
                                        selected_indices.remove(num)
                                    else:
                                        selected_indices.add(num)
                        else:
                            # Single number
                            num = int(part)
                            if 1 <= num <= len(tables_with_counts):
                                if num in selected_indices:
                                    selected_indices.remove(num)
                                else:
                                    selected_indices.add(num)
                except ValueError:
                    self.stdout.write(self.style.ERROR('Invalid input. Please try again.'))
                    input('Press Enter to continue...')
        
        return selected_tables

    def command_line_table_selection(self, tables_with_counts):
        """Command-line mode for table selection."""
        self.stdout.write('\nAvailable tables:')
        for idx, table_info in enumerate(tables_with_counts, 1):
            table_name = table_info['name']
            row_count = table_info['count']
            count_str = f"{row_count:,} rows" if isinstance(row_count, int) else str(row_count)
            self.stdout.write(f'  {idx}. {table_name} ({count_str})')
        
        self.stdout.write('\nEnter table numbers separated by commas (e.g., 1,3,5) or "all" for all tables:')
        response = input('Selection: ').strip()
        
        if response.lower() == 'all':
            return [t['name'] for t in tables_with_counts]
        
        try:
            indices = [int(x.strip()) - 1 for x in response.split(',')]
            selected = [tables_with_counts[i]['name'] for i in indices if 0 <= i < len(tables_with_counts)]
            return selected
        except (ValueError, IndexError):
            self.stdout.write(self.style.ERROR('Invalid selection.'))
            return []

    def handle(self, *args, **options):
        no_gui = options['no_gui']
        confirm = options['confirm']
        exclude_tables = set(options['exclude'] or [])
        list_only = options['list_only']
        
        # Get database engine
        db_engine = settings.DATABASES['default']['ENGINE']
        db_name = settings.DATABASES['default']['NAME']
        
        self.stdout.write(self.style.WARNING('=' * 70))
        self.stdout.write(self.style.WARNING('DATABASE TABLE TRUNCATION TOOL'))
        self.stdout.write(self.style.WARNING('=' * 70))
        self.stdout.write(f'\nDatabase: {db_name}')
        self.stdout.write(f'Engine: {db_engine}\n')
        
        # Get all table names
        tables = self.get_all_tables(db_engine)
        if tables is None:
            self.stdout.write(self.style.ERROR(f'Unsupported database engine: {db_engine}'))
            return
        
        # Filter out excluded tables
        available_tables = [t for t in tables if t not in exclude_tables]
        
        if not available_tables:
            self.stdout.write(self.style.WARNING('No tables available (all tables excluded).'))
            return
        
        # Get row counts for each table
        self.stdout.write('Fetching table information...')
        tables_with_counts = self.get_tables_with_counts(available_tables, db_engine)
        
        if list_only:
            self.stdout.write(f'\nAvailable tables ({len(tables_with_counts)}):')
            for table_info in tables_with_counts:
                count_str = f"{table_info['count']:,} rows" if isinstance(table_info['count'], int) else str(table_info['count'])
                self.stdout.write(f"  - {table_info['name']} ({count_str})")
            if exclude_tables:
                self.stdout.write(f'\nExcluded tables ({len(exclude_tables)}):')
                for table in sorted(exclude_tables):
                    self.stdout.write(f'  - {table}')
            return
        
        # Select tables to truncate
        if no_gui or not TERMINAL_MENU_AVAILABLE:
            selected_tables = self.command_line_table_selection(tables_with_counts)
        else:
            selected_tables = self.interactive_table_selection(tables_with_counts)
        
        if not selected_tables:
            self.stdout.write(self.style.WARNING('\nNo tables selected. Operation cancelled.'))
            return
        
        # Display selected tables
        self.stdout.write(f'\nSelected tables to truncate ({len(selected_tables)}):')
        for table in sorted(selected_tables):
            table_info = next((t for t in tables_with_counts if t['name'] == table), None)
            if table_info:
                count_str = f"{table_info['count']:,} rows" if isinstance(table_info['count'], int) else str(table_info['count'])
                self.stdout.write(f'  - {table} ({count_str})')
        
        # Confirmation prompt
        if not confirm:
            self.stdout.write(self.style.ERROR('\n' + '=' * 70))
            self.stdout.write(self.style.ERROR('WARNING: This will DELETE ALL DATA from the selected tables!'))
            self.stdout.write(self.style.ERROR('=' * 70))
            response = input('\nType "TRUNCATE" to confirm: ')
            
            if response != 'TRUNCATE':
                self.stdout.write(self.style.WARNING('\nOperation cancelled.'))
                return
        
        # Perform truncation
        self.stdout.write(self.style.WARNING('\nTruncating selected tables...'))
        
        try:
            with connection.cursor() as cursor:
                # Disable foreign key checks for MySQL
                if 'mysql' in db_engine.lower():
                    cursor.execute("SET FOREIGN_KEY_CHECKS = 0")
                
                truncated_count = 0
                errors = []
                
                for table in selected_tables:
                    try:
                        if 'mysql' in db_engine.lower():
                            cursor.execute(f"TRUNCATE TABLE `{table}`")
                        elif 'postgresql' in db_engine.lower():
                            cursor.execute(f'TRUNCATE TABLE "{table}" RESTART IDENTITY CASCADE')
                        elif 'sqlite' in db_engine.lower():
                            cursor.execute(f'DELETE FROM "{table}"')
                            cursor.execute(f"DELETE FROM sqlite_sequence WHERE name='{table}'")
                        
                        truncated_count += 1
                        self.stdout.write(f'  ✓ Truncated: {table}')
                    except Exception as e:
                        error_msg = f'  ✗ Error truncating {table}: {str(e)}'
                        self.stdout.write(self.style.ERROR(error_msg))
                        errors.append((table, str(e)))
                
                # Re-enable foreign key checks for MySQL
                if 'mysql' in db_engine.lower():
                    cursor.execute("SET FOREIGN_KEY_CHECKS = 1")
            
            # Summary
            self.stdout.write(self.style.SUCCESS(f'\n✓ Successfully truncated {truncated_count} table(s).'))
            
            if errors:
                self.stdout.write(self.style.ERROR(f'\n✗ {len(errors)} table(s) had errors:'))
                for table, error in errors:
                    self.stdout.write(self.style.ERROR(f'  - {table}: {error}'))
            
            self.stdout.write(self.style.SUCCESS('\nDone!'))
            
        except Exception as e:
            self.stdout.write(self.style.ERROR(f'\n✗ Fatal error: {str(e)}'))
            sys.exit(1)

