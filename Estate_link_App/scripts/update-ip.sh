#!/bin/bash

# Script to update IP address in React Native app configuration
# Run this script when your computer's IP address changes

echo "=== Estate Link App IP Update Script ==="

# Get current IP address
CURRENT_IP=$(ifconfig | grep "inet " | grep -v 127.0.0.1 | awk '{print $2}' | head -1)

if [ -z "$CURRENT_IP" ]; then
    echo "Error: Could not determine current IP address"
    exit 1
fi

echo "Current IP address: $CURRENT_IP"

# Check if IP is already configured
if grep -q "$CURRENT_IP" "src/utils/networkUtils.ts"; then
    echo "IP address $CURRENT_IP is already configured in networkUtils.ts"
else
    echo "Updating IP address in networkUtils.ts..."
    
    # Update the IP address in networkUtils.ts
    sed -i '' "s/http:\/\/192\.168\.0\.[0-9]*:8000/http:\/\/$CURRENT_IP:8000/g" "src/utils/networkUtils.ts"
    
    if [ $? -eq 0 ]; then
        echo "Successfully updated IP address to $CURRENT_IP in networkUtils.ts"
    else
        echo "Error: Failed to update IP address in networkUtils.ts"
        exit 1
    fi
fi

# Check Django settings
echo "Checking Django settings..."
if grep -q "$CURRENT_IP" "../backend/backend/settings.py"; then
    echo "IP address $CURRENT_IP is already in Django ALLOWED_HOSTS"
else
    echo "Adding IP address to Django ALLOWED_HOSTS..."
    
    # Add IP to Django settings
    sed -i '' "s/ALLOWED_HOSTS = \[/ALLOWED_HOSTS = ['$CURRENT_IP', /" "../backend/backend/settings.py"
    
    if [ $? -eq 0 ]; then
        echo "Successfully added IP address to Django ALLOWED_HOSTS"
    else
        echo "Error: Failed to update Django settings"
        exit 1
    fi
fi

echo "=== IP Update Complete ==="
echo "Please restart your Django server and React Native app for changes to take effect."
