import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Box,
  Button,
  List,
  ListItem,
  ListItemButton,
  ListItemText,
  IconButton,
  Divider,
  Typography,
  Tooltip,
  InputBase,
  Menu,
  MenuItem,
  ListItemIcon,
  Chip,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import DeleteIcon from '@mui/icons-material/Delete';
import SettingsIcon from '@mui/icons-material/Settings';
import ChatIcon from '@mui/icons-material/Chat';
import SendIcon from '@mui/icons-material/Send';
import StopIcon from '@mui/icons-material/Stop';
import SearchIcon from '@mui/icons-material/Search';
import MoreVertIcon from '@mui/icons-material/MoreVert';
import PushPinIcon from '@mui/icons-material/PushPin';
import PushPinOutlinedIcon from '@mui/icons-material/PushPinOutlined';
import FileDownloadIcon from '@mui/icons-material/FileDownload';
import FileUploadIcon from '@mui/icons-material/FileUpload';
import ChevronLeftIcon from '@mui/icons-material/ChevronLeft';
import ChevronRightIcon from '@mui/icons-material/ChevronRight';
import LinkIcon from '@mui/icons-material/Link';
import CloseIcon from '@mui/icons-material/Close';
import { useApi, identityApiRef } from '@backstage/core-plugin-api';
import { aiConversationApiRef } from '../api';
import { useThreads } from '../hooks/useThreads';
import { extractText } from '../hooks/messageShape';
import { injectDesignSystemAssets } from '../theme';
import { ChatSettingsPanel } from './ChatSettingsPanel';
import { PersonaHomepage } from './PersonaHomepage';
import { MessageList } from './MessageList';
import { ErrorBanner } from './ErrorBanner';
import { SourcesPanel } from './SourcesPanel';
import { UsagePanel } from './UsagePanel';
import type { ChatConfig, ChatTraits, Persona, ReasoningEffort, Thread, UrlContextPreview } from '../types';

const SIDEBAR_WIDTH = 280;
const SIDEBAR_RAIL_WIDTH = 48;
const RIGHT_RAIL_WIDTH = 300;
const CHAT_MAX_WIDTH = 900;
const URL_TOKEN_RE = /#(https:\/\/\S+)/;
const URL_PREVIEW_DEBOUNCE_MS = 500;

function threadMatchesQuery(thread: Thread, query: string): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  if (thread.title.toLowerCase().includes(q)) return true;
  return thread.messages.some(m => extractText(m).toLowerCase().includes(q));
}

function sortThreads(threads: Thread[]): Thread[] {
  return [...threads].sort((a, b) => {
    if (!!a.pinned !== !!b.pinned) return a.pinned ? -1 : 1;
    return b.updatedAt - a.updatedAt;
  });
}

export const ChatPage: React.FC = () => {
  const chatApi = useApi(aiConversationApiRef);
  const identityApi = useApi(identityApiRef);

  const [userId, setUserId] = useState('default');
  const [config, setConfig] = useState<ChatConfig>({
    defaultModel: null,
    defaultVectorStoreIds: null,
    maxRequestBudget: null,
    persistence: { enabled: false, ttlDays: 30 },
  });

  const [model, setModel] = useState('');
  const [compareMode, setCompareModeUi] = useState(false);
  const [compareModelsSel, setCompareModelsSel] = useState<string[]>([]);
  const [vectorStoreIds, setVectorStoreIds] = useState<string[]>([]);
  const [webSearch, setWebSearch] = useState(false);
  const [personaId, setPersonaId] = useState('');
  const [customSystemPrompt, setCustomSystemPrompt] = useState('');
  const [toneId, setToneId] = useState('');
  const [focusId, setFocusId] = useState('');
  const [verbosityId, setVerbosityId] = useState('');
  const [reasoningEffort, setReasoningEffort] = useState<ReasoningEffort | ''>('');
  const [keyVal, setKeyVal] = useState<{ alias: string; token: string }>({
    alias: '',
    token: '',
  });
  const [showSettings, setShowSettings] = useState(true);
  const [input, setInput] = useState('');
  const [configError, setConfigError] = useState<string | null>(null);
  const [personas, setPersonas] = useState<Persona[]>([]);
  const [personasLoading, setPersonasLoading] = useState(true);
  const [personasError, setPersonasError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [rightPanelCollapsed, setRightPanelCollapsed] = useState(false);
  const [threadMenuAnchor, setThreadMenuAnchor] = useState<HTMLElement | null>(null);
  const [threadMenuTarget, setThreadMenuTarget] = useState<string | null>(null);
  const [importError, setImportError] = useState<string | null>(null);
  const [urlPreview, setUrlPreview] = useState<UrlContextPreview | null>(null);
  const [urlPreviewLoading, setUrlPreviewLoading] = useState(false);
  const [urlPreviewError, setUrlPreviewError] = useState<string | null>(null);
  const [dismissedUrl, setDismissedUrl] = useState<string | null>(null);
  const [traits, setTraits] = useState<ChatTraits>({ tones: [], focuses: [], verbosities: [] });
  const [traitsLoading, setTraitsLoading] = useState(true);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const importInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    injectDesignSystemAssets();
    chatApi
      .getChatConfig()
      .then(setConfig)
      .catch(err => setConfigError(err.message ?? 'Failed to reach the chat backend'));
    chatApi
      .listPersonas()
      .then(setPersonas)
      .catch(err => setPersonasError(err.message ?? 'Failed to load personas'))
      .finally(() => setPersonasLoading(false));
    chatApi
      .getChatTraits()
      .then(setTraits)
      .catch(() => {})
      .finally(() => setTraitsLoading(false));
    identityApi
      .getCredentials()
      .then(c => setUserId(c.token ? 'oidc' : 'default'))
      .catch(() => {});
  }, [chatApi, identityApi]);

  const chat = useThreads({
    userId,
    model,
    vectorStoreIds,
    personaId,
    customSystemPrompt,
    toneId,
    focusId,
    verbosityId,
    reasoningEffort,
    keyAlias: keyVal.alias,
    keyToken: keyVal.token,
    topK: 5,
    webSearch,
    persistenceEnabled: config.persistence.enabled,
  });

  // Restore the selected thread's own model/KBs/persona/key into Settings
  // whenever the active thread changes — otherwise sending a message in an
  // older thread silently uses whatever is currently picked, not what that
  // conversation was built with.
  const activeThreadId = chat.activeThread?.id ?? null;
  useEffect(() => {
    if (!chat.activeThread) return;
    setModel(chat.activeThread.model);
    setVectorStoreIds(chat.activeThread.vectorStoreIds);
    setPersonaId(chat.activeThread.personaId ?? '');
    setCustomSystemPrompt(chat.activeThread.customSystemPrompt ?? '');
    setToneId(chat.activeThread.toneId ?? '');
    setFocusId(chat.activeThread.focusId ?? '');
    setVerbosityId(chat.activeThread.verbosityId ?? '');
    setReasoningEffort(chat.activeThread.reasoningEffort ?? '');
    setKeyVal({ alias: chat.activeThread.keyAlias, token: chat.activeThread.keyToken });
    setCompareModeUi(chat.activeThread.mode === 'compare');
    setCompareModelsSel(chat.activeThread.compareModels ?? []);
    setWebSearch(!!chat.activeThread.webSearch);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeThreadId]);

  // Auto-scroll to bottom when messages update or streaming.
  const messages = useMemo(() => chat.activeThread?.messages ?? [], [
    chat.activeThread,
  ]);
  const isStreaming = chat.isStreaming;
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isStreaming]);

  // Detect a `#https://...` token in the composer, debounced, and resolve
  // it to a title/snippet chip via the SSRF-guarded backend preview. The
  // full page text is never fetched to the browser — only fetched again
  // server-side (cache-hit) when the message is actually sent.
  useEffect(() => {
    const match = input.match(URL_TOKEN_RE);
    const url = match?.[1];
    if (!url) {
      setUrlPreview(null);
      setUrlPreviewError(null);
      setUrlPreviewLoading(false);
      return undefined;
    }
    if (url === dismissedUrl || url === urlPreview?.url) return undefined;

    setUrlPreviewLoading(true);
    setUrlPreviewError(null);
    const timer = setTimeout(() => {
      chatApi
        .fetchUrlContext(url)
        .then(result => {
          setUrlPreview(result);
          setUrlPreviewLoading(false);
        })
        .catch(err => {
          setUrlPreviewError(err.message ?? 'Failed to fetch that page');
          setUrlPreviewLoading(false);
        });
    }, URL_PREVIEW_DEBOUNCE_MS);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [input, dismissedUrl]);

  const visibleThreads = useMemo(
    () => sortThreads(chat.threads.filter(t => threadMatchesQuery(t, searchQuery))),
    [chat.threads, searchQuery],
  );

  const handlePersonaChange = (id: string, persona: Persona | undefined) => {
    setPersonaId(id);
    if (persona?.defaultModel) setModel(persona.defaultModel);
    if (persona?.defaultVectorStoreIds) {
      setVectorStoreIds(persona.defaultVectorStoreIds);
    }
  };

  const handleSend = () => {
    if (!input.trim() || !keyVal.token || isStreaming) return;
    if (compareMode && compareModelsSel.length === 0) return;
    const text = input.trim();
    const activeUrlMatch = text.match(URL_TOKEN_RE)?.[1];
    const attachedUrl =
      activeUrlMatch && urlPreview?.url === activeUrlMatch && activeUrlMatch !== dismissedUrl
        ? { url: urlPreview.url, title: urlPreview.title }
        : undefined;
    const compareModelsOverride = compareMode ? compareModelsSel : undefined;
    if (!chat.activeThread) {
      chat.newThread();
      // newThread() setState is async; defer sendMessage to the next tick
      // so it sees the freshly created active thread.
      requestAnimationFrame(() => chat.sendMessage(text, attachedUrl, compareModelsOverride));
    } else {
      chat.sendMessage(text, attachedUrl, compareModelsOverride);
    }
    setInput('');
    setUrlPreview(null);
    setUrlPreviewError(null);
    setDismissedUrl(null);
  };

  const dismissUrlPreview = () => {
    if (urlPreview) setDismissedUrl(urlPreview.url);
    else {
      const match = input.match(URL_TOKEN_RE)?.[1];
      if (match) setDismissedUrl(match);
    }
    setUrlPreview(null);
    setUrlPreviewError(null);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const openThreadMenu = (e: React.MouseEvent<HTMLElement>, threadId: string) => {
    e.stopPropagation();
    setThreadMenuAnchor(e.currentTarget);
    setThreadMenuTarget(threadId);
  };

  const closeThreadMenu = () => {
    setThreadMenuAnchor(null);
    setThreadMenuTarget(null);
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

  const menuTargetThread = chat.threads.find(t => t.id === threadMenuTarget) ?? null;

  const lastTurnUsage = chat.activeThread?.lastTurnUsage ?? null;
  const totalTokens = chat.activeThread?.totalTokens ?? 0;
  const statusParts: string[] = [];
  if (lastTurnUsage) {
    statusParts.push(`${lastTurnUsage.total_tokens.toLocaleString()} tokens this turn`);
  }
  if (chat.keySpend) {
    statusParts.push(`$${chat.keySpend.spend.toFixed(4)} spent`);
    if (chat.keySpend.max_budget != null) {
      statusParts.push(`$${chat.keySpend.spend.toFixed(2)} / $${chat.keySpend.max_budget.toFixed(2)} budget`);
    }
  }

  let persistenceTooltip: string;
  if (config.persistence.enabled) {
    persistenceTooltip =
      config.persistence.ttlDays > 0
        ? `Threads are saved to your account and auto-deleted after ${config.persistence.ttlDays} days of inactivity.`
        : 'Threads are saved to your account and kept indefinitely.';
  } else {
    persistenceTooltip =
      'Threads are stored only in this browser (localStorage) and are lost if browser data is cleared.';
  }

  let urlPreviewChip: React.ReactNode = null;
  if (urlPreviewLoading) {
    urlPreviewChip = (
      <Chip size="small" icon={<LinkIcon fontSize="small" />} label="Fetching page…" variant="outlined" />
    );
  } else if (urlPreviewError) {
    urlPreviewChip = (
      <Chip
        size="small"
        color="error"
        icon={<LinkIcon fontSize="small" />}
        label={urlPreviewError}
        variant="outlined"
        onDelete={dismissUrlPreview}
        deleteIcon={<CloseIcon fontSize="small" />}
      />
    );
  } else if (urlPreview) {
    urlPreviewChip = (
      <Tooltip title={urlPreview.url}>
        <Chip
          size="small"
          icon={<LinkIcon fontSize="small" />}
          label={`Page attached: ${urlPreview.title}`}
          variant="outlined"
          onDelete={dismissUrlPreview}
          deleteIcon={<CloseIcon fontSize="small" />}
        />
      </Tooltip>
    );
  }

  return (
    <Box sx={{ display: 'flex', height: '100dvh', overflow: 'hidden' }}>
      {/* ─── Left sidebar: settings on top + threads ─── */}
      <Box
        sx={{
          width: sidebarCollapsed ? SIDEBAR_RAIL_WIDTH : SIDEBAR_WIDTH,
          flexShrink: 0,
          borderRight: 1,
          borderColor: 'divider',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          transition: 'width 0.15s',
        }}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: sidebarCollapsed ? 'center' : 'flex-end', px: 0.5, py: 0.5 }}>
          <Tooltip title={sidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}>
            <IconButton size="small" onClick={() => setSidebarCollapsed(v => !v)}>
              {sidebarCollapsed ? <ChevronRightIcon fontSize="small" /> : <ChevronLeftIcon fontSize="small" />}
            </IconButton>
          </Tooltip>
        </Box>

        {sidebarCollapsed ? (
          <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 1, pt: 1 }}>
            <Tooltip title="New chat" placement="right">
              <IconButton onClick={chat.newThread}>
                <AddIcon />
              </IconButton>
            </Tooltip>
            <Tooltip title="Settings" placement="right">
              <IconButton onClick={() => setSidebarCollapsed(false)}>
                <SettingsIcon />
              </IconButton>
            </Tooltip>
          </Box>
        ) : (
          <>
            {/* Settings panel (collapsible, pinned to top) */}
            <ChatSettingsPanel
              chatApi={chatApi}
              showSettings={showSettings}
              onToggleShowSettings={() => setShowSettings(v => !v)}
              configError={configError}
              config={config}
              personas={personas}
              personasLoading={personasLoading}
              personasError={personasError}
              personaId={personaId}
              onPersonaChange={handlePersonaChange}
              traits={traits}
              traitsLoading={traitsLoading}
              toneId={toneId}
              onToneChange={setToneId}
              focusId={focusId}
              onFocusChange={setFocusId}
              customSystemPrompt={customSystemPrompt}
              onCustomSystemPromptChange={setCustomSystemPrompt}
              compareMode={compareMode}
              onCompareModeChange={setCompareModeUi}
              compareModelsSel={compareModelsSel}
              onCompareModelsChange={setCompareModelsSel}
              model={model}
              onModelChange={setModel}
              vectorStoreIds={vectorStoreIds}
              onVectorStoreIdsChange={setVectorStoreIds}
              webSearch={webSearch}
              onWebSearchChange={setWebSearch}
              verbosityId={verbosityId}
              onVerbosityChange={setVerbosityId}
              reasoningEffort={reasoningEffort}
              onReasoningEffortChange={setReasoningEffort}
              keyVal={keyVal}
              onKeyChange={setKeyVal}
              activeThreadKeyToken={chat.activeThread?.keyToken}
            />

            <Divider />

            {/* New chat + import */}
            <Box sx={{ p: 1.5, display: 'flex', gap: 1 }}>
              <Button
                fullWidth
                variant="outlined"
                startIcon={<AddIcon />}
                onClick={chat.newThread}
                size="small"
              >
                New chat
              </Button>
              <Tooltip title="Import thread">
                <IconButton size="small" onClick={() => importInputRef.current?.click()}>
                  <FileUploadIcon fontSize="small" />
                </IconButton>
              </Tooltip>
              <input
                ref={importInputRef}
                type="file"
                accept="application/json"
                hidden
                onChange={handleImportFile}
              />
            </Box>
            {importError && (
              <Box sx={{ px: 1.5, pb: 1 }}>
                <Typography variant="caption" color="error">
                  {importError}
                </Typography>
              </Box>
            )}

            {/* Persistence status — transparency for where thread history
                actually lives, driven by litellm.aiConversation.persistence config. */}
            <Box sx={{ px: 1.5, pb: 1 }}>
              <Tooltip title={persistenceTooltip}>
                <Typography variant="caption" color="text.secondary">
                  {config.persistence.enabled
                    ? `History saved to your account${config.persistence.ttlDays > 0 ? ` · ${config.persistence.ttlDays}d retention` : ''}`
                    : 'History stored only in this browser'}
                </Typography>
              </Tooltip>
            </Box>

            {/* Search */}
            <Box sx={{ px: 1.5, pb: 1 }}>
              <InputBase
                fullWidth
                placeholder="Search threads…"
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                startAdornment={<SearchIcon fontSize="small" sx={{ mr: 0.75, color: 'text.secondary' }} />}
                sx={{
                  border: 1,
                  borderColor: 'divider',
                  borderRadius: 2,
                  px: 1,
                  py: 0.5,
                  fontSize: '0.85rem',
                }}
              />
            </Box>

            {/* Thread list */}
            <Box sx={{ flex: 1, overflowY: 'auto', minHeight: 0 }}>
              <List dense>
                {visibleThreads.map(t => (
                  <ListItem
                    key={t.id}
                    disablePadding
                    secondaryAction={
                      <IconButton edge="end" size="small" onClick={e => openThreadMenu(e, t.id)}>
                        <MoreVertIcon fontSize="small" />
                      </IconButton>
                    }
                  >
                    <ListItemButton
                      selected={chat.activeThread?.id === t.id}
                      onClick={() => chat.selectThread(t.id)}
                      sx={{ pr: 6 }}
                    >
                      {t.pinned && <PushPinIcon fontSize="small" sx={{ mr: 0.75, color: 'text.secondary' }} />}
                      <ListItemText
                        primary={t.title}
                        primaryTypographyProps={{ noWrap: true, variant: 'body2' }}
                        secondaryTypographyProps={{ noWrap: true, variant: 'caption' }}
                      />
                    </ListItemButton>
                  </ListItem>
                ))}
                {visibleThreads.length === 0 && (
                  <Typography variant="caption" color="text.secondary" sx={{ px: 2, py: 1, display: 'block' }}>
                    {searchQuery ? 'No threads match your search.' : 'No threads yet.'}
                  </Typography>
                )}
              </List>
            </Box>

            <Menu anchorEl={threadMenuAnchor} open={!!threadMenuAnchor} onClose={closeThreadMenu}>
              <MenuItem
                onClick={() => {
                  if (threadMenuTarget) chat.togglePin(threadMenuTarget);
                  closeThreadMenu();
                }}
              >
                <ListItemIcon>
                  {menuTargetThread?.pinned ? (
                    <PushPinIcon fontSize="small" />
                  ) : (
                    <PushPinOutlinedIcon fontSize="small" />
                  )}
                </ListItemIcon>
                {menuTargetThread?.pinned ? 'Unpin' : 'Pin'}
              </MenuItem>
              <MenuItem
                onClick={() => {
                  if (threadMenuTarget) chat.exportThread(threadMenuTarget);
                  closeThreadMenu();
                }}
              >
                <ListItemIcon>
                  <FileDownloadIcon fontSize="small" />
                </ListItemIcon>
                Export
              </MenuItem>
              <MenuItem
                onClick={() => {
                  if (threadMenuTarget) chat.deleteThread(threadMenuTarget);
                  closeThreadMenu();
                }}
              >
                <ListItemIcon>
                  <DeleteIcon fontSize="small" />
                </ListItemIcon>
                Delete
              </MenuItem>
            </Menu>
          </>
        )}
      </Box>

      {/* ─── Center: chat column ─── */}
      <Box
        sx={{
          flex: 3,
          display: 'flex',
          justifyContent: 'center',
          overflow: 'hidden',
        }}
      >
        <Box
          sx={{
            width: '100%',
            maxWidth: CHAT_MAX_WIDTH,
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
          }}
        >
          {/* Fixed header */}
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
            <Tooltip title={rightPanelCollapsed ? 'Show context panel' : 'Hide context panel'}>
              <IconButton size="small" onClick={() => setRightPanelCollapsed(v => !v)}>
                {rightPanelCollapsed ? <ChevronLeftIcon fontSize="small" /> : <ChevronRightIcon fontSize="small" />}
              </IconButton>
            </Tooltip>
          </Box>

          {/* Error banner */}
          {chat.error && (
            <Box sx={{ px: 2, pt: 1 }}>
              <ErrorBanner error={chat.error} onDismiss={() => {}} />
            </Box>
          )}

          {/* Scrollable messages */}
          <Box
            ref={messagesContainerRef}
            sx={{
              flex: 1,
              overflowY: 'auto',
              minHeight: 0,
            }}
          >
            {messages.length === 0 ? (
              <PersonaHomepage
                personas={personas}
                loading={personasLoading}
                error={personasError}
                selectedId={personaId}
                onSelect={handlePersonaChange}
              />
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

          {/* #url attachment chip */}
          {(urlPreviewLoading || urlPreview || urlPreviewError) && (
            <Box sx={{ px: 2, pt: 1 }}>
              {urlPreviewChip}
            </Box>
          )}

          {/* Fixed composer */}
          <Box
            sx={{
              flexShrink: 0,
              borderTop: 1,
              borderColor: 'divider',
              px: 2,
              py: 1.5,
              display: 'flex',
              gap: 1,
              alignItems: 'flex-end',
            }}
          >
            <InputBase
              multiline
              minRows={1}
              maxRows={5}
              fullWidth
              placeholder={
                keyVal.token
                  ? 'Send a message…  (Enter to send, Shift+Enter for newline)'
                  : 'Generate a chat key in Settings to start…'
              }
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              disabled={!keyVal.token}
              sx={{
                border: 1,
                borderColor: 'divider',
                borderRadius: 2,
                px: 1.5,
                py: 0.75,
                fontSize: '0.9rem',
              }}
            />
            {isStreaming ? (
              <Tooltip title="Stop">
                <IconButton color="error" onClick={chat.stopGeneration}>
                  <StopIcon />
                </IconButton>
              </Tooltip>
            ) : (
              <Tooltip title="Send">
                <IconButton
                  color="primary"
                  onClick={handleSend}
                  disabled={
                    !input.trim() || !keyVal.token || (compareMode && compareModelsSel.length === 0)
                  }
                >
                  <SendIcon />
                </IconButton>
              </Tooltip>
            )}
          </Box>

          {/* Status strip */}
          {statusParts.length > 0 && (
            <Box sx={{ px: 2, pb: 1 }}>
              <Typography variant="caption" color="text.secondary">
                {statusParts.join(' · ')}
              </Typography>
            </Box>
          )}
        </Box>
      </Box>

      {/* ─── Right sidebar: sources + usage ─── */}
      {!rightPanelCollapsed && (
        <Box
          sx={{
            width: RIGHT_RAIL_WIDTH,
            flexShrink: 0,
            borderLeft: 1,
            borderColor: 'divider',
            display: 'flex',
            flexDirection: 'column',
            overflowY: 'auto',
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
      )}
    </Box>
  );
};
