import React, { useMemo } from 'react';
import {
  Alert,
  Box,
  Button,
  Card,
  Chip,
  Grid,
  Stack,
  Typography,
  useTheme,
} from '@mui/material';
import CheckIcon from '@mui/icons-material/Check';
import { StreamingAvatar } from './StreamingAvatar';
import { TeamPicker } from './TeamPicker';
import { RADIUS, surface } from '../theme';
import { getStarterPrompts } from '../utils/suggestions';
import type { ChatConfig, ChatTeamInfo, Skill } from '../types';

export interface WelcomeScreenProps {
  config: ChatConfig;
  selectedSkill?: Skill;
  selectedTeam?: ChatTeamInfo;
  selectedModel?: string;
  teams: ChatTeamInfo[];
  teamsLoading?: boolean;
  teamsError?: string | null;
  skills: Skill[];
  teamId: string;
  onTeamChange: (teamId: string) => void;
  onSkillSelect: (skillId: string) => void;
  onPromptClick: (prompt: string) => void;
}

export const WelcomeScreen: React.FC<WelcomeScreenProps> = ({
  config,
  selectedSkill,
  selectedTeam,
  selectedModel,
  teams,
  teamsLoading,
  teamsError,
  skills,
  teamId,
  onTeamChange,
  onSkillSelect,
  onPromptClick,
}) => {
  const theme = useTheme();
  const starterPrompts = useMemo(
    () => getStarterPrompts(selectedSkill),
    [selectedSkill],
  );

  const isTeamMissing = config.teamRequired && !teamId;

  return (
    <Box
      sx={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        px: 3,
        pt: 3,
        pb: 20,
        overflowY: 'auto',
      }}
    >
      <Box sx={{ maxWidth: 720, width: '100%' }}>
        {/* Gradient avatar */}
        <Box sx={{ display: 'flex', justifyContent: 'center', mb: 2 }}>
          <StreamingAvatar label="AI" size={44} isStreaming={false} />
        </Box>

        {/* Main greeting */}
        <Typography
          variant="h4"
          sx={{
            fontWeight: 600,
            textAlign: 'center',
            mb: 0.5,
            color: theme.palette.text.primary,
          }}
        >
          How can I help today?
        </Typography>

        {/* Team + model context line */}
        <Typography
          variant="body2"
          sx={{
            textAlign: 'center',
            color: theme.palette.text.secondary,
            mb: 2,
          }}
        >
          {teamId && selectedModel ? (
            <>
              Chatting as <strong>{selectedTeam?.team_alias || teamId}</strong> with{' '}
              <strong>{selectedModel}</strong>
            </>
          ) : (
            'Select a team and model to get started'
          )}
        </Typography>

        {/* Team required alert */}
        {isTeamMissing && (
          <Alert severity="warning" sx={{ mb: 3, borderRadius: RADIUS.md }}>
            <Stack spacing={1}>
              <Typography variant="body2" sx={{ fontWeight: 500 }}>
                Please select a team to continue
              </Typography>
              <Box sx={{ mt: 1 }}>
                <TeamPicker
                  value={teamId}
                  onChange={onTeamChange}
                  teams={teams}
                  loading={teamsLoading}
                  error={teamsError}
                  required={config.teamRequired}
                />
              </Box>
            </Stack>
          </Alert>
        )}

        {/* Skills grid */}
        {skills.length > 0 && (
          <Box sx={{ mb: 2 }}>
            <Typography
              variant="caption"
              sx={{
                display: 'block',
                color: theme.palette.text.secondary,
                fontWeight: 500,
                textTransform: 'uppercase',
                letterSpacing: 0.06,
                mb: 1.5,
              }}
            >
              Skills
            </Typography>
            <Grid container spacing={1}>
              {skills.slice(0, 6).map(skill => (
                <Grid item xs={12} sm={6} lg={4} key={skill.id}>
                  <Card
                    onClick={() => onSkillSelect(skill.id)}
                    sx={{
                      p: 1.5,
                      cursor: 'pointer',
                      border: `1px solid`,
                      borderColor:
                        selectedSkill?.id === skill.id
                          ? theme.palette.primary.main
                          : theme.palette.divider,
                      backgroundColor:
                        selectedSkill?.id === skill.id
                          ? surface(theme, 1)
                          : surface(theme, 0),
                      borderRadius: RADIUS.md,
                      transition: 'all 0.2s ease-in-out',
                      position: 'relative',
                      '&:hover': {
                        borderColor: theme.palette.primary.main,
                      },
                    }}
                  >
                    {selectedSkill?.id === skill.id && (
                      <CheckIcon
                        sx={{
                          position: 'absolute',
                          top: 4,
                          right: 4,
                          color: 'primary.main',
                          fontSize: 18,
                        }}
                      />
                    )}
                    <Typography
                      variant="body2"
                      sx={{
                        fontWeight: 600,
                        mb: 0.25,
                        pr: selectedSkill?.id === skill.id ? 20 : 0,
                      }}
                    >
                      {skill.title}
                    </Typography>
                    <Typography
                      variant="caption"
                      sx={{
                        color: theme.palette.text.secondary,
                        display: '-webkit-box',
                        WebkitLineClamp: 2,
                        WebkitBoxOrient: 'vertical',
                        overflow: 'hidden',
                        mb: 0.75,
                      }}
                    >
                      {skill.description}
                    </Typography>
                    {skill.tags && skill.tags.length > 0 && (
                      <Box sx={{ display: 'flex', gap: 0.25, flexWrap: 'wrap' }}>
                        {skill.tags.slice(0, 2).map(tag => (
                          <Chip
                            key={tag}
                            label={tag}
                            size="small"
                            variant="outlined"
                            sx={{ height: 18, fontSize: '0.65rem' }}
                          />
                        ))}
                      </Box>
                    )}
                  </Card>
                </Grid>
              ))}
            </Grid>
            {selectedSkill && (
              <Button
                size="small"
                onClick={() => onSkillSelect('')}
                sx={{ mt: 0.75, textTransform: 'none', color: theme.palette.text.secondary }}
              >
                Clear skill
              </Button>
            )}
          </Box>
        )}

        {/* Starter prompts */}
        {starterPrompts.length > 0 && (
          <Box>
            <Typography
              variant="caption"
              sx={{
                display: 'block',
                color: theme.palette.text.secondary,
                fontWeight: 500,
                textTransform: 'uppercase',
                letterSpacing: 0.06,
                mb: 1.5,
              }}
            >
              Try asking
            </Typography>
            <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
              {starterPrompts.map((prompt, idx) => (
                <Chip
                  key={idx}
                  label={prompt}
                  onClick={() => onPromptClick(prompt)}
                  variant="outlined"
                  size="small"
                  sx={{
                    borderRadius: RADIUS.pill,
                    fontSize: '0.85rem',
                    height: 'auto',
                    py: 0.5,
                  }}
                />
              ))}
            </Box>
          </Box>
        )}
      </Box>
    </Box>
  );
};
