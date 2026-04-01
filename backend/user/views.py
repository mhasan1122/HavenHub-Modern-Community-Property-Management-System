from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status,serializers
from django.contrib.auth.models import User
from rest_framework_simplejwt.tokens import RefreshToken, AccessToken
from rest_framework.permissions import IsAuthenticated
from django.contrib.auth import authenticate
from rest_framework_simplejwt.exceptions import TokenError
from .serializers import UserSerializer,MemberSerializer,SetPasswordSerializer,CompanySerializer,CompanySerializerlist
import logging
from rest_framework.exceptions import NotFound
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from rest_framework.exceptions import AuthenticationFailed,ValidationError
from rest_framework_simplejwt.authentication import JWTStatelessUserAuthentication
from .serializers import UserSerializer,MemberTypeSerializer
from .models import Member,MemberType,Company,BlockedUser
from notifications.models import DeviceToken
from group_role.models import MembersRole
from django.core.mail import send_mail
from user.email_utils import send_html_email
from django.conf import settings as django_settings
import random
from .permissions import HasRequiredPermission
from django.db.models import Q
from datetime import datetime, timedelta
from datetime import timedelta
from django.utils import timezone
from django.core.cache import cache
import secrets
from audit_trail.create_audit_trail import create_audit_trail
from django.forms.models import model_to_dict 
import os
from towers.models import Unit
from django.core.exceptions import ObjectDoesNotExist
from .serializers import generate_random_username,generate_random_password
from django.core.validators import RegexValidator
from django.db import transaction
from towers.serializers.resident_serializers import ResidentSerializer
from towers.serializers.owner_serializers import OwnerSerializer
from towers.serializers.unitStaff_serializers import UnitStaffSerializer,UnitStaffMemberSerializerForCommMember
from towers.serializers.resident_serializers import AddExistingResident,AddExistingOwners
from towers.models import Owner,Resident,UnitStaff
import traceback
import re
from backend.utils.errors import flatten_errors
from django.conf import settings


class HeadingData(APIView):
    def get(self,request):
        member =  MemberSerializer(Member.objects.get(user=request.user)).data
        return Response({
                            'id': member.get('id'),
                            'full_name': member.get('full_name'),
                            'photo_low_quality': member.get('photo_low_quality'),
                            'roles': [role['role_name'] for role in member.get('member_roles', [])]
                        },status=status.HTTP_200_OK)

class CentralPermissionChecker(APIView):
    def get(self,request):
        member = Member.objects.get(user=request.user)
        permission_ids = member.get_permission_ids()
        permission_id = int(request.GET.get('permission_id')) if request.GET.get('permission_id') is not None else None
        type_of_member = request.GET.get('type_of_member')
        if type_of_member is None or permission_id is None:
            return Response(status=status.HTTP_404_NOT_FOUND)
        elif type_of_member == "org":
            if member.is_org_member == 0:
                return Response(status=status.HTTP_401_UNAUTHORIZED)
            if permission_id not in permission_ids:
                return Response(status=status.HTTP_403_FORBIDDEN)
        elif type_of_member == "comm":
            if member.is_comm_member == 0:
                return Response(status=status.HTTP_401_UNAUTHORIZED)
            if permission_id not in permission_ids:
                return Response(status=status.HTTP_403_FORBIDDEN)
        return Response(status=status.HTTP_200_OK)
        
# Created By Injam
class UserListView(APIView):
    permission_classes = [IsAuthenticated]  # Only authenticated users can access this endpoint

    def get(self, request):
        users = User.objects.all()  # Get all users
        serializer = UserSerializer(users, many=True)  # Serialize all users
        return Response(serializer.data)  # Return serialized data

class MemberTypeList(APIView):
    # permission_classes = [IsAuthenticated]  # Only authenticated users can access this endpoint

    def get(self, request):
        member_types = MemberType.objects.all()  # Get all users
        serializer = MemberTypeSerializer(member_types, many=True)  # Serialize all users
        return Response(serializer.data,status=status.HTTP_200_OK)  # Return serialized data
    
# Organizational member List
# Created By Injam
# Updated by Ankan
class MemberList(APIView):
    permission_classes = [IsAuthenticated,HasRequiredPermission]
    # Here define the permission id in the database to have access of this view
    required_permission_id = [3]

    def get(self, request):
        type = request.GET.get('type')
        
        member_type_ids = request.GET.getlist('member_type_ids')  # Get array from query params
        # Convert to list of integers
        if member_type_ids:
            member_type_ids = list(map(int, member_type_ids))

        # Get all user profiles
        if type == "org":
            member_profiles = Member.objects.filter(is_org_member=True)
        elif type == "comm":
            member_profiles = Member.objects.filter(is_comm_member=True) or (Member.objects.filter(is_comm_member=False) and Member.objects.filter(is_org_member=False))
        else:
            member_profiles = Member.objects.filter()
        # Serialize the user profiles

        # Filter by member_type_ids if provided
    
        if member_type_ids:
            member_profiles = member_profiles.filter(member_type__id__in=member_type_ids)

        # Newest members first (at top of list)
        member_profiles = member_profiles.order_by("-created_at", "-id")

        serializer = MemberSerializer(member_profiles, many=True)
        # Return the serialized data
        return Response(serializer.data)

# class MemberListSearchSort(APIView):
#     permission_classes = [IsAuthenticated,HasRequiredPermission]
#     # Here define the permission id in the database to have access of this view
#     required_permission_id = [3]
#     def get(self, request):
#         # Start with all members
#         # member_query = Member.objects.all()
#         member_query = Member.objects.filter(org_member_ever_created=True) 

        
#         member_type_ids = request.GET.getlist('member_type')
#         if member_type_ids:
#             member_query = member_query.filter(member_type__id__in=member_type_ids)
#         # --- Search by name, contact, or email ---
#         search = request.GET.get('search', '').strip()
#         if search and len(search) >= 3:
#             member_query = member_query.filter(
#                 Q(full_name__icontains=search) |
#                 Q(general_contact__icontains=search) |
#                 Q(general_email__icontains=search) |
#                 Q(membersrole__role__role_name__icontains=search)

#             )

#         # Check if there are any results
#         if not member_query.exists():
#             # return Response({"message": "No results found"}, status=status.HTTP_200_OK)
#             return Response({"message": "No results found", "data": []}, status=status.HTTP_200_OK)

#             # return Response({"message": "No results found"}, status=status.HTTP_404_NOT_FOUND)

#         # Serialize the data
#         serializer = MemberSerializer(
#             member_query, many=True, context={'request': request}
#         )
#         return Response(serializer.data)
class MemberListSearchSort(APIView):
    permission_classes = [IsAuthenticated, HasRequiredPermission]
    required_permission_id = [3]

    def get(self, request):
        member_query = Member.objects.filter(org_member_ever_created=True)

        # Filter by member_type
        member_type_ids = request.GET.getlist('member_type')
        if member_type_ids:
            member_query = member_query.filter(member_type__id__in=member_type_ids)

        # ✅ Filter by role
        role_ids = request.GET.getlist('role')
        if role_ids:
            member_query = member_query.filter(membersrole__role__id__in=role_ids)

        # 🔍 Search
        search = request.GET.get('search', '').strip()
        if search and len(search) >= 3:
            member_query = member_query.filter(
                Q(full_name__icontains=search) |
                Q(general_contact__icontains=search) |
                Q(general_email__icontains=search) |
                Q(membersrole__role__role_name__icontains=search)
            )

        if not member_query.exists():
            return Response({"message": "No results found", "data": []}, status=status.HTTP_200_OK)

        # Newest members first (at top of list)
        member_query = member_query.distinct().order_by("-created_at", "-id")

        serializer = MemberSerializer(
            member_query,
            many=True,
            context={'request': request}
        )
        return Response(serializer.data)

# Created By Ankan    
class MemberDetails(APIView):
    permission_classes = [IsAuthenticated, HasRequiredPermission]
    required_permission_id = [3]

    def get(self, request, pk):
        try:
            member_profile = Member.objects.get(pk=pk)
        except Member.DoesNotExist:
            raise NotFound("Member profile not found")

        # Serialize the member itself
        member_serializer = MemberSerializer(member_profile)

        # Get all Owner, Resident, and UnitStaff records for this member
        owners = Owner.objects.filter(member=member_profile)
        residents = Resident.objects.filter(member=member_profile,is_active=True)
        staff = UnitStaff.objects.filter(member=member_profile,is_active=True)

        # Serialize them
        owner_serializer = OwnerSerializer(owners, many=True, context={'request': request})
        resident_serializer = ResidentSerializer(residents, many=True, context={'request': request})
        staff_serializer = UnitStaffSerializer(staff, many=True, context={'request': request})

        return Response({
            'member': member_serializer.data,
            'owners': owner_serializer.data,
            'residents': resident_serializer.data,
            'staff': staff_serializer.data,
        })

class ChangeMemberStatus(APIView):
    permission_classes = [IsAuthenticated,HasRequiredPermission]
    # Here define the permission id in the database to have access of this view
    required_permission_id = [2]
    def post(self, request, pk):
        # Retrieve the user profile by primary key (pk)
        status_change = request.data.get('status_change')
        member_type = request.data.get('member_type')
        try:
            # Attempt to cast status_change to an integer
            status_change = int(status_change)
        except (ValueError, TypeError):
            # Handle the case where it's not a valid integer
            status_change = None
        if status_change is None or member_type is None:
            raise ValidationError({"message": "Both 'status_change' and 'member_type' are required"})
        try:
            member_profile = Member.objects.get(pk=pk)
        except Member.DoesNotExist:
            raise NotFound("Member profile not found")
        
        old_data = model_to_dict(member_profile, exclude=['photo', 'photo_low_quality', 'nid_front', 'nid_back'])

        # print(type(status_change),type(member_type))
        if status_change == 0 and member_type == 'org':
            member_profile.is_org_member = False
        elif status_change == 1 and member_type == 'org':
            member_profile.is_org_member = True
        elif status_change == 0 and member_type == 'comm':
            member_profile.is_comm_member = False
        elif status_change == 1 and member_type == 'comm':
            member_profile.is_comm_member = True
        member_profile.save()
        updated_data = model_to_dict(member_profile, exclude=['photo', 'photo_low_quality', 'nid_front', 'nid_back'])
        create_audit_trail(
            member=member_profile,
            event_type='MEMBER_STATUS_CHANGED',
            table_name='Member',
            row_id=member_profile.id,
            old_data=old_data,
            new_data=updated_data,
            description=f'Member "{member_profile.full_name}" status changed successfully.'
        )
        return Response({"message": "Member status changed successfully"}, status=status.HTTP_200_OK)

# Created By Injam
# class CreateMember(APIView):
#     permission_classes = [IsAuthenticated,HasRequiredPermission]
#     # Here define the permission id in the database to have access of this view
#     required_permission_id = [1]
#     def post(self, request):
#         print(request.data.get("delivery_method"))
#         full_name = request.data.get("full_name")
#         general_email = request.data.get("general_email")
#         general_contact = request.data.get("general_contact")
        
#         if full_name and general_email and general_contact:
#             existing_member = Member.objects.filter(
#                 full_name=full_name,
#                 general_email=general_email,
#                 general_contact=general_contact
#             ).first()
            
#         delivery_method = request.data.get("delivery_method", None)
#         if delivery_method:
#             if "@" in delivery_method:
#                 if Member.objects.filter(login_email=delivery_method).exists():
#                     return Response({"Error": "This email address is already in use. Please enter a different email."}, status=status.HTTP_400_BAD_REQUEST)
#             elif delivery_method.isdigit():
#                 if Member.objects.filter(login_contact=delivery_method).exists():
#                     return Response({"Error": "This contact number is already in use. Please enter a different contact number."}, status=status.HTTP_400_BAD_REQUEST)
        
#             if existing_member:
                
#                 if not existing_member.is_org_member:
#                     existing_member.is_org_member = True
#                     existing_member.org_member_ever_created = True
#                     existing_member.save(update_fields=['is_org_member','org_member_ever_created'])
#                 return Response(
#                     {
#                         "message": "User registered successfully",
#                         "member": {
#                             "id": existing_member.id,
#                             "full_name": existing_member.full_name
#                         }
#                     },
#                     status=status.HTTP_200_OK   
#                 )
#             serializer = MemberSerializer(data=request.data,context={'request': request})
#         if serializer.is_valid():
#             member = serializer.save()
#             try:
#                 member = request.user.member
#             except AttributeError:
#                 member = Member.objects.get(user=request.user)
#             excluded_fields = ['photo', 'photo_low_quality', 'nid_front', 'nid_back']
#             member_data = model_to_dict(member, exclude=excluded_fields)
#             create_audit_trail(
#                 member=member,
#                 event_type='MEMBER_CREATED',
#                 table_name='Member',
#                 row_id=member.id,
#                 old_data=None,
#                 new_data=member_data,
#                 description=f'New member "{member.full_name}" created successfully.'
#             )
#             return Response({"message": "User registered successfully"}, status=status.HTTP_201_CREATED)
#         return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

class CreateMember(APIView):
    permission_classes = [IsAuthenticated, HasRequiredPermission]
    required_permission_id = [1]

    def post(self, request):
        # print(request.data.get("delivery_method"))
        full_name = request.data.get("full_name")
 
        general_email = request.data.get("general_email")
        general_contact = request.data.get("general_contact")

        existing_member = None
        if full_name and general_email and general_contact:
           
            existing_member = Member.objects.filter(full_name=full_name,general_email=general_email,general_contact=general_contact).first()
         
       
        delivery_method = request.data.get("delivery_method", None)
    
        if delivery_method:
            if "@" in delivery_method:
                email_query = Member.objects.filter(login_email=delivery_method)
                if existing_member:
                    email_query = email_query.exclude(id=existing_member.id)
                if email_query.exists():
                    return Response(
                        {"Error": "This email address is already in use. Please enter a different email."},
                        status=status.HTTP_400_BAD_REQUEST
                    )
            elif delivery_method.isdigit():
                contact_query = Member.objects.filter(login_email=delivery_method)
                if existing_member:
                    contact_query = contact_query.exclude(id=existing_member.id)
                if contact_query.exists():
                    return Response(
                        {"Error": "This contact number is already in use. Please enter a different contact number."},
                        status=status.HTTP_400_BAD_REQUEST
                    )


        if existing_member:
            updated_fields = []
            
            if not existing_member.is_org_member:
                existing_member.is_org_member = True
                existing_member.org_member_ever_created = True
                updated_fields += ['is_org_member', 'org_member_ever_created']

            
            if delivery_method:
                if "@" in delivery_method and not existing_member.login_email:
                    existing_member.login_email = delivery_method
                    updated_fields.append('login_email')
                elif delivery_method.isdigit() and not existing_member.login_contact:
                    existing_member.login_contact = delivery_method
                    updated_fields.append('login_contact')

            existing_member.save(update_fields=updated_fields)
            print('update  member  ')
            return Response(
                {
                    "message": "User registered successfully",
                    "member": {
                        "id": existing_member.id,
                        "full_name": existing_member.full_name
                    }
                },
                status=status.HTTP_200_OK
            )

        # Create new member
        print('new member ')
        serializer = MemberSerializer(data=request.data, context={'request': request})
        if serializer.is_valid():
            member = serializer.save()

            try:
                member = request.user.member
            except AttributeError:
                member = Member.objects.get(user=request.user)

            excluded_fields = ['photo', 'photo_low_quality', 'nid_front', 'nid_back']
            member_data = model_to_dict(member, exclude=excluded_fields)

            create_audit_trail(
                member=member,
                event_type='MEMBER_CREATED',
                table_name='Member',
                row_id=member.id,
                old_data=None,
                new_data=member_data,
                description=f'New member "{member.full_name}" created successfully.'
            )

            return Response({"message": "User registered successfully"}, status=status.HTTP_201_CREATED)

        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

class CreateMemberForUnit(APIView):
    permission_classes = [IsAuthenticated, HasRequiredPermission]
    required_permission_id = [1]

    def post(self, request):
      

        full_name = request.data.get("full_name")
        general_email = request.data.get("general_email")
        general_contact = request.data.get("general_contact")
        nid_number = request.data.get("nid_number")

        if full_name and general_email and general_contact:
            existing_member = Member.objects.filter(
                full_name=full_name,
                general_email=general_email,
                general_contact=general_contact
            ).first()
            if existing_member:
                delivery_method = request.data.get("delivery_method", None)
                if delivery_method:
                    if "@" in delivery_method:
                        if Member.objects.filter(login_email=delivery_method).exclude(id=existing_member.id).exists():
                            return Response(
                                {"Error": "This email address is already in use. Please enter a different email."},
                                status=status.HTTP_400_BAD_REQUEST
                            )
                    elif delivery_method.isdigit():
                        if Member.objects.filter(login_contact=delivery_method).exclude(id=existing_member.id).exists():
                            return Response(
                                {"Error": "This contact number is already in use. Please enter a different contact number."},
                                status=status.HTTP_400_BAD_REQUEST
                            )
                        

                update_data = request.data.copy()
                update_data['is_comm_member'] = True  # Force to True
                update_data['comm_member_ever_created'] = True

                serializer = MemberSerializer(existing_member, data=update_data, partial=True, context={'request': request})
                if serializer.is_valid():
                    serializer.save()
                    return Response(
                        {
                            "message": "User registered successfully",
                            "member": {
                                "id": existing_member.id,
                                "full_name": existing_member.full_name
                            }
                        },
                        status=status.HTTP_200_OK
                    )
                return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
        if nid_number:
            if Member.objects.filter(nid_number=nid_number).exists():
                return Response(
                    {"error": "This NID number is already registered."},
                    status=status.HTTP_400_BAD_REQUEST
                )

        # Validate delivery_method if no existing member found
        delivery_method = request.data.get("delivery_method", None)
        if delivery_method:
            if "@" in delivery_method:
                if Member.objects.filter(login_email=delivery_method).exists():
                    return Response(
                        {"Error": "This email address is already in use. Please enter a different email."},
                        status=status.HTTP_400_BAD_REQUEST
                    )
            elif delivery_method.isdigit():
                if Member.objects.filter(login_contact=delivery_method).exists():
                    return Response(
                        {"Error": "This contact number is already in use. Please enter a different contact number."},
                        status=status.HTTP_400_BAD_REQUEST
                    )

        # Create new member (for_owner=True suppresses "New Organization Member Added" in favour of "New Owner Added")
        for_owner = request.data.get('for_owner') in (True, 'true', '1', 1)
        
        # Prepare data with forced community member flags to ensure email logic works correctly
        # We must copy request.data because it might be immutable
        member_data = request.data.copy()
        member_data['is_comm_member'] = True
        member_data['comm_member_ever_created'] = True
        # Force is_org_member to False as per original logic
        member_data['is_org_member'] = False
        
        serializer = MemberSerializer(data=member_data, context={'request': request, 'for_owner': for_owner})
        if serializer.is_valid():
            member = serializer.save()
            # Flags are already set via serializer, no need to save again

            excluded_fields = ['photo', 'photo_low_quality', 'nid_front', 'nid_back']
            member_data = model_to_dict(member, exclude=excluded_fields)

            create_audit_trail(
                member=member,
                event_type='MEMBER_CREATED',
                table_name='Member',
                row_id=member.id,
                old_data=None,
                new_data=member_data,
                description=f'New member "{member.full_name}" created successfully.'
            )

            return Response(
                {
                    "message": "User registered successfully",
                    "member": {
                        "id": member.id,
                        "full_name": member.full_name
                    }
                },
                status=status.HTTP_201_CREATED
            )
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)



class UpdateMember(APIView):
    permission_classes = [IsAuthenticated,HasRequiredPermission]
    # Here define the permission id in the database to have access of this view
    required_permission_id = [2]
    def put(self, request, pk):
        try:
            nid_in = request.data.get("nid_number", None)
            if nid_in:
                if Member.objects.exclude(pk=pk).filter(nid_number=nid_in).exists():
                    return Response(
                        {"nid_number": ["This NID number is already in use."]},
                        status=status.HTTP_400_BAD_REQUEST
                    )
            delivery_method = request.data.get("delivery_method", None)
            if delivery_method:
                if "@" in delivery_method:
                    if Member.objects.exclude(pk=pk).filter(login_email=delivery_method).exists():
                        return Response({"Error": "This email address is already in use. Please enter a different email."}, status=status.HTTP_400_BAD_REQUEST)
                elif delivery_method.isdigit():
                    if Member.objects.exclude(pk=pk).filter(login_contact=delivery_method).exists():
                        return Response({"Error": "This contact number is already in use. Please enter a different contact number."}, status=status.HTTP_400_BAD_REQUEST)
            member = Member.objects.get(pk=pk)
            old_data = model_to_dict(member, exclude=['photo', 'photo_low_quality', 'nid_front', 'nid_back'])
            serializer = MemberSerializer(member, data=request.data, partial=True,context={'request': request})
            if serializer.is_valid():
                updated_member = serializer.save()
                try:
                    member = request.user.member
                except AttributeError:
                    member = Member.objects.get(user=request.user)
                updated_data = model_to_dict(updated_member, exclude=['photo', 'photo_low_quality', 'nid_front', 'nid_back'])
                create_audit_trail(
                    member=updated_member,
                    event_type='MEMBER_UPDATED',
                    table_name='Member',
                    row_id=updated_member.id,
                    old_data=old_data,
                    new_data=updated_data,
                    description=f'Member "{updated_member.full_name}" updated successfully.'
                )
                return Response({"message": "User updated successfully"}, status=status.HTTP_200_OK)
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
        except Member.DoesNotExist:
            return Response({"error": "Member not found"}, status=status.HTTP_404_NOT_FOUND)


class ResendLoginCredentials(APIView):
    permission_classes = [IsAuthenticated, HasRequiredPermission]
    required_permission_id = [2]

    def post(self, request, pk):
        try:
            member = Member.objects.get(pk=pk)
        except Member.DoesNotExist:
            return Response({"error": "Member not found"}, status=status.HTTP_404_NOT_FOUND)

        if not member.login_email:
            return Response({"error": "Member does not have an email login set."}, status=status.HTTP_400_BAD_REQUEST)

        if not member.is_first_login:
            return Response(
                {"error": "User has already completed first login. Use forgot password instead."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        with transaction.atomic():
            if member.user is None:
                username = generate_random_username(full_name=member.full_name)
                password = generate_random_password()
                user = User.objects.create_user(username=username, password=password)
                member.user = user
            else:
                username = member.user.username
                password = generate_random_password()
                member.user.set_password(password)
                member.user.save()

            member.is_first_login = True
            member.save(update_fields=["user", "is_first_login"])

        MemberSerializer().send_welcome_email(
            member.login_email,
            username,
            password,
            is_comm_member=member.is_comm_member,
            is_org_member=member.is_org_member,
        )

        return Response({"message": "Login credentials email sent."}, status=status.HTTP_200_OK)
logger = logging.getLogger(__name__)
# Created By Injam
# Updated by Ankan
# Login Section
class LoginUser(APIView):
    def post(self, request): 
        authenticator = request.data.get('authenticator')
        password = request.data.get('password')
        login_type = request.data.get('login_type')
        if not authenticator or not password:
            return Response({'error': 'Credentials are required'}, status=status.HTTP_400_BAD_REQUEST)
        try:
            # Determine the user based on authenticator type.
            if "@" in authenticator:
                member = Member.objects.get(login_email=authenticator)
                user = member.user
            elif authenticator.isdigit():
                member = Member.objects.get(login_contact=authenticator)
                user = member.user
            else:
                user = User.objects.get(username=authenticator)
                member = Member.objects.get(user=user)
            if login_type == "org":
                if member.is_org_member == 0:
                    return Response('You do not have access', status=status.HTTP_403_FORBIDDEN)
            elif login_type == "comm":
                if member.is_comm_member == 0:
                    return Response('You do not have access', status=status.HTTP_403_FORBIDDEN)
            elif not login_type:
                    return Response('You do not have access', status=status.HTTP_403_FORBIDDEN)
            
            if user.check_password(password):
                if member.is_first_login:
                    # logger.info(f"First time login for user {user.username}")
                    return Response({
                        'message': 'First time login, please set your new password.',
                        'user_id': user.id
                    }, status=status.HTTP_307_TEMPORARY_REDIRECT)

                access_token = str(AccessToken.for_user(user))
                refresh_token = str(RefreshToken.for_user(user))
                permission_ids = list(member.get_permission_ids())

                # logger.info(f"Login successful for user {user.username}. Permissions: {permission_ids}")
                # logger.debug(f"Member data: {MemberSerializer(member).data}")

                return Response({
                    'message': 'Login successful',
                    'access_token': access_token,
                    'refresh_token': refresh_token,
                    'member': MemberSerializer(member).data,
                    'permission_ids': permission_ids
                }, status=status.HTTP_200_OK)

            # logger.warning(f"Invalid credentials for user {authenticator}")
            return Response('Invalid credentials', status=status.HTTP_400_BAD_REQUEST)

        except (Member.DoesNotExist, User.DoesNotExist) as e:
            # logger.error(f"Login error: {e} for authenticator {authenticator}")
            return Response('Invalid credentials', status=status.HTTP_400_BAD_REQUEST)

# Created By Injam
# Helper For setting new password for the first time user
class SetPassword(APIView):
    def post(self, request):
        user_id = request.data.get('user_id')
        if not user_id:
            return Response("User ID is required", status=status.HTTP_400_BAD_REQUEST)

        serializer = SetPasswordSerializer(data=request.data, context={'user_id': user_id})
        if serializer.is_valid():
            user = User.objects.get(id=user_id)
            user.set_password(serializer.validated_data['new_password'])
            user.save()

            # Mark the user as not needing to set password again
            user_profile = Member.objects.get(user=user)
            user_profile.is_first_login = False
            user_profile.save()

            return Response({"message": "Password updated successfully"}, status=status.HTTP_200_OK)

        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

# Created By Injam
# Check status of first time user login or not
class CheckStatus(APIView):
    def post(self, request):
        authenticator = request.data.get('authenticator')
        if not authenticator:
            return Response({"error": "Authenticator is required"}, status=status.HTTP_400_BAD_REQUEST)
        
        try:
            # Use login_email if authenticator contains '@'
            if "@" in authenticator:
                member = Member.objects.get(login_email=authenticator)
                user = member.user
            # Use login_contact if authenticator is numeric
            elif authenticator.isdigit():
                member = Member.objects.get(login_contact=authenticator)
                user = member.user
            # Fallback to username-based lookup
            else:
                user = User.objects.get(username=authenticator)
                member = Member.objects.get(user=user)
            
            return Response({
                "is_first_login": member.is_first_login,
                "user_id": user.id,
                "is_comm_member": getattr(member, 'is_comm_member', False),
                "is_org_member": getattr(member, 'is_org_member', False),
            }, status=status.HTTP_200_OK)
        except (Member.DoesNotExist, User.DoesNotExist):
            return Response("User not found", status=status.HTTP_404_NOT_FOUND)


# Created By Injam
class LogoutUser(APIView):
    authentication_classes = []  # Allow requests without authentication
    permission_classes = []       # No permission required

    def post(self, request):
        try:
            refresh_token = request.data.get('refresh_token')
            if not refresh_token:
                return Response({'error': 'Refresh token is required'}, status=status.HTTP_400_BAD_REQUEST)

            # 1. Identify the member to deactivate tokens
            member = None
            
            # Try getting from authenticated user first
            if request.user and request.user.is_authenticated:
                try:
                    member = request.user.member
                    logger.info(f"🔍 Found member {member.id} ({member.full_name}) from authenticated user (access token)")
                except Exception:
                    pass
            
            # If not found (e.g. access token expired), try getting from refresh token
            if not member and refresh_token:
                try:
                    token = RefreshToken(refresh_token)
                    user_id = token.payload.get('user_id')
                    if user_id:
                        member = Member.objects.get(user_id=user_id)
                        logger.info(f"🔍 Found member {member.id} ({member.full_name}) from refresh token payload")
                except Exception as e:
                    logger.warning(f"⚠️ Could not identify member from refresh token: {e}")
                    pass

            # 2. Deactivate ALL device tokens for this member
            if member:
                try:
                    updated_count = DeviceToken.objects.filter(
                        member=member,
                        is_active=True
                    ).update(is_active=False)
                    
                    if updated_count > 0:
                        logger.info(f"✅ Deactivated {updated_count} device token(s) for member {member.id} ({member.full_name}) during logout")
                    else:
                        logger.info(f"ℹ️ No active device tokens found for member {member.id} ({member.full_name})")
                except Exception as e:
                    logger.error(f"❌ Error deactivating device tokens during logout: {e}")
            else:
                logger.warning("⚠️ Could not identify member for device token deactivation during logout")
                # Fallback: deactivate by push_token directly if provided
                push_token_value = request.data.get('push_token')
                if push_token_value:
                    try:
                        updated = DeviceToken.objects.filter(
                            push_token=push_token_value,
                            is_active=True
                        ).update(is_active=False)
                        logger.info(f"✅ Deactivated {updated} token(s) by push_token fallback during logout")
                    except Exception as e:
                        logger.error(f"❌ Error deactivating token by push_token fallback: {e}")

            # 3. Blacklist the refresh token
            try:
                token = RefreshToken(refresh_token)
                token.blacklist()  # Blacklist the refresh token on logout
            except Exception as e:
                return Response({'error': str(e)}, status=status.HTTP_400_BAD_REQUEST)
                
            return Response({'message': 'Logout successful'}, status=status.HTTP_205_RESET_CONTENT)

        except TokenError as e:
            return Response({'detail': str(e)}, status=status.HTTP_400_BAD_REQUEST)

# Constants
OTP_VALIDITY_PERIOD = timedelta(minutes=2)      
RESEND_ATTEMPT_LIMIT = 4                            
RESEND_LOCK_PERIOD = timedelta(minutes=2)          
 
CACHE_TIMEOUT = int((OTP_VALIDITY_PERIOD + RESEND_LOCK_PERIOD).total_seconds())
# Step 1: Request OTP
class ForgotPasswordRequestOTP(APIView):
    def post(self, request):
        email = request.data.get('email')
        if not email:
            return Response({'error': 'Email is required'}, status=status.HTTP_400_BAD_REQUEST)
        
        # Normalize email: lowercase and strip whitespace for consistent cache keys
        email = email.strip().lower()
        
        try:
            member = Member.objects.get(login_email__iexact=email)
        except Member.DoesNotExist:
            return Response({'error': 'Email not found in our system.'}, status=status.HTTP_404_NOT_FOUND)
        
        if member.is_first_login == 0:
            otp = secrets.randbelow(900000) + 100000  
            now = timezone.now()
            
            # Store OTP data in cache using normalized email as part of the key
            cache.set(f'otp_{email}', {
                'otp': otp,
                'timestamp': now,
                'resend_count': 0,
                'last_resend_time': now
            }, timeout=CACHE_TIMEOUT)
            
            # Send HTML email with OTP
            context = {
                'otp': otp,
                'subject': 'Password Reset OTP',
            }
            
            send_html_email(
                subject='Password Reset OTP',
                template_name='user/emails/forgot_password_otp.html',
                context=context,
                recipient_list=[email],
                from_email=django_settings.EMAIL_HOST_USER,
            )
            
            return Response({'message': 'OTP sent to your email'}, status=status.HTTP_200_OK)
        else:
            return Response({'error': 'For first-time users, you must reset your password using the system-generated password.'}, status=status.HTTP_400_BAD_REQUEST)


# Step 2: Verify OTP
class ForgotPasswordVerifyOTP(APIView):
    def post(self, request):
        email = request.data.get('email')
        otp = request.data.get('otp')
        
        if not email or not otp:
            return Response({'error': 'Email and OTP are required'}, status=status.HTTP_400_BAD_REQUEST)
        
        # Normalize email: lowercase and strip whitespace for consistent cache keys
        email = email.strip().lower()
        
        data = cache.get(f'otp_{email}')
        if not data:
            return Response({'error': 'Invalid OTP. Please try again.'}, status=status.HTTP_400_BAD_REQUEST)
        
        now = timezone.now()
        if now > data['timestamp'] + OTP_VALIDITY_PERIOD:
            return Response({'error': 'OTP has expired. Please request a new OTP.'}, status=status.HTTP_400_BAD_REQUEST)
        
        try:
            otp_int = int(otp)
        except ValueError:
            return Response({'error': 'Invalid OTP'}, status=status.HTTP_400_BAD_REQUEST)
        
        if otp_int != data['otp']:
            return Response({'error': 'Invalid OTP'}, status=status.HTTP_400_BAD_REQUEST)
        
        return Response({'message': 'OTP verified. Proceed to reset password'}, status=status.HTTP_200_OK)


# Step 3: Set New Password
class ForgotPasswordSetNewPassword(APIView):
    def post(self, request):
        email = request.data.get('email')
        new_password = request.data.get('new_password')
        
        # Check if both email and new password are provided.
        if not email and not new_password:
            return Response({'error': 'New password is required. Confirm password is required.'}, status=status.HTTP_400_BAD_REQUEST)
        if not email:
            return Response({'error': 'Email is required'}, status=status.HTTP_400_BAD_REQUEST)
        if not new_password:
            return Response({'error': 'New password is required.'}, status=status.HTTP_400_BAD_REQUEST)
        
        # Normalize email: lowercase and strip whitespace for consistent cache keys
        email = email.strip().lower()
        
        try:
            member = Member.objects.get(login_email__iexact=email)
        except Member.DoesNotExist:
            return Response({'error': 'User with this email does not exist'}, status=status.HTTP_404_NOT_FOUND)
        
        # Password complexity validation (same as First-Time User flow)
        import re
        password_errors = []
        if len(new_password) < 8:
            password_errors.append("Password must be at least 8 characters long.")
        if not re.search(r'[!@#$%^&*]', new_password):
            password_errors.append("Password must contain at least one special character (!@#$%^&*).")
        if not re.search(r'[A-Z]', new_password):
            password_errors.append("Password must contain at least one uppercase letter.")
        if not re.search(r'[a-z]', new_password):
            password_errors.append("Password must contain at least one lowercase letter.")
        if not re.search(r'[0-9]', new_password):
            password_errors.append("Password must contain at least one number.")
        
        if password_errors:
            return Response({'error': ' '.join(password_errors)}, status=status.HTTP_400_BAD_REQUEST)
        
        user = member.user
        user.set_password(new_password)
        user.save()
        
        # Remove the OTP record from cache after a successful password reset.
        cache.delete(f'otp_{email}')
        
        return Response({'message': 'Your password has been successfully updated.'}, status=status.HTTP_200_OK)


# Step 4: Resend OTP
class ForgotPasswordResendOTP(APIView):
    def post(self, request):
        email = request.data.get('email')
        
        if not email:
            return Response({'error': 'Email is required'}, status=status.HTTP_400_BAD_REQUEST)
        
        # Normalize email: lowercase and strip whitespace for consistent cache keys
        email = email.strip().lower()
        
        try:
            member = Member.objects.get(login_email__iexact=email)
        except Member.DoesNotExist:
            return Response({'error': 'User with this email does not exist'}, status=status.HTTP_404_NOT_FOUND)
        
        data = cache.get(f'otp_{email}')
        now = timezone.now()
        
        if data:
            if data['resend_count'] >= RESEND_ATTEMPT_LIMIT:
                if now < data['last_resend_time'] + RESEND_LOCK_PERIOD:
                    return Response({'error': 'Too many resend attempts. Please try again later.'}, 
                                    status=status.HTTP_429_TOO_MANY_REQUESTS)
                else:
                    data['resend_count'] = 0
        
        otp = secrets.randbelow(900000) + 100000
        new_data = {
            'otp': otp,
            'timestamp': now,
            'resend_count': (data['resend_count'] + 1) if data else 1,
            'last_resend_time': now
        }
        cache.set(f'otp_{email}', new_data, timeout=CACHE_TIMEOUT)
        
        # Send HTML email with new OTP
        context = {
            'otp': otp,
            'subject': 'Password Reset OTP',
        }
        
        send_html_email(
            subject='Password Reset OTP',
            template_name='user/emails/forgot_password_otp.html',
            context=context,
            recipient_list=[email],
            from_email=django_settings.EMAIL_HOST_USER,
        )
        
        return Response({'message': 'New OTP sent to your email'}, status=status.HTTP_200_OK)




class MemberDetailsForResident(APIView):
    def get(self, request, member_id, format=None):
        try:
            member = Member.objects.get(id=member_id)
        except Member.DoesNotExist:
            return Response({"error": "Member not found."}, status=status.HTTP_404_NOT_FOUND)
        serializer = MemberSerializer(member)
        return Response(serializer.data, status=status.HTTP_200_OK)







    
    


class CompanyView(APIView):
#     permission_classes = [IsAuthenticated]

#     def validate_photo(self, photo):
#         if photo:
#             valid_mime_types = ['image/jpeg', 'image/png']
#             valid_extensions = ['.jpg', '.jpeg', '.png']
#             ext = os.path.splitext(photo.name)[1].lower()
#             mime_type = photo.content_type

#             if mime_type not in valid_mime_types:
#                 raise serializers.ValidationError('Only JPEG and PNG files are allowed.')
#             if ext not in valid_extensions:
#                 raise serializers.ValidationError('Unsupported file extension.')
#         return photo


    def get(self, request):
            # Get the search parameter from query params (if available)
            search_term = request.query_params.get('search', '').strip()  # Default to empty string if not provided

            # Print search_term for debugging purposes (remove this in production)
            # print("Search parameter:", request)
           

            # If a search term is provided, filter the companies, otherwise return all
            if search_term:
                companies = Company.objects.select_related('member').filter(
                Q(company_name__icontains=search_term) |
                Q(member__full_name__icontains=search_term) |
                Q(member__general_contact__icontains=search_term) |
                Q(member__general_email__icontains=search_term)
                ) 
                
                message = f"Company data filtered by '{search_term}'"
            else:
                companies = Company.objects.select_related('member').all()
                message = "All company and member data loaded"

            # Serialize the data
            serializer = CompanySerializerlist(companies, many=True)

            # Return the response with the filtered or all company data
            return Response(
                {"company": serializer.data, "message": message},
                status=status.HTTP_200_OK
            )




    
    
    def validate_photo(self, photo):
        if photo:
            valid_mime_types = ['image/jpeg', 'image/png']
            valid_extensions = ['.jpg', '.jpeg', '.png']
            ext = os.path.splitext(photo.name)[1].lower()
            mime_type = photo.content_type

            if mime_type not in valid_mime_types:
                raise serializers.ValidationError('Only JPEG and PNG files are allowed.')
            if ext not in valid_extensions:
                raise serializers.ValidationError('Unsupported file extension.')
        return photo

    
    # def post(self, request):
    #     try:
    #         data = request.data
    #         data = data.get('data', data)
    #         delivery_method= data.get('delivery_method')
           
    #         member_serializer = MemberSerializer(data=data, context={'request': request})
    #         if not member_serializer.is_valid():
    #             print("Validation Errors:", member_serializer.errors)  # Helpful debug print
    #             return Response({'error': member_serializer.errors}, status=status.HTTP_400_BAD_REQUEST)

    #         member = member_serializer.save()

    #         # # Validate optional company photo
    #         photo = request.FILES.get('photo')
    #         self.validate_photo(photo)

    #         # Get and validate Unit
    #         company_data = data.get('data', data)
    #         # company_data['unit_id']=1
      
    #         unit_id = data.get('unit_id') or data.get('unit_id')
    #         # if not unit_id:
    #         #     return Response({'error': 'Unit ID is required.'}, status=status.HTTP_400_BAD_REQUEST)

    #         # try:
    #         #     unit = Unit.objects.get(id=unit_id)
    #         # except ObjectDoesNotExist:
    #         #     return Response({'error': 'Unit not found.'}, status=status.HTTP_404_NOT_FOUND)

    #         created_by = request.user.id
    #         print(request.user.id,member.id,created_by)
    #         # Create the Company object
         
    #         company = {
    #             "company_name": data.get("company_name"),
    #             "member": member.id,
    #             "unit": unit_id,
    #             "created_by": created_by,
    #          }

    #         company_serializer = CompanySerializer(data=company, context={'request': request})
    #         if company_serializer.is_valid():
    #             company = company_serializer.save()
    #             return Response({'data': company_serializer.data, 'message': 'Company created successfully.'}, status=status.HTTP_201_CREATED)
    #         else:
    #             return Response({'error': company_serializer.errors}, status=status.HTTP_400_BAD_REQUEST)
                        
                        
     
    #         # return Response({'data':'test', 'message': 'Company and member created successfully.'},
    #         #                 status=status.HTTP_201_CREATED)

    #     except Exception as e:
    #         import traceback
    #         traceback.print_exc()  # for debugging during development
    #         return Response({'error': str(e)}, status=status.HTTP_400_BAD_REQUEST)
    # def post(self, request):
        
    #     with transaction.atomic():
    #         try:
    #             # return Response({'error':''}, status=status.HTTP_404_NOT_FOUND)
    #             data = request.data.get('data', request.data)
    #             member_id = data.get("member_id")
    #             unit_id = data.get("unit_id")
    #             is_first_login = data.get("is_first_login")
    #             delivery_method=data.get('delivery_method')
       
    #             member = None
    #             login = data.get("login")

       

    #             if delivery_method:
    #                 # Basic email check
    #                 if re.match(r"[^@]+@[^@]+\.[^@]+", delivery_method):
    #                     login_email = delivery_method
    #                     if Member.objects.filter(login_email=login_email).exclude(id=member_id).exists():
    #                         return Response({'error': 'This email address is already in use. Please enter a different email.'}, status=status.HTTP_400_BAD_REQUEST)
                    
    #                 # Basic phone number check (e.g., 10-15 digits, optional +)
    #                 elif re.match(r"^\+?\d{10,15}$", delivery_method):
    #                     login_contact = delivery_method
    #                     if Member.objects.filter(login_contact=login_contact).exclude(id=member_id).exists():
    #                         return Response({'error': 'This contact number is already in use. Please enter a different number.'}, status=status.HTTP_400_BAD_REQUEST)
                    
    #                 else:
    #                     return Response({'error': 'Invalid delivery method. Please enter a valid email or phone number.'}, status=status.HTTP_400_BAD_REQUEST)
                                
                            
    #             if member_id:
    #                 try:
    #                     member_obj = Member.objects.get(id=member_id)
    #                     member_serializer = MemberSerializer(member_obj, data=data, partial=True, context={'request': request})
    #                 except Member.DoesNotExist:
    #                     return Response({'message': 'Member not found.'}, status=status.HTTP_404_NOT_FOUND)
    #             else:
    #                 member_serializer = MemberSerializer(data=data, context={'request': request})
    #                 # print('data', data)

    #             if not member_serializer.is_valid():
    #                 traceback.print_exc()
    #                 return Response({'error':member_serializer.errors }, status=status.HTTP_400_BAD_REQUEST)

    #             # Now save the member
    #             member = member_serializer.save()

    #             # COMPANY CREATE/UPDATE
    #             company_data = {
    #                 "company_name": data.get("company_name"),
    #                 "member": member.id,
    #                 "unit": unit_id,
    #             }

    #             company = Company.objects.filter(member=member).first()
    #             if company:
    #                 company_serializer = CompanySerializer(company, data=company_data, partial=True, context={'request': request})
    #                 company_msg = "Company updated successfully."
    #                 company_status = status.HTTP_200_OK
    #             else:
    #                 company_serializer = CompanySerializer(data=company_data, context={'request': request})
    #                 company_msg = "Company created successfully."
    #                 company_status = status.HTTP_201_CREATED

    #             if company_serializer.is_valid():
    #                 company = company_serializer.save()
    #                 company.created_by_id = request.user.id
    #                 company.save()
    #             else:
    #                 traceback.print_exc()
    #                 return Response({'error': company_serializer.errors}, status=status.HTTP_400_BAD_REQUEST)

    #             return Response({
    #                 'data': CompanySerializer(company).data,
    #                 'message': company_msg
    #             }, status=company_status)

    #         except Exception as e:
                
    #             traceback.print_exc()
    #             return Response({'error': 'Something went wrong. Please try again.'}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
    

    def post(self, request):
        with transaction.atomic():
            try:
                data = request.data.get('data', request.data)
                member_id = data.get("member_id")
                unit_id = data.get("unit_id")
                is_first_login = data.get("is_first_login")
                delivery_method = data.get('delivery_method')

                member = None
                login = data.get("login")

                if delivery_method:
                    if re.match(r"[^@]+@[^@]+\.[^@]+", delivery_method):
                        login_email = delivery_method
                        if Member.objects.filter(login_email=login_email).exclude(id=member_id).exists():
                            return Response({'error': 'This email address is already in use. Please enter a different email.'}, status=status.HTTP_400_BAD_REQUEST)

                    elif re.match(r"^\+?\d{10,15}$", delivery_method):
                        login_contact = delivery_method
                        if Member.objects.filter(login_contact=login_contact).exclude(id=member_id).exists():
                            return Response({'error': 'This contact number is already in use. Please enter a different number.'}, status=status.HTTP_400_BAD_REQUEST)
                    else:
                        return Response({'error': 'Invalid delivery method. Please enter a valid email or phone number.'}, status=status.HTTP_400_BAD_REQUEST)

                old_member_data = None
                if member_id:
                    try:
                        member_obj = Member.objects.get(id=member_id)
                        old_member_data = MemberSerializer(member_obj).data
                        member_serializer = MemberSerializer(member_obj, data=data, partial=True, context={'request': request})
                    except Member.DoesNotExist:
                        return Response({'message': 'Member not found.'}, status=status.HTTP_404_NOT_FOUND)
                else:
                    member_serializer = MemberSerializer(data=data, context={'request': request})

                if not member_serializer.is_valid():
                    traceback.print_exc()
                    transaction.set_rollback(True) 
                    return Response({'error': member_serializer.errors}, status=status.HTTP_400_BAD_REQUEST)

                member = member_serializer.save()
                new_member_data = MemberSerializer(member).data

                create_audit_trail(
                    member=member,
                    event_type='MEMBER_UPDATED' if old_member_data else 'MEMBER_CREATED',
                    table_name='Member',
                    row_id=member.id,
                    old_data=old_member_data,
                    new_data=new_member_data,
                    description=f'Member "{member.full_name}" {"updated" if old_member_data else "created"} successfully.'
                )

                # COMPANY CREATE/UPDATE
                company_data = {
                    "company_name": data.get("company_name"),
                    "member": member.id,
                    "unit": unit_id,
                }

                company = Company.objects.filter(member=member).first()
                old_company_data = CompanySerializer(company).data if company else None

                if company:
                    company_serializer = CompanySerializer(company, data=company_data, partial=True, context={'request': request})
                    company_msg = "Company updated successfully."
                    company_status = status.HTTP_200_OK
                else:
                    company_serializer = CompanySerializer(data=company_data, context={'request': request})
                    company_msg = "Company created successfully."
                    company_status = status.HTTP_201_CREATED

                if company_serializer.is_valid():
                    company = company_serializer.save()
                    company.created_by = member
                    company.save()

                    new_company_data = CompanySerializer(company).data

                    # ✅ Fix: Again, use member, not request.user
                    create_audit_trail(
                        member=member,
                        event_type='COMPANY_UPDATED' if old_company_data else 'COMPANY_CREATED',
                        table_name='Company',
                        row_id=company.id,
                        old_data=old_company_data,
                        new_data=new_company_data,
                        description=f'Company "{company.company_name}" {"updated" if old_company_data else "created"} successfully.'
                    )
                else:
                    traceback.print_exc()
                    transaction.set_rollback(True) 
                    # Example usage in a view
                    return Response({'error': flatten_errors(company_serializer.errors)}, status=status.HTTP_400_BAD_REQUEST)

                    # return Response({'error': company_serializer.errors}, status=status.HTTP_400_BAD_REQUEST)

                return Response({
                    'data': CompanySerializer(company).data,
                    'message': company_msg
                }, status=company_status)

            except Exception as e:
                traceback.print_exc()
                transaction.set_rollback(True)
                return Response({'error': 'Something went wrong. Please try again.'}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

        
class AddExistingCommMemberList(APIView):
    permission_classes = [IsAuthenticated, HasRequiredPermission]
    # required_permission_id = [3]
    def get(self, request, format=None):
        member_types = request.GET.getlist("member_type")
        search_query = request.GET.get("search", "").strip().lower()
        if len(search_query) < 3:
            search_query = None

        data = {
            'owners': [],
            'comm_members': [],
            'resident_members': [],
            'unit_staff': []
        }

        show_all = not member_types and not search_query

                # --- OWNERS ---
        if show_all or "owner" in member_types or search_query:
            # Only include community members who are not org members
            owners = Owner.objects.filter(member__is_org_member=False)
            if search_query:
                owners = owners.filter(
                    Q(member__full_name__icontains=search_query) |
                    Q(member__general_contact__icontains=search_query) |
                    Q(member__general_email__icontains=search_query)
                )
            owner_serializer = AddExistingOwners(owners, many=True)
            data["owners"] = owner_serializer.data

        # --- UNIT STAFF ---
        if show_all or "unit_staff" in member_types or search_query:
            # Only include community members who are not org members
            unit_staff_qs = UnitStaff.objects.filter(
                is_active=True,
                member__is_org_member=False
            )
            if search_query:
                unit_staff_qs = unit_staff_qs.filter(
                    Q(member__full_name__icontains=search_query) |
                    Q(member__general_contact__icontains=search_query) |
                    Q(member__general_email__icontains=search_query)
                )
            staff_serializer = UnitStaffMemberSerializerForCommMember(unit_staff_qs, many=True)
            data["unit_staff"] = staff_serializer.data

        # # # --- COMM MEMBERS ---
        # if show_all or (member_types and any(m not in ["owner", "resident", "unit_staff"] for m in member_types)) or search_query:
        #     owner_member_ids = Owner.objects.values_list("member_id", flat=True)
        #     resident_member_ids = Resident.objects.values_list("member_id", flat=True)
        #     staff_member_ids = UnitStaff.objects.values_list("member_id", flat=True)

        #     exclude_ids = set(owner_member_ids) | set(resident_member_ids) | set(staff_member_ids)

        #     comm_members = Member.objects.filter(is_comm_member=True).exclude(id__in=exclude_ids)

        #     if member_types:
        #         comm_members = comm_members.filter(
        #             member_type__in=[m for m in member_types if m not in ["owner", "resident", "unit_staff"]]
        #         )

        #     if search_query:
        #         comm_members = comm_members.filter(
        #             Q(full_name__icontains=search_query) |
        #             Q(general_contact__icontains=search_query) |
        #             Q(general_email__icontains=search_query)
        #         )

        #     comm_member_serializer = MemberSerializer(comm_members, many=True)
        #     data["comm_members"] = comm_member_serializer.data

        # --- RESIDENTS ---
        # Handle both "resident" and "resident_tenant" types
        wants_resident = "resident" in member_types
        wants_tenant = "resident_tenant" in member_types
        
        if show_all or wants_resident or wants_tenant or search_query:
            # Only include community members who are not org members
            residents_qs = Resident.objects.filter(
                is_active=True,
                member__is_org_member=False
            ).order_by("id")
            
            # Filter by resident type if specific type is requested
            if not show_all and not search_query:
                if wants_resident and not wants_tenant:
                    # Only residents (is_resident_or_tenant=True)
                    residents_qs = residents_qs.filter(is_resident_or_tenant=True)
                elif wants_tenant and not wants_resident:
                    # Only tenants (is_resident_or_tenant=False)
                    residents_qs = residents_qs.filter(is_resident_or_tenant=False)
                # If both are selected, show all residents (no additional filter needed)
            
            if search_query:
                residents_qs = residents_qs.filter(
                    Q(member__full_name__icontains=search_query) |
                    Q(member__general_contact__icontains=search_query) |
                    Q(member__general_email__icontains=search_query)
                )

            seen_member_ids = set()
            distinct_residents = []
            for resident in residents_qs:
                if resident.member.id not in seen_member_ids:
                    seen_member_ids.add(resident.member.id)
                    distinct_residents.append(resident)

            resident_serializer = AddExistingResident(distinct_residents, many=True)
            data["resident_members"] = resident_serializer.data
        # print(data)
        return Response(data)

class GetUserTowerUnit(APIView):
    permission_classes = [IsAuthenticated]
    
    def get(self, request):
        """Get the current user's tower and unit IDs"""
        try:
            member = Member.objects.get(user=request.user)
            
            # Try to get tower and unit IDs from ownership first
            owner_record = (
                Owner.objects
                .filter(member=member)
                .select_related('unit__floor__tower')
                .first()
            )
            
            if owner_record:
                return Response({
                    'tower_id': owner_record.unit.floor.tower.id,
                    'tower_name': owner_record.unit.floor.tower.tower_name,
                    'unit_id': owner_record.unit.id,
                    'unit_name': owner_record.unit.unit_name
                })
            
            # If not an owner, try to get from residency
            resident_record = (
                Resident.objects
                .filter(member=member, is_active=True)
                .select_related('unit__floor__tower')
                .first()
            )
            
            if resident_record:
                return Response({
                    'tower_id': resident_record.unit.floor.tower.id,
                    'tower_name': resident_record.unit.floor.tower.tower_name,
                    'unit_id': resident_record.unit.id,
                    'unit_name': resident_record.unit.unit_name
                })
            
            # If not found in either, return null
            return Response({
                'tower_id': None,
                'tower_name': None,
                'unit_id': None,
                'unit_name': None
            })
            
        except Member.DoesNotExist:
            return Response({'error': 'Member not found'}, status=status.HTTP_404_NOT_FOUND)
        except Exception as e:
            return Response({'error': 'Something went wrong'}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


class MyProfile(APIView):
    permission_classes = [IsAuthenticated]  # Only authentication required, no special permissions

    def get(self, request):
        """Get current user's own profile details"""
        try:
            # Get the member associated with the authenticated user
            member = Member.objects.get(user=request.user)
            
            # Serialize the member data
            member_serializer = MemberSerializer(member)
            
            # Get all Owner, Resident, and UnitStaff records for this member
            owners = Owner.objects.filter(member=member)
            residents = Resident.objects.filter(member=member, is_active=True)
            staff = UnitStaff.objects.filter(member=member, is_active=True)
            
            # Serialize them
            owner_serializer = OwnerSerializer(owners, many=True, context={'request': request})
            resident_serializer = ResidentSerializer(residents, many=True, context={'request': request})
            staff_serializer = UnitStaffSerializer(staff, many=True, context={'request': request})
            
            return Response({
                'member': member_serializer.data,
                'owners': owner_serializer.data,
                'residents': resident_serializer.data,
                'staff': staff_serializer.data,
            })
            
        except Member.DoesNotExist:
            return Response({"error": "Member profile not found"}, status=status.HTTP_404_NOT_FOUND)
    
    def put(self, request):
        """Update current user's own profile"""
        try:
            # Get the member associated with the authenticated user
            member = Member.objects.get(user=request.user)
            
            # Check for NID number conflicts (excluding current user)
            nid_in = request.data.get("nid_number", None)
            if nid_in:
                if Member.objects.exclude(pk=member.pk).filter(nid_number=nid_in).exists():
                    return Response(
                        {"nid_number": ["This NID number is already in use."]},
                        status=status.HTTP_400_BAD_REQUEST
                    )
            
            # Check for delivery method conflicts (excluding current user)
            delivery_method = request.data.get("delivery_method", None)
            if delivery_method:
                if "@" in delivery_method:
                    if Member.objects.exclude(pk=member.pk).filter(login_email=delivery_method).exists():
                        return Response(
                            {"Error": "This email address is already in use. Please enter a different email."}, 
                            status=status.HTTP_400_BAD_REQUEST
                        )
                elif delivery_method.isdigit():
                    if Member.objects.exclude(pk=member.pk).filter(login_contact=delivery_method).exists():
                        return Response(
                            {"Error": "This contact number is already in use. Please enter a different contact number."}, 
                            status=status.HTTP_400_BAD_REQUEST
                        )
            
            # Store old data for audit trail
            old_data = model_to_dict(member, exclude=['photo', 'photo_low_quality', 'nid_front', 'nid_back'])
            
            # Update the member using the serializer
            serializer = MemberSerializer(member, data=request.data, partial=True, context={'request': request})
            if serializer.is_valid():
                updated_member = serializer.save()
                
                # Store new data for audit trail
                updated_data = model_to_dict(updated_member, exclude=['photo', 'photo_low_quality', 'nid_front', 'nid_back'])
                
                # Create audit trail
                create_audit_trail(
                    member=updated_member,
                    event_type='PROFILE_UPDATED',
                    table_name='Member',
                    row_id=updated_member.id,
                    old_data=old_data,
                    new_data=updated_data,
                    description=f'Profile updated by user "{updated_member.full_name}".'
                )
                
                # Return the updated member data
                member_serializer = MemberSerializer(updated_member)
                return Response(member_serializer.data, status=status.HTTP_200_OK)
            
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
            
        except Member.DoesNotExist:
            return Response({"error": "Member profile not found"}, status=status.HTTP_404_NOT_FOUND)


class AcceptTermsAndConditions(APIView):
    """
    Accept terms and conditions for the current authenticated user.
    """
    permission_classes = [IsAuthenticated]

    def post(self, request):
        try:
            from django.utils import timezone
            member = Member.objects.get(user=request.user)
            
            # Update terms acceptance
            member.terms_accepted = True
            member.terms_accepted_at = timezone.now()
            member.terms_version = request.data.get('terms_version', '1.0')  # You can version your terms
            member.save()
            
            return Response({
                "message": "Terms and conditions accepted successfully",
                "terms_accepted": True,
                "terms_accepted_at": member.terms_accepted_at
            }, status=status.HTTP_200_OK)
            
        except Member.DoesNotExist:
            return Response({"error": "Member profile not found"}, status=status.HTTP_404_NOT_FOUND)
        except Exception as e:
            return Response({"error": str(e)}, status=status.HTTP_400_BAD_REQUEST)


class CheckTermsStatus(APIView):
    """
    Check if the current authenticated user has accepted the latest terms and conditions.
    This is used to enforce terms acceptance on dashboard load/refresh.
    """
    permission_classes = [IsAuthenticated]

    def get(self, request):
        try:
            member = Member.objects.get(user=request.user)
            
            return Response({
                "terms_accepted": member.terms_accepted,
                "terms_accepted_at": member.terms_accepted_at,
                "terms_version": member.terms_version,
                "user_id": member.id
            }, status=status.HTTP_200_OK)
            
        except Member.DoesNotExist:
            return Response({"error": "Member profile not found"}, status=status.HTTP_404_NOT_FOUND)
        except Exception as e:
            return Response({"error": str(e)}, status=status.HTTP_400_BAD_REQUEST)


class MyPermissions(APIView):
    """
    Returns the current authenticated user's permission IDs.
    Useful for refreshing frontend permission cache after role changes.
    """
    permission_classes = [IsAuthenticated]

    def get(self, request):
        try:
            member = Member.objects.get(user=request.user)
            permission_ids = list(member.get_permission_ids())
            return Response({
                'permission_ids': permission_ids
            }, status=status.HTTP_200_OK)
        except Member.DoesNotExist:
            return Response({"permission_ids": []}, status=status.HTTP_200_OK)


class BlockUserView(APIView):
    """
    Block a user. Blocked user's bulletins and notifications will be hidden.
    POST /user/block/<member_id>/
    """
    permission_classes = [IsAuthenticated]

    def post(self, request, member_id):
        try:
            blocker = Member.objects.get(user=request.user)
        except Member.DoesNotExist:
            return Response({"error": "Your member profile was not found."}, status=status.HTTP_404_NOT_FOUND)

        # Prevent self-blocking
        if blocker.id == member_id:
            return Response({"error": "You cannot block yourself."}, status=status.HTTP_400_BAD_REQUEST)

        # Check if target member exists
        try:
            blocked_member = Member.objects.get(pk=member_id)
        except Member.DoesNotExist:
            return Response({"error": "Member not found."}, status=status.HTTP_404_NOT_FOUND)

        # Check if already blocked
        if BlockedUser.objects.filter(blocker=blocker, blocked=blocked_member).exists():
            return Response({"message": "User is already blocked."}, status=status.HTTP_200_OK)

        # Create the block
        BlockedUser.objects.create(blocker=blocker, blocked=blocked_member)
        
        return Response({
            "message": f"Successfully blocked {blocked_member.full_name}.",
            "blocked_member_id": blocked_member.id,
            "blocked_member_name": blocked_member.full_name
        }, status=status.HTTP_201_CREATED)


class UnblockUserView(APIView):
    """
    Unblock a previously blocked user.
    POST /user/unblock/<member_id>/
    """
    permission_classes = [IsAuthenticated]

    def post(self, request, member_id):
        try:
            blocker = Member.objects.get(user=request.user)
        except Member.DoesNotExist:
            return Response({"error": "Your member profile was not found."}, status=status.HTTP_404_NOT_FOUND)

        # Find and delete the block
        deleted_count, _ = BlockedUser.objects.filter(blocker=blocker, blocked_id=member_id).delete()

        if deleted_count == 0:
            return Response({"error": "This user is not in your blocked list."}, status=status.HTTP_404_NOT_FOUND)

        return Response({
            "message": "User unblocked successfully.",
            "unblocked_member_id": member_id
        }, status=status.HTTP_200_OK)


class BlockedMembersListView(APIView):
    """
    List all members blocked by the current user.
    GET /user/blocked_members/
    """
    permission_classes = [IsAuthenticated]

    def get(self, request):
        try:
            member = Member.objects.get(user=request.user)
        except Member.DoesNotExist:
            return Response({"error": "Your member profile was not found."}, status=status.HTTP_404_NOT_FOUND)

        blocked_entries = BlockedUser.objects.filter(blocker=member).select_related('blocked')

        blocked_list = []
        for entry in blocked_entries:
            blocked_member = entry.blocked
            photo_url = None
            if blocked_member.photo:
                photo_url = request.build_absolute_uri(blocked_member.photo.url)
            
            blocked_list.append({
                "id": blocked_member.id,
                "full_name": blocked_member.full_name,
                "photo": photo_url,
                "blocked_at": entry.created_at.isoformat()
            })

        return Response(blocked_list, status=status.HTTP_200_OK)