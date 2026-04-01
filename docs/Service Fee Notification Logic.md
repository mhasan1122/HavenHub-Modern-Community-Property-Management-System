# **Service Fee Notification System**

This document defines how service fee–related notifications are distributed within the system. Notifications are sent based on user roles and permission configurations.

There are two primary recipient groups:

* Community Members (Owners and Residents)  
* Organization Members (Management and Staff)

# **1\. Community Members (Owners & Residents)**

Community Members include all registered owners and active residents associated with a specific unit.

Whenever a service fee–related event occurs for a unit, notifications are automatically sent to all registered owners and active residents of that unit.

## **1.1 Bill Issued**

**Trigger:**  
A new service fee bill is generated for the unit.

**Recipients:**  
All registered owners and active residents linked to the unit.

**Delivery Channel:**

* Mobile push notification  
* In-app notification center

## **1.2 Payment Confirmation**

**Definition:**  
A Payment Confirmation notification is sent immediately after a payment is successfully recorded for a unit.

### **Trigger Scenarios**

The notification is triggered in both of the following cases:

1. A community member makes a **full payment** against a service fee bill via the mobile app.

2. A community member makes a **partial payment** against a service fee bill via the mobile app.

3. An admin records a **full payment** against a service fee bill via the web application.

4. An admin records a **partial payment** against a service fee bill via the web application.

5. A community member makes an **advance payment only** (no bill adjustment) via mobile or web.

6. An admin records an **advance payment only** via the web application.

7. A single payment includes **both bill adjustment and advance amount** (combined payment) via mobile.

8. A single payment includes **both bill adjustment and advance amount** (combined payment) via web.

9. An existing advance balance is **automatically adjusted** during bill payment.

In both scenarios, all registered owners and active residents associated with the unit receive the notification.

**Delivery Channel:**

* Mobile push notification  
* In-app notification center

# **2\. Organization Members (Management & Staff)**

Organization Members include management and staff who use the web dashboard.

Staff notifications are controlled strictly through permission-based logic. A staff member will only receive notifications if the required permission set is assigned.

**Delivery Channel:**

* Web dashboard (in-app notification)

# **3\. Permission-Based Notification Rules**

## **3.1 Service Fee Main Permissions**

The following are the five main Service Fee permissions used to determine notification eligibility:

1. View Service Fee Overview
2. Record Service Fee Payment
3. Generate Service Fees
4. View Billing Management
5. View Service Fee Payments Page

## **3.2 Full Service Fee Permission Access**

If a staff member has **all five Service Fee permissions**, they will receive **all Service Fee–related notifications**, including:

* Monthly Bills Generated (Bulk)
* Service Fee Payment notifications
* Any other service fee–related system notifications

## **3.3 Monthly Bills Generated (Bulk)**

**Trigger:**  
Bulk generation of service fee bills for a specific period or tower.

**Eligibility Rule:**  
A staff member will receive this notification if they have **all** of the following permissions:

* Generate Service Fees
* View Billing Management

If both permissions are assigned, the user is eligible to receive the Monthly Bills Generated (Bulk) notification.

**Notification Content:**  
Provides a summary of the total number of bills generated for the selected period or tower.

## **3.4 Service Fee Payment Notification (Staff)**

**Trigger:**  
Notification will be triggered in the web application when:

1. A community member makes a full or partial service fee payment through the mobile app.

2. An admin records a full or partial service fee payment using the Estate Control web application.

3. A community member or admin makes an advance payment only via mobile or web.

4. A single payment includes both service fee payment and advance amount (combined payment) via mobile or web.

**Eligibility Rule:**  
A staff member will receive this notification if they have **all** of the following permissions:

* View Service Fee Overview
* Record Service Fee Payment
* View Service Fee Payments Page

If all three permissions are assigned, the user is eligible to receive Service Fee Payment notifications.

# **4\. Permission Reference**

## **Record Service Fee Payment**

* Permission ID: 44  
* Applies To: Organization Members  
* Purpose: Allows staff to record service fee payments from the web dashboard.  
* Related Notifications:  
  * Triggers Payment Confirmation for Community Members  
  * Triggers Service Fee Payment notification for eligible staff

# **5\. Summary Table**

| Notification Type | Target Recipient | Required Permissions | Channel |
| ----- | ----- | ----- | ----- |
| Bill Issued | Owners & Active Residents | Associated with the unit | Push + In-app |
| Payment Confirmation | Owners & Active Residents | Payment recorded for the unit | Push + In-app |
| Monthly Bills Generated (Bulk) | Management Staff | Generate Service Fees + View Billing Management | Web (In-app) |
| Service Fee Payment (Staff) | Authorized Staff | View Service Fee Overview + Record Service Fee Payment + View Service Fee Payments Page | Web (In-app) |
