from django.db import models
from django.core.validators import MinValueValidator, MaxValueValidator
from user.models import Member
from towers.models import Unit, Tower
from service_fee.models import ServiceFee  # Import from original service_fee module
from datetime import datetime
from decimal import Decimal
from bill_categories.models import BillCategory
import time
import re


def generate_unique_sequential_id(model_class, field_name, prefix, digits=5):
    """
    Generates a unique sequential ID like PREFIX-YYYY-MM-00001
    """
    from django.db.models import Max
    
    # 1. Find the current max for this prefix
    max_id = model_class.objects.filter(**{f"{field_name}__startswith": prefix}).aggregate(Max(field_name))[f"{field_name}__max"]
    
    next_num = 1
    if max_id:
        # Extract the number from the end. 
        # Example max_id: "BILL-2024-01-00005"
        # We look for the last numeric group after a dash
        match = re.search(r'-(\d+)(?:-ADV)?$', max_id)
        if match:
            try:
                next_num = int(match.group(1)) + 1
            except (ValueError, TypeError):
                next_num = 1
    
    # 2. Loop to ensure uniqueness (safety check)
    while True:
        new_id = f"{prefix}{str(next_num).zfill(digits)}"
        if not model_class.objects.filter(**{field_name: new_id}).exists():
            return new_id
        next_num += 1


class ServiceFeeBilling(models.Model):
    """
    Model for service fee billing details - represents the monthly service fee charges
    Separated from payment transactions to normalize the data
    """
    
    
    # Payment identification
    # Payment identification
    transaction_id = models.CharField(max_length=100, default='TXN-LEGACY', help_text="Unique transaction identifier for each payment")
    receipt_id = models.CharField(max_length=100, default='RCP-LEGACY', help_text="Unique receipt identifier (e.g., RCP-2024-01-00001)")
    billing_id = models.CharField(max_length=100, unique=True, default='BILL-LEGACY', help_text="Unique billing identifier (e.g., BILL-2024-01-00001)")
    
    # Link to payment record
    servicefeepaymentid = models.ForeignKey('ServiceFeePayment', on_delete=models.CASCADE, related_name='billing_records', default=29, null=True, blank=True, help_text="Related payment transaction")
    advance_payment = models.ForeignKey('AdvancePayment', on_delete=models.SET_NULL, related_name='billing_receipts', null=True, blank=True, help_text="Related advance payment record")
    
    # Billing amount details
    billing_amount = models.DecimalField(max_digits=10, decimal_places=2, validators=[MinValueValidator(Decimal('0'))], help_text="Original billing amount for the period")
    total_paid = models.DecimalField(max_digits=10, decimal_places=2, default=0, validators=[MinValueValidator(Decimal('0'))], help_text="Total amount paid so far")
    
    currency = models.CharField(max_length=3, default='BDT')
    
    # Payment method
    payment_method = models.ForeignKey('PaymentMethod', on_delete=models.PROTECT, related_name='billings', help_text="Payment method used", null=True, blank=True, db_column='payment_method_id')
    
    # Payment type - distinguish between regular and advance payments
    PAYMENT_TYPE_CHOICES = [
        ('service_fee_bill_payment', 'Service Fee Bill Payment'),
        ('advance_payment', 'Advance Payment'),
    ]
    payment_type = models.CharField(
        max_length=30,
        choices=PAYMENT_TYPE_CHOICES,
        default='service_fee_bill_payment',
        help_text='Type of payment: regular bill payment or advance payment application'
    )
    
    # Payment result status - tracks whether THIS specific transaction was full, partial, or overpayment
    PAYMENT_RESULT_CHOICES = [
        ('full', 'Full Payment'),
        ('partial', 'Partial Payment'),
        ('overpayment', 'Overpayment'),
    ]
    payment_result_status = models.CharField(
        max_length=20, 
        choices=PAYMENT_RESULT_CHOICES, 
        null=True, 
        blank=True, 
        help_text="Result of this payment: whether it was partial, full, or overpayment at the time of transaction"
    )
    
    # Dates
    payment_date = models.DateTimeField(null=True, blank=True, help_text="When payment was made")
    due_date = models.DateField(null=True, blank=True, help_text="Service fee due date")
    
    # Additional information
    reference_number = models.CharField(max_length=100, blank=True, null=True, help_text="External reference (e.g., MFS transaction ID)")
    notes = models.TextField(blank=True, null=True, help_text="Additional payment notes")
    
    # Detailed Payment Tracking info
    received_by = models.ForeignKey(Member, on_delete=models.SET_NULL, null=True, blank=True, related_name='received_payments', help_text="User who received the cash payment")
    received_by_name = models.CharField(max_length=255, blank=True, null=True, help_text="Name of person who received payment (fallback)")
    from_account_number = models.CharField(max_length=100, blank=True, null=True, help_text="Sender's account number")
    to_account_number = models.CharField(max_length=100, blank=True, null=True, help_text="Receiver's account number")
    to_account_name = models.CharField(max_length=255, blank=True, null=True, help_text="Receiver's account name")
    other_method_name = models.CharField(max_length=100, blank=True, null=True, help_text="Display name for 'Other' methods like bKash, Nagad")
    payment_gateway = models.CharField(max_length=50, blank=True, null=True, help_text="Payment gateway used (e.g., paystation, sslcommerz, manual)")
    
    # Voucher and Account Mapping (for accounting integration)
    voucher_id = models.IntegerField(null=True, blank=True, help_text="Link to bill voucher (VoucherEntry ID)")
    payment_account_code = models.CharField(max_length=20, blank=True, null=True, help_text="Account code for payment method (e.g., 1110 for Cash)")
    payment_account_name = models.CharField(max_length=255, blank=True, null=True, help_text="Account name for payment method (e.g., Cash Account)")
    
    # Audit fields
    created_by = models.ForeignKey(Member, null=True, blank=True, on_delete=models.SET_NULL, related_name='created_billings')
    created_at = models.DateTimeField(auto_now_add=True)
    updated_by = models.ForeignKey(Member, null=True, blank=True, on_delete=models.SET_NULL, related_name='updated_billings')
    updated_at = models.DateTimeField(auto_now=True)
    
    class Meta:
        ordering = ['-created_at']
        db_table = 'service_fee_payment_details'
        indexes = [
            models.Index(fields=['transaction_id']),
            models.Index(fields=['receipt_id']),
            models.Index(fields=['payment_date']),
            models.Index(fields=['servicefeepaymentid', '-payment_date']),
            models.Index(fields=['reference_number']),
            models.Index(fields=['payment_type']),
        ]
    
    def __str__(self):
        return f"Billing {self.billing_id}" if self.billing_id else f"Billing {self.id}"
    
    def save(self, *args, **kwargs):
        from datetime import datetime
        now = datetime.now()
        prefix_date = f"{now.year}-{now.month:02d}-"
        
        # Generate transaction_id if not provided or is default
        if not self.transaction_id or self.transaction_id == 'TXN-LEGACY':
            self.transaction_id = generate_unique_sequential_id(ServiceFeeBilling, 'transaction_id', f"TXN-{prefix_date}", 8)
        
        # Generate IDs if not provided or is default
        if not self.billing_id or self.billing_id == 'BILL-LEGACY':
            self.billing_id = generate_unique_sequential_id(ServiceFeeBilling, 'billing_id', f"BILL-{prefix_date}", 5)
        
        if not self.receipt_id or self.receipt_id == 'RCP-LEGACY':
            self.receipt_id = generate_unique_sequential_id(ServiceFeeBilling, 'receipt_id', f"RCP-{prefix_date}", 5)
        
        super().save(*args, **kwargs)
    
    def calculate_service_status(self):
        """Calculate service status based on payment completion"""
        from decimal import Decimal
        
        billing_amount = float(self.billing_amount)
        total_paid = float(self.total_paid)
        
        if total_paid >= billing_amount:
            return 'paid'
        elif total_paid > 0:
            return 'partial'
        else:
            return 'due'
    
    def update_payment_totals(self):
        """
        Update total_paid based on completed payments
        Call this after payment transactions are created/updated
        """
        from django.db.models import Sum
        
        total = self.payments.filter(payment_status='completed').aggregate(
            total=Sum('amount')
        )['total'] or 0
        
        self.total_paid = total
        self.save()
    
    @property
    def payment_percentage(self):
        """Calculate payment percentage"""
        if float(self.billing_amount) <= 0:
            return 0
        return (float(self.total_paid) / float(self.billing_amount)) * 100

    def calculate_totals(self):
        """Place holder method if needed for other totals"""
        pass


class PenaltyWaiver(models.Model):
    """
    Model to store penalty waiver history for a billing record
    """
    WAIVER_TYPE_CHOICES = [
        ('full', 'Full Waiver'),
        ('partial_percentage', 'Partial (Percentage)'),
        ('partial_fixed', 'Partial (Fixed Amount)'),
    ]

    billing = models.ForeignKey(ServiceFeeBilling, on_delete=models.CASCADE, related_name='waivers')
    waiver_type = models.CharField(max_length=20, choices=WAIVER_TYPE_CHOICES)
    percentage = models.DecimalField(max_digits=5, decimal_places=2, null=True, blank=True, help_text="Percentage waived if applicable")
    
    # Penalty state at the time of waiver
    penalty_amount = models.DecimalField(max_digits=10, decimal_places=2, default=0, validators=[MinValueValidator(Decimal('0'))], help_text="Penalty amount before this waiver")
    waived_amount = models.DecimalField(max_digits=10, decimal_places=2, help_text="Amount waived in this instance")
    penalty_after_waiver = models.DecimalField(max_digits=10, decimal_places=2, default=0, validators=[MinValueValidator(Decimal('0'))], help_text="Penalty remaining after this waiver")
    
    reason = models.CharField(max_length=255, blank=True, null=True)
    notes = models.TextField(blank=True, null=True)
    
    # Audit fields
    applied_by = models.ForeignKey(Member, on_delete=models.SET_NULL, null=True, blank=True, related_name='applied_waivers')
    applied_at = models.DateTimeField(auto_now_add=True)

    default_account_head = models.ForeignKey(
        'accounts.DefaultAccountHead',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='penalty_waivers',
        help_text="Accounting head for this waiver adjustement"
    )

    class Meta:
        db_table = 'service_fee_penalty_waivers'
        ordering = ['-applied_at']

    def __str__(self):
        return f"Waiver for {self.billing.billing_id} - ৳{self.waived_amount}"

    def save(self, *args, **kwargs):
        # Round penalty fields to integers for consistency
        if self.penalty_amount is not None:
            self.penalty_amount = round(self.penalty_amount)
        if self.waived_amount is not None:
            self.waived_amount = round(self.waived_amount)
        if self.penalty_after_waiver is not None:
            self.penalty_after_waiver = round(self.penalty_after_waiver)
        super().save(*args, **kwargs)


class PaymentMethod(models.Model):
    """
    Model for payment methods
    """
    method_name = models.CharField(max_length=100, unique=True, help_text="Display name (e.g., 'Cash', 'bKash')")
    METHOD_TYPE_CHOICES = [
        ('cash', 'Cash'),
        ('bank', 'Bank Transfer'),
        ('card', 'Card'),
        ('mfs', 'Mobile Financial Services (MFS)'),
    ]
    method_type = models.CharField(
        max_length=20, 
        choices=METHOD_TYPE_CHOICES, 
        default='cash',
        help_text="Categorization of the payment method"
    )
    is_active = models.BooleanField(default=True, help_text="Whether this payment method is currently available")
    display_order = models.IntegerField(default=0, help_text="Order in which to display this method")
    icon = models.CharField(max_length=100, blank=True, null=True, help_text="Icon class or image path")
    description = models.TextField(blank=True, null=True, help_text="Additional details about this payment method")
    default_account = models.ForeignKey('accounts.Account', on_delete=models.SET_NULL, null=True, blank=True, related_name='payment_methods', help_text="Accounting head for this payment method")
    
    # Account Details for Receiving Payments (New)
    account_name = models.CharField(max_length=255, blank=True, null=True, help_text="Name of the account holder (e.g. Company Name)")
    account_number = models.CharField(max_length=100, blank=True, null=True, help_text="Account number/Phone number for receiving payments")
    
    # Audit fields
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    class Meta:
        ordering = ['display_order', 'method_name']
        db_table = 'service_fee_payment_methods'
    
    def __str__(self):
        return self.method_name


class ServiceFeePayment(models.Model):
    """
    Model for service fee payment transactions
    Represents individual payment transactions - multiple payments can be made for a single billing period
    """
    PAYMENT_STATUS_CHOICES = [
        ('pending', 'Pending'),
        ('completed', 'Completed'),
        ('failed', 'Failed'),
        ('cancelled', 'Cancelled'),
        ('refunded', 'Refunded'),
    ]

    PAYMENT_METHOD_CHOICES = [
        ('cash', 'Cash'),
        ('bkash', 'bKash'),
        ('nagad', 'Nagad'),
        ('rocket', 'Rocket'),
        ('bank_transfer', 'Bank Transfer'),
        # ('sslcommerz', 'SSLCommerz'),  # Commented out - replaced with PayStation
        ('paystation', 'PayStation'),
    ]

    SERVICE_STATUS_CHOICES = [
        ('due', 'Due'),
        ('partial', 'Partial'),
        ('paid', 'Paid'),
        ('overdue', 'Overdue'),
    ]

    PAYMENT_RESULT_CHOICES = [
        ('partial', 'Partial Payment'),
        ('full', 'Full Payment'),
        ('overpayment', 'Overpayment'),
    ]

    # Service period
    service_period_month = models.IntegerField(default=1, help_text="Month for which service fee is paid (1-12)")
    service_period_year = models.IntegerField(default=2024, help_text="Year for which service fee is paid")
    
    # Payment details (only payment-specific data)
    base_service_amount = models.DecimalField(max_digits=10, decimal_places=2, default=0, validators=[MinValueValidator(Decimal('0'))], help_text="Base service fee amount")
    additional_bill_charges = models.DecimalField(max_digits=10, decimal_places=2, default=0, validators=[MinValueValidator(Decimal('0'))], help_text="Sum of all additional bill categories")
    amount = models.DecimalField(max_digits=10, decimal_places=2, validators=[MinValueValidator(Decimal('0'))], help_text="Total amount (base + additional) in this transaction")
    remaining_amount = models.DecimalField(max_digits=10, decimal_places=2, default=0, validators=[MinValueValidator(Decimal('0'))], help_text="Remaining amount after this payment")
    currency = models.CharField(max_length=3, default='BDT')
    payment_status = models.CharField(max_length=20, choices=PAYMENT_STATUS_CHOICES, default='pending', help_text="Status of this payment transaction")
    payment_result_status = models.CharField(max_length=20, choices=PAYMENT_RESULT_CHOICES, null=True, blank=True, help_text="Result of this payment: whether it was partial, full, or overpayment at the time of completion")
    
    # Payment dates
    completion_date = models.DateTimeField(null=True, blank=True, help_text="When payment was completed")
    due_date = models.DateField(default='2024-01-01', help_text="Service fee due date")
    
    # Service status (moved from billing)
    service_status = models.CharField(max_length=20, choices=SERVICE_STATUS_CHOICES, default='due', help_text="Service status at time of payment")
    
    # Relations to service_fee, resident, unit (moved from billing)
    service_fee = models.ForeignKey('service_fee.ServiceFee', on_delete=models.CASCADE, related_name='management_payments')
    resident = models.ForeignKey(Member, on_delete=models.CASCADE, related_name='service_fee_management_payments', null=True, blank=True, help_text='DEPRECATED: Legacy field, no longer populated during bill generation. Use owner field instead.')
    unit = models.ForeignKey(Unit, on_delete=models.CASCADE, related_name='service_fee_management_payments')
    
    # Owner information (NEW - Primary contact for billing)
    owner = models.ForeignKey(
        'towers.Owner',
        on_delete=models.PROTECT,
        related_name='service_fee_payments',
        null=True,
        blank=True,
        help_text='Primary contract owner (billing contact) - THE account holder',
        db_column='owner_id'
    )
    owner_name = models.CharField(
        max_length=255,
        null=True,
        blank=True,
        help_text='Owner name snapshot at generation time'
    )
    owner_email = models.EmailField(
        max_length=255,
        null=True,
        blank=True,
        help_text='Owner email snapshot at generation time'
    )
    owner_phone = models.CharField(
        max_length=20,
        null=True,
        blank=True,
        help_text='Owner phone snapshot at generation time'
    )
    
    # DEPRECATED: Account holder fields (redundant with owner fields above)
    # These fields are kept for backward compatibility only
    # For new bills: account_holder_type='owner' and account_holder_id=owner.id
    account_holder_type = models.CharField(
        max_length=20, 
        choices=[('resident', 'Resident'), ('owner', 'Owner')], 
        null=True, 
        blank=True,
        help_text="DEPRECATED: Always 'owner' for new bills. Use owner field instead."
    )
    account_holder_id = models.PositiveBigIntegerField(
        null=True, 
        blank=True,
        help_text="DEPRECATED: Always equals owner_id for new bills. Use owner field instead."
    )
    
    # Penalty snapshot fields
    late_penalty_enabled = models.BooleanField(default=False, help_text="Whether late payment penalties were enabled at time of generation")
    
    # Payment and penalty tracking fields
    total_paid = models.DecimalField(
        max_digits=10, 
        decimal_places=2, 
        default=0, 
        validators=[MinValueValidator(0)], 
        help_text="Total amount paid towards this bill (from billing records)"
    )
    penalty_amount = models.DecimalField(
        max_digits=10, 
        decimal_places=2, 
        default=0, 
        validators=[MinValueValidator(0)], 
        help_text="Current penalty amount (after waivers)"
    )
    waived_amount = models.DecimalField(
        max_digits=10, 
        decimal_places=2, 
        default=0, 
        validators=[MinValueValidator(0)], 
        help_text="Total amount waived (penalties and fees)"
    )
    gross_penalty_amount = models.DecimalField(
        max_digits=10, 
        decimal_places=2, 
        default=0, 
        validators=[MinValueValidator(0)], 
        help_text="Gross penalty amount (before waivers)"
    )
    
    # Generation config reference (one config per SF per period)
    generation_config = models.ForeignKey(
        'ServiceFeeGenerationConfig',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='payments',
        help_text="Reference to the snapshot config at time of generation"
    )
    
    # Bill Number (New)
    bill_number = models.CharField(max_length=100, unique=True, null=True, blank=True, help_text="Unique bill number (e.g., BILL-2024-01-00001)")

    # Audit fields
    created_by = models.ForeignKey(Member, null=True, blank=True, on_delete=models.SET_NULL, related_name='service_fee_management_recorded_payments')
    created_at = models.DateTimeField(auto_now_add=True)
    updated_by = models.ForeignKey(Member, null=True, blank=True, on_delete=models.SET_NULL, related_name='service_fee_management_updated_payments')
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-created_at']
        db_table = 'service_fee_management_servicefeegenerate'  # Renamed from servicefeepayment
        indexes = [
            models.Index(fields=['owner', 'service_period_year', 'service_period_month'], name='idx_payment_owner_period'),
            models.Index(fields=['unit', 'service_period_year', 'service_period_month'], name='idx_payment_unit_period'),
            models.Index(fields=['service_status', 'payment_status'], name='idx_payment_status_combo'),
            models.Index(fields=['service_fee', 'service_period_year', 'service_period_month'], name='idx_payment_fee_period'),
            models.Index(fields=['unit', 'service_fee', 'service_period_year', 'service_period_month'], name='idx_payment_unique_bill'),
            models.Index(fields=['bill_number'], name='idx_payment_bill_number'),
        ]
        # Removed unique_together constraint to allow multiple partial payments per month
        # unique_together = [
        #     ('unit', 'service_period_month', 'service_period_year', 'service_fee'),
        # ]

    def __str__(self):
        contact_name = self.owner_name if self.owner_name else (self.resident.full_name if self.resident else 'No Contact')
        bill_num = f" [{self.bill_number}]" if self.bill_number else ""
        return f"Payment for {contact_name} - {self.service_period_month}/{self.service_period_year} - {self.amount} {self.currency}{bill_num}"

    def save(self, *args, **kwargs):
        # Generate bill_number if not provided
        if not self.bill_number:
            # Use provided month/year if available, else current
            year = self.service_period_year or datetime.now().year
            month = self.service_period_month or datetime.now().month
            prefix = f"BILL-{year}-{month:02d}-"
            self.bill_number = generate_unique_sequential_id(ServiceFeePayment, 'bill_number', prefix, 5)

        # Set completion date when status changes to completed
        if self.payment_status == 'completed' and not self.completion_date:
            from django.utils import timezone
            self.completion_date = timezone.now()
        
        # Save the payment
        super().save(*args, **kwargs)

    # Properties that reference billing data (for backward compatibility in serializers)
    @property
    def service_period_month_property(self):
        """Get service period month from direct field"""
        return self.service_period_month
    
    @property
    def service_period_year_property(self):
        """Get service period year from direct field"""
        return self.service_period_year
    
    @property
    def service_period_display(self):
        """Display service period in readable format"""
        months = [
            'January', 'February', 'March', 'April', 'May', 'June',
            'July', 'August', 'September', 'October', 'November', 'December'
        ]
        if self.service_period_month and self.service_period_year:
            return f"{months[self.service_period_month - 1]} {self.service_period_year}"
        return "N/A"

    @property
    def is_fully_paid(self):
        """Check if service is fully paid"""
        return self.service_status == 'paid'

    @property
    def is_partial_payment(self):
        """Check if service has partial payments"""
        return self.service_status == 'partial'

    @property
    def service_status_display(self):
        """Get formatted service status display"""
        status = self.service_status
        if status == 'paid':
            return 'Paid'
        elif status == 'partial':
            return 'Partial'
        elif status == 'overdue':
            return 'Overdue'
        elif status == 'due':
            return 'Due'
        else:
            return status.capitalize()

    @property
    def payment_result_display(self):
        """Get formatted payment result display - shows the HISTORICAL status of this specific payment"""
        if self.payment_status != 'completed':
            # For non-completed payments, show the payment status
            return self.get_payment_status_display()
        
        if self.payment_result_status == 'full':
            return 'Paid'
        elif self.payment_result_status == 'partial':
            return 'Partial'
        elif self.payment_result_status == 'overpayment':
            return 'Overpayment'
        else:
            # Fallback for old records without payment_result_status
            return 'Completed'


# ==================== SEMANTIC ALIAS ====================
# ServiceFeePayment represents a GENERATED SERVICE FEE BILL, not a payment transaction.
# Aliasing as ServiceFeeGenerate for semantic clarity.
# Both names can be used interchangeably throughout the codebase.
ServiceFeeGenerate = ServiceFeePayment


class Reminder(models.Model):
    """
    Model for automated reminder notifications
    """
    REMINDER_TYPE_CHOICES = [
        ('Scheduled', 'Scheduled'),
        ('Manual Send', 'Manual Send'),
    ]
    
    STATUS_CHOICES = [
        ('Active', 'Active'),
        ('Paused', 'Paused'),
    ]
    
    AUDIENCE_CHOICES = [
        ('All Towers', 'All Towers'),
        ('All Residents', 'All Residents'), 
        ('Specific Tower', 'Specific Tower'),
        ('Specific Units', 'Specific Units'),
        ('Specific Resident', 'Specific Resident'),
        ('Due Only', 'Due Only'),
        ('Overdue Only', 'Overdue Only'),
        ('Paid Only', 'Paid Only'),
    ]

    
    # Basic reminder information
    reminder_name = models.CharField(max_length=255, help_text="Name/title of the reminder")
    reminder_type = models.CharField(max_length=50, choices=REMINDER_TYPE_CHOICES, default='Scheduled')
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='Active')
    
    # Timing configuration - Now supports time-specific scheduling
    # Master send times applied across all timing rules
    send_times = models.JSONField(default=list, null=True, blank=True, help_text="List of times to send reminder (e.g., ['10:00:00', '14:00:00'])")
    # Quick-option fields: a numeric day value and a type for when to send
    # NOTE: `send_when_type` and `send_when_day` were quick-option JSON fields
    # that have been normalized/removed from the DB. Provide read-only
    # properties so code that expects these attributes does not break.
    SEND_WHEN_TYPE_CHOICES = [
        ('before_due', 'Before Due'),
        ('after_due', 'After Due'),
        ('on_due', 'On Due Date'),
        ('specific', 'Specific Day')
    ]

    @property
    def send_when_type(self):
        """Return quick-option send_when types (empty list by default).

        If you previously stored these as a JSON column and need them
        preserved, consider migrating them into a normalized table or
        into the `send_when` structure. For now return an empty list to
        preserve attribute access in code paths that read it.
        """
        return []

    @property
    def send_when_day(self):
        """Return quick-option day values corresponding to `send_when_type`.

        Defaults to an empty list after the DB column was removed.
        """
        return []
    
    # Channel configuration
    app_notification = models.BooleanField(default=False)
    sms = models.BooleanField(default=False) 
    email = models.BooleanField(default=False)
    # NOTE: `payment_status`, `tower_id`, and `specific_target` have been
    # normalized into separate tables (ReminderPaymentStatus, ReminderTower,
    # ReminderSpecificTarget). The DB JSON columns were removed via
    # migrations — expose read-only accessors here so existing code that
    # references these attributes keeps working.

    @property
    def payment_status(self):
        """Return list of payment status strings from normalized table."""
        return [ps.status for ps in self.payment_statuses.all()]

    @property
    def tower_id(self):
        """Return list of tower ids from normalized ReminderTower relations."""
        return [rt.tower_id for rt in self.reminder_towers.all()]

    @property
    def specific_target(self):
        """Return list of specific target ids from normalized ReminderSpecificTarget relations."""
        # The related_name for ReminderSpecificTarget is 'specific_targets'
        return [st.target_id for st in self.specific_targets.all()]

    @property
    def audience(self):
        """Infer audience string from normalized relations where possible.

        Priority order:
        1. If specific targets exist (units/residents), use that audience type
        2. If tower associations exist without specific targets, treat as 'Specific Tower'
        3. Otherwise default to 'All Towers'
        
        This ensures that tower associations used for filtering don't override
        the actual audience type (e.g., 'Specific Units' with tower filtering).
        """
        # PRIORITY 1: Check specific targets first (units, residents, or tower targets)
        # ReminderSpecificTarget related_name is `specific_targets`
        if self.specific_targets.exists():
            first = self.specific_targets.first()
            if first.target_type.lower().startswith('unit'):
                return 'Specific Units'
            if first.target_type.lower().startswith('resident'):
                return 'Specific Resident'
            if first.target_type.lower().startswith('tower'):
                return 'Specific Tower'
        
        # PRIORITY 2: If explicit tower associations exist (without specific targets)
        # This is the fallback case for tower-only reminders
        if self.reminder_towers.exists():
            return 'Specific Tower'
            
        # PRIORITY 3: Default
        return 'All Towers'
    
    # Message content
    message_preview = models.TextField(help_text="Template message for the reminder")
    
    # Tracking
    total_sent = models.IntegerField(default=0, help_text="Total number of reminders sent")
    last_sent = models.DateTimeField(null=True, blank=True, help_text="When this reminder was last sent")
    last_sent_timing = models.CharField(max_length=255, blank=True, null=True, help_text="Last timing rule that was sent (e.g., '1 day before due at 10:00')")
    
    # Metadata
    created_by = models.ForeignKey(Member, on_delete=models.CASCADE, related_name='created_reminders', null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    class Meta:
        db_table = 'service_fee_reminders'
        ordering = ['-created_at']
    
    def __str__(self):
        return f"{self.reminder_name} ({self.reminder_type})"
    
    @property
    def channels_active(self):
        """Get list of active channels"""
        channels = []
        if self.app_notification:
            channels.append('App')
        if self.sms:
            channels.append('SMS')
        if self.email:
            channels.append('Email')
        return channels
    
    @property
    def is_scheduled(self):
        """Check if reminder is scheduled type"""
        return self.reminder_type == 'Scheduled'
    
    @property
    def is_active(self):
        """Check if reminder is active"""
        return self.status == 'Active'
    
    @property
    def timing_rules_list(self):
        """Get list of timing rules from related table"""
        return self.timing_rules.all()
    
    @property
    def payment_status_list(self):
        """Get list of payment statuses from related table"""
        return [ps.status for ps in self.payment_statuses.all()]
    
    @property
    def tower_ids_list(self):
        """Get list of tower IDs from related table"""
        return [rt.tower_id for rt in self.reminder_towers.all()]
    
    @property
    def specific_targets_list(self):
        """Get list of specific targets from related table"""
        return [{'type': st.target_type, 'id': st.target_id} for st in self.specific_targets.all()]
    
    @property
    def send_when(self):
        """Get list of timing rules as dictionaries (for backward compatibility)
        
        Returns timing rules from the normalized ReminderTiming table in a format
        compatible with the scheduler's expectations.
        """
        return [
            {
                'timing': rule.timing_label,
                'type': rule.timing_type,
                'day_offset': rule.day_offset
            }
            for rule in self.timing_rules.all()
        ]


class ReminderTiming(models.Model):
    """
    Normalized table for reminder timing rules
    Replaces JSON columns: send_when, send_when_type, send_when_day, send_when_times
    """
    TIMING_TYPE_CHOICES = [
        ('before_due', 'Before Due'),
        ('after_due', 'After Due'),
        ('on_due', 'On Due Date'),
        ('specific', 'Specific Day'),
    ]
    
    # Foreign key to parent reminder
    reminder = models.ForeignKey('Reminder', on_delete=models.CASCADE, related_name='timing_rules', help_text="Parent reminder")
    
    # Timing configuration
    timing_type = models.CharField(max_length=20, choices=TIMING_TYPE_CHOICES, help_text="Type of timing rule")
    day_offset = models.IntegerField(default=0, help_text="Number of days (0 for 'on_due', N for before/after)")
    timing_label = models.CharField(max_length=255, help_text="Human-readable timing description (e.g., '3 days before due')")
    
    # Metadata
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    class Meta:
        db_table = 'service_fee_reminder_timings'
        ordering = ['timing_type', 'day_offset', 'id']
        indexes = [
            models.Index(fields=['reminder', 'timing_type']),
            models.Index(fields=['reminder', 'day_offset']),
        ]
    
    def __str__(self):
        return f"{self.reminder.reminder_name} - {self.timing_label}"


class ReminderPaymentStatus(models.Model):
    """
    Normalized table for reminder payment status filters
    Replaces payment_status JSON column
    """
    STATUS_CHOICES = [
        ('all', 'All'),
        ('paid', 'Paid'),
        ('due', 'Due'),
        ('overdue', 'Overdue'),
        ('partial', 'Partial'),
    ]
    
    # Foreign key to parent reminder
    reminder = models.ForeignKey('Reminder', on_delete=models.CASCADE, related_name='payment_statuses', help_text="Parent reminder")
    
    # Payment status
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, help_text="Payment status to filter")
    
    # Metadata
    created_at = models.DateTimeField(auto_now_add=True)
    
    class Meta:
        db_table = 'service_fee_reminder_payment_statuses'
        unique_together = [['reminder', 'status']]
        ordering = ['status']
    
    def __str__(self):
        return f"{self.reminder.reminder_name} - {self.status}"


class ReminderTower(models.Model):
    """
    Normalized table for reminder tower associations
    Replaces tower_id JSON column
    """
    # Foreign key to parent reminder
    reminder = models.ForeignKey('Reminder', on_delete=models.CASCADE, related_name='reminder_towers', help_text="Parent reminder")
    
    # Tower reference
    tower = models.ForeignKey('towers.Tower', on_delete=models.CASCADE, help_text="Associated tower")
    
    # Metadata
    created_at = models.DateTimeField(auto_now_add=True)
    
    class Meta:
        db_table = 'service_fee_reminder_towers'
        unique_together = [['reminder', 'tower']]
        ordering = ['tower__tower_name']
    
    def __str__(self):
        return f"{self.reminder.reminder_name} - {self.tower.tower_name}"


class ReminderSpecificTarget(models.Model):
    """
    Normalized table for reminder specific targets (towers, units, or residents)
    Replaces specific_target JSON column
    """
    TARGET_TYPE_CHOICES = [
        ('tower', 'Tower'),
        ('unit', 'Unit'),
        ('resident', 'Resident'),
    ]
    
    # Foreign key to parent reminder
    reminder = models.ForeignKey('Reminder', on_delete=models.CASCADE, related_name='specific_targets', help_text="Parent reminder")
    
    # Target type and ID
    target_type = models.CharField(max_length=20, choices=TARGET_TYPE_CHOICES, help_text="Type of target")
    target_id = models.IntegerField(help_text="ID of the target (tower_id, unit_id, or resident_id)")
    
    # Metadata
    created_at = models.DateTimeField(auto_now_add=True)
    
    class Meta:
        db_table = 'service_fee_reminder_specific_targets'
        unique_together = [['reminder', 'target_type', 'target_id']]
        indexes = [
            models.Index(fields=['reminder', 'target_type']),
            models.Index(fields=['target_type', 'target_id']),
        ]
        ordering = ['target_type', 'target_id']
    
    def __str__(self):
        return f"{self.reminder.reminder_name} - {self.target_type} #{self.target_id}"


class ReminderLog(models.Model):
    """
    Model to track individual reminder sends
    """
    DELIVERY_STATUS_CHOICES = [
        ('pending', 'Pending'),
        ('sent', 'Sent'),
        ('delivered', 'Delivered'),
        ('failed', 'Failed'),
    ]
    
    reminder = models.ForeignKey(Reminder, on_delete=models.CASCADE, related_name='logs')
    recipient = models.ForeignKey(Member, on_delete=models.CASCADE, related_name='received_reminders', null=True, blank=True)
    unit = models.ForeignKey(Unit, on_delete=models.CASCADE, related_name='unit_reminders', null=True, blank=True)
    
    # Channel used for this specific send
    channel = models.CharField(max_length=20, help_text="Channel used: App, SMS, Email")
    
    # Timing tracking (store timing_rule_id without FK to avoid missing-table issues)
    timing_rule_id = models.IntegerField(null=True, blank=True, help_text="Timing rule id that triggered this send")
    send_time = models.CharField(max_length=10, null=True, blank=True, help_text="Time when reminder was sent (HH:MM format)")
    
    # Message details
    message_content = models.TextField(help_text="Actual message sent")
    
    # Delivery tracking
    delivery_status = models.CharField(max_length=20, choices=DELIVERY_STATUS_CHOICES, default='pending')
    sent_at = models.DateTimeField(auto_now_add=True)
    delivered_at = models.DateTimeField(null=True, blank=True)
    
    # Error tracking
    error_message = models.TextField(blank=True, null=True)
    
    class Meta:
        db_table = 'service_fee_reminder_logs'
        ordering = ['-sent_at']
        indexes = [
            models.Index(fields=['reminder', 'unit', 'sent_at']),
            models.Index(fields=['reminder', 'timing_rule_id', 'send_time', 'sent_at']),
        ]
    
    def __str__(self):
        return f"{self.reminder.reminder_name} -> {self.recipient.user.username} ({self.channel})"


class ServiceFeeGenerationSchedule(models.Model):
    """
    Model to configure automatic service fee generation schedules
    Supports tower-wise configuration
    """
    STATUS_CHOICES = [
        ('active', 'Active'),
        ('inactive', 'Inactive'),
    ]
    
    # Schedule identification
    schedule_name = models.CharField(max_length=200, help_text="Name for this schedule (e.g., 'Tower 1 Monthly Generation')")
    
    # Tower configuration (None = all towers)
    tower = models.ForeignKey(
        'towers.Tower', 
        on_delete=models.CASCADE, 
        related_name='service_fee_schedules',
        null=True, 
        blank=True,
        help_text="Specific tower for this schedule (leave empty for all towers)"
    )
    
    # Service fee filter (None = all active service fees)
    service_fee = models.ForeignKey(
        ServiceFee,
        on_delete=models.CASCADE,
        related_name='generation_schedules',
        null=True,
        blank=True,
        help_text="Specific service fee (leave empty for all active service fees)"
    )
    
    # Unit filter (comma-separated unit IDs, None = all units)
    unit_ids = models.CharField(
        max_length=500,
        blank=True,
        null=True,
        help_text="Comma-separated unit IDs (e.g., '12604,12605') or leave empty for all units"
    )
    
    # Schedule timing
    generation_day = models.IntegerField(
        default=1,
        help_text="Day of month to generate (1-31, e.g., 1 for 1st, 2 for 2nd)"
    )
    generation_hour = models.IntegerField(
        default=14,
        help_text="Hour to generate (0-23, e.g., 14 for 2 PM)"
    )
    generation_minute = models.IntegerField(
        default=15,
        help_text="Minute to generate (0-59, e.g., 15 for :15)"
    )
    
    # Recurring frequency
    RECURRING_FREQUENCY_CHOICES = [
        ('daily', 'Daily'),
        ('weekly', 'Weekly'),
        ('monthly', 'Monthly'),
    ]
    recurring_frequency = models.CharField(
        max_length=20,
        choices=RECURRING_FREQUENCY_CHOICES,
        default='monthly',
        help_text="How often to generate service fees (daily, weekly, monthly)"
    )
    is_recurring = models.BooleanField(
        default=True,
        help_text="Whether this schedule is recurring"
    )
    
    # Status
    status = models.CharField(
        max_length=20,
        choices=STATUS_CHOICES,
        default='active',
        help_text="Schedule status"
    )
    
    # Last execution tracking
    last_executed = models.DateTimeField(null=True, blank=True, help_text="Last time this schedule was executed")
    last_execution_result = models.TextField(blank=True, null=True, help_text="Result of last execution")
    
    # Audit fields
    created_by = models.ForeignKey(Member, null=True, blank=True, on_delete=models.SET_NULL, related_name='created_schedules')
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    class Meta:
        db_table = 'service_fee_generation_schedules'
        ordering = ['tower_id', 'generation_day', 'generation_hour', 'generation_minute']
        verbose_name = 'Service Fee Generation Schedule'
        verbose_name_plural = 'Service Fee Generation Schedules'
    
    def __str__(self):
        tower_name = self.tower.tower_name if self.tower else "All Towers"
        return f"{self.schedule_name} - {tower_name} (Day {self.generation_day} at {self.generation_hour:02d}:{self.generation_minute:02d})"
    
    @property
    def is_active(self):
        """Check if schedule is active"""
        return self.status == 'active'
    
    def should_run_now(self, current_datetime):
        """
        Check if this schedule should run at the given datetime
        Handles daily, weekly, and monthly recurring frequencies
        
        Args:
            current_datetime: datetime object to check against
        
        Returns:
            bool: True if schedule should run now
        """
        if not self.is_active:
            return False
        
        if not self.is_recurring:
            # Non-recurring schedules only run once
            if self.last_executed:
                return False
            # Check if day, hour, and minute match
            if (current_datetime.day == self.generation_day and
                current_datetime.hour == self.generation_hour and
                current_datetime.minute == self.generation_minute):
                return True
            return False
        
        # For recurring schedules, check based on frequency
        frequency = self.recurring_frequency or 'monthly'
        
        # First check if hour and minute match
        if (current_datetime.hour != self.generation_hour or
            current_datetime.minute != self.generation_minute):
            return False
        
        # Check if we already executed today (prevent duplicate runs)
        if self.last_executed:
            last_executed_date = self.last_executed.date()
            current_date = current_datetime.date()
            if last_executed_date == current_date:
                return False  # Already executed today
        
        # Check based on recurring frequency
        if frequency == 'daily':
            # Daily: Run every day at the specified time
            return True
        
        elif frequency == 'weekly':
            # Weekly: Run on the same day of week
            # Use generation_day as day of week (0=Monday, 6=Sunday)
            # If generation_day > 6, use modulo 7
            target_weekday = (self.generation_day - 1) % 7  # Convert 1-31 to 0-6 (Monday-Sunday)
            current_weekday = current_datetime.weekday()  # 0=Monday, 6=Sunday
            return current_weekday == target_weekday
        
        elif frequency == 'monthly':
            # Monthly: Run on the specified day of month
            # Handle months with fewer days (e.g., day 31 in February)
            from calendar import monthrange
            last_day_of_month = monthrange(current_datetime.year, current_datetime.month)[1]
            target_day = min(self.generation_day, last_day_of_month)
            return current_datetime.day == target_day
        
        # Default: monthly behavior
        from calendar import monthrange
        last_day_of_month = monthrange(current_datetime.year, current_datetime.month)[1]
        target_day = min(self.generation_day, last_day_of_month)
        return current_datetime.day == target_day

# ==================== SSLCommerz - COMMENTED OUT ====================
# Replaced with PayStation payment gateway
# class SSLCommerzTransactionMapping(models.Model):
#     """
#     Temporary mapping table for SSLCommerz transactions to payment IDs.
#     SSLCommerz sandbox doesn't reliably return value_a/b/c in callbacks,
#     so we maintain a server-side mapping that expires after 1 hour.
#     """
#     transaction_id = models.CharField(max_length=100, unique=True, db_index=True, help_text="SSLCommerz transaction ID")
#     payment_ids = models.TextField(help_text="Comma-separated payment IDs")
#     unit_id = models.IntegerField(help_text="Unit ID")
#     service_fee_id = models.IntegerField(help_text="Service Fee ID")
#     amount = models.DecimalField(max_digits=10, decimal_places=2, help_text="Total transaction amount")
#     created_at = models.DateTimeField(auto_now_add=True)
#     expires_at = models.DateTimeField(help_text="When this mapping expires (1 hour from creation)")
#     
#     class Meta:
#         db_table = 'service_fee_sslcommerz_transaction_mapping'
#         ordering = ['-created_at']
#     
#     def __str__(self):
#         return f"{self.transaction_id} -> {self.payment_ids}"
#     
#     @classmethod
#     def create_mapping(cls, transaction_id, payment_ids, unit_id, service_fee_id, amount):
#         """Create a new transaction mapping that expires in 1 hour"""
#         from django.utils import timezone
#         from datetime import timedelta
#         
#         expires_at = timezone.now() + timedelta(hours=1)
#         payment_ids_str = ','.join([str(pid) for pid in payment_ids])
#         
#         mapping = cls.objects.create(
#             transaction_id=transaction_id,
#             payment_ids=payment_ids_str,
#             unit_id=unit_id,
#             service_fee_id=service_fee_id,
#             amount=amount,
#             expires_at=expires_at
#         )
#         return mapping
#     
#     @classmethod
#     def get_payment_ids(cls, transaction_id):
#         \"\"\"Get payment IDs for a transaction, if mapping exists and hasn't expired\"\"\"
#         from django.utils import timezone
#         
#         try:
#             mapping = cls.objects.get(
#                 transaction_id=transaction_id,
#                 expires_at__gt=timezone.now()
#             )
#             # Parse comma-separated payment IDs
#             payment_ids = [int(pid.strip()) for pid in mapping.payment_ids.split(',') if pid.strip()]
#             return payment_ids
#         except cls.DoesNotExist:
#             return None
#     
#     @classmethod
#     def cleanup_expired(cls):
#         \"\"\"Delete expired mappings\"\"\"
#         from django.utils import timezone
#         deleted_count = cls.objects.filter(expires_at__lte=timezone.now()).delete()[0]
#         return deleted_count
# ==================== END SSLCommerz ====================


# ==================== PAYSTATION PAYMENT GATEWAY ====================
class PayStationTransactionMapping(models.Model):
    """
    Mapping table for PayStation transactions to payment IDs.
    Stores invoice_number and related payment information for verification.
    """
    invoice_number = models.CharField(max_length=100, unique=True, db_index=True, help_text="PayStation invoice number")
    payment_ids = models.TextField(help_text="Comma-separated payment IDs")
    unit_id = models.IntegerField(help_text="Unit ID")
    service_fee_id = models.IntegerField(help_text="Service Fee ID")
    amount = models.DecimalField(max_digits=10, decimal_places=2, help_text="Total transaction amount")
    reference = models.CharField(max_length=255, blank=True, null=True, help_text="Additional reference information")
    is_advance_payment = models.BooleanField(default=False, help_text="Whether this is an advance payment")
    created_at = models.DateTimeField(auto_now_add=True)
    expires_at = models.DateTimeField(help_text="When this mapping expires (24 hours from creation)")
    
    class Meta:
        db_table = 'service_fee_paystation_transaction_mapping'
        ordering = ['-created_at']
    
    def __str__(self):
        return f"{self.invoice_number} -> {self.payment_ids}"
    
    @classmethod
    def create_mapping(cls, invoice_number, payment_ids, unit_id, service_fee_id, amount, reference='', is_advance_payment=False):
        """Create a new transaction mapping that expires in 24 hours"""
        from django.utils import timezone
        from datetime import timedelta
        
        expires_at = timezone.now() + timedelta(hours=24)
        payment_ids_str = ','.join([str(pid) for pid in payment_ids])
        
        mapping = cls.objects.create(
            invoice_number=invoice_number,
            payment_ids=payment_ids_str,
            unit_id=unit_id,
            service_fee_id=service_fee_id,
            amount=amount,
            reference=reference,
            is_advance_payment=is_advance_payment,
            expires_at=expires_at
        )
        return mapping
    
    @classmethod
    def get_payment_ids(cls, invoice_number):
        """Get payment IDs for an invoice, if mapping exists and hasn't expired"""
        from django.utils import timezone
        
        try:
            mapping = cls.objects.get(
                invoice_number=invoice_number,
                expires_at__gt=timezone.now()
            )
            # Parse comma-separated payment IDs
            payment_ids = [int(pid.strip()) for pid in mapping.payment_ids.split(',') if pid.strip()]
            return payment_ids
        except cls.DoesNotExist:
            return None
    
    @classmethod
    def cleanup_expired(cls):
        """Delete expired mappings"""
        from django.utils import timezone
        deleted_count = cls.objects.filter(expires_at__lte=timezone.now()).delete()[0]
        return deleted_count
# ==================== END PAYSTATION ====================


# ==================== BILL UPLOAD MODELS ====================

class BillUpload(models.Model):
    """
    Model for monthly bill uploads (e.g., Electricity, Gas, Water bills)
    """
    # Upload identification
    upload_id = models.CharField(max_length=100, unique=True, help_text="Unique upload identifier (e.g., BILL-ELEC-2024-01-00001)")
    
    # Category (legacy and FK)
    bill_category = models.ForeignKey(BillCategory, on_delete=models.PROTECT, related_name='bill_uploads', help_text="Bill category", null=True, blank=True)
    category = models.CharField(max_length=50, help_text="Bill category name (legacy field)", null=True, blank=True)
    
    # Upload method
    upload_method = models.CharField(max_length=20, choices=[('manual', 'Manual Entry'), ('csv', 'CSV Upload')], default='manual')
    file_name = models.CharField(max_length=255, blank=True, null=True, help_text="Original filename of the uploaded file")
    
    # Status
    is_active = models.BooleanField(default=True)
    
    # Audit fields
    created_by = models.ForeignKey(Member, on_delete=models.SET_NULL, null=True, blank=True, related_name='created_bill_uploads')
    created_at = models.DateTimeField(auto_now_add=True)
    updated_by = models.ForeignKey(Member, on_delete=models.SET_NULL, null=True, blank=True, related_name='updated_bill_uploads')
    updated_at = models.DateTimeField(auto_now=True)
    
    class Meta:
        db_table = 'bill_uploads'
        ordering = ['-created_at']
        # Batch-level uniqueness is now handled by details; keep upload_id unique
        unique_together = [['upload_id']]
    
    def __str__(self):
        return f"{self.category} - {self.tower.tower_name} - {self.upload_year}-{self.upload_month:02d}"
    
    def save(self, *args, **kwargs):
        # Generate upload_id if not set
        if not self.upload_id:
            import random
            category_prefix = (self.category or 'GEN')[:4].upper()
            now = datetime.now()
            
            # Add random component to prevent duplicates when creating multiple records quickly
            # Try up to 10 times to generate a unique ID
            for attempt in range(10):
                random_suffix = random.randint(10000, 99999)
                self.upload_id = f"BILL-{category_prefix}-{now.year}-{now.month:02d}-{random_suffix}"
                
                # Check if this ID already exists
                if not BillUpload.objects.filter(upload_id=self.upload_id).exists():
                    break
                    
                # If we're on the last attempt and still have a duplicate, add timestamp
                if attempt == 9:
                    timestamp_suffix = int(time.time() * 1000) % 1000000
                    self.upload_id = f"BILL-{category_prefix}-{now.year}-{now.month:02d}-{timestamp_suffix}"
        
        super().save(*args, **kwargs)


class BillUploadDetail(models.Model):
    """
    Model for individual unit bill details within an upload
    """
    # Link to upload batch
    bill_upload = models.ForeignKey(BillUpload, on_delete=models.CASCADE, related_name='details')

    # Associate service_fee, tower and upload period per-detail (moved from BillUpload)
    service_fee = models.ForeignKey(ServiceFee, on_delete=models.PROTECT, related_name='bill_upload_details', help_text="Associated service fee", null=True, blank=True)
    tower = models.ForeignKey(Tower, on_delete=models.PROTECT, related_name='bill_upload_details', help_text="Tower for this detail", null=True, blank=True)
    upload_month = models.IntegerField(validators=[MinValueValidator(1)], help_text="Month for which this detail applies (1-12)", null=True, blank=True)
    upload_year = models.IntegerField(validators=[MinValueValidator(2020)], help_text="Year for which this detail applies", null=True, blank=True)

    # Unit details
    unit = models.ForeignKey(Unit, on_delete=models.PROTECT, related_name='bill_upload_details')
    
    # Consumption details
    unit_of_measurement = models.CharField(max_length=20, blank=True, null=True, help_text="e.g., kWh, cubic meters")
    price_per_unit = models.DecimalField(max_digits=10, decimal_places=2, default=0, validators=[MinValueValidator(0)], help_text="Price per unit")
    previous_reading = models.DecimalField(max_digits=10, decimal_places=2, default=0, validators=[MinValueValidator(0)], help_text="Previous meter reading")
    current_reading = models.DecimalField(max_digits=10, decimal_places=2, default=0, validators=[MinValueValidator(0)], help_text="Current meter reading")
    consumption = models.DecimalField(max_digits=10, decimal_places=2, default=0, validators=[MinValueValidator(0)], help_text="Consumption amount")
    
    # Bill amount
    amount = models.DecimalField(max_digits=10, decimal_places=2, validators=[MinValueValidator(0)], help_text="Total bill amount in BDT")
    
    # Audit fields
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    class Meta:
        db_table = 'bill_upload_details'
        ordering = ['unit__unit_name']
        unique_together = [['bill_upload', 'unit']]
        indexes = [
            models.Index(fields=['unit', 'service_fee', 'upload_year', 'upload_month']),
            models.Index(fields=['service_fee', 'upload_year', 'upload_month']),
        ]
    
    def __str__(self):
        return f"{self.bill_upload.upload_id} - {self.unit.unit_name} - ৳{self.amount}"
    
    def save(self, *args, **kwargs):
        # Auto-calculate consumption if readings are provided
        if self.current_reading and self.previous_reading:
            self.consumption = self.current_reading - self.previous_reading
        
        # Auto-calculate amount if consumption and price_per_unit are provided
        if self.consumption and self.price_per_unit:
            self.amount = self.consumption * self.price_per_unit
        
        super().save(*args, **kwargs)


class ServiceFeeBillCategory(models.Model):
    """
    Model for Service Fee Bill Categories (containing detail columns as requested)
    """
    # FKs based on schema
    servicefeepaymentid = models.ForeignKey(ServiceFeePayment, on_delete=models.PROTECT, related_name='service_fee_bill_categories', help_text="Linked service fee payment")
    bill_category = models.ForeignKey(BillCategory, on_delete=models.PROTECT, related_name='service_fee_bill_categories', null=True, blank=True)
    
    service_fee = models.ForeignKey(ServiceFee, on_delete=models.PROTECT, related_name='service_fee_bill_categories', null=True, blank=True)
    tower = models.ForeignKey(Tower, on_delete=models.PROTECT, related_name='service_fee_bill_categories', null=True, blank=True)
    # upload_month = models.IntegerField(validators=[MinValueValidator(1)], null=True, blank=True)
    # upload_year = models.IntegerField(validators=[MinValueValidator(2020)], null=True, blank=True)

    unit = models.ForeignKey(Unit, on_delete=models.PROTECT, related_name='service_fee_bill_categories')
    
    # Detail fields
    unit_of_measurement = models.CharField(max_length=20, blank=True, null=True)
    price_per_unit = models.DecimalField(max_digits=10, decimal_places=2, default=0, validators=[MinValueValidator(0)])
    previous_reading = models.DecimalField(max_digits=10, decimal_places=2, default=0, validators=[MinValueValidator(0)])
    current_reading = models.DecimalField(max_digits=10, decimal_places=2, default=0, validators=[MinValueValidator(0)])
    consumption = models.DecimalField(max_digits=10, decimal_places=2, default=0, validators=[MinValueValidator(0)])
    
    amount = models.DecimalField(max_digits=10, decimal_places=2, validators=[MinValueValidator(0)])
    
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'service_fee_bill_categories'
        verbose_name_plural = 'Service Fee Bill Categories'
        ordering = ['unit__unit_name']

    def __str__(self):
        return f"{self.unit.unit_name} - {self.amount}"

    def save(self, *args, **kwargs):
        # Auto-calculate consumption if readings are provided
        if self.current_reading and self.previous_reading:
            self.consumption = self.current_reading - self.previous_reading
        
        # Auto-calculate amount if consumption and price_per_unit are provided
        if self.consumption and self.price_per_unit:
            self.amount = self.consumption * self.price_per_unit
        
        super().save(*args, **kwargs)


class AdvancePayment(models.Model):
    """
    Model to track advance payments when user overpays
    When a payment exceeds the required amount, the excess is stored as advance
    to be applied to future months
    """
    ADVANCE_TYPE_CHOICES = [
        ('auto_excess', 'Auto-generated from excess payment'),
        ('service_fee_advance', 'Service Fee Advance'),
        ('advance_payment', 'Advance Payment'),  # Used for both pure advance and overpayment
        ('other_advance', 'Other Advance'),
    ]
    
    STATUS_CHOICES = [
        ('available', 'Available for use'),
        ('partial', 'Partially applied'),
        ('applied', 'Fully applied'),
        ('cancelled', 'Cancelled'),
    ]
    
    # Identification
    unit = models.ForeignKey(Unit, on_delete=models.CASCADE, related_name='advance_payments', help_text="Unit for which advance is held")
    resident = models.ForeignKey(Member, on_delete=models.SET_NULL, null=True, blank=True, related_name='advance_payments', help_text="Resident associated with advance")
    
    # Account holder identification (Resident or Owner)
    account_holder_type = models.CharField(
        max_length=20, 
        choices=[('resident', 'Resident'), ('owner', 'Owner')], 
        null=True, 
        blank=True,
        db_collation="utf8mb4_0900_ai_ci",
        help_text="Type of account holder who owns this advance"
    )
    account_holder_id = models.PositiveBigIntegerField(
        null=True, 
        blank=True,
        help_text="ID of the resident or owner record"
    )
    
    # Advance details
    advance_type = models.CharField(max_length=20, choices=ADVANCE_TYPE_CHOICES, default='auto_excess', help_text="How advance payment was created")
    amount = models.DecimalField(max_digits=10, decimal_places=2, validators=[MinValueValidator(0)], help_text="Total advance amount held")
    applied_amount = models.DecimalField(max_digits=10, decimal_places=2, default=0, validators=[MinValueValidator(0)], help_text="Amount already applied to payments")
    remaining_amount = models.DecimalField(max_digits=10, decimal_places=2, default=0, validators=[MinValueValidator(0)], help_text="Available advance balance")
    
    # Source information - Reference to payment detail (ServiceFeeBilling) instead of ServiceFeePayment
    source_billing = models.ForeignKey(
        'ServiceFeeBilling',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='generated_advances',
        help_text="Billing record (payment detail) that generated this advance"
    )
    
    # Payment method used to create this advance
    payment_method = models.ForeignKey(
        'PaymentMethod',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='advance_payments',
        help_text="Payment method used to create this advance payment"
    )
    
    # Status tracking
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='available', help_text="Current status of advance payment")
    currency = models.CharField(max_length=3, default='BDT')
    
    # Dates
    created_at = models.DateTimeField(auto_now_add=True)
    applied_at = models.DateTimeField(null=True, blank=True, help_text="When advance was fully applied")
    expired_at = models.DateTimeField(null=True, blank=True, help_text="When advance expires if not used (optional)")
    
    # Audit fields
    created_by = models.ForeignKey(Member, null=True, blank=True, on_delete=models.SET_NULL, related_name='created_advance_payments')
    notes = models.TextField(blank=True, null=True, help_text="Notes about this advance payment")
    
    class Meta:
        ordering = ['-created_at']
        db_table = 'service_fee_advance_payments'
        indexes = [
            models.Index(fields=['unit', 'status']),
            models.Index(fields=['status', '-created_at']),
            models.Index(fields=['account_holder_type', 'account_holder_id']),
        ]
    
    def __str__(self):
        return f"Advance Payment - {self.unit.unit_name} - ৳{self.amount} - {self.status}"
    
    def save(self, *args, **kwargs):
        # Auto-calculate remaining amount
        self.remaining_amount = self.amount - self.applied_amount
        
        # Update status based on remaining amount
        if self.remaining_amount <= 0:
            self.status = 'applied'
            from django.utils import timezone
            self.applied_at = timezone.now()
        elif self.applied_amount > 0:
            self.status = 'partial'
        else:
            self.status = 'available'
        
        super().save(*args, **kwargs)
    
    def apply_to_payment(self, amount_to_apply):
        """
        Apply advance payment to a new payment
        Returns amount actually applied
        """
        from decimal import Decimal
        
        amount_to_apply = Decimal(str(amount_to_apply))
        if amount_to_apply > self.remaining_amount:
            amount_to_apply = self.remaining_amount
        
        self.applied_amount += amount_to_apply
        self.save()
        
        return amount_to_apply


class ServiceFeePaymentAllocation(models.Model):
    """
    Model to track how payment amounts are allocated to specific service fee items.
    Replaces service_fee_payment_details to support hierarchical payments.
    Links a payment selection (Billing) to a liability (Item).
    """
    
    # Link to the Money (The Transaction/Billing Record)
    service_fee_billing = models.ForeignKey(
        'ServiceFeeBilling',
        on_delete=models.CASCADE,
        related_name='allocations',
        help_text="Related billing record (source of funds)"
    )
    
    # Link to the Liability (The Item being paid)
    service_fee_item = models.ForeignKey(
        'ServiceFeeItem',
        on_delete=models.CASCADE,
        related_name='allocations',
        help_text="Specific item being paid (destination of funds)"
    )
    
    # Redundant but useful link to main payment context
    service_fee_payment = models.ForeignKey(
        'ServiceFeePayment',
        on_delete=models.CASCADE,
        related_name='allocations',
        help_text="Parent payment transaction context"
    )
    
    # Amount from this billing allocated to this item
    allocated_amount = models.DecimalField(
        max_digits=10,
        decimal_places=2,
        validators=[MinValueValidator(Decimal('0'))],
        help_text="Amount allocated to this item"
    )

    ALLOCATION_TYPE_CHOICES = [
        ('debit', 'Debit (Cash Payment)'),
        ('credit', 'Credit (Penalty Waiver)'),
        ('advance', 'Advance (Advance Adjustment)'),
    ]

    allocation_type = models.CharField(
        max_length=20,
        choices=ALLOCATION_TYPE_CHOICES,
        default='debit',
        help_text="Debit = cash payment received, Credit = waiver reduces liability"
    )

    # Link to waiver if this is a credit (waiver) allocation
    penalty_waiver = models.ForeignKey(
        'PenaltyWaiver',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='allocations',
        help_text="Related waiver record if allocation_type is 'credit'"
    )
    
    # Description/Notes
    description = models.TextField(
        blank=True,
        null=True,
        help_text="Details about this allocation"
    )
    
    # Audit fields
    created_at = models.DateTimeField(auto_now_add=True)
    
    class Meta:
        db_table = 'service_fee_payment_allocations'
        ordering = ['created_at']
        indexes = [
            models.Index(fields=['service_fee_billing']),
            models.Index(fields=['service_fee_item']),
            models.Index(fields=['allocation_type']),
            models.Index(fields=['service_fee_billing', 'service_fee_item']),
        ]
    
    def __str__(self):
        return f"Allocation: {self.service_fee_item.item_name} ({self.allocation_type}) - ৳{self.allocated_amount}"


class ServiceFeeItem(models.Model):
    """
    Model to track service fee items generated for a unit in a specific period.
    Created when service fees are GENERATED to show breakdown of charges.
    Unlike ServiceFeePaymentDetail (payment breakdown),
    this tracks what ITEMS EXIST for a unit+period at generation time.
    """
    
    service_fee_payment = models.ForeignKey(
        'ServiceFeePayment',
        on_delete=models.CASCADE,
        related_name='items',
        help_text='Parent service fee payment for this unit+period'
    )
    
    item_type = models.CharField(
        max_length=50,
        help_text='Type of item: Service Fee, Late Fee, or dynamic bill category name'
    )

    item_name = models.CharField(
        max_length=100,
        help_text="Readable name of the item (e.g. Service Fee, Electricity)",
        null=True,
        blank=True
    )
    
    amount = models.DecimalField(
        max_digits=10,
        decimal_places=2,
        validators=[MinValueValidator(Decimal('0'))],
        help_text='Amount for this item'
    )
    
    bill_category = models.ForeignKey(
        'bill_categories.BillCategory',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='fee_items',
        help_text='Bill category if item_type is bill_category'
    )
    
    # Link to source bill upload detail (contains consumption/reading data)
    bill_upload_detail = models.ForeignKey(
        'BillUploadDetail',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='generated_items',
        help_text='Source bill upload detail that created this item (for bill_category items) - contains consumption and reading data'
    )
    
    penalty_tier = models.ForeignKey(
        'ServiceFeePaymentLatePenaltyTier',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='penalty_items',
        help_text='Penalty tier snapshot if item_type is penalty'
    )
    
    penalty_waiver = models.ForeignKey(
        'PenaltyWaiver',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='fee_items',
        help_text='Penalty waiver record if item_type is penalty'
    )
    
    description = models.TextField(
        blank=True,
        null=True,
        help_text='Details about this item'
    )
    
    created_at = models.DateTimeField(auto_now_add=True)
    
    class Meta:
        db_table = 'service_fee_management_servicefeeitem'
        ordering = ['created_at']
        indexes = [
            models.Index(fields=['service_fee_payment', 'item_type']),
            models.Index(fields=['bill_category']),
            models.Index(fields=['bill_upload_detail']),  # Index for upload detail tracking
            models.Index(fields=['penalty_tier']),
        ]
    
    def __str__(self):
        return f'Item: {self.item_type} - ৳{self.amount}'


class ServiceFeePaymentLatePenaltyTier(models.Model):
    """
    Snapshot of LatePenaltyTier at the time of service fee generation.
    Ensures that historical payments are not affected by changes to global penalty settings.
    """
    payment = models.ForeignKey(
        'ServiceFeePayment',
        on_delete=models.CASCADE,
        related_name='penalty_tiers',
        help_text="Parent payment record"
    )
    days_overdue = models.IntegerField(
        validators=[MinValueValidator(1), MaxValueValidator(31)],
        help_text="Number of days overdue for this penalty tier (1-31)"
    )
    penalty_percentage = models.DecimalField(
        max_digits=5,
        decimal_places=2,
        validators=[MinValueValidator(1.01), MaxValueValidator(100)],
        help_text="Penalty percentage (>1 and <=100)"
    )
    
    tier_name = models.CharField(
        max_length=100,
        blank=True,
        null=True,
        help_text="Name of the penalty tier (e.g., 'Standard Penalty', 'Late Payment Fee')"
    )
    
    penalty_calculation_basis = models.CharField(
        max_length=50,
        blank=True,
        null=True,
        help_text="Basis for penalty calculation (e.g., 'base_amount', 'total_amount')"
    )
    
    # Ordering field to ensure tiers are in ascending order
    order = models.IntegerField(
        default=0,
        help_text="Order of this tier (lower numbers = earlier tiers)"
    )
    
    # Status field - tracks which tier is currently active
    status = models.CharField(
        max_length=20,
        choices=[
            ('active', 'Active'),
            ('inactive', 'Inactive')
        ],
        default='inactive',
        help_text="Current status of this tier (only one tier should be active per payment)"
    )
    
    # Audit fields
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'service_fee_management_servicefeepaymentlatepenaltytier'
        ordering = ['order', 'days_overdue']
        unique_together = [('payment', 'days_overdue')]
        verbose_name = "Service Fee Payment Late Penalty Tier"
        verbose_name_plural = "Service Fee Payment Late Penalty Tiers"

    def __str__(self):
        return f"Payment {self.payment_id} - {self.days_overdue} days: {self.penalty_percentage}%"


class ServiceFeeGenerationConfig(models.Model):
    """
    Snapshot of the ServiceFee configuration at the time of generation.
    ONE record per ServiceFee per billing period (year/month).
    All payments for that period reference this single snapshot.
    """
    service_fee = models.ForeignKey(
        'service_fee.ServiceFee',
        on_delete=models.CASCADE,
        related_name='generation_configs',
        help_text="The service fee this config belongs to"
    )
    year = models.IntegerField(help_text="Billing period year")
    month = models.IntegerField(help_text="Billing period month")
    
    # Snapshot of ServiceFee fields
    fee_amount = models.DecimalField(max_digits=15, decimal_places=2, validators=[MinValueValidator(0)])
    currency = models.CharField(max_length=3, default='BDT')
    frequency = models.CharField(max_length=20, default='Monthly')
    billing_cycle = models.CharField(max_length=20, default='Monthly')
    due_day = models.IntegerField(
        validators=[MinValueValidator(1), MaxValueValidator(31)],
        help_text="Due day of the month (1-31)"
    )
    
    # Payment Methods snapshot
    accepts_cash = models.BooleanField(default=False)
    accepts_mfs = models.BooleanField(default=False)
    accepts_bank = models.BooleanField(default=False)
    
    # Reminder Settings snapshot
    reminder_before_days = models.IntegerField(default=0)
    reminder_after_days = models.IntegerField(default=0)
    
    # Audit fields
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'service_fee_management_servicefeegenerationconfig'
        verbose_name = "Service Fee Generation Configuration"
        verbose_name_plural = "Service Fee Generation Configurations"
        unique_together = [('service_fee', 'year', 'month')]

    def __str__(self):
        return f"Config for SF {self.service_fee_id} ({self.year}-{self.month})"

