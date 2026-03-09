import { initAuth, setupLoginForm, setupRegisterForm, signOut, getProfile, getUser } from './auth.js';
import { showPage, toast, setLoading, statusLabel, statusClass, formatDate, getInitial } from './utils.js';
import { db } from './supabase.js';

window.showPage = showPage;
window.navTo = navTo;
window.handleSignOut = async () => { await signOut(); };

// ===================== テーマ管理 =====================
function applyTheme(color, dark) {
  const r = parseInt(color.slice(1,3),16), g = parseInt(color.slice(3,5),16), b = parseInt(color.slice(5,7),16);
  document.documentElement.style.setProperty('--primary', color);
  document.documentElement.style.setProperty('--primary-dark', dark);
  document.documentElement.style.setProperty('--primary-glow', `rgba(${r},${g},${b},0.25)`);
  document.documentElement.style.setProperty('--primary-subtle', `rgba(${r},${g},${b},0.10)`);
}

function loadTheme() {
  const saved = localStorage.getItem('ignitera-theme');
  if (saved) {
    try { const { color, dark } = JSON.parse(saved); applyTheme(color, dark); updateSwatchUI(color); } catch(e) {}
  }
}

function updateSwatchUI(activeColor) {
  document.querySelectorAll('.theme-swatch').forEach(s => s.classList.toggle('active', s.dataset.color === activeColor));
}

function setupThemeSwatches() {
  document.querySelectorAll('.theme-swatch').forEach(swatch => {
    swatch.addEventListener('click', () => {
      const { color, dark } = swatch.dataset;
      applyTheme(color, dark);
      updateSwatchUI(color);
      localStorage.setItem('ignitera-theme', JSON.stringify({ color, dark }));
      toast('テーマカラーを変更しました', 'success');
    });
  });
  const saved = localStorage.getItem('ignitera-theme');
  updateSwatchUI(saved ? JSON.parse(saved).color : '#FF6B35');
}

// ===================== サイドバー =====================
function setupSidebar() {
  const sidebar   = document.getElementById('sidebar');
  const overlay   = document.getElementById('sidebar-overlay');
  const hamburger = document.getElementById('hamburger-btn');
  const closeBtn  = document.getElementById('sidebar-close-btn');

  function openSidebar() {
    sidebar.classList.add('open');
    overlay.classList.add('open');
    hamburger.classList.add('open');
    document.body.style.overflow = 'hidden';
  }
  function closeSidebar() {
    sidebar.classList.remove('open');
    overlay.classList.remove('open');
    hamburger.classList.remove('open');
    document.body.style.overflow = '';
  }

  hamburger.addEventListener('click', openSidebar);
  closeBtn.addEventListener('click', closeSidebar);
  overlay.addEventListener('click', closeSidebar);
}

function navTo(pageId) {
  const sidebar   = document.getElementById('sidebar');
  const overlay   = document.getElementById('sidebar-overlay');
  const hamburger = document.getElementById('hamburger-btn');
  sidebar.classList.remove('open');
  overlay.classList.remove('open');
  if (hamburger) hamburger.classList.remove('open');
  document.body.style.overflow = '';
  showPage(pageId);
}

// ===================== 初期化 =====================
async function init() {
  loadTheme();
  setupSidebar();
  setupThemeSwatches();
  setupLoginForm();
  setupRegisterForm();
  setupProjectForm();

  await initAuth(
    (user, profile) => {
      document.getElementById('app-loading').style.display = 'none';
      document.getElementById('app-header').classList.remove('hidden');
      updateSidebarUser(user, profile);
      updateHomeUI(profile);
      updateProfileUI(user, profile);
      updateSettingsUI(user, profile);
      loadProjects(user);
      if (profile?.role === 'operator') {
        document.getElementById('sidebar-admin-link').classList.remove('hidden');
      }
      showPage('home-page');
    },
    () => {
      document.getElementById('app-loading').style.display = 'none';
      document.getElementById('app-header').classList.add('hidden');
      showPage('login-page');
    }
  );
}

function updateSidebarUser(user, profile) {
  const name   = document.getElementById('sidebar-username');
  const avatar = document.getElementById('sidebar-avatar');
  if (name)   name.textContent   = profile?.display_name ?? user.email;
  if (avatar) avatar.textContent = getInitial(profile?.display_name ?? user.email);
}

function updateHomeUI(profile) {
  const el = document.getElementById('home-username');
  if (el) el.textContent = profile?.display_name ?? '...';
}

async function updateProfileUI(user, profile) {
  const nameEl   = document.getElementById('profile-name');
  const avatarEl = document.getElementById('profile-avatar');
  if (nameEl)   nameEl.textContent   = profile?.display_name ?? '...';
  if (avatarEl) avatarEl.textContent = getInitial(profile?.display_name);
  await loadDiagnosis(user.id);
}

function updateSettingsUI(user, profile) {
  const emailEl = document.getElementById('settings-email');
  const roleEl  = document.getElementById('settings-role');
  if (emailEl) emailEl.textContent = user.email ?? '-';
  if (roleEl)  roleEl.textContent  =
    profile?.role === 'operator' ? '運営' :
    profile?.role === 'company'  ? '企業' : '学生';
}

// ===================== 診断結果 =====================
async function loadDiagnosis(userId) {
  const section = document.getElementById('diagnosis-section');
  if (!section) return;

  const { data } = await db
    .from('diagnosis_results')
    .select('*')
    .eq('student_id', userId)
    .single();

  if (!data) {
    section.innerHTML = `
      <div class="diagnosis-banner">
        <h3>診断が未実施です</h3>
        <p>45問の本格診断で自分のタイプと強みを発見しよう</p>
        <a href="https://ignitera-official.vercel.app" target="_blank" class="btn btn-primary btn-sm">診断する →</a>
      </div>`;
    return;
  }

  const cultures = data.culture_matches ?? [];
  section.innerHTML = `
    <div class="card mb-16">
      ${data.type_name ? `
        <div style="padding-bottom:16px;margin-bottom:16px;border-bottom:1px solid var(--border)">
          <div class="text-small text-secondary mb-4">あなたのタイプ</div>
          <div style="font-size:22px;font-weight:900;color:var(--primary);margin-bottom:6px">${data.type_name}</div>
          ${data.type_description ? `<div class="text-small text-secondary">${data.type_description}</div>` : ''}
        </div>` : ''}
      <div class="form-label mb-12">スコア</div>
      ${scoreBar('行動力', data.score_behavior)}
      ${scoreBar('成長志向', data.score_growth)}
      ${scoreBar('価値観', data.score_values)}
      ${cultures.length ? `
        <div class="form-label" style="margin-top:16px;margin-bottom:12px">企業文化マッチ度</div>
        ${cultures.map(m => scoreBar(m.culture, m.score)).join('')}
      ` : ''}
    </div>`;
}

function scoreBar(label, value) {
  const pct = value ?? 0;
  return `
    <div class="score-bar-row">
      <span class="score-bar-label">${label}</span>
      <div class="score-bar-bg"><div class="score-bar-fill" style="width:${pct}%"></div></div>
      <span class="score-bar-value">${value ?? '-'}</span>
    </div>`;
}

// ===================== 案件 =====================
async function loadProjects(user) {
  const { data, error } = await db
    .from('projects')
    .select('*, companies(name)')
    .eq('acquired_by', user.id)
    .order('created_at', { ascending: false });

  if (error || !data) return;

  const statEl = document.getElementById('stat-projects');
  const pendEl = document.getElementById('stat-pending');
  const progEl = document.getElementById('stat-inprogress');
  if (statEl) statEl.textContent = data.length;
  if (pendEl) pendEl.textContent = data.filter(p => p.status === 'pending_approval').length;
  if (progEl) progEl.textContent = data.filter(p => p.status === 'in_progress').length;

  const recentEl = document.getElementById('home-recent-projects');
  if (recentEl && data.length > 0) recentEl.innerHTML = data.slice(0,3).map(projectCardHTML).join('');

  const list = document.getElementById('projects-list');
  if (list && data.length > 0) list.innerHTML = data.map(projectCardHTML).join('');
}

function projectCardHTML(p) {
  return `
    <div class="project-card">
      <div class="project-title">${p.title}</div>
      <div class="project-company">🏢 ${p.companies?.name ?? '-'}</div>
      <div class="project-meta">
        <span class="${statusClass[p.status] ?? ''}">${statusLabel[p.status] ?? p.status}</span>
        <span class="text-small text-muted">期限: ${formatDate(p.deadline)}</span>
      </div>
    </div>`;
}

function setupProjectForm() {
  const form = document.getElementById('project-form');
  if (!form) return;

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const btn  = form.querySelector('button[type="submit"]');
    const user = getUser();
    if (!user) return;

    const companyName = document.getElementById('proj-company').value.trim();
    const title       = document.getElementById('proj-title').value.trim();
    const desc        = document.getElementById('proj-desc').value.trim();
    const deadline    = document.getElementById('proj-deadline').value || null;

    if (!companyName || !title) { toast('企業名と案件タイトルは必須です', 'error'); return; }

    setLoading(btn, true);

    let companyId;
    const { data: existing } = await db.from('companies').select('id').ilike('name', companyName).single();
    if (existing) {
      companyId = existing.id;
    } else {
      const { data: newCompany, error: compErr } = await db
        .from('companies').insert({ name: companyName, created_by: user.id }).select('id').single();
      if (compErr) { toast('企業の作成に失敗しました', 'error'); setLoading(btn, false); return; }
      companyId = newCompany.id;
    }

    const { error } = await db.from('projects').insert({
      company_id: companyId, title, description: desc, deadline,
      acquired_by: user.id, status: 'pending_approval',
    });

    setLoading(btn, false);
    if (error) { toast('登録に失敗しました: ' + error.message, 'error'); return; }

    toast('案件を登録しました。運営の承認をお待ちください。', 'success');
    form.reset();
    await loadProjects(user);
    showPage('projects-page');
  });
}

init();
