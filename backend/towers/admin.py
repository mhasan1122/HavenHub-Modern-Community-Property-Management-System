from django.contrib import admin
from towers.models import (
    Tower, Floor, Unit, UnitDocs, Owner, OwnerDocs, 
    Resident, ResidentDocs, UnitStaff, UnitOwnershipHistory, UnitStaffHistory, UnitResidentHistory
)

# Register your models here.

@admin.register(Tower)
class TowerAdmin(admin.ModelAdmin):
    list_display = ('tower_name', 'tower_number', 'num_floors', 'num_units')
    search_fields = ('tower_name',)


@admin.register(Floor)
class FloorAdmin(admin.ModelAdmin):
    list_display = ('tower', 'floor_no', 'number_of_units')
    list_filter = ('tower',)


@admin.register(Unit)
class UnitAdmin(admin.ModelAdmin):
    list_display = ('unit_name', 'floor', 'unit_status')
    list_filter = ('unit_status', 'floor__tower')
    search_fields = ('unit_name',)


@admin.register(Owner)
class OwnerAdmin(admin.ModelAdmin):
    list_display = ('member', 'unit', 'ownership_percentage', 'date_of_ownership')
    list_filter = ('unit__floor__tower',)
    search_fields = ('member__full_name', 'unit__unit_name')


@admin.register(Resident)
class ResidentAdmin(admin.ModelAdmin):
    list_display = ('member', 'unit', 'is_active', 'is_resident_or_tenant')
    list_filter = ('is_active', 'is_resident_or_tenant')
    search_fields = ('member__full_name', 'unit__unit_name')


@admin.register(UnitStaff)
class UnitStaffAdmin(admin.ModelAdmin):
    list_display = ('member', 'unit', 'is_active', 'unit_staff_status')
    list_filter = ('is_active', 'unit_staff_status')
    search_fields = ('member__full_name', 'unit__unit_name')


@admin.register(UnitOwnershipHistory)
class UnitOwnershipHistoryAdmin(admin.ModelAdmin):
    list_display = ('unit', 'entry_type', 'entry_date', 'description', 'created_at')
    list_filter = ('entry_type', 'unit__floor__tower')
    search_fields = ('unit__unit_name', 'description')
    readonly_fields = ('created_at',)
    ordering = ('-entry_date', '-created_at')
    
    fieldsets = (
        ('Basic Info', {
            'fields': ('unit', 'entry_type', 'entry_date', 'description')
        }),
        ('Transfer Details', {
            'fields': ('transfer_from', 'transfer_to'),
            'classes': ('collapse',),
        }),
        ('Owners Data', {
            'fields': ('owners',),
        }),
        ('Metadata', {
            'fields': ('created_at', 'created_by'),
        }),
    )


@admin.register(UnitStaffHistory)
class UnitStaffHistoryAdmin(admin.ModelAdmin):
    list_display = ('unit', 'entry_type', 'staff_member', 'entry_date', 'created_at')
    list_filter = ('entry_type', 'unit__floor__tower')
    search_fields = ('unit__unit_name', 'staff_member__full_name')
    readonly_fields = ('created_at',)


@admin.register(UnitResidentHistory)
class UnitResidentHistoryAdmin(admin.ModelAdmin):
    list_display = ('unit', 'entry_type', 'resident_member', 'entry_date', 'created_at')
    list_filter = ('entry_type', 'unit__floor__tower')
    search_fields = ('unit__unit_name', 'resident_member__full_name')
    readonly_fields = ('created_at',)
