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

export interface SavedLegislationRow {
  id: string;
  user_id: string;
  case_id: string;
  bwb_id: string;
  article_number: string;
  law_title: string | null;
  boek_nummer: string | null;
  boek_titel: string | null;
  titel_nummer: string | null;
  titel_naam: string | null;
  article_text: string | null;
  valid_from: string | null;
  wetten_link: string | null;
  commentary_short_intro: string | null;
  commentary_systematiek: string | null;
  commentary_kernbegrippen: any | null;
  commentary_reikwijdte: string | null;
  jurisprudence_refs: any | null;
  online_sources: any | null;
  user_notes: string | null;
  saved_at: string;
  updated_at: string;
}

export interface SaveLegislationInput {
  userId: string;
  caseId: string;
  bwbId: string;
  articleNumber: string;
  lawTitle?: string | null;
  boekNummer?: string | null;
  boekTitel?: string | null;
  titelNummer?: string | null;
  titelNaam?: string | null;
  articleText?: string | null;
  validFrom?: string | null;
  wettenLink?: string | null;
  commentaryShortIntro?: string | null;
  commentarySystematiek?: string | null;
  commentaryKernbegrippen?: any | null;
  commentaryReikwijdte?: string | null;
  jurisprudenceRefs?: any | null;
  onlineSources?: any | null;
  userNotes?: string | null;
}

export interface SavedLegislation {
  id: string;
  userId: string;
  caseId: string;
  bwbId: string;
  articleNumber: string;
  lawTitle: string | null;
  boekNummer: string | null;
  boekTitel: string | null;
  titelNummer: string | null;
  titelNaam: string | null;
  articleText: string | null;
  validFrom: string | null;
  wettenLink: string | null;
  commentaryShortIntro: string | null;
  commentarySystematiek: string | null;
  commentaryKernbegrippen: any | null;
  commentaryReikwijdte: string | null;
  jurisprudenceRefs: any | null;
  onlineSources: any | null;
  userNotes: string | null;
  savedAt: Date;
  updatedAt: Date;
}

function mapRowToSavedLegislation(row: SavedLegislationRow): SavedLegislation {
  return {
    id: row.id,
    userId: row.user_id,
    caseId: row.case_id,
    bwbId: row.bwb_id,
    articleNumber: row.article_number,
    lawTitle: row.law_title,
    boekNummer: row.boek_nummer,
    boekTitel: row.boek_titel,
    titelNummer: row.titel_nummer,
    titelNaam: row.titel_naam,
    articleText: row.article_text,
    validFrom: row.valid_from,
    wettenLink: row.wetten_link,
    commentaryShortIntro: row.commentary_short_intro,
    commentarySystematiek: row.commentary_systematiek,
    commentaryKernbegrippen: row.commentary_kernbegrippen,
    commentaryReikwijdte: row.commentary_reikwijdte,
    jurisprudenceRefs: row.jurisprudence_refs,
    onlineSources: row.online_sources,
    userNotes: row.user_notes,
    savedAt: new Date(row.saved_at),
    updatedAt: new Date(row.updated_at),
  };
}

function mapInputToRow(input: SaveLegislationInput): Partial<SavedLegislationRow> {
  return {
    user_id: ensureUuid(input.userId),
    case_id: input.caseId,
    bwb_id: input.bwbId,
    article_number: input.articleNumber,
    law_title: input.lawTitle ?? null,
    boek_nummer: input.boekNummer ?? null,
    boek_titel: input.boekTitel ?? null,
    titel_nummer: input.titelNummer ?? null,
    titel_naam: input.titelNaam ?? null,
    article_text: input.articleText ?? null,
    valid_from: input.validFrom ?? null,
    wetten_link: input.wettenLink ?? null,
    commentary_short_intro: input.commentaryShortIntro ?? null,
    commentary_systematiek: input.commentarySystematiek ?? null,
    commentary_kernbegrippen: input.commentaryKernbegrippen ?? null,
    commentary_reikwijdte: input.commentaryReikwijdte ?? null,
    jurisprudence_refs: input.jurisprudenceRefs ?? null,
    online_sources: input.onlineSources ?? null,
    user_notes: input.userNotes ?? null,
  };
}

class SavedLegislationServiceError extends Error {
  constructor(public statusCode: number, message: string) {
    super(message);
    this.name = "SavedLegislationServiceError";
  }
}

export const savedLegislationService = {
  async saveLegislation(input: SaveLegislationInput): Promise<SavedLegislation> {
    const id = randomUUID();
    const now = new Date().toISOString();

    const rowData = {
      id,
      ...mapInputToRow(input),
      saved_at: now,
      updated_at: now,
    };

    const { data, error } = await supabase
      .from("saved_legislation")
      .insert(rowData)
      .select()
      .single();

    if (error) {
      if (error.code === "23505") {
        throw new SavedLegislationServiceError(409, "Dit artikel is al opgeslagen voor deze zaak");
      }
      console.error("Supabase saveLegislation error:", error);
      throw new SavedLegislationServiceError(500, "Kon artikel niet opslaan");
    }

    return mapRowToSavedLegislation(data);
  },

  async getSavedForCase(caseId: string, userId: string): Promise<SavedLegislation[]> {
    const userUuid = ensureUuid(userId);

    const { data, error } = await supabase
      .from("saved_legislation")
      .select("*")
      .eq("case_id", caseId)
      .eq("user_id", userUuid)
      .order("saved_at", { ascending: false });

    if (error) {
      console.error("Supabase getSavedForCase error:", error);
      throw new SavedLegislationServiceError(500, "Kon opgeslagen artikelen niet ophalen");
    }

    return (data || []).map(mapRowToSavedLegislation);
  },

  async deleteSavedLegislation(id: string, userId: string): Promise<void> {
    const userUuid = ensureUuid(userId);

    const { error } = await supabase
      .from("saved_legislation")
      .delete()
      .eq("id", id)
      .eq("user_id", userUuid);

    if (error) {
      console.error("Supabase deleteSavedLegislation error:", error);
      throw new SavedLegislationServiceError(500, "Kon artikel niet verwijderen");
    }
  },

  async deleteByArticle(caseId: string, bwbId: string, articleNumber: string, userId: string): Promise<void> {
    const userUuid = ensureUuid(userId);

    const { error } = await supabase
      .from("saved_legislation")
      .delete()
      .eq("case_id", caseId)
      .eq("bwb_id", bwbId)
      .eq("article_number", articleNumber)
      .eq("user_id", userUuid);

    if (error) {
      console.error("Supabase deleteByArticle error:", error);
      throw new SavedLegislationServiceError(500, "Kon artikel niet verwijderen");
    }
  },

  async isArticleSaved(caseId: string, bwbId: string, articleNumber: string, userId: string): Promise<boolean> {
    const userUuid = ensureUuid(userId);

    const { data, error } = await supabase
      .from("saved_legislation")
      .select("id")
      .eq("case_id", caseId)
      .eq("bwb_id", bwbId)
      .eq("article_number", articleNumber)
      .eq("user_id", userUuid)
      .maybeSingle();

    if (error) {
      console.error("Supabase isArticleSaved error:", error);
      return false;
    }

    return data !== null;
  },

  async updateNotes(id: string, userId: string, notes: string): Promise<SavedLegislation> {
    const userUuid = ensureUuid(userId);
    const now = new Date().toISOString();

    const { data, error } = await supabase
      .from("saved_legislation")
      .update({ user_notes: notes, updated_at: now })
      .eq("id", id)
      .eq("user_id", userUuid)
      .select()
      .single();

    if (error) {
      console.error("Supabase updateNotes error:", error);
      throw new SavedLegislationServiceError(500, "Kon notities niet updaten");
    }

    return mapRowToSavedLegislation(data);
  },
};
