/**
 * Mock LiteLLM API for the dev harness. Provides realistic, deterministic data
 * so the frontend can be tested and screenshotted without a live backend.
 */
import type { LiteLlmApiInterface } from '@acarmisc/backstage-plugin-litellm';
import type {
  UserInfo,
  VirtualKey,
  ModelInfo,
  TeamInfo,
  GenerateKeyRequest,
  GenerateKeyResponse,
  UpdateKeyRequest,
} from '@acarmisc/backstage-plugin-litellm';

const now = Date.now();
const day = 24 * 60 * 60 * 1000;
const iso = (offsetDays: number) => new Date(now - offsetDays * day).toISOString();

const ME = 'jane.doe@example.com';

const models: ModelInfo[] = [
  {
    model_name: 'gpt-4o',
    mode: 'chat',
    supports_function_calling: true,
    supports_vision: true,
    input_cost_per_token: 0.0000025,
    output_cost_per_token: 0.00001,
    max_input_tokens: 128000,
    max_output_tokens: 16384,
  },
  {
    model_name: 'gpt-4o-mini',
    mode: 'chat',
    supports_function_calling: true,
    supports_vision: true,
    input_cost_per_token: 0.00000015,
    output_cost_per_token: 0.0000006,
    max_input_tokens: 128000,
    max_output_tokens: 16384,
  },
  {
    model_name: 'claude-sonnet-4',
    mode: 'chat',
    supports_function_calling: true,
    supports_vision: true,
    input_cost_per_token: 0.000003,
    output_cost_per_token: 0.000015,
    max_input_tokens: 200000,
    max_output_tokens: 64000,
  },
  {
    model_name: 'claude-haiku-3-5',
    mode: 'chat',
    supports_function_calling: true,
    supports_vision: true,
    input_cost_per_token: 0.0000008,
    output_cost_per_token: 0.000004,
    max_input_tokens: 200000,
    max_output_tokens: 8192,
  },
  {
    model_name: 'gemini-2.5-pro',
    mode: 'chat',
    supports_function_calling: true,
    supports_vision: true,
    input_cost_per_token: 0.0000075,
    output_cost_per_token: 0.00003,
    max_input_tokens: 1000000,
    max_output_tokens: 8192,
  },
  {
    model_name: 'llama-3.1-70b',
    mode: 'chat',
    supports_function_calling: false,
    supports_vision: false,
    input_cost_per_token: 0.00000072,
    output_cost_per_token: 0.00000072,
    max_input_tokens: 128000,
    max_output_tokens: 4096,
  },
];

const teams: TeamInfo[] = [
  {
    team_id: 'platform-eng',
    team_alias: 'Platform Engineering',
    max_budget: 1000,
    budget_duration: '30d',
    spend: 612.48,
    tpm_limit: 500000,
    rpm_limit: 5000,
    models: ['gpt-4o', 'gpt-4o-mini', 'claude-sonnet-4', 'claude-haiku-3-5'],
    members_with_roles: [
      { user_id: 'jane.doe@example.com', user_email: 'jane.doe@example.com', role: 'admin' },
      { user_id: 'john.smith@example.com', user_email: 'john.smith@example.com', role: 'user' },
      { user_id: 'alice.nguyen@example.com', user_email: 'alice.nguyen@example.com', role: 'user' },
    ],
    metadata: { owning_group: 'group:default/platform-eng-admins', updated_at_iso: iso(5) },
    object_permission: { vector_stores: ['vs-engineering-handbook', 'vs-platform-runbooks'] },
  },
  {
    team_id: 'data-science',
    team_alias: 'Data Science',
    max_budget: 500,
    budget_duration: '30d',
    spend: 431.9,
    tpm_limit: 300000,
    rpm_limit: 3000,
    models: ['gpt-4o', 'gpt-4o-mini', 'claude-sonnet-4'],
    members_with_roles: [
      { user_id: 'raj.patel@example.com', user_email: 'raj.patel@example.com', role: 'admin' },
      { user_id: 'jane.doe@example.com', user_email: 'jane.doe@example.com', role: 'user' },
      { user_id: 'lena.fischer@example.com', user_email: 'lena.fischer@example.com', role: 'user' },
    ],
    metadata: { owning_group: 'group:default/data-science-admins', updated_at_iso: iso(11) },
    object_permission: { vector_stores: ['vs-product-docs'] },
  },
];

export class MockLiteLlmApi implements LiteLlmApiInterface {
  async getUserInfo(): Promise<UserInfo> {
    return {
      user_id: ME,
      user_email: ME,
      teams: teams.map(t => t.team_id),
      models: [],
      max_budget: 150,
      spend: 62.3,
      budget_duration: '30d',
      budget_reset_at: iso(-17),
      can_view_audit: true,
    };
  }

  async listKeys(): Promise<VirtualKey[]> {
    return [];
  }

  async generateKey(request: GenerateKeyRequest): Promise<GenerateKeyResponse> {
    return {
      key: `sk-litellm-${Math.random().toString(36).slice(2, 20)}`,
      key_alias: request.alias,
      expires_at: iso(-3),
      max_budget: request.max_budget ?? 5,
      models: request.models ?? [],
    };
  }

  async updateKey(_keyId: string, request: UpdateKeyRequest): Promise<VirtualKey> {
    return {
      key: 'sk-mock-...',
      key_alias: request.key_alias ?? 'mock-key',
      user_id: ME,
      team_id: 'platform-eng',
    };
  }

  async deleteKey(_keyId: string) {
    return { success: true };
  }

  async blockKey(_keyId: string) {}
  async unblockKey(_keyId: string) {}
  async resetKeySpend(_keyId: string) {}
  async pruneExpiredKeys() {
    return { pruned: 0, failed: 0 };
  }

  async listModels(): Promise<ModelInfo[]> {
    return models;
  }

  async getTeams(): Promise<TeamInfo[]> {
    return teams;
  }

  async getManagedTeams(): Promise<TeamInfo[]> {
    return teams;
  }

  async addTeamMember(teamId: string, body: { userEntityRef: string }): Promise<TeamInfo> {
    const team = teams.find(t => t.team_id === teamId) ?? teams[0];
    const name = body.userEntityRef.split('/').pop()!;
    return {
      ...team,
      members_with_roles: [
        ...(team.members_with_roles ?? []),
        { user_id: `${name}@example.com`, user_email: `${name}@example.com`, role: 'user' },
      ],
    };
  }

  async removeTeamMember(teamId: string, userEntityRef: string): Promise<TeamInfo> {
    const team = teams.find(t => t.team_id === teamId) ?? teams[0];
    const id = `${userEntityRef.split('/').pop()}@example.com`;
    return {
      ...team,
      members_with_roles: (team.members_with_roles ?? []).filter(m => m.user_id !== id),
    };
  }

  async getVectorStores(): Promise<any[]> {
    return [];
  }

  async setTeamKnowledgeBases(teamId: string, vectorStores: string[]): Promise<TeamInfo> {
    const team = teams.find(t => t.team_id === teamId) ?? teams[0];
    return { ...team, object_permission: { ...team.object_permission, vector_stores: vectorStores } };
  }

  async getMcpServers(): Promise<any[]> {
    return [];
  }

  async setTeamMcpServers(teamId: string, mcpServers: string[]): Promise<TeamInfo> {
    const team = teams.find(t => t.team_id === teamId) ?? teams[0];
    return { ...team, object_permission: { ...team.object_permission, mcp_servers: mcpServers } };
  }

  async getUsage(_startDate: string, _endDate: string): Promise<any> {
    return { total_spend: 0, usage_by_model: {}, daily_usage: [] };
  }

  async getTeamUsage(_teamId: string, _startDate: string, _endDate: string): Promise<any> {
    return { total_spend: 0, usage_by_model: {}, daily_usage: [] };
  }

  async getAuditLogs(_params: any): Promise<any> {
    return { audit_logs: [], total: 0, page: 1, page_size: 25, total_pages: 1 };
  }

  async getConfig(): Promise<any> {
    return {
      baseUrl: 'https://llm.example.com',
      keyGeneration: { teamRequired: true },
    };
  }

  async createTeam(request: any): Promise<any> {
    return { team_id: request.team_alias.toLowerCase().replace(/\s+/g, '-'), team_alias: request.team_alias };
  }

  async updateTeam(teamId: string, request: any): Promise<TeamInfo> {
    const team = teams.find(t => t.team_id === teamId) ?? teams[0];
    return { ...team, ...request, max_budget: request.max_budget ?? team.max_budget };
  }
}
