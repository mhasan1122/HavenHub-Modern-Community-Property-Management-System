#!/bin/bash

# SSH Login and Django Restart Script
# This script connects to the server via SSH and runs the restart command

echo "Connecting to server and restarting Django test environment..."
echo ""

ssh estatelink-api@69.62.81.148 "/home/estatelink-api/htdocs/api.estatelink.cloud/restart_django.sh"

echo ""
echo "Done!"