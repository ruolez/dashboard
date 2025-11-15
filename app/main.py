"""Main Flask application with all routes and API endpoints"""

import os
from datetime import datetime
from flask import (
    Flask,
    render_template,
    request,
    jsonify,
    session,
    redirect,
    url_for,
)
from app.database import DatabaseManager
from app.auth import (
    hash_password,
    verify_password,
    login_required,
    admin_required,
    get_current_user,
)

# Initialize Flask app
app = Flask(__name__)
app.secret_key = os.getenv('SECRET_KEY', 'dev-secret-key')

# Initialize database
DATABASE_URL = os.getenv('DATABASE_URL', 'postgresql://dashboard:dashboardpass@db:5432/dashboard')
db = DatabaseManager(DATABASE_URL)
db.initialize_pool()

# Disable caching for instant updates
@app.after_request
def add_no_cache_headers(response):
    """Add no-cache headers to all responses"""
    response.headers['Cache-Control'] = 'no-store, no-cache, must-revalidate, max-age=0'
    response.headers['Pragma'] = 'no-cache'
    response.headers['Expires'] = '0'
    return response


# ============================================================================
# Authentication Routes
# ============================================================================


@app.route('/login', methods=['GET', 'POST'])
def login():
    """Login page"""
    if request.method == 'POST':
        data = request.get_json()
        username = data.get('username', '').strip()
        password = data.get('password', '')

        if not username or not password:
            return jsonify({'error': 'Username and password required'}), 400

        # Get user from database
        user = db.execute_one(
            'SELECT * FROM users WHERE username = %s', (username,)
        )

        if not user or not verify_password(password, user['password_hash']):
            return jsonify({'error': 'Invalid username or password'}), 401

        # Set session
        session['user_id'] = user['id']
        session['username'] = user['username']
        session['is_admin'] = user['is_admin']
        session['must_change_password'] = user['must_change_password']

        # Update last login
        db.execute_query(
            'UPDATE users SET last_login = NOW() WHERE id = %s',
            (user['id'],),
            fetch=False,
        )

        # Determine redirect
        if user['must_change_password']:
            return jsonify({'redirect': '/change-password'})
        elif user['is_admin']:
            return jsonify({'redirect': '/admin/users'})
        else:
            return jsonify({'redirect': '/dashboard'})

    return render_template('login.html')


@app.route('/logout')
def logout():
    """Logout and clear session"""
    session.clear()
    return redirect(url_for('login'))


@app.route('/change-password', methods=['GET', 'POST'])
@login_required
def change_password():
    """Change password page"""
    if request.method == 'POST':
        data = request.get_json()
        current_password = data.get('current_password', '')
        new_password = data.get('new_password', '')
        confirm_password = data.get('confirm_password', '')

        if not all([current_password, new_password, confirm_password]):
            return jsonify({'error': 'All fields required'}), 400

        if new_password != confirm_password:
            return jsonify({'error': 'New passwords do not match'}), 400

        if len(new_password) < 6:
            return jsonify({'error': 'Password must be at least 6 characters'}), 400

        # Get current user
        user = db.execute_one(
            'SELECT * FROM users WHERE id = %s', (session['user_id'],)
        )

        if not verify_password(current_password, user['password_hash']):
            return jsonify({'error': 'Current password incorrect'}), 401

        # Update password
        new_hash = hash_password(new_password)
        db.execute_query(
            'UPDATE users SET password_hash = %s, must_change_password = FALSE WHERE id = %s',
            (new_hash, session['user_id']),
            fetch=False,
        )

        # Log password change
        db.execute_query(
            'INSERT INTO password_change_history (user_id, changed_by) VALUES (%s, %s)',
            (session['user_id'], session['user_id']),
            fetch=False,
        )

        session['must_change_password'] = False

        # Redirect based on role
        redirect_url = '/admin/users' if session.get('is_admin') else '/dashboard'
        return jsonify({'redirect': redirect_url})

    return render_template('change_password.html')


# ============================================================================
# User Dashboard Routes
# ============================================================================


@app.route('/')
@login_required
def index():
    """Redirect to appropriate dashboard"""
    if session.get('must_change_password'):
        return redirect(url_for('change_password'))
    if session.get('is_admin'):
        return redirect(url_for('admin_users'))
    return redirect(url_for('dashboard'))


@app.route('/dashboard')
@login_required
def dashboard():
    """User dashboard page"""
    if session.get('must_change_password'):
        return redirect(url_for('change_password'))
    return render_template('dashboard.html')


@app.route('/tool/<int:item_id>')
@login_required
def tool_viewer(item_id):
    """Tool viewer page with iframe"""
    if session.get('must_change_password'):
        return redirect(url_for('change_password'))

    # Verify user has access to this item
    user_item = db.execute_one(
        '''SELECT di.* FROM dashboard_items di
           JOIN user_items ui ON di.id = ui.item_id
           WHERE di.id = %s AND ui.user_id = %s''',
        (item_id, session['user_id']),
    )

    if not user_item:
        return "Access denied", 403

    return render_template('tool_viewer.html', item=user_item)


# ============================================================================
# Admin Routes
# ============================================================================


@app.route('/admin/users')
@admin_required
def admin_users():
    """Admin user management page"""
    return render_template('admin_users.html')


@app.route('/admin/items')
@admin_required
def admin_items():
    """Admin dashboard items page"""
    return render_template('admin_items.html')


@app.route('/admin/analytics')
@admin_required
def admin_analytics():
    """Admin analytics page"""
    return render_template('admin_analytics.html')


# ============================================================================
# API Endpoints - Authentication
# ============================================================================


@app.route('/api/auth/me')
@login_required
def api_me():
    """Get current user info"""
    return jsonify(get_current_user())


# ============================================================================
# API Endpoints - Dashboard
# ============================================================================


@app.route('/api/dashboard/items')
@login_required
def api_dashboard_items():
    """Get user's assigned dashboard items"""
    items = db.execute_query(
        '''SELECT di.*, ui.display_order
           FROM dashboard_items di
           JOIN user_items ui ON di.id = ui.item_id
           WHERE ui.user_id = %s
           ORDER BY ui.display_order, di.name''',
        (session['user_id'],),
    )
    return jsonify(items or [])


@app.route('/api/dashboard/item/<int:item_id>')
@login_required
def api_dashboard_item(item_id):
    """Get specific dashboard item"""
    item = db.execute_one(
        '''SELECT di.* FROM dashboard_items di
           JOIN user_items ui ON di.id = ui.item_id
           WHERE di.id = %s AND ui.user_id = %s''',
        (item_id, session['user_id']),
    )
    if not item:
        return jsonify({'error': 'Item not found or access denied'}), 404
    return jsonify(item)


# ============================================================================
# API Endpoints - Usage Tracking
# ============================================================================


@app.route('/api/usage/start', methods=['POST'])
@login_required
def api_usage_start():
    """Start usage tracking session"""
    data = request.get_json()
    item_id = data.get('item_id')

    if not item_id:
        return jsonify({'error': 'item_id required'}), 400

    # Insert usage record
    result = db.execute_insert(
        '''INSERT INTO usage_tracking (user_id, item_id, session_start)
           VALUES (%s, %s, NOW())
           RETURNING id''',
        (session['user_id'], item_id),
    )

    return jsonify({'session_id': result['id']})


@app.route('/api/usage/end', methods=['POST'])
@login_required
def api_usage_end():
    """End usage tracking session"""
    data = request.get_json()
    session_id = data.get('session_id')

    if not session_id:
        return jsonify({'error': 'session_id required'}), 400

    # Update usage record with end time and duration
    db.execute_query(
        '''UPDATE usage_tracking
           SET session_end = NOW(),
               duration_seconds = EXTRACT(EPOCH FROM (NOW() - session_start))::INTEGER
           WHERE id = %s AND user_id = %s''',
        (session_id, session['user_id']),
        fetch=False,
    )

    return jsonify({'success': True})


# ============================================================================
# API Endpoints - Admin Users
# ============================================================================


@app.route('/api/admin/users', methods=['GET'])
@admin_required
def api_admin_users_list():
    """Get all users"""
    users = db.execute_query(
        '''SELECT id, username, is_admin, must_change_password, created_at, last_login
           FROM users
           ORDER BY username'''
    )
    return jsonify(users or [])


@app.route('/api/admin/users', methods=['POST'])
@admin_required
def api_admin_users_create():
    """Create new user"""
    data = request.get_json()
    username = data.get('username', '').strip()
    password = data.get('password', '')
    is_admin = data.get('is_admin', False)

    if not username or not password:
        return jsonify({'error': 'Username and password required'}), 400

    if len(username) < 3:
        return jsonify({'error': 'Username must be at least 3 characters'}), 400

    if len(password) < 6:
        return jsonify({'error': 'Password must be at least 6 characters'}), 400

    try:
        password_hash = hash_password(password)
        result = db.execute_insert(
            '''INSERT INTO users (username, password_hash, is_admin, must_change_password)
               VALUES (%s, %s, %s, TRUE)
               RETURNING id, username, is_admin, created_at''',
            (username, password_hash, is_admin),
        )
        return jsonify(result), 201
    except Exception as e:
        if 'duplicate key' in str(e).lower():
            return jsonify({'error': 'Username already exists'}), 409
        return jsonify({'error': str(e)}), 500


@app.route('/api/admin/users/<int:user_id>', methods=['PUT'])
@admin_required
def api_admin_users_update(user_id):
    """Update user"""
    data = request.get_json()
    username = data.get('username', '').strip()
    is_admin = data.get('is_admin')
    new_password = data.get('new_password', '').strip()

    if not username:
        return jsonify({'error': 'Username required'}), 400

    try:
        if new_password:
            if len(new_password) < 6:
                return jsonify({'error': 'Password must be at least 6 characters'}), 400
            password_hash = hash_password(new_password)
            db.execute_query(
                '''UPDATE users
                   SET username = %s, is_admin = %s, password_hash = %s, must_change_password = TRUE
                   WHERE id = %s''',
                (username, is_admin, password_hash, user_id),
                fetch=False,
            )
            # Log password change
            db.execute_query(
                'INSERT INTO password_change_history (user_id, changed_by) VALUES (%s, %s)',
                (user_id, session['user_id']),
                fetch=False,
            )
        else:
            db.execute_query(
                'UPDATE users SET username = %s, is_admin = %s WHERE id = %s',
                (username, is_admin, user_id),
                fetch=False,
            )

        return jsonify({'success': True})
    except Exception as e:
        if 'duplicate key' in str(e).lower():
            return jsonify({'error': 'Username already exists'}), 409
        return jsonify({'error': str(e)}), 500


@app.route('/api/admin/users/<int:user_id>', methods=['DELETE'])
@admin_required
def api_admin_users_delete(user_id):
    """Delete user"""
    # Prevent deleting yourself
    if user_id == session['user_id']:
        return jsonify({'error': 'Cannot delete your own account'}), 400

    db.execute_query('DELETE FROM users WHERE id = %s', (user_id,), fetch=False)
    return jsonify({'success': True})


@app.route('/api/admin/users/<int:user_id>/items', methods=['GET'])
@admin_required
def api_admin_user_items_get(user_id):
    """Get user's assigned items"""
    items = db.execute_query(
        'SELECT item_id FROM user_items WHERE user_id = %s', (user_id,)
    )
    return jsonify([item['item_id'] for item in items] if items else [])


@app.route('/api/admin/users/<int:user_id>/items', methods=['POST'])
@admin_required
def api_admin_user_items_update(user_id):
    """Update user's assigned items"""
    data = request.get_json()
    item_ids = data.get('item_ids', [])

    # Delete existing assignments
    db.execute_query(
        'DELETE FROM user_items WHERE user_id = %s', (user_id,), fetch=False
    )

    # Insert new assignments
    for idx, item_id in enumerate(item_ids):
        db.execute_query(
            '''INSERT INTO user_items (user_id, item_id, display_order)
               VALUES (%s, %s, %s)''',
            (user_id, item_id, idx),
            fetch=False,
        )

    return jsonify({'success': True})


# ============================================================================
# API Endpoints - Admin Items
# ============================================================================


@app.route('/api/admin/items', methods=['GET'])
@admin_required
def api_admin_items_list():
    """Get all dashboard items"""
    items = db.execute_query(
        '''SELECT di.*,
           (SELECT COUNT(*) FROM user_items WHERE item_id = di.id) as user_count
           FROM dashboard_items di
           ORDER BY di.category, di.name'''
    )
    return jsonify(items or [])


@app.route('/api/admin/items', methods=['POST'])
@admin_required
def api_admin_items_create():
    """Create new dashboard item"""
    data = request.get_json()
    name = data.get('name', '').strip()
    description = data.get('description', '').strip()
    url = data.get('url', '').strip()
    icon = data.get('icon', '').strip()
    category = data.get('category', '').strip()

    if not name or not url:
        return jsonify({'error': 'Name and URL required'}), 400

    result = db.execute_insert(
        '''INSERT INTO dashboard_items (name, description, url, icon, category, created_by)
           VALUES (%s, %s, %s, %s, %s, %s)
           RETURNING *''',
        (name, description, url, icon, category, session['user_id']),
    )
    return jsonify(result), 201


@app.route('/api/admin/items/<int:item_id>', methods=['PUT'])
@admin_required
def api_admin_items_update(item_id):
    """Update dashboard item"""
    data = request.get_json()
    name = data.get('name', '').strip()
    description = data.get('description', '').strip()
    url = data.get('url', '').strip()
    icon = data.get('icon', '').strip()
    category = data.get('category', '').strip()

    if not name or not url:
        return jsonify({'error': 'Name and URL required'}), 400

    db.execute_query(
        '''UPDATE dashboard_items
           SET name = %s, description = %s, url = %s, icon = %s, category = %s
           WHERE id = %s''',
        (name, description, url, icon, category, item_id),
        fetch=False,
    )
    return jsonify({'success': True})


@app.route('/api/admin/items/<int:item_id>', methods=['DELETE'])
@admin_required
def api_admin_items_delete(item_id):
    """Delete dashboard item"""
    db.execute_query(
        'DELETE FROM dashboard_items WHERE id = %s', (item_id,), fetch=False
    )
    return jsonify({'success': True})


@app.route('/api/admin/items/<int:item_id>/users', methods=['GET'])
@admin_required
def api_admin_item_users(item_id):
    """Get users assigned to an item"""
    users = db.execute_query(
        '''SELECT u.id, u.username
           FROM users u
           JOIN user_items ui ON u.id = ui.user_id
           WHERE ui.item_id = %s
           ORDER BY u.username''',
        (item_id,),
    )
    return jsonify(users or [])


# ============================================================================
# API Endpoints - Admin Analytics
# ============================================================================


@app.route('/api/admin/analytics/summary', methods=['GET'])
@admin_required
def api_admin_analytics_summary():
    """Get analytics summary statistics"""
    summary = db.execute_one(
        '''SELECT
           (SELECT COUNT(*) FROM users WHERE NOT is_admin) as total_users,
           (SELECT COUNT(*) FROM dashboard_items) as total_items,
           (SELECT COUNT(*) FROM usage_tracking) as total_sessions,
           (SELECT COALESCE(SUM(duration_seconds), 0) FROM usage_tracking) / 3600 as total_hours
        '''
    )
    return jsonify(summary or {})


@app.route('/api/admin/analytics/top-tools', methods=['GET'])
@admin_required
def api_admin_analytics_top_tools():
    """Get most-clicked tools"""
    limit = request.args.get('limit', 10, type=int)
    start_date = request.args.get('start_date')
    end_date = request.args.get('end_date')

    query = '''SELECT di.name, di.icon, COUNT(*) as click_count,
                      COALESCE(SUM(ut.duration_seconds), 0) as total_seconds
               FROM dashboard_items di
               LEFT JOIN usage_tracking ut ON di.id = ut.item_id
               WHERE 1=1'''
    params = []

    if start_date:
        query += ' AND ut.clicked_at >= %s'
        params.append(start_date)
    if end_date:
        query += ' AND ut.clicked_at <= %s'
        params.append(end_date)

    query += ' GROUP BY di.id, di.name, di.icon ORDER BY click_count DESC LIMIT %s'
    params.append(limit)

    tools = db.execute_query(query, tuple(params))
    return jsonify(tools or [])


@app.route('/api/admin/analytics/user-activity', methods=['GET'])
@admin_required
def api_admin_analytics_user_activity():
    """Get user activity over time"""
    days = request.args.get('days', 30, type=int)

    activity = db.execute_query(
        '''SELECT DATE(clicked_at) as date, COUNT(*) as session_count
           FROM usage_tracking
           WHERE clicked_at >= NOW() - INTERVAL '%s days'
           GROUP BY DATE(clicked_at)
           ORDER BY date''',
        (days,),
    )
    return jsonify(activity or [])


@app.route('/api/admin/analytics/recent', methods=['GET'])
@admin_required
def api_admin_analytics_recent():
    """Get recent activity log"""
    limit = request.args.get('limit', 50, type=int)

    recent = db.execute_query(
        '''SELECT ut.*, u.username, di.name as item_name, di.icon
           FROM usage_tracking ut
           JOIN users u ON ut.user_id = u.id
           LEFT JOIN dashboard_items di ON ut.item_id = di.id
           ORDER BY ut.clicked_at DESC
           LIMIT %s''',
        (limit,),
    )
    return jsonify(recent or [])


# ============================================================================
# Main Entry Point
# ============================================================================

if __name__ == '__main__':
    port = int(os.getenv('PORT', 5000))
    app.run(host='0.0.0.0', port=port, debug=True)
