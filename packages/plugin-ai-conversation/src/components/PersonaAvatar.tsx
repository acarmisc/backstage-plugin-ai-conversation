import React from 'react';
import { Avatar, Box } from '@mui/material';
import { ACCENT_CONIC_GRADIENT } from '../theme';

export interface PersonaAvatarProps {
  label: string;
  isStreaming?: boolean;
  size?: number;
}

/**
 * The design system's one persistent animated element: a thin ring around
 * the persona/model avatar that shows the accent gradient rotating while
 * that column is actively streaming, and a neutral divider color at rest.
 * Reused identically per-column in multi-model compare mode (phase13).
 */
export const PersonaAvatar: React.FC<PersonaAvatarProps> = ({
  label,
  isStreaming = false,
  size = 32,
}) => {
  const ringSize = size + 4;
  return (
    <Box sx={{ position: 'relative', width: ringSize, height: ringSize, flexShrink: 0 }}>
      <Box
        sx={{
          position: 'absolute',
          inset: 0,
          borderRadius: '50%',
          background: (theme) =>
            isStreaming ? ACCENT_CONIC_GRADIENT : theme.palette.divider,
          animation: isStreaming ? 'litellm-ring-spin 3s linear infinite' : 'none',
          '@media (prefers-reduced-motion: reduce)': {
            animation: 'none',
          },
          '@keyframes litellm-ring-spin': {
            from: { transform: 'rotate(0deg)' },
            to: { transform: 'rotate(360deg)' },
          },
        }}
      />
      <Avatar
        sx={{
          position: 'absolute',
          top: 2,
          left: 2,
          width: size,
          height: size,
          fontSize: size * 0.42,
          bgcolor: 'background.paper',
          color: 'text.primary',
        }}
      >
        {label}
      </Avatar>
    </Box>
  );
};
