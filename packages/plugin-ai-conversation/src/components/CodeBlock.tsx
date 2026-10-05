import { Box } from '@mui/material';
import React from 'react';
import { CodeSnippet } from '@backstage/core-components';

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
  const isBlock = /language-/.test(className ?? '');

  if (!isBlock) {
    return (
      <Box
        component="code"
        className={className}
        sx={{ fontFamily: 'monospace', bgcolor: 'action.hover', borderRadius: 1, px: 0.5 }}
        {...props}
      >
        {children}
      </Box>
    );
  }

  const language = (className ?? '').replace('language-', '').trim() || 'code';
  const text = extractText(children).replace(/\n$/, '');

  return (
    <CodeSnippet
      text={text}
      language={language}
      showCopyCodeButton
    />
  );
};
