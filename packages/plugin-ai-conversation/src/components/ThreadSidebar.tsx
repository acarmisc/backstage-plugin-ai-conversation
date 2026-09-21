import React, { useMemo, useState } from 'react';
import {
  Box,
  Button,
  Collapse,
  Divider,
  IconButton,
  InputBase,
  List,
  ListItem,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Menu,
  MenuItem,
  Tooltip,
  Typography,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import ChevronLeftIcon from '@mui/icons-material/ChevronLeft';
import ChevronRightIcon from '@mui/icons-material/ChevronRight';
import DeleteIcon from '@mui/icons-material/Delete';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import FileDownloadIcon from '@mui/icons-material/FileDownload';
import FileUploadIcon from '@mui/icons-material/FileUpload';
import HistoryIcon from '@mui/icons-material/History';
import MoreVertIcon from '@mui/icons-material/MoreVert';
import PushPinIcon from '@mui/icons-material/PushPin';
import PushPinOutlinedIcon from '@mui/icons-material/PushPinOutlined';
import SearchIcon from '@mui/icons-material/Search';
import SettingsIcon from '@mui/icons-material/Settings';
import { extractText } from '../hooks/messageShape';
import { ChatSettingsPanel } from './ChatSettingsPanel';

import type { ChatConfig, ChatTeamInfo, ChatTraits, ReasoningEffort, Skill, Thread } from '../types';

export const SIDEBAR_WIDTH = 280;
export const SIDEBAR_RAIL_WIDTH = 48;

/** Pinned first, then most-recently-updated. Shared with nothing else —
 * kept here since the sidebar is its only consumer. */
export function sortThreads(threads: Thread[]): Thread[] {
  return [...threads].sort((a, b) => {
    if (!!a.pinned !== !!b.pinned) return a.pinned ? -1 : 1;
    return b.updatedAt - a.updatedAt;
  });
}

function threadMatchesQuery(thread: Thread, query: string): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  if (thread.title.toLowerCase().includes(q)) return true;
  return thread.messages.some(m => extractText(m).toLowerCase().includes(q));
}

/** Explains where threads actually live, given the active persistence mode. */
export function getPersistenceTooltip(config: ChatConfig): string {
  if (!config.persistence.enabled) {
    return 'Threads are stored only in this browser (localStorage) and are lost if browser data is cleared.';
  }
  if (config.persistence.ttlDays > 0) {
    return `Threads are saved to your account and auto-deleted after ${config.persistence.ttlDays} days of inactivity.`;
  }
  return 'Threads are saved to your account and kept indefinitely.';
}

export interface ThreadSidebarProps {
  collapsed: boolean;
  onToggleCollapsed: () => void;

  config: ChatConfig;
  configError: string | null;
  traits: ChatTraits;
  traitsLoading: boolean;
  skills: Skill[];
  skillId: string;
  onSkillChange: (id: string) => void;
  toneId: string;
  onToneChange: (id: string) => void;
  focusId: string;
  onFocusChange: (id: string) => void;
  verbosityId: string;
  onVerbosityChange: (id: string) => void;
  customSystemPrompt: string;
  onCustomSystemPromptChange: (value: string) => void;
  teams: ChatTeamInfo[];
  teamsLoading: boolean;
  teamsError: string | null;
  teamId: string;
  onTeamChange: (teamId: string) => void;
  teamModels?: string[] | null;
  model: string;
  onModelChange: (model: string) => void;
  vectorStoreIds: string[];
  onVectorStoreIdsChange: (ids: string[]) => void;
  teamVectorStores?: string[] | null;
  webSearch: boolean;
  onWebSearchChange: (enabled: boolean) => void;
  reasoningEffort: ReasoningEffort | '';
  onReasoningEffortChange: (value: ReasoningEffort | '') => void;

  threads: Thread[];
  activeThreadId: string | null;
  onNewThread: () => void;
  onSelectThread: (id: string) => void;
  onDeleteThread: (id: string) => void;
  onTogglePin: (id: string) => void;
  onExportThread: (id: string) => void;
  onImportFile: (e: React.ChangeEvent<HTMLInputElement>) => void;
  importError: string | null;
}

/**
 * Left rail: collapsible settings panel, the new/import actions, and the
 * searchable thread history. Purely presentational — all thread and settings
 * state is owned by ChatPage.
 */
export const ThreadSidebar: React.FC<ThreadSidebarProps> = ({
  collapsed,
  onToggleCollapsed,
  config,
  configError,
  traits,
  traitsLoading,
  skills,
  skillId,
  onSkillChange,
  toneId,
  onToneChange,
  focusId,
  onFocusChange,
  verbosityId,
  onVerbosityChange,
  customSystemPrompt,
  onCustomSystemPromptChange,
  teams,
  teamsLoading,
  teamsError,
  teamId,
  onTeamChange,
  teamModels,
  model,
  onModelChange,
  vectorStoreIds,
  onVectorStoreIdsChange,
  teamVectorStores,
  webSearch,
  onWebSearchChange,
  reasoningEffort,
  onReasoningEffortChange,
  threads,
  activeThreadId,
  onNewThread,
  onSelectThread,
  onDeleteThread,
  onTogglePin,
  onExportThread,
  onImportFile,
  importError,
}) => {
  const [showSettings, setShowSettings] = useState(true);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [menuAnchor, setMenuAnchor] = useState<HTMLElement | null>(null);
  const [menuTarget, setMenuTarget] = useState<string | null>(null);
  const importInputRef = React.useRef<HTMLInputElement>(null);

  const visibleThreads = useMemo(
    () => sortThreads(threads.filter(t => threadMatchesQuery(t, searchQuery))),
    [threads, searchQuery],
  );

  const openMenu = (e: React.MouseEvent<HTMLElement>, threadId: string) => {
    e.stopPropagation();
    setMenuAnchor(e.currentTarget);
    setMenuTarget(threadId);
  };
  const closeMenu = () => {
    setMenuAnchor(null);
    setMenuTarget(null);
  };

  const menuThread = threads.find(t => t.id === menuTarget) ?? null;

  const persistenceTooltip = getPersistenceTooltip(config);

  return (
    <Box
      sx={{
        width: collapsed ? SIDEBAR_RAIL_WIDTH : SIDEBAR_WIDTH,
        flexShrink: 0,
        borderRight: 1,
        borderColor: 'divider',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
        transition: 'width 0.15s',
      }}
    >
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: collapsed ? 'center' : 'flex-end',
          px: 0.5,
          py: 0.5,
        }}
      >
        <Tooltip title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}>
          <IconButton size="small" onClick={onToggleCollapsed}>
            {collapsed ? (
              <ChevronRightIcon fontSize="small" />
            ) : (
              <ChevronLeftIcon fontSize="small" />
            )}
          </IconButton>
        </Tooltip>
      </Box>

      {collapsed ? (
        <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 1, pt: 1 }}>
          <Tooltip title="New chat" placement="right">
            <IconButton onClick={onNewThread}>
              <AddIcon />
            </IconButton>
          </Tooltip>
          <Tooltip title="Settings" placement="right">
            <IconButton onClick={onToggleCollapsed}>
              <SettingsIcon />
            </IconButton>
          </Tooltip>
        </Box>
      ) : (
        <>
          <ChatSettingsPanel
            showSettings={showSettings}
            onToggleShowSettings={() => setShowSettings(v => !v)}
            configError={configError}
            config={config}
            traits={traits}
            traitsLoading={traitsLoading}
            skills={skills}
            skillId={skillId}
            onSkillChange={onSkillChange}
            toneId={toneId}
            onToneChange={onToneChange}
            focusId={focusId}
            onFocusChange={onFocusChange}
            customSystemPrompt={customSystemPrompt}
            onCustomSystemPromptChange={onCustomSystemPromptChange}
            teams={teams}
            teamsLoading={teamsLoading}
            teamsError={teamsError}
            teamId={teamId}
            onTeamChange={onTeamChange}
            teamModels={teamModels}
            model={model}
            onModelChange={onModelChange}
            vectorStoreIds={vectorStoreIds}
            onVectorStoreIdsChange={onVectorStoreIdsChange}
            teamVectorStores={teamVectorStores}
            webSearch={webSearch}
            onWebSearchChange={onWebSearchChange}
            verbosityId={verbosityId}
            onVerbosityChange={onVerbosityChange}
            reasoningEffort={reasoningEffort}
            onReasoningEffortChange={onReasoningEffortChange}
          />

          <Divider />

          <Box sx={{ p: 1.5, display: 'flex', gap: 1 }}>
            <Button
              fullWidth
              variant="outlined"
              startIcon={<AddIcon />}
              onClick={onNewThread}
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
              onChange={onImportFile}
            />
          </Box>
          {importError && (
            <Box sx={{ px: 1.5, pb: 1 }}>
              <Typography variant="caption" color="error">
                {importError}
              </Typography>
            </Box>
          )}

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
              <Box sx={{ px: 1.5, pb: 1 }}>
                <InputBase
                  fullWidth
                  placeholder="Search threads…"
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  startAdornment={
                    <SearchIcon
                      fontSize="small"
                      sx={{ mr: 0.75, color: 'text.secondary' }}
                    />
                  }
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

              <Box sx={{ flex: 1, overflowY: 'auto', minHeight: 0 }}>
                <List dense>
                  {visibleThreads.map(t => (
                    <ListItem
                      key={t.id}
                      disablePadding
                      secondaryAction={
                        <IconButton
                          edge="end"
                          size="small"
                          aria-label={`Thread actions for ${t.title}`}
                          onClick={e => openMenu(e, t.id)}
                        >
                          <MoreVertIcon fontSize="small" />
                        </IconButton>
                      }
                    >
                      <ListItemButton
                        selected={activeThreadId === t.id}
                        onClick={() => onSelectThread(t.id)}
                        sx={{ pr: 6 }}
                      >
                        {t.pinned && (
                          <PushPinIcon
                            fontSize="small"
                            sx={{ mr: 0.75, color: 'text.secondary' }}
                          />
                        )}
                        <ListItemText
                          primary={t.title}
                          primaryTypographyProps={{ noWrap: true, variant: 'body2' }}
                          secondaryTypographyProps={{ noWrap: true, variant: 'caption' }}
                        />
                      </ListItemButton>
                    </ListItem>
                  ))}
                  {visibleThreads.length === 0 && (
                    <Typography
                      variant="caption"
                      color="text.secondary"
                      sx={{ px: 2, py: 1, display: 'block' }}
                    >
                      {searchQuery ? 'No threads match your search.' : 'No threads yet.'}
                    </Typography>
                  )}
                </List>
              </Box>
            </Box>
          </Collapse>

          <Menu anchorEl={menuAnchor} open={!!menuAnchor} onClose={closeMenu}>
            <MenuItem
              onClick={() => {
                if (menuTarget) onTogglePin(menuTarget);
                closeMenu();
              }}
            >
              <ListItemIcon>
                {menuThread?.pinned ? (
                  <PushPinIcon fontSize="small" />
                ) : (
                  <PushPinOutlinedIcon fontSize="small" />
                )}
              </ListItemIcon>
              {menuThread?.pinned ? 'Unpin' : 'Pin'}
            </MenuItem>
            <MenuItem
              onClick={() => {
                if (menuTarget) onExportThread(menuTarget);
                closeMenu();
              }}
            >
              <ListItemIcon>
                <FileDownloadIcon fontSize="small" />
              </ListItemIcon>
              Export
            </MenuItem>
            <MenuItem
              onClick={() => {
                if (menuTarget) onDeleteThread(menuTarget);
                closeMenu();
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
  );
};
