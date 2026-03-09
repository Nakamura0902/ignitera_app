-- =====================================================
-- IGNITERA 初期スキーマ
-- Supabase SQL Editorで実行するか、supabase db push で適用
-- =====================================================

-- 拡張機能
create extension if not exists "uuid-ossp";

-- =====================================================
-- profiles (auth.usersと1:1)
-- =====================================================
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  role text not null check (role in ('student', 'operator', 'company')) default 'student',
  display_name text not null,
  avatar_url text,
  fcm_token text,  -- プッシュ通知用
  created_at timestamptz default now()
);

-- 新規ユーザー登録時に自動でprofileを作成するトリガー (任意)
-- ※ Webアプリからも登録するため、Web側でも同様の処理が必要

-- =====================================================
-- student_profiles
-- =====================================================
create table public.student_profiles (
  id uuid primary key references public.profiles(id) on delete cascade,
  university text,
  faculty text,
  grade int check (grade between 1 and 6),
  skills text[] default '{}',
  portfolio_url text,
  instagram_handle text,
  -- 個人情報 (企業からは非表示)
  real_name text,
  email text,
  phone text
);

-- =====================================================
-- companies (アプリ登録は任意)
-- =====================================================
create table public.companies (
  id uuid primary key default uuid_generate_v4(),
  name text not null,
  industry text,
  size text,
  description text,
  created_by uuid references public.profiles(id),
  claimed_by uuid references public.profiles(id),  -- 企業がクレーム後にset
  verified boolean default false,
  created_at timestamptz default now()
);

-- =====================================================
-- projects (案件)
-- =====================================================
create table public.projects (
  id uuid primary key default uuid_generate_v4(),
  company_id uuid not null references public.companies(id),
  title text not null,
  description text,
  status text not null check (status in (
    'pending_approval', 'approved', 'team_forming', 'in_progress', 'completed'
  )) default 'pending_approval',
  acquired_by uuid not null references public.profiles(id),
  deadline date,
  budget numeric,
  created_at timestamptz default now()
);

-- =====================================================
-- teams
-- =====================================================
create table public.teams (
  id uuid primary key default uuid_generate_v4(),
  project_id uuid not null references public.projects(id) on delete cascade,
  formed_by uuid references public.profiles(id),
  formed_at timestamptz default now()
);

-- =====================================================
-- team_members
-- =====================================================
create table public.team_members (
  id uuid primary key default uuid_generate_v4(),
  team_id uuid not null references public.teams(id) on delete cascade,
  student_id uuid not null references public.profiles(id),
  role text,
  joined_at timestamptz default now(),
  unique(team_id, student_id)
);

-- =====================================================
-- tasks
-- =====================================================
create table public.tasks (
  id uuid primary key default uuid_generate_v4(),
  team_id uuid not null references public.teams(id) on delete cascade,
  assigned_to uuid references public.profiles(id),
  title text not null,
  status text not null check (status in ('todo', 'in_progress', 'done')) default 'todo',
  due_date date,
  created_at timestamptz default now()
);

-- =====================================================
-- progress_updates (進捗)
-- =====================================================
create table public.progress_updates (
  id uuid primary key default uuid_generate_v4(),
  project_id uuid not null references public.projects(id) on delete cascade,
  reporter_id uuid not null references public.profiles(id),
  percentage int check (percentage between 0 and 100),
  note text,
  is_official boolean default false,
  created_at timestamptz default now()
);

-- =====================================================
-- calendar_events
-- =====================================================
create table public.calendar_events (
  id uuid primary key default uuid_generate_v4(),
  project_id uuid references public.projects(id) on delete cascade,
  team_id uuid references public.teams(id) on delete cascade,
  type text not null check (type in ('meeting', 'deadline', 'milestone')),
  title text not null,
  start_at timestamptz not null,
  end_at timestamptz,
  created_by uuid references public.profiles(id),
  created_at timestamptz default now()
);

-- =====================================================
-- availabilities (空き時間)
-- =====================================================
create table public.availabilities (
  id uuid primary key default uuid_generate_v4(),
  student_id uuid not null references public.profiles(id) on delete cascade,
  start_at timestamptz not null,
  end_at timestamptz not null
);

-- =====================================================
-- messages (チャット)
-- =====================================================
create table public.messages (
  id uuid primary key default uuid_generate_v4(),
  team_id uuid not null references public.teams(id) on delete cascade,
  sender_id uuid not null references public.profiles(id),
  content text,
  file_url text,
  created_at timestamptz default now()
);

-- =====================================================
-- evaluations (評価 / 将来実装)
-- =====================================================
create table public.evaluations (
  id uuid primary key default uuid_generate_v4(),
  project_id uuid not null references public.projects(id),
  from_id uuid not null references public.profiles(id),
  to_id uuid not null references public.profiles(id),
  type text not null check (type in ('company_to_student', 'student_to_company')),
  score int check (score between 1 and 5),
  comment text,
  created_at timestamptz default now()
);

-- =====================================================
-- notifications
-- =====================================================
create table public.notifications (
  id uuid primary key default uuid_generate_v4(),
  recipient_id uuid not null references public.profiles(id) on delete cascade,
  type text not null,
  title text not null,
  body text,
  data jsonb,
  read boolean default false,
  created_at timestamptz default now()
);

-- =====================================================
-- diagnosis_results (本格診断結果 / Webアプリから保存)
-- =====================================================
create table public.diagnosis_results (
  id uuid primary key default uuid_generate_v4(),
  student_id uuid not null unique references public.profiles(id) on delete cascade,
  score_behavior int check (score_behavior between 0 and 100),
  score_growth int check (score_growth between 0 and 100),
  score_values int check (score_values between 0 and 100),
  type_name text,
  type_description text,
  culture_matches jsonb,  -- [{ "culture": "成長重視", "score": 85 }, ...]
  raw_scores jsonb,       -- 詳細スコア (将来拡張用)
  diagnosed_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- =====================================================
-- RLS (Row Level Security) 設定
-- =====================================================

-- 全テーブルでRLSを有効化
alter table public.profiles enable row level security;
alter table public.student_profiles enable row level security;
alter table public.companies enable row level security;
alter table public.projects enable row level security;
alter table public.teams enable row level security;
alter table public.team_members enable row level security;
alter table public.tasks enable row level security;
alter table public.progress_updates enable row level security;
alter table public.calendar_events enable row level security;
alter table public.availabilities enable row level security;
alter table public.messages enable row level security;
alter table public.evaluations enable row level security;
alter table public.notifications enable row level security;
alter table public.diagnosis_results enable row level security;

-- =====================================================
-- profiles RLS
-- =====================================================
-- 自分のprofileは読み書き可能
create policy "profiles: self read/write"
  on public.profiles for all
  using (auth.uid() = id)
  with check (auth.uid() = id);

-- 全員が他ユーザーのprofileを読める (公開情報)
create policy "profiles: anyone can read"
  on public.profiles for select
  using (true);

-- =====================================================
-- student_profiles RLS
-- =====================================================
-- 自分のプロフィールは読み書き可能
create policy "student_profiles: self all"
  on public.student_profiles for all
  using (auth.uid() = id)
  with check (auth.uid() = id);

-- 運営は全員読める
create policy "student_profiles: operator read"
  on public.student_profiles for select
  using (
    exists (
      select 1 from public.profiles
      where id = auth.uid() and role = 'operator'
    )
  );

-- 企業は個人情報以外を読める (real_name, email, phoneは除く)
-- ※実装上はビューまたはアプリ側でフィルタリング推奨
create policy "student_profiles: company read public"
  on public.student_profiles for select
  using (
    exists (
      select 1 from public.profiles
      where id = auth.uid() and role = 'company'
    )
  );

-- =====================================================
-- companies RLS
-- =====================================================
-- 誰でも企業情報を読める
create policy "companies: public read"
  on public.companies for select
  using (true);

-- 認証済みユーザーは企業を作成可能
create policy "companies: auth users can create"
  on public.companies for insert
  with check (auth.uid() is not null);

-- 運営は全操作可能
create policy "companies: operator all"
  on public.companies for all
  using (
    exists (
      select 1 from public.profiles
      where id = auth.uid() and role = 'operator'
    )
  );

-- =====================================================
-- projects RLS
-- =====================================================
-- 認証済みユーザーは案件を読める
create policy "projects: auth read"
  on public.projects for select
  using (auth.uid() is not null);

-- 学生は案件を登録可能 (pending_approvalのみ)
create policy "projects: student insert"
  on public.projects for insert
  with check (
    auth.uid() = acquired_by
    and exists (
      select 1 from public.profiles
      where id = auth.uid() and role = 'student'
    )
  );

-- 運営は全操作可能
create policy "projects: operator all"
  on public.projects for all
  using (
    exists (
      select 1 from public.profiles
      where id = auth.uid() and role = 'operator'
    )
  );

-- =====================================================
-- messages RLS (チームメンバーのみ)
-- =====================================================
create policy "messages: team members only"
  on public.messages for all
  using (
    exists (
      select 1 from public.team_members
      where team_id = messages.team_id and student_id = auth.uid()
    )
    or exists (
      select 1 from public.profiles
      where id = auth.uid() and role = 'operator'
    )
  );

-- =====================================================
-- notifications RLS (自分のみ)
-- =====================================================
create policy "notifications: self only"
  on public.notifications for all
  using (auth.uid() = recipient_id)
  with check (auth.uid() = recipient_id);

-- =====================================================
-- diagnosis_results RLS
-- =====================================================
-- 本人は読み書き可能
create policy "diagnosis: self all"
  on public.diagnosis_results for all
  using (auth.uid() = student_id)
  with check (auth.uid() = student_id);

-- 企業・運営は読める (企業は採用・案件マッチング判断に使用)
create policy "diagnosis: others read"
  on public.diagnosis_results for select
  using (auth.uid() is not null);

-- =====================================================
-- インデックス
-- =====================================================
create index on public.projects(acquired_by);
create index on public.projects(status);
create index on public.team_members(student_id);
create index on public.team_members(team_id);
create index on public.messages(team_id);
create index on public.notifications(recipient_id, read);
create index on public.calendar_events(start_at);
create index on public.diagnosis_results(student_id);
