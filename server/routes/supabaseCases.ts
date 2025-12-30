import { Router, type Request, type Response } from "express";
import { supabase } from "../supabaseClient";
import { randomUUID } from "crypto";

const router = Router();

interface SupabaseCase {
  id: string;
  owner_user_id: string;
  title: string;
  description: string;
  category: string;
  claim_amount?: string;
  claimant_name?: string;
  claimant_address?: string;
  claimant_city?: string;
  counterparty_type?: string;
  counterparty_name?: string;
  counterparty_email?: string;
  counterparty_phone?: string;
  counterparty_address?: string;
  counterparty_city?: string;
  counterparty_user_id?: string;
  user_role?: string;
  counterparty_description_approved?: boolean;
  status?: string;
  current_step?: string;
  next_action_label?: string;
  has_unseen_missing_items?: boolean;
  needs_reanalysis?: boolean;
  created_at?: string;
  updated_at?: string;
}

function validateRequired(body: any): string | null {
  const requiredFields = ["title"];
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
      owner_user_id: userId,
      title: req.body.title,
      description: req.body.description || "",
      category: req.body.category || "",
      claim_amount: req.body.claimAmount || req.body.claim_amount,
      claimant_name: req.body.claimantName || req.body.claimant_name,
      claimant_address: req.body.claimantAddress || req.body.claimant_address,
      claimant_city: req.body.claimantCity || req.body.claimant_city,
      counterparty_type: req.body.counterpartyType || req.body.counterparty_type,
      counterparty_name: req.body.counterpartyName || req.body.counterparty_name,
      counterparty_email: req.body.counterpartyEmail || req.body.counterparty_email,
      counterparty_phone: req.body.counterpartyPhone || req.body.counterparty_phone,
      counterparty_address: req.body.counterpartyAddress || req.body.counterparty_address,
      counterparty_city: req.body.counterpartyCity || req.body.counterparty_city,
      user_role: req.body.userRole || req.body.user_role || "EISER",
      status: req.body.status || "NEW_INTAKE",
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
      .eq("owner_user_id", userId);

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
      .eq("owner_user_id", userId)
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

    const updateData: Partial<SupabaseCase> = {
      title: req.body.title,
      description: req.body.description,
      category: req.body.category,
      claim_amount: req.body.claimAmount || req.body.claim_amount,
      claimant_name: req.body.claimantName || req.body.claimant_name,
      claimant_address: req.body.claimantAddress || req.body.claimant_address,
      claimant_city: req.body.claimantCity || req.body.claimant_city,
      counterparty_type: req.body.counterpartyType || req.body.counterparty_type,
      counterparty_name: req.body.counterpartyName || req.body.counterparty_name,
      counterparty_email: req.body.counterpartyEmail || req.body.counterparty_email,
      counterparty_phone: req.body.counterpartyPhone || req.body.counterparty_phone,
      counterparty_address: req.body.counterpartyAddress || req.body.counterparty_address,
      counterparty_city: req.body.counterpartyCity || req.body.counterparty_city,
      user_role: req.body.userRole || req.body.user_role,
      status: req.body.status,
      updated_at: new Date().toISOString(),
    };

    const { data, error } = await supabase
      .from("cases")
      .update(updateData)
      .eq("id", id)
      .eq("owner_user_id", userId)
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
      .eq("owner_user_id", userId)
      .single();

    if (!existing) {
      return res.status(404).json({ error: "Case not found" });
    }

    const { error } = await supabase
      .from("cases")
      .delete()
      .eq("id", id)
      .eq("owner_user_id", userId);

    if (error) {
      return res.status(500).json({ error: error.message });
    }

    return res.json({ success: true });
  } catch (err: any) {
    return res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
