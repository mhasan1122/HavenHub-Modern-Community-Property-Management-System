from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from django.db.models import Q, Sum
from .models import BillCategory
from .serializers import BillCategorySerializer, BillCategoryListSerializer
from user.models import Member
from user.permissions import HasRequiredPermission
from group_role.permission_constants import (
    PERMISSION_VIEW_BILL_CATEGORIES,
    PERMISSION_ADD_BILL_CATEGORIES,
    PERMISSION_EDIT_BILL_CATEGORIES,
)
from audit_trail.create_audit_trail import create_audit_trail


class BillCategoryViewSet(viewsets.ModelViewSet):
    """
    ViewSet for managing Bill Categories
    
    Provides CRUD operations:
    - list: GET /api/bill-categories/
    - create: POST /api/bill-categories/
    - retrieve: GET /api/bill-categories/{id}/
    - update: PUT /api/bill-categories/{id}/
    - partial_update: PATCH /api/bill-categories/{id}/
    - destroy: DELETE /api/bill-categories/{id}/
    
    Custom actions:
    - toggle_status: PATCH /api/bill-categories/{id}/toggle-status/
    - active: GET /api/bill-categories/active/
    """
    
    queryset = BillCategory.objects.all()
    serializer_class = BillCategorySerializer
    permission_classes = [IsAuthenticated, HasRequiredPermission]
    
    def get_permissions(self):
        """
        Set required permissions based on action
        """
        if self.action in ['list', 'retrieve', 'active', 'choices']:
            self.required_permission_id = [
                PERMISSION_VIEW_BILL_CATEGORIES,
                PERMISSION_ADD_BILL_CATEGORIES,
                PERMISSION_EDIT_BILL_CATEGORIES,
            ]
        elif self.action == 'create':
            self.required_permission_id = [PERMISSION_ADD_BILL_CATEGORIES]
        elif self.action in ['update', 'partial_update', 'destroy', 'toggle_status']:
            self.required_permission_id = [PERMISSION_EDIT_BILL_CATEGORIES]
        else:
            self.required_permission_id = []
        return super().get_permissions()
    
    def get_queryset(self):
        """
        Optionally filter by active status, service fee ID, or search
        """
        queryset = BillCategory.objects.all()
        
        # Filter by service_fee_id if provided
        # Returns categories that are used in BillUploadDetail for that service fee
        service_fee_id = self.request.query_params.get('service_fee_id', None)
        if service_fee_id:
            try:
                service_fee_id = int(service_fee_id)
                from service_fee_management.models import BillUploadDetail

                # Optional month/year filters — when provided, limit categories to that period
                month = self.request.query_params.get('month', None)
                year = self.request.query_params.get('year', None)

                from django.db.models import Q
                detail_q = Q(service_fee_id=service_fee_id)

                if month:
                    try:
                        month_int = int(month)
                        detail_q &= Q(upload_month=month_int)
                    except (ValueError, TypeError):
                        pass

                if year:
                    try:
                        year_int = int(year)
                        detail_q &= Q(upload_year=year_int)
                    except (ValueError, TypeError):
                        pass

                # Add tower filter if provided
                tower_id = self.request.query_params.get('tower_id', None)
                if tower_id:
                    try:
                        tower_id_int = int(tower_id)
                        detail_q &= Q(tower_id=tower_id_int)
                    except (ValueError, TypeError):
                        pass

                # Get bill categories used in bill uploads for this service fee and optional period
                queryset = queryset.filter(
                    id__in=BillUploadDetail.objects.filter(
                        detail_q
                    ).values_list('bill_upload__bill_category_id', flat=True).distinct()
                )
            except (ValueError, TypeError):
                pass  # Invalid service_fee_id, ignore
        
        # Filter by active status if provided
        is_active = self.request.query_params.get('is_active', None)
        if is_active is not None:
            if is_active.lower() in ['true', '1', 'yes']:
                queryset = queryset.filter(is_active=True)
            elif is_active.lower() in ['false', '0', 'no']:
                queryset = queryset.filter(is_active=False)
        
        # Search by name or description
        search = self.request.query_params.get('search', None)
        if search:
            queryset = queryset.filter(
                Q(name__icontains=search) | 
                Q(description__icontains=search)
            )
        
        return queryset.order_by('-created_at')
    
    def get_serializer_class(self):
        """
        Use lightweight serializer for list action
        """
        if self.action == 'list':
            return BillCategoryListSerializer
        return BillCategorySerializer
    
    def create(self, request, *args, **kwargs):
        """
        Create a new bill category
        """
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        self.perform_create(serializer)
        
        # Get member for audit trail
        try:
            member = Member.objects.get(user=request.user)
        except Member.DoesNotExist:
            member = None
        
        # Create audit trail
        try:
            create_audit_trail(
                member=member,
                event_type='BILL_CATEGORY_CREATED',
                table_name='BillCategory',
                row_id=serializer.instance.id,
                old_data=None,
                new_data=serializer.data,
                description=f'Bill category "{serializer.instance.name}" created successfully.'
            )
        except Exception as e:
            print(f"Error creating audit trail: {str(e)}")
        
        headers = self.get_success_headers(serializer.data)
        return Response(
            serializer.data,
            status=status.HTTP_201_CREATED,
            headers=headers
        )
    
    def update(self, request, *args, **kwargs):
        """
        Update a bill category
        """
        partial = kwargs.pop('partial', False)
        instance = self.get_object()
        
        # Store old data for audit trail
        old_data = self.get_serializer(instance).data
        
        serializer = self.get_serializer(instance, data=request.data, partial=partial)
        serializer.is_valid(raise_exception=True)
        self.perform_update(serializer)
        
        # Get member for audit trail
        try:
            member = Member.objects.get(user=request.user)
        except Member.DoesNotExist:
            member = None
        
        # Create audit trail
        try:
            create_audit_trail(
                member=member,
                event_type='BILL_CATEGORY_UPDATED',
                table_name='BillCategory',
                row_id=instance.id,
                old_data=old_data,
                new_data=serializer.data,
                description=f'Bill category "{instance.name}" updated successfully.'
            )
        except Exception as e:
            print(f"Error creating audit trail: {str(e)}")
        
        return Response(serializer.data)
    
    def destroy(self, request, *args, **kwargs):
        """
        Delete a bill category
        """
        instance = self.get_object()
        category_name = instance.name
        category_id = instance.id
        
        # Store data for audit trail before deletion
        old_data = self.get_serializer(instance).data
        
        # Check if category is being used before deletion
        if (instance.bill_uploads.exists() or 
            instance.service_fee_bill_categories.exists() or 
            instance.fee_items.exists()):
            return Response(
                {'success': False, 'message': 'Cannot delete category that is in use in bill uploads, service fee bills, or items.'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        self.perform_destroy(instance)
        
        # Get member for audit trail
        try:
            member = Member.objects.get(user=request.user)
        except Member.DoesNotExist:
            member = None
        
        # Create audit trail
        try:
            create_audit_trail(
                member=member,
                event_type='BILL_CATEGORY_DELETED',
                table_name='BillCategory',
                row_id=category_id,
                old_data=old_data,
                new_data=None,
                description=f'Bill category "{category_name}" deleted successfully.'
            )
        except Exception as e:
            print(f"Error creating audit trail: {str(e)}")
        
        return Response(status=status.HTTP_204_NO_CONTENT)
    
    @action(detail=True, methods=['patch'], url_path='toggle-status')
    def toggle_status(self, request, pk=None):
        """
        Toggle the active status of a bill category
        PATCH /api/bill-categories/{id}/toggle-status/
        """
        instance = self.get_object()
        
        # Store old status for audit trail
        old_status = instance.is_active
        old_data = self.get_serializer(instance).data
        
        instance.is_active = not instance.is_active
        instance.save()
        
        serializer = self.get_serializer(instance)
        
        # Get member for audit trail
        try:
            member = Member.objects.get(user=request.user)
        except Member.DoesNotExist:
            member = None
        
        # Create audit trail
        try:
            status_text = "activated" if instance.is_active else "deactivated"
            create_audit_trail(
                member=member,
                event_type='BILL_CATEGORY_STATUS_CHANGED',
                table_name='BillCategory',
                row_id=instance.id,
                old_data=old_data,
                new_data=serializer.data,
                description=f'Bill category "{instance.name}" {status_text}.'
            )
        except Exception as e:
            print(f"Error creating audit trail: {str(e)}")
        
        return Response(serializer.data)
    
    @action(detail=False, methods=['get'])
    def active(self, request):
        """
        Get only active bill categories
        GET /api/bill-categories/active/
        """
        active_categories = self.get_queryset().filter(is_active=True)
        serializer = self.get_serializer(active_categories, many=True)
        return Response(serializer.data)
    
    @action(detail=False, methods=['get'])
    def choices(self, request):
        """
        Get available icon and color choices
        GET /api/bill-categories/choices/
        """
        return Response({
            'icons': [
                {'value': choice[0], 'label': choice[1]}
                for choice in BillCategory.ICON_CHOICES
            ],
            'colors': [
                {'value': choice[0], 'label': choice[1]}
                for choice in BillCategory.COLOR_CHOICES
            ]
        })

    def list(self, request, *args, **kwargs):
        """
        Override list to add amounts when service_fee_id is provided
        Supports optional month and year parameters to filter amounts by period
        Query params:
        - service_fee_id: Required to calculate amounts
        - month: Optional (1-12) to filter by specific month
        - year: Optional (YYYY) to filter by specific year
        - tower_id: Optional to filter by tower
        - unit_ids: Optional comma-separated list of unit IDs
        """
        queryset = self.filter_queryset(self.get_queryset())
        serializer = self.get_serializer(queryset, many=True)
        
        # If service_fee_id is provided, add amounts to each category
        service_fee_id = request.query_params.get('service_fee_id', None)
        if service_fee_id:
            try:
                from service_fee_management.models import BillUploadDetail
                from django.db.models import Sum
                
                service_fee_id_int = int(service_fee_id)
                month = request.query_params.get('month', None)
                year = request.query_params.get('year', None)
                tower_id = request.query_params.get('tower_id', None)
                unit_ids = request.query_params.get('unit_ids', None)
                
                # Build Q-based filter for BillUploadDetail to support flexible month/year
                from django.db.models import Q

                q_filters = Q(service_fee_id=service_fee_id_int)

                # Add month filter if provided
                if month:
                    try:
                        month_int = int(month)
                        q_filters &= Q(upload_month=month_int)
                    except (ValueError, TypeError):
                        pass  # Invalid month, ignore

                # Add year filter if provided
                if year:
                    try:
                        year_int = int(year)
                        q_filters &= Q(upload_year=year_int)
                    except (ValueError, TypeError):
                        pass  # Invalid year, ignore

                # Annotate categories with filtered sum of related BillUploadDetail.amount
                # This preserves categories with no matching uploads (LEFT JOIN behavior)
                detail_filter = Q(bill_uploads__details__service_fee_id=service_fee_id_int)

                if month:
                    try:
                        month_int = int(month)
                        detail_filter &= Q(bill_uploads__details__upload_month=month_int)
                    except (ValueError, TypeError):
                        pass

                if year:
                    try:
                        year_int = int(year)
                        detail_filter &= Q(bill_uploads__details__upload_year=year_int)
                    except (ValueError, TypeError):
                        pass
                
                # Filter by tower if provided
                if tower_id:
                    try:
                        tower_id_int = int(tower_id)
                        detail_filter &= Q(bill_uploads__details__tower_id=tower_id_int)
                    except (ValueError, TypeError):
                        pass
                
                # Filter by unit_ids if provided (comma separated)
                if unit_ids:
                    try:
                        unit_id_list = [int(uid) for uid in unit_ids.split(',')]
                        detail_filter &= Q(bill_uploads__details__unit_id__in=unit_id_list)
                    except (ValueError, TypeError):
                        pass

                # Annotate the queryset of categories so every category remains present
                annotated = queryset.annotate(
                    total_amount=Sum('bill_uploads__details__amount', filter=detail_filter)
                ).values('id', 'total_amount')

                amounts_map = {item['id']: float(item['total_amount'] or 0) for item in annotated}

                # Add amounts to serialized data (default 0 for missing)
                for item in serializer.data:
                    item['amount'] = amounts_map.get(item['id'], 0.0)
            except (ValueError, TypeError):
                pass  # Invalid service_fee_id, skip amount calculation
        
        return Response(serializer.data)
    