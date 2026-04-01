from django.db import models
from django.core.validators import MinValueValidator
from django.core.exceptions import ValidationError
from django.db.models import Sum, Q
from user.models import Member
from datetime import datetime


class Account(models.Model):
    ACCOUNT_TYPES = [
        ('asset', 'Asset'),
        ('liability', 'Liability'),
        ('equity', 'Equity'),
        ('revenue', 'Revenue'),
        ('expense', 'Expense'),
    ]

    accountCode = models.CharField(max_length=20, unique=True)
    accountName = models.CharField(max_length=255)
    description = models.TextField(blank=True, null=True)
    accountType = models.CharField(max_length=20, choices=ACCOUNT_TYPES, default='expense')
    parentAccount = models.ForeignKey(
        'self',
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name='subAccounts'
    )
    currentBalance = models.DecimalField(max_digits=15, decimal_places=2, default=0)
    openingBalance = models.DecimalField(max_digits=15, decimal_places=2, default=0)
    openingBalanceDate = models.DateField(null=True, blank=True)
    openingDebit = models.DecimalField(max_digits=15, decimal_places=2, default=0, help_text="Opening debit amount")
    openingCredit = models.DecimalField(max_digits=15, decimal_places=2, default=0, help_text="Opening credit amount")
    isActive = models.BooleanField(default=True)
    isSystemAccount = models.BooleanField(default=False)
    hasSubAccounts = models.BooleanField(default=False)
    isGroup = models.BooleanField(default=False)
    
    createdBy = models.ForeignKey(
        Member,
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name='created_accounts'
    )
    createdAt = models.DateTimeField(auto_now_add=True)
    updatedBy = models.ForeignKey(
        Member,
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name='updated_accounts'
    )
    updatedAt = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['accountCode']
        indexes = [
            models.Index(fields=['accountCode']),
            models.Index(fields=['isActive']),
            models.Index(fields=['accountType']),
            models.Index(fields=['parentAccount']), # Added for faster sub-account lookups
        ]

    def __str__(self):
        return f"{self.accountCode} - {self.accountName}"
    
    def clean(self):
        """Validate that only one of openingDebit or openingCredit has a value (XOR)"""
        from decimal import Decimal
        
        # Convert to Decimal for comparison
        opening_debit = Decimal(str(self.openingDebit)) if self.openingDebit else Decimal('0')
        opening_credit = Decimal(str(self.openingCredit)) if self.openingCredit else Decimal('0')
        
        # Both cannot have values (XOR validation)
        if opening_debit > 0 and opening_credit > 0:
            raise ValidationError({
                'openingDebit': 'Cannot have both opening debit and opening credit. Please enter only one.',
                'openingCredit': 'Cannot have both opening debit and opening credit. Please enter only one.'
            })
        
        # Calculate opening balance based on debit/credit
        # For debit accounts (asset, expense): debit is positive, credit is negative
        # For credit accounts (liability, equity, revenue): credit is positive, debit is negative
        if self.accountType in ['asset', 'expense']:
            self.openingBalance = opening_debit - opening_credit
        else:
            self.openingBalance = opening_credit - opening_debit

    def save(self, *args, **kwargs):
        # Run validation
        self.full_clean()
        # Check if this is an update and get the original values
        original_opening_balance = None
        original_opening_debit = None
        original_opening_credit = None
        if self.pk:  # Only if object exists
            try:
                original_account = Account.objects.get(pk=self.pk)
                original_opening_balance = original_account.openingBalance
                original_opening_debit = original_account.openingDebit
                original_opening_credit = original_account.openingCredit
            except Account.DoesNotExist:
                pass
        
        # Save first, then update hasSubAccounts if needed
        super().save(*args, **kwargs)
        
        # Check if opening balance has changed (via openingDebit/openingCredit)
        opening_changed = False
        if original_opening_debit is not None and original_opening_debit != self.openingDebit:
            opening_changed = True
        if original_opening_credit is not None and original_opening_credit != self.openingCredit:
            opening_changed = True
        if original_opening_balance is not None and original_opening_balance != self.openingBalance:
            opening_changed = True
        
        if opening_changed:
            # Opening balance has changed, trigger recalculation
            self.recalculate_balance()
        
        if self.pk:  # Only check if object has been saved
            has_sub = self.subAccounts.filter(isActive=True).exists()
            if self.hasSubAccounts != has_sub:
                # Update the field directly without calling save() again to avoid infinite loop
                Account.objects.filter(pk=self.pk).update(hasSubAccounts=has_sub)
    
    def recalculate_balance(self):
        """Calculate current balance from opening balance and all posted voucher entries"""
        from decimal import Decimal
        
        # Start with zero - opening balance is now handled via vouchers
        # created by signals, so starting with self.openingBalance would double-count.
        balance = Decimal('0')
        
        # Get all posted voucher entry details for this account
        details = self.voucher_details.filter(
            voucherEntry__status='posted'
        )
        
        # Calculate total debits and credits
        total_dr_sum = details.aggregate(Sum('debitAmount'))['debitAmount__sum']
        total_cr_sum = details.aggregate(Sum('creditAmount'))['creditAmount__sum']
        total_debits = Decimal(str(total_dr_sum)) if total_dr_sum else Decimal('0')
        total_credits = Decimal(str(total_cr_sum)) if total_cr_sum else Decimal('0')
        
        # Calculate balance based on account type
        if self.accountType in ['asset', 'expense']:
            balance = total_debits - total_credits
        else:
            balance = total_credits - total_debits
        
        # Update the balance
        self.currentBalance = balance
        Account.objects.filter(pk=self.pk).update(currentBalance=balance)
        return balance

    def get_movement(self, from_date, to_date):
        """Calculate total debit and credit movement for a specific period"""
        from decimal import Decimal
        
        details = self.voucher_details.filter(
            voucherEntry__status='posted',
            entryDate__gte=from_date,
            entryDate__lte=to_date
        )
        
        sums = details.aggregate(
            total_dr=Sum('debitAmount'),
            total_cr=Sum('creditAmount')
        )
        
        return {
            'debit': sums['total_dr'] or Decimal('0'),
            'credit': sums['total_cr'] or Decimal('0')
        }


class VoucherType(models.Model):
    """Model for different types of vouchers (Receipt, Payment, Journal, etc.)"""
    
    VOUCHER_TYPES = [
        ('receipt', 'Receipt Voucher'),
        ('payment', 'Payment Voucher'),
        ('journal', 'Journal Voucher'),
        ('contra', 'Contra Voucher'),
        ('ServiceFeeBill', 'Service Fee Bill'),
        ('ServiceFeePayment', 'Service Fee Payment'),
        ('AdvancePayment', 'Advance Payment'),
        ('ServiceFeeAdjustment', 'Service Fee Adjustment'),
        ('ClosingBalance', 'Closing Balance'),
    ]
    
    name = models.CharField(max_length=50, choices=VOUCHER_TYPES, unique=True)
    displayName = models.CharField(max_length=50)
    description = models.TextField(blank=True, null=True)
    prefix = models.CharField(max_length=10, help_text="Prefix for voucher numbers (e.g., RV, PV, JV, CV)")
    isActive = models.BooleanField(default=True)
    
    createdBy = models.ForeignKey(
        Member,
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name='created_voucher_types'
    )
    createdAt = models.DateTimeField(auto_now_add=True)
    updatedBy = models.ForeignKey(
        Member,
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name='updated_voucher_types'
    )
    updatedAt = models.DateTimeField(auto_now=True)
    
    class Meta:
        ordering = ['name']
        verbose_name = 'Voucher Type'
        verbose_name_plural = 'Voucher Types'
    
    def __str__(self):
        return self.get_name_display()


class VoucherEntry(models.Model):
    """Header table for voucher entries following industry-standard accounting format"""
    
    ENTRY_STATUS = [
        ('draft', 'Draft'),
        ('posted', 'Posted'),
        ('void', 'Void'),
    ]
    
    voucherNumber = models.CharField(max_length=50, unique=True, db_index=True)
    entryDate = models.DateField(db_index=True)
    referenceNumber = models.CharField(max_length=100, blank=True, null=True)
    narration = models.TextField(blank=True, null=True, help_text="Description of the transaction")
    
    # Relationship to voucher type
    voucherType = models.ForeignKey(
        VoucherType,
        on_delete=models.PROTECT,
        related_name='vouchers'
    )

    # Primary account reference for the voucher (New)
    account = models.ForeignKey(
        Account,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='header_vouchers',
        help_text="Primary account associated with this voucher (e.g., Bank for payments)"
    )
    
    # Link to Unit (optional, for unit-specific ledgers)
    unit = models.ForeignKey(
        'towers.Unit',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='vouchers',
        help_text="Optional link to a specific Unit for targeted ledger tracking"
    )
    
    status = models.CharField(max_length=20, choices=ENTRY_STATUS, default='draft')
    totalDebit = models.DecimalField(max_digits=15, decimal_places=2, default=0, validators=[MinValueValidator(0)])
    totalCredit = models.DecimalField(max_digits=15, decimal_places=2, default=0, validators=[MinValueValidator(0)])
    
    # Audit trail
    createdBy = models.ForeignKey(
        Member,
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name='created_voucher_entries'
    )
    createdAt = models.DateTimeField(auto_now_add=True)
    postedBy = models.ForeignKey(
        Member,
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name='posted_voucher_entries'
    )
    postedAt = models.DateTimeField(null=True, blank=True)
    updatedBy = models.ForeignKey(
        Member,
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name='updated_voucher_entries'
    )
    updatedAt = models.DateTimeField(auto_now=True)
    
    # Tracking information (New)
    unit = models.ForeignKey(
        'towers.Unit',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='voucher_entries'
    )
    account_holder_type = models.CharField(
        max_length=20,
        choices=[('resident', 'Resident'), ('owner', 'Owner')],
        null=True,
        blank=True
    )
    account_holder_id = models.PositiveBigIntegerField(
        null=True,
        blank=True
    )
    
    class Meta:
        ordering = ['-entryDate', '-voucherNumber']
        indexes = [
            models.Index(fields=['voucherNumber']),
            models.Index(fields=['entryDate']),
            models.Index(fields=['status']),
            models.Index(fields=['voucherType']),
            models.Index(fields=['account']),
            models.Index(fields=['account', 'entryDate']), # Critical for month-wise partitioning/filtering
            models.Index(fields=['-entryDate', '-voucherNumber']),
            models.Index(fields=['unit']),
            models.Index(fields=['status', 'entryDate']), # Critical: Used in ALL financial reports
            models.Index(fields=['account_holder_type', 'account_holder_id']),
        ]
        verbose_name = 'Voucher Entry'
        verbose_name_plural = 'Voucher Entries'
    
    def __str__(self):
        return f"{self.voucherNumber} ({self.entryDate})"
    
    def clean(self):
        """Validate that debits equal credits for posted entries"""
        if self.status == 'posted' and self.totalDebit != self.totalCredit:
            raise ValidationError(
                f"Total debits ({self.totalDebit}) must equal total credits ({self.totalCredit}) for posted entries."
            )
    
    def save(self, *args, **kwargs):
        self.full_clean()
        is_new = self.pk is None
        
        # Track if entryDate changed for existing records
        old_entry_date = None
        if not is_new:
            try:
                old_instance = VoucherEntry.objects.get(pk=self.pk)
                old_entry_date = old_instance.entryDate
            except VoucherEntry.DoesNotExist:
                pass
                
        super().save(*args, **kwargs)
        
        # Sync entryDate to details if it changed
        if not is_new and old_entry_date and old_entry_date != self.entryDate:
            self.details.update(entryDate=self.entryDate)
    
    def calculate_totals(self):
        """Calculate total debits and credits from line items"""
        lines = self.details.all()
        self.totalDebit = sum(line.debitAmount for line in lines)
        self.totalCredit = sum(line.creditAmount for line in lines)
        self.save()


class VoucherEntryDetails(models.Model):
    """Detail lines for voucher entries (each debit/credit line)"""
    
    voucherEntry = models.ForeignKey(
        VoucherEntry,
        on_delete=models.CASCADE,
        related_name='details'
    )
    lineNumber = models.IntegerField(help_text="Sequence number of this line in the entry")
    account = models.ForeignKey(
        Account,
        on_delete=models.PROTECT,
        related_name='voucher_details'
    )
    
    # Denormalized entryDate for partitioning and fast queries (New)
    entryDate = models.DateField(db_index=True, null=True, blank=True)
    
    description = models.CharField(max_length=500, blank=True, null=True, help_text="Line-specific description")
    debitAmount = models.DecimalField(max_digits=15, decimal_places=2, default=0, validators=[MinValueValidator(0)])
    creditAmount = models.DecimalField(max_digits=15, decimal_places=2, default=0, validators=[MinValueValidator(0)])
    
    createdAt = models.DateTimeField(auto_now_add=True)
    updatedAt = models.DateTimeField(auto_now=True)

    # Tracking information (New)
    unit = models.ForeignKey(
        'towers.Unit',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='voucher_detail_lines'
    )
    account_holder_type = models.CharField(
        max_length=20,
        choices=[('resident', 'Resident'), ('owner', 'Owner')],
        null=True,
        blank=True
    )
    account_holder_id = models.PositiveBigIntegerField(
        null=True,
        blank=True
    )
    
    class Meta:
        ordering = ['voucherEntry', 'lineNumber']
        unique_together = [['voucherEntry', 'lineNumber']]
        indexes = [
            models.Index(fields=['voucherEntry', 'lineNumber']),
            models.Index(fields=['account']),
            models.Index(fields=['entryDate']), # Support month-wise partitioning
            models.Index(fields=['account', 'entryDate']), # Critical for fast ledger/report generation
            models.Index(fields=['unit']),
            models.Index(fields=['account', 'voucherEntry']), # Critical: Speeds up ledger and report itemization
            models.Index(fields=['account_holder_type', 'account_holder_id']),
        ]
        verbose_name = 'Voucher Entry Detail'
        verbose_name_plural = 'Voucher Entry Details'
    
    def __str__(self):
        return f"{self.voucherEntry.voucherNumber} - Line {self.lineNumber}: {self.account.accountCode}"
    
    def clean(self):
        """Validate that either debit or credit is entered, but not both"""
        if self.debitAmount > 0 and self.creditAmount > 0:
            raise ValidationError("A line cannot have both debit and credit amounts. Use separate lines.")
        if self.debitAmount == 0 and self.creditAmount == 0:
            raise ValidationError("A line must have either a debit or credit amount.")
    
    def save(self, *args, **kwargs):
        if hasattr(self, 'voucherEntry') and self.voucherEntry and self.voucherEntry.entryDate:
            self.entryDate = self.voucherEntry.entryDate
        self.full_clean()
        super().save(*args, **kwargs)


class DefaultAccountHead(models.Model):
    """Configuration for default account heads for different transaction types"""
    
    # Keep TRANSACTION_TYPES for backward compatibility and suggestions
    TRANSACTION_TYPES = [
        ('income', 'Income'),
        ('expense', 'Expense'),
        ('sales', 'Sales'),
        ('purchase', 'Purchase'),
        ('cash', 'Cash'),
        ('bank', 'Bank'),
        ('mfs', 'Mobile Financial Service (MFS)'),
    ]
    
    ENTRY_TYPES = [
        ('debit', 'Debit'),
        ('credit', 'Credit'),
    ]
    
    transactionType = models.CharField(
        max_length=100,
        unique=True,
        help_text="Type of financial transaction (can be custom)"
    )
    defaultEntryType = models.CharField(
        max_length=10,
        choices=ENTRY_TYPES,
        blank=True,
        null=True,
        help_text="Default entry type (Debit or Credit) for this transaction type"
    )
    customLabel = models.CharField(
        max_length=200,
        help_text="Display name for this default account head"
    )
    defaultAccount = models.ForeignKey(
        Account,
        on_delete=models.PROTECT,
        related_name='default_account_heads'
    )
    description = models.TextField(blank=True, null=True, help_text="Description for this default account mapping")
    isActive = models.BooleanField(default=True)
    
    createdBy = models.ForeignKey(
        Member,
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name='created_default_account_heads'
    )
    createdAt = models.DateTimeField(auto_now_add=True)
    updatedBy = models.ForeignKey(
        Member,
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name='updated_default_account_heads'
    )
    updatedAt = models.DateTimeField(auto_now=True)
    
    class Meta:
        ordering = ['transactionType']
        indexes = [
            models.Index(fields=['transactionType']),
            models.Index(fields=['isActive']),
        ]
        verbose_name = 'Default Account Head'
        verbose_name_plural = 'Default Account Heads'
    
    def __str__(self):
        return f"{self.customLabel} -> {self.defaultAccount.accountCode}"
    
    def save(self, *args, **kwargs):
        # Ensure only active accounts are used as defaults
        if self.defaultAccount and not self.defaultAccount.isActive:
            raise ValidationError("Cannot set an inactive account as default.")
        super().save(*args, **kwargs)

class ReportSection(models.Model):
    """Configuration for financial report sections (Trial Balance, Income Statement, etc.)"""
    
    MODULE_CHOICES = [
        ('trial_balance', 'Trial Balance'),
        ('income_statement', 'Income Statement'),
        ('balance_sheet', 'Balance Sheet'),
        ('received_payment', 'Received & Payment'),
        ('cash_flow', 'Cash Flow Statement'),
    ]
    
    moduleName = models.CharField(
        max_length=50, 
        choices=MODULE_CHOICES,
        help_text="The report module this section belongs to"
    )
    sectionName = models.CharField(
        max_length=100,
        help_text="Name of the section (e.g., ASSETS, LIABILITIES)"
    )
    order = models.IntegerField(
        default=0,
        help_text="Sort order for the section within the report"
    )
    accounts = models.ManyToManyField(
        Account,
        related_name='report_sections',
        blank=True,
        help_text="Ledger accounts included in this section"
    )
    description = models.TextField(blank=True, null=True)
    isActive = models.BooleanField(default=True)
    
    # Audit trail
    createdBy = models.ForeignKey(
        Member,
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name='created_report_sections'
    )
    createdAt = models.DateTimeField(auto_now_add=True)
    updatedBy = models.ForeignKey(
        Member,
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name='updated_report_sections'
    )
    updatedAt = models.DateTimeField(auto_now=True)
    
    class Meta:
        ordering = ['moduleName', 'order']
        verbose_name = 'Report Section'
        verbose_name_plural = 'Report Sections'
        unique_together = [['moduleName', 'sectionName']]
    
    def __str__(self):
        return f"{self.get_moduleName_display()} - {self.sectionName}"
