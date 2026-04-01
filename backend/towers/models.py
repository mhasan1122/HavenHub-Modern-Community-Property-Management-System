from django.db import models
from django.utils import timezone
from django.core.validators import FileExtensionValidator
from user.models import Member
import os

class Tower(models.Model):
    tower_name = models.CharField(max_length=255)
    tower_number = models.IntegerField(null=True)
    description = models.TextField(blank=True, null=True)
    photo = models.ImageField(upload_to='towers/',null=True,validators=[FileExtensionValidator(allowed_extensions=['jpg', 'jpeg', 'png', 'heic'])])
    num_floors = models.IntegerField(default=0)
    num_units = models.IntegerField(default=0)
    unit_naming_type = models.CharField(max_length=255)
    add_tower_number_to_unit_name = models.BooleanField(default=0)
    units_per_floor = models.CharField(max_length=255,default="Same as Every Floor")
    created_by = models.ForeignKey(Member, null=True,on_delete=models.DO_NOTHING, related_name='created_towers')
    created_at = models.DateTimeField(auto_now_add=True,null=True)
    updated_by = models.ForeignKey(Member, null=True,on_delete=models.DO_NOTHING, related_name='updated_towers')
    updated_at = models.DateTimeField(auto_now = True,null=True) 

    class Meta:
        indexes = [
            models.Index(fields=['tower_name']),
        ]


    def __str__(self):
        return self.tower_name
    
    def save(self, *args, **kwargs):
        # Ensure that the directory exists before saving
        if self.photo:
            # Get the directory where the image will be stored
            media_directory = os.path.join('media', 'towers')

            # Create the directory if it doesn't exist
            if not os.path.exists(media_directory):
                os.makedirs(media_directory)

        super(Tower, self).save(*args, **kwargs)

class Floor(models.Model):
    tower = models.ForeignKey(Tower,on_delete=models.CASCADE)
    floor_no = models.IntegerField()
    number_of_units = models.IntegerField()
    created_by = models.ForeignKey(Member, null=True,on_delete=models.DO_NOTHING, related_name='created_floors')
    created_at = models.DateTimeField(auto_now_add=True,null=True)
    updated_by = models.ForeignKey(Member, null=True,on_delete=models.DO_NOTHING, related_name='updated_floors')
    updated_at = models.DateTimeField(auto_now = True,null=True)

    class Meta:
        indexes = [
            models.Index(fields=['tower', 'floor_no']),
        ]

    def __str__(self):
        return f"Floor {self.floor_no} in Tower {self.tower.tower_name}"
        return f"Unit {self.unit_name} on Floor {self.floor.floor_no}"

def upload_to_unit_docs(instance, filename):
    """
    Returns the upload path for a file based on the associated Unit's details.
    The path is constructed using the Unit's id and unit_name.
    For example, if the Unit has an id of 5 and a unit_name "UnitA",
    the file will be stored in the directory: 'unit_docs/5_UnitA/filename.pdf'.
    """
    return os.path.join('unit_docs', filename)

class Unit(models.Model):
    """
    Unit model stores details about a unit in a building.
    """
    UNIT_STATUS_CHOICES = [
        ('no_owner', 'No Owner'),
        ('available', 'Available'),
        ('occupied', 'Occupied'),
        ('unknown', 'Unknown'),
    ]

    # Color mapping matching frontend
    STATUS_COLORS = {
        'no_owner': '#FFFFFF',    # White (bg-white)
        'available': '#FF8682',   # Light red (bg-[#FF8682])
        'occupied': '#3D9D9B',    # Teal (bg-[#3D9D9B])
        'unknown': '#E5E7EB',     # Gray (bg-[#E5E7EB])
    }
    floor = models.ForeignKey(Floor, on_delete=models.CASCADE)
    unit_name = models.CharField(max_length=20)
    # unit_status = models.CharField(max_length=255)
    unit_status = models.CharField(
        max_length=20,
        choices=UNIT_STATUS_CHOICES,
        default='no_owner'
    )
    status_color = models.CharField(
        max_length=7,
        default='#FFFFFF',
        help_text="Hex color code for unit status"
    )
    created_by = models.ForeignKey(Member, null=True, on_delete=models.DO_NOTHING, related_name='created_units')
    created_at = models.DateTimeField(auto_now_add=True, null=True)
    updated_by = models.ForeignKey(Member, null=True, on_delete=models.DO_NOTHING, related_name='updated_units')
    updated_at = models.DateTimeField(auto_now=True, null=True)

    class Meta:
        indexes = [
            models.Index(fields=['floor', 'unit_name']),
            models.Index(fields=['unit_status']),
            models.Index(fields=['primary_email']),
        ]

    # Additional unit details
    area = models.IntegerField(null=True)
    number_of_rooms = models.IntegerField(null=True)
    number_of_bathrooms = models.IntegerField(null=True)
    number_of_balconies = models.IntegerField(null=True)
    
    # Primary contact information
    primary_name = models.CharField(max_length=255, null=True)
    primary_number = models.CharField(max_length=11, unique=False, null=True)
    primary_email = models.EmailField(null=True)
    primary_relationship = models.CharField(max_length=50, null=True)
    
    # Secondary contact information
    secondary_name = models.CharField(max_length=255, null=True)
    secondary_number = models.CharField(max_length=11, unique=False, null=True)
    secondary_email = models.EmailField(null=True)
    secondary_relationship = models.CharField(max_length=50, null=True)
    
    # Emergency contact information
    emergency_name = models.CharField(max_length=255, null=True)
    emergency_number = models.CharField(max_length=11, unique=False, null=True)
    emergency_email = models.EmailField(null=True)
    emergency_relationship = models.CharField(max_length=50, null=True)

    def __str__(self):
        return f"Unit {self.unit_name} on Floor {self.floor.floor_no}"

class UnitDocs(models.Model):
    """
    Model for storing documents related to a Unit.
    """
    
    # The Unit to which the document belongs
    unit = models.ForeignKey(Unit, on_delete=models.CASCADE, related_name="docs")
    
    # FileField for uploading documents, using a custom upload path function
    unit_docs = models.FileField(
        upload_to=upload_to_unit_docs,
        null=True,
        validators=[FileExtensionValidator(allowed_extensions=['pdf', 'jpg', 'jpeg', 'png'])]
    )
    
    # User who created this document record
    created_by = models.ForeignKey(Member, null=True, on_delete=models.DO_NOTHING, related_name='created_unit_docs')
    created_at = models.DateTimeField(auto_now_add=True)
    
    # User who last updated this document record
    updated_by = models.ForeignKey(Member, null=True, on_delete=models.DO_NOTHING, related_name='updated_unit_docs')
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return f"Doc for Unit {self.unit.unit_name}" 
    
class Resident(models.Model):
    member = models.ForeignKey(Member, on_delete=models.CASCADE)
    unit = models.ForeignKey(Unit, on_delete=models.CASCADE)
    is_active = models.BooleanField(default=True)  
    is_resident_or_tenant = models.BooleanField(default=True,
                                                help_text="True if resident, False if tenant")
    # unit_rent_fee = models.FloatField()
    # advance_payment = models.FloatField()
    unit_rent_fee = models.FloatField(default=0)
    advance_payment = models.FloatField(default=0)

    notice_period = models.IntegerField(help_text="Notice period in months")
    created_by = models.ForeignKey(Member, null=True, on_delete=models.DO_NOTHING, related_name='created_residents')
    created_at = models.DateTimeField(auto_now_add=True)
    updated_by = models.ForeignKey(Member, null=True, on_delete=models.DO_NOTHING, related_name='updated_residents')
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        indexes = [
            models.Index(fields=['unit', 'is_active']),
            models.Index(fields=['member', 'is_active']),
        ]

    def __str__(self):
        return f"Resident: {self.member.full_name} in Unit {self.unit.unit_name}"

def upload_to_rental_docs(instance, filename):
    return os.path.join('resident_docs', f'{instance.resident.id}_{instance.resident.member.full_name}', filename)

class ResidentDocs(models.Model):
    resident = models.ForeignKey(
        'Resident', on_delete=models.CASCADE, related_name="docs"
    )
    rental_docs = models.FileField(
        upload_to=upload_to_rental_docs,
        null=True,
        validators=[FileExtensionValidator(allowed_extensions=['pdf', 'jpg', 'jpeg', 'png'])]
    )
    created_by = models.ForeignKey(
        Member, null=True, on_delete=models.DO_NOTHING, related_name='created_resident_docs'
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_by = models.ForeignKey(
        Member, null=True, on_delete=models.DO_NOTHING, related_name='updated_resident_docs'
    )
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return f"Doc for {self.resident.member.full_name}"

class Owner(models.Model):
    member = models.ForeignKey(Member, on_delete=models.CASCADE)
    unit = models.ForeignKey(Unit, on_delete=models.CASCADE)
    ownership_transfer_from = models.ForeignKey(Member, null=True, blank=True, on_delete=models.SET_NULL, related_name='transferred_ownerships')
    ownership_percentage = models.DecimalField(max_digits=5, decimal_places=2)
    date_of_ownership = models.DateField()
    # New field to track the last transfer date (when ownership % changed or transferred)
    # This is separate from date_of_ownership which is the original/initial ownership date
    last_transfer_date = models.DateField(null=True, blank=True, help_text="Date of the last ownership transfer or percentage change")
    created_by = models.ForeignKey(Member, null=True, on_delete=models.DO_NOTHING, related_name='created_owners')
    created_at = models.DateTimeField(auto_now_add=True)
    updated_by = models.ForeignKey(Member, null=True, on_delete=models.DO_NOTHING, related_name='updated_owners')
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        indexes = [
            models.Index(fields=['unit', 'member']),
            models.Index(fields=['member']),
        ]

    def __str__(self):
        return f"Owner: {self.member.full_name} in Unit {self.unit.unit_name}"
    
    def save(self, *args, **kwargs):
        # Check if this is a new instance (not yet saved to database)
        is_new = self.pk is None
        
        # Save the Owner object first
        super(Owner, self).save(*args, **kwargs)
        
        # If this is a new Owner object, update the member's community member status
        if is_new:
            self.member.is_comm_member = True
            self.member.comm_member_ever_created = True
            self.member.save()

def upload_to_owner_photo(instance, filename):
    # Generate a custom path for the image based on the instance's ID
    return os.path.join('owners', f'{instance.owner.member.id}_{instance.owner.member.full_name}', filename)

class OwnerDocs(models.Model):
    owner = models.ForeignKey(Owner, on_delete=models.CASCADE)
    unit = models.ForeignKey(Unit, on_delete=models.CASCADE)
    owner_docs = models.FileField(upload_to=upload_to_owner_photo, null=True, blank=True)
    created_by = models.ForeignKey(Member, null=True, on_delete=models.DO_NOTHING, related_name='created_owner_docs')
    created_at = models.DateTimeField(auto_now_add=True)
    updated_by = models.ForeignKey(Member, null=True, on_delete=models.DO_NOTHING, related_name='updated_owner_docs')
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return f"Ownership documents for {self.owner.member.full_name}"


class UnitStaff(models.Model):
    from user.models import Member
    member = models.ForeignKey(Member, on_delete=models.CASCADE)
    unit = models.ForeignKey(Unit, on_delete=models.CASCADE)
    is_active = models.BooleanField(default=True)  
    unit_staff_status = models.BooleanField(default=True,
                                                help_text="True if Live-in, False if Part-time")

    created_by = models.ForeignKey(Member, null=True, on_delete=models.DO_NOTHING, related_name='created_unitstaff')
    created_at = models.DateTimeField(auto_now_add=True)
    updated_by = models.ForeignKey(Member, null=True, on_delete=models.DO_NOTHING, related_name='updated_unitstaff')
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return f"UnitStaff: {self.member.full_name} in Unit {self.unit.unit_name}"


class UnitOwnershipHistory(models.Model):
    """
    Dedicated table for storing ownership history timeline entries.
    This is the single source of truth for the Unit History feature.
    
    Entry Types:
    - initial_ownership: First owner(s) at unit creation (single owner)
    - initial_ownership_list: First owner(s) at unit creation (multiple owners)
    - ownership_transfer: When ownership moves from one party to another
    - ownership_updated: After transfer, single owner result
    - ownership_list_updated: After transfer, multiple owners result
    - attachment_added: When attachment(s) are added to an owner
    - attachment_removed: When an attachment is removed from an owner
    
    Structure:
    - ownership_state_before: Complete ownership state BEFORE the event (for transfers, shows previous state)
    - ownership_state_after: Complete ownership state AFTER the event (current state after the event)
    - For initial entries: ownership_state_before is empty, ownership_state_after has the initial owners
    - For transfer entries: ownership_state_before shows previous state, ownership_state_after shows new state
    - For state entries: ownership_state_before shows previous state, ownership_state_after shows current state
    """
    ENTRY_TYPE_CHOICES = [
        ('initial_ownership', 'Initial Ownership'),
        ('initial_ownership_list', 'Initial Ownership List'),
        ('ownership_transfer', 'Ownership Transfer'),
        ('ownership_updated', 'Ownership Updated'),
        ('ownership_list_updated', 'Ownership List Updated'),
        ('attachment_added', 'Attachment Added'),
        ('attachment_removed', 'Attachment Removed'),
    ]
    
    unit = models.ForeignKey(
        Unit, 
        on_delete=models.CASCADE, 
        related_name='ownership_history'
    )
    entry_type = models.CharField(
        max_length=50, 
        choices=ENTRY_TYPE_CHOICES
    )
    entry_date = models.DateTimeField(
        default=timezone.now,
        help_text="The date/time this ownership event occurred"
    )
    description = models.TextField(
        blank=True, 
        null=True,
        help_text="Human-readable description of the event (not used, kept for compatibility)"
    )
    
    # Complete ownership state BEFORE this event
    # Structure: [{owner_id, member_id, name, share, purchase_date, contact, email}, ...]
    # For initial entries: empty list []
    # For transfer/update entries: shows the ownership state before the change
    ownership_state_before = models.JSONField(
        default=list,
        help_text="Complete ownership state before this event with all owner details"
    )
    
    # Complete ownership state AFTER this event
    # Structure: [{owner_id, member_id, name, share, purchase_date, contact, email}, ...]
    # Always contains the current ownership state after this event
    ownership_state_after = models.JSONField(
        default=list,
        help_text="Complete ownership state after this event with all owner details"
    )
    
    # Legacy fields for backward compatibility (deprecated, use ownership_state_before/after instead)
    transfer_from = models.JSONField(
        blank=True, 
        null=True,
        help_text="DEPRECATED: Use ownership_state_before/after. Array of owners transferring out"
    )
    transfer_to = models.JSONField(
        blank=True, 
        null=True,
        help_text="DEPRECATED: Use ownership_state_before/after. Array of owners receiving transfer"
    )
    owners = models.JSONField(
        default=list,
        help_text="DEPRECATED: Use ownership_state_after. Array of owner objects with full details"
    )
    
    # Metadata
    created_at = models.DateTimeField(auto_now_add=True)
    created_by = models.ForeignKey(
        Member, 
        null=True, 
        on_delete=models.SET_NULL, 
        related_name='created_ownership_history'
    )
    
    class Meta:
        ordering = ['-entry_date', '-created_at']
        indexes = [
            models.Index(fields=['unit', '-entry_date']),
            models.Index(fields=['entry_type']),
        ]
        verbose_name = 'Unit Ownership History'
        verbose_name_plural = 'Unit Ownership Histories'
    
    def __str__(self):
        return f"{self.get_entry_type_display()} - Unit {self.unit.unit_name} - {self.entry_date}"
    
    @classmethod
    def create_initial_ownership_entry(cls, unit, owners_data, entry_date, created_by=None):
        """
        Create an initial ownership entry.
        
        Args:
            unit: Unit instance
            owners_data: List of owner dicts with owner_id, member_id, name, share, purchase_date, contact, email
            entry_date: Date of the ownership event
            created_by: Member who created this entry
        """
        entry_type = 'initial_ownership' if len(owners_data) == 1 else 'initial_ownership_list'
        
        # Sort owners by share descending
        sorted_owners = sorted(owners_data, key=lambda x: x.get('share', 0), reverse=True)
        
        return cls.objects.create(
            unit=unit,
            entry_type=entry_type,
            entry_date=entry_date,
            description="",
            ownership_state_before=[],  # No previous state for initial ownership
            ownership_state_after=sorted_owners,  # Initial owners
            # Legacy fields for backward compatibility
            owners=sorted_owners,
            created_by=created_by
        )
    
    @classmethod
    def create_transfer_entry(cls, unit, from_owners, to_owners, entry_date, created_by=None, 
                              ownership_state_before=None, ownership_state_after=None):
        """
        Create an ownership transfer entry.
        
        Args:
            unit: Unit instance
            from_owners: List of dicts with owner_id, name, share for outgoing owners (legacy, for backward compat)
            to_owners: List of dicts with owner_id, name, share for incoming owners (legacy, for backward compat)
            entry_date: Date of the transfer
            created_by: Member who created this entry
            ownership_state_before: Complete ownership state before transfer with full details
            ownership_state_after: Complete ownership state after transfer with full details
        """
        # If full state not provided, derive from from_owners/to_owners (backward compatibility)
        if ownership_state_before is None:
            ownership_state_before = from_owners or []
        if ownership_state_after is None:
            ownership_state_after = to_owners or []
        
        # Filter out owners with 0% or negative shares from ownership_state_after
        ownership_state_after = [o for o in ownership_state_after if float(o.get('share', 0)) > 0]
        
        # Sort by share descending
        if ownership_state_before:
            ownership_state_before = sorted(ownership_state_before, key=lambda x: x.get('share', 0), reverse=True)
        if ownership_state_after:
            ownership_state_after = sorted(ownership_state_after, key=lambda x: x.get('share', 0), reverse=True)
        
        return cls.objects.create(
            unit=unit,
            entry_type='ownership_transfer',
            entry_date=entry_date,
            description="",
            ownership_state_before=ownership_state_before,
            ownership_state_after=ownership_state_after,
            # Legacy fields for backward compatibility
            transfer_from=from_owners,
            transfer_to=to_owners,
            owners=[],
            created_by=created_by
        )
    
    @classmethod
    def create_ownership_state_entry(cls, unit, owners_data, entry_date, created_by=None, 
                                      ownership_state_before=None):
        """
        Create an ownership state entry (after a transfer).
        
        Args:
            unit: Unit instance
            owners_data: List of owner dicts with full details (becomes ownership_state_after)
            entry_date: Date of the ownership state
            created_by: Member who created this entry
            ownership_state_before: Complete ownership state before this update (optional, will fetch from last entry if not provided)
        """
        # Filter out owners with 0% or negative shares
        valid_owners_data = [o for o in owners_data if float(o.get('share', 0)) > 0]
        
        # Determine entry type based on final owner count (after filtering 0% owners)
        entry_type = 'ownership_updated' if len(valid_owners_data) == 1 else 'ownership_list_updated'
        
        # Sort owners by share descending
        sorted_owners = sorted(valid_owners_data, key=lambda x: x.get('share', 0), reverse=True)
        
        # If ownership_state_before not provided, get it from the last history entry
        if ownership_state_before is None:
            last_entry = cls.objects.filter(unit=unit).order_by('-entry_date', '-created_at').first()
            if last_entry and last_entry.ownership_state_after:
                ownership_state_before = last_entry.ownership_state_after
            else:
                ownership_state_before = []
        
        return cls.objects.create(
            unit=unit,
            entry_type=entry_type,
            entry_date=entry_date,
            description="",
            ownership_state_before=ownership_state_before,
            ownership_state_after=sorted_owners,
            # Legacy fields for backward compatibility
            owners=sorted_owners,
            created_by=created_by
        )
    
    @staticmethod
    def build_owner_data_with_attachments(owner, request=None):
        """
        Build owner data dictionary with attachments included.
        
        Args:
            owner: Owner instance
            request: Request object (optional, for building absolute URLs)
        
        Returns:
            Dict with owner data including attachments
        """
        # Get attachments for this owner
        attachments = []
        for doc in OwnerDocs.objects.filter(owner=owner):
            if doc.owner_docs:
                doc_url = doc.owner_docs.url
                if request:
                    doc_url = request.build_absolute_uri(doc_url)
                attachments.append({
                    'id': doc.id,
                    'name': os.path.basename(doc.owner_docs.name) if doc.owner_docs else None,
                    'url': doc_url
                })
        
        return {
            'owner_id': owner.id,
            'member_id': owner.member.id,
            'name': owner.member.full_name,
            'share': float(owner.ownership_percentage),
            'purchase_date': owner.date_of_ownership.isoformat(),
            'contact': owner.member.general_contact or '',
            'email': owner.member.general_email or '',
            'attachments': attachments
        }
    
    @classmethod
    def create_attachment_entry(cls, unit, owner, entry_type, attachments_info, entry_date=None, created_by=None, 
                                ownership_state_before=None, ownership_state_after=None, request=None):
        """
        Create an attachment history entry (added or removed).
        
        Args:
            unit: Unit instance
            owner: Owner instance
            entry_type: 'attachment_added' or 'attachment_removed'
            attachments_info: List of dicts with attachment details (id, name, url) - can be single item or multiple
            entry_date: Date/time of the attachment event (defaults to now)
            created_by: Member who created this entry
            ownership_state_before: Complete ownership state before this event (optional)
            ownership_state_after: Complete ownership state after this event (optional)
            request: Request object (optional, for building absolute URLs)
        """
        if entry_date is None:
            entry_date = timezone.now()
        
        # Ensure attachments_info is a list
        if not isinstance(attachments_info, list):
            attachments_info = [attachments_info]
        
        # For attachment entries, only store the specific owner's state, not all owners
        # This prevents showing attachments for all owners and adding attachments to previous snapshots
        if ownership_state_before is None or ownership_state_after is None:
            # Get the specific owner's current state (after the change has been applied)
            owner_after_data = cls.build_owner_data_with_attachments(owner, request)
            
            if ownership_state_after is None:
                # After state: current state (already has the change applied)
                ownership_state_after = [owner_after_data]
            
            if ownership_state_before is None:
                # Before state: need to reconstruct what it was before the change
                owner_before_data = owner_after_data.copy()
                
                if entry_type == 'attachment_added':
                    # Remove the newly added attachments to get the before state
                    added_attachment_ids = {att.get('id') for att in attachments_info}
                    owner_before_data['attachments'] = [
                        att for att in owner_after_data.get('attachments', [])
                        if att.get('id') not in added_attachment_ids
                    ]
                elif entry_type == 'attachment_removed':
                    # Add back the removed attachments to get the before state
                    owner_before_data['attachments'] = (owner_after_data.get('attachments', []) or []).copy()
                    # Add the removed attachments back
                    for att_info in attachments_info:
                        owner_before_data['attachments'].append(att_info)
                
                ownership_state_before = [owner_before_data]
        
        # Build description
        if entry_type == 'attachment_added':
            if len(attachments_info) == 1:
                description = f"Attachment '{attachments_info[0].get('name', 'attachment')}' added for {owner.member.full_name}"
            else:
                description = f"{len(attachments_info)} attachments added for {owner.member.full_name}"
        elif entry_type == 'attachment_removed':
            if len(attachments_info) == 1:
                description = f"Attachment '{attachments_info[0].get('name', 'attachment')}' removed for {owner.member.full_name}"
            else:
                description = f"{len(attachments_info)} attachments removed for {owner.member.full_name}"
        else:
            description = f"Attachment change for {owner.member.full_name}"
        
        return cls.objects.create(
            unit=unit,
            entry_type=entry_type,
            entry_date=entry_date,
            description=description,
            ownership_state_before=ownership_state_before,
            ownership_state_after=ownership_state_after,
            created_by=created_by
        )
    
    @staticmethod
    def calculate_ownership_state_after_transfer(unit, transfer_from_owner_id, transfer_to_owner_id, transfer_share, transfer_date=None):
        """
        Calculate ownership state after an internal transfer between existing owners.
        
        Args:
            unit: Unit instance
            transfer_from_owner_id: ID of the owner transferring shares (Owner.id)
            transfer_to_owner_id: ID of the owner receiving shares (Owner.id)
            transfer_share: Percentage being transferred (float)
            transfer_date: Date of the transfer (date object). If provided, will be used for recipient's purchase_date
        
        Returns:
            dict with:
                - ownership_state_before: List of current owners with shares (from DB)
                - ownership_state_after: List of owners after transfer (excluding 0% owners)
                - should_delete_source: Boolean indicating if source owner should be removed
                - source_owner_new_share: New share percentage for source owner (0 if leaving)
                - recipient_owner_new_share: New share percentage for recipient owner
        """
        from towers.models import Owner
        
        # Get all current owners of the unit
        all_owners = Owner.objects.filter(unit=unit).select_related('member')
        
        # Build ownership_state_before from current DB state
        ownership_state_before = []
        source_owner = None
        recipient_owner = None
        
        for owner in all_owners:
            owner_data = {
                'owner_id': owner.id,
                'member_id': owner.member.id,
                'name': owner.member.full_name,
                'share': float(owner.ownership_percentage),
                'purchase_date': owner.date_of_ownership.isoformat(),
                'contact': owner.member.general_contact or '',
                'email': owner.member.general_email or '',
                'is_leaving': False,
                'is_joining': False
            }
            ownership_state_before.append(owner_data)
            
            if owner.id == transfer_from_owner_id:
                source_owner = owner
            if owner.id == transfer_to_owner_id:
                recipient_owner = owner
        
        if not source_owner or not recipient_owner:
            raise ValueError(f"Source owner (ID: {transfer_from_owner_id}) or recipient owner (ID: {transfer_to_owner_id}) not found in unit {unit.id}")
        
        # Calculate new shares
        source_original_share = float(source_owner.ownership_percentage)
        recipient_original_share = float(recipient_owner.ownership_percentage)
        
        source_new_share = source_original_share - transfer_share
        recipient_new_share = recipient_original_share + transfer_share
        
        # Determine if source owner should be deleted (0% or less remaining)
        should_delete_source = source_new_share <= 0
        
        # Mark source owner as leaving if transferring all shares
        for owner_data in ownership_state_before:
            if owner_data['owner_id'] == transfer_from_owner_id:
                owner_data['is_leaving'] = should_delete_source
                break
        
        # Build ownership_state_after
        ownership_state_after = []
        
        for owner_data in ownership_state_before:
            member_id = owner_data['member_id']
            
            # Skip source owner if they're leaving (0% or less)
            if member_id == source_owner.member.id and should_delete_source:
                continue
            
            # Update shares for source and recipient
            if member_id == source_owner.member.id:
                # Source owner (keeping some shares)
                owner_data = owner_data.copy()
                owner_data['share'] = max(0, source_new_share)  # Ensure non-negative
                owner_data['is_leaving'] = False
                ownership_state_after.append(owner_data)
            elif member_id == recipient_owner.member.id:
                # Recipient owner (already an owner, so is_joining=False)
                # Use transfer_date for purchase_date if provided, otherwise use original date
                owner_data = owner_data.copy()
                owner_data['share'] = recipient_new_share
                owner_data['is_joining'] = False
                if transfer_date:
                    owner_data['purchase_date'] = transfer_date.isoformat()
                ownership_state_after.append(owner_data)
            else:
                # Other owners - unchanged
                owner_data = owner_data.copy()
                owner_data['is_leaving'] = False
                owner_data['is_joining'] = False
                ownership_state_after.append(owner_data)
        
        return {
            'ownership_state_before': ownership_state_before,
            'ownership_state_after': ownership_state_after,
            'should_delete_source': should_delete_source,
            'source_owner_new_share': max(0, source_new_share),
            'recipient_owner_new_share': recipient_new_share,
            'source_owner': source_owner,
            'recipient_owner': recipient_owner
        }
    

class UnitStaffHistory(models.Model):
    """
    Dedicated table for storing unit staff history timeline entries.
    This tracks when staff members are assigned to or removed from units.
    
    Entry Types:
    - staff_assigned: When a staff member is assigned to a unit
    - staff_removed: When a staff member is removed from a unit
    - staff_status_changed: When a staff member's status (Live-in/Part-time) changes
    
    Structure:
    - staff_state_before: Complete staff state BEFORE the event
    - staff_state_after: Complete staff state AFTER the event
    - For assignment entries: staff_state_before shows previous state, staff_state_after includes new staff
    - For removal entries: staff_state_before shows previous state, staff_state_after shows state without removed staff
    """
    ENTRY_TYPE_CHOICES = [
        ('staff_assigned', 'Staff Assigned'),
        ('staff_removed', 'Staff Removed'),
        ('staff_status_changed', 'Staff Status Changed'),
    ]
    
    unit = models.ForeignKey(
        Unit, 
        on_delete=models.CASCADE, 
        related_name='staff_history'
    )
    entry_type = models.CharField(
        max_length=50, 
        choices=ENTRY_TYPE_CHOICES
    )
    entry_date = models.DateTimeField(
        default=timezone.now,
        help_text="The date/time this staff event occurred"
    )
    description = models.TextField(
        blank=True, 
        null=True,
        help_text="Human-readable description of the event"
    )
    
    # Staff member involved in this event
    staff_member = models.ForeignKey(
        'user.Member',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='staff_history_entries',
        help_text="The staff member involved in this event"
    )
    
    # Store staff member info directly to preserve data even if member is deleted
    staff_member_name = models.CharField(
        max_length=255,
        null=True,
        blank=True,
        help_text="Staff member name at the time of the event (preserved even if member is deleted)"
    )
    staff_member_contact = models.CharField(
        max_length=50,
        null=True,
        blank=True,
        help_text="Staff member contact at the time of the event (preserved even if member is deleted)"
    )
    staff_member_email = models.EmailField(
        null=True,
        blank=True,
        help_text="Staff member email at the time of the event (preserved even if member is deleted)"
    )
    
    # Staff status at the time of the event (True = Live-in, False = Part-time)
    staff_status = models.BooleanField(
        null=True,
        blank=True,
        help_text="Staff status at the time of event (True=Live-in, False=Part-time)"
    )
    
    # Complete staff state BEFORE this event
    # Structure: [{staff_id, member_id, name, contact, email, status, assignment_date}, ...]
    staff_state_before = models.JSONField(
        default=list,
        help_text="Complete staff state before this event with all staff details"
    )
    
    # Complete staff state AFTER this event
    # Structure: [{staff_id, member_id, name, contact, email, status, assignment_date}, ...]
    staff_state_after = models.JSONField(
        default=list,
        help_text="Complete staff state after this event with all staff details"
    )
    
    # Metadata
    created_at = models.DateTimeField(auto_now_add=True)
    created_by = models.ForeignKey(
        Member, 
        null=True, 
        on_delete=models.SET_NULL, 
        related_name='created_staff_history'
    )
    
    class Meta:
        ordering = ['-entry_date', '-created_at']
        indexes = [
            models.Index(fields=['unit', '-entry_date']),
            models.Index(fields=['entry_type']),
            models.Index(fields=['staff_member']),
        ]
        verbose_name = 'Unit Staff History'
        verbose_name_plural = 'Unit Staff Histories'
    
    def __str__(self):
        staff_name = self.staff_member.full_name if self.staff_member else "Unknown"
        return f"{self.get_entry_type_display()} - {staff_name} - Unit {self.unit.unit_name} - {self.entry_date}"
    
    @classmethod
    def create_staff_assigned_entry(cls, unit, staff_member, staff_status, entry_date, created_by=None, 
                                    staff_state_before=None, staff_state_after=None):
        """
        Create a staff assignment entry.
        
        Args:
            unit: Unit instance
            staff_member: Member instance (the staff being assigned)
            staff_status: Boolean (True=Live-in, False=Part-time)
            entry_date: Date/time of the assignment
            created_by: Member who created this entry
            staff_state_before: Complete staff state before assignment (optional, will fetch if not provided)
            staff_state_after: Complete staff state after assignment (optional, will build if not provided)
        """
        # If staff_state_before not provided, get it from the last history entry
        if staff_state_before is None:
            last_entry = cls.objects.filter(unit=unit).order_by('-entry_date', '-created_at').first()
            if last_entry and last_entry.staff_state_after:
                staff_state_before = last_entry.staff_state_after
            else:
                staff_state_before = []
        
        # If staff_state_after not provided, build it from before state + new staff
        if staff_state_after is None:
            staff_state_after = list(staff_state_before) if staff_state_before else []
            # Add new staff member to the state
            new_staff_data = {
                'staff_id': None,  # Will be set after UnitStaff is created
                'member_id': staff_member.id,
                'name': staff_member.full_name,
                'contact': staff_member.general_contact or '',
                'email': staff_member.general_email or '',
                'status': 'Live-in' if staff_status else 'Part-time',
                'assignment_date': entry_date.date().isoformat() if hasattr(entry_date, 'date') else str(entry_date)
            }
            staff_state_after.append(new_staff_data)
        
        return cls.objects.create(
            unit=unit,
            entry_type='staff_assigned',
            entry_date=entry_date,
            description=f"{staff_member.full_name} assigned to unit",
            staff_member=staff_member,
            staff_member_name=staff_member.full_name,
            staff_member_contact=staff_member.general_contact or '',
            staff_member_email=staff_member.general_email or '',
            staff_status=staff_status,
            staff_state_before=staff_state_before,
            staff_state_after=staff_state_after,
            created_by=created_by
        )
    
    @classmethod
    def create_staff_removed_entry(cls, unit, staff_member, entry_date, created_by=None, 
                                   staff_state_before=None, staff_state_after=None):
        """
        Create a staff removal entry.
        
        Args:
            unit: Unit instance
            staff_member: Member instance (the staff being removed)
            entry_date: Date/time of the removal
            created_by: Member who created this entry
            staff_state_before: Complete staff state before removal (optional, will fetch if not provided)
            staff_state_after: Complete staff state after removal (optional, will build if not provided)
        """
        # If staff_state_before not provided, get it from the last history entry
        if staff_state_before is None:
            last_entry = cls.objects.filter(unit=unit).order_by('-entry_date', '-created_at').first()
            if last_entry and last_entry.staff_state_after:
                staff_state_before = last_entry.staff_state_after
            else:
                staff_state_before = []
        
        # If staff_state_after not provided, build it by removing the staff member
        if staff_state_after is None:
            staff_state_after = [
                staff for staff in staff_state_before 
                if staff.get('member_id') != staff_member.id
            ]
        
        return cls.objects.create(
            unit=unit,
            entry_type='staff_removed',
            entry_date=entry_date,
            description=f"{staff_member.full_name} removed from unit",
            staff_member=staff_member,
            staff_member_name=staff_member.full_name,
            staff_member_contact=staff_member.general_contact or '',
            staff_member_email=staff_member.general_email or '',
            staff_status=None,  # Not applicable for removal
            staff_state_before=staff_state_before,
            staff_state_after=staff_state_after,
            created_by=created_by
        )
    
    @classmethod
    def create_staff_status_changed_entry(cls, unit, staff_member, old_status, new_status, entry_date, created_by=None,
                                         staff_state_before=None, staff_state_after=None):
        """
        Create a staff status change entry.
        
        Args:
            unit: Unit instance
            staff_member: Member instance (the staff whose status changed)
            old_status: Boolean (previous status)
            new_status: Boolean (new status)
            entry_date: Date/time of the status change
            created_by: Member who created this entry
            staff_state_before: Complete staff state before change (optional, will fetch if not provided)
            staff_state_after: Complete staff state after change (optional, will build if not provided)
        """
        # If staff_state_before not provided, get it from the last history entry
        if staff_state_before is None:
            last_entry = cls.objects.filter(unit=unit).order_by('-entry_date', '-created_at').first()
            if last_entry and last_entry.staff_state_after:
                staff_state_before = last_entry.staff_state_after
            else:
                staff_state_before = []
        
        # If staff_state_after not provided, build it by updating the staff member's status
        if staff_state_after is None:
            staff_state_after = []
            for staff in staff_state_before:
                if staff.get('member_id') == staff_member.id:
                    # Update the status for this staff member
                    updated_staff = staff.copy()
                    updated_staff['status'] = 'Live-in' if new_status else 'Part-time'
                    staff_state_after.append(updated_staff)
                else:
                    staff_state_after.append(staff)
        
        return cls.objects.create(
            unit=unit,
            entry_type='staff_status_changed',
            entry_date=entry_date,
            description=f"Staff member {staff_member.full_name} status changed from {'Live-in' if old_status else 'Part-time'} to {'Live-in' if new_status else 'Part-time'}",
            staff_member=staff_member,
            staff_member_name=staff_member.full_name,
            staff_member_contact=staff_member.general_contact or '',
            staff_member_email=staff_member.general_email or '',
            staff_status=new_status,
            staff_state_before=staff_state_before,
            staff_state_after=staff_state_after,
            created_by=created_by
        )


class UnitResidentHistory(models.Model):
    """
    Dedicated table for storing unit resident history timeline entries.
    Tracks when residents/tenants are assigned to or removed from units.
    
    Entry Types:
    - resident_assigned: When a resident is assigned to a unit
    - resident_removed: When a resident is removed from a unit
    - resident_info_updated: When resident details (rent, etc.) are updated
    - resident_status_changed: When a resident's status (Resident/Tenant) changes
    """
    ENTRY_TYPE_CHOICES = [
        ('resident_assigned', 'Resident Assigned'),
        ('resident_removed', 'Resident Removed'),
        ('resident_info_updated', 'Resident Info Updated'),
        ('resident_status_changed', 'Resident Status Changed'),
        ('attachment_added', 'Attachment Added'),
        ('attachment_removed', 'Attachment Removed'),
    ]
    
    unit = models.ForeignKey(
        Unit, 
        on_delete=models.CASCADE, 
        related_name='resident_history'
    )
    entry_type = models.CharField(
        max_length=50, 
        choices=ENTRY_TYPE_CHOICES
    )
    entry_date = models.DateTimeField(
        default=timezone.now,
        help_text="The date/time this resident event occurred"
    )
    description = models.TextField(
        blank=True, 
        null=True,
        help_text="Human-readable description of the event"
    )
    
    # Resident member involved in this event
    resident_member = models.ForeignKey(
        'user.Member',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='resident_history_entries',
        help_text="The resident member involved in this event"
    )
    
    # Resident status at the time of the event (True = Resident, False = Tenant)
    is_resident_or_tenant = models.BooleanField(
        null=True,
        blank=True,
        help_text="Resident status at the time of event (True=Resident, False=Tenant)"
    )
    
    # Store resident info directly to handle cases where Member record is deleted
    resident_name = models.CharField(max_length=255, null=True, blank=True)
    resident_contact = models.CharField(max_length=50, null=True, blank=True)
    resident_email = models.EmailField(null=True, blank=True)
    
    # Complete resident state BEFORE this event
    # Structure: [{resident_id, member_id, name, contact, email, is_resident_or_tenant, unit_rent_fee, assignment_date}, ...]
    resident_state_before = models.JSONField(
        default=list,
        help_text="Complete resident state before this event with all resident details"
    )
    
    # Complete resident state AFTER this event
    # Structure: [{resident_id, member_id, name, contact, email, is_resident_or_tenant, unit_rent_fee, assignment_date}, ...]
    resident_state_after = models.JSONField(
        default=list,
        help_text="Complete resident state after this event with all resident details"
    )
    
    # Metadata
    created_at = models.DateTimeField(auto_now_add=True)
    created_by = models.ForeignKey(
        Member, 
        null=True, 
        on_delete=models.SET_NULL, 
        related_name='created_resident_history'
    )
    
    class Meta:
        ordering = ['-entry_date', '-created_at']
        indexes = [
            models.Index(fields=['unit', '-entry_date']),
            models.Index(fields=['entry_type']),
            models.Index(fields=['resident_member']),
        ]
        verbose_name = 'Unit Resident History'
        verbose_name_plural = 'Unit Resident Histories'
    
    def __str__(self):
        resident_name = self.resident_member.full_name if self.resident_member else "Unknown"
        return f"{self.get_entry_type_display()} - {resident_name} - Unit {self.unit.unit_name} - {self.entry_date}"
    
    @staticmethod
    def build_resident_data_with_attachments(resident, request=None):
        """
        Build resident data dictionary with attachments included.
        
        Args:
            resident: Resident instance
            request: Request object (optional, for building absolute URLs)
        
        Returns:
            Dict with resident data including attachments
        """
        # Get attachments for this resident
        attachments = []
        for doc in ResidentDocs.objects.filter(resident=resident):
            if doc.rental_docs:
                doc_url = doc.rental_docs.url
                if request:
                    doc_url = request.build_absolute_uri(doc_url)
                attachments.append({
                    'id': doc.id,
                    'name': os.path.basename(doc.rental_docs.name) if doc.rental_docs else None,
                    'url': doc_url
                })
        
        return {
            'resident_id': resident.id,
            'member_id': resident.member.id,
            'name': resident.member.full_name,
            'contact': resident.member.general_contact or '',
            'email': resident.member.general_email or '',
            'is_resident_or_tenant': resident.is_resident_or_tenant,
            'status_label': 'Resident' if resident.is_resident_or_tenant else 'Tenant',
            'unit_rent_fee': float(resident.unit_rent_fee),
            'advance_payment': float(resident.advance_payment),
            'notice_period': resident.notice_period,
            'assignment_date': resident.created_at.date().isoformat() if resident.created_at else None,
            'attachments': attachments
        }
    
    @classmethod
    def create_attachment_entry(cls, unit, resident, entry_type, attachments_info, entry_date=None, created_by=None, 
                                resident_state_before=None, resident_state_after=None, request=None):
        """
        Create an attachment history entry (added or removed).
        
        Args:
            unit: Unit instance
            resident: Resident instance
            entry_type: 'attachment_added' or 'attachment_removed'
            attachments_info: List of dicts with attachment details (id, name, url) - can be single item or multiple
            entry_date: Date/time of the attachment event (defaults to now)
            created_by: Member who created this entry
            resident_state_before: Complete resident state before this event (optional)
            resident_state_after: Complete resident state after this event (optional)
            request: Request object (optional, for building absolute URLs)
        """
        if entry_date is None:
            entry_date = timezone.now()
        
        # Ensure attachments_info is a list
        if not isinstance(attachments_info, list):
            attachments_info = [attachments_info]
        
        # If resident states not provided, get current state
        if resident_state_before is None or resident_state_after is None:
            all_residents = Resident.objects.filter(unit=unit).select_related('member')
            current_state = []
            for r in all_residents:
                resident_data = cls.build_resident_data_with_attachments(r, request)
                current_state.append(resident_data)
            
            if resident_state_before is None:
                resident_state_before = current_state
            if resident_state_after is None:
                resident_state_after = current_state
        
        # Build description
        if entry_type == 'attachment_added':
            if len(attachments_info) == 1:
                description = f"Attachment '{attachments_info[0].get('name', 'attachment')}' added for {resident.member.full_name}"
            else:
                description = f"{len(attachments_info)} attachments added for {resident.member.full_name}"
        elif entry_type == 'attachment_removed':
            if len(attachments_info) == 1:
                description = f"Attachment '{attachments_info[0].get('name', 'attachment')}' removed for {resident.member.full_name}"
            else:
                description = f"{len(attachments_info)} attachments removed for {resident.member.full_name}"
        else:
            description = f"Attachment change for {resident.member.full_name}"
        
        return cls.objects.create(
            unit=unit,
            entry_type=entry_type,
            entry_date=entry_date,
            description=description,
            resident_member=resident.member,
            resident_name=resident.member.full_name,
            resident_contact=resident.member.general_contact or '',
            resident_email=resident.member.general_email or '',
            is_resident_or_tenant=resident.is_resident_or_tenant,
            resident_state_before=resident_state_before,
            resident_state_after=resident_state_after,
            created_by=created_by
        )
    
    @classmethod
    def create_resident_assigned_entry(cls, unit, resident_member, is_resident_or_tenant, entry_date, created_by=None, 
                                     resident_state_before=None, resident_state_after=None, extra_info=None, description=None):
        """
        Create a resident assignment entry.
        
        Args:
            description: Optional custom description. If not provided, defaults to standard format.
        """
        if resident_state_before is None:
            last_entry = cls.objects.filter(unit=unit).order_by('-entry_date', '-created_at').first()
            if last_entry and last_entry.resident_state_after:
                resident_state_before = last_entry.resident_state_after
            else:
                resident_state_before = []
        
        if resident_state_after is None:
            resident_state_after = list(resident_state_before) if resident_state_before else []
            new_resident_data = {
                'resident_id': None,
                'member_id': resident_member.id,
                'name': resident_member.full_name,
                'contact': resident_member.general_contact or '',
                'email': resident_member.general_email or '',
                'is_resident_or_tenant': is_resident_or_tenant,
                'status_label': 'Resident' if is_resident_or_tenant else 'Tenant',
                'assignment_date': entry_date.date().isoformat() if hasattr(entry_date, 'date') else str(entry_date)
            }
            if extra_info:
                new_resident_data.update(extra_info)
            resident_state_after.append(new_resident_data)
        
        # Use custom description if provided, otherwise use default
        if description is None:
            description = f"{resident_member.full_name} assigned to unit"
        
        return cls.objects.create(
            unit=unit,
            entry_type='resident_assigned',
            entry_date=entry_date,
            description=description,
            resident_member=resident_member,
            resident_name=resident_member.full_name,
            resident_contact=resident_member.general_contact or '',
            resident_email=resident_member.general_email or '',
            is_resident_or_tenant=is_resident_or_tenant,
            resident_state_before=resident_state_before,
            resident_state_after=resident_state_after,
            created_by=created_by
        )
    
    @classmethod
    def create_resident_removed_entry(cls, unit, resident_member, entry_date, created_by=None, 
                                    resident_state_before=None, resident_state_after=None, is_resident_or_tenant=None):
        """
        Create a resident removal entry.
        """
        if resident_state_before is None:
            last_entry = cls.objects.filter(unit=unit).order_by('-entry_date', '-created_at').first()
            if last_entry and last_entry.resident_state_after:
                resident_state_before = last_entry.resident_state_after
            else:
                resident_state_before = []
        
        if resident_state_after is None:
            resident_state_after = [
                res for res in resident_state_before 
                if res.get('member_id') != resident_member.id
            ]
        
        # If is_resident_or_tenant not provided, try to find it in before state
        if is_resident_or_tenant is None and resident_state_before:
            for res in resident_state_before:
                if res.get('member_id') == resident_member.id:
                    is_resident_or_tenant = res.get('is_resident_or_tenant')
                    break

        return cls.objects.create(
            unit=unit,
            entry_type='resident_removed',
            entry_date=entry_date,
            description=f"Resident {resident_member.full_name} removed from unit",
            resident_member=resident_member,
            resident_name=resident_member.full_name,
            resident_contact=resident_member.general_contact or '',
            resident_email=resident_member.general_email or '',
            is_resident_or_tenant=is_resident_or_tenant,
            resident_state_before=resident_state_before,
            resident_state_after=resident_state_after,
            created_by=created_by
        )
    
    @classmethod
    def create_resident_status_changed_entry(cls, unit, resident_member, old_status, new_status, entry_date, created_by=None,
                                          resident_state_before=None, resident_state_after=None):
        """
        Create a resident status change entry (e.g. from Tenant to Resident).
        """
        if resident_state_before is None:
            last_entry = cls.objects.filter(unit=unit).order_by('-entry_date', '-created_at').first()
            if last_entry and last_entry.resident_state_after:
                resident_state_before = last_entry.resident_state_after
            else:
                resident_state_before = []
        
        if resident_state_after is None:
            resident_state_after = []
            for res in resident_state_before:
                if res.get('member_id') == resident_member.id:
                    updated_res = res.copy()
                    updated_res['is_resident_or_tenant'] = new_status
                    updated_res['status_label'] = 'Resident' if new_status else 'Tenant'
                    resident_state_after.append(updated_res)
                else:
                    resident_state_after.append(res)
        
        old_label = 'Resident' if old_status else 'Tenant'
        new_label = 'Resident' if new_status else 'Tenant'
        
        return cls.objects.create(
            unit=unit,
            entry_type='resident_status_changed',
            entry_date=entry_date,
            description=f"Resident {resident_member.full_name} status changed from {old_label} to {new_label}",
            resident_member=resident_member,
            resident_name=resident_member.full_name,
            resident_contact=resident_member.general_contact or '',
            resident_email=resident_member.general_email or '',
            is_resident_or_tenant=new_status,
            resident_state_before=resident_state_before,
            resident_state_after=resident_state_after,
            created_by=created_by
        )

    @classmethod
    def create_resident_info_updated_entry(cls, unit, resident_member, entry_date, description, created_by=None,
                                         resident_state_before=None, resident_state_after=None):
        """
        Create a resident info update entry.
        """
        if resident_state_before is None:
            last_entry = cls.objects.filter(unit=unit).order_by('-entry_date', '-created_at').first()
            if last_entry and last_entry.resident_state_after:
                resident_state_before = last_entry.resident_state_after
            else:
                resident_state_before = []
        
        # If after state is not provided, we just assume it's updated in the calling view
        if resident_state_after is None:
            resident_state_after = resident_state_before

        return cls.objects.create(
            unit=unit,
            entry_type='resident_info_updated',
            entry_date=entry_date,
            description=description,
            resident_member=resident_member,
            resident_name=resident_member.full_name,
            resident_contact=resident_member.general_contact or '',
            resident_email=resident_member.general_email or '',
            is_resident_or_tenant=None, # Not status change
            resident_state_before=resident_state_before,
            resident_state_after=resident_state_after,
            created_by=created_by
        )