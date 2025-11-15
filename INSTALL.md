# Dashboard Application - Installation Guide

## Overview

This guide covers installation, update, and removal of the Dashboard application on Ubuntu 24 Server using the automated installation script.

## Prerequisites

- **Operating System:** Ubuntu 24 LTS Server (clean minimal install)
- **Architecture:** x86_64 (amd64)
- **Network:** Static IP address recommended
- **Access:** Root or sudo privileges
- **Ports:** 80 (HTTP), 5432 (PostgreSQL - internal only)

## Quick Start

### One-Line Installation

```bash
curl -fsSL https://raw.githubusercontent.com/YOUR_USERNAME/dashboard/main/install.sh | sudo bash
```

Replace `YOUR_USERNAME/dashboard` with your actual GitHub repository path.

### Manual Installation

```bash
# Download installation script
wget https://raw.githubusercontent.com/YOUR_USERNAME/dashboard/main/install.sh

# Make executable
chmod +x install.sh

# Run installer
sudo ./install.sh
```

## Installation Options

The installation script provides an interactive menu with three options:

### 1. Clean Install

Performs a fresh installation of the application:

- Installs Docker and Docker Compose (if not present)
- Installs and configures Nginx reverse proxy
- Clones application from GitHub
- Generates secure production configuration
- Builds and starts Docker containers
- Configures application to run on port 80

**You will be prompted for:**
- Server IP address (auto-detected with confirmation)
- GitHub repository URL

**Installation location:** `/opt/dashboard`

### 2. Update from GitHub

Updates an existing installation with latest code from GitHub:

- Creates automatic backup before updating
- Backs up PostgreSQL database
- Pulls latest code from GitHub repository
- Rebuilds Docker containers
- Preserves existing configuration and data
- Restores database after update
- Automatically rolls back on failure

**Backup location:** `/opt/dashboard_backup_YYYYMMDD_HHMMSS`

### 3. Remove Installation

Completely removes the application:

- Stops and removes Docker containers
- Removes Docker volumes (destroys all data)
- Removes application files
- Removes Nginx configuration
- Leaves Docker and Nginx installed for other applications

**Warning:** This operation cannot be undone. All data will be lost.

## Post-Installation

### Access the Application

After successful installation, access the dashboard at:

```
http://YOUR_SERVER_IP
```

**Default credentials:**
- Username: `admin`
- Password: `admin`

**Important:** You will be forced to change the default password on first login.

### Verify Installation

Check that containers are running:

```bash
cd /opt/dashboard
docker compose ps
```

You should see two containers with status "Up":
- `dashboard-app-1` - Flask application
- `dashboard-db-1` - PostgreSQL database

### View Logs

```bash
# All logs
docker compose -f /opt/dashboard/docker-compose.yml logs -f

# Application logs only
docker compose -f /opt/dashboard/docker-compose.yml logs -f app

# Database logs only
docker compose -f /opt/dashboard/docker-compose.yml logs -f db
```

### Restart Application

```bash
cd /opt/dashboard
docker compose restart
```

### Stop Application

```bash
cd /opt/dashboard
docker compose down
```

### Start Application

```bash
cd /opt/dashboard
docker compose up -d
```

## Configuration

### Environment Variables

Production configuration is stored in `/opt/dashboard/.env`:

```bash
# View configuration (passwords are hidden)
sudo cat /opt/dashboard/.env
```

**Important configuration files:**
- `/opt/dashboard/.env` - Environment variables (600 permissions)
- `/opt/dashboard/docker-compose.yml` - Container orchestration
- `/etc/nginx/sites-available/dashboard` - Nginx configuration

### Database Access

Access PostgreSQL directly:

```bash
# PostgreSQL shell
docker compose -f /opt/dashboard/docker-compose.yml exec db psql -U dashboard

# Run SQL query
docker compose -f /opt/dashboard/docker-compose.yml exec db psql -U dashboard -d dashboard -c "SELECT * FROM users;"

# Create database backup
docker compose -f /opt/dashboard/docker-compose.yml exec db pg_dump -U dashboard dashboard > backup.sql

# Restore database backup
docker compose -f /opt/dashboard/docker-compose.yml exec -T db psql -U dashboard dashboard < backup.sql
```

### Nginx Configuration

Nginx reverse proxy configuration:

```bash
# View configuration
sudo cat /etc/nginx/sites-available/dashboard

# Test configuration
sudo nginx -t

# Reload Nginx
sudo systemctl reload nginx

# View Nginx logs
sudo tail -f /var/log/nginx/dashboard_access.log
sudo tail -f /var/log/nginx/dashboard_error.log
```

## Troubleshooting

### Application Not Accessible

1. **Check containers are running:**
   ```bash
   docker compose -f /opt/dashboard/docker-compose.yml ps
   ```

2. **Check application logs:**
   ```bash
   docker compose -f /opt/dashboard/docker-compose.yml logs app
   ```

3. **Check Nginx status:**
   ```bash
   sudo systemctl status nginx
   ```

4. **Check Nginx configuration:**
   ```bash
   sudo nginx -t
   ```

5. **Check firewall:**
   ```bash
   sudo ufw status
   sudo ufw allow 80/tcp
   ```

### Database Connection Errors

1. **Check database is running:**
   ```bash
   docker compose -f /opt/dashboard/docker-compose.yml ps db
   ```

2. **Check database logs:**
   ```bash
   docker compose -f /opt/dashboard/docker-compose.yml logs db
   ```

3. **Test database connection:**
   ```bash
   docker compose -f /opt/dashboard/docker-compose.yml exec db psql -U dashboard -c "SELECT 1;"
   ```

### Container Won't Start

1. **Check Docker service:**
   ```bash
   sudo systemctl status docker
   ```

2. **Check disk space:**
   ```bash
   df -h
   ```

3. **Check Docker logs:**
   ```bash
   sudo journalctl -u docker -n 50
   ```

4. **Rebuild containers:**
   ```bash
   cd /opt/dashboard
   docker compose down -v
   docker compose build --no-cache
   docker compose up -d
   ```

### Update Failed

If update fails, the script automatically rolls back to the previous version. The backup is preserved at:

```
/opt/dashboard_backup_YYYYMMDD_HHMMSS
```

To manually restore:

```bash
cd /opt/dashboard
docker compose down -v
cd /opt
sudo rm -rf dashboard
sudo mv dashboard_backup_YYYYMMDD_HHMMSS dashboard
cd dashboard
docker compose up -d
```

## Security Considerations

### Production Recommendations

1. **Change default password immediately** after first login

2. **Enable HTTPS** with Let's Encrypt:
   ```bash
   sudo apt-get install certbot python3-certbot-nginx
   sudo certbot --nginx -d your-domain.com
   ```

3. **Enable firewall:**
   ```bash
   sudo ufw allow 22/tcp   # SSH
   sudo ufw allow 80/tcp   # HTTP
   sudo ufw allow 443/tcp  # HTTPS
   sudo ufw enable
   ```

4. **Regular backups:**
   ```bash
   # Create backup script
   sudo cat > /opt/backup-dashboard.sh <<'EOF'
   #!/bin/bash
   BACKUP_DIR="/backup/dashboard/$(date +%Y%m%d)"
   mkdir -p "$BACKUP_DIR"
   docker compose -f /opt/dashboard/docker-compose.yml exec -T db pg_dump -U dashboard dashboard > "$BACKUP_DIR/database.sql"
   cp /opt/dashboard/.env "$BACKUP_DIR/.env"
   EOF

   sudo chmod +x /opt/backup-dashboard.sh

   # Add to crontab (daily at 2 AM)
   echo "0 2 * * * /opt/backup-dashboard.sh" | sudo crontab -
   ```

5. **Monitor logs regularly:**
   ```bash
   sudo tail -f /var/log/nginx/dashboard_access.log
   ```

### File Permissions

The installation script automatically sets secure permissions:

- `/opt/dashboard/.env` - 600 (root only)
- `/opt/dashboard/` - 755 (standard directory)
- Docker volumes - managed by Docker daemon

## Uninstallation

To completely remove the application:

```bash
sudo ./install.sh
# Select option 3: Remove Installation
# Type "yes" when prompted
```

This will remove:
- All application files from `/opt/dashboard`
- Docker containers and volumes
- Nginx configuration
- All data (irreversible)

Docker and Nginx will remain installed and can be manually removed:

```bash
# Remove Docker
sudo apt-get purge docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
sudo rm -rf /var/lib/docker

# Remove Nginx
sudo apt-get purge nginx nginx-common
```

## Support

For issues or questions:

1. Check application logs: `docker compose -f /opt/dashboard/docker-compose.yml logs`
2. Check Nginx logs: `/var/log/nginx/dashboard_*.log`
3. Review this troubleshooting guide
4. Open issue on GitHub repository

## Architecture

```
┌─────────────────────────────────────────────┐
│                                             │
│  Internet / Network Users                   │
│                                             │
└────────────────┬────────────────────────────┘
                 │
                 │ HTTP (Port 80)
                 │
┌────────────────▼────────────────────────────┐
│                                             │
│  Nginx Reverse Proxy                        │
│  - SSL termination (if configured)          │
│  - Security headers                         │
│  - Request proxying                         │
│                                             │
└────────────────┬────────────────────────────┘
                 │
                 │ HTTP (127.0.0.1:5000)
                 │
┌────────────────▼────────────────────────────┐
│                                             │
│  Flask Application (Docker Container)       │
│  - User authentication                      │
│  - Dashboard management                     │
│  - API endpoints                            │
│  - Session handling                         │
│                                             │
└────────────────┬────────────────────────────┘
                 │
                 │ PostgreSQL Protocol
                 │
┌────────────────▼────────────────────────────┐
│                                             │
│  PostgreSQL Database (Docker Container)     │
│  - User accounts                            │
│  - Dashboard items                          │
│  - Usage tracking                           │
│  - Password history                         │
│                                             │
└─────────────────────────────────────────────┘
```

## File Locations

| Path | Description |
|------|-------------|
| `/opt/dashboard/` | Main application directory |
| `/opt/dashboard/.env` | Production environment configuration |
| `/opt/dashboard/docker-compose.yml` | Container orchestration |
| `/opt/dashboard/app/` | Application source code |
| `/opt/dashboard/scripts/` | Database initialization scripts |
| `/etc/nginx/sites-available/dashboard` | Nginx site configuration |
| `/etc/nginx/sites-enabled/dashboard` | Nginx enabled site symlink |
| `/var/log/nginx/dashboard_*.log` | Nginx access and error logs |
| `/var/lib/docker/volumes/` | Docker volume data (PostgreSQL) |

## Updates and Maintenance

### Regular Updates

It is recommended to update the application regularly to receive:
- Security patches
- Bug fixes
- New features
- Performance improvements

Run updates during maintenance windows to minimize user impact.

### Maintenance Commands

```bash
# Update application
sudo ./install.sh  # Select option 2

# View running containers
docker compose -f /opt/dashboard/docker-compose.yml ps

# View resource usage
docker compose -f /opt/dashboard/docker-compose.yml stats

# View database size
docker compose -f /opt/dashboard/docker-compose.yml exec db psql -U dashboard -c "SELECT pg_size_pretty(pg_database_size('dashboard'));"

# Clean up old Docker images
docker image prune -a
```

## License

See LICENSE file in the repository.
