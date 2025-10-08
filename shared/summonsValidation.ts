import { z } from "zod";

// SummonsV1 Validation Schema
export const SummonsV1Schema = z.object({
  meta: z.object({
    template_version: z.string(),
    language: z.string(),
  }),
  court: z.object({
    name: z.string(),
    visit_address: z.string(),
    postal_address: z.string().optional(),
    hearing_day: z.string().optional(),
    hearing_date: z.string().optional(),
    hearing_time: z.string().optional(),
  }),
  parties: z.object({
    claimant: z.object({
      name: z.string(),
      place: z.string(),
      rep_name: z.string().optional(),
      rep_address: z.string().optional(),
      phone: z.string().optional(),
      email: z.string().email().optional(),
      iban: z.string().optional(),
      dossier: z.string().optional(),
    }),
    defendant: z.object({
      name: z.string(),
      address: z.string(),
      birthdate: z.string().optional(),
      is_consumer: z.boolean().default(true),
    }),
  }),
  case: z.object({
    subject: z.string(),
    amount_eur: z.number().nonnegative(),
    interest: z.object({
      type: z.string(),
      from_date: z.string(),
    }),
    interim_sum_eur: z.number().nonnegative(),
    costs: z.object({
      salaris_gemachtigde_eur: z.number().nonnegative(),
      dagvaarding_eur: z.number().nonnegative(),
    }),
    total_to_date_eur: z.number().nonnegative(),
  }),
  sections: z.object({
    full_claim_items: z.array(
      z.object({
        label: z.string(),
        amount_eur: z.number().nonnegative(),
      })
    ),
    orders_requested: z.array(z.string()),
    grounds: z.object({
      intro: z.array(z.string()),
      assignment_and_work: z.array(z.string()),
      terms_and_conditions: z.array(z.string()),
      invoice: z.array(z.string()),
      interest_and_collection_costs: z.array(z.string()),
      defendant_response: z.array(z.string()),
      evidence: z.object({
        list: z.array(z.string()),
        offer_of_proof: z.string(),
        witnesses: z.array(z.string()),
      }),
    }),
  }),
  service_block: z.object({
    bailiff_name: z.string(),
    bailiff_city: z.string(),
    bailiff_address: z.string(),
    served_to: z.string(),
    extra_costs: z.array(
      z.object({
        label: z.string(),
        amount_eur: z.number().nonnegative(),
      })
    ),
    base_service_fee_eur: z.number().nonnegative(),
    total_service_costs_eur: z.number().nonnegative(),
  }).optional(),
  signoff: z.object({
    place: z.string(),
    date: z.string(),
    representative: z.string(),
  }),
});

export type SummonsV1Type = z.infer<typeof SummonsV1Schema>;

// Helper function to validate summons data
export function validateSummonsV1(data: unknown): {
  success: boolean;
  data?: SummonsV1Type;
  errors?: string[];
} {
  const result = SummonsV1Schema.safeParse(data);
  
  if (result.success) {
    return {
      success: true,
      data: result.data,
    };
  } else {
    return {
      success: false,
      errors: result.error.errors.map((err) => 
        `${err.path.join('.')}: ${err.message}`
      ),
    };
  }
}
