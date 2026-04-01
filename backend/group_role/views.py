from django.shortcuts import render

# Create your views here.
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from rest_framework import status
from .models import Group,Role, RolePermission,RoleGroup,MembersRole,Permission, GlobalRolePermission
from .serializers import GroupSerializer,GroupDetailSerializer,RoleSerializer, RolePermissionSerializer,RoleGroupSerializer,GroupMemberAddListSerializer,GroupListSerializer,PermissionSerializer, GlobalRolePermissionSerializer
from user.models import Member
from django.db.models import Q
from user.permissions import HasRequiredPermission
from audit_trail.create_audit_trail import create_audit_trail
from django.forms.models import model_to_dict

# Group Views
class CreateGroup(APIView):
    # permission_classes = [IsAuthenticated,HasRequiredPermission]
    # # Here define the permission id in the database to have access of this view
    # required_permission_id = [7]

    def post(self, request):
        serializer = GroupSerializer(data=request.data,context={'request': request})
        if serializer.is_valid():
            group = serializer.save()
            group_data = model_to_dict(group)
            try:
                member = request.user.member
            except AttributeError:
                # Fallback: if the reverse relation isn't set, query the Member model.
                member = Member.objects.get(user=request.user)
            
            # Log the audit trail event.
            create_audit_trail(
                member=member,
                event_type='GROUP_CREATE',
                table_name='Group',
                row_id=group.id,
                new_data=group_data,
                description='Group created'
            )
            return Response(serializer.data, status=status.HTTP_201_CREATED)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


class GroupList(APIView):
    permission_classes = [IsAuthenticated,HasRequiredPermission]
    # Here define the permission id in the database to have access of this view
    required_permission_id = [9]

    def get(self, request):
        groups = Group.objects.all()
       
        status_filters = request.GET.getlist('status')   
        search_term = request.GET.get('search', '').strip()

        
        print("Status Filters:", status_filters)
        print("Search Term:", search_term)

        if status_filters:
            statuses = []
            for s in status_filters:
                if s == "1":
                    statuses.append(True)
                elif s == "0":
                    statuses.append(False)
            
            print("Converted Statuses:", statuses)
            if statuses:
                groups = groups.filter(is_active__in=statuses)
        
        if search_term and len(search_term) >= 3:
            groups = groups.filter(group_name__icontains=search_term)
        
        serializer = GroupListSerializer(groups, many=True)
        return Response({"groups": serializer.data}, status=status.HTTP_200_OK)



class GetGroupDetails(APIView):
    permission_classes = [IsAuthenticated,HasRequiredPermission]
    # Here define the permission id in the database to have access of this view
    required_permission_id = [9]


    def get(self, request, pk):
        try:
            # print("Fetching Group with ID:", pk)
            group = Group.objects.get(pk=pk)
        except Group.DoesNotExist:
            return Response({'error': 'Group not found'}, status=status.HTTP_404_NOT_FOUND)
        
        serializer = GroupDetailSerializer(group, context={'request': request})
        # print('Fetched Group Detail:', serializer.data)
        return Response(serializer.data, status=status.HTTP_200_OK)

class UpdateGroup(APIView):
    permission_classes = [IsAuthenticated,HasRequiredPermission]
    # Here define the permission id in the database to have access of this view
    required_permission_id = [8]


    def put(self, request, pk):
        try:
            group = Group.objects.get(pk=pk)
            old_data = model_to_dict(group)
            serializer = GroupSerializer(group, data=request.data, partial=True, context={'request': request})
            if serializer.is_valid():
                updated_group = serializer.save()
                new_data = model_to_dict(updated_group)   

              
                try:
                    member = request.user.member
                except AttributeError:
                    member = Member.objects.get(user=request.user)

               
                create_audit_trail(
                    member=member,
                    event_type='GROUP_UPDATE',
                    table_name='Group',
                    row_id=group.id,
                    old_data=old_data,
                    new_data=new_data,
                    description='Group updated'
                )
                return Response(serializer.data, status=status.HTTP_200_OK)
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
        except Group.DoesNotExist:
            return Response({"error": "Group not found"}, status=status.HTTP_404_NOT_FOUND)  
        
class GroupStatusChange(APIView):
    # permission_classes = [IsAuthenticated, HasRequiredPermission]
    # # Define the required permission id as needed
    # required_permission_id = [10]  

    def post(self, request, pk):
        try:
            group = Group.objects.get(pk=pk)
        except Group.DoesNotExist:
            return Response({'error': 'Group not found'}, status=status.HTTP_404_NOT_FOUND)
        
        old_data = {"is_active": group.is_active}
        # Toggle the group status.
        group.is_active = not group.is_active
        group.save()

        # Update all RoleGroup entries for this group.
        RoleGroup.objects.filter(group=group).update(is_active=group.is_active)

        new_data = {"is_active": group.is_active}

        try:
            member = request.user.member
        except AttributeError:
            member = Member.objects.get(user=request.user)

        # Log the audit trail event
        create_audit_trail(
            member=member,
            event_type='GROUP_STATUS_CHANGE',
            table_name='Group',
            row_id=group.id,
            old_data=old_data,
            new_data=new_data,
            description=f'Group status changed to {"Active" if group.is_active else "Inactive"}'
        )

        serializer = GroupDetailSerializer(group, context={'request': request})
        return Response(serializer.data, status=status.HTTP_200_OK)
    

class GroupMemberAddList(APIView):
    permission_classes = [IsAuthenticated, HasRequiredPermission]
    required_permission_id = [9]

    def get(self, request):
        # member_query = Member.objects.filter(is_org_member = True)
        # member_query = Member.objects.all()
        member_query = Member.objects.filter(
                Q(is_org_member=True) | Q(org_member_ever_created=True)
            )

        # --- Filter by member type using IDs ---
        member_type_params = request.GET.getlist('member_type')
        if member_type_params:
            try:
                type_ids = [int(t.strip()) for t in member_type_params if t.strip().isdigit()]
                if type_ids:
                    member_query = member_query.filter(member_type__id__in=type_ids)
            except ValueError:
                return Response({"error": "MemberType Not found"}, status=status.HTTP_404_NOT_FOUND)

        # --- Filter by role ---
        role_params = request.GET.getlist('role')
        if role_params:
           
            role_params = [p.strip().lower() for p in role_params]
            role_ids = []
            include_other = False
            for param in role_params:
                if param.isdigit():
                    role_ids.append(int(param))
                elif param == "other":
                    include_other = True

            if role_ids and include_other:
                # Members with a role from the given IDs...
                members_with_roles = MembersRole.objects.filter(
                    role__id__in=role_ids
                ).values_list('member_id', flat=True)
                # ...plus members with no roles assigned.
                members_no_role = Member.objects.exclude(
                    id__in=MembersRole.objects.all().values_list('member_id', flat=True)
                ).values_list('id', flat=True)
                # Combine the two lists.
                combined_ids = list(set(members_with_roles).union(set(members_no_role)))
                member_query = member_query.filter(id__in=combined_ids)
            elif role_ids:
                member_ids = MembersRole.objects.filter(
                    role__id__in=role_ids
                ).values_list('member_id', flat=True)
                member_query = member_query.filter(id__in=member_ids)
            elif include_other:
                member_query = member_query.filter(
                    ~Q(id__in=MembersRole.objects.all().values_list('member_id', flat=True))
                )

        # --- Filter by search (requires at least 3 characters) ---
        search = request.GET.get('search', '').strip()
        if search and len(search) >= 3:
            member_query = member_query.filter(
                Q(full_name__icontains=search) |
                Q(general_contact__icontains=search) |
                Q(general_email__icontains=search)
            )

        serializer = GroupMemberAddListSerializer(
            member_query, many=True, context={'request': request}
        )
        return Response(serializer.data)



class DeleteGroup(APIView):
    permission_classes = [IsAuthenticated]

    def delete(self, request, pk):
        try:
            group = Group.objects.get(pk=pk)
            group.delete()
            return Response({"message": "Group deleted successfully"}, status=status.HTTP_200_OK)
        except Group.DoesNotExist:
            return Response({"error": "Group not found"}, status=status.HTTP_404_NOT_FOUND)


# Role Views
class CreateRole(APIView):
    # permission_classes = [HasRequiredPermission, IsAuthenticated]
    # required_permission_id = [4]

    def post(self, request):
        serializer = RoleSerializer(data=request.data,context={'request': request})
        if serializer.is_valid():
            role = serializer.save()
            try:
                member = request.user.member
            except AttributeError:
                member = Member.objects.get(user=request.user)
            create_audit_trail(
                member=member,
                event_type='ROLE_CREATED',
                table_name='Role',
                row_id=role.id,
                old_data={},
                new_data=model_to_dict(role),
                description=f'Role "{role.role_name}" has been created.'
            )
            # Return a message along with the created role data
            return Response(
                {"message": "Your new Role has been successfully added.", "data": serializer.data},
                status=status.HTTP_201_CREATED
            )
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)



class RoleList(APIView):
    permission_classes = [IsAuthenticated, HasRequiredPermission]
    required_permission_id = [6]

    def get(self, request):
        roles = Role.objects.all()

        # Apply status filter from FilterSelect if provided (as list "status")
        status_filters = request.GET.getlist('status')
        if status_filters:
            statuses = []
            for s in status_filters:
                if s == "1":
                    statuses.append(True)
                elif s == "0":
                    statuses.append(False)
            if statuses:
                roles = roles.filter(is_active__in=statuses)

        # Search filter: only perform search if the term is at least 3 characters long.
        search = request.GET.get('search', '').strip()
        if search and len(search) >= 3:
            search_lower = search.lower()
            # If the search term starts with "act", treat it as a search for active roles.
            if search_lower.startswith("act"):
                roles = roles.filter(is_active=True)
            # If it starts with "ina", treat it as a search for inactive roles.
            elif search_lower.startswith("ina"):
                roles = roles.filter(is_active=False)
            else:
                roles = roles.filter(Q(role_name__icontains=search))
                
        serializer = RoleSerializer(roles, many=True)
        return Response(serializer.data, status=status.HTTP_200_OK)

class MemberRoleList(APIView):
    permission_classes = [IsAuthenticated, HasRequiredPermission]
    required_permission_id = [6]

    def get(self, request):
        roles = Role.objects.filter(is_active=True)
        serializer = RoleSerializer(roles, many=True)
        return Response(serializer.data, status=status.HTTP_200_OK)
    
    
class AddGroupRoleList(APIView):
    # permission_classes = [IsAuthenticated, HasRequiredPermission]
    # required_permission_id = [6]

    def get(self, request):
        roles = Role.objects.filter(is_active=True)
        serializer = RoleSerializer(roles, many=True)
        return Response(serializer.data, status=status.HTTP_200_OK)

class RoleDetails(APIView):
    permission_classes = [IsAuthenticated,HasRequiredPermission]
    # Here define the permission id in the database to have access of this view
    required_permission_id = [6]

    def get(self, request, pk):
        try:
            role = Role.objects.get(pk=pk)
            serializer = RoleSerializer(role)
            return Response(serializer.data, status=status.HTTP_200_OK)
        except Role.DoesNotExist:
            return Response({"error": "Role not found"}, status=status.HTTP_404_NOT_FOUND)
        
class RoleStatusChange(APIView):
    # permission_classes = [IsAuthenticated, HasRequiredPermission]
    # required_permission_id = [6]

    def put(self, request, pk):
        try:
            role = Role.objects.get(pk=pk)
            old_data = model_to_dict(role)  # Capture the old role data before update

            # Toggle the role's status
            role.is_active = not role.is_active
            role.save()

            # Update related models with the new status
            MembersRole.objects.filter(role=role).update(is_active=role.is_active)
            RolePermission.objects.filter(role=role).update(is_active=role.is_active)
            RoleGroup.objects.filter(role=role).update(is_active=role.is_active)

            # Retrieve the Member instance associated with the current user
            try:
                   member = request.user.member
            except AttributeError:
                try:
                    member = Member.objects.get(user=request.user)
                except Member.DoesNotExist:
                    member = None  # or handle this case accordingly

            # Log the audit trail event
            create_audit_trail(
                member=member,
                event_type='ROLE_STATUS_CHANGED',
                table_name='Role',
                row_id=role.id,
                old_data=old_data,
                new_data=model_to_dict(role),
                description=f'Role "{role.role_name}" status changed to {"Active" if role.is_active else "Inactive"}.'
            )

            serializer = RoleSerializer(role)
            return Response(serializer.data, status=status.HTTP_200_OK)
        except Role.DoesNotExist:
            return Response({"error": "Role not found"}, status=status.HTTP_404_NOT_FOUND)


class UpdateRole(APIView):
    permission_classes = [HasRequiredPermission, IsAuthenticated]
    required_permission_id = [4]

    def put(self, request, pk):
        try:
            role = Role.objects.get(pk=pk)
            old_data = model_to_dict(role)
        except Role.DoesNotExist:
            return Response({"message": "Role not found"}, status=status.HTTP_404_NOT_FOUND)

        serializer = RoleSerializer(role, data=request.data, partial=True,context={'request': request})
        if serializer.is_valid():
            role = serializer.save()
            new_data = model_to_dict(role) 
            try:
                member = request.user.member
            except AttributeError:
                member = Member.objects.get(user=request.user)
            create_audit_trail(
                    member=member,
                    event_type='ROLE_UPDATED',
                    table_name='Role',
                    row_id=role.id,
                    old_data=old_data,
                    new_data=new_data,
                    description='Role updated'
                )
            return Response(
                {"message": "Your Role has been successfully updated.", "data": serializer.data},
                status=status.HTTP_200_OK
            )
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

class DeleteRole(APIView):
    permission_classes = [IsAuthenticated]

    def delete(self, request, pk):
        try:
            role = Role.objects.get(pk=pk)
            role.delete()
            return Response({"message": "Role deleted successfully"}, status=status.HTTP_200_OK)
        except Role.DoesNotExist:
            return Response({"error": "Role not found"}, status=status.HTTP_404_NOT_FOUND)


# Permission Views
class CreatePermission(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        serializer = RolePermissionSerializer(data=request.data)
        if serializer.is_valid():
            serializer.save()
            return Response(serializer.data, status=status.HTTP_201_CREATED)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

    
class PermissionList(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        permissions = Permission.objects.all()
        serializer = PermissionSerializer(permissions, many=True)
        return Response(serializer.data, status=status.HTTP_200_OK)



class PermissionDetails(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request, pk):
        try:
            permission = RolePermission.objects.get(pk=pk)
            serializer = RolePermissionSerializer(permission)
            return Response(serializer.data, status=status.HTTP_200_OK)
        except RolePermission.DoesNotExist:
            return Response({"error": "Permission not found"}, status=status.HTTP_404_NOT_FOUND)


class UpdatePermission(APIView):
    permission_classes = [IsAuthenticated]

    def put(self, request, pk):
        try:
            permission = RolePermission.objects.get(pk=pk)
            serializer = RolePermissionSerializer(permission, data=request.data, partial=True)
            if serializer.is_valid():
                serializer.save()
                return Response(serializer.data, status=status.HTTP_200_OK)
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
        except RolePermission.DoesNotExist:
            return Response({"error": "Permission not found"}, status=status.HTTP_404_NOT_FOUND)


class DeletePermission(APIView):
    permission_classes = [IsAuthenticated]

    def delete(self, request, pk):
        try:
            permission = RolePermission.objects.get(pk=pk)
            permission.delete()
            return Response({"message": "Permission deleted successfully"}, status=status.HTTP_200_OK)
        except RolePermission.DoesNotExist:
            return Response({"error": "Permission not found"}, status=status.HTTP_404_NOT_FOUND)

# Role Group Views
class CreateRoleGroup(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        serializer = RoleGroupSerializer(data=request.data,context={'request': request})
        if serializer.is_valid():
            serializer.save()
            return Response(serializer.data, status=status.HTTP_201_CREATED)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


class RoleGroupList(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        role_group = RoleGroup.objects.all()
        serializer = RoleGroupSerializer(role_group, many=True)
        return Response(serializer.data, status=status.HTTP_200_OK)


class GetRoleGroupDetails(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request, pk):
        try:
            role_group = RoleGroup.objects.get(pk=pk)
            serializer = RoleGroupSerializer(role_group)
            return Response(serializer.data, status=status.HTTP_200_OK)
        except RoleGroup.DoesNotExist:
            return Response({"error": "Role Group not found"}, status=status.HTTP_404_NOT_FOUND)


class UpdateRoleGroup(APIView):
    permission_classes = [IsAuthenticated]

    def put(self, request, pk):
        try:
            role_group = RoleGroup.objects.get(pk=pk)
            serializer = RoleGroupSerializer(role_group, data=request.data, partial=True)
            if serializer.is_valid():
                serializer.save()
                return Response(serializer.data, status=status.HTTP_200_OK)
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
        except RoleGroup.DoesNotExist:
            return Response({"error": "Role group not found"}, status=status.HTTP_404_NOT_FOUND)


class DeleteRoleGroup(APIView):
    permission_classes = [IsAuthenticated]

    def delete(self, request, pk):
        try:
            role_group = RoleGroup.objects.get(pk=pk)
            role_group.delete()
            return Response({"message": "Role group deleted successfully"}, status=status.HTTP_200_OK)
        except RoleGroup.DoesNotExist:
            return Response({"error": "Role group not found"}, status=status.HTTP_404_NOT_FOUND)


# Global Role Permission Views