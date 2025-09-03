import { sql } from 'drizzle-orm';
import {
  index,
  jsonb,
  pgTable,
  timestamp,
  varchar,
  text,
  integer,
  decimal,
  boolean,
  pgEnum,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// Session storage table (mandatory for Replit Auth)
export const sessions = pgTable(
  "sessions",
  {
    sid: varchar("sid").primaryKey(),
    sess: jsonb("sess").notNull(),
    expire: timestamp("expire").notNull(),
  },
  (table) => [index("IDX_session_expire").on(table.expire)],
);

// User storage table (mandatory for Replit Auth)
export const users = pgTable("users", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  email: varchar("email").unique(),
  firstName: varchar("first_name"),
  lastName: varchar("last_name"),
  profileImageUrl: varchar("profile_image_url"),
  role: varchar("role").default("user"), // user, reviewer, admin
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Case status enum
export const caseStatusEnum = pgEnum("case_status", [
  "NEW_INTAKE",
  "DOCS_UPLOADED", 
  "ANALYZED",
  "LETTER_DRAFTED",
  "BAILIFF_ORDERED",
  "SERVED",
  "SUMMONS_DRAFTED",
  "FILED",
  "PROCEEDINGS_ONGOING",
  "JUDGMENT"
]);

export const cases = pgTable("cases", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  ownerUserId: varchar("owner_user_id").notNull().references(() => users.id),
  title: text("title").notNull(),
  category: varchar("category"),
  description: text("description"),
  claimAmount: decimal("claim_amount", { precision: 10, scale: 2 }),
  counterpartyType: varchar("counterparty_type"), // individual, company
  counterpartyName: text("counterparty_name"),
  counterpartyEmail: varchar("counterparty_email"),
  counterpartyPhone: varchar("counterparty_phone"),
  counterpartyAddress: text("counterparty_address"),
  status: caseStatusEnum("status").default("NEW_INTAKE"),
  currentStep: varchar("current_step"),
  nextActionLabel: varchar("next_action_label"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  index("idx_cases_owner").on(table.ownerUserId),
  index("idx_cases_status").on(table.status),
  index("idx_cases_created").on(table.createdAt),
]);

export const caseDocuments = pgTable("case_documents", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  caseId: varchar("case_id").notNull().references(() => cases.id, { onDelete: "cascade" }),
  filename: text("filename").notNull(),
  storageKey: text("storage_key").notNull(),
  mimetype: varchar("mimetype").notNull(),
  sizeBytes: integer("size_bytes").notNull(),
  extractedText: text("extracted_text"),
  publicUrl: text("public_url"), // Add public URL for object storage
  uploadedByUserId: varchar("uploaded_by_user_id").notNull().references(() => users.id),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [
  index("idx_documents_case").on(table.caseId),
  index("idx_documents_created").on(table.createdAt),
]);

export const analyses = pgTable("analyses", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  caseId: varchar("case_id").notNull().references(() => cases.id, { onDelete: "cascade" }),
  model: varchar("model").notNull(),
  rawText: text("raw_text"), // Add raw analysis text
  factsJson: jsonb("facts_json"),
  issuesJson: jsonb("issues_json"),
  missingDocsJson: jsonb("missing_docs_json"),
  legalBasisJson: jsonb("legal_basis_json"),
  riskNotesJson: jsonb("risk_notes_json"),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [
  index("idx_analyses_case").on(table.caseId),
]);

export const letters = pgTable("letters", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  caseId: varchar("case_id").notNull().references(() => cases.id, { onDelete: "cascade" }),
  templateId: varchar("template_id"),
  html: text("html"),
  markdown: text("markdown"),
  pdfStorageKey: text("pdf_storage_key"),
  status: varchar("status").default("draft"), // draft, reviewed, sent
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [
  index("idx_letters_case").on(table.caseId),
]);

export const summons = pgTable("summons", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  caseId: varchar("case_id").notNull().references(() => cases.id, { onDelete: "cascade" }),
  templateId: varchar("template_id"),
  html: text("html"),
  markdown: text("markdown"),
  pdfStorageKey: text("pdf_storage_key"),
  status: varchar("status").default("draft"), // draft, reviewed, filed
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [
  index("idx_summons_case").on(table.caseId),
]);

export const templates = pgTable("templates", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  kind: varchar("kind").notNull(), // letter, summons
  name: text("name").notNull(),
  version: varchar("version").notNull(),
  bodyMarkdown: text("body_markdown").notNull(),
  fieldsJson: jsonb("fields_json"),
  validationsJson: jsonb("validations_json"),
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [
  index("idx_templates_kind").on(table.kind),
  index("idx_templates_active").on(table.isActive),
]);

export const events = pgTable("events", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  caseId: varchar("case_id").notNull().references(() => cases.id, { onDelete: "cascade" }),
  actorUserId: varchar("actor_user_id").notNull().references(() => users.id),
  type: varchar("type").notNull(),
  payloadJson: jsonb("payload_json"),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [
  index("idx_events_case").on(table.caseId),
  index("idx_events_created").on(table.createdAt),
]);

export const webhooks = pgTable("webhooks", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  caseId: varchar("case_id").references(() => cases.id, { onDelete: "cascade" }),
  url: text("url").notNull(),
  eventTypesJson: jsonb("event_types_json"),
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [
  index("idx_webhooks_case").on(table.caseId),
]);

export const settings = pgTable("settings", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  key: varchar("key").notNull().unique(),
  valueJson: jsonb("value_json"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Relations
export const usersRelations = relations(users, ({ many }) => ({
  cases: many(cases),
  uploadedDocuments: many(caseDocuments),
  events: many(events),
}));

export const casesRelations = relations(cases, ({ one, many }) => ({
  owner: one(users, {
    fields: [cases.ownerUserId],
    references: [users.id],
  }),
  documents: many(caseDocuments),
  analyses: many(analyses),
  letters: many(letters),
  summons: many(summons),
  events: many(events),
  webhooks: many(webhooks),
}));

export const caseDocumentsRelations = relations(caseDocuments, ({ one }) => ({
  case: one(cases, {
    fields: [caseDocuments.caseId],
    references: [cases.id],
  }),
  uploadedBy: one(users, {
    fields: [caseDocuments.uploadedByUserId],
    references: [users.id],
  }),
}));

export const analysesRelations = relations(analyses, ({ one }) => ({
  case: one(cases, {
    fields: [analyses.caseId],
    references: [cases.id],
  }),
}));

export const lettersRelations = relations(letters, ({ one }) => ({
  case: one(cases, {
    fields: [letters.caseId],
    references: [cases.id],
  }),
}));

export const summonsRelations = relations(summons, ({ one }) => ({
  case: one(cases, {
    fields: [summons.caseId],
    references: [cases.id],
  }),
}));

export const eventsRelations = relations(events, ({ one }) => ({
  case: one(cases, {
    fields: [events.caseId],
    references: [cases.id],
  }),
  actor: one(users, {
    fields: [events.actorUserId],
    references: [users.id],
  }),
}));

// Insert and select schemas
export const insertCaseSchema = createInsertSchema(cases).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertDocumentSchema = createInsertSchema(caseDocuments).omit({
  id: true,
  createdAt: true,
});

export const insertAnalysisSchema = createInsertSchema(analyses).omit({
  id: true,
  createdAt: true,
});

export const insertLetterSchema = createInsertSchema(letters).omit({
  id: true,
  createdAt: true,
});

export const insertSummonsSchema = createInsertSchema(summons).omit({
  id: true,
  createdAt: true,
});

export const insertTemplateSchema = createInsertSchema(templates).omit({
  id: true,
  createdAt: true,
});

export const insertEventSchema = createInsertSchema(events).omit({
  id: true,
  createdAt: true,
});

// Types
export type UpsertUser = typeof users.$inferInsert;
export type User = typeof users.$inferSelect;
export type Case = typeof cases.$inferSelect;
export type InsertCase = z.infer<typeof insertCaseSchema>;
export type CaseDocument = typeof caseDocuments.$inferSelect;
export type InsertCaseDocument = z.infer<typeof insertDocumentSchema>;
export type Analysis = typeof analyses.$inferSelect;
export type InsertAnalysis = z.infer<typeof insertAnalysisSchema>;
export type Letter = typeof letters.$inferSelect;
export type InsertLetter = z.infer<typeof insertLetterSchema>;
export type Summons = typeof summons.$inferSelect;
export type InsertSummons = z.infer<typeof insertSummonsSchema>;
export type Template = typeof templates.$inferSelect;
export type InsertTemplate = z.infer<typeof insertTemplateSchema>;
export type Event = typeof events.$inferSelect;
export type InsertEvent = z.infer<typeof insertEventSchema>;
export type CaseStatus = typeof cases.status.enumValues[number];
