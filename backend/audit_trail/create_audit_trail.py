# utils/audit_trail.py
import json
from django.core.serializers.json import DjangoJSONEncoder
from .models import AuditTrail 

def create_audit_trail(member, event_type, table_name, row_id, new_data=None, old_data=None, description=''):
    # Convert dictionaries to JSON strings if needed.
    if isinstance(new_data, dict):
        new_data = json.dumps(new_data, cls=DjangoJSONEncoder)
    if isinstance(old_data, dict):
        old_data = json.dumps(old_data, cls=DjangoJSONEncoder)
    
    AuditTrail.objects.create(
        member=member,
        event_type=event_type,
        table_name=table_name,
        row_id=row_id,
        new_data=new_data,
        old_data=old_data,
        description=description,
    )
