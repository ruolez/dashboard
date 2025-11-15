#!/bin/bash

################################################################################
# Dashboard Application - Ubuntu 24 Server Installation Script
# Supports: Clean Install | Update from GitHub | Complete Removal
################################################################################

set -e  # Exit on error

# Color codes for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
APP_NAME="dashboard"
APP_DIR="/opt/${APP_NAME}"
GITHUB_REPO="https://github.com/ruolez/dashboard.git"
NGINX_CONF="/etc/nginx/sites-available/${APP_NAME}"
NGINX_ENABLED="/etc/nginx/sites-enabled/${APP_NAME}"
COMPOSE_FILE="${APP_DIR}/docker-compose.yml"
ENV_FILE="${APP_DIR}/.env"

################################################################################
# Helper Functions
################################################################################

print_header() {
    echo -e "${BLUE}═══════════════════════════════════════════════════════════${NC}"
    echo -e "${BLUE}  $1${NC}"
    echo -e "${BLUE}═══════════════════════════════════════════════════════════${NC}"
}

print_success() {
    echo -e "${GREEN}✓ $1${NC}"
}

print_error() {
    echo -e "${RED}✗ $1${NC}"
}

print_warning() {
    echo -e "${YELLOW}⚠ $1${NC}"
}

print_info() {
    echo -e "${BLUE}ℹ $1${NC}"
}

# Check if running as root
check_root() {
    if [[ $EUID -ne 0 ]]; then
        print_error "This script must be run as root (use sudo)"
        exit 1
    fi
}

# Detect server IP address
detect_ip() {
    local ip=$(ip route get 8.8.8.8 | awk '{print $7; exit}')
    if [[ -z "$ip" ]]; then
        ip=$(hostname -I | awk '{print $1}')
    fi
    echo "$ip"
}

# Prompt for IP confirmation
get_server_ip() {
    local detected_ip=$(detect_ip)
    echo "" >&2
    print_info "Detected IP address: ${detected_ip}" >&2
    read -p "Is this correct? (y/n): " confirm

    if [[ "$confirm" =~ ^[Yy]$ ]]; then
        echo "$detected_ip"
    else
        read -p "Enter server IP address: " custom_ip
        # Basic IP validation
        if [[ $custom_ip =~ ^[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}$ ]]; then
            echo "$custom_ip"
        else
            print_error "Invalid IP address format" >&2
            exit 1
        fi
    fi
}

# Install Docker if not present
install_docker() {
    if command -v docker &> /dev/null; then
        print_success "Docker already installed"
        return 0
    fi

    print_info "Installing Docker..."

    # Update package index
    apt-get update -qq

    # Install prerequisites
    apt-get install -y -qq \
        ca-certificates \
        curl \
        gnupg \
        lsb-release

    # Add Docker's official GPG key
    install -m 0755 -d /etc/apt/keyrings
    curl -fsSL https://download.docker.com/linux/ubuntu/gpg | gpg --dearmor -o /etc/apt/keyrings/docker.gpg
    chmod a+r /etc/apt/keyrings/docker.gpg

    # Set up repository
    echo \
      "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu \
      $(lsb_release -cs) stable" | tee /etc/apt/sources.list.d/docker.list > /dev/null

    # Install Docker Engine
    apt-get update -qq
    apt-get install -y -qq docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin

    # Start and enable Docker
    systemctl start docker
    systemctl enable docker

    print_success "Docker installed successfully"
}

# Install nginx if not present
install_nginx() {
    if command -v nginx &> /dev/null; then
        print_success "Nginx already installed"
    else
        print_info "Installing Nginx..."
        apt-get update -qq
        apt-get install -y -qq nginx
        systemctl start nginx
        systemctl enable nginx
        print_success "Nginx installed successfully"
    fi

    # Ensure curl is installed for health checks
    if ! command -v curl &> /dev/null; then
        print_info "Installing curl..."
        apt-get install -y -qq curl
    fi
}

# Configure nginx reverse proxy
configure_nginx() {
    local server_ip=$1

    print_info "Configuring Nginx reverse proxy..."

    # Detect which port the app will use (from docker-compose.yml or default)
    local app_port=5000
    if [[ -f "${COMPOSE_FILE}" ]]; then
        # Extract port from docker-compose.yml if exists
        local port_line=$(grep -A 5 "ports:" "${COMPOSE_FILE}" 2>/dev/null | grep -o '127.0.0.1:[0-9]*' 2>/dev/null | cut -d: -f2 | head -1)
        if [[ -n "$port_line" ]] && [[ "$port_line" =~ ^[0-9]+$ ]]; then
            app_port=$port_line
        fi
    fi

    # Create nginx configuration (redirect stderr to avoid contamination)
    cat > "${NGINX_CONF}" 2>/dev/null <<EOF
server {
    listen 80;
    server_name ${server_ip};

    # Security headers
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-XSS-Protection "1; mode=block" always;

    # Logging
    access_log /var/log/nginx/${APP_NAME}_access.log;
    error_log /var/log/nginx/${APP_NAME}_error.log;

    # Client settings
    client_max_body_size 50M;

    # Proxy settings
    location / {
        proxy_pass http://127.0.0.1:${app_port};
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host \$host;
        proxy_cache_bypass \$http_upgrade;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;

        # Timeouts
        proxy_connect_timeout 60s;
        proxy_send_timeout 60s;
        proxy_read_timeout 60s;
    }
}
EOF

    # Enable site
    ln -sf "${NGINX_CONF}" "${NGINX_ENABLED}"

    # Remove default site
    rm -f /etc/nginx/sites-enabled/default

    # Test nginx configuration
    if nginx -t 2>&1 | grep -q "syntax is ok"; then
        systemctl reload nginx
        print_success "Nginx configured successfully"
    else
        print_error "Nginx configuration test failed"
        echo ""
        print_warning "Generated nginx config:"
        cat "${NGINX_CONF}"
        echo ""
        print_error "Nginx test output:"
        nginx -t
        exit 1
    fi
}

# Create production environment file
create_env_file() {
    local server_ip=$1

    print_info "Creating production environment configuration..."

    cat > "${ENV_FILE}" <<EOF
# Production Environment Configuration
FLASK_ENV=production
FLASK_DEBUG=0
SECRET_KEY=$(openssl rand -hex 32)

# Database Configuration
POSTGRES_USER=dashboard
POSTGRES_PASSWORD=$(openssl rand -base64 32)
POSTGRES_DB=dashboard

# Server Configuration
SERVER_IP=${server_ip}
PORT=127.0.0.1:5000

# Session Configuration
SESSION_COOKIE_SECURE=False
SESSION_COOKIE_HTTPONLY=True
SESSION_COOKIE_SAMESITE=Lax
PERMANENT_SESSION_LIFETIME=3600
EOF

    chmod 600 "${ENV_FILE}"
    print_success "Environment file created"
}

# Update docker-compose.yml for production
update_docker_compose() {
    print_info "Configuring Docker Compose for production..."

    # Docker Compose will read environment variables from .env file
    # No modifications needed - configuration is handled via .env

    print_success "Docker Compose configured for production"
}

################################################################################
# Installation Functions
################################################################################

clean_install() {
    print_header "CLEAN INSTALLATION"

    # Get configuration
    SERVER_IP=$(get_server_ip)

    print_info "Installing to: ${APP_DIR}"
    print_info "Server IP: ${SERVER_IP}"
    print_info "GitHub Repo: ${GITHUB_REPO}"
    echo ""

    # Install dependencies
    print_header "Installing Dependencies"
    install_docker
    install_nginx

    # Clone repository
    print_header "Cloning Repository"
    if [[ -d "${APP_DIR}" ]]; then
        print_warning "Directory ${APP_DIR} already exists. Removing..."
        rm -rf "${APP_DIR}"
    fi

    mkdir -p "$(dirname ${APP_DIR})"
    git clone "${GITHUB_REPO}" "${APP_DIR}"
    cd "${APP_DIR}"
    print_success "Repository cloned"

    # Create production configuration
    print_header "Configuring Production Environment"
    create_env_file "${SERVER_IP}"
    update_docker_compose
    configure_nginx "${SERVER_IP}"

    # Build and start containers
    print_header "Building and Starting Application"
    cd "${APP_DIR}"
    docker compose down -v 2>/dev/null || true
    docker compose build --no-cache
    docker compose up -d

    # Wait for database to be ready
    print_info "Waiting for database to be ready..."
    local max_attempts=30
    local attempt=0
    while [ $attempt -lt $max_attempts ]; do
        if docker compose exec -T db pg_isready -U dashboard &>/dev/null; then
            print_success "Database is ready"
            break
        fi
        attempt=$((attempt + 1))
        sleep 1
    done

    if [ $attempt -eq $max_attempts ]; then
        print_error "Database failed to start"
        docker compose logs db
        exit 1
    fi

    # Wait for Flask app to be ready
    print_info "Waiting for Flask application to start..."
    sleep 5

    max_attempts=30
    attempt=0
    while [ $attempt -lt $max_attempts ]; do
        if curl -s http://127.0.0.1:5000 &>/dev/null; then
            print_success "Application is responding"
            break
        fi
        attempt=$((attempt + 1))
        sleep 1
    done

    if [ $attempt -eq $max_attempts ]; then
        print_error "Application failed to start"
        echo ""
        print_warning "Application logs:"
        docker compose logs app
        exit 1
    fi

    # Final container check
    if docker compose ps | grep -q "Up"; then
        print_success "All services running"
    else
        print_error "Some services failed to start"
        docker compose ps
        docker compose logs
        exit 1
    fi

    # Final status
    print_header "INSTALLATION COMPLETE"
    print_success "Dashboard is now running"
    echo ""
    print_info "Access URL: http://${SERVER_IP}"
    print_info "Default credentials: admin / admin"
    print_warning "Please change the default password immediately"
    echo ""
    print_info "Useful commands:"
    echo "  - View logs: docker compose -f ${COMPOSE_FILE} logs -f"
    echo "  - Restart: docker compose -f ${COMPOSE_FILE} restart"
    echo "  - Stop: docker compose -f ${COMPOSE_FILE} down"
    echo "  - Update: sudo $(readlink -f $0) (select option 2)"
    echo ""
}

update_from_github() {
    print_header "UPDATE FROM GITHUB"

    # Check if installation exists
    if [[ ! -d "${APP_DIR}" ]]; then
        print_error "Installation not found at ${APP_DIR}"
        print_info "Please run clean install first (option 1)"
        exit 1
    fi

    print_info "Repository: ${GITHUB_REPO}"
    echo ""

    # Backup current installation
    print_header "Backing Up Current Installation"
    BACKUP_DIR="${APP_DIR}_backup_$(date +%Y%m%d_%H%M%S)"

    # Backup data volume
    cd "${APP_DIR}"
    if docker compose ps | grep -q "Up"; then
        print_info "Creating database backup..."
        docker compose exec -T db pg_dump -U dashboard dashboard > "${APP_DIR}/backup.sql" 2>/dev/null || true
    fi

    # Copy current installation
    cp -r "${APP_DIR}" "${BACKUP_DIR}"
    print_success "Backup created: ${BACKUP_DIR}"

    # Stop containers
    print_header "Stopping Application"
    cd "${APP_DIR}"
    docker compose down
    print_success "Application stopped"

    # Update code
    print_header "Updating Code from GitHub"
    cd "${APP_DIR}"

    # Stash any local changes
    git stash

    # Pull latest changes
    git pull origin main || git pull origin master
    print_success "Code updated"

    # Preserve environment file
    if [[ -f "${BACKUP_DIR}/.env" ]]; then
        cp "${BACKUP_DIR}/.env" "${APP_DIR}/.env"
        print_success "Environment file preserved"
    fi

    # Rebuild and restart
    print_header "Rebuilding and Restarting Application"
    docker compose build --no-cache
    docker compose up -d

    # Wait for services
    print_info "Waiting for services to start..."
    sleep 10

    # Restore database if backup exists
    if [[ -f "${APP_DIR}/backup.sql" ]]; then
        print_info "Restoring database..."
        docker compose exec -T db psql -U dashboard dashboard < "${APP_DIR}/backup.sql" 2>/dev/null || true
        rm -f "${APP_DIR}/backup.sql"
    fi

    # Check status
    if docker compose ps | grep -q "Up"; then
        print_success "Update completed successfully"

        # Get server IP
        if [[ -f "${ENV_FILE}" ]]; then
            SERVER_IP=$(grep "SERVER_IP=" "${ENV_FILE}" | cut -d'=' -f2)
        else
            SERVER_IP=$(detect_ip)
        fi

        print_header "UPDATE COMPLETE"
        print_info "Access URL: http://${SERVER_IP}"
        print_info "Backup location: ${BACKUP_DIR}"
        echo ""
    else
        print_error "Update failed - containers not running"
        print_warning "Restoring from backup..."

        docker compose down -v
        rm -rf "${APP_DIR}"
        mv "${BACKUP_DIR}" "${APP_DIR}"
        cd "${APP_DIR}"
        docker compose up -d

        print_error "Update rolled back to previous version"
        exit 1
    fi
}

remove_installation() {
    print_header "REMOVE INSTALLATION"

    if [[ ! -d "${APP_DIR}" ]]; then
        print_warning "Installation not found at ${APP_DIR}"
        return 0
    fi

    print_warning "This will remove:"
    echo "  - Application files: ${APP_DIR}"
    echo "  - Docker containers and volumes"
    echo "  - Nginx configuration"
    echo "  - All data (databases, uploads, etc.)"
    echo ""

    read -p "Are you sure you want to continue? (yes/no): " confirm
    if [[ "$confirm" != "yes" ]]; then
        print_warning "Removal cancelled"
        exit 0
    fi

    # Stop and remove containers
    print_header "Removing Docker Containers"
    if [[ -f "${COMPOSE_FILE}" ]]; then
        cd "${APP_DIR}"
        docker compose down -v
        print_success "Containers removed"
    fi

    # Remove application directory
    print_header "Removing Application Files"
    rm -rf "${APP_DIR}"
    print_success "Application files removed"

    # Remove nginx configuration
    print_header "Removing Nginx Configuration"
    rm -f "${NGINX_CONF}"
    rm -f "${NGINX_ENABLED}"
    systemctl reload nginx 2>/dev/null || true
    print_success "Nginx configuration removed"

    print_header "REMOVAL COMPLETE"
    print_success "Dashboard has been completely removed"
    echo ""
    print_info "Docker and Nginx remain installed for other applications"
    print_info "To remove Docker: apt-get purge docker-ce docker-ce-cli containerd.io"
    print_info "To remove Nginx: apt-get purge nginx"
    echo ""
}

################################################################################
# Main Menu
################################################################################

show_menu() {
    clear
    print_header "DASHBOARD APPLICATION INSTALLER"
    echo ""
    echo "Please select an option:"
    echo ""
    echo "  1) Clean Install"
    echo "  2) Update from GitHub"
    echo "  3) Remove Installation"
    echo "  4) Exit"
    echo ""
}

main() {
    check_root

    while true; do
        show_menu
        read -p "Enter your choice [1-4]: " choice

        case $choice in
            1)
                clean_install
                read -p "Press Enter to continue..."
                ;;
            2)
                update_from_github
                read -p "Press Enter to continue..."
                ;;
            3)
                remove_installation
                read -p "Press Enter to continue..."
                ;;
            4)
                print_info "Exiting..."
                exit 0
                ;;
            *)
                print_error "Invalid option. Please try again."
                sleep 2
                ;;
        esac
    done
}

# Run main menu
main
