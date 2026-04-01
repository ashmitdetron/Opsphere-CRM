// ─── API Response Wrappers ───────────────────────────────

export interface ApiError {
  error: { code: string; message: string; details?: unknown };
}

export interface PaginatedResponse<T> {
  total: number;
  limit: number;
  offset: number;
  [key: string]: T[] | number;
}

// ─── Auth ────────────────────────────────────────────────

export interface AuthUser {
  id: string;
  email: string;
  displayName: string | null;
  role: 'owner' | 'admin' | 'member';
  createdAt?: string;
}

export interface AuthEntity {
  id: string;
  name: string;
}

export interface LoginResponse {
  accessToken: string;
  refreshToken: string;
  user: AuthUser;
  entity: AuthEntity | null;
}

// ─── Organisations ───────────────────────────────────────

export interface Organisation {
  id: string;
  name: string;
  industry: string | null;
  website: string | null;
  created_at: string;
  updated_at: string;
}

// ─── Leads ───────────────────────────────────────────────

export interface Lead {
  id: string;
  entity_id: string;
  name: string;
  email: string | null;
  phone: string | null;
  company: string | null;
  source: string | null;
  stage_id: string | null;
  assigned_to: string | null;
  notes: string | null;
  value: number | null;
  metadata: Record<string, unknown> | null;
  created_at: string;
  updated_at: string;
}

// ─── Campaigns ───────────────────────────────────────────

export interface Campaign {
  id: string;
  entity_id: string;
  name: string;
  description: string | null;
  status: 'draft' | 'active' | 'paused' | 'completed' | 'archived';
  brand_voice_id: string | null;
  icp_industries: string[] | null;
  icp_seniority: string[] | null;
  icp_company_size: string | null;
  icp_locations: string[] | null;
  icp_keywords: string[] | null;
  daily_send_limit: number;
  total_prospect_count: number;
  total_message_count: number;
  total_reply_count: number;
  total_meeting_count: number;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface CampaignDetail {
  campaign: Campaign;
  stage_breakdown: Array<{ pipeline_stage: string; count: number }>;
}

// ─── Prospects ───────────────────────────────────────────

export type PipelineStage =
  | 'found' | 'researched' | 'message_drafted' | 'message_approved'
  | 'message_sent' | 'replied' | 'meeting_booked' | 'converted' | 'rejected';

export interface Prospect {
  id: string;
  entity_id: string;
  campaign_id: string;
  first_name: string | null;
  last_name: string | null;
  full_name: string | null;
  email: string | null;
  linkedin_url: string | null;
  company_name: string | null;
  company_website: string | null;
  job_title: string | null;
  industry: string | null;
  location: string | null;
  company_size: string | null;
  source: string;
  source_tier: number;
  enrichment_status: 'pending' | 'in_progress' | 'completed' | 'failed' | 'skipped';
  enrichment_data: Record<string, unknown>;
  pipeline_stage: PipelineStage;
  is_approved: boolean;
  rejection_reason: string | null;
  created_at: string;
  updated_at: string;
}

// ─── Messages ────────────────────────────────────────────

export interface OutreachMessage {
  id: string;
  entity_id: string;
  campaign_id: string;
  prospect_id: string;
  subject: string | null;
  body: string;
  channel: 'linkedin' | 'email';
  status: 'draft' | 'approved' | 'rejected' | 'queued' | 'sent' | 'failed';
  approved_by: string | null;
  approved_at: string | null;
  rejection_reason: string | null;
  sent_at: string | null;
  phantombuster_ref: string | null;
  ai_model: string | null;
  ai_prompt_version: string | null;
  created_at: string;
  updated_at: string;
  // joined fields from review-queue
  prospect_name?: string;
  prospect_company?: string;
  prospect_title?: string;
}

// ─── Brand Voices ─────────────────────────────────────────

export interface BrandVoice {
  id: string;
  entity_id: string;
  name: string;
  industry: string | null;
  value_proposition: string | null;
  tone: string;
  avoid_phrases: string[] | null;
  example_messages: string[] | null;
  is_default: boolean;
  created_at: string;
  updated_at: string;
}

// ─── Appointments ─────────────────────────────────────────

export type AppointmentStatus = 'scheduled' | 'completed' | 'cancelled' | 'no_show';

export interface Appointment {
  id: string;
  entity_id: string;
  prospect_id: string;
  campaign_id: string;
  title: string;
  scheduled_at: string;
  duration_minutes: number;
  location: string | null;
  notes: string | null;
  status: AppointmentStatus;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  // Joined fields
  prospect_name?: string;
  prospect_company?: string;
  prospect_title?: string;
  campaign_name?: string;
}

// ─── Pipeline ────────────────────────────────────────────

export interface PipelineEvent {
  id: string;
  entity_id: string;
  prospect_id: string;
  campaign_id: string;
  event_type: string;
  from_stage: string | null;
  to_stage: string | null;
  notes: string | null;
  created_by: string | null;
  created_at: string;
}

export interface PipelineStats {
  summary: {
    total_prospects: number;
    stage_breakdown: Array<{ pipeline_stage: string; count: number }>;
  };
  campaigns: Array<{
    campaign_id: string;
    campaign_name: string;
    campaign_status: string;
    total_prospect_count: number;
    total_message_count: number;
    total_reply_count: number;
    total_meeting_count: number;
    message_rate: number;
    reply_rate: number;
    meeting_rate: number;
  }>;
}
