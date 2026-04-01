from django.contrib import admin
from .models import Announcement, AnnouncementAttachment, AnnouncementHistory


@admin.register(Announcement)
class AnnouncementAdmin(admin.ModelAdmin):
    list_display = ['title', 'creator', 'priority', 'label', 'status', 'start_date', 'end_date', 'is_pinned', 'views']
    list_filter = ['status', 'priority', 'label', 'is_pinned', 'created_at']
    search_fields = ['title', 'description', 'creator__full_name']
    readonly_fields = ['status', 'views', 'created_at', 'updated_at']
    filter_horizontal = ['target_towers', 'target_units']


@admin.register(AnnouncementAttachment)
class AnnouncementAttachmentAdmin(admin.ModelAdmin):
    list_display = ['announcement', 'file_name', 'file_type', 'file_size', 'created_at']
    list_filter = ['file_type', 'created_at']
    search_fields = ['file_name', 'announcement__title']


@admin.register(AnnouncementHistory)
class AnnouncementHistoryAdmin(admin.ModelAdmin):
    list_display = ['announcement', 'edited_by', 'edited_at']
    list_filter = ['edited_at']
    search_fields = ['announcement__title', 'edited_by__full_name']
    readonly_fields = ['edited_at']
