// Extract en analyse MindStudio analysis_json uit database
const fs = require('fs');

// Simuleer de raw_text data uit de database (afgeknipt, dus we moeten via API)
async function extractAnalysisFromCase() {
  try {
    // Haal de case data op
    const caseResponse = await fetch('http://localhost:5000/api/cases/0f5fa167-7f3f-485d-a1e6-a4cfc98bbaef');
    const caseData = await caseResponse.json();
    
    console.log("📊 Case data analysis status:", caseData.fullAnalysisStatus);
    
    if (caseData.fullAnalysisResult) {
      const analysisResult = JSON.parse(caseData.fullAnalysisResult);
      
      if (analysisResult.parsedAnalysis) {
        const parsed = analysisResult.parsedAnalysis;
        console.log("\n📈 GEVONDEN ANALYSIS STRUCTURE:");
        console.log("====================================");
        
        console.log("\n🏛️ CASE OVERVIEW:");
        console.log(JSON.stringify(parsed.case_overview, null, 2));
        
        console.log("\n⚖️ LEGAL ANALYSIS:");
        console.log(JSON.stringify(parsed.legal_analysis, null, 2));
        
        console.log("\n📝 FACTS:");
        console.log(JSON.stringify(parsed.facts, null, 2));
        
        console.log("\n🔍 EVIDENCE:");
        console.log(JSON.stringify(parsed.evidence, null, 2));
        
        console.log("\n❓ QUESTIONS TO ANSWER:");
        console.log(JSON.stringify(parsed.questions_to_answer, null, 2));
        
        console.log("\n📄 PER DOCUMENT:");
        console.log(JSON.stringify(parsed.per_document, null, 2));
        
        console.log("\n⚠️ MISSING INFO:");
        console.log(JSON.stringify(parsed.missing_info_for_assessment, null, 2));
        
        // Check specifiek waarom rechtsgronden leeg zijn
        console.log("\n🔍 DETAIL CHECK - Waarom zijn sommige secties leeg?");
        console.log("====================================================");
        
        if (parsed.legal_analysis?.legal_issues?.length === 0) {
          console.log("❌ legal_issues is LEEG array");
        } else {
          console.log(`✅ legal_issues heeft ${parsed.legal_analysis?.legal_issues?.length} items`);
        }
        
        if (parsed.legal_analysis?.potential_defenses?.length === 0) {
          console.log("❌ potential_defenses is LEEG array");
        } else {
          console.log(`✅ potential_defenses heeft ${parsed.legal_analysis?.potential_defenses?.length} items`);
        }
        
        if (parsed.legal_analysis?.risks?.length === 0) {
          console.log("❌ risks is LEEG array");
        } else {
          console.log(`✅ risks heeft ${parsed.legal_analysis?.risks?.length} items`);
        }
        
        if (parsed.legal_analysis?.next_actions?.length === 0) {
          console.log("❌ next_actions is LEEG array");
        } else {
          console.log(`✅ next_actions heeft ${parsed.legal_analysis?.next_actions?.length} items`);
        }
      }
    }
    
  } catch (error) {
    console.error("❌ Error:", error);
  }
}

extractAnalysisFromCase();