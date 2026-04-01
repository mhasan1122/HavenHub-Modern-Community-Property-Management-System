#!/bin/bash

# PayStation Integration Test Script Runner
# This script sets up a virtual environment and runs the PayStation integration tests

set -e  # Exit on error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Script directory
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
cd "$SCRIPT_DIR"

echo -e "${BLUE}╔════════════════════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║   PayStation Integration Test Runner                  ║${NC}"
echo -e "${BLUE}╚════════════════════════════════════════════════════════╝${NC}"
echo ""

# Function to print colored messages
print_info() {
    echo -e "${BLUE}ℹ $1${NC}"
}

print_success() {
    echo -e "${GREEN}✓ $1${NC}"
}

print_error() {
    echo -e "${RED}✗ $1${NC}"
}

print_warning() {
    echo -e "${YELLOW}⚠ $1${NC}"
}

# Check if Python 3 is installed
if ! command -v python3 &> /dev/null; then
    print_error "Python 3 is not installed. Please install Python 3 first."
    exit 1
fi

PYTHON_VERSION=$(python3 --version)
print_success "Found $PYTHON_VERSION"

# Virtual environment name
VENV_DIR="venv"

# Check if virtual environment exists
if [ -d "$VENV_DIR" ]; then
    print_info "Virtual environment already exists at: $VENV_DIR"
else
    print_info "Creating virtual environment..."
    python3 -m venv "$VENV_DIR"
    print_success "Virtual environment created at: $VENV_DIR"
fi

# Activate virtual environment
print_info "Activating virtual environment..."
source "$VENV_DIR/bin/activate"
print_success "Virtual environment activated"

# Upgrade pip
print_info "Upgrading pip..."
pip install --upgrade pip -q
print_success "Pip upgraded"

# Check if requirements.txt exists
if [ -f "requirements.txt" ]; then
    print_info "Installing dependencies from requirements.txt..."
    pip install -r requirements.txt -q
    print_success "Dependencies installed"
else
    print_warning "requirements.txt not found. Installing minimal dependencies..."
    pip install django djangorestframework requests -q
    print_success "Minimal dependencies installed"
fi

# Check if Django is properly configured
print_info "Checking Django configuration..."
if python3 -c "import django; import os; os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'backend.settings'); django.setup()" 2>/dev/null; then
    print_success "Django configuration is valid"
else
    print_error "Django configuration error. Please check your settings."
    exit 1
fi

echo ""
echo -e "${BLUE}╔════════════════════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║   Running PayStation Integration Tests                ║${NC}"
echo -e "${BLUE}╚════════════════════════════════════════════════════════╝${NC}"
echo ""

# Run the test script
python3 test_paystation_integration.py

# Capture exit code
TEST_EXIT_CODE=$?

echo ""
if [ $TEST_EXIT_CODE -eq 0 ]; then
    echo -e "${GREEN}╔════════════════════════════════════════════════════════╗${NC}"
    echo -e "${GREEN}║   All tests completed successfully! ✓                 ║${NC}"
    echo -e "${GREEN}╚════════════════════════════════════════════════════════╝${NC}"
else
    echo -e "${RED}╔════════════════════════════════════════════════════════╗${NC}"
    echo -e "${RED}║   Some tests failed! ✗                                ║${NC}"
    echo -e "${RED}╚════════════════════════════════════════════════════════╝${NC}"
fi

# Keep virtual environment activated
echo ""
print_info "Virtual environment is still activated. To deactivate, run: deactivate"

exit $TEST_EXIT_CODE
