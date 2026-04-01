#!/bin/bash

# Estate Link - Cross-Platform (Linux/macOS) Starter
echo "==========================================="
echo "   ESTATE LINK - UNIX STARTER (Linux/Mac)  "
echo "==========================================="

# Get the directory where the script is located
BASEDIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"

# 1. Start Backend in Background
echo "[1/2] Starting Backend Server..."
cd "$BASEDIR/backend"

# Ensure virtual environment exists and activate it
source venv/bin/activate || { python3 -m venv venv && source venv/bin/activate; }

# Install dependencies, run migrations, and start server
pip install -r requirements.txt
python manage.py makemigrations
python manage.py migrate
python manage.py runserver &
BACKEND_PID=$!
echo "Backend started with PID: $BACKEND_PID"

# 2. Start Frontend
echo ""
echo "[2/2] Starting Frontend Server..."
cd "$BASEDIR/frontend"
npm run dev

# Cleanup background process on exit
trap "kill $BACKEND_PID" EXIT
