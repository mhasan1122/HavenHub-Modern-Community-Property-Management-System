from django.contrib import admin
from .models import Notice, NoticeAttachment, NoticeHistory


class NoticeAttachmentInline(admin.TabularInline):
    model = NoticeAttachment
    extra = 0
    readonly_fields = ('file_size', 'created_at')


class NoticeHistoryInline(admin.TabularInline):
    model = NoticeHistory
    extra = 0
    readonly_fields = ('edited_by', 'edited_at', 'changes')


@admin.register(Notice)
class NoticeAdmin(admin.ModelAdmin):
    list_display = ('id', 'internal_title', 'creator', 'post_as', 'priority', 'status', 'is_pinned', 'created_at')
    list_filter = ('status', 'priority', 'post_as', 'is_pinned', 'created_at')
    search_fields = ('internal_title', 'creator__full_name', 'group_name', 'member_name')
    readonly_fields = ('created_at', 'updated_at', 'views')
    filter_horizontal = ('target_towers', 'target_units')
    inlines = [NoticeAttachmentInline, NoticeHistoryInline]

    fieldsets = (
        ('Basic Information', {
            'fields': ('internal_title', 'creator', 'priority', 'label')
        }),
        ('Author Information', {
            'fields': ('post_as', 'posted_group', 'posted_member', 'group_name', 'member_name')
        }),
        ('Timing', {
            'fields': ('start_date', 'start_time', 'end_date', 'end_time', 'status', 'manually_expired')
        }),
        ('Targeting', {
            'fields': ('target_towers', 'target_units')
        }),
        ('Metadata', {
            'fields': ('views', 'is_pinned', 'created_at', 'updated_at', 'created_by', 'updated_by')
        }),
    )


@admin.register(NoticeAttachment)
class NoticeAttachmentAdmin(admin.ModelAdmin):
    list_display = ('id', 'notice', 'file_name', 'file_type', 'file_size', 'created_at')
    list_filter = ('file_type', 'created_at')
    search_fields = ('file_name', 'notice__internal_title')
    readonly_fields = ('file_size', 'created_at')


@admin.register(NoticeHistory)
class NoticeHistoryAdmin(admin.ModelAdmin):
    list_display = ('id', 'notice', 'edited_by', 'edited_at')
    list_filter = ('edited_at',)
    search_fields = ('notice__internal_title', 'edited_by__full_name')
    readonly_fields = ('notice', 'edited_by', 'edited_at', 'changes')
