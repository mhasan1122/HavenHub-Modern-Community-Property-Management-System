"""Standalone PDF test - no Django ORM needed."""
import sys, os

# Add the backend directory to path
backend_dir = r'h:\wamp64\www\estate-link\backend'
sys.path.insert(0, backend_dir)
os.chdir(backend_dir)
os.environ['DJANGO_SETTINGS_MODULE'] = 'settings'

import django
django.setup()

from service_fee_management.utils.email_utils import generate_payment_receipt_html, generate_payment_receipt_pdf
import fitz, base64

mock_data = {
    'receipt_id': 'RCP-2026-02-00022',
    'transaction_id': 'TXN-2026-02-00000022',
    'payment_date': '2026-02-25',
    'payment_method_display': 'Cash',
    'total_amount': 1100,
    'advance_amount': 0,
    'tower_name': 'email_test',
    'primary_name': 'mirza hasan',
    'phone': '01623398837',
    'unit_display': '101',
    'email': 'tarekmahmud@gmail.com',
    'notes': 'Received By: Md. Tausif - Payment for December 2025',
    'created_by_name': 'Md. Tausif Hossain',
    'payment_details': [{
        'service_period_month': 12,
        'service_period_year': 2025,
        'amount': 1100,
        'gross_penalty_amount': 100000,
        'waived_amount': 0,
        'service_status': 'partial',
    }]
}

html = generate_payment_receipt_html(mock_data)
pdf_bytes = generate_payment_receipt_pdf(html)

with open(os.path.join(backend_dir, 'test_output.pdf'), 'wb') as f:
    f.write(pdf_bytes)

doc = fitz.open(stream=pdf_bytes, filetype='pdf')
page = doc.load_page(0)
pix = page.get_pixmap(dpi=150)
b64 = base64.b64encode(pix.tobytes("png")).decode('utf-8')

preview_path = os.path.join(backend_dir, 'test_output_preview.html')
with open(preview_path, 'w', encoding='utf-8') as f:
    f.write(f"""<html><body style="background:#ccc; text-align:center; padding:20px;">
    <img src="data:image/png;base64,{b64}" style="max-width:800px; box-shadow:0 0 10px rgba(0,0,0,.4);"/>
    <p>Pages: {len(doc)}</p></body></html>""")

print(f"Done. Pages={len(doc)}. Preview: {preview_path}")
