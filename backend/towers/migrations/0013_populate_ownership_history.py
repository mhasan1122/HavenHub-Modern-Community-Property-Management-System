# Data migration to populate UnitOwnershipHistory from existing ownership data

from django.db import migrations
from collections import defaultdict
from datetime import datetime


def populate_ownership_history(apps, schema_editor):
    """
    Populate UnitOwnershipHistory table from existing Owner records.
    
    This migration:
    1. Groups owners by unit and date_of_ownership
    2. Creates initial ownership entries for the first owners
    3. Creates transfer entries for subsequent ownership changes
    4. Properly tracks ownership state - removes transferred owners
    5. HANDLES IMPLICIT TRANSFERS: When new owner has 100% without transfer_from set,
       automatically removes previous owners and creates transfer entry
    """
    Owner = apps.get_model('towers', 'Owner')
    Unit = apps.get_model('towers', 'Unit')
    UnitOwnershipHistory = apps.get_model('towers', 'UnitOwnershipHistory')
    
    # Clear existing history entries first (in case of re-run)
    UnitOwnershipHistory.objects.all().delete()
    
    print("\n🔄 Starting ownership history migration...")
    
    # Get all units that have owners
    units_with_owners = Unit.objects.filter(
        owner__isnull=False
    ).distinct()
    
    total_units = units_with_owners.count()
    print(f"📊 Found {total_units} units with ownership records")
    
    entries_created = 0
    
    for unit in units_with_owners:
        # Get all owners for this unit, ordered by date
        owners = Owner.objects.filter(unit=unit).select_related(
            'member', 'ownership_transfer_from'
        ).order_by('date_of_ownership', 'created_at')
        
        if not owners.exists():
            continue
        
        # Group owners by date_of_ownership
        owners_by_date = defaultdict(list)
        for owner in owners:
            owners_by_date[owner.date_of_ownership].append(owner)
        
        sorted_dates = sorted(owners_by_date.keys())
        
        # Track ownership state over time: member_id -> owner record
        current_ownership_state = {}
        
        for date_idx, ownership_date in enumerate(sorted_dates):
            date_owners = owners_by_date[ownership_date]
            is_initial = date_idx == 0
            
            # Convert date to datetime for entry_date (naive datetime for MySQL with USE_TZ=False)
            entry_datetime = datetime.combine(ownership_date, datetime.min.time())
            
            if is_initial:
                # Initial ownership entry
                entry_type = 'initial_ownership' if len(date_owners) == 1 else 'initial_ownership_list'
                
                if len(date_owners) == 1:
                    description = f"{date_owners[0].member.full_name} became the initial owner"
                else:
                    description = "Initial owners established"
                
                owners_data = []
                for owner in sorted(date_owners, key=lambda o: float(o.ownership_percentage), reverse=True):
                    owners_data.append({
                        'owner_id': owner.id,
                        'member_id': owner.member.id,
                        'name': owner.member.full_name,
                        'share': float(owner.ownership_percentage),
                        'purchase_date': owner.date_of_ownership.isoformat(),
                        'contact': owner.member.general_contact or '',
                        'email': owner.member.general_email or ''
                    })
                    current_ownership_state[owner.member.id] = owner
                
                UnitOwnershipHistory.objects.create(
                    unit=unit,
                    entry_type=entry_type,
                    entry_date=entry_datetime,
                    description="",  # No description text
                    ownership_state_before=[],  # No previous state for initial ownership
                    ownership_state_after=owners_data,  # Initial owners
                    owners=owners_data,  # Legacy field
                    created_by=None
                )
                entries_created += 1
            else:
                # This is a transfer or update
                # Calculate current total and new total
                current_total = sum(float(o.ownership_percentage) for o in current_ownership_state.values())
                new_owners_total = sum(float(o.ownership_percentage) for o in date_owners)
                
                # Check for explicit transfers (ownership_transfer_from is set)
                explicit_transfers = [o for o in date_owners if o.ownership_transfer_from]
                
                # Check for implicit transfers:
                # If a new owner has 100% and there are existing owners, it's an implicit transfer
                implicit_transfer = False
                members_to_remove = set()
                
                if not explicit_transfers and current_ownership_state:
                    # No explicit transfer_from set, but we have existing owners
                    # If new owner(s) have 100% or more, previous owners are replaced
                    if new_owners_total >= 100:
                        implicit_transfer = True
                        members_to_remove = set(current_ownership_state.keys())
                    # If total would exceed 100%, also treat as replacement
                    elif current_total + new_owners_total > 100:
                        implicit_transfer = True
                        members_to_remove = set(current_ownership_state.keys())
                
                # Build transfer entry data
                from_data = []
                to_data = []
                members_who_transferred_out = set()
                
                if explicit_transfers:
                    # Handle explicit transfers
                    for owner in explicit_transfers:
                        from_member_id = owner.ownership_transfer_from.id
                        members_who_transferred_out.add(from_member_id)
                        
                        # Get the share they had before transfer
                        if from_member_id in current_ownership_state:
                            prev_owner = current_ownership_state[from_member_id]
                            from_share = float(prev_owner.ownership_percentage)
                        else:
                            from_share = 100.0
                        
                        from_data.append({
                            'owner_id': current_ownership_state[from_member_id].id if from_member_id in current_ownership_state else None,
                            'name': owner.ownership_transfer_from.full_name,
                            'share': from_share
                        })
                        
                        to_data.append({
                            'owner_id': owner.id,
                            'name': owner.member.full_name,
                            'share': float(owner.ownership_percentage)
                        })
                        
                elif implicit_transfer:
                    # Handle implicit transfer - previous owners are being replaced
                    for member_id in members_to_remove:
                        prev_owner = current_ownership_state[member_id]
                        from_data.append({
                            'owner_id': prev_owner.id,
                            'name': prev_owner.member.full_name,
                            'share': float(prev_owner.ownership_percentage)
                        })
                        members_who_transferred_out.add(member_id)
                    
                    for owner in date_owners:
                        to_data.append({
                            'owner_id': owner.id,
                            'name': owner.member.full_name,
                            'share': float(owner.ownership_percentage)
                        })
                
                # Build complete ownership state BEFORE transfer
                ownership_state_before = []
                for member_id in current_ownership_state.keys():
                    prev_owner = current_ownership_state[member_id]
                    ownership_state_before.append({
                        'owner_id': prev_owner.id,
                        'member_id': prev_owner.member.id,
                        'name': prev_owner.member.full_name,
                        'share': float(prev_owner.ownership_percentage),
                        'purchase_date': prev_owner.date_of_ownership.isoformat(),
                        'contact': prev_owner.member.general_contact or '',
                        'email': prev_owner.member.general_email or ''
                    })
                
                # Create transfer entry if there was a transfer
                if from_data and to_data:
                    # Build complete ownership state AFTER transfer (before updating state)
                    ownership_state_after_transfer = []
                    # Include owners who are staying (not in members_who_transferred_out)
                    for member_id, owner in current_ownership_state.items():
                        if member_id not in members_who_transferred_out:
                            ownership_state_after_transfer.append({
                                'owner_id': owner.id,
                                'member_id': owner.member.id,
                                'name': owner.member.full_name,
                                'share': float(owner.ownership_percentage),
                                'purchase_date': owner.date_of_ownership.isoformat(),
                                'contact': owner.member.general_contact or '',
                                'email': owner.member.general_email or ''
                            })
                    # Add new owners
                    for owner in date_owners:
                        ownership_state_after_transfer.append({
                            'owner_id': owner.id,
                            'member_id': owner.member.id,
                            'name': owner.member.full_name,
                            'share': float(owner.ownership_percentage),
                            'purchase_date': owner.date_of_ownership.isoformat(),
                            'contact': owner.member.general_contact or '',
                            'email': owner.member.general_email or ''
                        })
                    
                    UnitOwnershipHistory.objects.create(
                        unit=unit,
                        entry_type='ownership_transfer',
                        entry_date=entry_datetime,
                        description="",  # No description text
                        ownership_state_before=ownership_state_before,
                        ownership_state_after=ownership_state_after_transfer,
                        transfer_from=from_data,  # Legacy field
                        transfer_to=to_data,  # Legacy field
                        owners=[],  # Legacy field
                        created_by=None
                    )
                    entries_created += 1
                
                # Update ownership state - REMOVE members who transferred out
                for member_id in members_who_transferred_out:
                    current_ownership_state.pop(member_id, None)
                
                # Add new owners to state
                for owner in date_owners:
                    current_ownership_state[owner.member.id] = owner
                
                # Create ownership state entry with ONLY current owners
                current_owners = list(current_ownership_state.values())
                entry_type = 'ownership_updated' if len(current_owners) == 1 else 'ownership_list_updated'
                
                # Build ownership state BEFORE this update (from previous entry or transfer)
                ownership_state_before_update = ownership_state_before if from_data and to_data else []
                if not ownership_state_before_update:
                    # If no transfer entry, get from last history entry
                    last_entry = UnitOwnershipHistory.objects.filter(unit=unit).order_by('-entry_date', '-created_at').first()
                    if last_entry and last_entry.ownership_state_after:
                        ownership_state_before_update = last_entry.ownership_state_after
                    elif last_entry and last_entry.owners:
                        ownership_state_before_update = last_entry.owners
                
                owners_data = []
                for owner in sorted(current_owners, key=lambda o: float(o.ownership_percentage), reverse=True):
                    owners_data.append({
                        'owner_id': owner.id,
                        'member_id': owner.member.id,
                        'name': owner.member.full_name,
                        'share': float(owner.ownership_percentage),
                        'purchase_date': owner.date_of_ownership.isoformat(),
                        'contact': owner.member.general_contact or '',
                        'email': owner.member.general_email or ''
                    })
                
                UnitOwnershipHistory.objects.create(
                    unit=unit,
                    entry_type=entry_type,
                    entry_date=entry_datetime,
                    description="",  # No description text
                    ownership_state_before=ownership_state_before_update,
                    ownership_state_after=owners_data,
                    owners=owners_data,  # Legacy field
                    created_by=None
                )
                entries_created += 1
    
    print(f"✅ Created {entries_created} ownership history entries for {total_units} units")


def reverse_populate_ownership_history(apps, schema_editor):
    """Reverse migration - delete all history entries."""
    UnitOwnershipHistory = apps.get_model('towers', 'UnitOwnershipHistory')
    count = UnitOwnershipHistory.objects.count()
    UnitOwnershipHistory.objects.all().delete()
    print(f"🗑️ Deleted {count} ownership history entries")


class Migration(migrations.Migration):

    dependencies = [
        ('towers', '0012_unitownershiphistory'),
    ]

    operations = [
        migrations.RunPython(
            populate_ownership_history,
            reverse_populate_ownership_history
        ),
    ]
