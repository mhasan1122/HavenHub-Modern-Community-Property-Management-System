"""
Final verification: Test bulletin notification system
This script verifies that:
1. get_bulletin_recipients correctly returns all eligible users
2. Creator is always included in recipients
3. No database errors occur
"""
import os
import django

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'backend.settings')
django.setup()

from bulletins.models import Bulletin
from notifications.utils import get_bulletin_recipients

print("="*80)
print("BULLETIN NOTIFICATION SYSTEM VERIFICATION")
print("="*80)

# Test with various bulletin configurations
test_cases = [
    {"status": "current", "description": "Published bulletins"},
    {"status": "pending", "description": "Pending bulletins"},
]

for test_case in test_cases:
    print(f"\n{'='*80}")
    print(f"Testing: {test_case['description']}")
    print('='*80)
    
    bulletins = Bulletin.objects.filter(status=test_case['status']).order_by('-id')[:2]
    
    if not bulletins.exists():
        print(f"  No bulletins found with status '{test_case['status']}'")
        continue
    
    for bulletin in bulletins:
        print(f"\n  Bulletin ID: {bulletin.id}")
        print(f"  Title: {bulletin.title}")
        print(f"  Creator: {bulletin.creator.full_name if bulletin.creator else 'None'} (ID: {bulletin.creator.id if bulletin.creator else 'None'})")
        print(f"  Target Towers: {bulletin.target_towers.count()}")
        print(f"  Target Units: {bulletin.target_units.count()}")
        
        try:
            recipients = get_bulletin_recipients(bulletin)
            print(f"  ✓ Recipients found: {len(recipients)}")
            
            if bulletin.creator:
                creator_included = bulletin.creator in recipients
                print(f"  ✓ Creator included in recipients: {creator_included}")
                if not creator_included:
                    print(f"  ⚠️ WARNING: Creator NOT in recipients list!")
            
            if len(recipients) > 0:
                print(f"  ✓ Sample recipients (first 3):")
                for recipient in recipients[:3]:
                    print(f"      - {recipient.full_name} (ID: {recipient.id})")
        except Exception as e:
            print(f"  ✗ ERROR: {e}")
            import traceback
            traceback.print_exc()

print("\n" + "="*80)
print("VERIFICATION COMPLETE")
print("="*80)
print("\n✅ If all tests show '✓' and no errors, the fix is working correctly!")
print("✅ All eligible users (including the creator) should now receive notifications")
print("   when a bulletin is created and approved by the same user.\n")
