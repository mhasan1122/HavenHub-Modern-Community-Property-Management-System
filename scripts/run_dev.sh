#!/bin/bash

# Run both Django backend and Vite frontend development servers
# Usage: ./run_dev.sh

# Colors for output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}  Estate Link Development Server Runner${NC}"
echo -e "${BLUE}========================================${NC}"
echo ""

# Function to cleanup processes on exit
cleanup() {
    echo ""
    echo -e "${YELLOW}Shutting down servers...${NC}"
    if [ -n "$BACKEND_PID" ]; then
        kill $BACKEND_PID 2>/dev/null
        echo -e "${GREEN}✓ Backend server stopped${NC}"
    fi
    if [ -n "$FRONTEND_PID" ]; then
        kill $FRONTEND_PID 2>/dev/null
        echo -e "${GREEN}✓ Frontend server stopped${NC}"
    fi
    exit 0
}

# Set trap to cleanup on Ctrl+C
trap cleanup SIGINT SIGTERM

# Check if virtual environment exists for backend
if [ -d "backend/venv" ]; then
    source backend/venv/bin/activate
elif [ -d "backend/.venv" ]; then
    source backend/.venv/bin/activate
fi

cd backend

# Check and create database if it doesn't exist
echo -e "${BLUE}Checking database connection...${NC}"
if ! python -c "
import django
from django.conf import settings
from django.db import connection
from django.db.utils import OperationalError
try:
    connection.ensure_connection()
    print('DB_OK')
except OperationalError as e:
    if 'Unknown database' in str(e):
        print('DB_MISSING')
    else:
        print(f'DB_ERROR: {e}')
" 2>/dev/null | grep -q "DB_OK"; then
    echo -e "${YELLOW}Database 'estatelink-test' not found. Creating...${NC}"
    python -c "
import pymysql
conn = pymysql.connect(host='localhost', user='root', password='12345678', port=3306)
cursor = conn.cursor()
cursor.execute('CREATE DATABASE IF NOT EXISTS \`estatelink-test\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci')
conn.commit()
cursor.close()
conn.close()
print('Database created successfully')
"
    if [ $? -eq 0 ]; then
        echo -e "${GREEN}✓ Database created successfully${NC}"
    else
        echo -e "${RED}✗ Failed to create database. Please check MySQL is running and credentials are correct.${NC}"
        exit 1
    fi
else
    echo -e "${GREEN}✓ Database connection OK${NC}"
fi

echo ""

# Check for pending migrations
echo -e "${BLUE}Checking for pending migrations...${NC}"
MIGRATION_OUTPUT=$(python manage.py showmigrations --plan 2>/dev/null | grep "\[ \]" || true)

if [ -n "$MIGRATION_OUTPUT" ]; then
    echo -e "${YELLOW}Pending migrations found. Running migrate...${NC}"
    python manage.py migrate
    echo -e "${GREEN}✓ Migrations applied successfully${NC}"
else
    echo -e "${GREEN}✓ No pending migrations${NC}"
fi

echo ""

# Start Django backend server
echo -e "${GREEN}Starting Django backend server...${NC}"
python manage.py runserver &
BACKEND_PID=$!
cd ..

# Wait a moment for backend to start
sleep 2

# Start Vite frontend dev server
echo -e "${GREEN}Starting Vite frontend dev server...${NC}"
cd frontend
npm run dev &
FRONTEND_PID=$!
cd ..

echo ""
echo -e "${BLUE}========================================${NC}"
echo -e "${GREEN}Both servers are running!${NC}"
echo -e "${BLUE}========================================${NC}"
echo ""
echo -e "${YELLOW}Backend:${NC} http://127.0.0.1:8000/"
echo -e "${YELLOW}Frontend:${NC} http://localhost:5173/ (or check console output)"
echo ""
echo -e "${RED}Press Ctrl+C to stop both servers${NC}"
echo ""

# Wait for both processes
wait $BACKEND_PID $FRONTEND_PID
