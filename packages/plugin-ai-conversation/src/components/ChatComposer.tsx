import React, { useState } from 'react';
import {
  Avatar,
  Badge,
  Box,
  Button,
  Chip,
  IconButton,
  InputBase,
  LinearProgress,
  Paper,
  Stack,
  Tooltip,
  Typography,
  useTheme,
} from '@mui/material';
import AttachFileIcon from '@mui/icons-material/AttachFile';
import CloseIcon from '@mui/icons-material/Close';
import GroupsIcon from '@mui/icons-material/Groups';
import LinkIcon from '@mui/icons-material/Link';
import MenuBookIcon from '@mui/icons-material/MenuBook';
import PsychologyIcon from '@mui/icons-material/Psychology';
import StopIcon from '@mui/icons-material/Stop';
import TuneIcon from '@mui/icons-material/Tune';
import AutoAwesomeIcon from '@mui/icons-material/AutoAwesome';
import SendIcon from '@mui/icons-material/Send';
import type { FileUIPart } from 'ai';

import { ComposerPill } from './ComposerPill';
import { TeamPicker } from './TeamPicker';
import { ModelPicker } from './ModelPicker';
import { VectorStorePicker } from './VectorStorePicker';
import { SkillPicker } from './SkillPicker';
import { SettingsDrawer, hasCustomSettings } from './SettingsDrawer';
import type { ChatConfig, ChatTeamInfo, ChatTraits, ReasoningEffort, Skill, UrlContextPreview } from '../types';

import { ALLOWED_ATTACHMENT_MEDIA_TYPES } from '../hooks/useStagedFiles';

export interface ChatComposerProps {
  input: string;
  onInputChange: (value: string) => void;
  onKeyDown: (e: React.KeyboardEvent) => void;
  onSend: () => void;
  isStreaming: boolean;
  onStop: () => void;

  stagedFiles: FileUIPart[];
  onRemoveStagedFile: (index: number) => void;
  attachError: string | null;
  onDismissAttachError: () => void;
  attachInputRef: React.RefObject<HTMLInputElement>;
  composerInputRef?: React.RefObject<HTMLTextAreaElement>;
  onAttachFiles: (e: React.ChangeEvent<HTMLInputElement>) => void;
  /** Pasted or dropped files. */
  onAddFiles: (files: File[]) => void;

  urlPreview: UrlContextPreview | null;
  urlPreviewLoading: boolean;
  urlPreviewError: string | null;
  onDismissUrlPreview: () => void;

  // New props for settings + pickers
  config: ChatConfig;
  teams: ChatTeamInfo[];
  teamsLoading: boolean;
  teamsError?: string | null;
  skills: Skill[];

  teamId: string;
  onTeamChange: (teamId: string) => void;
  model: string;
  onModelChange: (modelId: string) => void;
  vectorStoreIds: string[];
  onVectorStoreIdsChange: (ids: string[]) => void;
  teamVectorStores?: string[] | null;
  skillId: string;
  onSkillChange: (skillId: string) => void;

  toneId: string;
  onToneChange: (id: string) => void;
  focusId: string;
  onFocusChange: (id: string) => void;
  verbosityId: string;
  onVerbosityChange: (id: string) => void;
  reasoningEffort: ReasoningEffort | '';
  onReasoningEffortChange: (value: ReasoningEffort | '') => void;
  webSearch: boolean;
  onWebSearchChange: (enabled: boolean) => void;
  customSystemPrompt: string;
  onCustomSystemPromptChange: (value: string) => void;
  traits: ChatTraits;
  traitsLoading: boolean;

  keySpend?: { spend: number; max_budget: number | null } | null;
}

const UrlPreviewChip: React.FC<{
  loading: boolean;
  error: string | null;
  preview: UrlContextPreview | null;
  onDismiss: () => void;
}> = ({ loading, error, preview, onDismiss }) => {
  if (loading) {
    return (
      <Chip
        size="small"
        icon={<LinkIcon fontSize="small" />}
        label="Fetching page…"
        variant="outlined"
      />
    );
  }
  if (error) {
    return (
      <Chip
        size="small"
        color="error"
        icon={<LinkIcon fontSize="small" />}
        label={error}
        variant="outlined"
        onDelete={onDismiss}
        deleteIcon={<CloseIcon fontSize="small" />}
      />
    );
  }
  if (preview) {
    return (
      <Tooltip title={preview.url}>
        <Chip
          size="small"
          icon={<LinkIcon fontSize="small" />}
          label={`Page attached: ${preview.title}`}
          variant="outlined"
          onDelete={onDismiss}
          deleteIcon={<CloseIcon fontSize="small" />}
        />
      </Tooltip>
    );
  }
  return null;
};

/**
 * Composer with new design: card-based layout, pill-based toolbar (Team/Model/KB/Skill),
 * Tune drawer button, attach/send buttons, and budget status.
 */
export const ChatComposer: React.FC<ChatComposerProps> = ({
  input,
  onInputChange,
  onKeyDown,
  onSend,
  isStreaming,
  onStop,
  stagedFiles,
  onRemoveStagedFile,
  attachError,
  onDismissAttachError,
  attachInputRef,
  composerInputRef,
  onAttachFiles,
  onAddFiles,
  urlPreview,
  urlPreviewLoading,
  urlPreviewError,
  onDismissUrlPreview,
  config,
  teams,
  teamsLoading,
  teamsError,
  skills,
  teamId,
  onTeamChange,
  model,
  onModelChange,
  vectorStoreIds,
  onVectorStoreIdsChange,
  teamVectorStores,
  skillId,
  onSkillChange,
  toneId,
  onToneChange,
  focusId,
  onFocusChange,
  verbosityId,
  onVerbosityChange,
  reasoningEffort,
  onReasoningEffortChange,
  webSearch,
  onWebSearchChange,
  customSystemPrompt,
  onCustomSystemPromptChange,
  traits,
  traitsLoading,
  keySpend,
}) => {
  const theme = useTheme();
  const [settingsDrawerOpen, setSettingsDrawerOpen] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const canSend = !!input.trim() || stagedFiles.length > 0;

  const hasFiles = (dt: DataTransfer | null) => !!dt && Array.from(dt.types).includes('Files');

  // Pasted images become attachments; pasted text keeps its default
  // behaviour.
  const handlePaste = (e: React.ClipboardEvent) => {
    const files = Array.from(e.clipboardData?.files ?? []);
    if (!files.length) return;
    e.preventDefault();
    onAddFiles(files);
  };

  const handleDragOver = (e: React.DragEvent) => {
    if (!hasFiles(e.dataTransfer)) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = 'copy';
    setDragOver(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    if (e.currentTarget.contains(e.relatedTarget as Node | null)) return;
    setDragOver(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    if (!hasFiles(e.dataTransfer)) return;
    e.preventDefault();
    setDragOver(false);
    onAddFiles(Array.from(e.dataTransfer.files));
  };

  const showUrlChip = urlPreviewLoading || !!urlPreview || !!urlPreviewError;
  const showAttachments = stagedFiles.length > 0 || !!attachError;

  const selectedTeam = teams.find(t => t.team_id === teamId);
  const selectedSkill = skills.find(s => s.id === skillId);
  const kbCount = vectorStoreIds.length;

  const isTeamMissing = config.teamRequired && !teamId;

  // Budget status
  const budgetPercent = keySpend && keySpend.max_budget
    ? Math.min((keySpend.spend / keySpend.max_budget) * 100, 100)
    : 0;
  let budgetBarColor = theme.palette.primary.main;
  if (budgetPercent >= 95) budgetBarColor = theme.palette.error.main;
  else if (budgetPercent >= 80) budgetBarColor = theme.palette.warning.main;
  const budgetStatus =
    keySpend && keySpend.max_budget
      ? `$${keySpend.spend.toFixed(4)} of $${keySpend.max_budget.toFixed(2)} used`
      : '';

  return (
    <>
      {/* Main composer card */}
      <Box
        sx={{
          flexShrink: 0,
          px: 2,
          py: 1.5,
        }}
      >
        <Paper
          variant="outlined"
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          sx={{
            ...(dragOver ? { borderColor: 'primary.main' } : {}),
            display: 'flex',
            flexDirection: 'column',
            gap: 1.5,
            p: 2,
          }}
        >
          {/* Staged images and URL preview chips */}
          {(showUrlChip || showAttachments) && (
            <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap' }}>
              {showUrlChip && (
                <UrlPreviewChip
                  loading={urlPreviewLoading}
                  error={urlPreviewError}
                  preview={urlPreview}
                  onDismiss={onDismissUrlPreview}
                />
              )}
              {stagedFiles.map((f, i) => (
                <Chip
                  key={i}
                  size="small"
                  avatar={<Avatar variant="rounded" src={f.url} alt="" />}
                  label={f.filename ?? f.mediaType}
                  variant="outlined"
                  onDelete={() => onRemoveStagedFile(i)}
                  deleteIcon={<CloseIcon fontSize="small" />}
                />
              ))}
              {attachError && (
                <Chip
                  size="small"
                  color="error"
                  label={attachError}
                  variant="outlined"
                  onDelete={onDismissAttachError}
                  deleteIcon={<CloseIcon fontSize="small" />}
                />
              )}
            </Box>
          )}
          {/* Textarea */}
          <InputBase
            inputRef={composerInputRef}
            multiline
            minRows={1}
            maxRows={10}
            fullWidth
            placeholder="Ask anything… (type #https://… to add a page)"
            value={input}
            onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => onInputChange(e.target.value)}
            onKeyDown={onKeyDown}
            onPaste={handlePaste}
            inputProps={{
              'aria-label': 'Message',
            }}
            sx={{ typography: 'body1' }}
          />

          {/* Toolbar row: pills + attach + send */}
          <Stack
            direction="row"
            spacing={1}
            sx={{
              alignItems: 'flex-end',
              justifyContent: 'space-between',
            }}
          >
            {/* Left: pill selectors */}
            <Stack direction="row" spacing={0.75} sx={{ alignItems: 'center', flexWrap: 'wrap' }}>
              {/* Team pill */}
              <Tooltip title={isTeamMissing ? 'Select a team' : ''}>
                <Box sx={{ display: 'flex' }}>
                  <ComposerPill
                    icon={<GroupsIcon />}
                    label="Team"
                    value={selectedTeam?.team_alias || 'No team'}
                    isError={isTeamMissing}
                  >
                    <TeamPicker
                      value={teamId}
                      onChange={onTeamChange}
                      teams={teams}
                      loading={teamsLoading}
                      error={teamsError}
                      required={config.teamRequired}
                    />
                  </ComposerPill>
                </Box>
              </Tooltip>

              {/* Model pill - always mounted for default selection */}
              <ComposerPill
                icon={<AutoAwesomeIcon />}
                label="Model"
                value={model || 'Select'}
              >
                <ModelPicker
                  value={model}
                  onChange={onModelChange}
                  defaultModel={config.defaultModel}
                  excludedModels={config.excludedModels}
                  teamModels={selectedTeam?.models}
                />
              </ComposerPill>

              {/* Knowledge bases pill */}
              <ComposerPill
                icon={<MenuBookIcon />}
                label="Knowledge"
                value={kbCount > 0 ? `${kbCount}` : 'None'}
              >
                <VectorStorePicker
                  value={vectorStoreIds}
                  onChange={onVectorStoreIdsChange}
                  defaultVectorStoreIds={config.defaultVectorStoreIds}
                  extraStores={teamVectorStores}
                />
              </ComposerPill>

              {/* Skill pill */}
              <ComposerPill
                icon={<PsychologyIcon />}
                label="Skill"
                value={selectedSkill?.title || 'None'}
              >
                <SkillPicker
                  value={skillId}
                  skills={skills}
                  onChange={onSkillChange}
                />
              </ComposerPill>

              {/* Tune button - opens settings drawer */}
              <Tooltip title="Conversation settings">
                <Box sx={{ display: 'flex' }}>
                  <IconButton
                    aria-label="Conversation settings"
                    onClick={() => setSettingsDrawerOpen(true)}
                    size="small"
                  >
                    <Badge
                      variant="dot"
                      color="primary"
                      invisible={
                        !hasCustomSettings({
                          toneId,
                          focusId,
                          verbosityId,
                          reasoningEffort,
                          webSearch,
                          customSystemPrompt,
                        })
                      }
                    >
                      <TuneIcon fontSize="small" />
                    </Badge>
                  </IconButton>
                </Box>
              </Tooltip>
            </Stack>

            {/* Right: attach + send/stop */}
            <Stack direction="row" spacing={1} sx={{ alignItems: 'center' }}>
              {/* Attach button */}
              <Tooltip title="Attach images (or paste / drop them)">
                <IconButton
                  aria-label="Attach images"
                  size="small"
                  onClick={() => attachInputRef.current?.click()}
                >
                  <AttachFileIcon fontSize="small" />
                </IconButton>
              </Tooltip>
              <input
                ref={attachInputRef}
                type="file"
                accept={ALLOWED_ATTACHMENT_MEDIA_TYPES.join(',')}
                multiple
                hidden
                onChange={onAttachFiles}
              />

              {/* Send/Stop button */}
              {isStreaming ? (
                <Tooltip title="Stop generation (Esc)">
                  <Button
                    aria-label="Stop generation"
                    onClick={onStop}
                    size="small"
                    variant="outlined"
                    color="error"
                    startIcon={<StopIcon />}
                  >
                    Stop
                  </Button>
                </Tooltip>
              ) : (
                <Tooltip title={canSend ? 'Send (Enter)' : 'Type a message first'}>
                  <span>
                    <IconButton
                      aria-label="Send message"
                      onClick={onSend}
                      disabled={!canSend}
                      color="primary"
                    >
                      <SendIcon fontSize="small" />
                    </IconButton>
                  </span>
                </Tooltip>
              )}
            </Stack>
          </Stack>
        </Paper>

        {/* Budget line + hints */}
        <Box
          sx={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 2,
            mt: 1.5,
            px: 1,
          }}
        >
          {keySpend && keySpend.max_budget ? (
            <Box sx={{ flex: 1, minWidth: 0 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
                <Typography variant="caption" sx={{ color: theme.palette.text.secondary }}>
                  {budgetStatus}
                </Typography>
              </Box>
              <LinearProgress
                variant="determinate"
                value={budgetPercent}
                sx={{
                  '& .MuiLinearProgress-bar': {
                    backgroundColor: budgetBarColor,
                  },
                }}
              />
            </Box>
          ) : null}
          <Typography variant="caption" sx={{ color: theme.palette.text.secondary, whiteSpace: 'nowrap' }}>
            Enter to send · Shift+Enter for newline
          </Typography>
        </Box>
      </Box>

      {/* Settings drawer */}
      <SettingsDrawer
        open={settingsDrawerOpen}
        onClose={() => setSettingsDrawerOpen(false)}
        traits={traits}
        traitsLoading={traitsLoading}
        toneId={toneId}
        onToneChange={onToneChange}
        focusId={focusId}
        onFocusChange={onFocusChange}
        verbosityId={verbosityId}
        onVerbosityChange={onVerbosityChange}
        reasoningEffort={reasoningEffort}
        onReasoningEffortChange={onReasoningEffortChange}
        webSearch={webSearch}
        onWebSearchChange={onWebSearchChange}
        customSystemPrompt={customSystemPrompt}
        onCustomSystemPromptChange={onCustomSystemPromptChange}
        onResetDefaults={() => {
          onToneChange('');
          onFocusChange('');
          onVerbosityChange('');
          onReasoningEffortChange('');
          onWebSearchChange(false);
          onCustomSystemPromptChange('');
        }}
      />
    </>
  );
};
