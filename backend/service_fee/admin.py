from django.contrib import admin
from .models import ServiceFee, ServiceFeeMFS, ServiceFeeBank, LatePenaltyTier


class ServiceFeeMFSInline(admin.TabularInline):
    model = ServiceFeeMFS
    extra = 0
    fields = ['provider', 'account_name', 'account_number']


class ServiceFeeBankInline(admin.StackedInline):
    model = ServiceFeeBank
    extra = 0
    fields = ['bank_name', 'branch_name', 'branch_address', 'account_holder_name', 'account_number', 'routing_number']


class LatePenaltyTierInline(admin.TabularInline):
    model = LatePenaltyTier
    extra = 0
    fields = ['days_overdue', 'penalty_percentage', 'order']


@admin.register(ServiceFee)
class ServiceFeeAdmin(admin.ModelAdmin):
    list_display = [
        'id', 'creator_name', 'fee_amount', 'currency', 'frequency',
        'billing_cycle', 'due_day', 'is_active', 'created_at'
    ]
    list_filter = [
        'currency', 'frequency', 'billing_cycle', 'is_active',
        'accepts_cash', 'accepts_mfs', 'accepts_bank', 'created_at'
    ]
    search_fields = ['creator_name', 'creator__full_name']
    readonly_fields = ['creator_name', 'created_at', 'updated_at', 'created_by', 'updated_by']
    filter_horizontal = ['towers']

    fieldsets = (
        ('General Information', {
            'fields': ('creator_name', 'creator', 'fee_amount', 'currency', 'frequency')
        }),
        ('Billing Details', {
            'fields': ('billing_cycle', 'due_day')
        }),
        ('Tower and Unit Selection', {
            'fields': ('towers',)
        }),
        ('Payment Methods', {
            'fields': ('accepts_cash', 'accepts_mfs', 'accepts_bank')
        }),
        ('Reminder Settings', {
            'fields': ('reminder_before_days', 'reminder_after_days')
        }),
        ('Late Payment Settings', {
            'fields': ('late_payment_enabled',)
        }),
        ('Status', {
            'fields': ('is_active',)
        }),
        ('Audit Information', {
            'fields': ('created_by', 'created_at', 'updated_by', 'updated_at'),
            'classes': ('collapse',)
        }),
    )

    inlines = [ServiceFeeMFSInline, ServiceFeeBankInline, LatePenaltyTierInline]

    def save_model(self, request, obj, form, change):
        if not change:  # Creating new object
            obj.created_by = request.user.member if hasattr(request.user, 'member') else None
            obj.creator = request.user.member if hasattr(request.user, 'member') else None
            if obj.creator:
                obj.creator_name = obj.creator.full_name
        else:  # Updating existing object
            obj.updated_by = request.user.member if hasattr(request.user, 'member') else None
        super().save_model(request, obj, form, change)


@admin.register(ServiceFeeMFS)
class ServiceFeeMFSAdmin(admin.ModelAdmin):
    list_display = ['id', 'service_fee', 'provider', 'account_name', 'account_number', 'created_at']
    list_filter = ['provider', 'created_at']
    search_fields = ['account_name', 'account_number', 'service_fee__creator_name']
    readonly_fields = ['created_at', 'updated_at']


@admin.register(ServiceFeeBank)
class ServiceFeeBankAdmin(admin.ModelAdmin):
    list_display = ['id', 'service_fee', 'bank_name', 'account_holder_name', 'account_number', 'created_at']
    list_filter = ['bank_name', 'created_at']
    search_fields = ['account_holder_name', 'account_number', 'service_fee__creator_name']
    readonly_fields = ['created_at', 'updated_at']


@admin.register(LatePenaltyTier)
class LatePenaltyTierAdmin(admin.ModelAdmin):
    list_display = ['id', 'service_fee', 'days_overdue', 'penalty_percentage', 'order', 'created_at']
    list_filter = ['created_at']
    search_fields = ['service_fee__creator_name']
    readonly_fields = ['created_at', 'updated_at']

