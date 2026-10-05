import React, { useState } from 'react';
import {
  Box,
  Chip,
  IconButton,
  Menu,
  MenuItem,
  Stack,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material';
import ChevronRightIcon from '@mui/icons-material/ChevronRight';
import MoreVertIcon from '@mui/icons-material/MoreVert';
import CompareArrowsIcon from '@mui/icons-material/CompareArrows';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import FileDownloadIcon from '@mui/icons-material/FileDownload';
import HelpOutlineIcon from '@mui/icons-material/HelpOutline';
import { RADIUS, ACCENT_GRADIENT } from '../theme';
import type { Skill } from '../types';

export interface ChatHeaderProps {
  title: string;
  onRenameThread?: (newTitle: string) => void;
  skill?: Skill | null;
  vectorStoreCount?: number;
  webSearch?: boolean;
  compareMode?: boolean;
  compareModelCount?: number;
  onToggleRightPanel?: () => void;
  /** Opens the compare-mode model picker anchored on the button. */
  onCompareClick?: (anchor: HTMLElement) => void;
  onCopyAsMarkdown?: () => void;
  onExportMarkdown?: () => void;
  onExportJSON?: () => void;
  onShowShortcuts?: () => void;
}

export const ChatHeader: React.FC<ChatHeaderProps> = ({
  title,
  onRenameThread,
  skill,
  vectorStoreCount,
  webSearch,
  compareMode,
  compareModelCount,
  onToggleRightPanel,
  onCompareClick,
  onCopyAsMarkdown,
  onExportMarkdown,
  onExportJSON,
  onShowShortcuts,
}) => {
  const [isRenaming, setIsRenaming] = useState(false);
  const [renamingValue, setRenamingValue] = useState(title);
  const [menuAnchor, setMenuAnchor] = useState<HTMLElement | null>(null);

  const handleStartRename = () => {
    setRenamingValue(title);
    setIsRenaming(true);
    setMenuAnchor(null);
  };

  const handleSaveRename = () => {
    if (renamingValue.trim()) {
      onRenameThread?.(renamingValue.trim());
    }
    setIsRenaming(false);
  };

  const handleCancelRename = () => {
    setIsRenaming(false);
  };

  const handleTitleClick = () => {
    if (onRenameThread) {
      handleStartRename();
    }
  };

  return (
    <>
      <Box
        sx={{
          height: 56,
          px: 2,
          py: 1,
          borderBottom: 1,
          borderColor: 'divider',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 2,
          flexShrink: 0,
        }}
      >
        {/* Left: title */}
        <Box sx={{ flex: 1, minWidth: 0 }}>
          {isRenaming ? (
            <TextField
              // Shown only after an explicit rename action, so focus belongs here.
              // eslint-disable-next-line jsx-a11y/no-autofocus
              autoFocus
              size="small"
              value={renamingValue}
              onChange={e => setRenamingValue(e.target.value)}
              onBlur={handleSaveRename}
              onKeyDown={e => {
                if (e.key === 'Enter') handleSaveRename();
                if (e.key === 'Escape') handleCancelRename();
              }}
              sx={{ width: '100%' }}
            />
          ) : (
            <Typography
              variant="h6"
              noWrap
              onClick={handleTitleClick}
              sx={{
                fontWeight: 600,
                textOverflow: 'ellipsis',
                cursor: onRenameThread ? 'pointer' : 'default',
                '&:hover': onRenameThread
                  ? {
                      opacity: 0.7,
                    }
                  : {},
              }}
            >
              {title || 'New conversation'}
            </Typography>
          )}
        </Box>

        {/* Center: context chips */}
        <Stack direction="row" spacing={1} sx={{ alignItems: 'center' }}>
          {skill && (
            <Chip
              size="small"
              label={skill.title}
              variant="outlined"
              sx={{
                height: 24,
                fontSize: '0.75rem',
                borderRadius: RADIUS.pill,
              }}
            />
          )}
          {vectorStoreCount !== undefined && vectorStoreCount > 0 && (
            <Chip
              size="small"
              label={`${vectorStoreCount} knowledge base${vectorStoreCount !== 1 ? 's' : ''}`}
              variant="outlined"
              sx={{
                height: 24,
                fontSize: '0.75rem',
                borderRadius: RADIUS.pill,
              }}
            />
          )}
          {webSearch && (
            <Chip
              size="small"
              label="Web"
              variant="outlined"
              sx={{
                height: 24,
                fontSize: '0.75rem',
                borderRadius: RADIUS.pill,
              }}
            />
          )}
          {compareMode && compareModelCount !== undefined && compareModelCount > 0 && (
            <Chip
              size="small"
              label={`Compare ×${compareModelCount}`}
              variant="outlined"
              sx={{
                height: 24,
                fontSize: '0.75rem',
                borderRadius: RADIUS.pill,
                background: ACCENT_GRADIENT,
                color: 'white',
                border: 'none',
              }}
            />
          )}
        </Stack>

        {/* Right: action buttons */}
        <Stack direction="row" spacing={0.5}>
          {onCompareClick && (
            <Tooltip title="Compare models">
              <IconButton
                size="small"
                aria-label="Compare models"
                color={compareMode ? 'primary' : 'default'}
                onClick={e => onCompareClick(e.currentTarget)}
              >
                <CompareArrowsIcon fontSize="small" />
              </IconButton>
            </Tooltip>
          )}
          <Tooltip title="More options">
            <IconButton
              size="small"
              onClick={e => setMenuAnchor(e.currentTarget)}
              aria-controls="header-menu"
              aria-haspopup="true"
            >
              <MoreVertIcon fontSize="small" />
            </IconButton>
          </Tooltip>
          {onToggleRightPanel && (
            <Tooltip title="Toggle sources & usage">
              <IconButton size="small" onClick={onToggleRightPanel}>
                <ChevronRightIcon fontSize="small" />
              </IconButton>
            </Tooltip>
          )}
        </Stack>
      </Box>

      {/* More menu */}
      <Menu
        id="header-menu"
        anchorEl={menuAnchor}
        open={!!menuAnchor}
        onClose={() => setMenuAnchor(null)}
      >
        {onRenameThread && (
          <MenuItem onClick={handleStartRename}>
            {/* Icon would go here */}
            Rename
          </MenuItem>
        )}
        {onCopyAsMarkdown && (
          <MenuItem onClick={() => {
            onCopyAsMarkdown();
            setMenuAnchor(null);
          }}>
            <ContentCopyIcon fontSize="small" sx={{ mr: 1 }} />
            Copy conversation as Markdown
          </MenuItem>
        )}
        {onExportMarkdown && (
          <MenuItem onClick={() => {
            onExportMarkdown();
            setMenuAnchor(null);
          }}>
            <FileDownloadIcon fontSize="small" sx={{ mr: 1 }} />
            Export Markdown
          </MenuItem>
        )}
        {onExportJSON && (
          <MenuItem onClick={() => {
            onExportJSON();
            setMenuAnchor(null);
          }}>
            <FileDownloadIcon fontSize="small" sx={{ mr: 1 }} />
            Export JSON
          </MenuItem>
        )}
        {onShowShortcuts && (
          <MenuItem onClick={() => {
            onShowShortcuts();
            setMenuAnchor(null);
          }}>
            <HelpOutlineIcon fontSize="small" sx={{ mr: 1 }} />
            Keyboard shortcuts
          </MenuItem>
        )}
      </Menu>
    </>
  );
};
