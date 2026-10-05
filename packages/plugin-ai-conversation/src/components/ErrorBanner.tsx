import React from 'react';
import { Alert, AlertTitle } from '@mui/material';

export interface ErrorBannerProps {
  error?: string;
  onDismiss?: () => void;
  severity?: 'error' | 'warning' | 'info';
  plain?: boolean;
}

export interface ErrorClassification {
  title: string;
  message: string;
  hint: string;
  severity: 'error' | 'warning' | 'info';
}

/**
 * Classifies an error message and returns a user-friendly title, message, and hint.
 * This is exported for unit testing.
 */
export function classifyError(error: string): ErrorClassification {
  if (!error) {
    return {
      title: 'Something went wrong',
      message: 'An unknown error occurred.',
      hint: 'Please try again.',
      severity: 'error',
    };
  }

  // Key rejection errors (401, 403, token expired, not found)
  if (/401|403|unauthorized|forbidden|token_not_found_in_db|expired token|key expired/i.test(error)) {
    return {
      title: 'Your chat key was rejected',
      message: error,
      hint: 'A new key is minted automatically on the next message; if it keeps failing, check your team membership.',
      severity: 'error',
    };
  }

  // Budget exceeded
  if (/budget|exceeded|429|rate_limit_exceeded/i.test(error) && /budget|spend/i.test(error)) {
    return {
      title: 'Budget exhausted',
      message: error,
      hint: 'Ask your team admin to raise the team budget.',
      severity: 'warning',
    };
  }

  // Rate limit (but not budget)
  if (/429|rate.limit|too.many.requests|rate_limit_exceeded/i.test(error)) {
    return {
      title: 'Rate limited',
      message: error,
      hint: 'Wait a moment and retry.',
      severity: 'warning',
    };
  }

  // Service busy errors (check before network errors since they may also contain "connection")
  if (/too many clients|database connection|temporarily unavailable|overloaded/i.test(error)) {
    return {
      title: 'Service temporarily busy',
      message: error,
      hint: 'Please try again in a moment.',
      severity: 'warning',
    };
  }

  // Network/connection errors
  if (/failed to fetch|network|connection|timeout|timed out|aborted|ECONNREFUSED|ERR_/i.test(error)) {
    return {
      title: "Can't reach the chat service",
      message: error,
      hint: 'Check your internet connection and try again.',
      severity: 'error',
    };
  }

  // Fallback for unknown errors
  return {
    title: 'Something went wrong',
    message: error,
    hint: 'Please try again.',
    severity: 'error',
  };
}

export const ErrorBanner: React.FC<ErrorBannerProps> = ({ error, onDismiss, severity: overrideSeverity, plain }) => {
  if (!error) return null;

  // For plain mode, use provided severity or default to 'warning'
  if (plain) {
    return (
      <Alert
        severity={overrideSeverity || 'warning'}
        onClose={onDismiss}
        sx={{
          mb: 2,
          '& .MuiAlert-message': {
            width: '100%',
          },
        }}
      >
        {error}
      </Alert>
    );
  }

  // For classified mode, use the classification logic
  const { title, message, hint, severity } = classifyError(error);

  return (
    <Alert
      severity={overrideSeverity || severity}
      onClose={onDismiss}
      sx={{
        mb: 2,
        '& .MuiAlert-message': {
          width: '100%',
        },
      }}
    >
      <AlertTitle sx={{ fontWeight: 600, mb: 0.5 }}>
        {title}
      </AlertTitle>
      <div style={{ fontSize: '0.875rem', marginBottom: '0.5rem' }}>
        {message}
      </div>
      <div style={{ fontSize: '0.75rem', opacity: 0.8 }}>
        {hint}
      </div>
    </Alert>
  );
};
