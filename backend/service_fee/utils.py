"""
Utility functions for service fee management
"""
from django.db.models import Q
from .models import ServiceFee
from towers.models import Unit, Tower


def check_service_fee_unit_integrity():
    """
    Check all service fees for broken unit references
    Returns a dict with issues found
    """
    issues = {
        'broken_unit_refs': [],
        'empty_assignments': [],
        'summary': {}
    }
    
    active_service_fees = ServiceFee.objects.filter(is_active=True)
    
    for service_fee in active_service_fees:
        # Check for broken unit references
        referenced_unit_ids = list(service_fee.units.values_list('id', flat=True))
        if referenced_unit_ids:
            existing_unit_ids = list(Unit.objects.filter(id__in=referenced_unit_ids).values_list('id', flat=True))
            missing_unit_ids = set(referenced_unit_ids) - set(existing_unit_ids)
            
            if missing_unit_ids:
                issues['broken_unit_refs'].append({
                    'service_fee_id': service_fee.id,
                    'missing_unit_ids': list(missing_unit_ids),
                    'existing_unit_ids': existing_unit_ids,
                    'has_tower_assignment': service_fee.towers.exists()
                })
        
        # Check for empty assignments
        if not service_fee.units.exists() and not service_fee.towers.exists():
            issues['empty_assignments'].append({
                'service_fee_id': service_fee.id,
                'fee_amount': service_fee.fee_amount,
                'created_at': service_fee.created_at
            })
    
    issues['summary'] = {
        'total_active_service_fees': active_service_fees.count(),
        'broken_unit_refs_count': len(issues['broken_unit_refs']),
        'empty_assignments_count': len(issues['empty_assignments'])
    }
    
    return issues


def get_service_fee_unit_details(service_fee_id):
    """
    Get detailed information about a service fee's unit assignments
    """
    try:
        service_fee = ServiceFee.objects.get(id=service_fee_id)
    except ServiceFee.DoesNotExist:
        return {'error': f'Service fee {service_fee_id} not found'}
    
    details = {
        'service_fee_id': service_fee.id,
        'is_active': service_fee.is_active,
        'fee_amount': service_fee.fee_amount,
        'towers': [],
        'units': [],
        'issues': []
    }
    
    # Get tower assignments
    for tower in service_fee.towers.all():
        tower_units = Unit.objects.filter(floor__tower=tower)
        details['towers'].append({
            'id': tower.id,
            'name': tower.tower_name,
            'unit_naming_type': tower.unit_naming_type,
            'total_units': tower_units.count(),
            'unit_names': [u.unit_name for u in tower_units[:10]]  # First 10 for preview
        })
    
    # Get unit assignments
    unit_ids = list(service_fee.units.values_list('id', flat=True))
    existing_units = Unit.objects.filter(id__in=unit_ids)
    
    for unit in existing_units:
        details['units'].append({
            'id': unit.id,
            'name': unit.unit_name,
            'floor_no': unit.floor.floor_no,
            'tower_name': unit.floor.tower.tower_name,
            'tower_id': unit.floor.tower.id
        })
    
    # Check for missing unit references
    existing_unit_ids = set(existing_units.values_list('id', flat=True))
    missing_unit_ids = set(unit_ids) - existing_unit_ids
    
    if missing_unit_ids:
        details['issues'].append({
            'type': 'missing_units',
            'message': f'References {len(missing_unit_ids)} units that no longer exist',
            'missing_unit_ids': list(missing_unit_ids)
        })
    
    # Check for empty assignments
    if not service_fee.units.exists() and not service_fee.towers.exists():
        details['issues'].append({
            'type': 'empty_assignment',
            'message': 'No towers or units assigned'
        })
    
    return details


def suggest_unit_mapping_for_service_fee(service_fee_id):
    """
    Suggest unit mappings for a service fee with broken references
    """
    try:
        service_fee = ServiceFee.objects.get(id=service_fee_id)
    except ServiceFee.DoesNotExist:
        return {'error': f'Service fee {service_fee_id} not found'}
    
    suggestions = {
        'service_fee_id': service_fee.id,
        'current_valid_units': [],
        'suggested_fixes': []
    }
    
    # Get current valid units
    valid_units = service_fee.units.all()
    for unit in valid_units:
        suggestions['current_valid_units'].append({
            'id': unit.id,
            'name': unit.unit_name,
            'tower': unit.floor.tower.tower_name,
            'floor': unit.floor.floor_no
        })
    
    # If service fee has tower assignments, suggest clearing unit assignments
    if service_fee.towers.exists():
        suggestions['suggested_fixes'].append({
            'type': 'clear_units',
            'description': 'Clear unit assignments since tower-level assignment exists',
            'action': 'service_fee.units.clear()'
        })
    
    # If service fee has partial unit assignments, suggest completing them
    elif valid_units.exists():
        towers_with_units = {}
        for unit in valid_units:
            tower_id = unit.floor.tower.id
            if tower_id not in towers_with_units:
                towers_with_units[tower_id] = {
                    'tower': unit.floor.tower,
                    'assigned_units': [],
                    'all_units': []
                }
            towers_with_units[tower_id]['assigned_units'].append(unit)
        
        for tower_id, data in towers_with_units.items():
            tower = data['tower']
            assigned_units = data['assigned_units']
            all_units = Unit.objects.filter(floor__tower=tower)
            
            assigned_count = len(assigned_units)
            total_count = all_units.count()
            
            if assigned_count < total_count:
                missing_units = all_units.exclude(id__in=[u.id for u in assigned_units])
                
                suggestions['suggested_fixes'].append({
                    'type': 'complete_tower_units',
                    'description': f'Add {missing_units.count()} missing units from {tower.tower_name}',
                    'tower_id': tower.id,
                    'tower_name': tower.tower_name,
                    'missing_unit_ids': list(missing_units.values_list('id', flat=True)),
                    'missing_unit_names': [u.unit_name for u in missing_units]
                })
    
    return suggestions
