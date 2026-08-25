import React from 'react';
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
  Menu,
  MenuItem,
  ListItemIcon,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import DeleteIcon from '@mui/icons-material/Delete';
import SettingsIcon from '@mui/icons-material/Settings';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import SearchIcon from '@mui/icons-material/Search';
import MoreVertIcon from '@mui/icons-material/MoreVert';
import PushPinIcon from '@mui/icons-material/PushPin';
import PushPinOutlinedIcon from '@mui/icons-material/PushPinOutlined';
import FileDownloadIcon from '@mui/icons-material/FileDownload';
import FileUploadIcon from '@mui/icons-material/FileUpload';
import ChevronLeftIcon from '@mui/icons-material/ChevronLeft';
import ChevronRightIcon from '@mui/icons-material/ChevronRight';
import type { Thread } from '../types';

export const SIDEBAR_WIDTH = 280;
export const SIDEBAR_RAIL_WIDTH = 48;

interface ThreadSidebarProps {
  collapsed: boolean;
  onToggleCollapsed: () => void;
  showSettings: boolean;
  onToggleShowSettings: () => void;
  settingsSlot: React.ReactNode;
  onNewThread: () => void;
  importInputRef: React.RefObject<HTMLInputElement>;
  onImportFile: (e: React.ChangeEvent<HTMLInputElement>) => void;
  importError: string | null;
  persistenceTooltip: string;
  persistenceText: string;
  searchQuery: string;
  onSearchQueryChange: (query: string) => void;
  visibleThreads: Thread[];
  activeThreadId: string | null;
  onSelectThread: (id: string) => void;
  threads: Thread[];
  menuAnchor: HTMLElement | null;
  menuTarget: string | null;
  onOpenMenu: (e: React.MouseEvent<HTMLElement>, threadId: string) => void;
  onCloseMenu: () => void;
  onTogglePin: (threadId: string) => void;
  onExport: (threadId: string) => void;
  onDelete: (threadId: string) => void;
}

export const ThreadSidebar: React.FC<ThreadSidebarProps> = ({
  collapsed,
  onToggleCollapsed,
  showSettings,
  onToggleShowSettings,
  settingsSlot,
  onNewThread,
  importInputRef,
  onImportFile,
  importError,
  persistenceTooltip,
  persistenceText,
  searchQuery,
  onSearchQueryChange,
  visibleThreads,
  activeThreadId,
  onSelectThread,
  threads,
  menuAnchor,
  menuTarget,
  onOpenMenu,
  onCloseMenu,
  onTogglePin,
  onExport,
  onDelete,
}) => {
  const menuTargetThread = threads.find(t => t.id === menuTarget) ?? null;

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
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: collapsed ? 'center' : 'flex-end', px: 0.5, py: 0.5 }}>
        <Tooltip title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}>
          <IconButton size="small" onClick={onToggleCollapsed}>
            {collapsed ? <ChevronRightIcon fontSize="small" /> : <ChevronLeftIcon fontSize="small" />}
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
              onClick={onToggleShowSettings}
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
                {settingsSlot}
              </Box>
            </Collapse>
          </Box>

          <Divider />

          {/* New chat + import */}
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

          {/* Persistence status — transparency for where thread history
              actually lives, driven by litellm.chat.persistence config. */}
          <Box sx={{ px: 1.5, pb: 1 }}>
            <Tooltip title={persistenceTooltip}>
              <Typography variant="caption" color="text.secondary">
                {persistenceText}
              </Typography>
            </Tooltip>
          </Box>

          {/* Search */}
          <Box sx={{ px: 1.5, pb: 1 }}>
            <InputBase
              fullWidth
              placeholder="Search threads…"
              value={searchQuery}
              onChange={e => onSearchQueryChange(e.target.value)}
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
                    <IconButton edge="end" size="small" onClick={e => onOpenMenu(e, t.id)}>
                      <MoreVertIcon fontSize="small" />
                    </IconButton>
                  }
                >
                  <ListItemButton
                    selected={activeThreadId === t.id}
                    onClick={() => onSelectThread(t.id)}
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

          <Menu anchorEl={menuAnchor} open={!!menuAnchor} onClose={onCloseMenu}>
            <MenuItem
              onClick={() => {
                if (menuTarget) onTogglePin(menuTarget);
                onCloseMenu();
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
                if (menuTarget) onExport(menuTarget);
                onCloseMenu();
              }}
            >
              <ListItemIcon>
                <FileDownloadIcon fontSize="small" />
              </ListItemIcon>
              Export
            </MenuItem>
            <MenuItem
              onClick={() => {
                if (menuTarget) onDelete(menuTarget);
                onCloseMenu();
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
