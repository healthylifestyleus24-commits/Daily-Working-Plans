import { pgTable, serial, text, timestamp, boolean, integer } from "drizzle-orm/pg-core";

// Main tasks table - stores today and tomorrow plans
export const tasks = pgTable("tasks", {
  id: serial("id").primaryKey(),
  type: text("type").notNull(), // 'today' | 'tomorrow'
  content: text("content").notNull().default(""),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
  scheduledTransferAt: timestamp("scheduled_transfer_at"), // when tomorrow tasks should transfer
  transferred: boolean("transferred").default(false).notNull(),
});

// Task history - archives of previous plans by date
export const taskHistory = pgTable("task_history", {
  id: serial("id").primaryKey(),
  date: text("date").notNull(), // YYYY-MM-DD
  todayContent: text("today_content").notNull().default(""),
  tomorrowContent: text("tomorrow_content").notNull().default(""),
  savedAt: timestamp("saved_at").defaultNow().notNull(),
});

// Completed tasks
export const completedTasks = pgTable("completed_tasks", {
  id: serial("id").primaryKey(),
  content: text("content").notNull(),
  sourceType: text("source_type").notNull(), // 'today' | 'tomorrow'
  completedAt: timestamp("completed_at").defaultNow().notNull(),
});

// Recycle bin - soft deleted items
export const recycleBin = pgTable("recycle_bin", {
  id: serial("id").primaryKey(),
  content: text("content").notNull(),
  sourceType: text("source_type").notNull(), // 'today' | 'tomorrow'
  originalDate: text("original_date").notNull(),
  deletedAt: timestamp("deleted_at").defaultNow().notNull(),
  expiresAt: timestamp("expires_at").notNull(), // auto-delete after 30 days
});

// App settings
export const settings = pgTable("settings", {
  id: serial("id").primaryKey(),
  key: text("key").notNull().unique(),
  value: text("value").notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});
