import { supabase } from "../supabaseClient";

const BUCKET_NAME = "case-files";

export class SupabaseStorageService {
  async uploadFile(
    userId: string,
    caseId: string,
    file: Express.Multer.File
  ): Promise<{ storagePath: string }> {
    const storagePath = `${userId}/${caseId}/${file.originalname}`;
    
    const { error } = await supabase.storage
      .from(BUCKET_NAME)
      .upload(storagePath, file.buffer, {
        contentType: file.mimetype,
        upsert: true,
      });

    if (error) {
      console.error("Supabase storage upload error:", error);
      throw new Error(`Failed to upload file: ${error.message}`);
    }

    return { storagePath };
  }

  async getSignedUrl(storagePath: string, expiresIn: number = 300): Promise<{ url: string; expiresIn: number }> {
    const { data, error } = await supabase.storage
      .from(BUCKET_NAME)
      .createSignedUrl(storagePath, expiresIn);

    if (error) {
      console.error("Supabase signed URL error:", error);
      throw new Error(`Failed to create signed URL: ${error.message}`);
    }

    return {
      url: data.signedUrl,
      expiresIn,
    };
  }

  async deleteFile(storagePath: string): Promise<void> {
    const { error } = await supabase.storage
      .from(BUCKET_NAME)
      .remove([storagePath]);

    if (error) {
      console.error("Supabase storage delete error:", error);
      throw new Error(`Failed to delete file: ${error.message}`);
    }
  }

  async listFiles(userId: string, caseId: string): Promise<string[]> {
    const prefix = `${userId}/${caseId}/`;
    
    const { data, error } = await supabase.storage
      .from(BUCKET_NAME)
      .list(prefix);

    if (error) {
      console.error("Supabase storage list error:", error);
      throw new Error(`Failed to list files: ${error.message}`);
    }

    return data?.map(file => `${prefix}${file.name}`) || [];
  }
}

export const supabaseStorageService = new SupabaseStorageService();
