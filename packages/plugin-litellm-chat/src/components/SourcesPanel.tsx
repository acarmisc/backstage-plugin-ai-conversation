import React from 'react';
import { Box, Chip, Typography } from '@mui/material';
import type { Citation } from '../types';

export interface SourcesPanelProps {
  citations: Citation[];
}

export const SourcesPanel: React.FC<SourcesPanelProps> = ({ citations }) => {
  return (
    <Box sx={{ p: 1.5 }}>
      <Typography variant="overline" color="text.secondary">
        Sources
      </Typography>
      {citations.length === 0 ? (
        <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
          No sources for the latest reply yet.
        </Typography>
      ) : (
        citations.map((c, i) => (
          <Box key={i} sx={{ mt: 1.5 }}>
            <Box sx={{ display: 'flex', gap: 1, alignItems: 'center', flexWrap: 'wrap' }}>
              <Typography variant="body2" fontWeight={500}>
                {c.filename}
              </Typography>
              <Chip size="small" label={c.score.toFixed(3)} color="primary" variant="outlined" />
            </Box>
            <Typography
              variant="body2"
              color="text.secondary"
              sx={{
                mt: 0.5,
                whiteSpace: 'pre-wrap',
                maxHeight: 120,
                overflow: 'auto',
                fontFamily: 'monospace',
                fontSize: '0.75rem',
              }}
            >
              {c.snippet}
            </Typography>
          </Box>
        ))
      )}
    </Box>
  );
};
