import { supabase } from "../supabaseClient";

export interface LetterInput {
  case_id: string;
  user_id: string;
  template_id?: string;
  brief_type?: string;
  tone?: string;
  mindstudio_run_id?: string;
}

export interface LetterContent {
  html?: string;
  markdown?: string;
  pdf_storage_key?: string;
  sender_name?: string;
  sender_address?: string;
  sender_postcode?: string;
  sender_city?: string;
  recipient_name?: string;
  recipient_address?: string;
  recipient_postcode?: string;
  recipient_city?: string;
  letter_structure?: any;
}

export interface LetterRecord {
  id: string;
  case_id: string;
  user_id: string;
  template_id: string | null;
  brief_type: string | null;
  tone: string | null;
  html: string | null;
  markdown: string | null;
  pdf_storage_key: string | null;
  sender_name: string | null;
  sender_address: string | null;
  sender_postcode: string | null;
  sender_city: string | null;
  recipient_name: string | null;
  recipient_address: string | null;
  recipient_postcode: string | null;
  recipient_city: string | null;
  letter_structure: any | null;
  status: string;
  mindstudio_run_id: string | null;
  raw_payload: any | null;
  created_at: string;
  updated_at: string;
}

export class LetterServiceError extends Error {
  constructor(message: string, public readonly originalError?: any) {
    super(message);
    this.name = "LetterServiceError";
  }
}

export const letterService = {
  async createLetter(
    input: LetterInput,
    content: LetterContent,
    rawPayload?: any
  ): Promise<LetterRecord> {
    const insertData: any = {
      case_id: input.case_id,
      user_id: input.user_id,
      template_id: input.template_id || null,
      brief_type: input.brief_type || null,
      tone: input.tone || null,
      mindstudio_run_id: input.mindstudio_run_id || null,
      html: content.html || null,
      markdown: content.markdown || null,
      pdf_storage_key: content.pdf_storage_key || null,
      sender_name: content.sender_name || null,
      sender_address: content.sender_address || null,
      sender_postcode: content.sender_postcode || null,
      sender_city: content.sender_city || null,
      recipient_name: content.recipient_name || null,
      recipient_address: content.recipient_address || null,
      recipient_postcode: content.recipient_postcode || null,
      recipient_city: content.recipient_city || null,
      letter_structure: content.letter_structure || null,
      status: "draft",
      raw_payload: rawPayload || null,
    };

    const { data, error } = await supabase
      .from("letters")
      .insert(insertData)
      .select()
      .single();

    if (error) {
      console.error("Supabase createLetter error:", error);
      throw new LetterServiceError("Failed to create letter", error);
    }

    if (!data) {
      throw new LetterServiceError("No data returned from createLetter");
    }

    console.log(`✅ Created letter in Supabase: ${data.id}`);
    return data as LetterRecord;
  },

  async getLettersByCaseId(caseId: string): Promise<LetterRecord[]> {
    try {
      const { data, error } = await supabase
        .from("letters")
        .select("*")
        .eq("case_id", caseId)
        .order("created_at", { ascending: false });

      if (error) {
        console.error("Supabase getLettersByCaseId error:", error);
        return [];
      }

      return (data || []) as LetterRecord[];
    } catch (error) {
      console.error("Error fetching letters:", error);
      return [];
    }
  },

  async getLetterById(id: string): Promise<LetterRecord | null> {
    try {
      const { data, error } = await supabase
        .from("letters")
        .select("*")
        .eq("id", id)
        .single();

      if (error) {
        if (error.code === "PGRST116") {
          return null;
        }
        console.error("Supabase getLetterById error:", error);
        return null;
      }

      return data as LetterRecord;
    } catch (error) {
      console.error("Error fetching letter by id:", error);
      return null;
    }
  },

  async updateLetter(id: string, updates: Partial<LetterContent & { status?: string }>): Promise<LetterRecord | null> {
    try {
      const { data, error } = await supabase
        .from("letters")
        .update(updates)
        .eq("id", id)
        .select()
        .single();

      if (error) {
        console.error("Supabase updateLetter error:", error);
        return null;
      }

      return data as LetterRecord;
    } catch (error) {
      console.error("Error updating letter:", error);
      return null;
    }
  },

  async deleteLetter(id: string): Promise<boolean> {
    try {
      const { error } = await supabase
        .from("letters")
        .delete()
        .eq("id", id);

      if (error) {
        console.error("Supabase deleteLetter error:", error);
        return false;
      }

      console.log(`✅ Deleted letter from Supabase: ${id}`);
      return true;
    } catch (error) {
      console.error("Error deleting letter:", error);
      return false;
    }
  },

  async getLettersByUserId(userId: string): Promise<LetterRecord[]> {
    try {
      const { data, error } = await supabase
        .from("letters")
        .select("*")
        .eq("user_id", userId)
        .order("created_at", { ascending: false });

      if (error) {
        console.error("Supabase getLettersByUserId error:", error);
        return [];
      }

      return (data || []) as LetterRecord[];
    } catch (error) {
      console.error("Error fetching letters by user:", error);
      return [];
    }
  },
};
