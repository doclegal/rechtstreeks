import { Pool, neonConfig } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-serverless';
import ws from "ws";
import * as schema from "@shared/schema";

neonConfig.webSocketConstructor = ws;

if (!process.env.DATABASE_URL) {
  throw new Error(
    "DATABASE_URL must be set. Did you forget to provision a database?",
  );
}

// Configure connection pool optimized for Neon serverless
export const pool = new Pool({ 
  connectionString: process.env.DATABASE_URL,
  max: 3, // Small pool size for serverless (recommended for Neon)
  idleTimeoutMillis: 10000, // Close idle connections after 10 seconds
  connectionTimeoutMillis: 2000, // Timeout for new connections
});

// Add error handling for pool events
pool.on('error', (err, client) => {
  console.error('Unexpected error on idle database client', err);
});

pool.on('connect', () => {
  console.log('Database pool connected');
});

export const db = drizzle({ client: pool, schema });

// Database error handler utility
export function handleDatabaseError(error: any) {
  console.error('Database error:', error);
  
  // Handle specific database connection errors
  if (error.code === '57P01' || // Connection terminated by administrator
      error.code === 'ECONNRESET' || 
      error.code === 'ETIMEDOUT' ||
      error.message?.includes('terminating connection') ||
      error.message?.includes('connection') && error.message?.includes('timeout')) {
    return {
      status: 503,
      message: "Database temporarily unavailable. Please try again in a moment."
    };
  }
  
  // Handle other database errors
  if (error.code?.startsWith('23')) { // Constraint violations (23xxx)
    return {
      status: 400,
      message: "Data validation error"
    };
  }
  
  // Generic database error
  return {
    status: 500,
    message: "Database error occurred"
  };
}