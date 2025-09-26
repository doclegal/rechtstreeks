// Script om de gestructureerde analyse data uit de database te halen en weer te geven
const fs = require('fs');

// Lees de raw_text uit de database
const rawText = `{
  "success": true,
  "threadId": "d1d27ad2-b534-4b02-a5df-06ebac7debd4",
  // ... rest van de data uit de database query
}`;

try {
  const data = JSON.parse(rawText);
  
  // Zoek naar analysis_json in thread posts
  if (data.thread && data.thread.posts) {
    for (const post of data.thread.posts) {
      // Kijk in debugLog.newState.variables voor analysis_json
      if (post.debugLog?.newState?.variables?.analysis_json) {
        console.log("🔍 Found analysis_json in debugLog.newState.variables");
        const analysisJson = post.debugLog.newState.variables.analysis_json.value;
        
        let parsedAnalysis;
        if (typeof analysisJson === 'string') {
          parsedAnalysis = JSON.parse(analysisJson);
        } else {
          parsedAnalysis = analysisJson;
        }
        
        console.log("📊 Gestructureerde MindStudio Analyse:");
        console.log(JSON.stringify(parsedAnalysis, null, 2));
        
        // Toon specifiek welke velden gevuld zijn
        console.log("\n📋 Overzicht van gevulde/lege velden:");
        
        Object.keys(parsedAnalysis).forEach(key => {
          const value = parsedAnalysis[key];
          if (Array.isArray(value)) {
            console.log(`${key}: Array met ${value.length} items`);
            if (value.length > 0) {
              console.log(`  └── Eerste item: ${JSON.stringify(value[0])}`);
            }
          } else if (typeof value === 'object' && value !== null) {
            const subKeys = Object.keys(value);
            console.log(`${key}: Object met keys: ${subKeys.join(', ')}`);
            subKeys.forEach(subKey => {
              const subValue = value[subKey];
              if (Array.isArray(subValue)) {
                console.log(`  └── ${subKey}: Array met ${subValue.length} items`);
              } else {
                console.log(`  └── ${subKey}: ${typeof subValue} - ${subValue === null ? 'null' : 'heeft waarde'}`);
              }
            });
          } else {
            console.log(`${key}: ${typeof value} - ${value === null ? 'null' : 'heeft waarde'}`);
          }
        });
        
        break;
      }
    }
  }
} catch (error) {
  console.error("Error parsing:", error);
}