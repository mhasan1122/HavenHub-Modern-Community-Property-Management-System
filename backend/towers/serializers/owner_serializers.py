from rest_framework import serializers
from django.db import transaction
from towers.models import Owner, OwnerDocs, Unit, UnitOwnershipHistory
from user.models import Member
from datetime import datetime
from django.utils import timezone
from user.serializers import MemberSerializer
import os

class OwnerSerializer(serializers.ModelSerializer):
    date_of_ownership = serializers.CharField(required=True)
    ownership_percentage = serializers.DecimalField(max_digits=5, decimal_places=2, required=False)
    # owner_docs = serializers.ListField(
    #     child=serializers.FileField(allow_empty_file=False), required=False
    # )
    unit_name = serializers.SerializerMethodField()  
    owner_docs = serializers.SerializerMethodField()
    owner_docs_upload = serializers.ListField(
        child=serializers.FileField(allow_empty_file=False),
        required=False,
        write_only=True
    )
    docs_to_delete = serializers.ListField(
        child=serializers.IntegerField(), required=False, write_only=True
    )
    docs_to_update = serializers.ListField(
        child=serializers.DictField(), required=False, write_only=True
    )
    tower = serializers.SerializerMethodField()
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
    
    def get_owner_docs(self, obj):
        request = self.context.get('request')
        docs = OwnerDocs.objects.filter(owner=obj)
        return [
            {
                'id': doc.id,
                'url': request.build_absolute_uri(doc.owner_docs.url) if doc.owner_docs else None,
                'name': os.path.basename(doc.owner_docs.name) if doc.owner_docs else None
            }
            for doc in docs
        ]



    class Meta:
        model = Owner
        fields = [
            'id', 'member', 'unit_name', 'unit', 'tower', 'ownership_percentage', 'date_of_ownership',
            'last_transfer_date',  # Add the new field
            'created_by', 'created_at', 'updated_by', 'updated_at',
            'owner_docs', 'owner_docs_upload', 'ownership_transfer_from', 'docs_to_delete', 'docs_to_update'
        ]
        read_only_fields = ['created_by', 'created_at', 'updated_by', 'updated_at', 'last_transfer_date']  # Make it read-only

    def validate_member(self, value):
        if isinstance(value, Member):
            return value
        try:
            return Member.objects.get(id=value)
        except Member.DoesNotExist:
            raise serializers.ValidationError("Member does not exist.")

    def validate_ownership_transfer_from(self, value):
        if value in (None, "", "null"):
            return None
        if isinstance(value, Member):
            return value
        try:
            return Member.objects.get(id=value)
        except Member.DoesNotExist:
            raise serializers.ValidationError("Ownership transfer member not found.")


    def validate_date_of_ownership(self, value):
        try:
            return datetime.strptime(value, "%d-%b-%Y").date()
        except ValueError:
            raise serializers.ValidationError("Date of ownership must be in format DD-MMM-YYYY (e.g., 01-Jan-2025)")

    def create(self, validated_data):
        owner_docs = validated_data.pop('owner_docs_upload', [])

        with transaction.atomic():
            user = self.context['request'].user
            if not user or not user.is_authenticated:
                raise serializers.ValidationError("User must be authenticated.")

            try:
                member_creator = Member.objects.get(user=user)
            except Member.DoesNotExist:
                raise serializers.ValidationError("No member profile found for the authenticated user.")
            
            validated_data['created_by'] = member_creator
            validated_data['updated_by'] = member_creator

      
            owner = Owner.objects.create(**validated_data)

            # Create all attachments first
            # Note: Attachments added during initial ownership creation or transfer
            # will be included in the ownership/transfer history entries automatically
            # via build_owner_data_with_attachments, so no separate attachment entry needed
            created_docs = []
            request = self.context.get('request')
            for file in owner_docs:
                doc = OwnerDocs.objects.create(
                    owner=owner,
                    unit=owner.unit,
                    owner_docs=file,
                    created_by=member_creator,
                    updated_by=member_creator
                )
                created_docs.append(doc)
            
            # Don't create separate attachment entry - attachments will be included
            # in the initial ownership or transfer entry created by the view
            
            unit_id = validated_data.get('unit')
            unit = Unit.objects.get(id=unit_id.id if hasattr(unit_id, 'id') else unit_id)
            
            # Update unit status
            unit.unit_status = 'available'
            unit.status_color = unit.STATUS_COLORS['available']
            unit.save()
            
            return owner
        
        
    def update(self, instance, validated_data):
        owner_docs = validated_data.pop('owner_docs_upload', [])
        
        # Handle docs_to_delete - try multiple ways to get the data
        docs_to_delete = validated_data.pop('docs_to_delete', [])
        
        # If not in validated_data, try to get from request data
        if not docs_to_delete:
            request_data = self.context['request'].data
            print("🔍 Request data type:", type(request_data))
            print("🔍 Request data keys:", list(request_data.keys()) if hasattr(request_data, 'keys') else "No keys")
            
            # Try different possible formats
            if hasattr(request_data, 'getlist'):
                docs_to_delete = request_data.getlist('docs_to_delete[]', [])
            elif isinstance(request_data, dict):
                docs_to_delete = request_data.get('docs_to_delete[]', [])
                if not isinstance(docs_to_delete, list):
                    docs_to_delete = [docs_to_delete] if docs_to_delete else []
            else:
                # For FormData, try to get all values with this key
                docs_to_delete = []
                for key in request_data.keys():
                    if key == 'docs_to_delete[]':
                        value = request_data.get(key)
                        if value:
                            docs_to_delete.append(value)

        print("🔁 Updating Owner:", instance.id)
        print("📄 New files to upload:", len(owner_docs))
        print("🗑 Docs to delete:", docs_to_delete)

        with transaction.atomic():
            # Get current member for history tracking
            try:
                request_user = self.context['request'].user
                if request_user and request_user.is_authenticated:
                    current_member = Member.objects.get(user=request_user)
                else:
                    current_member = None
            except (Member.DoesNotExist, AttributeError):
                current_member = None
            
            for attr, value in validated_data.items():
                setattr(instance, attr, value)
            
            if current_member:
                instance.updated_by = current_member
            instance.save()

            # Handle attachment deletions - create single history entry before deletion
            if docs_to_delete:
                # Convert to integers and filter out any invalid values
                doc_ids = []
                for doc_id in docs_to_delete:
                    try:
                        doc_ids.append(int(doc_id))
                    except (ValueError, TypeError):
                        print(f"⚠️ Invalid doc_id: {doc_id}")
                        continue
                
                if doc_ids:
                    # Get the documents to delete
                    docs_to_remove = OwnerDocs.objects.filter(id__in=doc_ids, owner=instance)
                    
                    # Create single history entry for all deleted attachments
                    request = self.context.get('request')
                    attachments_info = []
                    for doc in docs_to_remove:
                        if doc.owner_docs:
                            attachment_info = {
                                'id': doc.id,
                                'name': os.path.basename(doc.owner_docs.name) if doc.owner_docs else None,
                                'url': doc.owner_docs.url if doc.owner_docs else None
                            }
                            if request and doc.owner_docs:
                                attachment_info['url'] = request.build_absolute_uri(doc.owner_docs.url)
                            attachments_info.append(attachment_info)
                    
                    if attachments_info:
                        UnitOwnershipHistory.create_attachment_entry(
                            unit=instance.unit,
                            owner=instance,
                            entry_type='attachment_removed',
                            attachments_info=attachments_info,
                            entry_date=timezone.now(),
                            created_by=current_member,
                            request=request
                        )
                    
                    # Delete the actual files from media storage first
                    for doc in docs_to_remove:
                        if doc.owner_docs:
                            try:
                                # Delete the file from storage
                                doc.owner_docs.delete(save=False)
                                print(f"🗑️ Deleted file: {doc.owner_docs.name}")
                            except Exception as e:
                                print(f"⚠️ Error deleting file {doc.owner_docs.name}: {e}")
                    
                    # Then delete the database records
                    deleted = docs_to_remove.delete()
                    print(f"✅ Deleted {deleted[0]} docs with IDs: {doc_ids}")

            # Handle new attachment uploads
            # Check if this is part of a transfer - if so, don't create separate attachment entry
            # Attachments will be included in the transfer entry automatically
            is_transfer = 'ownership_transfer_from' in validated_data and validated_data.get('ownership_transfer_from') is not None
            is_transfer_date_update = 'last_transfer_date' in validated_data and validated_data.get('last_transfer_date') is not None
            
            if owner_docs:
                created_docs = []
                request = self.context.get('request')
                for file in owner_docs:
                    doc = OwnerDocs.objects.create(
                        owner=instance,
                        unit=instance.unit,
                        owner_docs=file,
                        created_by=current_member or instance.updated_by,
                        updated_by=current_member or instance.updated_by
                    )
                    created_docs.append(doc)
                
                # Only create separate attachment entry if this is NOT a transfer
                # If it's a transfer, attachments will be included in the transfer entry
                if created_docs and not (is_transfer or is_transfer_date_update):
                    attachments_info = []
                    for doc in created_docs:
                        attachment_info = {
                            'id': doc.id,
                            'name': os.path.basename(doc.owner_docs.name) if doc.owner_docs else None,
                            'url': doc.owner_docs.url if doc.owner_docs else None
                        }
                        if request and doc.owner_docs:
                            attachment_info['url'] = request.build_absolute_uri(doc.owner_docs.url)
                        attachments_info.append(attachment_info)
                    
                    UnitOwnershipHistory.create_attachment_entry(
                        unit=instance.unit,
                        owner=instance,
                        entry_type='attachment_added',
                        attachments_info=attachments_info,
                        entry_date=timezone.now(),
                        created_by=current_member,
                        request=request
                    )

        return instance




class OwnerDetailSerializer(serializers.ModelSerializer):
    member = MemberSerializer(read_only=True)
    ownership_transfer_from = serializers.SerializerMethodField()
    docs = serializers.SerializerMethodField()

    class Meta:
        model = Owner
        fields = [
            'id', 'member', 'ownership_percentage', 'date_of_ownership',
            'created_at', 'updated_at', 'docs', 'ownership_transfer_from'
        ]

    def get_docs(self, obj):
        request = self.context.get('request')
        docs = OwnerDocs.objects.filter(owner=obj)
        return [
            {
                "id": doc.id,
                "url": request.build_absolute_uri(doc.owner_docs.url) if doc.owner_docs and request else doc.owner_docs.url if doc.owner_docs else None
            }
            for doc in docs if doc.owner_docs
        ]


    def get_ownership_transfer_from(self, obj):
        if obj.ownership_transfer_from:
            return {
                "id": obj.ownership_transfer_from.id,
                "full_name": obj.ownership_transfer_from.full_name
            }
        return None

class MemberUnitOwnershipSerializer(serializers.ModelSerializer):
    unit_name = serializers.CharField(source='unit.unit_name')
    tower_name = serializers.CharField(source='unit.floor.tower.tower_name')
    tower_number = serializers.IntegerField(source='unit.floor.tower.tower_number')
    unit_id = serializers.IntegerField(source='unit.id')
    docs = serializers.SerializerMethodField()

    class Meta:
        model = Owner
        fields = [
            'unit_name', 'tower_name', 'tower_number', 'unit_id',
            'ownership_percentage', 'date_of_ownership', 'docs'
        ]

    def get_docs(self, obj):
        request = self.context.get('request')
        docs = OwnerDocs.objects.filter(owner=obj)
        return [
            request.build_absolute_uri(doc.owner_docs.url) if doc.owner_docs and request else doc.owner_docs.url 
            for doc in docs if doc.owner_docs
        ]
    


class OwnerExcelUploadSerializer(serializers.Serializer):
    member_id = serializers.IntegerField()
    unit_id = serializers.IntegerField()
    ownership_percentage = serializers.FloatField()
    date_of_ownership = serializers.CharField()
    ownership_transfer_from_id = serializers.IntegerField(required=False, allow_null=True)

    def validate_date_of_ownership(self, value):
        try:
            return datetime.strptime(value, "%d-%b-%Y").date()
        except ValueError:
            raise serializers.ValidationError("Date must be in format DD-MMM-YYYY (e.g., 01-Jan-2025)") 

    def validate_member_id(self, value):
        try:
            return Member.objects.get(id=value)
        except Member.DoesNotExist:
            raise serializers.ValidationError("Member not found.")

    def validate_unit_id(self, value):
        try:
            return Unit.objects.get(id=value)
        except Unit.DoesNotExist:
            raise serializers.ValidationError("Unit not found.")

    def validate_ownership_transfer_from_id(self, value):
        if value in (None, "", "null"):
            return None
        try:
            return Member.objects.get(id=value)
        except Member.DoesNotExist:
            raise serializers.ValidationError("Ownership transfer member not found.")

