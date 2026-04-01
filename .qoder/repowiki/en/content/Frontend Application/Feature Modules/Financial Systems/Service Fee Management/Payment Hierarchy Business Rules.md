# Payment Hierarchy Business Rules

<cite>
**Referenced Files in This Document**
- [SERVICE_FEE_PAYMENT_HIERARCHY_BUSINESS_RULES.md](file://backend/SERVICE_FEE_PAYMENT_HIERARCHY_BUSINESS_RULES.md)
- [PAYMENT_HIERARCHY_TABLE_STRUCTURE.md](file://backend/PAYMENT_HIERARCHY_TABLE_STRUCTURE.md)
- [payment_hierarchy_redesign.md](file://backend/docs/payment_hierarchy_redesign.md)
- [models.py](file://backend/service_fee_management/models.py)
- [views.py](file://backend/service_fee_management/views.py)
- [urls.py](file://backend/service_fee_management/urls.py)
- [serializers.py](file://backend/service_fee_management/serializers.py)
- [payment_processor.py](file://backend/service_fee_management/utils/payment_processor.py)
</cite>

## Table of Contents
1. [Introduction](#introduction)
2. [Project Structure](#project-structure)
3. [Core Components](#core-components)
4. [Architecture Overview](#architecture-overview)
5. [Detailed Component Analysis](#detailed-component-analysis)
6. [Dependency Analysis](#dependency-analysis)
7. [Performance Considerations](#performance-considerations)
8. [Troubleshooting Guide](#troubleshooting-guide)
9. [Conclusion](#conclusion)

## Introduction
This document defines the Payment Hierarchy Business Rules that govern how service fee payments are allocated across multiple charge components. The system enforces a strict priority order: penalty (late fee) is paid first, followed by the base service fee, then bill categories (utilities), with any remaining amount becoming an advance payment for future use. These rules ensure accurate financial tracking, compliance with billing obligations, and transparent audit trails.

## Project Structure
The payment hierarchy implementation spans backend Django models, views, serializers, and utility modules within the service fee management application. Supporting documentation provides business rule definitions and table structures.

```mermaid
graph TB
subgraph "Service Fee Management"
A["models.py<br/>ServiceFeePayment, ServiceFeeItem,<br/>ServiceFeePaymentAllocation,<br/>AdvancePayment"]
B["views.py<br/>ServiceFeeMultiMonthPaymentView,<br/>ServiceFeeUnpaidPeriodsView"]
C["serializers.py<br/>ServiceFeePaymentSerializer"]
D["urls.py<br/>API endpoints"]
E["utils/payment_processor.py<br/>apply_advance_to_bill"]
end
subgraph "Documentation"
F["SERVICE_FEE_PAYMENT_HIERARCHY_BUSINESS_RULES.md"]
G["PAYMENT_HIERARCHY_TABLE_STRUCTURE.md"]
H["payment_hierarchy_redesign.md"]
end
A --> B
B --> C
D --> B
B --> E
F --> A
G --> A
H --> A
```

**Diagram sources**
- [models.py](file://backend/service_fee_management/models.py#L1180-L1578)
- [views.py](file://backend/service_fee_management/views.py#L1582-L2077)
- [serializers.py](file://backend/service_fee_management/serializers.py#L132-L773)
- [urls.py](file://backend/service_fee_management/urls.py#L68-L155)
- [payment_processor.py](file://backend/service_fee_management/utils/payment_processor.py#L16-L268)
- [SERVICE_FEE_PAYMENT_HIERARCHY_BUSINESS_RULES.md](file://backend/SERVICE_FEE_PAYMENT_HIERARCHY_BUSINESS_RULES.md#L1-L586)
- [PAYMENT_HIERARCHY_TABLE_STRUCTURE.md](file://backend/PAYMENT_HIERARCHY_TABLE_STRUCTURE.md#L1-L222)
- [payment_hierarchy_redesign.md](file://backend/docs/payment_hierarchy_redesign.md#L1-L100)

**Section sources**
- [models.py](file://backend/service_fee_management/models.py#L1180-L1578)
- [views.py](file://backend/service_fee_management/views.py#L1582-L2077)
- [serializers.py](file://backend/service_fee_management/serializers.py#L132-L773)
- [urls.py](file://backend/service_fee_management/urls.py#L68-L155)
- [payment_processor.py](file://backend/service_fee_management/utils/payment_processor.py#L16-L268)
- [SERVICE_FEE_PAYMENT_HIERARCHY_BUSINESS_RULES.md](file://backend/SERVICE_FEE_PAYMENT_HIERARCHY_BUSINESS_RULES.md#L1-L586)
- [PAYMENT_HIERARCHY_TABLE_STRUCTURE.md](file://backend/PAYMENT_HIERARCHY_TABLE_STRUCTURE.md#L1-L222)
- [payment_hierarchy_redesign.md](file://backend/docs/payment_hierarchy_redesign.md#L1-L100)

## Core Components
This section outlines the key components that implement the payment hierarchy business rules.

- ServiceFeePayment: Main payment transaction record containing unit, service fee, period, base amount, additional charges, total amount, and status fields.
- ServiceFeeItem: Represents individual line items (penalty, base fee, bill categories) generated for a unit and period, carrying item type, name, amount, and related foreign keys.
- ServiceFeePaymentAllocation: New allocation model replacing legacy payment details, linking a specific billing record to a specific item with allocated amount and allocation type (debit, credit, advance).
- AdvancePayment: Tracks overpayments as advance credits with type, amount, applied amount, remaining amount, and status.
- PenaltyWaiver: Records penalty waivers applied to items, supporting net penalty calculations.
- ServiceFeeBilling: Transaction record capturing payment method, billing amount, total paid, and payment metadata.

These components collectively enforce the strict payment hierarchy and maintain auditability.

**Section sources**
- [models.py](file://backend/service_fee_management/models.py#L1180-L1578)
- [SERVICE_FEE_PAYMENT_HIERARCHY_BUSINESS_RULES.md](file://backend/SERVICE_FEE_PAYMENT_HIERARCHY_BUSINESS_RULES.md#L222-L265)

## Architecture Overview
The payment hierarchy architecture enforces strict allocation order and maintains detailed allocation records.

```mermaid
sequenceDiagram
participant Client as "Client"
participant View as "ServiceFeeMultiMonthPaymentView"
participant Billing as "ServiceFeeBilling"
participant Items as "ServiceFeeItem"
participant Alloc as "ServiceFeePaymentAllocation"
participant Adv as "AdvancePayment"
Client->>View : POST multi-month payment
View->>Billing : Create billing record
View->>Items : Fetch items for payment (sorted by priority)
View->>Alloc : Allocate in hierarchy (penalty→base→categories)
Alloc-->>View : Allocation records created
View->>Adv : Create advance if excess remains
Adv-->>View : Advance record created
View-->>Client : Payment confirmed with allocations
```

**Diagram sources**
- [views.py](file://backend/service_fee_management/views.py#L1582-L2077)
- [models.py](file://backend/service_fee_management/models.py#L1343-L1427)
- [serializers.py](file://backend/service_fee_management/serializers.py#L550-L640)

## Detailed Component Analysis

### Payment Hierarchy Business Rules
The system enforces a strict allocation order:
1. Penalty (Late Fee): Paid first, net penalty equals gross penalty minus waived amount.
2. Base Service Fee: Paid second, amount equals original fixed amount minus already paid.
3. Bill Categories: Paid third, distributed across categories (equal distribution or per-category).
4. Excess Amount: Remaining amount becomes an advance payment (auto_excess type).

```mermaid
flowchart TD
Start(["Payment Received"]) --> Init["Initialize remaining_amount = total_payment"]
Init --> PenaltyCheck{"Net penalty > 0?"}
PenaltyCheck --> |Yes| PayPenalty["Allocate to penalty item(s)"]
PenaltyCheck --> |No| BaseCheck{"Base fee owed > 0?"}
PayPenalty --> PenaltyAdj["remaining_amount -= penalty_paid"]
PenaltyAdj --> BaseCheck
BaseCheck --> |Yes| PayBase["Allocate to base fee item"]
BaseCheck --> |No| CatCheck{"Bill categories > 0 and remaining > 0?"}
PayBase --> BaseAdj["remaining_amount -= base_paid"]
BaseAdj --> CatCheck
CatCheck --> |Yes| PayCats["Distribute to bill category items"]
CatCheck --> |No| ExcessCheck{"remaining > 0?"}
PayCats --> CatAdj["remaining_amount -= categories_paid"]
CatAdj --> ExcessCheck
ExcessCheck --> |Yes| CreateAdvance["Create AdvancePayment (auto_excess)"]
ExcessCheck --> |No| Done(["Complete"])
CreateAdvance --> Done
```

**Diagram sources**
- [SERVICE_FEE_PAYMENT_HIERARCHY_BUSINESS_RULES.md](file://backend/SERVICE_FEE_PAYMENT_HIERARCHY_BUSINESS_RULES.md#L5-L72)
- [PAYMENT_HIERARCHY_TABLE_STRUCTURE.md](file://backend/PAYMENT_HIERARCHY_TABLE_STRUCTURE.md#L33-L72)

**Section sources**
- [SERVICE_FEE_PAYMENT_HIERARCHY_BUSINESS_RULES.md](file://backend/SERVICE_FEE_PAYMENT_HIERARCHY_BUSINESS_RULES.md#L5-L72)
- [PAYMENT_HIERARCHY_TABLE_STRUCTURE.md](file://backend/PAYMENT_HIERARCHY_TABLE_STRUCTURE.md#L33-L72)

### Allocation Model and Hierarchy Logic
The allocation model replaces legacy payment details and supports hierarchical payment processing.

```mermaid
classDiagram
class ServiceFeePayment {
+unit
+service_fee
+service_period_month
+service_period_year
+base_service_amount
+additional_bill_charges
+amount
+service_status
+payment_status
}
class ServiceFeeItem {
+service_fee_payment
+item_type
+item_name
+amount
+bill_category
+bill_upload_detail
+penalty_tier
+penalty_waiver
}
class ServiceFeePaymentAllocation {
+service_fee_billing
+service_fee_item
+service_fee_payment
+allocated_amount
+allocation_type
+penalty_waiver
+description
}
class AdvancePayment {
+unit
+resident
+advance_type
+amount
+applied_amount
+remaining_amount
+source_billing
+status
}
ServiceFeePayment "1" --> "N" ServiceFeePaymentAllocation : "allocations"
ServiceFeeItem "1" --> "N" ServiceFeePaymentAllocation : "payment_allocations"
ServiceFeePayment "1" --> "N" ServiceFeeItem : "items"
ServiceFeePayment "1" --> "N" AdvancePayment : "generated_advances"
```

**Diagram sources**
- [models.py](file://backend/service_fee_management/models.py#L1180-L1578)

**Section sources**
- [models.py](file://backend/service_fee_management/models.py#L1180-L1578)

### Multi-Month Payment Processing
The multi-month payment view orchestrates payment processing across multiple periods with hierarchical allocation and advance application.

```mermaid
sequenceDiagram
participant Client as "Client"
participant View as "ServiceFeeMultiMonthPaymentView"
participant DB as "Database"
participant Processor as "PaymentProcessor"
Client->>View : Submit selected periods and payment
View->>DB : Validate inputs and identities
View->>DB : Create billing records
View->>DB : Fetch items (penalty→base→categories)
View->>Processor : Apply advance credits if needed
Processor->>DB : Allocate advances to items
View->>DB : Create allocation records
View->>DB : Create advance if excess remains
View-->>Client : Return payment confirmation
```

**Diagram sources**
- [views.py](file://backend/service_fee_management/views.py#L1582-L2077)
- [payment_processor.py](file://backend/service_fee_management/utils/payment_processor.py#L16-L268)

**Section sources**
- [views.py](file://backend/service_fee_management/views.py#L1582-L2077)
- [payment_processor.py](file://backend/service_fee_management/utils/payment_processor.py#L16-L268)

### API Endpoints and Data Flow
The service fee management API exposes endpoints for multi-month payments, unpaid periods, and payment details, integrating with the payment hierarchy logic.

```mermaid
graph TB
A["POST /multi-month-payment/"] --> B["ServiceFeeMultiMonthPaymentView"]
C["GET /unpaid-periods/"] --> D["ServiceFeeUnpaidPeriodsView"]
E["GET /payment-details/"] --> F["ServiceFeePaymentDetailsView"]
B --> G["Create billing records"]
B --> H["Hierarchical allocation"]
B --> I["Create advance payments"]
D --> J["Return payment hierarchy breakdown"]
F --> K["Return allocation details"]
```

**Diagram sources**
- [urls.py](file://backend/service_fee_management/urls.py#L68-L155)
- [views.py](file://backend/service_fee_management/views.py#L1582-L2077)

**Section sources**
- [urls.py](file://backend/service_fee_management/urls.py#L68-L155)
- [views.py](file://backend/service_fee_management/views.py#L1582-L2077)

## Dependency Analysis
The payment hierarchy implementation depends on several models and utilities working together to enforce business rules and maintain data integrity.

```mermaid
graph TB
A["ServiceFeePayment"] --> B["ServiceFeeItem"]
A --> C["ServiceFeePaymentAllocation"]
A --> D["AdvancePayment"]
C --> E["ServiceFeeBilling"]
C --> F["PenaltyWaiver"]
B --> G["BillCategory"]
B --> H["BillUploadDetail"]
B --> I["ServiceFeePaymentLatePenaltyTier"]
J["ServiceFeeMultiMonthPaymentView"] --> A
J --> C
J --> D
K["ServiceFeeUnpaidPeriodsView"] --> A
L["ServiceFeePaymentDetailsView"] --> C
M["ServiceFeePaymentSerializer"] --> A
N["apply_advance_to_bill"] --> D
N --> C
```

**Diagram sources**
- [models.py](file://backend/service_fee_management/models.py#L1180-L1578)
- [views.py](file://backend/service_fee_management/views.py#L1582-L2077)
- [serializers.py](file://backend/service_fee_management/serializers.py#L132-L773)
- [payment_processor.py](file://backend/service_fee_management/utils/payment_processor.py#L16-L268)

**Section sources**
- [models.py](file://backend/service_fee_management/models.py#L1180-L1578)
- [views.py](file://backend/service_fee_management/views.py#L1582-L2077)
- [serializers.py](file://backend/service_fee_management/serializers.py#L132-L773)
- [payment_processor.py](file://backend/service_fee_management/utils/payment_processor.py#L16-L268)

## Performance Considerations
- Efficient querying: Use database indexes on payment type, billing records, and allocation types to optimize hierarchical allocation queries.
- Bulk operations: Leverage bulk create for allocation records to minimize database round trips during payment processing.
- Atomic transactions: Wrap payment processing in atomic blocks to ensure consistency and rollback on errors.
- Advance application: Implement FIFO logic for advance application to maintain predictable credit utilization.

## Troubleshooting Guide
Common issues and resolutions:
- Payment exceeding due amount: Validation prevents overpayments; adjust payment amount or remove excess.
- Duplicate payments: Recent payment detection prevents duplicate entries within a short time window.
- Allocation mismatches: Verify item priorities and balances; ensure penalty items are processed before base fees.
- Advance application failures: Check advance status and remaining amounts; ensure proper filtering by account holder type and ID.

**Section sources**
- [serializers.py](file://backend/service_fee_management/serializers.py#L244-L345)
- [views.py](file://backend/service_fee_management/views.py#L1878-L2077)
- [payment_processor.py](file://backend/service_fee_management/utils/payment_processor.py#L16-L268)

## Conclusion
The Payment Hierarchy Business Rules establish a robust framework for allocating payments across penalty, base fee, and bill categories while maintaining transparency and auditability. The implementation leverages dedicated models, serializers, and views to enforce strict priority ordering and provide comprehensive tracking of payment allocations and advance credits.