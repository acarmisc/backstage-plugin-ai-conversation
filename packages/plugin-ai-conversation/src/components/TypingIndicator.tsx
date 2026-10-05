import React from 'react';
import { Box, Skeleton } from '@mui/material';

export interface TypingIndicatorProps {
  /**
   * Number of skeleton lines. Default 3.
   */
  size?: number;
}

/**
 * Loading skeleton indicating that the assistant is typing.
 */
export const TypingIndicator: React.FC<TypingIndicatorProps> = ({ size = 3 }) => {
  const widths = size === 3 ? ['90%', '75%', '60%'] : Array(size).fill('100%').map((_, i) => {
    const pct = 100 - (i * 10);
    return `${Math.max(60, pct)}%`;
  });

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
      {widths.map((width, i) => (
        <Skeleton key={i} variant="text" width={width} height={20} />
      ))}
    </Box>
  );
};
