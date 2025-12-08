import { supabase } from "../supabaseClient";

export interface LegalAdviceInput {
  case_id: string;
  user_id?: string; // Required by Supabase RLS policy
  mindstudio_run_id?: string;
  flow_version?: string;
}

export interface LegalAdviceResult {
  het_geschil?: string;
  de_feiten?: any;
  betwiste_punten?: string;
  beschikbaar_bewijs?: string;
  juridische_duiding?: any;
  vervolgstappen?: any;
  samenvatting_advies?: string;
  ontbrekend_bewijs?: any[];
}

export interface LegalAdviceRecord {
  id: string;
  case_id: string;
  user_id: string | null;
  mindstudio_run_id: string | null;
  flow_version: string | null;
  status: "pending" | "completed" | "failed";
  started_at: string;
  completed_at: string | null;
  het_geschil: string | null;
  de_feiten: any[] | null;
  juridische_duiding: any | null;
  vervolgstappen: any[] | null;
  samenvatting_advies: string | null;
  ontbrekend_bewijs: any[] | null;
  raw_payload: any | null;
  created_at: string;
}

interface SupabaseLegalAdviceRow {
  id: string;
  case_id: string;
  user_id: string | null;
  mindstudio_run_id: string | null;
  flow_version: string | null;
  status: string;
  started_at: string;
  completed_at: string | null;
  het_geschil: string | null;
  de_feiten: any[] | null;
  juridische_duiding: any | null;
  vervolgstappen: any[] | null;
  samenvatting_advies: string | null;
  ontbrekend_bewijs: any[] | null;
  raw_payload: any | null;
  created_at: string;
}

function mapRowToRecord(row: SupabaseLegalAdviceRow): LegalAdviceRecord {
  return {
    id: row.id,
    case_id: row.case_id,
    user_id: row.user_id,
    mindstudio_run_id: row.mindstudio_run_id,
    flow_version: row.flow_version,
    status: row.status as "pending" | "completed" | "failed",
    started_at: row.started_at,
    completed_at: row.completed_at,
    het_geschil: row.het_geschil,
    de_feiten: row.de_feiten,
    juridische_duiding: row.juridische_duiding,
    vervolgstappen: row.vervolgstappen,
    samenvatting_advies: row.samenvatting_advies,
    ontbrekend_bewijs: row.ontbrekend_bewijs,
    raw_payload: row.raw_payload,
    created_at: row.created_at,
  };
}

export class LegalAdviceServiceError extends Error {
  constructor(message: string, public readonly originalError?: any) {
    super(message);
    this.name = "LegalAdviceServiceError";
  }
}

export const legalAdviceService = {
  async createCompletedAdvice(
    input: LegalAdviceInput,
    result: LegalAdviceResult,
    rawPayload: any
  ): Promise<LegalAdviceRecord> {
    const insertData: any = {
      case_id: input.case_id,
      mindstudio_run_id: input.mindstudio_run_id || null,
      flow_version: input.flow_version || "Create_advice.flow",
      status: "completed",
      started_at: new Date().toISOString(),
      completed_at: new Date().toISOString(),
      het_geschil: result.het_geschil || null,
      de_feiten: result.de_feiten || null,
      betwiste_punten: result.betwiste_punten || null,
      beschikbaar_bewijs: result.beschikbaar_bewijs || null,
      juridische_duiding: result.juridische_duiding || null,
      vervolgstappen: result.vervolgstappen || null,
      samenvatting_advies: result.samenvatting_advies || null,
      ontbrekend_bewijs: Array.isArray(result.ontbrekend_bewijs) ? result.ontbrekend_bewijs : [],
      raw_payload: rawPayload || null,
    };
    
    // Include user_id if provided (required by Supabase RLS policy)
    if (input.user_id) {
      insertData.user_id = input.user_id;
    }

    const { data, error } = await supabase
      .from("legal_advice")
      .insert(insertData)
      .select()
      .single();

    if (error) {
      console.error("Supabase createCompletedAdvice error:", error);
      throw new LegalAdviceServiceError("Failed to create completed legal advice", error);
    }

    if (!data) {
      throw new LegalAdviceServiceError("No data returned from createCompletedAdvice");
    }

    console.log(`✅ Created completed legal advice: ${data.id}`);
    return mapRowToRecord(data);
  },

  async getAdviceByCaseId(caseId: string): Promise<LegalAdviceRecord[]> {
    try {
      const { data, error } = await supabase
        .from("legal_advice")
        .select("*")
        .eq("case_id", caseId)
        .order("created_at", { ascending: false });

      if (error) {
        console.error("Supabase getAdviceByCaseId error:", error);
        return [];
      }

      return data ? data.map(mapRowToRecord) : [];
    } catch (error) {
      console.error("Error fetching legal advice:", error);
      return [];
    }
  },

  async getLatestCompletedAdvice(caseId: string): Promise<LegalAdviceRecord | null> {
    try {
      const { data, error } = await supabase
        .from("legal_advice")
        .select("*")
        .eq("case_id", caseId)
        .eq("status", "completed")
        .order("completed_at", { ascending: false })
        .limit(1)
        .single();

      if (error) {
        if (error.code === "PGRST116") {
          return null;
        }
        console.error("Supabase getLatestCompletedAdvice error:", error);
        return null;
      }

      return data ? mapRowToRecord(data) : null;
    } catch (error) {
      console.error("Error fetching latest legal advice:", error);
      return null;
    }
  },

  async getAdviceById(id: string): Promise<LegalAdviceRecord | null> {
    try {
      const { data, error } = await supabase
        .from("legal_advice")
        .select("*")
        .eq("id", id)
        .single();

      if (error) {
        if (error.code === "PGRST116") {
          return null;
        }
        console.error("Supabase getAdviceById error:", error);
        return null;
      }

      return data ? mapRowToRecord(data) : null;
    } catch (error) {
      console.error("Error fetching legal advice by id:", error);
      return null;
    }
  },
};
