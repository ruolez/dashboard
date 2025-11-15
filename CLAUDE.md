# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Custom user dashboard application that allows admins to manage users and assign dashboard items (tools at URLs). Users see a personalized dashboard of assigned tools that open either in an iframe viewer or a new browser window. Includes usage tracking and analytics.

**Tech Stack:**
- Backend: Python 3.11 + Flask 3.0.0
- Database: PostgreSQL 16 (in Docker container)
- Frontend: Vanilla JavaScript, HTML5, CSS3 (no frameworks)
- Deployment: Docker + Docker Compose
- UI: Material Design 3 with slate-cyan color palette
- Auth: Session-based with bcrypt (cost factor 12)

**Port:** Auto-detects available port in range 5000-5100

## Running the Application

```bash
# Start application (builds on first run)
docker-compose up -d

# View logs
docker-compose logs -f app

# Restart after code changes
docker-compose restart app

# Stop application
docker-compose down

# Check which port is being used
docker-compose ps
```

**Default Credentials:** admin/admin (forces password change on first login)

**Important:** All responses use no-cache headers for instant updates during development.

## Database Operations

```bash
# Access PostgreSQL shell
docker-compose exec db psql -U dashboard -d dashboard

# Run SQL migrations manually
docker-compose exec db psql -U dashboard -d dashboard -c "ALTER TABLE ..."

# Reset database (destroys all data)
docker-compose down -v
docker-compose up -d
```

**Database Schema Location:** `scripts/init_db.sql` (runs automatically on first startup)

**Tables:**
- `users` - User accounts with admin flag
- `dashboard_items` - Available tools with URL, icon, description
- `user_items` - Many-to-many assignment of items to users
- `usage_tracking` - Click tracking with session duration
- `password_change_history` - Audit log

## Architecture

### Backend (`app/main.py`)

Single Flask application file with all routes (~650 lines). Uses decorator-based authentication (`@login_required`, `@admin_required`).

**Route Categories:**
- `/` - Redirects to dashboard or login
- `/login`, `/logout`, `/change-password` - Authentication flows
- `/dashboard` - User dashboard page
- `/tool/<id>` - Iframe viewer with persistent navigation bar
- `/admin/*` - Admin pages (users, items, analytics)
- `/api/auth/*` - Authentication API
- `/api/dashboard/*` - User dashboard data
- `/api/usage/*` - Usage tracking (start/end session)
- `/api/admin/*` - Admin CRUD operations

### Database Layer (`app/database.py`)

**DatabaseManager class** with connection pooling (SimpleConnectionPool):
- `execute_query(query, params, fetch=True)` - Returns list of dicts
- `execute_one(query, params)` - Returns single dict or None
- `execute_insert(query, params)` - Returns inserted row with RETURNING clause

All queries use **RealDictCursor** to return dictionaries, not tuples.

**Connection handling:** Automatically gets from pool, handles errors with rollback, returns to pool in finally block.

### Authentication (`app/auth.py`)

**Functions:**
- `hash_password(password)` - bcrypt with rounds=12
- `verify_password(password, hash)` - bcrypt comparison
- `login_required` - Decorator for authenticated routes
- `admin_required` - Decorator for admin-only routes
- `get_current_user()` - Returns session user info

**Session keys:** `user_id`, `username`, `is_admin`, `must_change_password`

### Frontend Architecture

**No build step, no bundlers, no frameworks.** Vanilla JavaScript with modern async/await.

**File organization:**
- `app/static/js/theme.js` - ThemeManager class (light/dark mode with localStorage)
- `app/static/js/keyboard.js` - KeyboardManager class (global shortcuts)
- `app/static/js/dashboard.js` - User dashboard with item grid
- `app/static/js/admin-users.js` - User management CRUD
- `app/static/js/admin-items.js` - Dashboard item management CRUD
- `app/static/js/admin-analytics.js` - Usage analytics with Chart.js

**Global instances:** `themeManager` and `keyboardManager` are created in their respective files and used across all pages.

**Styling:** Single CSS file `app/static/css/style.css` (~3000 lines) with CSS custom properties for theming.

### Usage Tracking

**Beacon API** for reliable tracking on page unload:
```javascript
navigator.sendBeacon('/api/usage/end', JSON.stringify({ session_id }));
```

**Events tracked:**
- Page visibility changes (visibilitychange)
- Page unload (beforeunload)
- Page hide for mobile (pagehide)

**Session timer** displayed in tool viewer showing elapsed time (HH:MM:SS).

### Dashboard Item Behavior

Dashboard items have `open_in_new_window` boolean flag:
- `false` - Opens in iframe viewer (`/tool/<id>`) with persistent top bar and session timer
- `true` - Opens URL directly in new browser window (`window.open(url, '_blank')`)

This is controlled via checkbox in admin items form.

## Development Workflow

### Making Changes

1. **Python changes:** Edit files in `app/`, then `docker-compose restart app`
2. **Frontend changes:** Edit files in `app/static/` or `app/templates/`, hard refresh browser (Cmd+Shift+R / Ctrl+Shift+F5)
3. **Database schema:** Edit `scripts/init_db.sql` for new deployments, run manual ALTER statements for existing databases

**Volume mounting:** `./app:/app/app` enables live code updates without rebuilding container.

### Adding New Routes

1. Add route function in `app/main.py`
2. Apply decorator: `@login_required` or `@admin_required`
3. Use `db.execute_query()`, `db.execute_one()`, or `db.execute_insert()`
4. Return JSON for API routes: `return jsonify(data), status_code`
5. Return HTML for page routes: `return render_template('page.html', **context)`

### Adding New Database Tables

1. Add CREATE TABLE to `scripts/init_db.sql`
2. Add indexes for foreign keys and frequently queried columns
3. For existing databases, run ALTER statements manually via psql

### CSS Variables

Theme colors defined in `:root`:
```css
--primary: #0891b2;        /* Cyan-600 */
--primary-hover: #0e7490;  /* Cyan-700 */
--primary-light: #cffafe;  /* Cyan-100 */
--surface: #ffffff;
--background: #f8fafc;
--text-primary: #0f172a;
--text-secondary: #64748b;
--outline: #e2e8f0;
```

Dark mode overrides in `[data-theme="dark"]` selector.

### Toast Notifications

```javascript
showToast(message, type) // type: 'success', 'error', 'info'
```

Positioned at bottom center with bounce-in animation. Auto-dismisses after 3 seconds.

## Key Implementation Details

### Password Changes

Users with `must_change_password=true` are redirected to `/change-password` after login. First-time admin users must change from default password.

### Emoji Picker

Admin items form includes 80+ pre-selected office-appropriate emojis. Click to select. Includes barcode representation using Unicode musical notation symbols: `𝄃𝄃𝄂𝄂𝄀𝄁𝄃𝄂𝄂𝄃`

### Analytics Dashboard

Uses Chart.js (loaded from CDN) to display:
- Total clicks, unique users, total time
- Top 10 tools by clicks (bar chart)
- User activity breakdown (pie chart)
- Recent usage table with pagination

### No Caching Strategy

All routes set headers:
```python
response.headers['Cache-Control'] = 'no-store, no-cache, must-revalidate, max-age=0'
response.headers['Pragma'] = 'no-cache'
response.headers['Expires'] = '0'
```

This ensures instant updates during development when files change.

### Theme System

`ThemeManager` class manages light/dark mode:
- Persists preference to localStorage
- Sets `data-theme` attribute on `<html>` element
- Provides `toggle()` and `setTheme(theme)` methods
- Auto-initializes from saved preference or defaults to light

## Common Pitfalls

1. **Modal not closing:** Don't use `display: none !important` in CSS, JavaScript can't override it
2. **Port conflicts:** Check `docker-compose ps` to see which port in range 5000-5100 was allocated
3. **Database locked:** Connection pool handles this, but manual psql commands can block
4. **Form submission:** Always `preventDefault()` and handle with fetch API
5. **Checkbox values:** Use `.checked` property, not `.value`
6. **Iframe security:** Some sites block embedding with X-Frame-Options - offer "Open in new window" option
7. **Session logout:** Must clear Flask session on backend, localStorage clearing alone doesn't work

## File Structure

```
dashboard/
├── app/
│   ├── main.py              # All Flask routes and logic
│   ├── database.py          # DatabaseManager with connection pooling
│   ├── auth.py              # Authentication decorators and bcrypt
│   ├── static/
│   │   ├── css/style.css    # All styling (Material Design 3)
│   │   └── js/
│   │       ├── theme.js     # ThemeManager (light/dark mode)
│   │       ├── keyboard.js  # KeyboardManager (shortcuts)
│   │       ├── dashboard.js # User dashboard grid
│   │       ├── admin-*.js   # Admin CRUD interfaces
│   └── templates/           # Jinja2 HTML templates
├── scripts/
│   └── init_db.sql         # Database schema and seed data
├── docker-compose.yml      # Multi-container orchestration
├── Dockerfile              # Python 3.11 + dependencies
└── requirements.txt        # Python packages
```

**Note:** `theme/` directory contains original design templates - not used by running application.
