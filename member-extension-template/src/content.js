const seen = new Map();
let retryScheduled = false;

const RULES = [
  {
    platform: 'ChatGPT',
    hosts: ['chatgpt.com', 'chat.openai.com'],
    turns: ['[data-testid^="conversation-turn-"]', '[data-message-author-role]'],
    user: ['[data-message-author-role="user"]', '[data-testid="user-message"]'],
    assistant: ['[data-message-author-role="assistant"]', '[data-testid="assistant-message"]'],
    markdown: '.markdown, div[class*="markdown"]',
    reasoning: ['[data-testid*="reasoning"]', '[data-testid*="thought"]', '[class*="thought"]', '[class*="reasoning"]'],
    noise: ['button', '[data-testid*="action"]', '[data-testid*="feedback"]', '[aria-label*="copy" i]', '[aria-label*="thumbs" i]', '[aria-label*="retry" i]'],
    streaming: ['button[data-testid="stop-button"]', 'button[aria-label="Stop generating"]', 'span[class*="result-streaming"]'],
    id: /\/c\/([^/?#]+)/
  },
  {
    platform: 'Claude',
    hosts: ['claude.ai'],
    turns: ['div[data-testid="user-message"]', 'div.font-user-message', 'div.font-claude-message', 'div[data-testid="claude-message"]', 'div[class*="ChatMessage"]', 'div[class*="chat-message"]', 'div[data-is-streaming]'],
    user: ['[data-testid="user-message"]', '.font-user-message', '[data-is-user="true"]', 'div[class*="user-message"]', 'div[class*="UserMessage"]'],
    assistant: ['[data-testid="claude-message"]', '[data-testid="assistant-message"]', '.font-claude-message', '[data-is-streaming]', '[data-is-assistant="true"]', '[data-role="assistant"]', 'div[class*="claude-message"]', 'div[class*="ClaudeMessage"]', 'div[class*="claude-response"]', 'div[class*="assistant-message"]', 'div[class*="AssistantMessage"]'],
    markdown: '.standard-markdown, div[class*="standard-markdown"], div[class*="markdown"], div[class*="prose"]',
    reasoning: ['antthinking', '[data-testid*="reasoning"]', '[data-testid*="thought"]', '[class*="thought"]', '[class*="thinking"]', '[class*="ThinkingContainer"]'],
    noise: ['button', '[data-testid*="action"]', '[data-testid*="feedback"]', '[aria-label*="copy" i]', '[aria-label*="retry" i]', '[aria-label*="share" i]'],
    streaming: ['div[data-is-streaming="true"]', 'button[aria-label*="Stop Response" i]', 'button[aria-label*="Stop generating" i]', 'span[class*="cursor-blink"]'],
    id: /\/chat\/([a-zA-Z0-9_-]+)/
  },
  {
    platform: 'Perplexity',
    hosts: ['perplexity.ai'],
    turns: ['[data-testid="thread-turn"]', 'div[class*="ThreadTurn"]', 'div[class*="thread-turn"]', '.conversation-turn', '[data-testid="user-turn"]', '[data-testid="assistant-turn"]', '.query-turn', '.answer-turn', 'div[class*="group/user-bubble"]', '[data-workflow-final-text]'],
    user: ['[data-testid="user-turn"]', '[data-testid="user-query"]', '.user-turn', 'div[class*="user-query"]', 'div[class*="QueryTurn"]', 'div[class*="group/user-bubble"]'],
    assistant: ['[data-testid="assistant-turn"]', '[data-testid="answer-content"]', '.assistant-turn', 'div[class*="answer-turn"]', 'div[class*="AnswerTurn"]', '[data-workflow-final-text]', '.prose'],
    markdown: '[data-testid="answer-content"], div[class*="answer-content"], [data-workflow-final-text], .prose, div[class*="prose"], div[class*="markdown"]',
    reasoning: ['[data-testid="reasoning-container"]', '[data-testid="thought-container"]', '.reasoning-steps', '.thinking-container', 'div[class*="reasoning"]', 'div[class*="thinking"]', 'div[class*="ProSearchSteps"]'],
    noise: ['button', '[data-testid="action-bar"]', '[data-testid="sources-section"]', '[data-testid="source-card"]', '[data-testid="citation"]', '[data-testid="citation-pill"]', '[data-testid="related-questions"]', '[data-testid="follow-up"]', '[class*="source-card"]', '[class*="related-questions"]'],
    streaming: ['button[aria-label="Stop"]', 'button[aria-label="Stop generating"]', '[data-testid="stop-button"]', '.streaming-cursor', '[data-testid="streaming-indicator"]'],
    id: /^\/search\/([^/?#]+)/
  },
  {
    platform: 'DeepSeek',
    hosts: ['deepseek.com', 'chat.deepseek.com'],
    turns: ['div[class*="chat-message"]', 'div[class*="message-item"]', 'div[class*="chat-item"]', 'div[data-testid*="message-"]', 'div[class*="ChatMessage"]', 'div[class*="MessageRow"]'],
    user: ['div[class*="chat-message--user"]', 'div[class*="user-message"]', '[data-is-user="true"]', 'div[class*="UserMessage"]'],
    assistant: ['div[class*="chat-message--assistant"]', 'div[class*="assistant-message"]', 'div[class*="AssistantMessage"]', 'div[class*="ds-message"]'],
    markdown: 'div.ds-markdown, div[class*="ds-markdown"], div[class*="markdown"], div[class*="message-content"], div.prose',
    reasoning: ['div.ds-think', 'div[class*="ds-think"]', 'div[class*="thinking"]', 'div[class*="reasoning"]', '[data-testid*="thought"]'],
    noise: ['button', '[data-testid*="action"]', '[data-testid*="feedback"]', '[aria-label*="copy" i]', '[aria-label*="retry" i]', 'div[class*="action-buttons"]'],
    streaming: ['div[class*="stop-button"]', 'button[class*="stop"]', 'button[aria-label*="Stop" i]', 'span[class*="streaming-cursor"]', 'div[class*="ds-loading"]'],
    id: /\/(?:a\/chat\/s|chat\/s|chat|c)\/([a-zA-Z0-9_-]+)/
  },
  {
    platform: 'Grok',
    hosts: ['grok.com', 'x.com'],
    path: /^(?:\/i\/grok|\/c\/|\/share\/|\/chat\/)/,
    turns: ['div[data-testid="user-message"]', 'div[data-testid="assistant-message"]', 'div[data-testid="grok-message"]', 'div.message-row', 'div[class*="chat-message"]', 'div[class*="message-bubble"]', 'div[data-testid*="message-"]'],
    user: ['[data-testid="user-message"]', 'div[class*="user-message"]', 'div[class*="user-bubble"]', '[data-is-user="true"]'],
    assistant: ['[data-testid="assistant-message"]', '[data-testid="grok-message"]', 'div[class*="grok-message"]', 'div[class*="grok-bubble"]', 'div[class*="assistant-message"]'],
    markdown: 'div.message-content, div[class*="message-content"], div[class*="markdown"], div.prose',
    reasoning: ['div[class*="deepsearch-container"]', 'div[class*="thinking-steps"]', 'div[class*="thought"]', 'div[class*="thinking"]', '[data-testid*="reasoning"]'],
    noise: ['button', '[data-testid*="action"]', '[data-testid*="feedback"]', '[aria-label*="copy" i]', '[aria-label*="like" i]', '[aria-label*="dislike" i]', '[aria-label*="retry" i]'],
    streaming: ['button[data-testid="stop-button"]', 'button[aria-label*="Stop" i]', 'span[class*="cursor-blink"]', 'div[class*="streaming"]'],
    id: /\/(?:c|share|chat)\/([a-zA-Z0-9_-]+)/
  },
  {
    platform: 'Gemini',
    hosts: ['gemini.google.com'],
    turns: ['user-query', 'model-response', '[data-testid*="user-query"]', '[data-testid*="model-response"]', '[data-test-id*="user-query"]', '[data-test-id*="model-response"]', 'div.user-query-container', 'div.model-response-container', 'div[class*="user-query"]', 'div[class*="model-response"]', 'div[class*="turn-container"]', 'div[class*="conversation-turn"]'],
    user: ['user-query', '[data-testid*="user-query"]', '[data-test-id*="user-query"]', 'div.user-query-container', 'div[class*="user-query"]', '[data-is-user="true"]', '[data-role="user"]', 'div.query-content'],
    assistant: ['model-response', '[data-testid*="model-response"]', '[data-test-id*="model-response"]', 'div.model-response-container', 'div[class*="model-response"]', 'div[class*="response-container"]', '[data-role="assistant"]', 'message-content'],
    markdown: 'div.message-content, message-content, div.markdown, div[class*="markdown"], div[class*="model-response-text"], div[class*="response-content"]',
    reasoning: ['expandable-thought', 'div[class*="thought"]', 'div[class*="thinking"]', '[data-testid*="thought"]', '[data-testid*="reasoning"]', '[aria-label*="thought" i]'],
    noise: ['button', '[data-testid*="action"]', '[data-testid*="feedback"]', '[aria-label*="copy" i]', '[aria-label*="thumbs" i]', '[aria-label*="share" i]', 'div[class*="drafts-container"]', 'div[class*="action-buttons"]', 'div.response-footer', 'div[class*="citation"]'],
    streaming: ['button[aria-label*="Stop" i]', 'button[data-testid*="stop" i]', 'mat-progress-bar', 'div.sparkle-loading', 'div[class*="streaming"]', 'span.streaming-indicator', '[data-is-streaming="true"]'],
    id: /\/app\/([a-zA-Z0-9_-]+)/
  }
];

function getRule() {
  const host = location.hostname.toLowerCase();
  return RULES.find(rule => rule.hosts.some(domain => host === domain || host.endsWith('.' + domain)) && (!rule.path || rule.path.test(location.pathname)));
}

function isStreaming(rule) {
  return rule.streaming.some(selector => document.querySelector(selector));
}

function matchesAny(node, selectors) {
  return selectors.some(selector => node.matches(selector) || node.querySelector(selector));
}

function getRole(node, rule) {
  if (matchesAny(node, rule.user)) return 'USER';
  if (matchesAny(node, rule.assistant)) return 'ASSISTANT';
  return null;
}

function collectTurns(rule) {
  const unique = new Set();
  for (const selector of rule.turns) {
    document.querySelectorAll(selector).forEach(node => unique.add(node));
  }
  const turns = [...unique].filter(node => ![...unique].some(other => other !== node && other.contains(node)));
  // Selector collection is grouped by selector (all user nodes, then all assistant nodes).
  // Re-sort by their actual DOM position so a conversation remains USER -> ASSISTANT -> USER -> ASSISTANT.
  return turns.sort((a, b) => {
    const position = a.compareDocumentPosition(b);
    if (position & Node.DOCUMENT_POSITION_FOLLOWING) return -1;
    if (position & Node.DOCUMENT_POSITION_PRECEDING) return 1;
    return 0;
  });
}

function extractText(turn, rule) {
  const clone = turn.cloneNode(true);
  rule.reasoning.forEach(selector => clone.querySelectorAll(selector).forEach(node => node.remove()));
  rule.noise.forEach(selector => clone.querySelectorAll(selector).forEach(node => node.remove()));
  clone.querySelectorAll('[data-testid*="attachment"], [data-testid*="file"], [class*="attachment"], [class*="file-preview"]').forEach(node => node.remove());
  const root = rule.platform === 'Gemini'
    ? (getRole(turn, rule) === 'USER'
      ? (clone.querySelector('.query-content') || clone)
      : (clone.querySelector('message-content') || clone))
    : (clone.querySelector(rule.markdown) || clone);
  root.querySelectorAll('pre').forEach(pre => {
    const code = pre.querySelector('code') || pre;
    const language = code.getAttribute('class')?.match(/language-([a-z0-9_-]+)/i)?.[1] || '';
    const text = (code.textContent || '').trim();
    pre.replaceWith(document.createTextNode(`\n\`\`\`${language}\n${text}\n\`\`\`\n`));
  });
  serializePortableTables(root);
  let text = (rule.platform === 'Gemini' || ['Perplexity', 'DeepSeek', 'Grok'].includes(rule.platform)
    ? serializeStructuredBlocks(root)
    : (root.textContent || '')).replace(/\n{3,}/g, '\n\n').trim();
  if (rule.platform === 'Gemini') text = cleanGeminiText(text, getRole(turn, rule));
  if (rule.platform === 'Claude') text = cleanClaudeText(text);
  return text;
}

function serializePortableTables(root) {
  // Drive stores conversations as plain text, so use a wrapped ASCII table rather than raw Markdown pipes.
  serializeClaudeTables(root);
}

function normalizeAsciiTables(text) {
  const lines = String(text || '').split(/\r?\n/);
  const isBorder = line => /^\s*\+(?:[-+]+\+)+\s*$/.test(line);
  const isRow = line => /^\s*\|/.test(line) && line.includes('|');
  const parseRow = line => line.trim().split('|').slice(1, -1).map(cell => cell.trim());
  const wrap = (value, width) => {
    const words = String(value || '').split(/\s+/).filter(Boolean);
    if (!words.length) return [''];
    const result = [];
    let current = '';
    for (let word of words) {
      while (word.length > width) {
        if (current) { result.push(current); current = ''; }
        result.push(word.slice(0, width));
        word = word.slice(width);
      }
      if (!word) continue;
      if (!current) current = word;
      else if ((current + ' ' + word).length <= width) current += ' ' + word;
      else { result.push(current); current = word; }
    }
    if (current) result.push(current);
    return result.length ? result : [''];
  };
  const renderGroup = (rows, widths) => {
    const merged = [];
    for (let column = 0; column < widths.length; column++) {
      merged.push(rows.map(row => row[column] || '').filter(Boolean).join(' '));
    }
    const wrapped = merged.map((value, column) => wrap(value, widths[column]));
    const height = Math.max(...wrapped.map(cell => cell.length));
    return Array.from({ length: height }, (_, lineIndex) =>
      '| ' + wrapped.map((cell, column) => (cell[lineIndex] || '').padEnd(widths[column], ' ')).join(' | ') + ' |'
    );
  };

  const output = [];
  let i = 0;
  while (i < lines.length) {
    if (!isBorder(lines[i]) || i + 1 >= lines.length || !isRow(lines[i + 1])) {
      output.push(lines[i++]);
      continue;
    }
    const table = [];
    while (i < lines.length && (isBorder(lines[i]) || isRow(lines[i]))) table.push(lines[i++]);
    const firstBorder = table.find(isBorder);
    const widths = firstBorder.split('+').slice(1, -1).map(part => Math.max(1, part.length - 2));
    let group = [];
    for (const line of table) {
      if (isBorder(line)) {
        if (group.length) {
          output.push(...renderGroup(group, widths));
          group = [];
        }
        output.push(line);
      } else {
        group.push(parseRow(line));
      }
    }
    if (group.length) output.push(...renderGroup(group, widths));
  }
  return output.join('\n');
}

function serializeStructuredBlocks(root) {
  const blocks = [];
  const visit = node => {
    if (node.nodeType === Node.TEXT_NODE) {
      const value = node.textContent.replace(/[ \t]+/g, ' ').trim();
      if (value) blocks.push(value);
      return;
    }
    if (node.nodeType !== Node.ELEMENT_NODE) return;
    const tag = node.tagName;
    if (tag === 'PRE') {
      const code = normalizeAsciiTables(node.textContent.trim());
      if (code) blocks.push('```\n' + code + '\n```');
      return;
    }
    if (tag === 'LI') {
      const value = node.textContent.replace(/\s+/g, ' ').trim();
      if (value) blocks.push('- ' + value);
      return;
    }
    if (['P','H1','H2','H3','H4','H5','H6','BLOCKQUOTE'].includes(tag)) {
      const value = node.textContent.replace(/\s+/g, ' ').trim();
      if (value) blocks.push(value);
      return;
    }
    for (const child of node.childNodes || []) visit(child);
  };
  visit(root);
  return normalizeAsciiTables(blocks.join('\n\n').replace(/\n{3,}/g, '\n\n').trim() || (root.innerText || root.textContent || ''));
}

function serializeChatGPTTables(root) {
  root.querySelectorAll('table').forEach(table => {
    const rows = [...table.querySelectorAll('tr')].map(row =>
      [...row.querySelectorAll(':scope > th, :scope > td')]
        .map(cell => (cell.textContent || '').replace(/\s+/g, ' ').trim())
    ).filter(row => row.length && row.some(Boolean));
    if (!rows.length) return;

    const columnCount = Math.max(...rows.map(row => row.length));
    const normalized = rows.map(row => Array.from(
      { length: columnCount }, (_, index) => row[index] || ''
    ));
    const naturalWidths = Array.from({ length: columnCount }, (_, column) =>
      Math.max(3, ...normalized.map(row => row[column].length))
    );
    const defaultCaps = columnCount === 4 ? [12, 28, 18, 34] :
      columnCount === 3 ? [18, 34, 20] :
      Array.from({ length: columnCount }, () => 24);
    const widths = naturalWidths.map((width, index) => Math.min(width, defaultCaps[index] || 24));
    const wrapCell = (value, width) => {
      const words = String(value || '').split(/\s+/).filter(Boolean);
      if (!words.length) return [''];
      const lines = [];
      let line = '';
      words.forEach(word => {
        while (word.length > width) {
          if (line) { lines.push(line); line = ''; }
          lines.push(word.slice(0, width));
          word = word.slice(width);
        }
        if (!word) return;
        if (!line) line = word;
        else if ((line + ' ' + word).length <= width) line += ' ' + word;
        else { lines.push(line); line = word; }
      });
      if (line) lines.push(line);
      return lines.length ? lines : [''];
    };
    const border = '+' + widths.map(width => '-'.repeat(width + 2)).join('+') + '+';
    const output = [border];
    normalized.forEach(row => {
      const cells = row.map((cell, index) => wrapCell(cell, widths[index]));
      const height = Math.max(...cells.map(cell => cell.length));
      for (let lineIndex = 0; lineIndex < height; lineIndex++) {
        output.push('| ' + cells.map((cell, index) =>
          (cell[lineIndex] || '').padEnd(widths[index], ' ')
        ).join(' | ') + ' |');
      }
      output.push(border);
    });
    table.replaceWith(document.createTextNode(`\n${output.join('\n')}\n`));
  });
}


function serializeClaudeTables(root) {
  root.querySelectorAll('table').forEach(table => {
    const rows = [...table.querySelectorAll('tr')].map(row =>
      [...row.querySelectorAll(':scope > th, :scope > td')]
        .map(cell => (cell.textContent || '').replace(/\s+/g, ' ').trim())
    ).filter(row => row.length && row.some(Boolean));
    if (!rows.length) return;

    const columnCount = Math.max(...rows.map(row => row.length));
    const normalized = rows.map(row => Array.from(
      { length: columnCount }, (_, index) => row[index] || ''
    ));
    const naturalWidths = Array.from({ length: columnCount }, (_, column) =>
      Math.max(3, ...normalized.map(row => row[column].length))
    );
    const defaultCaps = columnCount === 4 ? [12, 28, 18, 34] :
      columnCount === 3 ? [18, 34, 20] :
      Array.from({ length: columnCount }, () => 24);
    const widths = naturalWidths.map((width, index) => Math.min(width, defaultCaps[index] || 24));
    const wrapCell = (value, width) => {
      const words = String(value || '').split(/\s+/).filter(Boolean);
      if (!words.length) return [''];
      const lines = [];
      let line = '';
      words.forEach(word => {
        while (word.length > width) {
          if (line) { lines.push(line); line = ''; }
          lines.push(word.slice(0, width));
          word = word.slice(width);
        }
        if (!word) return;
        if (!line) line = word;
        else if ((line + ' ' + word).length <= width) line += ' ' + word;
        else { lines.push(line); line = word; }
      });
      if (line) lines.push(line);
      return lines.length ? lines : [''];
    };
    const border = '+' + widths.map(width => '-'.repeat(width + 2)).join('+') + '+';
    const output = [border];
    normalized.forEach(row => {
      const cells = row.map((cell, index) => wrapCell(cell, widths[index]));
      const height = Math.max(...cells.map(cell => cell.length));
      for (let lineIndex = 0; lineIndex < height; lineIndex++) {
        output.push('| ' + cells.map((cell, index) =>
          (cell[lineIndex] || '').padEnd(widths[index], ' ')
        ).join(' | ') + ' |');
      }
      output.push(border);
    });
    table.replaceWith(document.createTextNode(`\n${output.join('\n')}\n`));
  });
}

function serializeGeminiBlocks(root) {
  const clone = root.cloneNode(true);
  clone.querySelectorAll('button, [aria-label*="source" i], [aria-label*="citation" i], [class*="citation" i], [class*="source" i], [class*="action" i], [class*="footer" i], sources-carousel-inline, source-inline-chip, source-footnote, .screen-reader-user-query-label, .screen-reader-model-response-label').forEach(node => node.remove());
  const blocks = [];
  const blockTags = new Set(['P', 'H1', 'H2', 'H3', 'H4', 'H5', 'H6', 'LI', 'PRE', 'BLOCKQUOTE']);
  const visit = node => {
    if (node.nodeType === Node.TEXT_NODE) {
      const value = node.textContent.replace(/[ \t]+/g, ' ').replace(/\n{3,}/g, '\n\n').trim();
      if (value) blocks.push(value);
      return;
    }
    if (node.nodeType === Node.ELEMENT_NODE && blockTags.has(node.tagName)) {
      let value = node.tagName === 'PRE' ? '\\n```\\n' + node.textContent.trim() + '\\n```\\n' : node.textContent;
      value = value.replace(/\\s+/g, ' ').trim();
      if (value) blocks.push(node.tagName === 'LI' ? '- ' + value : value);
      return;
    }
    for (const child of node.childNodes || []) visit(child);
  };
  visit(clone);
  return blocks.length ? blocks.join('\\n\\n') : (clone.innerText || clone.textContent || '');
}

function cleanGeminiText(value, role) {
  let text = String(value || '').replace(/\\n/g, '\n').replace(/\r\n/g, '\n').trim();
  if (role === 'USER') text = text.replace(/^You said\s*:?[ \t]*/i, '').trim();
  const normalized = text.replace(/\s+/g, ' ').trim();
  if (normalized.length > 20 && normalized.length % 2 === 0) {
    const midpoint = normalized.length / 2;
    const left = normalized.slice(0, midpoint).trim();
    const right = normalized.slice(midpoint).trim();
    if (left === right) text = left;
  }
  text = text.replace(/[ \t]{2,}/g, ' ').replace(/\n{3,}/g, '\n\n').trim();
  return normalizeClaudeAsciiTables(text, [6, 24, 18, 16]);
}

function cleanClaudeText(value) {
  let text = String(value || '')
    .replace(/\bSearched\s+the\s+web\b/gi, '')
    .replace(/\b(?:Updated\s+memory|Finding|Figuring|Loading)\b/gi, '')
    .replace(/Thought\s+for\s+\d+\s*(?:s|m)(?:\s+\d+\s*(?:s|m))*/gi, '')
    .replace(/\bV?visualize\b/gi, '')
    .replace(/\bshow_widget\b/gi, '')
    .replace(/[ \t]{2,}/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .replace(/\s+([,.!?])/g, '$1')
    .trim();
  return normalizeClaudeAsciiTables(text);
}

function normalizeClaudeAsciiTables(value, preferredCaps) {
  const lines = String(value || '').split('\n');
  const output = [];
  let index = 0;
  while (index < lines.length) {
    const current = lines[index].trim();
    const next = lines[index + 1]?.trim() || '';
    if (!/^\+[-+]+\+$/.test(current) || !next.startsWith('|')) {
      output.push(lines[index]);
      index++;
      continue;
    }
    const block = [];
    let cursor = index;
    while (cursor < lines.length && (/^\+[-+]+\+$/.test(lines[cursor].trim()) || lines[cursor].trim().startsWith('|'))) {
      block.push(lines[cursor].trim());
      cursor++;
    }
    const parsed = block.filter(line => line.startsWith('|')).map(line =>
      line.slice(1, line.endsWith('|') ? -1 : undefined).split('|').map(cell => cell.trim())
    );
    if (parsed.length < 2) {
      output.push(...block);
      index = cursor;
      continue;
    }
    const columnCount = Math.max(...parsed.map(row => row.length));
    const logicalRows = [];
    parsed.forEach(row => {
      const normalized = Array.from({ length: columnCount }, (_, col) => row[col] || '');
      if (logicalRows.length && (normalized[0] === '' || (normalized[1] === '' && columnCount > 1))) {
        const previous = logicalRows[logicalRows.length - 1];
        normalized.forEach((cell, col) => { if (cell) previous[col] = previous[col] ? `${previous[col]} ${cell}` : cell; });
      } else {
        logicalRows.push(normalized);
      }
    });
    const naturalWidths = Array.from({ length: columnCount }, (_, col) => Math.max(3, ...logicalRows.map(row => row[col].length)));
    const firstColumnIsNumeric = logicalRows.slice(1).every(row => !row[0] || /^[#\d.]+$/.test(row[0]));
    const caps = preferredCaps && preferredCaps.length === columnCount
      ? preferredCaps.slice()
      : Array.from({ length: columnCount }, () => 24);
    if (!firstColumnIsNumeric) caps[0] = Math.max(caps[0] || 18, Math.min(naturalWidths[0], 24));
    const widths = naturalWidths.map((width, col) => Math.min(caps[col] || 24, width));
    const wrap = (value, width) => {
      const words = String(value || '').split(/\s+/).filter(Boolean);
      const result = []; let line = '';
      words.forEach(word => {
        while (word.length > width) { if (line) { result.push(line); line = ''; } result.push(word.slice(0, width)); word = word.slice(width); }
        if (!word) return;
        if (!line) line = word; else if ((line + ' ' + word).length <= width) line += ' ' + word; else { result.push(line); line = word; }
      });
      if (line) result.push(line);
      return result.length ? result : [''];
    };
    const border = '+' + widths.map(width => '-'.repeat(width + 2)).join('+') + '+';
    const rendered = [border];
    logicalRows.forEach(row => {
      const cells = row.map((cell, col) => wrap(cell, widths[col]));
      const height = Math.max(...cells.map(cell => cell.length));
      for (let lineNo = 0; lineNo < height; lineNo++) rendered.push('| ' + cells.map((cell, col) => (cell[lineNo] || '').padEnd(widths[col], ' ')).join(' | ') + ' |');
      rendered.push(border);
    });
    output.push(...rendered);
    index = cursor;
  }
  return output.join('\n');
}

function extractAttachments(turn) {
  return [...turn.querySelectorAll('[data-testid*="attachment"], [data-testid*="file"], [class*="attachment"], [class*="file-preview"]')].map(item => {
    const name = (item.querySelector('[data-testid*="file-name"], [class*="file-name"], span[class*="name"], span[class*="truncate"]')?.textContent || item.getAttribute('aria-label') || '').trim();
    if (!name) return null;
    const sizeText = item.querySelector('[data-testid*="file-size"], [class*="file-size"], span[class*="size"]')?.textContent || '';
    const match = sizeText.match(/([\d.]+)\s*(bytes|B|KB|MB|GB)/i);
    const value = match ? Number.parseFloat(match[1]) : NaN;
    const unit = match?.[2]?.toUpperCase();
    const byteSize = Number.isFinite(value) ? Math.floor(value * (unit === 'GB' ? 1024 ** 3 : unit === 'MB' ? 1024 ** 2 : unit === 'KB' ? 1024 : 1)) : undefined;
    return { fileName: name, byteSize };
  }).filter(Boolean);
}

function extractTitle() {
  const rule = getRule();
  const generic = /^(new chat|new search|chatgpt|claude|perplexity|deepseek|grok|gemini|flash|bard|conversation with gemini|untitled conversation|open menu for conversation actions\.?|show more options|skip to content)$/i;
  if (rule?.platform === 'ChatGPT') {
    const currentPath = location.pathname.replace(/\/$/, '');
    const currentLink = [...document.querySelectorAll('a[href]')].find(link => {
      try { return new URL(link.href, location.origin).pathname.replace(/\/$/, '') === currentPath; }
      catch (_) { return false; }
    });
    const linkedTitle = (currentLink?.getAttribute('aria-label') || currentLink?.textContent || '').replace(/\s+/g, ' ').trim();
    if (linkedTitle && !generic.test(linkedTitle) && linkedTitle.length < 180) return linkedTitle;
  }
  if (rule?.platform === 'ChatGPT') {
    // ChatGPT response content can contain H1 headings. Prefer the browser title so an answer
    // heading such as ?Deep Research?? cannot replace the actual renamed conversation title.
    const currentTitle = (document.title || '').replace(/\s*[-|]\s*ChatGPT\s*$/i, '').trim();
    if (currentTitle && !generic.test(currentTitle) && currentTitle.length < 180) return currentTitle;
  }
  if (rule?.platform === 'ChatGPT') {
    // Never fall through to generic h1/navigation text on ChatGPT: accessibility labels such as
    // "Skip to content" are page chrome, not conversation names.
    return 'Untitled Conversation';
  }
  if (rule?.platform === 'Perplexity') {
    const currentPath = location.pathname.replace(/\/$/, '');
    const currentSession = [...document.querySelectorAll('a[href]')].find(link => {
      try { return new URL(link.href, location.origin).pathname.replace(/\/$/, '') === currentPath; }
      catch (_) { return false; }
    });
    const sessionTitle = (currentSession?.getAttribute('aria-label') || currentSession?.textContent || '').replace(/\s+/g, ' ').trim();
    if (sessionTitle && !generic.test(sessionTitle) && sessionTitle.length < 180) return sessionTitle;
    const pageTitle = (document.title || '').replace(/\s*[-|]\s*Perplexity\s*$/i, '').trim();
    if (pageTitle && !generic.test(pageTitle) && pageTitle.length < 180) return pageTitle;
    return 'Untitled Conversation';
  }
  if (rule?.platform === 'Gemini') {
    const currentTitle = (document.title || '').replace(/\s*[-|]\s*(Google Gemini|Gemini)\s*$/i, '').trim();
    if (currentTitle && !generic.test(currentTitle) && currentTitle.length < 180) return currentTitle;
  }
  const selectors = rule?.platform === 'Gemini'
    ? [
        'nav a[aria-current="page"]',
        'nav a[class*="active" i]',
        '[data-testid*="conversation-title" i]',
        '[data-testid*="thread-title" i]',
        '[aria-label*="conversation" i]',
        '[aria-label*="chat title" i]',
        '[class*="conversation-title" i]',
        '[class*="chat-title" i]',
        'main h1',
        'main [role="heading"]',
        'h1'
      ]
    : ['nav a[class*="active"]', 'nav a[aria-current="page"]', '[data-testid*="thread-title"]', '[class*="conversation-title"]', '[class*="chat-title"]', 'h1'];
  for (const selector of selectors) {
    for (const element of document.querySelectorAll(selector)) {
      const value = (element.textContent || element.getAttribute('aria-label') || '').replace(/\s+/g, ' ').trim();
      if (value && !generic.test(value) && value.length < 180) return value;
    }
  }
  const fromDocument = (document.title || '').replace(/\s*[-|]\s*(Google Gemini|ChatGPT|Claude|Perplexity|DeepSeek|Grok|Gemini)\s*$/i, '').trim();
  return fromDocument && !generic.test(fromDocument) ? fromDocument : 'Untitled Conversation';
}

async function diagnostic(value) { try { await chrome.storage.local.set({ buddyLastCapture: { ...value, at: new Date().toISOString(), url: location.href } }); } catch (_) {} }

function capture() {
  const rule = getRule();
  if (!rule) { diagnostic({ stage: 'no_platform_rule' }); return; }
  if (isStreaming(rule)) {
    if (!retryScheduled) {
      retryScheduled = true;
      diagnostic({ stage: 'waiting_for_response', platform: rule.platform });
      setTimeout(() => { retryScheduled = false; capture(); }, 2500);
    }
    return;
  }
  const turns = collectTurns(rule);
  if (!turns.length) { diagnostic({ stage: 'no_turns', platform: rule.platform }); return; }
  const messages = turns.map((turn, index) => {
    const role = getRole(turn, rule);
    if (!role) return null;
    const content = extractText(turn, rule);
    const attachments = extractAttachments(turn);
    if (!content && !attachments.length) return null;
    return { sequence: index + 1, role, content, attachments: attachments.length ? attachments : undefined };
  }).filter(Boolean);
  const cleanedMessages = [];
  for (const message of messages) {
    const previous = cleanedMessages[cleanedMessages.length - 1];
    const sameAssistant = previous && message.role === 'ASSISTANT' && previous.role === 'ASSISTANT' && message.content.trim().toLowerCase() === previous.content.trim().toLowerCase();
    if (!sameAssistant) cleanedMessages.push(message);
  }
  const finalMessages = cleanedMessages.map((message, index) => ({ ...message, sequence: index + 1 }));
  if (!finalMessages.length) { diagnostic({ stage: 'no_messages', platform: rule.platform, turns: turns.length }); return; }
  const externalConversationId = location.pathname.match(rule.id)?.[1] || location.pathname;
  const conversation = { platform: rule.platform, externalConversationId, sourceUrl: location.href, title: extractTitle(), messages: finalMessages, capturedAt: new Date().toISOString() };
  const key = rule.platform + ':' + location.pathname;
  const fingerprint = JSON.stringify({ title: conversation.title, messages: finalMessages });
  if (seen.get(key) === fingerprint) return;
  seen.set(key, fingerprint);
  diagnostic({ stage: 'capture_sent_to_background', platform: rule.platform, messages: finalMessages.length, title: conversation.title });
  try {
    const delivery = chrome.runtime.sendMessage({ type: 'CONVERSATION_CAPTURED', conversation });
    if (delivery && typeof delivery.then === 'function') delivery.then(result => diagnostic({ stage: result?.pending ? 'queued_pending' : 'sync_response', platform: rule.platform, messages: finalMessages.length, result })).catch(error => diagnostic({ stage: 'background_error', error: String(error) }));
  } catch (error) { diagnostic({ stage: 'background_error', error: String(error) }); }
}

let captureTimer;
function scheduleCapture() {
  clearTimeout(captureTimer);
  captureTimer = setTimeout(capture, 3500);
}
new MutationObserver(scheduleCapture).observe(document.documentElement, { subtree: true, childList: true, characterData: true });
diagnostic({ stage: 'content_loaded', platform: getRule()?.platform || 'unknown' });
scheduleCapture();


