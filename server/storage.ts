import {
  users,
  cases,
  caseDocuments,
  analyses,
  letters,
  summons,
  templates,
  events,
  webhooks,
  settings,
  type User,
  type UpsertUser,
  type Case,
  type InsertCase,
  type CaseDocument,
  type InsertCaseDocument,
  type Analysis,
  type InsertAnalysis,
  type Letter,
  type InsertLetter,
  type Summons,
  type InsertSummons,
  type Template,
  type InsertTemplate,
  type Event,
  type InsertEvent,
  type CaseStatus,
} from "@shared/schema";
import { db } from "./db";
import { eq, desc, and } from "drizzle-orm";

export interface IStorage {
  // User operations (mandatory for Replit Auth)
  getUser(id: string): Promise<User | undefined>;
  upsertUser(user: UpsertUser): Promise<User>;
  
  // Case operations
  createCase(caseData: InsertCase): Promise<Case>;
  getCase(id: string): Promise<Case | undefined>;
  getCasesByUser(userId: string): Promise<Case[]>;
  updateCaseStatus(id: string, status: CaseStatus, currentStep?: string, nextActionLabel?: string): Promise<Case>;
  updateCase(id: string, updates: Partial<InsertCase>): Promise<Case>;
  
  // Document operations
  createDocument(docData: InsertCaseDocument): Promise<CaseDocument>;
  getDocumentsByCase(caseId: string): Promise<CaseDocument[]>;
  getDocument(id: string): Promise<CaseDocument | undefined>;
  deleteDocument(id: string): Promise<void>;
  touchCase(id: string): Promise<void>; // Update only timestamp
  
  // Analysis operations
  createAnalysis(analysisData: InsertAnalysis): Promise<Analysis>;
  getLatestAnalysis(caseId: string): Promise<Analysis | undefined>;
  getAnalysisByType(caseId: string, model: string): Promise<Analysis | undefined>;
  
  // Letter operations
  createLetter(letterData: InsertLetter): Promise<Letter>;
  getLettersByCase(caseId: string): Promise<Letter[]>;
  getLetter(id: string): Promise<Letter | undefined>;
  deleteLetter(id: string): Promise<void>;
  
  // Summons operations
  createSummons(summonsData: InsertSummons): Promise<Summons>;
  getSummonsByCase(caseId: string): Promise<Summons[]>;
  getSummons(id: string): Promise<Summons | undefined>;
  
  // Template operations
  getTemplates(kind?: string): Promise<Template[]>;
  getTemplate(id: string): Promise<Template | undefined>;
  createTemplate(templateData: InsertTemplate): Promise<Template>;
  updateTemplate(id: string, updates: Partial<InsertTemplate>): Promise<Template>;
  
  // Event operations
  createEvent(eventData: InsertEvent): Promise<Event>;
  getEventsByCase(caseId: string): Promise<Event[]>;
  getEventsByType(caseId: string, type: string): Promise<Event[]>;
  
  // Timeline and progress
  getCaseTimeline(caseId: string): Promise<Event[]>;
  computeProgress(caseData: Case): number;
}

export class DatabaseStorage implements IStorage {
  // User operations (mandatory for Replit Auth)
  async getUser(id: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user;
  }

  async upsertUser(userData: UpsertUser): Promise<User> {
    const [user] = await db
      .insert(users)
      .values(userData)
      .onConflictDoUpdate({
        target: users.email,
        set: {
          id: userData.id, // Update ID to the new OIDC subject
          firstName: userData.firstName,
          lastName: userData.lastName,
          profileImageUrl: userData.profileImageUrl,
          updatedAt: new Date(),
        },
      })
      .returning();
    return user;
  }

  // Case operations
  async createCase(caseData: InsertCase): Promise<Case> {
    const [newCase] = await db
      .insert(cases)
      .values({
        ...caseData,
        currentStep: "Indienen stukken",
        nextActionLabel: "Upload je documenten",
      })
      .returning();
    return newCase;
  }

  async getCase(id: string): Promise<Case | undefined> {
    const [caseData] = await db.select().from(cases).where(eq(cases.id, id));
    return caseData;
  }

  async getCasesByUser(userId: string): Promise<Case[]> {
    return await db
      .select()
      .from(cases)
      .where(eq(cases.ownerUserId, userId))
      .orderBy(desc(cases.updatedAt));
  }

  async updateCaseStatus(
    id: string, 
    status: CaseStatus, 
    currentStep?: string, 
    nextActionLabel?: string
  ): Promise<Case> {
    const [updatedCase] = await db
      .update(cases)
      .set({ 
        status, 
        currentStep, 
        nextActionLabel,
        updatedAt: new Date() 
      })
      .where(eq(cases.id, id))
      .returning();
    return updatedCase;
  }

  async updateCase(id: string, updates: Partial<InsertCase>): Promise<Case> {
    const [updatedCase] = await db
      .update(cases)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(cases.id, id))
      .returning();
    return updatedCase;
  }

  // Document operations
  async createDocument(docData: InsertCaseDocument): Promise<CaseDocument> {
    const [document] = await db
      .insert(caseDocuments)
      .values(docData)
      .returning();
    return document;
  }

  async getDocumentsByCase(caseId: string): Promise<CaseDocument[]> {
    return await db
      .select()
      .from(caseDocuments)
      .where(eq(caseDocuments.caseId, caseId))
      .orderBy(desc(caseDocuments.createdAt));
  }

  async getDocument(id: string): Promise<CaseDocument | undefined> {
    const [document] = await db
      .select()
      .from(caseDocuments)
      .where(eq(caseDocuments.id, id));
    return document;
  }

  async deleteDocument(id: string): Promise<void> {
    await db
      .delete(caseDocuments)
      .where(eq(caseDocuments.id, id));
  }

  async touchCase(id: string): Promise<void> {
    await db
      .update(cases)
      .set({ updatedAt: new Date() })
      .where(eq(cases.id, id));
  }

  // Analysis operations
  async createAnalysis(analysisData: InsertAnalysis): Promise<Analysis> {
    const [analysis] = await db
      .insert(analyses)
      .values(analysisData)
      .returning();
    return analysis;
  }

  async getLatestAnalysis(caseId: string): Promise<Analysis | undefined> {
    const [analysis] = await db
      .select()
      .from(analyses)
      .where(eq(analyses.caseId, caseId))
      .orderBy(desc(analyses.createdAt))
      .limit(1);
    return analysis;
  }

  async getAnalysisByType(caseId: string, model: string): Promise<Analysis | undefined> {
    const [analysis] = await db
      .select()
      .from(analyses)
      .where(and(eq(analyses.caseId, caseId), eq(analyses.model, model)))
      .orderBy(desc(analyses.createdAt))
      .limit(1);
    return analysis;
  }

  async getAnalysesByCase(caseId: string): Promise<Analysis[]> {
    const analysesData = await db
      .select()
      .from(analyses)
      .where(eq(analyses.caseId, caseId))
      .orderBy(desc(analyses.createdAt));
    return analysesData;
  }

  // Letter operations
  async createLetter(letterData: InsertLetter): Promise<Letter> {
    const [letter] = await db
      .insert(letters)
      .values(letterData)
      .returning();
    return letter;
  }

  async getLettersByCase(caseId: string): Promise<Letter[]> {
    return await db
      .select()
      .from(letters)
      .where(eq(letters.caseId, caseId))
      .orderBy(desc(letters.createdAt));
  }

  async getLetter(id: string): Promise<Letter | undefined> {
    const [letter] = await db
      .select()
      .from(letters)
      .where(eq(letters.id, id));
    return letter;
  }

  async deleteLetter(id: string): Promise<void> {
    await db.delete(letters).where(eq(letters.id, id));
  }

  // Summons operations
  async createSummons(summonsData: InsertSummons): Promise<Summons> {
    const [summon] = await db
      .insert(summons)
      .values(summonsData)
      .returning();
    return summon;
  }

  async getSummonsByCase(caseId: string): Promise<Summons[]> {
    return await db
      .select()
      .from(summons)
      .where(eq(summons.caseId, caseId))
      .orderBy(desc(summons.createdAt));
  }

  async getSummons(id: string): Promise<Summons | undefined> {
    const [summon] = await db
      .select()
      .from(summons)
      .where(eq(summons.id, id));
    return summon;
  }

  // Template operations
  async getTemplates(kind?: string): Promise<Template[]> {
    if (kind) {
      return await db
        .select()
        .from(templates)
        .where(and(eq(templates.isActive, true), eq(templates.kind, kind)))
        .orderBy(desc(templates.createdAt));
    }
    
    return await db
      .select()
      .from(templates)
      .where(eq(templates.isActive, true))
      .orderBy(desc(templates.createdAt));
  }

  async getTemplate(id: string): Promise<Template | undefined> {
    const [template] = await db
      .select()
      .from(templates)
      .where(eq(templates.id, id));
    return template;
  }

  async createTemplate(templateData: InsertTemplate): Promise<Template> {
    const [template] = await db
      .insert(templates)
      .values(templateData)
      .returning();
    return template;
  }

  async updateTemplate(id: string, updates: Partial<InsertTemplate>): Promise<Template> {
    const [template] = await db
      .update(templates)
      .set(updates)
      .where(eq(templates.id, id))
      .returning();
    return template;
  }

  // Event operations
  async createEvent(eventData: InsertEvent): Promise<Event> {
    const [event] = await db
      .insert(events)
      .values(eventData)
      .returning();
    return event;
  }

  async getEventsByCase(caseId: string): Promise<Event[]> {
    return await db
      .select()
      .from(events)
      .where(eq(events.caseId, caseId))
      .orderBy(desc(events.createdAt));
  }

  async getEventsByType(caseId: string, type: string): Promise<Event[]> {
    return await db
      .select()
      .from(events)
      .where(and(eq(events.caseId, caseId), eq(events.type, type)))
      .orderBy(desc(events.createdAt));
  }

  // Timeline and progress
  async getCaseTimeline(caseId: string): Promise<Event[]> {
    return await this.getEventsByCase(caseId);
  }

  computeProgress(caseData: Case): number {
    const stepOrder = [
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
    ];
    
    const currentIndex = stepOrder.indexOf(caseData.status || "NEW_INTAKE");
    if (currentIndex === -1) return 0;
    
    return Math.round(((currentIndex + 1) / stepOrder.length) * 100);
  }
}

export const storage = new DatabaseStorage();
