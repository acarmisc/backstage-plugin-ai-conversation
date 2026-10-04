import React, { useState } from 'react';
import {
  Box,
  Button,
  Popover,
  Stack,
  Typography,
  useTheme,
  useMediaQuery,
  Badge,
} from '@mui/material';
import { alpha } from '@mui/material/styles';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import { RADIUS } from '../theme';

export interface ComposerPillProps {
  icon?: React.ReactNode;
  label: string;
  value?: string | number;
  isError?: boolean;
  children?: React.ReactNode;
  size?: 'small' | 'medium';
  showBadge?: boolean;
}

/**
 * A pill-shaped button that opens a popover with content.
 * Used for Team, Model, KB, Skill pickers in the composer.
 * On small screens, shows icon only.
 */
export const ComposerPill: React.FC<ComposerPillProps> = ({
  icon,
  label,
  value,
  isError,
  children,
  size = 'medium',
  showBadge,
}) => {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));
  let pillPadding: number | string = size === 'small' ? '4px 8px' : '6px 12px';
  if (isMobile) pillPadding = 0;
  const [anchorEl, setAnchorEl] = useState<HTMLButtonElement | null>(null);
  const open = Boolean(anchorEl);
  let pillBorder = 'inherit';
  if (isError) pillBorder = theme.palette.error.main;
  else if (open) pillBorder = theme.palette.primary.main;

  const handleClick = (event: React.MouseEvent<HTMLButtonElement>) => {
    setAnchorEl(event.currentTarget);
  };

  const handleClose = () => {
    setAnchorEl(null);
  };

  return (
    <>
      <Badge
        badgeContent={showBadge ? '●' : 0}
        sx={{
          '& .MuiBadge-badge': {
            right: 4,
            top: 4,
            border: `2px solid ${theme.palette.background.paper}`,
            padding: '0 4px',
            backgroundColor: theme.palette.warning.main,
          },
        }}
      >
        <Button
          onClick={handleClick}
          size={size}
          variant="outlined"
          endIcon={!isMobile && <ExpandMoreIcon />}
          sx={{
            borderRadius: RADIUS.pill,
            textTransform: 'none',
            fontWeight: 500,
            padding: pillPadding,
            fontSize: size === 'small' ? '0.75rem' : '0.875rem',
            borderColor: pillBorder,
            color: isError ? theme.palette.error.main : 'inherit',
            backgroundColor: open ? alpha(theme.palette.primary.main, 0.08) : undefined,
            '&:hover': {
              borderColor: theme.palette.primary.main,
            },
            minWidth: isMobile ? 32 : undefined,
            width: isMobile ? 32 : undefined,
            height: isMobile ? 32 : undefined,
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
          }}
          title={isMobile ? label : undefined}
        >
          {isMobile ? (
            icon
          ) : (
            <Stack direction="row" spacing={0.5} sx={{ alignItems: 'center' }}>
              {icon && <Box sx={{ display: 'flex', alignItems: 'center' }}>{icon}</Box>}
              {value && <Typography variant="inherit">{value}</Typography>}
            </Stack>
          )}
        </Button>
      </Badge>

      <Popover
        open={open}
        anchorEl={anchorEl}
        onClose={handleClose}
        anchorOrigin={{
          vertical: 'bottom',
          horizontal: 'left',
        }}
        transformOrigin={{
          vertical: 'top',
          horizontal: 'left',
        }}
        slotProps={{
          paper: {
            sx: {
              borderRadius: RADIUS.md,
              boxShadow: theme.shadows[4],
            },
          },
        }}
      >
        <Box sx={{ p: 2, minWidth: 320 }}>
          {children}
        </Box>
      </Popover>
    </>
  );
};
