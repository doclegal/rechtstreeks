import { supabase } from "../supabaseClient";
import { randomUUID, createHash } from "crypto";

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

export interface SavedJurisprudenceRow {
  id: string;
  user_id: string;
  case_id: string;
  ecli: string;
  court: string | null;
  court_level: string | null;
  decision_date: string | null;
  legal_area: string | null;
  procedure_type: string | null;
  title: string | null;
  source_url: string | null;
  text_fragment: string | null;
  ai_feiten: string | null;
  ai_geschil: string | null;
  ai_beslissing: string | null;
  ai_motivering: string | null;
  ai_inhoudsindicatie: string | null;
  search_score: number | null;
  search_namespace: string | null;
  search_query: string | null;
  user_notes: string | null;
  saved_at: string;
}

export interface SaveJurisprudenceInput {
  userId: string;
  caseId: string;
  ecli: string;
  court?: string | null;
  courtLevel?: string | null;
  decisionDate?: string | null;
  legalArea?: string | null;
  procedureType?: string | null;
  title?: string | null;
  sourceUrl?: string | null;
  textFragment?: string | null;
  aiFeiten?: string | null;
  aiGeschil?: string | null;
  aiBeslissing?: string | null;
  aiMotivering?: string | null;
  aiInhoudsindicatie?: string | null;
  searchScore?: number | null;
  searchNamespace?: string | null;
  searchQuery?: string | null;
  userNotes?: string | null;
}

export interface SavedJurisprudence {
  id: string;
  userId: string;
  caseId: string;
  ecli: string;
  court: string | null;
  courtLevel: string | null;
  decisionDate: string | null;
  legalArea: string | null;
  procedureType: string | null;
  title: string | null;
  sourceUrl: string | null;
  textFragment: string | null;
  aiFeiten: string | null;
  aiGeschil: string | null;
  aiBeslissing: string | null;
  aiMotivering: string | null;
  aiInhoudsindicatie: string | null;
  searchScore: number | null;
  searchNamespace: string | null;
  searchQuery: string | null;
  userNotes: string | null;
  savedAt: Date;
}

function mapRowToSavedJurisprudence(row: SavedJurisprudenceRow): SavedJurisprudence {
  return {
    id: row.id,
    userId: row.user_id,
    caseId: row.case_id,
    ecli: row.ecli,
    court: row.court,
    courtLevel: row.court_level,
    decisionDate: row.decision_date,
    legalArea: row.legal_area,
    procedureType: row.procedure_type,
    title: row.title,
    sourceUrl: row.source_url,
    textFragment: row.text_fragment,
    aiFeiten: row.ai_feiten,
    aiGeschil: row.ai_geschil,
    aiBeslissing: row.ai_beslissing,
    aiMotivering: row.ai_motivering,
    aiInhoudsindicatie: row.ai_inhoudsindicatie,
    searchScore: row.search_score,
    searchNamespace: row.search_namespace,
    searchQuery: row.search_query,
    userNotes: row.user_notes,
    savedAt: new Date(row.saved_at),
  };
}

function mapInputToRow(input: SaveJurisprudenceInput): Partial<SavedJurisprudenceRow> {
  return {
    user_id: ensureUuid(input.userId),
    case_id: input.caseId,
    ecli: input.ecli,
    court: input.court ?? null,
    court_level: input.courtLevel ?? null,
    decision_date: input.decisionDate ?? null,
    legal_area: input.legalArea ?? null,
    procedure_type: input.procedureType ?? null,
    title: input.title ?? null,
    source_url: input.sourceUrl ?? null,
    text_fragment: input.textFragment ?? null,
    ai_feiten: input.aiFeiten ?? null,
    ai_geschil: input.aiGeschil ?? null,
    ai_beslissing: input.aiBeslissing ?? null,
    ai_motivering: input.aiMotivering ?? null,
    ai_inhoudsindicatie: input.aiInhoudsindicatie ?? null,
    search_score: input.searchScore ?? null,
    search_namespace: input.searchNamespace ?? null,
    search_query: input.searchQuery ?? null,
    user_notes: input.userNotes ?? null,
  };
}

class SavedJurisprudenceServiceError extends Error {
  constructor(public statusCode: number, message: string) {
    super(message);
    this.name = "SavedJurisprudenceServiceError";
  }
}

export const savedJurisprudenceService = {
  async saveJurisprudence(input: SaveJurisprudenceInput): Promise<SavedJurisprudence> {
    const id = randomUUID();
    const now = new Date().toISOString();

    const rowData = {
      id,
      ...mapInputToRow(input),
      saved_at: now,
    };

    const { data, error } = await supabase
      .from("saved_jurisprudence")
      .insert(rowData)
      .select()
      .single();

    if (error) {
      if (error.code === "23505") {
        throw new SavedJurisprudenceServiceError(409, "Deze uitspraak is al opgeslagen voor deze zaak");
      }
      console.error("Supabase saveJurisprudence error:", error);
      throw new SavedJurisprudenceServiceError(500, "Kon uitspraak niet opslaan");
    }

    return mapRowToSavedJurisprudence(data);
  },

  async getSavedForCase(caseId: string, userId: string): Promise<SavedJurisprudence[]> {
    const userUuid = ensureUuid(userId);

    const { data, error } = await supabase
      .from("saved_jurisprudence")
      .select("*")
      .eq("case_id", caseId)
      .eq("user_id", userUuid)
      .order("saved_at", { ascending: false });

    if (error) {
      console.error("Supabase getSavedForCase error:", error);
      throw new SavedJurisprudenceServiceError(500, "Kon opgeslagen uitspraken niet ophalen");
    }

    return (data || []).map(mapRowToSavedJurisprudence);
  },

  async deleteSavedJurisprudence(id: string, userId: string): Promise<void> {
    const userUuid = ensureUuid(userId);

    const { error } = await supabase
      .from("saved_jurisprudence")
      .delete()
      .eq("id", id)
      .eq("user_id", userUuid);

    if (error) {
      console.error("Supabase deleteSavedJurisprudence error:", error);
      throw new SavedJurisprudenceServiceError(500, "Kon uitspraak niet verwijderen");
    }
  },

  async deleteByEcli(caseId: string, ecli: string, userId: string): Promise<void> {
    const userUuid = ensureUuid(userId);

    const { error } = await supabase
      .from("saved_jurisprudence")
      .delete()
      .eq("case_id", caseId)
      .eq("ecli", ecli)
      .eq("user_id", userUuid);

    if (error) {
      console.error("Supabase deleteByEcli error:", error);
      throw new SavedJurisprudenceServiceError(500, "Kon uitspraak niet verwijderen");
    }
  },

  async isEcliSaved(caseId: string, ecli: string, userId: string): Promise<boolean> {
    const userUuid = ensureUuid(userId);

    const { data, error } = await supabase
      .from("saved_jurisprudence")
      .select("id")
      .eq("case_id", caseId)
      .eq("ecli", ecli)
      .eq("user_id", userUuid)
      .maybeSingle();

    if (error) {
      console.error("Supabase isEcliSaved error:", error);
      return false;
    }

    return data !== null;
  },

  async updateNotes(id: string, userId: string, notes: string): Promise<SavedJurisprudence> {
    const userUuid = ensureUuid(userId);

    const { data, error } = await supabase
      .from("saved_jurisprudence")
      .update({ user_notes: notes })
      .eq("id", id)
      .eq("user_id", userUuid)
      .select()
      .single();

    if (error) {
      console.error("Supabase updateNotes error:", error);
      throw new SavedJurisprudenceServiceError(500, "Kon notities niet updaten");
    }

    return mapRowToSavedJurisprudence(data);
  },
};
