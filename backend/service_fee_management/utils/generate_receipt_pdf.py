"""
Payment Receipt PDF Generator using WeasyPrint.
Converts the HTML receipt from email_utils.generate_payment_receipt_html() to PDF.
"""
import logging

try:
    from weasyprint import HTML as WeasyHTML
    HAS_WEASYPRINT = True
except Exception:
    WeasyHTML = None
    HAS_WEASYPRINT = False

logger = logging.getLogger(__name__)

def generate_receipt_pdf_weasyprint(payment_data):
    """
    Generate a PDF from payment receipt HTML using WeasyPrint.
    WeasyPrint supports complex fonts (including Bengali ৳) and modern CSS.
    
    Args:
        payment_data: dict with payment information
        
    Returns:
        bytes: PDF content, or None if generation fails
    """
    if not HAS_WEASYPRINT:
        logger.warning("WeasyPrint not available - cannot generate PDF. Install GTK3 on Windows or deploy to Linux.")
        return None

    try:
        from service_fee_management.utils.email_utils import generate_payment_receipt_html

        html_content = generate_payment_receipt_html(payment_data)
        
        # WeasyPrint generation
        pdf_bytes = WeasyHTML(string=html_content).write_pdf()

        logger.info(f"Receipt PDF generated with WeasyPrint: {len(pdf_bytes)} bytes")
        return pdf_bytes
    except Exception as e:
        logger.error(f"Receipt PDF generation failed with WeasyPrint: {e}", exc_info=True)
        return None

# Keep old name as alias to avoid breaking existing imports
generate_receipt_pdf_reportlab = generate_receipt_pdf_weasyprint
