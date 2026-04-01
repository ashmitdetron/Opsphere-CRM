import { OutreachMessage, Prospect, SendQueueResult } from '../types/index.js';

const PHANTOMBUSTER_API_KEY = process.env.PHANTOMBUSTER_API_KEY || '';
const PHANTOMBUSTER_ENDPOINT = 'https://api.phantombuster.com/api/v2/agents/launch';

interface PhantombusterPayload {
  id: string;
  argument: {
    linkedinUrl: string;
    message: string;
  };
}

interface PhantombusterResponse {
  containerId: string;
  status: string;
}

function formatPayload(prospect: Prospect, message: OutreachMessage): PhantombusterPayload {
  return {
    id: 'linkedin-message-sender',
    argument: {
      linkedinUrl: prospect.linkedin_url || '',
      message: message.body,
    },
  };
}

async function callPhantombusterApi(payload: PhantombusterPayload): Promise<PhantombusterResponse> {
  if (!PHANTOMBUSTER_API_KEY) {
    console.warn('[SendQueue] PHANTOMBUSTER_API_KEY not set — returning stub response');
    return {
      containerId: `stub-${Date.now()}`,
      status: 'queued',
    };
  }

  const response = await fetch(PHANTOMBUSTER_ENDPOINT, {
    method: 'POST',
    headers: {
      'X-Phantombuster-Key': PHANTOMBUSTER_API_KEY,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Phantombuster API error ${response.status}: ${text}`);
  }

  return response.json() as Promise<PhantombusterResponse>;
}

export async function enqueueMessage(
  prospect: Prospect,
  message: OutreachMessage,
): Promise<SendQueueResult> {
  console.log(`[SendQueue] Enqueuing message ${message.id} for prospect ${prospect.id}`);

  if (!prospect.linkedin_url) {
    return {
      success: false,
      phantombuster_ref: null,
      error: 'Prospect has no LinkedIn URL',
    };
  }

  try {
    const payload = formatPayload(prospect, message);
    const result = await callPhantombusterApi(payload);

    console.log(`[SendQueue] Message queued: ${result.containerId}`);
    return {
      success: true,
      phantombuster_ref: result.containerId,
    };
  } catch (err) {
    const errMessage = err instanceof Error ? err.message : 'Unknown error';
    console.error(`[SendQueue] Failed to enqueue: ${errMessage}`);
    return {
      success: false,
      phantombuster_ref: null,
      error: errMessage,
    };
  }
}
