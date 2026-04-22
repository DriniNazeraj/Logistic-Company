# Deployment Guide

## Prerequisites

- Docker and Docker Compose installed on the server
- Port 80 open for HTTP traffic

## Setup

### 1. Clone the repository

```bash
git clone https://github.com/DriniNazeraj/Logistic-Company.git
cd Logistic-Company
git checkout main
```

### 2. Create the environment file

Create a `.env` file in the project root (same folder as `docker-compose.yml`):

```
POSTGRES_USER=postgres
POSTGRES_PASSWORD=<strong-password-here>
POSTGRES_DB=trans_al
JWT_SECRET=<random-secret-string-here>
ADMIN_EMAIL=manager@gmail.com
ADMIN_PASSWORD=<admin-password-here>
```

> Replace `<strong-password-here>`, `<random-secret-string-here>`, and `<admin-password-here>` with secure values.
> The admin user is created automatically on first boot.

### 3. Start the application

```bash
docker compose up -d
```

This starts 3 services:

| Service | Description | Port |
|---------|-------------|------|
| **db** | PostgreSQL 16 database | 5432 (internal) |
| **server** | Express API backend | 3001 (internal) |
| **client** | Nginx serving the frontend | **80** (public) |

The database tables are created automatically on first boot.

### 4. Verify

```bash
# Check all services are running
docker compose ps

# Check logs if something is wrong
docker compose logs

# Test the API health endpoint
curl http://localhost/api/health
```

Expected response: `{"status":"ok","database":true}`

## Common Operations

### View logs

```bash
docker compose logs -f            # all services
docker compose logs -f server     # backend only
docker compose logs -f client     # frontend only
docker compose logs -f db         # database only
```

### Restart services

```bash
docker compose restart            # restart all
docker compose restart server     # restart backend only
```

### Update to latest code

```bash
git pull
docker compose up -d --build
```

### Stop the application

```bash
docker compose down               # stops everything, keeps data
docker compose down -v            # stops everything AND deletes database data
```

> **Warning:** `docker compose down -v` deletes all database data permanently.

## HTTPS / SSL

The Docker setup serves HTTP on port 80. For HTTPS you have two options:

1. **Cloudflare** (recommended) — point your domain to the server IP, enable Cloudflare proxy, and it handles SSL automatically
2. **Reverse proxy** — put an external nginx/Caddy with SSL certificates in front of port 80

## Architecture

```
Browser → :80 (nginx) → static files (frontend)
                      → /api/* → :3001 (Express backend) → PostgreSQL
```

All API requests go through nginx — the browser only talks to port 80.
