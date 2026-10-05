import React, { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { Box, Fab, Tooltip } from '@mui/material';
import KeyboardArrowDownIcon from '@mui/icons-material/KeyboardArrowDown';
import { useApi, identityApiRef } from '@backstage/core-plugin-api';
import { liteLlmApiRef } from '@acarmisc/backstage-plugin-litellm';

import type { FileUIPart } from 'ai';
import { aiConversationApiRef } from '../api';
import { threadToMarkdown } from '../utils/threadMarkdown';
import { citationsFromLastAssistant } from '../utils/citations';
import { useThreads } from '../hooks/useThreads';
import { useResizablePanel } from '../hooks/useResizablePanel';
import { useUrlContext, URL_TOKEN_RE } from '../hooks/useUrlContext';
import { useStagedFiles } from '../hooks/useStagedFiles';
import { useStickToBottom } from '../hooks/useStickToBottom';
import { useChatShortcuts } from '../hooks/useChatShortcuts';
import { filterModels } from './modelFilter';
import { ComparePopover } from './ComparePopover';
import type { ModelInfo } from '@acarmisc/backstage-plugin-litellm';
import { injectDesignSystemAssets } from '../theme';
import { ChatComposer } from './ChatComposer';
import { MessageList } from './MessageList';
import { ThreadSidebar } from './ThreadSidebar';
import { ChatHeader } from './ChatHeader';
import { WelcomeScreen } from './WelcomeScreen';
import { ErrorBanner } from './ErrorBanner';
import { ContextPanel } from './ContextPanel';
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
const CHAT_MAX_WIDTH = 820;
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
  const [configError, setConfigError] = useState<string | null>(null);
  const [teamsError, setTeamsError] = useState<string | null>(null);

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
  const [teamId, setTeamId] = useState('');
  const [keyError, setKeyError] = useState<string | null>(null);
  const [input, setInput] = useState('');
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [rightPanelCollapsed, setRightPanelCollapsed] = useState(false);
  const [importError, setImportError] = useState<string | null>(null);
  const [traits, setTraits] = useState<ChatTraits>(EMPTY_TRAITS);
  const [traitsLoading, setTraitsLoading] = useState(true);
  const [contextTab, setContextTab] = useState<'sources' | 'usage'>('sources');
  const [compareAnchor, setCompareAnchor] = useState<HTMLElement | null>(null);
  const [compareModels, setCompareModels] = useState<ModelInfo[]>([]);
  // Compare mode is a per-conversation setting: with no conversation open,
  // one is created first and the choice applied once it exists.
  const pendingCompareRef = useRef<string[] | null>(null);

  const rightPanel = useResizablePanel({
    storageKey: 'ai-conversation.rightPanelWidth',
    defaultWidth: RIGHT_RAIL_WIDTH,
    minWidth: RIGHT_RAIL_MIN_WIDTH,
    maxWidth: RIGHT_RAIL_MAX_WIDTH,
    side: 'left',
  });

  const messagesScrollRef = useRef<HTMLDivElement>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const [rootTop, setRootTop] = useState(0);
  const attachInputRef = useRef<HTMLInputElement>(null);
  const composerInputRef = useRef<HTMLTextAreaElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const pendingSendRef = useRef<{
    text: string;
    attachedUrl?: { url: string; title: string };
    files?: FileUIPart[];
  } | null>(null);

  const staged = useStagedFiles();
  const urlContext = useUrlContext(chatApi, input);

  // Load config, traits, skills, teams, models
  useEffect(() => {
    injectDesignSystemAssets();
    chatApi
      .getChatConfig()
      .then(setConfig)
      .catch(err => setConfigError(err.message ?? 'Failed to reach the chat backend'));

    chatApi
      .getChatTraits()
      // No trait is preselected: "Default" (none) is what every conversation
      // starts with, and what Reset to defaults goes back to.
      .then(setTraits)
      .catch(() => {})
      .finally(() => setTraitsLoading(false));

    chatApi
      .listSkills()
      .then(setSkills)
      .catch(() => {});

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
    teamId: teamId || (teams.length === 1 ? teams[0].team_id : ''),
    topK: 5,
    webSearch,
    persistenceEnabled: config.persistence.enabled,
    maxRequestBudget: config.maxRequestBudget,
    onKeyChange: setKeyVal,
  });

  // A single-team user's only team is the implicit default (handleSend
  // mints against it), so pickers must show and scope by it too.
  const effectiveTeamId = teamId || (teams.length === 1 ? teams[0].team_id : '');
  const selectedTeam = useMemo(
    () => teams.find(t => t.team_id === effectiveTeamId),
    [teams, effectiveTeamId],
  );

  // Restore thread settings on active thread change
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

  // Apply default model on fresh load (when no thread is active and model is unset)
  useEffect(() => {
    if (!config.defaultModel || model || chat.activeThread) return;
    setModel(config.defaultModel);
  }, [config.defaultModel, model, chat.activeThread]);

  // Models for the compare picker, loaded the first time it opens.
  useEffect(() => {
    if (!compareAnchor || compareModels.length) return;
    liteLlmApi
      .listModels()
      .then(all => setCompareModels(filterModels(all, m => m.model_name, config.excludedModels)))
      .catch(() => {});
  }, [compareAnchor, compareModels.length, liteLlmApi, config.excludedModels]);

  useEffect(() => {
    if (!pendingCompareRef.current || !activeThreadId) return;
    const models = pendingCompareRef.current;
    pendingCompareRef.current = null;
    chat.setCompareMode(true, models);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeThreadId]);

  const handleEnableCompare = (models: string[]) => {
    setCompareAnchor(null);
    if (chat.activeThread) {
      chat.setCompareMode(true, models);
    } else {
      pendingCompareRef.current = models;
      chat.newThread();
    }
  };

  // Sends a message queued by handleSend once its conversation exists and
  // its freshly minted key has reached useThreads (both arrive a render
  // after handleSend runs).
  useEffect(() => {
    if (!pendingSendRef.current || !activeThreadId || !keyVal.token) return;
    const pending = pendingSendRef.current;
    pendingSendRef.current = null;
    chat.sendMessage(pending.text, pending.attachedUrl, undefined, pending.files);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeThreadId, keyVal.token]);

  const messages = useMemo(
    () => chat.activeThread?.messages ?? [],
    [chat.activeThread],
  );
  const isStreaming = chat.isStreaming;

  // Setup scroll behavior
  const { isAtBottom, scrollToBottom } = useStickToBottom(messagesScrollRef, [messages, isStreaming]);

  // Scroll to top for welcome screen (no messages), scroll to bottom for messages
  useLayoutEffect(() => {
    if (!messagesScrollRef.current) return;
    if (messages.length === 0) {
      messagesScrollRef.current.scrollTop = 0;
    }
  }, [messages.length]);

  // Measure the root element's top position to adjust for Backstage header
  useLayoutEffect(() => {
    const measureAndAdjust = () => {
      if (rootRef.current) {
        const rect = rootRef.current.getBoundingClientRect();
        setRootTop(rect.top);
      }
    };
    measureAndAdjust();
    window.addEventListener('resize', measureAndAdjust);
    return () => window.removeEventListener('resize', measureAndAdjust);
  }, []);

  useChatShortcuts({
    onNewChat: () => chat.newThread(),
    onSearch: () => {
      setSidebarCollapsed(false);
      // The search field mounts with the expanded sidebar.
      setTimeout(() => searchInputRef.current?.focus(), 0);
    },
    onToggleSidebar: () => setSidebarCollapsed(v => !v),
    onStop: isStreaming ? chat.stopGeneration : undefined,
    onFocusComposer: () => composerInputRef.current?.focus(),
  });

  const handleSkillChange = (id: string) => {
    setSkillId(id);
    const skill = skills.find(s => s.id === id);
    if (!skill) return;
    if (skill.defaultModel) setModel(skill.defaultModel);
    if (skill.defaultVectorStoreIds?.length) setVectorStoreIds(skill.defaultVectorStoreIds);
  };

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
      setKeyError(err.message ?? 'Failed to mint a chat key for this team');
    }
  };

  const handleSend = async () => {
    if (!input.trim() || isStreaming) return;

    if (config.teamRequired && !effectiveTeamId) {
      setKeyError('Select a team before sending a message.');
      return;
    }

    let currentKey = keyVal;
    let minted = false;
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
        minted = true;
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
      pendingSendRef.current = { text, attachedUrl, files };
      chat.newThread(currentKey);
    } else if (minted) {
      // useThreads still holds the previous (empty) key until the next
      // render; sending now would drop the message. The pending-send effect
      // fires once the new key has propagated.
      pendingSendRef.current = { text, attachedUrl, files };
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

  const handleShowSources = () => {
    setContextTab('sources');
    setRightPanelCollapsed(false);
  };

  const lastTurnUsage = chat.activeThread?.lastTurnUsage ?? null;
  const totalTokens = chat.activeThread?.totalTokens ?? 0;

  const selectedSkill = skills.find(s => s.id === skillId);

  // Use live citations if available, otherwise extract from last assistant message
  const railCitations = useMemo(() => {
    if (chat.citations.length > 0) return chat.citations;
    return citationsFromLastAssistant(messages);
  }, [chat.citations, messages]);

  return (
    <Box
      ref={rootRef}
      sx={{
        display: 'flex',
        bgcolor: 'background.default',
        color: 'text.primary',
        height: rootTop > 0 ? `calc(100dvh - ${rootTop}px)` : '100dvh',
        overflow: 'hidden',
      }}
    >
      {/* Sidebar */}
      <ThreadSidebar
        collapsed={sidebarCollapsed}
        onToggleCollapsed={() => setSidebarCollapsed(v => !v)}
        config={config}
        threads={chat.threads}
        activeThreadId={activeThreadId}
        onNewThread={() => chat.newThread()}
        onSelectThread={chat.selectThread}
        onDeleteThread={chat.deleteThread}
        onTogglePin={chat.togglePin}
        onRenameThread={chat.renameThread}
        onExportThread={chat.exportThread}
        onExportMarkdown={chat.exportThreadMarkdown}
        onImportFile={handleImportFile}
        importError={importError}
        searchInputRef={searchInputRef}
      />

      {/* Center column */}
      <Box sx={{ flex: 1, display: 'flex', justifyContent: 'center', overflow: 'hidden' }}>
        <Box
          sx={{
            width: '100%',
            maxWidth: CHAT_MAX_WIDTH,
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
          }}
        >
          {/* Header */}
          <ChatHeader
            title={chat.activeThread?.title || 'New conversation'}
            onRenameThread={
              chat.activeThread
                ? (newTitle) => chat.renameThread(chat.activeThread!.id, newTitle)
                : undefined
            }
            skill={selectedSkill}
            vectorStoreCount={vectorStoreIds.length}
            webSearch={webSearch}
            compareMode={chat.activeThread?.mode === 'compare'}
            compareModelCount={chat.activeThread?.compareModels?.length}
            onToggleRightPanel={() => setRightPanelCollapsed(v => !v)}
            onCopyAsMarkdown={() => {
              if (chat.activeThread) {
                const md = threadToMarkdown(chat.activeThread);
                navigator.clipboard.writeText(md).catch(() => {});
              }
            }}
            onExportMarkdown={() => {
              if (chat.activeThread) chat.exportThreadMarkdown(chat.activeThread.id);
            }}
            onExportJSON={() => {
              // exportThread strips the conversation's key from the file.
              if (chat.activeThread) chat.exportThread(chat.activeThread.id);
            }}
            onCompareClick={el => setCompareAnchor(el)}
          />
          <ComparePopover
            open={!!compareAnchor}
            anchorEl={compareAnchor}
            onClose={() => setCompareAnchor(null)}
            models={compareModels}
            selectedTeam={selectedTeam}
            selectedModels={chat.activeThread?.compareModels ?? []}
            isEnabled={chat.activeThread?.mode === 'compare'}
            onEnable={handleEnableCompare}
            onDisable={() => chat.setCompareMode(false)}
          />

          {/* Error banners */}
          {chat.error && (
            <Box sx={{ px: 2, pt: 1 }}>
              <ErrorBanner error={chat.error} onDismiss={chat.clearError} />
            </Box>
          )}

          {configError && (
            <Box sx={{ px: 2, pt: 1 }}>
              <ErrorBanner
                error={`Couldn't load chat defaults: ${configError}`}
                onDismiss={() => setConfigError(null)}
              />
            </Box>
          )}

          {keyError && (
            <Box sx={{ px: 2, pt: 1 }}>
              <ErrorBanner
                error={keyError}
                onDismiss={() => setKeyError(null)}
                severity={keyError.includes('Select a team') ? 'warning' : undefined}
                plain={keyError.includes('Select a team')}
              />
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

          {/* Messages or welcome screen */}
          <Box sx={{ flex: 1, overflowY: 'auto', minHeight: 0 }} ref={messagesScrollRef}>
            {messages.length === 0 ? (
              <WelcomeScreen
                config={config}
                selectedSkill={selectedSkill}
                selectedTeam={selectedTeam}
                selectedModel={model}
                teams={teams}
                teamsLoading={teamsLoading}
                teamsError={teamsError}
                skills={skills}
                teamId={effectiveTeamId}
                onTeamChange={handleTeamChange}
                onSkillSelect={handleSkillChange}
                onPromptClick={setInput}
              />
            ) : (
              <MessageList
                messages={messages}
                streamingMessageIds={chat.streamingMessageIds}
                onFeedback={chat.submitFeedback}
                onRegenerate={chat.regenerateFrom}
                onEditAndResend={chat.editAndResend}
                onShowSources={handleShowSources}
                modelLabel={model}
              />
            )}
            <div style={{ height: 16 }} />
          </Box>

          {/* Scroll to bottom button */}
          {!isAtBottom && (
            <Box sx={{ position: 'absolute', bottom: 120, left: '50%', transform: 'translateX(-50%)' }}>
              <Tooltip title="Scroll to bottom">
<Fab size="small" aria-label="Scroll to bottom" onClick={() => scrollToBottom('smooth')}>
                  <KeyboardArrowDownIcon />
                </Fab>
              </Tooltip>
            </Box>
          )}

          {/* Composer */}
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
            composerInputRef={composerInputRef}
            onAttachFiles={handleAttachFiles}
            urlPreview={urlContext.preview}
            urlPreviewLoading={urlContext.loading}
            urlPreviewError={urlContext.error}
            onDismissUrlPreview={urlContext.dismiss}
            config={config}
            teams={teams}
            teamsLoading={teamsLoading}
            teamsError={teamsError}
            skills={skills}
            teamId={effectiveTeamId}
            onTeamChange={handleTeamChange}
            model={model}
            onModelChange={setModel}
            vectorStoreIds={vectorStoreIds}
            onVectorStoreIdsChange={setVectorStoreIds}
            teamVectorStores={selectedTeam?.object_permission?.vector_stores}
            skillId={skillId}
            onSkillChange={handleSkillChange}
            toneId={toneId}
            onToneChange={setToneId}
            focusId={focusId}
            onFocusChange={setFocusId}
            verbosityId={verbosityId}
            onVerbosityChange={setVerbosityId}
            reasoningEffort={reasoningEffort}
            onReasoningEffortChange={setReasoningEffort}
            webSearch={webSearch}
            onWebSearchChange={setWebSearch}
            customSystemPrompt={customSystemPrompt}
            onCustomSystemPromptChange={setCustomSystemPrompt}
            traits={traits}
            traitsLoading={traitsLoading}
            keySpend={chat.keySpend}
          />
        </Box>
      </Box>

      {/* Right panel */}
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
            <ContextPanel
              citations={railCitations}
              lastTurnUsage={lastTurnUsage}
              totalTokens={totalTokens}
              keySpend={chat.keySpend}
              keyAlias={keyVal.alias}
              keyExpiresAt={keyVal.expiresAt}
              tab={contextTab}
              onTabChange={setContextTab}
            />
          </Box>
        </>
      )}

    </Box>
  );
};
