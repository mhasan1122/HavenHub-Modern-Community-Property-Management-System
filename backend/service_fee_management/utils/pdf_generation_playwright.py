import logging
from playwright.sync_api import sync_playwright
import os

logger = logging.getLogger(__name__)

def generate_pdf_with_playwright(html_content):
    """
    Generate PDF from HTML content using Playwright.
    Returns bytes of the PDF.
    """
    try:
        with sync_playwright() as p:
            # Launch chromium in headless mode
            browser = p.chromium.launch(headless=True)
            context = browser.new_context()
            page = context.new_page()
            
            # Set HTML content with a standard desktop viewport for rendering
            page.set_viewport_size({"width": 1280, "height": 800})
            page.set_content(html_content, wait_until="networkidle")
            
            # Generate PDF matching the CSS @page rules
            pdf_bytes = page.pdf(
                format="A4",
                margin={"top": "0mm", "right": "0mm", "bottom": "0mm", "left": "0mm"},
                print_background=True,
                display_header_footer=False,
                prefer_css_page_size=True
            )
            
            browser.close()
            return pdf_bytes
    except Exception as e:
        logger.error(f"Playwright PDF generation failed: {e}", exc_info=True)
        return None

def generate_pdf_from_html(html_content):
    """
    Tries to generate PDF using different methods.
    Priority:
    1. Playwright (Best quality, same as browser/local)
    2. WeasyPrint (Alternative)
    """
    # 1. Try Playwright first for high-quality "smooth" rendering
    try:
        # Check if playwright is actually installed by trying to import
        import playwright
        pdf_bytes = generate_pdf_with_playwright(html_content)
        if pdf_bytes:
            print("  [OK] PDF generated using Playwright (Chromium)")
            return pdf_bytes
    except Exception as e:
        logger.warning(f"Playwright failed, trying WeasyPrint fallback: {e}")
    
    # 2. Fallback to WeasyPrint
    try:
        from weasyprint import HTML as WeasyHTML
        print("  [WARN] Falling back to WeasyPrint engine...")
        # Note: WeasyPrint might have different CSS compatibility than browsers
        pdf_bytes = WeasyHTML(string=html_content).write_pdf()
        if pdf_bytes:
            print("  [OK] PDF generated using WeasyPrint")
            return pdf_bytes
    except Exception as e:
        logger.error(f"WeasyPrint fallback also failed: {e}")
    
    return None
