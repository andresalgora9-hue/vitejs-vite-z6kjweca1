import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = "https://rjwojxwrsbvwwshwwpvq.supabase.co";
const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJqd29qeHdyc2J2d3dzaHd3cHZxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDY0NjMzMTMsImV4cCI6MjA2MjAzOTMxM30.wBjFJPAFSmzPaHMmTJKv6w2eCB7YR0FI3MBT2JX1234";

export const db = createClient(SUPABASE_URL, SUPABASE_KEY);
export const STORAGE_URL = `${SUPABASE_URL}/storage/v1/object/public/photos/`;

export type Plan = "gratis" | "basico" | "pro" | "elite";

export interface UserRow {
  id: string;
  name: string;
  email: string;
  password: string;
  phone?: string;
  type: "cliente" | "profesional" | "admin";
  plan: Plan;
  bio?: string;
  price?: number;
  category?: string;
  trade?: string;
  zone?: string;
  rating: number;
  reviews: number;
  jobs: number;
  verified?: boolean;
  available?: boolean;
  whatsapp?: string;
  service_zones?: string[];
  schedule?: string;
  response_time?: string;
  free_quote?: boolean;
  experience_years?: number;
  specialties?: string[];
  photos?: string[];
  profile_views?: number;
  leads_count?: number;
  trial_end: string;
  joined_at: string;
}

export interface MessageRow {
  id: string;
  from_id: string;
  to_id: string;
  text: string;
  read: boolean;
  created_at: string;
}

export interface JobRow {
  id: string;
  worker_id: string;
  client_id: string;
  client_name: string;
  title: string;
  description?: string;
  status: "pending" | "in_progress" | "done" | "cancelled";
  created_at: string;
  updated_at?: string;
}

export interface ReviewRow {
  id: string;
  worker_id: string;
  client_id?: string;
  client_name: string;
  stars: number;
  text: string;
  photo_url?: string;
  approved?: boolean;
  reported?: boolean;
  created_at: string;
}

export interface CertRow {
  id: string;
  worker_id: string;
  name: string;
  url?: string;
  verified?: boolean;
  created_at: string;
}

export interface PhotoRow {
  id: string;
  worker_id: string;
  url: string;
  caption?: string;
  created_at: string;
}
