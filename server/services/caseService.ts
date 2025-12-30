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
  owner_user_id: string;
  title: string;
  description: string | null;
  category: string | null;
  claim_amount: string | null;
  claimant_name: string | null;
  claimant_address: string | null;
  claimant_city: string | null;
  counterparty_type: string | null;
  counterparty_name: string | null;
  counterparty_email: string | null;
  counterparty_phone: string | null;
  counterparty_address: string | null;
  counterparty_city: string | null;
  counterparty_user_id: string | null;
  user_role: string | null;
  counterparty_description_approved: boolean | null;
  status: string | null;
  current_step: string | null;
  next_action_label: string | null;
  has_unseen_missing_items: boolean | null;
  needs_reanalysis: boolean | null;
  created_at: string | null;
  updated_at: string | null;
}

function mapSupabaseToInternal(row: SupabaseCaseRow): Case {
  return {
    id: row.id,
    ownerUserId: row.owner_user_id,
    title: row.title,
    description: row.description,
    category: row.category,
    claimAmount: row.claim_amount,
    claimantName: row.claimant_name,
    claimantAddress: row.claimant_address,
    claimantCity: row.claimant_city,
    counterpartyType: row.counterparty_type,
    counterpartyName: row.counterparty_name,
    counterpartyEmail: row.counterparty_email,
    counterpartyPhone: row.counterparty_phone,
    counterpartyAddress: row.counterparty_address,
    counterpartyCity: row.counterparty_city,
    counterpartyUserId: row.counterparty_user_id,
    userRole: (row.user_role as "EISER" | "GEDAAGDE") || "EISER",
    counterpartyDescriptionApproved: row.counterparty_description_approved ?? false,
    status: (row.status as CaseStatus) || "NEW_INTAKE",
    currentStep: row.current_step,
    nextActionLabel: row.next_action_label,
    hasUnseenMissingItems: row.has_unseen_missing_items ?? false,
    needsReanalysis: row.needs_reanalysis ?? false,
    createdAt: row.created_at ? new Date(row.created_at) : new Date(),
    updatedAt: row.updated_at ? new Date(row.updated_at) : new Date(),
  };
}

function mapInternalToSupabase(caseData: Partial<InsertCase> & { id?: string }): Partial<SupabaseCaseRow> {
  const mapped: Partial<SupabaseCaseRow> = {};
  
  if (caseData.id !== undefined) mapped.id = caseData.id;
  if (caseData.ownerUserId !== undefined) mapped.owner_user_id = ensureUuid(caseData.ownerUserId);
  if (caseData.title !== undefined) mapped.title = caseData.title;
  if (caseData.description !== undefined) mapped.description = caseData.description;
  if (caseData.category !== undefined) mapped.category = caseData.category;
  if (caseData.claimAmount !== undefined) mapped.claim_amount = caseData.claimAmount;
  if (caseData.claimantName !== undefined) mapped.claimant_name = caseData.claimantName;
  if (caseData.claimantAddress !== undefined) mapped.claimant_address = caseData.claimantAddress;
  if (caseData.claimantCity !== undefined) mapped.claimant_city = caseData.claimantCity;
  if (caseData.counterpartyType !== undefined) mapped.counterparty_type = caseData.counterpartyType;
  if (caseData.counterpartyName !== undefined) mapped.counterparty_name = caseData.counterpartyName;
  if (caseData.counterpartyEmail !== undefined) mapped.counterparty_email = caseData.counterpartyEmail;
  if (caseData.counterpartyPhone !== undefined) mapped.counterparty_phone = caseData.counterpartyPhone;
  if (caseData.counterpartyAddress !== undefined) mapped.counterparty_address = caseData.counterpartyAddress;
  if (caseData.counterpartyCity !== undefined) mapped.counterparty_city = caseData.counterpartyCity;
  if (caseData.counterpartyUserId !== undefined) mapped.counterparty_user_id = caseData.counterpartyUserId;
  if (caseData.userRole !== undefined) mapped.user_role = caseData.userRole;
  if (caseData.counterpartyDescriptionApproved !== undefined) mapped.counterparty_description_approved = caseData.counterpartyDescriptionApproved;
  if (caseData.status !== undefined) mapped.status = caseData.status;
  if (caseData.currentStep !== undefined) mapped.current_step = caseData.currentStep;
  if (caseData.nextActionLabel !== undefined) mapped.next_action_label = caseData.nextActionLabel;
  if (caseData.hasUnseenMissingItems !== undefined) mapped.has_unseen_missing_items = caseData.hasUnseenMissingItems;
  if (caseData.needsReanalysis !== undefined) mapped.needs_reanalysis = caseData.needsReanalysis;
  
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
      .eq("owner_user_id", uuid)
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
      .eq("owner_user_id", uuid)
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

  async updateCaseStatus(id: string, status: CaseStatus, currentStep?: string, nextActionLabel?: string): Promise<Case> {
    const supabaseUpdates: Partial<SupabaseCaseRow> = {
      status,
      updated_at: new Date().toISOString(),
    };
    
    if (currentStep !== undefined) {
      supabaseUpdates.current_step = currentStep;
    }
    if (nextActionLabel !== undefined) {
      supabaseUpdates.next_action_label = nextActionLabel;
    }

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
