// Supabase Client Configuration
import { createClient, SupabaseClient } from '@supabase/supabase-js';

// Environment variables
const supabaseUrl = process.env.SUPABASE_URL || '';
const supabaseKey = process.env.SUPABASE_ANON_KEY || '';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

if (!supabaseUrl || !supabaseKey) {
  throw new Error(
    'Missing Supabase environment variables. Please check your .env file.\n' +
    'Required: SUPABASE_URL, SUPABASE_ANON_KEY'
  );
}

// Public client (for client-facing operations)
export const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: {
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: true
  }
});

// Admin client (for server-side operations that bypass RLS)
export const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  },
  db: {
    schema: 'public'
  },
  global: {
    headers: {
      'x-application-name': 'makati-report-server'
    }
  },
  // Performance optimizations
  realtime: {
    params: {
      eventsPerSecond: 10
    }
  }
});

// Helper function to get database client based on bypass RLS flag
export function getSupabaseClient(bypassRLS = false): SupabaseClient {
  return bypassRLS ? supabaseAdmin : supabase;
}

// Database helper functions (replacing mysql2 pool queries)
export async function query<T = any>(
  sql: string,
  params?: any[],
  bypassRLS = false
): Promise<T[]> {
  const client = getSupabaseClient(bypassRLS);
  
  try {
    // Supabase doesn't support raw SQL by default
    // You'll need to create functions or use the query builder
    // This is a placeholder - you'll refactor to use Supabase's query builder
    console.warn('Direct SQL queries not recommended with Supabase. Use query builder instead.');
    return [];
  } catch (error: any) {
    console.error('Supabase query error:', error.message);
    throw error;
  }
}

// Connection pool equivalent (Supabase handles this automatically)
export const pool = {
  query: async (sql: string, params?: any[]) => {
    return query(sql, params, true); // Use admin client for direct queries
  },
  // Supabase doesn't need explicit connection management
  getConnection: async () => {
    return {
      query: async (sql: string, params?: any[]) => query(sql, params, true),
      release: () => {}, // No-op for Supabase
      beginTransaction: async () => {},
      commit: async () => {},
      rollback: async () => {}
    };
  },
  end: async () => {
    // No-op - Supabase manages connections
  }
};

// Export types for TypeScript
export type { SupabaseClient };

// Health check function
export async function checkDatabaseHealth(): Promise<boolean> {
  try {
    const { data, error } = await supabase
      .from('departments')
      .select('department_id')
      .limit(1);
    
    return !error;
  } catch (error) {
    console.error('Database health check failed:', error);
    return false;
  }
}

export default supabase;
