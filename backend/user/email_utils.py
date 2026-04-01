"""
Utility functions for rendering HTML email templates
"""
from django.template.loader import render_to_string
from django.core.mail import EmailMultiAlternatives
from django.conf import settings


def send_html_email(subject, template_name, context, recipient_list, from_email=None):
    """
    Send an HTML email using Django templates.
    
    Args:
        subject: Email subject line
        template_name: Path to the template (e.g., 'user/emails/welcome_credentials.html')
        context: Dictionary of template variables
        recipient_list: List of recipient email addresses
        from_email: Sender email (defaults to settings.EMAIL_HOST_USER)
    
    Returns:
        Number of emails sent
    """
    if from_email is None:
        from_email = settings.EMAIL_HOST_USER
    
    # Render HTML content
    html_content = render_to_string(template_name, context)
    
    # Generate plain text fallback (strip HTML tags for basic plain text)
    # This is a simple fallback - for better results, create separate plain text templates
    import re
    plain_text = re.sub(r'<[^>]+>', '', html_content)
    plain_text = re.sub(r'\s+', ' ', plain_text).strip()
    
    # Create email message
    email = EmailMultiAlternatives(
        subject=subject,
        body=plain_text,  # Plain text fallback
        from_email=from_email,
        to=recipient_list,
    )
    
    # Attach HTML content
    email.attach_alternative(html_content, "text/html")
    
    # Send email
    return email.send(fail_silently=False)
