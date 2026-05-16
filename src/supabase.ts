import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://rjwojxwrsbvwwshwwpvq.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJqd29qeHdyc2J2d3dzaHd3cHZxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDY1NTI1MDAsImV4cCI6MjA2MjEyODUwMH0.r3pJO1SjVJtpmTFmpFpQUWOmL4g9d7Ns1Y0qs_WpqrU';

export const STORAGE_URL = `${SUPABASE_URL}/storage/v1/object/public`;

export const db = createClient(SUPABASE_URL, SUPABASE_KEY);

// ─── TIPOS ────────────────────────────────────────────────────────────────────

export interface UserRow {
  id: string;
  email: string;
  name: string;
  role: 'worker' | 'client' | 'admin' | 'fincas' | 'asesoria';
  plan: 'gratis' | 'basico' | 'pro' | 'elite';
  trade: string;
  bio: string;
  phone: string;
  avatar_url: string;
  rating: number;
  review_count: number;
  verified: boolean;
  featured: boolean;
  price: number;
  available: boolean;
  schedule: string | string[];
  response_time: string;
  free_quote: boolean;
  experience_years: number;
  specialties: string[];
  service_zones: string[];
  location_lat?: number;
  location_lng?: number;
  location_address?: string;
  leads_used?: number;
  leads_reset_date?: string;
  created_at: string;
  banned?: boolean;
  // Campos B2B
  company_name?: string;
  cif?: string;
}

export interface PhotoRow {
  id: string;
  worker_id: string;
  url: string;
  caption?: string;
  created_at: string;
}

export interface ReviewRow {
  id: string;
  worker_id: string;
  client_id: string;
  client_name: string;
  rating: number;
  comment: string;
  reported: boolean;
  approved: boolean;
  created_at: string;
}

export interface MessageRow {
  id: string;
  sender_id: string;
  receiver_id: string;
  content: string;
  read: boolean;
  created_at: string;
}

export interface JobRow {
  id: string;
  worker_id: string;
  client_id: string;
  title: string;
  description: string;
  status: 'pending' | 'in_progress' | 'done' | 'cancelled';
  price: number;
  created_at: string;
}

export interface LeadRow {
  id: string;
  worker_id: string;
  client_id?: string;
  type: 'whatsapp' | 'call' | 'message' | 'visit';
  created_at: string;
}

export interface VisitRequestRow {
  id: string;
  worker_id: string;
  client_id: string;
  client_name: string;
  date_requested: string;
  time_slot: 'morning' | 'afternoon';
  description: string;
  photo_url?: string;
  status: 'pending' | 'accepted' | 'rejected' | 'proposed';
  proposed_date?: string;
  created_at: string;
}

// Tablas B2B nuevas
export interface FincaIncidentRow {
  id: string;
  finca_id: string;
  community_name: string;
  title: string;
  description?: string;
  trade_required?: string;
  status: 'pending' | 'assigned' | 'completed';
  assigned_worker_id?: string;
  created_at: string;
}

export interface AsesoriaCodeRow {
  id: string;
  asesoria_id: string;
  code: string;
  plan_to_grant: string;
  months_duration: number;
  uses_count: number;
  created_at: string;
}
