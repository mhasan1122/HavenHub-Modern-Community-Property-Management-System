
import os
import sys

# Add the backend directory to sys.path
backend_path = os.path.abspath(os.path.join(os.getcwd(), 'backend'))
if backend_path not in sys.path:
    sys.path.append(backend_path)

from service_fee_management.utils.generate_receipt_pdf import generate_receipt_pdf_reportlab
from datetime import datetime

def test_final_receipt_v3():
    payment_data = {
        'receipt_id': 'RCP-2026-02-00025',
        'transaction_id': 'TXN-2026-02-00000025',
        'payment_date': '2026-02-25T14:03:18',
        'payment_method_display': 'Cash',
        'tower_name': 'email_test',
        'unit_display': '101',
        'primary_name': 'mirza hasan',
        'owner_phone': '01623398837', # Testing the new extraction field
        'resident_email': 'tarekmahmud.official1@gmail.com', # Testing the new extraction field
        'total_amount': 1254.0,
        'advance_amount': 0.0,
        'payment_details': [
            {
                'service_period_month': 12,
                'service_period_year': 2025,
                'amount': 1254.0,
                'status': 'partial',
                'penalty_amount': 100000.0,
                'waived_amount': 0.0
            }
        ],
        'created_by_name': 'Md. Tausif Hossain',
        'notes': 'Received By: Md. Tausif Hossain - Payment for December 2025'
    }

    pdf_bytes = generate_receipt_pdf_reportlab(payment_data)
    with open('final_receipt_test_v3.pdf', 'wb') as f:
        f.write(pdf_bytes)
    print(f"SUCCESS! PDF generated: {os.path.abspath('final_receipt_test_v3.pdf')}")

if __name__ == '__main__':
    test_final_receipt_v3()
