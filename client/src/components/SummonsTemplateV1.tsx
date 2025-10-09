import { useState, useEffect } from "react";

interface SummonsTemplateV1Props {
  userFields: Record<string, any>;
  aiFields: Record<string, any>;
  onUserFieldChange?: (key: any, value: string | number) => void;
  editable?: boolean;
  templateId: string;
}

// Reusable components for fields
function UserField({ 
  value, 
  fieldKey, 
  placeholder = "[Nog in te vullen]",
  editable = false,
  onChange
}: { 
  value: string | number | undefined; 
  fieldKey: string;
  placeholder?: string;
  editable: boolean;
  onChange?: (key: string, value: string | number) => void;
}) {
  const isEmpty = !value || value === "";
  
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
      type="text"
      value={value || ""}
      onChange={(e) => onChange?.(fieldKey, e.target.value)}
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
  fieldKey: string;
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

export function SummonsTemplateV1({ userFields, aiFields, onUserFieldChange, editable = false }: SummonsTemplateV1Props) {
  const u = userFields;
  const a = aiFields;

  // Helper to get field value
  const getField = (key: string, isAI = false) => {
    const normalizedKey = key.toLowerCase().replace(/[^a-z0-9]+/g, '_');
    return isAI ? a[normalizedKey] : u[normalizedKey];
  };

  return (
    <div className="summons-template-v1 bg-white text-black font-serif" style={{ fontSize: "12pt", lineHeight: "1.5" }}>
      <style>{`
        @media print {
          @page {
            size: A4;
            margin: 2.5cm;
          }
          .summons-template-v1 {
            width: 100%;
            max-width: none;
          }
          .user-field-input {
            border: none !important;
            background: transparent !important;
            padding: 0 !important;
          }
          .ai-field-display {
            border: none !important;
            background: transparent !important;
            padding: 0 !important;
          }
        }
        
        .summons-template-v1 {
          max-width: 21cm;
          margin: 0 auto;
          padding: 2.5cm;
          background: white;
          box-shadow: 0 0 10px rgba(0,0,0,0.1);
        }
      `}</style>

      <div className="text-center mb-8">
        <h1 className="text-xl font-bold mb-2">📄 DAGVAARDING KANTONRECHTER</h1>
        <p className="text-sm">(zonder aanzegging, met vaste teksten en invulvelden)</p>
      </div>

      <div className="mb-6">
        <h2 className="font-bold text-lg mb-2">DAGVAARDING</h2>
        <p>Datum: <UserField value={u.datum_opmaak} fieldKey="datum_opmaak" editable={editable} onChange={onUserFieldChange} /></p>
      </div>

      <div className="mb-6">
        <h3 className="font-bold mb-2">1. Partijen</h3>
        
        <div className="mb-4">
          <p className="font-semibold">Eiser(es):</p>
          <p>Naam: <UserField value={u.naam_eiser} fieldKey="naam_eiser" editable={editable} onChange={onUserFieldChange} /></p>
          <p>Adres: <UserField value={u.adres_eiser} fieldKey="adres_eiser" editable={editable} onChange={onUserFieldChange} /></p>
          <p>Postcode en woonplaats: <UserField value={u.woonplaats_eiser} fieldKey="woonplaats_eiser" editable={editable} onChange={onUserFieldChange} /></p>
          <p>Geboortedatum / KvK-nummer (indien van toepassing): <UserField value={u.geboortedatum_of_kvk} fieldKey="geboortedatum_of_kvk" editable={editable} onChange={onUserFieldChange} /></p>
          <p>Eventueel vertegenwoordigd door: <UserField value={u.gemachtigde_advocaat_deurwaarder} fieldKey="gemachtigde_advocaat_deurwaarder" editable={editable} onChange={onUserFieldChange} /></p>
        </div>

        <p className="text-center my-2 font-semibold">tegen</p>

        <div className="mb-4">
          <p className="font-semibold">Gedaagde:</p>
          <p>Naam: <UserField value={u.naam_gedaagde} fieldKey="naam_gedaagde" editable={editable} onChange={onUserFieldChange} /></p>
          <p>Adres: <UserField value={u.adres_gedaagde} fieldKey="adres_gedaagde" editable={editable} onChange={onUserFieldChange} /></p>
          <p>Postcode en woonplaats: <UserField value={u.woonplaats_gedaagde} fieldKey="woonplaats_gedaagde" editable={editable} onChange={onUserFieldChange} /></p>
          <p>Geboortedatum / KvK-nummer (indien van toepassing): <UserField value={u.geboortedatum_of_kvk_gedaagde} fieldKey="geboortedatum_of_kvk_gedaagde" editable={editable} onChange={onUserFieldChange} /></p>
        </div>
      </div>

      <div className="mb-6">
        <h3 className="font-bold mb-2">2. Oproep</h3>
        <p>Aan: <UserField value={u.naam_gedaagde} fieldKey="naam_gedaagde" editable={editable} onChange={onUserFieldChange} /></p>
        <p className="mt-2">
          U wordt hierbij opgeroepen om te verschijnen ter terechtzitting van de Rechtbank{' '}
          <UserField value={u.rechtbanknaam} fieldKey="rechtbanknaam" editable={editable} onChange={onUserFieldChange} />, 
          sector kanton, locatie <UserField value={u.plaats_rechtbank} fieldKey="plaats_rechtbank" editable={editable} onChange={onUserFieldChange} />,
          op <UserField value={u.datum_zitting} fieldKey="datum_zitting" editable={editable} onChange={onUserFieldChange} /> om{' '}
          <UserField value={u.tijdstip} fieldKey="tijdstip" editable={editable} onChange={onUserFieldChange} /> uur.
        </p>
        <p className="mt-2">De zitting zal plaatsvinden in de openbare terechtzitting van de kantonrechter in bovengenoemde rechtbank.</p>
      </div>

      <div className="mb-6">
        <h3 className="font-bold mb-2">3. Inleiding</h3>
        <p>Deze dagvaarding heeft betrekking op een geschil tussen eiser(es) en gedaagde met betrekking tot:</p>
        <AIField value={a.korte_omschrijving_van_het_geschil} fieldKey="korte_omschrijving_van_het_geschil" multiline />
      </div>

      <div className="mb-6">
        <h3 className="font-bold mb-2">4. Feiten</h3>
        <p className="mb-2">Eiser(es) legt aan deze vordering de volgende feiten ten grondslag:</p>
        <AIField value={a.chronologisch_feitenrelaas} fieldKey="chronologisch_feitenrelaas" multiline />
      </div>

      <div className="mb-6">
        <h3 className="font-bold mb-2">5. De vordering (Eis)</h3>
        <p className="mb-2">Eiser(es) vordert dat de kantonrechter bij vonnis, uitvoerbaar bij voorraad, gedaagde veroordeelt tot het volgende:</p>
        <AIField value={a.hoofdeis} fieldKey="hoofdeis" multiline />
        <AIField value={a.nevenvordering} fieldKey="nevenvordering" multiline />
        <AIField value={a.vergoeding_van_buitengerechtelijke_incassokosten} fieldKey="vergoeding_van_buitengerechtelijke_incassokosten" multiline />
        <AIField value={a.veroordeling_van_gedaagde_in_de_proceskosten} fieldKey="veroordeling_van_gedaagde_in_de_proceskosten" multiline />
        <p className="mt-2">Teneinde te horen veroordelen overeenkomstig bovenstaande vorderingen.</p>
      </div>

      <div className="mb-6">
        <h3 className="font-bold mb-2">6. Gronden van de vordering (Motivering)</h3>
        <p className="mb-2">Eiser(es) grondt deze vorderingen op het volgende:</p>
        <AIField value={a.juridische_motivering} fieldKey="juridische_motivering" multiline />
      </div>

      <div className="mb-6">
        <h3 className="font-bold mb-2">7. Bewijs en producties</h3>
        <p className="mb-2">Ter onderbouwing van deze vorderingen verwijst eiser(es) naar de volgende producties:</p>
        <table className="w-full border-collapse border border-gray-300 my-2">
          <thead>
            <tr className="bg-gray-100">
              <th className="border border-gray-300 p-2 text-left">Nr.</th>
              <th className="border border-gray-300 p-2 text-left">Omschrijving productie</th>
              <th className="border border-gray-300 p-2 text-left">Door wie ingebracht</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td className="border border-gray-300 p-2">1</td>
              <td className="border border-gray-300 p-2">
                <UserField value={u.naam_bestand_document_1} fieldKey="naam_bestand_document_1" editable={editable} onChange={onUserFieldChange} />
              </td>
              <td className="border border-gray-300 p-2">Eiser(es)</td>
            </tr>
            <tr>
              <td className="border border-gray-300 p-2">2</td>
              <td className="border border-gray-300 p-2">
                <UserField value={u.naam_bestand_document_2} fieldKey="naam_bestand_document_2" editable={editable} onChange={onUserFieldChange} />
              </td>
              <td className="border border-gray-300 p-2">Eiser(es)</td>
            </tr>
            <tr>
              <td className="border border-gray-300 p-2">3</td>
              <td className="border border-gray-300 p-2">
                <AIField value={a.eventueel_aanvullend_bewijs} fieldKey="eventueel_aanvullend_bewijs" />
              </td>
              <td className="border border-gray-300 p-2">AI</td>
            </tr>
          </tbody>
        </table>
        <p className="mt-2">Eiser(es) biedt, voor zover vereist, aan het gestelde te bewijzen met alle middelen rechtens, in het bijzonder door overlegging van bovengenoemde producties en het horen van partijen en getuigen.</p>
      </div>

      <div className="mb-6">
        <h3 className="font-bold mb-2">8. Reactie van gedaagde (informatie voor leken)</h3>
        <p className="italic text-sm mb-2">(Deze tekst blijft altijd staan, is wettelijk voorgeschreven in lekenprocedures.)</p>
        <p>U kunt schriftelijk of mondeling reageren op deze dagvaarding.</p>
        <p>Als u het eens bent met de vordering, hoeft u niets te doen; de rechter kan de vordering dan toewijzen.</p>
        <p>Als u het niet eens bent, kunt u verweer voeren tijdens of vóór de zitting.</p>
        <p>Verschijnt u niet, dan kan de rechter uitspraak doen zonder uw reactie ("verstek").</p>
        <p>Heeft u vragen over de procedure, kijk dan op www.rechtspraak.nl of neem contact op met de griffie van de rechtbank.</p>
      </div>

      <div className="mb-6">
        <h3 className="font-bold mb-2">9. Proceskosten</h3>
        <p>Eiser(es) verzoekt de kantonrechter om gedaagde te veroordelen in de kosten van de procedure, waaronder begrepen het griffierecht en de kosten van betekening.</p>
      </div>

      <div className="mb-6">
        <h3 className="font-bold mb-2">10. Slot en ondertekening</h3>
        <p className="mb-2">
          Aldus opgemaakt en ondertekend te <UserField value={u.plaats_opmaak} fieldKey="plaats_opmaak" editable={editable} onChange={onUserFieldChange} />,
          op <UserField value={u.datum_opmaak} fieldKey="datum_opmaak" editable={editable} onChange={onUserFieldChange} />.
        </p>
        <div className="mt-4">
          <p><UserField value={u.naam_gemachtigde_of_eiser} fieldKey="naam_gemachtigde_of_eiser" editable={editable} onChange={onUserFieldChange} /></p>
          <p><UserField value={u.adres_gemachtigde_kantooradres} fieldKey="adres_gemachtigde_kantooradres" editable={editable} onChange={onUserFieldChange} /></p>
          <p><UserField value={u.handtekening_digitaal_of_fysiek} fieldKey="handtekening_digitaal_of_fysiek" placeholder="[Handtekening]" editable={editable} onChange={onUserFieldChange} /></p>
        </div>
      </div>

      <div className="mb-6">
        <h3 className="font-bold mb-2">11. Bijlagen</h3>
        <p className="text-sm text-gray-600 italic">(Voeg hier de relevante documenten toe)</p>
      </div>
    </div>
  );
}
