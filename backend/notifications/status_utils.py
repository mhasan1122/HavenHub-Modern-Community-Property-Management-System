from django.apps import apps
from django.db.models import Q
import datetime

def get_entity_statuses_bulk(notifications):
    """
    Efficiently fetch statuses for a list of notifications in bulk.
    Returns a dictionary mapping (entity_type, entity_id) -> status.
    
    Status can be: 'active', 'deleted', 'expired', 'archived', 'unknown'
    """
    # Group entity IDs by type
    entity_ids = {}
    for notif in notifications:
        if not notif.entity_type or not notif.entity_id:
            continue
            
        if notif.entity_type not in entity_ids:
            entity_ids[notif.entity_type] = set()
        entity_ids[notif.entity_type].add(notif.entity_id)
    
    # Map to store results: (entity_type, entity_id) -> status
    results = {}
    
    # Get current time for expiry checks (naive datetime as per project settings)
    now = datetime.datetime.now()
    
    # Process each entity type
    for entity_type, ids in entity_ids.items():
        if not ids:
            continue
            
        model = None
        app_label = None
        model_name = None
        
        if entity_type == 'announcement':
            app_label = 'announcements'
            model_name = 'Announcement'
        elif entity_type == 'notice':
            app_label = 'noticeboard'
            model_name = 'Notice'
        elif entity_type == 'bulletin':
            app_label = 'bulletins'
            model_name = 'Bulletin'
        
        # If not one of our content types, assume active (e.g., member, payment)
        if not app_label or not model_name:
            for entity_id in ids:
                results[(entity_type, entity_id)] = 'active'
            continue
            
        try:
            model = apps.get_model(app_label, model_name)
            
            # Fetch all existing entities with their status fields if applicable
            fields_to_fetch = ['id']
            if entity_type in ['announcement', 'notice']:
                fields_to_fetch.extend(['status', 'end_date', 'end_time'])
            elif entity_type == 'bulletin':
                fields_to_fetch.append('status')
                
            entities = model.objects.filter(id__in=ids).values(*fields_to_fetch)
            
            # Create a map of found entities
            found_entities = {e['id']: e for e in entities}
            
            for entity_id in ids:
                if entity_id not in found_entities:
                    # Entity not found -> deleted
                    results[(entity_type, entity_id)] = 'deleted'
                else:
                    entity_data = found_entities[entity_id]
                    status = 'active'
                    
                    # Check specific status fields
                    if entity_type in ['announcement', 'notice']:
                        # Check stored status first
                        if entity_data.get('status') == 'expired':
                            status = 'expired'
                        else:
                            # Check for auto-expiry based on date/time
                            end_date = entity_data.get('end_date')
                            end_time = entity_data.get('end_time')
                            
                            if end_date and end_time:
                                end_datetime = datetime.datetime.combine(end_date, end_time)
                                if now > end_datetime:
                                    status = 'expired'
                                    
                    elif entity_type == 'bulletin':
                        if entity_data.get('status') == 'archive':
                            status = 'archived'
                            
                    results[(entity_type, entity_id)] = status
                    
        except LookupError:
            # Model not found, treat as unknown
            for entity_id in ids:
                results[(entity_type, entity_id)] = 'unknown'
        except Exception as e:
            # Error, treat as unknown
            print(f"Error fetching statuses for {entity_type}: {e}")
            for entity_id in ids:
                results[(entity_type, entity_id)] = 'unknown'
                
    return results
