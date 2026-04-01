#!/bin/bash
# Setup script for testing new member notification behavior

echo "=========================================="
echo "Setting up test environment..."
echo "=========================================="

# Navigate to backend directory
cd "$(dirname "$0")"

# Create virtual environment if it doesn't exist
if [ ! -d "venv_test" ]; then
    echo "Creating virtual environment..."
    python3 -m venv venv_test
else
    echo "Virtual environment already exists."
fi

# Activate virtual environment
echo "Activating virtual environment..."
source venv_test/bin/activate

# Install requirements
echo "Installing requirements..."
pip install --upgrade pip
pip install -r requirements.txt

echo ""
echo "=========================================="
echo "Setup complete!"
echo "=========================================="
echo ""
echo "To run the test:"
echo "  1. source venv_test/bin/activate"
echo "  2. python test_new_member_retroactive_notifications.py"
echo ""
echo "Or run directly:"
echo "  ./run_test.sh"
