"""
Test script to generate invoice PDF.
Uses Django's running server for WeasyPrint since GTK libs are needed.
Falls back to xhtml2pdf for local testing only.
"""
import os, sys

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'backend.settings')

# Try importing WeasyPrint natively first
try:
    import weasyprint
    USE_WEASYPRINT = True
    print("[OK] WeasyPrint available")
except (ImportError, OSError):
    USE_WEASYPRINT = False
    print("[INFO] WeasyPrint not available locally (needs GTK). Using xhtml2pdf fallback for preview.")
    # Mock weasyprint so bill_email_utils can import
    import types
    fake = types.ModuleType('weasyprint')
    class FakeHTML:
        def __init__(self, *a, **kw): pass
        def write_pdf(self): return b''
    fake.HTML = FakeHTML
    sys.modules['weasyprint'] = fake

import django
django.setup()

from service_fee_management.utils.bill_email_utils import fetch_bill_data_for_email, generate_bill_detail_html

data = fetch_bill_data_for_email([13])
if not data:
    print("No data found"); sys.exit(1)

bill = data[0]
print(f"Bill: {bill.get('bill_number')}, Status: {bill.get('service_status')}")

html = generate_bill_detail_html(bill)

# Save HTML
with open('test_invoice.html', 'w', encoding='utf-8') as f:
    f.write(html)
print("HTML saved to test_invoice.html")

fname = f"Invoice_{bill.get('bill_number', 'UNKNOWN')}.pdf"

if USE_WEASYPRINT:
    from weasyprint import HTML
    HTML(string=html).write_pdf(fname)
    print(f"PDF saved to {fname} (WeasyPrint)")
else:
    from io import BytesIO
    from xhtml2pdf import pisa
    result = BytesIO()
    pdf = pisa.pisaDocument(BytesIO(html.encode('utf-8')), result)
    if not pdf.err:
        with open(fname, 'wb') as f:
            f.write(result.getvalue())
        print(f"PDF saved to {fname} (xhtml2pdf fallback - some styles may differ)")
    else:
        print(f"PDF generation failed: {pdf.err}")

print("Done!")
