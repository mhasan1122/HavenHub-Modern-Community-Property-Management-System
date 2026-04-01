from django.contrib import admin
from .models import BillCategory


@admin.register(BillCategory)
class BillCategoryAdmin(admin.ModelAdmin):
    """
    Admin interface for BillCategory model
    """
    
    list_display = [
        'id',
        'name',
        'icon',
        'color',
        'is_active',
        'created_at',
        'updated_at'
    ]
    
    list_filter = [
        'is_active',
        'icon',
        'color',
        'created_at'
    ]
    
    search_fields = [
        'name',
        'description'
    ]
    
    readonly_fields = [
        'created_at',
        'updated_at'
    ]
    
    fieldsets = (
        ('Basic Information', {
            'fields': ('name', 'description')
        }),
        ('Display Settings', {
            'fields': ('icon', 'color')
        }),
        ('Status', {
            'fields': ('is_active',)
        }),
        ('Timestamps', {
            'fields': ('created_at', 'updated_at'),
            'classes': ('collapse',)
        }),
    )
    
    list_per_page = 25
    
    actions = ['activate_categories', 'deactivate_categories']
    
    def activate_categories(self, request, queryset):
        """
        Custom admin action to activate selected categories
        """
        updated = queryset.update(is_active=True)
        self.message_user(
            request,
            f'{updated} category(ies) activated successfully.'
        )
    activate_categories.short_description = "Activate selected categories"
    
    def deactivate_categories(self, request, queryset):
        """
        Custom admin action to deactivate selected categories
        """
        updated = queryset.update(is_active=False)
        self.message_user(
            request,
            f'{updated} category(ies) deactivated successfully.'
        )
    deactivate_categories.short_description = "Deactivate selected categories"
