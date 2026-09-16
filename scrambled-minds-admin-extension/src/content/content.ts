import { ChangeDetector } from '../shared/change-detector';
import { stableLocalCaptureId } from '../shared/identity';
import { normalizeConversation } from '../shared/normalizer';
import { extractChatGPTConversation } from './chatgpt-adapter';
import type { NormalizedConversation } from '../shared/types';

declare const chrome: { runtime: { sendMessage(message: { type: string; conversation: NormalizedConversation }): Promise<unknown> } };
const detector = new ChangeDetector();
let lastUrl = location.href;
let timer: number | undefined;

function scheduleCapture(): void {
  window.clearTimeout(timer);
  timer = window.setTimeout(async () => {
    const raw = extractChatGPTConversation();
    if (!raw) return;
    const conversation = normalizeConversation(raw, stableLocalCaptureId(raw.platform, raw.externalConversationId));
    if (await detector.shouldCapture(conversation)) await chrome.runtime.sendMessage({ type: 'CONVERSATION_CAPTURED', conversation });
  }, 250);
}
function checkNavigation(): void { if (location.href !== lastUrl) { lastUrl = location.href; detector.reset(); scheduleCapture(); } }
new MutationObserver(() => { checkNavigation(); scheduleCapture(); }).observe(document.documentElement, { subtree: true, childList: true, characterData: true });
scheduleCapture();
