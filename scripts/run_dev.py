#!/usr/bin/env python3
"""
Run both Django backend and Vite frontend development servers.
Usage: python run_dev.py
"""

import subprocess
import sys
import os
import signal
import time
from pathlib import Path

# Colors for terminal output
class Colors:
    GREEN = '\033[92m'
    BLUE = '\033[94m'
    RED = '\033[91m'
    YELLOW = '\033[93m'
    END = '\033[0m'

# Global process references
backend_process = None
frontend_process = None

def print_header():
    """Print the startup header."""
    print(f"{Colors.BLUE}{'='*40}{Colors.END}")
    print(f"{Colors.BLUE}  Estate Link Development Server Runner{Colors.END}")
    print(f"{Colors.BLUE}{'='*40}{Colors.END}")
    print()

def print_footer():
    """Print the running status footer."""
    print()
    print(f"{Colors.BLUE}{'='*40}{Colors.END}")
    print(f"{Colors.GREEN}Both servers are running!{Colors.END}")
    print(f"{Colors.BLUE}{'='*40}{Colors.END}")
    print()
    print(f"{Colors.YELLOW}Backend:{Colors.END} http://127.0.0.1:8000/")
    print(f"{Colors.YELLOW}Frontend:{Colors.END} http://localhost:5173/ (or check console output)")
    print()
    print(f"{Colors.RED}Press Ctrl+C to stop both servers{Colors.END}")
    print()

def cleanup(signum=None, frame=None):
    """Cleanup function to stop both servers."""
    print()
    print(f"{Colors.YELLOW}Shutting down servers...{Colors.END}")
    
    if backend_process:
        backend_process.terminate()
        try:
            backend_process.wait(timeout=5)
        except subprocess.TimeoutExpired:
            backend_process.kill()
        print(f"{Colors.GREEN}✓ Backend server stopped{Colors.END}")
    
    if frontend_process:
        frontend_process.terminate()
        try:
            frontend_process.wait(timeout=5)
        except subprocess.TimeoutExpired:
            frontend_process.kill()
        print(f"{Colors.GREEN}✓ Frontend server stopped{Colors.END}")
    
    sys.exit(0)

def get_venv_python():
    """Get the Python executable from virtual environment if it exists."""
    venv_paths = [
        Path("backend/venv/bin/python"),
        Path("backend/.venv/bin/python"),
        Path("backend/venv/Scripts/python.exe"),
        Path("backend/.venv/Scripts/python.exe"),
    ]
    
    for venv_path in venv_paths:
        if venv_path.exists():
            return str(venv_path)
    
    return sys.executable

def main():
    global backend_process, frontend_process
    
    # Set up signal handlers
    signal.signal(signal.SIGINT, cleanup)
    signal.signal(signal.SIGTERM, cleanup)
    
    print_header()
    
    # Get the project root directory
    project_root = Path(__file__).parent.absolute()
    backend_dir = project_root / "backend"
    frontend_dir = project_root / "frontend"
    
    # Check directories exist
    if not backend_dir.exists():
        print(f"{Colors.RED}Error: backend directory not found at {backend_dir}{Colors.END}")
        sys.exit(1)
    
    if not frontend_dir.exists():
        print(f"{Colors.RED}Error: frontend directory not found at {frontend_dir}{Colors.END}")
        sys.exit(1)
    
    python_exe = get_venv_python()
    
    # Check database connection and create if needed
    print(f"{Colors.BLUE}Checking database connection...{Colors.END}")
    try:
        # Try to check database connection
        check_db_script = """
import django
from django.conf import settings
settings.configure(
    DATABASES={
        'default': {
            'ENGINE': 'django.db.backends.mysql',
            'NAME': 'estatelink-test',
            'USER': 'root',
            'PASSWORD': '12345678',
            'HOST': 'localhost',
            'PORT': '3306',
        }
    },
    INSTALLED_APPS=[],
)
from django.db import connection
from django.db.utils import OperationalError
try:
    connection.ensure_connection()
    print('DB_OK')
except OperationalError as e:
    if 'Unknown database' in str(e) or "doesn't exist" in str(e):
        print('DB_MISSING')
    else:
        print(f'DB_ERROR: {e}')
"""
        result = subprocess.run(
            [python_exe, "-c", check_db_script],
            capture_output=True,
            text=True
        )
        
        if 'DB_MISSING' in result.stdout:
            print(f"{Colors.YELLOW}Database 'estatelink-test' not found. Creating...{Colors.END}")
            create_db_script = """
import pymysql
conn = pymysql.connect(host='localhost', user='root', password='12345678', port=3306)
cursor = conn.cursor()
cursor.execute("CREATE DATABASE IF NOT EXISTS `estatelink-test` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci")
conn.commit()
cursor.close()
conn.close()
print('DB_CREATED')
"""
            create_result = subprocess.run(
                [python_exe, "-c", create_db_script],
                capture_output=True,
                text=True
            )
            if create_result.returncode == 0 and 'DB_CREATED' in create_result.stdout:
                print(f"{Colors.GREEN}✓ Database created successfully{Colors.END}")
            else:
                print(f"{Colors.RED}✗ Failed to create database:{Colors.END}")
                print(create_result.stderr)
                sys.exit(1)
        elif 'DB_OK' in result.stdout:
            print(f"{Colors.GREEN}✓ Database connection OK{Colors.END}")
        else:
            print(f"{Colors.YELLOW}Could not verify database status, continuing...{Colors.END}")
    except Exception as e:
        print(f"{Colors.YELLOW}Could not check database: {e}{Colors.END}")
    
    print()
    
    # Check for pending migrations
    print(f"{Colors.BLUE}Checking for pending migrations...{Colors.END}")
    try:
        result = subprocess.run(
            [python_exe, "manage.py", "showmigrations", "--plan"],
            cwd=backend_dir,
            capture_output=True,
            text=True
        )
        
        # Check if there are any pending migrations (lines with "[ ]")
        pending_migrations = [line for line in result.stdout.split('\n') if '[ ]' in line]
        
        if pending_migrations:
            print(f"{Colors.YELLOW}Pending migrations found. Running migrate...{Colors.END}")
            migrate_result = subprocess.run(
                [python_exe, "manage.py", "migrate"],
                cwd=backend_dir,
                capture_output=True,
                text=True
            )
            if migrate_result.returncode == 0:
                print(f"{Colors.GREEN}✓ Migrations applied successfully{Colors.END}")
            else:
                print(f"{Colors.RED}Migration failed:{Colors.END}")
                print(migrate_result.stdout)
                print(migrate_result.stderr)
                sys.exit(1)
        else:
            print(f"{Colors.GREEN}✓ No pending migrations{Colors.END}")
    except Exception as e:
        print(f"{Colors.YELLOW}Could not check migrations: {e}{Colors.END}")
    
    print()
    
    # Start Django backend
    print(f"{Colors.GREEN}Starting Django backend server...{Colors.END}")
    try:
        backend_process = subprocess.Popen(
            [python_exe, "manage.py", "runserver"],
            cwd=backend_dir,
            stdout=subprocess.PIPE,
            stderr=subprocess.STDOUT,
            text=True,
            bufsize=1,
            universal_newlines=True
        )
    except Exception as e:
        print(f"{Colors.RED}Failed to start backend: {e}{Colors.END}")
        sys.exit(1)
    
    # Wait a moment for backend to initialize
    time.sleep(2)
    
    # Start Vite frontend
    print(f"{Colors.GREEN}Starting Vite frontend dev server...{Colors.END}")
    try:
        frontend_process = subprocess.Popen(
            ["npm", "run", "dev"],
            cwd=frontend_dir,
            stdout=subprocess.PIPE,
            stderr=subprocess.STDOUT,
            text=True,
            bufsize=1,
            universal_newlines=True
        )
    except Exception as e:
        print(f"{Colors.RED}Failed to start frontend: {e}{Colors.END}")
        cleanup()
        sys.exit(1)
    
    print_footer()
    
    # Monitor both processes and print output
    try:
        while True:
            # Check if processes are still running
            if backend_process.poll() is not None:
                print(f"{Colors.RED}Backend server exited unexpectedly!{Colors.END}")
                cleanup()
                break
            
            if frontend_process.poll() is not None:
                print(f"{Colors.RED}Frontend server exited unexpectedly!{Colors.END}")
                cleanup()
                break
            
            # Read and print output from backend
            if backend_process.stdout:
                line = backend_process.stdout.readline()
                if line:
                    print(f"[BACKEND] {line}", end='')
            
            # Read and print output from frontend
            if frontend_process.stdout:
                line = frontend_process.stdout.readline()
                if line:
                    print(f"[FRONTEND] {line}", end='')
            
            time.sleep(0.1)
            
    except KeyboardInterrupt:
        cleanup()

if __name__ == "__main__":
    main()
