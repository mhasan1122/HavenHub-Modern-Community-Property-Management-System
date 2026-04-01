from rest_framework import serializers
from django.contrib.auth.models import User
from .models import Member,MemberType,Company
from group_role.models import MembersRole,Role,GroupMembers,RoleGroup
import random,string
from datetime import date,datetime
from django.core.mail import send_mail
from django.conf import settings
from user.email_utils import send_html_email
from io import BytesIO
from PIL import Image
from django.core.files.uploadedfile import InMemoryUploadedFile
import sys
from rest_framework.response import Response
from rest_framework import status
from django.db import transaction
import os
from django.utils import timezone
from .models import Company
from user.models import Member 
from towers.models import Unit, Owner, Resident  
from django.db import IntegrityError
import json
from django.conf import settings
from rest_framework_simplejwt.serializers import TokenRefreshSerializer
from rest_framework_simplejwt.exceptions import InvalidToken

# Global login link from settings - used in email notifications
LOGIN_LINK = settings.LOGIN_LINK
APP_DOWNLOAD_LINK = getattr(settings, 'APP_DOWNLOAD_LINK', 'https://play.google.com/apps/internaltest/4701408139020918392')

# Custom Token Refresh Serializer to handle deleted users gracefully
class CustomTokenRefreshSerializer(TokenRefreshSerializer):
    """
    Custom token refresh serializer that catches DoesNotExist errors
    when a user referenced in the token has been deleted from the database.
    Returns a proper 401 error instead of 500 Internal Server Error.
    """
    def validate(self, attrs):
        try:
            return super().validate(attrs)
        except User.DoesNotExist:
            raise InvalidToken({
                'detail': 'User account no longer exists. Please log in again.',
                'code': 'user_not_found'
            })

# Created by Ankan

class MemberTypeSerializer(serializers.ModelSerializer):
    class Meta:
        model = MemberType
        fields = '__all__'


# Function to generate a username in format fullname_XXXX with system-enforced uniqueness
def generate_random_username(full_name=None):
    """
    Generate username in format: fullname_XXXX
    - fullname: sanitized version of full_name (lowercase, spaces to underscores, special chars removed)
    - XXXX: 4-digit unique identifier
    - System-enforced uniqueness by checking existing usernames
    """
    import re
    
    if full_name:
        # Sanitize full_name: lowercase, replace spaces with underscores, remove special characters
        # Keep only alphanumeric characters and underscores
        sanitized_name = re.sub(r'[^a-zA-Z0-9\s]', '', full_name)  # Remove special chars first
        sanitized_name = sanitized_name.lower().strip()  # Convert to lowercase and trim
        sanitized_name = re.sub(r'\s+', '_', sanitized_name)  # Replace spaces with underscores
        sanitized_name = re.sub(r'_+', '_', sanitized_name)  # Replace multiple underscores with single
        sanitized_name = sanitized_name.strip('_')  # Remove leading/trailing underscores
        
        # If sanitized name is empty or too short, use 'user' as fallback
        if not sanitized_name or len(sanitized_name) < 2:
            sanitized_name = 'user'
        
        # Truncate if too long (Django username max_length is 150, we need space for '_' + 4 digits = 5 chars)
        # So max name length is 145 characters
        max_name_length = 145
        if len(sanitized_name) > max_name_length:
            sanitized_name = sanitized_name[:max_name_length]
    else:
        sanitized_name = 'user'
    
    # Generate unique 4-digit suffix
    max_attempts = 1000  # Prevent infinite loop
    attempt = 0
    
    while attempt < max_attempts:
        suffix = random.randint(1000, 9999)
        username = f"{sanitized_name}_{suffix}"
        
        # Check for uniqueness
        if not User.objects.filter(username=username).exists():
            return username
        
        attempt += 1
    
    # Fallback: if we can't find unique username with fullname, use timestamp-based approach
    import time
    timestamp_suffix = int(time.time()) % 10000
    username = f"{sanitized_name}_{timestamp_suffix}"
    
    # Final uniqueness check with timestamp
    counter = 0
    while User.objects.filter(username=username).exists() and counter < 100:
        timestamp_suffix = (timestamp_suffix + 1) % 10000
        username = f"{sanitized_name}_{timestamp_suffix}"
        counter += 1
    
    return username

# Function to generate a numeric-only password
def generate_random_password():
    """
    Generate numeric-only password for first-time users.
    Default length: 8 digits (can be customized)
    """
    length = 8  # 8-digit numeric password
    password = ''.join(random.choice(string.digits) for _ in range(length))
    return password

# User Serializer to handle the User creation logic
class UserSerializer(serializers.ModelSerializer):
    password = serializers.CharField(write_only=True, required=False)  # password is optional during serialization
    username = serializers.CharField(required=False)
    class Meta:
        model = User
        fields = ['username', 'email', 'password']

    def create(self, validated_data):
        email = validated_data.get('email')  # The email is provided in the payload
        # Note: UserSerializer doesn't have access to full_name, so it uses default 'user' prefix
        username = validated_data.get('username', generate_random_username())  # Auto-generate the username if not provided
        password = validated_data.get('password', generate_random_password())  # Generate password if not provided
        print('Username is:',username,'Password is:',password)
        # Create the user with the email, username, and password
        user = User.objects.create_user(username=username, email=email, password=password)
        return user,password,username

# MemberSerializer to handle creating both the User and Member models
class MemberSerializer(serializers.ModelSerializer):
      # Use the UserSerializer to create a nested user
    user = UserSerializer(required=False)
    photo = serializers.ImageField(required=False)
    nid_front = serializers.ImageField(required=False)
    nid_back = serializers.ImageField(required=False)
    members_role =serializers.ListField(required=False)
    
    date_of_birth = serializers.CharField(required=False)
    delivery_method = serializers.CharField(required=False)
    general_contact = serializers.CharField(required=False, allow_null=False, allow_blank=True)
    nid_number = serializers.CharField(
        required=False,
        allow_null=True,
        allow_blank=True
    )
    
    def validate_general_contact(self, value):
        """Validate that contact number does not exceed 11 characters"""
        if value and len(str(value)) > 11:
            raise serializers.ValidationError(
                f"Contact number cannot be more than 11 characters (current: {len(str(value))})"
            )
        return value

    photo_removed = serializers.CharField(required=False)
    nid_front_removed = serializers.CharField(required=False)
    nid_back_removed = serializers.CharField(required=False)
    delete_role = serializers.ListField(
        child=serializers.IntegerField(), required=False, write_only=True
    )
    def get_members_role(self, obj):
        """
        Fetch member roles, including the assignment id and any group
        provenance so the frontend can show when a role arrived via a group.
        """
        members_roles = MembersRole.objects.filter(
            member=obj
        ).select_related("role")

        # Build a lookup of role_id -> [group names] for the groups this member
        # belongs to. This lets us show which group provided a role, even if the
        # role id is the same as a direct assignment.
        member_group_ids = list(
            GroupMembers.objects.filter(member=obj).values_list("group_id", flat=True)
        )
        group_role_map = {}
        if member_group_ids:
            for rg in RoleGroup.objects.filter(group_id__in=member_group_ids).select_related(
                "group"
            ):
                group_role_map.setdefault(rg.role_id, []).append(rg.group.group_name)

        return [
            {
                "id": mr.role.id,
                "assignment_id": mr.id,
                "role_name": mr.role.role_name,
                "is_member": mr.is_member,
                "is_group": mr.is_group,
                "group_names": group_role_map.get(mr.role_id, []) if mr.is_group else [],
            }
            for mr in members_roles
        ]
    def get_members_group(self, obj):
        """ Fetch all MembersRole objects related to this member. """
        members_group = GroupMembers.objects.filter(member=obj)
        return [
            {
                "group_name": mg.group.group_name,
            }
            for mg in members_group
        ]
    
    def validate_general_email(self, value):
        """Normalize email (strip whitespace and convert to lowercase)"""
        if not value or value == '':
            raise serializers.ValidationError("Email address is required.")
        
        # Normalize email (strip whitespace and convert to lowercase)
        value = value.strip().lower()
        
        return value
    
    def validate_nid_number(self, value):
        """Normalize empty NID values to None to avoid unique constraint violations"""
        if value is None or value == '':
            return None
        
        # Strip whitespace
        value = value.strip()
        if not value:
            return None
            
        # No format validation - just return the value as-is
        return value
    # def validate(self, data):
    #     nid = data.get('nid_number')
    #     # If we're updating (self.instance exists) and nid is provided,
    #     # make sure no other Member has the same NID
    #     if nid and self.instance:
    #         qs = Member.objects.filter(nid_number=nid).exclude(pk=self.instance.pk)
    #         if qs.exists():
    #             raise serializers.ValidationError({
    #                 "nid_number": "This NID number is already in use."
    #             })
    #     return data
      
    # Override the to_representation method to format the date_of_birth field
    def to_representation(self, instance):
        representation = super().to_representation(instance)
        
        # Check if date_of_birth exists and is a date object
        if instance.date_of_birth:
            # Format the date to '19-Aug-1986'
            representation['date_of_birth'] = instance.date_of_birth.strftime('%d-%b-%Y')
        if instance.member_type:
            representation['member_type_name'] = instance.member_type.type_name
        if instance.user:
            representation['username'] = instance.user.username
        representation['member_roles'] = self.get_members_role(instance)
        representation['member_groups'] = self.get_members_group(instance)
         
        # Add computed tower and unit info (from ownership or residency)
        try:
            owner_record = (
                Owner.objects
                .filter(member=instance)
                .select_related('unit__floor__tower')
                .first()
            )
            if owner_record:
                representation['unit'] = owner_record.unit.unit_name
                representation['tower'] = owner_record.unit.floor.tower.tower_name
            else:
                resident_record = (
                    Resident.objects
                    .filter(member=instance, is_active=True)
                    .select_related('unit__floor__tower')
                    .first()
                )
                if resident_record:
                    representation['unit'] = resident_record.unit.unit_name
                    representation['tower'] = resident_record.unit.floor.tower.tower_name
        except Exception:
            # Fail silently if related data is missing; frontend will show 'null'
            pass

        if instance.member_type:
                    representation['member_type_edit'] = {
                    'id': instance.member_type.id,
                    'member_type_name': instance.member_type.type_name
            }
        return representation
    
    class Meta:
        model = Member
        fields = [
            'id','user','member_type','members_role', 'full_name', 'general_contact','general_email','nid_number', 'photo','photo_low_quality',
            'about_us', 'facebook_profile', 'linkedin_profile', 'permanent_address', 
            'present_address', 'date_of_birth', 'occupation', 'gender', 'marital_status',
            'religion', 'nid_front', 'nid_back','is_org_member','is_comm_member','org_member_ever_created','comm_member_ever_created','delivery_method','login_email','login_contact','photo_removed','nid_front_removed','delete_role','nid_back_removed','is_first_login','terms_accepted','terms_accepted_at','terms_version'
        ]  
        # depth =1 
    # def validate(self, data):
    
    #     if Member.objects.filter(
    #         full_name=data.get('full_name'),
    #         general_contact=data.get('general_contact'),
    #         general_email=data.get('general_email')
    #     ).exists():
    #         pass   

       
    #     return data
    
    def create(self, validated_data):
        
       
        with transaction.atomic():
            try:
                request = self.context.get('request')
            
                if not request:
                    raise serializers.ValidationError("Request object is missing from context")
                
                
                user_info = request.user  
                if not user_info.is_authenticated:
                    raise serializers.ValidationError("User is not authenticated")
                creator_member = Member.objects.get(user=user_info)

                user = UserSerializer()
                delivery_method = validated_data.pop('delivery_method',None) 
                role_ids = validated_data.pop('members_role',[])  # Get the list of role IDs
                date_of_birth = validated_data.get('date_of_birth')
                photo = validated_data.pop('photo',None)
                nid_front = validated_data.pop('nid_front',None)
                nid_back = validated_data.pop('nid_back',None)
            

                
                if date_of_birth:
                    # Parse the string into a datetime object
                    parsed_date = datetime.strptime(date_of_birth, '%d-%b-%Y')
                    # Convert it to a date object (this removes the time part)
                    validated_data['date_of_birth'] = parsed_date.date()
                
                # Normalize empty NID number to None to avoid unique constraint violations
                nid_number = validated_data.get('nid_number')
                if nid_number is not None:
                    nid_number = nid_number.strip() if isinstance(nid_number, str) else nid_number
                    validated_data['nid_number'] = nid_number if nid_number else None
                else:
                    validated_data['nid_number'] = None
                
                # Create the user first
                # username =  generate_random_username()  # Auto-generate the username if not provided
                # password =  generate_random_password()  # Generate password if not provided
                # print('Username is:',username,'Password is:',password)
                # # Create the user with the email, username, and password
                # user = User.objects.create_user(username=username, password=password)

                # Now, create the Member instance and associate it with the created user
                # When for_owner=True (add-owner flow), set flag so signal skips org_member_added notification
                member = Member(**validated_data)
                if self.context.get('for_owner'):
                    member._skip_org_member_notification = True
                member.save()
                member.created_by = creator_member
                member.created_at = timezone.now()
                member.nid_front = nid_front
                member.nid_back = nid_back
                member.is_first_login = True

                # Process the photo to create a lower resolution version if a photo was uploaded
                if photo:
                    try:
                        # Open the image using Pillow
                        image = Image.open(photo)
                        # Ensure the image is in RGB mode for consistent JPEG saving
                        if image.mode != 'RGB':
                            image = image.convert('RGB')
                    # Resize the image to exactly 150x150 pixels
                        image = image.resize((150, 150), Image.Resampling.LANCZOS)

                        
                        # Save the processed image to a BytesIO object
                        buffer = BytesIO()
                        image.save(buffer, format='JPEG')
                        buffer.seek(0)
                        
                        # Create an InMemoryUploadedFile to save into the model field
                        low_quality_image = InMemoryUploadedFile(
                            buffer,               # file
                            'ImageField',         # field name
                            f'low_quality_{photo.name}',  # filename
                            'image/jpeg',         # content type
                            buffer.tell(),        # size in bytes
                            None                  # charset
                        )
                        
                        # Save the low quality image to the member instance
                        member.photo_low_quality.save(f'low_quality_{photo.name}', low_quality_image, save=True)
                        member.photo = photo
                        
                    except Exception as e:
                        # Optionally, handle exceptions or log errors if image processing fails
                        raise serializers.ValidationError(f"Error occurred: {str(e)}")
                # Validate and process role IDs
                for role_id in role_ids:
                    # Validate that role_id is a valid integer
                    try:
                        role_id = int(role_id)
                    except (ValueError, TypeError):
                        raise serializers.ValidationError(
                            f"Invalid role ID: '{role_id}'. Role ID must be a valid number."
                        )
                    
                    # Validate that the role exists
                    try:
                        role = Role.objects.get(id=role_id)
                    except Role.DoesNotExist:
                        raise serializers.ValidationError(
                            f"Role with id {role_id} does not exist."
                        )
                    
                    MembersRole.objects.create(member=member, role=role, is_member=True, is_group=False)
                
                # Send an email to the user with their username and password
                if delivery_method:
                    # Validate delivery_method if it's an email
                    if '@' in delivery_method:
                        delivery_email = delivery_method.lower().strip()
                        
                        # Check if email is already used by another member in a different unit
                        existing_member = Member.objects.filter(login_email=delivery_email).first()
                        if existing_member:
                            from towers.models import Owner, Resident, UnitStaff
                            
                            # Check as Owner
                            existing_owner = Owner.objects.filter(member=existing_member).select_related('unit__floor__tower').first()
                            if existing_owner:
                                raise serializers.ValidationError(
                                    f"Email {delivery_email} is already used for {existing_member.full_name} "
                                    f"in unit {existing_owner.unit.unit_name}, tower {existing_owner.unit.floor.tower.tower_name}. "
                                    f"Same email cannot be used across different units."
                                )
                            
                            # Check as Resident
                            existing_resident = Resident.objects.filter(member=existing_member, is_active=True).select_related('unit__floor__tower').first()
                            if existing_resident:
                                raise serializers.ValidationError(
                                    f"Email {delivery_email} is already used for {existing_member.full_name} "
                                    f"in unit {existing_resident.unit.unit_name}, tower {existing_resident.unit.floor.tower.tower_name}. "
                                    f"Same email cannot be used across different units."
                                )
                            
                            # Check as UnitStaff
                            existing_staff = UnitStaff.objects.filter(member=existing_member, is_active=True).select_related('unit__floor__tower').first()
                            if existing_staff:
                                raise serializers.ValidationError(
                                    f"Email {delivery_email} is already used for {existing_member.full_name} "
                                    f"in unit {existing_staff.unit.unit_name}, tower {existing_staff.unit.floor.tower.tower_name}. "
                                    f"Same email cannot be used across different units."
                                )
                    
                    # Generate username using full_name in format: fullname_XXXX
                    full_name = validated_data.get('full_name', '')
                    username = generate_random_username(full_name=full_name)  # Auto-generate the username with full_name
                    password = generate_random_password()  # Generate numeric-only password
                    print('Username is:',username,'Password is:',password)
                    # Create the user with the email, username, and password
                    user = User.objects.create_user(username=username, password=password)
                    

                    member.user = user
                    if '@' in delivery_method:
                        is_comm = member.is_comm_member
                        is_org = member.is_org_member
                        print(f"[DEBUG] create() -> send_welcome_email: member.is_comm_member={is_comm}, member.is_org_member={is_org}")
                        
                        self.send_welcome_email(delivery_method, username, password, is_comm_member=is_comm, is_org_member=is_org)
                        member.login_email = delivery_method
                        
                    elif delivery_method.isdigit():
                        member.login_contact = delivery_method                
                member.save()
                
                # Handle notifications for new member (non-retroactive)
                # New members should only receive notifications for announcements/bulletins/notices
                # created AFTER they join, not for existing ones
                try:
                    from notifications.utils import handle_new_member_notifications
                    handle_new_member_notifications(member)
                except Exception as e:
                    # Don't fail member creation if notification handling fails
                    print(f"Error handling notifications for new member {member.id}: {e}")
                    import traceback
                    traceback.print_exc()
                
                return member
            except Exception as e:
                    # If any error occurs, the transaction will be rolled back
                    raise serializers.ValidationError(f"Error occurred: {str(e)}")
    def update(self, instance, validated_data):
    # Start the transaction to ensure atomicity
        print('🔄 MemberSerializer.update called')
        print(f'📝 Validated data keys: {list(validated_data.keys())}')
        print(f'📝 Validated data: {validated_data}')
        with transaction.atomic():
            try:
                request = self.context.get('request')
                # print(request)
                if not request:
                    raise serializers.ValidationError("Request object is missing from context")
                
                
                user_info = request.user  
                if not user_info.is_authenticated:
                    raise serializers.ValidationError("User is not authenticated")
                updated_by = Member.objects.get(user=user_info)
                # Handle fields to update
                photo = validated_data.get('photo')
                
                # Handle NID number properly - normalize empty values to None
                nid_number = validated_data.get('nid_number', None)
                if nid_number is not None:
                    # Strip whitespace and convert empty strings to None
                    normalized_nid = nid_number.strip() if isinstance(nid_number, str) else nid_number
                    validated_data['nid_number'] = normalized_nid if normalized_nid else None
                else:
                    validated_data['nid_number'] = None
                    
                # members_roles_data = validated_data.pop('members_role', None)
                # print('role_ids:',role_ids)
                date_of_birth = validated_data.get('date_of_birth', None)
                delivery_method = validated_data.get('delivery_method', None)
                # nid_front = validated_data.get('nid_front')
                # nid_back = validated_data.get('nid_back')

                photo_removed = validated_data.get('photo_removed')
                nid_front_removed = validated_data.get('nid_front_removed')
                nid_back_removed = validated_data.get('nid_back_removed')

                print(photo_removed,nid_front_removed,nid_back_removed)

                # print(photo,nid_front,nid_back)

                # If a new date of birth is provided, parse and update it
                if date_of_birth:
                    try:
                        print(f'📅 Parsing date_of_birth: "{date_of_birth}" (type: {type(date_of_birth)})')
                        parsed_date = datetime.strptime(date_of_birth, '%d-%b-%Y')
                        validated_data['date_of_birth'] = parsed_date.date()
                        print(f'📅 Successfully parsed date: {validated_data["date_of_birth"]}')
                    except ValueError as e:
                        print(f'❌ Date parsing error: {e}')
                        raise serializers.ValidationError(f"Invalid date format. Expected DD-MMM-YYYY, got: {date_of_birth}")

                # Update the instance with the validated data
                for attr, value in validated_data.items():
                    setattr(instance, attr, value)


                if nid_front_removed == 'Removed':
                    instance.nid_front = None
       
                if nid_back_removed == 'Removed' :
                    instance.nid_back = None
                    
                # Update the photo and its low-quality version if a new photo is provided
                if photo:
                    try:
                        # Open the new photo image using Pillow
                        image = Image.open(photo)
                        # Ensure the image is in RGB mode for consistent JPEG saving
                        if image.mode != 'RGB':
                            image = image.convert('RGB')
                        # Resize the image to 150x150 pixels for low quality
                        image = image.resize((150, 150), Image.Resampling.LANCZOS)

                        # Save the processed low-quality image to a buffer
                        buffer = BytesIO()
                        image.save(buffer, format='JPEG')
                        buffer.seek(0)

                        # Create an InMemoryUploadedFile to save into the model field
                        low_quality_image = InMemoryUploadedFile(
                            buffer,               # file
                            'ImageField',         # field name
                            f'low_quality_{photo.name}',  # filename
                            'image/jpeg',         # content type
                            buffer.tell(),        # size in bytes
                            None                  # charset
                        )

                        # Save the new low-quality image to the instance
                        instance.photo_low_quality.save(f'low_quality_{photo.name}', low_quality_image, save=False)
                        instance.photo = photo
                        
                    except Exception as e:
                        raise serializers.ValidationError(f"Error occurred: {str(e)}")
                if photo_removed == 'Removed':
                    instance.photo_low_quality = None
                    instance.photo = None
                  
                # # Update member roles if provided
                # if role_ids is not None:
                #     # First, clear the existing member roles
                #     # instance.member_roles.clear()
                #     MembersRole.objects.filter(member=instance).delete()
                #     # Then, create the new roles
                #     for role_id in role_ids:
                #         role = Role.objects.get(id=role_id)
                #         MembersRole.objects.create(member=instance, role=role)
                # else:
                #     if not MembersRole.objects.filter(member=instance).exists():
                #         # Member had no previous roles — nothing to preserve, just ensure it's clean
                #         MembersRole.objects.filter(member=instance).delete()


                # if role_ids is not None:
                #         MembersRole.objects.filter(member=instance).delete()
                #         MembersRole.objects.bulk_create([
                #             MembersRole(member=instance, role_id=role_id)
                #             for role_id in role_ids
                #         ])
                # else:
                #         MembersRole.objects.filter(member=instance).delete()
                # role_add_ids    = validated_data.pop('members_role', None)
                # role_delete_ids = validated_data.pop('delete_role',  None)
                # print('instance:',instance)
                

                # if role_delete_ids:
                #     MembersRole.objects.filter(
                #         member=instance,
                #         role_id__in=role_delete_ids
                #     ).delete()

                # if role_ids:
                #     existing = set(
                #         MembersRole.objects
                #                 .filter(member=instance)
                #                 .values_list('role_id', flat=True)
                #     )
                #     to_create = [rid for rid in role_ids if rid not in existing]
                #     MembersRole.objects.bulk_create([
                #         MembersRole(member=instance, role_id=rid)
                #         for rid in to_create
                #     ])
                    # Pop the members_role list (list of dicts with role_id, is_member, is_group)
                # members_roles_data = validated_data.pop('members_role', [])
                
                members_roles_data = validated_data.pop('members_role', [])
                role_delete_ids = validated_data.pop('delete_role', [])
                
                print(f"[MEMBER-UPDATE] Role update data - To add: {members_roles_data}, To delete: {role_delete_ids}")

                # Delete only directly assigned roles (is_member=True, is_group=False)
                # Do not delete roles that come from groups
                if role_delete_ids:
                    deleted_count = MembersRole.objects.filter(
                        member=instance,
                        role_id__in=role_delete_ids,
                        is_member=True,
                        is_group=False
                    ).delete()[0]
                    print(f"[MEMBER-UPDATE] Deleted {deleted_count} roles")

                # Prevent duplicate creations (only directly assigned roles: is_member=True, is_group=False)
                existing_roles = list(MembersRole.objects.filter(
                    member=instance,
                    is_member=True,
                    is_group=False
                ).values_list('role_id', flat=True))
                
                print(f"[MEMBER-UPDATE] Existing roles: {existing_roles}, New roles to add: {members_roles_data}")

                # Create new ones only if not already assigned
                # Convert all to integers for consistent comparison
                members_roles_data = [int(rid) for rid in members_roles_data if rid is not None]
                existing_roles = [int(rid) for rid in existing_roles if rid is not None]
                
                roles_added = []
                for role_id in members_roles_data:
                    role_id_int = int(role_id)
                    if role_id_int not in existing_roles:
                        roles_added.append(role_id_int)
                        MembersRole.objects.create(
                            member=instance,
                            role_id=role_id_int,
                            is_member=True,
                            is_group=False,  # or True, based on your logic
                            created_by=updated_by  # Set the assigner for signal handler
                        )
                
                print(f"[MEMBER-UPDATE] Created {len(roles_added)} new role assignments: {roles_added}")
                print(f"[MEMBER-UPDATE] Member being updated: {instance.id} ({instance.full_name})")
                print(f"[MEMBER-UPDATE] User making the update: {updated_by.id} ({updated_by.full_name})")
                
                # Note: Notifications are created automatically by the post_save signal on MembersRole
                # See group_role/signals.py -> notify_member_role_assigned()
                if len(roles_added) > 0:
                    print(f"[MEMBER-UPDATE] 🎯 {len(roles_added)} roles added: {roles_added} - notifications will be created by signal")
                else:
                    print(f"[MEMBER-UPDATE] ⚠️ No new roles to add - no notifications needed")
                    print(f"[MEMBER-UPDATE] Debug: members_roles_data={members_roles_data}, existing_roles={existing_roles}")

              
                # Update delivery method if provided
                if delivery_method:
                    # Handle the delivery method: email or contact
                    user_created = 0
                    credentials_changed = False
                    username = None
                    password = None
                    
                    # Check if delivery method has changed
                    if '@' in delivery_method:
                        # Email delivery method
                        delivery_email = delivery_method.lower().strip()
                        
                        # Validate that this email is not used by another member in a different unit
                        if instance.login_email != delivery_email:
                            credentials_changed = True
                            
                            # Check if email is already used by another member
                            existing_member = Member.objects.filter(
                                login_email=delivery_email
                            ).exclude(id=instance.id).first()
                            
                            if existing_member:
                                # Check if this member is in a different unit/tower
                                from towers.models import Owner, Resident, UnitStaff
                                
                                # Check as Owner
                                existing_owner = Owner.objects.filter(member=existing_member).select_related('unit__floor__tower').first()
                                if existing_owner:
                                    raise serializers.ValidationError(
                                        f"Email {delivery_email} is already used for {existing_member.full_name} "
                                        f"in unit {existing_owner.unit.unit_name}, tower {existing_owner.unit.floor.tower.tower_name}. "
                                        f"Same email cannot be used across different units."
                                    )
                                
                                # Check as Resident  
                                existing_resident = Resident.objects.filter(member=existing_member, is_active=True).select_related('unit__floor__tower').first()
                                if existing_resident:
                                    raise serializers.ValidationError(
                                        f"Email {delivery_email} is already used for {existing_member.full_name} "
                                        f"in unit {existing_resident.unit.unit_name}, tower {existing_resident.unit.floor.tower.tower_name}. "
                                        f"Same email cannot be used across different units."
                                    )
                                
                                # Check as UnitStaff
                                existing_staff = UnitStaff.objects.filter(member=existing_member, is_active=True).select_related('unit__floor__tower').first()
                                if existing_staff:
                                    raise serializers.ValidationError(
                                        f"Email {delivery_email} is already used for {existing_member.full_name} "
                                        f"in unit {existing_staff.unit.unit_name}, tower {existing_staff.unit.floor.tower.tower_name}. "
                                        f"Same email cannot be used across different units."
                                    )
                    elif delivery_method.isdigit():
                        # Phone delivery method
                        if instance.login_contact != delivery_method:
                            credentials_changed = True
                            
                    
                    # Create user if doesn't exist
                    if instance.user is None:
                        # Generate username using full_name in format: fullname_XXXX
                        full_name = instance.full_name or ''
                        username = generate_random_username(full_name=full_name)
                        password = generate_random_password()
                        print('New user - Username:', username, 'Password:', password)
                        user = User.objects.create_user(username=username, password=password)
                        instance.user = user
                        user_created = 1
                    elif credentials_changed and instance.is_first_login == True:
                        # User has logged in before - generate new password with existing username
                        username = instance.user.username  # Keep existing username
                        password = generate_random_password()  # New password
                        print('User logged in before - Username:', username, 'New Password:', password)
                        instance.user.set_password(password)
                        instance.user.save()
                        # instance.is_first_login = True  # Reset to require password change
        
 

                    if '@' in delivery_method:
                        instance.login_email = delivery_method
                        instance.login_contact = None
                        
                        # Normalize booleans
                        is_comm = instance.is_comm_member
                        is_org = instance.is_org_member
                        
                        if user_created == 1:
                            # New user - send welcome email
                            self.send_welcome_email(delivery_method, username, password, is_comm_member=is_comm, is_org_member=is_org)
                        elif credentials_changed and instance.is_first_login == True:
                            # Credentials changed and new password generated - send with credentials
                            self.send_update_email(delivery_method, username, password)
                        elif credentials_changed:
                            # Email changed - send notification
                            self.send_update_email(delivery_method, '', '')


                    elif delivery_method.isdigit():
                        instance.login_contact = delivery_method
                        instance.login_email = None
                # Save the updated member instance
                instance.updated_by = updated_by
                instance.updated_at = timezone.now()
                instance.save()
                return instance
            except Exception as e:
                # If any error occurs, the transaction will be rolled back
                raise serializers.ValidationError(f"Error occurred: {str(e)}")
    
    def send_welcome_email(self, recipient_email, username, password, is_comm_member=False, is_org_member=False):
        subject = "Welcome to EstateLink"
        
        # Determine content based on member type
        # 1. Org & Comm: loginand + Apps
        # 2. Org Only: login + No Apps
        # 3. Comm Only: No Login + Apps
        
        login_link_to_use = None
        show_app_links = False
        
        # Get configured links
        login_link_org = getattr(settings, 'LOGIN_LINK', 'https://control.estatelink.cloud/login')
        login_link_both = getattr(settings, 'LOGIN_LINK_BOTH', 'https://control.estatelink.cloud/loginand')
        app_link_android = getattr(settings, 'ANDROID_APP_DOWNLOAD_LINK', APP_DOWNLOAD_LINK)
        app_link_ios = getattr(settings, 'IOS_APP_DOWNLOAD_LINK', '#')
        
        if is_org_member and is_comm_member:
            login_link_to_use = login_link_both
            show_app_links = True
        elif is_org_member:
            login_link_to_use = login_link_org
            show_app_links = False
        elif is_comm_member:
            login_link_to_use = None
            show_app_links = True
            
        context = {
            'username': username,
            'password': password,
            'login_link': login_link_to_use,
            'subject': subject,
            'show_app_links': show_app_links,
            'android_link': app_link_android,
            'ios_link': app_link_ios,
        }
        
        send_html_email(
            subject=subject,
            template_name='user/emails/welcome_credentials.html',
            context=context,
            recipient_list=[recipient_email],
            from_email=settings.EMAIL_HOST_USER,
        )
    def send_update_email(self, recipient_email, username, password):
        subject = "Login Credential Updated"
        
        contact_info = recipient_email if '@' not in recipient_email else f'[{recipient_email}]'
        
        context = {
            'username': username,
            'password': password,
            'contact_info': contact_info,
            'login_link': LOGIN_LINK,
            'subject': subject,
        }
        
        send_html_email(
            subject=subject,
            template_name='user/emails/credential_update.html',
            context=context,
            recipient_list=[recipient_email],
            from_email=settings.EMAIL_HOST_USER,
        )
# Password validation helper function (same rules as Forgot Password flow)
def validate_password_complexity(password):
    """
    Validates password complexity requirements:
    - At least 8 characters
    - At least one uppercase letter
    - At least one lowercase letter
    - At least one number
    - At least one special character (!@#$%^&*)
    """
    import re
    errors = []
    
    if len(password) < 8:
        errors.append("Password must be at least 8 characters long.")
    if not re.search(r'[!@#$%^&*]', password):
        errors.append("Password must contain at least one special character (!@#$%^&*).")
    if not re.search(r'[A-Z]', password):
        errors.append("Password must contain at least one uppercase letter.")
    if not re.search(r'[a-z]', password):
        errors.append("Password must contain at least one lowercase letter.")
    if not re.search(r'[0-9]', password):
        errors.append("Password must contain at least one number.")
    
    return errors

#created By Injam
# For setting New password for the first time user
class SetPasswordSerializer(serializers.Serializer):
    old_password = serializers.CharField(write_only=True, required=True)
    new_password = serializers.CharField(write_only=True, required=True)
    confirm_password = serializers.CharField(write_only=True, required=True)

    def validate_old_password(self, value):
        user_id = self.context.get('user_id')
        try:
            user = User.objects.get(id=user_id)
        except User.DoesNotExist:
            raise serializers.ValidationError("User does not exist")
        if not user.check_password(value):
            raise serializers.ValidationError("Old password is incorrect")
        return value

    def validate_new_password(self, value):
        """Validate password complexity (same as Forgot Password flow)"""
        errors = validate_password_complexity(value)
        if errors:
            raise serializers.ValidationError(errors)
        return value

    def validate(self, data):
        if data.get('new_password') != data.get('confirm_password'):
            raise serializers.ValidationError("New password and confirmation do not match")
        return data






class CompanySerializer(serializers.ModelSerializer):
    
    # member = MemberSerializer()
    class Meta:
        model = Company
        fields = ['company_name', 'member', 'unit', 'created_by']

   
class CompanySerializerlist(serializers.ModelSerializer):
    member = MemberSerializer()
    company_member_type = serializers.SerializerMethodField()

    class Meta:
        model = Company
        fields = ['company_name', 'member', 'company_member_type', 'unit', 'created_by']

    def get_company_member_type(self, obj):
        return "Owner"