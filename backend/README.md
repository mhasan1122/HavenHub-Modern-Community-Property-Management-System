# ⚙️ HavenHub API & Core Engine

The engine that powers the HavenHub Property Management System. A robust **Django-based** REST API designed for high-performance residential management.

## 🚀 Key Modules
- **Core Property Logic**: Tower, Floor, Unit, and Member management with hierarchal structures.
- **Service Fee Management**: Automated bulk bill generation, penalty logic, and partial payment handling.
- **Notification Engine**: Dispatch system for FCM (Firebase Push), SMTP (Email), and in-app bulletins.
- **Financial Audit**: Secure tracking of each payment, voucher, and financial entry.

## 🛠 Tech Stack
- **Framework**: [Django](https://www.djangoproject.com/)
- **API Engine**: [Django REST Framework (DRF)](https://www.django-rest-framework.org/)
- **Database**: SQLite (Development), PostgreSQL (Production-ready)
- **Authentication**: JWT (JSON Web Token)
- **Services**: Firebase (FCM), Paystation (Payment gateway), WeasyPrint (PDF generation)

## 📥 Installation

1. Navigate to the backend directory:
   ```bash
   cd backend
   ```

2. Create and activate a Virtual Environment:
   ```bash
   python -m venv venv
   source venv/bin/activate  # On Windows: venv\Scripts\activate
   ```

3. Install dependencies:
   ```bash
   pip install -r requirements.txt
   ```

4. Run Migrations:
   ```bash
   python manage.py migrate
   ```

5. Start the server:
   ```bash
   python manage.py runserver
   ```

## 🧪 Testing & Diagnostics
The backend features an extensive test suite and diagnostic scripts for payments, notifications, and service fee logic.
Check the [PAYMENT_HIERARCHY_TABLE_STRUCTURE.md](./PAYMENT_HIERARCHY_TABLE_STRUCTURE.md) for deeper database architecture details.

---
*Building secure foundations for modern living. Part of the HavenHub ecosystem.*
