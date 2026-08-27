import React, { useEffect, useState } from 'react';
import { Box, Paper, Select, MenuItem, Typography, Alert } from '@mui/material';
import { useApi } from '@backstage/core-plugin-api';
import { aiConversationApiRef } from '../api';
import { BarList } from './BarList';
import type { FeedbackSummary, UsageSummaryRow } from '../types';

const RANGES = [
  { value: '24h', label: 'Last 24 hours' },
  { value: '7d', label: 'Last 7 days' },
  { value: '30d', label: 'Last 30 days' },
  { value: 'all', label: 'All time' },
];

/**
 * Admin analytics page — see AGENTS.md: this repo has no permission-policy
 * plumbing of its own (identity/auth is all inherited from govai), so
 * restricting this route to admins is a host-Backstage-app concern, same as
 * the sidebar nav entry and route registration done there for /ai-conversation.
 * Until that's wired up, this page is reachable by anyone who can reach
 * /ai-conversation/analytics — the data it shows is aggregate counts only (no
 * message content, no per-user breakdown), so the exposure is low, but it
 * is not actually admin-gated yet.
 */
export const AnalyticsPage: React.FC = () => {
  const chatApi = useApi(aiConversationApiRef);
  const [range, setRange] = useState('30d');
  const [byPersona, setByPersona] = useState<UsageSummaryRow[]>([]);
  const [byModel, setByModel] = useState<UsageSummaryRow[]>([]);
  const [feedback, setFeedback] = useState<FeedbackSummary | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    setError(null);
    Promise.all([
      chatApi.getUsageSummary('persona', range),
      chatApi.getUsageSummary('model', range),
      chatApi.getFeedbackSummary(),
    ])
      .then(([persona, model, fb]) => {
        if (!alive) return;
        setByPersona(persona);
        setByModel(model);
        setFeedback(fb);
      })
      .catch(err => {
        if (alive) setError(err.message ?? 'Failed to load analytics');
      })
      .finally(() => alive && setLoading(false));
    return () => {
      alive = false;
    };
  }, [chatApi, range]);

  const feedbackRows = feedback ? [{ key: '👍 up', count: feedback.up }, { key: '👎 down', count: feedback.down }] : [];

  return (
    <Box sx={{ p: 3, maxWidth: 900, mx: 'auto' }}>
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
        <Typography variant="h5">AI Chat analytics</Typography>
        <Select size="small" value={range} onChange={e => setRange(e.target.value as string)}>
          {RANGES.map(r => (
            <MenuItem key={r.value} value={r.value}>
              {r.label}
            </MenuItem>
          ))}
        </Select>
      </Box>

      {error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}

      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
        <Paper variant="outlined" sx={{ p: 2 }}>
          <Typography variant="subtitle1" sx={{ mb: 1.5 }}>
            Turns by persona
          </Typography>
          <BarList rows={byPersona} emptyLabel={loading ? 'Loading…' : 'No chat turns in this range.'} />
        </Paper>

        <Paper variant="outlined" sx={{ p: 2 }}>
          <Typography variant="subtitle1" sx={{ mb: 1.5 }}>
            Turns by model
          </Typography>
          <BarList rows={byModel} emptyLabel={loading ? 'Loading…' : 'No chat turns in this range.'} />
        </Paper>

        <Paper variant="outlined" sx={{ p: 2 }}>
          <Typography variant="subtitle1" sx={{ mb: 1.5 }}>
            Feedback (all time)
          </Typography>
          <BarList rows={feedbackRows} emptyLabel={loading ? 'Loading…' : 'No feedback recorded yet.'} />
        </Paper>
      </Box>
    </Box>
  );
};
