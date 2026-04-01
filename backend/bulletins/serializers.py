from rest_framework import serializers
from .models import Bulletin, BulletinAttachment, BulletinHistory, BulletinReport
from user.models import Member
from group_role.models import Group
from towers.models import Tower, Unit


class BulletinAttachmentSerializer(serializers.ModelSerializer):
    """
    Serializer for bulletin attachments
    """
    file_url = serializers.SerializerMethodField()

    class Meta:
        model = BulletinAttachment
        fields = ['id', 'file', 'file_url', 'file_name', 'file_type', 'file_size', 'created_at']

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


class BulletinHistorySerializer(serializers.ModelSerializer):
    """
    Serializer for bulletin history with comments and approval workflow
    """
    edited_by_name = serializers.CharField(source='edited_by.full_name', read_only=True)
    comment = serializers.CharField(required=False, allow_blank=True)

    class Meta:
        model = BulletinHistory
        fields = ['id', 'edited_by', 'edited_by_name', 'edited_at', 'changes', 'comment', 'action']

    def validate_comment(self, value):
        """
        Validate that comment does not exceed 50 words
        """
        if value and value.strip():
            word_count = len(value.strip().split())
            if word_count > 50:
                raise serializers.ValidationError(
                    f"Comment cannot exceed 50 words. Current word count: {word_count}"
                )
        return value


class BulletinSerializer(serializers.ModelSerializer):
    """
    Main serializer for bulletins
    """
    creator_name = serializers.CharField(source='creator.full_name', read_only=True)
    creator_photo = serializers.SerializerMethodField()
    member_photo = serializers.SerializerMethodField()
    creator_is_admin = serializers.SerializerMethodField()
    group_name = serializers.CharField(read_only=True)
    member_name = serializers.CharField(read_only=True)
    attachments = BulletinAttachmentSerializer(many=True, read_only=True)
    history = BulletinHistorySerializer(many=True, read_only=True)
    
    # For targeting
    target_towers_data = serializers.SerializerMethodField()
    target_units_data = serializers.SerializerMethodField()
    
    # Write-only fields for creating/updating
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
        model = Bulletin
        fields = [
            'id', 'title', 'description', 'creator', 'creator_name', 'creator_photo', 'member_photo', 'creator_is_admin', 'post_as',
            'posted_group', 'posted_member', 'group_name', 'member_name',
            'priority', 'label', 'status', 'views', 'is_pinned', 'created_at', 'updated_at',
            'attachments', 'target_towers_data', 'target_units_data', 'history',
            'target_tower_ids', 'target_unit_ids'
        ]
        read_only_fields = ['id', 'creator', 'views', 'created_at', 'updated_at']

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

    def get_creator_is_admin(self, obj):
        """
        Determine if the bulletin creator is an admin/organizational member
        """
        if obj.creator:
            return obj.creator.is_org_member
        return False

    def get_target_towers_data(self, obj):
        """
        Get tower data for the bulletin
        """
        towers = obj.target_towers.all()
        return [{'id': tower.id, 'tower_name': tower.tower_name, 'tower_number': tower.tower_number} for tower in towers]

    def get_target_units_data(self, obj):
        """
        Get unit data for the bulletin
        """
        units = obj.target_units.all()
        return [{'id': unit.id, 'unit_name': unit.unit_name, 'tower_name': unit.floor.tower.tower_name} for unit in units]

    def validate_label(self, value):
        """
        Validate that label field is not empty or whitespace-only
        """
        if not value or not value.strip():
            raise serializers.ValidationError("At least one label is required")
        return value

    def create(self, validated_data):
        """
        Create a new bulletin with tower and unit targeting
        """
        # Extract targeting data
        target_tower_ids = validated_data.pop('target_tower_ids', [])
        target_unit_ids = validated_data.pop('target_unit_ids', [])
        
        # Handle post_as logic
        post_as = validated_data.get('post_as', 'creator')
        if post_as == 'group':
            # Ensure posted_group is set and posted_member is None
            if not validated_data.get('posted_group'):
                raise serializers.ValidationError({'posted_group': 'Group is required when posting as a group'})
            # Store group name
            validated_data['group_name'] = validated_data['posted_group'].group_name
            validated_data['posted_member'] = None
            validated_data['member_name'] = None
        elif post_as == 'member':
            # Ensure posted_member is set and posted_group is None
            if not validated_data.get('posted_member'):
                raise serializers.ValidationError({'posted_member': 'Member is required when posting as a member'})
            # Store member name
            validated_data['member_name'] = validated_data['posted_member'].full_name
            validated_data['posted_group'] = None
            validated_data['group_name'] = None
        else:  # creator
            # Clear both group and member when posting as creator
            validated_data['posted_group'] = None
            validated_data['posted_member'] = None
            validated_data['group_name'] = None
            validated_data['member_name'] = None
        
        # Create the bulletin
        bulletin = Bulletin.objects.create(**validated_data)
        
        # Set targeting relationships
        # IMPORTANT: Always set M2M relationships, even for empty arrays
        # This ensures proper targeting logic (e.g., tower-only bulletins)
        if target_tower_ids is not None:
            towers = Tower.objects.filter(id__in=target_tower_ids)
            bulletin.target_towers.set(towers)
        
        if target_unit_ids is not None:
            units = Unit.objects.filter(id__in=target_unit_ids)
            bulletin.target_units.set(units)
        
        return bulletin

    def update(self, instance, validated_data):
        """
        Update an existing bulletin
        """
        # Extract targeting data
        target_tower_ids = validated_data.pop('target_tower_ids', None)
        target_unit_ids = validated_data.pop('target_unit_ids', None)

        # Handle post_as logic
        post_as = validated_data.get('post_as', instance.post_as)
        if post_as == 'group':
            # Ensure posted_group is set and posted_member is None
            if not validated_data.get('posted_group'):
                raise serializers.ValidationError({'posted_group': 'Group is required when posting as a group'})
            # Store group name
            validated_data['group_name'] = validated_data['posted_group'].group_name
            validated_data['posted_member'] = None
            validated_data['member_name'] = None
        elif post_as == 'member':
            # Ensure posted_member is set and posted_group is None
            if not validated_data.get('posted_member'):
                raise serializers.ValidationError({'posted_member': 'Member is required when posting as a member'})
            # Store member name
            validated_data['member_name'] = validated_data['posted_member'].full_name
            validated_data['posted_group'] = None
            validated_data['group_name'] = None
        else:  # creator
            # Clear both group and member when posting as creator
            validated_data['posted_group'] = None
            validated_data['posted_member'] = None
            validated_data['group_name'] = None
            validated_data['member_name'] = None

        # Update the bulletin fields
        for attr, value in validated_data.items():
            setattr(instance, attr, value)

        # Update targeting relationships before saving to avoid multiple saves
        if target_tower_ids is not None:
            towers = Tower.objects.filter(id__in=target_tower_ids)
            instance.target_towers.set(towers)

        if target_unit_ids is not None:
            units = Unit.objects.filter(id__in=target_unit_ids)
            instance.target_units.set(units)

        # Save only once after all changes are made
        instance.save()

        return instance


class BulletinListSerializer(serializers.ModelSerializer):
    """
    Simplified serializer for bulletin lists - optimized for performance
    """
    creator = serializers.IntegerField(source='creator.id', read_only=True)  # Add creator ID for permission checks
    creator_name = serializers.CharField(source='creator.full_name', read_only=True)
    creator_photo = serializers.SerializerMethodField()
    member_photo = serializers.SerializerMethodField()
    creator_is_admin = serializers.SerializerMethodField()
    group_name = serializers.CharField(read_only=True)
    member_name = serializers.CharField(read_only=True)
    attachments = serializers.SerializerMethodField()
    attachment_count = serializers.SerializerMethodField()
    target_towers_count = serializers.SerializerMethodField()
    target_units_count = serializers.SerializerMethodField()
    target_towers_data = serializers.SerializerMethodField()
    target_units_data = serializers.SerializerMethodField()

    class Meta:
        model = Bulletin
        fields = [
            'id', 'title', 'description', 'creator', 'creator_name', 'creator_photo', 'member_photo', 'creator_is_admin', 'post_as',
            'posted_group', 'posted_member', 'group_name', 'member_name', 'priority', 'label', 'status', 'views', 'is_pinned', 'created_at',
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

    def get_creator_is_admin(self, obj):
        """
        Determine if the bulletin creator is an admin/organizational member
        """
        if obj.creator:
            return obj.creator.is_org_member
        return False

    def get_attachments(self, obj):
        """
        Get attachments with proper context for file URLs - use prefetched data
        """
        # Use prefetched attachments to avoid N+1 queries
        attachments = obj.attachments.all() if hasattr(obj, 'attachments') else []
        return BulletinAttachmentSerializer(
            attachments,
            many=True,
            context=self.context
        ).data

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
        Get tower data for the bulletin - use prefetched data
        """
        # Use prefetched towers to avoid N+1 queries
        towers = obj.target_towers.all() if hasattr(obj, 'target_towers') else []
        
        # Inline serialization for better performance
        return [
            {
                'id': tower.id,
                'name': tower.tower_name,
                'tower_name': tower.tower_name,
                'tower_number': tower.tower_number
            }
            for tower in towers
        ]

    def get_target_units_data(self, obj):
        """
        Get unit data for the bulletin - use prefetched data for performance
        Inline minimal serialization to avoid overhead
        """
        # Use prefetched units to avoid N+1 queries
        units = obj.target_units.all() if hasattr(obj, 'target_units') else []
        
        # Inline serialization for better performance
        return [
            {
                'id': unit.id,
                'unit_name': unit.unit_name,
                'unit_number': unit.unit_name,
                'tower_id': unit.floor.tower.id if hasattr(unit, 'floor') and unit.floor and unit.floor.tower else None,
                'tower_name': unit.floor.tower.tower_name if hasattr(unit, 'floor') and unit.floor and unit.floor.tower else None
            }
            for unit in units
        ]


class BulletinReportSerializer(serializers.ModelSerializer):
    """
    Serializer for bulletin reports submitted by community members
    """
    reported_by_name = serializers.CharField(source='reported_by.full_name', read_only=True)
    bulletin_title = serializers.CharField(source='bulletin.title', read_only=True)
    reason_display = serializers.CharField(source='get_reason_display', read_only=True)

    class Meta:
        model = BulletinReport
        fields = [
            'id', 'bulletin', 'bulletin_title', 'reported_by', 'reported_by_name',
            'reason', 'reason_display', 'details', 'status', 'created_at', 'updated_at'
        ]
        read_only_fields = ['id', 'reported_by', 'status', 'created_at', 'updated_at']

    def validate_reason(self, value):
        """
        Validate that reason is one of the allowed choices
        """
        valid_reasons = [choice[0] for choice in BulletinReport.REPORT_REASON_CHOICES]
        if value not in valid_reasons:
            raise serializers.ValidationError(f"Invalid reason. Must be one of: {', '.join(valid_reasons)}")
        return value

    def validate_details(self, value):
        """
        Validate details length (optional field)
        """
        if value and len(value) > 1000:
            raise serializers.ValidationError("Details cannot exceed 1000 characters")
        return value
