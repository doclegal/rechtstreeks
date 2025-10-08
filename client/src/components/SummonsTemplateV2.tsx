import { UserFields, AIFields } from "@shared/summonsFields";

interface SummonsTemplateV2Props {
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
        className="ai-field-display bg-amber-50 border border-amber-200 p-2 rounded text-amber-800 italic min-h-[60px]" 
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

export function SummonsTemplateV2({ userFields, aiFields, onUserFieldChange, editable = false }: SummonsTemplateV2Props) {
  const u = userFields;
  const a = aiFields;

  // Calculate totals
  const tussenoptelling = (u.hoofdsom || 0) + (u.rente_bedrag || 0) + (u.incassokosten || 0);
  const totaal = tussenoptelling + (u.salaris_gemachtigde || 0) + (u.kosten_dagvaarding || 0);
  const deurwaarder_totaal = (u.deurwaarder_kosten_basis || 0) + (u.deurwaarder_kosten_adresinfo || 0) + (u.deurwaarder_kosten_beslagregister || 0);

  return (
    <div className="summons-template-v2 bg-white text-black font-serif" style={{ fontSize: "12pt", lineHeight: "1.5" }}>
      <style>{`
        @media print {
          @page {
            size: A4;
            margin: 2.5cm;
          }
          .summons-template-v2 {
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
        
        .summons-template-v2 h1 {
          font-size: 18pt;
          font-weight: bold;
          margin-bottom: 1em;
        }
        
        .summons-template-v2 h2 {
          font-size: 14pt;
          font-weight: bold;
          margin-top: 1.5em;
          margin-bottom: 0.5em;
        }
        
        .summons-template-v2 h3 {
          font-size: 12pt;
          font-weight: bold;
          margin-top: 1em;
          margin-bottom: 0.5em;
        }
        
        .summons-template-v2 ul {
          margin-left: 2em;
          list-style-type: disc;
        }
        
        .summons-template-v2 table {
          width: 100%;
          border-collapse: collapse;
        }
        
        .summons-template-v2 .header-table td {
          vertical-align: top;
          padding: 0.5em 1em;
        }
        
        .summons-template-v2 .three-column {
          display: grid;
          grid-template-columns: 1fr 1fr 1fr;
          gap: 1em;
          border: 1px solid #ccc;
          padding: 1em;
          margin: 1em 0;
        }
        
        .summons-template-v2 .footer-italic {
          font-size: 10pt;
          font-style: italic;
          margin-top: 0.5em;
        }
      `}</style>

      {/* Page 1 - Header */}
      <div className="page-1">
        <h1 style={{ textAlign: "center" }}>Dagvaarding / oproep voor een rechtszaak</h1>
        <p style={{ textAlign: "center", marginBottom: "2em" }}>
          Betaling: rekening <UserField value={u.eiser_naam} fieldKey="eiser_naam" editable={editable} onChange={onUserFieldChange} />
        </p>

        <table className="header-table" style={{ marginBottom: "2em" }}>
          <tbody>
            <tr>
              <td style={{ width: "50%" }}>
                <strong>Gedaagde</strong><br/>
                <UserField value={u.gedaagde_naam} fieldKey="gedaagde_naam" placeholder="[naam gedaagde]" editable={editable} onChange={onUserFieldChange} /><br/><br/>
                <strong>Adres</strong><br/>
                <UserField value={u.gedaagde_adres} fieldKey="gedaagde_adres" placeholder="[adres gedaagde]" editable={editable} onChange={onUserFieldChange} /><br/><br/>
                <strong>Geboortedatum</strong><br/>
                <UserField value={u.gedaagde_geboortedatum} fieldKey="gedaagde_geboortedatum" type="date" placeholder="[geboortedatum]" editable={editable} onChange={onUserFieldChange} />
              </td>
              <td style={{ width: "50%" }}>
                <strong>Eiser</strong><br/>
                <UserField value={u.eiser_naam} fieldKey="eiser_naam" placeholder="[naam eiser]" editable={editable} onChange={onUserFieldChange} /><br/>
                gevestigd in <UserField value={u.eiser_plaats} fieldKey="eiser_plaats" placeholder="[plaats]" editable={editable} onChange={onUserFieldChange} /><br/><br/>
                <strong>Vertegenwoordigd door:</strong><br/>
                <UserField value={u.eiser_vertegenwoordiger_naam} fieldKey="eiser_vertegenwoordiger_naam" placeholder="[naam vertegenwoordiger]" editable={editable} onChange={onUserFieldChange} /><br/>
                <UserField value={u.eiser_vertegenwoordiger_adres} fieldKey="eiser_vertegenwoordiger_adres" placeholder="[adres]" editable={editable} onChange={onUserFieldChange} /><br/>
                T: <UserField value={u.eiser_vertegenwoordiger_telefoon} fieldKey="eiser_vertegenwoordiger_telefoon" placeholder="[telefoonnummer]" editable={editable} onChange={onUserFieldChange} /><br/>
                E: <UserField value={u.eiser_vertegenwoordiger_email} fieldKey="eiser_vertegenwoordiger_email" type="email" placeholder="[emailadres]" editable={editable} onChange={onUserFieldChange} /><br/>
                Bankrekening: <UserField value={u.eiser_bankrekening} fieldKey="eiser_bankrekening" placeholder="[bankrekeningnummer]" editable={editable} onChange={onUserFieldChange} /><br/>
                Dossiernummer: <UserField value={u.eiser_dossiernummer} fieldKey="eiser_dossiernummer" placeholder="[dossiernummer of kenmerk]" editable={editable} onChange={onUserFieldChange} />
              </td>
            </tr>
          </tbody>
        </table>

        <div style={{ marginBottom: "2em" }}>
          <h3>Wat eist <UserField value={u.eiser_naam} fieldKey="eiser_naam" editable={editable} onChange={onUserFieldChange} />?</h3>
          <p><UserField value={u.eiser_naam} fieldKey="eiser_naam" editable={editable} onChange={onUserFieldChange} /> wil dat u een rekening voor <UserField value={u.onderwerp} fieldKey="onderwerp" placeholder="[onderwerp rekening/overeenkomst]" editable={editable} onChange={onUserFieldChange} /> betaalt met rente en kosten. Hierna leest u hier meer over.</p>
        </div>

        <div className="three-column">
          <div>
            <strong>U bent het eens met de eis</strong><br/>
            Betaal uiterlijk <UserField value={u.betaal_deadline} fieldKey="betaal_deadline" type="date" placeholder="[datum]" editable={editable} onChange={onUserFieldChange} /> aan <UserField value={u.eiser_vertegenwoordiger_naam} fieldKey="eiser_vertegenwoordiger_naam" editable={editable} onChange={onUserFieldChange} /> €{totaal.toLocaleString('nl-NL', { minimumFractionDigits: 2 })}. Die stopt dan de rechtszaak.<br/><br/>
            Kunt u niet betalen? Neem dan contact op met <UserField value={u.eiser_vertegenwoordiger_naam} fieldKey="eiser_vertegenwoordiger_naam" editable={editable} onChange={onUserFieldChange} /> en maak een betaalafspraak.
          </div>
          <div>
            <strong>U bent het niet eens met de eis</strong><br/>
            U, of iemand die u helpt, kan 2 dingen doen.<br/><br/>
            <strong>Schrijf een brief aan de kantonrechter</strong> OF <strong>Ga naar de zitting van de kantonrechter</strong>
          </div>
          <div>
            <strong>U weet niet wat u moet doen</strong><br/>
            Neem zo snel mogelijk contact op met iemand die u kan helpen.<br/><br/>
            Bijvoorbeeld:<br/>
            • het Juridisch Loket http://www.juridischloket.nl of 0900-8020<br/>
            • een (schuld)hulpverlener<br/>
            • een advocaat<br/>
            • een jurist<br/>
            • een rechtsbijstandsverzekeraar
          </div>
        </div>

        <table style={{ width: "100%", marginTop: "2em" }}>
          <tbody>
            <tr>
              <td style={{ width: "50%", verticalAlign: "top" }}>
                <strong>Stuur de brief naar</strong><br/><br/>
                De kantonrechter van de <UserField value={u.rechtbank_naam} fieldKey="rechtbank_naam" placeholder="[naam rechtbank]" editable={editable} onChange={onUserFieldChange} /><br/>
                <UserField value={u.rechtbank_postadres} fieldKey="rechtbank_postadres" placeholder="[postadres]" editable={editable} onChange={onUserFieldChange} /><br/><br/>
                Uw reactie moet op <UserField value={u.reactie_deadline} fieldKey="reactie_deadline" type="date" placeholder="[datum]" editable={editable} onChange={onUserFieldChange} /> bij de Rechtbank ontvangen zijn.
              </td>
              <td style={{ width: "50%", verticalAlign: "top" }}>
                <strong>Ga naar de zitting</strong><br/><br/>
                De kantonrechter van de <UserField value={u.rechtbank_naam} fieldKey="rechtbank_naam" editable={editable} onChange={onUserFieldChange} /><br/>
                <UserField value={u.rechtbank_bezoekadres} fieldKey="rechtbank_bezoekadres" placeholder="[bezoekadres]" editable={editable} onChange={onUserFieldChange} /><br/><br/>
                De zitting is op <UserField value={u.zitting_dag} fieldKey="zitting_dag" placeholder="[dag van de week]" editable={editable} onChange={onUserFieldChange} /> <UserField value={u.zitting_datum} fieldKey="zitting_datum" type="date" placeholder="[datum]" editable={editable} onChange={onUserFieldChange} /> om <UserField value={u.zitting_tijd} fieldKey="zitting_tijd" placeholder="[tijd]" editable={editable} onChange={onUserFieldChange} /> uur.
              </td>
            </tr>
          </tbody>
        </table>

        <div style={{ textAlign: "right", marginTop: "3em" }}>1</div>
      </div>

      <div style={{ pageBreakBefore: "always" }}></div>

      {/* Table of Contents */}
      <div className="toc" style={{ marginBottom: "2em" }}>
        <h2>Inhoudsopgave</h2>
        <div>1. Wat betekent deze dagvaarding voor u? ........................................................................................................ 2</div>
        <div style={{ marginLeft: "1em" }}>Wat als de eiser gelijk krijgt? ............................................................................................................................ 2</div>
        <div style={{ marginLeft: "1em" }}>Wat als de eiser geen gelijk krijgt? .................................................................................................................. 2</div>
        <div>2. Wat is de volledige eis?...................................................................................................................................... 3</div>
        <div>3. Waar is de eis op gebaseerd? .......................................................................................................................... 3</div>
        <div style={{ marginLeft: "1em" }}>Inleiding .............................................................................................................................................................. 3</div>
        <div style={{ marginLeft: "1em" }}>De opdracht en het werk ................................................................................................................................... 3</div>
        <div style={{ marginLeft: "1em" }}>Algemene voorwaarden .................................................................................................................................... 4</div>
        <div style={{ marginLeft: "1em" }}>De rekening ........................................................................................................................................................ 4</div>
        <div style={{ marginLeft: "1em" }}>Rente en incassokosten .................................................................................................................................... 4</div>
        <div style={{ marginLeft: "1em" }}>Reactie van {u.gedaagde_naam || "[naam gedaagde]"} ................................................................................. 5</div>
        <div style={{ marginLeft: "1em" }}>Bewijsmiddelen.................................................................................................................................................. 5</div>
        <div>4. U bent het eens met de eis ................................................................................................................................ 5</div>
        <div>5. U bent het niet eens met de eis ......................................................................................................................... 5</div>
        <div>6. U weet niet wat u moet doen ............................................................................................................................. 6</div>
        <div>7. Wat gebeurt er als u niets doet? ....................................................................................................................... 6</div>
        <div>8. Waar vindt u meer informatie? ......................................................................................................................... 6</div>
        <div>9. Officiële uitreiking door de gerechtsdeurwaarder ........................................................................................... 7</div>
      </div>

      {/* Section 1 */}
      <div className="section-1" style={{ marginBottom: "2em" }}>
        <h2>1. Wat betekent deze dagvaarding voor u?</h2>
        <p>Met de dagvaarding is een rechtszaak gestart. U bent de gedaagde. Wie de eiser is, leest u op het voorblad. De rechtszaak gaat over de eis die hieronder staat. De kantonrechter beslist over de eis in een vonnis. Dat doet de kantonrechter ook als u niets doet.</p>
        
        <h3>Wat als de eiser gelijk krijgt?</h3>
        <ul>
          <li>U moet doen wat er in het vonnis staat.</li>
          <li>U moet dan meestal ook de proceskosten van de eiser betalen. Deze kosten komen bovenop het totaalbedrag onder punt 2. Meer informatie over de kosten vindt u op rechtspraak.nl/kosten-rechtszaak</li>
          <li>Doet u niet wat er in het vonnis staat, dan kan de eiser opdracht geven aan de gerechtsdeurwaarder om bijvoorbeeld beslag te leggen op uw inkomen of spullen.</li>
        </ul>

        <h3>Wat als de eiser geen gelijk krijgt?</h3>
        <ul>
          <li>De zaak is daarmee meestal klaar. U hoeft dan niet te betalen.</li>
        </ul>
        <p>Aan het einde van deze dagvaarding leest u waar u meer informatie kunt vinden. Op de laatste pagina vindt u de officiële betekening door de gerechtsdeurwaarder.</p>
        
        <div style={{ textAlign: "right", marginTop: "2em" }}>2</div>
      </div>

      <div style={{ pageBreakBefore: "always" }}></div>

      {/* Section 2: Volledige eis */}
      <div className="section-2" style={{ marginBottom: "2em" }}>
        <h2>2. Wat is de volledige eis<sup>1</sup>?</h2>
        <p><UserField value={u.eiser_naam} fieldKey="eiser_naam" editable={editable} onChange={onUserFieldChange} /> vraagt met deze dagvaarding aan de kantonrechter:</p>
        
        <p>1. <UserField value={u.gedaagde_naam} fieldKey="gedaagde_naam" editable={editable} onChange={onUserFieldChange} /> te veroordelen tot betaling van:</p>

        <table style={{ marginLeft: "2em", marginBottom: "1em" }}>
          <tbody>
            <tr><td colSpan={3}><strong>Openstaande rekeningen, rente en incassokosten</strong></td></tr>
            <tr>
              <td style={{ width: "10%" }}>a.</td>
              <td>rekening <UserField value={u.rekening_nummer} fieldKey="rekening_nummer" placeholder="[nummer]" editable={editable} onChange={onUserFieldChange} /> d.d. <UserField value={u.rekening_datum} fieldKey="rekening_datum" type="date" placeholder="[datum]" editable={editable} onChange={onUserFieldChange} />:</td>
              <td style={{ textAlign: "right" }}>€ {(u.hoofdsom || 0).toLocaleString('nl-NL', { minimumFractionDigits: 2 })}</td>
            </tr>
            <tr>
              <td>b.</td>
              <td>rente tot <UserField value={u.rente_datum_tot} fieldKey="rente_datum_tot" type="date" placeholder="[datum]" editable={editable} onChange={onUserFieldChange} />:</td>
              <td style={{ textAlign: "right" }}>€ {(u.rente_bedrag || 0).toLocaleString('nl-NL', { minimumFractionDigits: 2 })}</td>
            </tr>
            <tr>
              <td>c.</td>
              <td>incassokosten:</td>
              <td style={{ textAlign: "right" }}>€ {(u.incassokosten || 0).toLocaleString('nl-NL', { minimumFractionDigits: 2 })}</td>
            </tr>
            <tr style={{ borderTop: "1px solid black" }}>
              <td></td>
              <td><strong>Tussenoptelling<sup>2</sup></strong></td>
              <td style={{ textAlign: "right" }}><strong>€ {tussenoptelling.toLocaleString('nl-NL', { minimumFractionDigits: 2 })}</strong></td>
            </tr>
          </tbody>
        </table>

        <table style={{ marginLeft: "2em", marginBottom: "1em" }}>
          <tbody>
            <tr><td colSpan={3}><strong>De proceskosten tot nu toe:</strong></td></tr>
            <tr>
              <td style={{ width: "10%" }}>d.</td>
              <td>salaris gemachtigde</td>
              <td style={{ textAlign: "right" }}>€ {(u.salaris_gemachtigde || 0).toLocaleString('nl-NL', { minimumFractionDigits: 2 })}</td>
            </tr>
            <tr>
              <td>e.</td>
              <td>kosten dagvaarding</td>
              <td style={{ textAlign: "right" }}>€ {(u.kosten_dagvaarding || 0).toLocaleString('nl-NL', { minimumFractionDigits: 2 })}</td>
            </tr>
            <tr style={{ borderTop: "1px solid black" }}>
              <td></td>
              <td><strong>Totaal tot nu toe</strong></td>
              <td style={{ textAlign: "right" }}><strong>€ {totaal.toLocaleString('nl-NL', { minimumFractionDigits: 2 })}</strong></td>
            </tr>
          </tbody>
        </table>

        <p>2. <UserField value={u.gedaagde_naam} fieldKey="gedaagde_naam" editable={editable} onChange={onUserFieldChange} /> te veroordelen tot betaling van de wettelijke rente over € {tussenoptelling.toLocaleString('nl-NL', { minimumFractionDigits: 2 })} vanaf <UserField value={u.rente_vanaf_datum} fieldKey="rente_vanaf_datum" type="date" placeholder="[datum]" editable={editable} onChange={onUserFieldChange} />;</p>

        <p>3. <UserField value={u.gedaagde_naam} fieldKey="gedaagde_naam" editable={editable} onChange={onUserFieldChange} /> te veroordelen tot betaling van de proceskosten die na deze dagvaarding nog worden gemaakt, waaronder het griffierecht dat <UserField value={u.eiser_naam} fieldKey="eiser_naam" editable={editable} onChange={onUserFieldChange} /> aan de rechtbank moet betalen voor het behandelen van deze zaak en het nasalaris;</p>

        <p>4. De uitspraak uitvoerbaar bij voorraad te verklaren.</p>

        <p className="footer-italic"><sup>1</sup> Dit is het petitum/vordering van de dagvaarding.</p>
        <p className="footer-italic"><sup>2</sup> Het opnemen van een tussenoptelling is van belang omdat het griffierecht over dit bedrag wordt berekend.</p>

        <div style={{ textAlign: "right", marginTop: "2em" }}>3</div>
      </div>

      <div style={{ pageBreakBefore: "always" }}></div>

      {/* Section 3: Gronden */}
      <div className="section-3" style={{ marginBottom: "2em" }}>
        <h2>3. Waar is de eis op gebaseerd<sup>3</sup>?</h2>
        
        <h3>Inleiding</h3>
        <div><strong>1.</strong> <AIField value={a.inleiding} fieldKey="inleiding" multiline placeholder="Deze zaak gaat om een rekening die [naam eiser] heeft gestuurd aan [naam gedaagde] voor [omschrijving]..." /></div>

        <h3>De opdracht en het werk</h3>
        <p>2. <UserField value={u.eiser_naam} fieldKey="eiser_naam" editable={editable} onChange={onUserFieldChange} /> en <UserField value={u.gedaagde_naam} fieldKey="gedaagde_naam" editable={editable} onChange={onUserFieldChange} /> hebben een overeenkomst gesloten op <AIField value={a.overeenkomst_datum} fieldKey="overeenkomst_datum" placeholder="[datum]" /> (bewijsstuk R1).</p>

        <div><strong>3.</strong> <AIField value={a.overeenkomst_omschrijving} fieldKey="overeenkomst_omschrijving" multiline placeholder="[Omschrijving van de totstandkoming en uitvoering van de overeenkomst, waarbij ook de informatie wordt gegeven voor de toets in consumentenzaken]" /></div>

        <div style={{ textAlign: "right", marginTop: "2em" }}>3</div>
      </div>

      <div style={{ pageBreakBefore: "always" }}></div>

      {/* Section 3 continued: Algemene voorwaarden */}
      <div className="section-3-continued" style={{ marginBottom: "2em" }}>
        <h3>Algemene voorwaarden<sup>4</sup></h3>
        <p>4. In de <AIField value={a.algemene_voorwaarden_document} fieldKey="algemene_voorwaarden_document" placeholder="[offerte, overeenkomst]" /> staat dat de algemene voorwaarden van toepassing zijn (bewijsstuk R2). <UserField value={u.gedaagde_naam} fieldKey="gedaagde_naam" editable={editable} onChange={onUserFieldChange} /> heeft de algemene voorwaarden van <UserField value={u.eiser_naam} fieldKey="eiser_naam" editable={editable} onChange={onUserFieldChange} /> gekregen.</p>

        <p>5. In artikel <AIField value={a.algemene_voorwaarden_artikelnummer_betaling} fieldKey="algemene_voorwaarden_artikelnummer_betaling" placeholder="[artikelnummer]" /> van de algemene voorwaarden staat dat de rekening binnen <AIField value={a.algemene_voorwaarden_betalingstermijn_dagen} fieldKey="algemene_voorwaarden_betalingstermijn_dagen" placeholder="[aantal]" /> dagen moet worden betaald. Daarna is rente van <AIField value={a.algemene_voorwaarden_rente_percentage} fieldKey="algemene_voorwaarden_rente_percentage" placeholder="[percentage]" /> per jaar over het openstaande bedrag verschuldigd.</p>

        <p>6. In de algemene voorwaarden staat verder in artikel <AIField value={a.algemene_voorwaarden_artikelnummer_incasso} fieldKey="algemene_voorwaarden_artikelnummer_incasso" placeholder="[artikelnummer]" /> dat buitengerechtelijke kosten verschuldigd zijn als niet op tijd wordt betaald.</p>

        <h3>De rekening</h3>
        <p>7. <UserField value={u.eiser_naam} fieldKey="eiser_naam" editable={editable} onChange={onUserFieldChange} /> heeft <UserField value={u.gedaagde_naam} fieldKey="gedaagde_naam" editable={editable} onChange={onUserFieldChange} /> de volgende rekening gezonden:<br/>
        o rekeningnr. <UserField value={u.rekening_nummer} fieldKey="rekening_nummer" editable={editable} onChange={onUserFieldChange} /> d.d. <UserField value={u.rekening_datum} fieldKey="rekening_datum" type="date" editable={editable} onChange={onUserFieldChange} /> voor een bedrag van € {(u.hoofdsom || 0).toLocaleString('nl-NL', { minimumFractionDigits: 2 })} (bewijsstuk R3).</p>

        <p>8. <UserField value={u.gedaagde_naam} fieldKey="gedaagde_naam" editable={editable} onChange={onUserFieldChange} /> heeft de rekening niet helemaal betaald. Een bedrag van € <AIField value={a.onbetaald_bedrag} fieldKey="onbetaald_bedrag" placeholder="[bedrag]" /> staat nog open.</p>

        <h3>Rente en incassokosten</h3>
        <h4>Aanmaning en verzuim</h4>
        <p>9. In de brief van <AIField value={a.veertiendagenbrief_datum} fieldKey="veertiendagenbrief_datum" placeholder="[datum veertiendagenbrief]" /> heeft <UserField value={u.eiser_naam} fieldKey="eiser_naam" editable={editable} onChange={onUserFieldChange} /> aan <UserField value={u.gedaagde_naam} fieldKey="gedaagde_naam" editable={editable} onChange={onUserFieldChange} /> een termijn van 14 dagen gegeven om alsnog te betalen (bewijsstuk R4). In deze brief is ook vermeld wat de gevolgen zijn van het uitblijven van betaling. <UserField value={u.gedaagde_naam} fieldKey="gedaagde_naam" editable={editable} onChange={onUserFieldChange} /> heeft niet betaald en is daardoor in verzuim geraakt.</p>

        <h4>Rente</h4>
        <div><strong>10.</strong> <AIField value={a.rente_berekening_uitleg} fieldKey="rente_berekening_uitleg" multiline placeholder="[Naam eiser] heeft recht op de overeengekomen rente over het onbetaalde bedrag van de rekening vanaf 14 dagen na rekeningdatum. Tot [datum] is deze rente € [bedrag]." /></div>

        <h4>Buitengerechtelijke incassokosten</h4>
        <p>11. <UserField value={u.eiser_naam} fieldKey="eiser_naam" editable={editable} onChange={onUserFieldChange} /> heeft opdracht gegeven de door <UserField value={u.gedaagde_naam} fieldKey="gedaagde_naam" editable={editable} onChange={onUserFieldChange} /> verschuldigde bedragen voor haar te incasseren.</p>

        <p>12. Op <AIField value={a.aanmaning_datum} fieldKey="aanmaning_datum" placeholder="[datum]" /> heeft <UserField value={u.eiser_naam} fieldKey="eiser_naam" editable={editable} onChange={onUserFieldChange} /> een aanmaning gestuurd (bewijsstuk R5). De aanmaning is verstuurd aan het <AIField value={a.aanmaning_verzendwijze} fieldKey="aanmaning_verzendwijze" placeholder="woonadres/e-mailadres" /> van <UserField value={u.gedaagde_naam} fieldKey="gedaagde_naam" editable={editable} onChange={onUserFieldChange} /> en zal op <AIField value={a.aanmaning_ontvangst_datum} fieldKey="aanmaning_ontvangst_datum" placeholder="[datum]" /> door hem zijn ontvangen. In de aanmaning heeft <UserField value={u.gedaagde_naam} fieldKey="gedaagde_naam" editable={editable} onChange={onUserFieldChange} /> 14 dagen de tijd gekregen om te betalen. In de aanmaning staat ook dat deze termijn ingaat op de dag na ontvangst hiervan. In de aanmaning staat ook dat <UserField value={u.gedaagde_naam} fieldKey="gedaagde_naam" editable={editable} onChange={onUserFieldChange} /> daarnaast incassokosten moet betalen als hij de rekening niet op tijd betaalt<sup>5</sup>.</p>

        <p>13. <UserField value={u.gedaagde_naam} fieldKey="gedaagde_naam" editable={editable} onChange={onUserFieldChange} /> heeft niet betaald.</p>

        <p className="footer-italic"><sup>3</sup> Dit zijn de gronden van de eis, waarin ook wordt voldaan aan de substantiering en de bewijsaandraagplicht. In dit deel van de dagvaarding dient ook de informatie te worden gegeven voor de toetsing van consumentenzaken.</p>
        <p className="footer-italic"><sup>4</sup> Als geen algemene voorwaarden van toepassing zijn kan volstaan worden met de vermelding dat er geen algemene voorwaarden van toepassing zijn.</p>
        <p className="footer-italic"><sup>5</sup> Hier wordt de veertiendagenbrief vermeld. De huidige uitgebreide verwijzingen naar de wet kunnen achterwege gelaten worden.</p>

        <div style={{ textAlign: "right", marginTop: "2em" }}>4</div>
      </div>

      <div style={{ pageBreakBefore: "always" }}></div>

      {/* Section 3 continued: Incassokosten, Reactie, Bewijsmiddelen */}
      <div className="section-3-final" style={{ marginBottom: "2em" }}>
        <p>14. De buitengerechtelijke incassokosten bedragen € {(u.incassokosten || 0).toLocaleString('nl-NL', { minimumFractionDigits: 2 })}. Dit bedrag is berekend volgens het Besluit vergoeding voor buitengerechtelijke incassokosten.</p>

        <h3>Reactie van <UserField value={u.gedaagde_naam} fieldKey="gedaagde_naam" editable={editable} onChange={onUserFieldChange} /></h3>
        <p>15. <AIField value={a.reactie_gedaagde} fieldKey="reactie_gedaagde" multiline placeholder="[Vermelden reactie van gedaagde en de reactie van eiser daarop]" /></p>

        <h3>Bewijsmiddelen</h3>
        <p>16. R1: <AIField value={a.bewijsmiddel_r1} fieldKey="bewijsmiddel_r1" placeholder="[offerte/overeenkomst]" />;</p>
        <p style={{ marginLeft: "2em" }}>R2: <AIField value={a.bewijsmiddel_r2} fieldKey="bewijsmiddel_r2" placeholder="algemene voorwaarden [naam eiser]" />;</p>
        <p style={{ marginLeft: "2em" }}>R3: <AIField value={a.bewijsmiddel_r3} fieldKey="bewijsmiddel_r3" placeholder="rekening van [naam eiser] met nr. [nummer] van [datum]" />;</p>
        <p style={{ marginLeft: "2em" }}>R4: <AIField value={a.bewijsmiddel_r4} fieldKey="bewijsmiddel_r4" placeholder="de brief van [naam eiser] aan [naam gedaagde] van [datum]" />;</p>
        <p style={{ marginLeft: "2em" }}>R5: <AIField value={a.bewijsmiddel_r5} fieldKey="bewijsmiddel_r5" placeholder="de brief van de [naam eiser] aan [naam gedaagde] van [datum]" />;</p>

        <p>17. <AIField value={a.bewijsmiddel_overig} fieldKey="bewijsmiddel_overig" multiline placeholder="[Naam eiser] biedt aan te bewijzen dat [te bewijzen feiten]." /> Getuigen zijn: <AIField value={a.getuigen} fieldKey="getuigen" placeholder="[namen en functie]" />.</p>

        <div style={{ textAlign: "right", marginTop: "2em" }}>5</div>
      </div>

      <div style={{ pageBreakBefore: "always" }}></div>

      {/* Sections 4-8 */}
      <div className="sections-4-8" style={{ marginBottom: "2em" }}>
        <h2>4. U bent het eens met de eis</h2>
        <p>Als u het eens bent met de eis, kunt u vaak de rechtszaak stoppen door te betalen. Dat is meestal goedkoper dan wanneer u betaalt nadat de kantonrechter de eiser gelijk heeft gegeven. Wat u moet betalen om de rechtszaak te stoppen, wanneer en aan wie, vindt u op het eerste blad van deze dagvaarding. Heeft u vragen over wat u moet betalen en op welke manier? Neemt u dan contact op met de vertegenwoordiger van de eiser. De gegevens van de vertegenwoordiger staan op het voorblad.</p>

        <h2>5. U bent het niet eens met de eis</h2>
        <p>Als u het niet eens bent met de eis of met een onderdeel van de eis, dan kunt u daartegen verweer voeren. Dan moet u de kantonrechter laten weten dat u het niet eens bent met de eis en waarom niet.</p>

        <p>U kunt zelf verweer voeren of u kunt iemand anders namens u verweer laten voeren. U moet dan een verklaring ondertekenen dat iemand anders dat mag doen. Dat heet een schriftelijke machtiging. Geef de machtiging mee of stuur hem naar de rechtbank. Op rechtspraak.nl/kantondagvaarding leest u hier meer over.</p>

        <p>Om verweer te voeren hoeft u niets aan de rechtbank te betalen<sup>6</sup>.</p>

        <p>Als u verweer voert dan moet u alles wat belangrijk is voor deze rechtszaak eerlijk opschrijven of vertellen aan de rechter. De eiser moet dit ook doen. De kantonrechter neemt een beslissing op basis van wat u en de eiser opschrijven en vertellen. Als de eiser iets opschrijft of vertelt waar u het niet mee eens bent, dan moet u duidelijk opschrijven of vertellen aan de rechter dat dit niet juist is en waarom dit niet juist is. Als u dat niet doet dan gaat de rechter er meestal vanuit dat het juist is wat de eiser opschrijft of vertelt. Andersom is dit ook zo: als u iets opschrijft of vertelt dan gaat de rechter er meestal ook vanuit dat dit juist is, behalve als de eiser schrijft of zegt dat dit niet juist is.</p>

        <p><strong>Verweer voeren kan op 2 manieren:</strong></p>

        <p><strong>1. stuur een brief aan de kantonrechter</strong><br/>
        Als u uw verweer kunt onderbouwen met bewijsstukken zoals brieven, rekeningafschriften of betalingsbewijzen, stuur dan een kopie van die stukken mee. Uw brief moet dan op tijd door de rechtbank zijn ontvangen. Op het eerste blad van deze dagvaarding vindt u de adresgegevens van de rechtbank en wanneer uw brief moet zijn ontvangen. Op rechtspraak.nl/kantondagvaarding leest u hier meer over en vindt u een schrijfhulp om uw verweer aan de kantonrechter te schrijven.</p>

        <p><strong>of</strong></p>

        <p><strong>2. ga naar de zitting van de kantonrechter</strong><br/>
        Op het eerste blad van deze dagvaarding staat waar en wanneer de zitting is. Op de zitting kunt u een brief met uw verweer geven aan de kantonrechter of uw verweer aan de kantonrechter vertellen. Als u uw verweer kunt onderbouwen met bewijsstukken zoals brieven, rekeningafschriften of betalingsbewijzen, neem dan een kopie van die stukken mee.</p>

        <p>Houd er rekening mee dat de zitting openbaar is. Er zitten meestal ook andere mensen in de zaal. Vaak moet u wachten tot uw zaak aan de beurt is. De eiser is niet aanwezig bij deze zitting. Op rechtspraak.nl/kantondagvaarding leest u meer over wat u kunt verwachten als u naar de zitting gaat.</p>

        <p className="footer-italic"><sup>6</sup> Dit is de aanzegging dat geen griffierecht verschuldigd is bij verschijning.</p>

        <div style={{ textAlign: "right", marginTop: "2em" }}>5</div>
      </div>

      <div style={{ pageBreakBefore: "always" }}></div>

      {/* Sections 6-8 */}
      <div className="sections-6-8" style={{ marginBottom: "2em" }}>
        <h2>6. U weet niet wat u moet doen</h2>
        <p>Weet u niet wat u moet doen? Zoek dan hulp. Dit kan bijvoorbeeld bij het Juridisch Loket, een (schuld)hulpverlener, een jurist, uw rechtsbijstandsverzekeraar of een advocaat.</p>

        <h2>7. Wat gebeurt er als u niets doet<sup>7</sup>?</h2>
        <p>Als u niet op tijd een brief aan de kantonrechter stuurt en ook niet naar de zitting gaat, dan neemt de kantonrechter toch een beslissing. Op het eerste blad van deze dagvaarding staat wanneer de zitting wordt gehouden en wanneer uw brief moet zijn ontvangen. De kantonrechter bekijkt of de regels zijn gevolgd, maar onderzoekt niet uitgebreid of de eis klopt. Meestal krijgt de eiser dan gelijk. De kantonrechter veroordeelt u dan bij verstek om te doen wat de eiser vraagt. Hier vindt u meer over op rechtspraak.nl/kantondagvaarding.</p>

        <h2>8. Waar vindt u meer informatie?</h2>
        <p>Op rechtspraak.nl/kantondagvaarding vindt u meer informatie over:</p>
        <ul>
          <li>Hoe een dagvaardingsprocedure verloopt</li>
          <li>Hoe u kunt reageren op een dagvaarding</li>
          <li>Wat er gebeurt tijdens een zitting</li>
          <li>Wat de gevolgen zijn als de rechter de eiser gelijk geeft</li>
          <li>Wat u kunt doen als u niet reageert maar later toch verweer wil voeren.</li>
        </ul>

        <p className="footer-italic"><sup>7</sup> Deze alinea is de verstekaanzegging.</p>

        <div style={{ textAlign: "right", marginTop: "2em" }}>6</div>
      </div>

      <div style={{ pageBreakBefore: "always" }}></div>

      {/* Section 9: Deurwaarder */}
      <div className="section-9" style={{ marginBottom: "2em" }}>
        <p style={{ textAlign: "center", marginBottom: "1em" }}>Scan de QR code voor informatie op rechtspraak.nl:</p>
        
        <h2>9. Officiële uitreiking door de gerechtsdeurwaarder</h2>
        <p>Vandaag <UserField value={u.deurwaarder_datum} fieldKey="deurwaarder_datum" type="date" placeholder="[datum]" editable={editable} onChange={onUserFieldChange} /></p>

        <p>heb ik, <UserField value={u.deurwaarder_naam} fieldKey="deurwaarder_naam" placeholder="[naam]" editable={editable} onChange={onUserFieldChange} />, gerechtsdeurwaarder in <UserField value={u.deurwaarder_plaats} fieldKey="deurwaarder_plaats" placeholder="[plaats]" editable={editable} onChange={onUserFieldChange} />, daar kantoorhoudende aan <UserField value={u.deurwaarder_adres} fieldKey="deurwaarder_adres" placeholder="[adres]" editable={editable} onChange={onUserFieldChange} />, op verzoek van <UserField value={u.eiser_naam} fieldKey="eiser_naam" editable={editable} onChange={onUserFieldChange} />, gevestigd in <UserField value={u.eiser_plaats} fieldKey="eiser_plaats" editable={editable} onChange={onUserFieldChange} />, deze dagvaarding met bijbehorende bewijsstukken 1 tot en met 5 uitgebracht aan gedaagde:</p>

        <p><UserField value={u.gedaagde_naam} fieldKey="gedaagde_naam" editable={editable} onChange={onUserFieldChange} /> (<UserField value={u.gedaagde_geboortedatum} fieldKey="gedaagde_geboortedatum" type="date" placeholder="geboortedatum" editable={editable} onChange={onUserFieldChange} />), wonende in <UserField value={u.gedaagde_adres} fieldKey="gedaagde_adres" editable={editable} onChange={onUserFieldChange} />.</p>

        <p>Ik heb een afschrift van deze dagvaarding en bijbehorende bewijsstukken gelaten aan:</p>

        <p><strong>Hemzelf</strong></p>

        <p><strong>Of</strong></p>

        <p>het adres hierboven in een gesloten envelop met daarop de vermeldingen zoals wettelijk voorgeschreven, omdat ik aldaar niemand aantrof aan wie rechtsgeldig afschrift hiervan kon worden gelaten.</p>

        <p><UserField value={u.eiser_naam} fieldKey="eiser_naam" editable={editable} onChange={onUserFieldChange} /> kiest in deze zaak woonplaats in <UserField value={u.eiser_plaats} fieldKey="eiser_plaats" editable={editable} onChange={onUserFieldChange} />, <UserField value={u.eiser_vertegenwoordiger_adres} fieldKey="eiser_vertegenwoordiger_adres" editable={editable} onChange={onUserFieldChange} />, op het kantoor van <UserField value={u.eiser_vertegenwoordiger_naam} fieldKey="eiser_vertegenwoordiger_naam" editable={editable} onChange={onUserFieldChange} />, die in deze zaak voor <UserField value={u.eiser_naam} fieldKey="eiser_naam" editable={editable} onChange={onUserFieldChange} /> als gemachtigde zullen/zal optreden.</p>

        <table style={{ marginTop: "1em", width: "50%" }}>
          <tbody>
            <tr><td colSpan={2}><strong>De kosten van het uitreiken van deze dagvaarding zijn:</strong></td></tr>
            <tr>
              <td>Basistarief uitreiking dagvaarding</td>
              <td style={{ textAlign: "right" }}>€ {(u.deurwaarder_kosten_basis || 0).toLocaleString('nl-NL', { minimumFractionDigits: 2 })}</td>
            </tr>
            <tr><td colSpan={2}>Extra kosten:</td></tr>
            <tr>
              <td>- adresinformatie</td>
              <td style={{ textAlign: "right" }}>€ {(u.deurwaarder_kosten_adresinfo || 0).toLocaleString('nl-NL', { minimumFractionDigits: 2 })}</td>
            </tr>
            <tr>
              <td>- bevraging beslagregister</td>
              <td style={{ textAlign: "right" }}>€ {(u.deurwaarder_kosten_beslagregister || 0).toLocaleString('nl-NL', { minimumFractionDigits: 2 })}</td>
            </tr>
            <tr style={{ borderTop: "1px solid black" }}>
              <td><strong>Totaal</strong></td>
              <td style={{ textAlign: "right" }}><strong>€ {deurwaarder_totaal.toLocaleString('nl-NL', { minimumFractionDigits: 2 })}</strong></td>
            </tr>
          </tbody>
        </table>

        <p>De extra kosten zijn nodig om de dagvaarding op een wettelijk juiste manier uit te reiken. De gerechtsdeurwaarder heeft geen belang in degene die deze extra kosten in rekening heeft gebracht.</p>

        <div style={{ textAlign: "right", marginTop: "3em" }}>8</div>
      </div>
    </div>
  );
}
