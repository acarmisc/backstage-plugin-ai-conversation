import React, { useEffect, useState, useRef } from 'react';
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
  Collapse,
  Tooltip,
  InputBase,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import DeleteIcon from '@mui/icons-material/Delete';
import SettingsIcon from '@mui/icons-material/Settings';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import ChatIcon from '@mui/icons-material/Chat';
import SendIcon from '@mui/icons-material/Send';
import StopIcon from '@mui/icons-material/Stop';
import { useApi, identityApiRef } from '@backstage/core-plugin-api';
import { liteLlmChatApiRef } from '../api';
import { useChat } from '../hooks/useChat';
import { ModelPicker } from './ModelPicker';
import { VectorStorePicker } from './VectorStorePicker';
import { PersonaPicker } from './PersonaPicker';
import { KeyPicker } from './KeyPicker';
import { MessageList } from './MessageList';
import { ErrorBanner } from './ErrorBanner';
import { SourcesPanel } from './SourcesPanel';
import { UsagePanel } from './UsagePanel';
import type { ChatConfig } from '../types';

const SIDEBAR_WIDTH = 280;
const RIGHT_RAIL_WIDTH = 300;
const CHAT_MAX_WIDTH = 900;

export const ChatPage: React.FC = () => {
  const chatApi = useApi(liteLlmChatApiRef);
  const identityApi = useApi(identityApiRef);

  const [userId, setUserId] = useState('default');
  const [config, setConfig] = useState<ChatConfig>({
    defaultModel: null,
    defaultVectorStoreIds: null,
    maxRequestBudget: null,
  });

  const [model, setModel] = useState('');
  const [vectorStoreIds, setVectorStoreIds] = useState<string[]>([]);
  const [personaId, setPersonaId] = useState('');
  const [keyVal, setKeyVal] = useState<{ alias: string; token: string }>({
    alias: '',
    token: '',
  });
  const [showSettings, setShowSettings] = useState(true);
  const [input, setInput] = useState('');
  const [configError, setConfigError] = useState<string | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    chatApi
      .getChatConfig()
      .then(setConfig)
      .catch(err => setConfigError(err.message ?? 'Failed to reach the chat backend'));
    identityApi
      .getCredentials()
      .then(c => setUserId(c.token ? 'oidc' : 'default'))
      .catch(() => {});
  }, [chatApi, identityApi]);

  const chat = useChat({
    userId,
    model,
    vectorStoreIds,
    personaId,
    keyAlias: keyVal.alias,
    keyToken: keyVal.token,
    topK: 5,
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
    setKeyVal({ alias: chat.activeThread.keyAlias, token: chat.activeThread.keyToken });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeThreadId]);

  // Auto-scroll to bottom when messages update or streaming.
  const messages = chat.activeThread?.messages ?? [];
  const isStreaming = chat.isStreaming;
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isStreaming]);

  const handleSend = () => {
    if (!input.trim() || !keyVal.token || isStreaming) return;
    if (!chat.activeThread) {
      chat.newThread();
    }
    chat.sendMessage(input.trim());
    setInput('');
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
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
      statusParts.push(`$${chat.keySpend.spend.toFixed(2)} / $${chat.keySpend.max_budget.toFixed(2)} budget`);
    }
  }

  return (
    <Box sx={{ display: 'flex', height: '100dvh', overflow: 'hidden' }}>
      {/* ─── Left sidebar: settings on top + threads ─── */}
      <Box
        sx={{
          width: SIDEBAR_WIDTH,
          flexShrink: 0,
          borderRight: 1,
          borderColor: 'divider',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
        }}
      >
        {/* Settings panel (collapsible, pinned to top) */}
        <Box sx={{ flexShrink: 0 }}>
          <Box
            sx={{
              display: 'flex',
              alignItems: 'center',
              cursor: 'pointer',
              px: 1.5,
              py: 1,
              bgcolor: 'action.hover',
            }}
            onClick={() => setShowSettings(v => !v)}
          >
            <SettingsIcon fontSize="small" sx={{ mr: 1 }} />
            <Typography variant="overline" sx={{ flex: 1 }}>
              Settings
            </Typography>
            <ExpandMoreIcon
              fontSize="small"
              sx={{
                transform: showSettings ? 'rotate(180deg)' : 'none',
                transition: 'transform 0.2s',
              }}
            />
          </Box>
          <Collapse in={showSettings}>
            <Box sx={{ p: 1.5, display: 'flex', flexDirection: 'column', gap: 1.5 }}>
              {configError && (
                <Typography variant="caption" color="error">
                  Couldn't load chat defaults: {configError}
                </Typography>
              )}
              <PersonaPicker
                value={personaId}
                onChange={(id, persona) => {
                  setPersonaId(id);
                  if (persona?.defaultModel) setModel(persona.defaultModel);
                  if (persona?.defaultVectorStoreIds) {
                    setVectorStoreIds(persona.defaultVectorStoreIds);
                  }
                }}
              />
              <ModelPicker value={model} onChange={setModel} defaultModel={config.defaultModel} />
              <VectorStorePicker
                value={vectorStoreIds}
                onChange={setVectorStoreIds}
                defaultVectorStoreIds={config.defaultVectorStoreIds}
              />
              <KeyPicker
                value={keyVal}
                onChange={setKeyVal}
                onDelete={() => {
                  if (chat.activeThread?.keyToken) {
                    chatApi.deleteChatKey(chat.activeThread.keyToken).catch(() => {});
                  }
                }}
              />
            </Box>
          </Collapse>
        </Box>

        <Divider />

        {/* New chat */}
        <Box sx={{ p: 1.5 }}>
          <Button
            fullWidth
            variant="outlined"
            startIcon={<AddIcon />}
            onClick={chat.newThread}
            size="small"
          >
            New chat
          </Button>
        </Box>

        {/* Thread list */}
        <Box sx={{ flex: 1, overflowY: 'auto', minHeight: 0 }}>
          <List dense>
            {chat.threads.map(t => (
              <ListItem
                key={t.id}
                disablePadding
                secondaryAction={
                  <IconButton
                    edge="end"
                    size="small"
                    onClick={e => {
                      e.stopPropagation();
                      chat.deleteThread(t.id);
                    }}
                  >
                    <DeleteIcon fontSize="small" />
                  </IconButton>
                }
              >
                <ListItemButton
                  selected={chat.activeThread?.id === t.id}
                  onClick={() => chat.selectThread(t.id)}
                  sx={{ pr: 6 }}
                >
                  <ListItemText
                    primary={t.title}
                    primaryTypographyProps={{ noWrap: true, variant: 'body2' }}
                    secondaryTypographyProps={{ noWrap: true, variant: 'caption' }}
                  />
                </ListItemButton>
              </ListItem>
            ))}
          </List>
        </Box>
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
            <MessageList messages={messages} isStreaming={isStreaming} />
            <div ref={messagesEndRef} />
          </Box>

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
                  disabled={!input.trim() || !keyVal.token}
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
    </Box>
  );
};
