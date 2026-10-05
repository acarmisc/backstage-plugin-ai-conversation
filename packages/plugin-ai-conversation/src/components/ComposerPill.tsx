import React, { useState } from 'react';
import {
  Badge,
  Box,
  Button,
  Popover,
  useTheme,
  useMediaQuery,
} from '@mui/material';
import ArrowDropDownIcon from '@mui/icons-material/ArrowDropDown';

export interface ComposerPillProps {
  icon?: React.ReactNode;
  label: string;
  value?: string | number;
  isError?: boolean;
  children?: React.ReactNode;
  showBadge?: boolean;
}

/**
 * A button that opens a popover with content.
 * Used for Team, Model, KB, Skill pickers in the composer.
 * On small screens, shows icon only.
 */
export const ComposerPill: React.FC<ComposerPillProps> = ({
  icon,
  label,
  value,
  isError,
  children,
  showBadge,
}) => {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));
  const [anchorEl, setAnchorEl] = useState<HTMLButtonElement | null>(null);
  const open = Boolean(anchorEl);

  const handleClick = (event: React.MouseEvent<HTMLButtonElement>) => {
    setAnchorEl(event.currentTarget);
  };

  const handleClose = () => {
    setAnchorEl(null);
  };

  return (
    <>
      <Badge
        overlap="circular"
        anchorOrigin={{ vertical: 'top', horizontal: 'right' }}
        variant="dot"
        color="warning"
        invisible={!showBadge}
      >
        <Button
          onClick={handleClick}
          size="small"
          variant="text"
          color={isError ? 'error' : 'inherit'}
          startIcon={icon}
          endIcon={<ArrowDropDownIcon />}
          sx={{
            textTransform: 'none',
          }}
          title={isMobile ? label : undefined}
        >
          {!isMobile && value}
        </Button>
      </Badge>

      <Popover
        // Keep the picker mounted while closed: ModelPicker/VectorStorePicker
        // apply defaults and team scoping in effects that must run on load.
        keepMounted
        open={open}
        anchorEl={anchorEl}
        onClose={handleClose}
        // The composer sits at the bottom of the page: open upwards.
        anchorOrigin={{
          vertical: 'top',
          horizontal: 'left',
        }}
        transformOrigin={{
          vertical: 'bottom',
          horizontal: 'left',
        }}
      >
        <Box sx={{ p: 2, minWidth: 320 }}>
          {children}
        </Box>
      </Popover>
    </>
  );
};
