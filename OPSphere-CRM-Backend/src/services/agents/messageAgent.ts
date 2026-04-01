import { BrandVoice, Campaign, Prospect, GeneratedMessage } from '../../types/index.js';

const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY || '';
const ANTHROPIC_ENDPOINT = 'https://api.anthropic.com/v1/messages';
const MODEL = 'claude-sonnet-4-20250514';
const PROMPT_VERSION = '1.0.0';

interface AnthropicMessage {
  role: 'user' | 'assistant';
  content: string;
}

interface AnthropicResponse {
  id: string;
  content: Array<{ type: 'text'; text: string }>;
  model: string;
  usage: { input_tokens: number; output_tokens: number };
}

function buildSystemPrompt(brandVoice: BrandVoice | null): string {
  const base = `You are an expert B2B outreach specialist. Write a personalised LinkedIn connection message. Keep it under 300 characters. Reference something specific about the prospect or their company. Never use generic phrases like "I came across your profile". End with a soft question, not a pitch.`;

  if (!brandVoice) return base;

  const parts = [base];

  if (brandVoice.tone) {
    parts.push(`Tone: ${brandVoice.tone}.`);
  }
  if (brandVoice.value_proposition) {
    parts.push(`Value proposition: ${brandVoice.value_proposition}.`);
  }
  if (brandVoice.industry) {
    parts.push(`Industry context: ${brandVoice.industry}.`);
  }
  if (brandVoice.avoid_phrases?.length) {
    parts.push(`Never use these phrases: ${brandVoice.avoid_phrases.join(', ')}.`);
  }
  if (brandVoice.example_messages?.length) {
    parts.push(`Example messages for style reference:\n${brandVoice.example_messages.map((m, i) => `${i + 1}. ${m}`).join('\n')}`);
  }

  return parts.join('\n\n');
}

function buildUserPrompt(prospect: Prospect, campaign: Campaign): string {
  const lines: string[] = ['Write a LinkedIn connection message for this prospect:'];

  if (prospect.full_name) lines.push(`Name: ${prospect.full_name}`);
  if (prospect.job_title) lines.push(`Title: ${prospect.job_title}`);
  if (prospect.company_name) lines.push(`Company: ${prospect.company_name}`);
  if (prospect.industry) lines.push(`Industry: ${prospect.industry}`);
  if (prospect.location) lines.push(`Location: ${prospect.location}`);
  if (prospect.company_size) lines.push(`Company Size: ${prospect.company_size}`);

  const enrichment = prospect.enrichment_data as Record<string, unknown>;
  if (enrichment.headline) lines.push(`LinkedIn Headline: ${enrichment.headline}`);
  if (enrichment.summary) lines.push(`LinkedIn Summary: ${enrichment.summary}`);
  if (enrichment.about_section) lines.push(`Company About: ${enrichment.about_section}`);
  if (enrichment.recent_news) lines.push(`Recent News: ${enrichment.recent_news}`);

  if (campaign.description) {
    lines.push(`\nCampaign context: ${campaign.description}`);
  }

  return lines.join('\n');
}

async function callAnthropicApi(
  systemPrompt: string,
  messages: AnthropicMessage[],
): Promise<string> {
  if (!ANTHROPIC_API_KEY) {
    console.warn('[MessageAgent] ANTHROPIC_API_KEY not set — returning stub message');
    return 'Hi {{name}}, noticed {{company}} is scaling fast in {{industry}}. Curious how your team handles outbound at that pace — any frameworks that have worked well?';
  }

  const response = await fetch(ANTHROPIC_ENDPOINT, {
    method: 'POST',
    headers: {
      'x-api-key': ANTHROPIC_API_KEY,
      'anthropic-version': '2023-06-01',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: MODEL,
      max_tokens: 256,
      system: systemPrompt,
      messages,
    }),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Anthropic API error ${response.status}: ${text}`);
  }

  const data = (await response.json()) as AnthropicResponse;
  const textBlock = data.content.find((b) => b.type === 'text');
  return textBlock?.text ?? '';
}

export async function generateMessage(
  prospect: Prospect,
  campaign: Campaign,
  brandVoice: BrandVoice | null,
): Promise<GeneratedMessage> {
  console.log(`[MessageAgent] Generating message for ${prospect.full_name}`);

  const systemPrompt = buildSystemPrompt(brandVoice);
  const userPrompt = buildUserPrompt(prospect, campaign);

  const body = await callAnthropicApi(systemPrompt, [
    { role: 'user', content: userPrompt },
  ]);

  return {
    subject: null,
    body,
    ai_model: MODEL,
    ai_prompt_version: PROMPT_VERSION,
  };
}
