// Using built-in fetch instead of node-fetch for better compatibility

export interface MindStudioConfig {
  agentId: string;
  apiKey: string;
  baseUrl: string;
}

export interface MindStudioResponse {
  success: boolean;
  data?: any;
  error?: string;
  confidence?: number;
}

export interface ReceiptExtractionResult {
  productName: string;
  category: string;
  purchasePrice: number;
  storeName: string;
  purchaseDate: string;
  confidence: number;
}

export class MindStudioService {
  private config: MindStudioConfig;

  constructor(config: MindStudioConfig) {
    this.config = config;
  }

  /**
   * Extract receipt data using MindStudio AI agent
   * Supports both image and text-based processing
   */
  async extractReceiptData(input: { 
    type: 'image' | 'text', 
    content: string,
    filename?: string 
  }): Promise<ReceiptExtractionResult> {
    try {
      console.log(`🔮 MindStudio: Processing ${input.type} receipt - ${input.filename || 'unknown'}`);

      const payload = {
        agentId: this.config.agentId,
        input: {
          type: input.type,
          content: input.content,
          filename: input.filename,
          task: 'extract_receipt_data',
          // Request specific fields needed for our warranty system
          extractionFields: [
            'productName',
            'category', 
            'purchasePrice',
            'storeName',
            'purchaseDate'
          ]
        }
      };

      const response = await globalThis.fetch(`${this.config.baseUrl}/run`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.config.apiKey}`,
          'User-Agent': 'Rechtstreeks.ai/1.0'
        },
        body: JSON.stringify(payload)
      });

      if (!response.ok) {
        throw new Error(`MindStudio API error: ${response.status} ${response.statusText}`);
      }

      const result: MindStudioResponse = await response.json();

      if (!result.success) {
        throw new Error(`MindStudio processing failed: ${result.error || 'Unknown error'}`);
      }

      // Extract and validate the receipt data from MindStudio response
      const extractedData = this.validateAndNormalizeData(result.data);
      
      console.log(`✅ MindStudio: Extracted data with ${extractedData.confidence}% confidence`);
      
      return extractedData;

    } catch (error) {
      console.error('❌ MindStudio: Receipt extraction failed:', error);
      throw error;
    }
  }

  /**
   * Validate and normalize data from MindStudio response
   * Ensures consistent format for our warranty system
   */
  private validateAndNormalizeData(data: any): ReceiptExtractionResult {
    // Default fallback values
    const fallback: ReceiptExtractionResult = {
      productName: '',
      category: 'Anders',
      purchasePrice: 0,
      storeName: '',
      purchaseDate: '',
      confidence: 0
    };

    if (!data) {
      return fallback;
    }

    // Extract confidence score
    const confidence = typeof data.confidence === 'number' 
      ? Math.round(data.confidence * 100) 
      : 0;

    // Normalize and validate each field
    const result: ReceiptExtractionResult = {
      productName: this.normalizeString(data.productName || data.product_name || ''),
      category: this.normalizeCategory(data.category || ''),
      purchasePrice: this.normalizePrice(data.purchasePrice || data.purchase_price || data.price || 0),
      storeName: this.normalizeString(data.storeName || data.store_name || data.store || ''),
      purchaseDate: this.normalizeDate(data.purchaseDate || data.purchase_date || data.date || ''),
      confidence
    };

    // Validate minimum required fields
    if (!result.productName && !result.storeName) {
      result.confidence = 0;
    }

    return result;
  }

  /**
   * Normalize string values (trim, basic cleanup)
   */
  private normalizeString(value: any): string {
    if (typeof value !== 'string') return '';
    return value.trim().slice(0, 255); // Prevent extremely long strings
  }

  /**
   * Normalize category to one of our predefined categories
   */
  private normalizeCategory(category: any): string {
    if (typeof category !== 'string') return 'Anders';
    
    const normalized = category.toLowerCase().trim();
    const categoryMap: Record<string, string> = {
      'elektronisch': 'Elektronica',
      'elektronica': 'Elektronica',
      'electronics': 'Elektronica',
      'computer': 'Elektronica',
      'telefoon': 'Elektronica',
      'laptop': 'Elektronica',
      'tv': 'Elektronica',
      'huishouden': 'Huishoudelijk',
      'huishoudelijk': 'Huishoudelijk',
      'household': 'Huishoudelijk',
      'keuken': 'Huishoudelijk',
      'kitchen': 'Huishoudelijk',
      'kleding': 'Kleding',
      'clothing': 'Kleding',
      'fashion': 'Kleding',
      'boek': 'Boeken',
      'boeken': 'Boeken',
      'book': 'Boeken',
      'books': 'Boeken',
      'speelgoed': 'Speelgoed',
      'toy': 'Speelgoed',
      'toys': 'Speelgoed',
      'sport': 'Sport',
      'sports': 'Sport',
      'fitness': 'Sport'
    };

    return categoryMap[normalized] || 'Anders';
  }

  /**
   * Normalize price to a valid number
   */
  private normalizePrice(value: any): number {
    if (typeof value === 'number') return Math.max(0, Math.round(value * 100) / 100);
    if (typeof value === 'string') {
      // Remove currency symbols and parse
      const cleaned = value.replace(/[€$£¥₹,]/g, '').replace(',', '.').trim();
      const parsed = parseFloat(cleaned);
      return isNaN(parsed) ? 0 : Math.max(0, Math.round(parsed * 100) / 100);
    }
    return 0;
  }

  /**
   * Normalize date to ISO format or empty string
   */
  private normalizeDate(value: any): string {
    if (!value) return '';
    
    try {
      // Try to parse various date formats
      const date = new Date(value);
      if (isNaN(date.getTime())) return '';
      
      // Return ISO date string (YYYY-MM-DD)
      return date.toISOString().split('T')[0];
    } catch {
      return '';
    }
  }

  /**
   * Health check for MindStudio service
   */
  async healthCheck(): Promise<boolean> {
    try {
      const response = await globalThis.fetch(`${this.config.baseUrl}/health`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${this.config.apiKey}`
        }
      });
      
      return response.ok;
    } catch {
      return false;
    }
  }
}

// Factory function to create MindStudio service with environment config
export function createMindStudioService(): MindStudioService | null {
  const agentId = process.env.MINDSTUDIO_AGENT_ID;
  const apiKey = process.env.MINDSTUDIO_API_KEY;
  const baseUrl = process.env.MINDSTUDIO_BASE_URL || 'https://api.mindstudio.ai';

  if (!agentId || !apiKey) {
    console.warn('⚠️ MindStudio: Missing configuration (MINDSTUDIO_AGENT_ID or MINDSTUDIO_API_KEY)');
    return null;
  }

  return new MindStudioService({
    agentId,
    apiKey,
    baseUrl
  });
}