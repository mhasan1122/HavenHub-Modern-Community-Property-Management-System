from django.urls import path
from .views import CentralPermissionChecker,HeadingData,MemberTypeList,CreateMember
from .views import UpdateMember,ChangeMemberStatus,MemberListSearchSort, LogoutUser, UserListView 
from .views import LoginUser,SetPassword,CheckStatus,MemberList,ForgotPasswordRequestOTP,ForgotPasswordVerifyOTP
from .views import ForgotPasswordResendOTP,ForgotPasswordSetNewPassword,MemberDetails,MyProfile
from .views import ResendLoginCredentials
from .views import AddExistingCommMemberList,MemberDetailsForResident,CreateMemberForUnit,CompanyView,GetUserTowerUnit, MyPermissions, AcceptTermsAndConditions, CheckTermsStatus
from .views import BlockUserView, UnblockUserView, BlockedMembersListView
from .views_database import DatabaseTablesListView, DatabaseTablesTruncateView, DatabaseExportView, DatabaseImportView
from .views_system import AppUpdateView
from rest_framework_simplejwt.views import TokenObtainPairView, TokenRefreshView

urlpatterns = [

    # User authentication ,forget password and user profile section
    path('login/', LoginUser.as_view(), name='login'),
    path('logout/', LogoutUser.as_view(), name='logout'),
    path('token/refresh/', TokenRefreshView.as_view(), name='token_refresh'),
    path('cental_permission_checker/', CentralPermissionChecker.as_view(), name='cental_permission_checker'),
    path('heading_data/', HeadingData.as_view(), name='heading_data'),

    # Password setting for first time users
    path('set_password/', SetPassword.as_view(), name='set_password'),
    path('check_status/', CheckStatus.as_view(), name='check_status'),

    # Endpoints to serve forget password function
    path('forgot_password/request_otp/', ForgotPasswordRequestOTP.as_view(), name='forgot_password_request_otp'),
    path('forgot_password/verify_otp/', ForgotPasswordVerifyOTP.as_view(), name='forgot_password_verify_otp'),
    path('forgot_password/set_new_password/', ForgotPasswordSetNewPassword.as_view(), name='forgot_password_set_new_password'),
    path('forgot_password/resend_otp/', ForgotPasswordResendOTP.as_view(), name='resend_otp'),  
    
    # For User that is in the Members table for authentication
    path('users/', UserListView.as_view(), name='users'),  # Add this line

    # Member endpoints
 
    path('create_member/', CreateMember.as_view(), name='create_member'), # register
    path('create_member_for_unit/', CreateMemberForUnit.as_view(), name='create_member_for_unit'),
    path('member_list/', MemberList.as_view(), name='member_list'),
    path('member_list_search_sort/', MemberListSearchSort.as_view(), name='member_list_search_sort'), 
    path('member_details/<int:pk>/', MemberDetails.as_view(), name='member_details'),
    path('update_member/<int:pk>/', UpdateMember.as_view(), name='update_member'),
    path('resend_login_credentials/<int:pk>/', ResendLoginCredentials.as_view(), name='resend_login_credentials'),
    # path('delete_member/<int:pk>/', DeleteGroup.as_view(), name='delete_member'),
    path('change_member_status/<int:pk>/', ChangeMemberStatus.as_view(), name='change_member_status'),
    path('get_member_details/<int:member_id>/', MemberDetailsForResident.as_view(), name='get_member_details'),
    # Member Type endpoints
    path('member_type_list/', MemberTypeList.as_view(), name='member_type_list'), 

    # User tower and unit information
    path('user_tower_unit/', GetUserTowerUnit.as_view(), name='user_tower_unit'),
    
    # Profile management - user's own profile (no special permissions required)
    path('my_profile/', MyProfile.as_view(), name='my_profile'),
    path('my_permissions/', MyPermissions.as_view(), name='my_permissions'),
    path('accept_terms/', AcceptTermsAndConditions.as_view(), name='accept_terms'),
    path('check_terms_status/', CheckTermsStatus.as_view(), name='check_terms_status'),

    path('companies/list/', CompanyView.as_view(), name='company-list'),
    path('companies/create/', CompanyView.as_view(), name='company-create'),
    path('companies/update/<int:pk>/', CompanyView.as_view(), name='company-update'),
    path('add_existing_comm_member_list/', AddExistingCommMemberList.as_view(), name='add_existing_member_list'),
    # path('add_existing_comm_member_list_search_sort/', AddExistingMemberListSearchSort.as_view(), name='add_existing_member_list_search_sort'), 
    
    # Database table management endpoints
    path('database/tables/', DatabaseTablesListView.as_view(), name='database-tables-list'),
    path('database/tables/truncate/', DatabaseTablesTruncateView.as_view(), name='database-tables-truncate'),
    path('database/export/', DatabaseExportView.as_view(), name='database-export'),
    path('database/import/', DatabaseImportView.as_view(), name='database-import'),
    
    # System management endpoints
    path('system/app-update/', AppUpdateView.as_view(), name='app-update'),
    
    
    # User blocking endpoints
    path('block/<int:member_id>/', BlockUserView.as_view(), name='block_user'),
    path('unblock/<int:member_id>/', UnblockUserView.as_view(), name='unblock_user'),
    path('blocked_members/', BlockedMembersListView.as_view(), name='blocked_members'),

]
