import React from 'react';
import { Box, Typography, Chip, CircularProgress, Link } from '@mui/material';
import PersonIcon from '@mui/icons-material/Person';
import type { Persona } from '../types';

export interface PersonaHomepageProps {
  personas: Persona[];
  loading: boolean;
  error: string | null;
  selectedId: string;
  /** Fires with the full Persona (or undefined for "None") — same shape as
   * PersonaPicker's onChange so the parent can share one handler. */
  onSelect: (personaId: string, persona: Persona | undefined) => void;
}

export const PersonaHomepage: React.FC<PersonaHomepageProps> = ({
  personas,
  loading,
  error,
  selectedId,
  onSelect,
}) => {
  if (loading) {
    return (
      <Box sx={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <CircularProgress size={24} />
      </Box>
    );
  }

  if (error || personas.length === 0) {
    return (
      <Box sx={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <Typography color="text.secondary">
          {error ? `Couldn't load personas: ${error}` : 'Start a conversation…'}
        </Typography>
      </Box>
    );
  }

  return (
    <Box
      sx={{
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        gap: 2,
        px: 2,
        py: 4,
      }}
    >
      <Typography variant="subtitle1" align="center" color="text.secondary">
        Pick a persona to get started, or{' '}
        <Link
          component="button"
          type="button"
          underline="hover"
          onClick={() => onSelect('', undefined)}
        >
          just start typing
        </Link>{' '}
        — a persona is optional.
      </Typography>
      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
          gap: 1.5,
        }}
      >
        {personas.map(p => {
          const selected = p.id === selectedId;
          return (
            <Box
              key={p.id}
              role="button"
              tabIndex={0}
              onClick={() => onSelect(p.id, p)}
              onKeyDown={e => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  onSelect(p.id, p);
                }
              }}
              sx={{
                cursor: 'pointer',
                border: 1,
                borderColor: selected ? 'primary.main' : 'divider',
                borderRadius: 2,
                p: 1.5,
                display: 'flex',
                flexDirection: 'column',
                gap: 0.5,
                bgcolor: selected ? 'action.selected' : 'background.paper',
                transition: 'border-color 0.15s, background-color 0.15s',
                '&:hover': {
                  borderColor: 'primary.main',
                  bgcolor: 'action.hover',
                },
              }}
            >
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
                <PersonIcon fontSize="small" color={selected ? 'primary' : 'action'} />
                <Typography variant="body2" sx={{ fontWeight: 600 }} noWrap>
                  {p.title}
                </Typography>
              </Box>
              {p.description && (
                <Typography
                  variant="caption"
                  color="text.secondary"
                  sx={{
                    display: '-webkit-box',
                    WebkitLineClamp: 3,
                    WebkitBoxOrient: 'vertical',
                    overflow: 'hidden',
                  }}
                >
                  {p.description}
                </Typography>
              )}
              {p.tags && p.tags.length > 0 && (
                <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5, mt: 0.5 }}>
                  {p.tags.map(tag => (
                    <Chip key={tag} label={tag} size="small" variant="outlined" />
                  ))}
                </Box>
              )}
            </Box>
          );
        })}
      </Box>
    </Box>
  );
};
