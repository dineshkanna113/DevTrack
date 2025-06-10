# 🛠️ DevTrack – Bug Tracking System

A full-stack issue/bug tracker for teams and individuals. Built with **FastAPI**, **React**, and **PostgreSQL**.

---

## 🚀 Features

- 🔐 User authentication (JWT-based)
- 📄 Create, assign, and update issues
- 🧭 Filter by status, assignee
- 📊 Responsive UI dashboard with charts (planned)
- ☁️ Deploy on Render/Vercel

---

## 🛠️ Tech Stack

- **Frontend**: React, TailwindCSS, Axios
- **Backend**: FastAPI, Pydantic, PostgreSQL
- **Auth**: JWT
- **Deployment**: Vercel (frontend), Render (backend)

---

## 🧪 Setup

```bash
# Backend
cd backend/
pip install -r requirements.txt
uvicorn main:app --reload

# Frontend
cd frontend/
npm install
npm run dev
