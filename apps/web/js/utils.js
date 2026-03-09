// トースト通知
export function toast(message, type = 'default') {
  const container = document.getElementById('toast-container');
  const el = document.createElement('div');
  el.className = `toast${type === 'error' ? ' toast-error' : type === 'success' ? ' toast-success' : ''}`;
  el.textContent = message;
  container.appendChild(el);
  setTimeout(() => el.remove(), 3000);
}

// ページ切り替え (SPA)
export function showPage(pageId) {
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  const page = document.getElementById(pageId);
  if (page) page.classList.add('active');

  // ボトムナビのアクティブ状態
  document.querySelectorAll('.bottom-nav a').forEach(a => {
    a.classList.toggle('active', a.dataset.page === pageId);
  });

  window.scrollTo(0, 0);
}

// ローディング状態
export function setLoading(btn, loading) {
  if (loading) {
    btn.disabled = true;
    btn._origText = btn.innerHTML;
    btn.innerHTML = '<div class="spinner"></div>';
  } else {
    btn.disabled = false;
    btn.innerHTML = btn._origText || btn.innerHTML;
  }
}

// ステータス日本語変換
export const statusLabel = {
  pending_approval: '承認待ち',
  approved: '承認済み',
  team_forming: 'チーム編成中',
  in_progress: '進行中',
  completed: '完了',
};

export const statusClass = {
  pending_approval: 'status-pending',
  approved: 'status-approved',
  team_forming: 'status-progress',
  in_progress: 'status-progress',
  completed: 'status-completed',
};

// 日付フォーマット
export function formatDate(dateStr) {
  if (!dateStr) return '-';
  const d = new Date(dateStr);
  return `${d.getFullYear()}/${d.getMonth()+1}/${d.getDate()}`;
}

// イニシャル取得
export function getInitial(name) {
  if (!name) return '?';
  return name.charAt(0).toUpperCase();
}
