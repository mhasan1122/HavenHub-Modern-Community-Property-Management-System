from django.db import models

# Create your models here.
from django.db import models
from user.models import Member

class Group(models.Model):
   
    group_name = models.CharField(max_length=255,unique=True)
    group_description = models.TextField(max_length=255,blank=True, null=True)
    is_active = models.BooleanField(default=True) 
    created_by = models.ForeignKey(Member, null=True,on_delete=models.DO_NOTHING, related_name='created_group')
    created_at = models.DateTimeField(auto_now_add=True,null=True)
    updated_by = models.ForeignKey(Member, null=True,on_delete=models.DO_NOTHING, related_name='updated_group')
    updated_at = models.DateTimeField(auto_now = True,null=True)  


    def __str__(self):
        return self.group_name
    
class GroupMembers(models.Model):
    member = models.ForeignKey(Member, on_delete=models.PROTECT)
    group = models.ForeignKey(Group, on_delete=models.PROTECT)
    created_by = models.ForeignKey(Member, null=True,on_delete=models.DO_NOTHING, related_name='group_members_created')
    created_at = models.DateTimeField(auto_now_add=True,null=True)
    updated_by = models.ForeignKey(Member, null=True,on_delete=models.DO_NOTHING, related_name='group_members_updated')
    updated_at = models.DateTimeField(auto_now = True,null=True)  

    def __str__(self):
        return f"{self.group.group_name}-{self.member.full_name}"


class Role(models.Model):
     
    role_name = models.CharField(max_length=255,unique=True)
    role_description = models.TextField(max_length=255)
    is_active = models.BooleanField(default=True)  
    created_by = models.ForeignKey(Member, null=True,on_delete=models.DO_NOTHING, related_name='created_role')
    created_at = models.DateTimeField(auto_now_add=True,null=True)
    updated_by = models.ForeignKey(Member, null=True,on_delete=models.DO_NOTHING, related_name='updated_role')
    updated_at = models.DateTimeField(auto_now = True,null=True)  

    def __str__(self):
        return self.role_name


class Permission(models.Model):
   
    permission_name = models.CharField(max_length=255)

    def __str__(self):
        return self.permission_name


class RolePermission(models.Model):
    role = models.ForeignKey(Role, on_delete=models.PROTECT, related_name='role_permissions')
    permission = models.ForeignKey(Permission, on_delete=models.PROTECT, related_name='permission_roles')
    is_active = models.BooleanField(default=True)  
    created_by = models.ForeignKey(Member, null=True,on_delete=models.DO_NOTHING, related_name='role_permission_create')
    created_at = models.DateTimeField(auto_now_add=True,null=True)
    updated_by = models.ForeignKey(Member, null=True,on_delete=models.DO_NOTHING, related_name='role_permission_update')
    updated_at = models.DateTimeField(auto_now = True,null=True)  

    def __str__(self):
        return f"{self.role.role_name} - {self.permission.permission_name}"


class RoleGroup(models.Model):
    role = models.ForeignKey(Role, on_delete=models.PROTECT)
    group = models.ForeignKey(Group, on_delete=models.PROTECT)
    is_active = models.BooleanField(default=True)
    created_by = models.ForeignKey(Member, null=True,on_delete=models.DO_NOTHING, related_name='role_group_created')
    created_at = models.DateTimeField(auto_now_add=True,null=True)
    updated_by = models.ForeignKey(Member, null=True,on_delete=models.DO_NOTHING, related_name='role_group_updated')
    updated_at = models.DateTimeField(auto_now = True,null=True)  

    def __str__(self):
        return f"{self.group.group_name} - {self.role.role_name}"


class MembersRole(models.Model):
    member = models.ForeignKey(Member, on_delete=models.PROTECT)
    role = models.ForeignKey(Role, on_delete=models.PROTECT)
    is_active = models.BooleanField(default=True)
    is_group = models.BooleanField(default=False)
    is_member = models.BooleanField(default=False)
    created_by = models.ForeignKey(Member, null=True,on_delete=models.DO_NOTHING, related_name='members_role_created')
    created_at = models.DateTimeField(auto_now_add=True,null=True)
    updated_by = models.ForeignKey(Member, null=True,on_delete=models.DO_NOTHING, related_name='members_role_updated')
    updated_at = models.DateTimeField(auto_now = True,null=True)  

    def __str__(self):
        return f"{self.member.full_name} - {self.role.role_name}"


class GlobalRolePermission(models.Model):
    """
    Global role permissions that apply across the entire application.
    Allows administrators to define default permissions for all roles unless overridden.
    """
    PERMISSION_CATEGORIES = [
        ('member_management', 'Member Management'),
        ('role_management', 'Role Management'),
        ('group_management', 'Group Management'),
        ('tower_management', 'Tower & Unit Management'),
        ('communications', 'Communications'),
        ('service_fees', 'Service Fee Management'),
        ('financial', 'Financial Management'),
        ('settings', 'Settings & Configuration'),
    ]
    
    permission = models.OneToOneField(Permission, on_delete=models.CASCADE, related_name='global_role_setting')
    category = models.CharField(max_length=50, choices=PERMISSION_CATEGORIES, default='member_management')
    display_name = models.CharField(max_length=255, help_text='Human-readable permission name')
    description = models.TextField(blank=True, null=True, help_text='Detailed description of what this permission allows')
    default_enabled = models.BooleanField(
        default=False,
        help_text='If enabled, this permission is granted to all roles by default unless specifically disabled'
    )
    is_protected = models.BooleanField(
        default=False,
        help_text='Protected permissions cannot be disabled globally'
    )
    priority = models.IntegerField(default=0, help_text='Display priority in UI (higher = higher priority)')
    is_active = models.BooleanField(default=True)
    created_by = models.ForeignKey(Member, null=True, on_delete=models.DO_NOTHING, related_name='global_role_permission_created')
    created_at = models.DateTimeField(auto_now_add=True)
    updated_by = models.ForeignKey(Member, null=True, on_delete=models.DO_NOTHING, related_name='global_role_permission_updated')
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-priority', 'category', 'display_name']
        verbose_name = "Global Role Permission"
        verbose_name_plural = "Global Role Permissions"
        unique_together = ('permission', 'category')

    def __str__(self):
        return f"[{self.get_category_display()}] {self.display_name} (Default: {self.default_enabled})"

