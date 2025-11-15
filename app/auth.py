"""Authentication utilities for user management"""

import bcrypt
from functools import wraps
from flask import session, redirect, url_for, jsonify, request
from typing import Optional, Callable


def hash_password(password: str) -> str:
    """Hash a password using bcrypt with cost factor 12"""
    salt = bcrypt.gensalt(rounds=12)
    return bcrypt.hashpw(password.encode('utf-8'), salt).decode('utf-8')


def verify_password(password: str, password_hash: str) -> bool:
    """Verify a password against its hash"""
    return bcrypt.checkpw(password.encode('utf-8'), password_hash.encode('utf-8'))


def login_required(f: Callable) -> Callable:
    """Decorator to require login for routes"""

    @wraps(f)
    def decorated_function(*args, **kwargs):
        if 'user_id' not in session:
            if request.path.startswith('/api/'):
                return jsonify({'error': 'Unauthorized'}), 401
            return redirect(url_for('login'))
        return f(*args, **kwargs)

    return decorated_function


def admin_required(f: Callable) -> Callable:
    """Decorator to require admin privileges for routes"""

    @wraps(f)
    def decorated_function(*args, **kwargs):
        if 'user_id' not in session:
            if request.path.startswith('/api/'):
                return jsonify({'error': 'Unauthorized'}), 401
            return redirect(url_for('login'))
        if not session.get('is_admin', False):
            if request.path.startswith('/api/'):
                return jsonify({'error': 'Forbidden - Admin access required'}), 403
            return redirect(url_for('dashboard'))
        return f(*args, **kwargs)

    return decorated_function


def get_current_user() -> Optional[dict]:
    """Get current user info from session"""
    if 'user_id' in session:
        return {
            'id': session['user_id'],
            'username': session['username'],
            'is_admin': session.get('is_admin', False),
        }
    return None
