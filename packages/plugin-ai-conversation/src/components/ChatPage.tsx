import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Box, Divider, IconButton, Tooltip, Typography } from '@mui/material';
import ChatIcon from '@mui/icons-material/Chat';
import ChevronLeftIcon from '@mui/icons-material/ChevronLeft';
import ChevronRightIcon from '@mui/icons-material/ChevronRight';
import { useApi, identityApiRef } from '@backstage/core-plugin-api';
import { liteLlmApiRef } from '@acarmisc/backstage-plugin-litellm';

import type { FileUIPart } from 'ai';
import { aiConversationApiRef } from '../api';
import { useThreads } from '../hooks/useThreads';
import { useResizablePanel } from '../hooks/useResizablePanel';
import { useUrlContext, URL_TOKEN_RE } from '../hooks/useUrlContext';
import { useStagedFiles } from '../hooks/useStagedFiles';
import { injectDesignSystemAssets } from '../theme';
import { ChatComposer } from './ChatComposer';
import { MessageList } from './MessageList';
import { ThreadSidebar } from './ThreadSidebar';
import { ErrorBanner } from './ErrorBanner';
import { SourcesPanel } from './SourcesPanel';
import { UsagePanel } from './UsagePanel';
import type {
  ChatConfig,
  ChatTeamInfo,
  ChatTraits,
  ReasoningEffort,
  Skill,
} from '../types';

const RIGHT_RAIL_WIDTH = 300;
const RIGHT_RAIL_MIN_WIDTH = 240;
const RIGHT_RAIL_MAX_WIDTH = 640;
const CHAT_MAX_WIDTH = 900;
// Re-mint a chat key this far ahead of its expiry rather than letting the
// send race the TTL and fail upstream.
const KEY_REMINT_SKEW_MS = 60_000;

const EMPTY_CONFIG: ChatConfig = {
  defaultModel: null,
  defaultVectorStoreIds: null,
  maxRequestBudget: null,
  excludedModels: null,
  persistence: { enabled: false, ttlDays: 30 },
  teamRequired: true,
};

const EMPTY_TRAITS: ChatTraits = { tones: [], focuses: [], verbosities: [] };

export const ChatPage: React.FC = () => {
  const chatApi = useApi(aiConversationApiRef);
  const liteLlmApi = useApi(liteLlmApiRef);
  const identityApi = useApi(identityApiRef);

  const [userId, setUserId] = useState('default');
  const [config, setConfig] = useState<ChatConfig>(EMPTY_CONFIG);

  const [model, setModel] = useState('');
  const [vectorStoreIds, setVectorStoreIds] = useState<string[]>([]);
  const [webSearch, setWebSearch] = useState(false);
  const [customSystemPrompt, setCustomSystemPrompt] = useState('');
  const [toneId, setToneId] = useState('');
  const [focusId, setFocusId] = useState('');
  const [verbosityId, setVerbosityId] = useState('');
  const [reasoningEffort, setReasoningEffort] = useState<ReasoningEffort | ''>('');
  const [keyVal, setKeyVal] = useState<{ alias: string; token: string; expiresAt?: number }>({
    alias: '',
    token: '',
  });
  const [skillId, setSkillId] = useState('');
  const [skills, setSkills] = useState<Skill[]>([]);
  const [teams, setTeams] = useState<ChatTeamInfo[]>([]);
  const [teamsLoading, setTeamsLoading] = useState(true);
  const [teamsError, setTeamsError] = useState<string | null>(null);
  const [teamId, setTeamId] = useState('');
  const [keyError, setKeyError] = useState<string | null>(null);
  const [input, setInput] = useState('');
  const [configError, setConfigError] = useState<string | null>(null);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [rightPanelCollapsed, setRightPanelCollapsed] = useState(false);
  const [importError, setImportError] = useState<string | null>(null);
  const [traits, setTraits] = useState<ChatTraits>(EMPTY_TRAITS);
  const [traitsLoading, setTraitsLoading] = useState(true);

  const rightPanel = useResizablePanel({
    storageKey: 'ai-conversation.rightPanelWidth',
    defaultWidth: RIGHT_RAIL_WIDTH,
    minWidth: RIGHT_RAIL_MIN_WIDTH,
    maxWidth: RIGHT_RAIL_MAX_WIDTH,
    side: 'left',
  });

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const attachInputRef = useRef<HTMLInputElement>(null);
  const pendingSendRef = useRef<{
    text: string;
    attachedUrl?: { url: string; title: string };
    files?: FileUIPart[];
  } | null>(null);

  const staged = useStagedFiles();
  const urlContext = useUrlContext(chatApi, input);

  useEffect(() => {
    injectDesignSystemAssets();
    chatApi
      .getChatConfig()
      .then(setConfig)
      .catch(err => setConfigError(err.message ?? 'Failed to reach the chat backend'));
    chatApi
      .getChatTraits()
      .then(t => {
        setTraits(t);
        // Pre-select the first option for each trait when empty.
        setToneId(prev => prev || t.tones[0]?.id || '');
        setFocusId(prev => prev || t.focuses[0]?.id || '');
        setVerbosityId(prev => prev || t.verbosities[0]?.id || '');
      })
      .catch(() => {})
      .finally(() => setTraitsLoading(false));
    chatApi
      .listSkills()
      .then(setSkills)
      .catch(() => {});
    // Teams come from govai's /api/litellm/teams, already scoped server-side
    // to the teams the caller is a member of (via getOrProvisionUser →
    // team memberships). No chat-backend route needed — same reuse as
    // liteLlmApi.listModels() in ModelPicker.
    liteLlmApi
      .getTeams()
      .then(setTeams)
      .catch(err => setTeamsError(err.message ?? 'Failed to load teams'))
      .finally(() => setTeamsLoading(false));
    identityApi
      .getCredentials()
      .then(c => setUserId(c.token ? 'oidc' : 'default'))
      .catch(() => {});
  }, [chatApi, identityApi, liteLlmApi]);

  const chat = useThreads({
    userId,
    model,
    vectorStoreIds,
    customSystemPrompt,
    toneId,
    focusId,
    verbosityId,
    reasoningEffort,
    keyAlias: keyVal.alias,
    keyToken: keyVal.token,
    keyExpiresAt: keyVal.expiresAt,
    skillId,
    // The selected team, with a single-team user's only team as the implicit
    // default — so the common case needs no explicit pick but still gets a
    // team-bound key. Multi-team users must choose.
    teamId: teamId || (teams.length === 1 ? teams[0].team_id : ''),
    topK: 5,
    webSearch,
    persistenceEnabled: config.persistence.enabled,
    maxRequestBudget: config.maxRequestBudget,
    onKeyChange: setKeyVal,
  });

  // The team record the effective key is bound to — drives the model and KB
  // scoping below.
  const selectedTeam = useMemo(() => {
    const effectiveId = teamId || (teams.length === 1 ? teams[0].team_id : '');
    return teams.find(t => t.team_id === effectiveId) ?? null;
  }, [teams, teamId]);

  // Restore the selected thread's own model/KBs/key into Settings whenever
  // the active thread changes — otherwise sending a message in an older
  // thread silently uses whatever is currently picked, not what that
  // conversation was built with.
  const activeThreadId = chat.activeThread?.id ?? null;
  useEffect(() => {
    if (!chat.activeThread) return;
    setModel(chat.activeThread.model);
    setVectorStoreIds(chat.activeThread.vectorStoreIds);
    setCustomSystemPrompt(chat.activeThread.customSystemPrompt ?? '');
    setToneId(chat.activeThread.toneId ?? '');
    setFocusId(chat.activeThread.focusId ?? '');
    setVerbosityId(chat.activeThread.verbosityId ?? '');
    setReasoningEffort(chat.activeThread.reasoningEffort ?? '');
    setKeyVal({
      alias: chat.activeThread.keyAlias,
      token: chat.activeThread.keyToken,
      expiresAt: chat.activeThread.keyExpiresAt,
    });
    setSkillId(chat.activeThread.skillId ?? '');
    setTeamId(chat.activeThread.teamId ?? '');
    setWebSearch(!!chat.activeThread.webSearch);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeThreadId]);

  // Fires a message queued by handleSend() when it had to create a new thread
  // first — newThread()'s setState is async, so sendMessage (bound to the
  // pre-creation, still-null activeThread) can't be called in the same tick.
  useEffect(() => {
    if (!pendingSendRef.current || !activeThreadId) return;
    const pending = pendingSendRef.current;
    pendingSendRef.current = null;
    chat.sendMessage(pending.text, pending.attachedUrl, undefined, pending.files);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeThreadId]);

  const messages = useMemo(
    () => chat.activeThread?.messages ?? [],
    [chat.activeThread],
  );
  const isStreaming = chat.isStreaming;
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isStreaming]);

  // Selecting a skill prefills the model / knowledge bases it declares as
  // defaults (the user can still override afterwards). Clearing the skill
  // leaves the current picks untouched.
  const handleSkillChange = (id: string) => {
    setSkillId(id);
    const skill = skills.find(s => s.id === id);
    if (!skill) return;
    if (skill.defaultModel) setModel(skill.defaultModel);
    if (skill.defaultVectorStoreIds?.length) setVectorStoreIds(skill.defaultVectorStoreIds);
  };

  // Switching teams re-scopes what the key can actually reach. The ACL and
  // budget are baked into the key at mint time, so an already-minted key can
  // never be reused across teams — it's deleted and replaced immediately
  // (the user's next send then uses the new one; nothing is re-minted here
  // when no key exists yet, handleSend covers that case). Knowledge bases the
  // team declares are pre-selected, still fully editable afterwards — the
  // team's list is a starting point, not a lock.
  const handleTeamChange = async (nextTeamId: string) => {
    setTeamId(nextTeamId);
    setKeyError(null);
    const team = teams.find(t => t.team_id === nextTeamId);
    const teamStores = team?.object_permission?.vector_stores;
    if (teamStores?.length) setVectorStoreIds(teamStores);

    if (!keyVal.token) return;
    try {
      const keyInfo = await chatApi.mintChatKey({
        ...(config.maxRequestBudget != null ? { max_budget: config.maxRequestBudget } : {}),
        ...(nextTeamId ? { team_id: nextTeamId } : {}),
      });
      const previousKey = keyVal.token;
      setKeyVal({
        alias: keyInfo.key_alias,
        token: keyInfo.key,
        expiresAt: keyInfo.expires_at ? Date.parse(keyInfo.expires_at) : undefined,
      });
      chatApi.deleteChatKey(previousKey).catch(() => {});
    } catch (err: any) {
      // Leave keyVal untouched on failure: the old (still valid) key keeps
      // working until it expires, and the error explains why the team change
      // didn't take effect.
      setKeyError(err.message ?? 'Failed to mint a chat key for this team');
    }
  };

  const handleSend = async () => {
    if (!input.trim() || isStreaming) return;
    const effectiveTeamId = teamId || (teams.length === 1 ? teams[0].team_id : '');
    // The team is required before a key can be minted (litellm.keyGeneration
    // .teamRequired in govai's config; this plugin's own /config mirrors it).
    // Without one there is nothing to bill the turn to, so surface it rather
    // than silently minting a teamless key.
    if (config.teamRequired && !effectiveTeamId) {
      setKeyError('Select a team before sending a message.');
      return;
    }
    let currentKey = keyVal;
    // Mint a chat key on the first message, or re-mint an expired one when
    // starting a fresh thread (no active thread to attach a retry to). A key
    // that goes stale on an existing thread is instead recovered reactively
    // in useThreads — mint once, then replay the failed turn.
    const expired =
      !!currentKey.expiresAt && currentKey.expiresAt - Date.now() < KEY_REMINT_SKEW_MS;
    if (!currentKey.token || (expired && !chat.activeThread)) {
      try {
        const keyInfo = await chatApi.mintChatKey({
          ...(config.maxRequestBudget != null ? { max_budget: config.maxRequestBudget } : {}),
          ...(effectiveTeamId ? { team_id: effectiveTeamId } : {}),
        });
        currentKey = {
          alias: keyInfo.key_alias,
          token: keyInfo.key,
          expiresAt: keyInfo.expires_at ? Date.parse(keyInfo.expires_at) : undefined,
        };
        setKeyVal(currentKey);
        setKeyError(null);
      } catch (err: any) {
        setKeyError(err.message ?? 'Failed to mint a chat key');
        return;
      }
    }
    const text = input.trim();
    const activeUrlMatch = text.match(URL_TOKEN_RE)?.[1];
    const attachedUrl =
      activeUrlMatch && urlContext.preview?.url === activeUrlMatch
        ? { url: urlContext.preview.url, title: urlContext.preview.title }
        : undefined;
    const files = staged.files.length > 0 ? staged.files : undefined;
    if (!chat.activeThread) {
      // No "New chat" click required — just typing and sending starts one.
      // newThread()'s setState is async, so the actual send is queued and
      // fired by the activeThreadId effect once the new thread is live.
      // currentKey is passed explicitly since it may have just been minted
      // above — newThread's own key closure predates that mint.
      pendingSendRef.current = { text, attachedUrl, files };
      chat.newThread(currentKey);
    } else {
      chat.sendMessage(text, attachedUrl, undefined, files);
    }
    setInput('');
    urlContext.reset();
    staged.clear();
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleImportFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    try {
      await chat.importThread(file);
      setImportError(null);
    } catch (err: any) {
      setImportError(err.message ?? 'Failed to import thread');
    }
  };

  const handleAttachFiles = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const fileList = e.target.files;
    e.target.value = '';
    if (fileList) await staged.add(fileList);
  };

  const lastTurnUsage = chat.activeThread?.lastTurnUsage ?? null;
  const totalTokens = chat.activeThread?.totalTokens ?? 0;
  const statusParts: string[] = [];
  if (lastTurnUsage) {
    statusParts.push(`${lastTurnUsage.total_tokens.toLocaleString()} tokens this turn`);
  }
  if (chat.keySpend) {
    statusParts.push(`$${chat.keySpend.spend.toFixed(4)} spent`);
    if (chat.keySpend.max_budget != null) {
      statusParts.push(
        `$${chat.keySpend.spend.toFixed(2)} / $${chat.keySpend.max_budget.toFixed(2)} budget`,
      );
    }
  }

  return (
    <Box sx={{ display: 'flex', height: '100dvh', overflow: 'hidden' }}>
      <ThreadSidebar
        collapsed={sidebarCollapsed}
        onToggleCollapsed={() => setSidebarCollapsed(v => !v)}
        config={config}
        configError={configError}
        traits={traits}
        traitsLoading={traitsLoading}
        skills={skills}
        skillId={skillId}
        onSkillChange={handleSkillChange}
        toneId={toneId}
        onToneChange={setToneId}
        focusId={focusId}
        onFocusChange={setFocusId}
        verbosityId={verbosityId}
        onVerbosityChange={setVerbosityId}
        customSystemPrompt={customSystemPrompt}
        onCustomSystemPromptChange={setCustomSystemPrompt}
        teams={teams}
        teamsLoading={teamsLoading}
        teamsError={teamsError}
        teamId={teamId}
        onTeamChange={handleTeamChange}
        teamModels={selectedTeam?.models}
        model={model}
        onModelChange={setModel}
        vectorStoreIds={vectorStoreIds}
        onVectorStoreIdsChange={setVectorStoreIds}
        teamVectorStores={selectedTeam?.object_permission?.vector_stores}
        webSearch={webSearch}
        onWebSearchChange={setWebSearch}
        reasoningEffort={reasoningEffort}
        onReasoningEffortChange={setReasoningEffort}
        threads={chat.threads}
        activeThreadId={activeThreadId}
        onNewThread={() => chat.newThread()}
        onSelectThread={chat.selectThread}
        onDeleteThread={chat.deleteThread}
        onTogglePin={chat.togglePin}
        onExportThread={chat.exportThread}
        onImportFile={handleImportFile}
        importError={importError}
      />

      {/* ─── Center: chat column ─── */}
      <Box sx={{ flex: 3, display: 'flex', justifyContent: 'center', overflow: 'hidden' }}>
        <Box
          sx={{
            width: '100%',
            maxWidth: CHAT_MAX_WIDTH,
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
          }}
        >
          <Box
            sx={{
              flexShrink: 0,
              px: 2,
              py: 1,
              borderBottom: 1,
              borderColor: 'divider',
              display: 'flex',
              alignItems: 'center',
              gap: 1,
            }}
          >
            <ChatIcon fontSize="small" color="action" />
            <Typography variant="subtitle2" noWrap sx={{ flex: 1 }}>
              {chat.activeThread?.title ?? 'AI Chat'}
            </Typography>
            <Tooltip
              title={rightPanelCollapsed ? 'Show context panel' : 'Hide context panel'}
            >
              <IconButton size="small" onClick={() => setRightPanelCollapsed(v => !v)}>
                {rightPanelCollapsed ? (
                  <ChevronLeftIcon fontSize="small" />
                ) : (
                  <ChevronRightIcon fontSize="small" />
                )}
              </IconButton>
            </Tooltip>
          </Box>

          {chat.error && (
            <Box sx={{ px: 2, pt: 1 }}>
              <ErrorBanner error={chat.error} onDismiss={chat.clearError} />
            </Box>
          )}

          {keyError && (
            <Box sx={{ px: 2, pt: 1 }}>
              <ErrorBanner error={keyError} onDismiss={() => setKeyError(null)} />
            </Box>
          )}

          {chat.compareUnavailable && (
            <Box sx={{ px: 2, pt: 1 }}>
              <ErrorBanner
                error="Multi-model compare is unavailable with the installed AI SDK version."
                onDismiss={chat.clearError}
              />
            </Box>
          )}

          <Box sx={{ flex: 1, overflowY: 'auto', minHeight: 0 }}>
            {messages.length === 0 ? (
              <Box
                sx={{
                  height: '100%',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Typography color="text.secondary">Start a conversation…</Typography>
              </Box>
            ) : (
              <MessageList
                messages={messages}
                streamingMessageIds={chat.streamingMessageIds}
                onFeedback={chat.submitFeedback}
                onRegenerate={chat.regenerateFrom}
                onEditAndResend={chat.editAndResend}
              />
            )}
            <div ref={messagesEndRef} />
          </Box>

          <ChatComposer
            input={input}
            onInputChange={setInput}
            onKeyDown={handleKeyDown}
            onSend={handleSend}
            isStreaming={isStreaming}
            onStop={chat.stopGeneration}
            stagedFiles={staged.files}
            onRemoveStagedFile={staged.remove}
            attachError={staged.error}
            onDismissAttachError={staged.dismissError}
            attachInputRef={attachInputRef}
            onAttachFiles={handleAttachFiles}
            urlPreview={urlContext.preview}
            urlPreviewLoading={urlContext.loading}
            urlPreviewError={urlContext.error}
            onDismissUrlPreview={urlContext.dismiss}
          />

          {statusParts.length > 0 && (
            <Box sx={{ px: 2, pb: 1 }}>
              <Typography variant="caption" color="text.secondary">
                {statusParts.join(' · ')}
              </Typography>
            </Box>
          )}
        </Box>
      </Box>

      {/* ─── Right rail: sources + usage ─── */}
      {!rightPanelCollapsed && (
        <>
          <Box
            role="separator"
            aria-orientation="vertical"
            aria-label="Resize context panel"
            onPointerDown={rightPanel.onPointerDown}
            onDoubleClick={rightPanel.reset}
            sx={{
              width: '6px',
              flexShrink: 0,
              cursor: 'col-resize',
              bgcolor: 'transparent',
              transition: 'background-color 0.15s',
              '&:hover, &:active': { bgcolor: 'primary.main' },
            }}
          />
          <Box
            sx={{
              width: rightPanel.width,
              flexShrink: 0,
              borderLeft: 1,
              borderColor: 'divider',
              display: 'flex',
              flexDirection: 'column',
              overflowY: 'auto',
              overflowX: 'hidden',
            }}
          >
            <SourcesPanel citations={chat.citations} />
            <Divider />
            <UsagePanel
              lastTurnUsage={lastTurnUsage}
              totalTokens={totalTokens}
              keySpend={chat.keySpend}
            />
          </Box>
        </>
      )}
    </Box>
  );
};
