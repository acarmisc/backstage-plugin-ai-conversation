import React, { useEffect, useMemo, useState } from 'react';
import {
  Box,
  Button,
  Checkbox,
  Popover,
  Stack,
  Typography,
  useTheme,
} from '@mui/material';
import CompareArrowsIcon from '@mui/icons-material/CompareArrows';
import { filterModelsByTeam } from './modelFilter';
import type { ChatTeamInfo } from '../types';
import type { ModelInfo } from '@acarmisc/backstage-plugin-litellm';

export interface ComparePopoverProps {
  open: boolean;
  anchorEl: HTMLElement | null;
  onClose: () => void;
  models: ModelInfo[];
  selectedTeam?: ChatTeamInfo | null;
  selectedModels: string[];
  onEnable: (models: string[]) => void;
  onDisable: () => void;
  isEnabled: boolean;
}

/**
 * Popover to select 2-3 models for compare mode.
 * Allows filtering by team and enabling/disabling the mode.
 */
export const ComparePopover: React.FC<ComparePopoverProps> = ({
  open,
  anchorEl,
  onClose,
  models,
  selectedTeam,
  selectedModels,
  onEnable,
  onDisable,
  isEnabled,
}) => {
  const theme = useTheme();
  const [tempModels, setTempModels] = useState<string[]>(selectedModels);
  // Start from the conversation's current choice every time it opens.
  useEffect(() => {
    if (open) setTempModels(selectedModels);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const filteredModels = useMemo(
    () => filterModelsByTeam(models, selectedTeam?.models),
    [models, selectedTeam?.models],
  );

  const handleToggleModel = (modelId: string) => {
    setTempModels(prev => {
      if (prev.includes(modelId)) {
        return prev.filter(m => m !== modelId);
      } else if (prev.length < 3) {
        return [...prev, modelId];
      }
      return prev;
    });
  };

  const handleEnable = () => {
    if (tempModels.length >= 2) {
      onEnable(tempModels);
    }
  };

  const handleDisable = () => {
    onDisable();
    onClose();
  };

  const canEnable = tempModels.length >= 2 && tempModels.length <= 3;

  return (
    <Popover
      open={open}
      anchorEl={anchorEl}
      onClose={() => {
        onClose();
        setTempModels(selectedModels);
      }}
      anchorOrigin={{
        vertical: 'bottom',
        horizontal: 'center',
      }}
      transformOrigin={{
        vertical: 'top',
        horizontal: 'center',
      }}
    >
      <Box sx={{ p: 2, minWidth: 320 }}>
        <Stack spacing={2}>
          <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>
            <Stack direction="row" spacing={1} sx={{ alignItems: 'center' }}>
              <CompareArrowsIcon fontSize="small" />
              <span>Compare models</span>
            </Stack>
          </Typography>

          <Typography variant="body2" sx={{ color: theme.palette.text.secondary }}>
            Select 2–3 models to see side-by-side responses. Team scoping applies.
          </Typography>

          <Stack spacing={1} sx={{ maxHeight: 300, overflowY: 'auto' }}>
            {filteredModels.map(model => (
              <Box
                key={model.model_name}
                sx={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 1,
                  p: 1,
                  borderRadius: '4px',
                  '&:hover': {
                    backgroundColor: theme.palette.action.hover,
                  },
                }}
              >
                <Checkbox
                  size="small"
                  checked={tempModels.includes(model.model_name)}
                  onChange={() => handleToggleModel(model.model_name)}
                  disabled={
                    !tempModels.includes(model.model_name) && tempModels.length >= 3
                  }
                />
                <Box sx={{ flex: 1, minWidth: 0 }}>
                  <Typography
                    variant="body2"
                    noWrap
                    sx={{
                      fontWeight: 500,
                    }}
                  >
                    {model.model_name}
                  </Typography>
                </Box>
              </Box>
            ))}
          </Stack>

          <Typography variant="caption" sx={{ color: theme.palette.text.secondary }}>
            {tempModels.length > 0 && (
              <>
                {tempModels.length} / 3 selected
                {!canEnable && tempModels.length < 2 && ' (need at least 2)'}
              </>
            )}
          </Typography>

          <Stack direction="row" spacing={1}>
            <Button
              fullWidth
              variant="contained"
              size="small"
              onClick={handleEnable}
              disabled={!canEnable}
            >
              {isEnabled ? 'Update' : 'Compare'} ({tempModels.length})
            </Button>
            {isEnabled ? (
              <Button fullWidth variant="outlined" size="small" onClick={handleDisable}>
                Turn off
              </Button>
            ) : (
              <Button fullWidth variant="outlined" size="small" onClick={onClose}>
                Cancel
              </Button>
            )}
          </Stack>
        </Stack>
      </Box>
    </Popover>
  );
};
