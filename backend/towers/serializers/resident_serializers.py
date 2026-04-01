from towers.models import Resident,ResidentDocs,Owner,UnitStaff,Unit, UnitResidentHistory
from towers.serializers.tower_serializers import TowerSerializer
from user.serializers import MemberSerializer
from rest_framework import serializers
from django.db import transaction
from user.models import Member
from django.utils import timezone
import os
import json


class ResidentDocsSerializer(serializers.ModelSerializer):
    class Meta:
        model = ResidentDocs
        fields = '__all__'
        extra_kwargs = {
            'resident': {'read_only': True}   
        }
class ResidentSerializer(serializers.ModelSerializer):
    member = MemberSerializer(required=False)
    username = serializers.SerializerMethodField()  
    unit_name = serializers.SerializerMethodField()  

    tower = serializers.SerializerMethodField()
    docs = serializers.ListField(
        child=serializers.FileField(),
        write_only=True,
        required=False
    )

    resident_docs = ResidentDocsSerializer(
        source='docs',
        many=True,
        read_only=True
    )
    def __init__(self, *args, **kwargs):

        super().__init__(*args, **kwargs)
        request = self.context.get('request')
        if request and request.data.get('member_id'):
            # skip required-checks on any missing fields
            self.partial = True
            # ensure outer “member” field itself is not required
            self.fields['member'].required = False
            self.fields['member'].allow_null = True
    def get_tower(self, obj):
        # Traverse the relationships to get the tower
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
        # Safely retrieve username from related user
        if obj.member and obj.member.user:
            return obj.member.user.username
        return None

    move_in_date = serializers.SerializerMethodField()
    move_out_date = serializers.SerializerMethodField()

    def get_move_in_date(self, obj):
        """Get move-in date from created_at"""
        try:
            if obj.created_at:
                if hasattr(obj.created_at, 'date'):
                    return obj.created_at.date().isoformat()
                else:
                    # If it's already a date string, return as is
                    return str(obj.created_at)
            return None
        except Exception:
            return None
    
    def get_move_out_date(self, obj):
        """Get move-out date from UnitResidentHistory if resident is inactive"""
        try:
            if obj.is_active:
                return None
            
            from towers.models import UnitResidentHistory
            # Find the most recent 'resident_removed' entry for this resident
            removal_entry = UnitResidentHistory.objects.filter(
                unit=obj.unit,
                resident_member=obj.member,
                entry_type='resident_removed'
            ).order_by('-entry_date', '-created_at').first()
            
            if removal_entry and removal_entry.entry_date:
                if hasattr(removal_entry.entry_date, 'date'):
                    return removal_entry.entry_date.date().isoformat()
                else:
                    return str(removal_entry.entry_date)
            
            return None
        except Exception:
            return None

    class Meta:
        model = Resident
        fields = [
            'id',
            'member', 
            'username',           
            'member_id',
            'unit_name',
            'unit',
            'tower',
            'is_resident_or_tenant',
            'unit_rent_fee',
            'advance_payment',
            'notice_period',
            'docs',              
            'resident_docs',
            'is_active',
            'move_in_date',
            'move_out_date',
        ]
    def validate(self, data):
        
        request = self.context.get('request')
        member_data = data.get('member') or {}
        member_id = request.data.get('member_id') if request else None

        if not member_data and not member_id:
            raise serializers.ValidationError("Resident information is required.")

        # ---- Delivery method (login email/contact) ----
        delivery_method = member_data.get('delivery_method')
        if delivery_method:
             
            if '@' in delivery_method:
                if Member.objects.filter(login_email=delivery_method).exists():
                    raise serializers.ValidationError({
                        'login_email': "This email is already associated with an existing user."
                    })
            else:
                if Member.objects.filter(login_contact=delivery_method).exists():
                    raise serializers.ValidationError({
                        'login_contact': "This contact is already associated with an existing user."
                    })

        # ---- Also catch if they supplied login_email/login_contact directly ----
        # le = member_data.get('login_email')
        # if le and Member.objects.filter(login_email=le).exists():
        #     raise serializers.ValidationError({
        #         'login_email': 'This login email is already in use. Please choose a different one.'
        #     })
        # lc = member_data.get('login_contact')
        # if lc and Member.objects.filter(login_contact=lc).exists():
        #     raise serializers.ValidationError({
        #         'login_contact': 'This login contact is already in use. Please choose a different one.'
        #     })

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
                            # Use serializer to update if there is data to update
                            m_ser = MemberSerializer(member, data=member_data, context=self.context, partial=True)
                            m_ser.is_valid(raise_exception=True)
                            member = m_ser.save()
                        # Mark the existing member as a community member.
                        member.is_comm_member = True
                        member.comm_member_ever_created = True
                        member.save(update_fields=['is_comm_member','comm_member_ever_created'])
                    except Member.DoesNotExist:
                        raise serializers.ValidationError("Resident with the provided id does not exist.")
                else:
                    if member_data is None:
                        member_data = {}
                    member_data['is_comm_member'] = True
                    member_data['comm_member_ever_created'] = True
                    m_ser = MemberSerializer(data=member_data, context=self.context)
                    m_ser.is_valid(raise_exception=True)
                    member = m_ser.save()
                    # Mark the new member as a community member.
                    # member.is_comm_member = True
                    # member.comm_member_ever_created = True
                    # member.save(update_fields=['is_comm_member','comm_member_ever_created'])

                # NEW LOGIC: Check if the same resident is already a member of the provided unit.
                if Resident.objects.filter(member=member, unit=unit, is_active=True).exists():
                    raise serializers.ValidationError("This resident is already a member of this unit.")

                validated_data['is_active'] = True
                resident = Resident.objects.create(
                    member=member,
                    created_by=creator,
                    updated_by=creator,
                    **validated_data
                )

                # Create attachments - attachments added during assignment will be included
                # in the resident assignment entry automatically, so no separate attachment entry needed
                created_docs = []
                request = self.context.get('request')
                for f in files:
                    doc = ResidentDocs.objects.create(
                        resident=resident,
                        created_by=creator,
                        updated_by=creator,
                        rental_docs=f
                    )
                    created_docs.append(doc)
                
                unit_id = validated_data.get('unit')
                unit = Unit.objects.get(id=unit_id.id if hasattr(unit_id, 'id') else unit_id)
                
                # Update unit status
                unit.unit_status = 'occupied'
                unit.status_color = unit.STATUS_COLORS['occupied']
                unit.save()
            
                return resident  # Ensure this is inside the try block

            # except Exception as e:
            #     # If any error occurs, the transaction will be rolled back
            #     raise serializers.ValidationError(f"Error occurred: {str(e)}")
            except serializers.ValidationError as e:
                # Re‑raise validation errors unchanged
                raise e
            except Exception as e:
                # Convert all other errors to a clean ValidationError
                raise serializers.ValidationError(str(e))


class ResidentUpdateSerializer(serializers.ModelSerializer):
    member = MemberSerializer(required=False)
    
    tower = serializers.SerializerMethodField()
    docs = serializers.ListField(
        child=serializers.FileField(),
        write_only=True,
        required=False
    )
    resident_docs = ResidentDocsSerializer(
        source='docs',
        many=True,
        read_only=True
    )
    
    def get_tower(self, obj):
        # Traverse the relationships to get the tower
        tower = obj.unit.floor.tower
        if tower:
            return {
                'tower_name': tower.tower_name,
                'tower_number': tower.tower_number
            }
        return None

    class Meta:
        model = Resident
        fields = [
            'id',
            'member',
            'member_id',
            'unit',
            'tower',
            'is_resident_or_tenant',
            'unit_rent_fee',
            'advance_payment',
            'notice_period',
            'docs',
            'resident_docs',
            'is_active',
        ]

    def validate(self, data):
        # For updates, member information is not strictly required.
        return data

    def update(self, instance, validated_data):
        import json
        request = self.context.get('request')
        files = validated_data.pop('docs', [])
        member_data = validated_data.pop('member', None)
        removed_doc_ids = request.data.get('removed_doc_ids', [])

        # Update nested member details if provided
        if member_data:
            m_ser = MemberSerializer(instance=instance.member, data=member_data, partial=True, context=self.context)
            m_ser.is_valid(raise_exception=True)
            m_ser.save()
        
        # Update simple resident fields
        for attr, value in validated_data.items():
            setattr(instance, attr, value)
        
        # Update the 'updated_by' field if available
        if request and request.user.is_authenticated:
            creator = Member.objects.filter(user=request.user).first()
            instance.updated_by = creator
        
        instance.save()
        
        # Handle removed documents - create history entry before deletion
        if removed_doc_ids:
            try:
                removed_ids = json.loads(removed_doc_ids)
                docs_to_remove = ResidentDocs.objects.filter(id__in=removed_ids, resident=instance)
                
                # Create attachment removed history entry before deletion
                if docs_to_remove.exists():
                    request = self.context.get('request')
                    attachments_info = []
                    for doc in docs_to_remove:
                        if doc.rental_docs:
                            attachment_info = {
                                'id': doc.id,
                                'name': os.path.basename(doc.rental_docs.name) if doc.rental_docs else None,
                                'url': doc.rental_docs.url if doc.rental_docs else None
                            }
                            if request and doc.rental_docs:
                                attachment_info['url'] = request.build_absolute_uri(doc.rental_docs.url)
                            attachments_info.append(attachment_info)
                    
                    if attachments_info:
                        UnitResidentHistory.create_attachment_entry(
                            unit=instance.unit,
                            resident=instance,
                            entry_type='attachment_removed',
                            attachments_info=attachments_info,
                            entry_date=timezone.now(),
                            created_by=instance.updated_by,
                            request=request
                        )
                    
                    # Delete the documents
                    docs_to_remove.delete()
            except json.JSONDecodeError:
                pass
        
        # Append new documents if provided - create history entry
        if files:
            created_docs = []
            request = self.context.get('request')
            for f in files:
                doc = ResidentDocs.objects.create(
                    resident=instance,
                    created_by=instance.updated_by,
                    updated_by=instance.updated_by,
                    rental_docs=f
                )
                created_docs.append(doc)
            
            # Create attachment added history entry
            if created_docs:
                attachments_info = []
                for doc in created_docs:
                    attachment_info = {
                        'id': doc.id,
                        'name': os.path.basename(doc.rental_docs.name) if doc.rental_docs else None,
                        'url': doc.rental_docs.url if doc.rental_docs else None
                    }
                    if request and doc.rental_docs:
                        attachment_info['url'] = request.build_absolute_uri(doc.rental_docs.url)
                    attachments_info.append(attachment_info)
                
                UnitResidentHistory.create_attachment_entry(
                    unit=instance.unit,
                    resident=instance,
                    entry_type='attachment_added',
                    attachments_info=attachments_info,
                    entry_date=timezone.now(),
                    created_by=instance.updated_by,
                    request=request
                )
        
        return instance

    def to_representation(self, instance):
        return super().to_representation(instance)

class AddExistingOwners(serializers.ModelSerializer):
    id = serializers.IntegerField(source='member.id', read_only=True)
    member = MemberSerializer(read_only=True)
    tower_name = serializers.SerializerMethodField()
    floor_no = serializers.SerializerMethodField()
    unit_name = serializers.CharField(source='unit.unit_name', read_only=True)
    unit_id = serializers.IntegerField(source='unit.id', read_only=True)

    class Meta:
        model = Owner
        fields = [
            'id',
            'member',
            'unit_name',
            'unit_id',
            'floor_no',
            'tower_name',
            
            
        ]
    
    def get_tower_name(self, obj):
        # Access tower name via unit -> floor -> tower
        if obj.unit and obj.unit.floor and obj.unit.floor.tower:
            return obj.unit.floor.tower.tower_name
        return None

    def get_floor_no(self, obj):
        # Access floor number via unit -> floor
        if obj.unit and obj.unit.floor:
            return obj.unit.floor.floor_no
        return None
    

class AddExistingResident(serializers.ModelSerializer):
    id = serializers.IntegerField(source='member.id', read_only=True)
    resident_member = MemberSerializer(source='member', read_only=True)
    unit_name = serializers.CharField(source='unit.unit_name', read_only=True)
    unit_id = serializers.IntegerField(source='unit.id', read_only=True)
    tower_name = serializers.SerializerMethodField()
    floor_no = serializers.SerializerMethodField()
    is_resident_or_tenant = serializers.BooleanField(read_only=True)
    member_type_name = serializers.SerializerMethodField()

    class Meta:
        model = Resident
        fields = [
            'id',
            'resident_member',  
            'unit_name',
            'unit_id',
            'floor_no',
            'tower_name',
            'is_resident_or_tenant',
            'member_type_name',
        ]
        
    def get_tower_name(self, obj):
        if obj.unit and obj.unit.floor and obj.unit.floor.tower:
            return obj.unit.floor.tower.tower_name
        return None
    
    def get_floor_no(self, obj):
        if obj.unit and obj.unit.floor:
            return obj.unit.floor.floor_no
        return None
    
    def get_member_type_name(self, obj):
        # Return "Resident" for residents, "Resident (Tenant)" for tenants
        return "Resident" if obj.is_resident_or_tenant else "Resident (Tenant)"
class AddExistingUnitStaff(serializers.ModelSerializer):
    id = serializers.IntegerField(source='member.id', read_only=True)
    member = MemberSerializer(read_only=True)
    tower_name = serializers.SerializerMethodField()
    floor_no = serializers.SerializerMethodField()
    unit_name = serializers.CharField(source='unit.unit_name', read_only=True)

    class Meta:
        model = UnitStaff
        fields = [
            'id',
            'member',
            'unit_name',
            'floor_no',
            'tower_name',
            
            
        ]
    
    def get_tower_name(self, obj):
        # Access tower name via unit -> floor -> tower
        if obj.unit and obj.unit.floor and obj.unit.floor.tower:
            return obj.unit.floor.tower.tower_name
        return None

    def get_floor_no(self, obj):
        # Access floor number via unit -> floor
        if obj.unit and obj.unit.floor:
            return obj.unit.floor.floor_no
        return None
    

    
class ResidentMemberSerializer(serializers.ModelSerializer):
    member = MemberSerializer(read_only=True)

    class Meta:
        model = Resident
        fields = [
            'id',
            'member',
            'unit',
            'is_resident_or_tenant',
            'unit_rent_fee',
            'advance_payment',
            'notice_period'
        ]

    def to_representation(self, instance):
        rep = super().to_representation(instance)
        # Add resident type for clarity
        rep['resident_type'] = 'Resident' if instance.is_resident_or_tenant else 'Tenant'
        
        # Check if the unit exists and add extra fields:
        if instance.unit:
            rep['unit_name'] = instance.unit.unit_name
            # Ensure the unit is related to a floor and tower before accessing
            if instance.unit.floor and instance.unit.floor.tower:
                rep['tower_name'] = instance.unit.floor.tower.tower_name
                rep['tower_number'] = instance.unit.floor.tower.tower_number
        
        # Include rental docs file(s)
        rep['docs'] = []
        for doc in instance.docs.all():
            if doc.rental_docs:
                rep['docs'].append(doc.rental_docs.url)

        return rep
    








# class BulkResidentSerializer(serializers.ModelSerializer):
#     member = serializers.PrimaryKeyRelatedField(
#         queryset=Member.objects.all(),
#         required=False,
#         allow_null=True
#     )
#     unit = serializers.PrimaryKeyRelatedField(queryset=Unit.objects.all())

#     class Meta:
#         model = Resident
#         fields = [
#             'member', 'unit', 'is_resident_or_tenant',
#             'unit_rent_fee', 'advance_payment', 'notice_period'
#         ]

#     def validate(self, data):
#         # Member validation
#         if not data.get('member') and not self.context.get('request').data.get('member_id'):
#             raise serializers.ValidationError("Member information is required.")
        
#         # Tenant-specific field validation
#         is_resident = data.get('is_resident_or_tenant', True)
        
#         if not is_resident:
#             # Clear tenant-specific fields for non-tenants
#             data['unit_rent_fee'] = 0.0
#             data['advance_payment'] = 0.0
#             data['notice_period'] = 0
#         else:
#             # Validate tenant-specific fields exist
#             tenant_fields = ['unit_rent_fee', 'advance_payment', 'notice_period']
#             for field in tenant_fields:
#                 if field not in data:
#                     raise serializers.ValidationError({
#                         field: f"This field is required for tenants"
#                     })
        
#         return data
class BulkResidentSerializer(serializers.ModelSerializer):
    member = serializers.PrimaryKeyRelatedField(
        queryset=Member.objects.all(),
        required=False,
        allow_null=True
    )
    unit = serializers.PrimaryKeyRelatedField(queryset=Unit.objects.all())

    class Meta:
        model = Resident
        fields = [
            'member', 'unit', 'is_resident_or_tenant',
            'unit_rent_fee', 'advance_payment', 'notice_period'
        ]

    def validate(self, data):
        # Member validation - skip during bulk upload validation phase
        # (member will be provided after creation in the save phase)
        is_bulk_upload = self.context.get('bulk_upload', False)
        if not is_bulk_upload:
            if not data.get('member') and not self.context.get('request').data.get('member_id'):
                raise serializers.ValidationError("Resident information is required.")

        flag = data.get('is_resident_or_tenant')

        if flag:
            # When flag == 1 → zero out all three fields
            data['unit_rent_fee']   = 0.0
            data['advance_payment'] = 0.0
            data['notice_period']   = 0
        else:
            # When flag == 0 → require and keep the provided values
            required_fields = ['unit_rent_fee', 'advance_payment', 'notice_period']
            missing = {
                f: "This field is required for residents (flag=0)."
                for f in required_fields
                if f not in data
            }
            if missing:
                raise serializers.ValidationError(missing)

        return data


# class BulkResidentSerializer(serializers.ModelSerializer):
#     member = serializers.PrimaryKeyRelatedField(
#         queryset=Member.objects.all(),
#         required=False,
#         allow_null=True
#     )
#     unit = serializers.PrimaryKeyRelatedField(queryset=Unit.objects.all())

#     class Meta:
#         model = Resident
#         fields = [
#             'member', 'unit', 'is_resident_or_tenant',
#             'unit_rent_fee', 'advance_payment', 'notice_period'
#         ]

#     def validate(self, data):
#         if not data.get('member') and not self.context.get('request').data.get('member_id'):
#             raise serializers.ValidationError("Member information is required.")

#         flag = data.get('is_resident_or_tenant')
#         if flag:
#             data.update({
#                 'unit_rent_fee':   0.0,
#                 'advance_payment': 0.0,
#                 'notice_period':   0,
#             })
#         else:
#             for field in ('unit_rent_fee', 'advance_payment', 'notice_period'):
#                 if field not in data:
#                     raise serializers.ValidationError({
#                         field: "This field is required for residents (flag=0)."
#                     })

#         return data
