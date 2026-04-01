from rest_framework import serializers
from django.db import transaction
from .models import Account, VoucherEntry, VoucherEntryDetails, VoucherType, DefaultAccountHead, ReportSection
from datetime import datetime


class AccountMinimalSerializer(serializers.ModelSerializer):
    """Ultra-lightweight serializer for dropdowns/selectors — NO extra DB queries per row"""
    accountTypeDisplay = serializers.CharField(
        source='get_accountType_display', read_only=True)

    class Meta:
        model = Account
        fields = ['id', 'accountCode', 'accountName', 'accountTypeDisplay']
        read_only_fields = fields


class AccountSerializer(serializers.ModelSerializer):
    accountTypeDisplay = serializers.CharField(
        source='get_accountType_display', read_only=True)
    parentAccountName = serializers.CharField(
        source='parentAccount.accountName', read_only=True)
    createdByName = serializers.CharField(
        source='createdBy.full_name', read_only=True)
    updatedByName = serializers.CharField(
        source='updatedBy.full_name', read_only=True)
    hasVoucherEntries = serializers.SerializerMethodField()
    isDefaultAccountHead = serializers.SerializerMethodField()

    class Meta:
        model = Account
        fields = [
            'id', 'accountCode', 'accountName', 'description', 'accountType', 'accountTypeDisplay',
            'parentAccount', 'parentAccountName', 'currentBalance', 'openingBalance', 'openingBalanceDate', 
            'openingDebit', 'openingCredit', 'isActive', 'isSystemAccount', 'isGroup',
            'hasSubAccounts', 'hasVoucherEntries', 'isDefaultAccountHead', 'createdBy', 'createdByName', 'createdAt', 'updatedBy', 'updatedByName', 'updatedAt'
        ]
        read_only_fields = ['id', 'hasSubAccounts', 'hasVoucherEntries', 'isDefaultAccountHead', 'createdAt',
                            'updatedAt', 'accountTypeDisplay', 'parentAccountName', 'openingBalance']

    def get_hasVoucherEntries(self, obj):
        """Check if account has associated voucher entries"""
        return obj.voucher_details.exists()
    
    def get_isDefaultAccountHead(self, obj):
        """Check if account is used as a default account head"""
        from .models import DefaultAccountHead
        return DefaultAccountHead.objects.filter(defaultAccount=obj).exists()

    def validate_accountCode(self, value):
        """Validate account code and provide user-friendly error messages"""
        if not value or not value.strip():
            raise serializers.ValidationError("Account code is required.")

        # Normalize the account code
        value = value.strip()

        # Check for duplicate account codes (excluding current instance in update)
        instance_id = self.instance.id if self.instance else None
        
        # Prevent changing account code for existing accounts
        if self.instance and self.instance.accountCode:
            if value != self.instance.accountCode:
                raise serializers.ValidationError(
                    "Account code cannot be changed once assigned. Please create a new account if you need a different code."
                )

        if Account.objects.filter(accountCode=value).exclude(id=instance_id).exists():
            raise serializers.ValidationError(
                f"Account code '{value}' is already in use. Please enter a unique account code."
            )

        return value

    def validate_accountName(self, value):
        """Validate account name and provide user-friendly error messages"""
        if not value or not value.strip():
            raise serializers.ValidationError("Account name is required.")

        return value.strip()

    def validate_accountType(self, value):
        """Validate account type"""
        if not value:
            raise serializers.ValidationError("Account type is required.")

        valid_types = ['asset', 'liability', 'equity', 'revenue', 'expense']
        if value not in valid_types:
            raise serializers.ValidationError(
                f"Invalid account type. Please select one of: {', '.join(valid_types)}."
            )
        
        # Additional check: prevent type change if account has voucher entries
        if self.instance and self.instance.voucher_details.exists():
            if value != self.instance.accountType:
                raise serializers.ValidationError(
                    f"Cannot change account type as this account has associated voucher entries. Current type: {self.instance.get_accountType_display()}."
                )

        return value

    def validate(self, data):
        """Validate the entire account data"""
        from decimal import Decimal
        
        # XOR validation for openingDebit and openingCredit
        opening_debit = Decimal(str(data.get('openingDebit', 0))) if data.get('openingDebit') else Decimal('0')
        opening_credit = Decimal(str(data.get('openingCredit', 0))) if data.get('openingCredit') else Decimal('0')
        
        if opening_debit > 0 and opening_credit > 0:
            raise serializers.ValidationError({
                'openingDebit': 'Cannot have both opening debit and opening credit. Please enter only one.',
                'openingCredit': 'Cannot have both opening debit and opening credit. Please enter only one.'
            })
        
        # Check if account is used as default account head when updating
        if self.instance:
            from .models import DefaultAccountHead
            default_heads = DefaultAccountHead.objects.filter(defaultAccount=self.instance)
            
            if default_heads.exists():
                # Check if critical fields are being modified
                account_name = data.get('accountName')
                parent_account = data.get('parentAccount')
                account_type = data.get('accountType')
                
                # Get current values
                current_name = self.instance.accountName
                current_parent = self.instance.parentAccount
                current_type = self.instance.accountType
                
                # Get default head names for error message
                default_head_names = [f"{head.customLabel or head.transactionType}" for head in default_heads]
                default_heads_str = ", ".join(default_head_names)
                
                # Check if parent is being changed
                if parent_account != current_parent:
                    raise serializers.ValidationError(
                        {"parentAccount": f"Cannot move account '{current_name}' to a different parent as it is used in system configurations ({default_heads_str})."}
                    )
                
                # Check if account type is being changed
                if account_type and account_type != current_type:
                    raise serializers.ValidationError(
                        {"accountType": f"Cannot change account type for '{current_name}' as it is used in system configurations ({default_heads_str})."}
                    )
        
        # Check if account has voucher entries when updating
        if self.instance and self.instance.voucher_details.exists():
            # Check if critical fields are being modified
            account_name = data.get('accountName')
            parent_account = data.get('parentAccount')
            account_type = data.get('accountType')
            
            # Get current values
            current_name = self.instance.accountName
            current_parent = self.instance.parentAccount
            current_type = self.instance.accountType
            
            # Check if parent is being changed
            if parent_account != current_parent:
                raise serializers.ValidationError(
                    {"parentAccount": f"Cannot move account '{current_name}' to a different parent as it has associated voucher entries. Financial integrity requires structural consistency for accounts with transactions."}
                )
            
            # Check if account type is being changed
            if account_type and account_type != current_type:
                raise serializers.ValidationError(
                    {"accountType": f"Cannot change account type for '{current_name}' from {current_type.capitalize()} to {account_type.capitalize()} as it has associated voucher entries. The account type is locked due to existing financial transactions."}
                )
        
        # Check if parent account exists and is not the same as the account itself
        parent_account = data.get('parentAccount')
        if parent_account and self.instance and parent_account.id == self.instance.id:
            raise serializers.ValidationError(
                {"parentAccount": "An account cannot be its own parent account."}
            )

        # Check if parent account is active
        if parent_account and not parent_account.isActive:
            raise serializers.ValidationError(
                {"parentAccount": "The selected parent account is inactive. Please choose an active account."}
            )

        # Validate parent account type matches child account type
        account_type = data.get('accountType')
        if parent_account and account_type:
            if parent_account.accountType != account_type:
                parent_type_display = parent_account.get_accountType_display()
                child_type_display = dict(Account.ACCOUNT_TYPES).get(account_type, account_type.capitalize())
                raise serializers.ValidationError(
                    {"parentAccount": f"Parent account type must match the selected account type. Parent account '{parent_account.accountName}' is of type '{parent_type_display}', but you selected '{child_type_display}' as the account type. Please select a parent account of type '{child_type_display}' or change the account type to '{parent_type_display}'."}
                )

        # Check for duplicate account names under the same parent
        account_name = data.get('accountName')
        if account_name:
            account_name = account_name.strip()
            
            # Build the query to find duplicate names under same parent
            duplicate_query = Account.objects.filter(
                accountName__iexact=account_name,
                parentAccount=parent_account
            )
            
            # Exclude current instance if updating
            if self.instance:
                duplicate_query = duplicate_query.exclude(id=self.instance.id)
            
            if duplicate_query.exists():
                # Build a user-friendly error message
                if parent_account:
                    parent_name = parent_account.accountName
                    error_msg = f"An account with the name '{account_name}' already exists under parent account '{parent_name}'. Please choose a unique account name within this parent category."
                else:
                    error_msg = f"A root-level account with the name '{account_name}' already exists. Please choose a unique account name."
                
                raise serializers.ValidationError(
                    {"accountName": error_msg}
                )

        return data


class VoucherTypeSerializer(serializers.ModelSerializer):
    """Serializer for voucher types"""
    nameDisplay = serializers.CharField(
        source='get_name_display', read_only=True)
    createdByName = serializers.CharField(
        source='createdBy.full_name', read_only=True)
    updatedByName = serializers.CharField(
        source='updatedBy.full_name', read_only=True)
    # Add value and label fields for frontend compatibility
    value = serializers.CharField(source='name', read_only=True)
    label = serializers.CharField(source='get_name_display', read_only=True)

    class Meta:
        model = VoucherType
        fields = [
            'id', 'name', 'nameDisplay', 'displayName', 'description', 'prefix',
            'isActive', 'createdBy', 'createdByName', 'createdAt',
            'updatedBy', 'updatedByName', 'updatedAt',
            'value', 'label'  # Add for frontend compatibility
        ]
        read_only_fields = ['id', 'nameDisplay', 'createdByName',
                            'updatedByName', 'createdAt', 'updatedAt', 'value', 'label']


class VoucherEntryDetailsSerializer(serializers.ModelSerializer):
    """Serializer for voucher entry detail items"""
    accountCode = serializers.CharField(
        source='account.accountCode', read_only=True)
    accountName = serializers.CharField(
        source='account.accountName', read_only=True)
    accountId = serializers.PrimaryKeyRelatedField(
        queryset=Account.objects.filter(isActive=True),
        source='account',
        required=True
    )
    unitName = serializers.CharField(source='unit.unit_name', read_only=True)

    class Meta:
        model = VoucherEntryDetails
        fields = [
            'id', 'lineNumber', 'accountId', 'accountCode', 'accountName',
            'unit', 'unitName', 'account_holder_type', 'account_holder_id',
            'description', 'debitAmount', 'creditAmount', 'createdAt', 'updatedAt'
        ]
        read_only_fields = ['id', 'createdAt',
                            'updatedAt', 'accountCode', 'accountName']

    def validate(self, data):
        """Validate that either debit or credit is entered, but not both"""
        debit = data.get('debitAmount', 0)
        credit = data.get('creditAmount', 0)

        if debit > 0 and credit > 0:
            raise serializers.ValidationError(
                "A line cannot have both debit and credit amounts. Use separate lines."
            )
        if debit == 0 and credit == 0:
            raise serializers.ValidationError(
                "A line must have either a debit or credit amount."
            )

        return data


class VoucherEntrySerializer(serializers.ModelSerializer):
    """Serializer for voucher entries with nested detail items"""
    details = VoucherEntryDetailsSerializer(many=True)
    statusDisplay = serializers.CharField(
        source='get_status_display', read_only=True)
    voucherTypeName = serializers.CharField(
        source='voucherType.get_name_display', read_only=True)
    createdByName = serializers.CharField(
        source='createdBy.full_name', read_only=True)
    postedByName = serializers.CharField(
        source='postedBy.full_name', read_only=True)
    updatedByName = serializers.CharField(
        source='updatedBy.full_name', read_only=True)
    unitName = serializers.CharField(source='unit.unit_name', read_only=True)
    isBalanced = serializers.SerializerMethodField()

    class Meta:
        model = VoucherEntry
        fields = [
            'id', 'voucherNumber', 'entryDate', 'referenceNumber', 'narration',
            'voucherType', 'voucherTypeName',
            'unit', 'unitName', 'account_holder_type', 'account_holder_id',
            'status', 'statusDisplay', 'totalDebit', 'totalCredit', 'isBalanced',
            'createdBy', 'createdByName', 'createdAt',
            'postedBy', 'postedByName', 'postedAt',
            'updatedBy', 'updatedByName', 'updatedAt',
            'details'
        ]
        read_only_fields = [
            'id', 'totalDebit', 'totalCredit', 'createdAt', 'updatedAt',
            'statusDisplay', 'voucherTypeName', 'createdByName', 'postedByName', 'updatedByName',
            'postedBy', 'postedAt', 'isBalanced'
        ]

    def get_isBalanced(self, obj):
        """Check if the voucher entry is balanced (debits = credits)"""
        return obj.totalDebit == obj.totalCredit

    def validate_details(self, details):
        """Validate that there are at least 2 details"""
        if len(details) < 2:
            raise serializers.ValidationError(
                "A voucher entry must have at least 2 lines (minimum one debit and one credit)."
            )
        return details

    def validate(self, data):
        """Validate the entire voucher entry"""
        details = data.get('details', [])

        # Calculate totals from details
        total_debit = sum(detail.get('debitAmount', 0) for detail in details)
        total_credit = sum(detail.get('creditAmount', 0) for detail in details)

        # For posted entries, debits must equal credits
        status = data.get('status', 'draft')
        if status == 'posted' and total_debit != total_credit:
            raise serializers.ValidationError(
                f"Total debits ({total_debit}) must equal total credits ({total_credit}) for posted entries."
            )

        return data

    @transaction.atomic
    def create(self, validated_data):
        """Create voucher entry with details in a transaction"""
        details_data = validated_data.pop('details')

        # Generate voucher number if not provided
        if not validated_data.get('voucherNumber'):
            # Get voucher type prefix
            voucher_type = validated_data.get('voucherType')
            prefix = voucher_type.prefix if voucher_type else 'JV'

            # Generate format: PREFIX-YYYY-XXXX (e.g., RV-2025-001)
            today = datetime.now()
            year_part = today.strftime('%Y')

            # Get the last voucher number for this type and year
            last_entry = VoucherEntry.objects.filter(
                voucherNumber__startswith=f'{prefix}-{year_part}',
                voucherType=voucher_type
            ).order_by('-voucherNumber').first()

            if last_entry:
                # Extract sequence number from last voucher (PREFIX-YYYY-XXX)
                last_seq = int(last_entry.voucherNumber.split('-')[-1])
                new_seq = last_seq + 1
            else:
                new_seq = 1

            validated_data['voucherNumber'] = f'{prefix}-{year_part}-{new_seq:03d}'

        # Calculate totals
        total_debit = sum(detail.get('debitAmount', 0)
                          for detail in details_data)
        total_credit = sum(detail.get('creditAmount', 0)
                           for detail in details_data)

        validated_data['totalDebit'] = total_debit
        validated_data['totalCredit'] = total_credit

        # Set posted timestamp if status is posted
        if validated_data.get('status') == 'posted':
            validated_data['postedAt'] = datetime.now()
            validated_data['postedBy'] = validated_data.get('createdBy')

        # Create voucher entry
        voucher_entry = VoucherEntry.objects.create(**validated_data)

        # Create details
        for idx, detail_data in enumerate(details_data, start=1):
            detail_data['lineNumber'] = idx
            VoucherEntryDetails.objects.create(
                voucherEntry=voucher_entry, **detail_data)

        return voucher_entry

    @transaction.atomic
    def update(self, instance, validated_data):
        """Update voucher entry with details"""
        details_data = validated_data.pop('details', None)

        # Only allow updates if status is draft
        if instance.status == 'posted':
            raise serializers.ValidationError(
                "Cannot update a posted voucher entry. Create a reversing entry instead."
            )

        # Update voucher entry fields
        for attr, value in validated_data.items():
            setattr(instance, attr, value)

        # If details provided, replace all details
        if details_data is not None:
            # Delete existing details
            instance.details.all().delete()

            # Create new details
            total_debit = 0
            total_credit = 0
            for idx, detail_data in enumerate(details_data, start=1):
                detail_data['lineNumber'] = idx
                total_debit += detail_data.get('debitAmount', 0)
                total_credit += detail_data.get('creditAmount', 0)
                VoucherEntryDetails.objects.create(
                    voucherEntry=instance, **detail_data)

            instance.totalDebit = total_debit
            instance.totalCredit = total_credit

        # Set posted timestamp if status changed to posted
        if instance.status == 'posted' and not instance.postedAt:
            instance.postedAt = datetime.now()
            instance.postedBy = validated_data.get('updatedBy')

        instance.save()
        return instance


class VoucherEntryListSerializer(serializers.ModelSerializer):
    """Simplified serializer for listing voucher entries"""
    statusDisplay = serializers.CharField(
        source='get_status_display', read_only=True)
    voucherTypeName = serializers.CharField(
        source='voucherType.displayName', read_only=True)
    createdByName = serializers.CharField(
        source='createdBy.full_name', read_only=True)
    isBalanced = serializers.SerializerMethodField()
    detailCount = serializers.SerializerMethodField()
    unitName = serializers.CharField(source='unit.unit_name', read_only=True)

    class Meta:
        model = VoucherEntry
        fields = [
            'id', 'voucherNumber', 'entryDate', 'referenceNumber', 'narration',
            'voucherType', 'voucherTypeName',
            'unit', 'unitName', 'account_holder_type', 'account_holder_id',
            'status', 'statusDisplay', 'totalDebit', 'totalCredit', 'isBalanced',
            'detailCount', 'createdBy', 'createdByName', 'createdAt'
        ]
        read_only_fields = fields

    def get_isBalanced(self, obj):
        return obj.totalDebit == obj.totalCredit

    def get_detailCount(self, obj):
        return obj.details.count()


class DefaultAccountHeadSerializer(serializers.ModelSerializer):
    """Serializer for default account head configurations"""
    defaultAccountCode = serializers.CharField(
        source='defaultAccount.accountCode', read_only=True)
    defaultAccountName = serializers.CharField(
        source='defaultAccount.accountName', read_only=True)
    createdByName = serializers.CharField(
        source='createdBy.full_name', read_only=True)
    updatedByName = serializers.CharField(
        source='updatedBy.full_name', read_only=True)
    defaultEntryTypeDisplay = serializers.CharField(
        source='get_defaultEntryType_display', read_only=True)

    class Meta:
        model = DefaultAccountHead
        fields = [
            'id', 'transactionType', 'customLabel', 'defaultAccount', 'defaultEntryType', 'defaultEntryTypeDisplay',
            'defaultAccountCode', 'defaultAccountName', 'description', 'isActive',
            'createdBy', 'createdByName', 'createdAt', 'updatedBy', 'updatedByName', 'updatedAt'
        ]
        read_only_fields = ['id', 'createdAt', 'updatedAt',
                            'defaultAccountCode', 'defaultAccountName', 'defaultEntryTypeDisplay']
        extra_kwargs = {
            'defaultEntryType': {
                'required': False
            }
        }

    def validate(self, data):
        """Validate that the selected account is active and transactionType is unique"""
        account = data.get('defaultAccount')
        if account and not account.isActive:
            raise serializers.ValidationError(
                "Cannot set an inactive account as default.")

        # Check uniqueness of transactionType (case-insensitive)
        transaction_type = data.get('transactionType', '').strip().lower()
        instance_id = self.instance.id if self.instance else None

        if DefaultAccountHead.objects.filter(
            transactionType__iexact=transaction_type
        ).exclude(id=instance_id).exists():
            raise serializers.ValidationError(
                {"transactionType": "A default account head already exists for this transaction type. Please choose another type."}
            )

        return data

class ReportSectionSerializer(serializers.ModelSerializer):
    """Serializer for financial report section configurations"""
    moduleNameDisplay = serializers.CharField(
        source='get_moduleName_display', read_only=True)
    createdByName = serializers.CharField(
        source='createdBy.full_name', read_only=True)
    updatedByName = serializers.CharField(
        source='updatedBy.full_name', read_only=True)
    accountDetails = AccountSerializer(source='accounts', many=True, read_only=True)

    class Meta:
        model = ReportSection
        fields = [
            'id', 'moduleName', 'moduleNameDisplay', 'sectionName', 'order', 
            'accounts', 'accountDetails', 'description', 'isActive',
            'createdBy', 'createdByName', 'createdAt', 
            'updatedBy', 'updatedByName', 'updatedAt'
        ]
        read_only_fields = ['id', 'createdAt', 'updatedAt', 'moduleNameDisplay', 
                            'createdByName', 'updatedByName', 'accountDetails']

    def validate(self, data):
        """Ensure section order and uniqueness within module"""
        module_name = data.get('moduleName')
        section_name = data.get('sectionName')
        instance_id = self.instance.id if self.instance else None

        if ReportSection.objects.filter(
            moduleName=module_name, 
            sectionName__iexact=section_name
        ).exclude(id=instance_id).exists():
            raise serializers.ValidationError(
                {"sectionName": "Section Display Name already exists. Please use a different name."}
            )
        
        return data
