import { supabase } from "../supabaseClient";
import { randomUUID, createHash } from "crypto";
import type { Case, InsertCase, CaseStatus } from "@shared/schema";

function replitIdToUuid(replitId: string): string {
  const hash = createHash('sha256').update(`replit-user-${replitId}`).digest('hex');
  return `${hash.slice(0, 8)}-${hash.slice(8, 12)}-4${hash.slice(13, 16)}-a${hash.slice(17, 20)}-${hash.slice(20, 32)}`;
}

function isValidUuid(str: string): boolean {
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  return uuidRegex.test(str);
}

function ensureUuid(userId: string): string {
  if (isValidUuid(userId)) {
    return userId;
  }
  return replitIdToUuid(userId);
}

interface SupabaseCaseRow {
  id: string;
  user_id: string;
  title: string;
  description: string | null;
  client_role: string;
  category: string | null;
  claim_amount_eur: number | null;
  client_name: string | null;
  client_address: string | null;
  client_city: string | null;
  opponent_type: string | null;
  opponent_company: string | null;
  opponent_email: string | null;
  opponent_phone: string | null;
  opponent_address: string | null;
  opponent_city: string | null;
  status: string | null;
  created_at: string | null;
  updated_at: string | null;
}

function mapSupabaseToInternal(row: SupabaseCaseRow): Case {
  return {
    id: row.id,
    ownerUserId: row.user_id,
    title: row.title,
    description: row.description,
    category: row.category,
    claimAmount: row.claim_amount_eur ? String(row.claim_amount_eur) : null,
    claimantName: row.client_name,
    claimantAddress: row.client_address,
    claimantCity: row.client_city,
    counterpartyType: row.opponent_type,
    counterpartyName: row.opponent_company,
    counterpartyEmail: row.opponent_email,
    counterpartyPhone: row.opponent_phone,
    counterpartyAddress: row.opponent_address,
    counterpartyCity: row.opponent_city,
    counterpartyUserId: null,
    userRole: (row.client_role as "EISER" | "GEDAAGDE") || "EISER",
    counterpartyDescriptionApproved: false,
    status: (row.status as CaseStatus) || "NEW_INTAKE",
    currentStep: null,
    nextActionLabel: null,
    hasUnseenMissingItems: false,
    needsReanalysis: false,
    createdAt: row.created_at ? new Date(row.created_at) : new Date(),
    updatedAt: row.updated_at ? new Date(row.updated_at) : new Date(),
  };
}

function mapInternalToSupabase(caseData: Partial<InsertCase> & { id?: string }): Partial<SupabaseCaseRow> {
  const mapped: Partial<SupabaseCaseRow> = {};
  
  if (caseData.id !== undefined) mapped.id = caseData.id;
  if (caseData.ownerUserId !== undefined) mapped.user_id = ensureUuid(caseData.ownerUserId);
  if (caseData.title !== undefined) mapped.title = caseData.title;
  if (caseData.description !== undefined) mapped.description = caseData.description;
  if (caseData.category !== undefined) mapped.category = caseData.category;
  if (caseData.claimAmount !== undefined) {
    mapped.claim_amount_eur = caseData.claimAmount ? parseFloat(caseData.claimAmount) : null;
  }
  if (caseData.claimantName !== undefined) mapped.client_name = caseData.claimantName;
  if (caseData.claimantAddress !== undefined) mapped.client_address = caseData.claimantAddress;
  if (caseData.claimantCity !== undefined) mapped.client_city = caseData.claimantCity;
  if (caseData.counterpartyType !== undefined) mapped.opponent_type = caseData.counterpartyType;
  if (caseData.counterpartyName !== undefined) mapped.opponent_company = caseData.counterpartyName;
  if (caseData.counterpartyEmail !== undefined) mapped.opponent_email = caseData.counterpartyEmail;
  if (caseData.counterpartyPhone !== undefined) mapped.opponent_phone = caseData.counterpartyPhone;
  if (caseData.counterpartyAddress !== undefined) mapped.opponent_address = caseData.counterpartyAddress;
  if (caseData.counterpartyCity !== undefined) mapped.opponent_city = caseData.counterpartyCity;
  if (caseData.userRole !== undefined) mapped.client_role = caseData.userRole;
  if (caseData.status !== undefined) mapped.status = caseData.status;
  
  return mapped;
}

class CaseServiceError extends Error {
  constructor(public statusCode: number, message: string) {
    super(message);
    this.name = "CaseServiceError";
  }
}

export const caseService = {
  async createCase(caseData: InsertCase): Promise<Case> {
    const now = new Date().toISOString();
    const id = randomUUID();
    
    const supabaseData = {
      ...mapInternalToSupabase({ ...caseData, id }),
      created_at: now,
      updated_at: now,
    };

    const { data, error } = await supabase
      .from("cases")
      .insert(supabaseData)
      .select()
      .single();

    if (error) {
      console.error("Supabase createCase error:", error);
      throw new CaseServiceError(500, `Failed to create case: ${error.message}`);
    }

    return mapSupabaseToInternal(data);
  },

  async getCasesForUser(userId: string): Promise<Case[]> {
    const uuid = ensureUuid(userId);
    const { data, error } = await supabase
      .from("cases")
      .select("*")
      .eq("user_id", uuid)
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Supabase getCasesForUser error:", error);
      throw new CaseServiceError(500, `Failed to get cases: ${error.message}`);
    }

    return (data || []).map(mapSupabaseToInternal);
  },

  async getCaseById(id: string): Promise<Case | undefined> {
    const { data, error } = await supabase
      .from("cases")
      .select("*")
      .eq("id", id)
      .single();

    if (error) {
      if (error.code === "PGRST116") {
        return undefined;
      }
      console.error("Supabase getCaseById error:", error);
      throw new CaseServiceError(500, `Failed to get case: ${error.message}`);
    }

    return data ? mapSupabaseToInternal(data) : undefined;
  },

  async getCaseByIdForUser(id: string, userId: string): Promise<Case | undefined> {
    const uuid = ensureUuid(userId);
    const { data, error } = await supabase
      .from("cases")
      .select("*")
      .eq("id", id)
      .eq("user_id", uuid)
      .single();

    if (error) {
      if (error.code === "PGRST116") {
        return undefined;
      }
      console.error("Supabase getCaseByIdForUser error:", error);
      throw new CaseServiceError(500, `Failed to get case: ${error.message}`);
    }

    return data ? mapSupabaseToInternal(data) : undefined;
  },

  async updateCase(id: string, updates: Partial<InsertCase>): Promise<Case> {
    const supabaseUpdates = {
      ...mapInternalToSupabase(updates),
      updated_at: new Date().toISOString(),
    };

    const { data, error } = await supabase
      .from("cases")
      .update(supabaseUpdates)
      .eq("id", id)
      .select()
      .single();

    if (error) {
      if (error.code === "PGRST116") {
        throw new CaseServiceError(404, "Case not found");
      }
      console.error("Supabase updateCase error:", error);
      throw new CaseServiceError(500, `Failed to update case: ${error.message}`);
    }

    return mapSupabaseToInternal(data);
  },

  async updateCaseStatus(id: string, status: CaseStatus, _currentStep?: string, _nextActionLabel?: string): Promise<Case> {
    const supabaseUpdates: Partial<SupabaseCaseRow> = {
      status,
      updated_at: new Date().toISOString(),
    };

    const { data, error } = await supabase
      .from("cases")
      .update(supabaseUpdates)
      .eq("id", id)
      .select()
      .single();

    if (error) {
      if (error.code === "PGRST116") {
        throw new CaseServiceError(404, "Case not found");
      }
      console.error("Supabase updateCaseStatus error:", error);
      throw new CaseServiceError(500, `Failed to update case status: ${error.message}`);
    }

    return mapSupabaseToInternal(data);
  },

  async deleteCase(id: string): Promise<void> {
    const { error } = await supabase
      .from("cases")
      .delete()
      .eq("id", id);

    if (error) {
      console.error("Supabase deleteCase error:", error);
      throw new CaseServiceError(500, `Failed to delete case: ${error.message}`);
    }
  },

  async touchCase(id: string): Promise<void> {
    const { error } = await supabase
      .from("cases")
      .update({ updated_at: new Date().toISOString() })
      .eq("id", id);

    if (error) {
      console.error("Supabase touchCase error:", error);
      throw new CaseServiceError(500, `Failed to touch case: ${error.message}`);
    }
  },
};
