from rest_framework import serializers
from django.apps import apps
from .models import Notification, NotificationType, DeviceToken


def get_entity_status_info(notification):
    """
    Helper function to check the status of the related entity
    Returns (status, message)
    status: 'active', 'deleted', 'expired', 'archived', 'unknown'
    message: User friendly message or None if active
    """
    entity_type = notification.entity_type
    entity_id = notification.entity_id
    
    if not entity_type or not entity_id:
        return 'unknown', None

    model = None
    app_label = None
    model_name = None

    if entity_type == 'announcement':
        app_label = 'announcements'
        model_name = 'Announcement'
    elif entity_type == 'notice':
        app_label = 'noticeboard'
        model_name = 'Notice'
    elif entity_type == 'bulletin':
        app_label = 'bulletins'
        model_name = 'Bulletin'
    
    if not app_label or not model_name:
        return 'active', None # Assume active for other types
        
    try:
        model = apps.get_model(app_label, model_name)
        obj = model.objects.get(pk=entity_id)
        
        # Check for expiry/archive status
        if entity_type in ['announcement', 'notice']:
            # Check stored status first
            if hasattr(obj, 'status') and obj.status == 'expired':
                return 'expired', "This content has expired and is no longer active."
            
            # Check for auto-expiry based on date/time
            if hasattr(obj, 'end_date') and hasattr(obj, 'end_time') and obj.end_date and obj.end_time:
                import datetime
                now = datetime.datetime.now()
                end_datetime = datetime.datetime.combine(obj.end_date, obj.end_time)
                if now > end_datetime:
                    return 'expired', "This content has expired and is no longer active."
                    
        elif entity_type == 'bulletin':
             if hasattr(obj, 'status') and obj.status == 'archive':
                return 'archived', "This content has been archived and is no longer active."

        return 'active', None
        
    except LookupError:
        # App or model not found
        return 'unknown', None
    except model.DoesNotExist:
        return 'deleted', "This content is no longer available. It may have been deleted by the administrator."
    except Exception:
        return 'error', "Error checking content status."


class NotificationTypeSerializer(serializers.ModelSerializer):
    """
    Serializer for NotificationType model
    """
    
    class Meta:
        model = NotificationType
        fields = [
            'id',
            'code',
            'name',
            'description',
            'entity_type',
            'icon',
            'is_active',
            'priority'
        ]
        read_only_fields = ['id']


class NotificationSerializer(serializers.ModelSerializer):
    """
    Serializer for Notification model with full details
    """
    notification_type_code = serializers.CharField(
        source='notification_type.code',
        read_only=True
    )
    notification_type_name = serializers.CharField(
        source='notification_type.name',
        read_only=True
    )
    notification_type_icon = serializers.CharField(
        source='notification_type.icon',
        read_only=True,
        allow_null=True
    )
    entity_reference = serializers.CharField(read_only=True)
    priority = serializers.IntegerField(
        source='notification_type.priority',
        read_only=True
    )
    
    entity_status = serializers.SerializerMethodField()
    entity_status_message = serializers.SerializerMethodField()

    def _get_status_info(self, obj):
        if not hasattr(obj, '_entity_status_info'):
            obj._entity_status_info = get_entity_status_info(obj)
        return obj._entity_status_info

    def get_entity_status(self, obj):
        return self._get_status_info(obj)[0]

    def get_entity_status_message(self, obj):
        return self._get_status_info(obj)[1]

    class Meta:
        model = Notification
        fields = [
            'id',
            'notification_type',
            'notification_type_code',
            'notification_type_name',
            'notification_type_icon',
            'entity_type',
            'entity_id',
            'entity_reference',
            'entity_status',
            'entity_status_message',
            'title',
            'message',
            'priority',
            'is_read',
            'metadata',
            'created_at',
            'read_at'
        ]
        read_only_fields = ['id', 'created_at', 'read_at', 'entity_reference']


class NotificationListSerializer(serializers.ModelSerializer):
    """
    Lightweight serializer for notification list view
    """
    notification_type_code = serializers.CharField(
        source='notification_type.code',
        read_only=True
    )
    notification_type_name = serializers.CharField(
        source='notification_type.name',
        read_only=True
    )
    notification_type_icon = serializers.CharField(
        source='notification_type.icon',
        read_only=True,
        allow_null=True
    )
    priority = serializers.IntegerField(
        source='notification_type.priority',
        read_only=True
    )
    
    entity_status = serializers.SerializerMethodField()
    entity_status_message = serializers.SerializerMethodField()

    def _get_status_info(self, obj):
        if not hasattr(obj, '_entity_status_info'):
            obj._entity_status_info = get_entity_status_info(obj)
        return obj._entity_status_info

    def get_entity_status(self, obj):
        return self._get_status_info(obj)[0]

    def get_entity_status_message(self, obj):
        return self._get_status_info(obj)[1]

    class Meta:
        model = Notification
        fields = [
            'id',
            'notification_type_code',
            'notification_type_name',
            'notification_type_icon',
            'entity_type',
            'entity_id',
            'entity_status',
            'entity_status_message',
            'title',
            'message',
            'priority',
            'is_read',
            'metadata',
            'created_at'
        ]
        read_only_fields = ['id', 'created_at']


class DeviceTokenSerializer(serializers.ModelSerializer):
    """
    Serializer for DeviceToken model
    """
    
    class Meta:
        model = DeviceToken
        fields = [
            'id',
            'member',
            'push_token',
            'device_type',
            'device_id',
            'is_active',
            'last_used_at',
            'created_at',
            'updated_at'
        ]
        read_only_fields = ['id', 'created_at', 'updated_at', 'last_used_at']
    
    def validate_push_token(self, value):
        """Validate that push_token is not empty"""
        if not value or not value.strip():
            raise serializers.ValidationError("Push token cannot be empty")
        return value.strip()
