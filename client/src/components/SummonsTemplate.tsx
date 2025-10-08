import { useState } from "react";

// SummonsV1 TypeScript interface based on specification
interface SummonsV1 {
  meta: {
    template_version: string;
    language: string;
  };
  court: {
    name: string;
    visit_address: string;
    postal_address: string;
    hearing_day: string;
    hearing_date: string;
    hearing_time: string;
  };
  parties: {
    claimant: {
      name: string;
      place: string;
      rep_name: string;
      rep_address: string;
      phone: string;
      email: string;
      iban: string;
      dossier: string;
    };
    defendant: {
      name: string;
      address: string;
      birthdate: string;
      is_consumer: boolean;
    };
  };
  case: {
    subject: string;
    amount_eur: number;
    interest: {
      type: string;
      from_date: string;
    };
    interim_sum_eur: number;
    costs: {
      salaris_gemachtigde_eur: number;
      dagvaarding_eur: number;
    };
    total_to_date_eur: number;
  };
  sections: {
    full_claim_items: Array<{
      label: string;
      amount_eur: number;
    }>;
    orders_requested: string[];
    grounds: {
      intro: string[];
      assignment_and_work: string[];
      terms_and_conditions: string[];
      invoice: string[];
      interest_and_collection_costs: string[];
      defendant_response: string[];
      evidence: {
        list: string[];
        offer_of_proof: string;
        witnesses: string[];
      };
    };
  };
  service_block?: {
    bailiff_name: string;
    bailiff_city: string;
    bailiff_address: string;
    served_to: string;
    extra_costs: Array<{
      label: string;
      amount_eur: number;
    }>;
    base_service_fee_eur: number;
    total_service_costs_eur: number;
  };
  signoff: {
    place: string;
    date: string;
    representative: string;
  };
}

interface SummonsTemplateProps {
  data: SummonsV1;
  className?: string;
}

export function SummonsTemplate({ data, className = "" }: SummonsTemplateProps) {
  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('nl-NL', {
      style: 'currency',
      currency: 'EUR'
    }).format(amount);
  };

  return (
    <div className={`summons-document ${className}`} data-testid="summons-template">
      <style>{`
        @media print {
          @page {
            size: A4;
            margin: 2.5cm;
          }
          .summons-document {
            font-size: 11pt;
          }
          .no-print {
            display: none;
          }
        }

        .summons-document {
          font-family: 'Times New Roman', Times, serif;
          line-height: 1.5;
          color: #000;
          max-width: 21cm;
          margin: 0 auto;
          padding: 2cm;
          background: white;
        }

        .summons-header {
          text-align: center;
          margin-bottom: 40px;
          page-break-after: avoid;
        }

        .summons-title {
          font-size: 18pt;
          font-weight: bold;
          margin-bottom: 20px;
          text-transform: uppercase;
        }

        .court-info {
          margin-bottom: 30px;
        }

        .court-name {
          font-weight: bold;
          font-size: 14pt;
          margin-bottom: 10px;
        }

        .parties-section {
          margin-bottom: 30px;
          page-break-inside: avoid;
        }

        .party-block {
          margin-bottom: 20px;
        }

        .party-label {
          font-weight: bold;
          text-decoration: underline;
          margin-bottom: 10px;
        }

        .party-details {
          margin-left: 20px;
        }

        .section-heading {
          font-weight: bold;
          margin-top: 30px;
          margin-bottom: 15px;
          font-size: 13pt;
          page-break-after: avoid;
        }

        .subsection-heading {
          font-weight: bold;
          margin-top: 20px;
          margin-bottom: 10px;
          font-size: 11pt;
        }

        .paragraph {
          margin-bottom: 15px;
          text-align: justify;
          text-indent: 0;
        }

        .claim-items {
          margin: 20px 0;
        }

        .claim-item {
          display: flex;
          justify-content: space-between;
          padding: 5px 0;
          border-bottom: 1px solid #ddd;
        }

        .claim-total {
          display: flex;
          justify-content: space-between;
          padding: 10px 0;
          font-weight: bold;
          border-top: 2px solid #000;
          margin-top: 10px;
        }

        .orders-list {
          margin: 20px 0;
          list-style-type: decimal;
          padding-left: 30px;
        }

        .orders-list li {
          margin-bottom: 10px;
        }

        .evidence-list {
          margin: 15px 0;
          list-style-type: none;
          padding-left: 20px;
        }

        .evidence-item {
          margin-bottom: 8px;
        }

        .witness-list {
          margin: 15px 0;
          padding-left: 20px;
        }

        .service-block {
          margin-top: 40px;
          padding: 20px;
          border: 1px solid #000;
          page-break-inside: avoid;
        }

        .signoff {
          margin-top: 50px;
          page-break-inside: avoid;
        }

        .signature-line {
          margin-top: 60px;
          border-top: 1px solid #000;
          width: 200px;
        }

        .template-version {
          font-size: 8pt;
          color: #666;
          text-align: right;
          margin-top: 20px;
        }
      `}</style>

      {/* Header */}
      <div className="summons-header">
        <div className="summons-title" data-testid="summons-title">Dagvaarding</div>
        <div className="court-info">
          <div className="court-name" data-testid="court-name">{data.court.name || 'Rechtbank'}</div>
          <div data-testid="court-address">{data.court.visit_address}</div>
          {data.court.postal_address && <div>{data.court.postal_address}</div>}
        </div>
      </div>

      {/* Hearing Information */}
      {data.court.hearing_date && (
        <div className="paragraph" data-testid="hearing-info">
          <strong>Datum en tijdstip zitting:</strong> {data.court.hearing_day} {data.court.hearing_date} om {data.court.hearing_time}
        </div>
      )}

      {/* Parties */}
      <div className="parties-section">
        <div className="party-block">
          <div className="party-label" data-testid="claimant-label">EISER:</div>
          <div className="party-details">
            <div data-testid="claimant-name">{data.parties.claimant.name}</div>
            <div>gevestigd te {data.parties.claimant.place}</div>
            {data.parties.claimant.rep_name && (
              <>
                <div>vertegenwoordigd door: {data.parties.claimant.rep_name}</div>
                <div>{data.parties.claimant.rep_address}</div>
              </>
            )}
            {data.parties.claimant.phone && <div>Tel: {data.parties.claimant.phone}</div>}
            {data.parties.claimant.email && <div>E-mail: {data.parties.claimant.email}</div>}
            {data.parties.claimant.dossier && <div>Dossiernummer: {data.parties.claimant.dossier}</div>}
          </div>
        </div>

        <div className="party-block">
          <div className="party-label" data-testid="defendant-label">TEGEN</div>
          <div className="party-details">
            <div data-testid="defendant-name">{data.parties.defendant.name}</div>
            <div>{data.parties.defendant.address}</div>
            {data.parties.defendant.birthdate && <div>geboren {data.parties.defendant.birthdate}</div>}
            <div>hierna te noemen: gedaagde</div>
          </div>
        </div>
      </div>

      {/* What does this summons mean */}
      <div className="section-heading">Wat betekent deze dagvaarding voor u?</div>
      <div className="paragraph">
        U bent gedagvaard. Dat betekent dat er een rechtszaak tegen u is aangespannen. 
        In deze dagvaarding staat wat eiser van u wil. Eiser vraagt aan de rechter om 
        een beslissing te nemen.
      </div>

      {/* Full Claim */}
      <div className="section-heading" data-testid="section-full-claim">Wat is de volledige eis?</div>
      <div className="paragraph">
        Eiser vordert bij vonnis, voor zover mogelijk uitvoerbaar bij voorraad:
      </div>
      
      {data.sections.full_claim_items && data.sections.full_claim_items.length > 0 && (
        <div className="claim-items">
          {data.sections.full_claim_items.map((item, idx) => (
            <div key={idx} className="claim-item" data-testid={`claim-item-${idx}`}>
              <span>{item.label}</span>
              <span>{formatCurrency(item.amount_eur)}</span>
            </div>
          ))}
          <div className="claim-total" data-testid="claim-total">
            <span>Totaal</span>
            <span>{formatCurrency(data.case.total_to_date_eur || 0)}</span>
          </div>
        </div>
      )}

      {/* Orders Requested */}
      {data.sections.orders_requested && data.sections.orders_requested.length > 0 && (
        <>
          <div className="paragraph">
            <strong>Eiser verzoekt de rechtbank:</strong>
          </div>
          <ol className="orders-list" data-testid="orders-list">
            {data.sections.orders_requested.map((order, idx) => (
              <li key={idx} data-testid={`order-${idx}`}>{order}</li>
            ))}
          </ol>
        </>
      )}

      {/* Grounds */}
      <div className="section-heading" data-testid="section-grounds">Waar is de eis op gebaseerd?</div>
      
      {/* Introduction */}
      {data.sections.grounds.intro && data.sections.grounds.intro.length > 0 && (
        <>
          <div className="subsection-heading">Inleiding</div>
          {data.sections.grounds.intro.map((para, idx) => (
            <div key={idx} className="paragraph" data-testid={`intro-para-${idx}`}>{para}</div>
          ))}
        </>
      )}

      {/* Assignment and Work */}
      {data.sections.grounds.assignment_and_work && data.sections.grounds.assignment_and_work.length > 0 && (
        <>
          <div className="subsection-heading">De opdracht en het werk</div>
          {data.sections.grounds.assignment_and_work.map((para, idx) => (
            <div key={idx} className="paragraph" data-testid={`work-para-${idx}`}>{para}</div>
          ))}
        </>
      )}

      {/* Terms and Conditions */}
      {data.sections.grounds.terms_and_conditions && data.sections.grounds.terms_and_conditions.length > 0 && (
        <>
          <div className="subsection-heading">Algemene voorwaarden</div>
          {data.sections.grounds.terms_and_conditions.map((para, idx) => (
            <div key={idx} className="paragraph" data-testid={`terms-para-${idx}`}>{para}</div>
          ))}
        </>
      )}

      {/* Invoice */}
      {data.sections.grounds.invoice && data.sections.grounds.invoice.length > 0 && (
        <>
          <div className="subsection-heading">De rekening</div>
          {data.sections.grounds.invoice.map((para, idx) => (
            <div key={idx} className="paragraph" data-testid={`invoice-para-${idx}`}>{para}</div>
          ))}
        </>
      )}

      {/* Interest and Collection Costs */}
      {data.sections.grounds.interest_and_collection_costs && data.sections.grounds.interest_and_collection_costs.length > 0 && (
        <>
          <div className="subsection-heading">Rente en incassokosten</div>
          {data.sections.grounds.interest_and_collection_costs.map((para, idx) => (
            <div key={idx} className="paragraph" data-testid={`interest-para-${idx}`}>{para}</div>
          ))}
        </>
      )}

      {/* Defendant Response */}
      {data.sections.grounds.defendant_response && data.sections.grounds.defendant_response.length > 0 && (
        <>
          <div className="subsection-heading">Reactie van gedaagde</div>
          {data.sections.grounds.defendant_response.map((para, idx) => (
            <div key={idx} className="paragraph" data-testid={`response-para-${idx}`}>{para}</div>
          ))}
        </>
      )}

      {/* Evidence */}
      {data.sections.grounds.evidence && (
        <>
          <div className="subsection-heading">Bewijsmiddelen</div>
          {data.sections.grounds.evidence.list && data.sections.grounds.evidence.list.length > 0 && (
            <ul className="evidence-list" data-testid="evidence-list">
              {data.sections.grounds.evidence.list.map((item, idx) => (
                <li key={idx} className="evidence-item" data-testid={`evidence-${idx}`}>{item}</li>
              ))}
            </ul>
          )}
          {data.sections.grounds.evidence.offer_of_proof && (
            <div className="paragraph" data-testid="proof-offer">{data.sections.grounds.evidence.offer_of_proof}</div>
          )}
          {data.sections.grounds.evidence.witnesses && data.sections.grounds.evidence.witnesses.length > 0 && (
            <>
              <div className="paragraph"><strong>Getuigen:</strong></div>
              <ul className="witness-list" data-testid="witness-list">
                {data.sections.grounds.evidence.witnesses.map((witness, idx) => (
                  <li key={idx} data-testid={`witness-${idx}`}>{witness}</li>
                ))}
              </ul>
            </>
          )}
        </>
      )}

      {/* Service Block (if served) */}
      {data.service_block && (
        <div className="service-block" data-testid="service-block">
          <div className="subsection-heading">Betekening</div>
          <div className="paragraph">
            Deurwaarder: {data.service_block.bailiff_name}, {data.service_block.bailiff_city}
          </div>
          <div className="paragraph">
            {data.service_block.bailiff_address}
          </div>
          <div className="paragraph">
            Betekend aan: {data.service_block.served_to === 'hemzelf' ? 'hemzelf/haarzelf' : 'per aangetekende envelop'}
          </div>
          
          {data.service_block.extra_costs && data.service_block.extra_costs.length > 0 && (
            <div>
              <strong>Extra kosten:</strong>
              {data.service_block.extra_costs.map((cost, idx) => (
                <div key={idx} className="claim-item">
                  <span>{cost.label}</span>
                  <span>{formatCurrency(cost.amount_eur)}</span>
                </div>
              ))}
            </div>
          )}
          <div className="claim-total">
            <span>Totale betekeniskosten</span>
            <span>{formatCurrency(data.service_block.total_service_costs_eur)}</span>
          </div>
        </div>
      )}

      {/* Signoff */}
      <div className="signoff">
        <div className="paragraph" data-testid="signoff">
          {data.signoff.place}, {data.signoff.date}
        </div>
        <div className="paragraph">
          {data.signoff.representative}
        </div>
        <div className="signature-line"></div>
      </div>

      {/* Template Version */}
      <div className="template-version" data-testid="template-version">
        Template versie: {data.meta.template_version}
      </div>
    </div>
  );
}

export default SummonsTemplate;
