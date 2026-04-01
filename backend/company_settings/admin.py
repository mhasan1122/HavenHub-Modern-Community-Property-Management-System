from django.contrib import admin
from .models import CompanySettings, CompanyImage


@admin.register(CompanySettings)
class CompanySettingsAdmin(admin.ModelAdmin):
    list_display = ['company_name', 'company_phone', 'company_email', 'updated_at']
    readonly_fields = ['created_at', 'updated_at']
    
    def has_add_permission(self, request):
        # Only allow one instance
        if CompanySettings.objects.exists():
            return False
        return super().has_add_permission(request)


@admin.register(CompanyImage)
class CompanyImageAdmin(admin.ModelAdmin):
    list_display = ['id', 'image_type', 'image', 'created_at']
    list_filter = ['image_type', 'created_at']
    readonly_fields = ['created_at', 'updated_at']

