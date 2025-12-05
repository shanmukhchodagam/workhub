# WorkHub Platform Documentation

## Table of Contents
1. [Platform Overview](#platform-overview)
2. [Docker Basics](#docker-basics)
3. [Getting Started](#getting-started)
4. [Platform Features](#platform-features)
5. [Available Commands](#available-commands)
6. [API Endpoints](#api-endpoints)
7. [Database Management](#database-management)
8. [Troubleshooting](#troubleshooting)

---

## Platform Overview

WorkHub is an AI-powered workflow automation platform designed for managing field operations. It features:
- **Manager Dashboard**: Real-time monitoring, employee management, and analytics
- **Worker Chat Interface**: AI-assisted communication for field workers
- **Team Management**: Role-based access control (Manager/Employee)
- **Real-time Updates**: WebSocket-based live communication
- **Cloud Database**: Data stored in Neon PostgreSQL

### Technology Stack
- **Frontend**: Next.js 14, TypeScript, Tailwind CSS, Shadcn/UI
- **Backend**: FastAPI (Python), SQLAlchemy, JWT Authentication
- **Database**: Neon PostgreSQL (Cloud)
- **Cache**: Redis
- **Storage**: MinIO (S3-compatible)
- **AI Agent**: LangGraph
- **Containerization**: Docker & Docker Compose

---

## Docker Basics

### What is Docker?
Docker is a platform that packages your application and all its dependencies into **containers**. Think of containers as lightweight, portable boxes that contain everything needed to run your application.

### Key Concepts

**1. Docker Image**
- A blueprint/template for creating containers
- Like a recipe that describes how to build your application

**2. Docker Container**
- A running instance of an image
- Like a cake made from the recipe (image)
- Isolated from your host system

**3. Docker Compose**
- A tool for running multi-container applications
- Uses a `docker-compose.yml` file to define all services
- Our app has 5 services: backend, frontend, postgres, redis, minio

**4. Docker Volume**
- Persistent storage for containers
- Data survives even when containers are deleted

### Common Docker Commands Explained

```bash
# Start all services (runs in foreground, shows logs)
sudo docker-compose up

# Start all services in background (detached mode)
sudo docker-compose up -d

# Stop all running services
sudo docker-compose down

# Rebuild images and start services (use after code changes)
sudo docker-compose up --build

# View logs of a specific service
sudo docker-compose logs backend

# View live logs (follow mode)
sudo docker-compose logs -f backend

# List running containers
sudo docker ps

# Execute a command inside a running container
sudo docker-compose exec backend python script.py

# Run a one-off command (container stops after execution)
sudo docker-compose run --rm backend python script.py

# Remove all stopped containers, networks, and unused images
sudo docker system prune
```

---

## Getting Started

### Prerequisites
- Docker installed
- Docker Compose installed
- Neon database account (already configured in `.env`)

### Initial Setup

1. **Clone the repository** (if not already done)
   ```bash
   cd /media/chodagam-shanmukh/volume\ A/workhub/workhub
   ```

2. **Verify environment variables**
   - Check `.env` file exists with Neon database credentials
   - Key variables: `DATABASE_URL`, `SECRET_KEY`, `NEXT_PUBLIC_API_URL`

3. **Start the platform**
   ```bash
   sudo docker-compose up --build
   ```
   
   This will:
   - Build all Docker images
   - Start 5 services: backend, frontend, redis, minio, agent_service
   - Backend runs on `http://localhost:8000`
   - Frontend runs on `http://localhost:3000`

4. **Access the application**
   - Open browser: `http://localhost:3000`
   - You'll see the landing page with "Sign In" and "Create Manager Account"

---

## Platform Features

### 1. Authentication & User Management

#### Manager Registration
- Navigate to `http://localhost:3000/register`
- Create a manager account (automatically creates a team)
- Fields: Email, Password, Full Name, Team Name

#### Login
- Navigate to `http://localhost:3000/login`
- Login with email and password
- Managers → redirected to `/manager`
- Employees → redirected to `/worker`

#### Add Employees
- **Manager Dashboard** → Click "Add Employee" button
- Fill in: Full Name, Email, Password
- Employee is automatically linked to your team

### 2. Manager Dashboard (`/manager`)

**Features:**
- **Real-time Stats**: Active workers, pending tasks, incidents, completed tasks
- **Live Activity Feed**: Real-time updates from field workers
- **Recent Incidents**: High-priority issues requiring attention
- **Add Employee**: Create new employee accounts
- **Settings**: Profile management (coming soon)
- **Logout**: Sign out of the platform

**WebSocket Connection:**
- Automatically connects to backend WebSocket
- Shows "Live Connected" or "Disconnected" status
- Receives real-time messages from workers

### 3. Worker Chat Interface (`/worker`)

**Features:**
- AI-powered chat interface
- Send messages to AI agent
- Real-time responses
- Message history

### 4. Profile Management

**Available Actions:**
- View profile: `GET /auth/me`
- Update profile: Name, Email
- Change password
- Logout

---

## Available Commands

### Development Commands

#### Start Platform (Development Mode)
```bash
# Start all services with live code reloading
sudo docker-compose up

# Start in background
sudo docker-compose up -d

# Rebuild and start (use after dependency changes)
sudo docker-compose up --build
```

#### Stop Platform
```bash
# Stop all services
sudo docker-compose down

# Stop and remove volumes (WARNING: deletes data)
sudo docker-compose down -v
```

#### View Logs
```bash
# All services
sudo docker-compose logs

# Specific service
sudo docker-compose logs backend
sudo docker-compose logs frontend

# Follow logs (live updates)
sudo docker-compose logs -f backend
```

### Database Commands

#### Initialize Neon Database
```bash
# Create all tables in Neon
sudo docker-compose run --rm backend python init_neon_db.py
```

#### Reset Neon Database
```bash
# Drop all tables and recreate (WARNING: deletes all data)
sudo docker-compose run --rm backend python reset_neon_db.py
```

#### Verify Users in Database
```bash
# List all users with email and password hash preview
sudo docker-compose run --rm backend python verify_users.py
```

### Utility Scripts

#### Check Database Connection
```bash
sudo docker-compose run --rm backend python check_db.py
```

#### Access Backend Shell
```bash
# Open Python shell inside backend container
sudo docker-compose exec backend python
```

#### Access Database Directly
```bash
# Connect to Neon database using psql (if installed)
psql "postgresql://neondb_owner:npg_j4WT9JuyPwgk@ep-royal-lab-a1t6h3fg-pooler.ap-southeast-1.aws.neon.tech/neondb?sslmode=require"
```

### Frontend Commands

#### Install Dependencies
```bash
sudo docker-compose exec frontend npm install
```

#### Build for Production
```bash
sudo docker-compose exec frontend npm run build
```

---

## API Endpoints

### Authentication Endpoints

| Method | Endpoint | Description | Auth Required |
|--------|----------|-------------|---------------|
| POST | `/auth/register/manager` | Register new manager + team | No |
| POST | `/auth/register/employee` | Register new employee (manager only) | Yes |
| POST | `/auth/token` | Login (get JWT token) | No |
| GET | `/auth/me` | Get current user profile | Yes |
| PUT | `/auth/profile` | Update profile (name/email) | Yes |
| POST | `/auth/change-password` | Change password | Yes |
| POST | `/auth/logout` | Logout | Yes |

### WebSocket Endpoints

| Endpoint | Description |
|----------|-------------|
| `ws://localhost:8000/ws/worker/{user_id}` | Worker chat connection |
| `ws://localhost:8000/ws/manager/{user_id}` | Manager dashboard updates |

### Example API Calls

#### Register Manager
```bash
curl -X POST http://localhost:8000/auth/register/manager \
  -H "Content-Type: application/json" \
  -d '{
    "email": "manager@example.com",
    "password": "securepassword",
    "full_name": "John Manager",
    "team_name": "Acme Corp"
  }'
```

#### Login
```bash
curl -X POST http://localhost:8000/auth/token \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d "username=manager@example.com&password=securepassword"
```

#### Get Profile (with token)
```bash
curl -X GET http://localhost:8000/auth/me \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

---

## Database Management

### Database Schema

**Tables:**
1. **teams**: Team information (id, name, plan_type, created_at)
2. **users**: User accounts (id, team_id, email, hashed_password, role, force_reset, full_name, created_at)
3. **chat_sessions**: Chat sessions (id, user_id, team_id, created_at)
4. **messages**: Chat messages (id, chat_id, sender, content, created_at)
5. **documents**: Uploaded documents (id, team_id, file_url, status, created_at)

### Accessing Neon Dashboard
1. Go to https://neon.tech
2. Login with your account
3. Select your project
4. View tables, run SQL queries, monitor usage

### Database Connection Details
- **Host**: `ep-royal-lab-a1t6h3fg-pooler.ap-southeast-1.aws.neon.tech`
- **Database**: `neondb`
- **User**: `neondb_owner`
- **SSL**: Required
- **Connection String**: See `.env` file

---

## Troubleshooting

### Common Issues

#### 1. "Port already in use"
```bash
# Find process using port 8000 or 3000
sudo lsof -i :8000
sudo lsof -i :3000

# Kill the process
sudo kill -9 <PID>

# Or stop all docker containers
sudo docker-compose down
```

#### 2. "Cannot connect to database"
- Check `.env` file has correct `DATABASE_URL`
- Verify Neon database is active (check Neon dashboard)
- Run: `sudo docker-compose run --rm backend python check_db.py`

#### 3. "Module not found" errors
```bash
# Rebuild containers
sudo docker-compose up --build

# Or reinstall dependencies
sudo docker-compose exec backend pip install -r requirements.txt
sudo docker-compose exec frontend npm install
```

#### 4. Frontend shows 404 errors
- Ensure frontend is running in dev mode (check `docker-compose.yml`)
- Restart frontend: `sudo docker-compose restart frontend`

#### 5. "Token expired" or "Could not validate credentials"
- Logout and login again (tokens expire after 24 hours)
- Clear browser localStorage
- Check backend logs: `sudo docker-compose logs backend`

### Viewing Logs for Debugging

```bash
# Backend errors
sudo docker-compose logs backend --tail=100

# Frontend errors
sudo docker-compose logs frontend --tail=100

# All services
sudo docker-compose logs --tail=50
```

### Resetting Everything

```bash
# Stop all services
sudo docker-compose down

# Remove all volumes (deletes data)
sudo docker-compose down -v

# Remove all images
sudo docker system prune -a

# Start fresh
sudo docker-compose up --build
```

---

## Project Structure

```
workhub/
├── backend/              # FastAPI backend
│   ├── app/
│   │   ├── routers/     # API endpoints
│   │   ├── models/      # Database models
│   │   ├── core/        # Config, security, database
│   │   └── main.py      # FastAPI app
│   ├── requirements.txt
│   ├── Dockerfile
│   ├── init_neon_db.py  # Initialize database
│   ├── reset_neon_db.py # Reset database
│   └── verify_users.py  # Check users
├── frontend/            # Next.js frontend
│   ├── app/            # Pages and routes
│   ├── components/     # React components
│   ├── hooks/          # Custom hooks
│   ├── package.json
│   └── Dockerfile
├── langgraph/          # AI agent service
│   ├── agent.py
│   └── main.py
├── docker-compose.yml  # Service orchestration
├── .env               # Environment variables
└── README.md          # This file
```

---

## Next Steps

1. **Test the Platform**
   - Create a manager account
   - Add some employees
   - Test the chat interface

2. **Customize**
   - Update team name and branding
   - Configure AI agent behavior
   - Add custom workflows

3. **Deploy to Production**
   - Set up proper domain
   - Configure HTTPS
   - Use production-grade secrets
   - Set up monitoring

---

## Support & Resources

- **Docker Documentation**: https://docs.docker.com/
- **FastAPI Documentation**: https://fastapi.tiangolo.com/
- **Next.js Documentation**: https://nextjs.org/docs
- **Neon Documentation**: https://neon.tech/docs

---

**Last Updated**: December 5, 2025
**Version**: 1.0.0
