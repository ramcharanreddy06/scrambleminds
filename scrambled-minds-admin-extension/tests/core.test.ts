import { describe, expect, it } from 'vitest';
import { ChangeDetector } from '../src/shared/change-detector';
import { normalizeConversation } from '../src/shared/normalizer';
import { stableLocalCaptureId } from '../src/shared/identity';

describe('Buddy capture core', () => {
  const raw = { platform: 'chatgpt' as const, externalConversationId: 'abc', title: ' Chat ', sourceUrl: 'https://chatgpt.com/c/abc', messages: [{ role: 'user', content: ' hello ' }, { role: 'assistant', content: ' world ' }] };
  it('normalizes stable fields and sequences', () => { const result = normalizeConversation(raw, stableLocalCaptureId(raw.platform, raw.externalConversationId), '2026-01-01T00:00:00.000Z'); expect(result.localCaptureId).toBe('chatgpt:abc'); expect(result.title).toBe('Chat'); expect(result.messages[0].sequence).toBe(1); expect(result.messages[1].role).toBe('assistant'); });
  it('rejects identical snapshots but accepts a different conversation identity', async () => { const detector = new ChangeDetector(); const a = normalizeConversation(raw, 'chatgpt:abc'); expect(await detector.shouldCapture(a)).toBe(true); expect(await detector.shouldCapture(a)).toBe(false); const b = normalizeConversation({ ...raw, externalConversationId: 'def', sourceUrl: 'https://chatgpt.com/c/def' }, 'chatgpt:def'); expect(await detector.shouldCapture(b)).toBe(true); });
});
