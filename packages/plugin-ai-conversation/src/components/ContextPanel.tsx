import React from 'react';
import { Box, Tab, Tabs, useTheme } from '@mui/material';
import { SourcesPanel } from './SourcesPanel';
import { UsagePanel } from './UsagePanel';
import { RADIUS, surface, subtleBorder } from '../theme';
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
  const theme = useTheme();
  const citationCount = citations.length;

  return (
    <Box
      sx={{
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        bgcolor: surface(theme, 0),
        borderLeft: subtleBorder(theme),
      }}
    >
      {/* Tabs header */}
      <Tabs
        value={tab}
        onChange={(_e, value) => onTabChange(value)}
        variant="fullWidth"
        sx={{
          borderBottom: subtleBorder(theme),
          '& .MuiTab-root': {
            textTransform: 'none',
            fontSize: '0.875rem',
            fontWeight: 500,
          },
        }}
      >
        <Tab
          label={
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
              Sources
              {citationCount > 0 && (
                <Box
                  sx={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    minWidth: 20,
                    height: 20,
                    bgcolor: 'primary.main',
                    color: 'primary.contrastText',
                    borderRadius: RADIUS.pill,
                    fontSize: '0.75rem',
                    fontWeight: 600,
                  }}
                >
                  {citationCount}
                </Box>
              )}
            </Box>
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
