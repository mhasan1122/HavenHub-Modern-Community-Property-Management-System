"""
Test: Fetch Receipt Data & Generate PDF using WeasyPrint.
Saves HTML & PDF to Desktop for viewing.
"""
import os, sys, django

# --- WINDOWS WEASYPRINT HELP ---
# If you have GTK installed but not in PATH, you can uncomment and point to it:
# os.add_dll_directory(r"C:\Program Files\GTK3-Runtime Win64\bin")

# Setup Django environment
os.environ['DJANGO_SETTINGS_MODULE'] = 'backend.settings'
# Add project root to sys.path
sys.path.append(os.getcwd())
django.setup()

from service_fee_management.utils.email_utils import (
    fetch_receipt_data_by_id,
    generate_payment_receipt_html,
    generate_payment_receipt_pdf,
    HAS_WEASYPRINT
)

# ─── Change this receipt_id to test different receipts ───
RECEIPT_ID = 'RCP-2026-02-00003'

print(f"--- Fetching Receipt Data: {RECEIPT_ID} ---")
receipt_data = fetch_receipt_data_by_id(RECEIPT_ID)

if receipt_data:
    print(f"[OK] Data fetched successfully")
    print(f"  Receipt#: {receipt_data.get('receipt_id')}")
    print(f"  Resident: {receipt_data.get('resident_name')}")
    print(f"  Unit:     {receipt_data.get('unit_display')}")
    print(f"  Amount:   {receipt_data.get('paid_amount')}")
    print(f"  Status:   {receipt_data.get('payment_status')}")
    
    details = receipt_data.get('payment_details')
    if isinstance(details, str):
        import json
        details = json.loads(details)
    
    print("\nAllocations:")
    for alloc in details:
        print(f"  - {alloc.get('month_name')}: PAID={alloc.get('amount_paid')} BILL={alloc.get('amount')}")
    print("")

    desktop = os.path.join(os.path.expanduser('~'), 'Desktop')

    # 1) Generate and Save HTML
    html = generate_payment_receipt_html(receipt_data)
    html_path = os.path.join(desktop, f"Receipt_{RECEIPT_ID}.html")
    with open(html_path, "w", encoding="utf-8") as f:
        f.write(html)
    print(f"[OK] HTML saved: {html_path}")

    # 2) Generate PDF (now works on Windows via Playwright)
    print("--- Generating PDF ---")
    pdf_bytes = generate_payment_receipt_pdf(html, receipt_data)
    if pdf_bytes:
        pdf_path = os.path.join(desktop, f"Receipt_{RECEIPT_ID}.pdf")
        with open(pdf_path, "wb") as f:
            f.write(pdf_bytes)
        print(f"[OK] PDF saved: {pdf_path}")
    else:
        print("[FAIL] PDF generation returned None (Verify Playwright installation)")
else:
    print(f"❌ [FAIL] No receipt data found for ID={RECEIPT_ID}")
