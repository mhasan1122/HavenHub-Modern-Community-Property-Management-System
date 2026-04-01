"""
Test: Generate bill invoice HTML & PDF and save to desktop for viewing.

WeasyPrint requires GTK3 native libraries:
  - Linux (production): sudo apt install libpango-1.0-0 libpangoft2-1.0-0 libgdk-pixbuf2.0-0 libffi-dev libcairo2
  - Windows (local dev): Install GTK3 runtime from:
      https://github.com/tschoonj/GTK-for-Windows-Runtime-Environment-Installer/releases
      Then restart your terminal/IDE so PATH picks up the GTK bin folder.

If WeasyPrint is not available, this script will still generate the HTML file
which you can open in Chrome and print to PDF for visual verification.
"""
import os, sys, django

os.environ['DJANGO_SETTINGS_MODULE'] = 'backend.settings'
django.setup()

from service_fee_management.utils.bill_email_utils import (
    fetch_bill_data_for_email,
    generate_bill_detail_html,
    generate_bill_detail_pdf
)

# Try importing WeasyPrint (may fail on Windows without GTK)
try:
    from weasyprint import HTML as WeasyHTML
    HAS_WEASYPRINT = True
    print("[OK] WeasyPrint available")
except Exception as e:
    HAS_WEASYPRINT = False
    print(f"[WARN] WeasyPrint not available locally: {e}")
    print("       HTML file will still be generated for browser preview.")
    print("       To install GTK3 on Windows, download from:")
    print("       https://github.com/tschoonj/GTK-for-Windows-Runtime-Environment-Installer/releases\n")

# ─── Change this payment_id to test different bills ───
PAYMENT_ID = 13

bills = fetch_bill_data_for_email([PAYMENT_ID])

if bills:
    bill = bills[0]
    bill_number = bill.get('bill_number', 'TEST')
    
    print(f"--- Bill Details ---")
    print(f"  Bill#:    {bill_number}")
    print(f"  Owner:    {bill.get('owner_name')} ({bill.get('owner_email')})")
    print(f"  Unit:     {bill.get('unit_display')}")
    print(f"  Status:   {bill.get('service_status')}")
    print(f"  Amount:   {bill.get('total_amount')}")
    print(f"  Paid:     {bill.get('total_paid')}")
    print(f"  Penalty:  {bill.get('penalty_amount')}")
    print(f"--------------------\n")

    desktop = os.path.join(os.path.expanduser('~'), 'Desktop')

    # 1) Always save HTML (works everywhere)
    html = generate_bill_detail_html(bill)
    html_path = os.path.join(desktop, f"Invoice_{bill_number}.html")
    with open(html_path, "w", encoding="utf-8") as f:
        f.write(html)
    print(f"[OK] HTML saved: {html_path}")
    print(f"     Open in Chrome -> Ctrl+P -> Save as PDF to preview")

    # 2) Generate PDF (now support on Windows via Playwright)
    print("--- Generating PDF ---")
    pdf_bytes = generate_bill_detail_pdf(bill)
    if pdf_bytes:
        pdf_path = os.path.join(desktop, f"Invoice_{bill_number}.pdf")
        with open(pdf_path, "wb") as f:
            f.write(pdf_bytes)
        print(f"[OK] PDF saved:  {pdf_path}  ({len(pdf_bytes)} bytes)")
    else:
        print("[FAIL] PDF generation failed")
else:
    print(f"[FAIL] No bill data found for payment_id={PAYMENT_ID}")
