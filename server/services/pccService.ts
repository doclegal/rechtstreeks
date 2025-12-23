import { db } from "../db";
import { users, cases as casesTable, caseDocuments as caseDocumentsTable, analyses as analysesTable } from "@shared/schema";
import { count, countDistinct, gte, or } from "drizzle-orm";
import { supabase } from "../supabaseClient";

const PROJECT_SLUG = "rechtstreeks";

interface StatusPayload {
  status: "operational" | "degraded" | "down" | "error";
  uptime: number;
  last_check: string;
  message?: string;
}

interface MetricsPayload {
  requests_today?: number;
  avg_response_ms: number;
  error_rate: number;
  requests_per_hour?: number;
}

interface ComputedScores {
  uptime: number;
  performance: number;
  errors: number;
  security: number;
}

interface SnapshotPayload {
  status_payload: StatusPayload;
  metrics_payload: MetricsPayload;
  computed_scores: ComputedScores;
}

class PCCService {
  private pccApiUrl: string | null = null;
  private pccFeedToken: string | null = null;
  private lastPushTime: Date | null = null;
  private errorCount: number = 0;
  private requestCount: number = 0;
  private totalResponseTime: number = 0;

  constructor() {
    this.pccApiUrl = process.env.PCC_API_URL || null;
    this.pccFeedToken = process.env.PCC_FEED_TOKEN || null;
  }

  private isConfigured(): boolean {
    return !!(this.pccApiUrl && this.pccFeedToken);
  }

  private async makeRequest(endpoint: string, payload: any): Promise<boolean> {
    if (!this.isConfigured()) {
      console.log("PCC Service: Not configured (missing PCC_API_URL or PCC_FEED_TOKEN)");
      return false;
    }

    const startTime = Date.now();
    let isError = false;

    try {
      const response = await fetch(`${this.pccApiUrl}${endpoint}`, {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${this.pccFeedToken}`,
          "Content-Type": "application/json",
          "X-Requested-With": "XMLHttpRequest",
          "Origin": this.pccApiUrl!
        },
        body: JSON.stringify(payload)
      });

      const responseTime = Date.now() - startTime;

      if (!response.ok) {
        const responseBody = await response.text().catch(() => "");
        console.error(`PCC Service: Request failed with status ${response.status}`, responseBody);
        isError = true;
        this.trackRequest(responseTime, true);
        return false;
      }

      this.trackRequest(responseTime, false);
      this.lastPushTime = new Date();
      console.log(`PCC Service: Successfully pushed to ${endpoint} (${responseTime}ms)`);
      return true;
    } catch (error: any) {
      const responseTime = Date.now() - startTime;
      this.trackRequest(responseTime, true);
      console.error("PCC Service: Request error:", error.message);
      return false;
    }
  }

  async getStatusPayload(): Promise<StatusPayload> {
    let status: "operational" | "degraded" | "down" | "error" = "operational";
    let uptime = 100.0;

    try {
      await db.select({ value: count() }).from(users).limit(1);
    } catch {
      status = "degraded";
      uptime = 95.0;
    }

    try {
      const { error } = await supabase.from("cases").select("id").limit(1);
      if (error) {
        status = status === "degraded" ? "down" : "degraded";
        uptime = status === "down" ? 0 : 90.0;
      }
    } catch {
      status = status === "degraded" ? "down" : "degraded";
      uptime = status === "down" ? 0 : 90.0;
    }

    return {
      status,
      uptime,
      last_check: new Date().toISOString(),
      message: status === "operational" ? "All systems running" : `Status: ${status}`
    };
  }

  async getMetricsPayload(): Promise<MetricsPayload> {
    const avgResponseMs = this.requestCount > 0 
      ? Math.round(this.totalResponseTime / this.requestCount)
      : 0;
    
    const errorRate = this.requestCount > 0
      ? Math.round((this.errorCount / this.requestCount) * 100) / 100
      : 0;

    return {
      avg_response_ms: avgResponseMs,
      error_rate: errorRate,
      requests_per_hour: this.requestCount
    };
  }

  async getComputedScores(): Promise<ComputedScores> {
    const status = await this.getStatusPayload();
    
    const uptimeScore = Math.round(status.uptime);
    const performanceScore = 85;
    const errorsScore = this.errorCount === 0 ? 100 : Math.max(0, 100 - (this.errorCount * 5));
    const securityScore = 90;

    return {
      uptime: uptimeScore,
      performance: performanceScore,
      errors: errorsScore,
      security: securityScore
    };
  }

  async pushSnapshot(): Promise<boolean> {
    const statusPayload = await this.getStatusPayload();
    const metricsPayload = await this.getMetricsPayload();
    const computedScores = await this.getComputedScores();

    const payload: SnapshotPayload = {
      status_payload: statusPayload,
      metrics_payload: metricsPayload,
      computed_scores: computedScores
    };

    return this.makeRequest(`/api/feed/${PROJECT_SLUG}/snapshot`, payload);
  }

  async pushStatus(message?: string): Promise<boolean> {
    const statusPayload = await this.getStatusPayload();
    if (message) {
      statusPayload.message = message;
    }
    return this.makeRequest(`/api/feed/${PROJECT_SLUG}/status`, statusPayload);
  }

  async pushMetrics(): Promise<boolean> {
    const metricsPayload = await this.getMetricsPayload();
    const computedScores = await this.getComputedScores();
    
    return this.makeRequest(`/api/feed/${PROJECT_SLUG}/metrics`, {
      ...metricsPayload,
      computed_scores: {
        uptime: computedScores.uptime,
        performance: computedScores.performance
      }
    });
  }

  async healthCheck(): Promise<boolean> {
    if (!this.isConfigured()) {
      return false;
    }

    try {
      const response = await fetch(`${this.pccApiUrl}/api/feed/health`, {
        method: "GET",
        headers: {
          "Authorization": `Bearer ${this.pccFeedToken}`
        }
      });
      return response.ok;
    } catch {
      return false;
    }
  }

  trackRequest(responseTimeMs: number, isError: boolean = false): void {
    this.requestCount++;
    this.totalResponseTime += responseTimeMs;
    if (isError) {
      this.errorCount++;
    }
  }

  resetHourlyMetrics(): void {
    this.requestCount = 0;
    this.totalResponseTime = 0;
    this.errorCount = 0;
  }
}

export const pccService = new PCCService();

let heartbeatInterval: NodeJS.Timeout | null = null;

export function startPCCHeartbeat(intervalMinutes: number = 60): void {
  if (heartbeatInterval) {
    clearInterval(heartbeatInterval);
  }

  setTimeout(async () => {
    console.log("PCC Service: Sending initial startup snapshot...");
    await pccService.pushSnapshot();
  }, 5000);

  heartbeatInterval = setInterval(async () => {
    console.log("PCC Service: Sending heartbeat snapshot...");
    await pccService.pushSnapshot();
    pccService.resetHourlyMetrics();
  }, intervalMinutes * 60 * 1000);

  console.log(`PCC Service: Heartbeat started (every ${intervalMinutes} minutes)`);
}

export function stopPCCHeartbeat(): void {
  if (heartbeatInterval) {
    clearInterval(heartbeatInterval);
    heartbeatInterval = null;
    console.log("PCC Service: Heartbeat stopped");
  }
}
