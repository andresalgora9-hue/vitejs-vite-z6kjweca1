import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = "https://rjwojxwrsbvwwshwwpvq.supabase.co"
const SUPABASE_ANON = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJqd29qeHdyc2J2d3dzaHd3cHZxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzg0MTcxMzgsImV4cCI6MjA5Mzk5MzEzOH0.tO2eE-d7diaqV5nS0NUIAJnyn69xnpHYSJZa4DGQWfE"

export const db = createClient(SUPABASE_URL, SUPABASE_ANON)

export type UserRow = {
  id: string; name: string; email: string; phone: string;
  type: 'cliente'|'profesional'|'admin'; plan: 'gratis'|'basico'|'pro'|'elite';
  trade?: string; zone?: string; bio?: string; price?: number;
  available: boolean; verified: boolean; jobs: number;
  rating: number; reviews: number; trial_end: string; joined_at: string;
}
export type ReviewRow = { id:string; worker_id:string; client_name:string; stars:number; text:string; photo:string; created_at:string; }
export type MessageRow = { id:string; from_id:string; to_id:string; text:string; read:boolean; created_at:string; }
export type CertRow = { id:string; worker_id:string; name:string; url:string; verified:boolean; created_at:string; }
export type VisitRow = { id:string; page:string; user_id?:string; created_at:string; }
