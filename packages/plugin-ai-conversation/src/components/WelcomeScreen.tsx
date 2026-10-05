import React, { useMemo } from 'react';
import {
  Alert,
  AlertTitle,
  Box,
  Button,
  Card,
  CardActionArea,
  CardContent,
  Chip,
  Grid,
  Typography,
  useTheme,
} from '@mui/material';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import { StreamingAvatar } from './StreamingAvatar';
import { TeamPicker } from './TeamPicker';
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
          variant="h5"
          sx={{
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
          <Alert severity="info" sx={{ mb: 3 }}>
            <AlertTitle>Choose a team</AlertTitle>
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
          </Alert>
        )}

        {/* Skills grid */}
        {skills.length > 0 && (
          <Box sx={{ mb: 2 }}>
            <Typography
              variant="overline"
              sx={{
                display: 'block',
                color: 'text.secondary',
                mb: 1.5,
              }}
            >
              Skills
            </Typography>
            <Grid container spacing={2}>
              {skills.slice(0, 6).map(skill => (
                <Grid item xs={12} sm={6} lg={4} key={skill.id}>
                  <Card
                    variant="outlined"
                    sx={{
                      borderColor:
                        selectedSkill?.id === skill.id
                          ? 'primary.main'
                          : undefined,
                      height: '100%',
                    }}
                  >
                    <CardActionArea
                      onClick={() => onSkillSelect(skill.id)}
                      sx={{
                        position: 'relative',
                        height: '100%',
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'flex-start',
                      }}
                    >
                      <CardContent sx={{ width: '100%' }}>
                        {selectedSkill?.id === skill.id && (
                          <CheckCircleIcon
                            sx={{
                              position: 'absolute',
                              top: 8,
                              right: 8,
                              color: 'primary.main',
                            }}
                            fontSize="small"
                          />
                        )}
                        <Typography
                          variant="subtitle2"
                          sx={{
                            mb: 0.5,
                            pr: selectedSkill?.id === skill.id ? 24 : 0,
                          }}
                        >
                          {skill.title}
                        </Typography>
                        <Typography
                          variant="body2"
                          color="text.secondary"
                          sx={{
                            display: '-webkit-box',
                            WebkitLineClamp: 2,
                            WebkitBoxOrient: 'vertical',
                            overflow: 'hidden',
                            mb: 1,
                          }}
                        >
                          {skill.description}
                        </Typography>
                        {skill.tags && skill.tags.length > 0 && (
                          <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap' }}>
                            {skill.tags.slice(0, 2).map(tag => (
                              <Chip
                                key={tag}
                                label={tag}
                                size="small"
                                variant="outlined"
                              />
                            ))}
                          </Box>
                        )}
                      </CardContent>
                    </CardActionArea>
                  </Card>
                </Grid>
              ))}
            </Grid>
            {selectedSkill && (
              <Button
                size="small"
                variant="text"
                onClick={() => onSkillSelect('')}
                sx={{ mt: 1, textTransform: 'none' }}
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
              variant="overline"
              sx={{
                display: 'block',
                color: 'text.secondary',
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
                />
              ))}
            </Box>
          </Box>
        )}
      </Box>
    </Box>
  );
};
