from rest_framework import serializers
from .models import CompanySettings, CompanyImage


class CompanyImageSerializer(serializers.ModelSerializer):
    image_url = serializers.SerializerMethodField()
    is_active = serializers.SerializerMethodField()

    class Meta:
        model = CompanyImage
        fields = [
            'id',
            'image_type',
            'image',
            'image_url',
            'is_active',
            'created_at',
            'updated_at'
        ]
        read_only_fields = ['id', 'created_at', 'updated_at', 'is_active']

    def get_image_url(self, obj):
        """Get the full URL for the image"""
        if obj.image and hasattr(obj.image, 'url'):
            request = self.context.get('request')
            if request:
                return request.build_absolute_uri(obj.image.url)
            return obj.image.url
        return None

    def get_is_active(self, obj):
        """Check if this image is the active one"""
        settings = CompanySettings.get_settings()
        if obj.image_type == 'logo':
            return settings.active_logo_id == obj.id
        elif obj.image_type == 'login_image':
            return settings.active_login_image_id == obj.id
        return False

    def validate_image(self, value):
        """Validate image file size and type"""
        if value:
            max_size = 10 * 1024 * 1024  # 10MB
            if hasattr(value, 'size') and value.size > max_size:
                raise serializers.ValidationError("Image size must be less than 10MB.")
            valid_types = ['image/jpeg', 'image/jpg', 'image/png', 'image/svg+xml', 'image/webp']
            if hasattr(value, 'content_type') and value.content_type not in valid_types:
                raise serializers.ValidationError("Only JPG, JPEG, PNG, SVG, and WEBP files are allowed.")
        return value


class CompanySettingsSerializer(serializers.ModelSerializer):
    logo_url = serializers.SerializerMethodField()
    login_page_image_url = serializers.SerializerMethodField()

    class Meta:
        model = CompanySettings
        fields = [
            'id',
            'logo_url',
            'login_page_image_url',
            'company_name',
            'company_phone',
            'company_email',
            'company_address',
            'created_at',
            'updated_at'
        ]
        read_only_fields = ['id', 'created_at', 'updated_at']

    def get_logo_url(self, obj):
        """Get the full URL for the active logo"""
        if obj.active_logo and obj.active_logo.image:
            request = self.context.get('request')
            if request:
                return request.build_absolute_uri(obj.active_logo.image.url)
            return obj.active_logo.image.url
        return None

    def get_login_page_image_url(self, obj):
        """Get the full URL for the active login page image"""
        if obj.active_login_image and obj.active_login_image.image:
            request = self.context.get('request')
            if request:
                return request.build_absolute_uri(obj.active_login_image.image.url)
            return obj.active_login_image.image.url
        return None

    def validate_company_name(self, value):
        """Allow empty string for company_name"""
        if value is None:
            return ""
        return value.strip() if isinstance(value, str) else value