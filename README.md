# HRMS Lite → **HRMS Cloud** (v0.9 体验版)

> 🆕 **本仓库已升级为完整的多租户 SaaS HRMS（双语 + 移动响应式 + 三地合规）**
>
> 📚 **完整文档套装** → [`/docs`](./docs/README.md) （5 份文档 · 约 2,500 行）
> - [01 · 用户使用手册](./docs/01-USER-MANUAL.md)
> - [02 · 完整功能介绍](./docs/02-FEATURE-CATALOG.md)
> - [03 · 系统承载力白皮书](./docs/03-CAPACITY-ARCHITECTURE.md)
> - [04 · 竞品对比与差异化优势](./docs/04-COMPETITIVE-ANALYSIS.md)
> - [05 · 定价策略与商业模式](./docs/05-PRICING-STRATEGY.md)
>
> 🌐 **在线体验**：<https://3000-i4pnxjuiycfh59ft4rxdj-2e77fc33.sandbox.novita.ai> （点击角色卡片即可登录，无需密码）

---

## 📌 Project Overview

**HRMS Lite** is a lightweight Human Resource Management System designed to manage employees and basic HR operations efficiently.
The project is built with a modern frontend + backend architecture, focusing on simplicity, scalability, and ease of use.

It is suitable for small to medium organizations that need a basic HR system without heavy complexity.

---

## 🛠 Tech Stack Used

### Frontend

* React.js
* Axios (for API calls)
* HTML5, CSS3
* JavaScript (ES6+)

### Backend

* FastAPI (Python)
* SQLAlchemy (ORM)
* JWT Authentication
* Uvicorn (ASGI Server)

### Database

* MySQL

### Tools & Utilities

* Git & GitHub
* dotenv (Environment variable management)
* Postman (API testing)

---

## ▶️ Steps to Run the Project Locally

### 1️⃣ Clone the Repository

```bash
git clone https://github.com/Grvrajput/Hrms.git
cd Hrms
```

---

### 2️⃣ Backend Setup

#### Create Virtual Environment

```bash
cd backend
python -m venv venv
```

#### Activate Virtual Environment

**Windows**

```bash
venv\Scripts\activate
```

**Linux / Mac**

```bash
source venv/bin/activate
```

#### Install Dependencies

```bash
pip install -r requirements.txt
```

#### Create `.env` File

```env
DATABASE_URL=mysql+pymysql://username:password@localhost:3306/hrms_lite
JWT_SECRET=your_secret_key
```

#### Run Backend Server

```bash
uvicorn app.main:app --reload
```

Backend will run at:

```
http://127.0.0.1:8000
```

---

### 3️⃣ Frontend Setup

```bash
cd frontend
npm install
npm start
```

Frontend will run at:

```
http://localhost:3000
```

---

⚠️ Assumptions & Limitations

* This is a basic HRMS, not a full-scale enterprise system.
* Role-based access control is limited.
* Payroll, attendance biometric integration, and advanced reporting are not included.
* Security features are suitable for learning/demo purposes, not for highly sensitive enterprise data.
* Email notifications and file uploads are not implemented yet.

---

📌 Future Enhancements

* Role-based access control (Admin / HR / Employee)
* Attendance & Leave Management
* Payroll module
* Email notifications
* Dashboard & analytics

---

👤 Author

**Gaurav Kumar**
