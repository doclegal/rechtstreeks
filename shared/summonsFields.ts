import { z } from "zod";

// User-fillable fields (editable by user)
export const userFieldsSchema = z.object({
  // Eiser (Plaintiff) gegevens
  eiser_naam: z.string().min(1, "Naam eiser is verplicht"),
  eiser_plaats: z.string().min(1, "Plaats eiser is verplicht"),
  eiser_vertegenwoordiger_naam: z.string().min(1, "Naam vertegenwoordiger is verplicht"),
  eiser_vertegenwoordiger_adres: z.string().min(1, "Adres vertegenwoordiger is verplicht"),
  eiser_vertegenwoordiger_telefoon: z.string().min(1, "Telefoonnummer is verplicht"),
  eiser_vertegenwoordiger_email: z.string().email("Ongeldig emailadres"),
  eiser_bankrekening: z.string().min(1, "Bankrekeningnummer is verplicht"),
  eiser_dossiernummer: z.string().min(1, "Dossiernummer is verplicht"),

  // Gedaagde (Defendant) gegevens
  gedaagde_naam: z.string().min(1, "Naam gedaagde is verplicht"),
  gedaagde_adres: z.string().min(1, "Adres gedaagde is verplicht"),
  gedaagde_geboortedatum: z.string().optional(),

  // Rechtbank gegevens
  rechtbank_naam: z.string().min(1, "Naam rechtbank is verplicht"),
  rechtbank_postadres: z.string().min(1, "Postadres rechtbank is verplicht"),
  rechtbank_bezoekadres: z.string().min(1, "Bezoekadres rechtbank is verplicht"),
  
  // Zitting gegevens
  zitting_datum: z.string().min(1, "Zittingsdatum is verplicht"),
  zitting_dag: z.string().min(1, "Dag van de week is verplicht"),
  zitting_tijd: z.string().min(1, "Tijdstip is verplicht"),
  reactie_deadline: z.string().min(1, "Deadline voor reactie is verplicht"),
  betaal_deadline: z.string().min(1, "Deadline voor betaling is verplicht"),

  // Financiële gegevens
  onderwerp: z.string().min(1, "Onderwerp rekening is verplicht"),
  rekening_nummer: z.string().min(1, "Rekeningnummer is verplicht"),
  rekening_datum: z.string().min(1, "Rekeningdatum is verplicht"),
  hoofdsom: z.number().min(0, "Hoofdsom moet positief zijn"),
  rente_datum_tot: z.string().min(1, "Datum rente tot is verplicht"),
  rente_bedrag: z.number().min(0, "Rentebedrag moet positief zijn"),
  incassokosten: z.number().min(0, "Incassokosten moeten positief zijn"),
  salaris_gemachtigde: z.number().min(0, "Salaris gemachtigde moet positief zijn"),
  kosten_dagvaarding: z.number().min(0, "Kosten dagvaarding moeten positief zijn"),
  rente_vanaf_datum: z.string().min(1, "Datum rente vanaf is verplicht"),

  // Deurwaarder gegevens
  deurwaarder_naam: z.string().optional(),
  deurwaarder_plaats: z.string().optional(),
  deurwaarder_adres: z.string().optional(),
  deurwaarder_datum: z.string().optional(),
  deurwaarder_kosten_basis: z.number().optional(),
  deurwaarder_kosten_adresinfo: z.number().optional(),
  deurwaarder_kosten_beslagregister: z.number().optional(),
});

export type UserFields = z.infer<typeof userFieldsSchema>;

// AI-generated narrative fields (read-only for user, filled by MindStudio)
export const aiFieldsSchema = z.object({
  // Section 3.1: Inleiding
  inleiding: z.string().default(""),

  // Section 3.2: De opdracht en het werk - overeenkomst datum
  overeenkomst_datum: z.string().default(""),
  
  // Section 3.3: Omschrijving totstandkoming en uitvoering
  overeenkomst_omschrijving: z.string().default(""),

  // Section 3.4: Algemene voorwaarden - document type
  algemene_voorwaarden_document: z.string().default(""),

  // Section 3.5: Betalingstermijn uit algemene voorwaarden
  algemene_voorwaarden_artikelnummer_betaling: z.string().default(""),
  algemene_voorwaarden_betalingstermijn_dagen: z.string().default(""),
  algemene_voorwaarden_rente_percentage: z.string().default(""),

  // Section 3.6: Buitengerechtelijke kosten artikel
  algemene_voorwaarden_artikelnummer_incasso: z.string().default(""),

  // Section 3.8: Onbetaald bedrag
  onbetaald_bedrag: z.string().default(""),

  // Section 3.9: Veertiendagenbrief datum
  veertiendagenbrief_datum: z.string().default(""),

  // Section 3.10: Rente berekening
  rente_berekening_uitleg: z.string().default(""),

  // Section 3.12: Aanmaning datum en verzendwijze
  aanmaning_datum: z.string().default(""),
  aanmaning_verzendwijze: z.string().default(""),
  aanmaning_ontvangst_datum: z.string().default(""),

  // Section 3.15: Reactie gedaagde
  reactie_gedaagde: z.string().default(""),

  // Section 3.16-17: Bewijsmiddelen
  bewijsmiddel_r1: z.string().default(""),
  bewijsmiddel_r2: z.string().default(""),
  bewijsmiddel_r3: z.string().default(""),
  bewijsmiddel_r4: z.string().default(""),
  bewijsmiddel_r5: z.string().default(""),
  bewijsmiddel_overig: z.string().default(""),
  getuigen: z.string().default(""),
});

export type AIFields = z.infer<typeof aiFieldsSchema>;

// Complete summons data combining user and AI fields
export interface SummonsData {
  userFields: UserFields;
  aiFields: AIFields;
}

// Field metadata for rendering
export interface FieldMetadata {
  key: string;
  label: string;
  type: "text" | "email" | "number" | "date" | "textarea";
  placeholder?: string;
  required: boolean;
  section?: string;
  helpText?: string;
}

// User field metadata for form rendering
export const userFieldMetadata: FieldMetadata[] = [
  // Eiser section
  { key: "eiser_naam", label: "Naam eiser", type: "text", required: true, section: "Eiser" },
  { key: "eiser_plaats", label: "Plaats eiser", type: "text", required: true, section: "Eiser" },
  { key: "eiser_vertegenwoordiger_naam", label: "Naam vertegenwoordiger", type: "text", required: true, section: "Eiser" },
  { key: "eiser_vertegenwoordiger_adres", label: "Adres vertegenwoordiger", type: "text", required: true, section: "Eiser" },
  { key: "eiser_vertegenwoordiger_telefoon", label: "Telefoonnummer", type: "text", required: true, section: "Eiser" },
  { key: "eiser_vertegenwoordiger_email", label: "E-mailadres", type: "email", required: true, section: "Eiser" },
  { key: "eiser_bankrekening", label: "Bankrekeningnummer", type: "text", required: true, section: "Eiser" },
  { key: "eiser_dossiernummer", label: "Dossiernummer", type: "text", required: true, section: "Eiser" },
  
  // Gedaagde section
  { key: "gedaagde_naam", label: "Naam gedaagde", type: "text", required: true, section: "Gedaagde" },
  { key: "gedaagde_adres", label: "Adres gedaagde", type: "text", required: true, section: "Gedaagde" },
  { key: "gedaagde_geboortedatum", label: "Geboortedatum gedaagde", type: "date", required: false, section: "Gedaagde" },
  
  // Rechtbank section
  { key: "rechtbank_naam", label: "Naam rechtbank", type: "text", required: true, section: "Rechtbank" },
  { key: "rechtbank_postadres", label: "Postadres rechtbank", type: "text", required: true, section: "Rechtbank" },
  { key: "rechtbank_bezoekadres", label: "Bezoekadres rechtbank", type: "text", required: true, section: "Rechtbank" },
  
  // Zitting section
  { key: "zitting_datum", label: "Datum zitting", type: "date", required: true, section: "Zitting" },
  { key: "zitting_dag", label: "Dag van de week", type: "text", required: true, section: "Zitting", placeholder: "bijv. maandag" },
  { key: "zitting_tijd", label: "Tijdstip zitting", type: "text", required: true, section: "Zitting", placeholder: "bijv. 10:00" },
  { key: "reactie_deadline", label: "Deadline voor reactie", type: "date", required: true, section: "Zitting" },
  { key: "betaal_deadline", label: "Deadline voor betaling", type: "date", required: true, section: "Zitting" },
  
  // Financieel section
  { key: "onderwerp", label: "Onderwerp rekening", type: "text", required: true, section: "Financieel" },
  { key: "rekening_nummer", label: "Rekeningnummer", type: "text", required: true, section: "Financieel" },
  { key: "rekening_datum", label: "Rekeningdatum", type: "date", required: true, section: "Financieel" },
  { key: "hoofdsom", label: "Hoofdsom (€)", type: "number", required: true, section: "Financieel" },
  { key: "rente_datum_tot", label: "Rente berekend tot", type: "date", required: true, section: "Financieel" },
  { key: "rente_bedrag", label: "Rentebedrag (€)", type: "number", required: true, section: "Financieel" },
  { key: "incassokosten", label: "Incassokosten (€)", type: "number", required: true, section: "Financieel" },
  { key: "salaris_gemachtigde", label: "Salaris gemachtigde (€)", type: "number", required: true, section: "Financieel" },
  { key: "kosten_dagvaarding", label: "Kosten dagvaarding (€)", type: "number", required: true, section: "Financieel" },
  { key: "rente_vanaf_datum", label: "Rente vanaf datum", type: "date", required: true, section: "Financieel" },
];
