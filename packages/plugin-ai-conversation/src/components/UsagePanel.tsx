import React from 'react';
import { Box, Divider, LinearProgress, Typography } from '@mui/material';
import type { KeySpend, UsageInfo } from '../types';

export interface UsagePanelProps {
  lastTurnUsage: UsageInfo | null;
  totalTokens: number;
  keySpend: KeySpend | null;
}

function formatUsd(n: number): string {
  return `$${n.toFixed(4)}`;
}

const Stat: React.FC<{ label: string; value: string }> = ({ label, value }) => (
  <Box sx={{ display: 'flex', justifyContent: 'space-between', py: 0.25 }}>
    <Typography variant="body2" color="text.secondary">
      {label}
    </Typography>
    <Typography variant="body2" fontWeight={500}>
      {value}
    </Typography>
  </Box>
);

export const UsagePanel: React.FC<UsagePanelProps> = ({
  lastTurnUsage,
  totalTokens,
  keySpend,
}) => {
  const budgetPct =
    keySpend?.max_budget && keySpend.max_budget > 0
      ? Math.min(100, (keySpend.spend / keySpend.max_budget) * 100)
      : null;

  return (
    <Box sx={{ p: 1.5 }}>
      <Typography variant="overline" color="text.secondary">
        Usage
      </Typography>
      {!lastTurnUsage && !keySpend ? (
        <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
          Send a message to see token and budget usage.
        </Typography>
      ) : (
        <Box sx={{ mt: 0.5 }}>
          {lastTurnUsage && (
            <>
              <Stat label="This turn" value={`${lastTurnUsage.total_tokens.toLocaleString()} tokens`} />
              <Stat label="Prompt / completion" value={`${lastTurnUsage.prompt_tokens.toLocaleString()} / ${lastTurnUsage.completion_tokens.toLocaleString()}`} />
              <Stat label="Session total" value={`${totalTokens.toLocaleString()} tokens`} />
            </>
          )}
          {keySpend && (
            <>
              <Divider sx={{ my: 1 }} />
              <Stat label="Spent" value={formatUsd(keySpend.spend)} />
              {keySpend.max_budget != null && (
                <>
                  <Stat label="Budget" value={`${formatUsd(keySpend.spend)} / ${formatUsd(keySpend.max_budget)}`} />
                  <LinearProgress
                    variant="determinate"
                    value={budgetPct ?? 0}
                    sx={{ mt: 0.5, borderRadius: 1, height: 6 }}
                    color={budgetPct != null && budgetPct > 90 ? 'error' : 'primary'}
                  />
                </>
              )}
            </>
          )}
        </Box>
      )}
    </Box>
  );
};
