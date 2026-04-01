from rest_framework import generics
from towers.models import Tower,Unit,Floor,UnitStaff
from towers.serializers.tower_serializers import TowerSerializer,UnitSideDetailSerializer,UnitSerializer
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status
from rest_framework.permissions import IsAuthenticated
from rest_framework.exceptions import NotFound
from user.permissions import HasRequiredPermission
from django.shortcuts import get_object_or_404
from user.models import Member
from django.http import JsonResponse
from towers.models import Resident,Owner
from django.db.models import Q

from user.serializers import MemberSerializer
import re

class GetLastTowerNumber(APIView):
    """
    Get the last tower number from the database and return (last_tower_number + 1)
    """
    permission_classes = [IsAuthenticated,HasRequiredPermission]
    required_permission_id = [10]

    def get(self, request):
        last_tower = Tower.objects.order_by("-tower_number").first()
        last_tower_number = last_tower.tower_number if last_tower else 0  # If no towers exist, start from 1
        return Response({"lastTowerNumber": last_tower_number + 1}, status=status.HTTP_200_OK)

class CreateTower(APIView):
    permission_classes = [IsAuthenticated,HasRequiredPermission]
    required_permission_id = [10]
    def post(self, request):
        print(request.data)
        serializer = TowerSerializer(data=request.data,context={'request': request})
        if serializer.is_valid():
            serializer.save()
            return Response({"message": "Tower created successfully"}, status=status.HTTP_201_CREATED)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

class TowerList(APIView):
    permission_classes = [IsAuthenticated,HasRequiredPermission]
    required_permission_id = [12]
    def get(self, request):
        # Optimize query with select_related and prefetch_related to eliminate N+1 queries
        from django.db.models import Prefetch
        
        towers = Tower.objects.select_related(
            'created_by',
            'updated_by'
        ).prefetch_related(
            Prefetch(
                'floor_set',
                queryset=Floor.objects.order_by('-floor_no').prefetch_related(
                    Prefetch(
                        'unit_set',
                        queryset=Unit.objects.only('id', 'unit_name', 'unit_status', 'status_color').order_by('id')
                    )
                )
            )
        )
        towers = list(towers)
        
        def natural_sort_key(s):
            if not s: return (2, [])
            s = str(s).strip()
            if not s: return (2, [])
            # Priority: Has digit (0) < No digit (1)
            has_digit = any(c.isdigit() for c in s)
            prefix = 0 if has_digit else 1
            parts = []
            for text in re.split(r'(\d+)', s):
                if text.isdigit():
                    parts.append((0, int(text)))
                elif text:
                    parts.append((1, text.lower()))
            return (prefix, parts)
            
        towers.sort(key=lambda x: natural_sort_key(x.tower_name))
        
        serializer = TowerSerializer(towers, many=True, context={'request': request})
        return Response(serializer.data)

class UpdateTower(APIView):
    permission_classes = [IsAuthenticated,HasRequiredPermission]
    required_permission_id = [11]

    def put(self, request, pk):
        try:
            # Fetch the tower instance to update
            tower = Tower.objects.get(id=pk)
        except Tower.DoesNotExist:
            return Response({"detail": "Tower not found."}, status=status.HTTP_404_NOT_FOUND)

        print(request.data) 

        # Pass the tower instance and the request context to the serializer
        serializer = TowerSerializer(tower, data=request.data, context={'request': request}, partial=True)

        # Check if the provided data is valid
        if serializer.is_valid():
            # Save the updated tower instance
            serializer.save()
            return Response({"message": "Tower updated successfully"}, status=status.HTTP_200_OK)

        # If there are validation errors, return them
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

class TowerDetails(APIView):
    permission_classes = [IsAuthenticated,HasRequiredPermission]
    required_permission_id = [11]

    def get(self, request, pk):
        try:
            # Retrieve the user profile by primary key (pk)
            tower_profile = Tower.objects.get(pk=pk)
        except Tower.DoesNotExist:
            raise NotFound("Tower not found")

        serializer = TowerSerializer(tower_profile)
        return Response(serializer.data)

class DeleteTower(APIView):
    permission_classes = [IsAuthenticated]

    def delete(self, request, pk):
        try:
            # Retrieve the tower by primary key (pk)
            tower_profile = Tower.objects.get(pk=pk)
        except Tower.DoesNotExist:
            raise NotFound("Tower not found")
        floors = Floor.objects.filter(tower=tower_profile)

        for floor in floors:
            units = Unit.objects.filter(floor=floor)
            for unit in units:
                if unit.updated_by is not None:
                    return Response(
                        {"message": f"Unit No: {unit.unit_name} on Floor No: {floor.floor_no} has already been updated by an user."},
                        status=status.HTTP_400_BAD_REQUEST
                    )
                elif Owner.objects.filter(unit=unit).exists():
                    return Response(
                        {"message": f"An owner is already associated with Unit No: {unit.unit_name} in this tower."},
                        status=status.HTTP_400_BAD_REQUEST
                    ) 
                elif Resident.objects.filter(unit=unit).exists():
                    return Response(
                        {"message": f"A resident is already associated with Unit No: {unit.unit_name} in this tower."},
                        status=status.HTTP_400_BAD_REQUEST
                    )
                elif UnitStaff.objects.filter(unit=unit).exists():
                    return Response(
                        {"message": f"Unit staff is already associated with Unit No: {unit.unit_name} in this tower."},
                        status=status.HTTP_400_BAD_REQUEST
                    )

        # Delete the tower
        tower_profile.delete()
        return Response({"message": "Tower deleted successfully"}, status=status.HTTP_204_NO_CONTENT)
    
class UnitSideDetails(APIView):
    def get(self, request, pk):
        
        unit = get_object_or_404(Unit, pk=pk)
        
        
        serializer = UnitSideDetailSerializer(unit)
        
        
        return Response(serializer.data)

class UpdateUnit(APIView):
    def put(self, request, pk):
        print(request.data) 

        try:
            # Fetch the tower instance to update
            unit = Unit.objects.get(id=pk)
        except Unit.DoesNotExist:
            return Response({"detail": "Unit not found."}, status=status.HTTP_404_NOT_FOUND)


        # Pass the tower instance and the request context to the serializer
        serializer = UnitSerializer(unit, data=request.data, context={'request': request}, partial=True)

        # Check if the provided data is valid
        if serializer.is_valid():
            # Save the updated tower instance
            serializer.save()
            return Response({"message": "Unit updated successfully"}, status=status.HTTP_200_OK)

        # If there are validation errors, return them
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

# class UnitDetails(APIView):

#     def get(self, request, pk):
#         try:
#             # Retrieve the user profile by primary key (pk)
#             unit_profile = Unit.objects.get(pk=pk)
#         except Tower.DoesNotExist:
#             raise NotFound("Tower not found")

#         serializer = UnitSerializer(unit_profile)
#         return Response(serializer.data)
class UnitDetails(APIView):
    def get(self, request, pk):
        try:
            unit_profile = Unit.objects.prefetch_related('docs').get(pk=pk)
        except Unit.DoesNotExist:
            raise NotFound("Unit not found")

        serializer = UnitSerializer(unit_profile, context={'request': request})
        return Response(serializer.data)
 
class AddExistingMemberForOwner(APIView):

    def get(self, request, format=None):
        # Retrieve all members where is_org_member=True OR is_comm_member=True
        members = Member.objects.filter(Q(is_org_member=True) | Q(is_comm_member=True))
        members_serializer = MemberSerializer(members, many=True)

        # print("hello",len(members_serializer.data))

        return Response({ "org_members": members_serializer.data})


class AddExistingMemberForContact(APIView):
    def get(self, request, pk):
        # Retrieve the Unit object or return a 404 if not found.
        unit = get_object_or_404(Unit, id=pk)

        # --- Process Owner Contacts ---
        owner_qs = Owner.objects.filter(unit_id=pk)
        owner_member_ids = list(owner_qs.values_list('member', flat=True))
        owner_members = Member.objects.filter(id__in=owner_member_ids)
        serialized_owner_members = MemberSerializer(owner_members, many=True)

        # Remove unwanted keys and mark them as owners.
        owners_list = []
        for owner_data in serialized_owner_members.data:
            owner_data.pop("member_roles", None)
            owner_data.pop("member_groups", None)
            owner_data.pop("member_type_edit", None)
            owner_data["contact_type"] = "owner"
            owners_list.append(owner_data)

        # --- Process Resident Contacts ---
        resident_qs = Resident.objects.filter(unit_id=pk, is_active=True)
        
        # Create a mapping of member_id to is_resident_or_tenant flag
        resident_tenant_map = {r.member_id: r.is_resident_or_tenant for r in resident_qs}
        
        resident_member_ids = list(resident_qs.values_list('member', flat=True))
        resident_members = Member.objects.filter(id__in=resident_member_ids)
        serialized_resident_members = MemberSerializer(resident_members, many=True)

        # Remove unwanted keys and mark them as residents.
        # Also add the is_resident_or_tenant flag from the Resident model
        residents_list = []
        for resident_data in serialized_resident_members.data:
            resident_data.pop("member_roles", None)
            resident_data.pop("member_groups", None)
            resident_data.pop("member_type_edit", None)
            resident_data["contact_type"] = "resident"
            # Add the is_resident_or_tenant flag to distinguish tenant from resident
            resident_data["is_resident_or_tenant"] = resident_tenant_map.get(resident_data['id'], True)
            residents_list.append(resident_data)

        # --- Process Unit Staff Contacts ---
        # Include unit staff to show all contacts for the unit, including org members who are unit staff
        unit_staff_qs = UnitStaff.objects.filter(unit_id=pk, is_active=True)
        unit_staff_member_ids = list(unit_staff_qs.values_list('member', flat=True))
        unit_staff_members = Member.objects.filter(id__in=unit_staff_member_ids)
        serialized_unit_staff_members = MemberSerializer(unit_staff_members, many=True)

        # Remove unwanted keys and mark them as unit staff
        unit_staff_list = []
        for staff_data in serialized_unit_staff_members.data:
            staff_data.pop("member_roles", None)
            staff_data.pop("member_groups", None)
            staff_data.pop("member_type_edit", None)
            staff_data["contact_type"] = "unit_staff"
            unit_staff_list.append(staff_data)

        # --- Additional Unit Information ---
        # For the unit_owner_name, we'll pick the first owner's member full_name, if any.
        owner_instance = owner_qs.first()
        unit_owner_name = owner_instance.member.full_name if owner_instance else None

        # Get floor name (assuming floor_no is descriptive) and tower name if available.
        floor_name = unit.floor.floor_no if unit.floor else None
        tower_name = unit.floor.tower.tower_name if hasattr(unit.floor, 'tower') and unit.floor.tower else None

        # Prepare the composite response payload.
        response_data = {
            "owners": owners_list,
            "residents": residents_list,
            "unit_staff": unit_staff_list,
            "unit_owner_name": unit_owner_name,
            "floor_name": floor_name,
            "tower_name": tower_name,
            "unit_name": unit.unit_name,
        }
        
        return Response(response_data)
        


class CommunityMemberTowerList(APIView):
    """
    API view for community members to get all towers for bulletin creation
    Only requires authentication, no special permissions needed
    """
    permission_classes = [IsAuthenticated]

    def get(self, request):
        try:
            # Get the current user's member profile
            member = request.user.member
            
            # If user is not a community member, return empty list
            if not member.is_comm_member:
                return Response([])
            
            # Return ALL towers from the database for community members
            # This allows them to create bulletins targeting any tower
            towers = list(Tower.objects.all().values('id', 'tower_name', 'tower_number'))
            
            def natural_sort_key(s):
                if not s: return (2, [])
                s = str(s).strip()
                if not s: return (2, [])
                # Priority: Has digit (0) < No digit (1)
                has_digit = any(c.isdigit() for c in s)
                prefix = 0 if has_digit else 1
                parts = []
                for text in re.split(r'(\d+)', s):
                    if text.isdigit():
                        parts.append((0, int(text)))
                    elif text:
                        parts.append((1, text.lower()))
                return (prefix, parts)
                
            towers.sort(key=lambda x: natural_sort_key(x['tower_name']))
            
            return Response(towers)
            
        except Exception as e:
            # If there's any error, return empty list for security
            return Response([])


class CommunityMemberUnitList(APIView):
    """
    API view for community members to get units for bulletin creation
    Only requires authentication, no special permissions needed
    """
    permission_classes = [IsAuthenticated]

    def get(self, request):
        try:
            # Get the current user's member profile
            member = request.user.member
            
            # If user is not a community member, return empty list
            if not member.is_comm_member:
                return Response([])
            
            # Get tower IDs from query params
            tower_ids = request.query_params.get('tower_ids', None)
            
            if tower_ids:
                # Parse comma-separated tower IDs
                tower_id_list = [int(id.strip()) for id in tower_ids.split(',') if id.strip().isdigit()]
                
                # Get ALL units in the specified towers (not just user's units)
                # This allows community members to target any unit in those towers
                units_data = []
                for unit in Unit.objects.filter(floor__tower__id__in=tower_id_list).select_related('floor__tower'):
                    units_data.append({
                        'id': unit.id,
                        'unit_name': unit.unit_name,
                        'tower_id': unit.floor.tower.id,
                        'tower_name': unit.floor.tower.tower_name,
                    })
                
                return Response(units_data)
            else:
                # If no tower IDs specified, return ALL units from ALL towers
                # This allows community members to see all available units
                units_data = []
                for unit in Unit.objects.all().select_related('floor__tower'):
                    units_data.append({
                        'id': unit.id,
                        'unit_name': unit.unit_name,
                        'tower_id': unit.floor.tower.id,
                        'tower_name': unit.floor.tower.tower_name,
                    })
                
                return Response(units_data)
                
        except Exception as e:
            # If there's any error, return empty list for security
            return Response([])