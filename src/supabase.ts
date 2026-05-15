import { createClient } from '@supabase/supabase-js';

// Reemplaza con tus credenciales reales de Supabase
const SUPABASE_URL = "https://tu-proyecto.supabase.co";
const SUPABASE_KEY = "tu-clave-anon-publica";

export const db = createClient(SUPABASE_URL, SUPABASE_KEY);
export const STORAGE_URL = `${SUPABASE_URL}/storage/v1/object/public/photos/`;

export type Plan = "gratis" | "basico" | "pro" | "elite";

export interface UserRow {
  id: string;
  email: string;
  name: string;
  type: "cliente" | "profesional" | "admin";
  plan: Plan;
  joined_at: string;
  phone: string;
  whatsapp?: string;
  trade?: string;
  zone?: string;
  rating: number;
  available: boolean;
  bio?: string;
  price?: number;
  service_zones?: string[];
  specialties?: string[];
  experience_years?: number;
  free_quote?: boolean;
  schedule?: string;
  response_time?: string;
  trial_end?: string;
}

export interface LeadLogRow {
  id: string;
  pro_id: string;
  visitor_id?: string;
  visitor_zone?: string;
  type: 'whatsapp' | 'call' | 'message';
  blocked: boolean;
  month: string; 
  created_at: string;
}

export interface MessageRow {
  id: string;
  from_id: string;
  to_id: string;
  text: string;
  created_at: string;
}

export interface JobRow { id: string; worker_id: string; title: string; description: string; status: "active" | "completed"; created_at: string; }
export interface CertRow { id: string; worker_id: string; name: string; url: string; }
export interface PhotoRow { id: string; worker_id: string; url: string; caption?: string; created_at: string; }
