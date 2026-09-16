import type { NormalizedConversation } from './types';
export function canonicalConversation(c: NormalizedConversation): string { return JSON.stringify({ platform: c.platform, externalConversationId: c.externalConversationId, title: c.title.trim(), sourceUrl: c.sourceUrl, messages: c.messages.map(m => ({ sequence: m.sequence, role: m.role, content: m.content.replace(/\r\n/g, '\n').trim(), model: m.model ?? null })) }); }
export async function contentHash(c: NormalizedConversation): Promise<string> { const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(canonicalConversation(c))); return [...new Uint8Array(digest)].map(v => v.toString(16).padStart(2, '0')).join(''); }
export function stableLocalCaptureId(platform: string, externalId: string): string { return `${platform}:${externalId.trim()}`; }
export function newEventId(): string { return crypto.randomUUID(); }
