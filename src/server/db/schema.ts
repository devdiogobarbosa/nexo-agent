import { integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

export const users = sqliteTable("users", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  role: text("role").notNull(),
  department: text("department").notNull(),
  initials: text("initials").notNull(),
  windowsVersion: text("windows_version"),
  passwordChangedAt: text("password_changed_at"),
});

export const articles = sqliteTable("articles", {
  id: text("id").primaryKey(),
  title: text("title").notNull(),
  body: text("body").notNull(),
  tags: text("tags").notNull(),
  windowsVersion: text("windows_version"),
});

export const tickets = sqliteTable("tickets", {
  id: text("id").primaryKey(),
  type: text("type").notNull(),
  title: text("title").notNull(),
  description: text("description").notNull(),
  category: text("category").notNull(),
  priority: text("priority").notNull(),
  status: text("status").notNull(),
  requesterId: text("requester_id").notNull(),
  affectedScope: text("affected_scope").notNull(),
  openedAt: text("opened_at").notNull(),
  updatedAt: text("updated_at").notNull(),
  resolvedAt: text("resolved_at"),
  dueAt: text("due_at").notNull(),
  assigneeId: text("assignee_id"),
  lastEvent: text("last_event").notNull(),
});

export const conversations = sqliteTable("conversations", {
  id: text("id").primaryKey(),
  employeeId: text("employee_id").notNull(),
  state: text("state").notNull(),
  assigneeId: text("assignee_id"),
  sessionMessageCount: integer("session_message_count").notNull().default(0),
  dailyCount: integer("daily_count").notNull().default(0),
  dailyDay: text("daily_day").notNull(),
  summary: text("summary"),
  updatedAt: text("updated_at").notNull(),
  closedAt: text("closed_at"),
});

export const messages = sqliteTable("messages", {
  id: text("id").primaryKey(),
  conversationId: text("conversation_id").notNull(),
  role: text("role").notNull(),
  authorName: text("author_name").notNull(),
  text: text("text").notNull(),
  createdAt: text("created_at").notNull(),
  decisionJson: text("decision_json"),
  payloadJson: text("payload_json"),
});

export const drafts = sqliteTable("drafts", {
  id: text("id").primaryKey(),
  conversationId: text("conversation_id").notNull(),
  employeeId: text("employee_id").notNull(),
  payloadJson: text("payload_json").notNull(),
  status: text("status").notNull(),
  resultingTicketId: text("resulting_ticket_id"),
  createdAt: text("created_at").notNull(),
});
