"""
=================================================================
  PDF Debug & Test Utility for Estate Link
  -----------------------------------------
  Generates receipt/invoice PDFs and saves them to disk for 
  debugging. Does NOT send emails. 

  Usage:
    python test_pdf_debug.py receipt RCP-2026-03-00002
    python test_pdf_debug.py bill 123
    python test_pdf_debug.py bill 123,456,789
=================================================================
"""
import os
import sys
import json
import logging

# Setup Django
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'backend.settings')

import django
django.setup()

logging.basicConfig(level=logging.INFO, format='%(levelname)s: %(message)s')
logger = logging.getLogger(__name__)

# ─── Output directory ────────────────────────────────────────────────
DEBUG_PDF_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'debug_pdfs')
os.makedirs(DEBUG_PDF_DIR, exist_ok=True)


def check_dependencies():
    """Check which PDF engines are available."""
    print("\n" + "=" * 60)
    print("  PDF Engine Dependency Check")
    print("=" * 60)

    # WeasyPrint
    try:
        from weasyprint import HTML as WeasyHTML
        print(f"  [OK] WeasyPrint available")
        # Quick test
        test_pdf = WeasyHTML(string="<html><body>test</body></html>").write_pdf()
        print(f"  [OK] WeasyPrint can generate PDFs ({len(test_pdf)} bytes)")
    except ImportError:
        print("  [FAIL] WeasyPrint not installed (pip install weasyprint)")
    except Exception as e:
        err = str(e)
        if 'gobject' in err or 'gtk' in err.lower() or 'pango' in err or 'libffi' in err:
            print(f"  [FAIL] WeasyPrint installed but GTK3 native libs missing")
            print(f"         Error: {err[:100]}")
            print(f"         Fix (Windows): Install GTK3 runtime from https://github.com/nickvdp/gtk-win")
            print(f"         Fix (Linux):   sudo apt-get install libpango-1.0-0 libpangoft2-1.0-0 libgdk-pixbuf2.0-0")
        else:
            print(f"  [FAIL] WeasyPrint error: {err[:100]}")

    # Playwright
    try:
        from playwright.sync_api import sync_playwright
        print(f"  [OK] Playwright available")
        # Quick test for Playwright
        try:
            with sync_playwright() as p:
                browser = p.chromium.launch(headless=True)
                page = browser.new_page()
                page.set_content("<html><body>test</body></html>")
                test_pdf_pw = page.pdf(format="A4")
                browser.close()
                print(f"  [OK] Playwright can generate PDFs ({len(test_pdf_pw)} bytes)")
        except Exception as pw_e:
            print(f"  [FAIL] Playwright installed but cannot generate PDF.")
            print(f"         Error: {str(pw_e)[:150]}")
            if "executable" in str(pw_e).lower() or "not found" in str(pw_e).lower():
                print(f"         Fix: run 'playwright install chromium'")
            elif "not installed" in str(pw_e).lower() and sys.platform == 'linux':
                print(f"         Fix: run 'playwright install-deps'")
    except ImportError:
        print(f"  [FAIL] Playwright not installed (pip install playwright && playwright install)")
    except Exception as e:
        print(f"  [FAIL] Playwright error: {e}")

    # pdfkit / wkhtmltopdf
    try:
        import pdfkit
        print(f"  [OK] pdfkit available")
        # Check binary
        wk_paths = [
            r'C:\Program Files\wkhtmltopdf\bin\wkhtmltopdf.exe',
            '/usr/local/bin/wkhtmltopdf',
            '/usr/bin/wkhtmltopdf',
        ]
        found = False
        for p in wk_paths:
            if os.path.isfile(p):
                print(f"  [OK] wkhtmltopdf binary found: {p}")
                found = True
                break
        if not found:
            print(f"  [WARN] wkhtmltopdf binary NOT found in standard paths")
    except ImportError:
        print(f"  [FAIL] pdfkit not installed (pip install pdfkit)")

    # Font files
    from django.conf import settings
    fonts_dir = os.path.join(settings.BASE_DIR, 'static', 'fonts')
    bengali_font = os.path.join(fonts_dir, 'NotoSansBengali-Regular.ttf')
    en_font = os.path.join(fonts_dir, 'NotoSans-Regular.ttf')
    print(f"\n  Font files:")
    print(f"  {'[OK]' if os.path.isfile(bengali_font) else '[MISSING]'} Bengali: {bengali_font}")
    print(f"  {'[OK]' if os.path.isfile(en_font) else '[MISSING]'} English: {en_font}")

    print("=" * 60 + "\n")


def test_receipt(receipt_id):
    """Generate a receipt PDF by receipt ID and save to debug_pdfs/."""
    from service_fee_management.utils.email_utils import (
        fetch_receipt_data_by_id,
        generate_payment_receipt_html,
    )
    from service_fee_management.utils.pdf_generation_playwright import generate_pdf_from_html

    print(f"\n--- Generating Receipt PDF for: {receipt_id} ---")

    # Step 1: Fetch data
    data = fetch_receipt_data_by_id(receipt_id)
    if not data:
        print(f"ERROR: No data found for receipt '{receipt_id}'")
        return False

    resident = data.get('primary_name') or data.get('owner_name') or 'Unknown'
    unit = data.get('unit_display') or data.get('unit_name') or '?'
    print(f"  Resident: {resident}")
    print(f"  Unit: {unit}")
    print(f"  Amount: {data.get('paid_amount', '?')}")

    # Step 2: Generate HTML
    html = generate_payment_receipt_html(data)
    html_path = os.path.join(DEBUG_PDF_DIR, f"receipt_{receipt_id}.html")
    with open(html_path, 'w', encoding='utf-8') as f:
        f.write(html)
    print(f"  HTML saved: {html_path} ({len(html):,} chars)")

    # Step 3: Generate PDF
    pdf_bytes = generate_pdf_from_html(html)
    if not pdf_bytes:
        print("  ERROR: PDF generation returned None - all engines failed!")
        return False

    pdf_path = os.path.join(DEBUG_PDF_DIR, f"receipt_{receipt_id}.pdf")
    with open(pdf_path, 'wb') as f:
        f.write(pdf_bytes)
    print(f"  PDF saved: {pdf_path} ({len(pdf_bytes):,} bytes)")

    # Also save data as JSON for debugging
    json_path = os.path.join(DEBUG_PDF_DIR, f"receipt_{receipt_id}_data.json")
    try:
        serializable = {}
        for k, v in data.items():
            try:
                json.dumps(v)
                serializable[k] = v
            except (TypeError, ValueError):
                serializable[k] = str(v)
        with open(json_path, 'w', encoding='utf-8') as f:
            json.dump(serializable, f, indent=2, ensure_ascii=False)
        print(f"  Data JSON saved: {json_path}")
    except Exception as e:
        print(f"  Data JSON save failed: {e}")

    print(f"  --- DONE ---\n")
    return True


def test_bill(payment_ids_str):
    """Generate bill/invoice PDFs by payment IDs and save to debug_pdfs/."""
    from service_fee_management.utils.bill_email_utils import (
        fetch_bill_data_for_email,
        generate_bill_detail_html,
    )
    from service_fee_management.utils.pdf_generation_playwright import generate_pdf_from_html

    # Parse comma-separated IDs
    payment_ids = [int(pid.strip()) for pid in payment_ids_str.split(',') if pid.strip()]
    print(f"\n--- Generating Bill PDFs for IDs: {payment_ids} ---")

    # Step 1: Fetch data
    bills = fetch_bill_data_for_email(payment_ids)
    if not bills:
        print(f"ERROR: No bill data found for IDs: {payment_ids}")
        return False

    print(f"  Found {len(bills)} bill(s)")

    for bill in bills:
        bill_number = bill.get('bill_number', 'UNKNOWN')
        resident = bill.get('owner_name') or bill.get('resident_name') or 'Unknown'
        unit = bill.get('unit_display') or bill.get('unit_name') or '?'
        period_month = bill.get('service_period_month')
        period_year = bill.get('service_period_year')
        print(f"\n  Bill: {bill_number} | {resident} | Unit {unit} | {period_month}/{period_year}")

        # Step 2: Generate HTML
        html = generate_bill_detail_html(bill)
        html_path = os.path.join(DEBUG_PDF_DIR, f"bill_{bill_number}.html")
        with open(html_path, 'w', encoding='utf-8') as f:
            f.write(html)
        print(f"    HTML saved: {html_path} ({len(html):,} chars)")

        # Step 3: Generate PDF
        pdf_bytes = generate_pdf_from_html(html)
        if not pdf_bytes:
            print(f"    ERROR: PDF generation failed for {bill_number}")
            continue

        pdf_path = os.path.join(DEBUG_PDF_DIR, f"bill_{bill_number}.pdf")
        with open(pdf_path, 'wb') as f:
            f.write(pdf_bytes)
        print(f"    PDF saved: {pdf_path} ({len(pdf_bytes):,} bytes)")

    print(f"\n  --- DONE ---\n")
    return True


if __name__ == '__main__':
    # Always check dependencies first
    check_dependencies()

    if len(sys.argv) < 3:
        print("Usage:")
        print("  python test_pdf_debug.py receipt <RECEIPT_ID>")
        print("  python test_pdf_debug.py bill <PAYMENT_ID>")
        print("  python test_pdf_debug.py bill <ID1,ID2,ID3>")
        print("")
        print("Examples:")
        print("  python test_pdf_debug.py receipt RCP-2026-03-00002")
        print("  python test_pdf_debug.py bill 123")
        print("  python test_pdf_debug.py bill 100,101,102")
        print(f"\nPDFs are saved to: {DEBUG_PDF_DIR}")
        sys.exit(0)

    cmd = sys.argv[1].lower()
    arg = sys.argv[2]

    if cmd == 'receipt':
        success = test_receipt(arg)
    elif cmd == 'bill':
        success = test_bill(arg)
    else:
        print(f"Unknown command: {cmd}")
        print("Use 'receipt' or 'bill'")
        sys.exit(1)

    sys.exit(0 if success else 1)
