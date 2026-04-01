# Payment Detail Dropdown Report Implementation

## Goal
Create a detailed payment report showing:
- Every transaction (ServiceFeePayment record)
- All bill items paid in each transaction (ServiceFeePaymentDetail records)
- Breakdown by item type (penalty, base_fee, bill_category)
- Displayable in a dropdown/expandable table

---

## Data Structure

### Master Transaction (Parent)
```
ServiceFeePayment (One per payment)
├── id
├── unit_id
├── amount (total paid)
├── service_period_month
├── service_period_year
├── payment_status
├── service_status
└── created_at
```

### Detail Items (Children)
```
ServiceFeePaymentDetail (Many per payment - breakdown)
├── id
├── service_fee_payment_id (FK to parent)
├── payment_type (penalty | base_fee | bill_category)
├── amount_paid (how much for this item)
├── penalty_waiver_id (optional - for penalties)
├── bill_category_id (optional - for categories)
└── created_at
```

---

## API Endpoint Structure

### GET `/api/service-fee-management/payment-details/`

**Query Parameters:**
```
- unit_id (required)
- service_fee_id (required)
- service_period_month (optional)
- service_period_year (optional)
- page (optional, default=1)
- page_size (optional, default=20)
```

**Response Structure:**
```json
{
  "success": true,
  "data": {
    "transactions": [
      {
        "id": 1,
        "transaction_id": "TRN-001",
        "unit_id": 87,
        "service_period": "December 2025",
        "amount_paid": "4500.00",
        "payment_status": "completed",
        "service_status": "paid",
        "payment_date": "2026-01-01 10:30:00",
        "items": [
          {
            "id": 1,
            "payment_type": "penalty",
            "payment_type_display": "Late Payment Fee",
            "amount_paid": "250.00",
            "related_info": {
              "type": "penalty_waiver",
              "waiver_id": 1,
              "original_penalty": "250.00",
              "waived_amount": "0.00"
            }
          },
          {
            "id": 2,
            "payment_type": "base_fee",
            "payment_type_display": "Base Service Fee",
            "amount_paid": "2000.00",
            "related_info": null
          },
          {
            "id": 3,
            "payment_type": "bill_category",
            "payment_type_display": "Bill Category",
            "amount_paid": "100.00",
            "related_info": {
              "type": "bill_category",
              "category_id": 1,
              "category_name": "Maintenance",
              "category_amount": "100.00"
            }
          },
          {
            "id": 4,
            "payment_type": "bill_category",
            "payment_type_display": "Bill Category",
            "amount_paid": "100.00",
            "related_info": {
              "type": "bill_category",
              "category_id": 2,
              "category_name": "Cleaning",
              "category_amount": "100.00"
            }
          },
          {
            "id": 5,
            "payment_type": "bill_category",
            "payment_type_display": "Bill Category",
            "amount_paid": "100.00",
            "related_info": {
              "type": "bill_category",
              "category_id": 3,
              "category_name": "Water",
              "category_amount": "100.00"
            }
          }
        ],
        "total_items": 5,
        "items_total": "2550.00",
        "excess_amount": "1950.00"
      }
    ],
    "pagination": {
      "total_count": 12,
      "page": 1,
      "page_size": 20,
      "total_pages": 1
    }
  }
}
```

---

## Implementation Steps

### Step 1: Create Serializer

**File:** `service_fee_management/serializers.py`

```python
class ServiceFeePaymentDetailSerializer(serializers.ModelSerializer):
    """Serializer for payment detail breakdown"""
    payment_type_display = serializers.CharField(source='get_payment_type_display', read_only=True)
    related_info = serializers.SerializerMethodField()
    
    class Meta:
        model = ServiceFeePaymentDetail
        fields = [
            'id',
            'payment_type',
            'payment_type_display',
            'amount_paid',
            'related_info'
        ]
    
    def get_related_info(self, obj):
        """Get related information based on payment type"""
        if obj.payment_type == 'penalty' and obj.penalty_waiver:
            return {
                'type': 'penalty_waiver',
                'waiver_id': obj.penalty_waiver.id,
                'original_penalty': str(obj.penalty_waiver.penalty_amount),
                'waived_amount': str(obj.penalty_waiver.waived_amount)
            }
        elif obj.payment_type == 'bill_category' and obj.bill_category:
            return {
                'type': 'bill_category',
                'category_id': obj.bill_category.id,
                'category_name': obj.bill_category.category_name,
                'category_amount': str(obj.bill_category.bill_category_amount)
            }
        return None


class PaymentTransactionDetailSerializer(serializers.ModelSerializer):
    """Serializer for payment transaction with detail breakdown"""
    service_period = serializers.SerializerMethodField()
    items = serializers.SerializerMethodField()
    transaction_id = serializers.SerializerMethodField()
    items_total = serializers.SerializerMethodField()
    excess_amount = serializers.SerializerMethodField()
    
    class Meta:
        model = ServiceFeePayment
        fields = [
            'id',
            'transaction_id',
            'unit_id',
            'service_period',
            'amount_paid',
            'payment_status',
            'service_status',
            'payment_date',
            'items',
            'total_items',
            'items_total',
            'excess_amount'
        ]
    
    def get_service_period(self, obj):
        """Format service period"""
        from datetime import datetime
        if obj.service_period_month and obj.service_period_year:
            date = datetime(obj.service_period_year, obj.service_period_month, 1)
            return date.strftime('%B %Y')
        return 'N/A'
    
    def get_transaction_id(self, obj):
        """Get transaction ID from first billing record"""
        billing = obj.billing_records.first()
        return billing.transaction_id if billing else 'N/A'
    
    def get_items(self, obj):
        """Get all payment detail items"""
        details = obj.payment_details.all()
        serializer = ServiceFeePaymentDetailSerializer(details, many=True)
        return serializer.data
    
    def get_items_total(self, obj):
        """Calculate total of all detail items"""
        from django.db.models import Sum
        total = obj.payment_details.aggregate(total=Sum('amount_paid'))['total']
        return str(total) if total else '0.00'
    
    def get_excess_amount(self, obj):
        """Calculate excess amount (payment - items)"""
        from django.db.models import Sum
        items_sum = obj.payment_details.aggregate(total=Sum('amount_paid'))['total'] or 0
        excess = obj.amount - items_sum
        return str(max(0, excess))
```

---

### Step 2: Create View

**File:** `service_fee_management/views.py`

```python
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status
from django.db.models import Sum

class PaymentDetailReportView(APIView):
    """
    API endpoint for payment detail breakdown report
    Shows every transaction with all bill items paid
    """
    
    def get(self, request):
        try:
            # Get parameters
            unit_id = request.query_params.get('unit_id')
            service_fee_id = request.query_params.get('service_fee_id')
            service_period_month = request.query_params.get('service_period_month')
            service_period_year = request.query_params.get('service_period_year')
            page = int(request.query_params.get('page', 1))
            page_size = int(request.query_params.get('page_size', 20))
            
            # Validate required parameters
            if not all([unit_id, service_fee_id]):
                return Response({
                    'success': False,
                    'message': 'Missing required parameters (unit_id, service_fee_id)'
                }, status=status.HTTP_400_BAD_REQUEST)
            
            # Build query
            queryset = ServiceFeePayment.objects.filter(
                unit_id=unit_id,
                service_fee_id=service_fee_id
            ).prefetch_related(
                'payment_details',
                'payment_details__penalty_waiver',
                'payment_details__bill_category',
                'billing_records'
            )
            
            # Apply optional filters
            if service_period_month:
                queryset = queryset.filter(service_period_month=service_period_month)
            if service_period_year:
                queryset = queryset.filter(service_period_year=service_period_year)
            
            # Order by date descending
            queryset = queryset.order_by('-created_at')
            
            # Pagination
            total_count = queryset.count()
            offset = (page - 1) * page_size
            transactions = queryset[offset:offset + page_size]
            
            # Serialize
            serializer = PaymentTransactionDetailSerializer(transactions, many=True)
            
            # Response
            return Response({
                'success': True,
                'data': {
                    'transactions': serializer.data,
                    'pagination': {
                        'total_count': total_count,
                        'page': page,
                        'page_size': page_size,
                        'total_pages': (total_count + page_size - 1) // page_size
                    }
                }
            }, status=status.HTTP_200_OK)
        
        except Exception as e:
            import traceback
            return Response({
                'success': False,
                'message': f'Error retrieving payment details: {str(e)}',
                'error': traceback.format_exc() if hasattr(settings, 'DEBUG') and settings.DEBUG else None
            }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
```

---

### Step 3: Register URL

**File:** `service_fee_management/urls.py`

```python
urlpatterns = [
    # ... existing patterns ...
    path('payment-details/', PaymentDetailReportView.as_view(), name='payment-detail-report'),
]
```

---

## Frontend Implementation (Dropdown/Expandable Table)

### Sample Structure for Payment History Table

```jsx
{transactions.map((transaction) => (
  <React.Fragment key={transaction.id}>
    {/* Main Row - Transaction Summary */}
    <tr className="border-b hover:bg-gray-50">
      <td className="px-4 py-2">
        <button onClick={() => toggleExpanded(transaction.id)}>
          {expandedTransactions.includes(transaction.id) ? '▼' : '▶'}
        </button>
      </td>
      <td className="px-4 py-2">{transaction.transaction_id}</td>
      <td className="px-4 py-2">{transaction.service_period}</td>
      <td className="px-4 py-2 font-bold">{transaction.amount_paid} TK</td>
      <td className="px-4 py-2">{transaction.service_status}</td>
      <td className="px-4 py-2">{transaction.payment_date}</td>
    </tr>
    
    {/* Expanded Detail Rows */}
    {expandedTransactions.includes(transaction.id) && (
      <>
        {transaction.items.map((item) => (
          <tr key={item.id} className="bg-gray-50 border-b">
            <td className="px-4 py-2"></td>
            <td className="px-4 py-2 pl-12">
              <span className="text-sm text-gray-600">├─ {item.payment_type_display}</span>
            </td>
            <td className="px-4 py-2">
              {item.related_info?.category_name || 
               item.related_info?.waiver_id ? 'Waiver' : '-'}
            </td>
            <td className="px-4 py-2 font-semibold">{item.amount_paid} TK</td>
            <td colSpan="2" className="px-4 py-2 text-xs text-gray-500">
              {item.related_info?.category_name || item.related_info?.type || ''}
            </td>
          </tr>
        ))}
        {/* Summary Row */}
        <tr className="bg-blue-50 border-b font-semibold">
          <td colSpan="3" className="px-4 py-2 text-right">Items Total:</td>
          <td className="px-4 py-2">{transaction.items_total} TK</td>
          <td colSpan="2" className="px-4 py-2">
            Excess: {transaction.excess_amount} TK
          </td>
        </tr>
      </>
    )}
  </React.Fragment>
))}
```

---

## Key Features

✅ **Complete Breakdown**
- Every payment transaction shown
- All items within transaction listed
- Item types clearly identified

✅ **Related Information**
- Penalty waivers linked for penalty items
- Bill category names linked for category items
- Easy to trace what was paid

✅ **Calculation Verification**
- Items total matches payment amount (minus excess)
- Excess amount tracked separately
- Audit trail complete

✅ **Filterable & Paginated**
- Filter by month/year
- Pagination support
- Efficient database queries with prefetch_related

✅ **Expandable/Collapsible**
- Clean table view
- Detail rows appear on expand
- Easy navigation

---

## Database Queries

### Single Payment with All Items
```sql
SELECT 
    sfp.id,
    sfp.amount,
    sfp.service_period_month,
    sfp.service_period_year,
    sfpd.id as detail_id,
    sfpd.payment_type,
    sfpd.amount_paid,
    pw.penalty_amount,
    bc.category_name
FROM service_fee_management_servicefeepayment sfp
LEFT JOIN service_fee_payment_detail sfpd 
    ON sfpd.service_fee_payment_id = sfp.id
LEFT JOIN service_fee_penalty_waivers pw 
    ON sfpd.penalty_waiver_id = pw.id
LEFT JOIN bill_categories_billcategory bc 
    ON sfpd.bill_category_id = bc.id
WHERE sfp.unit_id = 87 
  AND sfp.service_fee_id = 5
ORDER BY sfp.created_at DESC, sfpd.created_at ASC;
```

---

## Response Example

```json
{
  "success": true,
  "data": {
    "transactions": [
      {
        "id": 1,
        "transaction_id": "TRN-20260101-001",
        "unit_id": 87,
        "service_period": "December 2025",
        "amount_paid": "4500.00",
        "payment_status": "completed",
        "service_status": "paid",
        "payment_date": "2026-01-01 10:30:00",
        "items": [
          {
            "id": 1,
            "payment_type": "penalty",
            "payment_type_display": "Late Payment Fee",
            "amount_paid": "250.00",
            "related_info": {
              "type": "penalty_waiver",
              "waiver_id": 1,
              "original_penalty": "250.00",
              "waived_amount": "0.00"
            }
          },
          {
            "id": 2,
            "payment_type": "base_fee",
            "payment_type_display": "Base Service Fee",
            "amount_paid": "2000.00",
            "related_info": null
          },
          {
            "id": 3,
            "payment_type": "bill_category",
            "payment_type_display": "Bill Category",
            "amount_paid": "100.00",
            "related_info": {
              "type": "bill_category",
              "category_id": 1,
              "category_name": "Maintenance",
              "category_amount": "100.00"
            }
          },
          {
            "id": 4,
            "payment_type": "bill_category",
            "payment_type_display": "Bill Category",
            "amount_paid": "100.00",
            "related_info": {
              "type": "bill_category",
              "category_id": 2,
              "category_name": "Cleaning",
              "category_amount": "100.00"
            }
          },
          {
            "id": 5,
            "payment_type": "bill_category",
            "payment_type_display": "Bill Category",
            "amount_paid": "100.00",
            "related_info": {
              "type": "bill_category",
              "category_id": 3,
              "category_name": "Water",
              "category_amount": "100.00"
            }
          }
        ],
        "total_items": 5,
        "items_total": "2550.00",
        "excess_amount": "1950.00"
      }
    ],
    "pagination": {
      "total_count": 12,
      "page": 1,
      "page_size": 20,
      "total_pages": 1
    }
  }
}
```

---

## Status

📋 **Plan:** ✅ Complete
🔨 **Implementation:** Ready to code
📦 **Serializer:** Ready
🌐 **View:** Ready
🔗 **URL:** Ready

Next Steps:
1. Add serializers to `serializers.py`
2. Add view to `views.py`
3. Register URL in `urls.py`
4. Test with API
5. Build frontend table with expandable rows
