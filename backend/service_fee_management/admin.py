from django.contrib import admin
from .models import ServiceFeeBilling, ServiceFeePayment, Reminder, ReminderLog, PaymentMethod, ServiceFeeGenerationSchedule, BillUpload, BillUploadDetail


@admin.register(ServiceFeeBilling)
class ServiceFeeBillingAdmin(admin.ModelAdmin):
    list_display = ['transaction_id', 'billing_id', 'receipt_id', 'billing_amount', 'total_paid', 'payment_method', 'payment_date']
    list_filter = ['payment_method', 'payment_date', 'created_at']
    search_fields = ['transaction_id', 'billing_id', 'receipt_id', 'reference_number']
    readonly_fields = ['transaction_id', 'billing_id', 'receipt_id', 'total_paid', 'created_at', 'updated_at']
    
    fieldsets = (
        ('Identification', {
            'fields': ('transaction_id', 'billing_id', 'receipt_id')
        }),
        ('Amount Details', {
            'fields': ('billing_amount', 'total_paid', 'currency')
        }),
        ('Payment Information', {
            'fields': ('payment_method', 'reference_number', 'notes')
        }),
        ('Dates', {
            'fields': ('payment_date',)
        }),
        ('Audit Information', {
            'fields': ('created_by', 'created_at', 'updated_by', 'updated_at'),
            'classes': ('collapse',)
        })
    )


@admin.register(PaymentMethod)
class PaymentMethodAdmin(admin.ModelAdmin):
    list_display = ['method_name', 'is_active', 'display_order', 'created_at']
    list_filter = ['is_active']
    search_fields = ['method_name', 'description']
    ordering = ['display_order', 'method_name']
    readonly_fields = ['created_at', 'updated_at']
    
    fieldsets = (
        ('Basic Information', {
            'fields': ('method_name', 'is_active', 'display_order')
        }),
        ('Additional Details', {
            'fields': ('icon', 'description')
        }),
        ('Timestamps', {
            'fields': ('created_at', 'updated_at'),
            'classes': ('collapse',)
        })
    )


@admin.register(ServiceFeePayment)
class ServiceFeePaymentAdmin(admin.ModelAdmin):
    list_display = ['id', 'resident_name', 'amount', 'payment_status', 'service_status', 'due_date']
    list_filter = ['payment_status', 'service_status', 'created_at']
    search_fields = ['resident__full_name', 'unit__unit_name']
    readonly_fields = ['created_at', 'updated_at']
    
    fieldsets = (
        ('Service Period', {
            'fields': ('service_period_month', 'service_period_year')
        }),
        ('Related Entities', {
            'fields': ('service_fee', 'unit', 'resident')
        }),
        ('Payment Details', {
            'fields': ('amount', 'remaining_amount', 'currency', 'payment_status', 'payment_result_status')
        }),
        ('Service Status', {
            'fields': ('service_status',)
        }),
        ('Dates', {
            'fields': ('due_date', 'completion_date')
        }),
        ('Audit Information', {
            'fields': ('created_by', 'created_at', 'updated_by', 'updated_at'),
            'classes': ('collapse',)
        })
    )
    
    def resident_name(self, obj):
        return obj.resident.full_name if obj.resident else 'N/A'
    resident_name.short_description = 'Resident Name'


@admin.register(Reminder)
class ReminderAdmin(admin.ModelAdmin):
    list_display = ['reminder_name', 'reminder_type', 'status', 'audience', 'channels_display', 'total_sent', 'created_by', 'created_at']
    # `audience` is now a derived property (normalized tables). Remove from list_filter
    list_filter = ['reminder_type', 'status', 'app_notification', 'sms', 'email', 'created_at']
    search_fields = ['reminder_name', 'message_preview']
    readonly_fields = ['total_sent', 'last_sent', 'created_at', 'updated_at']
    
    fieldsets = (
        ('Basic Information', {
            'fields': ('reminder_name', 'reminder_type', 'status')
        }),
        ('Timing Configuration', {
            'fields': ('send_when',)
        }),
        ('Channels', {
            'fields': ('app_notification', 'sms', 'email')
        }),
        ('Audience', {
            'description': 'Audience and specific targets are managed via normalized tables (ReminderTower/ReminderSpecificTarget).',
            'fields': (),
        }),
        ('Message', {
            'fields': ('message_preview',)
        }),
        ('Tracking', {
            'fields': ('total_sent', 'last_sent'),
            'classes': ('collapse',)
        }),
        ('Metadata', {
            'fields': ('created_by', 'created_at', 'updated_at'),
            'classes': ('collapse',)
        })
    )
    
    def channels_display(self, obj):
        channels = []
        if obj.app_notification:
            channels.append('App')
        if obj.sms:
            channels.append('SMS') 
        if obj.email:
            channels.append('Email')
        return ', '.join(channels) if channels else 'None'
    channels_display.short_description = 'Active Channels'


@admin.register(ReminderLog)
class ReminderLogAdmin(admin.ModelAdmin):
    list_display = ['reminder_name', 'recipient_name', 'unit_display', 'channel', 'delivery_status', 'sent_at']
    list_filter = ['channel', 'delivery_status', 'sent_at']
    search_fields = ['reminder__reminder_name', 'recipient__full_name', 'message_content']
    readonly_fields = ['sent_at', 'delivered_at']
    
    fieldsets = (
        ('Basic Information', {
            'fields': ('reminder', 'recipient', 'unit', 'channel')
        }),
        ('Message', {
            'fields': ('message_content',)
        }),
        ('Delivery Tracking', {
            'fields': ('delivery_status', 'sent_at', 'delivered_at', 'error_message')
        })
    )
    
    def reminder_name(self, obj):
        return obj.reminder.reminder_name
    reminder_name.short_description = 'Reminder'
    
    def recipient_name(self, obj):
        return obj.recipient.full_name
    recipient_name.short_description = 'Recipient'
    
    def unit_display(self, obj):
        return obj.unit.unit_name if obj.unit else 'N/A'
    unit_display.short_description = 'Unit'


@admin.register(ServiceFeeGenerationSchedule)
class ServiceFeeGenerationScheduleAdmin(admin.ModelAdmin):
    list_display = ['schedule_name', 'tower_display', 'service_fee_display', 'generation_timing', 'status', 'last_executed', 'created_by']
    list_filter = ['status', 'generation_day', 'tower', 'created_at']
    search_fields = ['schedule_name', 'tower__tower_name', 'service_fee__fee_amount', 'unit_ids']
    readonly_fields = ['last_executed', 'last_execution_result', 'created_at', 'updated_at']
    
    fieldsets = (
        ('Basic Information', {
            'fields': ('schedule_name', 'status')
        }),
        ('Filters', {
            'fields': ('tower', 'service_fee', 'unit_ids'),
            'description': 'Leave empty to apply to all towers/service fees/units'
        }),
        ('Schedule Timing', {
            'fields': ('generation_day', 'generation_hour', 'generation_minute'),
            'description': 'Day of month (1-31), Hour (0-23), Minute (0-59). Example: Day 1, Hour 14, Minute 15 = 1st of month at 2:15 PM'
        }),
        ('Execution Tracking', {
            'fields': ('last_executed', 'last_execution_result'),
            'classes': ('collapse',)
        }),
        ('Metadata', {
            'fields': ('created_by', 'created_at', 'updated_at'),
            'classes': ('collapse',)
        })
    )
    
    def tower_display(self, obj):
        return obj.tower.tower_name if obj.tower else 'All Towers'
    tower_display.short_description = 'Tower'
    
    def service_fee_display(self, obj):
        if obj.service_fee:
            return f"{obj.service_fee.fee_amount} {obj.service_fee.currency}"
        return 'All Service Fees'
    service_fee_display.short_description = 'Service Fee'
    
    def generation_timing(self, obj):
        return f"Day {obj.generation_day} at {obj.generation_hour:02d}:{obj.generation_minute:02d}"
    generation_timing.short_description = 'Schedule'


@admin.register(BillUpload)
class BillUploadAdmin(admin.ModelAdmin):
    list_display = ['upload_id', 'category', 'bill_category', 'upload_method', 'is_active', 'created_by', 'created_at']
    list_filter = ['bill_category', 'upload_method', 'is_active', 'created_at']
    search_fields = ['upload_id', 'category']
    readonly_fields = ['upload_id', 'created_at', 'updated_at']
    fieldsets = (
        ('Batch Information', {'fields': ('upload_id', 'bill_category', 'category', 'upload_method', 'is_active')}),
        ('Audit', {'fields': ('created_by', 'created_at', 'updated_by', 'updated_at'), 'classes': ('collapse',)})
    )


@admin.register(BillUploadDetail)
class BillUploadDetailAdmin(admin.ModelAdmin):
    list_display = ['id', 'bill_upload', 'unit', 'service_fee', 'tower', 'upload_year', 'upload_month', 'amount']
    list_filter = ['service_fee', 'tower', 'upload_year', 'upload_month']
    search_fields = ['unit__unit_name', 'bill_upload__upload_id']
    readonly_fields = ['created_at', 'updated_at']
    fieldsets = (
        ('Detail', {'fields': ('bill_upload', 'service_fee', 'tower', 'upload_year', 'upload_month', 'unit', 'unit_of_measurement', 'price_per_unit', 'previous_reading', 'current_reading', 'consumption', 'amount')}),
    )
