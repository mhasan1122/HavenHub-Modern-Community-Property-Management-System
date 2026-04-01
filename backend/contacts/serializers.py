from rest_framework import serializers

from .models import ImportantContact
from user.models import Member


class ImportantContactSerializer(serializers.ModelSerializer):
    """
    Serializer for ImportantContact model.
    All contact data is pulled from the org_member relationship.
    """
    # Read-only fields pulled from org_member
    name = serializers.SerializerMethodField(read_only=True)
    phone_number = serializers.SerializerMethodField(read_only=True)
    email = serializers.SerializerMethodField(read_only=True)
    designation = serializers.SerializerMethodField(read_only=True)
    photo_url = serializers.SerializerMethodField(read_only=True)
    
    # Org member field (required for creation)
    org_member = serializers.PrimaryKeyRelatedField(
        queryset=Member.objects.filter(is_org_member=True),
        required=True,
        allow_null=False,
        help_text="Organization member ID (required - must be an org member)"
    )
    org_member_name = serializers.SerializerMethodField(read_only=True)
    
    # Audit fields
    created_by = serializers.PrimaryKeyRelatedField(read_only=True)
    created_by_name = serializers.SerializerMethodField(read_only=True)

    class Meta:
        model = ImportantContact
        fields = (
            "id",
            "org_member",
            "org_member_name",
            "name",
            "phone_number",
            "email",
            "designation",
            "photo_url",
            "created_at",
            "updated_at",
            "created_by",
            "created_by_name",
        )
        read_only_fields = (
            "id",
            "name",
            "phone_number",
            "email",
            "designation",
            "photo_url",
            "org_member_name",
            "created_at",
            "updated_at",
            "created_by",
            "created_by_name",
        )

    def get_name(self, obj):
        """Get name from org_member"""
        return obj.name

    def get_phone_number(self, obj):
        """Get phone number from org_member"""
        return obj.phone_number

    def get_email(self, obj):
        """Get email from org_member"""
        return obj.email

    def get_designation(self, obj):
        """Get designation from org_member"""
        return obj.designation

    def get_photo_url(self, obj):
        """Get photo URL from org_member"""
        if obj.photo_url:
            request = self.context.get('request')
            if request:
                return request.build_absolute_uri(obj.photo_url)
            return obj.photo_url
        return None

    def get_org_member_name(self, obj):
        """Get org member's full name"""
        if obj.org_member_id:
            return obj.org_member.full_name
        return None

    def get_created_by_name(self, obj):
        """Get creator's full name"""
        if obj.created_by_id:
            return obj.created_by.full_name
        return None

    def validate_org_member(self, value):
        """Validate that the selected member is an organization member and not already added"""
        if value is None:
            raise serializers.ValidationError(
                "An organization member must be selected. Only organization members can be added as important contacts."
            )
        
        if not value.is_org_member:
            raise serializers.ValidationError(
                "Only organization members can be added as important contacts."
            )
        
        # Check for duplicate entry - exclude current instance if updating
        instance = self.instance
        existing_contact = ImportantContact.objects.filter(org_member=value).exclude(
            pk=instance.pk if instance else None
        ).first()
        
        if existing_contact:
            raise serializers.ValidationError(
                f"This member ({value.full_name}) is already added as an important contact."
            )
        
        return value

