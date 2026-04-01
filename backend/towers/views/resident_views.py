
from towers.serializers.resident_serializers import AddExistingUnitStaff,ResidentUpdateSerializer,ResidentSerializer,AddExistingResident,AddExistingOwners,ResidentMemberSerializer,BulkResidentSerializer
from towers.serializers.unitStaff_serializers import UnitStaffSerializer
from user.serializers import MemberSerializer
from django.core.mail import send_mail
from django.conf import settings
from rest_framework import status
from rest_framework.permissions import IsAuthenticated
from rest_framework.exceptions import NotFound
from user.permissions import HasRequiredPermission
# from django.shortcuts import get_object_or_404
from rest_framework.views import APIView
from rest_framework.response import Response
from towers.models import Resident,ResidentDocs,Owner,UnitStaff, Unit,Tower, UnitResidentHistory
from group_role.models import MembersRole
from user.models import Member
from django.http import JsonResponse
import logging
import os
from user.serializers import MemberSerializer
from django.db.models import Q
from audit_trail.create_audit_trail import create_audit_trail
from django.shortcuts import get_object_or_404,get_list_or_404
from django.db import transaction
from django.utils import timezone
from rest_framework import status,serializers
import pandas as pd
from datetime import datetime, date
import re


import math
from backend.utils.errors import flatten_errors

import pandas as pd

logger = logging.getLogger(__name__)
class CreateResident(APIView):
    # permission_classes = [IsAuthenticated, HasRequiredPermission]
    # required_permission_id = [11]
    def post(self, request):
        serializer = ResidentSerializer(data=request.data, context={'request': request})
        if serializer.is_valid():
            resident = serializer.save()
            
            # Record resident history
            try:
                actor = request.user.member if hasattr(request.user, 'member') else Member.objects.get(user=request.user)
                
                # Get current resident state before adding (excluding current if needed)
                current_residents = Resident.objects.filter(
                    unit=resident.unit,
                    is_active=True
                ).select_related('member')
                
                # Build state before (existing residents without the new one)
                resident_state_before = []
                for res in current_residents:
                    if res.id != resident.id:
                        resident_data = UnitResidentHistory.build_resident_data_with_attachments(res, request=request)
                        resident_state_before.append(resident_data)
                
                # Build state after (include the new resident with attachments)
                resident_state_after = list(resident_state_before)
                new_resident_data = UnitResidentHistory.build_resident_data_with_attachments(resident, request=request)
                resident_state_after.append(new_resident_data)
                
                UnitResidentHistory.create_resident_assigned_entry(
                    unit=resident.unit,
                    resident_member=resident.member,
                    is_resident_or_tenant=resident.is_resident_or_tenant,
                    entry_date=resident.created_at or timezone.now(),
                    created_by=actor,
                    resident_state_before=resident_state_before,
                    resident_state_after=resident_state_after
                )
            except Exception as e:
                logger.error(f"Error creating resident history entry: {str(e)}")
            
            # Create notifications for managers with "View Unit Resident" permission
            try:
                from notifications.utils import create_resident_added_notification
                create_resident_added_notification(resident, creator=actor)
            except Exception as e:
                logger.error(f"Error creating resident notifications: {str(e)}")
                # Don't fail the request if notification creation fails
            
            # Create notification for the user if they added themselves
            if actor and resident.member.id == actor.id:
                try:
                    from notifications.utils import create_resident_added_self_notification
                    create_resident_added_self_notification(resident)
                except Exception as e:
                    logger.error(f"Error creating self-resident notification: {str(e)}")
                    # Don't fail the request if notification creation fails

            return Response(
                {"message": "Resident created successfully", "data": serializer.data},
                status=status.HTTP_201_CREATED
            )
        # The serializer.errors will now include our custom duplicate email error message.
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
    

# class AddExtingMemberForResident(APIView):
#     def get(self, request, format=None):
#         # Retrieve all residents
#         owners = Owner.objects.all()
#         owner_serializer = AddExistingMemberForResident(owners, many=True)
        
#         # Retrieve all members whose is_org_member field is True (1)
#         org_members = Member.objects.filter(is_org_member=True)
#         org_member_serializer = MemberSerializer(org_members, many=True)
        
#         # Return both lists in a combined response
#         return Response({
#             "owners": owner_serializer.data,
#             "org_members": org_member_serializer.data,
#         })


class AddExistingMemberView(APIView):
    """
    API view that returns owners, organization members, and resident members.
    """

    def get(self, request, format=None):
        # Retrieve all owners and serialize them
        owners = Owner.objects.all()
        owner_serializer = AddExistingOwners(owners, many=True)
        
        # Retrieve organization members (those with is_org_member True) and serialize them
        org_members = Member.objects.filter(is_org_member=True)
        org_member_serializer = MemberSerializer(org_members, many=True)
        
        # Retrieve resident records (distinct by member id)
        residents_qs = Resident.objects.all().order_by('id')
        seen_member_ids = set()
        distinct_residents = []
        for resident in residents_qs:
            if resident.member.id not in seen_member_ids:
                seen_member_ids.add(resident.member.id)
                distinct_residents.append(resident)
                
        resident_serializer = AddExistingResident(distinct_residents, many=True)

        unit_staff = UnitStaff.objects.all()
        unit_staff_serializer = AddExistingUnitStaff(unit_staff, many=True)
        # Return the combined response
        return Response({
            "owners": owner_serializer.data,
            "org_members": org_member_serializer.data,
            "resident_members": resident_serializer.data,
            "unit_staff": unit_staff_serializer.data
        })

# class ListSearchSort(APIView):
#     def get(self, request):
       
#         # Expecting member_type to be a list that may include numeric ids and/or the string "owner"
#         member_type_filters = request.GET.getlist('member_type', [])
        
#         # Determine if 'owner' filter is applied and extract numeric member type ids
#         owner_selected = "owner" in member_type_filters
#         numeric_member_type_ids = []
#         for mt in member_type_filters:
#             if mt != "owner":
#                 try:
#                     numeric_member_type_ids.append(int(mt))
#                 except ValueError:
#                     logger.warning(f"Invalid member_type value skipped: {mt}")  
        
#         # ===== Initialize Querysets =====
#         member_type_members = Member.objects.none()
#         owner_members = Member.objects.none()
        
#         # ===== Apply Numeric Member Type Filter =====
#         if numeric_member_type_ids:
#             member_type_members = Member.objects.filter(member_type__id__in=numeric_member_type_ids)
        
#         # ===== Apply Owner Filter =====
#         if owner_selected:
#             owner_member_ids = Owner.objects.values_list('member', flat=True).distinct()
#             owner_members = Member.objects.filter(id__in=owner_member_ids)
        
#         # ===== If No Filters, Return All Owners and Org Members =====
#         if not member_type_filters:
#             all_owners = Owner.objects.all()
#             owners_serializer = AddExistingMemberForResident(all_owners, many=True)
    
#             org_members = Member.objects.filter(is_org_member=True)
#             org_members_serializer = MemberSerializer(org_members, many=True, context={'request': request})
    
#             return Response({
#                 "owners": owners_serializer.data,
#                 "org_members": org_members_serializer.data
#             })
        
#         # ===== Serialize Filtered Results =====
#         member_type_serializer = MemberSerializer(member_type_members, many=True, context={'request': request})
#         owner_serializer = MemberSerializer(owner_members, many=True, context={'request': request})
        
#         # ===== Return Filtered Response =====
#         return Response({
#             "org_members": member_type_serializer.data,
#             "owners": owner_serializer.data

#         })
class ResidentMemberList(APIView):
    # permission_classes = [IsAuthenticated]

    def get(self, request, unit_pk):

        residents = Resident.objects.select_related('member', 'unit').filter(
            unit__id=unit_pk,
            is_active=True,
            member__is_comm_member=True  # Only include active community members
        )
        serializer = ResidentMemberSerializer(residents, many=True)
        print('Filtered residents count:', len(serializer.data))
        return Response(serializer.data)
      
class ResidentDetails(APIView):
    # permission_classes = [IsAuthenticated]
    def get(self, request, unit_id, resident_id):
        try:
            # Filter using the resident's primary key and its associated unit
            resident = Resident.objects.get(id=resident_id, unit__id=unit_id)
        except Resident.DoesNotExist:
            return Response(
                {"error": "Resident not found for the specified unit and resident id."},
                status=status.HTTP_404_NOT_FOUND
            )

        serializer = ResidentSerializer(resident)
        return Response(serializer.data, status=status.HTTP_200_OK)
    
class ResidentInfoEdit(APIView):
    permission_classes = [IsAuthenticated, HasRequiredPermission]
    required_permission_id = [20]  # EDIT_RESIDENT_INFO permission

    def put(self, request, resident_id):
        try:
            resident = Resident.objects.select_related('unit', 'member').prefetch_related('docs').get(id=resident_id)
        except Resident.DoesNotExist:
            return Response({"error": "Resident not found."}, status=status.HTTP_404_NOT_FOUND)
        
        # Capture old values before any changes
        old_status = resident.is_resident_or_tenant
        old_rent = resident.unit_rent_fee
        old_advance = resident.advance_payment
        old_notice_period = resident.notice_period
        old_doc_count = resident.docs.count()
        
        # Capture old Member values
        old_name = resident.member.full_name
        old_contact = resident.member.general_contact
        old_email = resident.member.general_email
        
        new_status = request.data.get('is_resident_or_tenant', old_status)
        
        serializer = ResidentUpdateSerializer(instance=resident, data=request.data, partial=True, context={'request': request})
        if serializer.is_valid():
            updated_resident = serializer.save()
            
            # Detect specific field changes
            new_rent = updated_resident.unit_rent_fee
            new_advance = updated_resident.advance_payment
            new_notice_period = updated_resident.notice_period
            new_doc_count = updated_resident.docs.count()
            
            # Detect Member field changes
            new_name = updated_resident.member.full_name
            new_contact = updated_resident.member.general_contact
            new_email = updated_resident.member.general_email
            
            # Check for removed documents
            import json
            removed_doc_ids = request.data.get('removed_doc_ids', [])
            if isinstance(removed_doc_ids, str):
                try:
                    removed_doc_ids = json.loads(removed_doc_ids)
                except json.JSONDecodeError:
                    removed_doc_ids = []
            
            # Check for new documents
            new_docs = request.FILES.getlist('docs', [])
            docs_added = len(new_docs)
            docs_removed = len(removed_doc_ids) if isinstance(removed_doc_ids, list) else 0
            
            # Build detailed change description
            # Note: Attachment changes are NOT included here because the serializer
            # creates individual attachment entries (attachment_added/attachment_removed)
            # to avoid duplicate entries in the history
            changes = []
            if old_rent != new_rent:
                changes.append(f"Rent amount changed from BDT {old_rent:,.2f} to BDT {new_rent:,.2f}")
            if old_advance != new_advance:
                changes.append(f"Advance payment updated from BDT {old_advance:,.2f} to BDT {new_advance:,.2f}")
            if old_notice_period != new_notice_period:
                changes.append(f"Notice period changed from {old_notice_period} month(s) to {new_notice_period} month(s)")
            # Attachment changes are handled separately by the serializer with individual entries
            
            # General Info Changes
            if old_name != new_name:
                changes.append(f"Name changed from '{old_name}' to '{new_name}'")
            if old_contact != new_contact:
                changes.append(f"Contact changed from '{old_contact}' to '{new_contact}'")
            if old_email != new_email:
                changes.append(f"Email changed from '{old_email}' to '{new_email}'")
            
            # Record history
            try:
                actor = request.user.member if hasattr(request.user, 'member') else Member.objects.get(user=request.user)
                
                # Capture current unit state
                current_residents = Resident.objects.filter(
                    unit=updated_resident.unit,
                    is_active=True
                ).select_related('member').prefetch_related('docs')
                
                # Helper function to build resident state with financial fields, attachments, and member override
                def build_resident_state(residents_qs, use_old_values_for_id=None, old_values=None):
                    state = []
                    for res in residents_qs:
                        # Build base resident data with attachments
                        resident_data = UnitResidentHistory.build_resident_data_with_attachments(res, request=request)
                        
                        # Use old values if this is the updated resident and old values are provided
                        if use_old_values_for_id and res.id == use_old_values_for_id and old_values:
                            resident_data.update({
                                'name': old_values.get('name', res.member.full_name),
                                'contact': old_values.get('contact', res.member.general_contact or ''),
                                'email': old_values.get('email', res.member.general_email or ''),
                                'is_resident_or_tenant': old_values.get('status', res.is_resident_or_tenant),
                                'status_label': 'Resident' if old_values.get('status', res.is_resident_or_tenant) else 'Tenant',
                                'unit_rent_fee': old_values.get('rent', res.unit_rent_fee),
                                'advance_payment': old_values.get('advance', res.advance_payment),
                                'notice_period': old_values.get('notice_period', res.notice_period),
                            })
                            # For old values, we might not have attachments, so keep them from the current state
                            # or remove them if we want to show state before attachment changes
                        
                        state.append(resident_data)
                    return state
                
                # State before the change (with old values)
                old_values = {
                    'status': old_status,
                    'rent': old_rent,
                    'advance': old_advance,
                    'notice_period': old_notice_period,
                    'doc_count': old_doc_count,
                    'name': old_name,
                    'contact': old_contact,
                    'email': old_email
                }
                resident_state_before = build_resident_state(
                    current_residents, 
                    use_old_values_for_id=updated_resident.id,
                    old_values=old_values
                )
                
                # State after the change (with current values)
                resident_state_after = build_resident_state(current_residents)

                if old_status != updated_resident.is_resident_or_tenant:
                    # Status change (Resident <-> Tenant)
                    UnitResidentHistory.create_resident_status_changed_entry(
                        unit=updated_resident.unit,
                        resident_member=updated_resident.member,
                        old_status=old_status,
                        new_status=updated_resident.is_resident_or_tenant,
                        entry_date=timezone.now(),
                        created_by=actor,
                        resident_state_before=resident_state_before,
                        resident_state_after=resident_state_after
                    )
                else:
                    # Only create general info update entry if there are non-attachment changes
                    # Attachment changes are handled separately by the serializer with individual entries
                    # Explicitly check that we're not only changing attachments
                    has_attachment_only_changes = (docs_added > 0 or docs_removed > 0) and len(changes) == 0
                    
                    if changes and not has_attachment_only_changes:
                        description = " | ".join(changes)
                        # General info update with detailed change tracking
                        UnitResidentHistory.create_resident_info_updated_entry(
                            unit=updated_resident.unit,
                            resident_member=updated_resident.member,
                            entry_date=timezone.now(),
                            description=description,
                            created_by=actor,
                            resident_state_before=resident_state_before,
                            resident_state_after=resident_state_after
                        )
                    # If only attachments changed (no other changes), individual attachment entries
                    # from the serializer are sufficient, so we skip the general entry
            except Exception as e:
                logger.error(f"Error creating resident history entry: {str(e)}")
            
            # Create notification for the user if they changed themselves
            if actor and updated_resident.member.id == actor.id:
                try:
                    from notifications.utils import create_resident_changed_self_notification
                    create_resident_changed_self_notification(updated_resident, changes=changes)
                except Exception as e:
                    logger.error(f"Error creating self-resident change notification: {str(e)}")
                    # Don't fail the request if notification creation fails

            return Response(serializer.data, status=status.HTTP_200_OK)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
    
 
class InactivateResidents(APIView):
    # permission_classes = [IsAuthenticated]   
    def post(self, request, *args, **kwargs):
        resident_ids = request.data.get('resident_ids', [])
        if not resident_ids or not isinstance(resident_ids, list):
            return Response({"error": "resident_ids must be provided as a list."}, status=status.HTTP_400_BAD_REQUEST)

        updated_count = 0
        for res_id in resident_ids:
            try:
                resident = Resident.objects.get(id=res_id)
                 
                if resident.is_active:
                    resident.is_active = False
                    resident.save()
                    updated_count += 1

                    # Record history for inactivation (removal from active status)
                    try:
                        actor = request.user.member if hasattr(request.user, 'member') else Member.objects.get(user=request.user)
                        
                        current_residents = Resident.objects.filter(
                            unit=resident.unit,
                            is_active=True
                        ).select_related('member')
                        
                        resident_state_before = []
                        # Since we just saved resident.is_active = False, it won't be in current_residents
                        # But we want the state including the one we just removed for 'before'
                        
                        # Fetch all including inactive briefly or just rebuild from current + the one we just inactivated
                        for res in current_residents:
                            resident_state_before.append({
                                'resident_id': res.id,
                                'member_id': res.member.id,
                                'name': res.member.full_name,
                                'contact': res.member.general_contact or '',
                                'email': res.member.general_email or '',
                                'is_resident_or_tenant': res.is_resident_or_tenant,
                                'status_label': 'Resident' if res.is_resident_or_tenant else 'Tenant',
                                'assignment_date': res.created_at.date().isoformat() if res.created_at else None
                            })
                        
                        # The one we inactivated was 'before' but is not 'after'
                        resident_state_before.append({
                            'resident_id': resident.id,
                            'member_id': resident.member.id,
                            'name': resident.member.full_name,
                            'contact': resident.member.general_contact or '',
                            'email': resident.member.general_email or '',
                            'is_resident_or_tenant': resident.is_resident_or_tenant,
                            'status_label': 'Resident' if resident.is_resident_or_tenant else 'Tenant',
                            'assignment_date': resident.created_at.date().isoformat() if resident.created_at else None
                        })
                        
                        # State after is just the current_residents
                        resident_state_after = [
                            res for res in resident_state_before 
                            if res.get('resident_id') != resident.id
                        ]
                        
                        UnitResidentHistory.create_resident_removed_entry(
                            unit=resident.unit,
                            resident_member=resident.member,
                            entry_date=timezone.now(),
                            created_by=actor,
                            resident_state_before=resident_state_before,
                            resident_state_after=resident_state_after,
                            is_resident_or_tenant=resident.is_resident_or_tenant
                        )
                    except Exception as e:
                        logger.error(f"Error creating resident inactivation history entry: {str(e)}")

                    # Send email notification to the resident's general email.
                    recipient_email = resident.member.general_email
                    subject = "Account Deactivation"
                    message = "Your account has been deactivated."
                    send_mail(
                        subject,
                        message,
                        settings.EMAIL_HOST_USER,
                        [recipient_email],
                        fail_silently=False
                    )
                    
                    # Create notification for the user if they removed themselves
                    if actor and resident.member.id == actor.id:
                        try:
                            from notifications.utils import create_resident_removed_self_notification
                            create_resident_removed_self_notification(resident, resident.unit)
                        except Exception as e:
                            logger.error(f"Error creating self-resident removal notification: {str(e)}")
                            # Don't fail the request if notification creation fails
            except Resident.DoesNotExist:
                logger.warning(f"Resident  not found.")
                continue
        
        return Response({"message": f"{updated_count} resident(s) inactivated successfully."}, status=status.HTTP_200_OK)
    


class BulkDeleteResident(APIView):
    permission_classes = [IsAuthenticated, HasRequiredPermission]
    required_permission_id = [20]  # EDIT_RESIDENT_INFO permission (covers deletion)

    def delete(self, request, *args, **kwargs):
        """
        Bulk delete Resident records.
        Expects in request.data:
        - ids (list[int]): list of Resident IDs to delete
        """
        ids = request.data.get('ids')

        if not isinstance(ids, list) or not ids:
            return Response(
                {"error": "A non-empty list of 'ids' is required."},
                status=status.HTTP_400_BAD_REQUEST
            )

        try:
            actor = request.user.member if hasattr(request.user, 'member') else Member.objects.get(user=request.user)
        except Member.DoesNotExist:
            return Response(
                {"error": "Requesting user is not linked to a Member."},
                status=status.HTTP_400_BAD_REQUEST
            )

        resident_qs = get_list_or_404(Resident, id__in=ids)
        affected_members = set()
        
        # Collect all resident info for bulk notification (before deletion)
        resident_info_list = []

        with transaction.atomic():
            for resident in resident_qs:
                affected_members.add(resident.member.id)
                
                # Collect resident info for bulk notification
                resident_info_list.append({
                    'id': resident.id,
                    'name': resident.member.full_name,
                    'member_id': resident.member.id,
                    'unit': resident.unit
                })

                # Create resident history entry before deletion
                try:
                    current_residents = Resident.objects.filter(
                        unit=resident.unit,
                        is_active=True
                    ).select_related('member')
                    
                    resident_state_before = []
                    is_in_current = False
                    for res in current_residents:
                        if res.id == resident.id:
                            is_in_current = True
                        resident_state_before.append({
                            'resident_id': res.id,
                            'member_id': res.member.id,
                            'name': res.member.full_name,
                            'contact': res.member.general_contact or '',
                            'email': res.member.general_email or '',
                            'is_resident_or_tenant': res.is_resident_or_tenant,
                            'status_label': 'Resident' if res.is_resident_or_tenant else 'Tenant',
                            'assignment_date': res.created_at.date().isoformat() if res.created_at else None
                        })
                    
                    # If the resident being deleted was not active, it wasn't in current_residents
                    # but we still want it in resident_state_before for the removal entry
                    if not is_in_current:
                        resident_state_before.append({
                            'resident_id': resident.id,
                            'member_id': resident.member.id,
                            'name': resident.member.full_name,
                            'contact': resident.member.general_contact or '',
                            'email': resident.member.general_email or '',
                            'is_resident_or_tenant': resident.is_resident_or_tenant,
                            'status_label': 'Resident' if resident.is_resident_or_tenant else 'Tenant',
                            'assignment_date': resident.created_at.date().isoformat() if resident.created_at else None
                        })
                    
                    # State after deletion
                    resident_state_after = [
                        res for res in resident_state_before 
                        if res.get('resident_id') != resident.id
                    ]
                    
                    UnitResidentHistory.create_resident_removed_entry(
                        unit=resident.unit,
                        resident_member=resident.member,
                        entry_date=timezone.now(),
                        created_by=actor,
                        resident_state_before=resident_state_before,
                        resident_state_after=resident_state_after,
                        is_resident_or_tenant=resident.is_resident_or_tenant
                    )
                except Exception as e:
                    logger.error(f"Error creating resident removal history entry: {str(e)}")

                # Optional: Audit trail logging
                create_audit_trail(
                    member=actor,
                    event_type='RESIDENT_DELETED',
                    table_name='Resident',
                    row_id=resident.id,
                    old_data={"is_active": resident.is_active},
                    new_data={"deleted": True},
                    description=f"Resident id={resident.id} deleted."
                )

                # Create notification for the user if they removed themselves
                if actor and resident.member.id == actor.id:
                    try:
                        from notifications.utils import create_resident_removed_self_notification
                        create_resident_removed_self_notification(resident, resident.unit)
                    except Exception as e:
                        logger.error(f"Error creating self-resident removal notification: {str(e)}")
                        # Don't fail the request if notification creation fails
                
                # Delete the resident entry
                resident.delete()
            
            # Create bulk notification after all deletions (one aggregated notification per unit)
            if resident_info_list:
                try:
                    from notifications.utils import create_bulk_resident_removed_notification
                    create_bulk_resident_removed_notification(resident_info_list, remover=actor)
                except Exception as e:
                    logger.error(f"Error creating bulk resident removal notifications: {str(e)}")
                    # Don't fail the request if notification creation fails
                
            unit_id = request.data.get('unit_id')
            resident_exists = Resident.objects.filter(unit_id=unit_id).exists()
            # print(resident_exists)
            if not resident_exists:
                # owner = Owner.objects.filter(unit_id=unit_id).exists()
                # if not owner:
                unit = Unit.objects.get(id=unit_id.id if hasattr(unit_id, 'id') else unit_id)
                # print(unit)
                unit.unit_status = 'available'
                unit.status_color = unit.STATUS_COLORS['available']
                unit.save()
        # Optional: Log the deletion of affected members
            # Update or delete affected members
            # for member_id in affected_members:
            #     still_exists = (
            #         Resident.objects.filter(member_id=member_id, is_active=True).exists() or
            #         UnitStaff.objects.filter(member_id=member_id, is_active=True).exists() or
            #         Owner.objects.filter(member_id=member_id).exists()
            #     )
            #     if not still_exists:
            #         Member.objects.filter(id=member_id).delete()
            for member_id in affected_members:
                still_exists = (
                    Resident.objects.filter(member_id=member_id, is_active=True).exists() or
                    UnitStaff.objects.filter(member_id=member_id, is_active=True).exists() or
                    Owner.objects.filter(member_id=member_id).exists()
                )
                if not still_exists:
                    # Fixed: Correct field reference using double underscore
                    MembersRole.objects.filter(member__id=member_id).delete()

                    # Now delete the member
                    Member.objects.filter(id=member_id, org_member_ever_created=False).delete()



        return Response(
            {"message": f"{len(resident_qs)} Residents deleted successfully."},
            status=status.HTTP_200_OK
        )






class CommMemberList(APIView):
    def get(self, request, format=None):
        # existing “array” filters
        types    = request.query_params.getlist('type')    # e.g. ['owner','resident']
        towers   = request.query_params.getlist('tower')
        units    = request.query_params.getlist('unit')
        statuses = request.query_params.getlist('status')
        # NEW: single‐value search box
        search = request.query_params.get('search', '').strip()

        # Log filter parameters for debugging
        logger.info(f"CommMemberList filters - types: {types}, towers: {towers}, units: {units}, statuses: {statuses}, search: '{search}'")
        
        # Additional logging for tower-unit filtering
        if towers and units:
            logger.info(f"Tower-Unit filtering: Selected towers {towers} with units {units}")
            logger.info(f"This should only return units {units} from towers {towers}")

        def apply_common_filters(qs, member_field):
            # Apply tower filter first - this restricts the scope to specific towers
            if towers:
                qs = qs.filter(unit__floor__tower__tower_name__in=towers)
            
            # Apply unit filter - this will only match units within the already-filtered towers
            # This ensures that if towers A, B, C are selected and unit "101" is selected,
            # only units named "101" from towers A, B, C will be returned
            if units:
                qs = qs.filter(unit__unit_name__in=units)
            
            # Apply status filter
            if statuses:
                bools = [(s.lower() == "active") for s in statuses]
                qs = qs.filter(**{f"{member_field}__is_comm_member__in": bools})

            # Apply search filter when user typed ≥ 3 chars
            if len(search) >= 3:
                qs = qs.filter(
                    Q(**{f"{member_field}__full_name__icontains": search}) |
                    Q(**{f"{member_field}__general_email__icontains": search})
                )
            return qs

        result = {}
        wants_owner    = not types or 'owner'    in types
        wants_resident = not types or 'resident' in types
        wants_resident_tenant = not types or 'resident_tenant' in types
        wants_staff    = not types or 'staff'    in types

        if wants_owner:
            owners_qs = apply_common_filters(Owner.objects.all(), 'member')
            result["owners"] = AddExistingOwners(owners_qs, many=True).data

        # Handle regular residents (is_resident_or_tenant = True)
        if wants_resident:
            residents_qs = apply_common_filters(
                Resident.objects.filter(is_active=True, is_resident_or_tenant=True), 
                'member'
            ).order_by('id')
            result["resident_members"] = AddExistingResident(residents_qs, many=True).data

        # Handle tenants (is_resident_or_tenant = False)
        if wants_resident_tenant:
            tenant_qs = apply_common_filters(
                Resident.objects.filter(is_active=True, is_resident_or_tenant=False), 
                'member'
            ).order_by('id')
            # Use the same serializer but store in a separate key for clarity
            tenant_data = AddExistingResident(tenant_qs, many=True).data
            # Append to resident_members if resident is also selected, otherwise create new key
            if wants_resident:
                # If resident was already added, append tenant data
                existing_residents = result.get("resident_members", [])
                result["resident_members"] = existing_residents + tenant_data
            else:
                # If only tenant is selected, set resident_members to tenant data only
                result["resident_members"] = tenant_data

        if wants_staff:
            staff_qs = apply_common_filters(UnitStaff.objects.filter(is_active=True), 'member')
            # staff_qs = apply_common_filters(UnitStaff.objects.all(), 'member')
            result["unit_staff"] = AddExistingUnitStaff(staff_qs, many=True).data

        # Log result counts for debugging
        total_count = sum(len(data) for data in result.values())
        logger.info(f"CommMemberList result - total members: {total_count}, breakdown: {dict((k, len(v)) for k, v in result.items())}")
        
        # Add additional metadata about the filtering for debugging
        response_data = {
            'data': result,
            'filter_info': {
                'applied_towers': towers,
                'applied_units': units,
                'applied_types': types,
                'applied_statuses': statuses,
                'search_term': search,
                'total_members': total_count
            }
        }
        
        return Response(response_data)
    






    

# class ResidentBulkUploadView(APIView):
#     permission_classes = [IsAuthenticated]

#     def post(self, request, *args, **kwargs):
#         file = request.FILES.get('file')
#         if not file:
#             return Response({'error': 'No file uploaded'}, status=status.HTTP_400_BAD_REQUEST)

#         # 1) Read file
#         try:
#             if file.name.lower().endswith('.csv'):
#                 df = pd.read_csv(file)
#             else:
#                 df = pd.read_excel(file)
#         except Exception as e:
#             return Response({'error': f'File read error: {e}'}, status=status.HTTP_400_BAD_REQUEST)

#         # ─── Normalize nid_number: NaN→'' and strip any trailing .0 ───
#         def fmt_nid(cell):
#             if pd.isna(cell):
#                 return ''
#             if isinstance(cell, float):
#                 if cell.is_integer():
#                     return str(int(cell))
#                 return str(cell).strip()
#             return str(cell).strip()

#         df['nid_number'] = df.get('nid_number', pd.Series()).apply(fmt_nid)

#         # # Debug print
#         # print("\n=== Excel Data Preview ===")
#         # print(df.to_string(index=False))
#         # print("==========================\n")

#         preview = df.fillna('').head(5).to_dict(orient='records')

#         # 2) Required columns
#         required = ['unit', 'full_name', 'general_contact', 'delivery_method']
#         missing = [c for c in required if c not in df.columns]
#         if missing:
#             return Response({
#                 'error': f"Missing fields: {', '.join(missing)}",
#                 'preview': preview
#             }, status=status.HTTP_400_BAD_REQUEST)

#         results = {
#             'total_rows': len(df),
#             'success_count': 0,
#             'error_count': 0,
#             'errors': [],
#             'preview': preview
#         }

#         # 3) Process rows
#         with transaction.atomic():
#             for idx, row in df.iterrows():
#                 try:
#                     with transaction.atomic():
#                         # format contact (untouched)
#                         contact = str(row['general_contact']).strip()
#                         if len(contact) == 10:
#                             contact = '0' + contact
#                         elif len(contact) == 11 and not contact.startswith('0'):
#                             contact = '0' + contact[1:]

#                         nid_str = row['nid_number']  # এখন '909434319' or ''

#                         # build member_data
#                         member_data = {
#                             'full_name': row['full_name'],
#                             'general_contact': contact,
#                             'general_email': row.get('general_email', '') or '',
#                             'delivery_method': row['delivery_method'],
#                         }
#                         if nid_str:
#                             member_data['nid_number'] = nid_str

#                         # validate member
#                         mem_ser = MemberSerializer(data=member_data, context={'request': request})
#                         mem_ser.is_valid(raise_exception=True)

#                         # duplicate check
#                         if nid_str and Member.objects.filter(nid_number=nid_str).exists():
#                             raise serializers.ValidationError({'nid_number': 'This NID number is already in use.'})

#                         member = mem_ser.save()
#                         member.is_comm_member = True
#                         member.comm_member_ever_created = True
#                         member.save()

#                         # fetch unit
#                         unit = Unit.objects.filter(id=row['unit']).first()
#                         if not unit:
#                             raise Exception(f"Unit {row['unit']} not found")

#                         # build & save resident
#                         resident_data = {
#                             'member': member.id,
#                             'unit': unit.id,
#                             'unit_rent_fee': float(row.get('unit_rent_fee') or 0),
#                             'advance_payment': float(row.get('advance_payment') or 0),
#                             'notice_period': int(row.get('notice_period') or 1),
#                             'is_resident_or_tenant': bool(row.get('is_resident_or_tenant', True)),
#                         }
#                         res_ser = BulkResidentSerializer(data=resident_data, context={'request': request})
#                         res_ser.is_valid(raise_exception=True)
#                         res_ser.save()

#                         unit.unit_status = 'occupied'
#                         unit.status_color = unit.STATUS_COLORS['occupied']
#                         unit.save()

#                         results['success_count'] += 1

#                 except Exception as e:
#                     msg = f"Row {idx + 2} failed: {e}"
#                     results['error_count'] += 1
#                     results['errors'].append(msg)
#                     raise

#         return Response({'message': 'Bulk upload completed', 'results': results}, status=status.HTTP_200_OK)



def sanitize_data(data):
    if isinstance(data, dict):
        return {k: sanitize_data(v) for k, v in data.items()}
    elif isinstance(data, list):
        return [sanitize_data(item) for item in data]
    elif isinstance(data, float):
        if math.isnan(data) or math.isinf(data):
            return None
        return data
    return data


# class ResidentBulkUploadView(APIView):
#     permission_classes = [IsAuthenticated]

#     def post(self, request, *args, **kwargs):
#         file = request.FILES.get('file')
#         if not file:
#             return Response({'error': 'No file uploaded'}, status=status.HTTP_400_BAD_REQUEST)

#         try:
#             if file.name.lower().endswith('.csv'):
#                 df = pd.read_csv(file)
#             else:
#                 df = pd.read_excel(file)
#         except Exception as e:
#             return Response({'error': f'File read error: {e}'}, status=status.HTTP_400_BAD_REQUEST)

#         # Normalize NID
#         def fmt_nid(cell):
#             if pd.isna(cell):
#                 return ''
#             if isinstance(cell, float):
#                 return str(int(cell)) if cell.is_integer() else str(cell).strip()
#             return str(cell).strip()

#         df['nid_number'] = df.get('nid_number', pd.Series()).apply(fmt_nid)

#         preview = df.fillna('').head(5).to_dict(orient='records')

#         # Required fields
#         required = ['unit', 'full_name', 'general_contact', 'delivery_method']
#         missing = [c for c in required if c not in df.columns]
#         if missing:
#             return Response({
#                 'error': f"Missing fields: {', '.join(missing)}",
#                 'preview': preview
#             }, status=status.HTTP_400_BAD_REQUEST)

#         results = {
#             'total_rows': len(df),
#             'success_count': 0,
#             'error_count': 0,
#             'errors': [],
#             'preview': preview
#         }

#         try:
#             with transaction.atomic():
#                 for idx, row in df.iterrows():
#                     try:
#                         with transaction.atomic():
#                             # Format contact
#                             contact = str(row['general_contact']).strip()
#                             if len(contact) == 10:
#                                 contact = '0' + contact
#                             elif len(contact) == 11 and not contact.startswith('0'):
#                                 contact = '0' + contact[1:]

#                             nid_str = row.get('nid_number', '')

#                             # Base member data
#                             member_data = {
#                                 'full_name': row['full_name'],
#                                 'general_contact': contact,
#                                 'general_email': row.get('general_email', '') or '',
#                                 'delivery_method': row['delivery_method'],
#                             }
#                             if nid_str:
#                                 member_data['nid_number'] = nid_str

#                             # Optional fields
#                             optional_fields = [
#                                 'permanent_address', 'present_address',
#                                 'date_of_birth', 'occupation', 'gender','marital_status' ,'religion'                         ]
#                             for field in optional_fields:
#                                 val = row.get(field, '')
#                                 if pd.notna(val):
#                                     member_data[field] = val

#                             # Validate member
#                             mem_ser = MemberSerializer(data=member_data, context={'request': request})
#                             mem_ser.is_valid(raise_exception=True)

#                             if nid_str and Member.objects.filter(nid_number=nid_str).exists():
#                                 raise serializers.ValidationError({'nid_number': 'This NID number is already in use.'})

#                             member = mem_ser.save()
#                             member.is_comm_member = True
#                             member.comm_member_ever_created = True
#                             member.save()

#                             # Fetch unit
#                             unit = Unit.objects.filter(id=row['unit']).first()
#                             if not unit:
#                                 raise Exception(f"Unit {row['unit']} not found")

#                             # Build & save resident
#                             resident_data = {
#                                 'member': member.id,
#                                 'unit': unit.id,
#                                 'unit_rent_fee': float(row.get('unit_rent_fee') or 0),
#                                 'advance_payment': float(row.get('advance_payment') or 0),
#                                 'notice_period': int(row.get('notice_period') or 1),
#                                 'is_resident_or_tenant': bool(row.get('is_resident_or_tenant', True)),
#                             }
#                             res_ser = BulkResidentSerializer(data=resident_data, context={'request': request})
#                             res_ser.is_valid(raise_exception=True)
#                             res_ser.save()

#                             unit.unit_status = 'occupied'
#                             unit.status_color = unit.STATUS_COLORS['occupied']
#                             unit.save()

#                             results['success_count'] += 1

#                     except Exception as e:
#                         msg = f"Row {idx + 2} failed: {str(e)}"
#                         results['error_count'] += 1
#                         results['errors'].append({'row': idx + 2, 'error': str(e)})
#                         raise

#         except Exception:
#             # Whole transaction rolled back
#             return Response({
#                 'message': 'Upload failed due to errors',
#                 'results': sanitize_data(results)
#             }, status=status.HTTP_400_BAD_REQUEST)

#         return Response({
#             'message': 'Bulk upload completed',
#             'results': sanitize_data(results)
#         }, status=status.HTTP_200_OK)from datetime import datetime


# class ResidentBulkUploadView(APIView):
#     permission_classes = [IsAuthenticated]

#     def sanitize_data(self, data):
#         if isinstance(data, dict):
#             return {k: self.sanitize_data(v) for k, v in data.items()}
#         elif isinstance(data, list):
#             return [self.sanitize_data(item) for item in data]
#         elif isinstance(data, float):
#             if math.isnan(data) or math.isinf(data):
#                 return None
#             return data
#         return data

#     def parse_contact(self, contact):
#         contact = str(contact).strip()
#         if len(contact) == 10:
#             return '0' + contact
#         elif len(contact) == 11 and not contact.startswith('0'):
#             return '0' + contact[1:]
#         return contact

#     def parse_int(self, val):
#         try:
#             return int(float(val))
#         except (ValueError, TypeError):
#             return None

#     def post(self, request):
#         file = request.FILES.get('file')
#         if not file:
#             return Response({'error': 'No file uploaded'}, status=status.HTTP_400_BAD_REQUEST)

#         try:
#             df = pd.read_csv(file) if file.name.endswith('.csv') else pd.read_excel(file)
#         except Exception as e:
#             return Response({'error': f'File read error: {e}'}, status=status.HTTP_400_BAD_REQUEST)

#         df.columns = df.columns.str.strip().str.lower()
#         preview = df.fillna('').head(5).to_dict(orient='records')

#         required_fields = ['tower_name', 'tower_number', 'unit_name', 'full_name', 'general_contact', 'general_email']
#         missing = [c for c in required_fields if c not in df.columns]
#         if missing:
#             return Response({
#                 'error': f"Missing fields: {', '.join(missing)}",
#                 'preview': preview
#             }, status=status.HTTP_400_BAD_REQUEST)

#         results = {
#             'total_rows': len(df),
#             'success_count': 0,
#             'error_count': 0,
#             'errors': [],
#             'preview': preview
#         }

#         try:
#             with transaction.atomic():
#                 for idx, row in df.iterrows():
#                     row_errors = {}
#                     row_num = idx + 2

#                     # Validate tower/unit fields
#                     tower_name = str(row.get('tower_name')).strip() if not pd.isna(row.get('tower_name')) else None
#                     if not tower_name:
#                         row_errors['tower_name'] = "Required field"

#                     tower_number = self.parse_int(row.get('tower_number'))
#                     if tower_number is None:
#                         row_errors['tower_number'] = "Invalid tower number"

#                     unit_name = str(row.get('unit_name')).strip() if not pd.isna(row.get('unit_name')) else None
#                     if not unit_name:
#                         row_errors['unit_name'] = "Required field"

#                     # Validate required member fields
#                     full_name = row.get('full_name', '')
#                     if pd.isna(full_name) or str(full_name).strip() == '':
#                         row_errors['full_name'] = "Full name is required"
#                     else:
#                         full_name = str(full_name).strip()

#                     general_contact = row.get('general_contact', '')
#                     if pd.isna(general_contact) or str(general_contact).strip() == '':
#                         row_errors['general_contact'] = "General contact is required"
#                     else:
#                         general_contact = str(general_contact).strip()

#                     general_email = row.get('general_email', '')
#                     if pd.isna(general_email) or str(general_email).strip() == '':
#                         row_errors['general_email'] = "General email is required"
#                     else:
#                         general_email = str(general_email).strip()

#                     if row_errors:
#                         results['error_count'] += 1
#                         results['errors'].append({'row': row_num, 'errors': row_errors})
#                         raise Exception("Validation failed")

#                     # Your existing code below without change
#                     with transaction.atomic():
#                         tower_name = str(row['tower_name']).strip()
#                         tower_number = int(row['tower_number'])
#                         unit_name = str(row['unit_name']).strip()

#                         unit = Unit.objects.filter(
#                             unit_name=unit_name,
#                             floor__tower__tower_name=tower_name,
#                             floor__tower__tower_number=tower_number
#                         ).first()

#                         if not unit:
#                             raise Exception(f"Unit {unit_name} not found in Tower {tower_name} ({tower_number})")
                        
#                         if not Owner.objects.filter(unit=unit).exists():
#                             # raise Exception(
#                             #     f"Unit {unit_name} in Tower {tower_name} "
#                             #     f"({tower_number}) has no owner; resident not created."
#                             # )
#                              raise Exception(f"({tower_number}) has no owner; resident not created")

#                         contact = self.parse_contact(row['general_contact'])

#                         # Build member data
#                         member_data = {
#                             'full_name': full_name,
#                             'general_contact': contact,
#                             'general_email': general_email,
#                             'permanent_address': row.get('permanent_address', ''),
#                             'present_address': row.get('present_address', ''),
#                             'date_of_birth': row.get('date_of_birth', ''),
#                             'occupation': row.get('occupation', ''),
#                             'gender': row.get('gender', ''),
#                             'marital_status': row.get('marital_status', ''),
#                             'religion': row.get('religion', '')
#                         }

#                         nid = row.get('nid_number', '')
#                         if nid and not pd.isna(nid):
#                             member_data['nid_number'] = str(nid).strip()

#                         delivery_method = row.get('delivery_method', '')
#                         if delivery_method and not pd.isna(delivery_method):
#                             member_data['delivery_method'] = str(delivery_method).strip()

#                         # Validate member
#                         member_serializer = MemberSerializer(data=member_data, context={'request': request})
#                         member_serializer.is_valid(raise_exception=True)

#                         # Check duplicate NID manually
#                         if nid and Member.objects.filter(nid_number=nid).exists():
#                             raise Exception(f"NID number {nid} already in use.")

#                         member = member_serializer.save()
#                         member.is_comm_member = True
#                         member.comm_member_ever_created = True
#                         member.save()

#                         # Create Resident
#                         resident_data = {
#                             'member': member.id,
#                             'unit': unit.id,
#                             'unit_rent_fee': float(row.get('unit_rent_fee') or 0),
#                             'advance_payment': float(row.get('advance_payment') or 0),
#                             'notice_period': int(row.get('notice_period') or 1),
#                             'is_resident_or_tenant': bool(row.get('is_resident_or_tenant', True)),
#                         }

#                         res_ser = BulkResidentSerializer(data=resident_data, context={'request': request})
#                         res_ser.is_valid(raise_exception=True)
#                         res_ser.save()

#                         unit.unit_status = 'occupied'
#                         unit.status_color = unit.STATUS_COLORS['occupied']
#                         unit.save()

#                         results['success_count'] += 1

#         except Exception:
#             return Response({
#                 'message': 'Upload failed due to errors',
#                 'results': self.sanitize_data(results)
#             }, status=status.HTTP_400_BAD_REQUEST)

#         return Response({
#             'message': 'Resident upload completed',
#             'results': self.sanitize_data(results)
#         }, status=status.HTTP_200_OK)

from datetime import datetime, date
# import math
# class ResidentBulkUploadView(APIView):
#     permission_classes = [IsAuthenticated]

#     def sanitize_data(self, data):
#         if isinstance(data, dict):
#             return {k: self.sanitize_data(v) for k, v in data.items()}
#         elif isinstance(data, list):
#             return [self.sanitize_data(item) for item in data]
#         elif isinstance(data, float):
#             if math.isnan(data) or math.isinf(data):
#                 return None
#             return data
#         return data

#     def parse_contact(self, contact):
#         contact = str(contact).strip()
#         if len(contact) == 10:
#             return '0' + contact
#         elif len(contact) == 11 and not contact.startswith('0'):
#             return '0' + contact[1:]
#         return contact

#     def parse_int(self, val):
#         try:
#             return int(float(val))
#         except (ValueError, TypeError):
#             return None

#     def post(self, request):
#         file = request.FILES.get('file')
#         if not file:
#             return Response({'error': 'No file uploaded'},
#                             status=status.HTTP_400_BAD_REQUEST)

#         try:
#             df = pd.read_csv(file) if file.name.endswith('.csv') else pd.read_excel(file)
#         except Exception as e:
#             return Response({'error': f'File read error: {e}'},
#                             status=status.HTTP_400_BAD_REQUEST)

#         df.columns = df.columns.str.strip().str.lower()
#         preview = df.fillna('').head(5).to_dict(orient='records')

#         required_fields = [
#             'tower_name', 'tower_number', 'unit_name',
#             'full_name', 'general_contact', 'general_email'
#         ]
#         missing = [c for c in required_fields if c not in df.columns]
#         if missing:
#             return Response({
#                 'error': f"Missing fields: {', '.join(missing)}",
#                 'preview': preview
#             }, status=status.HTTP_400_BAD_REQUEST)

#         results = {
#             'total_rows': len(df),
#             'success_count': 0,
#             'error_count': 0,
#             'errors': [],
#             'preview': preview
#         }

#         has_error = False  # Track any row failure

#         try:
#             with transaction.atomic():
#                 for idx, row in df.iterrows():
#                     row_num = idx + 2
#                     try:
#                         # Validate tower/unit fields
#                         tower_name = str(row.get('tower_name')).strip() \
#                             if not pd.isna(row.get('tower_name')) else None
#                         tower_number = self.parse_int(row.get('tower_number'))
#                         unit_name = str(row.get('unit_name')).strip() \
#                             if not pd.isna(row.get('unit_name')) else None

#                         if not tower_name:
#                             raise Exception("tower_name: Required field")
#                         if tower_number is None:
#                             raise Exception("tower_number: Invalid tower number")
#                         if not unit_name:
#                             raise Exception("unit_name: Required field")

#                         # Validate member fields
#                         full_name = row.get('full_name', '')
#                         if pd.isna(full_name) or not str(full_name).strip():
#                             raise Exception("full_name: Full name is required")
#                         full_name = str(full_name).strip()

#                         general_contact = row.get('general_contact', '')
#                         if pd.isna(general_contact) or not str(general_contact).strip():
#                             raise Exception("general_contact: General contact is required")
#                         general_contact = str(general_contact).strip()

#                         general_email = row.get('general_email', '')
#                         if pd.isna(general_email) or not str(general_email).strip():
#                             raise Exception("general_email: General email is required")
#                         general_email = str(general_email).strip()

#                         # Find unit
#                         unit = Unit.objects.filter(
#                             unit_name=unit_name,
#                             floor__tower__tower_name=tower_name,
#                             floor__tower__tower_number=tower_number
#                         ).first()
#                         if not unit:
#                             raise Exception(
#                                 f"unit_name: Unit {unit_name} not found in Tower {tower_name} ({tower_number})"
#                             )

#                         # Check owner exists
#                         if not Owner.objects.filter(unit=unit).exists():
#                             raise Exception(
#                                 f"unit_name: Unit {unit_name} in Tower {tower_name} ({tower_number}) has no owner"
#                             )

#                         # Clean contact
#                         contact = self.parse_contact(general_contact)

#                         # Build member_data
#                         member_data = {
#                             'full_name': full_name,
#                             'general_contact': contact,
#                             'general_email': general_email,
#                             'permanent_address': row.get('permanent_address', ''),
#                             'present_address': row.get('present_address', ''),
#                             'date_of_birth': row.get('date_of_birth', ''),
#                             'occupation': row.get('occupation', ''),
#                             'gender': row.get('gender', ''),
#                             'marital_status': row.get('marital_status', ''),
#                             'religion': row.get('religion', '')
#                         }

#                         nid = row.get('nid_number', '')
#                         if nid and not pd.isna(nid):
#                             member_data['nid_number'] = str(nid).strip()

#                         delivery_method = row.get('delivery_method', '')
#                         if delivery_method and not pd.isna(delivery_method):
#                             member_data['delivery_method'] = str(delivery_method).strip()

#                         # Create & validate member
#                         member_serializer = MemberSerializer(
#                             data=member_data, context={'request': request}
#                         )
#                         member_serializer.is_valid(raise_exception=True)

#                         if nid and Member.objects.filter(nid_number=nid).exists():
#                             raise Exception(f"nid_number: NID number {nid} already in use.")

#                         member = member_serializer.save()
#                         member.is_comm_member = True
#                         member.comm_member_ever_created = True
#                         member.save()

#                         # Create resident
#                         resident_data = {
#                             'member': member.id,
#                             'unit': unit.id,
#                             'unit_rent_fee': float(row.get('unit_rent_fee') or 0),
#                             'advance_payment': float(row.get('advance_payment') or 0),
#                             'notice_period': int(row.get('notice_period') or 1),
#                             'is_resident_or_tenant': bool(row.get('is_resident_or_tenant', True)),
#                         }
#                         res_ser = BulkResidentSerializer(
#                             data=resident_data, context={'request': request}
#                         )
#                         res_ser.is_valid(raise_exception=True)
#                         res_ser.save()

#                         unit.unit_status = 'occupied'
#                         unit.status_color = unit.STATUS_COLORS['occupied']
#                         unit.save()

#                         results['success_count'] += 1

#                     except Exception as e:
#                         has_error = True
#                         error_details = {}

#                         if hasattr(e, 'detail') and isinstance(e.detail, dict):
#                             for field, msgs in e.detail.items():
#                                 error_details[field] = "; ".join(msgs) if isinstance(msgs, list) else str(msgs)
#                         else:
#                             error_details['non_field_error'] = str(e)

#                         row_data = self.sanitize_data(row.to_dict())
#                         results['error_count'] += 1
#                         results['errors'].append({
#                             "row": row_num,
#                             "errors": error_details,
#                             "data": row_data
#                         })

#                 if has_error:
#                     raise Exception("Validation failed. No data saved.")

#         except Exception:
#             return Response({
#                 'message': 'Validation failed. No data saved.',
#                 'results': self.sanitize_data(results)
#             }, status=status.HTTP_400_BAD_REQUEST)

#         return Response({
#             'message': 'Upload completed successfully',
#             'results': self.sanitize_data(results)
#         }, status=status.HTTP_200_OK)
import datetime
import pandas as pd
import numpy as np

import numpy as np  















# class ResidentBulkUploadView(APIView):
#     permission_classes = [IsAuthenticated]

#     def sanitize_data(self, data):
#         if isinstance(data, dict):
#             return {k: self.sanitize_data(v) for k, v in data.items()}
#         elif isinstance(data, list):
#             return [self.sanitize_data(item) for item in data]
#         elif isinstance(data, float):
#             if math.isnan(data) or math.isinf(data):
#                 return None
#             return data
#         return data


#     def parse_dob(self, val):
#         """Parse date_of_birth to DD-MMM-YYYY format for MemberSerializer"""
#         if pd.isna(val) or not val:
#             return None
#         try:
#             dt = pd.to_datetime(val, errors='raise')
#             return dt.strftime("%d-%b-%Y")  # Format: DD-MMM-YYYY
#         except Exception:
#             return None

#     def parse_contact(self, contact):
#         contact = str(contact).strip()
#         if len(contact) == 10:
#             return '0' + contact
#         elif len(contact) == 11 and not contact.startswith('0'):
#             return '0' + contact[1:]
#         return contact

#     def parse_int(self, val):
#         try:
#             # Handle pandas NA/NaN values
#             if pd.isna(val):
#                 return None
            
#             # Handle string representations
#             if isinstance(val, str):
#                 val = val.strip().lower()
#                 if val in ['', 'nan', 'none', 'null']:
#                     return None
#                 # Remove commas from numbers
#                 val = val.replace(',', '')
#                 return int(float(val))
            
#             # Handle float values
#             if isinstance(val, float):
#                 if math.isnan(val) or math.isinf(val):
#                     return None
#                 return int(val)
                
#             return int(val)
#         except (ValueError, TypeError):
#             return None

#     def parse_float(self, val):
#         try:
#             # Handle pandas NA/NaN values
#             if pd.isna(val):
#                 return 0.0
            
#             # Handle string representations
#             if isinstance(val, str):
#                 val = val.strip().lower()
#                 if val in ['', 'nan', 'none', 'null']:
#                     return 0.0
#                 # Remove commas from numbers
#                 val = val.replace(',', '')
#                 return float(val)
            
#             # Handle float values
#             if isinstance(val, float):
#                 if math.isnan(val) or math.isinf(val):
#                     return 0.0
#                 return val
                
#             return float(val)
#         except (ValueError, TypeError):
#             return 0.0

#     def parse_boolean(self, val):
#         if pd.isna(val):
#             return True  # Default value
        
 
            
#         if isinstance(val, str):
#             val = val.strip().lower()
#             if val in ['true', '1', 'yes', 'y']:
#                 return True
#             elif val in ['false', '0', 'no', 'n']:
#                 return False
#             else:
#                 return True  # Default value
                
#         if isinstance(val, (int, float)):
#             return bool(val)
            
#         if isinstance(val, bool):
#             return val
            
#         return True  # Default value


#     def post(self, request):
#         file = request.FILES.get('file')
#         if not file:
#             return Response({'error': 'No file uploaded'},
#                             status=status.HTTP_400_BAD_REQUEST)

#         try:
#             if file.name.endswith('.csv'):
#                 df = pd.read_csv(file, keep_default_na=False, na_values=['', 'NA', 'N/A', 'nan', 'NaN', 'NULL'])
#             else:
#                 df = pd.read_excel(file, keep_default_na=False, na_values=['', 'NA', 'N/A', 'nan', 'NaN', 'NULL'])
#             df = df.replace([np.nan, 'nan', 'NaN', 'N/A', 'NA', 'NULL', 'None'], None)
#         except Exception as e:
#             return Response({'error': f'File read error: {e}'},
#                             status=status.HTTP_400_BAD_REQUEST)

#         df.columns = df.columns.str.strip().str.lower()
#         preview = df.fillna('').head(5).to_dict(orient='records')

#         required_fields = [
#             'tower_name', 'tower_number', 'unit_name',
#             'full_name', 'general_contact', 'general_email'
#         ]
#         missing = [c for c in required_fields if c not in df.columns]
#         if missing:
#             return Response({
#                 'error': f"Missing fields: {', '.join(missing)}",
#                 'preview': preview
#             }, status=status.HTTP_400_BAD_REQUEST)

#         results = {
#             'total_rows': len(df),
#             'success_count': 0,
#             'error_count': 0,
#             'errors': [],
#             'preview': preview
#         }

#         has_error = False

#         try:
#             with transaction.atomic():
#                 for idx, row in df.iterrows():
#                     row_num = idx + 2
#                     try:
#                         # Validate required tower/unit fields
#                         tower_name = str(row.get('tower_name')).strip() if not pd.isna(row.get('tower_name')) else None
#                         tower_number = self.parse_int(row.get('tower_number'))
#                         unit_name = str(row.get('unit_name')).strip() if not pd.isna(row.get('unit_name')) else None

#                         if not tower_name:
#                             raise Exception("tower_name: Required field")
#                         if tower_number is None:
#                             raise Exception("tower_number: Invalid tower number")
#                         if not unit_name:
#                             raise Exception("unit_name: Required field")

#                         # Validate member fields
#                         full_name = row.get('full_name', '')
#                         if pd.isna(full_name) or not str(full_name).strip():
#                             raise Exception("full_name: Full name is required")
#                         full_name = str(full_name).strip()

#                         general_contact = row.get('general_contact', '')
#                         if pd.isna(general_contact) or not str(general_contact).strip():
#                             raise Exception("general_contact: General contact is required")
#                         general_contact = str(general_contact).strip()

#                         general_email = row.get('general_email', '')
#                         if pd.isna(general_email) or not str(general_email).strip():
#                             raise Exception("general_email: General email is required")
#                         general_email = str(general_email).strip()

#                         # Find Unit
#                         unit = Unit.objects.filter(
#                             unit_name=unit_name,
#                             floor__tower__tower_name=tower_name,
#                             floor__tower__tower_number=tower_number
#                         ).first()
#                         if not unit:
#                             raise Exception(f"unit_name: Unit {unit_name} not found in Tower {tower_name} ({tower_number})")

#                         # Check Owner exists for this unit 
#                         if not Owner.objects.filter(unit=unit).exists():
#                             raise Exception(f"unit_name: Unit {unit_name} in Tower {tower_name} ({tower_number}) has no owner")

#                         # Clean contact
#                         contact = self.parse_contact(general_contact)

#                         # Build member data
#                         member_data = {
#                             'full_name': full_name,
#                             'general_contact': contact,
#                             'general_email': general_email,
#                             'permanent_address': row.get('permanent_address', ''),
#                             'present_address': row.get('present_address', ''),
#                             'occupation': row.get('occupation', ''),
#                             'gender': row.get('gender', ''),
#                             'marital_status': row.get('marital_status', ''),
#                             'religion': row.get('religion', ''),
#                         }

#                         dob_str = self.parse_dob(row.get('date_of_birth'))
#                         if dob_str:
#                             member_data['date_of_birth'] = dob_str
#                         elif pd.notna(row.get('date_of_birth')):
#                             raise Exception({"date_of_birth": "Invalid date format"})

#                         nid = row.get('nid_number', '')
#                         row_errors = {}
#                         if not nid:
#                             row_errors['nid_number'] = "NID number is required"
#                         elif Member.objects.filter(nid_number=nid).exists():
#                             row_errors['nid_number'] = f"NID number '{nid}' is already in use"
#                         else:
#                             member_data['nid_number'] = nid

#                         if row_errors:
#                             raise Exception(row_errors)

#                         member_serializer = MemberSerializer(data=member_data, context={'request': request})
#                         member_serializer.is_valid(raise_exception=True)
#                         member = member_serializer.save()
#                         member.is_comm_member = True
#                         member.comm_member_ever_created = True
#                         member.save()

#                         # Create Resident
#                         resident_data = {
#                             'member': member.id,
#                             'unit': unit.id,
#                             'unit_rent_fee': self.parse_float(row.get('unit_rent_fee')),
#                             'advance_payment': self.parse_float(row.get('advance_payment')),
#                             'notice_period': self.parse_int(row.get('notice_period')),
#                             'is_resident_or_tenant': self.parse_boolean(row.get('is_resident_or_tenant')),
#                         }
#                         res_ser = BulkResidentSerializer(data=resident_data, context={'request': request})
#                         res_ser.is_valid(raise_exception=True)
#                         res_ser.save()

#                         # Update unit status
#                         unit.unit_status = 'occupied'
#                         unit.status_color = unit.STATUS_COLORS['occupied']
#                         unit.save()

#                         results['success_count'] += 1

#                     except Exception as e:
#                         has_error = True
#                         error_details = {}

#                         if hasattr(e, 'detail') and isinstance(e.detail, dict):
#                             for field, msgs in e.detail.items():
#                                 error_details[field] = "; ".join(msgs) if isinstance(msgs, list) else str(msgs)
#                         elif isinstance(e.args[0], dict):
#                             # When raise Exception is called with dict
#                             for field, msg in e.args[0].items():
#                                 error_details[field] = msg
#                         else:
#                             error_details['non_field_error'] = str(e)

#                         row_data = self.sanitize_data(row.to_dict())
#                         results['error_count'] += 1
#                         results['errors'].append({
#                             "row": row_num,
#                             "errors": error_details,
#                             "row_data": row_data,
#                         })

#                 if has_error:
#                     raise Exception("Validation failed. No data saved.")

#         except Exception:
#             return Response({
#                 'message': 'Validation failed. No data saved.',
#                 'results': self.sanitize_data(results)
#             }, status=status.HTTP_400_BAD_REQUEST)

#         return Response({
#             'message': 'Upload completed successfully',
#             'results': self.sanitize_data(results)
#         }, status=status.HTTP_200_OK)

class ResidentBulkUploadView(APIView): 
    permission_classes = [IsAuthenticated]

    def sanitize_data(self, data):
        if isinstance(data, dict):
            return {k: self.sanitize_data(v) for k, v in data.items()}
        elif isinstance(data, list):
            return [self.sanitize_data(item) for item in data]
        elif isinstance(data, float):
            if math.isnan(data) or math.isinf(data):
                return None
            return data
        return data

    def parse_dob(self, val):
        if pd.isna(val) or not val:
            return None
        try:
            dt = pd.to_datetime(val, errors='raise')
            return dt.strftime("%d-%b-%Y")
        except Exception:
            return None

    def parse_contact(self, contact):
        # No validation, pass through as-is
        return str(contact) if contact else contact

    def parse_int(self, val):
        try:
            if pd.isna(val):
                return None
            if isinstance(val, str):
                val = val.strip().lower()
                if val in ['', 'nan', 'none', 'null']:
                    return None
                val = val.replace(',', '')
                return int(float(val))
            if isinstance(val, float):
                if math.isnan(val) or math.isinf(val):
                    return None
                return int(val)
            return int(val)
        except (ValueError, TypeError):
            return None

    def parse_float(self, val):
        try:
            if pd.isna(val):
                return 0.0
            if isinstance(val, str):
                val = val.strip().lower()
                if val in ['', 'nan', 'none', 'null']:
                    return 0.0
                val = val.replace(',', '')
                return float(val)
            if isinstance(val, float):
                if math.isnan(val) or math.isinf(val):
                    return 0.0
                return val
            return float(val)
        except (ValueError, TypeError):
            return 0.0

    def parse_boolean(self, val):
        if pd.isna(val):
            return True
        if isinstance(val, str):
            val = val.strip().lower()
            if val in ['true', '1', 'yes', 'y']:
                return True
            elif val in ['false', '0', 'no', 'n']:
                return False
            else:
                return True
        if isinstance(val, (int, float)):
            return bool(val)
        if isinstance(val, bool):
            return val
        return True

    def post(self, request):
        file = request.FILES.get('file')
        if not file:
            return Response({
                'status': 'error',
                'message': 'No file uploaded',
                'total_rows': 0,
                'success_count': 0,
                'error_count': 0,
                'failed_rows': [],
                'created_residents': []
            }, status=status.HTTP_400_BAD_REQUEST)

        try:
            if file.name.endswith('.csv'):
                df = pd.read_csv(file, keep_default_na=False, na_values=['', 'NA', 'N/A', 'nan', 'NaN', 'NULL'])
            else:
                df = pd.read_excel(file, keep_default_na=False, na_values=['', 'NA', 'N/A', 'nan', 'NaN', 'NULL'])
            df = df.replace([np.nan, 'nan', 'NaN', 'N/A', 'NA', 'NULL', 'None'], None)
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
                'created_residents': [],
                'details': str(e)
            }, status=status.HTTP_400_BAD_REQUEST)

        df.columns = df.columns.str.strip().str.lower()
        preview = df.fillna('').head(5).to_dict(orient='records')
        total_rows = len(df)

        # general_contact removed from required_fields - it's now optional
        required_fields = [
            'tower_name', 'tower_number', 'unit_name',
            'full_name', 'general_email'
        ]
        missing = [c for c in required_fields if c not in df.columns]
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
                'created_residents': [],
                'missing_columns': list(missing),
                'preview': preview
            }, status=status.HTTP_400_BAD_REQUEST)

        results = {
            'total_rows': total_rows,
            'success_count': 0,
            'error_count': 0,
            'errors': [],
            'preview': preview
        }

        validation_errors = []
        validated_rows = []

        # Step 1: Validate ALL rows first (no saving)
        for idx, row in df.iterrows():
            row_num = idx + 2
            error_details = {}

            try:
                tower_name = str(row.get('tower_name')).strip() if not pd.isna(row.get('tower_name')) else None
                tower_number = self.parse_int(row.get('tower_number'))
                unit_name = str(row.get('unit_name')).strip() if not pd.isna(row.get('unit_name')) else None

                if not tower_name:
                    error_details["tower_name"] = "Required field"
                if tower_number is None:
                    error_details["tower_number"] = "Invalid tower number"
                if not unit_name:
                    error_details["unit_name"] = "Required field"

                full_name = row.get('full_name', '')
                if pd.isna(full_name) or not str(full_name).strip():
                    error_details["full_name"] = "Full name is required"
                full_name = str(full_name).strip()

                # general_contact is optional with max 11 characters validation
                general_contact = row.get('general_contact', '')
                general_contact = str(general_contact) if pd.notna(general_contact) else ''
                
                # Validate max length
                if general_contact and len(general_contact) > 11:
                    error_details['general_contact'] = f"Contact number cannot be more than 11 characters (current: {len(general_contact)})"

                general_email = row.get('general_email', '')
                if pd.isna(general_email) or not str(general_email).strip():
                    error_details["general_email"] = "General email is required"
                general_email = str(general_email).strip()

                unit = Unit.objects.filter(
                    unit_name=unit_name,
                    floor__tower__tower_name=tower_name,
                    floor__tower__tower_number=tower_number
                ).first()
                if not unit:
                    error_details["unit_name"] = f"Unit {unit_name} not found in Tower {tower_name} ({tower_number})"
                elif not Owner.objects.filter(unit=unit).exists():
                    error_details["unit_name"] = f"Unit {unit_name} in Tower {tower_name} ({tower_number}) has no owner"

                contact = self.parse_contact(general_contact)

                member_data = {
                    'full_name': full_name,
                    'general_contact': contact,
                    'general_email': general_email,
                    'permanent_address': row.get('permanent_address', ''),
                    'present_address': row.get('present_address', ''),
                    'occupation': row.get('occupation', ''),
                    'gender': row.get('gender', ''),
                    'marital_status': row.get('marital_status', ''),
                    'religion': row.get('religion', ''),
                    'is_comm_member': True,
                    'comm_member_ever_created': True,
                }

                dob_str = self.parse_dob(row.get('date_of_birth'))
                if dob_str:
                    member_data['date_of_birth'] = dob_str
                elif pd.notna(row.get('date_of_birth')):
                    error_details["date_of_birth"] = "Invalid date format"

                # NID number - no validation, skip if duplicate to avoid database errors
                nid = row.get('nid_number', '')
                if nid:
                    # If NID already exists, skip it (set to None) to avoid unique constraint violation
                    if Member.objects.filter(nid_number=nid).exists():
                        # Skip NID silently - no error, just don't set it
                        pass
                    else:
                        member_data['nid_number'] = nid

                delivery_method = row.get('delivery_method', '')
                if delivery_method and not pd.isna(delivery_method):
                    delivery_method = str(delivery_method).strip()
                    if "@" in delivery_method:
                        if Member.objects.filter(login_email=delivery_method).exists():
                            error_details['delivery_method'] = "This email address is already in use"
                    elif delivery_method.isdigit():
                        if Member.objects.filter(login_contact=delivery_method).exists():
                            error_details['delivery_method'] = "This contact number is already in use"

                    if 'delivery_method' not in error_details:
                        member_data['delivery_method'] = delivery_method        

                member_serializer = MemberSerializer(data=member_data, context={'request': request})
                if not member_serializer.is_valid():
                    for field, msgs in member_serializer.errors.items():
                        error_details[field] = "; ".join(msgs) if isinstance(msgs, list) else str(msgs)

                # Only validate resident_data if unit exists (unit validation already checked above)
                if unit:
                    resident_data = {
                        'member': None,  # Will be set after member creation
                        'unit': unit.id,
                        'unit_rent_fee': self.parse_float(row.get('unit_rent_fee')) or 0,
                        'advance_payment': self.parse_float(row.get('advance_payment')) or 0,
                        'notice_period': self.parse_int(row.get('notice_period')) or 0,
                        'is_resident_or_tenant': self.parse_boolean(row.get('is_resident_or_tenant')),
                    }
                    # Create a modified context that includes a flag to skip member validation
                    bulk_context = {'request': request, 'bulk_upload': True}
                    res_ser = BulkResidentSerializer(data=resident_data, context=bulk_context)
                    if not res_ser.is_valid():
                        for field, msgs in res_ser.errors.items():
                            error_details[field] = "; ".join(msgs) if isinstance(msgs, list) else str(msgs)
                else:
                    # Unit validation already failed, resident_data will be created later
                    resident_data = {
                        'unit': None,
                        'unit_rent_fee': self.parse_float(row.get('unit_rent_fee')) or 0,
                        'advance_payment': self.parse_float(row.get('advance_payment')) or 0,
                        'notice_period': self.parse_int(row.get('notice_period')) or 0,
                        'is_resident_or_tenant': self.parse_boolean(row.get('is_resident_or_tenant')),
                    }

                if error_details:
                    validation_errors.append({
                        "row": row_num,
                        "errors": error_details,
                        "row_data": self.sanitize_data(row.to_dict()),
                    })
                else:
                    validated_rows.append({
                        'row_num': row_num,
                        'member_data': member_data,
                        'resident_data': resident_data,
                        'unit': unit
                    })

            except Exception as e:
                validation_errors.append({
                    "row": row_num,
                    "errors": {'non_field_error': str(e)},
                    "row_data": self.sanitize_data(row.to_dict()),
                })

        # Step 2: If any validation errors, return without saving
        if validation_errors:
            results['error_count'] = len(validation_errors)
            results['errors'] = validation_errors
            return Response({
                'status': 'error',
                'message': 'Validation errors found',
                'total_rows': total_rows,
                'success_count': 0,
                'error_count': len(validation_errors),
                'failed_rows': validation_errors,
                'created_residents': []
            }, status=status.HTTP_400_BAD_REQUEST)

        # Step 3: If all valid, save ALL rows in a transaction
        try:
            with transaction.atomic():
                for item in validated_rows:
                    member_serializer = MemberSerializer(data=item['member_data'], context={'request': request})
                    member_serializer.is_valid(raise_exception=True)
                    member = member_serializer.save()
                    # member.is_comm_member = True
                    # member.comm_member_ever_created = True
                    # member.save()

                    # Update resident_data with member ID
                    resident_data = item['resident_data'].copy()
                    resident_data['member'] = member.id

                    res_ser = BulkResidentSerializer(data=resident_data, context={'request': request})
                    res_ser.is_valid(raise_exception=True)
                    resident = res_ser.save()

                    # Record resident history
                    try:
                        actor = request.user.member if hasattr(request.user, 'member') else Member.objects.get(user=request.user)
                        
                        # Get current resident state before adding
                        current_residents = Resident.objects.filter(
                            unit=resident.unit,
                            is_active=True
                        ).select_related('member')
                        
                        resident_state_before = []
                        for res in current_residents:
                            if res.id != resident.id:
                                resident_state_before.append({
                                    'resident_id': res.id,
                                    'member_id': res.member.id,
                                    'name': res.member.full_name,
                                    'contact': res.member.general_contact or '',
                                    'email': res.member.general_email or '',
                                    'is_resident_or_tenant': res.is_resident_or_tenant,
                                    'status_label': 'Resident' if res.is_resident_or_tenant else 'Tenant',
                                    'assignment_date': res.created_at.date().isoformat() if res.created_at else None
                                })
                        
                        # Build state after
                        resident_state_after = list(resident_state_before)
                        status_label = 'Resident' if resident.is_resident_or_tenant else 'Tenant'
                        resident_state_after.append({
                            'resident_id': resident.id,
                            'member_id': resident.member.id,
                            'name': resident.member.full_name,
                            'contact': resident.member.general_contact or '',
                            'email': resident.member.general_email or '',
                            'is_resident_or_tenant': resident.is_resident_or_tenant,
                            'status_label': status_label,
                            'assignment_date': resident.created_at.date().isoformat() if resident.created_at else None
                        })
                        
                        # Create history entry with description
                        description = f"{resident.member.full_name} assigned to unit"
                        UnitResidentHistory.create_resident_assigned_entry(
                            unit=resident.unit,
                            resident_member=resident.member,
                            is_resident_or_tenant=resident.is_resident_or_tenant,
                            entry_date=resident.created_at or timezone.now(),
                            created_by=actor,
                            resident_state_before=resident_state_before,
                            resident_state_after=resident_state_after,
                            description=description
                        )
                    except Exception as e:
                        # Log error but don't fail the transaction - history is important but shouldn't block resident creation
                        logger.error(f"Error creating resident history entry in bulk upload for resident {resident.member.full_name if 'resident' in locals() else 'unknown'}: {str(e)}", exc_info=True)

                    # Update unit status
                    unit = item['unit']
                    unit.unit_status = 'occupied'
                    unit.status_color = unit.STATUS_COLORS['occupied']
                    unit.save()

                    results['success_count'] += 1

            # Create bulk upload summary notifications grouped by unit
            try:
                from notifications.utils import create_bulk_upload_summary_notification
                from collections import defaultdict
                
                # Group validated rows by unit to count residents per unit
                unit_resident_counts = defaultdict(int)
                for item in validated_rows:
                    unit = item.get('unit')
                    if unit:
                        unit_resident_counts[unit] += 1
                
                # Get creator
                actor = request.user.member if hasattr(request.user, 'member') else Member.objects.get(user=request.user)
                
                # Create notification for each unit
                for unit, count in unit_resident_counts.items():
                    try:
                        create_bulk_upload_summary_notification(
                            unit=unit,
                            count=count,
                            upload_type='resident',
                            creator=actor
                        )
                    except Exception as e:
                        logger.error(f"Error creating bulk upload notification for unit {unit.unit_name}: {str(e)}")
                        # Don't fail the request if notification creation fails
            except Exception as e:
                logger.error(f"Error creating bulk upload notifications: {str(e)}")
                # Don't fail the request if notification creation fails

            return Response({
                'status': 'success',
                'message': f'Successfully created {results["success_count"]} residents',
                'total_rows': total_rows,
                'success_count': results['success_count'],
                'error_count': 0,
                'failed_rows': [],
                'created_residents': []
            }, status=status.HTTP_201_CREATED)

        except Exception as e:
            return Response({
                'status': 'error',
                'message': 'Transaction failed - No data was saved',
                'total_rows': total_rows,
                'success_count': 0,
                'error_count': total_rows,
                'failed_rows': [{
                    'row': 'All',
                    'errors': {
                        'transaction': str(e)
                    }
                }],
                'created_residents': [],
                'details': str(e),
                'solution': 'Please fix the errors and try again. Common issues: data too long for fields, invalid format, etc.'
            }, status=status.HTTP_400_BAD_REQUEST)


class UnitResidentHistoryAPI(APIView):
    """
    API endpoint to get the resident history of a unit.
    Reads directly from the UnitResidentHistory database table.
    
    Returns a timeline of resident changes with 4 status types:
    1. Resident Assigned - When a resident/tenant is assigned to a unit
    2. Resident Removed - When a resident/tenant is removed from a unit
    3. Resident Info Updated - When resident details (rent, etc.) are updated
    4. Resident Status Changed - When status toggles between Resident and Tenant
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
        history_entries = UnitResidentHistory.objects.filter(
            unit=unit
        ).select_related('resident_member', 'created_by').order_by('-entry_date', '-created_at')
        
        # Transform to API response format
        entries = []
        for entry in history_entries:
            resident_member_data = None
            current_name = None
            current_contact = None
            current_email = None
            member_id = None
            
            # Extract resident states early so they can be used in description generation
            resident_state_before = entry.resident_state_before or []
            resident_state_after = entry.resident_state_after or []
            
            if entry.resident_member:
                current_name = entry.resident_member.full_name
                current_contact = entry.resident_member.general_contact or ''
                current_email = entry.resident_member.general_email or ''
                member_id = entry.resident_member.id
                resident_member_data = {
                    'id': member_id,
                    'name': current_name,
                    'contact': current_contact,
                    'email': current_email,
                }
            else:
                # Fallback to stored values if member is deleted
                current_name = entry.resident_name
                current_contact = entry.resident_contact or ''
                current_email = entry.resident_email or ''
            
            # Generate description dynamically based on entry type and current member data
            description = ''
            if current_name:
                if entry.entry_type == 'resident_assigned':
                    description = f"{current_name} assigned to unit"
                elif entry.entry_type == 'resident_removed':
                    description = f"{current_name} removed from unit"
                elif entry.entry_type == 'resident_status_changed':
                    # Determine old and new status from snapshots
                    new_label = 'Resident' if entry.is_resident_or_tenant else 'Tenant'
                    old_label = 'Tenant' if entry.is_resident_or_tenant else 'Resident'  # Opposite of new status
                    # Try to get more accurate status from snapshots if available
                    if member_id and resident_state_before:
                        for res in resident_state_before:
                            if res.get('member_id') == member_id:
                                old_status = res.get('is_resident_or_tenant')
                                if old_status is not None:
                                    old_label = 'Resident' if old_status else 'Tenant'
                                break
                    description = f"{current_name} status changed from {old_label} to {new_label}"
                elif entry.entry_type == 'resident_info_updated':
                    # For info updates, extract meaningful parts from original description
                    # but replace old name with current name
                    original_desc = entry.description or ''
                    # Replace old name patterns with current name
                    if entry.resident_name and entry.resident_name != current_name:
                        original_desc = original_desc.replace(entry.resident_name, current_name)
                    description = original_desc if original_desc else f"{current_name} information updated"
                else:
                    description = entry.description or ''
            else:
                description = entry.description or ''
            
            entry_data = {
                'id': str(entry.id),
                'type': entry.entry_type,
                'date': entry.entry_date.isoformat() if entry.entry_date else None,
                'description': description,
                'resident_member': resident_member_data,
                'resident_name': current_name,
                'resident_contact': current_contact,
                'resident_email': current_email,
                'is_resident_or_tenant': entry.is_resident_or_tenant,
                'status_label': 'Resident' if entry.is_resident_or_tenant else 'Tenant' if entry.is_resident_or_tenant is not None else None,
            }
            
            # Update snapshots with current profile information and attachments if resident_member exists
            # (resident_state_before and resident_state_after already extracted above)
            if member_id:
                # Fetch attachments for the resident
                from towers.models import ResidentDocs
                resident_attachments = []
                try:
                    # Try to get resident by member_id
                    from towers.models import Resident
                    resident_obj = Resident.objects.filter(unit=unit, member_id=member_id).first()
                    if resident_obj:
                        for doc in ResidentDocs.objects.filter(resident=resident_obj):
                            if doc.rental_docs:
                                doc_url = doc.rental_docs.url
                                if request:
                                    doc_url = request.build_absolute_uri(doc_url)
                                resident_attachments.append({
                                    'id': doc.id,
                                    'name': os.path.basename(doc.rental_docs.name) if doc.rental_docs else None,
                                    'url': doc_url
                                })
                except Exception as e:
                    print(f"Error fetching attachments for resident: {e}")
                
                # Update resident_state_before snapshots
                updated_state_before = []
                for resident_state in resident_state_before:
                    updated_state = resident_state.copy()
                    if resident_state.get('member_id') == member_id:
                        updated_state['name'] = current_name
                        updated_state['contact'] = current_contact
                        updated_state['email'] = current_email
                        # Include attachments if not already present
                        if 'attachments' not in updated_state:
                            updated_state['attachments'] = resident_attachments
                    updated_state_before.append(updated_state)
                
                # Update resident_state_after snapshots
                updated_state_after = []
                for resident_state in resident_state_after:
                    updated_state = resident_state.copy()
                    if resident_state.get('member_id') == member_id:
                        updated_state['name'] = current_name
                        updated_state['contact'] = current_contact
                        updated_state['email'] = current_email
                        # Include attachments if not already present
                        if 'attachments' not in updated_state:
                            updated_state['attachments'] = resident_attachments
                    updated_state_after.append(updated_state)
                
                entry_data['resident_state_before'] = updated_state_before
                entry_data['resident_state_after'] = updated_state_after
            else:
                entry_data['resident_state_before'] = resident_state_before
                entry_data['resident_state_after'] = resident_state_after
            
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
