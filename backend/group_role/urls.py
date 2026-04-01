from django.urls import path
from .views import (
    CreateGroup,GroupList,GetGroupDetails,UpdateGroup,DeleteGroup,
    CreateRole, RoleList, RoleDetails, UpdateRole, DeleteRole,
    CreatePermission, PermissionList, PermissionDetails, UpdatePermission, DeletePermission,
    CreateRoleGroup,RoleGroupList,GetRoleGroupDetails,UpdateRoleGroup,DeleteRoleGroup,GroupMemberAddList,RoleStatusChange,GroupStatusChange,AddGroupRoleList,MemberRoleList
)

urlpatterns = [
    # Group endpoints
    path('create_group/', CreateGroup.as_view(), name='create_group'),
    path('group_list/', GroupList.as_view(), name='group_list'),
    path('group_details/<int:pk>/', GetGroupDetails.as_view(), name='group_details'),
    path('update_group/<int:pk>/', UpdateGroup.as_view(), name='update_group'),
    path('delete_group/<int:pk>/', DeleteGroup.as_view(), name='delete_group'),
    path('group_status_change/<int:pk>/', GroupStatusChange.as_view(), name='group_status_change'),
    path('group_member_add_list/', GroupMemberAddList.as_view(), name='group_member_add_list'),

    # Role endpoints
    path('create_role/', CreateRole.as_view(), name='create_role'),
    path('role_list/', RoleList.as_view(), name='role_list'),
    path('member_role_list/', MemberRoleList.as_view(), name='member_role_list'),
    path('add_group_role_list/', AddGroupRoleList.as_view(), name='add_group_role_list'),
    path('role_details/<int:pk>/', RoleDetails.as_view(), name='role_details'),
    path('role_status/<int:pk>/', RoleStatusChange.as_view(), name='role_status'),
    path('update_role/<int:pk>/', UpdateRole.as_view(), name='update_role'),
    path('delete_role/<int:pk>/', DeleteRole.as_view(), name='delete_role'),

    # Permission endpoints
    path('create_permission/', CreatePermission.as_view(), name='create_permission'),
    path('permission_list/', PermissionList.as_view(), name='permission_list'),
    path('permission_details/<int:pk>/', PermissionDetails.as_view(), name='get_permission_details'),
    path('update_permission/<int:pk>/', UpdatePermission.as_view(), name='update_permission'),
    path('delete_permission/<int:pk>/', DeletePermission.as_view(), name='delete_permission'),

    # Role Group endpoints
    path('create_role_group/', CreateRoleGroup.as_view(), name='create_role_group'),
    path('role_group_list/', RoleGroupList.as_view(), name='role_group_list'),
    path('role_group_details/<int:pk>/', GetRoleGroupDetails.as_view(), name='role_group_details'),
    path('update_role_group/<int:pk>/', UpdateRoleGroup.as_view(), name='update_role_group'),
    path('delete_role_group/<int:pk>/', DeleteRoleGroup.as_view(), name='delete_role_group'),
]