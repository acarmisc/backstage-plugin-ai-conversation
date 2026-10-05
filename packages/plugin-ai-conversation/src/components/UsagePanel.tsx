import React from 'react';
import { Box, LinearProgress, Typography, useTheme } from '@mui/material';
import { MONO_FONT_STACK, RADIUS, surface, subtleBorder } from '../theme';
import type { KeySpend, UsageInfo } from '../types';

export interface UsagePanelProps {
  lastTurnUsage: UsageInfo | null;
  totalTokens: number;
  keySpend: KeySpend | null;
  keyAlias?: string;
  keyExpiresAt?: number;
}

function formatUsd(n: number): string {
  return `$${n.toFixed(2)}`;
}

function formatTimeRemaining(expiresAt: number | undefined): string {
  if (!expiresAt) return '';
  const now = Date.now();
  const ms = expiresAt - now;
  if (ms <= 0) return 'expired';

  const totalSeconds = Math.floor(ms / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);

  if (hours > 0) {
    return `${hours}h ${minutes}m`;
  }
  return `${minutes}m`;
}

function getBudgetColor(budgetPct: number | null) {
  if (budgetPct === null) return 'primary';
  if (budgetPct >= 95) return 'error';
  if (budgetPct >= 80) return 'warning';
  return 'primary';
}

const StatTile: React.FC<{ label: string; value: string }> = ({ label, value }) => {
  const theme = useTheme();
  return (
    <Box
      sx={{
        p: 1.25,
        bgcolor: surface(theme, 1),
        borderRadius: RADIUS.sm,
        border: subtleBorder(theme),
      }}
    >
      <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 0.5 }}>
        {label}
      </Typography>
      <Typography variant="body2" fontWeight={600}>
        {value}
      </Typography>
    </Box>
  );
};

export const UsagePanel: React.FC<UsagePanelProps> = ({
  lastTurnUsage,
  totalTokens,
  keySpend,
  keyAlias,
  keyExpiresAt,
}) => {
  const theme = useTheme();
  const budgetPct =
    keySpend?.max_budget && keySpend.max_budget > 0
      ? Math.min(100, (keySpend.spend / keySpend.max_budget) * 100)
      : null;
  const timeRemaining = formatTimeRemaining(keyExpiresAt);

  if (!lastTurnUsage && !keySpend) {
    return (
      <Box sx={{ p: 2, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: 200 }}>
        <Typography variant="body2" color="text.secondary" sx={{ textAlign: 'center' }}>
          Send a message to see token and budget usage.
        </Typography>
      </Box>
    );
  }

  return (
    <Box sx={{ p: 2 }}>
      {/* 2x2 stat tiles grid */}
      {lastTurnUsage && (
        <Box
          sx={{
            display: 'grid',
            gridTemplateColumns: '1fr 1fr',
            gap: 1,
            mb: 2,
          }}
        >
          <StatTile
            label="This turn"
            value={`${lastTurnUsage.total_tokens.toLocaleString()} tokens`}
          />
          <StatTile
            label="Session total"
            value={`${totalTokens.toLocaleString()} tokens`}
          />
          <StatTile
            label="Prompt"
            value={`${lastTurnUsage.prompt_tokens.toLocaleString()}`}
          />
          <StatTile
            label="Completion"
            value={`${lastTurnUsage.completion_tokens.toLocaleString()}`}
          />
        </Box>
      )}

      {/* Budget card */}
      {keySpend && (
        <Box
          sx={{
            p: 1.5,
            bgcolor: surface(theme, 1),
            borderRadius: RADIUS.md,
            border: subtleBorder(theme),
          }}
        >
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', mb: 1 }}>
            <Typography variant="subtitle2" fontWeight={600}>
              Budget
            </Typography>
            <Typography variant="caption" color="text.secondary">
              {keySpend.max_budget != null ? `${formatUsd(keySpend.spend)} of ${formatUsd(keySpend.max_budget)}` : `${formatUsd(keySpend.spend)}`}
            </Typography>
          </Box>

          {keySpend.max_budget != null && (
            <Box sx={{ mb: 1.5 }}>
              <LinearProgress
                variant="determinate"
                value={budgetPct ?? 0}
                sx={{
                  borderRadius: '4px',
                  height: 6,
                  backgroundColor: theme.palette.mode === 'light'
                    ? 'rgba(0, 0, 0, 0.08)'
                    : 'rgba(255, 255, 255, 0.12)',
                }}
                color={getBudgetColor(budgetPct)}
              />
            </Box>
          )}

          {keyAlias && (
            <Typography
              variant="caption"
              sx={{
                display: 'block',
                fontFamily: MONO_FONT_STACK,
                fontSize: '0.75rem',
                color: 'text.secondary',
                mb: 0.5,
                wordBreak: 'break-all',
              }}
            >
              {keyAlias}
            </Typography>
          )}

          {timeRemaining && (
            <Typography variant="caption" color="text.secondary">
              expires in {timeRemaining}
            </Typography>
          )}
        </Box>
      )}
    </Box>
  );
};
