import { supabase } from "../supabaseClient";

export interface RkosAnalysisInput {
  case_id: string;
  analysis_id?: string;
  user_id?: string; // Optional - Supabase users table may not have this user
  mindstudio_run_id?: string;
  flow_version?: string;
}

export interface RkosAnalysisResult {
  chance_of_success?: number;
  confidence_level?: string;
  summary_verdict?: string;
  assessment?: string;
  facts?: string[];
  strengths?: string[];
  weaknesses?: string[];
  risks?: string[];
  legal_analysis?: any;
  recommended_claims?: any;
  applicable_laws?: any;
  missing_elements?: any;
}

export interface RkosAnalysisRecord {
  id: string;
  case_id: string;
  analysis_id: string | null;
  user_id: string;
  mindstudio_run_id: string | null;
  flow_version: string | null;
  status: "pending" | "completed" | "failed";
  started_at: string;
  completed_at: string | null;
  chance_of_success: number | null;
  confidence_level: string | null;
  summary_verdict: string | null;
  assessment: string | null;
  facts: string[] | null;
  strengths: string[] | null;
  weaknesses: string[] | null;
  risks: string[] | null;
  legal_analysis: any | null;
  recommended_claims: any | null;
  applicable_laws: any | null;
  missing_elements: any | null;
  raw_payload: any | null;
  created_at: string;
}

interface SupabaseRkosRow {
  id: string;
  case_id: string;
  analysis_id: string | null;
  user_id: string;
  mindstudio_run_id: string | null;
  flow_version: string | null;
  status: string;
  started_at: string;
  completed_at: string | null;
  chance_of_success: number | null;
  confidence_level: string | null;
  summary_verdict: string | null;
  assessment: string | null;
  facts: string[] | null;
  strengths: string[] | null;
  weaknesses: string[] | null;
  risks: string[] | null;
  legal_analysis: any | null;
  recommended_claims: any | null;
  applicable_laws: any | null;
  missing_elements: any | null;
  raw_payload: any | null;
  created_at: string;
}

// Helper to parse array items that might be stringified JSON objects
function parseArrayItems(arr: any[] | null): any[] | null {
  if (!Array.isArray(arr)) return null;
  return arr.map(item => {
    if (typeof item === 'string' && item.startsWith('{')) {
      try {
        return JSON.parse(item);
      } catch {
        return item;
      }
    }
    return item;
  });
}

function mapRowToRecord(row: SupabaseRkosRow): RkosAnalysisRecord {
  return {
    id: row.id,
    case_id: row.case_id,
    analysis_id: row.analysis_id,
    user_id: row.user_id,
    mindstudio_run_id: row.mindstudio_run_id,
    flow_version: row.flow_version,
    status: row.status as "pending" | "completed" | "failed",
    started_at: row.started_at,
    completed_at: row.completed_at,
    chance_of_success: row.chance_of_success,
    confidence_level: row.confidence_level,
    summary_verdict: row.summary_verdict,
    assessment: row.assessment,
    facts: parseArrayItems(row.facts),
    strengths: parseArrayItems(row.strengths),
    weaknesses: parseArrayItems(row.weaknesses),
    risks: parseArrayItems(row.risks),
    legal_analysis: row.legal_analysis,
    recommended_claims: row.recommended_claims,
    applicable_laws: row.applicable_laws,
    missing_elements: row.missing_elements,
    raw_payload: row.raw_payload,
    created_at: row.created_at,
  };
}

export class RkosServiceError extends Error {
  constructor(message: string, public readonly originalError?: any) {
    super(message);
    this.name = "RkosServiceError";
  }
}

export const rkosAnalysisService = {
  // Create a completed RKOS analysis directly (without pending step)
  async createCompletedAnalysis(
    input: RkosAnalysisInput,
    result: RkosAnalysisResult,
    rawPayload: any
  ): Promise<RkosAnalysisRecord> {
    const insertData: any = {
      case_id: input.case_id,
      analysis_id: input.analysis_id || null,
      mindstudio_run_id: input.mindstudio_run_id || null,
      flow_version: input.flow_version || "RKOS.flow",
      status: "completed",
      started_at: new Date().toISOString(),
      completed_at: new Date().toISOString(),
      chance_of_success: result.chance_of_success ?? null,
      confidence_level: result.confidence_level || null,
      summary_verdict: result.summary_verdict || null,
      assessment: result.assessment || null,
      facts: Array.isArray(result.facts) ? result.facts : [],
      strengths: Array.isArray(result.strengths) ? result.strengths : [],
      weaknesses: Array.isArray(result.weaknesses) ? result.weaknesses : [],
      risks: Array.isArray(result.risks) ? result.risks : [],
      legal_analysis: result.legal_analysis || null,
      recommended_claims: result.recommended_claims || null,
      applicable_laws: result.applicable_laws || null,
      missing_elements: result.missing_elements || null,
      raw_payload: rawPayload || null,
    };
    
    // Only include user_id if provided (avoid foreign key constraint issues)
    if (input.user_id) {
      insertData.user_id = input.user_id;
    }

    const { data, error } = await supabase
      .from("rkos_analyses")
      .insert(insertData)
      .select()
      .single();

    if (error) {
      console.error("Supabase createCompletedAnalysis error:", error);
      throw new RkosServiceError("Failed to create completed RKOS analysis", error);
    }

    if (!data) {
      throw new RkosServiceError("No data returned from createCompletedAnalysis");
    }

    console.log(`✅ Created completed RKOS analysis: ${data.id}`);
    return mapRowToRecord(data);
  },

  async createPendingAnalysis(
    input: RkosAnalysisInput
  ): Promise<RkosAnalysisRecord> {
    const insertData: any = {
      case_id: input.case_id,
      analysis_id: input.analysis_id || null,
      mindstudio_run_id: input.mindstudio_run_id || null,
      flow_version: input.flow_version || "RKOS.flow",
      status: "pending",
      started_at: new Date().toISOString(),
    };
    
    // Only include user_id if provided
    if (input.user_id) {
      insertData.user_id = input.user_id;
    }

    const { data, error } = await supabase
      .from("rkos_analyses")
      .insert(insertData)
      .select()
      .single();

    if (error) {
      console.error("Supabase createPendingAnalysis error:", error);
      throw new RkosServiceError("Failed to create pending RKOS analysis", error);
    }

    if (!data) {
      throw new RkosServiceError("No data returned from createPendingAnalysis");
    }

    console.log(`✅ Created pending RKOS analysis: ${data.id}`);
    return mapRowToRecord(data);
  },

  async markCompleted(
    id: string,
    result: RkosAnalysisResult,
    rawPayload: any
  ): Promise<RkosAnalysisRecord> {
    const { data, error } = await supabase
      .from("rkos_analyses")
      .update({
        status: "completed",
        completed_at: new Date().toISOString(),
        chance_of_success: result.chance_of_success ?? null,
        confidence_level: result.confidence_level || null,
        summary_verdict: result.summary_verdict || null,
        assessment: result.assessment || null,
        facts: Array.isArray(result.facts) ? result.facts : [],
        strengths: Array.isArray(result.strengths) ? result.strengths : [],
        weaknesses: Array.isArray(result.weaknesses) ? result.weaknesses : [],
        risks: Array.isArray(result.risks) ? result.risks : [],
        legal_analysis: result.legal_analysis || null,
        recommended_claims: result.recommended_claims || null,
        applicable_laws: result.applicable_laws || null,
        missing_elements: result.missing_elements || null,
        raw_payload: rawPayload || null,
      })
      .eq("id", id)
      .select()
      .single();

    if (error) {
      console.error("Supabase markCompleted error:", error);
      throw new RkosServiceError(`Failed to mark RKOS analysis ${id} as completed`, error);
    }

    if (!data) {
      throw new RkosServiceError(`No data returned from markCompleted for ${id}`);
    }

    console.log(`✅ RKOS analysis marked completed: ${id}`);
    return mapRowToRecord(data);
  },

  async markFailed(
    id: string,
    errorInfo: any
  ): Promise<RkosAnalysisRecord> {
    const { data, error } = await supabase
      .from("rkos_analyses")
      .update({
        status: "failed",
        completed_at: new Date().toISOString(),
        raw_payload: { error: errorInfo },
      })
      .eq("id", id)
      .select()
      .single();

    if (error) {
      console.error("Supabase markFailed error:", error);
      throw new RkosServiceError(`Failed to mark RKOS analysis ${id} as failed`, error);
    }

    if (!data) {
      throw new RkosServiceError(`No data returned from markFailed for ${id}`);
    }

    console.log(`❌ RKOS analysis marked failed: ${id}`);
    return mapRowToRecord(data);
  },

  async getAnalysesByCaseId(
    caseId: string
  ): Promise<RkosAnalysisRecord[]> {
    try {
      const { data, error } = await supabase
        .from("rkos_analyses")
        .select("*")
        .eq("case_id", caseId)
        .order("created_at", { ascending: false });

      if (error) {
        console.error("Supabase getAnalysesByCaseId error:", error);
        return [];
      }

      return data ? data.map(mapRowToRecord) : [];
    } catch (error) {
      console.error("Error fetching RKOS analyses:", error);
      return [];
    }
  },

  async getLatestCompletedAnalysis(
    caseId: string
  ): Promise<RkosAnalysisRecord | null> {
    try {
      const { data, error } = await supabase
        .from("rkos_analyses")
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
        console.error("Supabase getLatestCompletedAnalysis error:", error);
        return null;
      }

      return data ? mapRowToRecord(data) : null;
    } catch (error) {
      console.error("Error fetching latest RKOS analysis:", error);
      return null;
    }
  },

  async getAnalysisById(id: string): Promise<RkosAnalysisRecord | null> {
    try {
      const { data, error } = await supabase
        .from("rkos_analyses")
        .select("*")
        .eq("id", id)
        .single();

      if (error) {
        if (error.code === "PGRST116") {
          return null;
        }
        console.error("Supabase getAnalysisById error:", error);
        return null;
      }

      return data ? mapRowToRecord(data) : null;
    } catch (error) {
      console.error("Error fetching RKOS analysis by id:", error);
      return null;
    }
  },
};
