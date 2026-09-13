import { index, integer, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";

export const users = sqliteTable(
  "users",
  {
    id: text("id").primaryKey(),
    username: text("username").notNull().unique(),
    passwordHash: text("password_hash").notNull(),
    role: text("role", { enum: ["admin", "user"] }).notNull().default("user"),
    timezone: text("timezone").notNull().default("Asia/Shanghai"),
    isActive: integer("is_active", { mode: "boolean" }).notNull().default(true),
    sessionVersion: integer("session_version").notNull().default(1),
    createdAt: text("created_at").notNull(),
    updatedAt: text("updated_at").notNull(),
  },
  (table) => [uniqueIndex("users_username_idx").on(table.username)],
);

export const sessions = sqliteTable(
  "sessions",
  {
    id: text("id").primaryKey(),
    userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    tokenHash: text("token_hash").notNull().unique(),
    expiresAt: text("expires_at").notNull(),
    createdAt: text("created_at").notNull(),
  },
  (table) => [index("sessions_user_idx").on(table.userId)],
);

export const themes = sqliteTable(
  "themes",
  {
    id: text("id").primaryKey(),
    userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    icon: text("icon").notNull().default("✓"),
    color: text("color").notNull().default("#73947c"),
    sortOrder: integer("sort_order").notNull().default(0),
    archivedAt: text("archived_at"),
    createdAt: text("created_at").notNull(),
    updatedAt: text("updated_at").notNull(),
  },
  (table) => [index("themes_user_idx").on(table.userId, table.archivedAt)],
);

export const tasks = sqliteTable(
  "tasks",
  {
    id: text("id").primaryKey(),
    userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    themeId: text("theme_id").notNull().references(() => themes.id, { onDelete: "cascade" }),
    title: text("title").notNull(),
    description: text("description").notNull().default(""),
    type: text("type", { enum: ["habit", "one_time"] }).notNull(),
    recurrenceMask: integer("recurrence_mask").notNull().default(127),
    dueDate: text("due_date"),
    completionScore: integer("completion_score").notNull().default(10),
    incompleteScore: integer("incomplete_score").notNull().default(0),
    sortOrder: integer("sort_order").notNull().default(0),
    archivedAt: text("archived_at"),
    createdAt: text("created_at").notNull(),
    updatedAt: text("updated_at").notNull(),
  },
  (table) => [index("tasks_user_theme_idx").on(table.userId, table.themeId, table.archivedAt)],
);

export const checkins = sqliteTable(
  "checkins",
  {
    id: text("id").primaryKey(),
    userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    taskId: text("task_id").notNull().references(() => tasks.id, { onDelete: "cascade" }),
    localDate: text("local_date").notNull(),
    note: text("note").notNull().default(""),
    awardedScore: integer("awarded_score").notNull().default(10),
    completedAt: text("completed_at").notNull(),
    updatedAt: text("updated_at").notNull(),
  },
  (table) => [
    uniqueIndex("checkins_task_date_idx").on(table.taskId, table.localDate),
    index("checkins_user_date_idx").on(table.userId, table.localDate),
  ],
);

export const summaries = sqliteTable(
  "summaries",
  {
    id: text("id").primaryKey(),
    userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    period: text("period", { enum: ["day", "week"] }).notNull(),
    startDate: text("start_date").notNull(),
    endDate: text("end_date").notNull(),
    themeId: text("theme_id"),
    sourceHash: text("source_hash").notNull(),
    statsJson: text("stats_json").notNull(),
    contentJson: text("content_json").notNull(),
    model: text("model").notNull(),
    createdAt: text("created_at").notNull(),
    updatedAt: text("updated_at").notNull(),
  },
  (table) => [index("summaries_lookup_idx").on(table.userId, table.period, table.startDate, table.endDate, table.themeId)],
);

export const aiUsage = sqliteTable(
  "ai_usage",
  {
    id: text("id").primaryKey(),
    userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    createdAt: text("created_at").notNull(),
  },
  (table) => [index("ai_usage_user_date_idx").on(table.userId, table.createdAt)],
);

export const taskScoreVersions = sqliteTable(
  "task_score_versions",
  {
    id: text("id").primaryKey(),
    userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    taskId: text("task_id").notNull().references(() => tasks.id, { onDelete: "cascade" }),
    completionScore: integer("completion_score").notNull(),
    incompleteScore: integer("incomplete_score").notNull(),
    effectiveDate: text("effective_date").notNull(),
    createdAt: text("created_at").notNull(),
  },
  (table) => [index("task_score_versions_lookup_idx").on(table.taskId, table.effectiveDate)],
);

export type User = typeof users.$inferSelect;
export type Theme = typeof themes.$inferSelect;
export type Task = typeof tasks.$inferSelect;
export type Checkin = typeof checkins.$inferSelect;
