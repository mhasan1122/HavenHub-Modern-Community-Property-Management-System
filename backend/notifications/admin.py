from django.contrib import admin
from .models import Notification, NotificationType, DeviceToken


@admin.register(NotificationType)
class NotificationTypeAdmin(admin.ModelAdmin):
    list_display = ['code', 'name', 'entity_type', 'is_active', 'priority', 'created_at']
    list_filter = ['entity_type', 'is_active', 'created_at']
    search_fields = ['code', 'name', 'description']
    readonly_fields = ['created_at', 'updated_at']
    ordering = ['-priority', 'name']
    fieldsets = (
        ('Basic Information', {
            'fields': ('code', 'name', 'description', 'entity_type')
        }),
        ('Display', {
            'fields': ('icon', 'priority')
        }),
        ('Status', {
            'fields': ('is_active',)
        }),
        ('Timestamps', {
            'fields': ('created_at', 'updated_at'),
            'classes': ('collapse',)
        }),
    )


@admin.register(Notification)
class NotificationAdmin(admin.ModelAdmin):
    list_display = ['id', 'recipient', 'notification_type', 'entity_type', 'entity_id', 'title', 'is_read', 'created_at']
    list_filter = ['notification_type', 'entity_type', 'is_read', 'created_at']
    search_fields = ['recipient__full_name', 'title', 'message', 'entity_type']
    readonly_fields = ['created_at', 'read_at', 'entity_reference']
    ordering = ['-created_at']
    fieldsets = (
        ('Recipient', {
            'fields': ('recipient',)
        }),
        ('Notification Type', {
            'fields': ('notification_type',)
        }),
        ('Entity Reference', {
            'fields': ('entity_type', 'entity_id', 'entity_reference')
        }),
        ('Content', {
            'fields': ('title', 'message', 'metadata')
        }),
        ('Status', {
            'fields': ('is_read', 'read_at')
        }),
        ('Timestamps', {
            'fields': ('created_at',),
            'classes': ('collapse',)
        }),
    )


@admin.register(DeviceToken)
class DeviceTokenAdmin(admin.ModelAdmin):
    list_display = ['id', 'member', 'device_type', 'device_id', 'is_active', 'created_at', 'last_used_at']
    list_filter = ['device_type', 'is_active', 'created_at']
    search_fields = ['member__full_name', 'push_token', 'device_id']
    readonly_fields = ['created_at', 'updated_at']
    ordering = ['-created_at']
    fieldsets = (
        ('Member', {
            'fields': ('member',)
        }),
        ('Device Information', {
            'fields': ('push_token', 'device_type', 'device_id')
        }),
        ('Status', {
            'fields': ('is_active', 'last_used_at')
        }),
        ('Timestamps', {
            'fields': ('created_at', 'updated_at'),
            'classes': ('collapse',)
        }),
    )
