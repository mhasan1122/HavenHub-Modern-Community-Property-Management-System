from django.contrib import admin
from .models import Account, VoucherEntry, VoucherEntryDetails, VoucherType, DefaultAccountHead, ReportSection


@admin.register(Account)
class AccountAdmin(admin.ModelAdmin):
    list_display = ('accountCode', 'accountName', 'accountType', 'parentAccount', 'currentBalance', 'isActive')
    list_filter = ('accountType', 'isActive')
    search_fields = ('accountCode', 'accountName')
    fieldsets = (
        ('Basic Information', {
            'fields': ('accountCode', 'accountName', 'description', 'accountType')
        }),
        ('Account Details', {
            'fields': ('parentAccount', 'currentBalance', 'isSystemAccount', 'isActive')
        }),
        ('Metadata', {
            'fields': ('createdBy', 'createdAt', 'updatedBy', 'updatedAt'),
            'classes': ('collapse',)
        }),
    )
    readonly_fields = ('createdAt', 'updatedAt', 'hasSubAccounts')


class VoucherEntryDetailsInline(admin.TabularInline):
    model = VoucherEntryDetails
    extra = 0
    fields = ('lineNumber', 'account', 'description', 'debitAmount', 'creditAmount')
    readonly_fields = ('createdAt', 'updatedAt')


@admin.register(VoucherType)
class VoucherTypeAdmin(admin.ModelAdmin):
    list_display = ('name', 'displayName', 'prefix', 'isActive', 'createdAt')
    list_filter = ('isActive',)
    search_fields = ('name', 'displayName', 'description')
    fieldsets = (
        ('Basic Information', {
            'fields': ('name', 'displayName', 'description', 'prefix', 'isActive')
        }),
        ('Metadata', {
            'fields': ('createdBy', 'createdAt', 'updatedBy', 'updatedAt'),
            'classes': ('collapse',)
        }),
    )
    readonly_fields = ('createdAt', 'updatedAt')


@admin.register(VoucherEntry)
class VoucherEntryAdmin(admin.ModelAdmin):
    list_display = ('voucherNumber', 'entryDate', 'voucherType', 'status', 'totalDebit', 'totalCredit', 'createdBy', 'createdAt')
    list_filter = ('status', 'entryDate', 'voucherType')
    search_fields = ('voucherNumber', 'narration', 'referenceNumber')
    inlines = [VoucherEntryDetailsInline]
    fieldsets = (
        ('Voucher Information', {
            'fields': ('voucherNumber', 'entryDate', 'voucherType', 'referenceNumber', 'narration')
        }),
        ('Status & Totals', {
            'fields': ('status', 'totalDebit', 'totalCredit')
        }),
        ('Audit Trail', {
            'fields': ('createdBy', 'createdAt', 'postedBy', 'postedAt', 'updatedBy', 'updatedAt'),
            'classes': ('collapse',)
        }),
    )
    readonly_fields = ('createdAt', 'updatedAt', 'postedAt', 'totalDebit', 'totalCredit')


@admin.register(DefaultAccountHead)
class DefaultAccountHeadAdmin(admin.ModelAdmin):
    list_display = ('customLabel', 'transactionType', 'defaultAccount', 'isActive', 'createdAt')
    list_filter = ('isActive',)
    search_fields = ('transactionType', 'customLabel', 'description')
    fieldsets = (
        ('Basic Information', {
            'fields': ('transactionType', 'customLabel', 'defaultAccount', 'description', 'isActive')
        }),
        ('Metadata', {
            'fields': ('createdBy', 'createdAt', 'updatedBy', 'updatedAt'),
            'classes': ('collapse',)
        }),
    )
    readonly_fields = ('createdAt', 'updatedAt')


@admin.register(ReportSection)
class ReportSectionAdmin(admin.ModelAdmin):
    list_display = ('sectionName', 'moduleName', 'order', 'isActive', 'createdAt')
    list_filter = ('moduleName', 'isActive')
    search_fields = ('sectionName', 'description')
    filter_horizontal = ('accounts',)
    fieldsets = (
        ('Basic Information', {
            'fields': ('moduleName', 'sectionName', 'order', 'description', 'isActive')
        }),
        ('Accounts Mapping', {
            'fields': ('accounts',),
            'description': 'Select ledger accounts to include in this section'
        }),
        ('Metadata', {
            'fields': ('createdBy', 'createdAt', 'updatedBy', 'updatedAt'),
            'classes': ('collapse',)
        }),
    )
    readonly_fields = ('createdAt', 'updatedAt')
