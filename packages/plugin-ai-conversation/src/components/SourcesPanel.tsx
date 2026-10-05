import React, { useState } from 'react';
import {
  Box,
  Chip,
  Collapse,
  Divider,
  IconButton,
  Tooltip,
  Typography,
  useTheme,
} from '@mui/material';
import MenuBookIcon from '@mui/icons-material/MenuBook';
import PublicIcon from '@mui/icons-material/Public';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import { safeHref } from '../safeUrl';
import { RADIUS, surface, subtleBorder } from '../theme';
import type { Citation } from '../types';

export interface SourcesPanelProps {
  citations: Citation[];
}

interface DedupedSource {
  filename: string;
  url?: string;
  source: 'kb' | 'web' | undefined;
  bestScore: number;
  snippets: string[];
}

interface SourceGroup {
  key: 'kb' | 'web' | 'other';
  label: string;
  items: DedupedSource[];
}

/** Coarse, human-readable relevance bucket. Raw scores vary by backend, so keep
 *  the exact value available on hover but never lead with it. */
function relevanceLabel(score: number): 'High' | 'Medium' | 'Low' {
  if (score >= 0.7) return 'High';
  if (score >= 0.4) return 'Medium';
  return 'Low';
}

function getRelevanceColor(label: 'High' | 'Medium' | 'Low') {
  if (label === 'High') return 'success';
  if (label === 'Medium') return 'info';
  return 'default';
}

function dedupe(citations: Citation[]): DedupedSource[] {
  const byKey = new Map<string, DedupedSource>();
  for (const c of citations) {
    const key = (c.url || c.filename || '').toLowerCase();
    const existing = byKey.get(key);
    if (existing) {
      existing.bestScore = Math.max(existing.bestScore, c.score);
      if (c.snippet && !existing.snippets.includes(c.snippet)) {
        existing.snippets.push(c.snippet);
      }
    } else {
      byKey.set(key, {
        filename: c.filename,
        url: c.url,
        source: c.source,
        bestScore: c.score,
        snippets: c.snippet ? [c.snippet] : [],
      });
    }
  }
  return [...byKey.values()].sort((a, b) => b.bestScore - a.bestScore);
}

function groupSources(citations: Citation[]): SourceGroup[] {
  const deduped = dedupe(citations);
  const groups: SourceGroup[] = [
    { key: 'kb', label: 'Knowledge base', items: [] },
    { key: 'web', label: 'Web', items: [] },
    { key: 'other', label: 'Other', items: [] },
  ];
  for (const s of deduped) {
    if (s.source === 'kb') groups[0].items.push(s);
    else if (s.source === 'web') groups[1].items.push(s);
    else groups[2].items.push(s);
  }
  return groups.filter(g => g.items.length > 0);
}

const SourceRow: React.FC<{ source: DedupedSource }> = ({ source }) => {
  const theme = useTheme();
  const [expanded, setExpanded] = useState(false);
  const href = safeHref(source.url);
  const rel = relevanceLabel(source.bestScore);
  const passages = source.snippets.length;
  const isWeb = source.source === 'web';
  const isKb = source.source === 'kb';

  return (
    <Box
      sx={{
        p: 1.25,
        bgcolor: surface(theme, 1),
        borderRadius: RADIUS.sm,
        border: subtleBorder(theme),
        mb: 1,
      }}
    >
      {/* Header row */}
      <Box
        sx={{
          display: 'flex',
          alignItems: 'flex-start',
          gap: 1,
          mb: passages > 0 ? 1 : 0,
        }}
      >
        {/* Icon */}
        <Box
          sx={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: 24,
            height: 24,
            color: 'text.secondary',
            flexShrink: 0,
          }}
        >
          {isKb && <MenuBookIcon fontSize="small" />}
          {isWeb && <PublicIcon fontSize="small" />}
        </Box>

        {/* Title and metadata */}
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Tooltip title={source.filename}>
            <Typography
              variant="body2"
              fontWeight={500}
              sx={{
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
                mb: 0.5,
              }}
            >
              {source.filename}
            </Typography>
          </Tooltip>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, flexWrap: 'wrap' }}>
            <Chip
              size="small"
              label={rel}
              variant="filled"
              color={getRelevanceColor(rel)}
              sx={{ height: 20 }}
            />
            {passages > 1 && (
              <Typography variant="caption" color="text.secondary">
                {passages} passages
              </Typography>
            )}
          </Box>
        </Box>

        {/* Expand button */}
        {passages > 0 && (
          <IconButton
            size="small"
            onClick={() => setExpanded(!expanded)}
            sx={{
              transform: expanded ? 'rotate(180deg)' : 'rotate(0deg)',
              transition: 'transform 0.2s',
            }}
            aria-label={expanded ? 'Collapse' : 'Expand'}
          >
            <ExpandMoreIcon fontSize="small" />
          </IconButton>
        )}
      </Box>

      {/* Expanded snippets */}
      <Collapse in={expanded} timeout="auto" unmountOnExit>
        <Box sx={{ pt: 1 }}>
          {href && (
            <Typography
              variant="caption"
              sx={{
                display: 'block',
                mb: 1,
                '& a': { color: 'primary.main', textDecoration: 'none' },
                '& a:hover': { textDecoration: 'underline' },
              }}
            >
              <a href={href} target="_blank" rel="noopener noreferrer">
                Open source
              </a>
            </Typography>
          )}
          {source.snippets.map((snippet, i) => (
            <Box key={i}>
              {i > 0 && <Divider sx={{ my: 1 }} />}
              <Typography
                variant="caption"
                color="text.secondary"
                sx={{
                  display: 'block',
                  whiteSpace: 'pre-wrap',
                  overflowWrap: 'anywhere',
                  maxHeight: 200,
                  overflow: 'auto',
                }}
              >
                {snippet}
              </Typography>
            </Box>
          ))}
        </Box>
      </Collapse>
    </Box>
  );
};

export const SourcesPanel: React.FC<SourcesPanelProps> = ({ citations }) => {
  const theme = useTheme();
  const groups = groupSources(citations);
  const total = groups.reduce((n, g) => n + g.items.length, 0);

  if (total === 0) {
    return (
      <Box
        sx={{
          p: 2,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          minHeight: 200,
          textAlign: 'center',
        }}
      >
        <Box
          sx={{
            width: 48,
            height: 48,
            borderRadius: '50%',
            bgcolor: surface(theme, 2),
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            mb: 1,
            color: 'text.secondary',
          }}
        >
          <MenuBookIcon />
        </Box>
        <Typography variant="body2" color="text.secondary">
          Sources appear here when a reply uses a knowledge base or web search.
        </Typography>
      </Box>
    );
  }

  return (
    <Box sx={{ p: 2 }}>
      {groups.map(group => (
        <Box key={group.key} sx={{ mb: 2 }}>
          <Typography
            variant="caption"
            color="text.secondary"
            sx={{
              display: 'block',
              mb: 1,
              fontWeight: 600,
              textTransform: 'uppercase',
              letterSpacing: '0.06em',
            }}
          >
            {group.label} ({group.items.length})
          </Typography>
          {group.items.map((s, i) => (
            <SourceRow key={`${group.key}-${i}`} source={s} />
          ))}
        </Box>
      ))}
    </Box>
  );
};
