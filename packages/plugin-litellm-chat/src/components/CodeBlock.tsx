import React, { useState } from 'react';
import { Box, IconButton, Tooltip } from '@mui/material';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import CheckIcon from '@mui/icons-material/Check';
import { MONO_FONT_STACK } from '../theme';

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
  const [copied, setCopied] = useState(false);
  const isBlock = /language-/.test(className ?? '');

  if (!isBlock) {
    return (
      <code className={className} style={{ fontFamily: MONO_FONT_STACK }} {...props}>
        {children}
      </code>
    );
  }

  const handleCopy = () => {
    const text = extractText(children).replace(/\n$/, '');
    navigator.clipboard?.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  };

  return (
    <Box sx={{ position: 'relative', '&:hover .litellm-copy-btn': { opacity: 1 } }}>
      <Tooltip title={copied ? 'Copied' : 'Copy code'}>
        <IconButton
          size="small"
          className="litellm-copy-btn"
          onClick={handleCopy}
          sx={{
            position: 'absolute',
            top: 4,
            right: 4,
            opacity: 0,
            transition: 'opacity 0.15s',
            bgcolor: 'background.paper',
            border: 1,
            borderColor: 'divider',
          }}
        >
          {copied ? <CheckIcon fontSize="inherit" /> : <ContentCopyIcon fontSize="inherit" />}
        </IconButton>
      </Tooltip>
      <code className={className} style={{ fontFamily: MONO_FONT_STACK }} {...props}>
        {children}
      </code>
    </Box>
  );
};
