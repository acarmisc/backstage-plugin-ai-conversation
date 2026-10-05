import React from 'react';
import { Box, Typography } from '@mui/material';

export interface BarListProps {
  rows: Array<{ key: string; count: number }>;
  emptyLabel?: string;
}

// Deliberately dependency-free — a small hand-rolled horizontal bar chart
// rather than pulling in a charting library for two simple bar lists.
export const BarList: React.FC<BarListProps> = ({ rows, emptyLabel = 'No data yet.' }) => {
  if (rows.length === 0) {
    return (
      <Typography variant="body2" color="text.secondary">
        {emptyLabel}
      </Typography>
    );
  }
  const max = Math.max(...rows.map(r => r.count), 1);

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
      {rows.map(row => (
        <Box key={row.key} sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <Typography variant="body2" sx={{ width: 180, flexShrink: 0 }} noWrap title={row.key}>
            {row.key}
          </Typography>
          <Box sx={{ flex: 1, bgcolor: 'action.hover', borderRadius: 1, overflow: 'hidden', height: 18 }}>
            <Box
              sx={{
                width: `${(row.count / max) * 100}%`,
                height: '100%',
                bgcolor: 'primary.main',
                borderRadius: 1,
              }}
            />
          </Box>
          <Typography variant="body2" sx={{ width: 40, textAlign: 'right', flexShrink: 0 }}>
            {row.count}
          </Typography>
        </Box>
      ))}
    </Box>
  );
};
