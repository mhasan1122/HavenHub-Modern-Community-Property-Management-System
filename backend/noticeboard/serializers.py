from rest_framework import serializers
from .models import Notice, NoticeAttachment, NoticeHistory
from towers.models import Tower, Unit
from user.models import Member
import datetime


def make_json_serializable(value):
    """
    Convert non-JSON serializable objects to serializable representations
    """
    if isinstance(value, Member):
        return {
            'id': value.id,
            'full_name': value.full_name,
            'email': getattr(value, 'email', None)
        }
    elif isinstance(value, (datetime.datetime, datetime.date, datetime.time)):
        return value.isoformat()
    elif hasattr(value, '__dict__'):
        # For other model instances, return basic representation
        return {
            'id': getattr(value, 'id', None),
            'str': str(value)
        }
    else:
        return value


class NoticeAttachmentSerializer(serializers.ModelSerializer):
    """
    Serializer for notice attachments (images only)
    """
    file_url = serializers.SerializerMethodField()

    class Meta:
        model = NoticeAttachment
        fields = ['id', 'file', 'file_url', 'file_name', 'file_type', 'file_size', 'created_at']
        read_only_fields = ['id', 'created_at', 'file_url']

    def get_file_url(self, obj):
        """
        Get the full URL for the file
        """
        if obj.file:
            request = self.context.get('request')
            if request:
                return request.build_absolute_uri(obj.file.url)
            return obj.file.url
        return None


class TowerSerializer(serializers.ModelSerializer):
    """
    Simple serializer for Tower data
    """
    
    class Meta:
        model = Tower
        fields = ['id', 'tower_name', 'tower_number']


class UnitSerializer(serializers.ModelSerializer):
    """
    Simple serializer for Unit data
    """
    tower_name = serializers.CharField(source='floor.tower.tower_name', read_only=True)

    class Meta:
        model = Unit
        fields = ['id', 'unit_name', 'floor', 'tower_name']


class NoticeHistorySerializer(serializers.ModelSerializer):
    """
    Serializer for notice history
    """
    edited_by_name = serializers.CharField(source='edited_by.full_name', read_only=True)
    changes_display = serializers.SerializerMethodField()

    class Meta:
        model = NoticeHistory
        fields = ['id', 'edited_by', 'edited_by_name', 'edited_at', 'changes', 'changes_display']
        read_only_fields = ['id', 'edited_at']

    def get_changes_display(self, obj):
        """
        Convert changes JSON to a more readable format
        """
        if not obj.changes:
            return {}
        
        # Convert any non-serializable values in changes
        readable_changes = {}
        for field, change_data in obj.changes.items():
            if isinstance(change_data, dict) and 'old' in change_data and 'new' in change_data:
                readable_changes[field] = {
                    'old': make_json_serializable(change_data['old']),
                    'new': make_json_serializable(change_data['new'])
                }
            else:
                readable_changes[field] = make_json_serializable(change_data)
        
        return readable_changes


class NoticeSerializer(serializers.ModelSerializer):
    """
    Full serializer for notice CRUD operations
    """
    creator_name = serializers.CharField(source='creator.full_name', read_only=True)
    creator_photo = serializers.SerializerMethodField()
    member_photo = serializers.SerializerMethodField()
    attachments = serializers.SerializerMethodField()
    target_towers_data = TowerSerializer(source='target_towers', many=True, read_only=True)
    target_units_data = UnitSerializer(source='target_units', many=True, read_only=True)
    history = NoticeHistorySerializer(many=True, read_only=True)
    
    # Write-only fields for creating/updating relationships
    target_tower_ids = serializers.ListField(
        child=serializers.IntegerField(),
        write_only=True,
        required=False
    )
    target_unit_ids = serializers.ListField(
        child=serializers.IntegerField(),
        write_only=True,
        required=False
    )
    
    class Meta:
        model = Notice
        fields = [
            'id', 'internal_title', 'creator', 'creator_name', 'creator_photo', 'member_photo', 'post_as',
            'posted_group', 'posted_member', 'group_name', 'member_name',
            'priority', 'label', 'start_date', 'start_time', 'end_date', 'end_time',
            'status', 'views', 'is_pinned', 'manually_expired', 'created_at', 'updated_at',
            'attachments', 'target_towers_data', 'target_units_data', 'history',
            'target_tower_ids', 'target_unit_ids'
        ]
        read_only_fields = ['id', 'creator', 'status', 'views', 'created_at', 'updated_at']

    def create(self, validated_data):
        # Extract many-to-many data
        target_tower_ids = validated_data.pop('target_tower_ids', [])
        target_unit_ids = validated_data.pop('target_unit_ids', [])
        
        # Create the notice
        notice = Notice.objects.create(**validated_data)
        
        # Set many-to-many relationships
        if target_tower_ids:
            towers = Tower.objects.filter(id__in=target_tower_ids)
            notice.target_towers.set(towers)
        
        if target_unit_ids:
            units = Unit.objects.filter(id__in=target_unit_ids)
            notice.target_units.set(units)
        
        return notice

    def update(self, instance, validated_data):
        # Extract many-to-many data
        target_tower_ids = validated_data.pop('target_tower_ids', None)
        target_unit_ids = validated_data.pop('target_unit_ids', None)
        
        # Track changes for history
        changes = {}
        for field, new_value in validated_data.items():
            old_value = getattr(instance, field)
            if old_value != new_value:
                changes[field] = {
                    'old': make_json_serializable(old_value),
                    'new': make_json_serializable(new_value)
                }
        
        # Update the instance
        for attr, value in validated_data.items():
            setattr(instance, attr, value)
        instance.save()
        
        # Update many-to-many relationships
        if target_tower_ids is not None:
            old_towers = list(instance.target_towers.all())
            towers = Tower.objects.filter(id__in=target_tower_ids)
            instance.target_towers.set(towers)
            new_towers = list(instance.target_towers.all())
            if old_towers != new_towers:
                changes['target_towers'] = {
                    'old': make_json_serializable([str(t) for t in old_towers]),
                    'new': make_json_serializable([str(t) for t in new_towers])
                }
        
        if target_unit_ids is not None:
            old_units = list(instance.target_units.all())
            units = Unit.objects.filter(id__in=target_unit_ids)
            instance.target_units.set(units)
            new_units = list(instance.target_units.all())
            if old_units != new_units:
                changes['target_units'] = {
                    'old': make_json_serializable([str(u) for u in old_units]),
                    'new': make_json_serializable([str(u) for u in new_units])
                }
        
        # Create history entry if there were changes
        if changes:
            # Get the member from the user
            user = self.context['request'].user
            member = getattr(user, 'member', None)
            
            if member:
                NoticeHistory.objects.create(
                    notice=instance,
                    edited_by=member,
                    changes=changes
                )
        
        return instance

    def get_creator_photo(self, obj):
        """
        Get creator's photo URL
        """
        if obj.creator and obj.creator.photo:
            request = self.context.get('request')
            if request:
                return request.build_absolute_uri(obj.creator.photo.url)
            return obj.creator.photo.url
        return None

    def get_member_photo(self, obj):
        """
        Get member's photo URL when posting as member
        """
        if obj.post_as == 'member' and obj.posted_member and obj.posted_member.photo:
            request = self.context.get('request')
            if request:
                return request.build_absolute_uri(obj.posted_member.photo.url)
            return obj.posted_member.photo.url
        return None

    def get_attachments(self, obj):
        """
        Get attachments with proper context for file URLs
        """
        attachments = obj.attachments.all()
        return NoticeAttachmentSerializer(
            attachments,
            many=True,
            context=self.context
        ).data


class NoticeListSerializer(serializers.ModelSerializer):
    """
    Optimized serializer for notice list views - uses prefetched data for performance
    """
    creator_name = serializers.CharField(source='creator.full_name', read_only=True)
    creator_photo = serializers.SerializerMethodField()
    member_photo = serializers.SerializerMethodField()
    attachments = serializers.SerializerMethodField()
    attachment_count = serializers.SerializerMethodField()
    target_towers_count = serializers.SerializerMethodField()
    target_units_count = serializers.SerializerMethodField()
    target_towers_data = serializers.SerializerMethodField()
    target_units_data = serializers.SerializerMethodField()

    class Meta:
        model = Notice
        fields = [
            'id', 'internal_title', 'creator_name', 'creator_photo', 'member_photo', 'post_as', 'group_name', 'member_name',
            'priority', 'label', 'start_date', 'start_time', 'end_date', 'end_time',
            'status', 'views', 'is_pinned', 'manually_expired', 'created_at',
            'attachments', 'attachment_count', 'target_towers_count', 'target_units_count',
            'target_towers_data', 'target_units_data'
        ]

    def get_creator_photo(self, obj):
        """
        Get creator's photo URL
        """
        if obj.creator and obj.creator.photo:
            request = self.context.get('request')
            if request:
                return request.build_absolute_uri(obj.creator.photo.url)
            return obj.creator.photo.url
        return None

    def get_member_photo(self, obj):
        """
        Get member's photo URL when posting as member
        """
        if obj.post_as == 'member' and obj.posted_member and obj.posted_member.photo:
            request = self.context.get('request')
            if request:
                return request.build_absolute_uri(obj.posted_member.photo.url)
            return obj.posted_member.photo.url
        return None

    def get_attachments(self, obj):
        """
        Get attachments efficiently using prefetched data
        """
        # Use prefetched attachments to avoid N+1 queries
        attachments = obj.attachments.all() if hasattr(obj, 'attachments') else []
        # Return lightweight attachment data
        return [{
            'id': att.id,
            'file_url': self.context['request'].build_absolute_uri(att.file.url) if att.file else None,
            'file_name': att.file_name,
            'file_type': att.file_type,
            'file_size': att.file_size
        } for att in attachments]

    def get_attachment_count(self, obj):
        # Use prefetched attachments count to avoid extra query
        return len(obj.attachments.all()) if hasattr(obj, 'attachments') else 0
    
    def get_target_towers_count(self, obj):
        # Use prefetched count to avoid extra query
        return len(obj.target_towers.all()) if hasattr(obj, 'target_towers') else 0
    
    def get_target_units_count(self, obj):
        # Use prefetched count to avoid extra query
        return len(obj.target_units.all()) if hasattr(obj, 'target_units') else 0

    def get_target_towers_data(self, obj):
        """
        Get tower data using prefetched data
        """
        # Use prefetched towers to avoid N+1 queries
        towers = obj.target_towers.all() if hasattr(obj, 'target_towers') else []
        
        # Inline serialization for better performance
        return [
            {
                'id': tower.id,
                'tower_name': tower.tower_name,
                'tower_number': tower.tower_number
            }
            for tower in towers
        ]

    def get_target_units_data(self, obj):
        """
        Get unit data using prefetched data for performance
        """
        # Use prefetched units to avoid N+1 queries
        units = obj.target_units.all() if hasattr(obj, 'target_units') else []
        
        # Inline serialization for better performance
        return [
            {
                'id': unit.id,
                'unit_name': unit.unit_name,
                'tower_id': unit.floor.tower.id if hasattr(unit, 'floor') and unit.floor and unit.floor.tower else None,
                'tower_name': unit.floor.tower.tower_name if hasattr(unit, 'floor') and unit.floor and unit.floor.tower else None
            }
            for unit in units
        ]
