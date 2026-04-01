from django.db import models
from django.core.validators import MinValueValidator, MaxValueValidator
from django.utils import timezone
from user.models import Member
from towers.models import Tower, Unit
from django.core.exceptions import ValidationError
import json


class ServiceFee(models.Model):
    """
    Main model for service fee settings
    """
    BILLING_CYCLE_CHOICES = [
        ('Monthly', 'Monthly'),
        ('Weekly', 'Weekly'),
        ('Yearly', 'Yearly'),
    ]

    CURRENCY_CHOICES = [
        ('BDT', 'BDT'),
        ('USD', 'USD'),
        ('EUR', 'EUR'),
    ]

    FREQUENCY_CHOICES = [
        ('Monthly', 'Monthly'),
        ('Quarterly', 'Quarterly'),
        ('Yearly', 'Yearly'),
    ]

    # General Details
    creator = models.ForeignKey(Member, on_delete=models.CASCADE, related_name='created_service_fees')
    creator_name = models.CharField(max_length=255, help_text="Auto-populated creator name")

    # Tower and Unit Selection
    towers = models.ManyToManyField(Tower, blank=True, related_name='service_fees')
    units = models.ManyToManyField(Unit, blank=True, related_name='service_fees', through='ServiceFeeUnit')

    # Fee Details
    fee_amount = models.DecimalField(max_digits=15, decimal_places=2, validators=[MinValueValidator(0)])
    service_fee_date = models.DateField(default=timezone.now, help_text="Service fee effective date")
    currency = models.CharField(max_length=3, choices=CURRENCY_CHOICES, default='BDT')
    frequency = models.CharField(max_length=20, choices=FREQUENCY_CHOICES, default='Monthly')

    # Billing Cycle and Due Date
    billing_cycle = models.CharField(max_length=20, choices=BILLING_CYCLE_CHOICES, default='Monthly')
    due_day = models.IntegerField(
        validators=[MinValueValidator(1), MaxValueValidator(31)],
        help_text="Due day of the month (1-31)"
    )

    # Payment Methods
    accepts_cash = models.BooleanField(default=False)
    accepts_mfs = models.BooleanField(default=False)
    accepts_bank = models.BooleanField(default=False)

    # Reminder Settings
    reminder_before_days = models.IntegerField(
        validators=[MinValueValidator(1), MaxValueValidator(31)],
        help_text="Send reminder X days before due date"
    )
    reminder_after_days = models.IntegerField(
        validators=[MinValueValidator(1), MaxValueValidator(31)],
        help_text="Send reminder X days after due date"
    )

    # Status and metadata
    is_active = models.BooleanField(default=True)
    
    # Late Payment Settings
    late_payment_enabled = models.BooleanField(default=False, help_text="Enable late payment penalties")
    
    # Audit fields
    created_by = models.ForeignKey(Member, null=True, blank=True, on_delete=models.DO_NOTHING, related_name='service_fee_creator')
    created_at = models.DateTimeField(auto_now_add=True)
    updated_by = models.ForeignKey(Member, null=True, blank=True, on_delete=models.DO_NOTHING, related_name='service_fee_updater')
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['is_active']),
            models.Index(fields=['service_fee_date']),
        ]

    def __str__(self):
        return f"Service Fee - {self.fee_amount} {self.currency} ({self.frequency})"

    def clean(self):
        """
        Custom validation - preventing duplicate units from being assigned to multiple active service fees
        Note: Validation errors are handled by serializers and views for better user experience
        """
        # Only validate for active service fees
        if not self.is_active:
            return
            
        # Get all units that would be covered by this service fee
        all_units = set()
        
        # Check if we have any towers or units assigned
        # Note: This validation runs after the object is saved to get M2M relationships
        if hasattr(self, '_state') and self._state.adding:
            # For new instances, we can't check M2M relationships yet
            # This will be handled by the serializer validation instead
            return
            
        # For existing instances, check M2M relationships
        if self.units.exists():
            # Filter only active units from the through model
            active_units = self.units.filter(servicefeeunit__is_active=True)
            all_units.update(active_units)
        elif self.towers.exists():
            from towers.models import Unit
            for tower in self.towers.all():
                tower_units = Unit.objects.filter(floor__tower=tower)
                all_units.update(tower_units)
        
        if not all_units:
            return
            
        # Check if any of these units are already assigned to other active service fees
        conflicting_fees = ServiceFee.objects.filter(is_active=True).exclude(pk=self.pk)
        
        for fee in conflicting_fees:
            fee_units = set()
            
            if fee.units.exists():
                # Filter only active units from the through model
                active_fee_units = fee.units.filter(servicefeeunit__is_active=True)
                fee_units.update(active_fee_units)
            elif fee.towers.exists():
                from towers.models import Unit
                for tower in fee.towers.all():
                    tower_units = Unit.objects.filter(floor__tower=tower)
                    fee_units.update(tower_units)
            
            # Check for overlap
            overlapping_units = all_units.intersection(fee_units)
            if overlapping_units:
                overlapping_unit_names = [f"{unit.unit_name} (Floor {unit.floor.floor_no})" for unit in overlapping_units]
                # Log the error for debugging instead of raising ValidationError
                import logging
                logger = logging.getLogger(__name__)
                logger.warning(
                    f'Duplicate unit assignment detected for service fee #{self.pk}: '
                    f'The following units are already assigned to service fee {fee.id} - {", ".join(overlapping_unit_names)}. '
                    f'Each unit can only be assigned to one active service fee.'
                )
                # Return without raising an error - let the serializer handle validation
                return

    def save(self, *args, **kwargs):
        # Only call full_clean if this is a new instance or if explicitly requested
        skip_validation = kwargs.pop('skip_validation', False)
        if not skip_validation and self.pk:
            # For updates, skip validation as it's handled by the serializer
            pass
        elif not skip_validation:
            # For new instances, validate
            self.full_clean()
        super().save(*args, **kwargs)


class ServiceFeeUnit(models.Model):
    """
    Through model for ServiceFee-Unit relationship to support soft delete
    """
    service_fee = models.ForeignKey(ServiceFee, on_delete=models.CASCADE, db_column='servicefee_id')
    unit = models.ForeignKey(Unit, on_delete=models.CASCADE, db_column='unit_id')
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'service_fee_servicefee_units'
        unique_together = ('service_fee', 'unit')
        verbose_name = "Service Fee Unit Assignment"
        verbose_name_plural = "Service Fee Unit Assignments"

    def __str__(self):
        return f"{self.service_fee} - {self.unit} ({'Active' if self.is_active else 'Inactive'})"


class ServiceFeeMFS(models.Model):
    """
    Model for MFS payment method details
    """
    MFS_PROVIDER_CHOICES = [
        ('bKash', 'bKash'),
        ('Nagad', 'Nagad'),
        ('Rocket', 'Rocket'),
        ('IKcash', 'IKcash'),
    ]

    service_fee = models.ForeignKey(ServiceFee, on_delete=models.CASCADE, related_name='mfs_accounts')
    provider = models.CharField(max_length=20, choices=MFS_PROVIDER_CHOICES)
    account_name = models.CharField(max_length=255)
    account_number = models.CharField(max_length=25)

    # Audit fields
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        unique_together = [
            ('service_fee', 'provider', 'account_number'),  # Prevent duplicate numbers within same provider per service fee
        ]

    def __str__(self):
        return f"{self.provider} - {self.account_name} ({self.account_number})"
    
    def clean(self):
        """
        Validate MFS account number as Bangladeshi mobile number
        """
        super().clean()
        
        if self.account_number:
            account_number = str(self.account_number).strip()
            
            if not account_number:
                raise ValidationError({
                    'account_number': 'Account number is required.'
                })
            
            # Check if it contains only digits first
            if not account_number.isdigit():
                raise ValidationError({
                    'account_number': 'Mobile number should contain only digits.'
                })
            
            # Validate Bangladeshi mobile number format
            if len(account_number) != 11:
                raise ValidationError({
                    'account_number': 'Please enter a valid Bangladeshi mobile number (11 digits, e.g., 01XXXXXXXXX).'
                })
            
            if not account_number.startswith('01'):
                raise ValidationError({
                    'account_number': 'Bangladeshi mobile number must start with \'01\'.'
                })
            
            # Additional validation for valid Bangladeshi operator prefixes
            valid_prefixes = ['013', '014', '015', '016', '017', '018', '019']
            prefix = account_number[:3]
            
            if prefix not in valid_prefixes:
                raise ValidationError({
                    'account_number': f'Invalid mobile number prefix \'{prefix}\'. Valid prefixes are: {", ".join(valid_prefixes)}.'
                })


class ServiceFeeBank(models.Model):
    """
    Model for bank payment method details
    """
    BANK_CHOICES = [
        ('Prime Bank', 'Prime Bank'),
        ('DBBL', 'DBBL'),
        ('BRAC Bank', 'BRAC Bank'),
        ('City Bank', 'City Bank'),
        ('Dutch Bangla Bank', 'Dutch Bangla Bank'),
        ('Islami Bank', 'Islami Bank'),
    ]

    service_fee = models.OneToOneField(ServiceFee, on_delete=models.CASCADE, related_name='bank_account')
    bank_name = models.CharField(max_length=100, choices=BANK_CHOICES)
    branch_name = models.CharField(max_length=255)
    branch_address = models.TextField()
    account_holder_name = models.CharField(max_length=255)
    account_number = models.CharField(max_length=25)  # Up to 25 characters
    routing_number = models.CharField(max_length=25)

    # Audit fields
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return f"{self.bank_name} - {self.account_holder_name} ({self.account_number})"
    
    def clean(self):
        """
        Validate bank account details including Bangladeshi banking standards
        """
        super().clean()
        
        if self.account_number:
            account_number = str(self.account_number).strip()
            
            if not account_number:
                raise ValidationError({
                    'account_number': 'Account number is required.'
                })
            
            # Check if it contains only digits
            if not account_number.isdigit():
                raise ValidationError({
                    'account_number': 'Account number should contain only digits.'
                })
            
            # Validate Bangladeshi bank account number (maximum 18 digits)
            if len(account_number) > 18:
                raise ValidationError({
                    'account_number': 'Account Number cannot exceed 18 digits as per Bangladesh bank standards.'
                })
            
            # Minimum length check (most Bangladeshi banks have at least 10 digits)
            if len(account_number) < 10:
                raise ValidationError({
                    'account_number': 'Account number must be at least 10 digits long.'
                })


class LatePenaltyTier(models.Model):
    """
    Model for late payment penalty tiers
    Each tier defines a penalty percentage based on days overdue
    """
    service_fee = models.ForeignKey(ServiceFee, on_delete=models.CASCADE, related_name='late_penalty_tiers')
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
    
    # Ordering field to ensure tiers are in ascending order
    order = models.IntegerField(
        default=0,
        help_text="Order of this tier (lower numbers = earlier tiers)"
    )
    
    # Audit fields
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['order', 'days_overdue']
        unique_together = [('service_fee', 'days_overdue')]
        verbose_name = "Late Penalty Tier"
        verbose_name_plural = "Late Penalty Tiers"

    def __str__(self):
        return f"{self.service_fee.id} - {self.days_overdue} days: {self.penalty_percentage}%"

    def clean(self):
        """
        Validate that days_overdue is between 1 and 31
        """
        if self.days_overdue:
            if self.days_overdue < 1:
                raise ValidationError({
                    'days_overdue': 'Days overdue must be at least 1.'
                })
            if self.days_overdue > 31:
                raise ValidationError({
                    'days_overdue': 'Days overdue cannot exceed 31.'
                })
        
        if self.penalty_percentage:
            if self.penalty_percentage <= 1:
                raise ValidationError({
                    'penalty_percentage': 'Penalty percentage must be greater than 1.'
                })
            if self.penalty_percentage > 100:
                raise ValidationError({
                    'penalty_percentage': 'Penalty percentage cannot exceed 100.'
                })


class ServiceFeeHistory(models.Model):
    """
    Model to track all changes made to service fees
    """
    ACTION_CHOICES = [
        ('created', 'Created'),
        ('updated', 'Updated'),
        ('cancelled', 'Cancelled'),
        ('activated', 'Activated'),
        ('deactivated', 'Deactivated'),
        ('deleted', 'Deleted'),
    ]

    service_fee = models.ForeignKey(ServiceFee, on_delete=models.CASCADE, related_name='history')
    action = models.CharField(max_length=20, choices=ACTION_CHOICES)
    changed_by = models.ForeignKey(Member, on_delete=models.CASCADE, related_name='service_fee_changes')
    changed_by_name = models.CharField(max_length=255, help_text="Auto-populated changed by name")
    
    # Store field changes as JSON
    field_changes = models.JSONField(default=list, help_text="List of field changes with old and new values")
    
    # Additional context
    reason = models.TextField(blank=True, null=True, help_text="Reason for the change (especially for cancellations)")
    ip_address = models.GenericIPAddressField(blank=True, null=True)
    user_agent = models.TextField(blank=True, null=True)
    
    # Timestamp
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-created_at']
        verbose_name = "Service Fee History"
        verbose_name_plural = "Service Fee Histories"

    def __str__(self):
        return f"{self.service_fee.id} - {self.get_action_display()} by {self.changed_by_name}"

    def save(self, *args, **kwargs):
        # Auto-populate changed_by_name
        if self.changed_by and not self.changed_by_name:
            self.changed_by_name = self.changed_by.full_name
        super().save(*args, **kwargs)

    @classmethod
    def create_history_entry(cls, service_fee, action, changed_by, field_changes=None, reason=None, request=None):
        """
        Helper method to create a history entry
        """
        if field_changes is None:
            field_changes = []
            
        # Get IP address and user agent from request if available
        ip_address = None
        user_agent = None
        if request:
            ip_address = cls.get_client_ip(request)
            user_agent = request.META.get('HTTP_USER_AGENT', '')[:500]  # Limit length
        
        return cls.objects.create(
            service_fee=service_fee,
            action=action,
            changed_by=changed_by,
            changed_by_name=changed_by.full_name,
            field_changes=field_changes,
            reason=reason,
            ip_address=ip_address,
            user_agent=user_agent
        )

    @staticmethod
    def get_client_ip(request):
        """
        Get client IP address from request
        """
        x_forwarded_for = request.META.get('HTTP_X_FORWARDED_FOR')
        if x_forwarded_for:
            ip = x_forwarded_for.split(',')[0]
        else:
            ip = request.META.get('REMOTE_ADDR')
        return ip

    def get_formatted_changes(self):
        """
        Get formatted field changes for display
        """
        if not self.field_changes:
            return []
        
        formatted_changes = []
        for change in self.field_changes:
            formatted_changes.append({
                'field': change.get('field', ''),
                'old_value': change.get('old_value', ''),
                'new_value': change.get('new_value', ''),
                'field_display': change.get('field_display', change.get('field', ''))
            })
        return formatted_changes
