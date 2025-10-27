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

// User role enum (who is the user in the dispute?)
export const userRoleEnum = pgEnum("user_role", [
  "EISER",      // User is the claimant/plaintiff
  "GEDAAGDE"    // User is the defendant/respondent
]);

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
  
  // Claimant (eiser) information
  claimantName: text("claimant_name"),
  claimantAddress: text("claimant_address"),
  claimantCity: varchar("claimant_city"),
  
  // Counterparty (gedaagde) information
  counterpartyType: varchar("counterparty_type"), // individual, company
  counterpartyName: text("counterparty_name"),
  counterpartyEmail: varchar("counterparty_email"),
  counterpartyPhone: varchar("counterparty_phone"),
  counterpartyAddress: text("counterparty_address"),
  counterpartyCity: varchar("counterparty_city"),
  
  userRole: userRoleEnum("user_role").default("EISER").notNull(), // Who is the user? Default: claimant (for dagvaarding)
  status: caseStatusEnum("status").default("NEW_INTAKE"),
  currentStep: varchar("current_step"),
  nextActionLabel: varchar("next_action_label"),
  hasUnseenMissingItems: boolean("has_unseen_missing_items").default(false), // Set to true after analysis if missing items exist, cleared on Dossier page visit
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
  documentAnalysis: jsonb("document_analysis"), // AI analysis: summary, tags, type, readability, belongs_to_case, note
  analysisStatus: varchar("analysis_status").default("pending"), // pending, analyzing, completed, failed
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [
  index("idx_documents_case").on(table.caseId),
  index("idx_documents_created").on(table.createdAt),
]);

export const analyses = pgTable("analyses", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  caseId: varchar("case_id").notNull().references(() => cases.id, { onDelete: "cascade" }),
  version: integer("version").notNull().default(1), // v1, v2, v3, etc.
  model: varchar("model").notNull(),
  rawText: text("raw_text"),
  
  // MindStudio structured response
  analysisJson: jsonb("analysis_json"), // Main structured legal analysis
  extractedTexts: jsonb("extracted_texts"), // Documents with extracted text
  missingInfoStruct: jsonb("missing_info_struct"), // UI-ready missing-info items
  allFiles: jsonb("all_files"), // Consolidated file list
  
  // User and procedure context (from MindStudio)
  userContext: jsonb("user_context"), // User's procedural role (eiser/gedaagde) + legal role (koper/huurder/etc)
  procedureContext: jsonb("procedure_context"), // Procedural info (kantonzaak, court type, confidence)
  
  // Legacy fields (kept for backwards compatibility)
  factsJson: jsonb("facts_json"),
  issuesJson: jsonb("issues_json"),
  missingDocsJson: jsonb("missing_docs_json"),
  legalBasisJson: jsonb("legal_basis_json"),
  riskNotesJson: jsonb("risk_notes_json"),
  
  // Second run support
  prevAnalysisId: varchar("prev_analysis_id"), // Link to previous version (self-reference)
  missingInfoAnswers: jsonb("missing_info_answers"), // User answers to missing info questions
  
  // Success chance assessment (RKOS - Redelijke Kans Op Succes)
  succesKansAnalysis: jsonb("succes_kans_analysis"), // RKOS evaluation result
  
  // Legal advice (from Create_advice.flow)
  legalAdviceJson: jsonb("legal_advice_json"), // Structured legal advice (het_geschil, de_feiten, juridische_duiding, vervolgstappen, samenvatting_advies)
  
  // Missing information (from missing_info.flow)
  missingInformation: jsonb("missing_information"), // Consolidated missing info from RKOS and Create_advice flows [{item, why_needed}]
  
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [
  index("idx_analyses_case").on(table.caseId),
  index("idx_analyses_version").on(table.caseId, table.version),
]);

export const letters = pgTable("letters", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  caseId: varchar("case_id").notNull().references(() => cases.id, { onDelete: "cascade" }),
  templateId: varchar("template_id"),
  briefType: varchar("brief_type"), // LAATSTE_AANMANING, INGEBREKESTELLING, INFORMATIEVERZOEK
  tone: varchar("tone"), // zakelijk-vriendelijk, formeel, streng
  html: text("html"),
  markdown: text("markdown"),
  pdfStorageKey: text("pdf_storage_key"),
  status: varchar("status").default("draft"), // draft, reviewed, sent
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [
  index("idx_letters_case").on(table.caseId),
]);

// Section status enum for multi-step summons generation (must be before summons table)
export const summonsSectionStatusEnum = pgEnum("summons_section_status", [
  "pending",
  "generating",
  "draft",
  "needs_changes",
  "approved"
]);

export const summons = pgTable("summons", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  caseId: varchar("case_id").notNull().references(() => cases.id, { onDelete: "cascade" }),
  templateId: varchar("template_id"),
  templateVersion: varchar("template_version").default("v1"),
  userFieldsJson: jsonb("user_fields_json"), // User-filled fields (names, dates, amounts, etc.)
  aiFieldsJson: jsonb("ai_fields_json"), // AI-generated narrative sections
  dataJson: jsonb("data_json"), // Legacy: Complete SummonsV1 structure from MindStudio
  readinessJson: jsonb("readiness_json"), // Readiness check result from DV_Questions.flow
  userResponsesJson: jsonb("user_responses_json"), // User answers to missing items and clarifying questions
  html: text("html"),
  markdown: text("markdown"),
  pdfStorageKey: text("pdf_storage_key"),
  status: varchar("status").default("draft"), // draft, generating, ready, reviewed, filed
  generationError: text("generation_error"),
  isMultiStep: boolean("is_multi_step").default(false), // Whether this summons uses multi-step generation
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  index("idx_summons_case").on(table.caseId),
]);

// Multi-step summons sections (for 7-step dagvaarding)
export const summonsSections = pgTable("summons_sections", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  summonsId: varchar("summons_id").notNull().references(() => summons.id, { onDelete: "cascade" }),
  sectionKey: varchar("section_key").notNull(), // e.g., "VORDERINGEN", "FEITEN", "RECHTSGRONDEN"
  sectionName: text("section_name").notNull(), // Display name
  stepOrder: integer("step_order").notNull(), // 1-7 for ordering
  status: summonsSectionStatusEnum("status").default("pending"),
  flowName: varchar("flow_name"), // MindStudio flow to call for this section
  feedbackVariableName: varchar("feedback_variable_name"), // Variable name for user feedback in MindStudio
  generatedText: text("generated_text"), // AI-generated text for this section
  userFeedback: text("user_feedback"), // User comments/corrections for regeneration
  generationCount: integer("generation_count").default(0), // How many times generated
  warningsJson: jsonb("warnings_json"), // MindStudio warnings array from generation
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  index("idx_summons_sections_summons").on(table.summonsId),
  index("idx_summons_sections_order").on(table.summonsId, table.stepOrder),
]);

export const templates = pgTable("templates", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  kind: varchar("kind").notNull(), // letter, summons
  name: text("name").notNull(),
  version: varchar("version").notNull(),
  bodyMarkdown: text("body_markdown").notNull(),
  fieldsJson: jsonb("fields_json"),
  validationsJson: jsonb("validations_json"),
  
  // Template parsing and flow linking
  rawTemplateText: text("raw_template_text"), // Original template text with [user] and {ai} fields
  userFieldsJson: jsonb("user_fields_json"), // Parsed [user] field keys with occurrences
  aiFieldsJson: jsonb("ai_fields_json"), // Parsed {ai} field keys with occurrences
  fieldOccurrences: jsonb("field_occurrences"), // Count of each field occurrence
  
  // MindStudio flow linking (single-step templates)
  mindstudioFlowName: varchar("mindstudio_flow_name"), // Name of linked MindStudio flow
  mindstudioFlowId: varchar("mindstudio_flow_id"), // ID of linked MindStudio flow
  launchVariables: jsonb("launch_variables"), // Array of variable names expected as input (Start block)
  returnDataKeys: jsonb("return_data_keys"), // Array of JSON keys the flow returns (End block)
  
  // Multi-step configuration (for 7-step dagvaarding)
  isMultiStep: boolean("is_multi_step").default(false), // Whether this template uses multi-step generation
  sectionsConfig: jsonb("sections_config"), // Array of section configs: [{sectionKey, sectionName, stepOrder, flowName, feedbackVariableName, aiFieldKey}]
  
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
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

// Warranty/Guarantee Management Tables
export const warrantyProducts = pgTable("warranty_products", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  ownerUserId: varchar("owner_user_id").notNull().references(() => users.id),
  productName: text("product_name").notNull(),
  brand: varchar("brand"),
  model: varchar("model"),
  serialNumber: varchar("serial_number"),
  purchaseDate: timestamp("purchase_date"),
  purchasePrice: decimal("purchase_price", { precision: 10, scale: 2 }),
  supplier: text("supplier"), // where bought
  warrantyDuration: varchar("warranty_duration"), // e.g., "2 jaar", "6 maanden"
  warrantyExpiry: timestamp("warranty_expiry"),
  category: varchar("category"), // electronics, appliances, tools, etc.
  description: text("description"),
  status: varchar("status").default("active"), // active, claimed, expired
  websiteUrl: text("website_url"), // link to product page or terms
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  index("idx_warranty_products_owner").on(table.ownerUserId),
  index("idx_warranty_products_created").on(table.createdAt),
  index("idx_warranty_products_expiry").on(table.warrantyExpiry),
]);

export const warrantyDocuments = pgTable("warranty_documents", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  productId: varchar("product_id").notNull().references(() => warrantyProducts.id, { onDelete: "cascade" }),
  filename: text("filename").notNull(),
  storageKey: text("storage_key").notNull(),
  mimetype: varchar("mimetype").notNull(),
  sizeBytes: integer("size_bytes").notNull(),
  documentType: varchar("document_type").notNull(), // receipt, warranty, terms, delivery_note, manual, other
  extractedText: text("extracted_text"),
  publicUrl: text("public_url"),
  uploadedByUserId: varchar("uploaded_by_user_id").notNull().references(() => users.id),
  description: text("description"), // optional description by user
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [
  index("idx_warranty_documents_product").on(table.productId),
  index("idx_warranty_documents_type").on(table.documentType),
  index("idx_warranty_documents_created").on(table.createdAt),
]);

// Relations
export const usersRelations = relations(users, ({ many }) => ({
  cases: many(cases),
  uploadedDocuments: many(caseDocuments),
  events: many(events),
  warrantyProducts: many(warrantyProducts),
  warrantyDocuments: many(warrantyDocuments),
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

export const warrantyProductsRelations = relations(warrantyProducts, ({ one, many }) => ({
  owner: one(users, {
    fields: [warrantyProducts.ownerUserId],
    references: [users.id],
  }),
  documents: many(warrantyDocuments),
}));

export const warrantyDocumentsRelations = relations(warrantyDocuments, ({ one }) => ({
  product: one(warrantyProducts, {
    fields: [warrantyDocuments.productId],
    references: [warrantyProducts.id],
  }),
  uploadedBy: one(users, {
    fields: [warrantyDocuments.uploadedByUserId],
    references: [users.id],
  }),
}));

// Insert and select schemas
export const insertCaseSchema = createInsertSchema(cases).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
}).extend({
  // Allow claimAmount to be string or number and coerce to string for database
  claimAmount: z.union([z.string(), z.number()]).optional().nullable()
    .transform((val) => {
      if (val === null || val === undefined || val === '') return null;
      if (typeof val === 'number') return val.toString();
      if (typeof val === 'string' && val.trim() !== '') {
        const num = parseFloat(val);
        return isNaN(num) ? val : num.toString();
      }
      return val;
    })
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

export const insertSummonsSectionSchema = createInsertSchema(summonsSections).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertTemplateSchema = createInsertSchema(templates).omit({
  id: true,
  createdAt: true,
});

export const insertEventSchema = createInsertSchema(events).omit({
  id: true,
  createdAt: true,
});

export const insertWarrantyProductSchema = createInsertSchema(warrantyProducts).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertWarrantyDocumentSchema = createInsertSchema(warrantyDocuments).omit({
  id: true,
  createdAt: true,
});

// Missing Info / Requirements schemas
export const missingRequirementSchema = z.object({
  id: z.string(),
  key: z.string(),
  label: z.string(),
  description: z.string().optional(),
  required: z.boolean().default(true),
  inputKind: z.enum(['document', 'text', 'choice', 'date', 'number']).default('text'),
  acceptMimes: z.array(z.string()).optional(),
  maxLength: z.number().optional(),
  options: z.array(z.object({
    value: z.string(),
    label: z.string(),
  })).optional(),
  examples: z.array(z.string()).optional(),
});

export const missingInfoResponseSchema = z.object({
  requirementId: z.string().min(1, "requirementId is required"),
  kind: z.enum(['document', 'text', 'choice', 'date', 'number', 'not_available']),
  value: z.string().trim().min(1).optional(),
  documentId: z.string().min(1).optional(),
}).refine(
  (data) => {
    // If kind is 'not_available', no value or documentId is required
    if (data.kind === 'not_available') {
      return true;
    }
    // Otherwise, exactly one of value or documentId must be provided (XOR)
    const hasValue = !!data.value && data.value.length > 0;
    const hasDocumentId = !!data.documentId && data.documentId.length > 0;
    return hasValue !== hasDocumentId; // XOR: one must be true, the other false
  },
  {
    message: "Either 'value' or 'documentId' must be provided (unless kind is 'not_available')",
  }
);

export const submitMissingInfoRequestSchema = z.object({
  responses: z.array(missingInfoResponseSchema),
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
export type SummonsSection = typeof summonsSections.$inferSelect;
export type InsertSummonsSection = z.infer<typeof insertSummonsSectionSchema>;
export type SummonsSectionStatus = typeof summonsSections.status.enumValues[number];
export type Template = typeof templates.$inferSelect;
export type InsertTemplate = z.infer<typeof insertTemplateSchema>;
export type Event = typeof events.$inferSelect;
export type InsertEvent = z.infer<typeof insertEventSchema>;
export type WarrantyProduct = typeof warrantyProducts.$inferSelect;
export type InsertWarrantyProduct = z.infer<typeof insertWarrantyProductSchema>;
export type WarrantyDocument = typeof warrantyDocuments.$inferSelect;
export type InsertWarrantyDocument = z.infer<typeof insertWarrantyDocumentSchema>;
export type CaseStatus = typeof cases.status.enumValues[number];
export type MissingRequirement = z.infer<typeof missingRequirementSchema>;
export type MissingInfoResponse = z.infer<typeof missingInfoResponseSchema>;
export type SubmitMissingInfoRequest = z.infer<typeof submitMissingInfoRequestSchema>;
