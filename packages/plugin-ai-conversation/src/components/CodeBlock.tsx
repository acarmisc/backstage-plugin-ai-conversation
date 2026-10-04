import React, { useState } from 'react';
import { Box, IconButton, Tooltip, Typography, useTheme } from '@mui/material';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import CheckIcon from '@mui/icons-material/Check';
import { MONO_FONT_STACK, RADIUS, surface, subtleBorder } from '../theme';

function extractText(node: React.ReactNode): string {
  if (typeof node === 'string') return node;
  if (typeof node === 'number') return String(node);
  if (Array.isArray(node)) return node.map(extractText).join('');
  if (React.isValidElement(node)) {
    return extractText((node.props as { children?: React.ReactNode }).children);
  }
  return '';
}

/**
 * react-markdown v9 `code` renderer. Fenced code blocks (```lang) get a
 * `language-*` className from remark-gfm; inline `code` spans don't — used
 * here to tell block vs inline apart since v9 dropped the `inline` prop.
 */
export const CodeBlock: React.FC<{ className?: string; children?: React.ReactNode }> = ({
  className,
  children,
  ...props
}) => {
  const theme = useTheme();
  const [copied, setCopied] = useState(false);
  const isBlock = /language-/.test(className ?? '');

  if (!isBlock) {
    return (
      <code
        className={className}
        style={{
          fontFamily: MONO_FONT_STACK,
          backgroundColor: surface(theme, 2),
          borderRadius: RADIUS.sm,
          padding: '2px 6px',
        }}
        {...props}
      >
        {children}
      </code>
    );
  }

  const language = (className ?? '').replace('language-', '').trim() || 'code';

  const handleCopy = () => {
    const text = extractText(children).replace(/\n$/, '');
    navigator.clipboard?.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  };

  return (
    <Box
      sx={{
        borderRadius: RADIUS.md,
        border: subtleBorder(theme),
        bgcolor: surface(theme, 1),
        overflow: 'hidden',
        my: 1,
        '&:hover .litellm-copy-btn': { opacity: 1 },
      }}
    >
      {/* Header bar */}
      <Box
        sx={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          px: 1.5,
          py: 0.75,
          bgcolor: surface(theme, 2),
          borderBottom: subtleBorder(theme),
        }}
      >
        <Typography
          variant="caption"
          sx={{
            fontFamily: MONO_FONT_STACK,
            fontWeight: 500,
            color: 'text.secondary',
          }}
        >
          {language}
        </Typography>
        <Tooltip title={copied ? 'Copied' : 'Copy code'}>
          <IconButton
            size="small"
            className="litellm-copy-btn"
            onClick={handleCopy}
            aria-label="Copy code"
            sx={{
              opacity: 0,
              transition: 'opacity 0.15s',
            }}
          >
            {copied ? <CheckIcon fontSize="small" /> : <ContentCopyIcon fontSize="small" />}
          </IconButton>
        </Tooltip>
      </Box>

      {/* Code content */}
      <Box
        sx={{
          overflow: 'auto',
          p: 1.5,
          fontFamily: MONO_FONT_STACK,
          fontSize: '0.875rem',
          lineHeight: 1.5,
          color: 'text.primary',
        }}
      >
        <code className={className} {...props}>
          {children}
        </code>
      </Box>
    </Box>
  );
};
