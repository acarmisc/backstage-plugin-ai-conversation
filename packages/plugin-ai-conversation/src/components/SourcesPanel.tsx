import React from 'react';
import {
  Accordion,
  AccordionDetails,
  AccordionSummary,
  Box,
  Chip,
  Divider,
  Tooltip,
  Typography,
} from '@mui/material';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import { safeHref } from '../safeUrl';
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
  const href = safeHref(source.url);
  const rel = relevanceLabel(source.bestScore);
  const passages = source.snippets.length;
  return (
    <Accordion
      disableGutters
      variant="outlined"
      sx={{ '&:before': { display: 'none' }, mb: 0.5 }}
    >
      <AccordionSummary
        expandIcon={<ExpandMoreIcon fontSize="small" />}
        sx={{ minHeight: 0, '& .MuiAccordionSummary-content': { my: 0.75, mr: 1 } }}
      >
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.25, minWidth: 0 }}>
          <Typography
            variant="body2"
            fontWeight={500}
            sx={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
          >
            {source.filename}
          </Typography>
          <Typography variant="caption" color="text.secondary">
            <Tooltip title={`Score ${source.bestScore.toFixed(3)}`}>
              <span>{rel} relevance</span>
            </Tooltip>
            {passages > 1 ? ` · ${passages} passages` : ''}
          </Typography>
        </Box>
      </AccordionSummary>
      <AccordionDetails sx={{ pt: 0 }}>
        {href && (
          <Typography variant="caption" sx={{ display: 'block', mb: 1 }}>
            <a href={href} target="_blank" rel="noopener noreferrer">
              Open source
            </a>
          </Typography>
        )}
        {source.snippets.map((snippet, i) => (
          <Box key={i}>
            {i > 0 && <Divider sx={{ my: 1 }} />}
            <Typography
              variant="body2"
              color="text.secondary"
              sx={{ whiteSpace: 'pre-wrap', maxHeight: 220, overflow: 'auto' }}
            >
              {snippet}
            </Typography>
          </Box>
        ))}
        {source.snippets.length === 0 && (
          <Typography variant="body2" color="text.secondary">
            No excerpt available.
          </Typography>
        )}
      </AccordionDetails>
    </Accordion>
  );
};

export const SourcesPanel: React.FC<SourcesPanelProps> = ({ citations }) => {
  const groups = groupSources(citations);
  const total = groups.reduce((n, g) => n + g.items.length, 0);

  return (
    <Box sx={{ p: 1.5 }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
        <Typography variant="overline" color="text.secondary">
          Sources
        </Typography>
        {total > 0 && <Chip size="small" label={total} variant="outlined" />}
      </Box>

      {total === 0 ? (
        <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
          No sources for the latest reply yet.
        </Typography>
      ) : (
        groups.map(group => (
          <Box key={group.key} sx={{ mt: 1 }}>
            <Typography
              variant="caption"
              color="text.secondary"
              sx={{ display: 'block', mb: 0.5, fontWeight: 600 }}
            >
              {group.label} ({group.items.length})
            </Typography>
            {group.items.map((s, i) => (
              <SourceRow key={`${group.key}-${i}`} source={s} />
            ))}
          </Box>
        ))
      )}
    </Box>
  );
};
