/**
 * Admin Users Page - User management interface
 */

let users = [];
let allItems = [];
let editingUserId = null;
let assigningUserId = null;

// Initialize
document.addEventListener('DOMContentLoaded', async () => {
  await loadUsers();
  await loadAllItems();
  setupEventListeners();
});

/**
 * Load users
 */
async function loadUsers() {
  try {
    const response = await fetch('/api/admin/users');
    if (!response.ok) throw new Error('Failed to load users');
    users = await response.json();
    renderUsers();
  } catch (error) {
    console.error('Error loading users:', error);
    showToast('Failed to load users', 'error');
  }
}

/**
 * Load all dashboard items
 */
async function loadAllItems() {
  try {
    const response = await fetch('/api/admin/items');
    if (!response.ok) throw new Error('Failed to load items');
    allItems = await response.json();
  } catch (error) {
    console.error('Error loading items:', error);
  }
}

/**
 * Render users table
 */
function renderUsers() {
  const tbody = document.getElementById('usersTableBody');
  const searchTerm = document.getElementById('searchInput').value.toLowerCase();

  const filteredUsers = users.filter(
    (user) =>
      user.username.toLowerCase().includes(searchTerm)
  );

  if (filteredUsers.length === 0) {
    tbody.innerHTML = '<tr><td colspan="5" class="text-center">No users found</td></tr>';
    return;
  }

  tbody.innerHTML = filteredUsers
    .map(
      (user) => `
    <tr>
      <td>${escapeHtml(user.username)}</td>
      <td>${user.is_admin ? '<span class="badge badge-success">Yes</span>' : '<span class="badge badge-info">No</span>'}</td>
      <td>${user.last_login ? formatDate(user.last_login) : 'Never'}</td>
      <td>${formatDate(user.created_at)}</td>
      <td>
        <button class="btn btn-sm btn-secondary" onclick="editUser(${user.id})">Edit</button>
        <button class="btn btn-sm btn-secondary" onclick="assignItems(${user.id})">Assign Items</button>
        <button class="btn btn-sm btn-danger" onclick="deleteUser(${user.id}, '${escapeHtml(user.username)}')">Delete</button>
      </td>
    </tr>
  `
    )
    .join('');
}

/**
 * Setup event listeners
 */
function setupEventListeners() {
  document.getElementById('addUserBtn').addEventListener('click', () => {
    editingUserId = null;
    document.getElementById('modalTitle').textContent = 'Add User';
    document.getElementById('username').value = '';
    document.getElementById('password').value = '';
    document.getElementById('password').required = true;
    document.getElementById('is_admin').checked = false;
    document.getElementById('passwordHint').style.display = 'none';
    document.getElementById('userModal').style.display = 'flex';

    // Focus username field
    setTimeout(() => {
      document.getElementById('username').focus();
    }, 100);
  });

  document.getElementById('cancelBtn').addEventListener('click', () => {
    document.getElementById('userModal').style.display = 'none';
  });

  document.getElementById('userForm').addEventListener('submit', handleUserSubmit);

  document.getElementById('searchInput').addEventListener('input', renderUsers);

  document.getElementById('cancelAssignBtn').addEventListener('click', () => {
    document.getElementById('assignItemsModal').style.display = 'none';
  });

  document.getElementById('saveAssignBtn').addEventListener('click', handleAssignItems);
}

/**
 * Edit user
 */
window.editUser = async function (userId) {
  editingUserId = userId;
  const user = users.find((u) => u.id === userId);

  document.getElementById('modalTitle').textContent = 'Edit User';
  document.getElementById('username').value = user.username;
  document.getElementById('password').value = '';
  document.getElementById('password').required = false;
  document.getElementById('is_admin').checked = user.is_admin;
  document.getElementById('passwordHint').style.display = 'block';
  document.getElementById('userModal').style.display = 'flex';

  // Focus username field
  setTimeout(() => {
    document.getElementById('username').focus();
  }, 100);
};

/**
 * Handle user form submit
 */
async function handleUserSubmit(e) {
  e.preventDefault();

  const username = document.getElementById('username').value.trim();
  const password = document.getElementById('password').value;
  const is_admin = document.getElementById('is_admin').checked;

  const data = { username, is_admin };
  if (password) {
    data.password = password;
  }

  try {
    const url = editingUserId ? `/api/admin/users/${editingUserId}` : '/api/admin/users';
    const method = editingUserId ? 'PUT' : 'POST';

    const response = await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to save user');
    }

    document.getElementById('userModal').style.display = 'none';
    await loadUsers();
    showToast(`User ${editingUserId ? 'updated' : 'created'} successfully`, 'success');
  } catch (error) {
    showToast(error.message, 'error');
  }
}

/**
 * Delete user
 */
window.deleteUser = async function (userId, username) {
  if (!confirm(`Are you sure you want to delete user "${username}"?`)) {
    return;
  }

  try {
    const response = await fetch(`/api/admin/users/${userId}`, {
      method: 'DELETE',
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to delete user');
    }

    await loadUsers();
    showToast('User deleted successfully', 'success');
  } catch (error) {
    showToast(error.message, 'error');
  }
};

/**
 * Assign items to user
 */
window.assignItems = async function (userId) {
  assigningUserId = userId;
  const user = users.find((u) => u.id === userId);

  // Get user's current items
  const response = await fetch(`/api/admin/users/${userId}/items`);
  const userItemIds = await response.json();

  // Render items list
  const itemsList = document.getElementById('itemsList');
  itemsList.innerHTML = `
    <p>Select dashboard items for <strong>${escapeHtml(user.username)}</strong>:</p>
    <div style="max-height: 400px; overflow-y: auto;">
      ${allItems
        .map(
          (item) => `
        <label style="display: block; padding: 8px;">
          <input type="checkbox" value="${item.id}" ${userItemIds.includes(item.id) ? 'checked' : ''} />
          ${escapeHtml(item.icon || '🔧')} ${escapeHtml(item.name)}
        </label>
      `
        )
        .join('')}
    </div>
  `;

  document.getElementById('assignItemsModal').style.display = 'flex';
};

/**
 * Handle assign items
 */
async function handleAssignItems() {
  const checkboxes = document.querySelectorAll('#itemsList input[type="checkbox"]:checked');
  const itemIds = Array.from(checkboxes).map((cb) => parseInt(cb.value));

  try {
    const response = await fetch(`/api/admin/users/${assigningUserId}/items`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ item_ids: itemIds }),
    });

    if (!response.ok) throw new Error('Failed to assign items');

    document.getElementById('assignItemsModal').style.display = 'none';
    showToast('Items assigned successfully', 'success');
  } catch (error) {
    showToast(error.message, 'error');
  }
}

/**
 * Format date
 */
function formatDate(dateString) {
  if (!dateString) return '';
  const date = new Date(dateString);
  return date.toLocaleString();
}

/**
 * Escape HTML
 */
function escapeHtml(text) {
  if (!text) return '';
  const map = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#039;',
  };
  return String(text).replace(/[&<>"']/g, (m) => map[m]);
}

/**
 * Show toast notification
 */
function showToast(message, type = 'info') {
  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  toast.textContent = message;
  document.body.appendChild(toast);

  setTimeout(() => {
    toast.classList.add('toast-bounce-in');
  }, 10);

  setTimeout(() => {
    toast.classList.add('toast-slide-out');
    setTimeout(() => toast.remove(), 300);
  }, 3000);
}
