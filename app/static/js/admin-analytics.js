/**
 * Admin Analytics Page - Usage analytics and charts
 */

let topToolsChart = null;
let activityChart = null;

// Initialize
document.addEventListener('DOMContentLoaded', async () => {
  await loadAnalytics();
  setupThemeChangeListener();
});

/**
 * Load all analytics data
 */
async function loadAnalytics() {
  await Promise.all([loadSummary(), loadTopTools(), loadUserActivity(), loadRecentActivity()]);
}

/**
 * Load summary statistics
 */
async function loadSummary() {
  try {
    const response = await fetch('/api/admin/analytics/summary');
    if (!response.ok) throw new Error('Failed to load summary');
    const data = await response.json();

    document.getElementById('totalUsers').textContent = data.total_users || 0;
    document.getElementById('totalItems').textContent = data.total_items || 0;
    document.getElementById('totalSessions').textContent = data.total_sessions || 0;
    document.getElementById('totalHours').textContent =
      Math.round(data.total_hours || 0).toLocaleString();
  } catch (error) {
    console.error('Error loading summary:', error);
  }
}

/**
 * Load top tools chart
 */
async function loadTopTools() {
  try {
    const response = await fetch('/api/admin/analytics/top-tools?limit=10');
    if (!response.ok) throw new Error('Failed to load top tools');
    const data = await response.json();

    const labels = data.map((item) => `${item.icon || '🔧'} ${item.name}`);
    const values = data.map((item) => item.click_count);

    const ctx = document.getElementById('topToolsChart').getContext('2d');

    if (topToolsChart) {
      topToolsChart.destroy();
    }

    topToolsChart = new Chart(ctx, {
      type: 'bar',
      data: {
        labels: labels,
        datasets: [
          {
            label: 'Clicks',
            data: values,
            backgroundColor: getChartColor('primary'),
            borderColor: getChartColor('primary-dark'),
            borderWidth: 1,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: true,
        aspectRatio: 2,
        plugins: {
          legend: {
            display: false,
          },
        },
        scales: {
          y: {
            beginAtZero: true,
            ticks: {
              precision: 0,
              color: getChartColor('text'),
            },
            grid: {
              color: getChartColor('grid'),
            },
          },
          x: {
            ticks: {
              color: getChartColor('text'),
            },
            grid: {
              display: false,
            },
          },
        },
      },
    });
  } catch (error) {
    console.error('Error loading top tools:', error);
  }
}

/**
 * Load user activity chart
 */
async function loadUserActivity() {
  try {
    const response = await fetch('/api/admin/analytics/user-activity?days=30');
    if (!response.ok) throw new Error('Failed to load user activity');
    const data = await response.json();

    const labels = data.map((item) => {
      const date = new Date(item.date);
      return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    });
    const values = data.map((item) => item.session_count);

    const ctx = document.getElementById('activityChart').getContext('2d');

    if (activityChart) {
      activityChart.destroy();
    }

    activityChart = new Chart(ctx, {
      type: 'line',
      data: {
        labels: labels,
        datasets: [
          {
            label: 'Sessions',
            data: values,
            backgroundColor: getChartColor('primary-transparent'),
            borderColor: getChartColor('primary'),
            borderWidth: 2,
            fill: true,
            tension: 0.4,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: true,
        aspectRatio: 2,
        plugins: {
          legend: {
            display: false,
          },
        },
        scales: {
          y: {
            beginAtZero: true,
            ticks: {
              precision: 0,
              color: getChartColor('text'),
            },
            grid: {
              color: getChartColor('grid'),
            },
          },
          x: {
            ticks: {
              color: getChartColor('text'),
            },
            grid: {
              color: getChartColor('grid'),
            },
          },
        },
      },
    });
  } catch (error) {
    console.error('Error loading user activity:', error);
  }
}

/**
 * Load recent activity table
 */
async function loadRecentActivity() {
  try {
    const response = await fetch('/api/admin/analytics/recent?limit=20');
    if (!response.ok) throw new Error('Failed to load recent activity');
    const data = await response.json();

    const tbody = document.getElementById('recentActivityBody');

    if (data.length === 0) {
      tbody.innerHTML = '<tr><td colspan="4" class="text-center">No activity yet</td></tr>';
      return;
    }

    tbody.innerHTML = data
      .map(
        (item) => `
      <tr>
        <td>${escapeHtml(item.username)}</td>
        <td>${item.icon ? escapeHtml(item.icon) : '🔧'} ${escapeHtml(item.item_name || 'Deleted Item')}</td>
        <td>${formatDate(item.clicked_at)}</td>
        <td>${formatDuration(item.duration_seconds)}</td>
      </tr>
    `
      )
      .join('');
  } catch (error) {
    console.error('Error loading recent activity:', error);
  }
}

/**
 * Get chart color based on theme
 */
function getChartColor(type) {
  const root = document.documentElement;
  const theme = root.getAttribute('data-theme');

  const colors = {
    light: {
      primary: '#546e7a',
      'primary-dark': '#37474f',
      'primary-transparent': 'rgba(84, 110, 122, 0.1)',
      text: '#1a1a1a',
      grid: '#e0e0e0',
    },
    dark: {
      primary: '#78909c',
      'primary-dark': '#546e7a',
      'primary-transparent': 'rgba(120, 144, 156, 0.1)',
      text: '#e8e8e8',
      grid: '#333333',
    },
  };

  return colors[theme]?.[type] || colors.light[type];
}

/**
 * Setup theme change listener to update charts
 */
function setupThemeChangeListener() {
  document.addEventListener('themechange', () => {
    loadTopTools();
    loadUserActivity();
  });
}

/**
 * Format date
 */
function formatDate(dateString) {
  if (!dateString) return '-';
  const date = new Date(dateString);
  return date.toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

/**
 * Format duration
 */
function formatDuration(seconds) {
  if (!seconds) return '-';

  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;

  if (hours > 0) {
    return `${hours}h ${minutes}m`;
  } else if (minutes > 0) {
    return `${minutes}m ${secs}s`;
  } else {
    return `${secs}s`;
  }
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
