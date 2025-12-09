import { supabase } from "../supabaseClient";
import { createHash } from "crypto";

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

interface SupabaseSavedLegislationRow {
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
  saved_at: string | null;
  updated_at: string | null;
}

export interface SavedLegislationItem {
  id: string;
  caseId: string;
  bwbId: string;
  articleNumber: string;
  articleKey: string;
  lawTitle: string | null;
  articleText: string | null;
  wettenLink: string | null;
  boekNummer: string | null;
  boekTitel: string | null;
  validFrom: string | null;
  leden: any;
  commentary: any;
  commentarySources: any;
  commentaryGeneratedAt: string | null;
  searchScore: string | null;
  searchRank: number | null;
  createdAt: string;
}

function mapSupabaseToInternal(row: SupabaseSavedLegislationRow): SavedLegislationItem {
  const commentary = row.commentary_short_intro || row.commentary_systematiek || row.commentary_kernbegrippen || row.commentary_reikwijdte
    ? {
        short_intro: row.commentary_short_intro,
        systematiek: row.commentary_systematiek,
        kernbegrippen: row.commentary_kernbegrippen,
        reikwijdte_en_beperkingen: row.commentary_reikwijdte,
      }
    : null;

  const sources = row.jurisprudence_refs || row.online_sources
    ? {
        jurisprudence: row.jurisprudence_refs || [],
        onlineSources: row.online_sources || [],
        wettenLink: row.wetten_link || '',
      }
    : null;

  return {
    id: row.id,
    caseId: row.case_id,
    bwbId: row.bwb_id,
    articleNumber: row.article_number,
    articleKey: `${row.bwb_id}:${row.article_number}`,
    lawTitle: row.law_title,
    articleText: row.article_text,
    wettenLink: row.wetten_link,
    boekNummer: row.boek_nummer,
    boekTitel: row.boek_titel,
    validFrom: row.valid_from,
    leden: null,
    commentary: commentary,
    commentarySources: sources,
    commentaryGeneratedAt: row.updated_at,
    searchScore: null,
    searchRank: null,
    createdAt: row.saved_at || new Date().toISOString(),
  };
}

class SavedLegislationServiceError extends Error {
  constructor(public statusCode: number, message: string) {
    super(message);
    this.name = "SavedLegislationServiceError";
  }
}

export const savedLegislationService = {
  async getSavedForCase(caseId: string, userId: string): Promise<SavedLegislationItem[]> {
    const uuid = ensureUuid(userId);
    
    const { data, error } = await supabase
      .from("saved_legislation")
      .select("*")
      .eq("case_id", caseId)
      .eq("user_id", uuid)
      .order("saved_at", { ascending: false });

    if (error) {
      console.error("Supabase getSavedForCase error:", error);
      throw new SavedLegislationServiceError(500, `Failed to get saved legislation: ${error.message}`);
    }

    return (data || []).map(mapSupabaseToInternal);
  },

  async saveLegislation(
    caseId: string,
    userId: string,
    article: {
      bwbId: string;
      articleNumber: string;
      lawTitle?: string;
      text?: string;
      wettenLink?: string;
      boekNummer?: string;
      boekTitel?: string;
      validFrom?: string;
      bestScore?: number;
      bestRank?: number;
    },
    commentary?: {
      short_intro?: string;
      systematiek?: string;
      kernbegrippen?: any;
      reikwijdte_en_beperkingen?: string;
    },
    sources?: {
      jurisprudence?: any[];
      onlineSources?: any[];
      wettenLink?: string;
    }
  ): Promise<{ id: string; articleKey: string; isUpdate: boolean }> {
    const uuid = ensureUuid(userId);
    const articleKey = `${article.bwbId}:${article.articleNumber}`;
    const now = new Date().toISOString();

    const insertData = {
      user_id: uuid,
      case_id: caseId,
      bwb_id: article.bwbId,
      article_number: article.articleNumber,
      law_title: article.lawTitle || null,
      article_text: article.text || null,
      wetten_link: article.wettenLink || null,
      boek_nummer: article.boekNummer || null,
      boek_titel: article.boekTitel || null,
      valid_from: article.validFrom || null,
      commentary_short_intro: commentary?.short_intro || null,
      commentary_systematiek: commentary?.systematiek || null,
      commentary_kernbegrippen: commentary?.kernbegrippen || null,
      commentary_reikwijdte: commentary?.reikwijdte_en_beperkingen || null,
      jurisprudence_refs: sources?.jurisprudence || null,
      online_sources: sources?.onlineSources || null,
      updated_at: now,
    };

    const { data: existing } = await supabase
      .from("saved_legislation")
      .select("id")
      .eq("case_id", caseId)
      .eq("user_id", uuid)
      .eq("bwb_id", article.bwbId)
      .eq("article_number", article.articleNumber)
      .maybeSingle();

    if (existing) {
      const { error } = await supabase
        .from("saved_legislation")
        .update(insertData)
        .eq("id", existing.id);

      if (error) {
        console.error("Supabase update saved legislation error:", error);
        throw new SavedLegislationServiceError(500, `Failed to update saved legislation: ${error.message}`);
      }

      console.log(`📝 Updated saved legislation: ${articleKey} for case ${caseId}`);
      return { id: existing.id, articleKey, isUpdate: true };
    } else {
      const { data, error } = await supabase
        .from("saved_legislation")
        .insert({ ...insertData, saved_at: now })
        .select("id")
        .single();

      if (error) {
        console.error("Supabase insert saved legislation error:", error);
        throw new SavedLegislationServiceError(500, `Failed to save legislation: ${error.message}`);
      }

      console.log(`💾 Saved new legislation: ${articleKey} for case ${caseId}`);
      return { id: data.id, articleKey, isUpdate: false };
    }
  },

  async deleteSavedLegislation(caseId: string, articleKey: string, userId: string): Promise<void> {
    const uuid = ensureUuid(userId);
    const [bwbId, articleNumber] = articleKey.split(':');

    if (!bwbId || !articleNumber) {
      throw new SavedLegislationServiceError(400, "Invalid article key format");
    }

    const { error } = await supabase
      .from("saved_legislation")
      .delete()
      .eq("case_id", caseId)
      .eq("user_id", uuid)
      .eq("bwb_id", bwbId)
      .eq("article_number", articleNumber);

    if (error) {
      console.error("Supabase delete saved legislation error:", error);
      throw new SavedLegislationServiceError(500, `Failed to delete saved legislation: ${error.message}`);
    }

    console.log(`🗑️ Deleted saved legislation ${articleKey} for case ${caseId}`);
  },

  async deleteAllForCase(caseId: string, userId: string): Promise<number> {
    const uuid = ensureUuid(userId);

    const { data, error } = await supabase
      .from("saved_legislation")
      .delete()
      .eq("case_id", caseId)
      .eq("user_id", uuid)
      .select("id");

    if (error) {
      console.error("Supabase delete all saved legislation error:", error);
      throw new SavedLegislationServiceError(500, `Failed to delete saved legislation: ${error.message}`);
    }

    const count = data?.length || 0;
    console.log(`🗑️ Deleted ${count} saved legislation items for case ${caseId}`);
    return count;
  },
};
