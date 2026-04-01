from rest_framework import viewsets, status, serializers
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from rest_framework.views import APIView
from rest_framework.pagination import PageNumberPagination
from django.db import connection, transaction
from django.db.models import Q, Sum
from datetime import datetime
from decimal import Decimal
from .models import Account, VoucherEntry, VoucherEntryDetails, VoucherType, DefaultAccountHead, ReportSection
from .serializers import (
    AccountSerializer,
    AccountMinimalSerializer,
    VoucherEntrySerializer,
    VoucherEntryListSerializer,
    VoucherTypeSerializer,
    DefaultAccountHeadSerializer,
    ReportSectionSerializer
)
from user.permissions import HasRequiredPermission
from group_role.permission_constants import (
    PERMISSION_VIEW_CHART_OF_ACCOUNTS,
    PERMISSION_ADD_CHART_OF_ACCOUNTS,
    PERMISSION_EDIT_CHART_OF_ACCOUNTS,
)


class AccountViewSet(viewsets.ModelViewSet):
    queryset = Account.objects.all()
    serializer_class = AccountSerializer
    permission_classes = [IsAuthenticated, HasRequiredPermission]
    ordering = ['accountCode']

    def get_required_permission_id(self, request):
        """Determine required permission based on HTTP method"""
        if request.method == 'GET':
            return [PERMISSION_VIEW_CHART_OF_ACCOUNTS]
        elif request.method in ['POST']:
            return [PERMISSION_ADD_CHART_OF_ACCOUNTS]
        elif request.method in ['PUT', 'PATCH', 'DELETE']:
            return [PERMISSION_EDIT_CHART_OF_ACCOUNTS]
        return []

    def get_queryset(self):
        """Filter accounts based on query parameters"""
        queryset = super().get_queryset()

        # Filter by account type
        account_type = self.request.query_params.get('account_type')
        if account_type:
            queryset = queryset.filter(accountType=account_type)

        # Filter by active status
        is_active = self.request.query_params.get('is_active')
        if is_active is not None:
            is_active_bool = is_active.lower() == 'true'
            queryset = queryset.filter(isActive=is_active_bool)

        # Search by account code, name, or description
        search = self.request.query_params.get('search')
        if search:
            queryset = queryset.filter(
                Q(accountCode__icontains=search) |
                Q(accountName__icontains=search) |
                Q(description__icontains=search)
            )

        return queryset

    @action(detail=False, methods=['get'], url_path='minimal')
    def minimal_list(self, request):
        """Ultra-fast account list for selectors/dropdowns — no N+1 queries"""
        self.required_permission_id = [PERMISSION_VIEW_CHART_OF_ACCOUNTS]
        queryset = self.get_queryset().only('id', 'accountCode', 'accountName', 'accountType').order_by('accountCode')
        serializer = AccountMinimalSerializer(queryset, many=True)
        return Response(serializer.data)

    def list(self, request, *args, **kwargs):
        self.required_permission_id = self.get_required_permission_id(request)
        return super().list(request, *args, **kwargs)

    def retrieve(self, request, *args, **kwargs):
        self.required_permission_id = self.get_required_permission_id(request)
        return super().retrieve(request, *args, **kwargs)

    def create(self, request, *args, **kwargs):
        self.required_permission_id = self.get_required_permission_id(request)
        try:
            serializer = self.get_serializer(data=request.data)
            serializer.is_valid(raise_exception=True)
            serializer.save(createdBy=request.user.member)
            return Response(serializer.data, status=status.HTTP_201_CREATED)
        except serializers.ValidationError as e:
            # Extract user-friendly error messages from serializer validation errors
            error_dict = e.detail if hasattr(e, 'detail') else {}
            user_friendly_errors = {}

            for field, errors in error_dict.items():
                if isinstance(errors, list) and len(errors) > 0:
                    # Get the first error message
                    error = errors[0]
                    # Extract string from ErrorDetail object
                    if hasattr(error, 'string'):
                        user_friendly_errors[field] = str(error)
                    else:
                        user_friendly_errors[field] = str(error)
                else:
                    user_friendly_errors[field] = str(errors)

            return Response(
                user_friendly_errors,
                status=status.HTTP_400_BAD_REQUEST
            )
        except Exception as e:
            return Response(
                {'message': str(e)},
                status=status.HTTP_400_BAD_REQUEST
            )

    def update(self, request, *args, **kwargs):
        self.required_permission_id = self.get_required_permission_id(request)
        try:
            partial = kwargs.pop('partial', False)
            instance = self.get_object()
            serializer = self.get_serializer(
                instance, data=request.data, partial=partial)
            serializer.is_valid(raise_exception=True)
            serializer.save(updatedBy=request.user.member)
            return Response(serializer.data)
        except serializers.ValidationError as e:
            # Extract user-friendly error messages from serializer validation errors
            error_dict = e.detail if hasattr(e, 'detail') else {}
            user_friendly_errors = {}

            for field, errors in error_dict.items():
                if isinstance(errors, list) and len(errors) > 0:
                    # Get the first error message
                    error = errors[0]
                    # Extract string from ErrorDetail object
                    if hasattr(error, 'string'):
                        user_friendly_errors[field] = str(error)
                    else:
                        user_friendly_errors[field] = str(error)
                else:
                    user_friendly_errors[field] = str(errors)

            return Response(
                user_friendly_errors,
                status=status.HTTP_400_BAD_REQUEST
            )
        except Exception as e:
            return Response(
                {'message': str(e)},
                status=status.HTTP_400_BAD_REQUEST
            )

    def destroy(self, request, *args, **kwargs):
        self.required_permission_id = self.get_required_permission_id(request)
        try:
            instance = self.get_object()

            # Check if account has voucher entries
            if instance.voucher_details.exists():
                voucher_count = instance.voucher_details.count()
                return Response(
                    {'success': False, 'message': f'Cannot delete account "{instance.accountName}" as it has {voucher_count} associated voucher {"entry" if voucher_count == 1 else "entries"}. Please void or remove the voucher entries first.'},
                    status=status.HTTP_400_BAD_REQUEST
                )

            # Check if account has sub-accounts
            if instance.subAccounts.filter(isActive=True).exists():
                return Response(
                    {'success': False, 'message': 'Cannot delete account with sub-accounts'},
                    status=status.HTTP_400_BAD_REQUEST
                )
            
            # Check if account is used as default account head
            from .models import DefaultAccountHead
            default_heads = DefaultAccountHead.objects.filter(defaultAccount=instance)
            if default_heads.exists():
                default_head_names = [f"{head.customLabel or head.transactionType}" for head in default_heads]
                return Response(
                    {'success': False, 'message': f'Cannot delete account "{instance.accountName}" because it is set as the default account for: {", ".join(default_head_names)}. Please update or remove these default account head configurations first.'},
                    status=status.HTTP_400_BAD_REQUEST
                )
            
            instance.delete()
            return Response(status=status.HTTP_204_NO_CONTENT)
        except Exception as e:
            # Check if it's a protected foreign key error
            error_message = str(e)
            if 'protected foreign keys' in error_message.lower():
                return Response(
                    {'success': False, 'message': f'Cannot delete account "{instance.accountName}" because it is being used by other system components. Please remove all references to this account before deleting it.'},
                    status=status.HTTP_400_BAD_REQUEST
                )
            return Response(
                {'success': False, 'message': error_message},
                status=status.HTTP_400_BAD_REQUEST
            )

    @action(detail=False, methods=['get'])
    def generate_code(self, request):
        """Generate a structured unique account code"""
        self.required_permission_id = [PERMISSION_VIEW_CHART_OF_ACCOUNTS]
        try:
            account_type = request.query_params.get('account_type')
            parent_id = request.query_params.get('parent_id')

            if not account_type:
                return Response(
                    {'success': False, 'message': 'Account type is required'},
                    status=status.HTTP_400_BAD_REQUEST
                )

            # Define base prefixes for account types
            type_prefixes = {
                'asset': '1',
                'liability': '2',
                'equity': '3',
                'revenue': '4',
                'expense': '5'
            }

            prefix = type_prefixes.get(account_type, '9')
            parent = None
            
            if parent_id and parent_id != 'null':
                try:
                    parent = Account.objects.get(id=parent_id)
                    prefix = parent.accountCode
                except Account.DoesNotExist:
                    pass

            # Logic to find the next available code
            # 1. If it's a root type (no parent), and standard codes 1000, 2000 etc exist
            # 2. If parent is like 1000, next is 1100, 1200...
            # 3. If parent is like 1110, next is 1111, 1112...
            
            new_code = self._get_next_sequential_code(prefix, parent)
            
            return Response(
                {'success': True, 'accountCode': new_code},
                status=status.HTTP_200_OK
            )
        except Exception as e:
            return Response(
                {'success': False, 'message': str(e)},
                status=status.HTTP_400_BAD_REQUEST
            )

    def _get_next_sequential_code(self, prefix, parent=None):
        """Internal helper to calculate the next sequential code"""
        # If no parent, and prefix is just the type (1, 2, 3, 4, 5)
        if not parent:
            # Check for root account X000
            root_code = f"{prefix}000"
            if not Account.objects.filter(accountCode=root_code).exists():
                return root_code
            
            # If root exists, find next X100, X200...
            for i in range(1, 10):
                code = f"{prefix}{i}00"
                if not Account.objects.filter(accountCode=code).exists():
                    return code
            
            # If all X100-X900 exist, find max and increment
            last_account = Account.objects.filter(
                accountCode__startswith=prefix,
                accountCode__regex=r'^\d{4}$'
            ).order_by('-accountCode').first()
            
            if last_account:
                try:
                    next_val = int(last_account.accountCode) + 100
                    return str(next_val)
                except ValueError:
                    pass
            return f"{prefix}001" # Fallback

        # If parent exists
        parent_code = parent.accountCode
        
        # Determine the "step" based on the parent code's trailing zeros
        if parent_code.endswith('000'):
            # Parent is X000, next level is X100, X200...
            base = parent_code[:1]
            for i in range(1, 10):
                code = f"{base}{i}00"
                if not Account.objects.filter(accountCode=code).exists():
                    return code
        elif parent_code.endswith('00'):
            # Parent is XY00, next level is XY10, XY20...
            base = parent_code[:2]
            for i in range(1, 10):
                code = f"{base}{i}0"
                if not Account.objects.filter(accountCode=code).exists():
                    return code
        elif parent_code.endswith('0'):
            # Parent is XYZ0, next level is XYZ1, XYZ2...
            base = parent_code[:3]
            for i in range(1, 10):
                code = f"{base}{i}"
                if not Account.objects.filter(accountCode=code).exists():
                    return code
        
        # If no easy pattern (e.g. 1111) or all slots filled
        # We find the longest existing code that starts with parent_code
        last_sub = Account.objects.filter(
            accountCode__startswith=parent_code
        ).exclude(accountCode=parent_code).order_by('-accountCode').first()
        
        if last_sub:
            # Try to increment the numeric part
            try:
                # If they have same length, just increment
                # If parent is 1111 and last_sub is 111101, next is 111102
                # If parent is 1111 and no last_sub, next is 111101
                code_str = last_sub.accountCode
                # Find where it differs from parent
                suffix = code_str[len(parent_code):]
                if suffix.isdigit():
                    next_suffix = int(suffix) + 1
                    # Keep same padding
                    return parent_code + str(next_suffix).zfill(len(suffix))
            except (ValueError, IndexError):
                pass
        
        # Default fallback for sub-account: ParentCode + "01"
        return parent_code + "01"

    @action(detail=True, methods=['patch'])
    def toggle_status(self, request, pk=None):
        """Toggle account active status"""
        self.required_permission_id = [PERMISSION_EDIT_CHART_OF_ACCOUNTS]
        try:
            account = self.get_object()
            account.isActive = not account.isActive
            account.updatedBy = request.user.member
            account.save()
            return Response(
                {'success': True, 'message': 'Account status updated',
                    'data': self.get_serializer(account).data},
                status=status.HTTP_200_OK
            )
        except Exception as e:
            return Response(
                {'success': False, 'message': str(e)},
                status=status.HTTP_400_BAD_REQUEST
            )

    @action(detail=False, methods=['get'])
    def parent_accounts(self, request):
        """Get list of accounts that can be used as parent accounts"""
        self.required_permission_id = [PERMISSION_VIEW_CHART_OF_ACCOUNTS]
        try:
            is_active = request.query_params.get(
                'is_active', 'true').lower() == 'true'
            is_group_param = request.query_params.get('is_group')
            exclude_id = request.query_params.get('exclude_id')

            queryset = self.queryset.filter(isActive=is_active)

            if is_group_param is not None:
                is_group = str(is_group_param).lower() == 'true'
                queryset = queryset.filter(isGroup=is_group)

            if exclude_id:
                queryset = queryset.exclude(id=exclude_id)

            serializer = self.get_serializer(queryset, many=True)
            return Response(
                {'success': True, 'data': serializer.data},
                status=status.HTTP_200_OK
            )
        except Exception as e:
            return Response(
                {'success': False, 'message': str(e)},
                status=status.HTTP_400_BAD_REQUEST
            )


class VoucherTypeViewSet(viewsets.ReadOnlyModelViewSet):
    """ViewSet for managing voucher types"""
    queryset = VoucherType.objects.filter(isActive=True)
    serializer_class = VoucherTypeSerializer
    permission_classes = [IsAuthenticated, HasRequiredPermission]
    ordering = ['name']

    def get_required_permission_id(self, request):
        """Determine required permission based on HTTP method"""
        # Using chart of accounts permissions for voucher types
        if request.method == 'GET':
            return [PERMISSION_VIEW_CHART_OF_ACCOUNTS]
        return []

    def list(self, request, *args, **kwargs):
        self.required_permission_id = self.get_required_permission_id(request)
        return super().list(request, *args, **kwargs)

    def retrieve(self, request, *args, **kwargs):
        self.required_permission_id = self.get_required_permission_id(request)
        return super().retrieve(request, *args, **kwargs)


class VoucherEntryViewSet(viewsets.ModelViewSet):
    """ViewSet for managing voucher entries"""
    queryset = VoucherEntry.objects.all().prefetch_related(
        'details', 'details__account')
    permission_classes = [IsAuthenticated, HasRequiredPermission]
    ordering = ['-entryDate', '-voucherNumber']

    def get_serializer_class(self):
        """Use different serializers for list and detail views"""
        if self.action == 'list':
            return VoucherEntryListSerializer
        return VoucherEntrySerializer

    def get_required_permission_id(self, request):
        """Determine required permission based on HTTP method"""
        # Using chart of accounts permissions for voucher entries
        if request.method == 'GET':
            return [PERMISSION_VIEW_CHART_OF_ACCOUNTS]
        elif request.method in ['POST']:
            return [PERMISSION_ADD_CHART_OF_ACCOUNTS]
        elif request.method in ['PUT', 'PATCH', 'DELETE']:
            return [PERMISSION_EDIT_CHART_OF_ACCOUNTS]
        return []

    def get_queryset(self):
        """Filter voucher entries based on query parameters"""
        queryset = super().get_queryset()

        # Filter by status
        status_filter = self.request.query_params.get('status')
        if status_filter:
            queryset = queryset.filter(status=status_filter)

        # Filter by voucher type (supports multiple types)
        voucher_types = self.request.query_params.getlist('voucher_type')
        if voucher_types:
            # Filter by VoucherType name field, supporting multiple types with OR logic
            queryset = queryset.filter(voucherType__name__in=voucher_types)

        # Filter by date range
        from_date = self.request.query_params.get('from_date')
        to_date = self.request.query_params.get('to_date')
        if from_date:
            queryset = queryset.filter(entryDate__gte=from_date)
        if to_date:
            queryset = queryset.filter(entryDate__lte=to_date)

        # Search by voucher number or narration
        search = self.request.query_params.get('search')
        if search:
            queryset = queryset.filter(
                Q(voucherNumber__icontains=search) |
                Q(narration__icontains=search) |
                Q(referenceNumber__icontains=search)
            )

        return queryset

    def list(self, request, *args, **kwargs):
        self.required_permission_id = self.get_required_permission_id(request)
        return super().list(request, *args, **kwargs)

    def retrieve(self, request, *args, **kwargs):
        self.required_permission_id = self.get_required_permission_id(request)
        return super().retrieve(request, *args, **kwargs)

    def create(self, request, *args, **kwargs):
        """Create a new voucher entry"""
        self.required_permission_id = self.get_required_permission_id(request)
        try:
            serializer = self.get_serializer(data=request.data)
            serializer.is_valid(raise_exception=True)
            serializer.save(
                createdBy=request.user.member,
                updatedBy=request.user.member
            )
            return Response(
                {'success': True, 'message': 'Voucher entry created successfully',
                    'data': serializer.data},
                status=status.HTTP_201_CREATED
            )
        except Exception as e:
            return Response(
                {'success': False, 'message': str(e)},
                status=status.HTTP_400_BAD_REQUEST
            )

    def update(self, request, *args, **kwargs):
        """Update an existing voucher entry"""
        self.required_permission_id = self.get_required_permission_id(request)
        try:
            partial = kwargs.pop('partial', False)
            instance = self.get_object()

            # Check if entry is posted
            if instance.status == 'posted':
                return Response(
                    {'success': False, 'message': 'Cannot update a posted voucher entry. Create a reversing entry instead.'},
                    status=status.HTTP_400_BAD_REQUEST
                )

            serializer = self.get_serializer(
                instance, data=request.data, partial=partial)
            serializer.is_valid(raise_exception=True)
            serializer.save(updatedBy=request.user.member)
            return Response(
                {'success': True, 'message': 'Voucher entry updated successfully',
                    'data': serializer.data}
            )
        except Exception as e:
            return Response(
                {'success': False, 'message': str(e)},
                status=status.HTTP_400_BAD_REQUEST
            )

    def destroy(self, request, *args, **kwargs):
        """Delete a voucher entry (only if not posted)"""
        self.required_permission_id = self.get_required_permission_id(request)
        try:
            instance = self.get_object()

            # Only allow deletion of draft entries
            if instance.status == 'posted':
                return Response(
                    {'success': False,
                        'message': 'Cannot delete a posted voucher entry. Void it instead.'},
                    status=status.HTTP_400_BAD_REQUEST
                )

            instance.delete()
            return Response(
                {'success': True, 'message': 'Voucher entry deleted successfully'},
                status=status.HTTP_200_OK
            )
        except Exception as e:
            return Response(
                {'success': False, 'message': str(e)},
                status=status.HTTP_400_BAD_REQUEST
            )

    @action(detail=True, methods=['post'])
    def post_entry(self, request, pk=None):
        """Post a draft voucher entry"""
        self.required_permission_id = [PERMISSION_EDIT_CHART_OF_ACCOUNTS]
        try:
            entry = self.get_object()

            if entry.status == 'posted':
                return Response(
                    {'success': False, 'message': 'Entry is already posted'},
                    status=status.HTTP_400_BAD_REQUEST
                )

            if entry.totalDebit != entry.totalCredit:
                return Response(
                    {'success': False, 'message': f'Entry is not balanced. Debits: {entry.totalDebit}, Credits: {entry.totalCredit}'},
                    status=status.HTTP_400_BAD_REQUEST
                )

            entry.status = 'posted'
            entry.postedBy = request.user.member
            entry.postedAt = datetime.now()
            entry.save()

            # Recalculate balances for all affected accounts
            affected_accounts = set()
            for detail in entry.details.all():
                affected_accounts.add(detail.account)

            for account in affected_accounts:
                account.recalculate_balance()

            serializer = self.get_serializer(entry)
            return Response(
                {'success': True, 'message': 'Voucher entry posted successfully',
                    'data': serializer.data},
                status=status.HTTP_200_OK
            )
        except Exception as e:
            return Response(
                {'success': False, 'message': str(e)},
                status=status.HTTP_400_BAD_REQUEST
            )

    @action(detail=False, methods=['post'])
    def bulk_post_entries(self, request):
        """Post multiple draft voucher entries in bulk"""
        self.required_permission_id = [PERMISSION_EDIT_CHART_OF_ACCOUNTS]
        try:
            voucher_ids = request.data.get('voucher_ids', [])
            if not voucher_ids:
                return Response(
                    {'success': False, 'message': 'No voucher IDs provided'},
                    status=status.HTTP_400_BAD_REQUEST
                )

            vouchers = VoucherEntry.objects.filter(id__in=voucher_ids, status='draft')
            if not vouchers.exists():
                return Response(
                    {'success': False, 'message': 'No draft vouchers found for the provided IDs'},
                    status=status.HTTP_400_BAD_REQUEST
                )

            success_count = 0
            errors = []
            affected_accounts = set()

            for entry in vouchers:
                try:
                    if entry.totalDebit != entry.totalCredit:
                        errors.append(f"Voucher {entry.voucherNumber} is not balanced.")
                        continue

                    entry.status = 'posted'
                    entry.postedBy = request.user.member
                    entry.postedAt = datetime.now()
                    entry.save()

                    for detail in entry.details.all():
                        affected_accounts.add(detail.account)
                    
                    success_count += 1
                except Exception as e:
                    errors.append(f"Error posting voucher {entry.voucherNumber}: {str(e)}")

            for account in affected_accounts:
                account.recalculate_balance()

            return Response({
                'success': True,
                'message': f'Successfully approved {success_count} vouchers.',
                'error_count': len(errors),
                'errors': errors
            }, status=status.HTTP_200_OK)

        except Exception as e:
            return Response(
                {'success': False, 'message': str(e)},
                status=status.HTTP_400_BAD_REQUEST
            )

    @action(detail=True, methods=['post'])
    def void_entry(self, request, pk=None):
        """Void a posted voucher entry"""
        self.required_permission_id = [PERMISSION_EDIT_CHART_OF_ACCOUNTS]
        try:
            entry = self.get_object()

            if entry.status != 'posted':
                return Response(
                    {'success': False, 'message': 'Only posted entries can be voided'},
                    status=status.HTTP_400_BAD_REQUEST
                )

            entry.status = 'void'
            entry.updatedBy = request.user.member
            entry.save()

            # Recalculate balances for all affected accounts
            affected_accounts = set()
            for detail in entry.details.all():
                affected_accounts.add(detail.account)

            for account in affected_accounts:
                account.recalculate_balance()

            serializer = self.get_serializer(entry)
            return Response(
                {'success': True, 'message': 'Voucher entry voided successfully',
                    'data': serializer.data},
                status=status.HTTP_200_OK
            )
        except Exception as e:
            return Response(
                {'success': False, 'message': str(e)},
                status=status.HTTP_400_BAD_REQUEST
            )

    @action(detail=False, methods=['get'])
    def next_voucher_number(self, request):
        """Get the next available voucher number"""
        self.required_permission_id = [PERMISSION_VIEW_CHART_OF_ACCOUNTS]
        try:
            # Get voucher type from query params
            voucher_type_id = request.query_params.get('voucher_type')
            prefix = 'JV'  # Default prefix

            if voucher_type_id:
                try:
                    voucher_type = VoucherType.objects.get(id=voucher_type_id)
                    prefix = voucher_type.prefix
                except VoucherType.DoesNotExist:
                    pass

            today = datetime.now()
            date_part = today.strftime('%Y%m%d')

            last_entry = VoucherEntry.objects.filter(
                voucherNumber__startswith=f'{prefix}-{date_part}'
            ).order_by('-voucherNumber').first()

            if last_entry:
                last_seq = int(last_entry.voucherNumber.split('-')[-1])
                new_seq = last_seq + 1
            else:
                new_seq = 1

            next_number = f'{prefix}-{date_part}-{new_seq:04d}'

            return Response(
                {'success': True, 'voucherNumber': next_number},
                status=status.HTTP_200_OK
            )
        except Exception as e:
            return Response(
                {'success': False, 'message': str(e)},
                status=status.HTTP_400_BAD_REQUEST
            )



class DefaultAccountHeadViewSet(viewsets.ModelViewSet):
    """ViewSet for managing default account head configurations"""
    queryset = DefaultAccountHead.objects.all()
    serializer_class = DefaultAccountHeadSerializer
    permission_classes = [IsAuthenticated, HasRequiredPermission]
    ordering = ['transactionType']

    def get_required_permission_id(self, request):
        """Determine required permission based on HTTP method"""
        if request.method == 'GET':
            return [PERMISSION_VIEW_CHART_OF_ACCOUNTS]
        elif request.method in ['POST']:
            return [PERMISSION_ADD_CHART_OF_ACCOUNTS]
        elif request.method in ['PUT', 'PATCH', 'DELETE']:
            return [PERMISSION_EDIT_CHART_OF_ACCOUNTS]
        return []

    def list(self, request, *args, **kwargs):
        self.required_permission_id = self.get_required_permission_id(request)
        return super().list(request, *args, **kwargs)

    def retrieve(self, request, *args, **kwargs):
        self.required_permission_id = self.get_required_permission_id(request)
        return super().retrieve(request, *args, **kwargs)

    def create(self, request, *args, **kwargs):
        self.required_permission_id = self.get_required_permission_id(request)
        try:
            serializer = self.get_serializer(data=request.data)
            serializer.is_valid(raise_exception=True)
            serializer.save(createdBy=request.user.member)
            return Response(
                {'success': True, 'message': 'Default account head created successfully',
                    'data': serializer.data},
                status=status.HTTP_201_CREATED
            )
        except serializers.ValidationError as e:
            # Extract user-friendly error messages from serializer validation errors
            error_dict = e.detail if hasattr(e, 'detail') else {}
            user_friendly_errors = {}
            
            for field, errors in error_dict.items():
                if isinstance(errors, list) and len(errors) > 0:
                    # Get the first error message
                    error = errors[0]
                    # Check if it's an ErrorDetail object with a string property
                    if hasattr(error, 'string'):
                        user_friendly_errors[field] = str(error.string)
                    else:
                        user_friendly_errors[field] = str(error)
                else:
                    user_friendly_errors[field] = str(errors)
            
            # Return the specific error message if available
            if 'transactionType' in user_friendly_errors:
                return Response(
                    {'success': False, 'message': user_friendly_errors['transactionType']},
                    status=status.HTTP_400_BAD_REQUEST
                )
            else:
                return Response(
                    {'success': False, 'message': 'Validation error', 'errors': user_friendly_errors},
                    status=status.HTTP_400_BAD_REQUEST
                )
        except Exception as e:
            # Handle database-level unique constraint violations
            error_msg = str(e)
            if 'duplicate' in error_msg.lower() or 'unique constraint' in error_msg.lower() or 'already exists' in error_msg.lower():
                return Response(
                    {'success': False, 'message': 'A default account head already exists for this transaction type. Please choose another type.'},
                    status=status.HTTP_400_BAD_REQUEST
                )
            return Response(
                {'success': False, 'message': str(e)},
                status=status.HTTP_400_BAD_REQUEST
            )

    def update(self, request, *args, **kwargs):
        self.required_permission_id = self.get_required_permission_id(request)
        try:
            partial = kwargs.pop('partial', False)
            instance = self.get_object()
            serializer = self.get_serializer(
                instance, data=request.data, partial=partial)
            serializer.is_valid(raise_exception=True)
            serializer.save(updatedBy=request.user.member)
            return Response(
                {'success': True, 'message': 'Default account head updated successfully',
                    'data': serializer.data}
            )
        except serializers.ValidationError as e:
            # Extract user-friendly error messages from serializer validation errors
            error_dict = e.detail if hasattr(e, 'detail') else {}
            user_friendly_errors = {}
            
            for field, errors in error_dict.items():
                if isinstance(errors, list) and len(errors) > 0:
                    # Get the first error message
                    error = errors[0]
                    # Check if it's an ErrorDetail object with a string property
                    if hasattr(error, 'string'):
                        user_friendly_errors[field] = str(error.string)
                    else:
                        user_friendly_errors[field] = str(error)
                else:
                    user_friendly_errors[field] = str(errors)
            
            # Return the specific error message if available
            if 'transactionType' in user_friendly_errors:
                return Response(
                    {'success': False, 'message': user_friendly_errors['transactionType']},
                    status=status.HTTP_400_BAD_REQUEST
                )
            else:
                return Response(
                    {'success': False, 'message': 'Validation error', 'errors': user_friendly_errors},
                    status=status.HTTP_400_BAD_REQUEST
                )
        except Exception as e:
            # Handle database-level unique constraint violations
            error_msg = str(e)
            if 'duplicate' in error_msg.lower() or 'unique constraint' in error_msg.lower() or 'already exists' in error_msg.lower():
                return Response(
                    {'success': False, 'message': 'A default account head already exists for this transaction type. Please choose another type.'},
                    status=status.HTTP_400_BAD_REQUEST
                )
            return Response(
                {'success': False, 'message': str(e)},
                status=status.HTTP_400_BAD_REQUEST
            )

    def destroy(self, request, *args, **kwargs):
        self.required_permission_id = self.get_required_permission_id(request)
        try:
            instance = self.get_object()
            instance.delete()
            return Response(
                {'success': True, 'message': 'Default account head deleted successfully'},
                status=status.HTTP_204_NO_CONTENT
            )
        except Exception as e:
            return Response(
                {'success': False, 'message': str(e)},
                status=status.HTTP_400_BAD_REQUEST
            )

    @action(detail=False, methods=['get'])
    def transaction_types(self, request):
        """Get list of available transaction types (predefined suggestions)"""
        self.required_permission_id = [PERMISSION_VIEW_CHART_OF_ACCOUNTS]
        try:
            types = [
                {'value': choice[0], 'label': choice[1]}
                for choice in DefaultAccountHead.TRANSACTION_TYPES
            ]
            return Response(
                {'success': True, 'data': types,
                    'message': 'These are suggested transaction types. You can create custom types as well.'},
                status=status.HTTP_200_OK
            )
        except Exception as e:
            return Response(
                {'success': False, 'message': str(e)},
                status=status.HTTP_400_BAD_REQUEST
            )

    @action(detail=False, methods=['get'])
    def suggestions(self, request):
        """Get suggestions for transaction types including predefined and existing custom types"""
        self.required_permission_id = [PERMISSION_VIEW_CHART_OF_ACCOUNTS]
        try:
            # Get predefined types
            predefined = [
                {'value': choice[0], 'label': choice[1], 'isPredefined': True}
                for choice in DefaultAccountHead.TRANSACTION_TYPES
            ]

            # Get existing custom types
            existing = DefaultAccountHead.objects.all().values(
                'transactionType', 'customLabel')
            custom = [
                {'value': item['transactionType'],
                    'label': item['customLabel'], 'isPredefined': False}
                for item in existing
            ]

            return Response(
                {'success': True, 'data': {'predefined': predefined, 'custom': custom}},
                status=status.HTTP_200_OK
            )
        except Exception as e:
            return Response(
                {'success': False, 'message': str(e)},
                status=status.HTTP_400_BAD_REQUEST
            )


class ReportSectionViewSet(viewsets.ModelViewSet):
    """ViewSet for managing financial report section configurations"""
    queryset = ReportSection.objects.all()
    serializer_class = ReportSectionSerializer
    permission_classes = [IsAuthenticated, HasRequiredPermission]
    
    def get_required_permission_id(self, request):
        if request.user.is_anonymous:
            return []
        if request.method == 'GET':
            return [PERMISSION_VIEW_CHART_OF_ACCOUNTS]
        return [PERMISSION_EDIT_CHART_OF_ACCOUNTS]

    def list(self, request, *args, **kwargs):
        self.required_permission_id = self.get_required_permission_id(request)
        module = request.query_params.get('module')
        queryset = self.get_queryset()
        if module:
            queryset = queryset.filter(moduleName=module)
        
        serializer = self.get_serializer(queryset, many=True)
        return Response({
            'success': True,
            'data': serializer.data
        })

    def create(self, request, *args, **kwargs):
        self.required_permission_id = self.get_required_permission_id(request)
        try:
            serializer = self.get_serializer(data=request.data)
            serializer.is_valid(raise_exception=True)
            serializer.save(createdBy=request.user.member)
            return Response({
                'success': True,
                'message': 'Report section created successfully',
                'data': serializer.data
            }, status=status.HTTP_201_CREATED)
        except serializers.ValidationError as e:
            # Extract user-friendly error messages
            error_dict = e.detail if hasattr(e, 'detail') else {}
            
            error_str = str(e).lower()
            if 'sectionname' in error_str and ('exists' in error_str or 'unique' in error_str):
                message = "Section Display Name already exists. Please use a different name."
            else:
                # Helper to get the first string message
                def get_first_error(obj):
                    if isinstance(obj, dict):
                        for k, v in obj.items():
                            msg = get_first_error(v)
                            if msg: return msg
                    elif isinstance(obj, list) and obj:
                        return get_first_error(obj[0])
                    return str(obj) if obj else None

                message = get_first_error(error_dict) or "Validation error occurred"
            
            return Response({
                'success': False, 
                'message': message, 
                'errors': error_dict
            }, status=status.HTTP_400_BAD_REQUEST)
        except Exception as e:
            # Handle database-level unique constraint violations
            error_msg = str(e).lower()
            if 'duplicate' in error_msg or 'unique' in error_msg or 'sectionname' in error_msg:
                return Response({
                    'success': False, 
                    'message': 'Section Display Name already exists. Please use a different name.'
                }, status=status.HTTP_400_BAD_REQUEST)
            return Response(
                {'success': False, 'message': str(e)},
                status=status.HTTP_400_BAD_REQUEST
            )

    def update(self, request, *args, **kwargs):
        self.required_permission_id = self.get_required_permission_id(request)
        try:
            partial = kwargs.pop('partial', False)
            instance = self.get_object()
            serializer = self.get_serializer(instance, data=request.data, partial=partial)
            serializer.is_valid(raise_exception=True)
            serializer.save(updatedBy=request.user.member)
            return Response({
                'success': True,
                'message': 'Report section updated successfully',
                'data': serializer.data
            })
        except serializers.ValidationError as e:
            # Extract user-friendly error messages
            error_dict = e.detail if hasattr(e, 'detail') else {}
            
            error_str = str(e).lower()
            if 'sectionname' in error_str and ('exists' in error_str or 'unique' in error_str):
                message = "Section Display Name already exists. Please use a different name."
            else:
                # Helper to get the first string message
                def get_first_error(obj):
                    if isinstance(obj, dict):
                        for k, v in obj.items():
                            msg = get_first_error(v)
                            if msg: return msg
                    elif isinstance(obj, list) and obj:
                        return get_first_error(obj[0])
                    return str(obj) if obj else None

                message = get_first_error(error_dict) or "Validation error occurred"
            
            return Response({
                'success': False, 
                'message': message, 
                'errors': error_dict
            }, status=status.HTTP_400_BAD_REQUEST)
        except Exception as e:
            # Handle database-level unique constraint violations
            error_msg = str(e).lower()
            if 'duplicate' in error_msg or 'unique' in error_msg or 'sectionname' in error_msg:
                return Response({
                    'success': False, 
                    'message': 'Section Display Name already exists. Please use a different name.'
                }, status=status.HTTP_400_BAD_REQUEST)
            return Response(
                {'success': False, 'message': str(e)},
                status=status.HTTP_400_BAD_REQUEST
            )

    def destroy(self, request, *args, **kwargs):
        self.required_permission_id = self.get_required_permission_id(request)
        instance = self.get_object()
        instance.delete()
        return Response({
            'success': True,
            'message': 'Report section deleted successfully'
        }, status=status.HTTP_204_NO_CONTENT)


class LedgerPagination(PageNumberPagination):
    page_size = 20
    page_size_query_param = 'page_size'
    max_page_size = 100


class AccountLedgerView(APIView):
    """API view to get ledger for an individual account"""
    permission_classes = [IsAuthenticated, HasRequiredPermission]
    required_permission_id = [PERMISSION_VIEW_CHART_OF_ACCOUNTS]
    pagination_class = LedgerPagination

    def get(self, request, account_id):
        try:
            # Get account
            account = Account.objects.get(id=account_id, isActive=True)

            # Get date range from query params
            from_date_str = request.query_params.get('from_date')
            to_date_str = request.query_params.get('to_date')
            
            # Use default dates if not provided
            if from_date_str:
                from_date = datetime.strptime(from_date_str, '%Y-%m-%d').date()
            else:
                # Default to first day of current month if no from_date provided
                now = datetime.now()
                from_date = now.replace(day=1).date()
            
            if to_date_str:
                to_date = datetime.strptime(to_date_str, '%Y-%m-%d').date()
            else:
                # Default to today if no to_date provided
                to_date = datetime.now().date()

            # Calculate opening balance: All real transactions before from_date
            opening_details = VoucherEntryDetails.objects.filter(
                account=account,
                voucherEntry__status='posted',
                voucherEntry__entryDate__lt=from_date
            )

            op_sums = opening_details.aggregate(
                total_dr=Sum('debitAmount'),
                total_cr=Sum('creditAmount')
            )
            
            op_debits = op_sums['total_dr'] or Decimal('0')
            op_credits = op_sums['total_cr'] or Decimal('0')

            # Start with zero, rely completely on voucher date
            opening_balance = Decimal('0')
            
            # Add real transactions before from_date based on account type
            if account.accountType in ['asset', 'expense']:
                opening_balance += (op_debits - op_credits)
            else:
                opening_balance += (op_credits - op_debits)

            # Get transitions in date range
            ledger_details = VoucherEntryDetails.objects.filter(
                account=account,
                voucherEntry__status='posted',
                voucherEntry__entryDate__gte=from_date,
                voucherEntry__entryDate__lte=to_date
            ).select_related('voucherEntry', 'voucherEntry__voucherType').order_by(
                'voucherEntry__entryDate', 'voucherEntry__voucherNumber'
            )

            # Calculate running balance and format transactions
            transactions = []
            running_balance = opening_balance
            total_debit = Decimal('0')
            total_credit = Decimal('0')

            for detail in ledger_details:
                debit = detail.debitAmount or Decimal('0')
                credit = detail.creditAmount or Decimal('0')

                # Update running balance
                if account.accountType in ['asset', 'expense']:
                    running_balance += debit - credit
                else:
                    running_balance += credit - debit

                total_debit += debit
                total_credit += credit

                # Get particulars (opposite account)
                opposite_accounts = detail.voucherEntry.details.exclude(
                    account=account)
                particulars_parts = []
                for opp in opposite_accounts:
                    particulars_parts.append(f"{opp.account.accountName}")
                particulars = " & ".join(
                    particulars_parts) if particulars_parts else "—"

                transactions.append({
                    'date': detail.voucherEntry.entryDate,
                    'voucherNo': detail.voucherEntry.voucherNumber,
                    'particulars': particulars,
                    'narration': detail.voucherEntry.narration or '',
                    'debit': float(debit),
                    'credit': float(credit),
                    'balance': float(running_balance),
                })

            # Pagination
            paginator = self.pagination_class()
            page = paginator.paginate_queryset(transactions, request)

            # Get paginated response and add metadata
            response = paginator.get_paginated_response(page)
            response.data['opening_balance'] = float(opening_balance)
            response.data['closing_balance'] = float(running_balance)
            response.data['total_debit'] = float(total_debit)
            response.data['total_credit'] = float(total_credit)

            return response

        except Account.DoesNotExist:
            return Response(
                {'success': False, 'message': 'Account not found'},
                status=status.HTTP_404_NOT_FOUND
            )
        except Exception as e:
            return Response(
                {'success': False, 'message': str(e)},
                status=status.HTTP_400_BAD_REQUEST
            )


class UnitLedgerView(APIView):
    """API view to get a complete financial ledger for a specific unit (Tower/Flat)"""
    permission_classes = [IsAuthenticated, HasRequiredPermission]
    required_permission_id = [PERMISSION_VIEW_CHART_OF_ACCOUNTS]
    pagination_class = LedgerPagination

    def get(self, request, unit_id):
        try:
            from towers.models import Unit
            unit = Unit.objects.select_related('floor__tower').get(id=unit_id)

            # Get date range from query params
            from_date_str = request.query_params.get('from_date')
            to_date_str = request.query_params.get('to_date')
            
            # Use default dates if not provided
            if from_date_str:
                from_date = datetime.strptime(from_date_str, '%Y-%m-%d').date()
            else:
                # For unit ledger, we often want to see full history, but default to current year
                now = datetime.now()
                from_date = now.replace(month=1, day=1).date()
            
            if to_date_str:
                to_date = datetime.strptime(to_date_str, '%Y-%m-%d').date()
            else:
                to_date = datetime.now().date()

            # Calculate opening balance (all tagged Asset - Liability lines before from_date)
            opening_details = VoucherEntryDetails.objects.filter(
                unit=unit,
                voucherEntry__status='posted',
                voucherEntry__entryDate__lt=from_date
            )
            
            # Aggregate sums
            op_sums = opening_details.aggregate(
                total_dr=Sum('debitAmount'),
                total_cr=Sum('creditAmount')
            )
            
            opening_dr = op_sums['total_dr'] or Decimal('0')
            opening_cr = op_sums['total_cr'] or Decimal('0')
            opening_balance = opening_dr - opening_cr

            # Get all posted details for this unit in current range
            ledger_details = VoucherEntryDetails.objects.filter(
                unit=unit,
                voucherEntry__status='posted',
                voucherEntry__entryDate__gte=from_date,
                voucherEntry__entryDate__lte=to_date
            ).select_related(
                'account', 
                'voucherEntry', 
                'voucherEntry__voucherType'
            ).order_by(
                'voucherEntry__entryDate', 
                'voucherEntry__voucherNumber',
                'lineNumber'
            )

            # Format transactions
            transactions = []
            running_balance = opening_balance
            period_debit = Decimal('0')
            period_credit = Decimal('0')

            for detail in ledger_details:
                debit = detail.debitAmount or Decimal('0')
                credit = detail.creditAmount or Decimal('0')
                
                period_debit += debit
                period_credit += credit
                running_balance += (debit - credit)

                transactions.append({
                    'id': detail.id,
                    'date': detail.voucherEntry.entryDate,
                    'voucherNo': detail.voucherEntry.voucherNumber,
                    'voucherType': detail.voucherEntry.voucherType.displayName,
                    'accountCode': detail.account.accountCode,
                    'accountName': detail.account.accountName,
                    'particulars': detail.description or detail.voucherEntry.narration or '—',
                    'debit': float(debit),
                    'credit': float(credit),
                    'balance': float(running_balance)
                })

            # Pagination
            paginator = self.pagination_class()
            page = paginator.paginate_queryset(transactions, request)
            response = paginator.get_paginated_response(page)
            
            # Add metadata
            response.data.update({
                'unit_name': unit.unit_name,
                'tower_name': unit.floor.tower.tower_name,
                'opening_balance': float(opening_balance),
                'period_debit': float(period_debit),
                'period_credit': float(period_credit),
                'closing_balance': float(running_balance),
            })

            return response

        except Unit.DoesNotExist:
            return Response(
                {'success': False, 'message': 'Unit not found'},
                status=status.HTTP_404_NOT_FOUND
            )
        except Exception as e:
            import traceback
            traceback.print_exc()
            return Response(
                {'success': False, 'message': str(e)},
                status=status.HTTP_400_BAD_REQUEST
            )


class ConsolidatedLedgerView(APIView):
    """API view to get consolidated ledger for a parent account with all sub-accounts"""
    permission_classes = [IsAuthenticated, HasRequiredPermission]
    required_permission_id = [PERMISSION_VIEW_CHART_OF_ACCOUNTS]
    pagination_class = LedgerPagination

    def get_all_sub_accounts(self, parent_account):
        """Recursively get all sub-accounts"""
        sub_accounts = [parent_account]
        children = Account.objects.filter(
            parentAccount=parent_account, isActive=True)
        for child in children:
            sub_accounts.extend(self.get_all_sub_accounts(child))
        return sub_accounts

    def get(self, request, parent_account_id):
        try:
            # Get parent account
            parent_account = Account.objects.get(
                id=parent_account_id, isActive=True)
            if not parent_account.isGroup:
                return Response(
                    {'success': False, 'message': 'Selected account is not a group account.'},
                    status=status.HTTP_400_BAD_REQUEST
                )

            # Get all sub-accounts recursively
            all_accounts = self.get_all_sub_accounts(parent_account)
            account_ids = [acc.id for acc in all_accounts]

            # Get date range from query params
            from_date_str = request.query_params.get('from_date')
            to_date_str = request.query_params.get('to_date')
            
            # Use default dates if not provided
            if from_date_str:
                from_date = datetime.strptime(from_date_str, '%Y-%m-%d').date()
            else:
                # Default to first day of current month if no from_date provided
                now = datetime.now()
                from_date = now.replace(day=1).date()
            
            if to_date_str:
                to_date = datetime.strptime(to_date_str, '%Y-%m-%d').date()
            else:
                # Default to today if no to_date provided
                to_date = datetime.now().date()

            # Calculate opening balance for all accounts: Seed + real transactions before from_date
            opening_balance = Decimal('0')
            for account in all_accounts:
                opening_details = VoucherEntryDetails.objects.filter(
                    account=account,
                    voucherEntry__status='posted',
                    voucherEntry__entryDate__lt=from_date
                )

                op_sums = opening_details.aggregate(
                    total_dr=Sum('debitAmount'),
                    total_cr=Sum('creditAmount')
                )
                
                op_debits = op_sums['total_dr'] or Decimal('0')
                op_credits = op_sums['total_cr'] or Decimal('0')

                if account.accountType in ['asset', 'expense']:
                    opening_balance += (op_debits - op_credits)
                else:
                    opening_balance += (op_credits - op_debits)

            # Get transactions for all accounts in date range
            ledger_details = VoucherEntryDetails.objects.filter(
                account_id__in=account_ids,
                voucherEntry__status='posted',
                voucherEntry__entryDate__gte=from_date,
                voucherEntry__entryDate__lte=to_date
            ).select_related('account', 'voucherEntry', 'voucherEntry__voucherType').order_by(
                'voucherEntry__entryDate', 'voucherEntry__voucherNumber'
            )

            # Calculate running balance and format transactions
            transactions = []
            running_balance = opening_balance
            total_debit = Decimal('0')
            total_credit = Decimal('0')

            for detail in ledger_details:
                debit = detail.debitAmount or Decimal('0')
                credit = detail.creditAmount or Decimal('0')

                # Update running balance based on the specific account's type
                if detail.account.accountType in ['asset', 'expense']:
                    running_balance += debit - credit
                else:
                    running_balance += credit - debit

                total_debit += debit
                total_credit += credit

                # Get particulars (opposite accounts)
                opposite_accounts = detail.voucherEntry.details.exclude(
                    account=detail.account)
                particulars_parts = []
                for opp in opposite_accounts:
                    particulars_parts.append(f"{opp.account.accountName}")
                particulars = " & ".join(
                    particulars_parts) if particulars_parts else "—"

                transactions.append({
                    'date': detail.voucherEntry.entryDate,
                    'voucherNo': detail.voucherEntry.voucherNumber,
                    'particulars': particulars,
                    'narration': detail.voucherEntry.narration or '',
                    'accountName': detail.account.accountName,
                    'accountCode': detail.account.accountCode,
                    'debit': float(debit),
                    'credit': float(credit),
                    'balance': float(running_balance),
                })

            # Pagination
            paginator = self.pagination_class()
            page = paginator.paginate_queryset(transactions, request)
                        
            # Get paginated response and add metadata
            response = paginator.get_paginated_response(page)
            response.data['opening_balance'] = float(opening_balance)
            response.data['closing_balance'] = float(running_balance)
            response.data['total_debit'] = float(total_debit)
            response.data['total_credit'] = float(total_credit)
            response.data['accounts_included'] = len(all_accounts)
                        
            return response

        except Account.DoesNotExist:
            return Response(
                {'success': False, 'message': 'Parent account not found'},
                status=status.HTTP_404_NOT_FOUND
            )
        except Exception as e:
            return Response(
                {'success': False, 'message': str(e)},
                status=status.HTTP_400_BAD_REQUEST
            )



class TrialBalanceView(APIView):
    """API view to get trial balance using advanced queries with no loops"""
    permission_classes = [IsAuthenticated, HasRequiredPermission]
    required_permission_id = [PERMISSION_VIEW_CHART_OF_ACCOUNTS]

    def get(self, request):
        try:
            from_date_str = request.query_params.get('from_date')
            to_date_str = request.query_params.get('to_date')
            
            if from_date_str:
                from_date = datetime.strptime(from_date_str, '%Y-%m-%d').date()
            else:
                now = datetime.now()
                from_date = now.replace(day=1).date()
            
            if to_date_str:
                to_date = datetime.strptime(to_date_str, '%Y-%m-%d').date()
            else:
                to_date = datetime.now().date()

            from .models import ReportSection, Account
            has_sections = ReportSection.objects.filter(moduleName='trial_balance', isActive=True).exists()
            from django.db import connection
            from django.db.models import Sum, Q, F, DecimalField, OuterRef, Subquery
            from django.db.models.functions import Coalesce

            # 1. OPTIMIZATION: Find the most recent "Checkpoint" (Closing or Opening) before the selected from_date.
            from .models import VoucherEntry, VoucherType
            last_checkpoint = VoucherEntry.objects.filter(
                voucherType__name__in=['OpeningBalance', 'ClosingBalance'],
                entryDate__lt=from_date,
                status='posted'
            ).order_by('-entryDate').values('entryDate').first()

            # The start date for our opening balance calculation (either last checkpoint or "beginning of time")
            start_date_for_op = last_checkpoint['entryDate'] if last_checkpoint else None

            # 2. Advanced SQL Query: Use the closing date anchor to limit data read
            # op_dr/op_cr will now be: (Balance ON closing_date) + (Movements BETWEEN closing_date AND from_date)
            # If no closing_date, it behaves like a standard all-time query.
            
            unit_id = request.query_params.get('unit_id')
            voucher_type = request.query_params.get('voucher_type')
            
            # Sub-optimization: If we have a start_date_for_op, we don't need to read anything before it.
            date_filter_condition = "AND d.entryDate >= %s" if start_date_for_op else ""
            
            sql = f"""
                SELECT 
                    acc.id, acc.accountCode, acc.accountName, acc.accountType,
                    rs.sectionName as section_name, rs.`order` as section_order,
                    -- Opening Balance: (Closing Balance Value) + (Intermediate Movements)
                    CAST(COALESCE(SUM(CASE WHEN v.id IS NOT NULL AND d.entryDate < %s THEN d.debitAmount ELSE 0 END), 0) AS DECIMAL(15,2)) as op_dr,
                    CAST(COALESCE(SUM(CASE WHEN v.id IS NOT NULL AND d.entryDate < %s THEN d.creditAmount ELSE 0 END), 0) AS DECIMAL(15,2)) as op_cr,
                    -- Period Movements: Grouped by the requested date range
                    CAST(COALESCE(SUM(CASE WHEN v.id IS NOT NULL AND d.entryDate >= %s AND d.entryDate <= %s THEN d.debitAmount ELSE 0 END), 0) AS DECIMAL(15,2)) as mov_dr,
                    CAST(COALESCE(SUM(CASE WHEN v.id IS NOT NULL AND d.entryDate >= %s AND d.entryDate <= %s THEN d.creditAmount ELSE 0 END), 0) AS DECIMAL(15,2)) as mov_cr
                FROM accounts_account acc
                INNER JOIN accounts_reportsection_accounts rsa ON acc.id = rsa.account_id
                INNER JOIN accounts_reportsection rs ON rsa.reportsection_id = rs.id
                LEFT JOIN accounts_voucherentrydetails d ON acc.id = d.account_id {date_filter_condition}
                LEFT JOIN accounts_voucherentry v ON d.voucherEntry_id = v.id AND v.status = 'posted'
                LEFT JOIN accounts_vouchertype vt ON v.voucherType_id = vt.id
                WHERE acc.isActive = 1 AND rs.moduleName = 'trial_balance' AND rs.isActive = 1
            """
            
            params = [from_date, from_date, from_date, to_date, from_date, to_date]
            if start_date_for_op:
                params.append(start_date_for_op) # For the LEFT JOIN condition
            
            if unit_id:
                sql += " AND d.unit_id = %s"
                params.append(unit_id)
            
            if voucher_type:
                sql += " AND vt.name = %s"
                params.append(voucher_type)
 
            sql += " GROUP BY acc.id, acc.accountCode, acc.accountName, acc.accountType, rs.sectionName, rs.`order`"
            sql += " ORDER BY rs.`order` ASC, acc.accountCode ASC"
            
            with connection.cursor() as cursor:
                cursor.execute(sql, params)
                columns = [col[0] for col in cursor.description]
                raw_accounts = [dict(zip(columns, row)) for row in cursor.fetchall()]

            return Response({
                'success': True,
                'data': raw_accounts,
                'summary': {
                    'period': f'{from_date.strftime("%d/%m/%Y")} to {to_date.strftime("%d/%m/%Y")}',
                    'last_closing_date': start_date_for_op.strftime("%d/%m/%Y") if start_date_for_op else 'Initial'
                },
                'isConfigured': has_sections
            })

        except Exception as e:
            import traceback
            traceback.print_exc()
            return Response(
                {'success': False, 'message': str(e)},
                status=status.HTTP_400_BAD_REQUEST
            )


class ProfitLossView(APIView):
    """API view to get Profit & Loss / Income Statement"""
    permission_classes = [IsAuthenticated, HasRequiredPermission]
    required_permission_id = [PERMISSION_VIEW_CHART_OF_ACCOUNTS]

    def get_account_data(self, account, from_date, to_date):
        """Helper to get account balance and movements for a period"""
        # Get movement within the period
        movement = account.get_movement(from_date, to_date)
        
        # For Income/Expense accounts, we focus on the movement (Revenue/Expense for the period)
        # Net balance is movement for P&L
        net_balance = movement['debit'] - movement['credit']
        
        return {
            'accountId': account.id,
            'accountCode': account.accountCode,
            'accountName': account.accountName,
            'accountType': account.accountType,
            'accountTypeDisplay': account.get_accountType_display(),
            'movementDebit': float(movement['debit']),
            'movementCredit': float(movement['credit']),
            'netBalance': float(net_balance)
        }

    def get(self, request):
        try:
            from_date_str = request.query_params.get('from_date')
            to_date_str = request.query_params.get('to_date')
            
            if from_date_str:
                from_date = datetime.strptime(from_date_str, '%Y-%m-%d').date()
            else:
                now = datetime.now()
                from_date = now.replace(day=1).date()
            
            if to_date_str:
                to_date = datetime.strptime(to_date_str, '%Y-%m-%d').date()
            else:
                to_date = datetime.now().date()

            # Check if sections are configured for Income Statement
            from .models import ReportSection
            sections = ReportSection.objects.filter(moduleName='income_statement', isActive=True).order_by('order')
            
            grouped_data = []
            total_summary = {
                'totalIncome': Decimal('0'),
                'totalExpense': Decimal('0'),
                'netProfit': Decimal('0'),
            }

            if sections.exists():
                for section in sections:
                    section_accounts = section.accounts.filter(isActive=True).order_by('accountCode')
                    section_items = []
                    section_total = Decimal('0')

                    for account in section_accounts:
                        data = self.get_account_data(account, from_date, to_date)
                        section_items.append(data)
                        
                        # In P&L, income is usually credit, expense is debit
                        # We normalize based on account type
                        is_income = account.accountType in ['revenue', 'other_income']
                        balance = Decimal(str(data['netBalance']))
                        
                        # Invert for income so positive is good
                        if is_income:
                            section_total += abs(balance) if balance < 0 else -balance
                        else:
                            section_total += balance

                    if section_items:
                        # Determine if this section is Income or Expense for summary
                        # We can use the first account as a hint or a better heuristic
                        first_acc = section_accounts.first()
                        is_income_section = first_acc.accountType in ['revenue', 'other_income'] if first_acc else False
                        
                        abs_total = abs(section_total)
                        if is_income_section:
                            total_summary['totalIncome'] += abs_total
                        else:
                            total_summary['totalExpense'] += abs_total

                        grouped_data.append({
                            'sectionName': section.sectionName,
                            'order': section.order,
                            'accounts': section_items,
                            'total': float(abs_total),
                            'isIncome': is_income_section
                        })
            
            total_summary['netProfit'] = total_summary['totalIncome'] - total_summary['totalExpense']

            # Format final response
            return Response({
                'success': True,
                'data': grouped_data,
                'summary': {
                    'totalIncome': float(total_summary['totalIncome']),
                    'totalExpense': float(total_summary['totalExpense']),
                    'netProfit': float(total_summary['netProfit']),
                    'period': f'{from_date.strftime("%d/%m/%Y")} to {to_date.strftime("%d/%m/%Y")}'
                },
                'isConfigured': sections.exists()
            })

        except Exception as e:
            return Response(
                {'success': False, 'message': str(e)},
                status=status.HTTP_400_BAD_REQUEST
            )

class BalanceSheetView(APIView):
    """API view to get Balance Sheet"""
    permission_classes = [IsAuthenticated, HasRequiredPermission]
    required_permission_id = [PERMISSION_VIEW_CHART_OF_ACCOUNTS]

    def get_account_data(self, account, to_date):
        """Helper to get account balance as of a specific date"""
        # Balance Sheet shows positions as of a date
        # We start from beginning of time up to to_date
        details = account.voucher_details.filter(
            voucherEntry__status='posted',
            entryDate__lte=to_date
        )
        
        total_dr = details.aggregate(Sum('debitAmount'))['debitAmount__sum'] or Decimal('0')
        total_cr = details.aggregate(Sum('creditAmount'))['creditAmount__sum'] or Decimal('0')
        
        # Calculate balance based on account type
        if account.accountType in ['asset', 'expense']:
            balance = total_dr - total_cr
        else:
            balance = total_cr - total_dr
            
        return {
            'accountId': account.id,
            'accountCode': account.accountCode,
            'accountName': account.accountName,
            'accountType': account.accountType,
            'accountTypeDisplay': account.get_accountType_display(),
            'balance': float(balance)
        }

    def get(self, request):
        try:
            to_date_str = request.query_params.get('to_date')
            if to_date_str:
                to_date = datetime.strptime(to_date_str, '%Y-%m-%d').date()
            else:
                to_date = datetime.now().date()

            sections = ReportSection.objects.filter(moduleName='balance_sheet', isActive=True).order_by('order')
            
            grouped_data = []
            total_assets = Decimal('0')
            total_liabilities = Decimal('0')
            total_equity = Decimal('0')

            # Calculate Net Profit/Loss to date for Retained Earnings if not already accounted for
            # This is a simplification. Usually Retained Earnings is an account.
            # But we might need to show current year profit separately.

            if sections.exists():
                for section in sections:
                    section_accounts = section.accounts.filter(isActive=True).order_by('accountCode')
                    section_items = []
                    section_total = Decimal('0')

                    for account in section_accounts:
                        data = self.get_account_data(account, to_date)
                        section_items.append(data)
                        section_total += Decimal(str(data['balance']))

                    if section_items:
                        # Determine if this belongs to Assets or Liab/Equity
                        first_acc = section_accounts.first()
                        acc_type = first_acc.accountType if first_acc else 'asset'
                        
                        if acc_type == 'asset':
                            total_assets += section_total
                        elif acc_type == 'liability':
                            total_liabilities += section_total
                        else:
                            total_equity += section_total

                        grouped_data.append({
                            'sectionName': section.sectionName,
                            'order': section.order,
                            'accounts': section_items,
                            'total': float(section_total),
                            'type': acc_type
                        })
            
            return Response({
                'success': True,
                'data': grouped_data,
                'summary': {
                    'totalAssets': float(total_assets),
                    'totalLiabilities': float(total_liabilities),
                    'totalEquity': float(total_equity),
                    'totalLiabilitiesAndEquity': float(total_liabilities + total_equity),
                    'period': f'As of {to_date.strftime("%d/%m/%Y")}'
                },
                'isConfigured': sections.exists()
            })

        except Exception as e:
            return Response(
                {'success': False, 'message': str(e)},
                status=status.HTTP_400_BAD_REQUEST
            )

class ReceivedAndPaymentView(APIView):
    """API view to get Received & Payment Account Statement"""
    permission_classes = [IsAuthenticated, HasRequiredPermission]
    required_permission_id = [PERMISSION_VIEW_CHART_OF_ACCOUNTS]

    def get_movement_data(self, account, from_date, to_date):
        """Helper to get debit/credit movement within a period"""
        movement = account.get_movement(from_date, to_date)
        return {
            'accountId': account.id,
            'accountCode': account.accountCode,
            'accountName': account.accountName,
            'accountType': account.accountType,
            'accountTypeDisplay': account.get_accountType_display(),
            'debit': float(movement['debit']),
            'credit': float(movement['credit']),
            'net': float(movement['debit'] - movement['credit'])
        }

    def get_closing_balance(self, account, to_date):
        """Get balance of an account as of a specific date"""
        details = account.voucher_details.filter(
            voucherEntry__status='posted',
            entryDate__lte=to_date
        )
        total_dr = details.aggregate(Sum('debitAmount'))['debitAmount__sum'] or Decimal('0')
        total_cr = details.aggregate(Sum('creditAmount'))['creditAmount__sum'] or Decimal('0')
        return total_dr - total_cr # Cash/Bank are assets, so Debit - Credit

    def get(self, request):
        try:
            from_date_str = request.query_params.get('from_date')
            to_date_str = request.query_params.get('to_date')
            
            if from_date_str:
                from_date = datetime.strptime(from_date_str, '%Y-%m-%d').date()
            else:
                now = datetime.now()
                from_date = now.replace(day=1).date()
            
            if to_date_str:
                to_date = datetime.strptime(to_date_str, '%Y-%m-%d').date()
            else:
                to_date = datetime.now().date()

            # For Received & Payment, we need configured sections
            sections = ReportSection.objects.filter(moduleName='received_payment', isActive=True).order_by('order')
            
            # Receipts (Left side)
            receipt_sections = []
            # Payments (Right side)
            payment_sections = []
            
            total_receipts = Decimal('0')
            total_payments = Decimal('0')
            
            # 1. Handle Opening Balances (Receipt Side)
            # Usually users configure which accounts are "Cash/Bank" in a special way
            # For simplicity, we can look for accounts in an "Opening Balance" section or similar
            # Or we can just include all Asset accounts that are tagged as Cash/Bank
            
            if sections.exists():
                for section in sections:
                    section_accounts = section.accounts.filter(isActive=True).order_by('accountCode')
                    section_items = []
                    section_total = Decimal('0')

                    # Special handling for "OPENING BALANCE" and "CLOSING BALANCE" sections if configured
                    is_opening = 'OPENING' in section.sectionName.upper()
                    is_closing = 'CLOSING' in section.sectionName.upper()

                    for account in section_accounts:
                        if is_opening:
                            # Use balance BEFORE from_date
                            prev_date = from_date.replace(day=from_date.day) # Simplified
                            from datetime import timedelta
                            bal = self.get_closing_balance(account, from_date - timedelta(days=1))
                            data = {
                                'accountCode': account.accountCode,
                                'accountName': account.accountName,
                                'accountTypeDisplay': account.get_accountType_display(),
                                'amount': float(bal)
                            }
                        elif is_closing:
                            # Use balance ON to_date
                            bal = self.get_closing_balance(account, to_date)
                            data = {
                                'accountCode': account.accountCode,
                                'accountName': account.accountName,
                                'accountTypeDisplay': account.get_accountType_display(),
                                'amount': float(bal)
                            }
                        else:
                            # Normal movement
                            movement = account.get_movement(from_date, to_date)
                            # Receipts are usually inflows (Revenue movement)
                            # Payments are usually outflows (Expense movement)
                            # We normalize based on account type
                            if account.accountType in ['revenue', 'other_income']:
                                bal = abs(movement['credit'] - movement['debit'])
                            else:
                                bal = abs(movement['debit'] - movement['credit'])
                            
                            data = {
                                'accountCode': account.accountCode,
                                'accountName': account.accountName,
                                'accountTypeDisplay': account.get_accountType_display(),
                                'amount': float(bal)
                            }
                        
                        section_items.append(data)
                        section_total += Decimal(str(data['amount']))

                    if section_items:
                        # Decide if Receipt or Payment
                        # Sections starting with index or specific names can be Receipts
                        # User order should guide this.
                        # For now, let's assume even orders are Receipts, odd are Payments? No.
                        # Let's use a split approach or just return sections and let frontend decide.
                        # Better: Add 'isReceipt' flag to section or use account type hint.
                        
                        is_receipt_section = True
                        if is_closing:
                            is_receipt_section = False
                        elif not is_opening:
                            first_acc = section_accounts.first()
                            if first_acc and first_acc.accountType == 'expense':
                                is_receipt_section = False
                        
                        section_data = {
                            'sectionName': section.sectionName,
                            'items': section_items,
                            'total': float(section_total)
                        }
                        
                        if is_receipt_section:
                            receipt_sections.append(section_data)
                            total_receipts += section_total
                        else:
                            payment_sections.append(section_data)
                            total_payments += section_total

            return Response({
                'success': True,
                'data': {
                    'receipts': receipt_sections,
                    'payments': payment_sections,
                },
                'summary': {
                    'totalReceipts': float(total_receipts),
                    'totalPayments': float(total_payments),
                    'period': f'{from_date.strftime("%d/%m/%Y")} to {to_date.strftime("%d/%m/%Y")}'
                },
                'isConfigured': sections.exists()
            })

        except Exception as e:
            return Response(
                {'success': False, 'message': str(e)},
                status=status.HTTP_400_BAD_REQUEST
            )

