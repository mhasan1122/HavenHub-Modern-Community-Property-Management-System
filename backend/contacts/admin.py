from django.contrib import admin

from .models import ImportantContact


@admin.register(ImportantContact)
class ImportantContactAdmin(admin.ModelAdmin):
    list_display = (
        "org_member",
        "get_name",
        "get_designation",
        "get_phone_number",
        "get_email",
        "created_at",
        "created_by",
    )
    search_fields = (
        "org_member__full_name",
        "org_member__general_email",
        "org_member__general_contact",
        "org_member__member_type__type_name",
        "org_member__occupation",
    )
    list_filter = (
        "org_member__member_type",
        "created_at",
    )
    readonly_fields = (
        "get_name",
        "get_phone_number",
        "get_email",
        "get_designation",
        "get_photo_url",
        "created_at",
        "updated_at",
    )
    fieldsets = (
        ("Organization Member", {
            "fields": ("org_member",)
        }),
        ("Contact Information (from Member)", {
            "fields": (
                "get_name",
                "get_phone_number",
                "get_email",
                "get_designation",
                "get_photo_url",
            ),
            "classes": ("collapse",)
        }),
        ("Audit Information", {
            "fields": (
                "created_by",
                "updated_by",
                "created_at",
                "updated_at",
            ),
            "classes": ("collapse",)
        }),
    )

    def get_name(self, obj):
        """Display name from org_member"""
        return obj.name
    get_name.short_description = "Name"

    def get_phone_number(self, obj):
        """Display phone number from org_member"""
        return obj.phone_number
    get_phone_number.short_description = "Phone Number"

    def get_email(self, obj):
        """Display email from org_member"""
        return obj.email
    get_email.short_description = "Email"

    def get_designation(self, obj):
        """Display designation from org_member"""
        return obj.designation
    get_designation.short_description = "Designation"

    def get_photo_url(self, obj):
        """Display photo URL from org_member"""
        from django.utils.html import format_html
        if obj.photo_url:
            return format_html(
                '<img src="{}" alt="Photo" style="max-width: 100px; max-height: 100px;" />',
                obj.photo_url
            )
        return "No photo"
    get_photo_url.short_description = "Photo"

