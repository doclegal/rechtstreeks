import mammoth from 'mammoth';

/**
 * Template Parser Service
 * Automatically detects and extracts [user] and {ai} fields from template text
 */

export interface ParsedField {
  key: string;
  type: 'user' | 'ai';
  occurrences: number;
  positions: number[]; // Character positions where field appears
}

export interface ParsedTemplate {
  rawText: string;
  userFields: ParsedField[];
  aiFields: ParsedField[];
  fieldOccurrences: Record<string, number>;
  totalUserFields: number;
  totalAiFields: number;
}

/**
 * Parse template text and extract all [user] and {ai} fields
 */
export function parseTemplateText(text: string): ParsedTemplate {
  const userFieldsMap = new Map<string, ParsedField>();
  const aiFieldsMap = new Map<string, ParsedField>();
  
  // Regex to find [field_key] patterns
  const userFieldRegex = /\[([^\]]+)\]/g;
  // Regex to find {field_key} patterns
  const aiFieldRegex = /\{([^}]+)\}/g;
  
  // Extract user fields
  let userMatch;
  while ((userMatch = userFieldRegex.exec(text)) !== null) {
    const key = userMatch[1].trim();
    const position = userMatch.index;
    
    if (userFieldsMap.has(key)) {
      const field = userFieldsMap.get(key)!;
      field.occurrences++;
      field.positions.push(position);
    } else {
      userFieldsMap.set(key, {
        key,
        type: 'user',
        occurrences: 1,
        positions: [position],
      });
    }
  }
  
  // Extract AI fields
  let aiMatch;
  while ((aiMatch = aiFieldRegex.exec(text)) !== null) {
    const key = aiMatch[1].trim();
    const position = aiMatch.index;
    
    if (aiFieldsMap.has(key)) {
      const field = aiFieldsMap.get(key)!;
      field.occurrences++;
      field.positions.push(position);
    } else {
      aiFieldsMap.set(key, {
        key,
        type: 'ai',
        occurrences: 1,
        positions: [position],
      });
    }
  }
  
  const userFields = Array.from(userFieldsMap.values());
  const aiFields = Array.from(aiFieldsMap.values());
  
  // Create occurrence map for all fields
  const fieldOccurrences: Record<string, number> = {};
  userFields.forEach(field => {
    fieldOccurrences[`[${field.key}]`] = field.occurrences;
  });
  aiFields.forEach(field => {
    fieldOccurrences[`{${field.key}}`] = field.occurrences;
  });
  
  return {
    rawText: text,
    userFields,
    aiFields,
    fieldOccurrences,
    totalUserFields: userFields.length,
    totalAiFields: aiFields.length,
  };
}

/**
 * Extract text from PDF buffer
 */
export async function extractTextFromPdf(buffer: Buffer): Promise<string> {
  try {
    // Dynamic import to avoid pdf-parse test file loading issue
    const pdfParse = (await import('pdf-parse')).default;
    const data = await pdfParse(buffer);
    return data.text;
  } catch (error) {
    throw new Error(`Failed to extract text from PDF: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Extract text from DOCX buffer
 */
export async function extractTextFromDocx(buffer: Buffer): Promise<string> {
  try {
    const result = await mammoth.extractRawText({ buffer });
    return result.value;
  } catch (error) {
    throw new Error(`Failed to extract text from DOCX: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Extract text from file buffer based on mimetype
 */
export async function extractTextFromFile(buffer: Buffer, mimetype: string): Promise<string> {
  if (mimetype === 'application/pdf') {
    return await extractTextFromPdf(buffer);
  } else if (mimetype === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') {
    return await extractTextFromDocx(buffer);
  } else if (mimetype === 'text/plain') {
    return buffer.toString('utf-8');
  } else {
    throw new Error(`Unsupported file type: ${mimetype}. Supported types: PDF, DOCX, TXT`);
  }
}

/**
 * Validate parsed template
 */
export function validateParsedTemplate(parsed: ParsedTemplate): { valid: boolean; errors: string[] } {
  const errors: string[] = [];
  
  // Check for empty field keys
  const emptyUserFields = parsed.userFields.filter(f => f.key === '');
  const emptyAiFields = parsed.aiFields.filter(f => f.key === '');
  
  if (emptyUserFields.length > 0) {
    errors.push(`Found ${emptyUserFields.length} empty user field(s): []`);
  }
  if (emptyAiFields.length > 0) {
    errors.push(`Found ${emptyAiFields.length} empty AI field(s): {}`);
  }
  
  // Check for duplicate keys between user and AI fields
  const userKeys = new Set(parsed.userFields.map(f => f.key));
  const aiKeys = new Set(parsed.aiFields.map(f => f.key));
  const duplicates = Array.from(userKeys).filter(key => aiKeys.has(key));
  
  if (duplicates.length > 0) {
    errors.push(`Found duplicate field keys in both [user] and {ai}: ${duplicates.join(', ')}`);
  }
  
  // Warn if no fields found
  if (parsed.totalUserFields === 0 && parsed.totalAiFields === 0) {
    errors.push('No fields found in template. Expected [user] or {ai} field markers.');
  }
  
  return {
    valid: errors.length === 0,
    errors,
  };
}
