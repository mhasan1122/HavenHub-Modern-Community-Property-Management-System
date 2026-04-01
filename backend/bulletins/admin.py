from django.contrib import admin
from .models import Bulletin, BulletinAttachment, BulletinHistory, BulletinReport


@admin.register(Bulletin)
class BulletinAdmin(admin.ModelAdmin):
    list_display = ('title', 'creator', 'status', 'priority', 'created_at')
    list_filter = ('status', 'priority', 'created_at')
    search_fields = ('title', 'description', 'creator__full_name')
    readonly_fields = ('created_at', 'updated_at')


@admin.register(BulletinAttachment)
class BulletinAttachmentAdmin(admin.ModelAdmin):
    list_display = ('bulletin', 'file_name', 'file_type', 'file_size', 'created_at')
    list_filter = ('file_type', 'created_at')
    search_fields = ('bulletin__title', 'file_name')


@admin.register(BulletinHistory)
class BulletinHistoryAdmin(admin.ModelAdmin):
    list_display = ('bulletin', 'edited_by', 'action', 'edited_at')
    list_filter = ('action', 'edited_at')
    search_fields = ('bulletin__title', 'edited_by__full_name')
    readonly_fields = ('edited_at',)


@admin.register(BulletinReport)
class BulletinReportAdmin(admin.ModelAdmin):
    list_display = ('bulletin', 'reported_by', 'reason', 'status', 'created_at')
    list_filter = ('reason', 'status', 'created_at')
    search_fields = ('bulletin__title', 'reported_by__full_name', 'details')
    readonly_fields = ('created_at', 'updated_at')
    actions = ['mark_as_reviewed', 'mark_as_resolved', 'mark_as_dismissed']

    def mark_as_reviewed(self, request, queryset):
        queryset.update(status='reviewed')
    mark_as_reviewed.short_description = "Mark selected reports as reviewed"

    def mark_as_resolved(self, request, queryset):
        queryset.update(status='resolved')
    mark_as_resolved.short_description = "Mark selected reports as resolved"

    def mark_as_dismissed(self, request, queryset):
        queryset.update(status='dismissed')
    mark_as_dismissed.short_description = "Mark selected reports as dismissed"
