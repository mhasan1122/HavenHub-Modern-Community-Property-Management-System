from django.urls import path
from towers.views.resident_views import CommMemberList,AddExistingMemberView,CreateResident,ResidentMemberList,ResidentDetails,InactivateResidents,ResidentInfoEdit,BulkDeleteResident,ResidentBulkUploadView, UnitResidentHistoryAPI
from towers.views.tower_views import AddExistingMemberForContact,AddExistingMemberForOwner
from towers.views.tower_views import GetLastTowerNumber, CreateTower, UnitDetails,TowerList,UpdateTower,UpdateUnit,TowerDetails,DeleteTower,UnitSideDetails,CommunityMemberTowerList,CommunityMemberUnitList
from towers.views.unitStaff_views import CreateUnitStaff,UnitStaffMemberList,UpdateUnitStaffStatus,BulkDeleteUnitStaff,UnitStaffBulkUploadView,UnitStaffHistoryAPI
from towers.views.owner_views import AddOwnerSearch,CreateOwner,BulkCreateOwner,UpdateOwner, DeleteOwner, MemberUnitOwnership, OwnerDetails, OwnerListOfUnit, OwnerBulkUploadView, UnitOwnershipHistoryAPI
from towers.views.unit_contact_views import UnitContactList

urlpatterns = [
    path('get_last_tower_number/', GetLastTowerNumber.as_view(), name='get_last_tower_number'),
    path('create_tower/', CreateTower.as_view(), name='create_tower'),
    path('tower_list/', TowerList.as_view(), name='tower_list'),
    path('community_towers/', CommunityMemberTowerList.as_view(), name='community_towers'),
    path('community_units/', CommunityMemberUnitList.as_view(), name='community_units'),
    path('update_tower/<int:pk>/', UpdateTower.as_view(), name='update_tower'),
    path('tower_details/<int:pk>/', TowerDetails.as_view(), name='tower_details'),
    path('delete_tower/<int:pk>/', DeleteTower.as_view(), name='delete_tower'),
    path('units_side_details/<int:pk>/', UnitSideDetails.as_view(), name='units_side_details'),
    path('update_unit/<int:pk>/', UpdateUnit.as_view(), name='update_unit'),
    path('unit_details/<int:pk>/', UnitDetails.as_view(), name='unit_details'),

    path('create_resident/', CreateResident.as_view(), name='create_resident'),
    path('resident/bulk-upload/', ResidentBulkUploadView.as_view(), name='bulk_upload_resident'), 

    # UnitStaff 
    path('create_unit_staff/', CreateUnitStaff.as_view(), name='create_unit_staff'), 
    path('unit_staff_list/<int:unit_pk>/', UnitStaffMemberList.as_view(), name='unit_staff_list'),
    path('unit-staff/bulk-upload/', UnitStaffBulkUploadView.as_view(), name='bulk_upload_unit_staff'), 
  
    path('add_owner_search/', AddOwnerSearch.as_view(), name='add_owner_search'),
    path('create_owner/', CreateOwner.as_view(), name='create_owner'),
    path('bulk_create_owner/', BulkCreateOwner.as_view(), name='bulk_create_owner'),
    path('update_owner/<int:owner_id>/', UpdateOwner.as_view(), name='update_owner'),
    path('delete_owner/<int:owner_id>/', DeleteOwner.as_view(), name='delete_owner'),
    path('owners/bulk-upload/', OwnerBulkUploadView.as_view(), name='bulk_upload_owner'),

    path('owner_details/<int:unit_id>/<int:owner_id>/', OwnerDetails.as_view(), name='owner-details'),
    path('add_existing_member/', AddExistingMemberView.as_view(), name='add_existing_member'),
    path('unit_ownership_by_member/<int:member_id>/', MemberUnitOwnership.as_view(), name='unit_ownership_by_member'),

    path('add_existing_contact/<int:pk>/', AddExistingMemberForContact.as_view(), name='add_existing_contact'),
    path('add_existing_member_for_owner/', AddExistingMemberForOwner.as_view(), name='add_existing_member_for_owner'),
    
    # Optimized endpoint for unit contact list (for Add Unit Contact modal)
    path('unit_contact_list/', UnitContactList.as_view(), name='unit_contact_list'),

    # path('add_existing_member_for_resident/', AddExtingMemberForResident.as_view(), name='add_existing_member_for_resident'),
    # path('list_members/', ListSearchSort.as_view(), name='list_members'),
    path('residents_list/<int:unit_pk>/', ResidentMemberList.as_view(), name='residents_list_by_unit'),
    # /path('resident_details/<int:unit_pk>/', ResidentMemberList.as_view(), name='resident_details'),
    path('owner_list_of_unit/<int:unit_id>/', OwnerListOfUnit.as_view(), name='owner_list_of_unit'),
    path('unit_ownership_history/<int:unit_id>/', UnitOwnershipHistoryAPI.as_view(), name='unit_ownership_history'),
    path('unit_staff_history/<int:unit_id>/', UnitStaffHistoryAPI.as_view(), name='unit_staff_history'),
    path('unit_resident_history/<int:unit_id>/', UnitResidentHistoryAPI.as_view(), name='unit_resident_history'),
    path('resident_details/<int:unit_id>/<int:resident_id>/', ResidentDetails.as_view(), name='resident-detail'),
    path('inactivate_residents/', InactivateResidents.as_view(), name='inactivate-residents'),
    path('delete_residents/', BulkDeleteResident.as_view(), name='delete-residents'),
    path('resident_info_edit/<int:resident_id>/', ResidentInfoEdit.as_view(), name='resident-info-edit'),


    # CommMemeber list
    path('commMemberList/', CommMemberList.as_view(), name='commMemberList'),





# ============================
# Created by Firoj Hasan (Hasan)
# These endpoints are related to updating and soft-deleting UnitStaff records.
# ============================

# Single UnitStaff status update 
path('unit-staff/update-status/<int:pk>/', UpdateUnitStaffStatus.as_view(), name='update-unit-staff-status'),

#  Bulk deactivate UnitStaff (soft delete: is_active=False for multiple IDs)
path('unit-staff/bulk-delete/', BulkDeleteUnitStaff.as_view(), name='bulk_deactivate_unit_staff'),

# ============================
# End of Firoj's custom UnitStaff management routes
# ============================



]
