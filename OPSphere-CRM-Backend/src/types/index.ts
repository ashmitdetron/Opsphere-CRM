import { Request } from 'express';

// ─── Database Row Types ──────────────────────────────────────

export interface Organisation {
  id: string;
  name: string;
  industry: string | null;
  website: string | null;
  created_at: Date;
  updated_at: Date;
}

export interface CrmUser {
  id: string;
  entity_id: string;
  email: string;
  password_hash: string;
  display_name: string | null;
  role: 'owner' | 'admin' | 'member';
  token_version: number;
  created_at: Date;
  updated_at: Date;
}

export interface CrmEntityMember {
  id: string;
  entity_id: string;
  user_id: string;
  role: string;
  created_at: Date;
}

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
  created_at: Date;
  updated_at: Date;
}

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
  created_at: Date;
  updated_at: Date;
}

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
  source: 'csv' | 'serper' | 'proxycurl' | 'linkedin' | 'manual' | 'apollo' | 'bing';
  source_tier: number;
  enrichment_status: 'pending' | 'in_progress' | 'completed' | 'failed' | 'skipped';
  enrichment_data: Record<string, unknown>;
  pipeline_stage: 'found' | 'researched' | 'message_drafted' | 'message_approved' | 'message_sent' | 'replied' | 'meeting_booked' | 'converted' | 'rejected';
  is_approved: boolean;
  rejection_reason: string | null;
  created_at: Date;
  updated_at: Date;
}

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
  approved_at: Date | null;
  rejection_reason: string | null;
  sent_at: Date | null;
  phantombuster_ref: string | null;
  ai_model: string | null;
  ai_prompt_version: string | null;
  created_at: Date;
  updated_at: Date;
}

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
  created_at: Date;
}

export interface Appointment {
  id: string;
  entity_id: string;
  prospect_id: string;
  campaign_id: string;
  title: string;
  scheduled_at: Date;
  duration_minutes: number;
  location: string | null;
  notes: string | null;
  status: 'scheduled' | 'completed' | 'cancelled' | 'no_show';
  created_by: string | null;
  created_at: Date;
  updated_at: Date;
}

// ─── JWT Payload ─────────────────────────────────────────────

export interface JwtAccessPayload {
  sub: string;
  entityId: string;
  role: string;
  tv: number;
}

export interface JwtRefreshPayload {
  sub: string;
  tv: number;
}

// ─── Express Augmentation ────────────────────────────────────

export interface AuthenticatedRequest extends Request {
  user: JwtAccessPayload;
  entityId: string;
}

// ─── API Error Shape ─────────────────────────────────────────

export interface ApiError {
  error: {
    code: string;
    message: string;
    details?: unknown;
  };
}

// ─── Agent Types ─────────────────────────────────────────────

export interface DiscoveryResult {
  linkedin_url: string;
  full_name: string;
  company_name: string;
  job_title: string;
  email?: string;
  source?: string;
}

export interface EnrichmentResult {
  company_size: string | null;
  recent_news: string | null;
  about_section: string | null;
  headline: string | null;
  summary: string | null;
  email: string | null;
  raw: Record<string, unknown>;
}

export interface GeneratedMessage {
  subject: string | null;
  body: string;
  ai_model: string;
  ai_prompt_version: string;
}

export interface SendQueueResult {
  success: boolean;
  phantombuster_ref: string | null;
  error?: string;
}
