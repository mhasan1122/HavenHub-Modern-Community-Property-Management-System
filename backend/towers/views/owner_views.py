from rest_framework.views import APIView
from rest_framework.permissions import IsAuthenticated
from django.db.models import Q
from rest_framework.response import Response
from rest_framework import status
from user.models import Member
from user.serializers import MemberSerializer
from towers.serializers.owner_serializers import MemberUnitOwnershipSerializer, OwnerSerializer,OwnerDetailSerializer,OwnerExcelUploadSerializer
from towers.models import Owner, OwnerDocs, UnitOwnershipHistory
from towers.serializers.tower_serializers import UnitSerializer
from towers.models import Unit, Resident, UnitStaff
from django.forms.models import model_to_dict
from audit_trail.create_audit_trail import create_audit_trail
from rest_framework import status
from django.shortcuts import get_object_or_404
from django.http import Http404
from django.db import transaction, IntegrityError, DatabaseError
from django.db.utils import OperationalError
from user.permissions import HasRequiredPermission
import pandas as pd
from datetime import date, datetime, timedelta
import time
from django.utils import timezone
from collections import defaultdict
import logging

logger = logging.getLogger(__name__)
class AddOwnerSearch(APIView):
    def get(self, request):
        search = request.GET.get("search", "").strip()
        unit_id = request.GET.get("unit_id")

        print(f"🔍 DEBUG: Search term: '{search}', Unit ID: {unit_id}")

        member_data = []

        # --- OWNERS ---
        owners = Owner.objects.select_related("member", "unit__floor__tower")
        if unit_id:
            owners = owners.filter(unit_id=unit_id)
        owners = owners.filter(
            Q(member__full_name__icontains=search)
        )
        print(f"🔍 DEBUG: Found {owners.count()} owners")
        for owner in owners:
            member_data.append({
                "id": owner.member.id,
                "full_name": owner.member.full_name,
                "tower": owner.unit.floor.tower.tower_name if owner.unit.floor and owner.unit.floor.tower else None,
                "unit": owner.unit.unit_name,
                "roles": ["Owner"]
            })

        # --- RESIDENTS ---
        residents = Resident.objects.filter(is_active=True).select_related("member", "unit__floor__tower")
        if unit_id:
            residents = residents.filter(unit_id=unit_id)
        residents = residents.filter(
            Q(member__full_name__icontains=search)
        )
        print(f"🔍 DEBUG: Found {residents.count()} residents")
        for resident in residents:
            # Determine the resident type based on is_resident_or_tenant flag
            resident_type = "Resident" if resident.is_resident_or_tenant else "Resident (Tenant)"
            member_data.append({
                "id": resident.member.id,
                "full_name": resident.member.full_name,
                "tower": resident.unit.floor.tower.tower_name if resident.unit.floor and resident.unit.floor.tower else None,
                "unit": resident.unit.unit_name,
                "roles": [f"{resident_type}"]
            })

        # --- UNIT STAFF ---
        unit_staff = UnitStaff.objects.filter(is_active=True).select_related("member", "unit__floor__tower")
        if unit_id:
            unit_staff = unit_staff.filter(unit_id=unit_id)
        unit_staff = unit_staff.filter(
            Q(member__full_name__icontains=search)
        )
        print(f"🔍 DEBUG: Found {unit_staff.count()} unit staff")
        for staff in unit_staff:
            member_data.append({
                "id": staff.member.id,
                "full_name": staff.member.full_name,
                "tower": staff.unit.floor.tower.tower_name if staff.unit.floor and staff.unit.floor.tower else None,
                "unit": staff.unit.unit_name,
                "roles": ["Unit Staff"]
            })

        # --- COMPANY MEMBERS ---
        from user.models import Company
        company_members = Company.objects.filter(company_name__icontains=search).select_related("member")
        print(f"🔍 DEBUG: Found {company_members.count()} company members")
        for company in company_members:
            # If company has a member, use the member's ID and name
            if company.member:
                if search.lower() in company.member.full_name.lower() or search.lower() in company.company_name.lower():
                    member_data.append({
                        "id": company.member.id,
                        "full_name": company.member.full_name,
                        "tower": None,
                        "unit": None,
                        "roles": ["Company"]
                    })
            # If company doesn't have a member, skip it (can't create owner without member)

        # --- ORG MEMBERS ---
        # Don't exclude org members even if they are already owners/residents/unit staff
        # They should appear in both categories
        org_members = Member.objects.filter(
            is_org_member=True
        ).filter(
            Q(full_name__icontains=search)
        )
        
        # Debug: Log org members found
        print(f"🔍 DEBUG: Found {org_members.count()} org members for search: '{search}'")
        
        # Debug: Show all org members with their details
        all_org_members = Member.objects.filter(is_org_member=True)
        print(f"🔍 DEBUG: All org members in database:")
        for member in all_org_members:
            print(f"  - {member.full_name} (ID: {member.id}, is_org_member: {member.is_org_member})")
        
        for member in org_members:
            print(f"🔍 DEBUG: Adding org member: {member.full_name} (ID: {member.id})")
            member_data.append({
                "id": member.id,
                "full_name": member.full_name,
                "tower": None,
                "unit": None,
                "roles": ["Management"]
            })

        # Debug: Log final response
        print(f"🔍 DEBUG: Final member_data count: {len(member_data)}")
        print(f"🔍 DEBUG: Final member_data: {member_data}")

        return Response({"member_data": member_data}, status=status.HTTP_200_OK)

class CreateOwner(APIView):
    permission_classes = [IsAuthenticated, HasRequiredPermission]
    required_permission_id = [16]  # ADD_OWNERSHIP permission
    
    def post(self, request):
        # Retry logic for deadlock handling
        max_retries = 3
        retry_delay = 0.1
        
        for attempt in range(max_retries):
            try:
                return self._create_owner_internal(request)
            except OperationalError as e:
                if 'Deadlock' in str(e) and attempt < max_retries - 1:
                    print(f"⚠️ Deadlock detected, retrying... (attempt {attempt + 1}/{max_retries})")
                    time.sleep(retry_delay * (attempt + 1))
                    continue
                else:
                    raise
    
    def _create_owner_internal(self, request):
        try:
            with transaction.atomic():
                member_id = request.data.get('member') 
                unit_id = request.data.get('unit') 

                if member_id and Owner.objects.filter(member=member_id,unit=unit_id).exists():
                    return Response(
                        {"error": "This member is already associated with an owner."},
                        status=status.HTTP_400_BAD_REQUEST
                    )
                
                # Get existing owners before adding new one
                unit = get_object_or_404(Unit, id=unit_id)
                existing_owners = list(Owner.objects.filter(unit=unit).select_related('member'))
                is_first_owner = len(existing_owners) == 0
                
                serializer = OwnerSerializer(data=request.data, context={'request': request})
                if serializer.is_valid():
                    owner = serializer.save()
                    owner_data = model_to_dict(owner)
                    
                    # If this owner was created through a transfer, set last_transfer_date
                    # For new owners created via transfer, date_of_ownership is the transfer date
                    transfer_from_id = request.data.get('ownership_transfer_from')
                    if transfer_from_id and transfer_from_id not in ('', 'null', 'None', None):
                        # This is a transfer - set last_transfer_date to the date_of_ownership (which is the transfer date from the form)
                        owner.last_transfer_date = owner.date_of_ownership
                        owner.save(update_fields=['last_transfer_date'])
                        print(f"📅 CreateOwner: Set last_transfer_date to {owner.date_of_ownership} for new owner {owner.member.full_name} (created via transfer)")
                    
                    # Get current user for history tracking
                    try:
                        current_member = Member.objects.get(user=request.user)
                    except Member.DoesNotExist:
                        current_member = None
                    
                    # Use noon (12:00 PM) to avoid timezone conversion issues
                    # Use timezone-naive datetime since USE_TZ = False in settings
                    from datetime import time as dt_time
                    
                    if is_first_owner:
                        # First owner - create initial ownership entry
                        # For initial ownership, use datetime.now() - the actual creation time when this entry is being created
                        # The purchase_date in owner_info still uses owner.date_of_ownership (the actual purchase date)
                        entry_date = datetime.now().replace(microsecond=0)  # Use current datetime, remove microseconds for consistency
                        print(f"📅 CreateOwner: Initial ownership - Using current datetime {entry_date} for entry_date (purchase_date: {owner.date_of_ownership})")
                        
                        # Use build_owner_data_with_attachments to include attachments
                        owner_info = UnitOwnershipHistory.build_owner_data_with_attachments(owner, request=request)
                        # Override purchase_date to use actual purchase date (not entry date)
                        owner_info['purchase_date'] = owner.date_of_ownership.isoformat()
                        
                        UnitOwnershipHistory.create_initial_ownership_entry(
                            unit=unit,
                            owners_data=[owner_info],
                            entry_date=entry_date,  # Use current datetime (when entry is created)
                            created_by=current_member
                        )
                    else:
                        # Additional owner being added
                        # Check if this is a transfer or just adding a co-owner
                        transfer_from_id = request.data.get('ownership_transfer_from')
                        is_transfer = transfer_from_id and transfer_from_id not in ('', 'null', 'None', None)
                        
                        entry_date = datetime.now().replace(microsecond=0)  # Use current datetime, remove microseconds for consistency
                        
                        if not is_transfer:
                            # This is a co-owner addition (not a transfer)
                            # Update the initial ownership entry to include this new co-owner
                            print(f"📅 CreateOwner: Co-owner addition - Updating initial ownership entry to include new owner")
                            
                            # Build complete list of all current owners (including the newly created one)
                            all_owners_data = []
                            all_current_owners = list(Owner.objects.filter(unit=unit).select_related('member'))
                            
                            for curr_owner in all_current_owners:
                                owner_info = UnitOwnershipHistory.build_owner_data_with_attachments(curr_owner, request=request)
                                owner_info['purchase_date'] = curr_owner.date_of_ownership.isoformat()
                                owner_info['is_joining'] = (curr_owner.id == owner.id)  # Mark new owner as joining
                                owner_info['is_leaving'] = False
                                all_owners_data.append(owner_info)
                            
                            # Find the most recent initial ownership entry and update it,
                            # or create a new one if none exists
                            # entry_type can be 'initial_ownership' (single owner) or 'initial_ownership_list' (multiple owners)
                            last_initial_entry = UnitOwnershipHistory.objects.filter(
                                unit=unit,
                                entry_type__in=['initial_ownership', 'initial_ownership_list']
                            ).order_by('-entry_date', '-created_at').first()
                            
                            if last_initial_entry:
                                # Update the existing initial entry with the new complete ownership state
                                last_initial_entry.owners = all_owners_data
                                last_initial_entry.ownership_state_after = all_owners_data
                                # Update entry_type to reflect multiple owners
                                last_initial_entry.entry_type = 'initial_ownership_list' if len(all_owners_data) > 1 else 'initial_ownership'
                                last_initial_entry.updated_by = current_member
                                last_initial_entry.save()
                                print(f"📅 CreateOwner: Updated initial ownership entry (type: {last_initial_entry.entry_type}) with {len(all_owners_data)} owners")
                            else:
                                # No initial entry exists, create one
                                UnitOwnershipHistory.create_initial_ownership_entry(
                                    unit=unit,
                                    owners_data=all_owners_data,
                                    entry_date=entry_date,
                                    created_by=current_member
                                )
                                print(f"📅 CreateOwner: Created new initial ownership entry with {len(all_owners_data)} owners")
                            
                            return Response( 
                                {"message": "Owner created successfully", "data": serializer.data}, 
                                status=status.HTTP_201_CREATED
                            )
                        
                        # This is a transfer - continue with transfer logic
                        transfer_date = owner.last_transfer_date or owner.date_of_ownership  # Store for reference
                        print(f"📅 CreateOwner: Transfer - Using current datetime {entry_date} for entry_date (transfer_date: {transfer_date})")
                        transferred_out_member_ids = set()
                        new_owner_share = float(owner.ownership_percentage)
                        
                        # Get the most recent history entry to see previous ownership state
                        last_history = UnitOwnershipHistory.objects.filter(unit=unit).order_by('-entry_date', '-created_at').first()
                        
                        # Build complete ownership state BEFORE (from last history entry)
                        ownership_state_before = []
                        if last_history and last_history.ownership_state_after:
                            # Use the complete state from last entry
                            ownership_state_before = last_history.ownership_state_after
                        elif last_history and last_history.owners:
                            # Fallback to legacy owners field
                            ownership_state_before = last_history.owners
                        else:
                            # No history - build from current existing owners
                            for existing_owner in existing_owners:
                                ownership_state_before.append({
                                    'owner_id': existing_owner.id,
                                    'member_id': existing_owner.member.id,
                                    'name': existing_owner.member.full_name,
                                    'share': float(existing_owner.ownership_percentage),
                                    'purchase_date': (existing_owner.last_transfer_date or existing_owner.date_of_ownership).isoformat(),
                                    'contact': existing_owner.member.general_contact or '',
                                    'email': existing_owner.member.general_email or '',
                                    'is_leaving': False,  # Will be updated below if they're leaving
                                    'is_joining': False
                                })
                        
                        # Add metadata to ownership_state_before to mark leaving owners
                        for prev_owner in ownership_state_before:
                            if prev_owner.get('member_id') in transferred_out_member_ids:
                                prev_owner['is_leaving'] = True
                            else:
                                prev_owner['is_leaving'] = False
                            prev_owner['is_joining'] = False
                        
                        # Handle explicit transfer_from
                        if transfer_from_id:
                            transfer_from_owner = next(
                                (o for o in existing_owners if o.member.id == int(transfer_from_id)),
                                None
                            )
                            
                            if transfer_from_owner:
                                # If 100% was transferred, mark the old owner as transferred out
                                prev_owner_data = next(
                                    (o for o in ownership_state_before if o.get('member_id') == int(transfer_from_id)),
                                    None
                                )
                                prev_share = float(prev_owner_data.get('share', 0)) if prev_owner_data else float(transfer_from_owner.ownership_percentage)
                                
                                if new_owner_share >= prev_share and prev_share == 100:
                                    transferred_out_member_ids.add(int(transfer_from_id))
                                    transfer_from_owner.delete()
                        
                        # IMPORTANT: Calculate the ownership state AFTER based on the transfer logic
                        # Since UpdateOwner and CreateOwner run in parallel, we CANNOT rely on the database
                        # state being up-to-date. Instead, we calculate the expected state based on the transfer.
                        
                        # Identify the SOURCE of the transfer - who is giving up their share
                        # The transfer_from_id tells us which owner is transferring to the new owner
                        # Handle empty string, None, or "null" as no transfer source
                        transfer_source_member_id = None
                        if transfer_from_id and transfer_from_id not in ('', 'null', 'None', None):
                            try:
                                transfer_source_member_id = int(transfer_from_id)
                            except (ValueError, TypeError):
                                transfer_source_member_id = None
                        
                        # IMPORTANT: Do NOT infer transfer source when adding co-owners
                        # Only process as a transfer if transfer_from_id is EXPLICITLY provided
                        # This prevents incorrectly deleting existing owners when adding multiple co-owners
                        if not transfer_source_member_id:
                            print(f"📊 CreateOwner: No transfer_from_id provided - treating as co-owner addition (not a transfer)")
                            # This is a co-owner addition, not a transfer - don't modify existing owners
                        
                        print(f"📊 CreateOwner: Transfer source member_id: {transfer_source_member_id}")
                        print(f"📊 CreateOwner: New owner share: {new_owner_share}%")
                        
                        actual_ownership_state_after = []
                        
                        # Process previous owners - calculate their new percentage after the transfer
                        for prev_owner_data in ownership_state_before:
                            member_id = prev_owner_data.get('member_id')
                            prev_share = float(prev_owner_data.get('share', 0))
                            
                            # If this owner was transferred out completely, skip them
                            if member_id in transferred_out_member_ids:
                                continue
                            
                            # Calculate new share:
                            # - If this owner is the SOURCE of the transfer, subtract new_owner_share
                            # - Otherwise, keep their share unchanged
                            calculated_share = prev_share
                            
                            if member_id == transfer_source_member_id:
                                # This owner is the source - subtract the transferred amount
                                calculated_share = prev_share - new_owner_share
                                print(f"📊 CreateOwner: {prev_owner_data.get('name')} is transferring {new_owner_share}%: {prev_share}% -> {calculated_share}%")
                            else:
                                print(f"📊 CreateOwner: {prev_owner_data.get('name')} keeps {prev_share}% (not the source)")
                            
                            # Handle source owner life cycle (delete if 0%, update if >0%)
                            if calculated_share <= 0:
                                transferred_out_member_ids.add(member_id)
                                try:
                                    owner_to_delete = Owner.objects.get(unit=unit, member_id=member_id)
                                    print(f"🗑️ CreateOwner: Deleting transfer source owner {prev_owner_data.get('name')} (fully transferred out)")
                                    owner_to_delete.delete()
                                except Owner.DoesNotExist:
                                    print(f"⚠️ CreateOwner: Transfer source owner {prev_owner_data.get('name')} already deleted")
                                continue
                            else:
                                if member_id == transfer_source_member_id:
                                    # Update source owner in database if they're staying with reduced share
                                    try:
                                        owner_to_update = Owner.objects.get(unit=unit, member_id=member_id)
                                        owner_to_update.ownership_percentage = calculated_share
                                        owner_to_update.save(update_fields=['ownership_percentage'])
                                        print(f"📊 CreateOwner: Updated source owner {prev_owner_data.get('name')} share to {calculated_share}% in DB")
                                    except Owner.DoesNotExist:
                                        print(f"⚠️ CreateOwner: Source owner {prev_owner_data.get('name')} not found in DB to update share")
                            
                            # Get updated info from database for contact details
                            try:
                                current_owner_obj = Owner.objects.select_related('member').get(
                                    unit=unit, 
                                    member_id=member_id
                                )
                                actual_ownership_state_after.append({
                                    'owner_id': current_owner_obj.id,
                                    'member_id': member_id,
                                    'name': current_owner_obj.member.full_name,
                                    'share': calculated_share,  # Use CALCULATED share, not database value
                                    'purchase_date': (current_owner_obj.last_transfer_date or current_owner_obj.date_of_ownership).isoformat(),
                                    'contact': current_owner_obj.member.general_contact or '',
                                    'email': current_owner_obj.member.general_email or '',
                                    'is_leaving': False,  # Owner is staying
                                    'is_joining': False  # Not a new owner
                                })
                            except Owner.DoesNotExist:
                                # Owner was deleted, skip
                                continue
                        
                        # Add the new owner (joining)
                        actual_ownership_state_after.append({
                            'owner_id': owner.id,
                            'member_id': owner.member.id,
                            'name': owner.member.full_name,
                            'share': new_owner_share,  # The new owner's share
                            'purchase_date': (owner.last_transfer_date or owner.date_of_ownership).isoformat(),
                            'contact': owner.member.general_contact or '',
                            'email': owner.member.general_email or '',
                            'is_leaving': False,  # New owner is not leaving
                            'is_joining': True  # Metadata: this is a new owner joining
                        })
                        
                        # Sort by share descending
                        actual_ownership_state_after = sorted(actual_ownership_state_after, key=lambda x: x.get('share', 0), reverse=True)
                        
                        # Log for debugging
                        print(f"📊 CreateOwner: CALCULATED ownership state after transfer:")
                        for o in actual_ownership_state_after:
                            print(f"  - {o['name']}: {o['share']}%")
                        
                        # Enrich ownership states with attachments using build_owner_data_with_attachments
                        # This ensures attachments are included in the history entries
                        enriched_ownership_state_before = []
                        for prev_owner in ownership_state_before:
                            owner_id = prev_owner.get('owner_id')
                            if owner_id:
                                try:
                                    owner_obj = Owner.objects.get(id=owner_id)
                                    owner_data = UnitOwnershipHistory.build_owner_data_with_attachments(owner_obj, request=request)
                                    # Preserve calculated share and metadata
                                    owner_data['share'] = float(prev_owner.get('share', 0))
                                    owner_data['is_leaving'] = prev_owner.get('is_leaving', False)
                                    owner_data['is_joining'] = False
                                    enriched_ownership_state_before.append(owner_data)
                                except Owner.DoesNotExist:
                                    # Owner was deleted, use original data
                                    enriched_ownership_state_before.append(prev_owner)
                            else:
                                enriched_ownership_state_before.append(prev_owner)
                        
                        enriched_ownership_state_after = []
                        for curr_owner in actual_ownership_state_after:
                            owner_id = curr_owner.get('owner_id')
                            if owner_id:
                                try:
                                    owner_obj = Owner.objects.get(id=owner_id)
                                    owner_data = UnitOwnershipHistory.build_owner_data_with_attachments(owner_obj, request=request)
                                    # Preserve calculated share and metadata
                                    owner_data['share'] = float(curr_owner.get('share', 0))
                                    owner_data['is_leaving'] = curr_owner.get('is_leaving', False)
                                    is_new_owner = owner_id not in [o.get('owner_id') for o in ownership_state_before if o.get('owner_id')]
                                    owner_data['is_joining'] = is_new_owner
                                    enriched_ownership_state_after.append(owner_data)
                                except Owner.DoesNotExist:
                                    # Owner was deleted, use original data
                                    enriched_ownership_state_after.append(curr_owner)
                            else:
                                enriched_ownership_state_after.append(curr_owner)
                        
                        # Build legacy from/to data for backward compatibility
                        # from_data should show the transfer source owner with their ORIGINAL share (before transfer)
                        # and other owners with their unchanged shares
                        from_data = []
                        for prev_owner in enriched_ownership_state_before:
                            from_data.append({
                                'owner_id': prev_owner.get('owner_id'),
                                'member_id': prev_owner.get('member_id'),
                                'name': prev_owner.get('name', ''),
                                'share': float(prev_owner.get('share', 0)),
                                'is_leaving': prev_owner.get('is_leaving', False),
                                'is_joining': False
                            })
                        
                        # to_data should show all owners AFTER the transfer with their updated shares
                        to_data = []
                        for curr_owner in enriched_ownership_state_after:
                            to_data.append({
                                'owner_id': curr_owner.get('owner_id'),
                                'member_id': curr_owner.get('member_id'),
                                'name': curr_owner.get('name', ''),
                                'share': float(curr_owner.get('share', 0)),
                                'is_leaving': curr_owner.get('is_leaving', False),
                                'is_joining': curr_owner.get('is_joining', False)
                            })
                        
                        # Create transfer entry - this shows the complete transfer with before/after states
                        if enriched_ownership_state_before and enriched_ownership_state_after:
                            UnitOwnershipHistory.create_transfer_entry(
                                unit=unit,
                                from_owners=from_data,  # Legacy
                                to_owners=to_data,  # Legacy
                                entry_date=entry_date,
                                created_by=current_member,
                                ownership_state_before=enriched_ownership_state_before,  # Use enriched state with attachments
                                ownership_state_after=enriched_ownership_state_after  # Use enriched state with attachments
                            )
                            
                            # Create "Ownership List Updated" entry showing the final state
                            # This entry appears ABOVE the transfer entry (later timestamp)
                            ownership_list_entry_date = entry_date + timedelta(seconds=1)
                            print(f"📅 CreateOwner: Creating ownership list entry with entry_date: {ownership_list_entry_date}")
                            UnitOwnershipHistory.create_ownership_state_entry(
                                unit=unit,
                                owners_data=enriched_ownership_state_after,
                                entry_date=ownership_list_entry_date,
                                created_by=current_member,
                                ownership_state_before=enriched_ownership_state_before
                            )
                    
                    # Check if we should skip individual notification (for batch operations)
                    skip_notification = request.data.get('skip_notification', 'false').lower() == 'true'
                    
                    # Create notifications for managers with "View Unit Resident" permission
                    if not skip_notification:
                        try:
                            from notifications.utils import create_owner_added_notification
                            create_owner_added_notification(owner, creator=current_member)
                        except Exception as e:
                            logger.error(f"Error creating owner notifications: {str(e)}")
                            # Don't fail the request if notification creation fails
                    
                    # Create self-notification for the newly added owner
                    # All owners should receive a "You were added as owner" notification
                    try:
                        from notifications.utils import create_owner_added_self_notification
                        create_owner_added_self_notification(owner)
                    except Exception as e:
                        logger.error(f"Error creating self-owner notification: {str(e)}")
                        # Don't fail the request if notification creation fails
                    
                    return Response( 
                        {"message": "Owner created successfully", "data": serializer.data}, 
                        status=status.HTTP_201_CREATED
                    )
                    
                return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
        except IntegrityError as e:
            # Handle unique constraint violations
            if "UNIQUE constraint failed" in str(e) or "duplicate key value" in str(e):
                return Response(
                    {"error": "This member is already an owner for this unit."},
                    status=status.HTTP_400_BAD_REQUEST
                )
            return Response(
                {"error": f"Database integrity error: {str(e)}"},
                status=status.HTTP_400_BAD_REQUEST
            )
        except Exception as e:
            return Response(
                {"error": f"An unexpected error occurred: {str(e)}"},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )


class BulkCreateOwner(APIView):
    """
    Bulk create multiple owners for a unit in a single request.
    Creates a single notification with all owner names instead of separate notifications.
    """
    permission_classes = [IsAuthenticated, HasRequiredPermission]
    required_permission_id = [16]  # ADD_OWNERSHIP permission
    
    def post(self, request):
        """
        Expected payload:
        {
            "unit": <unit_id>,
            "owners": [
                {
                    "member": <member_id>,
                    "ownership_percentage": <percentage>,
                    "date_of_ownership": "<YYYY-MM-DD>",
                    "owner_docs_upload": [<file_objects>]  # Optional
                },
                ...
            ]
        }
        """
        try:
            with transaction.atomic():
                unit_id = request.data.get('unit')
                owners_data = request.data.get('owners', [])
                
                if not unit_id:
                    return Response(
                        {"error": "Unit ID is required"},
                        status=status.HTTP_400_BAD_REQUEST
                    )
                
                if not owners_data or len(owners_data) == 0:
                    return Response(
                        {"error": "At least one owner is required"},
                        status=status.HTTP_400_BAD_REQUEST
                    )
                
                # Get the unit
                unit = get_object_or_404(Unit, id=unit_id)
                
                # Check if unit already has owners
                existing_owners = Owner.objects.filter(unit=unit)
                if existing_owners.exists():
                    return Response(
                        {"error": "Cannot add new owners. Please go to Change Ownership page to modify owners."},
                        status=status.HTTP_400_BAD_REQUEST
                    )
                
                # Get current user for history tracking
                try:
                    current_member = Member.objects.get(user=request.user)
                except Member.DoesNotExist:
                    current_member = None
                
                # Validate and create all owners
                created_owners = []
                errors = []
                
                for idx, owner_data in enumerate(owners_data):
                    member_id = owner_data.get('member')
                    
                    # Check if member already exists as owner
                    if Owner.objects.filter(member_id=member_id, unit=unit).exists():
                        errors.append({
                            "index": idx,
                            "member_id": member_id,
                            "error": "This member is already an owner for this unit"
                        })
                        continue
                    
                    # Validate required fields
                    if not member_id or not owner_data.get('ownership_percentage'):
                        errors.append({
                            "index": idx,
                            "error": "member and ownership_percentage are required"
                        })
                        continue
                    
                    # Create owner
                    try:
                        serializer = OwnerSerializer(
                            data={
                                'member': member_id,
                                'unit': unit_id,
                                'ownership_percentage': owner_data.get('ownership_percentage'),
                                'date_of_ownership': owner_data.get('date_of_ownership')
                            },
                            context={'request': request}
                        )
                        
                        if serializer.is_valid():
                            owner = serializer.save()
                            created_owners.append(owner)
                        else:
                            errors.append({
                                "index": idx,
                                "member_id": member_id,
                                "errors": serializer.errors
                            })
                    except Exception as e:
                        errors.append({
                            "index": idx,
                            "member_id": member_id,
                            "error": str(e)
                        })
                
                # If no owners were created successfully, return error
                if len(created_owners) == 0:
                    return Response(
                        {
                            "error": "No owners were created",
                            "details": errors
                        },
                        status=status.HTTP_400_BAD_REQUEST
                    )
                
                # Create ownership history entry for all owners (initial ownership)
                entry_date = datetime.now().replace(microsecond=0)
                all_owners_data = []
                
                for owner in created_owners:
                    owner_info = UnitOwnershipHistory.build_owner_data_with_attachments(owner, request=request)
                    owner_info['purchase_date'] = owner.date_of_ownership.isoformat()
                    all_owners_data.append(owner_info)
                
                # Create initial ownership entry
                UnitOwnershipHistory.create_initial_ownership_entry(
                    unit=unit,
                    owners_data=all_owners_data,
                    entry_date=entry_date,
                    created_by=current_member
                )
                
                # Create a single notification for all owners (for managers)
                try:
                    from notifications.utils import create_bulk_owner_added_notification
                    create_bulk_owner_added_notification(created_owners, creator=current_member)
                except Exception as e:
                    logger.error(f"Error creating bulk owner notifications: {str(e)}")
                    # Don't fail the request if notification creation fails
                
                # Create self-notifications for ALL newly added owners
                # Each owner should receive a "You were added as owner" notification
                for owner in created_owners:
                    try:
                        from notifications.utils import create_owner_added_self_notification
                        create_owner_added_self_notification(owner)
                    except Exception as e:
                        logger.error(f"Error creating self-owner notification for {owner.member.full_name}: {str(e)}")
                
                # Return success response
                return Response(
                    {
                        "message": f"{len(created_owners)} owner(s) created successfully",
                        "created": len(created_owners),
                        "failed": len(errors),
                        "errors": errors if errors else None
                    },
                    status=status.HTTP_201_CREATED
                )
                
        except Exception as e:
            return Response(
                {"error": f"An unexpected error occurred: {str(e)}"},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )


class UpdateOwner(APIView):
    permission_classes = [IsAuthenticated, HasRequiredPermission]
    required_permission_id = [17]  # CHANGE_OWNERSHIP permission
    
    def put(self, request, owner_id):
        print("🛬 Incoming Update Owner request data:")
        print(dict(request.data))  # Print all incoming form data
        
        # Log the ownership_percentage specifically
        incoming_percentage = request.data.get('ownership_percentage')
        print(f"📊 Incoming ownership_percentage: {incoming_percentage}")

        # First check if owner exists (don't retry on 404)
        try:
            owner = Owner.objects.select_related('unit', 'member').get(id=owner_id)
        except Owner.DoesNotExist:
            # Check if owner ever existed or was deleted
            print(f"⚠️ Owner {owner_id} not found. Checking if it was recently deleted...")
            return Response(
                {
                    "error": f"Owner with ID {owner_id} not found. The owner may have been deleted or the ID is incorrect.",
                    "detail": "No Owner matches the given query."
                },
                status=status.HTTP_404_NOT_FOUND
            )
        
        unit = owner.unit
        
        # Capture old values before update
        old_percentage = float(owner.ownership_percentage)
        old_transfer_from = owner.ownership_transfer_from
        print(f"📊 BEFORE update - Owner {owner.member.full_name}: {old_percentage}%")
        
        # Retry logic for deadlock handling
        max_retries = 3
        retry_delay = 0.1  # 100ms
        
        for attempt in range(max_retries):
            try:
                with transaction.atomic():
                    # Re-fetch owner inside transaction to ensure it still exists
                    try:
                        owner = Owner.objects.get(id=owner_id)
                    except Owner.DoesNotExist:
                        return Response(
                            {"error": "Owner not found. The owner may have been deleted."},
                            status=status.HTTP_404_NOT_FOUND
                        )
                    
                    print(f"📊 Owner percentage before serializer.save(): {owner.ownership_percentage}")
                    
                    # Update serializer with fresh owner instance
                    serializer = OwnerSerializer(owner, data=request.data, context={'request': request}, partial=True)
                    if not serializer.is_valid():
                        print("❌ Validation errors:", serializer.errors)
                        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
                    
                    # Log validated data (safely to avoid Member.__str__ error if user is None)
                    safe_validated_data = {k: (v.id if hasattr(v, 'id') else v) for k, v in serializer.validated_data.items()}
                    print(f"📊 Validated data: {safe_validated_data}")
                    
                    updated_owner = serializer.save()
                    owner_name = updated_owner.member.full_name if updated_owner.member else "Unknown"
                    print(f"📊 AFTER serializer.save() - Owner {owner_name}: {updated_owner.ownership_percentage}%")
                    
                    # Verify the database was actually updated
                    owner_from_db = Owner.objects.get(id=owner_id)
                    verified_owner_name = owner_from_db.member.full_name if owner_from_db.member else "Unknown"
                    print(f"📊 VERIFIED from DB - Owner {verified_owner_name}: {owner_from_db.ownership_percentage}%")
                    
                    print(f"✅ Owner updated successfully: id={updated_owner.id}, percentage={updated_owner.ownership_percentage}%")
                    
                    # Check if ownership percentage or transfer_from changed
                    new_percentage = float(updated_owner.ownership_percentage)
                    new_transfer_from = updated_owner.ownership_transfer_from
                    
                    # Calculate percentage changes
                    percentage_decreased = new_percentage < old_percentage
                    percentage_increased = new_percentage > old_percentage
                    
                    # IMPORTANT: Create history when:
                    # 1. transfer_from is set AND (transfer_from changed OR percentage increased)
                    #    This handles cases where the same source transfers more shares
                    # 2. Skip if percentage decreased without transfer_from (source owner, recipient creates history)
                    
                    # Check if this is a transfer that needs history
                    is_transfer_receiving = new_transfer_from and (new_transfer_from != old_transfer_from or percentage_increased)
                    
                    if is_transfer_receiving:
                        # This is a receiving owner - create history (handled below)
                        pass
                    elif percentage_decreased and not new_transfer_from:
                        # This is a transferring owner (percentage decreased, no transfer_from set)
                        # Don't create history - the receiving owner will create it
                        print(f"📊 UpdateOwner: Owner {updated_owner.member.full_name} percentage decreased from {old_percentage}% to {new_percentage}% without transfer_from. Skipping history creation - receiving owner will create the entry.")
                        
                        # Create notification for the user if they changed themselves
                        try:
                            current_member = Member.objects.get(user=request.user)
                            if updated_owner.member.id == current_member.id:
                                from notifications.utils import create_owner_changed_self_notification
                                create_owner_changed_self_notification(updated_owner, old_percentage=old_percentage, new_percentage=new_percentage)
                        except Exception as e:
                            logger.error(f"Error creating self-owner change notification: {str(e)}")
                        
                        return Response({
                            "message": "Owner updated successfully.",
                            "data": OwnerSerializer(updated_owner, context={'request': request}).data
                        }, status=status.HTTP_200_OK)
                    
                    if is_transfer_receiving:
                        # Calculate transferred amount for use in the history creation
                        transferred_amount = new_percentage - old_percentage
                        
                        # Check if this is an internal transfer (transfer_from is an existing owner of the same unit)
                        is_internal_transfer = False
                        transfer_from_owner_obj = None
                        source_original_percentage = None  # Capture source's ORIGINAL percentage before any updates
                        try:
                            transfer_from_owner_obj = Owner.objects.get(unit=unit, member=new_transfer_from)
                            is_internal_transfer = True
                            
                            # Get source's CURRENT percentage from the LAST HISTORY ENTRY's "after" state
                            # This is the most reliable source of truth for the state before THIS transfer
                            # If there was a previous transfer from this same source in this batch, it will have 
                            # updated the source's percentage and created a history entry, so we should use that 
                            # "after" state as our "before" state for this transfer
                            # CRITICAL: Check for recent transfers from the same source (within last 5 seconds)
                            # to handle parallel requests where multiple recipients receive from the same source
                            recent_cutoff = datetime.now() - timedelta(seconds=5)
                            last_history_for_source = UnitOwnershipHistory.objects.filter(
                                unit=unit,
                                entry_type='ownership_transfer',
                                created_at__gte=recent_cutoff
                            ).order_by('-entry_date', '-created_at').first()
                            
                            # Also check the most recent history entry regardless of time (for sequential transfers)
                            if not last_history_for_source:
                                last_history_for_source = UnitOwnershipHistory.objects.filter(unit=unit).order_by('-entry_date', '-created_at').first()
                            
                            # ALWAYS refresh from DB first to get the most current value
                            # This ensures we have the latest state even if another request updated it
                            transfer_from_owner_obj.refresh_from_db()
                            db_current_percentage = float(transfer_from_owner_obj.ownership_percentage)
                            
                            # Then check if there's a recent history entry that shows a different state
                            # This handles the case where a transfer was just processed but the DB hasn't been updated yet
                            if last_history_for_source and last_history_for_source.ownership_state_after:
                                # Find source owner in the last history entry's after state
                                # This represents the source's percentage AFTER the last transfer (which is BEFORE this transfer)
                                for owner_data in last_history_for_source.ownership_state_after:
                                    if owner_data.get('member_id') == new_transfer_from.id:
                                        history_percentage = float(owner_data.get('share', 0))
                                        # Use history percentage if it's different from DB (more recent)
                                        # This handles parallel requests where one updated the history but not the DB yet
                                        if abs(history_percentage - db_current_percentage) > 0.01:
                                            source_original_percentage = history_percentage
                                            print(f"📊 UpdateOwner: Using history entry percentage {source_original_percentage}% (DB shows {db_current_percentage}%, history is more recent)")
                                        else:
                                            source_original_percentage = db_current_percentage
                                            print(f"📊 UpdateOwner: Using DB percentage {source_original_percentage}% (matches history)")
                                        break
                            
                            # If not found in history, use the refreshed DB value
                            if source_original_percentage is None:
                                source_original_percentage = db_current_percentage
                                print(f"📊 UpdateOwner: Using source current DB value (refreshed) as 'before' state: {source_original_percentage}%")
                            
                            print(f"📊 UpdateOwner: Internal transfer detected - {new_transfer_from.full_name} (original: {source_original_percentage}%) -> {updated_owner.member.full_name}")
                        except Owner.DoesNotExist:
                            # Not an internal transfer (transfer_from is not an existing owner)
                            print(f"📊 UpdateOwner: External transfer detected - {new_transfer_from.full_name} -> {updated_owner.member.full_name}")
                        
                        # Extract transfer date early so we can use it for duplicate checking and entry creation
                        # CRITICAL: For internal transfers, we MUST use the user-selected transfer date from the request,
                        # NOT the original purchase date (updated_owner.date_of_ownership), as that would be incorrect.
                        # Priority: 1) request.data (raw - user-selected date), 2) serializer.validated_data (parsed)
                        # DO NOT fall back to updated_owner.date_of_ownership for transfers - that's the original purchase date!
                        transfer_date = None
                        transfer_date_source = None
                        
                        # First, try to get from request.data (the date sent by user - this is the TRANSFER date)
                        transfer_date_str = request.data.get('date_of_ownership')
                        print(f"📅 UpdateOwner: Raw date from request.data: '{transfer_date_str}'")
                        
                        if transfer_date_str:
                            try:
                                # Try parsing different date formats that the frontend might send
                                from datetime import datetime as dt
                                # Try DD-MMM-YYYY format first (what formatDate returns: "24-Dec-2025")
                                try:
                                    transfer_date = dt.strptime(transfer_date_str, '%d-%b-%Y').date()
                                    transfer_date_source = "request.data (DD-MMM-YYYY - TRANSFER DATE)"
                                except ValueError:
                                    # Try YYYY-MM-DD format (ISO format)
                                    try:
                                        transfer_date = dt.strptime(transfer_date_str, '%Y-%m-%d').date()
                                        transfer_date_source = "request.data (YYYY-MM-DD - TRANSFER DATE)"
                                    except ValueError:
                                        # Try DD MMM YYYY format (e.g., "24 Dec 2025")
                                        try:
                                            transfer_date = dt.strptime(transfer_date_str, '%d %b %Y').date()
                                            transfer_date_source = "request.data (DD MMM YYYY - TRANSFER DATE)"
                                        except ValueError:
                                            # If all parsing fails, try serializer validated_data
                                            raise ValueError(f"Unable to parse date format: {transfer_date_str}")
                                print(f"📅 UpdateOwner: Successfully parsed TRANSFER date from {transfer_date_source}: {transfer_date}")
                            except (ValueError, TypeError, AttributeError) as e:
                                print(f"⚠️ UpdateOwner: Failed to parse date from request.data '{transfer_date_str}': {e}")
                                # Fall through to try validated_data
                        
                        # If parsing from request.data failed, try serializer validated_data (already parsed by serializer)
                        if not transfer_date and 'date_of_ownership' in serializer.validated_data:
                            # Check if it's a date object or string
                            validated_date = serializer.validated_data['date_of_ownership']
                            if isinstance(validated_date, date):
                                transfer_date = validated_date
                            elif isinstance(validated_date, str):
                                # Try to parse it
                                from datetime import datetime as dt
                                try:
                                    transfer_date = dt.strptime(validated_date, '%Y-%m-%d').date()
                                except ValueError:
                                    try:
                                        transfer_date = dt.strptime(validated_date, '%d-%b-%Y').date()
                                    except ValueError:
                                        pass
                            transfer_date_source = "serializer.validated_data (TRANSFER DATE)"
                            print(f"📅 UpdateOwner: Got transfer date from {transfer_date_source}: {transfer_date} (type: {type(transfer_date)})")
                        
                        # CRITICAL: For transfers, DO NOT fall back to updated_owner.date_of_ownership
                        # That is the ORIGINAL PURCHASE DATE, not the transfer date!
                        # If we still don't have a date, use today's date as a safe fallback
                        if not transfer_date:
                            print(f"⚠️ UpdateOwner: WARNING - No transfer date found in request! Using current date as fallback.")
                            print(f"⚠️ UpdateOwner: This should not happen - the frontend should always send date_of_ownership for transfers.")
                            transfer_date = date.today()
                            transfer_date_source = "FALLBACK (current date - transfer date not provided)"
                        
                        print(f"📅 UpdateOwner: Final TRANSFER date: {transfer_date} (source: {transfer_date_source})")
                        print(f"📅 UpdateOwner: This date will be used for BOTH transfer entry and ownership update entry")
                        
                        # REMOVED: Duplicate detection that was preventing separate transfers
                        # Each transfer should create its own history entry, even if done quickly
                        # The frontend validation already prevents duplicate submissions
                        should_create_history = True
                        
                        # Get current user for history tracking
                        try:
                            current_member = Member.objects.get(user=request.user)
                        except Member.DoesNotExist:
                            current_member = None
                        
                        # Use current datetime for history entry (when entry is created) - same as initial ownership
                        # The transfer_date is stored in owner.last_transfer_date and will be shown in the frontend
                        entry_date = datetime.now().replace(microsecond=0)  # Use current datetime, remove microseconds for consistency
                        print(f"📅 UpdateOwner: Using current datetime {entry_date} for entry_date (transfer_date: {transfer_date})")
                        
                        # Handle internal transfer using helper method
                        if is_internal_transfer and transfer_from_owner_obj:
                            try:
                                # Use helper method to calculate ownership state after transfer
                                # Pass transfer_date so recipient's purchase_date uses transfer date instead of original date
                                transfer_result = UnitOwnershipHistory.calculate_ownership_state_after_transfer(
                                    unit=unit,
                                    transfer_from_owner_id=transfer_from_owner_obj.id,
                                    transfer_to_owner_id=updated_owner.id,
                                    transfer_share=transferred_amount,
                                    transfer_date=transfer_date
                                )
                                
                                ownership_state_before = transfer_result['ownership_state_before']
                                ownership_state_after = transfer_result['ownership_state_after']
                                should_delete_source = transfer_result['should_delete_source']
                                source_owner = transfer_result['source_owner']
                                recipient_owner = transfer_result['recipient_owner']
                                
                                # IMPORTANT: Fix ownership_state_before to use the ORIGINAL percentages
                                # The helper method read from DB after serializer.save() and possibly after
                                # the source owner was already updated, so both shares may be wrong.
                                
                                # Fix recipient's share: The helper read 70% but original was 50%
                                # We captured the true original value in old_percentage at the start of this function
                                for owner_data in ownership_state_before:
                                    if owner_data.get('member_id') == updated_owner.member.id:
                                        wrong_before_share = owner_data.get('share', 0)
                                        owner_data['share'] = old_percentage
                                        print(f"📊 UpdateOwner: Corrected ownership_state_before for recipient {updated_owner.member.full_name}: {wrong_before_share}% -> {old_percentage}%")
                                        break
                                
                                # Use the CURRENT percentage from history or DB (before THIS transfer)
                                # If there was a previous transfer from this source in the same batch, 
                                # source_original_percentage will be from the last history entry's "after" state
                                # Otherwise, it's from the current DB value
                                source_original = source_original_percentage if source_original_percentage is not None else float(source_owner.ownership_percentage)
                                
                                # IMPORTANT: For multiple recipients from the same source, each entry should show:
                                # - Source's "before" = current state at the start of THIS transfer
                                # - Source's "after" = current state - amount transferred in THIS entry only
                                # This ensures each entry shows only the transfer amount for that specific recipient
                                source_new_share = source_original - transferred_amount  # After THIS transfer only
                                print(f"📊 UpdateOwner: Source {new_transfer_from.full_name} - before this transfer: {source_original}%, after this transfer: {source_new_share}% (transferred {transferred_amount}% in this entry)")
                                
                                # Ensure ownership_state_before has the correct source share
                                for owner_data in ownership_state_before:
                                    if owner_data.get('member_id') == new_transfer_from.id:
                                        wrong_source_share = owner_data.get('share', 0)
                                        if abs(wrong_source_share - source_original) > 0.01:
                                            owner_data['share'] = source_original
                                            print(f"📊 UpdateOwner: Corrected ownership_state_before for source {new_transfer_from.full_name}: {wrong_source_share}% -> {source_original}%")
                                        break
                                
                                # Determine if source should be deleted based on their share AFTER the transfer
                                correct_should_delete_source = source_new_share <= 0.01
                                if correct_should_delete_source != should_delete_source:
                                    print(f"📊 UpdateOwner: Corrected should_delete_source: {should_delete_source} -> {correct_should_delete_source} (source has {source_new_share}% after transfer)")
                                    should_delete_source = correct_should_delete_source
                                
                                # ALWAYS update is_leaving flag in ownership_state_before for the source owner
                                for owner_data in ownership_state_before:
                                    if owner_data.get('member_id') == new_transfer_from.id:
                                        owner_data['is_leaving'] = should_delete_source
                                        print(f"📊 UpdateOwner: Set is_leaving for {new_transfer_from.full_name} to {should_delete_source}")
                                        break
                                
                                # Also fix ownership_state_after for source owner
                                if should_delete_source:
                                    # Source is leaving - remove from ownership_state_after if present
                                    ownership_state_after = [o for o in ownership_state_after if o.get('member_id') != new_transfer_from.id]
                                    print(f"📊 UpdateOwner: Removed leaving source owner {new_transfer_from.full_name} from ownership_state_after")
                                else:
                                    # Source is staying - fix their share to the NEW share after transfer
                                    for owner_data in ownership_state_after:
                                        if owner_data.get('member_id') == new_transfer_from.id:
                                            wrong_after_share = owner_data.get('share', 0)
                                            if abs(wrong_after_share - source_new_share) > 0.01:
                                                owner_data['share'] = source_new_share
                                                print(f"📊 UpdateOwner: Corrected ownership_state_after for source {new_transfer_from.full_name}: {wrong_after_share}% -> {source_new_share}%")
                                            break
                                
                                # Update source owner's percentage and last_transfer_date
                                # The frontend does NOT update the source - we need to do it here
                                # Use .filter().update() which safely returns 0 if no rows found
                                
                                # Store source owner name before any DB operations that might fail
                                source_owner_name = new_transfer_from.full_name if new_transfer_from else "Unknown"
                                source_owner_id = source_owner.id if source_owner else None
                                
                                if source_owner_id:
                                    if not should_delete_source:
                                        # Source owner stays - update their percentage and last_transfer_date
                                        # IMPORTANT: When multiple recipients receive from the same source in parallel,
                                        # we need to use a database-level update that subtracts the transfer amount
                                        # to avoid race conditions. However, since we're already calculating the
                                        # correct new share (source_original - transferred_amount), we can just update it.
                                        # The refresh_from_db() above ensures we have the current value.
                                        update_data = {'ownership_percentage': source_new_share}
                                        if transfer_date:
                                            update_data['last_transfer_date'] = transfer_date
                                        
                                        rows_updated = Owner.objects.filter(id=source_owner_id).update(**update_data)
                                        if rows_updated > 0:
                                            print(f"📊 UpdateOwner: Updated source owner {source_owner_name}: {source_original}% -> {source_new_share}% (transferred {transferred_amount}% in this entry)")
                                        else:
                                            print(f"⚠️ UpdateOwner: Source owner {source_owner_name} (id={source_owner_id}) no longer exists")
                                    else:
                                        # Source owner is leaving (0% remaining) - delete them
                                        # First set last_transfer_date so DeleteOwner can use it if needed
                                        if transfer_date:
                                            Owner.objects.filter(id=source_owner_id).update(last_transfer_date=transfer_date)
                                        
                                        # Delete source owner
                                        deleted_count, _ = Owner.objects.filter(id=source_owner_id).delete()
                                        if deleted_count > 0:
                                            print(f"🗑️ UpdateOwner: Deleted source owner {source_owner_name} (transferred out all {source_original}%)")
                                        else:
                                            print(f"⚠️ UpdateOwner: Source owner {source_owner_name} (id={source_owner_id}) was already deleted")
                                
                                # Update recipient owner's last_transfer_date ONLY
                                # NOTE: Do NOT update ownership_percentage - the frontend already calculated the correct
                                # final percentage and the serializer already saved it. Recalculating here would cause
                                # double-counting (the helper method adds transfer_share to current DB value, but
                                # the current DB value already includes the transfer amount from serializer.save()).
                                # The frontend sends: existingOwnership + transferAmount = finalPercentage
                                # The serializer saves: finalPercentage (correct)
                                # If we recalculate: currentDB (finalPercentage) + transferAmount = WRONG double-count
                                recipient_updated = False
                                update_fields = []
                                
                                # Skip percentage update - serializer already saved the correct value from frontend
                                # The frontend calculates: original% + transfer% = new% (e.g., 50% + 20% = 70%)
                                # Serializer saved this 70% already. Don't recalculate.
                                correct_recipient_percentage = float(updated_owner.ownership_percentage)
                                print(f"📊 UpdateOwner: Recipient {updated_owner.member.full_name} percentage already updated by serializer to {correct_recipient_percentage}% (skipping recalculation to avoid double-count)")
                                
                                # IMPORTANT: Fix ownership_state_after to use the correct recipient percentage
                                # The helper method calculated wrong percentages because it read from DB after serializer.save()
                                # We need to correct the recipient's share in ownership_state_after
                                for owner_data in ownership_state_after:
                                    if owner_data.get('member_id') == updated_owner.member.id:
                                        old_wrong_share = owner_data.get('share', 0)
                                        owner_data['share'] = correct_recipient_percentage
                                        print(f"📊 UpdateOwner: Corrected ownership_state_after for {updated_owner.member.full_name}: {old_wrong_share}% -> {correct_recipient_percentage}%")
                                        break
                                
                                # Set last_transfer_date to the transfer date (from the form)
                                if transfer_date:
                                    updated_owner.last_transfer_date = transfer_date
                                    update_fields.append('last_transfer_date')
                                    recipient_updated = True
                                    print(f"📅 UpdateOwner: Set last_transfer_date to {transfer_date} for {updated_owner.member.full_name}")
                                
                                if recipient_updated and update_fields:
                                    # Use savepoint to isolate this operation in case the owner was deleted
                                    sid = transaction.savepoint()
                                    try:
                                        updated_owner.save(update_fields=update_fields)
                                        transaction.savepoint_commit(sid)
                                    except (DatabaseError, Owner.DoesNotExist) as e:
                                        transaction.savepoint_rollback(sid)
                                        print(f"⚠️ UpdateOwner: Could not update recipient owner (likely deleted by concurrent request): {e}")
                                
                                # CRITICAL: For each transfer entry, we should ONLY show the source and the specific recipient
                                # This ensures that when one source transfers to multiple recipients, each entry shows:
                                # - Source: before = state at start of THIS transfer, after = state after THIS transfer
                                # - Recipient: before = state at start of THIS transfer, after = state after THIS transfer
                                # The amounts MUST match: source's decrease = recipient's increase
                                
                                # Build from/to data with ONLY the source and this specific recipient
                                # CRITICAL: The source MUST be in ownership_state_before for this to be a valid internal transfer
                                from_data = []
                                source_owner_data = next(
                                    (o for o in ownership_state_before if o.get('member_id') == new_transfer_from.id),
                                    None
                                )
                                
                                if not source_owner_data:
                                    error_msg = f"Source owner {new_transfer_from.full_name} not found in ownership_state_before. This should be an internal transfer, but source is missing. Cannot create history entry."
                                    print(f"❌ UpdateOwner: {error_msg}")
                                    return Response(
                                        {"error": error_msg},
                                        status=status.HTTP_400_BAD_REQUEST
                                    )
                                
                                if source_owner_data:
                                    # Source's share BEFORE this transfer (already corrected above)
                                    source_before_share = source_original
                                    # Source's share AFTER this transfer (only for this recipient's portion)
                                    source_after_share = source_new_share
                                    
                                    from_data.append({
                                        'owner_id': source_owner_data.get('owner_id'),
                                        'member_id': new_transfer_from.id,
                                        'name': source_owner_data.get('name', new_transfer_from.full_name),
                                        'share': source_before_share,  # Before THIS transfer
                                        'is_leaving': should_delete_source,
                                        'contact': source_owner_data.get('contact', ''),
                                        'email': source_owner_data.get('email', ''),
                                        'purchase_date': source_owner_data.get('purchase_date', '')
                                    })
                                
                                # Find the recipient in ownership_state_after
                                recipient_owner_data = next(
                                    (o for o in ownership_state_after if o.get('member_id') == updated_owner.member.id),
                                    None
                                )
                                
                                if not recipient_owner_data:
                                    error_msg = f"Recipient owner {updated_owner.member.full_name} not found in ownership_state_after. Cannot create history entry."
                                    print(f"❌ UpdateOwner: {error_msg}")
                                    return Response(
                                        {"error": error_msg},
                                        status=status.HTTP_400_BAD_REQUEST
                                    )
                                
                                to_data = []
                                if recipient_owner_data:
                                    # Recipient's share BEFORE this transfer
                                    recipient_before_share = old_percentage
                                    # Recipient's share AFTER this transfer
                                    recipient_after_share = correct_recipient_percentage
                                    
                                    # Calculate transfer amounts
                                    source_transferred = source_before_share - source_after_share
                                    recipient_received = recipient_after_share - recipient_before_share
                                    
                                    # Use the transferred_amount from the request as the source of truth
                                    # This ensures consistency even if there are slight calculation differences
                                    actual_transfer_amount = transferred_amount
                                    
                                    # Validate that amounts are reasonable (within 1% tolerance)
                                    # This allows for floating point precision issues while still catching real errors
                                    if abs(source_transferred - actual_transfer_amount) > 1.0:
                                        error_msg = f"Source transferred amount ({source_transferred}%) differs significantly from request amount ({actual_transfer_amount}%). Cannot create history entry."
                                        print(f"❌ UpdateOwner: {error_msg}")
                                        return Response(
                                            {"error": error_msg},
                                            status=status.HTTP_400_BAD_REQUEST
                                        )
                                    
                                    if abs(recipient_received - actual_transfer_amount) > 1.0:
                                        error_msg = f"Recipient received amount ({recipient_received}%) differs significantly from request amount ({actual_transfer_amount}%). Cannot create history entry."
                                        print(f"❌ UpdateOwner: {error_msg}")
                                        return Response(
                                            {"error": error_msg},
                                            status=status.HTTP_400_BAD_REQUEST
                                        )
                                    
                                    # Use the request amount as the authoritative value
                                    # Adjust source_after_share and recipient_after_share to match exactly
                                    source_after_share = source_before_share - actual_transfer_amount
                                    recipient_after_share = recipient_before_share + actual_transfer_amount
                                    
                                    print(f"📊 UpdateOwner: Using request amount {actual_transfer_amount}% as authoritative. Adjusted: Source {source_before_share}% → {source_after_share}%, Recipient {recipient_before_share}% → {recipient_after_share}%")
                                    
                                    to_data.append({
                                        'owner_id': recipient_owner_data.get('owner_id'),
                                        'member_id': updated_owner.member.id,
                                        'name': recipient_owner_data.get('name', updated_owner.member.full_name),
                                        'share': recipient_after_share,  # After THIS transfer
                                        'is_joining': recipient_owner_data.get('is_joining', False),
                                        'contact': recipient_owner_data.get('contact', ''),
                                        'email': recipient_owner_data.get('email', ''),
                                        'purchase_date': recipient_owner_data.get('purchase_date', '')
                                    })
                                
                                # Create filtered ownership states that ONLY include source and recipient
                                # This ensures each entry shows only the relevant owners for THIS specific transfer
                                filtered_ownership_state_before = []
                                filtered_ownership_state_after = []
                                
                                # Add source to before state
                                # Use source_original which is the correct "before" state for THIS transfer
                                if source_owner_data:
                                    filtered_ownership_state_before.append({
                                        'owner_id': source_owner_data.get('owner_id'),
                                        'member_id': new_transfer_from.id,
                                        'name': source_owner_data.get('name', new_transfer_from.full_name),
                                        'share': source_before_share,  # This is source_original, already corrected above
                                        'purchase_date': source_owner_data.get('purchase_date', ''),
                                        'contact': source_owner_data.get('contact', ''),
                                        'email': source_owner_data.get('email', ''),
                                        'is_leaving': should_delete_source
                                    })
                                    print(f"📊 UpdateOwner: Source in filtered before state: {source_before_share}% (should be current state at start of THIS transfer)")
                                
                                # Add recipient to before state
                                recipient_before_data = next(
                                    (o for o in ownership_state_before if o.get('member_id') == updated_owner.member.id),
                                    None
                                )
                                if recipient_before_data:
                                    filtered_ownership_state_before.append({
                                        'owner_id': recipient_before_data.get('owner_id'),
                                        'member_id': updated_owner.member.id,
                                        'name': recipient_before_data.get('name', updated_owner.member.full_name),
                                        'share': recipient_before_share,
                                        'purchase_date': recipient_before_data.get('purchase_date', ''),
                                        'contact': recipient_before_data.get('contact', ''),
                                        'email': recipient_before_data.get('email', ''),
                                        'is_leaving': False
                                    })
                                
                                # Add source to after state (if not leaving)
                                # Use the corrected source_after_share that matches the transfer amount
                                if not should_delete_source and source_owner_data:
                                    filtered_ownership_state_after.append({
                                        'owner_id': source_owner_data.get('owner_id'),
                                        'member_id': new_transfer_from.id,
                                        'name': source_owner_data.get('name', new_transfer_from.full_name),
                                        'share': source_after_share,  # Already adjusted to match transfer amount
                                        'purchase_date': source_owner_data.get('purchase_date', ''),
                                        'contact': source_owner_data.get('contact', ''),
                                        'email': source_owner_data.get('email', ''),
                                        'is_leaving': False
                                    })
                                
                                # Add recipient to after state
                                # Use the corrected recipient_after_share that matches the transfer amount
                                if recipient_owner_data:
                                    filtered_ownership_state_after.append({
                                        'owner_id': recipient_owner_data.get('owner_id'),
                                        'member_id': updated_owner.member.id,
                                        'name': recipient_owner_data.get('name', updated_owner.member.full_name),
                                        'share': recipient_after_share,  # Already adjusted to match transfer amount
                                        'purchase_date': recipient_owner_data.get('purchase_date', ''),
                                        'contact': recipient_owner_data.get('contact', ''),
                                        'email': recipient_owner_data.get('email', ''),
                                        'is_joining': recipient_owner_data.get('is_joining', False)
                                    })
                                
                                # IMPORTANT: Recalculate ownership_state_after from current database state
                                # This ensures we have ALL owners with correct percentages, even when transfers happen quickly
                                # The helper method might have missed some owners or have stale data
                                print(f"📊 UpdateOwner: Recalculating ownership_state_after from current database state...")
                                all_owners_after = Owner.objects.filter(unit=unit).select_related('member')
                                
                                # Rebuild ownership_state_after from current DB state
                                recalculated_ownership_state_after = []
                                for owner_obj in all_owners_after:
                                    # Get attachments for this owner
                                    owner_docs = []
                                    try:
                                        from towers.models import OwnerDocs
                                        docs = OwnerDocs.objects.filter(owner=owner_obj).select_related('owner')
                                        for doc in docs:
                                            if doc.owner_docs:
                                                doc_url = doc.owner_docs.url
                                                if request:
                                                    doc_url = request.build_absolute_uri(doc_url)
                                                owner_docs.append({
                                                    'id': doc.id,
                                                    'name': doc.owner_docs.name.split('/')[-1] if doc.owner_docs.name else None,
                                                    'url': doc_url
                                                })
                                    except Exception as e:
                                        print(f"⚠️ UpdateOwner: Error fetching docs for {owner_obj.member.full_name}: {e}")
                                    
                                    owner_data = {
                                        'owner_id': owner_obj.id,
                                        'member_id': owner_obj.member.id,
                                        'name': owner_obj.member.full_name,
                                        'share': float(owner_obj.ownership_percentage),
                                        'purchase_date': owner_obj.date_of_ownership.isoformat() if owner_obj.date_of_ownership else '',
                                        'contact': owner_obj.member.general_contact or '',
                                        'email': owner_obj.member.general_email or '',
                                        'username': owner_obj.member.user.username if owner_obj.member.user else '',
                                        'attachments': owner_docs,
                                        'is_joining': False,
                                        'is_leaving': False
                                    }
                                    
                                    # Mark as joining if this is the recipient (new owner or existing owner receiving transfer)
                                    if owner_obj.member.id == updated_owner.member.id:
                                        owner_data['is_joining'] = True
                                    
                                    recalculated_ownership_state_after.append(owner_data)
                                
                                # Update the corrected amounts for source and recipient
                                for owner_data in recalculated_ownership_state_after:
                                    if owner_data.get('member_id') == new_transfer_from.id:
                                        owner_data['share'] = source_after_share
                                        print(f"📊 UpdateOwner: Updated recalculated ownership_state_after for source {new_transfer_from.full_name} to {source_after_share}%")
                                    elif owner_data.get('member_id') == updated_owner.member.id:
                                        owner_data['share'] = recipient_after_share
                                        print(f"📊 UpdateOwner: Updated recalculated ownership_state_after for recipient {updated_owner.member.full_name} to {recipient_after_share}%")
                                
                                # Use the recalculated state
                                ownership_state_after = recalculated_ownership_state_after
                                
                                # Calculate total for logging (no validation or normalization)
                                total_after = sum(float(o.get('share', 0)) for o in ownership_state_after)
                                print(f"📊 UpdateOwner: Ownership total: {total_after}%")
                                
                                # Create transfer entry using current datetime (when entry is created)
                                # The transfer_date is stored in owner.last_transfer_date and will be shown in the frontend
                                print(f"📅 UpdateOwner: Creating transfer entry with entry_date: {entry_date} (transfer_date: {transfer_date})")
                                print(f"📊 UpdateOwner: Transfer entry will show: Source {source_before_share}% → {source_after_share}% (transferred {source_transferred}%), Recipient {recipient_before_share}% → {recipient_after_share}% (received {recipient_received}%)")
                                
                                UnitOwnershipHistory.create_transfer_entry(
                                    unit=unit,
                                    from_owners=from_data,
                                    to_owners=to_data,
                                    entry_date=entry_date,  # Uses transfer_date at noon
                                    created_by=current_member,
                                    ownership_state_before=filtered_ownership_state_before,  # Only source and recipient
                                    ownership_state_after=filtered_ownership_state_after  # Only source and recipient
                                )
                                
                                # Create "Ownership List Updated" entry showing the final state
                                # This entry appears ABOVE the transfer entry (later timestamp)
                                # Use the recalculated ownership_state_after which includes all owners
                                ownership_list_entry_date = entry_date + timedelta(seconds=1)
                                print(f"📅 UpdateOwner: Creating ownership list entry with entry_date: {ownership_list_entry_date}")
                                UnitOwnershipHistory.create_ownership_state_entry(
                                    unit=unit,
                                    owners_data=ownership_state_after,
                                    entry_date=ownership_list_entry_date,
                                    created_by=current_member,
                                    ownership_state_before=ownership_state_before
                                )
                                
                                # Create notifications for managers with "View Unit Resident" permission
                                try:
                                    from notifications.utils import create_owner_updated_notification
                                    create_owner_updated_notification(unit, updated_owner=updated_owner, updater=current_member)
                                except Exception as e:
                                    logger.error(f"Error creating owner updated notifications: {str(e)}")
                                    # Don't fail the request if notification creation fails
                                
                                # Create notification for the user if they changed themselves
                                try:
                                    if updated_owner.member.id == current_member.id:
                                        from notifications.utils import create_owner_changed_self_notification
                                        create_owner_changed_self_notification(updated_owner, old_percentage=old_percentage, new_percentage=new_percentage)
                                except Exception as e:
                                    logger.error(f"Error creating self-owner change notification: {str(e)}")
                                
                                return Response({
                                    "message": "Owner updated successfully.",
                                    "data": OwnerSerializer(updated_owner, context={'request': request}).data
                                }, status=status.HTTP_200_OK)
                                
                            except ValueError as e:
                                print(f"⚠️ UpdateOwner: Error calculating internal transfer state: {e}")
                                # Fall through to external transfer logic
                                is_internal_transfer = False
                        
                        # If not internal transfer, use existing external transfer logic
                        if not is_internal_transfer:
                            # Build COMPLETE ownership_state_before from the last history entry
                            # This is the most reliable source of truth for the previous state
                            last_history = UnitOwnershipHistory.objects.filter(unit=unit).order_by('-entry_date', '-created_at').first()
                            ownership_state_before = []
                            
                            if last_history and last_history.ownership_state_after:
                                # Use the last history entry's "after" state as our "before" state
                                ownership_state_before = last_history.ownership_state_after.copy()
                                print(f"📊 UpdateOwner: Using last history entry state with {len(ownership_state_before)} owners")
                            else:
                                # No history - build from current owners in database
                                # CRITICAL: Get ALL owners from database and use their CURRENT percentages
                                # This ensures we have the actual state before any updates
                                all_owners_before = Owner.objects.filter(unit=unit).select_related('member')
                                
                                for o in all_owners_before:
                                    if o.id == updated_owner.id:
                                        # For the owner being updated, use their OLD percentage (before update)
                                        share = old_percentage
                                        print(f"📊 UpdateOwner: Using old percentage for {o.member.full_name}: {share}%")
                                    elif o.member.id == new_transfer_from.id:
                                        # For transfer source owner, we need their ORIGINAL share before transfer
                                        # If they were already updated in parallel, reconstruct by adding back transferred amount
                                        current_share = float(o.ownership_percentage)
                                        potential_original = current_share + transferred_amount
                                        
                                        # Use the potential original if it's reasonable (not > 100%)
                                        # This handles the case where Owner A was updated before Owner B
                                        if potential_original <= 100.0:
                                            share = potential_original
                                            print(f"📊 UpdateOwner: Transfer source {o.member.full_name} - reconstructed original: {share}% (current DB: {current_share}%, transferred: {transferred_amount}%)")
                                        else:
                                            # If calculated original > 100%, use current DB value (might be wrong, but safer)
                                            share = current_share
                                            print(f"⚠️ UpdateOwner: Transfer source {o.member.full_name} - calculated original > 100%, using current DB: {share}%")
                                    else:
                                        # For other owners, use current database value (should be unchanged)
                                        share = float(o.ownership_percentage)
                                    
                                    ownership_state_before.append({
                                    'owner_id': o.id,
                                    'member_id': o.member.id,
                                    'name': o.member.full_name,
                                    'share': share,
                                    'purchase_date': (o.last_transfer_date or o.date_of_ownership).isoformat(),
                                    'contact': o.member.general_contact or '',
                                    'email': o.member.general_email or '',
                                    'is_leaving': False,  # Will be updated below
                                    'is_joining': False
                                })
                                
                                # CRITICAL: Check if transfer source owner is missing from ownership_state_before
                                # This happens if they were deleted/transferred out in a parallel request (race condition)
                                source_in_state = any(o['member_id'] == new_transfer_from.id for o in ownership_state_before)
                                if not source_in_state and new_transfer_from:
                                    print(f"⚠️ UpdateOwner: Transfer source {new_transfer_from.full_name} missing from DB state (likely already deleted). Adding with transferred amount.")
                                    # We assume they had at least the transferred amount
                                    ownership_state_before.append({
                                        'owner_id': None, # We don't have the ID since they're deleted
                                        'member_id': new_transfer_from.id,
                                        'name': new_transfer_from.full_name,
                                        'share': transferred_amount, # Best guess: they had what they transferred
                                        'purchase_date': date.today().isoformat(), # Fallback date
                                        'contact': new_transfer_from.general_contact or '',
                                        'email': new_transfer_from.general_email or '',
                                        'is_leaving': False, 
                                        'is_joining': False
                                    })

                                print(f"📊 UpdateOwner: Built ownership_state_before from database with {len(ownership_state_before)} owners")
                            
                            # Check if transfer source owner is leaving (transferring all their shares)
                            transfer_source_is_leaving = False
                            transfer_source_original_share = None
                            for prev_owner in ownership_state_before:
                                if prev_owner.get('member_id') == new_transfer_from.id:
                                    transfer_source_original_share = float(prev_owner.get('share', 0))
                                    # If transferred amount equals or exceeds source owner's share, they're leaving
                                    if transferred_amount >= transfer_source_original_share:
                                        transfer_source_is_leaving = True
                                        prev_owner['is_leaving'] = True
                                        print(f"📊 UpdateOwner: Transfer source {new_transfer_from.full_name} is leaving (transferring all {transfer_source_original_share}%)")
                                    break
                            
                            # Build COMPLETE ownership_state_after from all current owners
                            # IMPORTANT: Calculate the transfer source owner's new percentage
                            # since UpdateOwner doesn't update that owner's percentage in the database
                            
                            # Track which owners are leaving (fully transferred out)
                            leaving_owner_ids = set()
                            if transfer_source_is_leaving:
                                leaving_owner_ids.add(new_transfer_from.id)
                            
                            # Calculate the receiving owner's final percentage
                            # If transfer source is leaving (transferring all shares), ensure receiving owner gets all of it
                            receiving_owner_final_share = new_percentage
                            if transfer_source_is_leaving and transfer_source_original_share is not None:
                                # If source is leaving, receiving owner should get: old_percentage + transfer_source_original_share
                                expected_final = old_percentage + transfer_source_original_share
                                if abs(new_percentage - expected_final) > 0.01:
                                    # new_percentage doesn't match expected - use calculated value
                                    receiving_owner_final_share = expected_final
                                    print(f"📊 UpdateOwner: Correcting receiving owner {updated_owner.member.full_name} percentage from {new_percentage}% to {receiving_owner_final_share}% (source leaving with {transfer_source_original_share}%)")
                            
                            # Build ownership_state_after - CRITICAL: Calculate from ownership_state_before
                            # This ensures accuracy even if database was updated in parallel
                            ownership_state_after = []
                            
                            # Find the transfer source owner's original share in ownership_state_before
                            transfer_source_prev_share = None
                            transfer_source_prev_data = None
                            for prev_owner in ownership_state_before:
                                if prev_owner.get('member_id') == new_transfer_from.id:
                                    transfer_source_prev_share = float(prev_owner.get('share', 0))
                                    transfer_source_prev_data = prev_owner
                                    break
                            
                            # Calculate transfer source owner's new share after transfer
                            if transfer_source_prev_share is not None:
                                transfer_source_new_share = transfer_source_prev_share - transferred_amount
                                print(f"📊 UpdateOwner: Transfer source {new_transfer_from.full_name}: {transfer_source_prev_share}% -> {transfer_source_new_share}% (transferred {transferred_amount}%)")
                                
                                # If calculated share is 0 or negative, owner is leaving
                                if transfer_source_new_share <= 0:
                                    leaving_owner_ids.add(new_transfer_from.id)
                                    print(f"📊 UpdateOwner: {new_transfer_from.full_name} is leaving (fully transferred out)")
                            
                            # Process all owners from ownership_state_before to build ownership_state_after
                            for prev_owner in ownership_state_before:
                                member_id = prev_owner.get('member_id')
                                
                                # Skip owners who are leaving (fully transferred out)
                                if member_id in leaving_owner_ids:
                                    continue
                                
                                # If this is the receiving owner (updated_owner), use their new percentage
                                if member_id == updated_owner.member.id:
                                    # Use transfer_date for purchase_date in the history entry (this is the transfer date from the form)
                                    # NOTE: The owner's date_of_ownership field remains unchanged (it represents their original ownership date)
                                    # We only use the transfer date in the history entry, not in the owner's database record
                                    recipient_purchase_date = transfer_date.isoformat() if transfer_date else updated_owner.date_of_ownership.isoformat()
                                    ownership_state_after.append({
                                        'owner_id': updated_owner.id,
                                        'member_id': updated_owner.member.id,
                                        'name': updated_owner.member.full_name,
                                        'share': receiving_owner_final_share,  # Use calculated final percentage
                                        'purchase_date': recipient_purchase_date,  # Use transfer date for this history entry
                                        'contact': updated_owner.member.general_contact or '',
                                        'email': updated_owner.member.general_email or '',
                                        'is_leaving': False,
                                        'is_joining': False
                                    })
                                    print(f"📊 UpdateOwner: Receiving owner {updated_owner.member.full_name}: {old_percentage}% -> {receiving_owner_final_share}% (received {transferred_amount}%). Using transfer date {recipient_purchase_date} for history entry (owner's date_of_ownership unchanged: {updated_owner.date_of_ownership}).")
                                
                                # If this is the transfer source owner, use their calculated new share
                                elif member_id == new_transfer_from.id:
                                    if transfer_source_prev_share is not None:
                                        transfer_source_new_share = transfer_source_prev_share - transferred_amount
                                        if transfer_source_new_share > 0:
                                            # Get the owner object to access other fields
                                            try:
                                                transfer_source_owner = Owner.objects.get(unit=unit, member=new_transfer_from)
                                                
                                                # CRITICAL: Update the source owner's percentage in database
                                                if abs(float(transfer_source_owner.ownership_percentage) - transfer_source_new_share) > 0.01:
                                                    print(f"📊 UpdateOwner: Updating source owner {new_transfer_from.full_name} share to {transfer_source_new_share}% in DB")
                                                    transfer_source_owner.ownership_percentage = transfer_source_new_share
                                                    update_fields = ['ownership_percentage']
                                                    
                                                    # Set last_transfer_date for source owner
                                                    if transfer_date:
                                                        transfer_source_owner.last_transfer_date = transfer_date
                                                        update_fields.append('last_transfer_date')
                                                        print(f"📅 UpdateOwner: Set last_transfer_date to {transfer_date} for source owner {new_transfer_from.full_name}")
                                                    
                                                    transfer_source_owner.save(update_fields=update_fields)

                                                ownership_state_after.append({
                                                    'owner_id': transfer_source_owner.id,
                                                    'member_id': new_transfer_from.id,
                                                    'name': new_transfer_from.full_name,
                                                    'share': transfer_source_new_share,
                                                    'purchase_date': (transfer_source_owner.last_transfer_date or transfer_source_owner.date_of_ownership).isoformat(),
                                                    'contact': new_transfer_from.general_contact or '',
                                                    'email': new_transfer_from.general_email or '',
                                                    'is_leaving': False,
                                                    'is_joining': False
                                                })
                                            except Owner.DoesNotExist:
                                                # Owner was deleted (fully transferred out) - skip
                                                pass
                                
                                # For all other owners, keep their share unchanged
                                else:
                                    ownership_state_after.append({
                                        'owner_id': prev_owner.get('owner_id'),
                                        'member_id': member_id,
                                        'name': prev_owner.get('name', ''),
                                        'share': float(prev_owner.get('share', 0)),  # Keep original share
                                        'purchase_date': prev_owner.get('purchase_date', ''),
                                        'contact': prev_owner.get('contact', ''),
                                        'email': prev_owner.get('email', ''),
                                        'is_leaving': False,
                                        'is_joining': False
                                    })
                            
                            # Verify total ownership is 100%
                            # Log total for debugging (no validation/normalization needed)
                            total_share = sum(o.get('share', 0) for o in ownership_state_after)
                            print(f"📊 UpdateOwner: Total ownership after transfer: {total_share}%")
                            
                            # Ensure all owners in ownership_state_before have metadata
                            for prev_owner in ownership_state_before:
                                if prev_owner.get('member_id') in leaving_owner_ids:
                                    prev_owner['is_leaving'] = True
                                else:
                                    prev_owner['is_leaving'] = False
                                prev_owner['is_joining'] = False
                            
                            # Legacy from/to data for backward compatibility
                            # Find the transfer source owner in ownership_state_before to get their ORIGINAL share
                            transfer_source_owner_id = None
                            transfer_source_name = new_transfer_from.full_name
                            
                            for prev_owner in ownership_state_before:
                                if prev_owner.get('member_id') == new_transfer_from.id:
                                    transfer_source_owner_id = prev_owner.get('owner_id')
                                    transfer_source_name = prev_owner.get('name', new_transfer_from.full_name)
                                    break
                            
                            # If not found in ownership_state_before, try to find in current owners (fallback)
                            if transfer_source_original_share is None:
                                try:
                                    transfer_source_owner = Owner.objects.get(unit=unit, member=new_transfer_from)
                                    # Get their share from ownership_state_before if available, otherwise use current DB value
                                    # But we need to account for the transfer that just happened
                                    transferred_amount = new_percentage - old_percentage
                                    # Their current DB value might already reflect the transfer, so add it back to get original
                                    transfer_source_original_share = float(transfer_source_owner.ownership_percentage) + transferred_amount
                                    transfer_source_owner_id = transfer_source_owner.id
                                    print(f"📊 UpdateOwner: Found transfer source in DB, calculated original share: {transfer_source_original_share}%")
                                except Owner.DoesNotExist:
                                    # Transfer source owner might have been fully transferred out
                                    # Use the difference between old and new percentage as transferred amount
                                    transferred_amount = new_percentage - old_percentage
                                    # Try to find in ownership_state_before by checking who lost that amount
                                    for prev_owner in ownership_state_before:
                                        prev_share = float(prev_owner.get('share', 0))
                                        # Find owner in after state
                                        after_owner = next(
                                            (o for o in ownership_state_after if o.get('member_id') == prev_owner.get('member_id')),
                                            None
                                        )
                                        if after_owner:
                                            after_share = float(after_owner.get('share', 0))
                                            if abs(prev_share - after_share - transferred_amount) < 0.01:
                                                # This owner lost the transferred amount
                                                transfer_source_original_share = prev_share
                                                transfer_source_owner_id = prev_owner.get('owner_id')
                                                transfer_source_name = prev_owner.get('name', new_transfer_from.full_name)
                                                print(f"📊 UpdateOwner: Inferred transfer source: {transfer_source_name} with original share: {transfer_source_original_share}%")
                                                break
                            
                            # Build from_data with the transfer source owner's ORIGINAL share
                            # IMPORTANT: Always include the transfer source owner in from_data, even if they're leaving
                            from_data = []
                            if transfer_source_original_share is not None:
                                from_data.append({
                                    'owner_id': transfer_source_owner_id,
                                    'member_id': new_transfer_from.id,
                                    'name': transfer_source_name,
                                    'share': transfer_source_original_share,  # ORIGINAL share before transfer
                                    'is_leaving': transfer_source_is_leaving  # Metadata: is this owner leaving?
                                })
                            else:
                                # Last resort: try to find in ownership_state_before
                                for prev_owner in ownership_state_before:
                                    if prev_owner.get('member_id') == new_transfer_from.id:
                                        from_data.append({
                                            'owner_id': prev_owner.get('owner_id'),
                                            'member_id': new_transfer_from.id,
                                            'name': prev_owner.get('name', new_transfer_from.full_name),
                                            'share': float(prev_owner.get('share', 0)),
                                            'is_leaving': prev_owner.get('is_leaving', False)
                                        })
                                        break
                                
                                # If still not found, use estimated values
                                if not from_data:
                                    from_data.append({
                                        'owner_id': None,
                                        'member_id': new_transfer_from.id,
                                        'name': new_transfer_from.full_name,
                                        'share': transferred_amount,  # At least show the transferred amount
                                        'is_leaving': transfer_source_is_leaving
                                    })
                                    print(f"⚠️ UpdateOwner: Could not find transfer source original share, using transferred amount: {transferred_amount}%")
                            
                            # CRITICAL: If transfer source is leaving (fully transferred out), delete them from database
                            if transfer_source_is_leaving:
                                try:
                                    transfer_source_owner = Owner.objects.get(unit=unit, member=new_transfer_from)
                                    
                                    # Set last_transfer_date before deletion (so DeleteOwner can use it)
                                    if transfer_date:
                                        transfer_source_owner.last_transfer_date = transfer_date
                                        transfer_source_owner.save(update_fields=['last_transfer_date'])
                                        print(f"📅 UpdateOwner: Set last_transfer_date to {transfer_date} for source owner {new_transfer_from.full_name} (before deletion)")
                                    
                                    print(f"🗑️ UpdateOwner: Deleting transfer source owner {new_transfer_from.full_name} (fully transferred out)")
                                    transfer_source_owner.delete()
                                except Owner.DoesNotExist:
                                    print(f"⚠️ UpdateOwner: Transfer source owner {new_transfer_from.full_name} already deleted")
                            
                            # CRITICAL: Update receiving owner's percentage and last_transfer_date in database
                            # NOTE: Do NOT update date_of_ownership - it represents the original ownership date
                            # Set last_transfer_date to track when this transfer occurred
                            recipient_needs_update = False
                            update_fields = []
                            
                            if abs(float(updated_owner.ownership_percentage) - receiving_owner_final_share) > 0.01:
                                print(f"📊 UpdateOwner: Correcting receiving owner percentage in database from {updated_owner.ownership_percentage}% to {receiving_owner_final_share}%")
                                updated_owner.ownership_percentage = receiving_owner_final_share
                                update_fields.append('ownership_percentage')
                                recipient_needs_update = True
                            
                            # Set last_transfer_date to the transfer date (from the form)
                            if transfer_date:
                                updated_owner.last_transfer_date = transfer_date
                                update_fields.append('last_transfer_date')
                                recipient_needs_update = True
                                print(f"📅 UpdateOwner: Set last_transfer_date to {transfer_date} for receiving owner {updated_owner.member.full_name}")
                            
                            if recipient_needs_update and update_fields:
                                updated_owner.save(update_fields=update_fields)
                            
                            # Build to_data with ALL owners after transfer (not just the receiving owner)
                            # This ensures the transfer entry shows the complete final state
                            to_data = []
                            for owner in ownership_state_after:
                                is_new_owner = owner.get('owner_id') not in [o.get('owner_id') for o in ownership_state_before if o.get('owner_id')]
                                to_data.append({
                                    'owner_id': owner.get('owner_id'),
                                    'member_id': owner.get('member_id'),
                                    'name': owner.get('name', ''),
                                    'share': float(owner.get('share', 0)),
                                    'is_joining': is_new_owner
                                })
                            
                            # Create the transfer entry using current datetime (when entry is created)
                            # The transfer_date is stored in owner.last_transfer_date and will be shown in the frontend
                            print(f"📅 UpdateOwner: Creating transfer entry with entry_date: {entry_date} (transfer_date: {transfer_date})")
                            UnitOwnershipHistory.create_transfer_entry(
                                unit=unit,
                                from_owners=from_data,
                                to_owners=to_data,
                                entry_date=entry_date,  # Uses transfer_date at noon
                                created_by=current_member,
                                ownership_state_before=ownership_state_before,
                                ownership_state_after=ownership_state_after
                            )
                            
                            # Create "Ownership List Updated" entry showing the final state
                            # This entry appears ABOVE the transfer entry (later timestamp)
                            ownership_list_entry_date = entry_date + timedelta(seconds=1)
                            print(f"📅 UpdateOwner: Creating ownership list entry with entry_date: {ownership_list_entry_date}")
                            UnitOwnershipHistory.create_ownership_state_entry(
                                unit=unit,
                                owners_data=ownership_state_after,
                                entry_date=ownership_list_entry_date,
                                created_by=current_member,
                                ownership_state_before=ownership_state_before
                            )
                            
                            # Create notifications for managers with "View Unit Resident" permission
                            try:
                                from notifications.utils import create_owner_updated_notification
                                create_owner_updated_notification(unit, updated_owner=updated_owner, updater=current_member)
                            except Exception as e:
                                logger.error(f"Error creating owner updated notifications: {str(e)}")
                                # Don't fail the request if notification creation fails
                    
                    # If only percentage changed without transfer_from, don't create history
                    # The history will be created when the new owner is added via CreateOwner
                            # This prevents creating incorrect "single owner" entries during redistribution
                            
                            # Create notification for the user if they changed themselves
                            try:
                                if updated_owner.member.id == current_member.id:
                                    from notifications.utils import create_owner_changed_self_notification
                                    create_owner_changed_self_notification(updated_owner, old_percentage=old_percentage, new_percentage=new_percentage)
                            except Exception as e:
                                logger.error(f"Error creating self-owner change notification: {str(e)}")
                            
                    return Response({
                        "message": "Owner updated successfully.",
                        "data": OwnerSerializer(updated_owner, context={'request': request}).data
                    }, status=status.HTTP_200_OK)
                
            except OperationalError as e:
                if 'Deadlock' in str(e) and attempt < max_retries - 1:
                    # Deadlock detected, retry after a short delay
                    print(f"⚠️ Deadlock detected, retrying... (attempt {attempt + 1}/{max_retries})")
                    time.sleep(retry_delay * (attempt + 1))  # Exponential backoff
                    continue
                else:
                    # Re-raise if it's not a deadlock or we've exhausted retries
                    raise
            except Owner.DoesNotExist:
                # Owner was deleted between check and update
                return Response(
                    {"error": "Owner not found. The owner may have been deleted."},
                    status=status.HTTP_404_NOT_FOUND
                )

class DeleteOwner(APIView):
    def delete(self, request, owner_id):
        # Retry logic for deadlock handling
        max_retries = 3
        retry_delay = 0.1
        
        for attempt in range(max_retries):
            try:
                return self._delete_owner_internal(request, owner_id)
            except OperationalError as e:
                if 'Deadlock' in str(e) and attempt < max_retries - 1:
                    print(f"⚠️ Deadlock detected, retrying... (attempt {attempt + 1}/{max_retries})")
                    time.sleep(retry_delay * (attempt + 1))
                    continue
                else:
                    raise
    
    def _delete_owner_internal(self, request, owner_id):
        owner = get_object_or_404(Owner, id=owner_id)
        unit = owner.unit

        with transaction.atomic():
            # Capture owner info BEFORE deletion (we need this for history)
            deleted_owner_info = {
                'owner_id': owner.id,
                'member_id': owner.member.id,
                'name': owner.member.full_name,
                'share': float(owner.ownership_percentage),
                'purchase_date': owner.date_of_ownership.isoformat(),
                'contact': owner.member.general_contact or '',
                'email': owner.member.general_email or ''
            }
            deleted_owner_date = owner.date_of_ownership
            
            # Get the most recent history entry to see previous ownership state
            last_history = UnitOwnershipHistory.objects.filter(unit=unit).order_by('-entry_date', '-created_at').first()
            
            # Build complete ownership state BEFORE deletion
            ownership_state_before = []
            if last_history and last_history.ownership_state_after:
                ownership_state_before = last_history.ownership_state_after
            elif last_history and last_history.owners:
                ownership_state_before = last_history.owners
            else:
                # No history - build from current owners including the one being deleted
                all_current_owners = Owner.objects.filter(unit=unit).select_related('member')
                for o in all_current_owners:
                    ownership_state_before.append({
                        'owner_id': o.id,
                        'member_id': o.member.id,
                        'name': o.member.full_name,
                        'share': float(o.ownership_percentage),
                        'purchase_date': o.date_of_ownership.isoformat(),
                        'contact': o.member.general_contact or '',
                        'email': o.member.general_email or ''
                    })
            
            # Get current user for history tracking
            try:
                current_member = Member.objects.get(user=request.user)
            except Member.DoesNotExist:
                current_member = None
            
            # Create notifications for managers with "View Unit Resident" permission
            # Store owner info before deletion
            try:
                from notifications.utils import create_owner_removed_notification
                owner_info = {
                    'id': owner.id,
                    'name': owner.member.full_name,
                    'member_id': owner.member.id
                }
                create_owner_removed_notification(owner_info, unit, remover=current_member)
            except Exception as e:
                logger.error(f"Error creating owner removal notifications: {str(e)}")
                # Don't fail the request if notification creation fails
            
            # Create notification for the user if they removed themselves
            if current_member and owner.member.id == current_member.id:
                try:
                    from notifications.utils import create_owner_removed_self_notification
                    create_owner_removed_self_notification(owner_info, unit)
                except Exception as e:
                    logger.error(f"Error creating self-owner removal notification: {str(e)}")
                    # Don't fail the request if notification creation fails
            
            # Get all related owner docs first
            owner_docs = OwnerDocs.objects.filter(owner=owner)
            
            # Delete the actual files from media storage first
            for doc in owner_docs:
                if doc.owner_docs:
                    try:
                        # Delete the file from storage
                        doc.owner_docs.delete(save=False)
                        print(f"🗑️ Deleted file: {doc.owner_docs.name}")
                    except Exception as e:
                        print(f"⚠️ Error deleting file {doc.owner_docs.name}: {e}")
            
            # Then delete the database records
            owner_docs.delete()

            # Check if UpdateOwner already created a transfer entry for this deletion
            # Since deletions are always part of transfers, we need to check if UpdateOwner handled it
            should_create_history = True
            transfer_date_to_use = deleted_owner_date  # Default to owner's original date (fallback)
            
            # First, check if this owner has a last_transfer_date set (indicating a recent transfer)
            # This would have been set by UpdateOwner just before calling DeleteOwner
            if owner.last_transfer_date:
                transfer_date_to_use = owner.last_transfer_date
                print(f"📅 DeleteOwner: Using last_transfer_date {transfer_date_to_use} from owner {deleted_owner_info['name']}")
            
            # Check if there are OTHER owners in this unit (excluding the one being deleted)
            # If there are other owners, this deletion is likely part of a transfer
            # and UpdateOwner will create the history entry
            other_owners_count = Owner.objects.filter(unit=unit).exclude(id=owner.id).count()
            
            # If there are other owners remaining, this is a transfer scenario
            # UpdateOwner handles all history creation, so skip here
            if other_owners_count > 0:
                print(f"📊 DeleteOwner: Found {other_owners_count} other owners in unit - this is likely part of a transfer. UpdateOwner handles history. Skipping.")
                should_create_history = False
            
            # Also check for receiving owners (secondary check)
            receiving_owners = Owner.objects.filter(
                unit=unit,
                ownership_transfer_from=owner.member
            ).select_related('member')
            
            # If there are receiving owners, this is definitely part of a transfer
            if receiving_owners.exists():
                print(f"📊 DeleteOwner: Found receiving owners - this is part of a transfer. UpdateOwner handles history. Skipping.")
                should_create_history = False
                # Still get the transfer date for logging
                for receiving_owner in receiving_owners:
                    if receiving_owner.last_transfer_date:
                        transfer_date_to_use = receiving_owner.last_transfer_date
                        print(f"📅 DeleteOwner: Found receiving owner {receiving_owner.member.full_name} with last_transfer_date {transfer_date_to_use}")
                        break
            
            # If we didn't get the date from the owner's last_transfer_date, use owner's value
            if transfer_date_to_use == deleted_owner_date and owner.last_transfer_date:
                transfer_date_to_use = owner.last_transfer_date
            
            # Check for very recent transfer entries (within last 60 seconds) that already cover this deletion
            # Use a longer window to handle race conditions where DeleteOwner runs before UpdateOwner finishes
            # If UpdateOwner just created one, use its date and skip creating duplicate
            recent_transfer_entries = UnitOwnershipHistory.objects.filter(
                unit=unit,
                entry_type='ownership_transfer',
                created_at__gte=datetime.now() - timedelta(seconds=60)
            ).order_by('-entry_date', '-created_at')
            
            for recent_entry in recent_transfer_entries:
                # Check ownership_state_before for this owner marked as leaving
                for prev_owner in (recent_entry.ownership_state_before or []):
                    if prev_owner.get('member_id') == deleted_owner_info['member_id']:
                        # Check if owner is marked as leaving
                        if prev_owner.get('is_leaving') == True:
                            # UpdateOwner just created this entry - use its date (the transfer date from the form)
                            transfer_date_to_use = recent_entry.entry_date.date()
                            print(f"📊 DeleteOwner: Owner {deleted_owner_info['name']} was already marked as leaving in very recent transfer entry (date: {transfer_date_to_use}, created {abs((datetime.now() - recent_entry.created_at).total_seconds())} seconds ago). UpdateOwner handled this. Skipping duplicate entry.")
                            should_create_history = False
                            break
                
                if not should_create_history:
                    break
                
                # Also check if owner is missing from ownership_state_after (meaning they left)
                owner_in_after_state = False
                for after_owner in (recent_entry.ownership_state_after or []):
                    if after_owner.get('member_id') == deleted_owner_info['member_id']:
                        owner_in_after_state = True
                        break
                
                # If owner was in before but not in after, they already left
                if not owner_in_after_state:
                    # Check if this owner was in the before state
                    owner_was_in_before = False
                    for prev_owner in (recent_entry.ownership_state_before or []):
                        if prev_owner.get('member_id') == deleted_owner_info['member_id']:
                            owner_was_in_before = True
                            break
                    
                    if owner_was_in_before:
                        # Use the transfer date from the entry (the date from the form)
                        transfer_date_to_use = recent_entry.entry_date.date()
                        print(f"📊 DeleteOwner: Owner {deleted_owner_info['name']} was already removed in very recent transfer entry (date: {transfer_date_to_use}). UpdateOwner handled this. Skipping duplicate entry.")
                        should_create_history = False
                        break
                
                if not should_create_history:
                    break
            
            # Also check last_history for backward compatibility (within last 60 seconds)
            if should_create_history and last_history:
                if last_history.entry_type == 'ownership_transfer':
                    time_diff = abs((datetime.now() - last_history.created_at).total_seconds())
                    if time_diff < 60:  # Within 60 seconds
                        # Check ownership_state_before for this owner marked as leaving
                        owner_marked_leaving = any(
                            prev_owner.get('member_id') == deleted_owner_info['member_id'] and prev_owner.get('is_leaving') == True
                            for prev_owner in (last_history.ownership_state_before or [])
                        )
                        
                        # Also check if owner is missing from ownership_state_after
                        owner_absent_from_after = not any(
                            after_owner.get('member_id') == deleted_owner_info['member_id']
                            for after_owner in (last_history.ownership_state_after or [])
                        )
                        
                        if owner_marked_leaving or owner_absent_from_after:
                            transfer_date_to_use = last_history.entry_date.date()
                            print(f"📊 DeleteOwner: Owner {deleted_owner_info['name']} was already handled in recent history entry (marked_leaving={owner_marked_leaving}, absent_from_after={owner_absent_from_after}). Skipping duplicate entry.")
                            should_create_history = False
            
            # Delete the owner
            owner.delete()
            
            # Skip creating history if UpdateOwner already created it
            if not should_create_history:
                print(f"📊 DeleteOwner: Skipping history creation - UpdateOwner already created the transfer entry with date {transfer_date_to_use}.")
                return Response(
                    {"message": "Owner deleted successfully."},
                    status=status.HTTP_200_OK
                )
            
            # Create history entries using current datetime (when entry is created) - same as initial ownership
            # The transfer_date is stored in owner.last_transfer_date and will be shown in the frontend
            entry_date = datetime.now().replace(microsecond=0)  # Use current datetime, remove microseconds for consistency
            print(f"📅 DeleteOwner: Creating history entry using current datetime {entry_date} (transfer_date: {transfer_date_to_use})")
            
            # Get remaining owners after deletion
            remaining_owners = Owner.objects.filter(unit=unit).select_related('member')
            
            if remaining_owners.exists() and should_create_history:
                # Build complete ownership state AFTER deletion
                ownership_state_after = []
                for o in remaining_owners:
                    ownership_state_after.append({
                        'owner_id': o.id,
                        'member_id': o.member.id,
                        'name': o.member.full_name,
                        'share': float(o.ownership_percentage),
                        'purchase_date': o.date_of_ownership.isoformat(),
                        'contact': o.member.general_contact or '',
                        'email': o.member.general_email or '',
                        'is_leaving': False,
                        'is_joining': False
                    })
                
                # Add metadata to ownership_state_before to mark the deleted owner as leaving
                for prev_owner in ownership_state_before:
                    if prev_owner.get('member_id') == deleted_owner_info['member_id']:
                        prev_owner['is_leaving'] = True
                    else:
                        prev_owner['is_leaving'] = False
                    prev_owner['is_joining'] = False
                
                # Build legacy from/to data for backward compatibility
                deleted_owner_info_legacy = {
                    'owner_id': deleted_owner_info['owner_id'],
                    'member_id': deleted_owner_info['member_id'],
                    'name': deleted_owner_info['name'],
                    'share': deleted_owner_info['share'],
                    'is_leaving': True  # Metadata
                }
                remaining_owners_data = []
                for o in remaining_owners:
                    remaining_owners_data.append({
                        'owner_id': o.id,
                        'member_id': o.member.id,
                        'name': o.member.full_name,
                        'share': float(o.ownership_percentage),
                        'is_leaving': False,
                        'is_joining': False
                    })
                
                # Check if a transfer entry was already created for this owner recently
                # This happens when the owner was part of a transfer in UpdateOwner before being deleted
                # Use created_at for time comparison (when entry was actually created), not entry_date
                recent_transfer = UnitOwnershipHistory.objects.filter(
                    unit=unit,
                    entry_type='ownership_transfer',
                    created_at__gte=datetime.now() - timedelta(seconds=60)  # Within last 60 seconds
                ).order_by('-created_at').first()
                
                should_skip_transfer_entry = False
                if recent_transfer:
                    # Check if this deleted owner is in the ownership_state_before of the recent transfer
                    # with is_leaving=True OR if they're absent from ownership_state_after
                    # (meaning they already exited in that entry)
                    owner_marked_leaving = any(
                        owner.get('member_id') == deleted_owner_info['member_id'] and owner.get('is_leaving') == True
                        for owner in (recent_transfer.ownership_state_before or [])
                    )
                    owner_absent_from_after = not any(
                        owner.get('member_id') == deleted_owner_info['member_id']
                        for owner in (recent_transfer.ownership_state_after or [])
                    )
                    
                    if owner_marked_leaving or owner_absent_from_after:
                        print(f"📊 DeleteOwner: Skipping transfer entry - owner {deleted_owner_info['name']} already recorded as leaving in recent transfer entry (marked_leaving={owner_marked_leaving}, absent_from_after={owner_absent_from_after})")
                        should_skip_transfer_entry = True
                
                if not should_skip_transfer_entry:
                    UnitOwnershipHistory.create_transfer_entry(
                        unit=unit,
                        from_owners=[deleted_owner_info_legacy],  # Legacy
                        to_owners=remaining_owners_data,  # Legacy
                        entry_date=entry_date,
                        created_by=current_member,
                        ownership_state_before=ownership_state_before,
                        ownership_state_after=ownership_state_after
                    )
                    
                    # Create "Ownership List Updated" entry showing the final state
                    # This entry appears ABOVE the transfer entry (later timestamp)
                    ownership_list_entry_date = entry_date + timedelta(seconds=1)
                    print(f"📅 DeleteOwner: Creating ownership list entry with entry_date: {ownership_list_entry_date}")
                    UnitOwnershipHistory.create_ownership_state_entry(
                        unit=unit,
                        owners_data=ownership_state_after,
                        entry_date=ownership_list_entry_date,
                        created_by=current_member,
                        ownership_state_before=ownership_state_before
                    )

        return Response(
            {"message": "Owner and related documents deleted successfully."},
            status=status.HTTP_200_OK
        )

    
class OwnerListOfUnit(APIView):
    def get(self, request, unit_id):
        # Get the unit or return 404 if not found
        unit = get_object_or_404(Unit, id=unit_id)

        # Get all owners of this unit, ordered by created_at timestamp
        # Only include owners whose members are active community members
        owners = Owner.objects.filter(
            unit=unit,
            member__is_comm_member=True  # Only include active community members
        ).select_related('member').order_by('created_at')

        # Serialize the data with request context
        serializer = OwnerDetailSerializer(owners, many=True, context={'request': request})

        return Response({
            'unit': UnitSerializer(unit).data,
            'owners': serializer.data
        }, status=status.HTTP_200_OK)

class OwnerDetails(APIView):
    # permission_classes = [IsAuthenticated]
    def get(self, request, unit_id, owner_id):
        
        try:
            # Filter using the owner's primary key and its associated unit
            owner = Owner.objects.get(id=owner_id, unit__id=unit_id)
        
        except Owner.DoesNotExist:
            return Response(
                {"error": "Owner not found for the specified unit and owner id."},
                status=status.HTTP_404_NOT_FOUND
            )

        # serializer = OwnerSerializer(owner)
        serializer = OwnerDetailSerializer(owner, context={'request': request})  # ✅ use the detailed version with request context

        return Response(serializer.data, status=status.HTTP_200_OK)

class MemberUnitOwnership(APIView):
    def get(self, request, member_id):
        owners = Owner.objects.filter(member__id=member_id).select_related(
            'unit__floor__tower'
        )
        serializer = MemberUnitOwnershipSerializer(owners, many=True, context={'request': request})
        return Response(serializer.data, status=status.HTTP_200_OK)


class UnitOwnershipHistoryAPI(APIView):
    """
    API endpoint to get the ownership history of a unit.
    Reads directly from the UnitOwnershipHistory database table.
    
    Returns a timeline of ownership changes with 5 status types:
    1. Initial Ownership - First owner(s) at unit creation (single owner)
    2. Initial Ownership List - First owner(s) at unit creation (multiple owners)
    3. Ownership Transfer - When ownership moves from one party to another
    4. Ownership Updated - After transfer, single owner result
    5. Ownership List Updated - After transfer, multiple owners result
    
    Note: Owner information (name, contact, email, username) is fetched from the Member database
    to ensure any edits to general information are reflected correctly.
    """
    
    def _update_owner_data_with_current_member_info(self, owner_list, request=None, entry=None):
        """
        Update owner data in JSON arrays with current member information from the database.
        This ensures that any edits to member general information are reflected correctly.
        Also includes attachments with proper URLs.
        
        Args:
            owner_list: List of owner dictionaries from JSON fields
            request: Request object (optional, for building absolute URLs for attachments)
            entry: History entry object (optional, used to determine entry type)
            
        Returns:
            Updated list with current member information and attachments
        """
        if not owner_list:
            return owner_list
        
        # Collect all member_ids and owner_ids from the owner list
        member_ids = []
        owner_ids = []
        for owner in owner_list:
            if isinstance(owner, dict):
                if owner.get('member_id'):
                    member_ids.append(owner['member_id'])
                if owner.get('owner_id'):
                    owner_ids.append(owner['owner_id'])
        
        # Fetch current member data from database
        members = {}
        if member_ids:
            members_query = Member.objects.filter(id__in=member_ids).select_related('user')
            members = {member.id: member for member in members_query}
        
        # Fetch attachments for owners
        attachments_by_owner = {}
        if owner_ids:
            from towers.models import OwnerDocs
            owner_docs = OwnerDocs.objects.filter(owner_id__in=owner_ids).select_related('owner')
            for doc in owner_docs:
                if doc.owner_docs:
                    owner_id = doc.owner.id
                    if owner_id not in attachments_by_owner:
                        attachments_by_owner[owner_id] = []
                    doc_url = doc.owner_docs.url
                    if request:
                        doc_url = request.build_absolute_uri(doc_url)
                    attachments_by_owner[owner_id].append({
                        'id': doc.id,
                        'name': doc.owner_docs.name.split('/')[-1] if doc.owner_docs and doc.owner_docs.name else None,
                        'url': doc_url
                    })
        
        # Update owner data with current member information and attachments
        updated_owners = []
        for owner in owner_list:
            if not isinstance(owner, dict):
                updated_owners.append(owner)
                continue
            
            member_id = owner.get('member_id')
            owner_id = owner.get('owner_id')
            
            # Update with current member information
            updated_owner = owner.copy()
            
            if member_id and member_id in members:
                member = members[member_id]
                updated_owner['name'] = member.full_name
                updated_owner['contact'] = member.general_contact or ''
                updated_owner['email'] = member.general_email or ''
                # Get username from related user
                if member.user:
                    updated_owner['username'] = member.user.username
                else:
                    updated_owner['username'] = owner.get('username', '')
            
            # Add/update attachments
            # CRITICAL: For attachment_added/attachment_removed entries, use the attachments
            # stored in the history entry, NOT the current database state
            # This preserves the historical state and prevents adding attachments to previous snapshots
            entry_type = entry.entry_type if entry and hasattr(entry, 'entry_type') else None
            is_attachment_entry = entry_type in ['attachment_added', 'attachment_removed']
            
            if is_attachment_entry:
                # For attachment entries, use the attachments from the stored history entry
                # Don't update from current database to preserve historical accuracy
                if 'attachments' in owner:
                    updated_owner['attachments'] = owner['attachments']
                else:
                    updated_owner['attachments'] = []
            else:
                # For other entry types, update with current attachments
                if owner_id and owner_id in attachments_by_owner:
                    updated_owner['attachments'] = attachments_by_owner[owner_id]
                elif 'attachments' in owner:
                    # Preserve existing attachments if owner_id not found
                    updated_owner['attachments'] = owner['attachments']
                else:
                    updated_owner['attachments'] = []
            
            updated_owners.append(updated_owner)
        
        return updated_owners
    
    def get(self, request, unit_id):
        try:
            unit = Unit.objects.select_related('floor__tower').get(id=unit_id)
        except Unit.DoesNotExist:
            return Response(
                {"error": "Unit not found."},
                status=status.HTTP_404_NOT_FOUND
            )
        
        # Get history entries from the dedicated history table
        # Ordered by entry_date descending (newest first) - so most recent entries appear at the top
        # Then by created_at descending and id descending for consistent ordering when entries have the same date
        # Transfer entries and ownership updates use the same entry_date, but:
        # - Transfer entry is created first (earlier created_at)
        # - Ownership update entry is created second (later created_at)
        # So when sorted by -entry_date, -created_at:
        # - Ownership update (later created_at) appears first
        # - Transfer (earlier created_at) appears right behind it
        # This approach handles multiple entries on the same date robustly
        history_entries = UnitOwnershipHistory.objects.filter(
            unit=unit
        ).order_by('-entry_date', '-created_at', '-id')
        
        # Transform to API response format
        entries = []
        for entry in history_entries:
            entry_data = {
                'id': str(entry.id),
                'type': entry.entry_type,
                'date': entry.entry_date.isoformat() if entry.entry_date else None,
                'description': entry.description or '',
                'summary': entry.description or '',
            }
            
            # Add owner_member info for attachment entries so frontend can identify the specific owner
            if entry.entry_type in ['attachment_added', 'attachment_removed']:
                # Try to get owner_member from the entry if it exists
                # Otherwise, extract from ownership_state_after (should only have one owner)
                if hasattr(entry, 'owner_member') and entry.owner_member:
                    entry_data['owner_member'] = MemberSerializer(entry.owner_member, context={'request': request}).data
                elif entry.ownership_state_after and len(entry.ownership_state_after) > 0:
                    # Extract member_id from the first (and only) owner in ownership_state_after
                    owner_data = entry.ownership_state_after[0]
                    member_id = owner_data.get('member_id')
                    if member_id:
                        try:
                            from user.models import Member
                            member = Member.objects.get(id=member_id)
                            entry_data['owner_member'] = MemberSerializer(member, context={'request': request}).data
                        except Member.DoesNotExist:
                            pass
            
            # Use new ownership_state_before/after if available, otherwise fall back to legacy fields
            # Check if entry has ownership_state_after (new structure) or use legacy fields
            has_new_structure = (entry.ownership_state_after is not None and len(entry.ownership_state_after) > 0) or \
                               (entry.ownership_state_before is not None and len(entry.ownership_state_before) > 0)
            
            if has_new_structure:
                # New structure: use ownership_state_before/after
                if entry.entry_type == 'ownership_transfer':
                    # For transfer entries, derive FROM/TO from before/after states
                    # Update both before and after states with current member info and attachments
                    entry_data['from'] = self._update_owner_data_with_current_member_info(
                        entry.ownership_state_before,
                        request=request,
                        entry=entry
                    )
                    entry_data['to'] = self._update_owner_data_with_current_member_info(
                        entry.ownership_state_after,
                        request=request,
                        entry=entry
                    )
                else:
                    # For state entries, show owners from after state
                    entry_data['owners'] = self._update_owner_data_with_current_member_info(
                        entry.ownership_state_after,
                        request=request,
                        entry=entry
                    )
                # Also include ownership_state_before and ownership_state_after for frontend
                entry_data['ownership_state_before'] = self._update_owner_data_with_current_member_info(
                    entry.ownership_state_before or [],
                    request=request,
                    entry=entry
                )
                entry_data['ownership_state_after'] = self._update_owner_data_with_current_member_info(
                    entry.ownership_state_after or [],
                    request=request,
                    entry=entry
                )
            else:
                # Legacy structure: use old fields
                if entry.entry_type == 'ownership_transfer':
                    entry_data['from'] = self._update_owner_data_with_current_member_info(
                        entry.transfer_from or [],
                        request=request,
                        entry=entry
                    )
                    entry_data['to'] = self._update_owner_data_with_current_member_info(
                        entry.transfer_to or [],
                        request=request,
                        entry=entry
                    )
                else:
                    entry_data['owners'] = self._update_owner_data_with_current_member_info(
                        entry.owners or [],
                        request=request,
                        entry=entry
                    )
                # For legacy entries, also try to include ownership_state_after if available
                if entry.ownership_state_after:
                    entry_data['ownership_state_after'] = self._update_owner_data_with_current_member_info(
                        entry.ownership_state_after,
                        request=request,
                        entry=entry
                    )
            
            entries.append(entry_data)
        
        logger.info(f"Returning {len(entries)} entries for unit {unit_id}")
        
        return Response({
            'unit': {
                'id': unit.id,
                'unit_name': unit.unit_name,
                'tower_name': unit.floor.tower.tower_name,
                'tower_number': unit.floor.tower.tower_number
            },
            'entries': entries
        }, status=status.HTTP_200_OK)

# class DeleteOwnersByUnit(APIView):
#     def delete(self, request, unit_id):
#         try:
#             # Verify unit exists
#             unit = Unit.objects.get(id=unit_id)
            
#             # Delete all owners related to this unit
#             deleted_count, _ = Owner.objects.filter(unit=unit).delete()

#             return Response(
#                 {"message": f"Successfully deleted {deleted_count} owner(s) associated with unit {unit.unit_name}."},
#                 status=status.HTTP_200_OK
#             )
#         except Unit.DoesNotExist:
#             return Response(
#                 {"error": "Unit not found."},
#                 status=status.HTTP_404_NOT_FOUND
#             )

# from rest_framework.views import APIView
# from rest_framework.response import Response
# from rest_framework import status
# from django.db import transaction
# from io import BytesIO
import pandas as pd
from datetime import datetime, date



# class OwnerBulkUploadView(APIView):
#     permission_classes = [IsAuthenticated]

#     def parse_int(self, val):
#         if pd.isna(val) or val is None or (isinstance(val, str) and not val.strip()):
#             return None
#         try:
#             return int(float(val))
#         except (ValueError, TypeError):
#             return None

#     def parse_date_str(self, val):
#         if pd.isna(val) or val is None or (isinstance(val, str) and not val.strip()):
#             return None
#         try:
#             dt = pd.to_datetime(val, dayfirst=False, errors='raise')
#             return dt.strftime("%Y-%m-%d")
#         except Exception:
#             return None
#     def parse_dob(self, val):
#         """Parse date_of_birth to DD-MMM-YYYY format for MemberSerializer"""
#         if pd.isna(val) or not val:
#             return None
#         try:
#             dt = pd.to_datetime(val, errors='raise')
#             return dt.strftime("%d-%b-%Y")  # Format: DD-MMM-YYYY
#         except Exception:
#             return None
#     def post(self, request):
#         upload = request.FILES.get('file')
#         if not upload:
#             return Response({
#                 "status": "error",
#                 "message": "No file uploaded"
#             }, status=status.HTTP_400_BAD_REQUEST)

#         try:
#             if upload.name.lower().endswith('.xlsx'):
#                 df = pd.read_excel(upload)
#             else:
#                 df = pd.read_csv(upload)
#         except Exception as exc:
#             return Response({
#                 "status": "error",
#                 "message": "Failed to read file",
#                 "details": str(exc)
#             }, status=status.HTTP_400_BAD_REQUEST)

#         df.columns = df.columns.str.strip().str.lower()
#         required_columns = {
#             'full_name', 'general_contact', 'general_email', 'tower_name', 'tower_number',
#             'unit_name', 'ownership_percentage', 'date_of_ownership'
#         }

#         missing = required_columns - set(df.columns)
#         if missing:
#             return Response({
#                 "status": "error",
#                 "message": "Missing required columns",
#                 "missing_columns": list(missing)
#             }, status=status.HTTP_400_BAD_REQUEST)

#         rows_data = []
#         validation_errors = []
#         unit_ownership_tracker = {}


#         total_ownership = 0
#         for idx, row in df.iterrows():
#             row_num = idx + 2
#             errors = {}

#             tower_name = str(row['tower_name']).strip() if not pd.isna(row['tower_name']) else None
#             tower_number = self.parse_int(row['tower_number'])
#             unit_name = str(row['unit_name']).strip() if not pd.isna(row['unit_name']) else None
#             full_name = str(row['full_name']).strip() if not pd.isna(row['full_name']) else None

#             general_contact_raw = row.get('general_contact', '')
#             general_contact = None
#             if pd.notna(general_contact_raw):
#                 if isinstance(general_contact_raw, float):
#                     general_contact = str(int(general_contact_raw))
#                 else:
#                     general_contact = str(general_contact_raw).strip().replace(" ", "").replace(".0", "")
#                 if general_contact and len(general_contact) == 10 and general_contact.startswith("1"):
#                     general_contact = "0" + general_contact

#             general_email = str(row['general_email']).strip() if not pd.isna(row['general_email']) else None

#             if not full_name:
#                 errors['full_name'] = "Required"
#             if not general_contact:
#                 errors['general_contact'] = "Required"
#             if not general_email:
#                 errors['general_email'] = "Required"
#             if not tower_name:
#                 errors['tower_name'] = "Required"
#             if not unit_name:
#                 errors['unit_name'] = "Required"
#             if tower_number is None:
#                 errors['tower_number'] = "Invalid tower number"

#             # ownership_pct = None
#             # if pd.isna(row['ownership_percentage']):
#             #     errors['ownership_percentage'] = "Required field"
#             # else:
#             #     try:
#             #         ownership_pct = float(row['ownership_percentage'])
#             #         if not (0 <= ownership_pct <= 100):
#             #             errors['ownership_percentage'] = "Must be 0-100"
#             #     except Exception:
#             #         errors['ownership_percentage'] = "Invalid number"

        

#             # if errors:
#             #     validation_errors.append({
#             #         "row": row_num,
#             #         "errors": errors
#             #     })
#             # else:
#             # #     total_ownership += ownership_pct

#             # # if total_ownership > 100:
#             # #     return Response({
#             # #         "status": "error",
#             # #         "message": "Total ownership percentage cannot exceed 100%",
#             # #         "details": f"Sum of ownership percentages is {total_ownership}%, which is over 100%"
#             # #     }, status=status.HTTP_400_BAD_REQUEST)
#             # # Create a unique key per unit
#             #     unit_key = f"{unit_name}"

#             #     # Initialize ownership % for this unit if not already
#             #     if unit_key not in unit_ownership_tracker:
#             #         unit_ownership_tracker[unit_key] = 0

#             #     unit_ownership_tracker[unit_key] += ownership_pct

#                 # Check if this unit exceeds 100%


#             nit_name = row.get("unit_name")
#             ownership_pct = None

#             if pd.isna(row["ownership_percentage"]):
#                 errors["ownership_percentage"] = "Ownership percentage is required"
#             else:
#                 try:
#                     ownership_pct = float(row["ownership_percentage"])
#                     if not (0 <= ownership_pct <= 100):
#                         errors["ownership_percentage"] = "Ownership must be between 0 and 100"
#                 except Exception:
#                     errors["ownership_percentage"] = "Invalid ownership percentage value"

#             if errors:
#                 validation_errors.append({
#                     "row": row_num,
#                     "errors": errors
#                 })
#                 continue

#             unit_key = f"{unit_name}"
#             if unit_key not in unit_ownership_tracker:
#                 unit_ownership_tracker[unit_key] = []
            
#             unit_ownership_tracker[unit_key].append((row_num, ownership_pct))
#             # if unit_ownership_tracker[unit_key] > 100:
#             #     validation_errors.append({
#             #         "row": row_num,
#             #         "errors": {
#             #             "ownership_percentage": (
#             #                 f"Ownership for Unit '{unit_name}' in Tower' "
#             #                 f"exceeds 100% (current total: {unit_ownership_tracker[unit_key]}%)"
#             #             )
#             #         }
#             #     })
#             #     continue  # Skip processing this row
#         for unit_name, entries in unit_ownership_tracker.items():
#             total_ownership = sum(pct for _, pct in entries)

#             if total_ownership != 100:
#                 for row_num, _ in entries:
#                     validation_errors.append({
#                         "row": row_num,
#                         "errors": {
#                             "ownership_percentage": (
#                                 f"Total ownership for unit '{unit_name}' must be exactly 100%. "
#                 f"Currently: {total_ownership}%"
#                             )
#                         }
#                     })



#             date_of_ownership = self.parse_date_str(row['date_of_ownership'])
#             if not date_of_ownership:
#                 errors['date_of_ownership'] = "Invalid date format"

#             def clean_value(val):
#                 if pd.isna(val) or val == '':
#                     return None
#                 return val

#             member_data = {
#                 'full_name': full_name,
#                 'general_contact': general_contact,
#                 'general_email': general_email,
#                 'permanent_address': clean_value(row.get('permanent_address')),
#                 'present_address': clean_value(row.get('present_address')),
#                 'occupation': clean_value(row.get('occupation')),
#                 'gender': clean_value(row.get('gender')),
#                 'marital_status': clean_value(row.get('marital_status')),
#                 'religion': clean_value(row.get('religion')),
#             }


#             dob_str = self.parse_dob(row.get('date_of_birth'))  # Use the new parser
#             if dob_str:
#                 member_data['date_of_birth'] = dob_str
#             elif pd.notna(row.get('date_of_birth')):
#                 errors['date_of_birth'] = "Invalid date format"

#             nid_number_raw = row.get('nid_number', '')
#             nid_number = str(nid_number_raw).strip() if pd.notna(nid_number_raw) else ''
#             if nid_number:
#                 if not nid_number.isdigit() or len(nid_number) not in [10, 13, 17]:
#                     errors['nid_number'] = "NID number must be 10, 13, or 17 digits"
#                 else:
#                     member_data['nid_number'] = nid_number

#             delivery_method = row.get('delivery_method', '')
#             if delivery_method and not pd.isna(delivery_method):
#                 delivery_method = str(delivery_method).strip()
#                 if "@" in delivery_method:
#                     if Member.objects.filter(login_email=delivery_method).exists():
#                         errors['delivery_method'] = "This email address is already in use"
#                 elif delivery_method.isdigit():
#                     contact = delivery_method
#                     if Member.objects.filter(general_contact=contact).exists():
#                         errors['delivery_method'] = "This contact number is already in use"

#                 if 'delivery_method' not in errors:
#                     member_data['delivery_method'] = delivery_method

#             if errors:
#                 validation_errors.append({
#                     "row": row_num,
#                     "errors": errors
#                 })
#                 continue

#             try:
#                 unit = Unit.objects.select_related('floor__tower').get(
#                     unit_name=unit_name,
#                     floor__tower__tower_name=tower_name,
#                     floor__tower__tower_number=tower_number
#                 )
#             except Unit.DoesNotExist:
#                 validation_errors.append({
#                     "row": row_num,
#                     "errors": {
#                         "unit": f"Unit '{unit_name}' in Tower '{tower_name}-{tower_number}' does not exist"
#                     }
#                 })
#                 continue

#             if Owner.objects.filter(unit=unit).exists():
#                 validation_errors.append({
#                     "row": row_num,
#                     "errors": {
#                         "owner": f"Owner already exists for Unit '{unit_name}' in Tower '{tower_name}-{tower_number}'"
#                     }
#                 })
#                 continue

#             rows_data.append({
#                 "row_num": row_num,
#                 "tower_name": tower_name,
#                 "tower_number": tower_number,
#                 "unit_name": unit_name,
#                 "ownership_pct": ownership_pct,
#                 "date_of_ownership": date_of_ownership,
#                 "unit": unit,
#                 "member_data": member_data
#             })

#         if validation_errors:
#             return Response({
#                 "status": "error",
#                 "message": "Validation errors found",
#                 "failed_rows": validation_errors
#             }, status=status.HTTP_400_BAD_REQUEST)

#         try:
#             with transaction.atomic():
#                 created_owners = []
#                 current_user = Member.objects.get(user=request.user)

#                 for row in rows_data:
#                     member_serializer = MemberSerializer(data=row['member_data'], context={'request': request})
#                     member_serializer.is_valid(raise_exception=True)
#                     member = member_serializer.save()
#                     member.is_comm_member = True
#                     member.comm_member_ever_created = True
#                     member.save()

#                     owner = Owner.objects.create(
#                         member=member,
#                         unit=row['unit'],
#                         ownership_percentage=row['ownership_pct'],
#                         date_of_ownership=row['date_of_ownership'],
#                         created_by=current_user,
#                         updated_by=current_user
#                     )

#                     created_owners.append({
#                         "row": row['row_num'],
#                         "owner_id": owner.id,
#                         "unit_id": row['unit'].id
#                     })

#                 return Response({
#                     "status": "success",
#                     "message": f"Successfully created {len(created_owners)} owners",
#                     "created_owners": created_owners
#                 }, status=status.HTTP_201_CREATED)


#         except Exception as e:
#             error_message = str(e)
#             return Response({
#                 "status": "error",
#                 "message": "Transaction failed",
#                 "details": error_message,
#                 "solution": "No records were saved. Please fix the errors and try again."
#             }, status=status.HTTP_400_BAD_REQUEST)



class OwnerBulkUploadView(APIView):
    permission_classes = [IsAuthenticated]

    def parse_int(self, val):
        if pd.isna(val) or val is None or (isinstance(val, str) and not val.strip()):
            return None
        try:
            return int(float(val))
        except (ValueError, TypeError):
            return None

    def parse_date_str(self, val):
        if pd.isna(val) or val is None or (isinstance(val, str) and not val.strip()):
            return None
        try:
            dt = pd.to_datetime(val, dayfirst=False, errors='raise')
            return dt.strftime("%Y-%m-%d")
        except Exception:
            return None

    def parse_dob(self, val):
        if pd.isna(val) or not val:
            return None
        try:
            dt = pd.to_datetime(val, errors='raise')
            return dt.strftime("%d-%b-%Y")
        except Exception:
            return None

    @transaction.atomic
    def post(self, request):
        upload = request.FILES.get('file')
        if not upload:
            return Response({
                "status": "error",
                "message": "No file uploaded",
                "total_rows": 0,
                "success_count": 0,
                "error_count": 0,
                "failed_rows": [],
                "created_owners": []
            }, status=status.HTTP_400_BAD_REQUEST)

        try:
            if upload.name.lower().endswith('.xlsx'):
                df = pd.read_excel(upload)
            else:
                df = pd.read_csv(upload)
        except Exception as exc:
            return Response({
                "status": "error",
                "message": "Failed to read file",
                "total_rows": 0,
                "success_count": 0,
                "error_count": 1,
                "failed_rows": [{
                    "row": "File",
                    "errors": {
                        "file": str(exc)
                    }
                }],
                "created_owners": [],
                "details": str(exc)
            }, status=status.HTTP_400_BAD_REQUEST)

        df.columns = df.columns.str.strip().str.lower()
        # general_contact removed from required_columns - it's now optional
        required_columns = {
            'full_name', 'general_email', 'tower_name', 'tower_number',
            'unit_name', 'ownership_percentage', 'date_of_ownership'
        }
        total_rows = len(df)

        missing = required_columns - set(df.columns)
        if missing:
            return Response({
                "status": "error",
                "message": "Missing required columns",
                "total_rows": total_rows,
                "success_count": 0,
                "error_count": 1,
                "failed_rows": [{
                    "row": "Headers",
                    "errors": {
                        "missing_columns": f"Missing: {', '.join(list(missing))}"
                    }
                }],
                "created_owners": [],
                "missing_columns": list(missing)
            }, status=status.HTTP_400_BAD_REQUEST)

        rows_data = []
        validation_errors = []
        unit_ownership_tracker = {}
        # Track delivery_methods (emails/contacts) in current batch to avoid duplicates
        batch_delivery_methods = set()
        # Track NID numbers in current batch to avoid duplicates
        batch_nid_numbers = set()
        

        for idx, row in df.iterrows():
            row_num = idx + 2
            errors = {}

            tower_name = str(row['tower_name']).strip() if not pd.isna(row['tower_name']) else None
            tower_number = self.parse_int(row['tower_number'])
            unit_name = str(row['unit_name']).strip() if not pd.isna(row['unit_name']) else None
            full_name = str(row['full_name']).strip() if not pd.isna(row['full_name']) else None

            # Contact - optional field with max 11 characters validation
            general_contact_raw = row.get('general_contact', '')
            general_contact = None
            if pd.notna(general_contact_raw):
                if isinstance(general_contact_raw, float):
                    general_contact = str(int(general_contact_raw))
                else:
                    general_contact = str(general_contact_raw).strip()
                
                # Validate max length
                if general_contact and len(general_contact) > 11:
                    errors['general_contact'] = f"Contact number cannot be more than 11 characters (current: {len(general_contact)})"

            general_email = str(row['general_email']).strip() if not pd.isna(row['general_email']) else None

            # Basic validations
            if not full_name:
                errors['full_name'] = "Required"
            # Removed general_contact required validation - it's optional
            if not general_email:
                errors['general_email'] = "Required"
            if not tower_name:
                errors['tower_name'] = "Required"
            if not unit_name:
                errors['unit_name'] = "Required"
            if tower_number is None:
                errors['tower_number'] = "Invalid tower number"

            # Ownership validation
            ownership_pct = None
            if pd.isna(row["ownership_percentage"]):
                errors["ownership_percentage"] = "Ownership percentage is required"
            else:
                try:
                    ownership_pct = float(row["ownership_percentage"])
                    if not (0 <= ownership_pct <= 100):
                        errors["ownership_percentage"] = "Ownership must be between 0 and 100"
                except Exception:
                    errors["ownership_percentage"] = "Invalid ownership percentage value"

            # Date of ownership
            # date_of_ownership = self.parse_date_str(row['date_of_ownership'])
            # if not date_of_ownership:
            #     errors['date_of_ownership'] = "Invalid date format"

            # date_of_ownership = row.get('date_of_ownership')
            # if pd.notna(date_of_ownership):
            #     try:
            #         parsed_date = parse_date_str(date_of_ownership)  # <-- Use custom safe parser
            #         if parsed_date > datetime.date.today():
            #             errors['date_of_ownership'] = "Date of ownership cannot be in the future"
            #     except Exception:
            #         errors['date_of_ownership'] = "Invalid date format"
            # Step 1: Raw date read
                # Step 1: Parse the date using custom parser
            

                date_str = row.get('date_of_ownership')
                parsed_date_str = self.parse_date_str(date_str)

                if not parsed_date_str:
                    errors['date_of_ownership'] = "Invalid date format"
                    date_of_ownership = None  # assign None so it's defined
                else:
                    try:
                        from datetime import datetime, date
                        parsed_date = datetime.strptime(parsed_date_str, "%Y-%m-%d").date()
                        if parsed_date > date.today():
                            errors['date_of_ownership'] = "Date of ownership cannot be in the future"
                        date_of_ownership = parsed_date  # assign the final parsed date here
                    except Exception:
                        errors['date_of_ownership'] = "Invalid date format"
                        date_of_ownership = None  # assign None if parsing fails


            







            # Member fields
            def clean_value(val):
                return None if pd.isna(val) or val == '' else val

            member_data = {
                'full_name': full_name,
                'general_contact': general_contact,
                'general_email': general_email,
                'permanent_address': clean_value(row.get('permanent_address')),
                'present_address': clean_value(row.get('present_address')),
                'occupation': clean_value(row.get('occupation')),
                'gender': clean_value(row.get('gender')),
                'marital_status': clean_value(row.get('marital_status')),
                'religion': clean_value(row.get('religion')),
            }

            dob_str = self.parse_dob(row.get('date_of_birth'))
            if dob_str:
                member_data['date_of_birth'] = dob_str
            elif pd.notna(row.get('date_of_birth')):
                errors['date_of_birth'] = "Invalid date format"

            # NID number - no validation at all, just store as-is
            # Handle duplicates silently by setting to None to avoid database constraint violation
            nid_number_raw = row.get('nid_number', '')
            nid_number = None
            if pd.notna(nid_number_raw):
                nid_number_str = str(nid_number_raw).strip()
                if nid_number_str:
                    # Check if duplicate (database or current batch) - set to None silently
                    if Member.objects.filter(nid_number=nid_number_str).exists() or nid_number_str in batch_nid_numbers:
                        # Duplicate found - set to None (no error, just skip storing)
                        nid_number = None
                    else:
                        # Store as-is, no format validation
                        nid_number = nid_number_str
                        batch_nid_numbers.add(nid_number_str)
            
            # Set nid_number in member_data only if not None
            # If None (empty or duplicate), don't include it - serializer will use None
            if nid_number is not None:
                member_data['nid_number'] = nid_number

            delivery_method = row.get('delivery_method', '')
            if delivery_method and not pd.isna(delivery_method):
                delivery_method = str(delivery_method).strip()
                if "@" in delivery_method:
                    # Check both existing members and current batch
                    if Member.objects.filter(login_email=delivery_method).exists():
                        errors['delivery_method'] = "This email address is already in use"
                    elif delivery_method.lower() in batch_delivery_methods:
                        errors['delivery_method'] = "This email address is already in use in this upload"
                    else:
                        batch_delivery_methods.add(delivery_method.lower())
                elif delivery_method.isdigit():
                    # Check both existing members and current batch
                    if Member.objects.filter(general_contact=delivery_method).exists():
                        errors['delivery_method'] = "This contact number is already in use"
                    elif delivery_method in batch_delivery_methods:
                        errors['delivery_method'] = "This contact number is already in use in this upload"
                    else:
                        batch_delivery_methods.add(delivery_method)

                if 'delivery_method' not in errors:
                    member_data['delivery_method'] = delivery_method

            if errors:
                validation_errors.append({"row": row_num, "errors": errors})
                continue

            try:
                unit = Unit.objects.select_related('floor__tower').get(
                    unit_name=unit_name,
                    floor__tower__tower_name=tower_name,
                    floor__tower__tower_number=tower_number
                )
            except Unit.DoesNotExist:
                validation_errors.append({
                    "row": row_num,
                    "errors": {
                        "unit": f"Unit '{unit_name}' in Tower '{tower_name}-{tower_number}' does not exist"
                    }
                })
                continue

            if Owner.objects.filter(unit=unit).exists():
                validation_errors.append({
                    "row": row_num,
                    "errors": {
                        "owner": f"Owner already exists for Unit '{unit_name}' in Tower '{tower_name}-{tower_number}'"
                    }
                })
                continue

            # Only add to unit_ownership_tracker AFTER all validations pass
            # Group unit ownership by tower_name, tower_number, and unit_name
            # This ensures units with the same name in different towers are tracked separately
            # Use tuple as key to avoid issues with underscores in tower/unit names
            # Only add if ownership_pct is valid (should always be valid at this point due to validation above)
            if ownership_pct is not None:
                unit_key = (tower_name, tower_number, unit_name)
                if unit_key not in unit_ownership_tracker:
                    unit_ownership_tracker[unit_key] = []
                unit_ownership_tracker[unit_key].append((row_num, ownership_pct))

            rows_data.append({
                "row_num": row_num,
                "tower_name": tower_name,
                "tower_number": tower_number,
                "unit_name": unit_name,
                "ownership_pct": ownership_pct,
                "date_of_ownership": date_of_ownership,
                "unit": unit,
                "member_data": member_data
            })

        # Ownership total check per unit (per tower)
        # unit_key is a tuple: (tower_name, tower_number, unit_name)
        # Use tolerance for floating point comparison (0.01% tolerance)
        for unit_key, entries in unit_ownership_tracker.items():
            total_ownership = sum(pct for _, pct in entries if pct is not None)
            if abs(total_ownership - 100.0) > 0.01:
                # Extract values from tuple key for display
                tower_name_display, tower_number_display, unit_name_display = unit_key
                display_unit = f"'{unit_name_display}' in Tower '{tower_name_display}-{tower_number_display}'"
                
                for row_num, _ in entries:
                    validation_errors.append({
                        "row": row_num,
                        "errors": {
                            "ownership_percentage": (
                                f"Total ownership for unit {display_unit} must be exactly 100%. "
                                f"Currently: {total_ownership}%"
                            )
                        }
                    })

        if validation_errors:
            return Response({
                "status": "error",
                "message": "Validation errors found",
                "total_rows": total_rows,
                "success_count": 0,
                "error_count": len(validation_errors),
                "failed_rows": validation_errors,
                "created_owners": []
            }, status=status.HTTP_400_BAD_REQUEST)

        # ✅ If all validation passed, proceed with saving data inside a transaction
        # This ensures that if ANY error occurs, ALL changes are rolled back
        try:
            # Group validated rows by unit to track initial ownership state per unit
            unit_rows_map = defaultdict(list)
            for row in rows_data:
                unit_rows_map[row['unit']].append(row)
            
            # Get initial ownership state for each unit (before any imports)
            # For bulk upload, initial state should be empty (no existing owners)
            unit_initial_ownership_state = {}
            for unit in unit_rows_map.keys():
                current_owners = Owner.objects.filter(unit=unit).select_related('member')
                unit_initial_ownership_state[unit] = []
                for owner in current_owners:
                    unit_initial_ownership_state[unit].append({
                        'owner_id': owner.id,
                        'member_id': owner.member.id,
                        'name': owner.member.full_name,
                        'share': float(owner.ownership_percentage),
                        'purchase_date': (owner.last_transfer_date or owner.date_of_ownership).isoformat(),
                        'contact': owner.member.general_contact or '',
                        'email': owner.member.general_email or '',
                        'is_leaving': False,
                        'is_joining': False
                    })
            
            with transaction.atomic():
                created_owners = []
                current_user = Member.objects.get(user=request.user)
                
                # Track created owners per unit for building history states
                unit_created_owners = defaultdict(list)
                
                for row in rows_data:
                    try:
                        member_serializer = MemberSerializer(data=row['member_data'], context={'request': request})
                        member_serializer.is_valid(raise_exception=True)
                        member = member_serializer.save()
                        member.is_comm_member = True
                        member.comm_member_ever_created = True
                        member.save()

                        owner = Owner.objects.create(
                            member=member,
                            unit=row['unit'],
                            ownership_percentage=row['ownership_pct'],
                            date_of_ownership=row['date_of_ownership'],
                            created_by=current_user,
                            updated_by=current_user
                        )

                        # Update unit status only after successful owner creation
                        unit = row['unit']
                        unit.unit_status = 'available'
                        unit.status_color = unit.STATUS_COLORS['available']
                        unit.save()

                        created_owners.append({
                            "row": row['row_num'],
                            "owner_id": owner.id,
                            "unit_id": row['unit'].id
                        })
                        
                        # Track created owner for history entry
                        unit_created_owners[row['unit']].append({
                            'owner': owner,
                            'member': member,
                            'date_of_ownership': row['date_of_ownership']
                        })
                        
                    except Exception as e:
                        # If any row fails during save, raise exception to rollback ALL changes
                        logger.error(f"Error saving row {row['row_num']}: {str(e)}")
                        raise
                
                # Create history entries for all imported owners
                import_time = timezone.now().replace(microsecond=0)  # Use current datetime for initial ownership entries
                from datetime import time as dt_time
                
                for unit, created_owners_list in unit_created_owners.items():
                    # Build ownership_state_after with all owners (initial state + newly created)
                    ownership_state_after = []
                    
                    # Add existing owners (if any)
                    for existing_owner_data in unit_initial_ownership_state[unit]:
                        ownership_state_after.append(existing_owner_data)
                    
                    # Add newly created owners
                    for created_item in created_owners_list:
                        owner = created_item['owner']
                        member = created_item['member']
                        ownership_state_after.append({
                            'owner_id': owner.id,
                            'member_id': member.id,
                            'name': member.full_name,
                            'share': float(owner.ownership_percentage),
                            'purchase_date': owner.date_of_ownership.isoformat(),
                            'contact': member.general_contact or '',
                            'email': member.general_email or '',
                            'is_leaving': False,
                            'is_joining': False
                        })
                    
                    # Create initial ownership history entry for this unit
                    # Only create if there are owners (should always be true here)
                    if ownership_state_after:
                        try:
                            # Determine if single owner or multiple owners
                            if len(ownership_state_after) == 1:
                                entry_type = 'initial_ownership'
                                owners_data = [ownership_state_after[0]]
                            else:
                                entry_type = 'initial_ownership_list'
                                owners_data = ownership_state_after
                            
                            # Use current datetime for initial ownership entry date
                            entry_date = import_time
                            
                            UnitOwnershipHistory.create_initial_ownership_entry(
                                unit=unit,
                                owners_data=owners_data,
                                entry_date=entry_date,
                                created_by=current_user
                            )
                            logger.info(f"✅ Created initial ownership history entry for unit {unit.unit_name}")
                        except Exception as e:
                            logger.error(f"Error creating ownership history entry for unit {unit.unit_name}: {str(e)}")
                            # Don't fail the request if history creation fails

                # Create bulk upload summary notifications grouped by unit
                try:
                    from notifications.utils import create_bulk_upload_summary_notification
                    
                    # Group created owners by unit (using unit from unit_created_owners which has the actual unit objects)
                    unit_owner_counts = defaultdict(int)
                    for unit, created_owners_list in unit_created_owners.items():
                        unit_owner_counts[unit] = len(created_owners_list)
                    
                    # Create notification for each unit
                    for unit, count in unit_owner_counts.items():
                        try:
                            create_bulk_upload_summary_notification(
                                unit=unit,
                                count=count,
                                upload_type='owner',
                                creator=current_user
                            )
                        except Exception as e:
                            logger.error(f"Error creating bulk upload notification for unit {unit.unit_name}: {str(e)}")
                            # Don't fail the request if notification creation fails
                except Exception as e:
                    logger.error(f"Error creating bulk upload notifications: {str(e)}")
                    # Don't fail the request if notification creation fails

                return Response({
                    "status": "success",
                    "message": f"Successfully created {len(created_owners)} owners",
                    "total_rows": total_rows,
                    "success_count": len(created_owners),
                    "error_count": 0,
                    "failed_rows": [],
                    "created_owners": created_owners
                }, status=status.HTTP_201_CREATED)

        except Exception as e:
            return Response({
                "status": "error",
                "message": "Transaction failed - No data was saved",
                "total_rows": total_rows,
                "success_count": 0,
                "error_count": total_rows,
                "failed_rows": [{
                    "row": "All",
                    "errors": {
                        "transaction": str(e)
                    }
                }],
                "created_owners": [],
                "details": str(e),
                "solution": "Please fix the errors and try again. Common issues: data too long for fields, invalid format, etc."
            }, status=status.HTTP_400_BAD_REQUEST)