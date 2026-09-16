importScripts('member-config.js');

const QUEUE = 'buddyCaptureQueue';
const CONFIG = 'buddyMemberConfig';
const CAPTURE = 'buddyCaptureEnabled';
const LAST_SYNC = 'buddyLastSync';

async function getConfig() {
  const data = await chrome.storage.local.get([CONFIG]);
  const saved = data[CONFIG] || {};
  const template = typeof SCRAMBLED_MINDS_TEMPLATE_CONFIG === 'object' ? SCRAMBLED_MINDS_TEMPLATE_CONFIG : {};
  const config = {
    backendUrl: template.backendUrl || saved.backendUrl || '',
    memberId: template.memberId || saved.memberId || '',
    email: template.email || saved.email || '',
    memberToken: template.memberToken || saved.memberToken || ''
  };
  if (config.memberId && config.memberToken && JSON.stringify(saved) !== JSON.stringify(config)) {
    await chrome.storage.local.set({ [CONFIG]: config });
  }
  return config;
}

async function deliver(item, config) {
  const response = await fetch(config.backendUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'text/plain;charset=utf-8' },
    body: JSON.stringify({
      action: 'syncConversation',
      memberId: config.memberId,
      memberToken: config.memberToken,
      syncEventId: item.syncEventId,
      conversation: item.conversation
    })
  });
  const raw = await response.text();
  let result;
  try { result = JSON.parse(raw); } catch (_) {
    throw new Error(`Backend returned non-JSON response (HTTP ${response.status}, ${response.headers.get('content-type') || 'unknown'}): ${raw.slice(0, 240)}`);
  }
  if (!response.ok || !result.ok) throw new Error(result.error || `Backend HTTP ${response.status}`);
  await chrome.storage.local.set({
    [LAST_SYNC]: { ok: true, at: new Date().toISOString(), fileName: result.fileName || '', appended: result.appended || 0, platform: item.conversation?.platform || '' }
  });
  return result;
}

async function flushQueue() {
  const data = await chrome.storage.local.get([QUEUE]);
  let queue = Array.isArray(data[QUEUE]) ? data[QUEUE] : [];
  const config = await getConfig();
  if (!config?.backendUrl || !config?.memberId || !config?.memberToken || !queue.length) return { sent: 0, pending: queue.length };
  let sent = 0;
  for (const item of queue) {
    try {
      await deliver(item, config);
      queue = queue.filter(x => x.id !== item.id);
      sent++;
      await chrome.storage.local.set({ [QUEUE]: queue });
    } catch (error) {
      await chrome.storage.local.set({ [LAST_SYNC]: { ok: false, at: new Date().toISOString(), error: String(error), pending: queue.length } });
      break;
    }
  }
  return { sent, pending: queue.length };
}

chrome.runtime.onInstalled.addListener(details => {
  if (details.reason === 'install') {
    chrome.storage.local.set({ [CAPTURE]: false, [QUEUE]: [] });
  }
  getConfig().catch(() => {});
});
chrome.runtime.onStartup.addListener(() => { flushQueue().catch(() => {}); });

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message.type !== 'CONVERSATION_CAPTURED') return;
  (async () => {
    const data = await chrome.storage.local.get([CONFIG, QUEUE, CAPTURE]);
    if (data[CAPTURE] !== true) { sendResponse({ ok: true, stored: false, reason: 'capture_off' }); return; }
    const config = await getConfig();
    if (!config?.memberId || !config?.memberToken || !config?.backendUrl) { sendResponse({ ok: false, error: 'Member extension is not configured' }); return; }
    const queue = Array.isArray(data[QUEUE]) ? data[QUEUE] : [];
    const item = { id: crypto.randomUUID(), syncEventId: crypto.randomUUID(), memberId: config.memberId, conversation: message.conversation, createdAt: new Date().toISOString() };
    const duplicate = queue.some(x => x.conversation?.externalConversationId === item.conversation.externalConversationId && x.conversation?.title === item.conversation.title && JSON.stringify(x.conversation.messages) === JSON.stringify(item.conversation.messages));
    if (!duplicate) {
      queue.push(item);
      await chrome.storage.local.set({ [QUEUE]: queue });
    }
    const result = await flushQueue();
    sendResponse({ ok: true, stored: !duplicate && result.pending === 0, pending: result.pending, sync: result });
  })().catch(error => sendResponse({ ok: false, error: String(error) }));
  return true;
});
