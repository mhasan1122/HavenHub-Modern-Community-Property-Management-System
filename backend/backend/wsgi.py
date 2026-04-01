"""
WSGI config for backend project.

It exposes the WSGI callable as a module-level variable named ``application``.

For more information on this file, see
https://docs.djangoproject.com/en/5.0/howto/deployment/wsgi/
"""
## Old wsgi

# import os

# from django.core.wsgi import get_wsgi_application

# os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'backend.settings')

# application = get_wsgi_application()


import os
import django
from django.core.wsgi import get_wsgi_application
import sys

# Ensure the project is in the Python path
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

# Set Django settings module environment variable
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'backend.settings')

# Setup Django first
django.setup()

# Populate permissions only if not in runserver and not in a management command
# This ensures permissions are populated in production WSGI servers but not during development
if 'runserver' not in sys.argv and len(sys.argv) <= 1:
    from group_role.auto_populate_permissions import AutoPopulatePermissions
    
    def run_populate_permissions():
        auto_populate = AutoPopulatePermissions()
        auto_populate.populate_permissions()
    
    run_populate_permissions()

# Get the WSGI application
application = get_wsgi_application()
