import React from 'react';
/**
 * react-markdown v9 `code` renderer. Fenced code blocks (```lang) get a
 * `language-*` className from remark-gfm; inline `code` spans don't — used
 * here to tell block vs inline apart since v9 dropped the `inline` prop.
 */
export declare const CodeBlock: React.FC<{
    className?: string;
    children?: React.ReactNode;
}>;
