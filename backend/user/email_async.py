"""
Email sending utility for credential emails
Supports both synchronous (single record) and parallel batch sending (bulk upload)
"""
import logging
import threading
from concurrent.futures import ThreadPoolExecutor, as_completed
from django.core.mail import send_mail
from django.conf import settings
from django.contrib.auth.models import User
from user.serializers import MemberSerializer, generate_random_username, generate_random_password
from user.models import Member
from user.email_utils import send_html_email

logger = logging.getLogger(__name__)

# Get login link from settings
LOGIN_LINK = getattr(settings, 'LOGIN_LINK', 'https://control.estatelink.cloud/login')
APP_DOWNLOAD_LINK = getattr(settings, 'APP_DOWNLOAD_LINK', 'https://play.google.com/apps/internaltest/4701408139020918392')

# Thread pool for parallel email sending
_email_thread_pool = None
_pool_lock = threading.Lock()

def get_email_thread_pool():
    """Get or create a thread pool for email sending"""
    global _email_thread_pool
    if _email_thread_pool is None:
        with _pool_lock:
            if _email_thread_pool is None:
                # Create thread pool with max 10 concurrent email sends
                _email_thread_pool = ThreadPoolExecutor(max_workers=10, thread_name_prefix='email_sender')
    return _email_thread_pool


def send_credential_email_async(member_id, recipient_email, role_type="Member"):
    """
    Send credential email synchronously for single record.
    For bulk operations, use send_credential_emails_batch instead.
    
    Args:
        member_id: ID of the Member to send credentials to
        recipient_email: Email address to send to (prevents race condition)
        role_type: Type of role (Owner, Resident, Staff, etc.)
    """
    # Send email synchronously (fast like password reset)
    _send_credential_email_worker(member_id, recipient_email, role_type)


def send_credential_emails_batch(email_jobs):
    """
    Send multiple credential emails in parallel using thread pool.
    This ensures all emails arrive in inboxes at roughly the same time.
    
    Args:
        email_jobs: List of dicts with keys: member_id, recipient_email, role_type
        Example: [
            {'member_id': 1, 'recipient_email': 'user1@test.com', 'role_type': 'Owner'},
            {'member_id': 2, 'recipient_email': 'user2@test.com', 'role_type': 'Owner'},
        ]
    
    Returns:
        tuple: (success_count, failed_count, results)
    """
    if not email_jobs:
        return 0, 0, []
    
    print(f"\n📧 Starting parallel email sending for {len(email_jobs)} emails...")
    
    pool = get_email_thread_pool()
    futures = []
    
    # Submit all email jobs to thread pool
    for job in email_jobs:
        future = pool.submit(
            _send_credential_email_worker,
            job['member_id'],
            job['recipient_email'],
            job['role_type']
        )
        futures.append((future, job))
    
    # Wait for all emails to complete
    success_count = 0
    failed_count = 0
    results = []
    
    for future, job in futures:
        try:
            future.result(timeout=30)  # Wait max 30 seconds per email
            success_count += 1
            results.append({
                'email': job['recipient_email'],
                'status': 'sent',
                'error': None
            })
        except Exception as e:
            failed_count += 1
            error_msg = str(e)
            logger.error(f"❌ Batch email failed for {job['recipient_email']}: {error_msg}")
            results.append({
                'email': job['recipient_email'],
                'status': 'failed',
                'error': error_msg
            })
    
    print(f"✅ Batch email complete: {success_count} sent, {failed_count} failed")
    return success_count, failed_count, results


def _send_credential_email_worker(member_id, recipient_email, role_type):
    """
    Send credential email for the specified member.
    
    Args:
        member_id: ID of the member
        recipient_email: Email address to send to (MUST be explicitly set by caller)
        role_type: Type of role (Owner, Resident, Staff, etc.)
    """
    # Use a prefix for all log messages to identify which member is being processed
    # This prevents confusion when multiple emails are sent in parallel
    log_prefix = f"[Member {member_id}]"
    
    try:
        print(f"\n🔄 {log_prefix} Starting email send")
        print(f"   {log_prefix} 📧 Target email: {recipient_email}")
        
        # Validate that recipient_email is not empty (should be checked by caller, but double-check)
        if not recipient_email:
            error_msg = f"❌ recipient_email is empty or None"
            logger.error(f"{log_prefix} {error_msg}")
            print(f"   {log_prefix} {error_msg}")
            return
        
        # Get member from database
        try:
            member = Member.objects.get(id=member_id)
            print(f"   {log_prefix} ✅ Found member: {member.full_name}")
        except Member.DoesNotExist:
            error_msg = f"❌ Member with ID {member_id} not found"
            logger.error(f"{log_prefix} {error_msg}")
            print(f"   {log_prefix} {error_msg}")
            return
        
        # Check if this specific email already has a user account (by any OTHER member)
        existing_member_with_email = Member.objects.filter(
            login_email=recipient_email
        ).exclude(id=member.id).first()
        
        if existing_member_with_email and existing_member_with_email.user:
            warning_msg = f"Email {recipient_email} already has a user account (used by member: {existing_member_with_email.full_name})"
            logger.warning(f"{log_prefix} ⚠️ {warning_msg}")
            print(f"   {log_prefix} ⚠️ {warning_msg}")
            return
        
        # Generate username and password using full_name in format: fullname_XXXX
        username = generate_random_username(full_name=member.full_name)
        password = generate_random_password()
        print(f"   {log_prefix} 🔑 Generated credentials - Username: {username}")
        
        # If member already has a user account with different email, delete it first
        if member.user:
            old_username = member.user.username
            old_user = member.user
            member.user = None
            member.save(update_fields=['user'])
            old_user.delete()
            print(f"   {log_prefix} 🗑️ Deleted old user account: {old_username}")
            logger.info(f"{log_prefix} Deleted old user account '{old_username}' for member {member.full_name} to create new account with email {recipient_email}")
        
        # Create new user account
        user = User.objects.create_user(username=username, password=password)
        member.user = user
        member.login_email = recipient_email
        member.save()
        print(f"   {log_prefix} ✅ Created new user account")
        
        # Prepare email content with HTML template
        subject = f"Your {role_type} Account Credentials"
        
        # Send HTML email
        print(f"   {log_prefix} 📤 Attempting to send email to {recipient_email}...")
        logger.info(f"{log_prefix} 📧 Sending credential email to {recipient_email} for {role_type} {member.full_name}")
        
        from django.conf import settings as django_settings
        print(f"   {log_prefix} 📋 Email config: {django_settings.EMAIL_BACKEND}")
        print(f"   {log_prefix} 📋 SMTP Host: {django_settings.EMAIL_HOST}")
        print(f"   {log_prefix} 📋 From: {django_settings.EMAIL_HOST_USER}")
        
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
        
        is_comm = member.is_comm_member
        is_org = member.is_org_member
        
        if is_org and is_comm:
            login_link_to_use = login_link_both
            show_app_links = True
        elif is_org:
            login_link_to_use = login_link_org
            show_app_links = False
        elif is_comm:
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
        
        result = send_html_email(
            subject=subject,
            template_name='user/emails/welcome_credentials.html',
            context=context,
            recipient_list=[recipient_email],
            from_email=settings.EMAIL_HOST_USER,
        )
        
        print(f"   {log_prefix} ✅ Email sent! Result: {result}")
        logger.info(f"{log_prefix} ✅ Credential email sent successfully to {recipient_email} for {role_type} {member.full_name}")
        
    except Exception as e:
        error_msg = f"Error sending credential email: {str(e)}"
        logger.error(f"{log_prefix} ❌ {error_msg}", exc_info=True)
        print(f"   {log_prefix} ❌ {error_msg}")
        import traceback
        traceback.print_exc()


def send_credential_email_sync(member, role_type="Member"):
    """
    Send credential email synchronously (for single record creation).
    Returns: (success: bool, username: str or None, password: str or None, message: str)
    
    Use this for single record creation where you want immediate feedback.
    For bulk operations, use send_credential_email_async instead.
    """
    try:
        # Determine which email to use for sending credentials
        # Priority: login_email (from delivery_method) > general_email
        recipient_email = None
        if member.login_email:
            recipient_email = member.login_email
        elif member.general_email:
            recipient_email = member.general_email
        else:
            error_msg = f"No email address found for {member.full_name}"
            return False, None, None, error_msg
        
        # Check if this specific email already has a user account (by any OTHER member)
        existing_member_with_email = Member.objects.filter(
            login_email=recipient_email
        ).exclude(id=member.id).first()
        
        if existing_member_with_email and existing_member_with_email.user:
            return False, None, None, f"Email {recipient_email} already has a user account (used by member: {existing_member_with_email.full_name})"
        
        # Generate username and password using full_name in format: fullname_XXXX
        username = generate_random_username(full_name=member.full_name)
        password = generate_random_password()
        
        # If member already has a user account with different email, delete it first
        if member.user:
            old_username = member.user.username
            old_user = member.user
            member.user = None
            member.save(update_fields=['user'])
            old_user.delete()
            logger.info(f"Deleted old user account '{old_username}' for member {member.full_name} to create new account with email {recipient_email}")
        
        # Create new user account
        user = User.objects.create_user(username=username, password=password)
        member.user = user
        member.login_email = recipient_email
        member.save()
        
        # Use MemberSerializer's email method
        serializer = MemberSerializer()
        
        is_comm = member.is_comm_member
        is_org = member.is_org_member
        print(f"[DEBUG] email_async -> send_welcome_email: member.is_comm_member={is_comm}, member.is_org_member={is_org}")
        
        serializer.send_welcome_email(recipient_email, username, password, is_comm_member=is_comm, is_org_member=is_org)
        
        logger.info(f"✅ Credential email sent successfully to {recipient_email} for {role_type} {member.full_name}")
        return True, username, password, f"Credential email sent successfully to {recipient_email}"
        
    except Exception as e:
        logger.error(f"❌ Error sending credential email to {member.full_name}: {str(e)}", exc_info=True)
        return False, None, None, f"Error sending credential email: {str(e)}"

