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
  kwalificaties: KwalificatiesSchema,
  vordering: VorderingSchema,
  kansinschatting: KansschattingSchema,
  belangrijke_data: BelangrijkeDataSchema,
  bewijslast: BewijslastSchema,
  verjaring_en_klachttermijnen: z.string(),
  conflicten_in_input: z.array(z.string()),
  to_do: z.array(z.string()),
  cta: z.array(z.string()),
  kernredenering: z.array(z.string()),
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