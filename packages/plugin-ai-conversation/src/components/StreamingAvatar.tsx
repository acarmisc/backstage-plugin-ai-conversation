import React from 'react';
import { Avatar, Box, CircularProgress, useMediaQuery } from '@mui/material';

export interface StreamingAvatarProps {
  label: string;
  isStreaming?: boolean;
  size?: number;
}

/**
 * Avatar with optional CircularProgress ring while streaming.
 * Respects prefers-reduced-motion.
 */
export const StreamingAvatar: React.FC<StreamingAvatarProps> = ({
  label,
  isStreaming = false,
  size = 32,
}) => {
  const prefersReducedMotion = useMediaQuery('(prefers-reduced-motion: reduce)');

  return (
    <Box sx={{ position: 'relative', width: size, height: size, flexShrink: 0 }}>
      {isStreaming && !prefersReducedMotion && (
        <CircularProgress
          size={size + 4}
          thickness={3}
          sx={{
            position: 'absolute',
            top: -2,
            left: -2,
            color: 'primary.main',
          }}
        />
      )}
      <Avatar
        sx={{
          width: size,
          height: size,
          fontSize: size * 0.42,
          bgcolor: 'primary.main',
          color: 'primary.contrastText',
        }}
      >
        {label}
      </Avatar>
    </Box>
  );
};
