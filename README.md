# 🏡 HavenHub: Modern Community & Property Management System

> Elevating property management through seamless connectivity, automated billing, and a unified community experience.

---

## ✨ Project Highlights
HavenHub (formerly EstateLink) is a comprehensive, full-stack solution designed for residential towers, apartment complexes, and gated communities. It bridges the gap between property administrators and residents by automating complex financial tasks, streamlining communication, and providing a powerful mobile interface for everyone.

### 🚀 Key Features
- **📊 Comprehensive Financial Suite**: Full ERP integration including Trial Balance, Balance Sheet, Profit & Loss, and automated Ledger management.
- **🏢 Infinite Property Hierarchy**: Manage multiple towers, individual units, and diverse member roles (Owners, Residents, Staff) with ease.
- **💳 Automated Service fees**: rule-based service fee generation, partial payments, and integration with Paystation for effortless collections.
- **📢 Real-time Communication**: Integrated notice boards, bulletins, and multi-channel notifications (Push via FCM, Email) to keep the community informed.
- **📱 Native Mobile Experience**: Dedicated React Native app for residents and staff to manage payments, view notices, and interact with the community.
- **🛠 Fine-grained RBAC**: Robust role-based access control to ensure data security across the dashboard and mobile app.

---

## 🏗 System Architecture

The project is architected as a decoupled ecosystem:

### ⚙️ [Backend](./backend) (Django)
The engine of HavenHub. A Python-powered REST API that handles:
- Core business logic and property hierarchy.
- Automated billing engine and service fee calculations.
- Notification dispatch (FCM & SMTP).
- Secure JWT-based authentication.

### 🖥️ [Frontend Web](./frontend) (React + Vite + Tailwind)
The Command Center for property managers.
- Rich interactive dashboards built with modern React.
- Advanced data visualization for financial reporting.
- Intuitive interfaces for tower and unit configuration.

### 📱 [Mobile App](./Estate_link_App) (React Native + Expo)
The resident's companion.
- Seamless onboarding and authentication.
- One-touch service fee payments.
- Real-time community wall and notification center.

---

## 🛠 Tech Stack

| Layer | Technologies |
| :--- | :--- |
| **Backend** | Python, Django, DRF, SQLite (Dev), Redis (Caching) |
| **Frontend** | React, Vite, Tailwind CSS, Redux Toolkit, Framer Motion |
| **Mobile** | React Native, Expo, NativeWind, React Navigation |
| **Services** | Firebase (FCM), Paystation (Payment gateway), SMTP (Email) |

---

## 🚀 Getting Started

### Prerequisites
- Python 3.10+
- Node.js 18+
- Expo CLI (`npm install -g expo-cli`)

### Quick Setup

1. **Clone the Repository**
   ```bash
   git clone <repo-url>
   cd HavenHub
   ```

2. **Initialize the Backend**
   ```bash
   cd backend
   python -m venv venv
   source venv/bin/activate  # On Windows: venv\Scripts\activate
   pip install -r requirements.txt
   python manage.py migrate
   python manage.py runserver
   ```

3. **Power up the Frontend**
   ```bash
   cd frontend
   npm install
   npm run dev
   ```

4. **Launch the Mobile App**
   ```bash
   cd Estate_link_App
   npm install
   npx expo start
   ```
