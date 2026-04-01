"""
Lightweight serializers for unit contact list
Optimized for performance - only includes essential fields
"""
from rest_framework import serializers
from towers.models import Owner, Resident, UnitStaff
from user.models import Member


class LightweightMemberSerializer(serializers.ModelSerializer):
    """
    Minimal member serializer with only fields needed for contact list
    Reduces response size significantly compared to full MemberSerializer
    """
    class Meta:
        model = Member
        fields = [
            'id',
            'full_name',
            'general_contact',
            'general_email',
            'photo',
            'photo_low_quality',
        ]


class UnitContactOwnerSerializer(serializers.ModelSerializer):
    """
    Lightweight serializer for owners in unit contact list
    """
    member = LightweightMemberSerializer(read_only=True)
    unit_id = serializers.IntegerField(source='unit.id', read_only=True)
    unit_name = serializers.CharField(source='unit.unit_name', read_only=True)
    tower_name = serializers.CharField(source='unit.floor.tower.tower_name', read_only=True)
    floor_no = serializers.IntegerField(source='unit.floor.floor_no', read_only=True)
    member_type_name = serializers.SerializerMethodField()
    
    class Meta:
        model = Owner
        fields = [
            'id',
            'member',
            'unit_id',
            'unit_name',
            'tower_name',
            'floor_no',
            'member_type_name',
        ]
    
    def get_member_type_name(self, obj):
        return "Owner"


class UnitContactResidentSerializer(serializers.ModelSerializer):
    """
    Lightweight serializer for residents in unit contact list
    """
    resident_member = LightweightMemberSerializer(source='member', read_only=True)
    unit_id = serializers.IntegerField(source='unit.id', read_only=True)
    unit_name = serializers.CharField(source='unit.unit_name', read_only=True)
    tower_name = serializers.CharField(source='unit.floor.tower.tower_name', read_only=True)
    floor_no = serializers.IntegerField(source='unit.floor.floor_no', read_only=True)
    member_type_name = serializers.SerializerMethodField()
    
    class Meta:
        model = Resident
        fields = [
            'id',
            'resident_member',
            'unit_id',
            'unit_name',
            'tower_name',
            'floor_no',
            'is_resident_or_tenant',
            'member_type_name',
        ]
    
    def get_member_type_name(self, obj):
        if obj.is_resident_or_tenant:
            return "Resident"
        return "Resident (Tenant)"


class UnitContactUnitStaffSerializer(serializers.ModelSerializer):
    """
    Lightweight serializer for unit staff in unit contact list
    """
    member = LightweightMemberSerializer(read_only=True)
    unit_id = serializers.IntegerField(source='unit.id', read_only=True)
    unit_name = serializers.CharField(source='unit.unit_name', read_only=True)
    tower_name = serializers.CharField(source='unit.floor.tower.tower_name', read_only=True)
    floor_no = serializers.IntegerField(source='unit.floor.floor_no', read_only=True)
    member_type_name = serializers.SerializerMethodField()
    
    class Meta:
        model = UnitStaff
        fields = [
            'id',
            'member',
            'unit_id',
            'unit_name',
            'tower_name',
            'floor_no',
            'member_type_name',
        ]
    
    def get_member_type_name(self, obj):
        return "Unit Staff"

