"""
Optimized API endpoint for fetching unit contacts
Designed for the "Add Unit Contact" modal with minimal queries and data transfer
"""
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status
from rest_framework.permissions import IsAuthenticated
from user.permissions import HasRequiredPermission
from django.db.models import Q, Prefetch
from towers.models import Owner, Resident, UnitStaff
from towers.serializers.unit_contact_serializers import (
    UnitContactOwnerSerializer,
    UnitContactResidentSerializer,
    UnitContactUnitStaffSerializer
)


class UnitContactList(APIView):
    """
    Optimized endpoint to fetch all contacts (owners, residents, unit staff) for a specific unit.
    
    Query Parameters:
    - unit_id (required): The ID of the unit to fetch contacts for
    - search (optional): Search term to filter by name, contact, or email (min 3 chars)
    - member_type (optional): Filter by member type (owner, resident, resident_tenant, unit_staff)
    
    Performance optimizations:
    - Uses select_related to prevent N+1 queries
    - Filters by unit_id at database level
    - Uses lightweight serializers with minimal fields
    - Deduplicates residents at database level using distinct()
    """
    permission_classes = [IsAuthenticated, HasRequiredPermission]
    
    def get(self, request):
        unit_id = request.GET.get('unit_id')
        search_query = request.GET.get('search', '').strip().lower()
        member_types = request.GET.getlist('member_type')
        
        # Validate unit_id
        if not unit_id:
            return Response(
                {'error': 'unit_id parameter is required'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        try:
            unit_id = int(unit_id)
        except ValueError:
            return Response(
                {'error': 'unit_id must be a valid integer'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        # Only use search if it's 3+ characters (matches backend behavior)
        if len(search_query) < 3:
            search_query = None
        
        # Determine what to fetch
        show_all = not member_types and not search_query
        wants_owner = show_all or "owner" in member_types or search_query
        wants_resident = show_all or "resident" in member_types or search_query
        wants_tenant = show_all or "resident_tenant" in member_types or search_query
        wants_unit_staff = show_all or "unit_staff" in member_types or search_query
        
        data = {
            'owners': [],
            'resident_members': [],
            'unit_staff': [],
        }
        
        # ===== OWNERS =====
        if wants_owner:
            # Remove is_org_member filter to include organization members who are added as owners
            # This allows finding owners that were added regardless of their member status flags
            owners_qs = Owner.objects.filter(
                unit_id=unit_id
            ).select_related(
                'member',           # Prevent N+1 for member
                'unit',             # Prevent N+1 for unit
                'unit__floor',      # Prevent N+1 for floor
                'unit__floor__tower'  # Prevent N+1 for tower
            )
            
            if search_query:
                owners_qs = owners_qs.filter(
                    Q(member__full_name__icontains=search_query) |
                    Q(member__general_contact__icontains=search_query) |
                    Q(member__general_email__icontains=search_query)
                )
            
            # Use only() to fetch only needed fields from member
            owners_qs = owners_qs.only(
                'id',
                'unit_id',
                'member__id',
                'member__full_name',
                'member__general_contact',
                'member__general_email',
                'member__photo',
                'member__photo_low_quality',
                'unit__unit_name',
                'unit__floor__floor_no',
                'unit__floor__tower__tower_name',
            )
            
            owner_serializer = UnitContactOwnerSerializer(owners_qs, many=True)
            data['owners'] = owner_serializer.data
        
        # ===== RESIDENTS =====
        if wants_resident or wants_tenant:
            residents_qs = Resident.objects.filter(
                unit_id=unit_id,
                is_active=True
            ).select_related(
                'member',
                'unit',
                'unit__floor',
                'unit__floor__tower'
            )
            
            # Filter by resident type if specific type is requested
            if not show_all and not search_query:
                if wants_resident and not wants_tenant:
                    residents_qs = residents_qs.filter(is_resident_or_tenant=True)
                elif wants_tenant and not wants_resident:
                    residents_qs = residents_qs.filter(is_resident_or_tenant=False)
            
            if search_query:
                residents_qs = residents_qs.filter(
                    Q(member__full_name__icontains=search_query) |
                    Q(member__general_contact__icontains=search_query) |
                    Q(member__general_email__icontains=search_query)
                )
            
            # Deduplicate by member_id at database level
            # Order by member_id and -id to get the most recent resident record per member
            # Then use distinct('member_id') for PostgreSQL (requires ordering by that field)
            residents_qs = residents_qs.only(
                'id',
                'unit_id',
                'is_resident_or_tenant',
                'member__id',
                'member__full_name',
                'member__general_contact',
                'member__general_email',
                'member__photo',
                'member__photo_low_quality',
                'unit__unit_name',
                'unit__floor__floor_no',
                'unit__floor__tower__tower_name',
            ).order_by('member_id', '-id')
            
            # Use distinct on member_id (PostgreSQL supports this)
            # For other databases, this will still work but may return all records
            # In that case, we can add database-specific handling if needed
            from django.db import connection
            if 'postgresql' in connection.vendor:
                residents_qs = residents_qs.distinct('member_id')
            else:
                # For other databases, use Python-level deduplication
                # Still more efficient than the old approach since we're only processing one unit's data
                seen_member_ids = set()
                distinct_residents_list = []
                for resident in residents_qs:
                    if resident.member_id not in seen_member_ids:
                        seen_member_ids.add(resident.member_id)
                        distinct_residents_list.append(resident)
                # Create a new queryset-like structure (we'll serialize directly)
                residents_qs = distinct_residents_list
            
            # Handle both queryset and list (for non-PostgreSQL databases)
            if isinstance(residents_qs, list):
                resident_serializer = UnitContactResidentSerializer(residents_qs, many=True)
            else:
                resident_serializer = UnitContactResidentSerializer(residents_qs, many=True)
            data['resident_members'] = resident_serializer.data
        
        # ===== UNIT STAFF =====
        if wants_unit_staff:
            # Remove is_org_member filter to include organization members who are added as unit staff
            # This allows finding unit staff that were added regardless of their member status flags
            # This matches the behavior of the Residents List which shows all active residents
            unit_staff_qs = UnitStaff.objects.filter(
                unit_id=unit_id,
                is_active=True
            ).select_related(
                'member',
                'unit',
                'unit__floor',
                'unit__floor__tower'
            )
            
            if search_query:
                unit_staff_qs = unit_staff_qs.filter(
                    Q(member__full_name__icontains=search_query) |
                    Q(member__general_contact__icontains=search_query) |
                    Q(member__general_email__icontains=search_query)
                )
            
            unit_staff_qs = unit_staff_qs.only(
                'id',
                'unit_id',
                'member__id',
                'member__full_name',
                'member__general_contact',
                'member__general_email',
                'member__photo',
                'member__photo_low_quality',
                'unit__unit_name',
                'unit__floor__floor_no',
                'unit__floor__tower__tower_name',
            )
            
            staff_serializer = UnitContactUnitStaffSerializer(unit_staff_qs, many=True)
            data['unit_staff'] = staff_serializer.data
        
        return Response(data, status=status.HTTP_200_OK)

