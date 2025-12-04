import { Router, type Request, type Response } from "express";
import { supabase } from "../supabaseClient";
import { randomUUID } from "crypto";

const router = Router();

interface SupabaseCase {
  id: string;
  user_id: string;
  title: string;
  description: string;
  client_role: string;
  category: string;
  claim_amount_eur?: number;
  client_name?: string;
  client_address?: string;
  client_city: string;
  opponent_type: string;
  opponent_company?: string;
  opponent_email?: string;
  opponent_phone?: string;
  opponent_address?: string;
  opponent_city?: string;
  status?: string;
  created_at?: string;
  updated_at?: string;
}

function validateRequired(body: any): string | null {
  const requiredFields = ["title", "description", "client_role", "category", "client_city", "opponent_type"];
  for (const field of requiredFields) {
    if (!body[field] || (typeof body[field] === "string" && body[field].trim() === "")) {
      return `Missing required field: ${field}`;
    }
  }
  return null;
}

router.post("/", async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.id;
    if (!userId) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const validationError = validateRequired(req.body);
    if (validationError) {
      return res.status(400).json({ error: validationError });
    }

    const now = new Date().toISOString();
    const caseData: SupabaseCase = {
      id: randomUUID(),
      user_id: userId,
      title: req.body.title,
      description: req.body.description,
      client_role: req.body.client_role,
      category: req.body.category,
      claim_amount_eur: req.body.claim_amount_eur,
      client_name: req.body.client_name,
      client_address: req.body.client_address,
      client_city: req.body.client_city,
      opponent_type: req.body.opponent_type,
      opponent_company: req.body.opponent_company,
      opponent_email: req.body.opponent_email,
      opponent_phone: req.body.opponent_phone,
      opponent_address: req.body.opponent_address,
      opponent_city: req.body.opponent_city,
      status: req.body.status,
      created_at: now,
      updated_at: now,
    };

    const { data, error } = await supabase
      .from("cases")
      .insert(caseData)
      .select()
      .single();

    if (error) {
      return res.status(500).json({ error: error.message });
    }

    return res.status(201).json(data);
  } catch (err: any) {
    return res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/", async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.id;
    if (!userId) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const { data, error } = await supabase
      .from("cases")
      .select("*")
      .eq("user_id", userId);

    if (error) {
      return res.status(500).json({ error: error.message });
    }

    return res.json(data);
  } catch (err: any) {
    return res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/:id", async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.id;
    if (!userId) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const { id } = req.params;

    const { data, error } = await supabase
      .from("cases")
      .select("*")
      .eq("id", id)
      .eq("user_id", userId)
      .single();

    if (error) {
      if (error.code === "PGRST116") {
        return res.status(404).json({ error: "Case not found" });
      }
      return res.status(500).json({ error: error.message });
    }

    if (!data) {
      return res.status(404).json({ error: "Case not found" });
    }

    return res.json(data);
  } catch (err: any) {
    return res.status(500).json({ error: "Internal server error" });
  }
});

router.put("/:id", async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.id;
    if (!userId) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const { id } = req.params;

    const validationError = validateRequired(req.body);
    if (validationError) {
      return res.status(400).json({ error: validationError });
    }

    const updateData: Partial<SupabaseCase> = {
      title: req.body.title,
      description: req.body.description,
      client_role: req.body.client_role,
      category: req.body.category,
      claim_amount_eur: req.body.claim_amount_eur,
      client_name: req.body.client_name,
      client_address: req.body.client_address,
      client_city: req.body.client_city,
      opponent_type: req.body.opponent_type,
      opponent_company: req.body.opponent_company,
      opponent_email: req.body.opponent_email,
      opponent_phone: req.body.opponent_phone,
      opponent_address: req.body.opponent_address,
      opponent_city: req.body.opponent_city,
      status: req.body.status,
      updated_at: new Date().toISOString(),
    };

    const { data, error } = await supabase
      .from("cases")
      .update(updateData)
      .eq("id", id)
      .eq("user_id", userId)
      .select()
      .single();

    if (error) {
      if (error.code === "PGRST116") {
        return res.status(404).json({ error: "Case not found" });
      }
      return res.status(500).json({ error: error.message });
    }

    if (!data) {
      return res.status(404).json({ error: "Case not found" });
    }

    return res.json(data);
  } catch (err: any) {
    return res.status(500).json({ error: "Internal server error" });
  }
});

router.delete("/:id", async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.id;
    if (!userId) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const { id } = req.params;

    const { data: existing } = await supabase
      .from("cases")
      .select("id")
      .eq("id", id)
      .eq("user_id", userId)
      .single();

    if (!existing) {
      return res.status(404).json({ error: "Case not found" });
    }

    const { error } = await supabase
      .from("cases")
      .delete()
      .eq("id", id)
      .eq("user_id", userId);

    if (error) {
      return res.status(500).json({ error: error.message });
    }

    return res.json({ success: true });
  } catch (err: any) {
    return res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
