from rest_framework import serializers
from .models import ServiceFee, ServiceFeeMFS, ServiceFeeBank, ServiceFeeHistory, ServiceFeeUnit, LatePenaltyTier
from towers.models import Tower, Unit
from user.models import Member


from django.core.exceptions import ObjectDoesNotExist

def format_unit_name(unit):
    """
    Safely format unit name with floor number, handling missing floor data.
    This prevents the 'Floor matching query does not exist' crash.
    """
    try:
        # Accessing unit.floor might raise ObjectDoesNotExist if the related floor is missing
        if unit.floor:
             return f"{unit.unit_name} (Floor {unit.floor.floor_no})"
        return unit.unit_name
    except (ObjectDoesNotExist, AttributeError):
        return unit.unit_name

class ServiceFeeMFSSerializer(serializers.ModelSerializer):

    """
    Serializer for MFS payment method
    """
    account_number = serializers.CharField(
        max_length=25,
        required=True,
        allow_blank=False,
        error_messages={
            'required': 'Account number is required.',
            'blank': 'Account number is required.'
        }
    )
    
    class Meta:
        model = ServiceFeeMFS
        fields = ['id', 'provider', 'account_name', 'account_number']
        
    def validate_account_number(self, value):
        """
        Validate Bangladeshi mobile number format for MFS account
        """
        if not value or not str(value).strip():
            raise serializers.ValidationError("Account number is required.")
        
        account_number = str(value).strip()
        
        # Check if it contains only digits first (before length check)
        if not account_number.isdigit():
            raise serializers.ValidationError("Mobile number should contain only digits.")
        
        # Validate Bangladeshi mobile number format
        # Must be exactly 11 digits and start with '01'
        if len(account_number) != 11:
            raise serializers.ValidationError("Please enter a valid Bangladeshi mobile number (11 digits, e.g., 01XXXXXXXXX).")
        
        if not account_number.startswith('01'):
            raise serializers.ValidationError("Bangladeshi mobile number must start with '01'.")
        
        # Additional validation for valid Bangladeshi operator prefixes
        # Common prefixes: 013, 014, 015, 016, 017, 018, 019
        valid_prefixes = ['013', '014', '015', '016', '017', '018', '019']
        prefix = account_number[:3]
        
        if prefix not in valid_prefixes:
            raise serializers.ValidationError(
                f"Invalid mobile number prefix '{prefix}'. Valid prefixes are: {', '.join(valid_prefixes)}."
            )
        
        return account_number


class ServiceFeeBankSerializer(serializers.ModelSerializer):
    """
    Serializer for bank payment method
    """
    class Meta:
        model = ServiceFeeBank
        fields = [
            'id', 'bank_name', 'branch_name', 'branch_address',
            'account_holder_name', 'account_number', 'routing_number'
        ]
        
    def validate_account_number(self, value):
        """
        Validate bank account number according to Bangladeshi banking standards
        """
        if not value or not str(value).strip():
            raise serializers.ValidationError("Account number is required.")
        
        account_number = str(value).strip()
        
        # Check if it contains only digits
        if not account_number.isdigit():
            raise serializers.ValidationError("Account number should contain only digits.")
        
        # Validate Bangladeshi bank account number (maximum 18 digits)
        if len(account_number) > 18:
            raise serializers.ValidationError("Account Number cannot exceed 18 digits as per Bangladesh bank standards.")
        
        # Minimum length check (most Bangladeshi banks have at least 10 digits)
        if len(account_number) < 10:
            raise serializers.ValidationError("Account number must be at least 10 digits long.")
        
        return account_number

    def validate_routing_number(self, value):
        """
        Validate routing number
        """
        if not value or not value.strip():
            raise serializers.ValidationError("Routing number is required.")
        if len(value.strip()) > 25:
            raise serializers.ValidationError("Routing number cannot exceed 25 characters.")
        return value.strip()


class LatePenaltyTierSerializer(serializers.ModelSerializer):
    """
    Serializer for late penalty tier
    """
    class Meta:
        model = LatePenaltyTier
        fields = ['id', 'days_overdue', 'penalty_percentage', 'order']
        
    def validate_days_overdue(self, value):
        """
        Validate days overdue is between 1 and 31
        """
        if value:
            if value < 1:
                raise serializers.ValidationError("Days overdue must be at least 1.")
            if value > 31:
                raise serializers.ValidationError("Days overdue cannot exceed 31.")
        return value
        
    def validate_penalty_percentage(self, value):
        """
        Validate penalty percentage is greater than 1 and at most 100
        """
        if value is not None:
            if value <= 1:
                raise serializers.ValidationError("Penalty percentage must be greater than 1.")
            if value > 100:
                raise serializers.ValidationError("Penalty percentage cannot exceed 100.")
        return value


class ServiceFeeSerializer(serializers.ModelSerializer):
    """
    Main serializer for service fee with nested payment methods
    """
    mfs_accounts = ServiceFeeMFSSerializer(many=True, required=False)
    bank_account = ServiceFeeBankSerializer(required=False)
    late_penalty_tiers = LatePenaltyTierSerializer(many=True, required=False)
    
    # Read-only fields for display
    creator_display = serializers.SerializerMethodField()
    tower_names = serializers.SerializerMethodField()
    unit_names = serializers.SerializerMethodField()
    total_units_in_towers = serializers.SerializerMethodField()
    
    # Read-only versions of IDs for frontend use
    tower_id_list = serializers.SerializerMethodField()
    unit_id_list = serializers.SerializerMethodField()
    tower_details = serializers.SerializerMethodField()
    
    # Write fields for creation/update
    tower_ids = serializers.ListField(
        child=serializers.IntegerField(),
        write_only=True,
        required=False,
        allow_empty=True
    )
    unit_ids = serializers.ListField(
        child=serializers.IntegerField(),
        write_only=True,
        required=False,
        allow_empty=True
    )
    
    # Service fee ID field - required for updates
    service_fee_id = serializers.IntegerField(
        write_only=True,
        required=False,
        help_text="Service fee ID (required for updates)"
    )
    
    class Meta:
        model = ServiceFee
        fields = [
            'id', 'service_fee_id', 'creator_name', 'creator_display', 'fee_amount', 'service_fee_date', 'currency',
            'frequency', 'billing_cycle', 'due_day', 'accepts_cash', 'accepts_mfs',
            'accepts_bank', 'reminder_before_days', 'reminder_after_days',
            'is_active', 'late_payment_enabled', 'created_at', 'updated_at', 'mfs_accounts', 'bank_account',
            'late_penalty_tiers', 'tower_names', 'unit_names', 'total_units_in_towers', 'tower_ids', 'unit_ids',
            'tower_id_list', 'unit_id_list', 'tower_details'
        ]
        read_only_fields = ['id', 'creator_name', 'created_at', 'updated_at']
        # Explicitly exclude related objects to prevent them from being included
        extra_kwargs = {
            'mfs_accounts': {'read_only': False, 'write_only': True},
            'bank_account': {'read_only': False, 'write_only': True},
            'late_penalty_tiers': {'read_only': False, 'write_only': True},
        }
        
    def get_creator_display(self, obj):
        """
        Get formatted creator display name
        """
        if obj.creator:
            return f"{obj.creator.full_name}"
        return obj.creator_name
        
    def get_tower_names(self, obj):
        """
        Get list of tower names
        """
        return [tower.tower_name for tower in obj.towers.all()]
        
    def get_unit_names(self, obj):
        """
        Get list of unit names
        """
        return [format_unit_name(unit) for unit in obj.units.filter(servicefeeunit__is_active=True)]
    
    def get_total_units_in_towers(self, obj):
        """
        Get total number of units in selected towers
        """
        from towers.models import Unit
        if obj.towers.exists():
            return Unit.objects.filter(floor__tower__in=obj.towers.all()).count()
        return 0
    
    def get_tower_id_list(self, obj):
        """
        Get list of tower IDs (for frontend use)
        """
        tower_ids = [tower.id for tower in obj.towers.all()]
        print(f"DEBUG: ServiceFeeSerializer.get_tower_id_list - obj.id: {obj.id}, tower_ids: {tower_ids}")
        return tower_ids
        
    def get_unit_id_list(self, obj):
        """
        Get list of unit IDs (for frontend use)
        """
        unit_ids = [unit.id for unit in obj.units.filter(servicefeeunit__is_active=True)]
        print(f"DEBUG: ServiceFeeSerializer.get_unit_id_list - obj.id: {obj.id}, unit_ids: {unit_ids}")
        return unit_ids
    
    def get_tower_details(self, obj):
        """
        Get detailed tower information including unit_naming_type for frontend use
        """
        tower_details = []
        for tower in obj.towers.all():
            tower_details.append({
                'id': tower.id,
                'tower_name': tower.tower_name,
                'unit_naming_type': tower.unit_naming_type,
                'add_tower_number_to_unit_name': tower.add_tower_number_to_unit_name,
                'tower_number': tower.tower_number,
                'num_floors': tower.num_floors,
                'num_units': tower.num_units,
            })
        return tower_details
    
    def validate(self, data):
        """
        Custom validation for service fee data
        """
        print(f"DEBUG: Validating service fee data: {data}")

        # For partial updates, only validate fields that are being updated
        is_partial_update = self.partial
        print(f"DEBUG: Is partial update: {is_partial_update}")
        
        # Validate late penalty tiers if late payment is enabled
        late_payment_enabled = data.get('late_payment_enabled', False)
        late_penalty_tiers = data.get('late_penalty_tiers', [])
        
        if late_payment_enabled and (not is_partial_update or 'late_penalty_tiers' in data):
            if not late_penalty_tiers or len(late_penalty_tiers) == 0:
                raise serializers.ValidationError({
                    'late_penalty_tiers': ['At least one penalty tier is required when late payment is enabled.']
                })
            
            # Validate tiers are in ascending order of days overdue
            days_list = [tier.get('days_overdue') for tier in late_penalty_tiers if tier.get('days_overdue')]
            if len(days_list) != len(set(days_list)):
                raise serializers.ValidationError({
                    'late_penalty_tiers': ['Each penalty tier must have unique days overdue.']
                })
            
            # Sort by days overdue and validate ascending order
            sorted_tiers = sorted(late_penalty_tiers, key=lambda x: x.get('days_overdue', 0))
            for i, tier in enumerate(sorted_tiers):
                days = tier.get('days_overdue')
                percentage = tier.get('penalty_percentage')
                
                if not days or days < 1:
                    raise serializers.ValidationError({
                        'late_penalty_tiers': [f'Penalty tier {i+1}: Days overdue must be at least 1.']
                    })
                
                if days > 31:
                    raise serializers.ValidationError({
                        'late_penalty_tiers': [f'Penalty tier {i+1}: Days overdue cannot exceed 31.']
                    })
                
                if percentage is None or percentage <= 1 or percentage > 100:
                    raise serializers.ValidationError({
                        'late_penalty_tiers': [f'Penalty tier {i+1}: Penalty percentage must be greater than 1 and at most 100.']
                    })
                
                # Ensure tiers are in ascending order
                if i > 0 and days <= sorted_tiers[i-1].get('days_overdue', 0):
                    raise serializers.ValidationError({
                        'late_penalty_tiers': ['Penalty tiers must be configured in ascending order of days overdue.']
                    })

        # Validate service_fee_id is required for updates
        if hasattr(self, 'instance') and self.instance:
            # This is an update operation
            service_fee_id = data.get('service_fee_id')
            if not service_fee_id:
                raise serializers.ValidationError({'service_fee_id': ['Service fee ID is required for updates.']})
            # Validate that service_fee_id matches the instance ID
            if service_fee_id != self.instance.id:
                raise serializers.ValidationError({'service_fee_id': ['Service fee ID must match the service fee being updated.']})

        # Validate required core fields only if they are provided or if this is not a partial update
        required_fields = {
            'fee_amount': 'Fee amount is required',
            'service_fee_date': 'Service fee date is required',
            'currency': 'Currency is required',
            'frequency': 'Frequency is required',
            'billing_cycle': 'Billing cycle is required',
            'due_day': 'Due day is required',
            'reminder_before_days': 'Reminder before due date is required',
            'reminder_after_days': 'Reminder after due date is required'
        }

        for field, message in required_fields.items():
            field_value = data.get(field)
            # Only validate if field is provided OR if this is not a partial update
            if not is_partial_update or field in data:
                if not field_value and field_value != 0:  # Allow 0 values but not None, empty string, etc.
                    raise serializers.ValidationError({field: [message]})

        # Validate fee amount is positive
        if data.get('fee_amount') and data.get('fee_amount') <= 0:
            raise serializers.ValidationError({'fee_amount': ['Fee amount must be greater than 0']})

        # Validate due day range
        if data.get('due_day') and (data.get('due_day') < 1 or data.get('due_day') > 31):
            raise serializers.ValidationError({'due_day': ['Due day must be between 1 and 31']})

        # Validate tower or unit selection (only for non-partial updates or when provided)
        tower_ids = data.get('tower_ids', [])
        unit_ids = data.get('unit_ids', [])
        
        # For partial updates, only validate if tower_ids or unit_ids are provided
        if not is_partial_update or 'tower_ids' in data or 'unit_ids' in data:
            if not tower_ids and not unit_ids:
                raise serializers.ValidationError("At least one tower or unit must be selected.")

        # Validate that at least one payment method is selected (only for non-partial updates or when payment methods are provided)
        payment_fields = ['accepts_cash', 'accepts_mfs', 'accepts_bank']
        payment_fields_provided = any(field in data for field in payment_fields)
        
        if not is_partial_update or payment_fields_provided:
            if not any([data.get('accepts_cash'), data.get('accepts_mfs'), data.get('accepts_bank')]):
                print("DEBUG: No payment method selected")
                raise serializers.ValidationError("At least one payment method must be selected.")
        
        # Validate MFS accounts if MFS is accepted (and MFS is being updated or it's not a partial update)
        if data.get('accepts_mfs') and (not is_partial_update or 'accepts_mfs' in data or 'mfs_accounts' in data):
            mfs_accounts = data.get('mfs_accounts', [])
            print(f"DEBUG: MFS accounts data: {mfs_accounts}")
            if not mfs_accounts:
                print("DEBUG: MFS accounts required but not provided")
                raise serializers.ValidationError("MFS accounts are required when MFS payment is accepted.")
            
            # Validate each MFS account individually
            for i, account in enumerate(mfs_accounts):
                print(f"DEBUG: Validating MFS account {i}: {account}")
                
                # Check required fields
                if not account.get('provider'):
                    print(f"DEBUG: MFS account {i} missing provider")
                    raise serializers.ValidationError(f"MFS account {i+1}: Provider is required")
                
                if not account.get('account_name'):
                    print(f"DEBUG: MFS account {i} missing account_name")
                    raise serializers.ValidationError(f"MFS account {i+1}: Account name is required")
                
                if not account.get('account_number'):
                    print(f"DEBUG: MFS account {i} missing account_number")
                    raise serializers.ValidationError(f"MFS account {i+1}: Account number is required")
                
                # Validate provider choice
                valid_providers = ['bKash', 'Nagad', 'Rocket', 'IKcash']
                if account.get('provider') not in valid_providers:
                    print(f"DEBUG: MFS account {i} invalid provider: {account.get('provider')}")
                    raise serializers.ValidationError(f"MFS account {i+1}: Provider must be one of {', '.join(valid_providers)}")
            
            # Check for duplicate account numbers within the same provider (database constraint)
            provider_numbers = {}
            for account in mfs_accounts:
                provider = account['provider']
                account_number = account['account_number']
                
                if provider not in provider_numbers:
                    provider_numbers[provider] = []
                
                if account_number in provider_numbers[provider]:
                    print(f"DEBUG: Duplicate mobile number {account_number} found for provider {provider}")
                    raise serializers.ValidationError(f"The mobile number {account_number} is already used for {provider}. Each provider can only have unique mobile numbers.")
                
                provider_numbers[provider].append(account_number)
        
        # Validate bank account if bank transfer is accepted (and bank is being updated or it's not a partial update)
        if data.get('accepts_bank') and (not is_partial_update or 'accepts_bank' in data or 'bank_account' in data):
            bank_account = data.get('bank_account')
            print(f"DEBUG: Bank account data: {bank_account}")
            if not bank_account:
                print("DEBUG: Bank account required but not provided")
                raise serializers.ValidationError("Bank account details are required when bank transfer is accepted.")
            
            # Validate required bank account fields
            required_fields = ['bank_name', 'branch_name', 'branch_address', 'account_holder_name', 'account_number', 'routing_number']
            missing_fields = [field for field in required_fields if not bank_account.get(field)]
            if missing_fields:
                print(f"DEBUG: Missing bank account fields: {missing_fields}")
                raise serializers.ValidationError(f"Missing required bank account fields: {', '.join(missing_fields)}")
            
            # Validate bank name choice
            valid_banks = ['Prime Bank', 'DBBL', 'BRAC Bank', 'City Bank', 'Dutch Bangla Bank', 'Islami Bank']
            if bank_account.get('bank_name') not in valid_banks:
                print(f"DEBUG: Invalid bank name: {bank_account.get('bank_name')}")
                raise serializers.ValidationError(f"Bank name must be one of {', '.join(valid_banks)}")
            
            # Validate account number format according to Bangladeshi banking standards
            if bank_account.get('account_number'):
                account_num = str(bank_account.get('account_number')).strip()
                if not account_num:
                    print(f"DEBUG: Empty account number: {bank_account.get('account_number')}")
                    raise serializers.ValidationError("Account number cannot be empty")
                
                # Check if it contains only digits
                if not account_num.isdigit():
                    print(f"DEBUG: Account number contains non-digits: {account_num}")
                    raise serializers.ValidationError("Account number should contain only digits.")
                
                # Validate Bangladeshi bank account number (maximum 18 digits)
                if len(account_num) > 18:
                    print(f"DEBUG: Account number too long: {account_num}")
                    raise serializers.ValidationError("Account Number cannot exceed 18 digits as per Bangladesh bank standards.")
                
                # Minimum length check (most Bangladeshi banks have at least 10 digits)
                if len(account_num) < 10:
                    print(f"DEBUG: Account number too short: {account_num}")
                    raise serializers.ValidationError("Account number must be at least 10 digits long.")

            # Validate routing number format (should be string)
            if bank_account.get('routing_number'):
                routing_num = str(bank_account.get('routing_number')).strip()
                if not routing_num:
                    print(f"DEBUG: Empty routing number: {bank_account.get('routing_number')}")
                    raise serializers.ValidationError("Routing number cannot be empty")
                if len(routing_num) > 25:
                    print(f"DEBUG: Routing number too long: {routing_num}")
                    raise serializers.ValidationError("Routing number cannot exceed 25 characters")
            
            # Basic validation passed - no uniqueness checks needed
        
        # Validate tower and unit selection
        tower_ids = data.get('tower_ids', [])
        unit_ids = data.get('unit_ids', [])
        print(f"DEBUG: Tower IDs: {tower_ids}, Unit IDs: {unit_ids}")
        
        if not tower_ids and not unit_ids:
            print("DEBUG: No tower or unit selected")
            raise serializers.ValidationError("At least one tower or unit must be selected.")
        
        # Validate tower IDs exist
        if tower_ids:
            existing_towers = Tower.objects.filter(id__in=tower_ids).count()
            if existing_towers != len(tower_ids):
                print(f"DEBUG: Invalid tower IDs: {tower_ids}")
                raise serializers.ValidationError("One or more selected towers do not exist.")
        
        # Validate unit IDs exist
        if unit_ids:
            existing_units = Unit.objects.filter(id__in=unit_ids).count()
            if existing_units != len(unit_ids):
                print(f"DEBUG: Invalid unit IDs: {unit_ids}")
                raise serializers.ValidationError("One or more selected units do not exist.")
        
        # Validate no duplicate service fees (re-enabled duplicate prevention)
        if not is_partial_update or 'tower_ids' in data or 'unit_ids' in data:
            # Check if this is an update scenario (instance exists) or creation
            if hasattr(self, 'instance') and self.instance:
                # For updates, use the method that excludes current instance
                self._validate_no_duplicate_service_fees(self.instance, tower_ids, unit_ids)
            else:
                # For creation, use the creation validation method
                self._validate_no_duplicate_service_fees_for_creation(tower_ids, unit_ids)
        
        print("DEBUG: Validation passed successfully")
        return data
    
    def _validate_no_duplicate_service_fees(self, instance, new_tower_ids, new_unit_ids):
        """
        Validate that updating with new tower/unit IDs won't create duplicates
        """
        from towers.models import Unit
        
        # Get the current tower and unit IDs to compare
        current_tower_ids = [tower.id for tower in instance.towers.all()] if instance.towers.exists() else []
        current_unit_ids = [unit.id for unit in instance.units.all()] if instance.units.exists() else []
        
        # Use new IDs if provided, otherwise keep current
        final_tower_ids = new_tower_ids if new_tower_ids is not None else current_tower_ids
        final_unit_ids = new_unit_ids if new_unit_ids is not None else current_unit_ids
        
        print(f"DEBUG: Current tower IDs: {current_tower_ids}")
        print(f"DEBUG: Current unit IDs: {current_unit_ids}")
        print(f"DEBUG: Final tower IDs: {final_tower_ids}")
        print(f"DEBUG: Final unit IDs: {final_unit_ids}")
        
        # Get all units that would be covered by this service fee
        all_units = set()
        
        # If specific units are selected, only use those (ignore tower units)
        if final_unit_ids:
            units = Unit.objects.filter(id__in=final_unit_ids)
            all_units.update(units)
            print(f"DEBUG: Using directly selected units only: {[u.id for u in units]}")
        # If no specific units but towers are selected, use all tower units
        elif final_tower_ids:
            tower_units = Unit.objects.filter(floor__tower__id__in=final_tower_ids)
            all_units.update(tower_units)
            print(f"DEBUG: Using all units from towers: {[u.id for u in tower_units]}")
        else:
            print("DEBUG: No units or towers selected")
        
        print(f"DEBUG: All units to be covered: {[u.id for u in all_units]}")
        
        # Check if this is just updating the same units (no change in units)
        current_units = set()
        if current_unit_ids:
            current_units.update(Unit.objects.filter(id__in=current_unit_ids))
        elif current_tower_ids:
            current_tower_units = Unit.objects.filter(floor__tower__id__in=current_tower_ids)
            current_units.update(current_tower_units)
        
        # If the units haven't changed, no need to check for conflicts
        if all_units == current_units:
            print("DEBUG: Units haven't changed, skipping conflict check")
            return
        
        # Only validate if there are units to check
        if all_units:
            # Check if any of these units already have an active service fee (excluding current instance)
            conflicting_fees = ServiceFee.objects.filter(is_active=True).exclude(pk=instance.pk)
            
            for fee in conflicting_fees:
                fee_units = set()
                print(f"DEBUG: Checking conflict with service fee {fee.id}")
                print(f"DEBUG: Fee {fee.id} has {fee.units.count()} specific units and {fee.towers.count()} towers")
                
                # If the conflicting fee has specific units, only use those
                if fee.units.exists():
                    fee_units.update(fee.units.filter(servicefeeunit__is_active=True))
                    print(f"DEBUG: Fee {fee.id} uses specific units: {[u.id for u in fee.units.filter(servicefeeunit__is_active=True)]}")
                # If no specific units but towers are selected, use all tower units
                elif fee.towers.exists():
                    print(f"DEBUG: Fee {fee.id} uses towers: {[t.id for t in fee.towers.all()]}")
                    for tower in fee.towers.all():
                        tower_units = Unit.objects.filter(floor__tower=tower)
                        fee_units.update(tower_units)
                        print(f"DEBUG: Tower {tower.id} has units: {[u.id for u in tower_units]}")
                
                print(f"DEBUG: Fee {fee.id} covers units: {[u.id for u in fee_units]}")
                
                # Check for overlap
                overlapping_units = all_units.intersection(fee_units)
                if overlapping_units:
                    overlapping_unit_names = [format_unit_name(unit) for unit in overlapping_units]
                    print(f"DEBUG: Conflict found with service fee {fee.id}")
                    print(f"DEBUG: Our units: {[u.id for u in all_units]}")
                    print(f"DEBUG: Their units: {[u.id for u in fee_units]}")
                    print(f"DEBUG: Overlapping units: {[u.id for u in overlapping_units]}")
                    raise serializers.ValidationError({
                        '__all__': [f'The following units are already assigned to service fee {fee.id} - {", ".join(overlapping_unit_names)}. Each unit can only be assigned to one active service fee.']
                    })
                else:
                    print(f"DEBUG: No conflict with service fee {fee.id}")
        
        print("DEBUG: No duplicate service fees found")
    
    def _validate_no_duplicate_service_fees_for_creation(self, tower_ids, unit_ids):
        # Validate that creating with new tower/unit IDs won't create duplicates
        from towers.models import Unit
        
        print(f"DEBUG: Validating duplicate service fees for creation - tower_ids: {tower_ids}, unit_ids: {unit_ids}")
        
        # Get all units that would be covered by this new service fee
        all_units = set()
        
        # If specific units are selected, only use those (ignore tower units)
        if unit_ids:
            units = Unit.objects.filter(id__in=unit_ids)
            all_units.update(units)
            print(f"DEBUG: Using directly selected units only: {[u.id for u in units]}")
        # If no specific units but towers are selected, use all tower units
        elif tower_ids:
            tower_units = Unit.objects.filter(floor__tower__id__in=tower_ids)
            all_units.update(tower_units)
            print(f"DEBUG: Using all units from towers: {[u.id for u in tower_units]}")
        else:
            print("DEBUG: No units or towers selected for creation")
            return
        
        print(f"DEBUG: All units to be covered by new service fee: {[u.id for u in all_units]}")
        
        # Only validate if there are units to check
        if all_units:
            # Check if any of these units already have an active service fee
            conflicting_fees = ServiceFee.objects.filter(is_active=True)
            
            for fee in conflicting_fees:
                fee_units = set()
                print(f"DEBUG: Checking conflict with existing service fee {fee.id}")
                print(f"DEBUG: Fee {fee.id} has {fee.units.count()} specific units and {fee.towers.count()} towers")
                
                # If the conflicting fee has specific units, only use those
                if fee.units.exists():
                    fee_units.update(fee.units.filter(servicefeeunit__is_active=True))
                    print(f"DEBUG: Fee {fee.id} uses specific units: {[u.id for u in fee.units.filter(servicefeeunit__is_active=True)]}")
                # If no specific units but towers are selected, use all tower units
                elif fee.towers.exists():
                    print(f"DEBUG: Fee {fee.id} uses towers: {[t.id for t in fee.towers.all()]}")
                    for tower in fee.towers.all():
                        tower_units = Unit.objects.filter(floor__tower=tower)
                        fee_units.update(tower_units)
                        print(f"DEBUG: Tower {tower.id} has units: {[u.id for u in tower_units]}")
                
                print(f"DEBUG: Fee {fee.id} covers units: {[u.id for u in fee_units]}")
                
                # Check for overlap
                overlapping_units = all_units.intersection(fee_units)
                if overlapping_units:
                    overlapping_unit_names = [format_unit_name(unit) for unit in overlapping_units]
                    print(f"DEBUG: Conflict found with service fee {fee.id}")
                    print(f"DEBUG: Our units: {[u.id for u in all_units]}")
                    print(f"DEBUG: Their units: {[u.id for u in fee_units]}")
                    print(f"DEBUG: Overlapping units: {[u.id for u in overlapping_units]}")
                    # Still raise ValidationError as this is needed for frontend popup handling
                    raise serializers.ValidationError({
                        '__all__': [f'The following units are already assigned to service fee {fee.id} - {", ".join(overlapping_unit_names)}. Each unit can only be assigned to one active service fee.']
                    })
                else:
                    print(f"DEBUG: No conflict with service fee {fee.id}")
        
        print("DEBUG: No duplicate service fees found for creation")
    
    def create(self, validated_data):
        # Create service fee with nested payment methods
        # Extract nested data
        mfs_accounts_data = validated_data.pop('mfs_accounts', [])
        bank_account_data = validated_data.pop('bank_account', None)
        late_penalty_tiers_data = validated_data.pop('late_penalty_tiers', [])
        tower_ids = validated_data.pop('tower_ids', [])
        unit_ids = validated_data.pop('unit_ids', [])
        # Remove service_fee_id if present (not a model field, only used for validation)
        validated_data.pop('service_fee_id', None)
        
        # Get creator from request
        request = self.context.get('request')
        member = None
        if request and request.user:
            member = Member.objects.get(user=request.user)
            validated_data['creator'] = member
            validated_data['created_by'] = member
            validated_data['creator_name'] = member.full_name
        
        # Create service fee
        service_fee = ServiceFee.objects.create(**validated_data)
        
        # Add towers and units
        if tower_ids:
            towers = Tower.objects.filter(id__in=tower_ids)
            service_fee.towers.set(towers)
        
        if unit_ids:
            units = Unit.objects.filter(id__in=unit_ids)
            # Create ServiceFeeUnit with is_active=True
            for unit in units:
                ServiceFeeUnit.objects.create(service_fee=service_fee, unit=unit, is_active=True)
        
        # Create MFS accounts
        for mfs_data in mfs_accounts_data:
            ServiceFeeMFS.objects.create(service_fee=service_fee, **mfs_data)
        
        # Create bank account
        if bank_account_data:
            ServiceFeeBank.objects.create(service_fee=service_fee, **bank_account_data)
        
        # Create late penalty tiers
        if late_penalty_tiers_data:
            for order, tier_data in enumerate(late_penalty_tiers_data):
                LatePenaltyTier.objects.create(
                    service_fee=service_fee,
                    days_overdue=tier_data.get('days_overdue'),
                    penalty_percentage=tier_data.get('penalty_percentage'),
                    order=order
                )
        
        # Create history entry for creation with all initial values
        if member:
            field_changes = []
            
            # Add all the initial field values
            currency_symbol = '৳' if service_fee.currency == 'BDT' else '$'
            field_changes.append({
                'field': 'Fee Amount',
                'field_display': 'Fee Amount',
                'old_value': 'N/A',
                'new_value': f"{currency_symbol}{service_fee.fee_amount}"
            })
            
            if service_fee.service_fee_date:
                field_changes.append({
                    'field': 'Service Fee Date',
                    'field_display': 'Service Fee Date',
                    'old_value': 'N/A',
                    'new_value': str(service_fee.service_fee_date)
                })
            
            field_changes.append({
                'field': 'Currency',
                'field_display': 'Currency',
                'old_value': 'N/A',
                'new_value': service_fee.currency
            })
            
            field_changes.append({
                'field': 'Frequency',
                'field_display': 'Frequency',
                'old_value': 'N/A',
                'new_value': service_fee.frequency
            })
            
            field_changes.append({
                'field': 'Billing Cycle',
                'field_display': 'Billing Cycle',
                'old_value': 'N/A',
                'new_value': service_fee.billing_cycle
            })
            
            field_changes.append({
                'field': 'Due Day',
                'field_display': 'Due Day',
                'old_value': 'N/A',
                'new_value': str(service_fee.due_day)
            })
            
            # Payment methods
            payment_methods = []
            if service_fee.accepts_cash:
                payment_methods.append('Cash')
            if service_fee.accepts_mfs:
                payment_methods.append('MFS')
            if service_fee.accepts_bank:
                payment_methods.append('Bank')
            
            field_changes.append({
                'field': 'Payment Methods',
                'field_display': 'Payment Methods',
                'old_value': 'N/A',
                'new_value': ', '.join(payment_methods) if payment_methods else 'None'
            })
            
            field_changes.append({
                'field': 'Reminder Before Days',
                'field_display': 'Reminder Before Days',
                'old_value': 'N/A',
                'new_value': str(service_fee.reminder_before_days)
            })
            
            field_changes.append({
                'field': 'Reminder After Days',
                'field_display': 'Reminder After Days',
                'old_value': 'N/A',
                'new_value': str(service_fee.reminder_after_days)
            })
            
            # Add tower and unit information
            if service_fee.towers.exists():
                tower_names = [tower.tower_name for tower in service_fee.towers.all()]
                field_changes.append({
                    'field': 'Towers',
                    'field_display': 'Towers',
                    'old_value': 'N/A',
                    'new_value': ', '.join(tower_names)
                })
            
            if service_fee.units.exists():
                unit_names = [format_unit_name(unit) for unit in service_fee.units.all()]
                field_changes.append({
                    'field': 'Units',
                    'field_display': 'Units',
                    'old_value': 'N/A',
                    'new_value': ', '.join(unit_names)
                })
            
            # Add MFS accounts if any
            if service_fee.mfs_accounts.exists():
                mfs_accounts = []
                for mfs in service_fee.mfs_accounts.all():
                    mfs_accounts.append(f"{mfs.provider} - {mfs.account_name} ({mfs.account_number})")
                field_changes.append({
                    'field': 'MFS Accounts',
                    'field_display': 'MFS Accounts',
                    'old_value': 'N/A',
                    'new_value': '; '.join(mfs_accounts)
                })
            
            # Add bank account if exists
            if hasattr(service_fee, 'bank_account') and service_fee.bank_account:
                bank = service_fee.bank_account
                field_changes.append({
                    'field': 'Bank Account',
                    'field_display': 'Bank Account',
                    'old_value': 'N/A',
                    'new_value': f"{bank.bank_name} - {bank.account_holder_name} ({bank.account_number})"
                })
            
            ServiceFeeHistory.create_history_entry(
                service_fee=service_fee,
                action='created',
                changed_by=member,
                field_changes=field_changes,
                request=request
            )
        
        return service_fee
    
    def update(self, instance, validated_data):
        # Update service fee with nested payment methods
        print(f"DEBUG: Updating service fee {instance.id}")
        print(f"DEBUG: Validated data keys: {list(validated_data.keys())}")
        print(f"DEBUG: Validated data: {validated_data}")
        
        # Store original values for change tracking
        original_data = {}
        tracked_fields = [
            'fee_amount', 'service_fee_date', 'currency', 'frequency', 'billing_cycle', 'due_day',
            'accepts_cash', 'accepts_mfs', 'accepts_bank', 'reminder_before_days',
            'reminder_after_days', 'is_active'
        ]
        
        for field in tracked_fields:
            if hasattr(instance, field):
                original_data[field] = getattr(instance, field)
        
        # Store original MFS accounts for change tracking
        original_mfs_accounts = []
        if instance.mfs_accounts.exists():
            for mfs in instance.mfs_accounts.all():
                original_mfs_accounts.append({
                    'provider': mfs.provider,
                    'account_name': mfs.account_name,
                    'account_number': mfs.account_number
                })
        
        # Store original bank account for change tracking
        original_bank_account = None
        if hasattr(instance, 'bank_account') and instance.bank_account:
            bank = instance.bank_account
            original_bank_account = {
                'bank_name': bank.bank_name,
                'account_holder_name': bank.account_holder_name,
                'account_number': bank.account_number,
                'branch_name': bank.branch_name,
                'routing_number': bank.routing_number
            }
        
        # Extract nested data
        mfs_accounts_data = validated_data.pop('mfs_accounts', None)
        bank_account_data = validated_data.pop('bank_account', None)
        late_penalty_tiers_data = validated_data.pop('late_penalty_tiers', None)
        tower_ids = validated_data.pop('tower_ids', None)
        unit_ids = validated_data.pop('unit_ids', None)
        # Remove service_fee_id if present (not a model field, only used for validation)
        validated_data.pop('service_fee_id', None)
        
        print(f"DEBUG: tower_ids: {tower_ids}")
        print(f"DEBUG: unit_ids: {unit_ids}")
        print(f"DEBUG: mfs_accounts_data: {mfs_accounts_data}")
        print(f"DEBUG: bank_account_data: {bank_account_data}")
        
        # Store original tower and unit data for change tracking
        original_towers = set(instance.towers.all())
        original_units = set(instance.units.all())
        
        # Validate for duplicate service fees - preventing same units from being assigned to multiple active service fees
        if tower_ids is not None or unit_ids is not None:
            self._validate_no_duplicate_service_fees(instance, tower_ids, unit_ids)
        
        # Update basic fields
        for attr, value in validated_data.items():
            setattr(instance, attr, value)
        
        # Update audit fields
        request = self.context.get('request')
        member = None
        if request and request.user:
            try:
                member = Member.objects.get(user=request.user)
                instance.updated_by = member
            except Member.DoesNotExist:
                print(f"DEBUG: Member not found for user {request.user.id}")
                # Don't fail the update if member doesn't exist
                pass
        
        # Save with skip_validation to avoid duplicate validation
        instance.save(skip_validation=True)

        # Update towers
        if tower_ids is not None:
            towers = Tower.objects.filter(id__in=tower_ids)
            instance.towers.set(towers)

        # Update units if provided
        if unit_ids is not None:
            # Get current active units
            current_units = set(instance.units.filter(servicefeeunit__is_active=True))
            new_units = set(Unit.objects.filter(id__in=unit_ids))
            
            # Units to activate (newly selected or re-selected)
            for unit in new_units:
                ServiceFeeUnit.objects.update_or_create(
                    service_fee=instance,
                    unit=unit,
                    defaults={'is_active': True}
                )
            
            # Units to deactivate (deselected)
            units_to_deactivate = current_units - new_units
            if units_to_deactivate:
                ServiceFeeUnit.objects.filter(
                    service_fee=instance,
                    unit__in=units_to_deactivate
                ).update(is_active=False)
        
        # Get updated tower and unit data for change tracking
        updated_towers = set(instance.towers.all())
        updated_units = set(instance.units.filter(servicefeeunit__is_active=True))
        # Update MFS accounts
        if mfs_accounts_data is not None:
            # Delete existing MFS accounts
            instance.mfs_accounts.all().delete()
            # Create new ones
            for mfs_data in mfs_accounts_data:
                ServiceFeeMFS.objects.create(service_fee=instance, **mfs_data)
        
        # Update bank account
        if bank_account_data is not None:
            # Delete existing bank account
            if hasattr(instance, 'bank_account'):
                instance.bank_account.delete()
            # Create new one
            if bank_account_data:
                ServiceFeeBank.objects.create(service_fee=instance, **bank_account_data)
        
        # Update late penalty tiers
        if late_penalty_tiers_data is not None:
            # Delete existing late penalty tiers
            instance.late_penalty_tiers.all().delete()
            # Create new ones
            if late_penalty_tiers_data:
                for order, tier_data in enumerate(late_penalty_tiers_data):
                    LatePenaltyTier.objects.create(
                        service_fee=instance,
                        days_overdue=tier_data.get('days_overdue'),
                        penalty_percentage=tier_data.get('penalty_percentage'),
                        order=order
                    )
        
        # Create history entry for changes - only if there are actual changes
        if member:
            field_changes = []
            
            # Track basic field changes - only fields that actually changed
            for field in tracked_fields:
                if field in validated_data:
                    old_value = original_data.get(field)
                    new_value = validated_data[field]
                    
                    # Only add to changes if the value actually changed
                    if old_value != new_value:
                        # Format values for display
                        if field == 'fee_amount':
                            currency_symbol = '৳' if instance.currency == 'BDT' else '$'
                            old_display = f"{currency_symbol}{old_value}" if old_value is not None else "N/A"
                            new_display = f"{currency_symbol}{new_value}" if new_value is not None else "N/A"
                        elif field == 'service_fee_date':
                            old_display = str(old_value) if old_value is not None else "N/A"
                            new_display = str(new_value) if new_value is not None else "N/A"
                        elif field in ['accepts_cash', 'accepts_mfs', 'accepts_bank', 'is_active']:
                            old_display = "Yes" if old_value else "No"
                            new_display = "Yes" if new_value else "No"
                        else:
                            old_display = str(old_value) if old_value is not None else "N/A"
                            new_display = str(new_value) if new_value is not None else "N/A"
                        
                        field_changes.append({
                            'field': field.replace('_', ' ').title(),
                            'field_display': field.replace('_', ' ').title(),
                            'old_value': old_display,
                            'new_value': new_display
                        })
            
            # Track tower changes
            if tower_ids is not None and original_towers != updated_towers:
                old_tower_names = [tower.tower_name for tower in original_towers]
                new_tower_names = [tower.tower_name for tower in updated_towers]
                
                field_changes.append({
                    'field': 'Towers',
                    'field_display': 'Towers',
                    'old_value': ', '.join(sorted(old_tower_names)) if old_tower_names else 'None',
                    'new_value': ', '.join(sorted(new_tower_names)) if new_tower_names else 'None'
                })
            
            # Track unit changes
            if unit_ids is not None and original_units != updated_units:
                old_unit_names = [format_unit_name(unit) for unit in original_units]
                new_unit_names = [format_unit_name(unit) for unit in updated_units]
                
                field_changes.append({
                    'field': 'Units',
                    'field_display': 'Units',
                    'old_value': ', '.join(sorted(old_unit_names)) if old_unit_names else 'None',
                    'new_value': ', '.join(sorted(new_unit_names)) if new_unit_names else 'None'
                })
            
            # Track MFS account changes
            if mfs_accounts_data is not None:
                new_mfs_accounts = []
                for mfs_data in mfs_accounts_data:
                    new_mfs_accounts.append({
                        'provider': mfs_data.get('provider', ''),
                        'account_name': mfs_data.get('account_name', ''),
                        'account_number': mfs_data.get('account_number', '')
                    })
                
                # Check if MFS accounts changed
                if original_mfs_accounts != new_mfs_accounts:
                    # First, try to track individual field changes if same number of accounts
                    individual_changes_found = False
                    if len(original_mfs_accounts) == len(new_mfs_accounts):
                        # Check for changes in individual account numbers and names
                        for i, (orig_mfs, new_mfs) in enumerate(zip(original_mfs_accounts, new_mfs_accounts)):
                            # Only track if the provider is the same (same account, different details)
                            if orig_mfs['provider'] == new_mfs['provider']:
                                if orig_mfs['account_number'] != new_mfs['account_number']:
                                    field_changes.append({
                                        'field': f'MFS Account {orig_mfs["provider"]} Number',
                                        'field_display': f'MFS Account {orig_mfs["provider"]} Number',
                                        'old_value': orig_mfs['account_number'],
                                        'new_value': new_mfs['account_number']
                                    })
                                    individual_changes_found = True
                                if orig_mfs['account_name'] != new_mfs['account_name']:
                                    field_changes.append({
                                        'field': f'MFS Account {orig_mfs["provider"]} Name',
                                        'field_display': f'MFS Account {orig_mfs["provider"]} Name',
                                        'old_value': orig_mfs['account_name'],
                                        'new_value': new_mfs['account_name']
                                    })
                                    individual_changes_found = True
                    
                    # If no individual changes found (accounts added/removed/providers changed), show full comparison
                    if not individual_changes_found:
                        old_mfs_display = []
                        for mfs in original_mfs_accounts:
                            old_mfs_display.append(f"{mfs['provider']} - {mfs['account_name']} ({mfs['account_number']})")
                        
                        new_mfs_display = []
                        for mfs in new_mfs_accounts:
                            new_mfs_display.append(f"{mfs['provider']} - {mfs['account_name']} ({mfs['account_number']})")
                        
                        field_changes.append({
                            'field': 'MFS Accounts',
                            'field_display': 'MFS Accounts',
                            'old_value': '; '.join(old_mfs_display) if old_mfs_display else 'None',
                            'new_value': '; '.join(new_mfs_display) if new_mfs_display else 'None'
                        })
            
            # Track bank account changes
            if bank_account_data is not None:
                new_bank_account = None
                if bank_account_data:
                    new_bank_account = {
                        'bank_name': bank_account_data.get('bank_name', ''),
                        'account_holder_name': bank_account_data.get('account_holder_name', ''),
                        'account_number': bank_account_data.get('account_number', ''),
                        'branch_name': bank_account_data.get('branch_name', ''),
                        'routing_number': bank_account_data.get('routing_number', '')
                    }
                
                # Check if bank account changed
                if original_bank_account != new_bank_account:
                    # First, try to track individual field changes if both accounts exist
                    individual_changes_found = False
                    if original_bank_account and new_bank_account:
                        # Check for changes in individual sensitive fields
                        if original_bank_account['account_number'] != new_bank_account['account_number']:
                            field_changes.append({
                                'field': 'Bank Account Number',
                                'field_display': 'Bank Account Number',
                                'old_value': original_bank_account['account_number'],
                                'new_value': new_bank_account['account_number']
                            })
                            individual_changes_found = True
                        if original_bank_account['account_holder_name'] != new_bank_account['account_holder_name']:
                            field_changes.append({
                                'field': 'Bank Account Holder Name',
                                'field_display': 'Bank Account Holder Name',
                                'old_value': original_bank_account['account_holder_name'],
                                'new_value': new_bank_account['account_holder_name']
                            })
                            individual_changes_found = True
                        if original_bank_account['routing_number'] != new_bank_account['routing_number']:
                            field_changes.append({
                                'field': 'Bank Routing Number',
                                'field_display': 'Bank Routing Number',
                                'old_value': original_bank_account['routing_number'],
                                'new_value': new_bank_account['routing_number']
                            })
                            individual_changes_found = True
                        if original_bank_account['bank_name'] != new_bank_account['bank_name']:
                            field_changes.append({
                                'field': 'Bank Name',
                                'field_display': 'Bank Name',
                                'old_value': original_bank_account['bank_name'],
                                'new_value': new_bank_account['bank_name']
                            })
                            individual_changes_found = True
                        if original_bank_account['branch_name'] != new_bank_account['branch_name']:
                            field_changes.append({
                                'field': 'Bank Branch Name',
                                'field_display': 'Bank Branch Name',
                                'old_value': original_bank_account['branch_name'],
                                'new_value': new_bank_account['branch_name']
                            })
                            individual_changes_found = True
                    
                    # If no individual changes found (account added/removed), show full comparison
                    if not individual_changes_found:
                        old_bank_display = 'None'
                        if original_bank_account:
                            old_bank_display = f"{original_bank_account['bank_name']} - {original_bank_account['account_holder_name']} ({original_bank_account['account_number']}) - {original_bank_account['branch_name']} - Routing: {original_bank_account['routing_number']}"
                        
                        new_bank_display = 'None'
                        if new_bank_account:
                            new_bank_display = f"{new_bank_account['bank_name']} - {new_bank_account['account_holder_name']} ({new_bank_account['account_number']}) - {new_bank_account['branch_name']} - Routing: {new_bank_account['routing_number']}"
                        
                        field_changes.append({
                            'field': 'Bank Account',
                            'field_display': 'Bank Account',
                            'old_value': old_bank_display,
                            'new_value': new_bank_display
                        })
            
            # Only create history entry if there are actual changes
            if field_changes:
                ServiceFeeHistory.create_history_entry(
                    service_fee=instance,
                    action='updated',
                    changed_by=member,
                    field_changes=field_changes,
                    request=request
                )
        
        return instance


class ServiceFeeListSerializer(serializers.ModelSerializer):
    # Simplified serializer for listing service fees
    creator_display = serializers.SerializerMethodField()
    tower_names = serializers.SerializerMethodField()
    unit_names = serializers.SerializerMethodField()
    total_units_in_towers = serializers.SerializerMethodField()
    payment_methods = serializers.SerializerMethodField()
    late_penalty_tiers = LatePenaltyTierSerializer(many=True, read_only=True)

    class Meta:
        model = ServiceFee
        fields = [
            'id', 'creator_display', 'fee_amount', 'service_fee_date', 'currency', 'frequency',
            'billing_cycle', 'due_day', 'tower_names', 'unit_names', 'total_units_in_towers',
            'payment_methods', 'accepts_cash', 'accepts_mfs', 'accepts_bank',
            'is_active', 'late_payment_enabled', 'late_penalty_tiers', 'created_at', 'updated_at'
        ]
    
    def get_creator_display(self, obj):
        return f"{obj.creator.full_name}" if obj.creator else obj.creator_name
    
    def get_tower_names(self, obj):
        # Get list of tower names
        return [tower.tower_name for tower in obj.towers.all()]
    
    def get_unit_names(self, obj):
        # Get list of unit names (only active units)
        return [format_unit_name(unit) for unit in obj.units.filter(servicefeeunit__is_active=True)]
    
    def get_total_units_in_towers(self, obj):
        # Get total number of units
        from towers.models import Unit
        
        # If specific units are assigned, count only active ones
        if obj.units.exists():
            return obj.units.filter(servicefeeunit__is_active=True).count()
        
        # If towers are selected (no specific units), count all units in those towers
        if obj.towers.exists():
            return Unit.objects.filter(floor__tower__in=obj.towers.all()).count()
        
        return 0
    
    def get_payment_methods(self, obj):
        # Get list of payment method names as strings
        methods = []

        try:
            # Debug: print the object's payment-related fields
            print(f"DEBUG: ServiceFee {obj.id} payment fields:")
            print(f"  accepts_cash: {obj.accepts_cash} (type: {type(obj.accepts_cash)})")
            print(f"  accepts_mfs: {obj.accepts_mfs} (type: {type(obj.accepts_mfs)})")
            print(f"  accepts_bank: {obj.accepts_bank} (type: {type(obj.accepts_bank)})")
            
            # Handle boolean fields properly - check for both True and 1 values
            # Convert to boolean if it's a number
            cash_enabled = bool(obj.accepts_cash) if obj.accepts_cash is not None else False
            mfs_enabled = bool(obj.accepts_mfs) if obj.accepts_mfs is not None else False
            bank_enabled = bool(obj.accepts_bank) if obj.accepts_bank is not None else False

            if cash_enabled:
                methods.append('Cash')
            if mfs_enabled:
                methods.append('MFS')
            if bank_enabled:
                methods.append('Bank')

            # Ensure we only return strings
            methods = [str(method) for method in methods if method]
            
            print(f"  DEBUG: Final methods array: {methods}")
            
            # If no methods found, return empty array (frontend will handle display)
            return methods
        except Exception as e:
            # Fallback: return empty array if there's any error
            print(f"Error in get_payment_methods: {e}")
            return []


class ServiceFeeHistorySerializer(serializers.ModelSerializer):
    # Serializer for ServiceFeeHistory
    action_display = serializers.CharField(source='get_action_display', read_only=True)
    changed_by_display = serializers.SerializerMethodField()
    formatted_changes = serializers.SerializerMethodField()
    formatted_date = serializers.SerializerMethodField()
    
    class Meta:
        model = ServiceFeeHistory
        fields = [
            'id', 'action', 'action_display', 'changed_by_display', 'changed_by_name',
            'field_changes', 'formatted_changes', 'reason', 'ip_address', 'user_agent',
            'created_at', 'formatted_date'
        ]
        read_only_fields = ['id', 'created_at']
    
    def get_changed_by_display(self, obj):
        # Get formatted changed by display name
        if obj.changed_by:
            return f"{obj.changed_by.full_name} (ID: {obj.changed_by.id})"
        return obj.changed_by_name
    
    def get_formatted_changes(self, obj):
        # Get formatted field changes for display
        return obj.get_formatted_changes()
    
    def get_formatted_date(self, obj):
        # Format date to match frontend format (DD-MM-YYYY at HH:MM:SS am/pm)
        try:
            date = obj.created_at
            day = date.day
            month = date.month
            year = date.year
            hours = date.hour
            minutes = date.minute
            seconds = date.second
            
            # Format day and month with leading zeros
            day_str = str(day).zfill(2)
            month_str = str(month).zfill(2)
            
            # Convert to 12-hour format
            hour12 = 12 if hours == 0 else (hours - 12 if hours > 12 else hours)
            period = 'pm' if hours >= 12 else 'am'
            
            return f"{day_str}-{month_str}-{year} at {hour12}:{minutes:02d}:{seconds:02d}{period}"
        except Exception as e:
            return 'Invalid date'

