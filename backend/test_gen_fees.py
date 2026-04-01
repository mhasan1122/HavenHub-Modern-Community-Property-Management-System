
import os
import django
import sys
from datetime import datetime

# Setup Django environment
sys.path.append(os.path.dirname(os.path.abspath(__file__)))
os.environ.setdefault("DJANGO_SETTINGS_MODULE", "backend.settings")
django.setup()

from service_fee_management.utils.service_fee_generator import generate_service_fees

def run_test():
    print("Testing generate_service_fees with bill_category validation...")
    
    current_date = datetime.now()
    year = current_date.year
    month = current_date.month
    
    # Parameters provided by user
    unit_ids = "102"
    tower_id = 118
    service_fee_ids = "3"
    bill_category_ids = "3"
    
    # Run Generation
    print(f"Generating for:")
    print(f"  Month/Year: {month}/{year}")
    print(f"  Unit: {unit_ids}")
    print(f"  Tower: {tower_id}")
    print(f"  Service Fee: {service_fee_ids}")
    print(f"  Bill Categories: {bill_category_ids}")
    
    result = generate_service_fees(
        year=year,
        month=month,
        unit_ids=unit_ids,
        tower_id=tower_id,
        service_fee_ids=service_fee_ids,
        bill_category_ids=bill_category_ids,
        force_regenerate=True
    )
    
    print("\nResult:")
    print(result)

if __name__ == "__main__":
    run_test()
