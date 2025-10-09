import { UserFields, AIFields } from "@shared/summonsFields";

interface SummonsTemplateV3Props {
  userFields: Partial<UserFields>;
  aiFields: Partial<AIFields>;
  onUserFieldChange?: (key: keyof UserFields, value: string | number) => void;
  editable?: boolean;
}

// Reusable components for fields
function UserField({ 
  value, 
  fieldKey, 
  placeholder = "[Nog in te vullen]",
  type = "text",
  editable = false,
  onChange
}: { 
  value: string | number | undefined; 
  fieldKey: keyof UserFields;
  placeholder?: string;
  type?: string;
  editable: boolean;
  onChange?: (key: keyof UserFields, value: string | number) => void;
}) {
  const isEmpty = !value || value === "" || (type === "number" && value === 0);
  
  if (!editable) {
    return (
      <span 
        className={`user-field-display ${isEmpty ? 'bg-yellow-100 border border-yellow-400 px-1 rounded text-yellow-700 italic' : ''}`}
        data-field={fieldKey}
      >
        {isEmpty ? placeholder : value}
      </span>
    );
  }

  return (
    <input
      type={type}
      value={value || ""}
      onChange={(e) => onChange?.(fieldKey, type === "number" ? parseFloat(e.target.value) || 0 : e.target.value)}
      placeholder={placeholder}
      className={`user-field-input inline-block border-b px-1 min-w-[100px] focus:outline-none ${
        isEmpty 
          ? 'border-yellow-400 bg-yellow-50 text-yellow-700 placeholder-yellow-500 focus:border-yellow-600' 
          : 'border-blue-400 bg-blue-50 focus:border-blue-600'
      }`}
      data-field={fieldKey}
      data-testid={`input-${fieldKey}`}
    />
  );
}

function AIField({ 
  value, 
  fieldKey, 
  placeholder = "[Wordt gegenereerd door AI]",
  multiline = false
}: { 
  value: string | undefined; 
  fieldKey: keyof AIFields;
  placeholder?: string;
  multiline?: boolean;
}) {
  const displayValue = value || placeholder;
  
  if (multiline) {
    return (
      <div 
        className="ai-field-display bg-amber-50 border border-amber-200 p-3 rounded text-amber-800 italic min-h-[80px]" 
        data-field={fieldKey}
        data-testid={`ai-${fieldKey}`}
      >
        {displayValue}
      </div>
    );
  }

  return (
    <span 
      className="ai-field-display bg-amber-50 border border-amber-200 px-2 py-0.5 rounded text-amber-800 italic inline-block min-w-[100px]" 
      data-field={fieldKey}
      data-testid={`ai-${fieldKey}`}
    >
      {displayValue}
    </span>
  );
}

export function SummonsTemplateV3({ userFields, aiFields, onUserFieldChange, editable = false }: SummonsTemplateV3Props) {
  const u = userFields;
  const a = aiFields;

  return (
    <div className="summons-template-v3 bg-white text-black font-serif" style={{ fontSize: "12pt", lineHeight: "1.6" }}>
      <style>{`
        @media print {
          @page {
            size: A4;
            margin: 2.5cm;
          }
          .summons-template-v3 {
            font-size: 12pt;
          }
          .user-field-input {
            border: none !important;
            background: transparent !important;
          }
          .ai-field-display {
            background: transparent !important;
            border: none !important;
            color: inherit !important;
          }
        }
        
        .summons-template-v3 h1 {
          font-size: 18pt;
          font-weight: bold;
          text-align: center;
          margin-bottom: 1.5em;
          margin-top: 0.5em;
          text-transform: uppercase;
        }
        
        .summons-template-v3 h2 {
          font-size: 13pt;
          font-weight: bold;
          margin-top: 1.5em;
          margin-bottom: 0.8em;
          text-transform: uppercase;
          border-bottom: 2px solid #000;
          padding-bottom: 0.3em;
        }
        
        .summons-template-v3 h3 {
          font-size: 11.5pt;
          font-weight: bold;
          margin-top: 1.2em;
          margin-bottom: 0.6em;
        }
        
        .summons-template-v3 .section {
          margin-bottom: 1.5em;
        }
        
        .summons-template-v3 .field-row {
          margin-bottom: 0.4em;
          line-height: 1.8;
        }
        
        .summons-template-v3 .field-label {
          font-weight: 500;
          display: inline-block;
          min-width: 180px;
        }
        
        .summons-template-v3 .divider {
          border-top: 1px dashed #666;
          margin: 2em 0;
          padding-top: 0.5em;
          text-align: center;
          font-style: italic;
          color: #666;
        }
      `}</style>

      {/* Title */}
      <h1>DAGVAARDING / OPROEP IN EERSTE AANLEG (KANTON)</h1>

      {/* EISER Section */}
      <div className="section">
        <h2>EISER</h2>
        <div className="field-row">
          <span className="field-label">Naam of Bedrijfsnaam:</span>
          <UserField value={u.eiser_naam} fieldKey="eiser_naam" editable={editable} onChange={onUserFieldChange} />
        </div>
        <div className="field-row">
          <span className="field-label">Adres:</span>
          <UserField value={u.eiser_adres} fieldKey="eiser_adres" editable={editable} onChange={onUserFieldChange} />
        </div>
        <div className="field-row">
          <span className="field-label">Postcode:</span>
          <UserField value={u.eiser_postcode} fieldKey="eiser_postcode" editable={editable} onChange={onUserFieldChange} />
        </div>
        <div className="field-row">
          <span className="field-label">Plaats:</span>
          <UserField value={u.eiser_plaats} fieldKey="eiser_plaats" editable={editable} onChange={onUserFieldChange} />
        </div>
        <div className="field-row">
          <span className="field-label">E-mailadres:</span>
          <UserField value={u.eiser_email} fieldKey="eiser_email" editable={editable} onChange={onUserFieldChange} />
        </div>
        <div className="field-row">
          <span className="field-label">Telefoonnummer:</span>
          <UserField value={u.eiser_telefoon} fieldKey="eiser_telefoon" editable={editable} onChange={onUserFieldChange} />
        </div>
        <div className="field-row">
          <span className="field-label">KvK of BSN:</span>
          <UserField value={u.eiser_kvk_bsn} fieldKey="eiser_kvk_bsn" placeholder="[Optioneel]" editable={editable} onChange={onUserFieldChange} />
        </div>
        <div className="field-row">
          <span className="field-label">Gemachtigde - Naam:</span>
          <UserField value={u.gemachtigde_naam} fieldKey="gemachtigde_naam" placeholder="[Indien van toepassing]" editable={editable} onChange={onUserFieldChange} />
        </div>
        <div className="field-row">
          <span className="field-label">Gemachtigde - Kantoornaam:</span>
          <UserField value={u.gemachtigde_kantoor} fieldKey="gemachtigde_kantoor" placeholder="[Indien van toepassing]" editable={editable} onChange={onUserFieldChange} />
        </div>
        <div className="field-row">
          <span className="field-label">Gemachtigde - Adres:</span>
          <UserField value={u.gemachtigde_adres} fieldKey="gemachtigde_adres" placeholder="[Indien van toepassing]" editable={editable} onChange={onUserFieldChange} />
        </div>
        <div className="field-row">
          <span className="field-label">Gemachtigde - E-mailadres:</span>
          <UserField value={u.gemachtigde_email} fieldKey="gemachtigde_email" placeholder="[Indien van toepassing]" editable={editable} onChange={onUserFieldChange} />
        </div>
        <div className="field-row">
          <span className="field-label">Gemachtigde - Telefoonnummer:</span>
          <UserField value={u.gemachtigde_telefoon} fieldKey="gemachtigde_telefoon" placeholder="[Indien van toepassing]" editable={editable} onChange={onUserFieldChange} />
        </div>
      </div>

      {/* GEDAAGDE Section */}
      <div className="section">
        <h2>GEDAAGDE</h2>
        <div className="field-row">
          <span className="field-label">Naam of Bedrijfsnaam:</span>
          <UserField value={u.gedaagde_naam} fieldKey="gedaagde_naam" editable={editable} onChange={onUserFieldChange} />
        </div>
        <div className="field-row">
          <span className="field-label">Adres:</span>
          <UserField value={u.gedaagde_adres} fieldKey="gedaagde_adres" editable={editable} onChange={onUserFieldChange} />
        </div>
        <div className="field-row">
          <span className="field-label">Postcode:</span>
          <UserField value={u.gedaagde_postcode} fieldKey="gedaagde_postcode" editable={editable} onChange={onUserFieldChange} />
        </div>
        <div className="field-row">
          <span className="field-label">Plaats:</span>
          <UserField value={u.gedaagde_plaats} fieldKey="gedaagde_plaats" editable={editable} onChange={onUserFieldChange} />
        </div>
        <div className="field-row">
          <span className="field-label">E-mailadres (indien bekend):</span>
          <UserField value={u.gedaagde_email} fieldKey="gedaagde_email" placeholder="[Indien bekend]" editable={editable} onChange={onUserFieldChange} />
        </div>
        <div className="field-row">
          <span className="field-label">Telefoonnummer (indien bekend):</span>
          <UserField value={u.gedaagde_telefoon} fieldKey="gedaagde_telefoon" placeholder="[Indien bekend]" editable={editable} onChange={onUserFieldChange} />
        </div>
        <div className="field-row">
          <span className="field-label">KvK of BSN (indien van toepassing):</span>
          <UserField value={u.gedaagde_kvk_bsn} fieldKey="gedaagde_kvk_bsn" placeholder="[Indien van toepassing]" editable={editable} onChange={onUserFieldChange} />
        </div>
      </div>

      {/* GERECHTSDEURWAARDER Section */}
      <div className="section">
        <h2>GERECHTSDEURWAARDER</h2>
        <div className="field-row">
          <span className="field-label">Naam:</span>
          <UserField value={u.deurwaarder_naam} fieldKey="deurwaarder_naam" editable={editable} onChange={onUserFieldChange} />
        </div>
        <div className="field-row">
          <span className="field-label">Kantooradres:</span>
          <UserField value={u.deurwaarder_adres} fieldKey="deurwaarder_adres" editable={editable} onChange={onUserFieldChange} />
        </div>
        <div className="field-row">
          <span className="field-label">Kenmerk:</span>
          <UserField value={u.deurwaarder_kenmerk} fieldKey="deurwaarder_kenmerk" editable={editable} onChange={onUserFieldChange} />
        </div>
        <div className="field-row">
          <span className="field-label">Datum betekening:</span>
          <UserField value={u.datum_betekening} fieldKey="datum_betekening" editable={editable} onChange={onUserFieldChange} />
        </div>
        <div className="field-row">
          <span className="field-label">Plaats betekening:</span>
          <UserField value={u.plaats_betekening} fieldKey="plaats_betekening" editable={editable} onChange={onUserFieldChange} />
        </div>
      </div>

      {/* RECHTBANK EN ZITTING Section */}
      <div className="section">
        <h2>RECHTBANK EN ZITTING</h2>
        <div className="field-row">
          <span className="field-label">Rechtbank:</span>
          Rechtbank <UserField value={u.rechtbank_naam} fieldKey="rechtbank_naam" editable={editable} onChange={onUserFieldChange} />
        </div>
        <div className="field-row">
          <span className="field-label">Afdeling:</span>
          Team Kanton
        </div>
        <div className="field-row">
          <span className="field-label">Zittingsdatum:</span>
          <UserField value={u.zitting_datum} fieldKey="zitting_datum" editable={editable} onChange={onUserFieldChange} />
        </div>
        <div className="field-row">
          <span className="field-label">Zittingstijd:</span>
          <UserField value={u.zitting_tijd} fieldKey="zitting_tijd" editable={editable} onChange={onUserFieldChange} />
        </div>
        <div className="field-row">
          <span className="field-label">Zittingsadres:</span>
          <UserField value={u.zitting_adres} fieldKey="zitting_adres" editable={editable} onChange={onUserFieldChange} />
        </div>
        <div className="field-row">
          <span className="field-label">Zaal/Kamer:</span>
          <UserField value={u.zitting_zaal} fieldKey="zitting_zaal" editable={editable} onChange={onUserFieldChange} />
        </div>
      </div>

      {/* OPROEP / AANZEGGING Section */}
      <div className="section">
        <h2>OPROEP / AANZEGGING</h2>
        <p style={{ textAlign: 'justify' }}>
          Ik, gerechtsdeurwaarder als hiervoor vermeld, roep hierbij gedaagde op om te verschijnen ter zitting zoals boven vermeld.
          Indien u niet verschijnt of geen verweer voert, kan de rechter bij verstek uitspraak doen.
        </p>
      </div>

      {/* A. VORDERINGEN Section */}
      <div className="section">
        <h2>A. VORDERINGEN</h2>
        <AIField value={a.vorderingen} fieldKey="vorderingen" placeholder="[Formuleer alle vorderingen volledig, inclusief hoofdsom, rente, buitengerechtelijke kosten, proceskosten en eventuele nevenvorderingen]" multiline={true} />
      </div>

      {/* B. FEITEN Section */}
      <div className="section">
        <h2>B. FEITEN</h2>
        <AIField value={a.feiten} fieldKey="feiten" placeholder="[Beschrijf de relevante feiten in chronologische volgorde, met verwijzing naar producties]" multiline={true} />
      </div>

      {/* C. RECHTSGRONDEN Section */}
      <div className="section">
        <h2>C. RECHTSGRONDEN EN JURIDISCHE MOTIVERING</h2>
        <AIField value={a.rechtsgronden} fieldKey="rechtsgronden" placeholder="[Koppel de feiten aan de toepasselijke rechtsregels en werk per vordering de grondslag en toewijsbaarheid uit]" multiline={true} />
      </div>

      {/* D. BEDRAGEN EN PARAMETER-INVOER Section */}
      <div className="section">
        <h2>D. BEDRAGEN EN PARAMETER-INVOER</h2>
        <div className="field-row">
          <span className="field-label">Hoofdsom (€):</span>
          <UserField value={u.hoofdsom} fieldKey="hoofdsom" type="number" editable={editable} onChange={onUserFieldChange} />
        </div>
        <div className="field-row">
          <span className="field-label">Datum ingangsverzuim/rente:</span>
          <UserField value={u.datum_verzuim} fieldKey="datum_verzuim" editable={editable} onChange={onUserFieldChange} />
        </div>
        <div className="field-row">
          <span className="field-label">Rentevorm:</span>
          <UserField value={u.rentevorm} fieldKey="rentevorm" placeholder="wettelijk of handelsrente" editable={editable} onChange={onUserFieldChange} />
        </div>
        <div className="field-row">
          <span className="field-label">Buitengerechtelijke kosten (€):</span>
          <UserField value={u.incassokosten} fieldKey="incassokosten" type="number" editable={editable} onChange={onUserFieldChange} />
        </div>
      </div>

      {/* E. SOMMATIES EN COMMUNICATIE Section */}
      <div className="section">
        <h2>E. SOMMATIES EN COMMUNICATIE</h2>
        <AIField value={a.sommaties} fieldKey="sommaties" placeholder="[Vat aanmaningen/sommatie(s) en reacties samen; verwijs naar producties]" multiline={true} />
      </div>

      {/* F. VERWACHT VERWEER Section */}
      <div className="section">
        <h2>F. VERWACHT VERWEER EN WEERLEGGING (OPTIONEEL)</h2>
        <AIField value={a.verweer_weerlegging} fieldKey="verweer_weerlegging" placeholder="[Anticipeer op mogelijk verweer en geef kernachtige weerlegging]" multiline={true} />
      </div>

      {/* G. PRODUCTIES Section */}
      <div className="section">
        <h2>G. PRODUCTIES</h2>
        <div className="field-row">Productie 1 – Titel: <UserField value={u.productie_1} fieldKey="productie_1" editable={editable} onChange={onUserFieldChange} /></div>
        <div className="field-row">Productie 2 – Titel: <UserField value={u.productie_2} fieldKey="productie_2" editable={editable} onChange={onUserFieldChange} /></div>
        <div className="field-row">Productie 3 – Titel: <UserField value={u.productie_3} fieldKey="productie_3" editable={editable} onChange={onUserFieldChange} /></div>
        <div className="field-row">Productie 4 – Titel: <UserField value={u.productie_4} fieldKey="productie_4" editable={editable} onChange={onUserFieldChange} /></div>
        <div className="field-row">Productie 5 – Titel: <UserField value={u.productie_5} fieldKey="productie_5" editable={editable} onChange={onUserFieldChange} /></div>
        <div className="field-row">Productie 6 – Titel: <UserField value={u.productie_6} fieldKey="productie_6" editable={editable} onChange={onUserFieldChange} /></div>
      </div>

      {/* H. SLOT EN PETITUM Section */}
      <div className="section">
        <h2>H. SLOT EN PETITUM</h2>
        <AIField value={a.petitum} fieldKey="petitum" placeholder="[Formuleer een compact en ondubbelzinnig petitum dat de vorderingen herhaalt, inclusief uitvoerbaar-bij-voorraad indien passend]" multiline={true} />
      </div>

      {/* PLAATS EN DATUM Section */}
      <div className="section">
        <h2>PLAATS EN DATUM</h2>
        <div className="field-row">
          <span className="field-label">Plaats:</span>
          <UserField value={u.plaats_datum_ondertekening} fieldKey="plaats_datum_ondertekening" editable={editable} onChange={onUserFieldChange} />
        </div>
        <div className="field-row">
          <span className="field-label">Datum:</span>
          <UserField value={u.datum_ondertekening} fieldKey="datum_ondertekening" editable={editable} onChange={onUserFieldChange} />
        </div>
      </div>

      {/* ONDERTEKENING Section */}
      <div className="section">
        <h2>ONDERTEKENING EISER / GEMACHTIGDE</h2>
        <div className="field-row">
          <span className="field-label">Naam ondertekenaar:</span>
          <UserField value={u.ondertekenaar_naam} fieldKey="ondertekenaar_naam" editable={editable} onChange={onUserFieldChange} />
        </div>
        <div className="field-row">
          <span className="field-label">Functie / Kantoorgegevens:</span>
          <UserField value={u.ondertekenaar_functie} fieldKey="ondertekenaar_functie" editable={editable} onChange={onUserFieldChange} />
        </div>
      </div>

      {/* KNIPLIJN */}
      <div className="divider">
        — — — — — KNIPLIJN: DEURWAARDERS-EXPLOOT — — — — —
      </div>

      {/* DEURWAARDERS-EXPLOOT Section */}
      <div className="section">
        <h2>DEURWAARDERS-EXPLOOT</h2>
        <p style={{ fontStyle: 'italic', marginBottom: '1em', fontSize: '11pt' }}>
          (IN TE VULLEN DOOR DE GERECHTSDEURWAARDER)
        </p>
        <div className="field-row">
          <span className="field-label">Datum betekening:</span>
          <UserField value={u.exploot_datum} fieldKey="exploot_datum" editable={editable} onChange={onUserFieldChange} />
        </div>
        <div className="field-row">
          <span className="field-label">Naam gerechtsdeurwaarder:</span>
          <UserField value={u.exploot_deurwaarder} fieldKey="exploot_deurwaarder" editable={editable} onChange={onUserFieldChange} />
        </div>
        <div className="field-row">
          <span className="field-label">Plaats kantoor:</span>
          <UserField value={u.exploot_plaats_kantoor} fieldKey="exploot_plaats_kantoor" editable={editable} onChange={onUserFieldChange} />
        </div>
        <div className="field-row">
          <span className="field-label">Adres gedaagde:</span>
          <UserField value={u.exploot_adres_gedaagde} fieldKey="exploot_adres_gedaagde" editable={editable} onChange={onUserFieldChange} />
        </div>
        <div className="field-row">
          <span className="field-label">Wijze van betekening:</span>
          <UserField value={u.exploot_wijze} fieldKey="exploot_wijze" editable={editable} onChange={onUserFieldChange} />
        </div>
        <p style={{ marginTop: '1.5em', textAlign: 'justify' }}>
          Ik heb gedaagde aangezegd te verschijnen op de hiervoor vermelde zitting van de Rechtbank (Team Kanton).
        </p>
        <div style={{ marginTop: '2em' }}>
          <span className="field-label">Handtekening/stempel:</span>
          <UserField value={u.exploot_handtekening} fieldKey="exploot_handtekening" editable={editable} onChange={onUserFieldChange} />
        </div>
      </div>
    </div>
  );
}
