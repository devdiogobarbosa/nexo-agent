export const MIGRATION_SQL = `
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  role TEXT NOT NULL,
  department TEXT NOT NULL,
  initials TEXT NOT NULL,
  windows_version TEXT,
  password_changed_at TEXT
);
CREATE TABLE IF NOT EXISTS articles (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  tags TEXT NOT NULL,
  windows_version TEXT
);
CREATE TABLE IF NOT EXISTS tickets (
  id TEXT PRIMARY KEY,
  type TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  category TEXT NOT NULL,
  priority TEXT NOT NULL,
  status TEXT NOT NULL,
  requester_id TEXT NOT NULL,
  affected_scope TEXT NOT NULL,
  opened_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  resolved_at TEXT,
  due_at TEXT NOT NULL,
  assignee_id TEXT,
  last_event TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS conversations (
  id TEXT PRIMARY KEY,
  employee_id TEXT NOT NULL,
  state TEXT NOT NULL,
  assignee_id TEXT,
  session_message_count INTEGER NOT NULL DEFAULT 0,
  daily_count INTEGER NOT NULL DEFAULT 0,
  daily_day TEXT NOT NULL,
  summary TEXT,
  updated_at TEXT NOT NULL,
  closed_at TEXT
);
CREATE TABLE IF NOT EXISTS messages (
  id TEXT PRIMARY KEY,
  conversation_id TEXT NOT NULL,
  role TEXT NOT NULL,
  author_name TEXT NOT NULL,
  text TEXT NOT NULL,
  created_at TEXT NOT NULL,
  decision_json TEXT,
  payload_json TEXT
);
CREATE TABLE IF NOT EXISTS drafts (
  id TEXT PRIMARY KEY,
  conversation_id TEXT NOT NULL,
  employee_id TEXT NOT NULL,
  payload_json TEXT NOT NULL,
  status TEXT NOT NULL,
  resulting_ticket_id TEXT,
  created_at TEXT NOT NULL
);
`;
