import { QueueRepository } from '../shared/queue';
import type { NormalizedConversation } from '../shared/types';

declare const chrome: { runtime: { onMessage: { addListener(listener: (message: { type?: string; conversation?: NormalizedConversation }, sender: unknown, sendResponse: (response: unknown) => void) => void): void } } };
const queue = new QueueRepository();
chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => { if (message.type !== 'CONVERSATION_CAPTURED' || !message.conversation) return; void queue.put(message.conversation).then(() => sendResponse({ ok: true })).catch((error: unknown) => sendResponse({ ok: false, error: String(error) })); });
export async function queueConversation(conversation: NormalizedConversation): Promise<void> { await queue.put(conversation); }
