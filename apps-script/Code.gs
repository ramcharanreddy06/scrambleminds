const PLATFORMS = ['ChatGPT', 'Claude', 'Perplexity', 'DeepSeek', 'Grok', 'Gemini'];
const PROPS = PropertiesService.getScriptProperties();
const LOCK = LockService.getScriptLock();

function setupBuddy() {
  const existing = PROPS.getProperty('ROOT_FOLDER_ID');
  const root = existing ? DriveApp.getFolderById(existing) : DriveApp.createFolder('Buddy Team Chats');
  root.setName('Scrambled Minds');
  const adminKey = PROPS.getProperty('ADMIN_KEY') || Utilities.getUuid().replace(/-/g, '');
  PROPS.setProperties({ ROOT_FOLDER_ID: root.getId(), ADMIN_KEY: adminKey, SCHEMA_VERSION: '2' });
  Logger.log(JSON.stringify({ rootFolderId: root.getId(), rootFolderName: root.getName(), adminKey }, null, 2));
  return { rootFolderId: root.getId(), rootFolderName: root.getName(), adminKey };
}

function doGet() {
  return json({ ok: true, service: 'scrambled-minds-team-cloud', version: PROPS.getProperty('SCHEMA_VERSION') || 'uninitialized' });
}

function doPost(e) {
  try {
    const body = parseBody(e);
    if (body.action === 'health') return json({ ok: true, service: 'scrambled-minds-team-cloud', version: PROPS.getProperty('SCHEMA_VERSION') || 'uninitialized' });
    if (body.action === 'syncConversation' && body.memberToken) {
      assertMember(body.memberId, body.memberToken);
    } else {
      assertAdmin(body.adminKey);
    }
    switch (body.action) {
      case 'setup': return json(setupBuddy());
      case 'checkMemberFolder': return json(checkMemberFolder(body));
      case 'addMember': return json(addMember(body));
      case 'issueMemberToken': return json(issueMemberToken(body));
      case 'listMembers': return json({ ok: true, members: listMembers() });
      case 'setMemberStatus': return json(setMemberStatus(body));
      case 'removeMember': return json(removeMember(body));
      case 'trashMember': return json(trashMember(body));
      case 'restoreMember': return json(restoreMember(body));
      case 'permanentDeleteMember': return json(permanentDeleteMember(body));
      case 'syncConversation': return json(syncConversation(body));
      case 'listChats': return json({ ok: true, chats: listChats(body) });
      case 'readChat': return json(readChat(body));
      case 'trashChat': return json(trashChat(body));
      case 'restoreChat': return json(restoreChat(body));
      case 'permanentDeleteChat': return json(permanentDeleteChat(body));
      default: return json({ ok: false, error: { code: 'UNKNOWN_ACTION', message: 'Unsupported action.' } });
    }
  } catch (error) {
    const rawMessage = error instanceof Error ? error.message : String(error);
    const marker = rawMessage.indexOf(':');
    const code = error && error.code ? error.code : (marker > 0 && /^[A-Z0-9_]+$/.test(rawMessage.slice(0, marker)) ? rawMessage.slice(0, marker) : 'BACKEND_ERROR');
    const message = code === 'MEMBER_FOLDER_EXISTS' || code === 'MEMBER_ID_IN_USE'
      ? 'A member or folder with this member ID already exists. Confirm reuse or choose a different member ID.'
      : rawMessage;
    return json({ ok: false, error: { code, message, memberId: marker > 0 ? rawMessage.slice(marker + 1) : '' } });
  }
}

function parseBody(e) {
  if (!e || !e.postData || !e.postData.contents) throw new Error('Request body is required.');
  return JSON.parse(e.postData.contents);
}

function assertAdmin(adminKey) {
  const expected = PROPS.getProperty('ADMIN_KEY');
  if (!expected) throw new Error('Backend is not initialized. Run setupBuddy first.');
  if (!adminKey || adminKey !== expected) throw new Error('Admin authorization failed.');
}

function checkMemberFolder(body) {
  const memberId = sanitizeSlug(String(body.memberId || ''));
  if (!memberId) throw new Error('A member ID is required.');
  const existingMember = listMembers().find(member => member.id === memberId);
  const existingFolder = findChildFolder(getRoot(), memberId);
  return { ok: true, exists: Boolean(existingMember || existingFolder), memberId, existingMember: existingMember || null, folderPath: getRoot().getName() + '/' + memberId };
}

function addMember(body) {
  const name = String(body.name || '').trim();
  const email = String(body.email || '').trim().toLowerCase();
  const memberId = sanitizeSlug(String(body.memberId || slug(name || email.split('@')[0])));
  if (!name || !/^\S+@\S+\.\S+$/.test(email)) throw new Error('A member name and valid email are required.');
  const root = getRoot();
  const existingMember = listMembers().find(member => member.id === memberId);
  const existing = findChildFolder(root, memberId);
  if ((existingMember || existing) && body.reuseExisting !== true) throw new Error('MEMBER_FOLDER_EXISTS:' + memberId);
  if (existingMember && existingMember.email !== email && body.reuseExisting !== true) throw new Error('MEMBER_ID_IN_USE:' + memberId);

  const memberFolder = existing || root.createFolder(memberId);
  PLATFORMS.forEach(platform => { if (!findChildFolder(memberFolder, platform)) memberFolder.createFolder(platform); });
  const members = listMembers().filter(member => member.id !== memberId);
  const activationToken = Utilities.getUuid().replace(/-/g, '') + Utilities.getUuid().replace(/-/g, '');
  const record = { id: memberId, name, email, status: 'active', folderId: memberFolder.getId(), folderPath: root.getName() + '/' + memberId, activationToken, createdAt: new Date().toISOString() };
  members.push(record);
  saveMembers(members);
  return { ok: true, member: record };
}

function issueMemberToken(body) {
  const member = getMember(body.memberId);
  const activationToken = Utilities.getUuid().replace(/-/g, '') + Utilities.getUuid().replace(/-/g, '');
  const members = listMembers().map(item => item.id === member.id ? Object.assign({}, item, { activationToken }) : item);
  saveMembers(members);
  return { ok: true, memberId: member.id, activationToken };
}

function assertMember(memberId, memberToken) {
  const member = getMember(memberId);
  if (!member.activationToken || member.activationToken !== String(memberToken)) throw new Error('Member activation failed.');
  if (member.status !== 'active') throw new Error('Member account is disabled or archived.');
}

function listMembers() {
  const raw = PROPS.getProperty('MEMBERS_JSON');
  return raw ? JSON.parse(raw) : [];
}

function saveMembers(members) {
  PROPS.setProperty('MEMBERS_JSON', JSON.stringify(members));
  return members;
}

function setMemberStatus(body) {
  const member = getMember(body.memberId);
  const status = String(body.status || '');
  if (['active', 'disabled', 'archived'].indexOf(status) < 0) throw new Error('Invalid member status.');
  const members = listMembers().map(item => item.id === member.id ? Object.assign({}, item, { status }) : item);
  saveMembers(members);
  return { ok: true, member: members.find(item => item.id === member.id) };
}

function removeMember(body) {
  const member = getMember(body.memberId);
  const members = listMembers().filter(item => item.id !== member.id);
  saveMembers(members);
  return { ok: true, action: 'removed', memberId: member.id, folderPreserved: true };
}

function trashMember(body) {
  const member = getMember(body.memberId);
  const folder = findChildFolder(getRoot(), member.id);
  if (!folder) throw new Error('Member folder not found.');
  folder.setTrashed(true);
  return setMemberStatus({ memberId: member.id, status: 'archived' });
}

function restoreMember(body) {
  const member = getMember(body.memberId);
  if (!member.folderId) throw new Error('Member folder ID is missing.');
  const folder = DriveApp.getFolderById(member.folderId);
  folder.setTrashed(false);
  return setMemberStatus({ memberId: member.id, status: 'active' });
}

function permanentDeleteMember(body) {
  const member = getMember(body.memberId);
  if (member.folderId) permanentlyDeleteDriveTree(member.folderId);
  const members = listMembers().filter(item => item.id !== member.id);
  saveMembers(members);
  return { ok: true, action: 'permanently_deleted', memberId: member.id };
}

function getRoot() {
  const id = PROPS.getProperty('ROOT_FOLDER_ID');
  if (!id) throw new Error('Run setupBuddy before provisioning folders.');
  return DriveApp.getFolderById(id);
}

function getMember(memberId) {
  const id = sanitizeSlug(String(memberId || ''));
  const member = listMembers().find(item => item.id === id);
  if (!member) throw new Error('Member not found.');
  return member;
}

function getPlatformFolder(memberId, platform) {
  if (PLATFORMS.indexOf(platform) < 0) throw new Error('Unsupported platform.');
  const memberFolder = findChildFolder(getRoot(), sanitizeSlug(memberId));
  if (!memberFolder) throw new Error('Member folder not found.');
  const folder = findChildFolder(memberFolder, platform);
  if (!folder) throw new Error('Platform folder not found.');
  return folder;
}

function syncConversation(body) {
  const member = getMember(body.memberId);
  const conversation = body.conversation || {};
  const platform = String(conversation.platform || '');
  const externalId = String(conversation.externalConversationId || conversation.localCaptureId || '');
  const eventId = String(body.syncEventId || '');
  const messages = Array.isArray(conversation.messages) ? conversation.messages : [];
  if (!externalId || !eventId || !messages.length) throw new Error('Conversation, syncEventId, and messages are required.');
  const folder = getPlatformFolder(member.id, platform);
  const fileName = sessionFileName(conversation.title, externalId, platform);
  const key = 'SYNC_EVENT_' + safePropertyKey(eventId);
  if (PROPS.getProperty(key)) return { ok: true, duplicate: true, appended: 0, fileName };

  LOCK.waitLock(30000);
  try {
    if (PROPS.getProperty(key)) return { ok: true, duplicate: true, appended: 0, fileName };
    const existingFile = findSessionFile(folder, fileName, externalId);
    const existingContent = existingFile ? existingFile.getBlob().getDataAsString() : '';
    const cursorKey = 'CURSOR_' + safePropertyKey(member.id + '|' + platform + '|' + externalId);
    const previousSequence = Number(PROPS.getProperty(cursorKey) || 0);
    const orderedMessages = messages.slice().sort((a, b) => Number(a.sequence || 0) - Number(b.sequence || 0));
    // Merge snapshots by content: browser AI pages often emit a partial assistant answer first,
    // then emit the completed answer. Replace a shorter prefix instead of appending both.
    let mergedContent = existingContent;
    let appended = 0;
    orderedMessages.forEach(message => {
      const block = formatMessage(message, member, conversation);
      if (!block || mergedContent.includes(block)) return;
      const merge = mergeAssistantSnapshot(mergedContent, message, conversation, block);
      if (merge.handled) {
        mergedContent = merge.content;
        return;
      }
      mergedContent += (mergedContent ? '\n' : '') + block;
      appended++;
    });
    if (mergedContent !== existingContent) {
      if (existingFile) {
        existingFile.setContent(mergedContent);
        if (existingFile.getName() !== fileName) existingFile.setName(fileName);
      } else {
        const createdFile = folder.createFile(fileName, sessionHeader(member, conversation) + mergedContent, MimeType.PLAIN_TEXT);
        createdFile.setDescription('SCRAMBLED_MINDS_CONVERSATION_ID=' + externalId);
      }
    } else if (existingFile && existingFile.getName() !== fileName) {
      existingFile.setName(fileName);
    }
    const highest = messages.reduce((max, message) => Math.max(max, Number(message.sequence || 0)), previousSequence);
    PROPS.setProperties({ [key]: new Date().toISOString(), [cursorKey]: String(highest) });
    return { ok: true, duplicate: false, appended, fileName, memberId: member.id, platform, serverVersion: highest };
  } finally {
    LOCK.releaseLock();
  }
}

function listChats(body) {
  const requestedMember = body.memberId ? getMember(body.memberId).id : null;
  const result = [];
  listMembers().filter(member => !requestedMember || member.id === requestedMember).forEach(member => {
    const memberFolder = findChildFolder(getRoot(), member.id);
    if (!memberFolder) return;
    PLATFORMS.forEach(platform => {
      const platformFolder = findChildFolder(memberFolder, platform);
      if (!platformFolder) return;
      const files = platformFolder.getFiles();
      while (files.hasNext()) {
        const file = files.next();
        result.push({ id: file.getId(), memberId: member.id, memberName: member.name, platform, name: file.getName(), size: file.getSize(), updatedAt: file.getLastUpdated().toISOString(), trashed: file.isTrashed() });
      }
    });
  });
  return result.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}

function readChat(body) {
  const file = findChatFile(body);
  return { ok: true, chat: { id: file.getId(), name: file.getName(), content: file.getBlob().getDataAsString(), updatedAt: file.getLastUpdated().toISOString() } };
}

function trashChat(body) {
  const file = findChatFile(body);
  file.setTrashed(true);
  return { ok: true, action: 'trashed', id: file.getId() };
}

function restoreChat(body) {
  const file = findChatFile(body);
  file.setTrashed(false);
  return { ok: true, action: 'restored', id: file.getId() };
}

function permanentDeleteChat(body) {
  const file = findChatFile(body);
  permanentlyDeleteDriveTree(file.getId());
  return { ok: true, action: 'permanently_deleted', id: body.fileId };
}

function findChatFile(body) {
  const fileId = String(body.fileId || '');
  if (!fileId) throw new Error('fileId is required.');
  try {
    const file = DriveApp.getFileById(fileId);
    if (!file) throw new Error('Chat file not found.');
    return file;
  } catch (error) {
    throw new Error('Chat file not found or inaccessible.');
  }
}

function permanentlyDeleteDriveTree(rootId) {
  const root = String(rootId || '');
  if (!root) throw new Error('Drive item ID is required.');
  let pageToken = '';
  do {
    const query = encodeURIComponent("'" + root + "' in parents");
    const token = pageToken ? '&pageToken=' + encodeURIComponent(pageToken) : '';
    const response = UrlFetchApp.fetch('https://www.googleapis.com/drive/v3/files?q=' + query + '&fields=nextPageToken,files(id,mimeType)' + token, { headers: { Authorization: 'Bearer ' + ScriptApp.getOAuthToken() }, muteHttpExceptions: true });
    const code = response.getResponseCode();
    if (code >= 300) throw new Error('Drive permanent deletion request failed (' + code + ').');
    const page = JSON.parse(response.getContentText());
    (page.files || []).forEach(item => permanentlyDeleteDriveTree(item.id));
    pageToken = page.nextPageToken || '';
  } while (pageToken);
  const deleted = UrlFetchApp.fetch('https://www.googleapis.com/drive/v3/files/' + encodeURIComponent(rootId), { method: 'delete', headers: { Authorization: 'Bearer ' + ScriptApp.getOAuthToken() }, muteHttpExceptions: true });
  if (deleted.getResponseCode() >= 300 && deleted.getResponseCode() !== 404) throw new Error('Drive item could not be permanently deleted.');
}

function findChildFolder(parent, name) {
  const folders = parent.getFoldersByName(name);
  return folders.hasNext() ? folders.next() : null;
}

function findChildFile(parent, name) {
  const files = parent.getFilesByName(name);
  return files.hasNext() ? files.next() : null;
}

function findSessionFile(parent, name, externalId) {
  const marker = 'SCRAMBLED_MINDS_CONVERSATION_ID=' + String(externalId || '');
  // Search by immutable conversation marker, not only the current title. Claude and other AIs
  // allow renaming a chat, so the Drive filename can change while the conversation ID stays fixed.
  const files = parent.getFiles();
  while (files.hasNext()) {
    const file = files.next();
    if (String(file.getDescription() || '').indexOf(marker) >= 0) return file;
  }
  const named = parent.getFilesByName(name);
  return named.hasNext() ? named.next() : null;
}

function sessionHeader(member, conversation) {
  return [
    'Scrambled Minds Chat',
    'Member: ' + String(member.name || member.id || ''),
    'Platform: ' + String(conversation.platform || ''),
    'Title: ' + String(conversation.title || 'Untitled'),
    '',
    ''
  ].join('\n');
}

function cleanStoredContent(value, platform) {
  let text = String(value || '').replace(/\r\n/g, '\n').trim();
  if (String(platform || '').toLowerCase() !== 'claude') return text;
  text = text
    .replace(/\bSearched the web\b/gi, '')
    .replace(/\bThought\s+for\s+\d+\s*(?:s|m)(?:\s+\d+\s*(?:s|m))*/gi, '')
    .replace(/\b(?:V?visualize|show_widget|Loading)\b/gi, '')
    .replace(/\b(?:Figuring|Finding)\b/gi, '')
    .replace(/[ \t]{2,}/g, ' ')
    .replace(/\n\s*\n\s*\n+/g, '\n\n')
    .replace(/^([^.!?\n]{10,180}\.)\s*\1\s*/i, '')
    .replace(/\s+([,.!?])/g, '$1')
    .trim();
  return normalizeClaudeAsciiTablesText(text);
}

function normalizeClaudeAsciiTablesText(value) {
  const lines = String(value || '').split('\n');
  const output = [];
  let index = 0;
  while (index < lines.length) {
    const current = lines[index].trim();
    const next = lines[index + 1] ? lines[index + 1].trim() : '';
    if (!/^\+[-+]+\+$/.test(current) || next.charAt(0) !== '|') { output.push(lines[index]); index++; continue; }
    const block = [];
    let cursor = index;
    while (cursor < lines.length && (/^\+[-+]+\+$/.test(lines[cursor].trim()) || lines[cursor].trim().charAt(0) === '|')) { block.push(lines[cursor].trim()); cursor++; }
    const parsed = block.filter(line => line.charAt(0) === '|').map(line => line.slice(1, line.endsWith('|') ? -1 : undefined).split('|').map(cell => cell.trim()));
    if (parsed.length < 2) { output.push.apply(output, block); index = cursor; continue; }
    const columnCount = Math.max.apply(null, parsed.map(row => row.length));
    const logicalRows = [];
    parsed.forEach(row => {
      const normalized = Array.from({ length: columnCount }, (_, col) => row[col] || '');
      if (logicalRows.length && (normalized[0] === '' || (normalized[1] === '' && columnCount > 1))) {
        const previous = logicalRows[logicalRows.length - 1];
        normalized.forEach((cell, col) => { if (cell) previous[col] = previous[col] ? previous[col] + ' ' + cell : cell; });
      } else logicalRows.push(normalized);
    });
    const caps = columnCount === 4 ? [12, 28, 18, 34] : columnCount === 3 ? [18, 34, 20] : Array.from({ length: columnCount }, () => 24);
    const widths = Array.from({ length: columnCount }, (_, col) => Math.min(caps[col] || 24, Math.max.apply(null, logicalRows.map(row => Math.max(3, row[col].length)))));
    const wrap = (value, width) => {
      const words = String(value || '').split(/\s+/).filter(Boolean); const result = []; let line = '';
      words.forEach(word => { while (word.length > width) { if (line) { result.push(line); line = ''; } result.push(word.slice(0, width)); word = word.slice(width); } if (!word) return; if (!line) line = word; else if ((line + ' ' + word).length <= width) line += ' ' + word; else { result.push(line); line = word; } });
      if (line) result.push(line); return result.length ? result : [''];
    };
    const border = '+' + widths.map(width => new Array(width + 3).join('-')).join('+') + '+';
    const rendered = [border];
    logicalRows.forEach(row => {
      const cells = row.map((cell, col) => wrap(cell, widths[col])); const height = Math.max.apply(null, cells.map(cell => cell.length));
      for (let lineNo = 0; lineNo < height; lineNo++) rendered.push('| ' + cells.map((cell, col) => (cell[lineNo] || '') + new Array(widths[col] - (cell[lineNo] || '').length + 1).join(' ')).join(' | ') + ' |');
      rendered.push(border);
    });
    output.push.apply(output, rendered); index = cursor;
  }
  return output.join('\n');
}

function mergeAssistantSnapshot(existingContent, message, conversation, incomingBlock) {
  if (String(message.role || '').toUpperCase() !== 'ASSISTANT') return { handled: false, content: existingContent };
  const speaker = String(conversation.platform || 'AI');
  const incoming = normalizeStoredText(cleanStoredContent(String(message.content || ''), conversation.platform));
  if (!incoming) return { handled: true, content: existingContent };
  const pattern = /(-->\s+([^:]+):\n)([\s\S]*?)(\n-{20,}\n)/g;
  let match;
  while ((match = pattern.exec(existingContent))) {
    if (String(match[2]).trim() !== speaker) continue;
    const stored = normalizeStoredText(match[3]);
    if (!stored) continue;
    if (incoming.startsWith(stored) && incoming.length > stored.length) {
      const replacement = match[1] + String(message.content || '').trim() + match[4];
      return { handled: true, content: existingContent.slice(0, match.index) + replacement + existingContent.slice(match.index + match[0].length) };
    }
    if (stored.startsWith(incoming)) return { handled: true, content: existingContent };
  }
  return { handled: false, content: existingContent };
}

function normalizeStoredText(value) {
  return String(value || '').replace(/\s+/g, ' ').trim().toLowerCase();
}

function formatMessage(message, member, conversation) {
  const role = String(message.role || '').toUpperCase();
  const speaker = role === 'USER'
    ? String(member.name || member.id || 'Member')
    : role === 'ASSISTANT'
      ? String(conversation.platform || 'AI')
      : String(role || 'Speaker');
  let content = String(message.content || '').replace(/\r\n/g, '\n').trim();
  if (role === 'USER') content = content.replace(/^You said:\s*/i, '').trim();
  content = cleanStoredContent(content, conversation.platform);
  content = content.replace(/\n{3,}/g, '\n\n');
  return '--> ' + speaker + ':\n' + content + '\n' + '-'.repeat(60) + '\n';
}

function sessionFileName(title, externalId, platform) {
  if (['claude', 'chatgpt', 'perplexity'].includes(String(platform || '').toLowerCase())) {
    var readable = String(title || 'Conversation')
      .normalize('NFKD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[<>:"/\\|?*\u0000-\u001f]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim() || 'Conversation';
    return (readable.substring(0, 95).trim() + '.txt').substring(0, 100);
  }
  var base = sanitizeSlug(title || 'conversation') || 'conversation';
  return (base.substring(0, 95) + '.txt').substring(0, 100);
}

function sanitizeSlug(value) {
  return String(value || '').toLowerCase().normalize('NFKD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 48) || 'member';
}

function safePropertyKey(value) {
  return String(value || '').replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 180);
}

function slug(value) {
  return sanitizeSlug(value);
}

function rotateAdminKey() {
  const adminKey = Utilities.getUuid().replace(/-/g, '');
  PROPS.setProperty('ADMIN_KEY', adminKey);
  Logger.log(JSON.stringify({ adminKey }, null, 2));
  return { adminKey };
}

function json(value) {
  return ContentService.createTextOutput(JSON.stringify(value)).setMimeType(ContentService.MimeType.JSON);
}

