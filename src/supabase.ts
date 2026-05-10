import { createClient } from '@supabase/supabase-js'

export const db = createClient(
  "https://rjwojxwrsbvwwshwwpvq.supabase.co",
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJqd29qeHdyc2J2d3dzaHd3cHZxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzg0MTcxMzgsImV4cCI6MjA5Mzk5MzEzOH0.tO2eE-d7diaqV5nS0NUIAJnyn69xnpHYSJZa4DGQWfE"
)

export const STORAGE_URL = "https://rjwojxwrsbvwwshwwpvq.supabase.co/storage/v1/object/public/photos/"

export type Plan = "gratis"|"basico"|"pro"|"elite"
export type UserType = "cliente"|"profesional"|"admin"

export interface UserRow {
  id: string; name: string; email: string; phone: string;
  type: UserType; plan: Plan; trade?: string; zone?: string;
  bio?: string; price?: number; available: boolean; verified: boolean;
  jobs: number; rating: number; reviews: number;
  trial_end: string; joined_at: string;
  service_zones?: string[]; schedule?: string; response_time?: string;
  free_quote?: boolean; experience_years?: number;
  specialties?: string[]; whatsapp?: string; photos?: string[];
}
export interface ReviewRow { id:string; worker_id:string; client_name:string; client_id?:string; stars:number; text:string; photo:string; photo_url?:string; approved?:boolean; reported?:boolean; created_at:string; }
export interface MessageRow { id:string; from_id:string; to_id:string; text:string; read:boolean; created_at:string; }
export interface JobRow { id:string; worker_id:string; client_id:string; client_name:string; title:string; description:string; status:"pending"|"in_progress"|"done"|"cancelled"; price:number; created_at:string; updated_at:string; }
export interface CertRow { id:string; worker_id:string; name:string; url:string; verified:boolean; created_at:string; }
export interface PhotoRow { id:string; worker_id:string; url:string; caption:string; created_at:string; }
