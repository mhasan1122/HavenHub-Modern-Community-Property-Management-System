from rest_framework import serializers
from .models import BillCategory


class BillCategorySerializer(serializers.ModelSerializer):
    """
    Serializer for BillCategory model
    Handles conversion between Python objects and JSON for API responses
    """
    
    # Read-only fields for frontend display
    created_at = serializers.DateTimeField(read_only=True, format='%Y-%m-%d')
    updated_at = serializers.DateTimeField(read_only=True, format='%Y-%m-%d')
    
    class Meta:
        model = BillCategory
        fields = [
            'id',
            'name',
            'description',
            'icon',
            'color',
            'is_active',
            'created_at',
            'updated_at'
        ]
        read_only_fields = ['id', 'created_at', 'updated_at']
    
    def validate_name(self, value):
        """
        Validate that the category name is unique (case-insensitive)
        """
        if not value or not value.strip():
            raise serializers.ValidationError("Category name cannot be empty")
        
        # Check for duplicate names (case-insensitive)
        name_lower = value.strip().lower()
        queryset = BillCategory.objects.filter(name__iexact=name_lower)
        
        # Exclude current instance if updating
        if self.instance:
            queryset = queryset.exclude(pk=self.instance.pk)
        
        if queryset.exists():
            raise serializers.ValidationError(
                f"A category with the name '{value}' already exists"
            )
        
        return value.strip()
    
    def validate_description(self, value):
        """
        Validate description - optional field, strip whitespace if provided
        """
        if value:
            return value.strip()
        return value
    
    def validate_icon(self, value):
        """
        Validate that the icon is one of the allowed choices
        """
        valid_icons = [choice[0] for choice in BillCategory.ICON_CHOICES]
        if value not in valid_icons:
            raise serializers.ValidationError(
                f"Invalid icon. Must be one of: {', '.join(valid_icons)}"
            )
        return value
    
    def validate_color(self, value):
        """
        Validate that the color is one of the allowed choices
        """
        valid_colors = [choice[0] for choice in BillCategory.COLOR_CHOICES]
        if value not in valid_colors:
            raise serializers.ValidationError(
                f"Invalid color. Must be one of: {', '.join(valid_colors)}"
            )
        return value
    
    def to_representation(self, instance):
        """
        Customize the output format to match frontend expectations
        """
        data = super().to_representation(instance)
        # Rename fields to match frontend camelCase convention
        data['isActive'] = data.pop('is_active')
        data['createdAt'] = data.pop('created_at')
        data['updatedAt'] = data.pop('updated_at')
        return data
    
    def to_internal_value(self, data):
        """
        Convert camelCase from frontend to snake_case for Django
        """
        # Create a copy to avoid mutating the original
        converted_data = {}
        
        # Map camelCase to snake_case
        field_mapping = {
            'isActive': 'is_active',
        }
        
        for key, value in data.items():
            # Use mapping if exists, otherwise keep original key
            converted_key = field_mapping.get(key, key)
            converted_data[converted_key] = value
        
        return super().to_internal_value(converted_data)


class BillCategoryListSerializer(serializers.ModelSerializer):
    """
    Lightweight serializer for listing bill categories
    Includes optional amount field when service_fee_id is provided
    """
    
    # Read-only fields for frontend display
    created_at = serializers.DateTimeField(read_only=True, format='%Y-%m-%d')
    updated_at = serializers.DateTimeField(read_only=True, format='%Y-%m-%d')
    amount = serializers.FloatField(required=False, allow_null=True)  # Added for service fee context
    
    class Meta:
        model = BillCategory
        fields = ['id', 'name', 'description', 'icon', 'color', 'is_active', 'amount', 'created_at', 'updated_at']
    
    def to_representation(self, instance):
        data = super().to_representation(instance)
        data['isActive'] = data.pop('is_active')
        data['createdAt'] = data.pop('created_at')
        data['updatedAt'] = data.pop('updated_at')
        return data
