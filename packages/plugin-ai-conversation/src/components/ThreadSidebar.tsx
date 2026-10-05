import React, { useMemo, useState } from 'react';
import {
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
  Divider,
  IconButton,
  List,
  ListItem,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Menu,
  MenuItem,
  TextField,
  Tooltip,
  Typography,
  useTheme,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import ChevronLeftIcon from '@mui/icons-material/ChevronLeft';
import ChevronRightIcon from '@mui/icons-material/ChevronRight';
import DeleteIcon from '@mui/icons-material/Delete';
import EditIcon from '@mui/icons-material/Edit';
import FileDownloadIcon from '@mui/icons-material/FileDownload';
import FileUploadIcon from '@mui/icons-material/FileUpload';
import MoreVertIcon from '@mui/icons-material/MoreVert';
import PushPinIcon from '@mui/icons-material/PushPin';
import PushPinOutlinedIcon from '@mui/icons-material/PushPinOutlined';
import SearchIcon from '@mui/icons-material/Search';
import StorageIcon from '@mui/icons-material/Storage';
import BarChartIcon from '@mui/icons-material/BarChart';

import { groupThreadsByDate, threadMatchesQuery } from '../utils/threadGroups';
import type { ChatConfig, Thread } from '../types';

export const SIDEBAR_WIDTH = 272;
export const SIDEBAR_RAIL_WIDTH = 56;


/** Short label for where conversations are kept. */
export function getPersistenceLabel(config: ChatConfig): string {
  if (!config.persistence.enabled) return 'Stored in this browser';
  if (config.persistence.ttlDays > 0) {
    return `Saved to your account · ${config.persistence.ttlDays} days`;
  }
  return 'Saved to your account';
}

/** Explains where conversations live, given the active persistence mode. */
export function getPersistenceTooltip(config: ChatConfig): string {
  if (!config.persistence.enabled) {
    return 'Conversations are stored only in this browser and are lost if browser data is cleared.';
  }
  if (config.persistence.ttlDays > 0) {
    return `Conversations are saved to your account and deleted after ${config.persistence.ttlDays} days of inactivity.`;
  }
  return 'Conversations are saved to your account and kept indefinitely.';
}

export interface ThreadSidebarProps {
  collapsed: boolean;
  onToggleCollapsed: () => void;

  config: ChatConfig;
  threads: Thread[];
  activeThreadId: string | null;
  onNewThread: () => void;
  onSelectThread: (id: string) => void;
  onDeleteThread: (id: string) => void;
  onTogglePin: (id: string) => void;
  onRenameThread?: (id: string, title: string) => void;
  onExportThread: (id: string) => void;
  onExportMarkdown?: (id: string) => void;
  onImportFile: (e: React.ChangeEvent<HTMLInputElement>) => void;
  importError: string | null;
  searchInputRef?: React.RefObject<HTMLInputElement>;
}

/**
 * Left sidebar: brand, new chat, search, thread history (grouped by date),
 * and footer (import, storage info, analytics).
 */
export const ThreadSidebar: React.FC<ThreadSidebarProps> = ({
  collapsed,
  onToggleCollapsed,
  config,
  threads,
  activeThreadId,
  onNewThread,
  onSelectThread,
  onDeleteThread,
  onTogglePin,
  onRenameThread,
  onExportThread,
  onExportMarkdown,
  onImportFile,
  importError,
  searchInputRef,
}) => {
  const theme = useTheme();
  const [searchQuery, setSearchQuery] = useState('');
  const [menuAnchor, setMenuAnchor] = useState<HTMLElement | null>(null);
  const [menuTarget, setMenuTarget] = useState<string | null>(null);
  const [renamingThreadId, setRenamingThreadId] = useState<string | null>(null);
  const [renamingValue, setRenamingValue] = useState('');
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const importInputRef = React.useRef<HTMLInputElement>(null);

  const visibleThreads = useMemo(
    () => threads.filter(t => threadMatchesQuery(t, searchQuery)),
    [threads, searchQuery],
  );

  const groupedThreads = useMemo(() => groupThreadsByDate(visibleThreads), [visibleThreads]);

  const menuThread = threads.find(t => t.id === menuTarget) ?? null;
  const persistenceTooltip = getPersistenceTooltip(config);

  const handleOpenMenu = (e: React.MouseEvent<HTMLElement>, threadId: string) => {
    e.stopPropagation();
    setMenuAnchor(e.currentTarget);
    setMenuTarget(threadId);
  };

  const handleCloseMenu = () => {
    setMenuAnchor(null);
    setMenuTarget(null);
  };

  const handleStartRename = (threadId: string, currentTitle: string) => {
    setRenamingThreadId(threadId);
    setRenamingValue(currentTitle);
    handleCloseMenu();
  };

  const handleSaveRename = () => {
    if (renamingValue.trim() && onRenameThread) {
      onRenameThread(renamingThreadId!, renamingValue.trim());
    }
    setRenamingThreadId(null);
  };

  const handleCancelRename = () => {
    setRenamingThreadId(null);
  };

  const handleDeleteClick = (threadId: string) => {
    setDeleteConfirmId(threadId);
    handleCloseMenu();
  };

  const handleConfirmDelete = () => {
    if (deleteConfirmId) {
      onDeleteThread(deleteConfirmId);
    }
    setDeleteConfirmId(null);
  };

  if (collapsed) {
    // Icon rail
    return (
      <Box
        sx={{
          width: SIDEBAR_RAIL_WIDTH,
          flexShrink: 0,
          borderRight: 1,
          borderColor: 'divider',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          py: 1,
          gap: 1,
        }}
      >
        {/* Brand icon */}
        <Tooltip title="Expand sidebar" placement="right">
          <IconButton size="small" aria-label="Expand sidebar" onClick={onToggleCollapsed}>
            <ChevronRightIcon fontSize="small" />
          </IconButton>
        </Tooltip>

        {/* New chat */}
        <Tooltip title="New chat (⌘⇧O)" placement="right">
          <IconButton onClick={onNewThread} size="small">
            <AddIcon fontSize="small" />
          </IconButton>
        </Tooltip>

        {/* Search (expands) */}
        <Tooltip title="Search (⌘K)" placement="right">
          <IconButton onClick={onToggleCollapsed} size="small">
            <SearchIcon fontSize="small" />
          </IconButton>
        </Tooltip>

        {/* Expand button */}
        <Tooltip title="Expand" placement="right">
          <IconButton onClick={onToggleCollapsed} size="small">
            <ChevronRightIcon fontSize="small" />
          </IconButton>
        </Tooltip>
      </Box>
    );
  }

  // Full sidebar
  return (
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
      {/* Brand row */}
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          px: 1.5,
          py: 1,
          gap: 1,
          flexShrink: 0,
        }}
      >
        <Typography variant="h6" sx={{ flex: 1 }}>
          Conversations
        </Typography>
        <Tooltip title="Collapse sidebar">
          <IconButton size="small" onClick={onToggleCollapsed}>
            <ChevronLeftIcon fontSize="small" />
          </IconButton>
        </Tooltip>
      </Box>

      {/* New chat button */}
      <Box sx={{ px: 1.5, py: 1, flexShrink: 0 }}>
        <Button
          fullWidth
          variant="contained"
          startIcon={<AddIcon />}
          onClick={onNewThread}
          size="small"
          title="New chat (⌘⇧O)"
          sx={{
            textTransform: 'none',
          }}
        >
          New chat
        </Button>
      </Box>

      {/* Search */}
      <Box sx={{ px: 1.5, pb: 1, flexShrink: 0 }}>
        <TextField
          inputRef={searchInputRef}
          fullWidth
          size="small"
          placeholder="Search conversations"
          value={searchQuery}
          onChange={e => setSearchQuery(e.target.value)}
          variant="outlined"
          InputProps={{
            startAdornment: (
              <SearchIcon fontSize="small" sx={{ mr: 0.75, color: 'text.secondary' }} />
            ),
          }}
        />
      </Box>

      {/* Thread history - always visible, scrollable */}
      <Box sx={{ flex: 1, overflowY: 'auto', minHeight: 0, px: 1 }}>
        {groupedThreads.length > 0 ? (
          groupedThreads.map(group => (
            <Box key={group.label} sx={{ mb: 2 }}>
              {/* Group label */}
              <Typography
                variant="caption"
                sx={{
                  display: 'block',
                  px: 1,
                  py: 1,
                  color: theme.palette.text.secondary,
                  fontWeight: 500,
                  textTransform: 'uppercase',
                  letterSpacing: 0.06,
                  fontSize: '0.65rem',
                }}
              >
                {group.label}
              </Typography>

              {/* Threads in group */}
              <List dense sx={{ p: 0 }}>
                {group.threads.map(thread => (
                  <ListItem
                    key={thread.id}
                    disablePadding
                    sx={{
                      mb: 0.5,
                      '&:hover .thread-menu-button': {
                        opacity: 1,
                      },
                    }}
                  >
                    {renamingThreadId === thread.id ? (
                      // Inline rename input
                      <Box sx={{ width: '100%', px: 1, py: 0.5 }}>
                        <TextField
                          // Shown only after an explicit rename action, so focus belongs here.
                          // eslint-disable-next-line jsx-a11y/no-autofocus
                          autoFocus
                          fullWidth
                          size="small"
                          value={renamingValue}
                          onChange={e => setRenamingValue(e.target.value)}
                          onBlur={handleSaveRename}
                          onKeyDown={e => {
                            if (e.key === 'Enter') handleSaveRename();
                            if (e.key === 'Escape') handleCancelRename();
                          }}
                        />
                      </Box>
                    ) : (
                      <ListItemButton
                        selected={activeThreadId === thread.id}
                        onClick={() => onSelectThread(thread.id)}
                        sx={{
                          py: 0.75,
                          px: 1,
                          width: '100%',
                          position: 'relative',
                        }}
                      >
                        <ListItemText
                          primary={
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
                              {thread.pinned && (
                                <PushPinIcon
                                  fontSize="small"
                                  sx={{ color: 'text.secondary', flexShrink: 0 }}
                                />
                              )}
                              <Typography
                                variant="body2"
                                noWrap
                                sx={{
                                  flex: 1,
                                }}
                              >
                                {thread.title}
                              </Typography>
                            </Box>
                          }
                          primaryTypographyProps={{ noWrap: true }}
                        />
                        <Tooltip title="Options">
                          <IconButton
                            className="thread-menu-button"
                            edge="end"
                            size="small"
                            onClick={e => handleOpenMenu(e, thread.id)}
                            sx={{
                              ml: 1,
                              opacity: 0,
                              transition: 'opacity 0.2s',
                            }}
                          >
                            <MoreVertIcon fontSize="small" />
                          </IconButton>
                        </Tooltip>
                      </ListItemButton>
                    )}
                  </ListItem>
                ))}
              </List>
            </Box>
          ))
        ) : (
          <Typography
            variant="body2"
            sx={{
              color: theme.palette.text.secondary,
              textAlign: 'center',
              py: 3,
          }}
          >
            {searchQuery ? 'No threads match your search.' : 'No conversations yet.'}
          </Typography>
        )}
      </Box>

      <Divider />

      {/* Footer */}
      <List dense disablePadding sx={{ flexShrink: 0, py: 0.5 }}>
        <ListItemButton onClick={() => importInputRef.current?.click()}>
          <ListItemIcon sx={{ minWidth: 36 }}>
            <FileUploadIcon fontSize="small" />
          </ListItemIcon>
          <ListItemText primary="Import conversation" />
        </ListItemButton>
        <input
          ref={importInputRef}
          type="file"
          accept="application/json"
          hidden
          onChange={onImportFile}
        />
        {importError && (
          <ListItem>
            <ListItemText primary={importError} primaryTypographyProps={{ color: 'error', variant: 'caption' }} />
          </ListItem>
        )}
        <ListItemButton component="a" href="/ai-conversation/analytics">
          <ListItemIcon sx={{ minWidth: 36 }}>
            <BarChartIcon fontSize="small" />
          </ListItemIcon>
          <ListItemText primary="Analytics" />
        </ListItemButton>
        <Tooltip title={persistenceTooltip} placement="right">
          <ListItem>
            <ListItemIcon sx={{ minWidth: 36 }}>
              <StorageIcon fontSize="small" />
            </ListItemIcon>
            <ListItemText
              primary={getPersistenceLabel(config)}
              primaryTypographyProps={{ variant: 'caption', color: 'text.secondary' }}
            />
          </ListItem>
        </Tooltip>
      </List>

      {/* Thread menu */}
      <Menu anchorEl={menuAnchor} open={!!menuAnchor} onClose={handleCloseMenu}>
        {onRenameThread && (
          <MenuItem onClick={() => handleStartRename(menuTarget!, menuThread?.title || '')}>
            <EditIcon fontSize="small" sx={{ mr: 1 }} />
            Rename
          </MenuItem>
        )}
        <MenuItem
          onClick={() => {
            if (menuTarget) onTogglePin(menuTarget);
            handleCloseMenu();
          }}
        >
          {menuThread?.pinned ? (
            <PushPinIcon fontSize="small" sx={{ mr: 1 }} />
          ) : (
            <PushPinOutlinedIcon fontSize="small" sx={{ mr: 1 }} />
          )}
          {menuThread?.pinned ? 'Unpin' : 'Pin'}
        </MenuItem>
        {onExportMarkdown && (
          <MenuItem
            onClick={() => {
              if (menuTarget) onExportMarkdown(menuTarget);
              handleCloseMenu();
            }}
          >
            <FileDownloadIcon fontSize="small" sx={{ mr: 1 }} />
            Export Markdown
          </MenuItem>
        )}
        <MenuItem
          onClick={() => {
            if (menuTarget) onExportThread(menuTarget);
            handleCloseMenu();
          }}
        >
          <FileDownloadIcon fontSize="small" sx={{ mr: 1 }} />
          Export JSON
        </MenuItem>
        <MenuItem onClick={() => handleDeleteClick(menuTarget!)}>
          <DeleteIcon fontSize="small" sx={{ mr: 1 }} />
          Delete
        </MenuItem>
      </Menu>

      {/* Delete confirmation dialog */}
      <Dialog
        open={!!deleteConfirmId}
        onClose={() => setDeleteConfirmId(null)}
      >
        <DialogTitle>Delete this conversation?</DialogTitle>
        <DialogContent>
          <DialogContentText>
            This action cannot be undone.
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteConfirmId(null)}>Cancel</Button>
          <Button onClick={handleConfirmDelete} variant="contained" color="error">
            Delete
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};
