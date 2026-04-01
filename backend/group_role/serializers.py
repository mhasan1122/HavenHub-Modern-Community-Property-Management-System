from rest_framework import serializers
from .models import Group,Role, RolePermission,RoleGroup, GlobalRolePermission
from user.models import Member
from .models import GroupMembers,MembersRole,Permission
from user.serializers import MemberSerializer
from django.db import transaction
from django.utils import timezone
from rest_framework.validators import UniqueValidator

# serializers.py
class GroupSerializer(serializers.ModelSerializer):
    role_ids = serializers.ListField(
        child=serializers.IntegerField(),
        required=False,   
        write_only=True,
        min_length=0,   
        error_messages={
            'min_length': 'At least one role must be provided if roles are specified.'
        }
    )
    member_ids = serializers.ListField(
        child=serializers.IntegerField(),
        required=False,
        write_only=True
    )
    is_group = serializers.BooleanField(default=False)
    member_photos = serializers.SerializerMethodField(read_only=True)

    class Meta:
        model = Group
        fields = [
            'id',
            'group_name',
            'group_description',
            'role_ids',
            'member_ids',
            'member_photos','is_group'
        ]
        extra_kwargs = {
            'group_description': {'required': False, 'allow_blank': True}
        }

    def get_member_photos(self, obj):
        # Get all GroupMembers for this group and return photo URLs.
        group_members = GroupMembers.objects.filter(group=obj)
        photos = []
        for gm in group_members:
            if gm.member and gm.member.photo:
                photo_url = gm.member.photo.url
                request = self.context.get('request')
                if request:
                    photo_url = request.build_absolute_uri(photo_url)
                photos.append(photo_url)
        return photos

    def create(self, validated_data):
        with transaction.atomic():
            try:
                request = self.context.get('request')
                role_ids = validated_data.pop('role_ids')
                member_ids = validated_data.pop('member_ids', [])
                is_group = validated_data.pop('is_group', None)
                if not request:
                    raise serializers.ValidationError("Request object is missing from context")

                user = request.user  
                if not user.is_authenticated:
                    raise serializers.ValidationError("User is not authenticated")

                # Get the member related to the user
                member_info = Member.objects.get(user=user)

            
                validated_data['created_by'] = member_info
                
                group = Group.objects.create(
                    **validated_data,   
                )
                # Create RoleGroup entries for each role ID.
                for role_id in role_ids:
                    try:
                        role = Role.objects.get(id=role_id)
                        RoleGroup.objects.create(
                            group=group,
                            role=role,
                            created_by=member_info,
                            created_at=timezone.now()   
                        )
                    except Role.DoesNotExist:
                        raise serializers.ValidationError(f"Role with id {role_id} does not exist.")
                # Create GroupMembers entries for each member ID.
                for member_id in member_ids:
                    try:
                        member = Member.objects.get(id=member_id)
                        GroupMembers.objects.create(
                            member=member, 
                            group=group,
                            created_by=member_info,
                            created_at=timezone.now()
                            )
                    except Member.DoesNotExist:
                        raise serializers.ValidationError(f"Member with id {member_id} does not exist.")
                # Create MembersRole entries for every combination of the selected roles and members.
                for role_id in role_ids:
                    try:
                        role = Role.objects.get(id=role_id)
                    except Role.DoesNotExist:
                        raise serializers.ValidationError(f"Role with id {role_id} does not exist.")
                    for member_id in member_ids:
                        try:
                            member = Member.objects.get(id=member_id)
                        except Member.DoesNotExist:
                            raise serializers.ValidationError(f"Member with id {member_id} does not exist.")
                        MembersRole.objects.create(
                            member=member,
                            role=role,
                            is_group=is_group,
                            created_by=member,
                            created_at=timezone.now()  
                        )

                return group
            except Exception as e:
                    # Optionally, handle exceptions or log errors if image processing fails
                    raise serializers.ValidationError(f"Error occurred: {str(e)}")
        

    def update(self, instance, validated_data):
        with transaction.atomic():
            try:
                request = self.context.get('request')
                role_ids = validated_data.pop('role_ids', None)
                member_ids = validated_data.pop('member_ids', None)
                is_group = validated_data.pop('is_group', None)
                # print(request.data)
                
                if not request:
                    raise serializers.ValidationError("Request object is missing from context")

                user = request.user
                if not user.is_authenticated:
                    raise serializers.ValidationError("User is not authenticated")

                updating_member = Member.objects.get(user=user)

                # Update group name and description
                instance.group_name = validated_data.get('group_name', instance.group_name)
                instance.group_description = validated_data.get('group_description', instance.group_description)
                instance.updated_by = updating_member
                instance.updated_at = timezone.now()
                instance.save()

                # Store old associations for cleanup
                old_member_ids = list(GroupMembers.objects.filter(group=instance).values_list('member_id', flat=True))
                old_role_ids = list(RoleGroup.objects.filter(group=instance).values_list('role_id', flat=True))

                if role_ids is not None:
                    RoleGroup.objects.filter(group=instance).delete()
                    for role_id in role_ids:
                        role = Role.objects.get(id=role_id)
                        RoleGroup.objects.create(
                            group=instance,
                            role=role,
                            updated_by=updating_member,
                            updated_at=timezone.now()
                        )
                else:
                    role_ids = old_role_ids

                if member_ids is not None:
                    GroupMembers.objects.filter(group=instance).delete()
                    for member_id in member_ids:
                        m = Member.objects.get(id=member_id)
                        GroupMembers.objects.create(
                            member=m,
                            group=instance,
                            updated_by=updating_member,
                            updated_at=timezone.now()
                        )
                else:
                    member_ids = old_member_ids

                # Identify removed members and roles
                removed_member_ids = set(old_member_ids) - set(member_ids)
                removed_role_ids = set(old_role_ids) - set(role_ids)

                # Delete MembersRole of removed members or removed roles
                if removed_member_ids:
                    MembersRole.objects.filter(member__id__in=removed_member_ids, role__id__in=old_role_ids,is_group=True).delete()
                if removed_role_ids:
                    MembersRole.objects.filter(member__id__in=old_member_ids, role__id__in=removed_role_ids,is_group=True).delete()

                # Now recreate current member-role assignments
                MembersRole.objects.filter(member__id__in=member_ids, role__id__in=role_ids,is_group=True).delete()
                for member_id in member_ids:
                    member = Member.objects.get(id=member_id)
                    for role_id in role_ids:
                        role = Role.objects.get(id=role_id)
                        MembersRole.objects.create(
                            member=member,
                            role=role,
                            is_group=is_group,
                            updated_by=updating_member,
                            updated_at=timezone.now()
                        )

                return instance
            except Exception as e:
                raise serializers.ValidationError(f"Error occurred: {str(e)}")



class GroupListSerializer(serializers.ModelSerializer):
    members = serializers.SerializerMethodField()
    roles = serializers.SerializerMethodField()

    class Meta:
        model = Group
        fields = ['id', 'group_name', 'group_description', 'is_active', 'members','roles']

    def get_members(self, obj):
        # Get all GroupMembers for this group and return the full member data
        # Newest members first (at top of list)
        group_members = GroupMembers.objects.filter(group=obj).select_related('member').order_by('-created_at', '-id')
        return MemberSerializer([gm.member for gm in group_members], many=True).data
    
    def get_roles(self, obj):
        roles = RoleGroup.objects.filter(group=obj).select_related('role')
        return RoleSerializer([rg.role for rg in roles], many=True).data

class GroupDetailSerializer(serializers.ModelSerializer):
    roles = serializers.SerializerMethodField()
    members = serializers.SerializerMethodField()
   
    class Meta:
        model = Group
        fields = ['id', 'group_name', 'group_description', 'is_active', 'roles', 'members']

    def get_roles(self, obj):
        # Retrieve roles via the RoleGroup model.
        role_groups = RoleGroup.objects.filter(group=obj)
        roles = [rg.role for rg in role_groups]
        return RoleSerializer(roles, many=True).data

    def get_members(self, obj):
        # Get all group members via the GroupMembers relationship.
        # Newest members first (at top of list)
        group_members = GroupMembers.objects.filter(group=obj).order_by('-created_at', '-id')
        members = [gm.member for gm in group_members]
        # Use the new GroupMemberDetailSerializer to serialize each member.
        return GroupMemberDetailSerializer(members, many=True, context=self.context).data
    
    
class GroupMemberAddListSerializer(serializers.ModelSerializer):
    member_roles = serializers.SerializerMethodField()
    photo_low_quality = serializers.ImageField(read_only=True)
    # is_org_member = serializers.BooleanField(read_only=True)  # ✅ add this explicitly

    class Meta:
        model = Member
        fields = [
            'id',
            'member_type',
            'full_name',
            'general_contact',
            'general_email',
            'photo_low_quality',
            'member_roles',
            'is_org_member'
        ]
        depth = 1

    def get_member_roles(self, obj):
   
        roles = MembersRole.objects.filter(member=obj)
        # print(roles)
        # Return an empty list if no roles are assigned instead of "N/A"
        if not roles.exists():
            return []
        return [{"member_name": role.member.full_name, "role": role.role.role_name} for role in roles]

    def to_representation(self, instance):
        representation = super().to_representation(instance)
        request = self.context.get('request')
        photo_url = representation.get('photo_low_quality')
        if photo_url and request:
            representation['photo_low_quality'] = request.build_absolute_uri(photo_url)
        else:
            representation['photo_low_quality'] = ""
        
        # Add a summarized 'role' field for easier frontend access.
        member_roles = representation.get('member_roles', [])
        if member_roles:
            representation['role'] = ", ".join([r['role'] for r in member_roles])
        else:
            representation['role'] = ""  # Show nothing instead of "N/A"
        
        return representation
    
class GroupMemberDetailSerializer(serializers.ModelSerializer):
    member_type = serializers.CharField(source='member_type.type_name', read_only=True)
    roles = serializers.SerializerMethodField()
    photo = serializers.SerializerMethodField()  # Override the photo field

    class Meta:
        model = Member
        # Note: We still use the key 'photo' so that the frontend code doesn't need to change.
        fields = ['id', 'full_name', 'member_type', 'general_contact', 'general_email','is_org_member' ,'roles', 'photo']

    def get_roles(self, obj):
        member_roles = MembersRole.objects.filter(member=obj)
        return [mr.role.role_name for mr in member_roles]

    def get_photo(self, obj):
        request = self.context.get('request')
        # Return the low quality image URL if available; else fallback to the normal photo.
        if obj.photo_low_quality and hasattr(obj.photo_low_quality, 'url'):
            return request.build_absolute_uri(obj.photo_low_quality.url) if request else obj.photo_low_quality.url
        elif obj.photo and hasattr(obj.photo, 'url'):
            return request.build_absolute_uri(obj.photo.url) if request else obj.photo.url
        return ""


class RoleGroupSerializer(serializers.ModelSerializer):
    class Meta:
        model = RoleGroup
        fields = '__all__'



class RolePermissionSerializer(serializers.ModelSerializer):
    class Meta:
        model = RolePermission
        fields = '__all__'
 
# serializers.py
 
class PermissionSerializer(serializers.ModelSerializer):
    class Meta:
        model = Permission
        fields = '__all__'
 


class RoleMemberListSerializer(serializers.ModelSerializer):
    member_type = serializers.CharField(source='member_type.type_name', read_only=True)
    photo = serializers.ImageField(source='photo_low_quality', read_only=True)
    
    class Meta:
        model = Member
        fields = ['id', 'photo', 'full_name', 'general_contact', 'general_email', 'member_type']


class RoleSerializer(serializers.ModelSerializer):


    role_name = serializers.CharField(
        max_length=255,
        validators=[
            UniqueValidator(
                queryset=Role.objects.all(),
                message="A role with this name already exists"
            )
        ],
        error_messages={
            'required': 'Role name is required.',
            'max_length': 'Role name cannot exceed 255 characters.'
        }
    )
    permissions = serializers.ListField(
        child=serializers.IntegerField(), write_only=True, required=False
    )
    selected_permissions = serializers.SerializerMethodField(read_only=True)
    permissions_list = serializers.SerializerMethodField(read_only=True)
    all_permissions = serializers.SerializerMethodField(read_only=True)
    assigned_members = serializers.SerializerMethodField(read_only=True)
  
    class Meta:
        model = Role
        fields = [
            'id', 'role_name', 'role_description', 'is_active',
            'permissions', 'selected_permissions', 'permissions_list',
            'all_permissions', 'assigned_members'
        ]
        extra_kwargs = {
            'role_name': {
                'error_messages': {
                    'max_length': 'Role name cannot exceed 255 characters.',
                    'required': 'Role name is required.'
                }
            },
            'role_description': {
                'required': False,
                'allow_blank': True,
                'error_messages': {
                    'max_length': 'Role description cannot exceed 255 characters.'
                }
            },
        }
    
    
    def get_selected_permissions(self, obj):
        return list(
            obj.role_permissions.filter(is_active=True)
            .values_list('permission__id', flat=True)
        )
    
    def get_permissions_list(self, obj):
        return list(
            obj.role_permissions.filter(is_active=True)
            .values_list('permission__permission_name', flat=True)
        )
    
    def get_all_permissions(self, obj):
        from .models import Permission
        permissions = Permission.objects.all()
        return [{"id": perm.id, "permission_name": perm.permission_name} for perm in permissions]
    
    def get_assigned_members(self, obj):
        # members_roles = MembersRole.objects.filter(role=obj, is_active=True,is_group=True)
        members_roles = MembersRole.objects.filter(role=obj, is_active=True)
        # print('Fetched Group Detail:', members_roles)
        unique_members = []
        seen_member_ids = set()
        for mr in members_roles:
            if mr.member.id not in seen_member_ids:
                seen_member_ids.add(mr.member.id)
                unique_members.append(mr.member)
        return RoleMemberListSerializer(unique_members, many=True).data

    def create(self, validated_data):
        with transaction.atomic():
            try:
                request = self.context.get('request')
                if not request:
                    raise serializers.ValidationError("Request object is missing from context")
                
                user = request.user  
                if not user.is_authenticated:
                    raise serializers.ValidationError("User is not authenticated")
                
                member = Member.objects.get(user=user)
                permissions_data = validated_data.pop('permissions', [])
                
                # Create the Role instance and add the created_by field
                role = Role.objects.create(
                    **validated_data,   
                    created_by=member,
                    created_at=timezone.now()  # Set the created_at timestamp when the role is created
                )

                # Creating RolePermissions and setting created_by and created_at
                for permission_id in permissions_data:
                    try:
                        permission_instance = Permission.objects.get(id=permission_id)
                    except Permission.DoesNotExist:
                        raise serializers.ValidationError(f"Permission with id {permission_id} does not exist.")
                    
                    RolePermission.objects.create(
                        role=role,
                        permission=permission_instance,
                        created_by=member,  
                        created_at=timezone.now()  
                    )

                return role
            except Exception as e:
                # Optionally, log error details here
                raise serializers.ValidationError(f"Error occurred: {str(e)}")

    def update(self, instance, validated_data):
        with transaction.atomic():
            try:
                request = self.context.get('request')
                if not request:
                    raise serializers.ValidationError("Request object is missing from context")
                
                user = request.user
                if not user.is_authenticated:
                    raise serializers.ValidationError("User is not authenticated")
                
                member = Member.objects.get(user=user)
                permissions_data = validated_data.pop('permissions', None)
                
                # Update role basic fields
                instance.role_name = validated_data.get('role_name', instance.role_name)
                instance.role_description = validated_data.get('role_description', instance.role_description)
                instance.updated_by = member
                instance.updated_at = timezone.now()
                instance.save()
                
                # Update permissions if provided
                if permissions_data is not None:
                    # Get current permission IDs
                    current_permission_ids = set(
                        RolePermission.objects.filter(role=instance)
                        .values_list('permission_id', flat=True)
                    )
                    new_permission_ids = set(permissions_data)
                    
                    # Determine permissions to add and remove
                    permissions_to_add = new_permission_ids - current_permission_ids
                    permissions_to_remove = current_permission_ids - new_permission_ids
                    
                    # Remove old permissions
                    if permissions_to_remove:
                        RolePermission.objects.filter(
                            role=instance,
                            permission_id__in=permissions_to_remove
                        ).delete()
                    
                    # Add new permissions
                    for permission_id in permissions_to_add:
                        try:
                            permission_instance = Permission.objects.get(id=permission_id)
                        except Permission.DoesNotExist:
                            raise serializers.ValidationError(f"Permission with id {permission_id} does not exist.")
                        
                        RolePermission.objects.create(
                            role=instance,
                            permission=permission_instance,
                            created_by=member,
                            created_at=timezone.now()
                        )
                
                return instance
            except Exception as e:
                raise serializers.ValidationError(f"Error occurred: {str(e)}")


class GlobalRolePermissionSerializer(serializers.ModelSerializer):
    """
    Serializer for GlobalRolePermission model.
    Handles global role permission settings that apply across all roles.
    """
    permission_name = serializers.CharField(source='permission.permission_name', read_only=True)
    category_display = serializers.CharField(source='get_category_display', read_only=True)
    
    class Meta:
        model = GlobalRolePermission
        fields = [
            'id',
            'permission',
            'permission_name',
            'category',
            'category_display',
            'display_name',
            'description',
            'default_enabled',
            'is_protected',
            'priority',
            'is_active',
            'created_at',
            'updated_at'
        ]
        read_only_fields = ['id', 'created_at', 'updated_at', 'permission_name', 'category_display']
        extra_kwargs = {
            'display_name': {'required': True},
            'description': {'required': False, 'allow_blank': True},
            'default_enabled': {'required': True},
            'is_protected': {'required': False},
            'priority': {'required': False}
        }

    def create(self, validated_data):
        request = self.context.get('request')
        if request and hasattr(request, 'user') and request.user.is_authenticated:
            try:
                validated_data['created_by'] = Member.objects.get(user=request.user)
            except Member.DoesNotExist:
                pass
        return super().create(validated_data)

    def update(self, instance, validated_data):
        request = self.context.get('request')
        if request and hasattr(request, 'user') and request.user.is_authenticated:
            try:
                validated_data['updated_by'] = Member.objects.get(user=request.user)
            except Member.DoesNotExist:
                pass
        return super().update(instance, validated_data)
