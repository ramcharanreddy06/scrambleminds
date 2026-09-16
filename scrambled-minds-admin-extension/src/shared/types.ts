export type PlatformSlug = 'chatgpt' | 'claude' | 'gemini' | 'grok' | 'deepseek' | 'perplexity';
export type MessageRole = 'user' | 'assistant' | 'system' | 'tool';
export type QueueStatus = 'queued' | 'uploading' | 'synced' | 'failed' | 'blocked';
export interface NormalizedMessage { sequence: number; role: MessageRole; content: string; model?: string; }
export interface NormalizedConversation { localCaptureId: string; platform: PlatformSlug; externalConversationId: string; title: string; sourceUrl: string; capturedAt: string; messages: NormalizedMessage[]; }
export interface QueueItem { id: string; localCaptureId: string; conversation: NormalizedConversation; status: QueueStatus; retryCount: number; syncEventId: string; baseVersion: number; nextAttemptAt: number; lastError?: string; createdAt: number; updatedAt: number; }
export interface SyncResponse { conversation_id: string; server_sync_version: number; sync_event_id: string; }
export interface BackendError { code: string; message: string; details?: unknown; }
