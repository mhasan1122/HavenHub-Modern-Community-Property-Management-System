from django.db import models
from django.core.exceptions import ValidationError

from user.models import Member


class ImportantContact(models.Model):
    """
    Important Contact model that references organization members.
    All contact data (name, phone, email, designation, photo) is pulled from the Member table.
    """
    org_member = models.ForeignKey(
        Member,
        on_delete=models.CASCADE,
        related_name="important_contacts",
        help_text="Organization member reference (required - must be an org member)"
    )
    created_by = models.ForeignKey(
        Member,
        on_delete=models.DO_NOTHING,
        related_name="important_contacts_created",
        help_text="Member who created this important contact entry"
    )
    updated_by = models.ForeignKey(
        Member,
        on_delete=models.DO_NOTHING,
        related_name="important_contacts_updated",
        null=True,
        blank=True,
        help_text="Member who last updated this entry"
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-created_at"]
        unique_together = [['org_member']]  # Prevent duplicate entries
        verbose_name = "Important Contact"
        verbose_name_plural = "Important Contacts"

    def clean(self):
        """Validate that the org_member is actually an organization member"""
        if self.org_member and not self.org_member.is_org_member:
            raise ValidationError({
                'org_member': 'Only organization members can be added as important contacts.'
            })

    def save(self, *args, **kwargs):
        """Override save to run clean validation"""
        self.full_clean()
        super().save(*args, **kwargs)

    def __str__(self) -> str:
        if self.org_member:
            return f"{self.org_member.full_name} (Important Contact)"
        return f"Important Contact #{self.id}"

    # Properties to access member data directly
    @property
    def name(self):
        """Get name from org_member"""
        return self.org_member.full_name if self.org_member else None

    @property
    def phone_number(self):
        """Get phone number from org_member"""
        return self.org_member.general_contact if self.org_member else None

    @property
    def email(self):
        """Get email from org_member"""
        return self.org_member.general_email if self.org_member else None

    @property
    def designation(self):
        """Get designation from org_member (member_type_name or occupation)"""
        if not self.org_member:
            return None
        if hasattr(self.org_member, 'member_type') and self.org_member.member_type:
            return self.org_member.member_type.type_name
        return self.org_member.occupation or None

    @property
    def photo(self):
        """Get photo from org_member"""
        return self.org_member.photo if self.org_member else None

    @property
    def photo_url(self):
        """Get photo URL from org_member"""
        if self.org_member and self.org_member.photo:
            return self.org_member.photo.url
        return None

