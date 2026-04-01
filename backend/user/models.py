from django.db import models
from django.contrib.auth.models import User
from django.core.validators import FileExtensionValidator
import os



class MemberType(models.Model):
    type_name = models.CharField(max_length=128)

def upload_to_member_photo(instance, filename):
    # Generate a custom path for the image based on the instance's ID
    return os.path.join('members', f'{instance.id}_{instance.full_name}', filename)
# Create your models here.
class Member(models.Model):
    user = models.OneToOneField(User, on_delete=models.CASCADE,null=True)
    member_type = models.ForeignKey(MemberType,on_delete=models.CASCADE,null=False,default = 1)
    # member_type = models.ForeignKey(MemberType, on_delete=models.CASCADE, null=True, blank=True)

    full_name = models.CharField(max_length=255)
    general_contact = models.CharField(max_length=11,unique=False,null=False)
    general_email = models.EmailField(unique=False, null=False,default = 'name@gmail.com')
    login_email = models.EmailField(unique=True, null=True)
    login_contact = models.CharField(max_length=11, unique=True, null=True)
    nid_number = models.CharField(max_length=255, null=True,unique=True)
    photo = models.ImageField(upload_to=upload_to_member_photo,null=True,validators=[FileExtensionValidator(allowed_extensions=['jpg', 'jpeg', 'png', 'heic'])])
    photo_low_quality = models.ImageField(upload_to=upload_to_member_photo,null=True)
    about_us = models.TextField(null=True)
    facebook_profile = models.TextField(null=True)
    linkedin_profile = models.TextField(null=True)
    permanent_address = models.TextField(null=True)
    present_address = models.TextField(null=True)
    date_of_birth = models.DateField(null=True)
    occupation = models.CharField(max_length=255, null=True)
    gender = models.CharField(max_length=10, null=True)
    marital_status = models.CharField(max_length=10, null=True)
    religion = models.CharField(max_length=20, null=True)
    nid_front = models.ImageField(upload_to=upload_to_member_photo,null=True,validators=[FileExtensionValidator(allowed_extensions=['jpg', 'jpeg', 'png', 'heic'])])
    nid_back = models.ImageField(upload_to=upload_to_member_photo,null=True,validators=[FileExtensionValidator(allowed_extensions=['jpg', 'jpeg', 'png', 'heic'])])
    is_org_member = models.BooleanField(default=0)
    is_comm_member = models.BooleanField(default=0)
    org_member_ever_created = models.BooleanField(default=0)
    comm_member_ever_created = models.BooleanField(default=0)
    is_first_login = models.BooleanField(default=True)
    terms_accepted = models.BooleanField(default=False)
    terms_accepted_at = models.DateTimeField(null=True, blank=True)
    terms_version = models.CharField(max_length=50, null=True, blank=True)
    created_by = models.ForeignKey('self', null=True, on_delete=models.DO_NOTHING, related_name='members_created')
    created_at = models.DateTimeField(auto_now_add=True, null=True)
    updated_by = models.ForeignKey('self', null=True, on_delete=models.DO_NOTHING, related_name='members_updated')
    updated_at = models.DateTimeField(auto_now=True, null=True)
    


    def __str__(self):
        return self.user.username

    
    def get_permission_ids(self):
        """
        Traverse from the member to roles, then to role permissions,
        and finally gather the permission IDs.
        """
        from group_role.models import Permission,MembersRole,Role,RolePermission
        # Get roles for this member
        members_roles = MembersRole.objects.filter(member_id=self.pk)
        # print(members_roles)
        roles = Role.objects.filter(id__in=members_roles.values_list('role_id', flat=True),is_active = True)
        # print(roles)
        role_permissions = RolePermission.objects.filter(role_id__in=roles.values_list('id', flat=True),is_active = True)
        # print(role_permissions)
        permissions = Permission.objects.filter(id__in=role_permissions.values_list('permission_id', flat=True))
        # print(permissions)
        # Now query Permission IDs using the join via RolePermission
        permission_ids = permissions.values_list('id', flat=True)
        # print(permission_ids)
        return set(permission_ids)
    
    def get_permission_grant_timestamp(self, permission_id):
        """
        Get the timestamp when a specific permission was granted to this member.
        This is used to ensure notifications are not retroactive - users should only
        receive notifications for items created AFTER they were granted the permission.
        
        Returns:
            datetime: The most recent timestamp when the permission was granted
                     (could be through role assignment or permission update)
            None: If the member doesn't have the permission
        """
        from group_role.models import MembersRole, RolePermission
        from django.db.models import Max
        
        try:
            # Get all active role assignments for this member
            members_roles = MembersRole.objects.filter(
                member_id=self.pk,
                is_active=True
            ).select_related('role')
            
            # For each role, check if it has the specified permission
            # Track both role assignment time and permission grant time
            grant_timestamps = []
            
            for member_role in members_roles:
                # Check if this role has the permission
                role_permission = RolePermission.objects.filter(
                    role=member_role.role,
                    permission_id=permission_id,
                    is_active=True
                ).first()
                
                if role_permission:
                    # The permission is effective from the LATER of:
                    # 1. When the role was assigned to the member (member_role.created_at)
                    # 2. When the permission was added to the role (role_permission.created_at)
                    # But we use updated_at to catch permission re-grants after removal
                    
                    # Use the most recent timestamp between role assignment and permission update
                    timestamps = [
                        member_role.created_at,
                        member_role.updated_at,
                        role_permission.created_at,
                        role_permission.updated_at
                    ]
                    
                    # Filter out None values and get the maximum (most recent)
                    valid_timestamps = [ts for ts in timestamps if ts is not None]
                    if valid_timestamps:
                        grant_timestamps.append(max(valid_timestamps))
            
            if grant_timestamps:
                # Get the most recent permission grant timestamp
                most_recent_grant = max(grant_timestamps)
                
                # IMPORTANT: Use the LATER of member creation or permission grant
                # This ensures notifications are only for items created after BOTH:
                # 1. The member joined the system, AND
                # 2. They received the permission
                # This prevents retroactive notifications in both scenarios:
                # - New member with immediate permissions: use member.created_at
                # - Existing member given new permissions: use permission grant time
                if self.created_at:
                    return max(self.created_at, most_recent_grant)
                else:
                    return most_recent_grant
            
            return None
            
        except Exception as e:
            print(f"Error getting permission grant timestamp for member {self.id}, permission {permission_id}: {e}")
            import traceback
            traceback.print_exc()
            return None
    
    def save(self, *args, **kwargs):
        # Update ever created flags if current status is True
        # if self.is_org_member:
        #     self.org_member_ever_created = True
        # if self.is_comm_member:
        #     self.comm_member_ever_created = True

        # Ensure that the directory exists before saving
        if self.photo or self.nid_back or self.nid_front:
            # Get the directory where the image will be stored
            media_directory = os.path.join('media', 'members',f"{self.id}_{self.full_name}")

            # Create the directory if it doesn't exist
            if not os.path.exists(media_directory):
                os.makedirs(media_directory)    
        super(Member, self).save(*args, **kwargs)
    


    
class Company(models.Model):
    from towers.models import Unit

    company_name = models.CharField(
    max_length=255,
    unique=True,
    error_messages={
        'unique': "This company name already exists.",
        'blank': "Company name cannot be blank.",
        'null': "Company name cannot be null.",
        }
         )

    member = models.ForeignKey(Member, on_delete=models.CASCADE, related_name="companies", null=True, blank=True)
    unit = models.ForeignKey(Unit, on_delete=models.CASCADE, related_name="companies", null=True, blank=True)
    created_by = models.ForeignKey(
        Member, null=True, blank=True, on_delete=models.DO_NOTHING, related_name='company_created'
    )
    created_at = models.DateTimeField(auto_now_add=True, null=True)
    updated_by = models.ForeignKey(Member, null=True, blank=True, on_delete=models.DO_NOTHING, related_name='company_updated')
    updated_at = models.DateTimeField(auto_now=True, null=True)

    def __str__(self):
        return self.company_name


class BlockedUser(models.Model):
    """
    Model to track user blocking relationships.
    When user A blocks user B:
    - A does not see B's bulletins/notifications.
    - B does not see A's bulletins/notifications (block works both ways for posts).
    """
    blocker = models.ForeignKey(
        Member,
        on_delete=models.CASCADE,
        related_name='blocked_users',
        help_text="The member who initiated the block"
    )
    blocked = models.ForeignKey(
        Member,
        on_delete=models.CASCADE,
        related_name='blocked_by',
        help_text="The member who is blocked"
    )
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = ('blocker', 'blocked')
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['blocker', 'blocked']),
            models.Index(fields=['blocker']),
        ]
        verbose_name = "Blocked User"
        verbose_name_plural = "Blocked Users"

    def __str__(self):
        return f"{self.blocker.full_name} blocked {self.blocked.full_name}"
