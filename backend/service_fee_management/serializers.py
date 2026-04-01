from rest_framework import serializers
from user.models import Member
from .models import (
    ServiceFeeBilling, ServiceFeePayment, Reminder, ReminderLog, PaymentMethod,
    ServiceFeeGenerationSchedule, ReminderTiming, ReminderPaymentStatus,
    ReminderTower, ReminderSpecificTarget, BillUpload, BillUploadDetail,
    PenaltyWaiver
)


class PaymentMethodSerializerV2(serializers.ModelSerializer):
    default_account_code = serializers.CharField(source='default_account.account_code', read_only=True)
    default_account_name = serializers.CharField(source='default_account.account_name', read_only=True)

    class Meta:
        model = PaymentMethod
        fields = [
            'id', 'method_name', 'method_type', 'is_active', 
            'display_order', 'description', 'icon', 'default_account',
            'default_account_code', 'default_account_name', 
            'account_name', 'account_number',
            'created_at', 'updated_at'
        ]
        read_only_fields = ['created_at', 'updated_at']


class BillUploadDetailSerializer(serializers.ModelSerializer):
    unit_name = serializers.CharField(source='unit.unit_name', read_only=True)
    class Meta:
        model = BillUploadDetail
        fields = [
            'id', 'bill_upload', 'service_fee', 'tower', 'upload_month', 'upload_year',
            'unit', 'unit_name', 'unit_of_measurement', 'price_per_unit',
            'previous_reading', 'current_reading', 'consumption', 'amount',
            'created_at', 'updated_at'
        ]
        read_only_fields = ['created_at', 'updated_at']


class BillUploadSerializer(serializers.ModelSerializer):
    details = BillUploadDetailSerializer(many=True, read_only=True)
    class Meta:
        model = BillUpload
        fields = ['id', 'upload_id', 'bill_category', 'category', 'upload_method', 'is_active', 'created_by', 'created_at', 'details']
        read_only_fields = ['created_at', 'details']


class BillUploadCreateSerializer(serializers.ModelSerializer):
    details = serializers.ListField(child=serializers.DictField(), write_only=True)

    class Meta:
        model = BillUpload
        fields = ['id', 'bill_category', 'category', 'upload_method', 'details']

    def create(self, validated_data):
        details_data = validated_data.pop('details', [])
        bill_upload = BillUpload.objects.create(**validated_data)
        
        # Create details using bulk_create for better performance
        detail_objects = [
            BillUploadDetail(
                bill_upload=bill_upload,
                service_fee_id=d.get('service_fee_id'),
                tower_id=d.get('tower_id'),
                upload_month=d.get('upload_month'),
                upload_year=d.get('upload_year'),
                unit_id=d.get('unit_id'),
                unit_of_measurement=d.get('unit_of_measurement', ''),
                price_per_unit=d.get('price_per_unit', 0) or 0,
                previous_reading=d.get('previous_reading', 0) or 0,
                current_reading=d.get('current_reading', 0) or 0,
                consumption=d.get('consumption', 0) or 0,
                amount=d.get('amount', 0) or 0
            ) for d in details_data
        ]
        
        if detail_objects:
            BillUploadDetail.objects.bulk_create(detail_objects)
            
        return bill_upload


class PenaltyWaiverSerializer(serializers.ModelSerializer):
    applied_by_name = serializers.CharField(source='applied_by.full_name', read_only=True)
    
    class Meta:
        model = PenaltyWaiver
        fields = [
            'id', 'billing', 'waiver_type', 'percentage', 
            'penalty_amount', 'waived_amount', 'penalty_after_waiver',
            'reason', 'notes', 'applied_by', 'applied_by_name', 'applied_at'
        ]
        read_only_fields = ['applied_at']


class ServiceFeeBillingSerializer(serializers.ModelSerializer):
    """
    Serializer for ServiceFeeBilling model
    """
    service_period_display = serializers.CharField(read_only=True)
    is_overdue = serializers.BooleanField(read_only=True)
    payment_percentage = serializers.FloatField(read_only=True)
    unit_display = serializers.CharField(source='unit.unit_name', read_only=True)
    tower_name = serializers.CharField(source='unit.floor.tower.tower_name', read_only=True)
    resident_name = serializers.CharField(source='resident.full_name', read_only=True, allow_null=True)
    service_fee_amount = serializers.DecimalField(source='service_fee.fee_amount', max_digits=10, decimal_places=2, read_only=True)
    created_by_name = serializers.CharField(source='created_by.full_name', read_only=True)
    received_by_display_name = serializers.CharField(source='received_by.full_name', read_only=True)
    payments_count = serializers.SerializerMethodField()
    
    class Meta:
        model = ServiceFeeBilling
        fields = [
            'id', 'billing_id', 'service_fee', 'unit', 'resident',
            'billing_amount', 'total_paid', 'remaining_amount', 'currency',
            'service_period_month', 'service_period_year', 'service_period_display',
            'service_status', 'due_date', 'is_overdue', 'payment_percentage',
            'unit_display', 'tower_name', 'resident_name', 'service_fee_amount',
            'created_by', 'created_by_name', 'created_at', 'updated_by', 'updated_at',
            'payments_count', 'waivers',
            'received_by', 'received_by_display_name', 'received_by_name',
            'from_account_number', 'to_account_number', 'to_account_name', 'other_method_name'
        ]
        read_only_fields = [
            'billing_id', 'total_paid', 'remaining_amount', 'service_status',
            'service_period_display', 'is_overdue', 'payment_percentage',
            'unit_display', 'tower_name', 'resident_name', 'service_fee_amount',
            'created_by_name', 'created_at', 'updated_at', 'payments_count', 'waivers'
        ]
    
    waivers = PenaltyWaiverSerializer(many=True, read_only=True)

    def get_payments_count(self, obj):
        """Get count of completed payments"""
        return obj.payments.filter(payment_status='completed').count()


class PaymentMethodSerializer(serializers.ModelSerializer):
    """
    Serializer for PaymentMethod model
    """
    class Meta:
        model = PaymentMethod
        fields = ['id', 'method_name', 'method_type', 'is_active', 'display_order', 'icon', 'description', 'default_account', 'created_at', 'updated_at']
        read_only_fields = ['created_at', 'updated_at']


class ServiceFeePaymentSerializer(serializers.ModelSerializer):
    """
    Serializer for service fee payment transactions
    Note: payment_method, receipt_id, transaction_id are on ServiceFeeBilling,
    accessed through billing_records reverse relationship
    """
    # Receipt and transaction info - from billing_records
    receipt_id = serializers.SerializerMethodField(read_only=True)
    transaction_id = serializers.SerializerMethodField(read_only=True)
    reference_number = serializers.SerializerMethodField(read_only=True)
    notes = serializers.SerializerMethodField(read_only=True)
    received_by = serializers.SerializerMethodField(read_only=True)
    received_by_name = serializers.SerializerMethodField(read_only=True)
    from_account_number = serializers.SerializerMethodField(read_only=True)
    to_account_number = serializers.SerializerMethodField(read_only=True)
    to_account_name = serializers.SerializerMethodField(read_only=True)
    other_method_name = serializers.SerializerMethodField(read_only=True)
    
    # Billing information - accessing first billing record
    billing = serializers.SerializerMethodField(read_only=True)
    billing_id = serializers.SerializerMethodField(read_only=True)
    billing_amount = serializers.SerializerMethodField(read_only=True)
    billing_remaining = serializers.SerializerMethodField(read_only=True)
    
    # Owner fields (new owner-only billing approach)
    owner_id = serializers.IntegerField(source='owner.id', read_only=True, allow_null=True)
    owner_name = serializers.CharField(read_only=True, allow_null=True)
    owner_email = serializers.EmailField(read_only=True, allow_null=True)
    owner_phone = serializers.CharField(read_only=True, allow_null=True)
    
    # Resident fields (DEPRECATED - kept for backward compatibility)
    resident_name = serializers.CharField(source='resident.full_name', read_only=True, allow_null=True)
    # Add Unit table contact fields
    primary_name = serializers.CharField(source='unit.primary_name', read_only=True, allow_null=True)
    secondary_name = serializers.CharField(source='unit.secondary_name', read_only=True, allow_null=True)
    primary_number = serializers.CharField(source='unit.primary_number', read_only=True, allow_null=True)
    secondary_number = serializers.CharField(source='unit.secondary_number', read_only=True, allow_null=True)
    primary_email = serializers.CharField(source='unit.primary_email', read_only=True, allow_null=True)
    secondary_email = serializers.CharField(source='unit.secondary_email', read_only=True, allow_null=True)
    
    resident_email = serializers.SerializerMethodField(read_only=True)
    member_id = serializers.SerializerMethodField(read_only=True)
    unit_number = serializers.CharField(source='unit.unit_name', read_only=True)  # Fixed: unit_name instead of unit_number
    unit_display = serializers.CharField(source='unit.unit_name', read_only=True)  # Add unit_display
    tower_name = serializers.CharField(source='unit.floor.tower.tower_name', read_only=True)  # Fixed: tower_name
    service_fee_amount = serializers.DecimalField(source='service_fee.fee_amount', max_digits=10, decimal_places=2, read_only=True)
    
    # Fields from billing (read from billing relationship via @property)
    original_amount = serializers.DecimalField(max_digits=10, decimal_places=2, read_only=True)
    remaining_amount = serializers.DecimalField(max_digits=10, decimal_places=2, read_only=True)
    service_status = serializers.CharField(read_only=True)
    service_period_month = serializers.IntegerField(read_only=True)
    service_period_year = serializers.IntegerField(read_only=True)
    due_date = serializers.DateField(read_only=True)
    service_period_display = serializers.CharField(read_only=True)
    is_overdue = serializers.BooleanField(read_only=True)
    is_fully_paid = serializers.BooleanField(read_only=True)
    is_partial_payment = serializers.BooleanField(read_only=True)
    
    # Historical payment result status (shows status at time of payment, not current billing status)
    payment_result_status = serializers.SerializerMethodField(read_only=True)
    payment_result_display = serializers.SerializerMethodField(read_only=True)
    
    created_by_name = serializers.CharField(source='created_by.full_name', read_only=True)
    payment_date = serializers.SerializerMethodField(read_only=True)
    # Payment method info - from billing_records
    payment_method_display = serializers.SerializerMethodField(read_only=True)
    method_display = serializers.SerializerMethodField(read_only=True)
    payment_method = serializers.SerializerMethodField(read_only=True)
    payment_gateway = serializers.SerializerMethodField(read_only=True)
    
    # Accept frontend fields that map to billing relationship
    service_period_month = serializers.IntegerField(write_only=True, required=False, allow_null=True)
    service_period_year = serializers.IntegerField(write_only=True, required=False, allow_null=True)
    
    # Accept frontend field mappings
    residentId = serializers.IntegerField(write_only=True, required=False, allow_null=True)

    class Meta:
        model = ServiceFeePayment
        fields = [
            'id', 'bill_number', 'receipt_id', 'transaction_id', 'billing', 'billing_id', 'billing_amount', 'billing_remaining',
            'service_fee', 'resident', 'residentId', 'unit',
            'owner', 'owner_id', 'owner_name', 'owner_email', 'owner_phone',
            'resident_name', 'primary_name', 'secondary_name', 'primary_number', 'secondary_number',
            'primary_email', 'secondary_email', 'resident_email', 'member_id', 
            'unit_number', 'unit_display', 'tower_name', 'service_fee_amount',
            'base_service_amount', 'additional_bill_charges',
            'amount', 'original_amount', 'remaining_amount', 'currency', 'payment_method', 'payment_method_display', 'method_display', 'payment_gateway',
            'payment_status', 'service_status', 'payment_result_status', 'payment_result_display',
            'penalty_amount', 'waived_amount', 'gross_penalty_amount',
            'is_overdue', 'is_fully_paid', 'is_partial_payment',
            'created_by_name',
            'payment_date', 'due_date', 'completion_date', 'reference_number', 'notes', 
            'service_period_month', 'service_period_year', 'service_period_display', 
            'created_by', 'created_at', 'updated_by', 'updated_at',
            'received_by', 'received_by_name', 'from_account_number', 'to_account_number', 'to_account_name', 'other_method_name'
        ]
        read_only_fields = [
            'receipt_id', 'transaction_id', 'billing_id', 'billing_amount', 'billing_remaining',
            'service_period_display', 'is_overdue', 'is_fully_paid', 'is_partial_payment', 
            'created_by_name', 'member_id', 'payment_method_display', 'payment_gateway',
            'method_display', 'primary_name', 'secondary_name', 'primary_number', 'secondary_number',
            'primary_email', 'secondary_email', 'unit_display', 'tower_name',
            'base_service_amount', 'additional_bill_charges',
            'original_amount', 'remaining_amount', 'service_status',
'penalty_amount', 'waived_amount', 'gross_penalty_amount',
            'service_period_month', 'service_period_year', 'due_date',
            'payment_date', 'created_at', 'updated_at'
        ]
        extra_kwargs = {
            'resident': {'required': False, 'allow_null': True},
            'payment_method': {'required': False, 'allow_null': True}
        }

    def validate(self, data):
        """
        Enhanced payment validation with better error handling and data consistency
        """
        # Check if this is a new payment (not updating existing)
        if not self.instance:
            unit_id = data.get('unit')
            service_fee_id = data.get('service_fee')
            # Get month/year from initial_data (frontend sends these)
            month = self.initial_data.get('service_period_month')
            year = self.initial_data.get('service_period_year')
            
            # Validate required fields
            if not unit_id:
                raise serializers.ValidationError({'unit': 'Unit ID is required'})
            if not service_fee_id:
                raise serializers.ValidationError({'service_fee': 'Service fee ID is required'})
            if not month or not year:
                raise serializers.ValidationError({
                    'service_period': 'Service period month and year are required'
                })
            
            # Validate amount
            new_amount = float(data.get('amount', 0))
            if new_amount <= 0:
                raise serializers.ValidationError({
                    'amount': 'Payment amount must be greater than 0'
                })
            
            if unit_id and service_fee_id and month and year:
                try:
                    # Check if billing record exists and get payment totals from there
                    try:
                        billing = ServiceFeeBilling.objects.get(
                            unit_id=unit_id,
                            service_fee_id=service_fee_id,
                            service_period_month=month,
                            service_period_year=year
                        )
                        # Use billing totals for validation
                        total_paid = float(billing.total_paid)
                        fee_amount = float(billing.billing_amount)
                    except ServiceFeeBilling.DoesNotExist:
                        # No billing record yet - calculate from service fee
                        from django.db.models import Sum
                        from .models import ServiceFeePayment
                        
                        total_paid = ServiceFeePayment.objects.filter(
                            billing__unit_id=unit_id,
                            billing__service_fee_id=service_fee_id,
                            billing__service_period_month=month,
                            billing__service_period_year=year,
                            payment_status='completed'
                        ).aggregate(total=Sum('amount'))['total'] or 0
                        
                        # Get the service fee amount
                        try:
                            from service_fee.models import ServiceFee
                            service_fee = ServiceFee.objects.get(id=service_fee_id)
                            fee_amount = float(service_fee.fee_amount)
                        except ServiceFee.DoesNotExist:
                            raise serializers.ValidationError({
                                'service_fee': 'Service fee not found'
                            })
                    
                    # Validate payment amount - ALLOW multiple payments but prevent overpayment
                    if total_paid + new_amount > fee_amount:
                        remaining_amount = fee_amount - total_paid
                        raise serializers.ValidationError({
                            'amount': f'Payment amount ({new_amount} TK) exceeds remaining amount ({remaining_amount:.2f} TK) for this month. Total already paid: {total_paid:.2f} TK'
                        })
                    
                    # Additional check: Prevent duplicate payments within a short time window
                    # This helps prevent rapid duplicate requests from frontend
                    from django.utils import timezone
                    from datetime import timedelta
                    from .models import ServiceFeePayment
                    
                    recent_payment = ServiceFeePayment.objects.filter(
                        unit_id=unit_id,
                        service_fee_id=service_fee_id,
                        amount=new_amount,
                        payment_status='completed',
                        created_at__gte=timezone.now() - timedelta(minutes=1)  # Within last minute
                    ).first()
                    
                    if recent_payment:
                        raise serializers.ValidationError({
                            'amount': f'A payment of {new_amount} TK was already recorded recently. Please wait a moment before trying again.'
                        })
                        
                except serializers.ValidationError:
                    # Re-raise validation errors
                    raise
                except Exception as e:
                    # Log unexpected errors but don't fail validation
                    import logging
                    logger = logging.getLogger(__name__)
                    logger.warning(f"Payment validation warning: {str(e)}")
                    # Continue with validation - don't block payment creation
        
        return data

    def create(self, validated_data):
        """
        Create payment with transaction handling and billing record management
        """
        from django.db import transaction
        from datetime import datetime
        from django.utils import timezone
        
        # Extract payment date from frontend if provided
        payment_date_input = self.initial_data.get('payment_date')
        parsed_payment_date = None
        if payment_date_input:
            try:
                if isinstance(payment_date_input, str):
                    parsed_payment_date = datetime.strptime(payment_date_input[:10], '%Y-%m-%d')
                else:
                    parsed_payment_date = payment_date_input
            except Exception:
                pass
        
        with transaction.atomic():
            # If historical date provided, set completion_date
            if parsed_payment_date:
                validated_data['completion_date'] = parsed_payment_date

            # Handle created_by assignment
            if 'created_by_id' in self.initial_data and self.initial_data['created_by_id']:
                try:
                    member = Member.objects.get(id=self.initial_data['created_by_id'])
                    validated_data['created_by'] = member
                except Member.DoesNotExist:
                    pass
            elif 'created_by' not in validated_data:
                # Fallback to request user if no created_by_id provided
                request = self.context.get('request')
                
                if request and hasattr(request, 'user') and request.user and not request.user.is_anonymous:
                    try:
                        member = Member.objects.get(user=request.user)
                        validated_data['created_by'] = member
                    except Member.DoesNotExist:
                        # If no member found, try to get the first member as fallback
                        try:
                            member = Member.objects.first()
                            if member:
                                validated_data['created_by'] = member
                        except:
                            pass
                else:
                    # If no authenticated user, try to get the first member as fallback
                    try:
                        member = Member.objects.first()
                        if member:
                            validated_data['created_by'] = member
                    except:
                        pass
            
            # Handle resident mapping from frontend data
            resident_id = self.initial_data.get('residentId')
            if resident_id and not validated_data.get('resident'):
                try:
                    resident = Member.objects.get(id=resident_id)
                    validated_data['resident'] = resident
                except Member.DoesNotExist:
                    pass
            
            # Handle billing record creation/lookup
            # Extract billing-related fields from initial_data (frontend sends these)
            unit_id = validated_data.get('unit')
            service_fee_id = validated_data.get('service_fee')
            month = self.initial_data.get('service_period_month')
            year = self.initial_data.get('service_period_year')
            
            # Convert objects to IDs if needed
            if hasattr(unit_id, 'id'):
                unit_id = unit_id.id
            if hasattr(service_fee_id, 'id'):
                service_fee_id = service_fee_id.id
            
            if unit_id and service_fee_id and month and year:
                # Try to find existing billing record
                try:
                    billing = ServiceFeeBilling.objects.get(
                        unit_id=unit_id,
                        service_fee_id=service_fee_id,
                        service_period_month=month,
                        service_period_year=year
                    )
                    validated_data['billing'] = billing
                except ServiceFeeBilling.DoesNotExist:
                    # Create new billing record
                    try:
                        from service_fee.models import ServiceFee
                        service_fee = ServiceFee.objects.get(id=service_fee_id)
                        
                        # Get resident from validated_data or unit if not provided
                        resident = validated_data.get('resident')
                        if not resident and unit_id:
                            try:
                                from towers.models import Unit
                                unit = Unit.objects.get(id=unit_id)
                                # Get the primary resident for this unit
                                resident_obj = unit.resident_set.first()
                                if resident_obj and resident_obj.member and resident_obj.member.user:
                                    resident = resident_obj.member
                                else:
                                    # Fallback to a valid member if unit resident doesn't have a user
                                    resident = Member.objects.filter(user__isnull=False).first()
                            except:
                                # Fallback to a valid member
                                resident = Member.objects.filter(user__isnull=False).first()
                        
                        # Create billing record
                        billing = ServiceFeeBilling.objects.create(
                            service_fee=service_fee,
                            unit_id=unit_id,
                            resident=resident,
                            billing_amount=service_fee.fee_amount,
                            service_period_month=month,
                            service_period_year=year,
                            due_date=timezone.now().date(),  # Default due date
                            payment_date=parsed_payment_date if parsed_payment_date else timezone.now(),
                            created_by=validated_data.get('created_by'),
                            # Detailed Tracking Fields
                            received_by_name=self.initial_data.get('received_by_name'),
                            from_account_number=self.initial_data.get('from_account_number'),
                            to_account_number=self.initial_data.get('to_account_number'),
                            to_account_name=self.initial_data.get('to_account_name'),
                            other_method_name=self.initial_data.get('other_method_name')
                        )
                        validated_data['billing'] = billing
                        
                    except Exception as e:
                        # Continue without billing record (legacy mode)
                        pass
            
            # Calculate remaining_amount based on previous payments for this month/year/unit
            # This ensures correct calculation even for multiple partial payments
            if unit_id and service_fee_id and month and year:
                try:
                    from service_fee.models import ServiceFee
                    from django.db.models import Sum
                    from decimal import Decimal
                    
                    # Get the service fee amount
                    service_fee = ServiceFee.objects.get(id=service_fee_id)
                    fee_amount = Decimal(str(service_fee.fee_amount))
                    
                    # Get bill category amount from ServiceFeeItem (not ServiceFeeBillCategory)
                    try:
                        from service_fee_management.models import ServiceFeeItem
                        bill_cat_total = ServiceFeeItem.objects.filter(
                            service_fee_payment__unit_id=unit_id,
                            service_fee_payment__service_fee_id=service_fee_id,
                            service_fee_payment__service_period_month=month,
                            service_fee_payment__service_period_year=year,
                            item_type='bill_category'
                        ).aggregate(total=Sum('amount'))['total'] or Decimal('0')
                    except Exception as e:
                        print(f"Error fetching bill categories from ServiceFeeItem: {e}")
                        bill_cat_total = Decimal('0')
                        
                    # Get penalty from initial_data if available
                    # Note: This relies on frontend sending correct penalty/waiver for the period
                    penalty_amount = Decimal(str(self.initial_data.get('penalty_amount', 0) or 0))
                    waived_amount = Decimal(str(self.initial_data.get('waived_amount', 0) or 0))
                    net_penalty = max(Decimal('0'), penalty_amount - waived_amount)
                    
                    # Total Obligation = Base + Bill Categories + Net Penalty
                    total_obligation = fee_amount + bill_cat_total + net_penalty

                    # Get total already paid for this month/year/unit (excluding current payment)
                    total_already_paid = ServiceFeePayment.objects.filter(
                        unit_id=unit_id,
                        service_fee_id=service_fee_id,
                        service_period_month=month,
                        service_period_year=year,
                        payment_status='completed'
                    ).aggregate(total=Sum('amount'))['total'] or Decimal('0')
                    
                    # Current payment amount
                    current_payment = Decimal(str(validated_data.get('amount', 0)))
                    
                    # Calculate remaining: total_obligation - (already_paid + current_payment)
                    remaining = total_obligation - (total_already_paid + current_payment)
                    remaining = max(Decimal('0'), remaining)  # Don't allow negative
                    
                    # Set remaining_amount in validated_data
                    validated_data['remaining_amount'] = remaining
                    
                    # Update service_status based on remaining
                    if remaining <= Decimal('0.01'):  # Fully paid (with small tolerance)
                        validated_data['service_status'] = 'paid'
                    elif total_already_paid + current_payment > Decimal('0'):
                        validated_data['service_status'] = 'partial'
                    else:
                        validated_data['service_status'] = 'due'
                        
                except Exception as e:
                    import logging
                    logger = logging.getLogger(__name__)
                    logger.warning(f"Error calculating remaining_amount: {str(e)}")
                    # Continue with payment creation
            
            # Set payment status to completed by default for manual payments
            if 'payment_status' not in validated_data:
                validated_data['payment_status'] = 'completed'
            
            # Set service period fields from initial_data
            if 'service_period_month' in self.initial_data:
                validated_data['service_period_month'] = self.initial_data['service_period_month']
            if 'service_period_year' in self.initial_data:
                validated_data['service_period_year'] = self.initial_data['service_period_year']
            
            # Remove write-only fields that are not part of the model
            validated_data.pop('residentId', None)
            
            # Create the payment
            payment = super().create(validated_data)
            
            # Create payment allocations (replace ServiceFeePaymentDetail)
            from decimal import Decimal
            from service_fee_management.models import ServiceFeeBilling, ServiceFeePaymentAllocation, ServiceFeeItem
            
            # Get billing (safe lookup)
            billing = ServiceFeeBilling.objects.filter(servicefeepaymentid=payment).first()
            if not billing:
                billing = ServiceFeeBilling.objects.filter(
                    unit_id=payment.unit_id,
                    service_period_month=payment.service_period_month,
                    service_period_year=payment.service_period_year
                ).first()
            
            if billing:
                remaining = Decimal(str(payment.amount))
                
                # Allocation Logic
                try:
                    allocations_to_create = []
                    
                    # Fetch all items for this payment to allocate against
                    # Prioritize: Penalty -> Base Fee -> Bill Categories
                    items = list(ServiceFeeItem.objects.filter(
                        service_fee_payment=payment
                    ))
                    
                    # Sort items by priority
                    def item_priority(item):
                        if item.item_type == 'penalty': return 0
                        if item.item_type == 'base_fee': return 1
                        return 2 # bill_category and others
                    
                    items.sort(key=item_priority)
                    
                    for item in items:
                        if remaining <= 0:
                            break
                            
                        # Determine how much this item still needs (unpaid amount)
                        from django.db.models import Sum
                        already_allocated = ServiceFeePaymentAllocation.objects.filter(
                            service_fee_item=item
                        ).exclude(
                            service_fee_billing=billing
                        ).aggregate(total=Sum('allocated_amount'))['total'] or Decimal('0')
                        
                        item_balance = item.amount - already_allocated
                        
                        if item_balance > 0:
                            amount_to_allocate = min(remaining, item_balance)
                            
                            allocations_to_create.append(ServiceFeePaymentAllocation(
                                service_fee_billing=billing,
                                service_fee_item=item,
                                service_fee_payment=payment,
                                allocated_amount=amount_to_allocate,
                                allocation_type='debit', # Cash payment
                                description=f"Payment for {item.item_name}"
                            ))
                            
                            remaining -= amount_to_allocate
                            
                    if allocations_to_create:
                        ServiceFeePaymentAllocation.objects.bulk_create(allocations_to_create)

                except Exception as e:
                    import logging
                    logger = logging.getLogger(__name__)
                    logger.error(f"Error creating payment allocations: {str(e)}")

                # Step 4: Create AdvancePayment for excess
                if remaining > Decimal('0.01'):  # More than small tolerance
                    try:
                        from service_fee_management.models import AdvancePayment
                        
                        AdvancePayment.objects.create(
                            unit_id=payment.unit_id,
                            resident_id=payment.resident_id,
                            advance_type='auto_excess',
                            amount=remaining,
                            source_billing=billing,  # billing is the source_billing_record
                            notes=f'Auto-generated excess from payment for {payment.get_service_period_display()}'
                        )
                    except Exception as e:
                        import logging
                        logger = logging.getLogger(__name__)
                        logger.error(f"CRITICAL Error creating advance payment: {str(e)}")
                        raise serializers.ValidationError(f"Accounting Consistency Error: Could not create advance record. {str(e)}")
            
            
            return payment

    def update(self, instance, validated_data):
        """
        Update payment with transaction handling and billing record management
        """
        from django.db import transaction
        from django.utils import timezone
        
        print(f"🔄 Updating payment {instance.id} with data: {validated_data}")
        print(f"🔄 Initial data: {self.initial_data}")
        
        with transaction.atomic():
            # Handle resident mapping from frontend data (same as create)
            resident_id = self.initial_data.get('residentId')
            if resident_id and not validated_data.get('resident'):
                try:
                    resident = Member.objects.get(id=resident_id)
                    validated_data['resident'] = resident
                    print(f"✅ Mapped residentId {resident_id} to resident {resident.id}")
                except Member.DoesNotExist:
                    print(f"❌ Resident with ID {resident_id} not found")
            
            # Handle billing record creation/lookup (same as create)
            # Extract billing-related fields from initial_data (frontend sends these)
            unit_id = validated_data.get('unit') or instance.unit_id
            service_fee_id = validated_data.get('service_fee') or instance.service_fee_id
            month = self.initial_data.get('service_period_month')
            year = self.initial_data.get('service_period_year')
            
            # Convert objects to IDs if needed
            if hasattr(unit_id, 'id'):
                unit_id = unit_id.id
            if hasattr(service_fee_id, 'id'):
                service_fee_id = service_fee_id.id
            
            print(f"🔄 Billing lookup: unit_id={unit_id}, service_fee_id={service_fee_id}, month={month}, year={year}")
            
            if unit_id and service_fee_id and month and year:
                # Try to find existing billing record
                try:
                    billing = ServiceFeeBilling.objects.get(
                        unit_id=unit_id,
                        service_fee_id=service_fee_id,
                        service_period_month=month,
                        service_period_year=year
                    )
                    validated_data['billing'] = billing
                    print(f"✅ Found existing billing record: {billing.id}")
                except ServiceFeeBilling.DoesNotExist:
                    # Create new billing record if it doesn't exist
                    try:
                        from service_fee.models import ServiceFee
                        service_fee = ServiceFee.objects.get(id=service_fee_id)
                        
                        # Get resident from validated_data or instance if not provided
                        resident = validated_data.get('resident') or instance.resident
                        if not resident and unit_id:
                            try:
                                from towers.models import Unit
                                unit = Unit.objects.get(id=unit_id)
                                # Get the primary resident for this unit
                                resident_obj = unit.resident_set.first()
                                if resident_obj and resident_obj.member and resident_obj.member.user:
                                    resident = resident_obj.member
                                else:
                                    # Fallback to a valid member if unit resident doesn't have a user
                                    resident = Member.objects.filter(user__isnull=False).first()
                            except:
                                # Fallback to a valid member
                                resident = Member.objects.filter(user__isnull=False).first()
                        
                        # Create billing record
                        billing = ServiceFeeBilling.objects.create(
                            service_fee=service_fee,
                            unit_id=unit_id,
                            resident=resident,
                            billing_amount=service_fee.fee_amount,
                            service_period_month=month,
                            service_period_year=year,
                            due_date=timezone.now().date(),  # Default due date
                            created_by=instance.created_by,  # Use existing payment's created_by
                            # Detailed Tracking Fields
                            received_by_name=self.initial_data.get('received_by_name'),
                            from_account_number=self.initial_data.get('from_account_number'),
                            to_account_number=self.initial_data.get('to_account_number'),
                            to_account_name=self.initial_data.get('to_account_name'),
                            other_method_name=self.initial_data.get('other_method_name')
                        )
                        validated_data['billing'] = billing
                        print(f"✅ Created new billing record: {billing.id}")
                        
                    except Exception as e:
                        print(f"❌ Error creating billing record during update: {e}")
                        # Continue without billing record (legacy mode)
                        pass
            
            # Set updated_by from request user as Member
            request = self.context.get('request')
            
            if request and hasattr(request, 'user') and request.user and not request.user.is_anonymous:
                try:
                    member = Member.objects.get(user=request.user)
                    validated_data['updated_by'] = member
                    print(f"✅ Set updated_by to authenticated user: {member.id}")
                except Member.DoesNotExist:
                    # If no member found, try to get the first member as fallback
                    try:
                        member = Member.objects.first()
                        if member:
                            validated_data['updated_by'] = member
                            print(f"✅ Set updated_by to fallback member: {member.id}")
                    except:
                        pass
            else:
                # If no authenticated user, try to get the first member as fallback
                try:
                    member = Member.objects.first()
                    if member:
                        validated_data['updated_by'] = member
                        print(f"✅ Set updated_by to fallback member (no auth): {member.id}")
                except:
                    pass
            
            # Remove write-only fields that are not part of the model
            validated_data.pop('service_period_month', None)
            validated_data.pop('service_period_year', None)
            validated_data.pop('residentId', None)
            
            print(f"🔄 Final validated_data: {validated_data}")
            result = super().update(instance, validated_data)
            print(f"✅ Payment update completed successfully")
            return result


    def get_member_id(self, obj):
        """Get member ID from resident"""
        try:
            return obj.resident.id if obj.resident else None
        except:
            return None

    def get_resident_email(self, obj):
        """
        Get resident email from unit's primary/secondary email or resident's email
        Priority: resident.general_email > unit.primary_email > unit.secondary_email
        """
        try:
            # First try to get email from resident if exists
            # if obj.resident:
            #     if hasattr(obj.resident, 'general_email') and obj.resident.general_email:
            #         return obj.resident.general_email
            #     if hasattr(obj.resident, 'login_email') and obj.resident.login_email:
            #         return obj.resident.login_email
            
            # Fall back to unit's email addresses
            if obj.unit:
                if hasattr(obj.unit, 'primary_email') and obj.unit.primary_email:
                    return obj.unit.primary_email
                if hasattr(obj.unit, 'secondary_email') and obj.unit.secondary_email:
                    return obj.unit.secondary_email
            
            return None
        except Exception as e:
            print(f"Error getting resident email in serializer: {str(e)}")
            return None

    def get_receipt_id(self, obj):
        """Get receipt_id from first billing record"""
        try:
            billing = obj.billing_records.first()
            return billing.receipt_id if billing else None
        except:
            return None

    def get_transaction_id(self, obj):
        """Get transaction_id from first billing record"""
        try:
            billing = obj.billing_records.first()
            return billing.transaction_id if billing else None
        except:
            return None

    def get_reference_number(self, obj):
        """Get reference_number from first billing record"""
        try:
            billing = obj.billing_records.first()
            return billing.reference_number if billing else None
        except:
            return None

    def get_notes(self, obj):
        """Get notes from first billing record"""
        try:
            billing = obj.billing_records.first()
            return billing.notes if billing else None
        except:
            return None

    def get_billing(self, obj):
        """Get billing ID from first billing record"""
        try:
            billing = obj.billing_records.first()
            return billing.id if billing else None
        except:
            return None

    def get_billing_id(self, obj):
        """Get billing_id from first billing record"""
        try:
            billing = obj.billing_records.first()
            return billing.billing_id if billing else None
        except:
            return None

    def get_billing_amount(self, obj):
        """Get billing_amount from first billing record"""
        try:
            billing = obj.billing_records.first()
            return billing.billing_amount if billing else None
        except:
            return None

    def get_billing_remaining(self, obj):
        """Get remaining_amount from first billing record"""
        try:
            billing = obj.billing_records.first()
            # Calculate remaining from billing_amount - total_paid
            if billing:
                return float(billing.billing_amount) - float(billing.total_paid)
            return None
        except:
            return None

    def get_payment_date(self, obj):
        """Get payment_date from first billing record"""
        try:
            billing = obj.billing_records.first()
            return billing.payment_date if billing else None
        except:
            return None

    def get_payment_result_status(self, obj):
        """Get payment_result_status from first billing record"""
        try:
            billing = obj.billing_records.first()
            return billing.payment_result_status if billing else None
        except:
            return None

    def get_payment_result_display(self, obj):
        """Get payment_result_display from first billing record"""
        try:
            billing = obj.billing_records.first()
            if billing and billing.payment_result_status:
                if billing.payment_result_status == 'full':
                    return 'Paid'
                elif billing.payment_result_status == 'partial':
                    return 'Partial'
                elif billing.payment_result_status == 'overpayment':
                    return 'Overpayment'
            return None
        except:
            return None

    def get_payment_method_display(self, obj):
        """
        Get payment method display name from first billing record.
        For gateway payments (Paystation), returns the actual method used (bKash, Nagad, etc.)
        instead of the gateway name. For cash/manual, returns Cash etc.
        """
        try:
            billing = obj.billing_records.first()
            if billing:
                # Priority 1: If payment was made via gateway (Paystation), use other_method_name
                if billing.payment_gateway and billing.other_method_name:
                    return billing.other_method_name
                # Priority 2: If payment_method FK is set, use its name
                if billing.payment_method:
                    return billing.payment_method.method_name
                # Priority 3: Use other_method_name as fallback (e.g. Cash, legacy data)
                if billing.other_method_name:
                    return billing.other_method_name
                # Fallback: payment_method_id set but relation not loaded
                if getattr(billing, 'payment_method_id', None):
                    from .models import PaymentMethod
                    name = PaymentMethod.objects.filter(id=billing.payment_method_id).values_list('method_name', flat=True).first()
                    if name:
                        return name
            return None
        except:
            return None

    def get_method_display(self, obj):
        """Alias for payment_method_display"""
        return self.get_payment_method_display(obj)

    def get_payment_method(self, obj):
        """Get payment method ID from first billing record"""
        try:
            billing = obj.billing_records.first()
            if billing and billing.payment_method:
                return billing.payment_method.id
            return None
        except:
            return None

    def get_payment_gateway(self, obj):
        """Get payment gateway name from first billing record (e.g., 'paystation', 'sslcommerz', 'manual')"""
        try:
            billing = obj.billing_records.first()
            return billing.payment_gateway if billing else None
        except:
            return None

    def get_received_by(self, obj):
        try:
            billing = obj.billing_records.first()
            return billing.received_by.id if billing and billing.received_by else None
        except:
            return None

    def get_received_by_name(self, obj):
        try:
            billing = obj.billing_records.first()
            return billing.received_by_name if billing else None
        except:
            return None

    def get_from_account_number(self, obj):
        try:
            billing = obj.billing_records.first()
            return billing.from_account_number if billing else None
        except:
            return None

    def get_to_account_number(self, obj):
        try:
            billing = obj.billing_records.first()
            return billing.to_account_number if billing else None
        except:
            return None

    def get_to_account_name(self, obj):
        try:
            billing = obj.billing_records.first()
            return billing.to_account_name if billing else None
        except:
            return None

    def get_other_method_name(self, obj):
        try:
            billing = obj.billing_records.first()
            return billing.other_method_name if billing else None
        except:
            return None


class ServiceFeePaymentListSerializer(serializers.ModelSerializer):
    """
    Simplified serializer for ServiceFeePayment list views
    Note: Similar to ServiceFeePaymentSerializer, billing fields accessed via billing_records
    """
    receipt_id = serializers.SerializerMethodField(read_only=True)
    transaction_id = serializers.SerializerMethodField(read_only=True)
    billing_id = serializers.SerializerMethodField(read_only=True)
    reference_number = serializers.SerializerMethodField(read_only=True)
    notes = serializers.SerializerMethodField(read_only=True)
    payment_date = serializers.SerializerMethodField(read_only=True)
    
    # Owner fields (new owner-only billing approach)
    owner_id = serializers.IntegerField(source='owner.id', read_only=True, allow_null=True)
    owner_name = serializers.CharField(read_only=True, allow_null=True)
    owner_email = serializers.EmailField(read_only=True, allow_null=True)
    owner_phone = serializers.CharField(read_only=True, allow_null=True)
    
    # Resident fields (DEPRECATED - kept for backward compatibility)
    resident_name = serializers.CharField(source='resident.full_name', read_only=True, allow_null=True)
    unit_display = serializers.CharField(source='unit.unit_name', read_only=True)
    status_display = serializers.CharField(source='get_payment_status_display', read_only=True)
    payment_method_display = serializers.SerializerMethodField(read_only=True)
    method_display = serializers.SerializerMethodField(read_only=True)
    service_status_display = serializers.CharField(read_only=True)
    payment_result_status = serializers.CharField(read_only=True)
    payment_result_display = serializers.CharField(read_only=True)
    service_period_display = serializers.CharField(read_only=True)
    is_overdue = serializers.BooleanField(read_only=True)
    is_fully_paid = serializers.BooleanField(read_only=True)
    is_partial_payment = serializers.BooleanField(read_only=True)
    unit_id = serializers.IntegerField(source='unit.id', read_only=True)
    service_fee_amount = serializers.DecimalField(source='service_fee.fee_amount', max_digits=10, decimal_places=2, read_only=True)
    original_amount = serializers.SerializerMethodField(read_only=True)
    remaining_amount = serializers.SerializerMethodField(read_only=True)

    class Meta:
        model = ServiceFeePayment
        fields = [
            'id', 'bill_number', 'receipt_id', 'transaction_id', 'billing_id', 'owner_id', 'owner_name', 'owner_email', 'owner_phone', 'resident_name', 'unit_display',
            'amount', 'original_amount', 'remaining_amount', 'currency', 'payment_method_display', 'method_display',
            'payment_status', 'status_display', 'service_status', 'service_status_display',
            'payment_result_status', 'payment_result_display',
            'penalty_amount', 'waived_amount', 'gross_penalty_amount',
            'notes', 'payment_date', 'due_date', 'service_fee_id', 'service_fee_amount',
            'completion_date', 'unit_id', 
            'service_period_month', 'service_period_year', 'reference_number', 'resident_id', 'service_period_display',
            'is_overdue', 'is_fully_paid', 'is_partial_payment'
        ]

    def get_receipt_id(self, obj):
        try:
            billing = obj.billing_records.first()
            return billing.receipt_id if billing else None
        except:
            return None

    def get_transaction_id(self, obj):
        try:
            billing = obj.billing_records.first()
            return billing.transaction_id if billing else None
        except:
            return None

    def get_billing_id(self, obj):
        try:
            billing = obj.billing_records.first()
            return billing.billing_id if billing else None
        except:
            return None

    def get_reference_number(self, obj):
        try:
            billing = obj.billing_records.first()
            return billing.reference_number if billing else None
        except:
            return None

    def get_notes(self, obj):
        try:
            billing = obj.billing_records.first()
            return billing.notes if billing else None
        except:
            return None

    def get_payment_date(self, obj):
        try:
            billing = obj.billing_records.first()
            return billing.payment_date if billing else None
        except:
            return None

    def get_payment_method_display(self, obj):
        """
        Get payment method display name from first billing record.
        For gateway payments (Paystation), returns the actual method used (bKash, Nagad, etc.)
        instead of the gateway name. For cash/manual, returns Cash etc.
        """
        try:
            billing = obj.billing_records.first()
            if billing:
                # Priority 1: If payment was made via gateway (Paystation), use other_method_name
                if billing.payment_gateway and billing.other_method_name:
                    return billing.other_method_name
                # Priority 2: If payment_method FK is set, use its name
                if billing.payment_method:
                    return billing.payment_method.method_name
                # Priority 3: Use other_method_name as fallback (e.g. Cash, legacy data)
                if billing.other_method_name:
                    return billing.other_method_name
                # Fallback: payment_method_id set but relation not loaded
                if getattr(billing, 'payment_method_id', None):
                    from .models import PaymentMethod
                    name = PaymentMethod.objects.filter(id=billing.payment_method_id).values_list('method_name', flat=True).first()
                    if name:
                        return name
            return None
        except:
            return None

    def get_method_display(self, obj):
        return self.get_payment_method_display(obj)

    def get_original_amount(self, obj):
        """Get original billing amount from first billing record"""
        try:
            billing = obj.billing_records.first()
            return billing.billing_amount if billing else None
        except:
            return None

    def get_remaining_amount(self, obj):
        """Get remaining amount from first billing record"""
        try:
            billing = obj.billing_records.first()
            if billing:
                return float(billing.billing_amount) - float(billing.total_paid)
            return None
        except:
            return None


class ResidentPaymentRowSerializer(serializers.Serializer):
    """
    Serializer for resident payment row data (used in complex queries)
    """
    payment_id = serializers.IntegerField(allow_null=True)
    bill_number = serializers.CharField(allow_null=True, required=False)
    id = serializers.CharField()
    resident_id = serializers.IntegerField()
    member_id = serializers.IntegerField()
    resident_name = serializers.CharField()
    unit_name = serializers.CharField()
    unit_id = serializers.IntegerField()
    unit_display = serializers.CharField()
    tower_name = serializers.CharField()
    tower_id = serializers.IntegerField()
    service_fee_id = serializers.IntegerField()
    fee_amount = serializers.CharField()
    amount = serializers.CharField()
    due_day = serializers.IntegerField()
    payment_method = serializers.CharField()
    method_display = serializers.CharField()
    service_status = serializers.CharField()
    payment_date = serializers.DateTimeField(allow_null=True)
    payment_status = serializers.CharField(allow_null=True)
    transaction_id = serializers.CharField(allow_null=True)
    service_period_month = serializers.IntegerField(allow_null=True)
    service_period_year = serializers.IntegerField(allow_null=True)
    due_date = serializers.CharField()
    frequency = serializers.CharField()


class ReminderSerializer(serializers.ModelSerializer):
    """
    Serializer for reminder notifications with camelCase support
    """
    channels_active = serializers.ReadOnlyField()
    is_scheduled = serializers.ReadOnlyField()
    is_active = serializers.ReadOnlyField()
    created_by_name = serializers.CharField(source='created_by.full_name', read_only=True)
    
    # Add camelCase field mappings for frontend compatibility
    reminderName = serializers.CharField(source='reminder_name', read_only=True)
    reminderType = serializers.CharField(source='reminder_type', read_only=True)
    appNotification = serializers.BooleanField(source='app_notification', read_only=True)
    messagePreview = serializers.CharField(source='message_preview', read_only=True)
    specificTarget = serializers.CharField(source='specific_target', read_only=True)
    totalSent = serializers.IntegerField(source='total_sent', read_only=True)
    lastSent = serializers.DateTimeField(source='last_sent', read_only=True)
    channelsActive = serializers.ReadOnlyField(source='channels_active')
    isScheduled = serializers.ReadOnlyField(source='is_scheduled')
    isActive = serializers.ReadOnlyField(source='is_active')
    createdByName = serializers.CharField(source='created_by.full_name', read_only=True)
    createdAt = serializers.DateTimeField(source='created_at', read_only=True)
    updatedAt = serializers.DateTimeField(source='updated_at', read_only=True)
    
    class Meta:
        model = Reminder
        fields = [
            'id', 'reminder_name', 'reminder_type', 'status',
            'app_notification', 'sms', 'email',
            'audience', 'specific_target', 'message_preview',
            'total_sent', 'last_sent', 'last_sent_timing',
            'created_by', 'created_by_name', 'created_at', 'updated_at',
            'channels_active', 'is_scheduled', 'is_active',
            'send_when_data', 'payment_status_data', 'tower_data', 'specific_target_data', 'send_times',
            # Include camelCase versions
            'reminderName', 'reminderType', 
            'appNotification', 'messagePreview', 'specificTarget',
            'totalSent', 'lastSent', 'channelsActive',
            'isScheduled', 'isActive', 'createdByName',
            'createdAt', 'updatedAt'
        ]
        read_only_fields = [
            'total_sent', 'last_sent', 'channels_active',
            'is_scheduled', 'is_active', 'created_by_name',
            'created_at', 'updated_at'
        ]
    
    def validate_send_when(self, value):
        """Validate send_when is a list"""
        if not isinstance(value, list):
            raise serializers.ValidationError("send_when must be a list")
        return value
    
    def validate(self, data):
        """Validate that at least one channel is selected (only if channels are being updated)"""
        # Only validate channels if any channel field is being updated
        channel_fields = ['app_notification', 'sms', 'email']
        updating_channels = any(field in data for field in channel_fields)
        
        if updating_channels:
            # If updating channels, check that at least one is True
            channels = [data.get('app_notification'), data.get('sms'), data.get('email')]
            if not any(channels):
                raise serializers.ValidationError("At least one notification channel must be selected")
        elif hasattr(self, 'instance') and self.instance:
            # If not updating channels but we have an instance, check current instance values
            current_channels = [self.instance.app_notification, self.instance.sms, self.instance.email]
            if not any(current_channels):
                raise serializers.ValidationError("At least one notification channel must be selected")
        
        return data


class ReminderLogSerializer(serializers.ModelSerializer):
    """
    Serializer for reminder delivery logs
    """
    reminder_name = serializers.CharField(source='reminder.reminder_name', read_only=True)
    recipient_name = serializers.CharField(source='recipient.full_name', read_only=True)
    recipient_email = serializers.CharField(source='recipient.email', read_only=True)
    unit_number = serializers.CharField(source='unit.unit_name', read_only=True)
    
    class Meta:
        model = ReminderLog
        fields = [
            'id', 'reminder', 'reminder_name', 'recipient', 'recipient_name',
            'recipient_email', 'unit', 'unit_number', 'channel',
            'message_content', 'delivery_status', 'sent_at',
            'delivered_at', 'error_message'
        ]
        read_only_fields = [
            'reminder_name', 'recipient_name', 'recipient_email',
            'unit_number', 'sent_at', 'delivered_at'
        ]


class ReminderFilterSerializer(serializers.Serializer):
    """
    Serializer for reminder filtering parameters
    """
    search = serializers.CharField(required=False, allow_blank=True)
    status = serializers.ChoiceField(
        choices=[('Active', 'Active'), ('Paused', 'Paused')],
        required=False,
        allow_blank=True
    )
    reminder_type = serializers.ChoiceField(
        choices=[('Scheduled', 'Scheduled'), ('Manual Send', 'Manual Send')],
        required=False,
        allow_blank=True
    )
    audience = serializers.CharField(required=False, allow_blank=True)
    channel = serializers.CharField(required=False, allow_blank=True)


class ServiceFeeGenerationScheduleSerializer(serializers.ModelSerializer):
    """
    Serializer for ServiceFeeGenerationSchedule model
    """
    tower_name = serializers.CharField(source='tower.tower_name', read_only=True, allow_null=True)
    service_fee_display = serializers.SerializerMethodField()
    created_by_name = serializers.CharField(source='created_by.full_name', read_only=True, allow_null=True)
    is_active = serializers.BooleanField(read_only=True)
    next_execution_display = serializers.SerializerMethodField()
    
    class Meta:
        model = ServiceFeeGenerationSchedule
        fields = [
            'id', 'schedule_name', 'tower', 'tower_name', 'service_fee', 'service_fee_display',
            'unit_ids', 'generation_day', 'generation_hour', 'generation_minute',
            'recurring_frequency', 'is_recurring',
            'status', 'is_active', 'last_executed', 'last_execution_result',
            'created_by', 'created_by_name', 'created_at', 'updated_at', 'next_execution_display'
        ]
        read_only_fields = ['id', 'last_executed', 'last_execution_result', 'created_at', 'updated_at', 'is_active']
    
    def get_service_fee_display(self, obj):
        try:
            if obj.service_fee:
                return f"{obj.service_fee.fee_amount} {obj.service_fee.currency} ({obj.service_fee.frequency})"
            return "All Service Fees"
        except (AttributeError, TypeError):
            return "All Service Fees"
    
    def get_next_execution_display(self, obj):
        """Calculate and display next execution time"""
        from datetime import datetime
        from calendar import monthrange
        
        # Handle None values
        if obj.generation_day is None:
            return 'N/A'
        
        generation_day = int(obj.generation_day) if obj.generation_day else 1
        generation_hour = int(obj.generation_hour) if obj.generation_hour is not None else 0
        generation_minute = int(obj.generation_minute) if obj.generation_minute is not None else 0
        
        now = datetime.now()
        
        # Helper function to get valid day for a month (handle months with fewer days)
        def get_valid_day(year, month, day):
            """Get valid day for month, clamping to last day if needed"""
            try:
                last_day = monthrange(year, month)[1]
                return min(day, last_day)
            except (ValueError, TypeError):
                return 1
        
        # Get valid day for current month
        valid_day = get_valid_day(now.year, now.month, generation_day)
        
        # Calculate next execution based on day, hour, minute
        try:
            next_exec = datetime(
                year=now.year,
                month=now.month,
                day=valid_day,
                hour=generation_hour,
                minute=generation_minute
            )
        except (ValueError, TypeError):
            # Fallback: use last day of month
            try:
                last_day = monthrange(now.year, now.month)[1]
                next_exec = datetime(
                    year=now.year,
                    month=now.month,
                    day=last_day,
                    hour=generation_hour,
                    minute=generation_minute
                )
            except (ValueError, TypeError):
                return 'N/A'
        
        # If this month's execution has passed, move to next month
        if next_exec < now:
            if now.month == 12:
                next_year = now.year + 1
                next_month = 1
            else:
                next_year = now.year
                next_month = now.month + 1
            
            # Get valid day for next month
            valid_day_next = get_valid_day(next_year, next_month, generation_day)
            
            try:
                next_exec = datetime(
                    next_year,
                    next_month,
                    valid_day_next,
                    generation_hour,
                    generation_minute
                )
            except (ValueError, TypeError):
                # Fallback: use last day of next month
                try:
                    last_day = monthrange(next_year, next_month)[1]
                    next_exec = datetime(
                        next_year,
                        next_month,
                        last_day,
                        generation_hour,
                        generation_minute
                    )
                except (ValueError, TypeError):
                    return 'N/A'
        
        try:
            return next_exec.strftime('%Y-%m-%d %H:%M:%S')
        except (ValueError, AttributeError):
            return 'N/A'
    
    def validate_generation_day(self, value):
        if not (1 <= value <= 31):
            raise serializers.ValidationError("Generation day must be between 1 and 31")
        return value
    
    def validate_generation_hour(self, value):
        if not (0 <= value <= 23):
            raise serializers.ValidationError("Generation hour must be between 0 and 23")
        return value
    
    def validate_generation_minute(self, value):
        if not (0 <= value <= 59):
            raise serializers.ValidationError("Generation minute must be between 0 and 59")
        return value


# ==================== REMINDER SERIALIZERS ====================

class ReminderSerializer(serializers.ModelSerializer):
    """
    Serializer for Reminder model - used for listing and retrieving reminders
    Includes normalized table data (timing, payment status, towers, targets)
    """
    created_by_name = serializers.CharField(source='created_by.full_name', read_only=True, allow_null=True)
    channels_active = serializers.ListField(read_only=True)
    is_scheduled = serializers.BooleanField(read_only=True)
    is_active = serializers.BooleanField(read_only=True)
    
    # Add normalized table data (read_only for GET, but allow write for create/update)
    send_when_data = serializers.SerializerMethodField(read_only=True)
    send_times = serializers.ListField(read_only=True, allow_empty=True, required=False)
    payment_status_data = serializers.SerializerMethodField(read_only=True)
    tower_data = serializers.SerializerMethodField(read_only=True)
    specific_target_data = serializers.SerializerMethodField(read_only=True)
    
    class Meta:
        model = Reminder
        fields = [
            'id', 'reminder_name', 'reminder_type', 'status',
            'app_notification', 'sms', 'email',
            'audience', 'specific_target', 'message_preview',
            'total_sent', 'last_sent', 'last_sent_timing',
            'created_by', 'created_by_name', 'created_at', 'updated_at',
            'channels_active', 'is_scheduled', 'is_active',
            'send_when_data', 'payment_status_data', 'tower_data', 'specific_target_data', 'send_times'
        ]
        read_only_fields = [
            'total_sent', 'last_sent', 'last_sent_timing',
            'created_by_name', 'created_at', 'updated_at',
            'channels_active', 'is_scheduled', 'is_active',
            'send_when_data', 'payment_status_data', 'tower_data', 'specific_target_data', 'send_times'
        ]
    
    def get_send_when_data(self, obj):
        """Get all timing rules from normalized table with send_times JSON array"""
        from .models import ReminderTiming
        timings = ReminderTiming.objects.filter(reminder=obj).values(
            'id', 'timing_type', 'day_offset', 'timing_label'
        ).order_by('id')
        
        return list(timings)
    
    def get_payment_status_data(self, obj):
        """Get all payment status filters from normalized table"""
        from .models import ReminderPaymentStatus
        statuses = ReminderPaymentStatus.objects.filter(reminder=obj).values(
            'id', 'status'
        ).order_by('status')
        return list(statuses)
    
    def get_tower_data(self, obj):
        """Get all associated towers from normalized table"""
        from .models import ReminderTower
        towers = ReminderTower.objects.filter(reminder=obj).select_related('tower').values(
            'id', 'tower__id', 'tower__tower_name', 'tower__tower_number'
        ).order_by('tower__tower_name')
        return list(towers)
    
    def get_specific_target_data(self, obj):
        """Get all specific targets from normalized table"""
        from .models import ReminderSpecificTarget
        targets = ReminderSpecificTarget.objects.filter(reminder=obj).values(
            'id', 'target_type', 'target_id'
        ).order_by('target_type', 'target_id')
        return list(targets)


class ReminderCreateSerializer(serializers.ModelSerializer):
    """
    Serializer for creating and updating reminders with validation
    """
    # Add field mappings to handle camelCase from frontend
    reminderName = serializers.CharField(source='reminder_name', write_only=True, required=False)
    reminderType = serializers.CharField(source='reminder_type', write_only=True, required=False)
    appNotification = serializers.BooleanField(source='app_notification', write_only=True, required=False)
    messagePreview = serializers.CharField(source='message_preview', write_only=True, required=False)
    specificTarget = serializers.JSONField(source='specific_target', write_only=True, required=False, allow_null=True)
    
    # Accept audience as write_only since it's a property, not a DB field
    # We need this to determine which normalized table to populate
    audience = serializers.CharField(write_only=True, required=False)
    
    # Accept payment status array and global send times from frontend
    paymentStatus = serializers.ListField(child=serializers.CharField(), source='payment_status', write_only=True, required=False, allow_empty=True)
    sendTimes = serializers.ListField(child=serializers.CharField(), source='send_times', write_only=True, required=False, allow_empty=True)
    # Global send times (new master field)
    sendTimes = serializers.ListField(child=serializers.CharField(), source='send_times', write_only=True, required=False, allow_empty=True)
    # Accept numeric day + type from frontend for quick-option representation
    sendWhenType = serializers.JSONField(source='send_when_type', write_only=True, required=False, allow_null=True)
    sendWhenDay = serializers.JSONField(source='send_when_day', write_only=True, required=False, allow_null=True)
    
    # Add fields to handle specific target IDs from frontend
    towerId = serializers.IntegerField(write_only=True, required=False, allow_null=True)
    unitId = serializers.IntegerField(write_only=True, required=False, allow_null=True)
    residentId = serializers.IntegerField(write_only=True, required=False, allow_null=True)
    
    # Add fields to handle multiple selections
    towerIds = serializers.ListField(child=serializers.IntegerField(), write_only=True, required=False, allow_empty=True)
    unitIds = serializers.ListField(child=serializers.IntegerField(), write_only=True, required=False, allow_empty=True)
    residentIds = serializers.ListField(child=serializers.IntegerField(), write_only=True, required=False, allow_empty=True)
    
    class Meta:
        model = Reminder
        fields = [
            'reminder_name', 'reminder_type', 'status',
            'send_when_type', 'send_when_day', 'payment_status', 'send_times',
            'app_notification', 'sms', 'email',
            'tower_id', 'specific_target', 'message_preview',
            # Audience is write_only (declared above), not a DB field
            'audience',
            # Add camelCase variants
            'reminderName', 'reminderType',
            'sendWhenType', 'sendWhenDay', 'sendTimes', 'paymentStatus',
            'appNotification', 'messagePreview', 'specificTarget',
            # Add ID fields
            'towerId', 'unitId', 'residentId',
            # Add multiple ID fields
            'towerIds', 'unitIds', 'residentIds'
        ]
        extra_kwargs = {
            # Make original fields optional when camelCase versions are provided
            'reminder_name': {'required': False},
            'reminder_type': {'required': False},
            'app_notification': {'required': False},
            'message_preview': {'required': False},
            'specific_target': {'required': False, 'allow_null': True},
            # Note: send_when field removed from model, no longer in extra_kwargs
            'send_when_type': {'required': False, 'allow_null': True},
            'send_when_day': {'required': False, 'allow_null': True},
            'payment_status': {'required': False, 'allow_null': True},
            'send_times': {'required': False, 'allow_null': True},
        }
    
    def validate(self, data):
        """Custom validation to handle both camelCase and snake_case field names"""
        # By the time validate() is called, field mapping has already occurred
        # So camelCase fields (reminderName, messagePreview) have been mapped to snake_case (reminder_name, message_preview)
        # Check for required fields in the mapped data
        if 'reminder_name' not in data or not data.get('reminder_name'):
            raise serializers.ValidationError({'reminder_name': ['This field is required.']})
        
        if 'message_preview' not in data or not data.get('message_preview'):
            raise serializers.ValidationError({'message_preview': ['This field is required.']})
        
        # Handle nested channels object from frontend
        if 'channels' in self.initial_data:
            channels = self.initial_data.get('channels', {})
            if isinstance(channels, dict):
                # Map nested channels to individual fields
                data['app_notification'] = channels.get('appNotification', False)
                data['sms'] = channels.get('sms', False)
                data['email'] = channels.get('email', False)
        
        # Validate at least one channel is selected (AFTER mapping channels from initial_data)
        if not data.get('app_notification') and not data.get('sms') and not data.get('email'):
            raise serializers.ValidationError({
                'channels': 'At least one notification channel (App, SMS, or Email) must be selected'
            })
        
        # Handle sendWhen array from frontend (for backward compatibility and new format)
        # Note: send_when is NOT a model field anymore, but we still validate it here
        # and store it temporarily in data for processing in create()/update()
        if 'sendWhen' in self.initial_data:
            send_when = self.initial_data.get('sendWhen')
            if isinstance(send_when, list):
                # Store temporarily for create()/update() methods to use
                data['send_when'] = send_when
        
        # Handle sendWhenType directly from frontend (now as array)
        if 'sendWhenType' in self.initial_data:
            send_when_type = self.initial_data.get('sendWhenType')
            # Convert to array if single value
            if isinstance(send_when_type, str):
                data['send_when_type'] = [send_when_type]
            elif isinstance(send_when_type, list):
                data['send_when_type'] = send_when_type
        
        # Handle sendWhenDay directly from frontend (now as array)
        if 'sendWhenDay' in self.initial_data:
            send_when_day = self.initial_data.get('sendWhenDay')
            # Convert to array if single value
            if isinstance(send_when_day, int):
                data['send_when_day'] = [send_when_day]
            elif isinstance(send_when_day, list):
                data['send_when_day'] = send_when_day
        
        # Handle paymentStatus from frontend
        if 'paymentStatus' in self.initial_data:
            payment_status = self.initial_data.get('paymentStatus', [])
            if isinstance(payment_status, list):
                data['payment_status'] = payment_status
        
        # Handle sendTimes (master times) from frontend
        if 'sendTimes' in self.initial_data:
            send_times = self.initial_data.get('sendTimes', [])
            if isinstance(send_times, list):
                data['send_times'] = send_times
        
        # Handle specific target ID mapping - store as JSON array instead of comma-separated string
        audience = data.get('audience')
        
        # Note: tower_id, specific_target, and payment_status are @property fields, not DB fields
        # We'll extract these from initial_data in create()/update() methods
        # Don't store them in validated_data since they're not DB columns
        
        if audience and audience.startswith('Specific'):
            # Handle multiple selections first, then fall back to single selections
            if audience == 'Specific Tower':
                # Extract tower IDs for validation, but don't store in validated_data
                if 'towerIds' in self.initial_data and self.initial_data['towerIds']:
                    # Just validate it exists, will be extracted in create()/update()
                    pass
                elif 'towerId' in self.initial_data and self.initial_data['towerId']:
                    # Just validate it exists
                    pass
                    
            elif audience == 'Specific Units':
                # Extract unit IDs for validation, will be processed in create()/update()
                if 'unitIds' in self.initial_data and self.initial_data['unitIds']:
                    # Just validate it exists
                    pass
                elif 'selectedUnits' in self.initial_data and self.initial_data['selectedUnits']:
                    # Just validate it exists
                    pass
                elif 'unitId' in self.initial_data and self.initial_data['unitId']:
                    # Just validate it exists
                    pass
                    
            elif audience == 'Specific Resident':
                # Extract resident IDs for validation
                if 'residentIds' in self.initial_data and self.initial_data['residentIds']:
                    # Just validate it exists
                    pass
                elif 'residentId' in self.initial_data and self.initial_data['residentId']:
                    # Just validate it exists
                    pass
        
        # Validate specific targets are provided when audience requires them
        if audience in ['Specific Tower', 'Specific Units', 'Specific Resident']:
            has_target = False
            if audience == 'Specific Tower':
                has_target = ('towerIds' in self.initial_data and self.initial_data['towerIds']) or \
                           ('towerId' in self.initial_data and self.initial_data['towerId'])
            elif audience == 'Specific Units':
                has_target = ('unitIds' in self.initial_data and self.initial_data['unitIds']) or \
                           ('selectedUnits' in self.initial_data and self.initial_data['selectedUnits']) or \
                           ('unitId' in self.initial_data and self.initial_data['unitId'])
            elif audience == 'Specific Resident':
                has_target = ('residentIds' in self.initial_data and self.initial_data['residentIds']) or \
                           ('residentId' in self.initial_data and self.initial_data['residentId'])
            
            if not has_target:
                raise serializers.ValidationError({
                    'specific_target': f'Specific target is required when audience is "{audience}"'
                })
        
        # Validate send_when has at least one timing rule
        # Note: send_when is not a DB field, but we still need timing rules
        send_when = data.get('send_when')
        if not send_when or (isinstance(send_when, list) and len(send_when) == 0):
            raise serializers.ValidationError({
                'sendWhen': 'At least one timing rule is required'  # Use frontend field name
            })
        
        return data
    
    def validate_reminder_name(self, value):
        """Validate reminder name is not empty"""
        if not value or not value.strip():
            raise serializers.ValidationError("Reminder name cannot be empty")
        return value.strip()
    
    def validate_send_when(self, value):
        """
        Validate send_when timing rules format
        Expected format: List of strings or dicts
        Examples:
        - ["1 day before due", "3 days after due", "On due date"]
        - [{"timing": "1 day before due", "times": ["10:00", "15:00"]}]
        - ["on specific day", "2025-12-15"]  # New: specific date option
        - [{"timing": "on specific day", "date": "2025-12-15"}]
        
        Also handles nested structures from frontend:
        - [{"timing": {"timing": "1 day before due", "times": []}, "times": ["14:12"]}]
        """
        # Allow empty array if sendWhen was provided directly from frontend
        # The validate() method will handle extracting sendWhen and setting send_when
        if not isinstance(value, list):
            raise serializers.ValidationError("send_when must be a list")
        
        # Skip validation if empty - will be populated by validate() method
        if len(value) == 0:
            return value
        
        valid_patterns = [
            'before due',
            'after due',
            'on due date',
            'on specific day'  # New pattern
        ]
        
        # Normalize the data structure
        normalized_rules = []
        
        for rule in value:
            # Handle nested timing structure from frontend
            # Frontend sends: {"timing": {"timing": "1 day before due", "times": []}, "times": ["14:12"]}
            # We need: {"timing": "1 day before due", "times": ["14:12"]}
            if isinstance(rule, dict):
                timing_value = rule.get('timing', '')
                
                # Check if timing is nested (object instead of string)
                if isinstance(timing_value, dict):
                    # Extract the actual timing text from nested object
                    timing_text = timing_value.get('timing', '')
                    # Preserve times from outer level
                    times = rule.get('times', [])
                    specific_date = timing_value.get('date', '') or rule.get('date', '')
                    
                    # Create normalized rule
                    normalized_rule = {'timing': timing_text}
                    if times:
                        normalized_rule['times'] = times
                    if specific_date:
                        normalized_rule['date'] = specific_date
                    
                    normalized_rules.append(normalized_rule)
                    timing_text = timing_text
                    specific_date = specific_date
                else:
                    # Already in correct format
                    timing_text = timing_value
                    specific_date = rule.get('date', '')
                    normalized_rules.append(rule)
            elif isinstance(rule, str):
                timing_text = rule
                specific_date = ''
                normalized_rules.append(rule)
            else:
                raise serializers.ValidationError(f"Invalid timing rule format: {rule}")
            
            timing_text = timing_text.lower().strip()
            
            # Check if it matches any valid pattern
            if not any(pattern in timing_text for pattern in valid_patterns):
                raise serializers.ValidationError(
                    f"Invalid timing rule: '{timing_text}'. "
                    f"Must contain 'before due', 'after due', 'on due date', or 'on specific day'"
                )
            
            # Validate number extraction for before/after rules
            if 'before due' in timing_text or 'after due' in timing_text:
                # Extract digits
                digits = ''.join(filter(str.isdigit, timing_text))
                if not digits:
                    raise serializers.ValidationError(
                        f"Timing rule '{timing_text}' must specify number of days (e.g., '1 day before due')"
                    )
            
            # Validate specific date for 'on specific day' option
            if 'on specific day' in timing_text:
                if specific_date:
                    # Validate date format (YYYY-MM-DD)
                    from datetime import datetime
                    try:
                        parsed_date = datetime.strptime(specific_date, '%Y-%m-%d').date()
                        
                        # Optional: Validate that date is in the future
                        from django.utils import timezone
                        today = timezone.now().date()
                        if parsed_date < today:
                            raise serializers.ValidationError(
                                f"Specific date '{specific_date}' must be in the future or today"
                            )
                    except ValueError:
                        raise serializers.ValidationError(
                            f"Invalid date format: '{specific_date}'. Must be YYYY-MM-DD (e.g., '2025-12-15')"
                        )
        
        # Return normalized rules
        return normalized_rules
    
    def create(self, validated_data):
        """Create reminder with created_by from request and save to normalized tables"""
        from .models import (
            Reminder, ReminderTiming, ReminderPaymentStatus, 
            ReminderTower, ReminderSpecificTarget
        )
        from datetime import datetime, time
        from django.db import transaction, IntegrityError, DatabaseError
        
        try:
            with transaction.atomic():
                # Remove ID fields that are not part of the Reminder model
                validated_data.pop('towerId', None)
                validated_data.pop('unitId', None)
                validated_data.pop('residentId', None)
                validated_data.pop('towerIds', None)
                validated_data.pop('unitIds', None)
                validated_data.pop('residentIds', None)
                
                # Extract audience to determine which normalized table to populate
                # (audience is not a DB field, it's a property that infers from relations)
                audience = validated_data.pop('audience', 'All Towers')
                
                # Extract data for normalized tables before creating reminder
                send_when_data = validated_data.pop('send_when', [])
                send_when_type_data = validated_data.pop('send_when_type', [])
                send_when_day_data = validated_data.pop('send_when_day', [])
                payment_status_data = validated_data.pop('payment_status', [])
                send_times_data = validated_data.pop('send_times', None)
                
                # Extract tower IDs for filtering (independent of audience)
                # Tower associations are used for filtering across all audience types
                tower_id_data = []
                if 'towerIds' in self.initial_data and self.initial_data['towerIds']:
                    tower_id_data = self.initial_data['towerIds']
                elif 'towerId' in self.initial_data and self.initial_data['towerId']:
                    tower_id_data = [self.initial_data['towerId']]
                
                # Extract target IDs from initial_data based on audience
                specific_target_data = []
                
                if audience == 'Specific Tower':
                    # For tower audience, towers are BOTH filters AND targets
                    specific_target_data = tower_id_data
                        
                elif audience == 'Specific Units':
                    # For unit audience, extract unitIds as targets
                    if 'unitIds' in self.initial_data and self.initial_data['unitIds']:
                        specific_target_data = self.initial_data['unitIds']
                    elif 'selectedUnits' in self.initial_data and self.initial_data['selectedUnits']:
                        selected_units = self.initial_data['selectedUnits']
                        if isinstance(selected_units, list):
                            specific_target_data = [unit['id'] for unit in selected_units if isinstance(unit, dict) and 'id' in unit]
                    elif 'unitId' in self.initial_data and self.initial_data['unitId']:
                        specific_target_data = [self.initial_data['unitId']]
                        
                elif audience == 'Specific Resident':
                    # For resident audience, extract residentIds as targets
                    if 'residentIds' in self.initial_data and self.initial_data['residentIds']:
                        specific_target_data = self.initial_data['residentIds']
                    elif 'residentId' in self.initial_data and self.initial_data['residentId']:
                        specific_target_data = [self.initial_data['residentId']]
                
                # Set created_by from request
                request = self.context.get('request')
                if request and hasattr(request, 'user') and request.user.is_authenticated:
                    try:
                        member = Member.objects.get(user=request.user)
                        validated_data['created_by'] = member
                    except Member.DoesNotExist:
                        pass
                
                # Aggregate send_times: priority new send_times, then per-entry times
                combined_times = []
                if isinstance(send_times_data, list):
                    combined_times.extend([t for t in send_times_data if t])

                # Extract times from send_when_data (but don't restore send_when to validated_data)
                if send_when_data:
                    for timing_entry in send_when_data:
                        if isinstance(timing_entry, dict):
                            times_list = timing_entry.get('times', []) or []
                            for t in times_list:
                                if t:
                                    combined_times.append(t)
                
                # Create reminder instance (send_when is not a DB field anymore)
                reminder = Reminder.objects.create(**validated_data)
                if combined_times:
                    # Deduplicate while preserving order
                    seen_times = []
                    for t in combined_times:
                        if t and t not in seen_times:
                            seen_times.append(t)
                    reminder.send_times = seen_times
                    reminder.save(update_fields=['send_times'])
        
                # Save to normalized tables
                # 1. Save ReminderTiming records (times now live on Reminder)
                if send_when_data:
                    for timing_entry in send_when_data:
                        timing_text = ''
                        
                        if isinstance(timing_entry, dict):
                            timing_text = timing_entry.get('timing', '')
                        elif isinstance(timing_entry, str):
                            timing_text = timing_entry
                        
                        # Parse timing_text to extract timing_type and day_offset
                        # Examples: "3 days before due", "On due date", "1 day after due"
                        timing_lower = timing_text.lower().strip()
                        timing_type = ''
                        day_offset = 0
                        
                        if 'before due' in timing_lower:
                            timing_type = 'before_due'
                            # Extract number
                            digits = ''.join(filter(str.isdigit, timing_lower))
                            day_offset = int(digits) if digits else 0
                        elif 'after due' in timing_lower:
                            timing_type = 'after_due'
                            # Extract number
                            digits = ''.join(filter(str.isdigit, timing_lower))
                            day_offset = int(digits) if digits else 0
                        elif 'on due date' in timing_lower:
                            timing_type = 'on_due'
                            day_offset = 0
                        elif 'specific day' in timing_lower:
                            timing_type = 'specific'
                            # Extract day number from "Specific day: 10" format
                            digits = ''.join(filter(str.isdigit, timing_lower))
                            day_offset = int(digits) if digits else 0
                        
                        ReminderTiming.objects.create(
                            reminder=reminder,
                            timing_type=timing_type,
                            day_offset=day_offset,
                            timing_label=timing_text,
                        )
                
                # 2. Save ReminderPaymentStatus records
                if payment_status_data:
                    import logging
                    logger = logging.getLogger(__name__)
                    logger.info(f"[REMINDER CREATE] Raw payment_status_data received: {payment_status_data}")
                    
                    # Normalize to lowercase - 'all' expands to ['paid', 'due', 'overdue']
                    normalized = []
                    for status_value in payment_status_data:
                        if not status_value:
                            continue
                        v = str(status_value).strip().lower()
                        
                        # 'all' expands but is NOT saved itself
                        if v == 'all':
                            for status in ['paid', 'due', 'overdue']:
                                if status not in normalized:
                                    normalized.append(status)
                        elif v not in normalized:
                            normalized.append(v)
                    
                    logger.info(f"[REMINDER CREATE] Normalized payment statuses to save: {normalized}")
                    for status in normalized:
                        ReminderPaymentStatus.objects.create(
                            reminder=reminder,
                            status=status
                        )
                    logger.info(f"[REMINDER CREATE] Successfully saved {len(normalized)} payment status records")
                
                # 3. Save ReminderTower records for tower filtering
                # These are created whenever towers are selected, regardless of audience type
                # They serve as filters to limit which towers' units/residents are targeted
                if tower_id_data:
                    from towers.models import Tower
                    for tower_id in tower_id_data:
                        if tower_id:  # Skip None/empty values
                            try:
                                tower = Tower.objects.get(id=tower_id)
                                ReminderTower.objects.create(
                                    reminder=reminder,
                                    tower=tower
                                )
                            except Tower.DoesNotExist:
                                # Skip if tower doesn't exist
                                continue
                
                # 4. Save ReminderSpecificTarget records
                if specific_target_data:
                    for target_id in specific_target_data:
                        if target_id:  # Skip None/empty values
                            target_type = ''
                            if audience == 'Specific Tower':
                                target_type = 'tower'
                            elif audience == 'Specific Units':
                                target_type = 'unit'
                            elif audience == 'Specific Resident':
                                target_type = 'resident'
                            
                            if target_type:
                                ReminderSpecificTarget.objects.create(
                                    reminder=reminder,
                                    target_type=target_type,
                                    target_id=target_id
                                )
                
                return reminder
        
        except (IntegrityError, DatabaseError) as e:
            # Transaction automatically rolled back
            raise serializers.ValidationError(f"Database error while creating reminder: {str(e)}")
        except Exception as e:
            # Catch other exceptions and rollback
            raise serializers.ValidationError(f"Error creating reminder: {str(e)}")
    
    def update(self, instance, validated_data):
        """Update reminder and its normalized table records"""
        from .models import (
            ReminderTiming, ReminderPaymentStatus, 
            ReminderTower, ReminderSpecificTarget
        )
        from datetime import datetime, time
        from django.db import transaction, IntegrityError, DatabaseError
        
        try:
            with transaction.atomic():
                # Remove ID fields that are not part of the Reminder model
                validated_data.pop('towerId', None)
                validated_data.pop('unitId', None)
                validated_data.pop('residentId', None)
                validated_data.pop('towerIds', None)
                validated_data.pop('unitIds', None)
                validated_data.pop('residentIds', None)
                
                # Extract audience to determine which normalized table to populate
                # (audience is not a DB field, it's a property that infers from relations)
                audience = validated_data.pop('audience', None)
                if audience is None:
                    # If not provided, use current inferred audience
                    audience = instance.audience
                
                # Extract data for normalized tables before updating reminder
                send_when_data = validated_data.pop('send_when', None)
                send_when_type_data = validated_data.pop('send_when_type', None)
                send_when_day_data = validated_data.pop('send_when_day', None)
                payment_status_data = validated_data.pop('payment_status', None)
                send_times_data = validated_data.pop('send_times', None)
                
                # Extract tower IDs for filtering (independent of audience)
                tower_id_data = None
                if 'towerIds' in self.initial_data:
                    tower_id_data = self.initial_data['towerIds'] or []
                elif 'towerId' in self.initial_data:
                    tower_id_data = [self.initial_data['towerId']] if self.initial_data['towerId'] else []
                
                # Extract target IDs from initial_data based on audience
                specific_target_data = None
                
                if audience == 'Specific Tower':
                    # For tower audience, towers are BOTH filters AND targets
                    if tower_id_data is not None:
                        specific_target_data = tower_id_data
                        
                elif audience == 'Specific Units':
                    # For unit audience, extract unitIds as targets
                    if 'unitIds' in self.initial_data:
                        specific_target_data = self.initial_data['unitIds'] or []
                    elif 'selectedUnits' in self.initial_data:
                        selected_units = self.initial_data['selectedUnits']
                        if isinstance(selected_units, list):
                            specific_target_data = [unit['id'] for unit in selected_units if isinstance(unit, dict) and 'id' in unit]
                        else:
                            specific_target_data = []
                    elif 'unitId' in self.initial_data:
                        specific_target_data = [self.initial_data['unitId']] if self.initial_data['unitId'] else []
                        
                elif audience == 'Specific Resident':
                    # For resident audience, extract residentIds as targets
                    if 'residentIds' in self.initial_data:
                        specific_target_data = self.initial_data['residentIds'] or []
                    elif 'residentId' in self.initial_data:
                        specific_target_data = [self.initial_data['residentId']] if self.initial_data['residentId'] else []
                
                # Aggregate send_times from input
                combined_times = None
                if send_times_data is not None:
                    combined_times = [t for t in send_times_data if t]

                # Update reminder fields (send_when is not a DB field anymore)
                for attr, value in validated_data.items():
                    setattr(instance, attr, value)
                
                instance.save()
                
                # Delete old normalized table records and create new ones
                # 1. Update ReminderTiming records
                if send_when_data is not None:
                    # Delete old records
                    ReminderTiming.objects.filter(reminder=instance).delete()
                    
                    # Create new records with send_times JSON array
                    for timing_entry in send_when_data:
                        timing_text = ''
                        
                        if isinstance(timing_entry, dict):
                            timing_text = timing_entry.get('timing', '')
                        elif isinstance(timing_entry, str):
                            timing_text = timing_entry
                        
                        # Parse timing_text
                        timing_lower = timing_text.lower().strip()
                        timing_type = ''
                        day_offset = 0
                        
                        if 'before due' in timing_lower:
                            timing_type = 'before_due'
                            digits = ''.join(filter(str.isdigit, timing_lower))
                            day_offset = int(digits) if digits else 0
                        elif 'after due' in timing_lower:
                            timing_type = 'after_due'
                            digits = ''.join(filter(str.isdigit, timing_lower))
                            day_offset = int(digits) if digits else 0
                        elif 'on due date' in timing_lower:
                            timing_type = 'on_due'
                            day_offset = 0
                        elif 'specific day' in timing_lower:
                            timing_type = 'specific'
                            # Extract day number from "Specific day: 10" format
                            digits = ''.join(filter(str.isdigit, timing_lower))
                            day_offset = int(digits) if digits else 0
                        
                        # Collect times for master field if provided in timing entries
                        if combined_times is None:
                            combined_times = []
                        if isinstance(timing_entry, dict):
                            for t in timing_entry.get('times', []) or []:
                                if t:
                                    combined_times.append(t)

                        ReminderTiming.objects.create(
                            reminder=instance,
                            timing_type=timing_type,
                            day_offset=day_offset,
                            timing_label=timing_text,
                        )
                
                # Persist master send_times if provided/collected
                if combined_times is not None:
                    seen_times = []
                    for t in combined_times:
                        if t and t not in seen_times:
                            seen_times.append(t)
                    instance.send_times = seen_times
                    instance.save(update_fields=['send_times'])

                # 2. Update ReminderPaymentStatus records
                if payment_status_data is not None:
                    import logging
                    logger = logging.getLogger(__name__)
                    logger.info(f"[REMINDER UPDATE] Raw payment_status_data received: {payment_status_data}")
                    
                    ReminderPaymentStatus.objects.filter(reminder=instance).delete()
                    
                    # Normalize to lowercase - 'all' expands to ['paid', 'due', 'overdue']
                    normalized = []
                    for status_value in payment_status_data:
                        if not status_value:
                            continue
                        v = str(status_value).strip().lower()
                        
                        # 'all' expands but is NOT saved itself
                        if v == 'all':
                            for status in ['paid', 'due', 'overdue']:
                                if status not in normalized:
                                    normalized.append(status)
                        elif v not in normalized:
                            normalized.append(v)
                    
                    logger.info(f"[REMINDER UPDATE] Normalized payment statuses to save: {normalized}")
                    for status in normalized:
                        ReminderPaymentStatus.objects.create(
                            reminder=instance,
                            status=status
                        )
                    logger.info(f"[REMINDER UPDATE] Successfully saved {len(normalized)} payment status records")
                
                # 3. Update ReminderTower records for tower filtering
                # These are created whenever towers are selected, regardless of audience type
                if tower_id_data is not None:
                    from towers.models import Tower
                    ReminderTower.objects.filter(reminder=instance).delete()
                    
                    for tower_id in tower_id_data:
                        if tower_id:
                            try:
                                tower = Tower.objects.get(id=tower_id)
                                ReminderTower.objects.create(
                                    reminder=instance,
                                    tower=tower
                                )
                            except Tower.DoesNotExist:
                                continue
                
                # 4. Update ReminderSpecificTarget records
                if specific_target_data is not None:
                    ReminderSpecificTarget.objects.filter(reminder=instance).delete()
                    
                    for target_id in specific_target_data:
                        if target_id:
                            target_type = ''
                            if audience == 'Specific Tower':
                                target_type = 'tower'
                            elif audience == 'Specific Units':
                                target_type = 'unit'
                            elif audience == 'Specific Resident':
                                target_type = 'resident'
                            
                            if target_type:
                                ReminderSpecificTarget.objects.create(
                                    reminder=instance,
                                    target_type=target_type,
                                    target_id=target_id
                                )
                
                return instance
        
        except (IntegrityError, DatabaseError) as e:
            # Transaction automatically rolled back
            raise serializers.ValidationError(f"Database error while updating reminder: {str(e)}")
        except Exception as e:
            # Catch other exceptions and rollback
            raise serializers.ValidationError(f"Error updating reminder: {str(e)}")


class ReminderFilterSerializer(serializers.Serializer):
    """
    Serializer for validating reminder filter parameters
    """
    search = serializers.CharField(required=False, allow_blank=True)
    status = serializers.ChoiceField(
        choices=['Active', 'Paused'],
        required=False,
        allow_blank=True
    )
    reminder_type = serializers.ChoiceField(
        choices=['Scheduled', 'Manual Send'],
        required=False,
        allow_blank=True
    )
    audience = serializers.ChoiceField(
        choices=[
            'All Towers', 'All Residents', 'Specific Tower',
            'Specific Units', 'Specific Resident',
            'Due Only', 'Overdue Only', 'Paid Only'
        ],
        required=False,
        allow_blank=True
    )
    channel = serializers.ChoiceField(
        choices=['App', 'SMS', 'Email'],
        required=False,
        allow_blank=True
    )


class ReminderLogSerializer(serializers.ModelSerializer):
    """
    Serializer for ReminderLog model - tracks reminder delivery
    """
    reminder_name = serializers.CharField(source='reminder.reminder_name', read_only=True)
    recipient_name = serializers.CharField(source='recipient.full_name', read_only=True)
    unit_name = serializers.CharField(source='unit.unit_name', read_only=True, allow_null=True)
    tower_name = serializers.SerializerMethodField(read_only=True)
    
    class Meta:
        model = ReminderLog
        fields = [
            'id', 'reminder', 'reminder_name', 'recipient', 'recipient_name',
            'unit', 'unit_name', 'tower_name', 'channel', 'message_content',
            'delivery_status', 'sent_at', 'delivered_at', 'error_message'
        ]
        read_only_fields = [
            'reminder_name', 'recipient_name', 'unit_name', 'tower_name',
            'sent_at', 'delivered_at'
        ]
    
    def get_tower_name(self, obj):
        """Get tower name from unit"""
        try:
            if obj.unit and obj.unit.floor and obj.unit.floor.tower:
                return obj.unit.floor.tower.tower_name
            return None
        except:
            return None


# ==================== BILL UPLOAD SERIALIZERS ====================

class BillUploadDetailSerializer(serializers.ModelSerializer):
    """
    Serializer for BillUploadDetail model
    """
    unit_name = serializers.CharField(source='unit.unit_name', read_only=True)
    tower_number = serializers.CharField(source='unit.floor.tower.tower_number', read_only=True)
    
    class Meta:
        model = BillUploadDetail
        fields = [
            'id', 'unit', 'unit_name', 'tower_number',
            'unit_of_measurement', 'price_per_unit', 
            'previous_reading', 'current_reading', 'consumption',
            'amount', 'created_at', 'updated_at'
        ]
        read_only_fields = ['id', 'unit_name', 'tower_number', 'created_at', 'updated_at']


class BillUploadSerializer(serializers.ModelSerializer):
    """
    Serializer for BillUpload model
    """
    details = BillUploadDetailSerializer(many=True, read_only=True)
    tower_name = serializers.CharField(source='tower.tower_name', read_only=True)
    tower_number = serializers.CharField(source='tower.tower_number', read_only=True)
    service_fee_name = serializers.SerializerMethodField(read_only=True)
    created_by_name = serializers.CharField(source='created_by.full_name', read_only=True)
    
    class Meta:
        model = BillUpload
        fields = [
            'id', 'upload_id', 'category', 'service_fee', 'service_fee_name',
            'upload_month', 'upload_year', 'tower', 'tower_name', 'tower_number',
            'upload_method', 'is_active', 'details',
            'created_by', 'created_by_name', 'created_at', 'updated_by', 'updated_at'
        ]
        read_only_fields = [
            'id', 'upload_id', 'tower_name', 'tower_number', 'service_fee_name',
            'created_by_name', 'created_at', 'updated_at'
        ]
    
    def get_service_fee_name(self, obj):
        """Get service fee description or amount"""
        if obj.service_fee:
            return f"৳{obj.service_fee.fee_amount} - {obj.service_fee.frequency}"
        return None


class BillUploadCreateSerializer(serializers.ModelSerializer):
    """
    Serializer for creating Bill Uploads with details
    """
    details = BillUploadDetailSerializer(many=True)
    
    class Meta:
        model = BillUpload
        fields = [
            'category', 'service_fee', 'upload_month', 'upload_year',
            'tower', 'upload_method', 'details'
        ]
    
    def validate(self, data):
        """Validate bill upload data"""
        # Check for duplicate upload
        exists = BillUpload.objects.filter(
            service_fee=data.get('service_fee'),
            tower=data.get('tower'),
            upload_month=data.get('upload_month'),
            upload_year=data.get('upload_year'),
            is_active=True
        ).exists()
        
        if exists:
            raise serializers.ValidationError(
                f"Bill upload already exists for {data.get('category')} in "
                f"{data.get('tower').tower_name} for {data.get('upload_year')}-{data.get('upload_month'):02d}"
            )
        
        # Validate details
        details = data.get('details', [])
        if not details:
            raise serializers.ValidationError("At least one unit detail is required")
        
        return data
    
    def create(self, validated_data):
        """Create bill upload with details"""
        details_data = validated_data.pop('details')
        
        # Get user from context
        request = self.context.get('request')
        if request and hasattr(request, 'user'):
            validated_data['created_by'] = request.user
        
        # Create bill upload
        bill_upload = BillUpload.objects.create(**validated_data)
        
        # Create details
        for detail_data in details_data:
            BillUploadDetail.objects.create(
                bill_upload=bill_upload,
                **detail_data
            )
        
        return bill_upload
