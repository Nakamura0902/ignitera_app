import { db } from './supabase.js';
import { toast, setLoading, showPage } from './utils.js';

let currentUser = null;
let currentProfile = null;

export function getUser() { return currentUser; }
export function getProfile() { return currentProfile; }

// セッション初期化
export async function initAuth(onLoggedIn, onLoggedOut) {
  const { data: { session } } = await db.auth.getSession();

  db.auth.onAuthStateChange(async (_event, session) => {
    if (session) {
      currentUser = session.user;
      currentProfile = await fetchProfile(session.user.id);
      onLoggedIn(currentUser, currentProfile);
    } else {
      currentUser = null;
      currentProfile = null;
      onLoggedOut();
    }
  });

  if (session) {
    currentUser = session.user;
    currentProfile = await fetchProfile(session.user.id);
    onLoggedIn(currentUser, currentProfile);
  } else {
    onLoggedOut();
  }
}

async function fetchProfile(userId) {
  const { data } = await db.from('profiles').select('*').eq('id', userId).single();
  return data;
}

// ログイン
export function setupLoginForm() {
  const form = document.getElementById('login-form');
  if (!form) return;

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const btn = form.querySelector('button[type="submit"]');
    const email = document.getElementById('login-email').value.trim();
    const password = document.getElementById('login-password').value;

    if (!email || !password) { toast('メールアドレスとパスワードを入力してください', 'error'); return; }

    setLoading(btn, true);
    const { error } = await db.auth.signInWithPassword({ email, password });
    setLoading(btn, false);

    if (error) { toast(error.message, 'error'); return; }
    // onAuthStateChange が発火してページ遷移される
  });
}

// 新規登録
export function setupRegisterForm() {
  const form = document.getElementById('register-form');
  if (!form) return;

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const btn = form.querySelector('button[type="submit"]');
    const displayName = document.getElementById('reg-name').value.trim();
    const email = document.getElementById('reg-email').value.trim();
    const password = document.getElementById('reg-password').value;

    if (!displayName || !email || !password) { toast('全ての項目を入力してください', 'error'); return; }
    if (password.length < 8) { toast('パスワードは8文字以上で入力してください', 'error'); return; }

    setLoading(btn, true);
    const { data, error } = await db.auth.signUp({ email, password });
    if (error) { toast(error.message, 'error'); setLoading(btn, false); return; }

    if (data.user) {
      await db.from('profiles').insert({
        id: data.user.id,
        role: 'student',
        display_name: displayName,
      });
      toast('確認メールを送信しました。メールを確認してください。', 'success');
      setTimeout(() => showPage('login-page'), 2000);
    }
    setLoading(btn, false);
  });
}

// ログアウト
export async function signOut() {
  await db.auth.signOut();
}
