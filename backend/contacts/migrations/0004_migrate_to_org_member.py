# Generated manually - Migration to refactor ImportantContact model

from django.db import migrations, models
import django.db.models.deletion


def migrate_member_to_org_member(apps, schema_editor):
    """
    Migrate data from old 'member' field to new 'org_member' field.
    Only migrate if member exists and is an org member.
    If no member exists, we'll need to delete those contacts or assign a default.
    """
    ImportantContact = apps.get_model('contacts', 'ImportantContact')
    Member = apps.get_model('user', 'Member')
    
    # Get all contacts
    all_contacts = ImportantContact.objects.all()
    
    migrated_count = 0
    skipped_count = 0
    deleted_count = 0
    
    for contact in all_contacts:
        if contact.member:
            # Check if the member is an org member
            if contact.member.is_org_member:
                contact.org_member = contact.member
                contact.save()
                migrated_count += 1
            else:
                # Member exists but is not an org member - skip
                skipped_count += 1
        else:
            # No member assigned - we need to delete this contact
            # as org_member is required in the new model
            contact.delete()
            deleted_count += 1
    
    print(f"Migrated {migrated_count} contacts to org_member")
    if skipped_count > 0:
        print(f"Skipped {skipped_count} contacts (member is not an org member)")
    if deleted_count > 0:
        print(f"Deleted {deleted_count} contacts (no member assigned)")


def reverse_migrate(apps, schema_editor):
    """
    Reverse migration: copy org_member back to member
    """
    ImportantContact = apps.get_model('contacts', 'ImportantContact')
    
    contacts = ImportantContact.objects.filter(org_member__isnull=False)
    for contact in contacts:
        contact.member = contact.org_member
        contact.save()


class Migration(migrations.Migration):

    dependencies = [
        ('contacts', '0003_importantcontact_member'),
        ('user', '0002_delete_mymodel'),
    ]

    operations = [
        # Step 1: Add org_member field as nullable first
        migrations.AddField(
            model_name='importantcontact',
            name='org_member',
            field=models.ForeignKey(
                null=True,
                blank=True,
                on_delete=django.db.models.deletion.CASCADE,
                related_name='important_contacts_new',
                to='user.member',
                help_text='Organization member reference (required - must be an org member)'
            ),
        ),
        
        # Step 2: Migrate data from member to org_member
        migrations.RunPython(migrate_member_to_org_member, reverse_migrate),
        
        # Step 3: Remove old fields
        migrations.RemoveField(
            model_name='importantcontact',
            name='name',
        ),
        migrations.RemoveField(
            model_name='importantcontact',
            name='phone_number',
        ),
        migrations.RemoveField(
            model_name='importantcontact',
            name='email',
        ),
        migrations.RemoveField(
            model_name='importantcontact',
            name='designation',
        ),
        migrations.RemoveField(
            model_name='importantcontact',
            name='photo',
        ),
        migrations.RemoveField(
            model_name='importantcontact',
            name='member',
        ),
        
        # Step 4: Make org_member non-nullable and update related_name
        migrations.AlterField(
            model_name='importantcontact',
            name='org_member',
            field=models.ForeignKey(
                on_delete=django.db.models.deletion.CASCADE,
                related_name='important_contacts',
                to='user.member',
                help_text='Organization member reference (required - must be an org member)'
            ),
        ),
        
        # Step 5: Add unique constraint
        migrations.AlterUniqueTogether(
            name='importantcontact',
            unique_together={('org_member',)},
        ),
    ]

