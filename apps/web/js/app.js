import { initAuth, setupLoginForm, setupRegisterForm, signOut, getProfile, getUser } from './auth.js';
import { showPage, toast, setLoading, statusLabel, statusClass, formatDate, getInitial } from './utils.js';
import { db } from './supabase.js';

// グローバルにshowPageを公開 (HTML onclick用)
window.showPage = showPage;
window.handleSignOut = async () => {
  await signOut();
};

// 初期化
async function init() {
  setupLoginForm();
  setupRegisterForm();
  setupProjectForm();

  await initAuth(
    // ログイン済み
    (user, profile) => {
      document.getElementById('app-loading').style.display = 'none';
      document.getElementById('bottom-nav').classList.remove('hidden');
      updateHomeUI(profile);
      updateProfileUI(user, profile);
      loadProjects(user);
      showPage('home-page');
    },
    // 未ログイン
    () => {
      document.getElementById('app-loading').style.display = 'none';
      document.getElementById('bottom-nav').classList.add('hidden');
      showPage('login-page');
    }
  );
}

// ホーム画面UI更新
function updateHomeUI(profile) {
  const el = document.getElementById('home-username');
  if (el) el.textContent = profile?.display_name ?? '...';
}

// プロフィール画面UI更新
async function updateProfileUI(user, profile) {
  const nameEl = document.getElementById('profile-name');
  const avatarEl = document.getElementById('profile-avatar');
  if (nameEl) nameEl.textContent = profile?.display_name ?? '...';
  if (avatarEl) avatarEl.textContent = getInitial(profile?.display_name);

  await loadDiagnosis(user.id);
}

// 診断結果読み込み
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
        <a href="https://ignitera-official.vercel.app" target="_blank" class="btn btn-primary btn-sm">
          診断する →
        </a>
      </div>`;
    return;
  }

  const cultures = data.culture_matches ?? [];
  section.innerHTML = `
    <div class="card mb-16">
      ${data.type_name ? `
        <div style="padding-bottom:16px; margin-bottom:16px; border-bottom:1px solid var(--border)">
          <div class="text-small text-secondary" style="margin-bottom:4px">あなたのタイプ</div>
          <div style="font-size:20px; font-weight:700; color:var(--primary); margin-bottom:6px">${data.type_name}</div>
          ${data.type_description ? `<div class="text-small text-secondary">${data.type_description}</div>` : ''}
        </div>` : ''}
      <div class="form-label" style="margin-bottom:10px">スコア</div>
      ${scoreBar('行動力', data.score_behavior)}
      ${scoreBar('成長志向', data.score_growth)}
      ${scoreBar('価値観', data.score_values)}
      ${cultures.length ? `
        <div class="form-label" style="margin-top:16px; margin-bottom:10px">企業文化マッチ度</div>
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

// 案件一覧読み込み
async function loadProjects(user) {
  const list = document.getElementById('projects-list');
  if (!list) return;

  const { data, error } = await db
    .from('projects')
    .select('*, companies(name)')
    .eq('acquired_by', user.id)
    .order('created_at', { ascending: false });

  if (error || !data || data.length === 0) return; // 空状態はHTML側で表示済み

  list.innerHTML = data.map(p => `
    <div class="project-card">
      <div class="project-title">${p.title}</div>
      <div class="project-company">🏢 ${p.companies?.name ?? '-'}</div>
      <div class="project-meta">
        <span class="${statusClass[p.status] ?? ''}">${statusLabel[p.status] ?? p.status}</span>
        <span class="text-small text-muted">期限: ${formatDate(p.deadline)}</span>
      </div>
    </div>`).join('');
}

// 案件登録フォーム
function setupProjectForm() {
  const form = document.getElementById('project-form');
  if (!form) return;

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const btn = form.querySelector('button[type="submit"]');
    const user = getUser();
    if (!user) return;

    const companyName = document.getElementById('proj-company').value.trim();
    const title = document.getElementById('proj-title').value.trim();
    const desc = document.getElementById('proj-desc').value.trim();
    const deadline = document.getElementById('proj-deadline').value || null;

    if (!companyName || !title) { toast('企業名と案件タイトルは必須です', 'error'); return; }

    setLoading(btn, true);

    // 企業を作成または検索
    let companyId;
    const { data: existing } = await db
      .from('companies')
      .select('id')
      .ilike('name', companyName)
      .single();

    if (existing) {
      companyId = existing.id;
    } else {
      const { data: newCompany, error: compErr } = await db
        .from('companies')
        .insert({ name: companyName, created_by: user.id })
        .select('id')
        .single();
      if (compErr) { toast('企業の作成に失敗しました', 'error'); setLoading(btn, false); return; }
      companyId = newCompany.id;
    }

    // 案件登録
    const { error } = await db.from('projects').insert({
      company_id: companyId,
      title,
      description: desc,
      deadline,
      acquired_by: user.id,
      status: 'pending_approval',
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
