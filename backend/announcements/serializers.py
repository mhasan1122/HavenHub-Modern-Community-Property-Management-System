from rest_framework import serializers
from .models import Announcement, AnnouncementAttachment, AnnouncementHistory
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


class AnnouncementAttachmentSerializer(serializers.ModelSerializer):
    """
    Serializer for announcement attachments
    """
    file_url = serializers.SerializerMethodField()

    class Meta:
        model = AnnouncementAttachment
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
    Simple serializer for Unit data with tower information
    """
    tower_name = serializers.CharField(source='floor.tower.tower_name', read_only=True)
    tower_id = serializers.IntegerField(source='floor.tower.id', read_only=True)
    
    class Meta:
        model = Unit
        fields = ['id', 'unit_name', 'tower_id', 'tower_name']


class MemberSerializer(serializers.ModelSerializer):
    """
    Simple serializer for Member data
    """
    
    class Meta:
        model = Member
        fields = ['id', 'full_name', 'email', 'phone_number']


class AnnouncementHistorySerializer(serializers.ModelSerializer):
    """
    Serializer for announcement edit history
    """
    edited_by_name = serializers.CharField(source='edited_by.full_name', read_only=True)
    
    class Meta:
        model = AnnouncementHistory
        fields = ['id', 'edited_by', 'edited_by_name', 'edited_at', 'changes']
        read_only_fields = ['id', 'edited_at']


class AnnouncementSerializer(serializers.ModelSerializer):
    """
    Main serializer for Announcement model
    """
    attachments = serializers.SerializerMethodField()
    creator_name = serializers.CharField(source='creator.full_name', read_only=True)
    creator_photo = serializers.SerializerMethodField()
    member_photo = serializers.SerializerMethodField()
    target_towers_data = TowerSerializer(source='target_towers', many=True, read_only=True)
    target_units_data = UnitSerializer(source='target_units', many=True, read_only=True)
    history = AnnouncementHistorySerializer(many=True, read_only=True)
    status = serializers.SerializerMethodField()
    relative_time = serializers.SerializerMethodField()

    # Override label field to accept any custom text
    label = serializers.CharField(max_length=500, required=False, allow_blank=True)

    # For write operations
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
        model = Announcement
        fields = [
            'id', 'title', 'description', 'creator', 'creator_name', 'creator_photo', 'member_photo', 'post_as',
            'posted_group', 'posted_member', 'group_name', 'member_name',
            'priority', 'label', 'start_date', 'start_time', 'end_date', 'end_time',
            'status', 'relative_time', 'views', 'is_pinned', 'manually_expired', 'created_at', 'updated_at',
            'attachments', 'target_towers_data', 'target_units_data', 'history',
            'target_tower_ids', 'target_unit_ids'
        ]
        read_only_fields = ['id', 'creator', 'status', 'views', 'created_at', 'updated_at']
    
    def create(self, validated_data):
        # Extract tower and unit IDs
        target_tower_ids = validated_data.pop('target_tower_ids', [])
        target_unit_ids = validated_data.pop('target_unit_ids', [])
        
        # Set creator from request user
        request = self.context.get('request')
        if request and hasattr(request, 'user'):
            validated_data['creator'] = request.user.member
            validated_data['created_by'] = request.user.member

        # Handle post_as logic
        post_as = validated_data.get('post_as')
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
        
        # Create announcement
        announcement = Announcement.objects.create(**validated_data)
        
        # Set many-to-many relationships
        # IMPORTANT: Always set M2M relationships, even for empty arrays
        # This ensures proper targeting logic (e.g., tower-only announcements)
        if target_tower_ids is not None:
            towers = Tower.objects.filter(id__in=target_tower_ids)
            announcement.target_towers.set(towers)
        
        if target_unit_ids is not None:
            units = Unit.objects.filter(id__in=target_unit_ids)
            announcement.target_units.set(units)
        
        return announcement
    
    def update(self, instance, validated_data):
        # Extract tower and unit IDs
        target_tower_ids = validated_data.pop('target_tower_ids', None)
        target_unit_ids = validated_data.pop('target_unit_ids', None)

        # Handle post_as logic (same as create method)
        post_as = validated_data.get('post_as')
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

        # Track changes for history
        changes = {}
        print(f"DEBUG: validated_data for update: {validated_data}")
        for field, value in validated_data.items():
            if not hasattr(instance, field):
                continue
            old_value = getattr(instance, field)
            print(f"DEBUG: field='{field}', old='{old_value}' ({type(old_value)}), new='{value}' ({type(value)})")
            if old_value != value:
                print(f"DEBUG: CHANGE DETECTED for '{field}'")
                changes[field] = {
                    'old': make_json_serializable(old_value),
                    'new': make_json_serializable(value)
                }

        # Update announcement
        for field, value in validated_data.items():
            setattr(instance, field, value)
        
        # Set updated_by
        request = self.context.get('request')
        if request and hasattr(request, 'user'):
            instance.updated_by = request.user.member
        
        instance.save()
        
        # Update many-to-many relationships
        if target_tower_ids is not None:
            # Get old tower IDs for change tracking
            old_tower_ids = list(instance.target_towers.values_list('id', flat=True))
            towers = Tower.objects.filter(id__in=target_tower_ids)
            instance.target_towers.set(towers)
            print(f"DEBUG: towers old={old_tower_ids}, new={target_tower_ids}")
            if set(old_tower_ids) != set(target_tower_ids):
                print("DEBUG: CHANGE DETECTED for target_towers")
                changes['target_towers'] = {
                    'old': old_tower_ids,
                    'new': target_tower_ids
                }

        if target_unit_ids is not None:
            # Get old unit IDs for change tracking
            old_unit_ids = list(instance.target_units.values_list('id', flat=True))
            units = Unit.objects.filter(id__in=target_unit_ids)
            instance.target_units.set(units)
            print(f"DEBUG: units old={old_unit_ids}, new={target_unit_ids}")
            if set(old_unit_ids) != set(target_unit_ids):
                print("DEBUG: CHANGE DETECTED for target_units")
                changes['target_units'] = {
                    'old': old_unit_ids,
                    'new': target_unit_ids
                }
        
        # Create history record if there were changes
        print(f"DEBUG: Final changes dict: {changes}")
        if changes and request and hasattr(request, 'user'):
            print(f"DEBUG: CREATING HISTORY RECORD for announcement {instance.id}")
            AnnouncementHistory.objects.create(
                announcement=instance,
                edited_by=request.user.member,
                changes=changes
            )
        
        return instance

    def get_attachments(self, obj):
        """
        Get attachments with proper context for file URLs
        """
        attachments = obj.attachments.all()
        return AnnouncementAttachmentSerializer(
            attachments,
            many=True,
            context=self.context
        ).data

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

    def get_status(self, obj):
        """
        Calculate and return the real-time status based on current date/time
        """
        import datetime
        
        # Use timezone-naive datetime since USE_TZ = False in settings
        now = datetime.datetime.now()
        
        # Combine date and time for comparison
        start_datetime = datetime.datetime.combine(obj.start_date, obj.start_time)
        end_datetime = datetime.datetime.combine(obj.end_date, obj.end_time)
        
        # If manually expired and the actual end time hasn't passed yet, keep it expired
        if obj.manually_expired and now <= end_datetime:
            return 'expired'
        
        # Otherwise, use normal date-based logic
        if now < start_datetime:
            return 'upcoming'
        elif start_datetime <= now <= end_datetime:
            return 'ongoing'
        else:
            return 'expired'

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

    def get_relative_time(self, obj):
        """
        Get relative time display (Today, Tomorrow, or actual date)
        """
        import datetime
        
        if not obj.start_date:
            return None
        
        # Use timezone-naive datetime since USE_TZ = False in settings
        now = datetime.datetime.now().date()
        start_date = obj.start_date
        
        # Calculate difference in days
        delta = (start_date - now).days
        
        if delta == 0:
            return 'Today'
        elif delta == 1:
            return 'Tomorrow'
        elif delta == -1:
            return 'Yesterday'
        elif delta > 1 and delta <= 7:
            # Return day name for next week
            return start_date.strftime('%A')  # e.g., 'Monday', 'Tuesday'
        elif delta < 0:
            # Past dates - return formatted date
            return start_date.strftime('%B %d')  # e.g., 'December 1'
        else:
            # Future dates beyond a week
            return start_date.strftime('%B %d')  # e.g., 'December 15'


class AnnouncementListSerializer(serializers.ModelSerializer):
    """
    Simplified serializer for announcement list views - excludes history for performance
    """
    creator_name = serializers.CharField(source='creator.full_name', read_only=True)
    creator_photo = serializers.SerializerMethodField()
    member_photo = serializers.SerializerMethodField()
    attachments = serializers.SerializerMethodField()
    attachment_count = serializers.SerializerMethodField()
    target_towers_count = serializers.SerializerMethodField()
    target_units_count = serializers.SerializerMethodField()
    target_units_data = serializers.SerializerMethodField()
    status = serializers.SerializerMethodField()
    relative_time = serializers.SerializerMethodField()

    class Meta:
        model = Announcement
        fields = [
            'id', 'title', 'description', 'creator_name', 'creator_photo', 'member_photo', 'post_as',
            'priority', 'label', 'start_date', 'start_time', 'end_date', 'end_time',
            'status', 'relative_time', 'views', 'is_pinned', 'manually_expired', 'created_at',
            'attachments', 'attachment_count', 'target_towers_count', 'target_units_count',
            'target_units_data', 'group_name', 'member_name'
        ]

    def get_attachments(self, obj):
        """
        Get attachments with proper context for file URLs - use prefetched data
        """
        # Use prefetched attachments to avoid N+1 queries
        attachments = obj.attachments.all() if hasattr(obj, 'attachments') else []
        return AnnouncementAttachmentSerializer(
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
        """
        Get target units count. For global announcements (no towers/units),
        return 0 to indicate org-only targeting (not counting community members).
        """
        target_units = list(obj.target_units.all()) if hasattr(obj, 'target_units') else []
        target_towers = list(obj.target_towers.all()) if hasattr(obj, 'target_towers') else []
        
        # RULE 1: No towers AND no units = global announcement for org members only
        # Return 0 to show this is not targeted at community members
        if not target_towers and not target_units:
            return 0
        
        # RULE 3: Only towers selected → count all units from those towers
        if target_towers and not target_units:
            return Unit.objects.filter(floor__tower__in=target_towers).count()
        
        # RULE 2 & 4: Units are selected
        return len(target_units)

    def get_target_units_data(self, obj):
        """
        Get target units data - use prefetched data for performance.
        For global announcements (no towers/units), return empty array to show 0 user count.
        When "all tower" is selected (towers only, no specific units), return empty to show 0 -
        no need for user count when broadcasting to all towers.
        For targeted announcements with specific units, return units for user count calculation.
        """
        # Use prefetched units to avoid N+1 queries
        target_units = list(obj.target_units.all()) if hasattr(obj, 'target_units') else []
        target_towers = list(obj.target_towers.all()) if hasattr(obj, 'target_towers') else []

        # RULE 1: No towers AND no units = global announcement for org members only
        # Return empty array so frontend shows 0 user count (not community members)
        if not target_towers and not target_units:
            return []
        
        # RULE 3: Only towers selected (no specific units) = "all tower" broadcast
        # Return empty array - no need for user count when targeting all towers
        if target_towers and not target_units:
            return []
        
        # RULE 2 & 4: Units are selected (with or without towers) - show user count
        units = target_units

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

    def get_relative_time(self, obj):
        """
        Get relative time display (Today, Tomorrow, or actual date)
        """
        import datetime
        
        if not obj.start_date:
            return None
        
        # Use timezone-naive datetime since USE_TZ = False in settings
        now = datetime.datetime.now().date()
        start_date = obj.start_date
        
        # Calculate difference in days
        delta = (start_date - now).days
        
        if delta == 0:
            return 'Today'
        elif delta == 1:
            return 'Tomorrow'
        elif delta == -1:
            return 'Yesterday'
        elif delta > 1 and delta <= 7:
            # Return day name for next week
            return start_date.strftime('%A')  # e.g., 'Monday', 'Tuesday'
        elif delta < 0:
            # Past dates - return formatted date
            return start_date.strftime('%B %d')  # e.g., 'December 1'
        else:
            # Future dates beyond a week
            return start_date.strftime('%B %d')  # e.g., 'December 15'

    def get_status(self, obj):
        """
        Calculate and return the real-time status based on current date/time
        """
        import datetime
        
        # Use timezone-naive datetime since USE_TZ = False in settings
        now = datetime.datetime.now()
        
        # Combine date and time for comparison
        start_datetime = datetime.datetime.combine(obj.start_date, obj.start_time)
        end_datetime = datetime.datetime.combine(obj.end_date, obj.end_time)
        
        # If manually expired and the actual end time hasn't passed yet, keep it expired
        if obj.manually_expired and now <= end_datetime:
            return 'expired'
        
        # Otherwise, use normal date-based logic
        if now < start_datetime:
            return 'upcoming'
        elif start_datetime <= now <= end_datetime:
            return 'ongoing'
        else:
            return 'expired'
