import { supabase, supabaseAdmin } from "../supabaseClient";
import type { SupabaseClient } from "@supabase/supabase-js";

const BUCKET_NAME = "case-files";

/**
 * Get the Supabase client - STRICT version
 * Throws error if no client provided (for RLS enforcement)
 */
function getClient(client?: SupabaseClient): SupabaseClient {
  if (!client) {
    throw new Error("supabaseStorageService: No Supabase client provided. Pass req.supabaseClient for RLS to work.");
  }
  return client;
}

/**
 * Supabase Storage Service - handles file uploads/downloads
 * 
 * IMPORTANT: All methods accept an optional SupabaseClient parameter.
 * For storage RLS to work correctly, pass a user-scoped client.
 */
export class SupabaseStorageService {
  async uploadFile(
    userId: string,
    caseId: string,
    file: Express.Multer.File,
    client?: SupabaseClient
  ): Promise<{ storagePath: string }> {
    const db = getClient(client);
    const storagePath = `${userId}/${caseId}/${file.originalname}`;
    
    const { error } = await db.storage
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

  async getSignedUrl(
    storagePath: string, 
    expiresIn: number = 300,
    client?: SupabaseClient
  ): Promise<{ url: string; expiresIn: number }> {
    const db = getClient(client);
    
    const { data, error } = await db.storage
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

  async deleteFile(storagePath: string, client?: SupabaseClient): Promise<void> {
    const db = getClient(client);
    
    const { error } = await db.storage
      .from(BUCKET_NAME)
      .remove([storagePath]);

    if (error) {
      console.error("Supabase storage delete error:", error);
      throw new Error(`Failed to delete file: ${error.message}`);
    }
  }

  async listFiles(userId: string, caseId: string, client?: SupabaseClient): Promise<string[]> {
    const db = getClient(client);
    const prefix = `${userId}/${caseId}/`;
    
    const { data, error } = await db.storage
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
