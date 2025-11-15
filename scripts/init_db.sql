-- Dashboard Application Database Schema
-- Created: 2025

-- Enable extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Users table
CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    username VARCHAR(50) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    is_admin BOOLEAN DEFAULT FALSE,
    must_change_password BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    last_login TIMESTAMPTZ,
    CONSTRAINT username_length CHECK (char_length(username) >= 3)
);

-- Dashboard items table
CREATE TABLE IF NOT EXISTS dashboard_items (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    description TEXT,
    url TEXT NOT NULL,
    icon VARCHAR(50),
    category VARCHAR(50),
    open_in_new_window BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    created_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
    CONSTRAINT name_not_empty CHECK (char_length(name) > 0),
    CONSTRAINT url_not_empty CHECK (char_length(url) > 0)
);

-- User-Item assignment table (many-to-many)
CREATE TABLE IF NOT EXISTS user_items (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    item_id INTEGER NOT NULL REFERENCES dashboard_items(id) ON DELETE CASCADE,
    display_order INTEGER DEFAULT 0,
    assigned_at TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT unique_user_item UNIQUE(user_id, item_id)
);

-- Usage tracking table
CREATE TABLE IF NOT EXISTS usage_tracking (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    item_id INTEGER REFERENCES dashboard_items(id) ON DELETE SET NULL,
    clicked_at TIMESTAMPTZ DEFAULT NOW(),
    session_start TIMESTAMPTZ NOT NULL,
    session_end TIMESTAMPTZ,
    duration_seconds INTEGER,
    CONSTRAINT valid_session_duration CHECK (session_end IS NULL OR session_end >= session_start),
    CONSTRAINT valid_duration CHECK (duration_seconds IS NULL OR duration_seconds >= 0)
);

-- Password change history table
CREATE TABLE IF NOT EXISTS password_change_history (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    changed_at TIMESTAMPTZ DEFAULT NOW(),
    changed_by INTEGER REFERENCES users(id) ON DELETE SET NULL
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_user_items_user_id ON user_items(user_id);
CREATE INDEX IF NOT EXISTS idx_user_items_item_id ON user_items(item_id);
CREATE INDEX IF NOT EXISTS idx_usage_tracking_user_id ON usage_tracking(user_id);
CREATE INDEX IF NOT EXISTS idx_usage_tracking_item_id ON usage_tracking(item_id);
CREATE INDEX IF NOT EXISTS idx_usage_tracking_clicked_at ON usage_tracking(clicked_at DESC);
CREATE INDEX IF NOT EXISTS idx_dashboard_items_category ON dashboard_items(category);

-- Insert default admin user (password: admin)
-- Password hash generated with bcrypt (cost factor 12)
INSERT INTO users (username, password_hash, is_admin, must_change_password)
VALUES ('admin', '$2b$12$K4pWmfuQH/HtvG13q8zWwuzjLP9MOD8s8iw2.YhSYSiKqQ2L8Zn1W', TRUE, TRUE)
ON CONFLICT (username) DO NOTHING;

-- Insert some sample dashboard items for testing
INSERT INTO dashboard_items (name, description, url, icon, category, created_by)
VALUES
    ('Google', 'Search engine', 'https://www.google.com', '🔍', 'Tools', 1),
    ('GitHub', 'Code repository', 'https://www.github.com', '🐙', 'Development', 1),
    ('Gmail', 'Email client', 'https://mail.google.com', '📧', 'Communication', 1),
    ('Calendar', 'Schedule management', 'https://calendar.google.com', '📅', 'Productivity', 1),
    ('Drive', 'Cloud storage', 'https://drive.google.com', '💾', 'Storage', 1)
ON CONFLICT DO NOTHING;

-- Assign all items to admin user for testing
INSERT INTO user_items (user_id, item_id, display_order)
SELECT 1, id, id FROM dashboard_items
ON CONFLICT DO NOTHING;
