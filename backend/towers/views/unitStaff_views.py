
from towers.serializers.unitStaff_serializers import UnitStaffSerializer,UnitStaffMemberSerializer,BulkUnitStaffSerializer
from towers.models import UnitStaff,Resident,Owner,Unit,UnitStaffHistory
from rest_framework import status
from rest_framework.permissions import IsAuthenticated
from rest_framework.exceptions import NotFound
from user.permissions import HasRequiredPermission
from django.shortcuts import get_object_or_404,get_list_or_404
from rest_framework.views import APIView
from rest_framework.response import Response
from user.models import Member
from audit_trail.create_audit_trail import create_audit_trail
from django.forms.models import model_to_dict
from django.core.mail import send_mail
from django.db import transaction
from django.conf import settings
from django.db.models import Q
from group_role.models import MembersRole,GroupMembers
from rest_framework import status,serializers
import pandas as pd
from user.serializers import MemberSerializer
from django.utils import timezone
import datetime
import logging
from collections import defaultdict

logger = logging.getLogger(__name__)



class CreateUnitStaff(APIView):
    # permission_classes = [IsAuthenticated, HasRequiredPermission]
    # required_permission_id = [11]
    def post(self, request):
        serializer = UnitStaffSerializer(data=request.data, context={'request': request})
        if serializer.is_valid():
            unit_staff = serializer.save()
            group_data = model_to_dict(unit_staff)
            try:
                member = request.user.member
            except AttributeError:
              
                member = Member.objects.get(user=request.user)
            
            # Create notification for managers with "View Unit Staff" permission
            # IMPORTANT: This is done AFTER serializer.save() and transaction commit
            # to ensure notification is immediately available when frontend queries
            try:
                from notifications.utils import create_unit_staff_added_notification
                create_unit_staff_added_notification(unit_staff, creator=member)
            except Exception as e:
                # Don't fail unit staff creation if notification fails
                logger.error(f"Error creating unit staff added notification: {e}")
                import traceback
                traceback.print_exc()
            
            # Create staff history entry
            try:
                # Get current staff state before adding new staff
                current_staff = UnitStaff.objects.filter(
                    unit=unit_staff.unit,
                    is_active=True
                ).select_related('member')
                
                staff_state_before = []
                for staff in current_staff:
                    if staff.id != unit_staff.id:  # Exclude the one we just created
                        staff_state_before.append({
                            'staff_id': staff.id,
                            'member_id': staff.member.id,
                            'name': staff.member.full_name,
                            'contact': staff.member.general_contact or '',
                            'email': staff.member.general_email or '',
                            'status': 'Live-in' if staff.unit_staff_status else 'Part-time',
                            'assignment_date': staff.created_at.date().isoformat() if staff.created_at else None
                        })
                
                # Build staff_state_after by adding the new staff
                staff_state_after = list(staff_state_before)
                staff_state_after.append({
                    'staff_id': unit_staff.id,
                    'member_id': unit_staff.member.id,
                    'name': unit_staff.member.full_name,
                    'contact': unit_staff.member.general_contact or '',
                    'email': unit_staff.member.general_email or '',
                    'status': 'Live-in' if unit_staff.unit_staff_status else 'Part-time',
                    'assignment_date': unit_staff.created_at.date().isoformat() if unit_staff.created_at else None
                })
                
                UnitStaffHistory.create_staff_assigned_entry(
                    unit=unit_staff.unit,
                    staff_member=unit_staff.member,
                    staff_status=unit_staff.unit_staff_status,
                    entry_date=unit_staff.created_at or timezone.now(),
                    created_by=member,
                    staff_state_before=staff_state_before,
                    staff_state_after=staff_state_after
                )
            except Exception as e:
                logger.error(f"Error creating staff history entry: {str(e)}")
                # Don't fail the request if history creation fails
            
            create_audit_trail(
                member=member,
                event_type='UnitStaff_CREATE',
                table_name='UnitStaff',
                row_id=unit_staff.id,
                new_data=group_data,
                description='UnitStaff Created'
            )
            return Response(
                {"message": "UnitStaff created successfully", "data": serializer.data},
                status=status.HTTP_201_CREATED
            )
       
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
    
class UnitStaffMemberList(APIView):
    # permission_classes = [IsAuthenticated]

    def get(self, request, unit_pk):

        unit_staff = UnitStaff.objects.select_related('member', 'unit').filter(
            unit__id=unit_pk,
            is_active=True,
            member__is_comm_member=True  # Only include active community members
        )
        serializer = UnitStaffMemberSerializer(unit_staff, many=True)

        return Response(serializer.data)

# Created by Firoj Hasan
# Description:
# - UpdateUnitStaffStatus: Update a single UnitStaff's unit_staff_status field.
# - BulkDeactivateUnitStaff: Soft delete .
# ================================================

class UpdateUnitStaffStatus(APIView):
    permission_classes = [IsAuthenticated, HasRequiredPermission]
    required_permission_id = [23]  # EDIT_UNIT_STAFF permission

    def patch(self, request, pk):
        unit_staff = get_object_or_404(UnitStaff, pk=pk)

        new_status = request.data.get('unit_staff_status')

        if new_status is None:
            return Response({"error": "staff status is required."}, status=status.HTTP_400_BAD_REQUEST)

        try:
            member = request.user.member
        except AttributeError:
            member = Member.objects.get(user=request.user)

        old_status = unit_staff.unit_staff_status
        old_data = {"unit_staff_status": old_status}
        unit_staff.unit_staff_status = new_status
        unit_staff.updated_by = member
        unit_staff.save()

        new_data = {"unit_staff_status": unit_staff.unit_staff_status}

        # Create staff history entry for status change
        try:
            # Get current staff state before status change
            current_staff = UnitStaff.objects.filter(
                unit=unit_staff.unit,
                is_active=True
            ).select_related('member')
            
            staff_state_before = []
            for s in current_staff:
                status_value = 'Live-in' if s.unit_staff_status else 'Part-time'
                if s.id == unit_staff.id:
                    # Use old status for this staff member
                    status_value = 'Live-in' if old_status else 'Part-time'
                staff_state_before.append({
                    'staff_id': s.id,
                    'member_id': s.member.id,
                    'name': s.member.full_name,
                    'contact': s.member.general_contact or '',
                    'email': s.member.general_email or '',
                    'status': status_value,
                    'assignment_date': s.created_at.date().isoformat() if s.created_at else None
                })
            
            # Build staff_state_after with updated status
            staff_state_after = []
            for s in current_staff:
                status_value = 'Live-in' if s.unit_staff_status else 'Part-time'
                staff_state_after.append({
                    'staff_id': s.id,
                    'member_id': s.member.id,
                    'name': s.member.full_name,
                    'contact': s.member.general_contact or '',
                    'email': s.member.general_email or '',
                    'status': status_value,
                    'assignment_date': s.created_at.date().isoformat() if s.created_at else None
                })
            
            UnitStaffHistory.create_staff_status_changed_entry(
                unit=unit_staff.unit,
                staff_member=unit_staff.member,
                old_status=old_status,
                new_status=new_status,
                entry_date=timezone.now(),
                created_by=member,
                staff_state_before=staff_state_before,
                staff_state_after=staff_state_after
            )
        except Exception as e:
            logger.error(f"Error creating staff status change history entry: {str(e)}")
            # Don't fail the request if history creation fails

        create_audit_trail(
            member=member,
            event_type='STAFF_STATUS_UPD',
            table_name='UnitStaff',
            row_id=unit_staff.id,
            old_data=old_data,
            new_data=new_data,
            description='Updated unit_staff_status field only'
        )

        return Response({
            "message": "Unit Staff Status Updated Successfully",
            "data": {
                "id": unit_staff.id,
                "unit_staff_status": unit_staff.unit_staff_status
            }
        }, status=status.HTTP_200_OK)
    


    # ================================================

class BulkDeleteUnitStaff(APIView):
    permission_classes = [IsAuthenticated, HasRequiredPermission]
    required_permission_id = [23]  # EDIT_UNIT_STAFF permission (covers deletion)

    def delete(self, request, *args, **kwargs):
        """
        Bulk delete UnitStaff records.
        Expects in request.data:
        - ids (list[int]): list of UnitStaff IDs to delete
        """
        ids = request.data.get('ids')

        # Validate payload
        if not isinstance(ids, list) or not ids:
            return Response(
                {"error": "A non‑empty list of 'ids' is required."},
                status=status.HTTP_400_BAD_REQUEST
            )

        try:
            actor = request.user.member
        except Member.DoesNotExist:
            return Response(
                {"error": "Requesting user is not linked to a Member."},
                status=status.HTTP_400_BAD_REQUEST
            )

        unit_staff_qs = get_list_or_404(UnitStaff, id__in=ids)
        affected_members = set()
        
        # Collect all staff info for bulk notification (before deletion)
        staff_info_list = []

        with transaction.atomic():
            for staff in unit_staff_qs:
                affected_members.add(staff.member.id)
                
                # Collect staff info for bulk notification
                staff_info_list.append({
                    'id': staff.id,
                    'name': staff.member.full_name,
                    'member_id': staff.member.id,
                    'unit': staff.unit
                })

                # Create staff history entry before deletion
                try:
                    # Get current staff state before removal
                    current_staff = UnitStaff.objects.filter(
                        unit=staff.unit,
                        is_active=True
                    ).select_related('member')
                    
                    staff_state_before = []
                    for s in current_staff:
                        staff_state_before.append({
                            'staff_id': s.id,
                            'member_id': s.member.id,
                            'name': s.member.full_name,
                            'contact': s.member.general_contact or '',
                            'email': s.member.general_email or '',
                            'status': 'Live-in' if s.unit_staff_status else 'Part-time',
                            'assignment_date': s.created_at.date().isoformat() if s.created_at else None
                        })
                    
                    # Build staff_state_after by removing this staff
                    staff_state_after = [
                        s for s in staff_state_before 
                        if s.get('staff_id') != staff.id
                    ]
                    
                    UnitStaffHistory.create_staff_removed_entry(
                        unit=staff.unit,
                        staff_member=staff.member,
                        entry_date=timezone.now(),
                        created_by=actor,
                        staff_state_before=staff_state_before,
                        staff_state_after=staff_state_after
                    )
                except Exception as e:
                    logger.error(f"Error creating staff removal history entry: {str(e)}")
                    # Don't fail the request if history creation fails

                # Save audit data before deletion
                create_audit_trail(
                    member=actor,
                    event_type='STAFF_DELETED',
                    table_name='UnitStaff',
                    row_id=staff.id,
                    old_data={"is_active": staff.is_active},
                    new_data={"deleted": True},
                    description=f"UnitStaff id={staff.id} deleted."
                )

                # Delete the staff entry
                staff.delete()
            
            # Check and update each affected member
            for member_id in affected_members:
                still_exists = (
                    Resident.objects.filter(member_id=member_id, is_active=True).exists() or
                    UnitStaff.objects.filter(member_id=member_id, is_active=True).exists() or
                    Owner.objects.filter(member_id=member_id).exists()
                )
                if not still_exists:
                    # Member.objects.filter(id=member_id).update(is_comm_member=False)
                    MembersRole.objects.filter(member__id=member_id).delete()
                    # remove any GroupMembers rows that would block deletion
                    GroupMembers.objects.filter(member_id=member_id).delete()
                    Member.objects.filter(id=member_id, org_member_ever_created=False).delete()

        # Create bulk notification after all deletions and transaction commit
        # IMPORTANT: This is done AFTER transaction commits to ensure notification 
        # is immediately available when frontend queries
        if staff_info_list:
            try:
                from notifications.utils import create_bulk_unit_staff_removed_notification
                create_bulk_unit_staff_removed_notification(staff_info_list, remover=actor)
            except Exception as e:
                logger.error(f"Error creating bulk unit staff removed notification: {e}")
                # Don't fail deletion if notification fails

        return Response(
            {"message": f"{len(unit_staff_qs)} UnitStaff deleted successfully."},
            status=status.HTTP_200_OK
        )


# class BulkDeactivateUnitStaff(APIView):
    permission_classes = [IsAuthenticated]

    def patch(self, request, *args, **kwargs):
        """
        Bulk soft delete or activate UnitStaff records.
        Expects in request.data:
        - ids (list[int]): list of UnitStaff IDs
        - is_active (bool): True to activate, False to deactivate
        """
        ids = request.data.get('ids')
        is_active = request.data.get('is_active')

        # Validate payload
        if not isinstance(ids, list) or not ids:
            return Response(
                {"error": "A non‑empty list of 'ids' is required."},
                status=status.HTTP_400_BAD_REQUEST
            )
        if not isinstance(is_active, bool):
            return Response(
                {"error": "'is_active' field (boolean) is required."},
                status=status.HTTP_400_BAD_REQUEST
            )

        # Ensure the requesting user has a Member
        try:
            actor = request.user.member
        except Member.DoesNotExist:
            return Response(
                {"error": "Requesting user is not linked to a Member."},
                status=status.HTTP_400_BAD_REQUEST
            )

        # Fetch UnitStaff entries (404 if any ID is invalid)
        unit_staff_qs = get_list_or_404(UnitStaff, id__in=ids)
        updated_records = []

        # Wrap in a transaction
        with transaction.atomic():
            for staff in unit_staff_qs:
                old_data = {"is_active": staff.is_active}

                # Only proceed if status is actually changing
                if staff.is_active != is_active:
                    staff.is_active = is_active
                    staff.updated_by = actor
                    staff.save(update_fields=['is_active', 'updated_by', 'updated_at'])

                    new_data = {"is_active": staff.is_active}
                    updated_records.append({
                        "id": staff.id,
                        "is_active": staff.is_active
                    })

                    # Send email notification
                    recipient_email = getattr(staff.member, 'general_email', None)
                    if recipient_email:
                        subject = (
                            "Account Activated"
                            if is_active
                            else "Account Deactivated"
                        )
                        message = (
                            "Your account has been activated."
                            if is_active
                            else "Your account has been deactivated."
                        )
                        try:
                            send_mail(
                                subject,
                                message,
                                settings.EMAIL_HOST_USER,
                                [recipient_email],
                                fail_silently=False
                            )
                        except Exception as e:
                            logger.error(
                                f"Failed to send email to UnitStaff id={staff.id} "
                                f"({recipient_email}): {e}"
                            )
                    else:
                        logger.warning(f"No general_email found for Member {staff.member.id}")

                    # Record the change in audit trail
                    create_audit_trail(
                        member=actor,
                        event_type='STAFF_STATUS_CHANGE',
                        table_name='UnitStaff',
                        row_id=staff.id,
                        old_data=old_data,
                        new_data=new_data,
                        description=f"Bulk set is_active={is_active}"
                    )

        return Response(
            {
                "message": f"{len(updated_records)} UnitStaff removed successfully.",
                "data": updated_records
            },
            status=status.HTTP_200_OK
        )
    

    


class UnitStaffBulkUploadView(APIView):
    permission_classes = [IsAuthenticated]

    def parse_int(self, val):
        try:
            return int(float(val))
        except (ValueError, TypeError):
            return None

    def parse_dob(self, val):
        """Parse date_of_birth to DD-MMM-YYYY format for MemberSerializer"""
        if pd.isna(val) or not val:
            return None
        try:
            dt = pd.to_datetime(val, errors='raise')
            return dt.strftime("%d-%b-%Y")  # Format: DD-MMM-YYYY
        except Exception:
            return None

    def parse_staff_status(self, val):
        """Parse unit_staff_status to boolean.
        Accepts: 1/0, True/False, 'live-in'/'part-time', 'active'/'inactive', or empty (defaults to True)
        Returns: True for live-in (1, True, 'live-in', 'active'), False for part-time (0, False, 'part-time', 'inactive')
        """
        if pd.isna(val) or val == '':
            return True  # Default to True (live-in)
        
        # Convert to string and normalize
        val_str = str(val).strip().lower()
        
        # Handle numeric values
        if val_str in ['1', '1.0', 'true']:
            return True
        if val_str in ['0', '0.0', 'false']:
            return False
        
        # Handle text values
        if val_str in ['live-in', 'livein', 'active', 'live in']:
            return True
        if val_str in ['part-time', 'parttime', 'inactive', 'part time']:
            return False
        
        # If we can't parse, default to True
        return True

    def parse_contact(self, contact):
        # No validation, pass through as-is
        return str(contact) if contact else contact

    def fmt_nid(self, cell):
        if pd.isna(cell):
            return ''
        if isinstance(cell, float):
            return str(int(cell)) if cell.is_integer() else str(cell).strip()
        return str(cell).strip()

    def parse_serializer_errors(self, errors):
        if isinstance(errors, dict):
            return {k: self.parse_serializer_errors(v) for k, v in errors.items()}
        elif isinstance(errors, list):
            return [str(e) for e in errors]
        return str(errors)

    def post(self, request, *args, **kwargs):
        file = request.FILES.get('file')
        if not file:
            return Response({
                'status': 'error',
                'message': 'No file uploaded',
                'total_rows': 0,
                'success_count': 0,
                'error_count': 0,
                'failed_rows': [],
                'created_staff': []
            }, status=status.HTTP_400_BAD_REQUEST)

        try:
            df = pd.read_csv(file) if file.name.lower().endswith('.csv') else pd.read_excel(file)
        except Exception as e:
            return Response({
                'status': 'error',
                'message': 'Failed to read file',
                'total_rows': 0,
                'success_count': 0,
                'error_count': 1,
                'failed_rows': [{
                    'row': 'File',
                    'errors': {
                        'file': str(e)
                    }
                }],
                'created_staff': [],
                'details': str(e)
            }, status=status.HTTP_400_BAD_REQUEST)

        df.columns = df.columns.str.strip().str.lower()
        df['nid_number'] = df.get('nid_number', pd.Series()).apply(self.fmt_nid)
        total_rows = len(df)

        # general_contact and delivery_method are optional
        required_fields = ['tower_name', 'tower_number', 'unit_name', 'full_name', 'general_email']
        missing = [f for f in required_fields if f not in df.columns]
        if missing:
            return Response({
                'status': 'error',
                'message': 'Missing required columns',
                'total_rows': total_rows,
                'success_count': 0,
                'error_count': 1,
                'failed_rows': [{
                    'row': 'Headers',
                    'errors': {
                        'missing_columns': f"Missing: {', '.join(list(missing))}"
                    }
                }],
                'created_staff': [],
                'missing_columns': list(missing)
            }, status=status.HTTP_400_BAD_REQUEST)

        results = {
            'total_rows': total_rows,
            'success_count': 0,
            'error_count': 0,
            'errors': []
        }

        current_user_member = request.user.member
        temp_errors = []
        validated_rows = []
        
        # Track delivery_methods in the current batch to detect duplicates (same as Owner/Resident)
        batch_delivery_methods = set()

        # Step 1: Validation Only
        for idx, row in df.iterrows():
            row_errors = {}
            row_num = idx + 2
            member_data = {}
            
            logger.info(f"🔍 Validating row {row_num}: {row.to_dict()}")

            tower_name = str(row.get('tower_name')).strip() if not pd.isna(row.get('tower_name')) else None
            tower_number = self.parse_int(row.get('tower_number'))
            unit_name = str(row.get('unit_name')).strip() if not pd.isna(row.get('unit_name')) else None

            if not tower_name:
                row_errors['tower_name'] = "Required field"
            if tower_number is None:
                row_errors['tower_number'] = "Invalid tower number"
            if not unit_name:
                row_errors['unit_name'] = "Required field"

            unit = Unit.objects.filter(
                unit_name=unit_name,
                floor__tower__tower_name=tower_name,
                floor__tower__tower_number=tower_number
            ).first()

            if not unit:
                row_errors['unit'] = f"Unit {unit_name} not found in Tower {tower_name} ({tower_number})"

            full_name = row.get('full_name', '')
            general_contact = row.get('general_contact', '')
            general_email = row.get('general_email', '')
            delivery_method = row.get('delivery_method', '')
            nid = row.get('nid_number', '')

            if not full_name or pd.isna(full_name):
                row_errors['full_name'] = "Full name is required"
            else:
                full_name = str(full_name).strip()
            
            # general_contact is optional with max 11 characters validation
            if general_contact and not pd.isna(general_contact):
                general_contact = str(general_contact).strip()
                logger.info(f"📱 Row {row_num} - general_contact: '{general_contact}' (length: {len(general_contact)})")
                if len(general_contact) > 11:
                    error_msg = f"Contact number cannot be more than 11 characters (current: {len(general_contact)})"
                    row_errors['general_contact'] = error_msg
                    logger.error(f"❌ Row {row_num} - {error_msg}")
            else:
                # Provide default empty string since model requires it (null=False)
                general_contact = ''
            
            if not general_email or pd.isna(general_email):
                row_errors['general_email'] = "General email is required"
            else:
                general_email = str(general_email).strip().lower()
                # Note: general_email is allowed to have duplicates since it's just contact info,
                # not a login credential. Only delivery_method (login_email/login_contact) must be unique.

            # general_contact is optional - no duplicate checking
            # (already processed above)

            # delivery_method is optional - validate for duplicates like Owner/Resident
            if delivery_method and not pd.isna(delivery_method):
                delivery_method = str(delivery_method).strip()
                if delivery_method:  # Check if not empty after stripping
                    if "@" in delivery_method:
                        # Check both existing members and current batch
                        if Member.objects.filter(login_email=delivery_method).exists():
                            row_errors['delivery_method'] = "This email address is already in use"
                        elif delivery_method.lower() in batch_delivery_methods:
                            row_errors['delivery_method'] = "This email address is already in use in this upload"
                        else:
                            batch_delivery_methods.add(delivery_method.lower())
                    elif delivery_method.isdigit():
                        # Check both existing members and current batch
                        if Member.objects.filter(login_contact=delivery_method).exists():
                            row_errors['delivery_method'] = "This contact number is already in use"
                        elif delivery_method in batch_delivery_methods:
                            row_errors['delivery_method'] = "This contact number is already in use in this upload"
                        else:
                            batch_delivery_methods.add(delivery_method)

                    if 'delivery_method' not in row_errors:
                        member_data['delivery_method'] = delivery_method








            

            
            # NID number - no validation, skip if duplicate to avoid database errors
            if nid:
                # If NID already exists, skip it (set to None) to avoid unique constraint violation
                if Member.objects.filter(nid_number=nid).exists():
                    # Skip NID silently - no error, just don't set it
                    pass
                else:
                    member_data['nid_number'] = nid

            def get_clean_value(val):
                return str(val).strip() if pd.notna(val) else None

            member_data.update({
                'full_name': full_name,
                'general_contact': general_contact,
                'general_email': general_email,
                'permanent_address': get_clean_value(row.get('permanent_address')),
                'present_address': get_clean_value(row.get('present_address')),
                'occupation': get_clean_value(row.get('occupation')),
                'gender': get_clean_value(row.get('gender')),
                'marital_status': get_clean_value(row.get('marital_status')),
                'religion': get_clean_value(row.get('religion')),
            })

            dob_str = self.parse_dob(row.get('date_of_birth'))
            if dob_str:
                member_data['date_of_birth'] = dob_str
            elif pd.notna(row.get('date_of_birth')):
                row_errors['date_of_birth'] = "Invalid date format"

            # Validation for member serializer moved outside of dob check, always run
            member_serializer = MemberSerializer(data=member_data, context={'request': request})

            if not member_serializer.is_valid():
                row_errors.update(self.parse_serializer_errors(member_serializer.errors))

            if row_errors:
                temp_errors.append({'row': row_num, 'errors': row_errors})
            else:
                # Parse unit_staff_status to boolean
                staff_status = self.parse_staff_status(row.get('unit_staff_status'))
                
                validated_rows.append({
                    'row_num': row_num,
                    'member_data': member_data,
                    'unit': unit,
                    'unit_staff_status': staff_status
                })

        if temp_errors:
            results['error_count'] = len(temp_errors)
            results['errors'] = temp_errors
            results['success_count'] = 0  # Ensure success_count is 0 when validation fails
            logger.error(f"❌ Validation failed for {len(temp_errors)} rows")
            logger.error(f"❌ Errors: {temp_errors}")
            return Response({
                'status': 'error',
                'message': 'Validation errors found',
                'total_rows': total_rows,
                'success_count': 0,
                'error_count': len(temp_errors),
                'failed_rows': temp_errors,
                'created_staff': []
            }, status=status.HTTP_400_BAD_REQUEST)

        # Step 2: Save only if ALL rows are valid
        try:
            # Group validated rows by unit to track initial staff state per unit
            unit_rows_map = defaultdict(list)
            for item in validated_rows:
                unit_rows_map[item['unit']].append(item)
            
            # Get initial staff state for each unit (before any imports)
            unit_initial_staff_state = {}
            for unit in unit_rows_map.keys():
                current_staff = UnitStaff.objects.filter(
                    unit=unit,
                    is_active=True
                ).select_related('member')
                
                unit_initial_staff_state[unit] = []
                for staff in current_staff:
                    unit_initial_staff_state[unit].append({
                        'staff_id': staff.id,
                        'member_id': staff.member.id,
                        'name': staff.member.full_name,
                        'contact': staff.member.general_contact or '',
                        'email': staff.member.general_email or '',
                        'status': 'Live-in' if staff.unit_staff_status else 'Part-time',
                        'assignment_date': staff.created_at.date().isoformat() if staff.created_at else None
                    })
            
            with transaction.atomic():
                # Track created staff per unit for building history states
                unit_created_staff = defaultdict(list)
                
                for item in validated_rows:
                    try:
                        logger.info(f"💾 Saving row {item['row_num']}")
                        logger.info(f"📝 Member data: {item['member_data']}")
                        
                        member_serializer = MemberSerializer(data=item['member_data'], context={'request': request})
                        if not member_serializer.is_valid():
                            # Get detailed error information
                            error_details = []
                            for field, errors in member_serializer.errors.items():
                                if isinstance(errors, list):
                                    error_details.append(f"{field}: {', '.join(str(e) for e in errors)}")
                                else:
                                    error_details.append(f"{field}: {str(errors)}")
                            error_msg = f"Row {item['row_num']} - Member validation failed: {'; '.join(error_details)}"
                            logger.error(f"❌ {error_msg}")
                            logger.error(f"❌ Member serializer errors: {member_serializer.errors}")
                            raise Exception(error_msg)
                        
                        member = member_serializer.save()
                        member.is_comm_member = True
                        member.comm_member_ever_created = True
                        member.save()

                        staff_data = {
                            'member': member.id,
                            'unit': item['unit'].id,
                            'unit_staff_status': item['unit_staff_status'],
                            'is_active': True,
                            'created_by': current_user_member.id,
                            'updated_by': current_user_member.id
                        }
                        staff_serializer = BulkUnitStaffSerializer(data=staff_data, context={'request': request})
                        if not staff_serializer.is_valid():
                            # Get detailed error information
                            error_details = []
                            for field, errors in staff_serializer.errors.items():
                                if isinstance(errors, list):
                                    error_details.append(f"{field}: {', '.join(str(e) for e in errors)}")
                                else:
                                    error_details.append(f"{field}: {str(errors)}")
                            raise Exception(f"Row {item['row_num']} - Staff validation failed: {'; '.join(error_details)}")
                        
                        unit_staff = staff_serializer.save()
                        results['success_count'] += 1
                        
                        # Track created staff for history entry
                        unit_created_staff[item['unit']].append({
                            'staff': unit_staff,
                            'member': member,
                            'staff_status': item['unit_staff_status']
                        })
                        
                    except Exception as e:
                        # If any row fails during save, raise exception to rollback ALL changes
                        logger.error(f"Error saving row {item['row_num']}: {str(e)}")
                        raise
                
                # Create history entries for all imported staff
                import_time = timezone.now()
                for unit, created_staff_list in unit_created_staff.items():
                    # Build staff_state_before from initial state + previously created staff in this batch
                    staff_state_before = list(unit_initial_staff_state[unit])
                    
                    for created_item in created_staff_list:
                        staff = created_item['staff']
                        member = created_item['member']
                        staff_status = created_item['staff_status']
                        
                        # Build staff_state_after by adding this staff
                        staff_state_after = list(staff_state_before)
                        staff_state_after.append({
                            'staff_id': staff.id,
                            'member_id': member.id,
                            'name': member.full_name,
                            'contact': member.general_contact or '',
                            'email': member.general_email or '',
                            'status': 'Live-in' if staff_status else 'Part-time',
                            'assignment_date': staff.created_at.date().isoformat() if staff.created_at else import_time.date().isoformat()
                        })
                        
                        # Create history entry
                        try:
                            UnitStaffHistory.create_staff_assigned_entry(
                                unit=unit,
                                staff_member=member,
                                staff_status=staff_status,
                                entry_date=staff.created_at or import_time,
                                created_by=current_user_member,
                                staff_state_before=staff_state_before,
                                staff_state_after=staff_state_after
                            )
                            logger.info(f"✅ Created history entry for imported staff: {member.full_name} in unit {unit.unit_name}")
                        except Exception as e:
                            logger.error(f"Error creating staff history entry for imported staff {member.full_name}: {str(e)}")
                            # Don't fail the request if history creation fails
                        
                        # Update before state for next iteration
                        staff_state_before = staff_state_after

                # Create bulk upload summary notifications grouped by unit
                try:
                    from notifications.utils import create_bulk_upload_summary_notification
                    
                    # Create notification for each unit
                    for unit, created_staff_list in unit_created_staff.items():
                        try:
                            create_bulk_upload_summary_notification(
                                unit=unit,
                                count=len(created_staff_list),
                                upload_type='staff',
                                creator=current_user_member
                            )
                        except Exception as e:
                            logger.error(f"Error creating bulk upload notification for unit {unit.unit_name}: {str(e)}")
                            # Don't fail the request if notification creation fails
                except Exception as e:
                    logger.error(f"Error creating bulk upload notifications: {str(e)}")
                    # Don't fail the request if notification creation fails

            return Response({
                'status': 'success',
                'message': f'Successfully created {results["success_count"]} unit staff records',
                'total_rows': total_rows,
                'success_count': results['success_count'],
                'error_count': 0,
                'failed_rows': [],
                'created_staff': []
            }, status=status.HTTP_201_CREATED)
            
        except serializers.ValidationError as e:
            # ValidationError during save - rollback everything
            error_detail = str(e.detail) if hasattr(e, 'detail') else str(e)
            logger.error(f"ValidationError during unit staff bulk upload: {error_detail}")
            return Response({
                'status': 'error',
                'message': 'Transaction failed - No data was saved',
                'total_rows': total_rows,
                'success_count': 0,
                'error_count': total_rows,
                'failed_rows': [{
                    'row': 'All',
                    'errors': {
                        'transaction': error_detail
                    }
                }],
                'created_staff': [],
                'details': error_detail,
                'solution': 'Please fix the errors and try again. Common issues: data too long for fields, invalid format, etc.'
            }, status=status.HTTP_400_BAD_REQUEST)
            
        except Exception as e:
            # Any other error during save - rollback everything
            error_msg = str(e)
            logger.error(f"Exception during unit staff bulk upload: {error_msg}", exc_info=True)
            return Response({
                'status': 'error',
                'message': 'Transaction failed - No data was saved',
                'total_rows': total_rows,
                'success_count': 0,
                'error_count': total_rows,
                'failed_rows': [{
                    'row': 'All',
                    'errors': {
                        'transaction': error_msg
                    }
                }],
                'created_staff': [],
                'details': error_msg,
                'solution': 'Please fix the errors and try again. Common issues: data too long for fields, invalid format, etc.'
            }, status=status.HTTP_400_BAD_REQUEST)


class UnitStaffHistoryAPI(APIView):
    """
    API endpoint to get the staff history of a unit.
    Reads directly from the UnitStaffHistory database table.
    
    Returns a timeline of staff changes with 3 status types:
    1. Staff Assigned - When a staff member is assigned to a unit
    2. Staff Removed - When a staff member is removed from a unit
    3. Staff Status Changed - When a staff member's status (Live-in/Part-time) changes
    """
    
    def get(self, request, unit_id):
        try:
            unit = Unit.objects.select_related('floor__tower').get(id=unit_id)
        except Unit.DoesNotExist:
            return Response(
                {"error": "Unit not found."},
                status=status.HTTP_404_NOT_FOUND
            )
        
        # Get history entries from the dedicated history table
        # Ordered by entry_date descending (newest first)
        history_entries = UnitStaffHistory.objects.filter(
            unit=unit
        ).select_related('staff_member', 'created_by').order_by('-entry_date', '-created_at')
        
        # Transform to API response format
        entries = []
        for entry in history_entries:
            staff_member_data = None
            if entry.staff_member:
                # Use foreign key if still available
                staff_member_data = {
                    'id': entry.staff_member.id,
                    'name': entry.staff_member.full_name,
                    'contact': entry.staff_member.general_contact or '',
                    'email': entry.staff_member.general_email or '',
                }
            elif entry.staff_member_name:
                # Fallback to preserved data if member was deleted
                staff_member_data = {
                    'id': None,
                    'name': entry.staff_member_name,
                    'contact': entry.staff_member_contact or '',
                    'email': entry.staff_member_email or '',
                }
            
            entry_data = {
                'id': str(entry.id),
                'type': entry.entry_type,
                'date': entry.entry_date.isoformat() if entry.entry_date else None,
                'description': entry.description or '',
                'staff_member': staff_member_data,
                'staff_status': 'Live-in' if entry.staff_status else 'Part-time' if entry.staff_status is not None else None,
            }
            
            # Include staff state information
            # Update snapshots with current profile information if staff_member exists
            staff_state_before = entry.staff_state_before or []
            staff_state_after = entry.staff_state_after or []
            
            # If staff_member exists, update snapshots with current profile info
            if entry.staff_member:
                current_name = entry.staff_member.full_name
                current_contact = entry.staff_member.general_contact or ''
                current_email = entry.staff_member.general_email or ''
                member_id = entry.staff_member.id
                
                # Update staff_state_before snapshots
                updated_state_before = []
                for staff_state in staff_state_before:
                    updated_state = staff_state.copy()
                    # If this snapshot entry matches the staff_member, update with current profile info
                    if staff_state.get('member_id') == member_id:
                        updated_state['name'] = current_name
                        updated_state['contact'] = current_contact
                        updated_state['email'] = current_email
                    updated_state_before.append(updated_state)
                
                # Update staff_state_after snapshots
                updated_state_after = []
                for staff_state in staff_state_after:
                    updated_state = staff_state.copy()
                    # If this snapshot entry matches the staff_member, update with current profile info
                    if staff_state.get('member_id') == member_id:
                        updated_state['name'] = current_name
                        updated_state['contact'] = current_contact
                        updated_state['email'] = current_email
                    updated_state_after.append(updated_state)
                
                entry_data['staff_state_before'] = updated_state_before
                entry_data['staff_state_after'] = updated_state_after
            else:
                # If staff_member is deleted, use original snapshots
                entry_data['staff_state_before'] = staff_state_before
                entry_data['staff_state_after'] = staff_state_after
            
            entries.append(entry_data)
        
        return Response({
            'unit': {
                'id': unit.id,
                'unit_name': unit.unit_name,
                'tower_name': unit.floor.tower.tower_name,
                'tower_number': unit.floor.tower.tower_number
            },
            'entries': entries
        }, status=status.HTTP_200_OK)

