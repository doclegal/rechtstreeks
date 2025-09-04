import { z } from "zod";

// Zod schema for the analysis response from MindStudio
export const KwalificatiesSchema = z.object({
  is_kantonzaak: z.string(),
  relatieve_bevoegdheid: z.string(),
  toepasselijk_recht: z.string(),
});

export const VorderingSchema = z.object({
  hoofdsom: z.string(),
  wettelijke_rente: z.string(),
});

export const KansschattingSchema = z.object({
  inschatting: z.enum(["kansrijk", "twijfelachtig", "risicovol", "Onbekend"]),
  redenen: z.array(z.string()),
});

export const BelangrijkeDataSchema = z.object({
  timeline: z.array(z.string()),
  deadlines_en_termijnen: z.array(z.string()),
});

export const BewijslastSchema = z.object({
  wie_moet_wat_bewijzen: z.array(z.string()),
  beschikbaar_bewijs: z.array(z.string()),
  ontbrekend_bewijs: z.array(z.string()),
});

export const AnalysisSchema = z.object({
  samenvatting_feiten: z.string(),
  juridische_analyse: z.string(),
  // Make these optional and accept both objects and strings
  kwalificaties: KwalificatiesSchema.optional().or(z.string().optional()),
  vordering: VorderingSchema.optional().or(z.string().optional()),
  kansinschatting: KansschattingSchema.optional().or(z.string().optional()),
  belangrijke_data: BelangrijkeDataSchema.optional().or(z.string().optional()),
  bewijslast: BewijslastSchema.optional().or(z.string().optional()),
  verjaring_en_klachttermijnen: z.string(),
  // Accept both arrays and comma-separated strings
  conflicten_in_input: z.array(z.string()).or(z.string()).optional(),
  to_do: z.array(z.string()).or(z.string()).optional(),
  cta: z.array(z.string()).or(z.string()).optional(),
  kernredenering: z.array(z.string()).or(z.string()).optional(),
});

// TypeScript types inferred from Zod schemas
export type Kwalificaties = z.infer<typeof KwalificatiesSchema>;
export type Vordering = z.infer<typeof VorderingSchema>;
export type Kansinschatting = z.infer<typeof KansschattingSchema>;
export type BelangrijkeData = z.infer<typeof BelangrijkeDataSchema>;
export type Bewijslast = z.infer<typeof BewijslastSchema>;
export type Analysis = z.infer<typeof AnalysisSchema>;

// Helper type for risk assessment colors
export type RiskLevel = Analysis["kansinschatting"]["inschatting"];

export const getRiskColor = (risk: RiskLevel): string => {
  switch (risk) {
    case "kansrijk":
      return "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200";
    case "twijfelachtig":
      return "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200";
    case "risicovol":
      return "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200";
    case "Onbekend":
      return "bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200";
    default:
      return "bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200";
  }
};

// Helper function to handle mixed data types from MindStudio
export function ensureArray(data: string[] | string | undefined): string[] {
  if (!data) return [];
  if (Array.isArray(data)) return data;
  if (typeof data === 'string') {
    if (data === '[object Object]' || data === '') return [];
    return data.split(',').map(item => item.trim()).filter(item => item.length > 0);
  }
  return [];
}

export function isValidData(data: any): boolean {
  return data !== undefined && data !== null && data !== '' && data !== '[object Object]';
}

export function displayString(data: string | undefined): string {
  if (!isValidData(data)) return 'Geen data beschikbaar';
  return data || 'Geen data beschikbaar';
}