# Dashboard Application

Custom user dashboard application that allows admins to manage users and assign dashboard items (tools at URLs). Users see a personalized dashboard of assigned tools that open either in an iframe viewer or a new browser window. Includes usage tracking and analytics.

## Features

- **User Management**: Admin interface to create, edit, and delete users
- **Dashboard Items**: Manage tools with URLs, icons, and descriptions
- **Assignment System**: Assign specific dashboard items to individual users
- **Dual View Modes**: Open tools in iframe viewer or new browser window
- **Usage Tracking**: Track clicks, session duration, and user activity
- **Analytics Dashboard**: Visualize usage statistics with charts
- **Theme Support**: Light and dark mode with persistent preferences
- **Session-based Authentication**: Secure login with bcrypt password hashing
- **Responsive Design**: Material Design 3 with slate-cyan color palette

## Technology Stack

- **Backend**: Python 3.11 + Flask 3.0.0
- **Database**: PostgreSQL 16 (in Docker container)
- **Frontend**: Vanilla JavaScript, HTML5, CSS3 (no frameworks)
- **Deployment**: Docker + Docker Compose
- **UI**: Material Design 3 with slate-cyan color palette
- **Auth**: Session-based with bcrypt (cost factor 12)

## Quick Start

### Production Installation (Ubuntu 24 Server)

**One-line install:**

```bash
curl -fsSL https://raw.githubusercontent.com/YOUR_USERNAME/dashboard/main/install.sh | sudo bash
```

Replace `YOUR_USERNAME/dashboard` with your actual GitHub repository path.

The installation script provides:
- ✅ Clean installation with Docker and Nginx setup
- ✅ Update from GitHub with automatic backup
- ✅ Complete removal with cleanup

**See [INSTALL.md](INSTALL.md) for complete production deployment guide.**

### Development Setup

**Prerequisites:**
- Docker and Docker Compose installed
- Port 5000-5100 available

**Start application:**

```bash
# Clone repository
git clone https://github.com/YOUR_USERNAME/dashboard.git
cd dashboard

# Start containers (builds on first run)
docker-compose up -d

# View logs
docker-compose logs -f

# Access application
open http://localhost:5000
```

**Default credentials:**
- Username: `admin`
- Password: `admin`

You will be forced to change the password on first login.

## Project Structure

```
dashboard/
├── app/
│   ├── main.py              # Flask application and routes
│   ├── database.py          # DatabaseManager with connection pooling
│   ├── auth.py              # Authentication decorators and bcrypt
│   ├── static/
│   │   ├── css/style.css    # Material Design 3 styling
│   │   └── js/
│   │       ├── theme.js     # ThemeManager (light/dark mode)
│   │       ├── keyboard.js  # KeyboardManager (shortcuts)
│   │       ├── dashboard.js # User dashboard grid
│   │       └── admin-*.js   # Admin CRUD interfaces
│   └── templates/           # Jinja2 HTML templates
├── scripts/
│   └── init_db.sql         # Database schema and seed data
├── docker-compose.yml      # Multi-container orchestration
├── Dockerfile              # Python 3.11 + dependencies
├── requirements.txt        # Python packages
├── install.sh             # Ubuntu 24 production installer
├── INSTALL.md             # Production installation guide
├── .env.example           # Environment variables template
└── README.md              # This file
```

## Development

### Running Locally

```bash
# Start application
docker-compose up -d

# View logs
docker-compose logs -f app

# Restart after code changes
docker-compose restart app

# Stop application
docker-compose down
```

### Database Operations

```bash
# Access PostgreSQL shell
docker-compose exec db psql -U dashboard

# Run SQL query
docker-compose exec db psql -U dashboard -d dashboard -c "SELECT * FROM users;"

# Create backup
docker-compose exec db pg_dump -U dashboard dashboard > backup.sql

# Restore backup
docker-compose exec -T db psql -U dashboard dashboard < backup.sql

# Reset database (destroys all data)
docker-compose down -v
docker-compose up -d
```

### Environment Variables

Copy `.env.example` to `.env` and customize:

```bash
# Flask configuration
FLASK_ENV=development
FLASK_DEBUG=1
SECRET_KEY=dev-secret-key-change-in-production

# Database configuration
POSTGRES_USER=dashboard
POSTGRES_PASSWORD=dashboardpass
POSTGRES_DB=dashboard

# Port configuration
PORT=5000-5100

# Volume configuration
APP_VOLUME=./app
```

## Database Schema

- **users** - User accounts with admin flag and password hashes
- **dashboard_items** - Available tools with URL, icon, description
- **user_items** - Many-to-many assignment of items to users
- **usage_tracking** - Click tracking with session duration
- **password_change_history** - Audit log for password changes

See `scripts/init_db.sql` for complete schema.

## API Endpoints

### Authentication
- `POST /api/auth/login` - User login
- `POST /api/auth/logout` - User logout
- `POST /api/auth/change-password` - Change password

### Dashboard
- `GET /api/dashboard/items` - Get user's assigned items
- `POST /api/usage/start` - Start usage tracking session
- `POST /api/usage/end` - End usage tracking session

### Admin
- `GET /api/admin/users` - List all users
- `POST /api/admin/users` - Create user
- `PUT /api/admin/users/<id>` - Update user
- `DELETE /api/admin/users/<id>` - Delete user
- `GET /api/admin/items` - List dashboard items
- `POST /api/admin/items` - Create dashboard item
- `PUT /api/admin/items/<id>` - Update dashboard item
- `DELETE /api/admin/items/<id>` - Delete dashboard item
- `GET /api/admin/users/<id>/items` - Get user's assigned items
- `PUT /api/admin/users/<id>/items` - Update user's items
- `GET /api/admin/analytics` - Get usage analytics

## Security Features

- **Password Hashing**: bcrypt with cost factor 12
- **Session Management**: Secure session cookies with HTTPOnly flag
- **CSRF Protection**: SameSite cookie attribute
- **Forced Password Change**: Default admin password must be changed
- **Admin Authorization**: Decorator-based route protection
- **No-cache Headers**: Prevents sensitive data caching
- **SQL Injection Protection**: Parameterized queries with psycopg2

## Production Deployment

For production deployment on Ubuntu 24 Server:

1. **Use the installation script** (recommended):
   ```bash
   curl -fsSL https://raw.githubusercontent.com/YOUR_USERNAME/dashboard/main/install.sh | sudo bash
   ```

2. **Manual setup** - see [INSTALL.md](INSTALL.md) for detailed instructions

3. **Enable HTTPS** with Let's Encrypt:
   ```bash
   sudo apt-get install certbot python3-certbot-nginx
   sudo certbot --nginx -d your-domain.com
   ```

4. **Configure firewall**:
   ```bash
   sudo ufw allow 22/tcp   # SSH
   sudo ufw allow 80/tcp   # HTTP
   sudo ufw allow 443/tcp  # HTTPS
   sudo ufw enable
   ```

## Screenshots

*Coming soon*

## Contributing

1. Fork the repository
2. Create feature branch (`git checkout -b feature/amazing-feature`)
3. Commit changes (`git commit -m 'feat: add amazing feature'`)
4. Push to branch (`git push origin feature/amazing-feature`)
5. Open pull request

## License

This project is licensed under the MIT License - see LICENSE file for details.

## Acknowledgments

- Material Design 3 for UI design system
- Flask for web framework
- PostgreSQL for database
- Docker for containerization
- Chart.js for analytics visualizations
