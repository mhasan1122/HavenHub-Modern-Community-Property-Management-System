from rest_framework import status, serializers
import re
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated, AllowAny
from rest_framework.views import APIView
from rest_framework.parsers import JSONParser
from rest_framework.decorators import api_view, permission_classes
from django.db.models import Q
from django.shortcuts import get_object_or_404
from django.core.exceptions import ValidationError
from django.forms.models import model_to_dict
from .models import ServiceFee, ServiceFeeMFS, ServiceFeeBank, ServiceFeeHistory
from .serializers import (
    ServiceFeeSerializer,
    ServiceFeeListSerializer,
    ServiceFeeMFSSerializer,
    ServiceFeeBankSerializer,
    ServiceFeeHistorySerializer
)
from towers.models import Tower, Unit
from user.models import Member
from audit_trail.create_audit_trail import create_audit_trail
from user.permissions import HasRequiredPermission
from group_role.permission_constants import (
    PERMISSION_VIEW_SERVICE_FEE_SETTINGS,
    PERMISSION_ADD_SERVICE_FEE_SETTINGS,
    PERMISSION_EDIT_SERVICE_FEE_SETTINGS,
)




class ServiceFeeListCreateView(APIView):
    """
    API view for listing and creating service fees
    """
    permission_classes = [IsAuthenticated, HasRequiredPermission]
    required_permission_id = {
        'GET': [PERMISSION_VIEW_SERVICE_FEE_SETTINGS],
        'POST': [PERMISSION_ADD_SERVICE_FEE_SETTINGS]
    }
    parser_classes = [JSONParser]

    def get(self, request):
        """
        Get list of service fees with optional filtering
        """
        try:
            queryset = ServiceFee.objects.all()

            # Filter by active status
            is_active = request.query_params.get('is_active', None)
            if is_active is not None:
                queryset = queryset.filter(is_active=is_active.lower() == 'true')

            # Search functionality
            search = request.query_params.get('search', None)
            if search:
                queryset = queryset.filter(
                    Q(creator_name__icontains=search) |
                    Q(creator__full_name__icontains=search) |
                    Q(towers__tower_name__icontains=search) |
                    Q(units__unit_name__icontains=search)
                ).distinct()

            # Filter by currency
            currency = request.query_params.get('currency', None)
            if currency:
                queryset = queryset.filter(currency=currency)

            # Filter by frequency
            frequency = request.query_params.get('frequency', None)
            if frequency:
                queryset = queryset.filter(frequency=frequency)

            # Filter by tower
            tower_id = request.query_params.get('tower_id', None)
            if tower_id:
                queryset = queryset.filter(towers__id=tower_id)

            # Filter by tower name
            tower_name = request.query_params.get('tower_name', None)
            if tower_name:
                queryset = queryset.filter(towers__tower_name__icontains=tower_name)

            # Filter by unit
            unit_id = request.query_params.get('unit_id', None)
            if unit_id:
                queryset = queryset.filter(units__id=unit_id)

            # Ordering
            ordering = request.query_params.get('ordering', '-created_at')
            if ordering:
                queryset = queryset.order_by(ordering)

            serializer = ServiceFeeListSerializer(queryset, many=True)

            return Response({
                'success': True,
                'data': serializer.data,
                'count': queryset.count()
            }, status=status.HTTP_200_OK)

        except Exception as e:
            return Response({
                'success': False,
                'message': f'Error retrieving service fees: {str(e)}'
            }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

    def post(self, request):
        """
        Create a new service fee
        """
        try:
            serializer = ServiceFeeSerializer(data=request.data, context={'request': request})

            if serializer.is_valid():
                service_fee = serializer.save()
                
                # Create serializable data for audit trail
                service_fee_data = model_to_dict(service_fee)
                # Handle ManyToMany relationships
                service_fee_data['towers'] = [t.id for t in service_fee.towers.all()]
                service_fee_data['units'] = [u.id for u in service_fee.units.filter(servicefeeunit__is_active=True)]

                # Create audit trail entry
                try:
                    member = request.user.member
                except AttributeError:
                    member = Member.objects.get(user=request.user)
                
                create_audit_trail(
                    member=member,
                    event_type='SERVICE_FEE_CREATED',
                    table_name='ServiceFee',
                    row_id=service_fee.id,
                    new_data=service_fee_data,
                    description=f'Service fee created with amount {service_fee.fee_amount} {service_fee.currency}'
                )

                # Create audit trail for service fee creation
                try:
                    member = None
                    if hasattr(request, 'user') and request.user and request.user.is_authenticated:
                        member = Member.objects.get(user=request.user)
                    
                    create_audit_trail(
                        member=member,
                        event_type='SERVICE_FEE_CREATED',
                        table_name='service_fee_servicefee',
                        row_id=service_fee.id,
                        new_data=ServiceFeeSerializer(service_fee, context={'request': request}).data,
                        description=f'Service fee created: {service_fee.fee_amount} {service_fee.currency}'
                    )
                except Exception as e:
                    print(f"Audit trail error: {e}")

                # Return detailed data
                response_serializer = ServiceFeeSerializer(service_fee, context={'request': request})

                return Response({
                    'success': True,
                    'message': 'Service fee created successfully',
                    'data': response_serializer.data
                }, status=status.HTTP_201_CREATED)

            return Response({
                'success': False,
                'message': 'Validation failed',
                'errors': serializer.errors
            }, status=status.HTTP_400_BAD_REQUEST)

        except ValidationError as e:
            return Response({
                'success': False,
                'message': str(e)
            }, status=status.HTTP_400_BAD_REQUEST)

        except Exception as e:
            return Response({
                'success': False,
                'message': f'Error creating service fee: {str(e)}'
            }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

class ServiceFeeDetailView(APIView):
    """
    API view for retrieving, updating, and deleting a specific service fee
    """
    permission_classes = [IsAuthenticated, HasRequiredPermission]
    required_permission_id = {
        'GET': [PERMISSION_VIEW_SERVICE_FEE_SETTINGS],
        'PUT': [PERMISSION_EDIT_SERVICE_FEE_SETTINGS],
        'PATCH': [PERMISSION_EDIT_SERVICE_FEE_SETTINGS],
        'DELETE': [PERMISSION_EDIT_SERVICE_FEE_SETTINGS]
    }
    parser_classes = [JSONParser]

    def get_object(self, pk):
        """
        Get service fee object or return 404
        """
        return get_object_or_404(ServiceFee, pk=pk)

    def get(self, request, pk):
        """
        Retrieve a specific service fee
        """
        try:
            service_fee = self.get_object(pk)
            serializer = ServiceFeeSerializer(service_fee, context={'request': request})

            return Response({
                'success': True,
                'data': serializer.data
            }, status=status.HTTP_200_OK)

        except Exception as e:
            return Response({
                'success': False,
                'message': f'Error retrieving service fee: {str(e)}'
            }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

    def put(self, request, pk):
        """
        Update a specific service fee
        """

        try:
            service_fee = self.get_object(pk)
            
            # Create serializable old data
            old_data = model_to_dict(service_fee)
            old_data['towers'] = [t.id for t in service_fee.towers.all()]
            old_data['units'] = [u.id for u in service_fee.units.filter(servicefeeunit__is_active=True)]
            
            serializer = ServiceFeeSerializer(
                service_fee,
                data=request.data,
                context={'request': request},
                partial=True
            )

            if serializer.is_valid():
                updated_service_fee = serializer.save()
                
                # Create serializable new data
                new_data = model_to_dict(updated_service_fee)
                new_data['towers'] = [t.id for t in updated_service_fee.towers.all()]
                new_data['units'] = [u.id for u in updated_service_fee.units.filter(servicefeeunit__is_active=True)]

                # Create audit trail entry
                try:
                    member = request.user.member
                except AttributeError:
                    member = Member.objects.get(user=request.user)
                
                create_audit_trail(
                    member=member,
                    event_type='SERVICE_FEE_UPDATED',
                    table_name='ServiceFee',
                    row_id=service_fee.id,
                    old_data=old_data,
                    new_data=new_data,
                    description=f'Service fee updated - amount: {updated_service_fee.fee_amount} {updated_service_fee.currency}'
                )

                response_serializer = ServiceFeeSerializer(updated_service_fee, context={'request': request})

                return Response({
                    'success': True,
                    'message': 'Service fee updated successfully',
                    'data': response_serializer.data
                }, status=status.HTTP_200_OK)

            # Enhanced error response for debugging
            print(f"DEBUG: Service fee validation failed for ID {pk}")
            print(f"DEBUG: Request data: {request.data}")
            print(f"DEBUG: Serializer errors: {serializer.errors}")
            
            return Response({
                'success': False,
                'message': 'Validation failed',
                'errors': serializer.errors,
                'debug_info': {
                    'request_data_keys': list(request.data.keys()) if hasattr(request.data, 'keys') else 'N/A',
                    'serializer_data': getattr(serializer, 'validated_data', {}),
                    'is_partial': getattr(serializer, 'partial', False)
                }
            }, status=status.HTTP_400_BAD_REQUEST)

        except ValidationError as e:
            return Response({
                'success': False,
                'message': str(e)
            }, status=status.HTTP_400_BAD_REQUEST)
        
        except serializers.ValidationError as e:
            # Handle DRF serializer validation errors
            error_message = e.detail
            if isinstance(error_message, dict):
                # Extract the actual error message
                if '__all__' in error_message:
                    error_message = error_message['__all__'][0] if isinstance(error_message['__all__'], list) else error_message['__all__']
                else:
                    error_message = str(error_message)
            
            return Response({
                'success': False,
                'message': str(error_message),
                'errors': e.detail
            }, status=status.HTTP_400_BAD_REQUEST)

        except Exception as e:
            return Response({
                'success': False,
                'message': f'Error updating service fee: {str(e)}'
            }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

    def patch(self, request, pk):
        """
        Partially update a specific service fee
        """
        try:
            service_fee = self.get_object(pk)
            
            # Create serializable old data
            old_data = model_to_dict(service_fee)
            old_data['towers'] = [t.id for t in service_fee.towers.all()]
            old_data['units'] = [u.id for u in service_fee.units.filter(servicefeeunit__is_active=True)]
            
            serializer = ServiceFeeSerializer(
                service_fee,
                data=request.data,
                context={'request': request},
                partial=True
            )

            if serializer.is_valid():
                updated_service_fee = serializer.save()
                
                # Create serializable new data
                new_data = model_to_dict(updated_service_fee)
                new_data['towers'] = [t.id for t in updated_service_fee.towers.all()]
                new_data['units'] = [u.id for u in updated_service_fee.units.filter(servicefeeunit__is_active=True)]

                # Create audit trail entry
                try:
                    member = request.user.member
                except AttributeError:
                    member = Member.objects.get(user=request.user)
                
                create_audit_trail(
                    member=member,
                    event_type='SERVICE_FEE_UPDATED',
                    table_name='ServiceFee',
                    row_id=service_fee.id,
                    old_data=old_data,
                    new_data=new_data,
                    description=f'Service fee partially updated - amount: {updated_service_fee.fee_amount} {updated_service_fee.currency}'
                )

                response_serializer = ServiceFeeSerializer(updated_service_fee, context={'request': request})

                return Response({
                    'success': True,
                    'message': 'Service fee updated successfully',
                    'data': response_serializer.data
                }, status=status.HTTP_200_OK)

            return Response({
                'success': False,
                'message': 'Validation failed',
                'errors': serializer.errors
            }, status=status.HTTP_400_BAD_REQUEST)

        except ValidationError as e:
            return Response({
                'success': False,
                'message': str(e)
            }, status=status.HTTP_400_BAD_REQUEST)
        
        except serializers.ValidationError as e:
            # Handle DRF serializer validation errors
            error_message = e.detail
            if isinstance(error_message, dict):
                # Extract the actual error message
                if '__all__' in error_message:
                    error_message = error_message['__all__'][0] if isinstance(error_message['__all__'], list) else error_message['__all__']
                else:
                    error_message = str(error_message)
            
            return Response({
                'success': False,
                'message': str(error_message),
                'errors': e.detail
            }, status=status.HTTP_400_BAD_REQUEST)

        except Exception as e:
            return Response({
                'success': False,
                'message': f'Error updating service fee: {str(e)}'
            }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

    def delete(self, request, pk):
        """
        Delete a specific service fee (soft delete by setting is_active=False)
        """
        try:
            service_fee = self.get_object(pk)
            
            # Create serializable old data
            old_data = model_to_dict(service_fee)
            old_data['towers'] = [t.id for t in service_fee.towers.all()]
            old_data['units'] = [u.id for u in service_fee.units.filter(servicefeeunit__is_active=True)]

            # Soft delete by setting is_active to False
            service_fee.is_active = False

            # Update audit fields
            if request.user:
                try:
                    member = Member.objects.get(user=request.user)
                    service_fee.updated_by = member
                except Member.DoesNotExist:
                    member = None
            
            # Save immediately to persist is_active=False to database
            service_fee.save(skip_validation=True)
            
            # Also soft-delete all related ServiceFeeUnit records
            from .models import ServiceFeeUnit
            ServiceFeeUnit.objects.filter(service_fee=service_fee, is_active=True).update(is_active=False)
            
            # Create history entry after saving
            if request.user and member:
                try:
                    # Create serializable new data after save
                    new_data = model_to_dict(service_fee)
                    new_data['towers'] = [t.id for t in service_fee.towers.all()]
                    new_data['units'] = [u.id for u in service_fee.units.filter(servicefeeunit__is_active=True)]
                    
                    # Create audit trail entry
                    create_audit_trail(
                        member=member,
                        event_type='SERVICE_FEE_CANCELLED',
                        table_name='ServiceFee',
                        row_id=service_fee.id,
                        old_data=old_data,
                        new_data=new_data,
                        description=f'Service fee cancelled - was {service_fee.fee_amount} {service_fee.currency}'
                    )
                    
                    # Create history entry for cancellation
                    field_changes = [{
                        'field': 'Status',
                        'field_display': 'Status',
                        'old_value': 'Active',
                        'new_value': 'Cancelled'
                    }]
                    ServiceFeeHistory.create_history_entry(
                        service_fee=service_fee,
                        action='cancelled',
                        changed_by=member,
                        field_changes=field_changes,
                        request=request
                    )
                except Exception as e:
                    # Log audit error but don't fail the delete operation
                    print(f"Error creating audit trail for cancellation: {e}")

            return Response({
                'success': True,
                'message': 'Service fee cancelled successfully'
            }, status=status.HTTP_200_OK)

        except Exception as e:
            return Response({
                'success': False,
                'message': f'Error cancelling service fee: {str(e)}'
            }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


class ServiceFeeStatusChangeView(APIView):
    """
    API view for changing service fee status (activate/deactivate)
    """
    permission_classes = [IsAuthenticated, HasRequiredPermission]
    required_permission_id = [PERMISSION_EDIT_SERVICE_FEE_SETTINGS]


    def post(self, request, pk):
        """
        Toggle service fee status (activate/deactivate)
        """

        try:
            service_fee = get_object_or_404(ServiceFee, pk=pk)
            
            # Create serializable old data
            old_data = model_to_dict(service_fee)
            old_data['towers'] = [t.id for t in service_fee.towers.all()]
            old_data['units'] = [u.id for u in service_fee.units.filter(servicefeeunit__is_active=True)]
            
            # Toggle the service fee status
            service_fee.is_active = not service_fee.is_active
            service_fee.save()
            
            # Create serializable new data
            new_data = model_to_dict(service_fee)
            new_data['towers'] = [t.id for t in service_fee.towers.all()]
            new_data['units'] = [u.id for u in service_fee.units.filter(servicefeeunit__is_active=True)]

            # Create audit trail entry
            try:
                member = request.user.member
            except AttributeError:
                member = Member.objects.get(user=request.user)

            event_type = 'SERVICE_FEE_ACTIVATED' if service_fee.is_active else 'SERVICE_FEE_DEACTIVATED'
            status_text = "Activated" if service_fee.is_active else "Deactivated"
            
            create_audit_trail(
                member=member,
                event_type=event_type,
                table_name='ServiceFee',
                row_id=service_fee.id,
                old_data=old_data,
                new_data=new_data,
                description=f'Service fee {status_text.lower()} - amount: {service_fee.fee_amount} {service_fee.currency}'
            )

            # Create history entry
            field_changes = [{
                'field': 'Status',
                'field_display': 'Status',
                'old_value': 'Active' if old_data['is_active'] else 'Inactive',
                'new_value': 'Active' if service_fee.is_active else 'Inactive'
            }]
            ServiceFeeHistory.create_history_entry(
                service_fee=service_fee,
                action='activated' if service_fee.is_active else 'deactivated',
                changed_by=member,
                field_changes=field_changes,
                request=request
            )

            response_serializer = ServiceFeeSerializer(service_fee, context={'request': request})

            return Response({
                'success': True,
                'message': f'Service fee {status_text.lower()} successfully',
                'data': response_serializer.data
            }, status=status.HTTP_200_OK)

        except Exception as e:
            return Response({
                'success': False,
                'message': f'Error changing service fee status: {str(e)}'
            }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


class ServiceFeeValidationView(APIView):
    """
    API view for validating service fee data before creation/update
    """
    permission_classes = [IsAuthenticated, HasRequiredPermission]
    required_permission_id = [PERMISSION_VIEW_SERVICE_FEE_SETTINGS]
    parser_classes = [JSONParser]


    def post(self, request):
        """
        Validate service fee data without saving
        """

        try:
            # Check for unit conflicts
            tower_ids = request.data.get('tower_ids', [])
            unit_ids = request.data.get('unit_ids', [])
            exclude_id = request.data.get('exclude_id', None)  # For updates - ID of service fee being edited

            print(f"[ServiceFeeValidation] Validating - tower_ids: {tower_ids}, unit_ids: {unit_ids}, exclude_id: {exclude_id}")

            if not tower_ids and not unit_ids:
                return Response({
                    'success': False,
                    'message': 'At least one tower or unit must be selected'
                }, status=status.HTTP_400_BAD_REQUEST)

            # Get all units that would be covered
            all_units = set()

            # Add units from selected towers
            if tower_ids:
                tower_units = Unit.objects.filter(floor__tower__id__in=tower_ids)
                all_units.update(tower_units)

            # Add directly selected units
            if unit_ids:
                units = Unit.objects.filter(id__in=unit_ids)
                all_units.update(units)

            print(f"[ServiceFeeValidation] Total units to check: {len(all_units)}")

            # Re-enabled conflict validation - preventing same units from being assigned to multiple service fees
            # Check if any of these units already have an active service fee
            conflicting_fees = ServiceFee.objects.filter(is_active=True)
            
            # CRITICAL: Exclude the service fee being updated (when editing existing service fee)
            # This allows updating the same service fee without triggering conflict with itself
            if exclude_id:
                try:
                    exclude_id_int = int(exclude_id)
                    conflicting_fees = conflicting_fees.exclude(pk=exclude_id_int)
                    print(f"[ServiceFeeValidation] Excluding service fee ID {exclude_id_int} from conflict check (editing mode)")
                except (ValueError, TypeError):
                    print(f"[ServiceFeeValidation] Warning: Could not parse exclude_id: {exclude_id}")
            
            print(f"[ServiceFeeValidation] Checking {conflicting_fees.count()} other active service fees for conflicts")
            
            for fee in conflicting_fees:
                fee_units = set()
                
                # If the conflicting fee has specific units, only use those
                if fee.units.exists():
                    fee_units.update(fee.units.filter(servicefeeunit__is_active=True))
                # If no specific units but towers are selected, use all tower units
                elif fee.towers.exists():
                    for tower in fee.towers.all():
                        tower_units = Unit.objects.filter(floor__tower=tower)
                        fee_units.update(tower_units)
                
                # Check for overlap
                overlapping_units = all_units.intersection(fee_units)
                if overlapping_units:
                    overlapping_unit_names = [f"{unit.unit_name} (Floor {unit.floor.floor_no})" for unit in overlapping_units]
                    return Response({
                        'success': False,
                        'message': f'The following units are already assigned to service fee {fee.id} - {", ".join(overlapping_unit_names)}. Each unit can only be assigned to one active service fee.',
                        'conflicting_service_fee_id': fee.id,
                        'overlapping_units': [{'id': unit.id, 'name': unit.unit_name, 'floor': unit.floor.floor_no} for unit in overlapping_units]
                    }, status=status.HTTP_400_BAD_REQUEST)

            return Response({
                'success': True,
                'message': 'Validation passed'
            }, status=status.HTTP_200_OK)

        except Exception as e:
            return Response({
                'success': False,
                'message': f'Error validating service fee: {str(e)}'
            }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


class TowerUnitsView(APIView):
    """
    API view for getting units in selected towers
    Supports both Organization Members and Community Members
    """
    permission_classes = [IsAuthenticated, HasRequiredPermission]
    required_permission_id = [PERMISSION_VIEW_SERVICE_FEE_SETTINGS]


    def get(self, request):
        """
        Get units for selected towers
        Organization Members: See all towers and units
        Community Members: See all towers and units (for service fee context)
        
        Query Parameters:
        - tower_ids (required): Comma-separated tower IDs
        - month (optional): Service period month (1-12)
        - year (optional): Service period year
        - category_status (optional): Filter bill categories - 'active' (default) or 'all'
          * 'active': Only show active bill categories
          * 'all': Show all bill categories (active and inactive)
        - exclude_service_fee_id (optional): Service fee ID being edited (to avoid self-conflict checks)
        """

        try:
            # Get current member to check access rights
            try:
                member = request.user.member
            except AttributeError:
                member = Member.objects.get(user=request.user)
            
            # Organization members should see all data
            # Community members with the permission should also see all data
            if not (member.is_org_member or member.is_comm_member):
                return Response({
                    'success': False,
                    'message': 'Access denied. Only organization or community members can access this endpoint.'
                }, status=status.HTTP_403_FORBIDDEN)
            
            tower_ids = request.query_params.get('tower_ids', '')
            exclude_service_fee_id = request.query_params.get('exclude_service_fee_id', None)
            month = request.query_params.get('month')
            year = request.query_params.get('year')
            category_status = request.query_params.get('category_status', 'active')  # Filter categories by status: 'active', 'all'
            
            print(f"DEBUG: TowerUnitsView - User: {request.user.username}, tower_ids: {tower_ids}, month: {month}, year: {year}, category_status: {category_status}")
            
            if not tower_ids:
                return Response({'success': True, 'data': []}, status=status.HTTP_200_OK)

            # Parse comma-separated tower IDs
            tower_id_list = [int(id.strip()) for id in tower_ids.split(',') if id.strip().isdigit()]
            
            if not tower_id_list:
                return Response({'success': True, 'data': []}, status=status.HTTP_200_OK)

            # Get units for the towers
            units = Unit.objects.filter(
                floor__tower__id__in=tower_id_list
            ).select_related('floor', 'floor__tower')
            
            def natural_sort_key(s):
                if not s: return (2, [])
                s = str(s).strip()
                if not s: return (2, [])
                prefix = 0 if s[0].isdigit() else 1
                parts = []
                for text in re.split(r'(\d+)', s):
                    if text.isdigit():
                        parts.append((0, int(text)))
                    elif text:
                        parts.append((1, text.lower()))
                return (prefix, parts)
                
            units = list(units)
            units.sort(key=lambda x: (
                natural_sort_key(x.floor.tower.tower_name),
                x.floor.floor_no,
                natural_sort_key(x.unit_name)
            ))
            
            # Fetch bill upload details and check for existing payments if month and year are provided
            bill_amounts_map = {}
            already_generated_units = set()
            available_categories_map = {}
            
            if month and year:
                try:
                    from service_fee_management.models import BillUploadDetail, ServiceFeePayment
                    
                    # Enforce integer casting for DB comparison
                    month_val = int(month)
                    year_val = int(year)
                    
                    # 1. Identify units that already have a generated bill (ServiceFeePayment record) for this period
                    existing_payments = ServiceFeePayment.objects.filter(
                        unit__in=units,
                        service_period_month=month_val,
                        service_period_year=year_val
                    ).values_list('unit_id', flat=True)
                    already_generated_units = set(existing_payments)
                    
                    # 2. Fetch extra bill categories from uploads - FILTER BY STATUS
                    bill_details = BillUploadDetail.objects.filter(
                        unit__in=units,
                        upload_month=month_val,
                        upload_year=year_val
                    ).select_related('bill_upload__bill_category')
                    
                    for detail in bill_details:
                        unit_id = detail.unit_id
                        cat = detail.bill_upload.bill_category
                        if not cat:
                            continue
                        
                        # FILTER: Check category status based on parameter
                        if category_status == 'active' and not cat.is_active:
                            continue  # Skip inactive categories when filtering for 'active'
                        # If category_status == 'all', include all categories
                            
                        if unit_id not in bill_amounts_map:
                            bill_amounts_map[unit_id] = []
                        
                        bill_amounts_map[unit_id].append({
                            'category_id': cat.id,
                            'category_name': cat.name,
                            'amount': float(detail.amount),
                            'is_active': cat.is_active  # Include status in response
                        })

                        # Collect available categories - FILTER BY STATUS
                        if cat.id not in available_categories_map:
                            available_categories_map[cat.id] = {
                                'id': cat.id,
                                'name': cat.name,
                                'icon': cat.icon,
                                'color': cat.color,
                                'description': cat.description,
                                'is_active': cat.is_active  # Include status in response
                            }
                except Exception as e:
                    print(f"DEBUG: TowerUnitsView - Error checking existing payments/bills: {e}")

            # Get the service fee being edited (if any) to check its current assignments
            current_service_fee_units = set()
            if exclude_service_fee_id:
                try:
                    current_service_fee = ServiceFee.objects.get(id=exclude_service_fee_id, is_active=True)
                    if current_service_fee.units.exists():
                        current_service_fee_units.update(current_service_fee.units.filter(servicefeeunit__is_active=True))
                    elif current_service_fee.towers.exists():
                        for tower in current_service_fee.towers.all():
                            tower_units = Unit.objects.filter(floor__tower=tower)
                            current_service_fee_units.update(tower_units)
                except ServiceFee.DoesNotExist:
                    pass
            
            # Cache active service fees mapping
            active_fees = list(ServiceFee.objects.filter(is_active=True).prefetch_related('units', 'towers'))

            units_data = []
            for unit in units:
                # 1. If bill already generated for this unit/month/year, DO NOT SHOW it
                if unit.id in already_generated_units:
                    continue
                
                # 2. NEW LOGIC: If month/year provided but unit has NO bill uploads, DO NOT SHOW it
                if month and year and unit.id not in bill_amounts_map:
                    continue
                    
                is_currently_assigned = unit in current_service_fee_units
                
                assigned_to_other_fee = False
                assigned_service_fee_id = None
                
                for service_fee in active_fees:
                    if exclude_service_fee_id and str(service_fee.id) == str(exclude_service_fee_id):
                        continue
                    
                    if service_fee.units.filter(id=unit.id, servicefeeunit__is_active=True).exists():
                        assigned_to_other_fee = True
                        assigned_service_fee_id = service_fee.id
                        break
                    
                    if service_fee.towers.filter(id=unit.floor.tower.id).exists() and not service_fee.units.exists():
                        assigned_to_other_fee = True
                        assigned_service_fee_id = service_fee.id
                        break
                
                base_display_name = f"{unit.unit_name} (Floor {unit.floor.floor_no}, {unit.floor.tower.tower_name})"
                assignment_status = "available"
                display_name = base_display_name

                if is_currently_assigned:
                    display_name = f"{base_display_name} (Currently Assigned)"
                    assignment_status = "currently_assigned"
                elif assigned_to_other_fee:
                    display_name = f"{base_display_name} (Assigned to Other)"
                    assignment_status = "assigned_to_other"
                
                units_data.append({
                    'id': unit.id,
                    'unit_name': unit.unit_name,
                    'floor_no': unit.floor.floor_no,
                    'tower_name': unit.floor.tower.tower_name,
                    'display_name': display_name,
                    'is_assigned': assigned_to_other_fee,
                    'is_currently_assigned': is_currently_assigned,
                    'assignment_status': assignment_status,
                    'assigned_service_fee_id': assigned_service_fee_id,
                    'bill_categories': bill_amounts_map.get(unit.id, []),
                    'is_bill_generated': False # Always False if skipped above
                })

            return Response({
                'success': True,
                'data': units_data,
                'available_categories': list(available_categories_map.values()),
                'filters_applied': {
                    'category_status': category_status
                }
            }, status=status.HTTP_200_OK)

        except Exception as e:
            return Response({
                'success': False,
                'message': f'Error retrieving units: {str(e)}'
            }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


class ServiceFeeTowerListView(APIView):
    """
    API view for getting all towers for service fee settings
    Supports both Organization Members and Community Members with proper permissions
    """
    permission_classes = [IsAuthenticated, HasRequiredPermission]
    
    def get(self, request):
        """
        Get all towers for service fee configuration
        Organization Members: See all towers
        Community Members with permission: See all towers
        """
        # Require view permission to fetch towers
        self.required_permission_id = [PERMISSION_VIEW_SERVICE_FEE_SETTINGS]
        try:
            # Get current member to check access rights
            try:
                member = request.user.member
            except AttributeError:
                member = Member.objects.get(user=request.user)
            
            print(f"DEBUG: ServiceFeeTowerListView - User: {request.user.username}, is_org: {member.is_org_member}, is_comm: {member.is_comm_member}")
            
            # Organization members should see all towers
            # Community members with the permission should also see all towers
            if not (member.is_org_member or member.is_comm_member):
                return Response({
                    'success': False,
                    'message': 'Access denied. Only organization or community members can access this endpoint.',
                    'data': []
                }, status=status.HTTP_403_FORBIDDEN)
            
            # Return ALL towers from the database
            towers = Tower.objects.all().values('id', 'tower_name', 'tower_number')
            towers_list = list(towers)
            
            def natural_sort_key(s):
                if not s: return (2, [])
                s = str(s).strip()
                if not s: return (2, [])
                prefix = 0 if s[0].isdigit() else 1
                parts = []
                for text in re.split(r'(\d+)', s):
                    if text.isdigit():
                        parts.append((0, int(text)))
                    elif text:
                        parts.append((1, text.lower()))
                return (prefix, parts)
                
            towers_list.sort(key=lambda x: natural_sort_key(x['tower_name']))
            
            print(f"DEBUG: ServiceFeeTowerListView - Returning {len(towers_list)} towers")
            
            return Response({
                'success': True,
                'data': towers_list,
                'count': len(towers_list)
            }, status=status.HTTP_200_OK)
            
        except Exception as e:
            print(f"ERROR: ServiceFeeTowerListView - {str(e)}")
            return Response({
                'success': False,
                'message': f'Error retrieving towers: {str(e)}',
                'data': []
            }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


class ServiceFeePermanentDeleteView(APIView):
    """
    API view for permanently deleting a service fee from the database
    Only for archived/cancelled service fees
    """
    permission_classes = [IsAuthenticated, HasRequiredPermission]
    # Require archive permission to permanently delete
    required_permission_id = [PERMISSION_EDIT_SERVICE_FEE_SETTINGS]

    def delete(self, request, pk):
        """
        Permanently delete a service fee from the database
        Only allows deletion of inactive (archived) service fees
        """
        try:
            service_fee = get_object_or_404(ServiceFee, pk=pk)
            
            # Security check: Only allow permanent deletion of inactive service fees
            if service_fee.is_active:
                return Response({
                    'success': False,
                    'message': 'Cannot permanently delete an active service fee. Please archive it first.'
                }, status=status.HTTP_400_BAD_REQUEST)
            
            # Store info for audit trail before deletion
            service_fee_info = {
                'id': service_fee.id,
                'fee_amount': float(service_fee.fee_amount),
                'currency': service_fee.currency,
                'tower_names': [tower.tower_name for tower in service_fee.towers.all()],
                'unit_count': service_fee.units.count()
            }
            
            # Create audit trail entry before deletion
            try:
                member = request.user.member
            except AttributeError:
                try:
                    member = Member.objects.get(user=request.user)
                except Member.DoesNotExist:
                    member = None
            
            if member:
                try:
                    create_audit_trail(
                        member=member,
                        event_type='SERVICE_FEE_PERMANENTLY_DELETED',
                        table_name='ServiceFee',
                        row_id=service_fee.id,
                        old_data=service_fee_info,
                        new_data=None,
                        description=f'Service fee permanently deleted - ID: {service_fee.id}, Amount: {service_fee.fee_amount} {service_fee.currency}'
                    )
                except Exception as e:
                    print(f"Error creating audit trail for permanent deletion: {e}")
            
            # Permanently delete the service fee (cascade will delete related MFS and Bank accounts)
            service_fee.delete()

            return Response({
                'success': True,
                'message': 'Service fee permanently deleted successfully'
            }, status=status.HTTP_200_OK)

        except Exception as e:
            return Response({
                'success': False,
                'message': f'Error permanently deleting service fee: {str(e)}'
            }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


class ServiceFeeHistoryView(APIView):
    """
    API view for retrieving service fee history
    """
    permission_classes = [IsAuthenticated, HasRequiredPermission]
    parser_classes = [JSONParser]

    def get(self, request, service_fee_id):
        """
        Get history for a specific service fee
        """
        # Require view permission for history
        self.required_permission_id = [PERMISSION_VIEW_SERVICE_FEE_SETTINGS]
        try:
            # Get the service fee object
            service_fee = get_object_or_404(ServiceFee, pk=service_fee_id)
            
            # Get history entries for this service fee
            history_entries = ServiceFeeHistory.objects.filter(
                service_fee=service_fee
            ).select_related('changed_by').order_by('-created_at')
            
            # Serialize the history entries
            serializer = ServiceFeeHistorySerializer(history_entries, many=True)
            
            # Transform data to match frontend format
            formatted_data = []
            for entry in serializer.data:
                formatted_entry = {
                    'id': entry['id'],
                    'type': entry['action_display'],
                    'action': entry['action'],
                    'user': entry['changed_by_name'],
                    'userId': entry['changed_by_display'].split('(ID: ')[1].rstrip(')') if '(ID: ' in entry['changed_by_display'] else None,
                    'timestamp': entry['created_at'],
                    'date': entry['formatted_date'],
                    'isRejected': False,  # Can be extended based on business logic
                    'changes': entry['formatted_changes'],
                    'reason': entry['reason'],
                    'ip_address': entry['ip_address']
                }
                formatted_data.append(formatted_entry)
            
            return Response({
                'success': True,
                'data': formatted_data,
                'count': len(formatted_data)
            }, status=status.HTTP_200_OK)

        except ServiceFee.DoesNotExist:
            return Response({
                'success': False,
                'message': 'Service fee not found'
            }, status=status.HTTP_404_NOT_FOUND)
        
        except Exception as e:
            return Response({
                'success': False,
                'message': f'Error retrieving service fee history: {str(e)}'
            }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
