/**
 * Admin Items Page - Dashboard items management interface
 */

let items = [];
let editingItemId = null;

// Initialize
document.addEventListener('DOMContentLoaded', async () => {
  await loadItems();
  setupEventListeners();
});

/**
 * Load dashboard items
 */
async function loadItems() {
  try {
    const response = await fetch('/api/admin/items');
    if (!response.ok) throw new Error('Failed to load items');
    items = await response.json();
    renderItems();
  } catch (error) {
    console.error('Error loading items:', error);
    showToast('Failed to load items', 'error');
  }
}

/**
 * Render items table
 */
function renderItems() {
  const tbody = document.getElementById('itemsTableBody');
  const searchTerm = document.getElementById('searchInput').value.toLowerCase();

  const filteredItems = items.filter(
    (item) =>
      item.name.toLowerCase().includes(searchTerm) ||
      (item.url && item.url.toLowerCase().includes(searchTerm))
  );

  if (filteredItems.length === 0) {
    tbody.innerHTML = '<tr><td colspan="5" class="text-center">No items found</td></tr>';
    return;
  }

  tbody.innerHTML = filteredItems
    .map(
      (item) => `
    <tr>
      <td style="font-size: 24px;">${escapeHtml(item.icon || '🔧')}</td>
      <td>${escapeHtml(item.name)}</td>
      <td><a href="${escapeHtml(item.url)}" target="_blank" class="link">${truncateUrl(item.url)}</a></td>
      <td>${item.user_count || 0}</td>
      <td>
        <button class="btn btn-sm btn-secondary" onclick="editItem(${item.id})">Edit</button>
        <button class="btn btn-sm btn-danger" onclick="deleteItem(${item.id}, '${escapeHtml(item.name)}')">Delete</button>
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
  document.getElementById('addItemBtn').addEventListener('click', () => {
    editingItemId = null;
    document.getElementById('modalTitle').textContent = 'Add Dashboard Item';
    document.getElementById('name').value = '';
    document.getElementById('description').value = '';
    document.getElementById('url').value = '';
    document.getElementById('icon').value = '';
    document.getElementById('itemModal').style.display = 'flex';
    setupEmojiPicker();
  });

  document.getElementById('cancelBtn').addEventListener('click', () => {
    document.getElementById('itemModal').style.display = 'none';
  });

  document.getElementById('itemForm').addEventListener('submit', handleItemSubmit);

  document.getElementById('searchInput').addEventListener('input', renderItems);
}

/**
 * Edit item
 */
window.editItem = async function (itemId) {
  editingItemId = itemId;
  const item = items.find((i) => i.id === itemId);

  document.getElementById('modalTitle').textContent = 'Edit Dashboard Item';
  document.getElementById('name').value = item.name;
  document.getElementById('description').value = item.description || '';
  document.getElementById('url').value = item.url;
  document.getElementById('icon').value = item.icon || '';
  document.getElementById('itemModal').style.display = 'flex';
  setupEmojiPicker();
};

/**
 * Handle item form submit
 */
async function handleItemSubmit(e) {
  e.preventDefault();

  const data = {
    name: document.getElementById('name').value.trim(),
    description: document.getElementById('description').value.trim(),
    url: document.getElementById('url').value.trim(),
    icon: document.getElementById('icon').value.trim(),
  };

  try {
    const url = editingItemId ? `/api/admin/items/${editingItemId}` : '/api/admin/items';
    const method = editingItemId ? 'PUT' : 'POST';

    const response = await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to save item');
    }

    document.getElementById('itemModal').style.display = 'none';
    await loadItems();
    showToast(`Item ${editingItemId ? 'updated' : 'created'} successfully`, 'success');
  } catch (error) {
    showToast(error.message, 'error');
  }
}

/**
 * Delete item
 */
window.deleteItem = async function (itemId, name) {
  const item = items.find((i) => i.id === itemId);
  let message = `Are you sure you want to delete "${name}"?`;

  if (item.user_count > 0) {
    message += `\n\nThis item is assigned to ${item.user_count} user(s) and will be removed from their dashboards.`;
  }

  if (!confirm(message)) {
    return;
  }

  try {
    const response = await fetch(`/api/admin/items/${itemId}`, {
      method: 'DELETE',
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to delete item');
    }

    await loadItems();
    showToast('Item deleted successfully', 'success');
  } catch (error) {
    showToast(error.message, 'error');
  }
};

/**
 * Truncate URL for display
 */
function truncateUrl(url) {
  if (url.length <= 50) return url;
  return url.substring(0, 47) + '...';
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
 * Setup emoji picker
 */
function setupEmojiPicker() {
  document.querySelectorAll('.emoji-option').forEach((option) => {
    option.addEventListener('click', () => {
      const emoji = option.dataset.emoji;
      document.getElementById('icon').value = emoji;
    });
  });
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
