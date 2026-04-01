#!/bin/bash
# Quick script to run the notification test

cd "$(dirname "$0")"

# Check if virtual environment exists
if [ ! -d "venv_test" ]; then
    echo "Virtual environment not found. Running setup..."
    ./setup_test_env.sh
fi

# Activate and run test
source venv_test/bin/activate
python test_new_member_retroactive_notifications.py
