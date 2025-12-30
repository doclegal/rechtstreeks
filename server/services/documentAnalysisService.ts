import { supabase, supabaseAdmin } from "../supabaseClient";
import type { SupabaseClient } from "@supabase/supabase-js";

export interface MindStudioAnalysis {
  document_name: string;
  document_type: string;
  is_readable: boolean;
  belongs_to_case: boolean;
  summary: string;
  tags: string[];
  note?: string | null;
}

export interface DocumentAnalysisRecord {
  id: string;
  document_id: string;
  user_id: string;
  document_name: string;
  document_type: string | null;
  is_readable: boolean;
  belongs_to_case: boolean;
  summary: string;
  tags: string[];
  note: string | null;
  created_at: string;
}

interface SupabaseDocumentAnalysisRow {
  id: string;
  document_id: string;
  user_id: string;
  document_name: string;
  document_type: string | null;
  is_readable: boolean;
  belongs_to_case: boolean;
  summary: string;
  tags: string[];
  note: string | null;
  created_at: string;
}

function mapRowToRecord(row: SupabaseDocumentAnalysisRow): DocumentAnalysisRecord {
  return {
    id: row.id,
    document_id: row.document_id,
    user_id: row.user_id,
    document_name: row.document_name,
    document_type: row.document_type,
    is_readable: row.is_readable,
    belongs_to_case: row.belongs_to_case,
    summary: row.summary,
    tags: Array.isArray(row.tags) ? row.tags : [],
    note: row.note,
    created_at: row.created_at,
  };
}

/**
 * Get the Supabase client - STRICT version
 * Throws error if no client provided (for RLS enforcement)
 */
function getClient(client?: SupabaseClient): SupabaseClient {
  if (!client) {
    throw new Error("documentAnalysisService: No Supabase client provided. Pass req.supabaseClient for RLS to work.");
  }
  return client;
}

export const documentAnalysisService = {
  async insertAnalysis(
    documentId: string,
    userId: string,
    analysis: MindStudioAnalysis,
    client?: SupabaseClient
  ): Promise<DocumentAnalysisRecord | null> {
    const db = getClient(client);
    
    try {
      const { data, error } = await db
        .from("document_analyses")
        .insert({
          document_id: documentId,
          user_id: userId,
          document_name: analysis.document_name,
          document_type: analysis.document_type || null,
          is_readable: analysis.is_readable ?? true,
          belongs_to_case: analysis.belongs_to_case ?? true,
          summary: analysis.summary,
          tags: analysis.tags || [],
          note: analysis.note || null,
        })
        .select()
        .single();

      if (error) {
        console.error("Supabase insertAnalysis error:", error);
        return null;
      }

      return data ? mapRowToRecord(data) : null;
    } catch (error) {
      console.error("Error inserting document analysis:", error);
      return null;
    }
  },

  async getAnalysisByDocumentId(
    documentId: string,
    userId: string,
    client?: SupabaseClient
  ): Promise<DocumentAnalysisRecord | null> {
    const db = getClient(client);
    
    try {
      const { data, error } = await db
        .from("document_analyses")
        .select("*")
        .eq("document_id", documentId)
        .eq("user_id", userId)
        .order("created_at", { ascending: false })
        .limit(1)
        .single();

      if (error) {
        if (error.code === "PGRST116") {
          return null;
        }
        console.error("Supabase getAnalysisByDocumentId error:", error);
        return null;
      }

      return data ? mapRowToRecord(data) : null;
    } catch (error) {
      console.error("Error fetching document analysis:", error);
      return null;
    }
  },

  async getAnalysesByDocumentIds(
    documentIds: string[],
    userId: string,
    client?: SupabaseClient
  ): Promise<Map<string, DocumentAnalysisRecord>> {
    const db = getClient(client);
    const analysesMap = new Map<string, DocumentAnalysisRecord>();
    
    if (documentIds.length === 0) {
      return analysesMap;
    }

    try {
      const { data, error } = await db
        .from("document_analyses")
        .select("*")
        .in("document_id", documentIds)
        .eq("user_id", userId)
        .order("created_at", { ascending: false });

      if (error) {
        console.error("Supabase getAnalysesByDocumentIds error:", error);
        return analysesMap;
      }

      if (data) {
        const latestByDocument = new Map<string, SupabaseDocumentAnalysisRow>();
        for (const row of data) {
          if (!latestByDocument.has(row.document_id)) {
            latestByDocument.set(row.document_id, row);
          }
        }
        
        Array.from(latestByDocument.entries()).forEach(([docId, row]) => {
          analysesMap.set(docId, mapRowToRecord(row));
        });
      }

      return analysesMap;
    } catch (error) {
      console.error("Error fetching document analyses:", error);
      return analysesMap;
    }
  },
};
