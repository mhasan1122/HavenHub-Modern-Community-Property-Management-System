"""
Helper utilities for owner and contract management
"""
import logging

logger = logging.getLogger(__name__)


def get_primary_contract_owner(unit):
    """
    Get primary contract owner information from unit.
    
    CRITICAL: Only looks at unit's primary ownership contract
    Does NOT check resident or tenant information.
    
    Args:
        unit: Unit instance (towers.models.Unit)
    
    Returns:
        dict or None: {
            'owner_id': int,
            'owner_name': str,
            'owner_email': str,
            'owner_phone': str
        }
    """
    try:
        # Import here to avoid circular dependency
        from towers.models import Owner
        
        # Get primary owner (highest ownership percentage or most recent)
        primary_owner = Owner.objects.filter(
            unit=unit
        ).order_by('-ownership_percentage', '-id').first()
        
        if not primary_owner:
            logger.warning(f"No owner found for unit {unit.unit_name} (ID: {unit.id})")
            return None
        
        # Get member information from owner
        member = primary_owner.member
        if not member:
            logger.warning(f"Primary owner for unit {unit.unit_name} has no member record")
            return None
        
        # Use unit contact info (primary contact fields) instead of member fields
        return {
            'owner_id': primary_owner.id,
            'member_id': member.id,
            'owner_name': unit.primary_name or member.full_name or member.username or 'Unknown',
            'owner_email': unit.primary_email or member.general_email or member.email or '',
            'owner_phone': unit.primary_number or ''
        }
        
    except Exception as e:
        logger.error(f"Error getting owner info for unit {unit.id}: {str(e)}", exc_info=True)
        return None


def get_unit_owner_info_bulk(unit_ids):
    """
    Get owner information for multiple units efficiently (avoid N+1 queries).
    
    Args:
        unit_ids: List of unit IDs
    
    Returns:
        dict: {unit_id: owner_info_dict}
    """
    try:
        from towers.models import Owner, Unit
        from django.db.models import Max, OuterRef, Subquery
        
        logger.info(f"[OwnerHelper] Input unit_ids: {unit_ids} (type: {type(unit_ids)})")
        
        # Ensure unit_ids is a list of integers
        if isinstance(unit_ids, str):
            unit_ids = [int(x.strip()) for x in unit_ids.split(',') if x.strip().isdigit()]
        elif not isinstance(unit_ids, list):
            unit_ids = list(unit_ids)
        
        logger.info(f"[OwnerHelper] Converted unit_ids: {unit_ids}")
        
        # Get primary owner for each unit in a single query
        primary_owners_subquery = Owner.objects.filter(
            unit_id=OuterRef('id')
        ).order_by('-ownership_percentage', '-id').values('member_id')[:1]
        
        units = Unit.objects.filter(
            id__in=unit_ids
        ).select_related('owner_set__member').annotate(
            primary_owner_member_id=Subquery(primary_owners_subquery)
        )
        
        owner_info_map = {}
        
        # Build efficient query to get all owners at once
        owners = Owner.objects.filter(
            unit_id__in=unit_ids
        ).select_related('member', 'unit').order_by('unit_id', '-id')
        
        logger.info(f"[OwnerHelper] Fetching owners for {len(unit_ids)} units. Found {owners.count()} owner records.")
        
        # Group by unit_id and get first (primary) owner
        current_unit_id = None
        for owner in owners:
            if owner.unit_id != current_unit_id:
                # This is the primary owner for this unit
                current_unit_id = owner.unit_id
                member = owner.member
                unit = owner.unit
                
                if member and unit:
                    # Use unit primary contact fields
                    owner_info_map[owner.unit_id] = {
                        'owner_id': owner.id,
                        'member_id': member.id,
                        'owner_name': unit.primary_name  or 'Unknown',
                        'owner_email': unit.primary_email  or '',
                        'owner_phone': unit.primary_number or ''
                    }
                    logger.info(f"[OwnerHelper] Unit {owner.unit_id}: Found owner {unit.primary_name or member.full_name} (ID: {member.id})")
                else:
                    logger.warning(f"[OwnerHelper] Unit {owner.unit_id}: Owner record exists but no member or unit linked")
        
        logger.info(f"[OwnerHelper] Mapped {len(owner_info_map)} units to owners")
        return owner_info_map
        
    except Exception as e:
        logger.error(f"Error getting bulk owner info: {str(e)}", exc_info=True)
        return {}
