import React from 'react';
import { Alert, AlertTitle } from '@mui/material';

export interface ErrorBannerProps {
  error?: string;
  onDismiss?: () => void;
}

function readableError(error: string): string {
  if (/upstream 401|token_not_found_in_db|expired token/i.test(error)) {
    return 'Your chat session expired. Please send the message again.';
  }
  if (/aborted|timeout|timed out|upstream fetch failed/i.test(error)) {
    return 'The model took too long to respond. Please try again.';
  }
  if (/too many clients|database connection/i.test(error)) {
    return 'The chat service is temporarily busy. Please try again in a moment.';
  }
  return error;
}

export const ErrorBanner: React.FC<ErrorBannerProps> = ({ error, onDismiss }) => {
  if (!error) return null;
  return (
    <Alert severity="error" onClose={onDismiss} sx={{ mb: 1 }}>
      <AlertTitle>Chat error</AlertTitle>
      {readableError(error)}
    </Alert>
  );
};
