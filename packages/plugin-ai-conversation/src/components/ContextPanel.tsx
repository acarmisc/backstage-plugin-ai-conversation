import React from 'react';
import { Box, Tab, Tabs } from '@mui/material';
import { SourcesPanel } from './SourcesPanel';
import { UsagePanel } from './UsagePanel';
import type { Citation, KeySpend, UsageInfo } from '../types';

export interface ContextPanelProps {
  citations: Citation[];
  lastTurnUsage: UsageInfo | null;
  totalTokens: number;
  keySpend: KeySpend | null;
  keyAlias?: string;
  keyExpiresAt?: number;
  tab: 'sources' | 'usage';
  onTabChange: (tab: 'sources' | 'usage') => void;
}

export const ContextPanel: React.FC<ContextPanelProps> = ({
  citations,
  lastTurnUsage,
  totalTokens,
  keySpend,
  keyAlias,
  keyExpiresAt,
  tab,
  onTabChange,
}) => {
  const citationCount = citations.length;

  return (
    <Box
      sx={{
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        borderLeft: 1,
        borderColor: 'divider',
      }}
    >
      {/* Tabs header */}
      <Tabs
        value={tab}
        onChange={(_e, value) => onTabChange(value)}
        variant="fullWidth"
        sx={{
          borderBottom: 1,
          borderColor: 'divider',
          '& .MuiTab-root': {
            textTransform: 'none',
          },
        }}
      >
        <Tab
          label={
citationCount > 0 ? `Sources (${citationCount})` : 'Sources'
          }
          value="sources"
        />
        <Tab
          label="Usage"
          value="usage"
        />
      </Tabs>

      {/* Content scrollable area */}
      <Box
        sx={{
          flex: 1,
          overflowY: 'auto',
          overflowX: 'hidden',
        }}
      >
        {tab === 'sources' ? (
          <SourcesPanel citations={citations} />
        ) : (
          <UsagePanel
            lastTurnUsage={lastTurnUsage}
            totalTokens={totalTokens}
            keySpend={keySpend}
            keyAlias={keyAlias}
            keyExpiresAt={keyExpiresAt}
          />
        )}
      </Box>
    </Box>
  );
};
