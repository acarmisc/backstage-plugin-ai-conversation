import React from 'react';
import { Box, LinearProgress, Table, TableBody, TableCell, TableContainer, TableRow, Typography, Paper } from '@mui/material';
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

export const UsagePanel: React.FC<UsagePanelProps> = ({
  lastTurnUsage,
  totalTokens,
  keySpend,
  keyAlias,
  keyExpiresAt,
}) => {
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
      {/* Usage stats table */}
      {lastTurnUsage && (
        <TableContainer component={Paper} variant="outlined" sx={{ mb: 2 }}>
          <Table size="small">
            <TableBody>
              <TableRow>
                <TableCell>This turn</TableCell>
                <TableCell align="right">{lastTurnUsage.total_tokens.toLocaleString()} tokens</TableCell>
              </TableRow>
              <TableRow>
                <TableCell>Session total</TableCell>
                <TableCell align="right">{totalTokens.toLocaleString()} tokens</TableCell>
              </TableRow>
              <TableRow>
                <TableCell>Prompt</TableCell>
                <TableCell align="right">{lastTurnUsage.prompt_tokens.toLocaleString()}</TableCell>
              </TableRow>
              <TableRow>
                <TableCell>Completion</TableCell>
                <TableCell align="right">{lastTurnUsage.completion_tokens.toLocaleString()}</TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </TableContainer>
      )}

      {/* Budget section */}
      {keySpend && (
        <Paper variant="outlined" sx={{ p: 1.5 }}>
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
                color={getBudgetColor(budgetPct)}
              />
            </Box>
          )}

          {keyAlias && (
            <Typography
              variant="caption"
              sx={{
                display: 'block',
                fontFamily: 'monospace',
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
        </Paper>
      )}
    </Box>
  );
};
