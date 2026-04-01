
import os
import django
import sys

sys.path.append('h:/wamp64/www/estate-link/backend')
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'backend.settings')
django.setup()

from service_fee_management.models import BillUploadDetail
from django.db.models import Sum, Q

def check_details():
    try:
        # Filter for Tower 2, Month 1, Year 2026, Service Fee 6 (from user request)
        sf_id = 6
        tower_id = 2
        month = 1
        year = 2026
        
        details = BillUploadDetail.objects.filter(
            service_fee_id=sf_id,
            tower_id=tower_id,
            upload_month=month,
            upload_year=year
        )
        
        print(f"Found {details.count()} details for SF {sf_id}, Tower {tower_id}, {month}/{year}")
        
        total = 0
        for d in details:
            print(f"Detail ID: {d.id}, Unit: {d.unit_id}, Amount: {d.amount}, Category ID: {d.bill_upload.bill_category_id}")
            total += d.amount
            
        print(f"Total Sum in Python: {total}")
        
        # Test the view logic (Sum annotation)
        from bill_categories.models import BillCategory
        
        detail_filter = Q(bill_uploads__details__service_fee_id=sf_id)
        detail_filter &= Q(bill_uploads__details__upload_month=month)
        detail_filter &= Q(bill_uploads__details__upload_year=year)
        detail_filter &= Q(bill_uploads__details__tower_id=tower_id)
        
        categories = BillCategory.objects.filter(
            bill_uploads__details__service_fee_id=sf_id
        ).distinct().annotate(
            total_amount=Sum('bill_uploads__details__amount', filter=detail_filter)
        )
        
        for cat in categories:
            print(f"Category: {cat.name} (ID {cat.id}), Annotated Total: {cat.total_amount}")

    except Exception as e:
        print(f"Error: {e}")

if __name__ == "__main__":
    check_details()
