export class MockIntegrations {
  async orderBailiffService(caseId: string): Promise<{
    orderId: string;
    status: string;
    estimatedServiceDate: string;
    bailiffName: string;
    cost: number;
  }> {
    // Simulate processing delay
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    const orderData = {
      orderId: `BAILIFF_${Date.now()}`,
      status: "ordered",
      estimatedServiceDate: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000).toISOString(), // 5 days from now
      bailiffName: "Deurwaardersbureau Van der Berg",
      cost: 275.50
    };
    
    // Simulate callback after 3 seconds
    setTimeout(async () => {
      try {
        await fetch(`${process.env.BASE_URL || 'http://localhost:5000'}/api/integrations/bailiff/callback`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            caseId,
            status: 'served',
            orderId: orderData.orderId,
            servedAt: new Date().toISOString(),
          }),
        });
      } catch (error) {
        console.error("Error sending bailiff callback:", error);
      }
    }, 3000);
    
    return orderData;
  }

  async fileWithCourt(caseId: string): Promise<{
    filingId: string;
    courtName: string;
    filedAt: string;
    caseNumber: string;
    status: string;
  }> {
    // Simulate processing delay
    await new Promise(resolve => setTimeout(resolve, 1500));
    
    return {
      filingId: `COURT_${Date.now()}`,
      courtName: "Kantongerecht Amsterdam",
      filedAt: new Date().toISOString(),
      caseNumber: `C/13/${new Date().getFullYear()}/${Math.floor(Math.random() * 10000)}`,
      status: "filed"
    };
  }

  async checkDeadlines(caseId: string): Promise<{
    hasWarnings: boolean;
    warnings: Array<{
      type: string;
      message: string;
      daysRemaining: number;
    }>;
  }> {
    // Mock deadline checking logic
    const warnings = [];
    
    // Example: Check if summons needs to be filed within deadline
    const randomDaysLeft = Math.floor(Math.random() * 10) + 1;
    if (randomDaysLeft <= 5) {
      warnings.push({
        type: "filing_deadline",
        message: "Let op termijn! Dagvaarding aanbrengen binnen 5 dagen",
        daysRemaining: randomDaysLeft
      });
    }
    
    return {
      hasWarnings: warnings.length > 0,
      warnings
    };
  }
}

export const mockIntegrations = new MockIntegrations();
