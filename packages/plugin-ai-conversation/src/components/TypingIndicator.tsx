import React from 'react';
import { Box, useMediaQuery, useTheme } from '@mui/material';

export interface TypingIndicatorProps {
  /**
   * Size of each dot in pixels. Default 8.
   */
  size?: number;
}

/**
 * Three animated dots indicating that the assistant is typing.
 * Respects prefers-reduced-motion.
 */
export const TypingIndicator: React.FC<TypingIndicatorProps> = ({ size = 8 }) => {
  const theme = useTheme();
  const prefersReducedMotion = useMediaQuery('(prefers-reduced-motion: reduce)');

  const dotStyle = {
    width: size,
    height: size,
    borderRadius: '50%',
    backgroundColor: theme.palette.text.primary,
    animation: prefersReducedMotion ? 'none' : 'litellm-typing 1.4s infinite',
  };

  return (
    <Box
      sx={{
        display: 'flex',
        gap: size * 0.5,
        alignItems: 'flex-end',
        '@keyframes litellm-typing': {
          '0%, 60%, 100%': {
            opacity: 0.5,
            transform: 'translateY(0)',
          },
          '30%': {
            opacity: 1,
            transform: `translateY(-${size}px)`,
          },
        },
      }}
    >
      <Box
        sx={{
          ...dotStyle,
          animationDelay: prefersReducedMotion ? '0ms' : '0ms',
        }}
      />
      <Box
        sx={{
          ...dotStyle,
          animationDelay: prefersReducedMotion ? '0ms' : '200ms',
        }}
      />
      <Box
        sx={{
          ...dotStyle,
          animationDelay: prefersReducedMotion ? '0ms' : '400ms',
        }}
      />
    </Box>
  );
};
