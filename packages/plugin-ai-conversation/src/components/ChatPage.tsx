import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Box,
  Button,
  Collapse,
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
import AttachFileIcon from '@mui/icons-material/AttachFile';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import HistoryIcon from '@mui/icons-material/History';
import { convertFileListToFileUIParts } from 'ai';
import type { FileUIPart } from 'ai';
import { useApi, identityApiRef } from '@backstage/core-plugin-api';
import { aiConversationApiRef } from '../api';
import { useThreads } from '../hooks/useThreads';
import { extractText } from '../hooks/messageShape';
import { injectDesignSystemAssets } from '../theme';
import { ChatSettingsPanel } from './ChatSettingsPanel';
import { MessageList } from './MessageList';
import { ErrorBanner } from './ErrorBanner';
import { SourcesPanel } from './SourcesPanel';
import { UsagePanel } from './UsagePanel';
import type { ChatConfig, ChatTraits, ReasoningEffort, Thread, UrlContextPreview } from '../types';

const SIDEBAR_WIDTH = 280;
const SIDEBAR_RAIL_WIDTH = 48;
const RIGHT_RAIL_WIDTH = 300;
const CHAT_MAX_WIDTH = 900;
const URL_TOKEN_RE = /#(https:\/\/\S+)/;
const URL_PREVIEW_DEBOUNCE_MS = 500;
// Mirrors plugin-ai-conversation-backend/src/attachments.ts — kept in sync
// manually since the two packages don't share a types module. A mismatch
// here just means the user sees a later 400 instead of an earlier one.
const MAX_ATTACHMENTS_PER_MESSAGE = 4;
const ALLOWED_ATTACHMENT_MEDIA_TYPES = 'image/png,image/jpeg,image/webp,image/gif';

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
  const [vectorStoreIds, setVectorStoreIds] = useState<string[]>([]);
  const [webSearch, setWebSearch] = useState(false);
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
  const [searchQuery, setSearchQuery] = useState('');
  const [historyOpen, setHistoryOpen] = useState(false);
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
  const [stagedFiles, setStagedFiles] = useState<FileUIPart[]>([]);
  const [attachError, setAttachError] = useState<string | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const importInputRef = useRef<HTMLInputElement>(null);
  const attachInputRef = useRef<HTMLInputElement>(null);
  const pendingSendRef = useRef<{
    text: string;
    attachedUrl?: { url: string; title: string };
    files?: FileUIPart[];
  } | null>(null);

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
    identityApi
      .getCredentials()
      .then(c => setUserId(c.token ? 'oidc' : 'default'))
      .catch(() => {});
  }, [chatApi, identityApi]);

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
    topK: 5,
    webSearch,
    persistenceEnabled: config.persistence.enabled,
  });

  // Restore the selected thread's own model/KBs/key into Settings
  // whenever the active thread changes — otherwise sending a message in an
  // older thread silently uses whatever is currently picked, not what that
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
    setKeyVal({ alias: chat.activeThread.keyAlias, token: chat.activeThread.keyToken });
    setWebSearch(!!chat.activeThread.webSearch);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeThreadId]);

  // Fires a message queued by handleSend() when it had to create a new
  // thread first — chat.newThread()'s setState is async, so chat.sendMessage
  // (bound to the pre-creation, still-null activeThread) can't be called in
  // the same tick. Waiting for activeThreadId to actually change and sending
  // from here (against the freshly re-rendered `chat`) avoids the no-op that
  // a same-tick or requestAnimationFrame call would silently hit.
  useEffect(() => {
    if (!pendingSendRef.current || !activeThreadId) return;
    const pending = pendingSendRef.current;
    pendingSendRef.current = null;
    chat.sendMessage(pending.text, pending.attachedUrl, undefined, pending.files);
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

  const handleSend = async () => {
    if (!input.trim() || isStreaming) return;
    let currentKey = keyVal;
    // Auto-mint a chat key on first message if none exists yet.
    if (!currentKey.token) {
      try {
        const keyInfo = await chatApi.mintChatKey();
        currentKey = { alias: keyInfo.key_alias, token: keyInfo.key };
        setKeyVal(currentKey);
      } catch {
        return; // key mint failed — silently abort
      }
    }
    const text = input.trim();
    const activeUrlMatch = text.match(URL_TOKEN_RE)?.[1];
    const attachedUrl =
      activeUrlMatch && urlPreview?.url === activeUrlMatch && activeUrlMatch !== dismissedUrl
        ? { url: urlPreview.url, title: urlPreview.title }
        : undefined;
    const files = stagedFiles.length > 0 ? stagedFiles : undefined;
    if (!chat.activeThread) {
      // No "New chat" click required — just typing and sending starts one.
      // newThread()'s setState is async, so the actual send is queued and
      // fired by the activeThreadId effect once the new thread is live.
      // currentKey is passed explicitly since it may have just been minted
      // above — chat.newThread's own keyAlias/keyToken closure predates that
      // mint and would otherwise bake in a stale empty key.
      pendingSendRef.current = { text, attachedUrl, files };
      chat.newThread(currentKey);
    } else {
      chat.sendMessage(text, attachedUrl, undefined, files);
    }
    setInput('');
    setUrlPreview(null);
    setUrlPreviewError(null);
    setDismissedUrl(null);
    setStagedFiles([]);
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

  const handleAttachFiles = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const fileList = e.target.files ?? undefined;
    e.target.value = '';
    if (!fileList?.length) return;
    if (stagedFiles.length + fileList.length > MAX_ATTACHMENTS_PER_MESSAGE) {
      setAttachError(`You can attach up to ${MAX_ATTACHMENTS_PER_MESSAGE} images per message`);
      return;
    }
    try {
      const parts = await convertFileListToFileUIParts(fileList);
      setStagedFiles(prev => [...prev, ...parts]);
      setAttachError(null);
    } catch {
      setAttachError('Failed to read attached file');
    }
  };

  const removeStagedFile = (index: number) => {
    setStagedFiles(prev => prev.filter((_, i) => i !== index));
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
              <IconButton onClick={() => chat.newThread()}>
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
              showSettings={showSettings}
              onToggleShowSettings={() => setShowSettings(v => !v)}
              configError={configError}
              config={config}
              traits={traits}
              traitsLoading={traitsLoading}
              toneId={toneId}
              onToneChange={setToneId}
              focusId={focusId}
              onFocusChange={setFocusId}
              customSystemPrompt={customSystemPrompt}
              onCustomSystemPromptChange={setCustomSystemPrompt}
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
            />

            <Divider />

            {/* New chat + import */}
            <Box sx={{ p: 1.5, display: 'flex', gap: 1 }}>
              <Button
                fullWidth
                variant="outlined"
                startIcon={<AddIcon />}
                onClick={() => chat.newThread()}
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

            {/* ── History (collapsible, default collapsed) ── */}
            <Box
              sx={{
                display: 'flex',
                alignItems: 'center',
                cursor: 'pointer',
                px: 1.5,
                py: 1,
                bgcolor: 'action.hover',
              }}
              onClick={() => setHistoryOpen(v => !v)}
            >
              <HistoryIcon fontSize="small" sx={{ mr: 1 }} />
              <Typography variant="overline" sx={{ flex: 1 }}>
                History
              </Typography>
              {config.persistence.enabled && (
                <Tooltip title={persistenceTooltip}>
                  <Typography variant="caption" color="text.secondary" sx={{ mr: 0.5 }}>
                    {config.persistence.ttlDays > 0 ? `${config.persistence.ttlDays}d` : 'saved'}
                  </Typography>
                </Tooltip>
              )}
              <ExpandMoreIcon
                fontSize="small"
                sx={{
                  transform: historyOpen ? 'rotate(180deg)' : 'none',
                  transition: 'transform 0.2s',
                }}
              />
            </Box>
            <Collapse in={historyOpen}>
              <Box sx={{ display: 'flex', flexDirection: 'column', minHeight: 0 }}>
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
              </Box>
            </Collapse>

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
              <Box sx={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
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

          {/* #url attachment chip */}
          {(urlPreviewLoading || urlPreview || urlPreviewError) && (
            <Box sx={{ px: 2, pt: 1 }}>
              {urlPreviewChip}
            </Box>
          )}

          {/* Staged file attachments */}
          {(stagedFiles.length > 0 || attachError) && (
            <Box sx={{ px: 2, pt: 1, display: 'flex', gap: 0.5, flexWrap: 'wrap' }}>
              {stagedFiles.map((f, i) => (
                <Chip
                  key={i}
                  size="small"
                  icon={<AttachFileIcon fontSize="small" />}
                  label={f.filename ?? f.mediaType}
                  variant="outlined"
                  onDelete={() => removeStagedFile(i)}
                  deleteIcon={<CloseIcon fontSize="small" />}
                />
              ))}
              {attachError && (
                <Chip
                  size="small"
                  color="error"
                  label={attachError}
                  variant="outlined"
                  onDelete={() => setAttachError(null)}
                  deleteIcon={<CloseIcon fontSize="small" />}
                />
              )}
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
            <Tooltip title="Attach image">
              <IconButton size="small" onClick={() => attachInputRef.current?.click()}>
                <AttachFileIcon fontSize="small" />
              </IconButton>
            </Tooltip>
            <input
              ref={attachInputRef}
              type="file"
              accept={ALLOWED_ATTACHMENT_MEDIA_TYPES}
              multiple
              hidden
              onChange={handleAttachFiles}
            />
            <InputBase
              multiline
              minRows={1}
              maxRows={5}
              fullWidth
              placeholder="Send a message…  (Enter to send, Shift+Enter for newline)"
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
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
                  disabled={!input.trim()}
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
