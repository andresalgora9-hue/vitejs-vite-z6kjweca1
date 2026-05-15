export interface LeadLogRow {
  id: string;
  pro_id: string;
  visitor_id: string;
  visitor_zone: string;
  type: 'whatsapp' | 'call' | 'message';
  blocked: boolean;
  month: string;
  created_at: string;
}
