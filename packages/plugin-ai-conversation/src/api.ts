import { createApiRef, FetchApi } from '@backstage/core-plugin-api';
import type {
  VectorStore,
  Skill,
  ChatRequest,
  ChatFeedbackRequest,
  ChatResult,
  ChatConfig,
  ChatTraits,
  KeySpend,
  UrlContextPreview,
  FeedbackSummary,
  UsageSummaryRow,
  PersistedThread,
  Thread,
} from './types';
import { toSaveThreadBody } from './hooks/threadPersistence';

export interface AiConversationApiInterface {
  listVectorStores(): Promise<VectorStore[]>;
  listSkills(): Promise<Skill[]>;
  getChatConfig(): Promise<ChatConfig>;
  getChatTraits(): Promise<ChatTraits>;
  fetchUrlContext(url: string): Promise<UrlContextPreview>;
  getFeedbackSummary(filters?: { skillId?: string; model?: string }): Promise<FeedbackSummary>;
  getUsageSummary(groupBy: 'skill' | 'model', range?: string): Promise<UsageSummaryRow[]>;
  chatCompletions(req: ChatRequest): Promise<ChatResult>;
  mintChatKey(opts?: { models?: string[]; max_budget?: number }): Promise<ChatKey>;
  deleteChatKey(key: string): Promise<{ success: boolean }>;
  getKeySpend(alias: string): Promise<KeySpend | null>;
  sendFeedback(req: ChatFeedbackRequest): Promise<{ success: boolean }>;
  listThreads(): Promise<PersistedThread[]>;
  saveThread(thread: Thread): Promise<void>;
  deleteThread(id: string): Promise<void>;
}

export interface ChatKey {
  key: string;
  key_alias: string;
  expires_at?: string;
  max_budget?: number;
}

export const aiConversationApiRef = createApiRef<AiConversationApiInterface>({
  id: 'plugin.ai-conversation.api',
});

const BASE_PATH = '/api/ai-conversation';

export class AiConversationApi implements AiConversationApiInterface {
  private fetchApi: FetchApi;

  constructor(fetchApi: FetchApi) {
    this.fetchApi = fetchApi;
  }

  async listVectorStores(): Promise<VectorStore[]> {
    const res = await this.fetchApi.fetch(`${BASE_PATH}/vector_stores`);
    if (!res.ok) throw new Error(`vector_stores ${res.status}`);
    return res.json();
  }

  async listSkills(): Promise<Skill[]> {
    const res = await this.fetchApi.fetch(`${BASE_PATH}/skills`);
    if (!res.ok) throw new Error(`skills ${res.status}`);
    return res.json();
  }

  async getChatConfig(): Promise<ChatConfig> {
    const res = await this.fetchApi.fetch(`${BASE_PATH}/config`);
    if (!res.ok) {
      return {
        defaultModel: null,
        defaultVectorStoreIds: null,
        maxRequestBudget: null,
        persistence: { enabled: false, ttlDays: 30 },
      };
    }
    const data = await res.json();
    return {
      defaultModel: data.defaultModel ?? null,
      defaultVectorStoreIds: data.defaultVectorStoreIds ?? null,
      maxRequestBudget: data.maxRequestBudget ?? null,
      // The two plugins version independently — an older backend's /config
      // may predate the persistence flag. Fall back to off-by-default (the
      // backend's own default, see readChatConfig in router.ts) so ChatPage
      // never reads `config.persistence.enabled` off undefined.
      persistence: data.persistence ?? { enabled: false, ttlDays: 30 },
    };
  }

  async getChatTraits(): Promise<ChatTraits> {
    const res = await this.fetchApi.fetch(`${BASE_PATH}/chat/traits`);
    if (!res.ok) throw new Error(`chat/traits ${res.status}`);
    return res.json();
  }

  async fetchUrlContext(url: string): Promise<UrlContextPreview> {
    const res = await this.fetchApi.fetch(`${BASE_PATH}/fetch-context`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url }),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      throw new Error(data.error ?? `fetch-context ${res.status}`);
    }
    return res.json();
  }

  async getFeedbackSummary(filters?: { skillId?: string; model?: string }): Promise<FeedbackSummary> {
    const params = new URLSearchParams();
    if (filters?.skillId) params.set('skillId', filters.skillId);
    if (filters?.model) params.set('model', filters.model);
    const qs = params.toString();
    const res = await this.fetchApi.fetch(`${BASE_PATH}/feedback/summary${qs ? `?${qs}` : ''}`);
    if (!res.ok) throw new Error(`feedback/summary ${res.status}`);
    return res.json();
  }

  async getUsageSummary(groupBy: 'skill' | 'model', range = '30d'): Promise<UsageSummaryRow[]> {
    const params = new URLSearchParams({ groupBy, range });
    const res = await this.fetchApi.fetch(`${BASE_PATH}/usage/summary?${params.toString()}`);
    if (!res.ok) throw new Error(`usage/summary ${res.status}`);
    return res.json();
  }

  async chatCompletions(req: ChatRequest): Promise<ChatResult> {
    const res = await this.fetchApi.fetch(`${BASE_PATH}/chat/completions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...req, stream: false }),
    });
    if (!res.ok) {
      const text = await res.text().catch(() => '');
      throw new Error(`${res.status}: ${text}`);
    }
    const data = await res.json();
    const content =
      data.choices?.[0]?.message?.content ?? data.content ?? '';
    const rawResults: any[] = data.search_results ?? data.citations ?? [];
    const citations = rawResults.map(r => ({
      filename: r.filename ?? r.file_name ?? r.source ?? r.name ?? '',
      score: typeof r.score === 'number' ? r.score : 0,
      snippet: r.text ?? r.snippet ?? r.content ?? '',
    }));
    return { content, citations };
  }

  async mintChatKey(opts?: { models?: string[]; max_budget?: number }): Promise<ChatKey> {
    const res = await this.fetchApi.fetch(`${BASE_PATH}/chat/key`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(opts ?? {}),
    });
    if (!res.ok) {
      const text = await res.text().catch(() => '');
      throw new Error(`mint key ${res.status}: ${text}`);
    }
    return res.json();
  }

  async deleteChatKey(key: string): Promise<{ success: boolean }> {
    const res = await this.fetchApi.fetch(`${BASE_PATH}/chat/key`, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ key }),
    });
    if (!res.ok) {
      const text = await res.text().catch(() => '');
      throw new Error(`delete key ${res.status}: ${text}`);
    }
    return res.json();
  }

  async getKeySpend(alias: string): Promise<KeySpend | null> {
    const res = await this.fetchApi.fetch(
      `${BASE_PATH}/chat/key/${encodeURIComponent(alias)}/spend`,
    );
    if (!res.ok) return null;
    return res.json();
  }

  async sendFeedback(req: ChatFeedbackRequest): Promise<{ success: boolean }> {
    const res = await this.fetchApi.fetch(`${BASE_PATH}/feedback`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(req),
    });
    if (!res.ok) {
      const text = await res.text().catch(() => '');
      throw new Error(`feedback ${res.status}: ${text}`);
    }
    return res.json();
  }

  async listThreads(): Promise<PersistedThread[]> {
    const res = await this.fetchApi.fetch(`${BASE_PATH}/threads`);
    if (!res.ok) throw new Error(`threads ${res.status}`);
    return res.json();
  }

  async saveThread(thread: Thread): Promise<void> {
    const res = await this.fetchApi.fetch(`${BASE_PATH}/threads/${encodeURIComponent(thread.id)}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(toSaveThreadBody(thread)),
    });
    if (!res.ok) {
      const text = await res.text().catch(() => '');
      throw new Error(`save thread ${res.status}: ${text}`);
    }
  }

  async deleteThread(id: string): Promise<void> {
    const res = await this.fetchApi.fetch(`${BASE_PATH}/threads/${encodeURIComponent(id)}`, {
      method: 'DELETE',
    });
    if (!res.ok) {
      const text = await res.text().catch(() => '');
      throw new Error(`delete thread ${res.status}: ${text}`);
    }
  }
}