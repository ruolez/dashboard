/**
 * Dashboard Page - User dashboard with tool grid
 */

let currentUser = null;
let dashboardItems = [];

// Initialize
document.addEventListener('DOMContentLoaded', async () => {
  await loadCurrentUser();
  await loadDashboardItems();
  setupProfileMenu();
  setupKeyboardShortcuts();
});

/**
 * Load current user info
 */
async function loadCurrentUser() {
  try {
    const response = await fetch('/api/auth/me');
    if (!response.ok) {
      if (response.status === 401) {
        window.location.href = '/login';
        return;
      }
      throw new Error('Failed to load user info');
    }
    currentUser = await response.json();
    document.getElementById('usernameDisplay').textContent = currentUser.username;
  } catch (error) {
    console.error('Error loading user:', error);
  }
}

/**
 * Load dashboard items
 */
async function loadDashboardItems() {
  try {
    const response = await fetch('/api/dashboard/items');
    if (!response.ok) {
      if (response.status === 401) {
        window.location.href = '/login';
        return;
      }
      throw new Error('Failed to load dashboard items');
    }
    dashboardItems = await response.json();
    renderDashboard();
  } catch (error) {
    console.error('Error loading dashboard items:', error);
    showError('Failed to load dashboard items');
  }
}

/**
 * Render dashboard grid
 */
function renderDashboard() {
  const container = document.getElementById('dashboardContent');

  if (dashboardItems.length === 0) {
    container.innerHTML = `
      <div class="empty-state">
        <div class="empty-state-icon">📦</div>
        <h2>No Tools Assigned</h2>
        <p>Contact your administrator to get access to tools.</p>
      </div>
    `;
    return;
  }

  // Render all items in a single grid
  const html = `
    <div class="dashboard-grid">
      ${dashboardItems.map((item) => renderDashboardCard(item)).join('')}
    </div>
  `;

  container.innerHTML = html;

  // Add click handlers
  document.querySelectorAll('.dashboard-card').forEach((card) => {
    card.addEventListener('click', () => {
      const itemId = card.dataset.itemId;
      window.location.href = `/tool/${itemId}`;
    });
  });
}

/**
 * Render dashboard card
 */
function renderDashboardCard(item) {
  const icon = item.icon || '🔧';
  const description = item.description || '';

  return `
    <div class="dashboard-card" data-item-id="${item.id}">
      <div class="dashboard-card-icon">${escapeHtml(icon)}</div>
      <div class="dashboard-card-name">${escapeHtml(item.name)}</div>
      ${description ? `<div class="dashboard-card-description">${escapeHtml(description)}</div>` : ''}
    </div>
  `;
}

/**
 * Setup profile menu
 */
function setupProfileMenu() {
  const profileButton = document.getElementById('profileButton');
  const profileDropdown = document.getElementById('profileDropdown');

  profileButton.addEventListener('click', (e) => {
    e.stopPropagation();
    profileDropdown.classList.toggle('show');
  });

  // Close dropdown when clicking outside
  document.addEventListener('click', () => {
    profileDropdown.classList.remove('show');
  });
}

/**
 * Setup keyboard shortcuts
 */
function setupKeyboardShortcuts() {
  keyboardManager.registerShortcut('/', () => {
    // Focus search if we add one later
  });

  keyboardManager.registerShortcut('Ctrl+,', () => {
    window.location.href = '/change-password';
  });
}

/**
 * Show error message
 */
function showError(message) {
  const container = document.getElementById('dashboardContent');
  container.innerHTML = `
    <div class="empty-state">
      <div class="empty-state-icon">⚠️</div>
      <h2>Error</h2>
      <p>${escapeHtml(message)}</p>
    </div>
  `;
}

/**
 * Escape HTML to prevent XSS
 */
function escapeHtml(text) {
  const map = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#039;',
  };
  return text.replace(/[&<>"']/g, (m) => map[m]);
}
