from towers.models import UnitStaff,Unit
from towers.serializers.tower_serializers import TowerSerializer
from user.serializers import MemberSerializer
from rest_framework import serializers
from django.db import transaction
from user.models import Member
from towers.models import Resident,ResidentDocs,Owner,UnitStaff,Unit

 
class UnitStaffSerializer(serializers.ModelSerializer):
    member = MemberSerializer(required=False)
    username = serializers.SerializerMethodField()   
    unit_name = serializers.SerializerMethodField()   

    tower = serializers.SerializerMethodField()

 
    def __init__(self, *args, **kwargs):

        super().__init__(*args, **kwargs)
        request = self.context.get('request')
        if request and request.data.get('member_id'):
            
            self.partial = True
            
            self.fields['member'].required = False
            self.fields['member'].allow_null = True
    def get_tower(self, obj):
       
        tower = obj.unit.floor.tower
        if tower:
            return {
                'tower_name': tower.tower_name,
                'tower_number': tower.tower_number
            }
        return None
    
    def get_unit_name(self, obj):
        return obj.unit.unit_name if obj.unit else None
    
    def get_username(self, obj):
       
        if obj.member and obj.member.user:
            return obj.member.user.username
        return None

    class Meta:
        model = UnitStaff
        fields = [
            'id',
            'member', 
            'username',           
            'member_id',
            'unit_name',
            'unit',
            'tower',
            'unit_staff_status',
            'is_active' ,

        ]
    def validate(self, data):
        
        request = self.context.get('request')
        member_data = data.get('member') or {}
        member_id = request.data.get('member_id') if request else None

        if not member_data and not member_id:
            raise serializers.ValidationError("Member information is required.")

      
        delivery_method = member_data.get('delivery_method')
        if delivery_method:
             
            if '@' in delivery_method:
                if Member.objects.filter(login_email=delivery_method).exists():
                    raise serializers.ValidationError({
                        'login_email': 'This login email is already in use. Please choose a different one.'
                    })
            else:
                if Member.objects.filter(login_contact=delivery_method).exists():
                    raise serializers.ValidationError({
                        'login_contact': 'This login contact is already in use. Please choose a different one.'
                    })
        return data


    def create(self, validated_data):
        request = self.context.get('request')
        files = validated_data.pop('docs', [])
        member_data = validated_data.pop('member', None)
        member_id = request.data.get('member_id') if request else None
        unit = validated_data.get('unit')  

        with transaction.atomic():
            try:
                creator = None
                if request and request.user.is_authenticated:
                    creator = Member.objects.filter(user=request.user).first()

                if member_id:
                    try:
                        member = Member.objects.get(id=member_id)

                        if member_data:
                            member_data['is_comm_member'] = True
                            member_data['comm_member_ever_created'] = True
                            member.is_comm_member = True
                            member.comm_member_ever_created = True
                            m_ser = MemberSerializer(member, data=member_data, context=self.context, partial=True)
                            m_ser.is_valid(raise_exception=True)
                            member = m_ser.save()
                       
                        member.is_comm_member = True
                        member.comm_member_ever_created = True

                        member.save(update_fields=['is_comm_member','comm_member_ever_created'])

                    except Member.DoesNotExist:
                        raise serializers.ValidationError("Member with the provided id does not exist.")
                else:
                    if member_data is None:
                        member_data = {}
                    member_data['is_comm_member'] = True
                    member_data['comm_member_ever_created'] = True
                    m_ser = MemberSerializer(data=member_data, context=self.context)

                    m_ser.is_valid(raise_exception=True)
                    member = m_ser.save()
           
           
                    member.is_comm_member = True
                    member.comm_member_ever_created = True
                    member.save(update_fields=['is_comm_member','comm_member_ever_created'])

                # NEW LOGIC: Check if the same unitstaff is already a member of the provided unit.
                if UnitStaff.objects.filter(member=member, unit=unit, is_active=True).exists():
                    raise serializers.ValidationError("This staff member is already assigned to this unit")

                validated_data['is_active'] = True
                unit_staff = UnitStaff.objects.create(
                    member=member,
                    created_by=creator,
                    updated_by=creator,
                    **validated_data
                )

                return unit_staff   

            # except Exception as e:
               
            #     raise serializers.ValidationError(f"Error occurred: {str(e)}")
            except serializers.ValidationError:
            
                raise
            except Exception as e:
                # Any other error gets wrapped, but without the ErrorDetail wrapper
                raise serializers.ValidationError(f"Error occurred: {str(e)}")
            

class UnitStaffMemberSerializer(serializers.ModelSerializer):
    member = MemberSerializer(read_only=True)

    class Meta:
        model = UnitStaff
        fields = [
            'id',
            'member',
            'unit',
            'unit_staff_status',

        ]

    def to_representation(self, instance):
        rep = super().to_representation(instance)
        
        # rep['resident_type'] = 'Flat Owner' if instance.is_resident_or_tenant else 'Tenant'
        
         
        if instance.unit:
            rep['unit_name'] = instance.unit.unit_name
            
            if instance.unit.floor and instance.unit.floor.tower:
                rep['tower_name'] = instance.unit.floor.tower.tower_name
                rep['tower_number'] = instance.unit.floor.tower.tower_number

        return rep

     
     
class UnitStaffMemberSerializerForCommMember(serializers.ModelSerializer):
    member = MemberSerializer(read_only=True)
    tower_name = serializers.SerializerMethodField()
    floor_no = serializers.SerializerMethodField()
    unit_name = serializers.CharField(source='unit.unit_name', read_only=True)
    unit_id = serializers.IntegerField(source='unit.id', read_only=True)
    unit_staff = serializers.SerializerMethodField() 
    
    class Meta:
        model = UnitStaff
        fields = [
            'id',
            'member',
            'unit_name',
            'unit_id',
            'floor_no',
            'tower_name',
            'unit_staff',
        ]

    def get_tower_name(self, obj):
        if obj.unit and obj.unit.floor and obj.unit.floor.tower:
            return obj.unit.floor.tower.tower_name
        return None

    def get_floor_no(self, obj):
        if obj.unit and obj.unit.floor:
            return obj.unit.floor.floor_no
        return None

    def get_unit_staff(self, obj):
        return "unit_staff" 
    

class BulkUnitStaffSerializer(serializers.ModelSerializer):
    member = serializers.PrimaryKeyRelatedField(
        queryset=Member.objects.all(),
        required=False,
        allow_null=True
    )
    unit = serializers.PrimaryKeyRelatedField(queryset=Unit.objects.all())

    class Meta:
        model = UnitStaff
        fields = [
            'member', 'unit', 'unit_staff_status',
            'is_active', 'created_by', 'updated_by'
        ]

    def validate(self, data):
        # Member validation
        if not data.get('member') and not self.context.get('request').data.get('member_id'):
            raise serializers.ValidationError("Member information is required.")
        
        # Check if staff already exists for this unit
        if UnitStaff.objects.filter(
            member=data.get('member'),
            unit=data.get('unit'),
            is_active=True
        ).exists():
            raise serializers.ValidationError("Staff member already exists for this unit")
        
        return data

 

