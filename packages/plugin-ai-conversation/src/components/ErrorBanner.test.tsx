import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { ErrorBanner, classifyError } from './ErrorBanner';

describe('ErrorBanner', () => {
  describe('classifyError', () => {
    it('should classify 401 unauthorized as key rejection', () => {
      const result = classifyError('401 unauthorized');
      expect(result.title).toBe('Your chat key was rejected');
      expect(result.severity).toBe('error');
      expect(result.hint).toContain('new key is minted automatically');
    });

    it('should classify 403 forbidden as key rejection', () => {
      const result = classifyError('403 forbidden');
      expect(result.title).toBe('Your chat key was rejected');
      expect(result.severity).toBe('error');
    });

    it('should classify token_not_found_in_db as key rejection', () => {
      const result = classifyError('token_not_found_in_db');
      expect(result.title).toBe('Your chat key was rejected');
    });

    it('should classify expired token as key rejection', () => {
      const result = classifyError('expired token');
      expect(result.title).toBe('Your chat key was rejected');
    });

    it('should classify budget exceeded as budget exhausted', () => {
      const result = classifyError('Budget exceeded: $5.00 limit');
      expect(result.title).toBe('Budget exhausted');
      expect(result.severity).toBe('warning');
      expect(result.hint).toContain('team admin');
    });

    it('should classify 429 with budget context as budget exhausted', () => {
      const result = classifyError('429 budget exceeded');
      expect(result.title).toBe('Budget exhausted');
    });

    it('should classify bare 429 as rate limit', () => {
      const result = classifyError('429 Too many requests');
      expect(result.title).toBe('Rate limited');
      expect(result.severity).toBe('warning');
      expect(result.hint).toContain('Wait a moment');
    });

    it('should classify too_many_requests as rate limit', () => {
      const result = classifyError('rate_limit_exceeded: too many');
      expect(result.title).toBe('Rate limited');
    });

    it('should classify network failure', () => {
      const result = classifyError('Failed to fetch: Network error');
      expect(result.title).toBe("Can't reach the chat service");
      expect(result.severity).toBe('error');
    });

    it('should classify connection refused', () => {
      const result = classifyError('ECONNREFUSED');
      expect(result.title).toBe("Can't reach the chat service");
    });

    it('should classify service busy', () => {
      const result = classifyError('Too many clients connected');
      expect(result.title).toBe('Service temporarily busy');
      expect(result.severity).toBe('warning');
    });

    it('should classify database connection error', () => {
      const result = classifyError('database connection failed');
      expect(result.title).toBe('Service temporarily busy');
    });

    it('should classify unknown error', () => {
      const result = classifyError('Some random error message');
      expect(result.title).toBe('Something went wrong');
    });

    it('should handle empty error', () => {
      const result = classifyError('');
      expect(result.title).toBe('Something went wrong');
    });
  });

  describe('ErrorBanner component', () => {
    it('should render nothing when error is not provided', () => {
      const { container } = render(<ErrorBanner error={undefined} onDismiss={() => {}} />);
      expect(container.firstChild).toBeNull();
    });

    it('should render error title and message', () => {
      render(
        <ErrorBanner
          error="401 unauthorized - your key expired"
          onDismiss={() => {}}
        />
      );

      expect(screen.getByText('Your chat key was rejected')).toBeTruthy();
      expect(screen.getByText('401 unauthorized - your key expired')).toBeTruthy();
    });

    it('should render helpful hint text', () => {
      render(
        <ErrorBanner
          error="429 budget exceeded"
          onDismiss={() => {}}
        />
      );

      expect(screen.getByText(/Ask your team admin/)).toBeTruthy();
    });

    it('should call onDismiss when alert is closed', () => {
      const handleDismiss = jest.fn();

      render(
        <ErrorBanner
          error="Network error"
          onDismiss={handleDismiss}
        />
      );

      const closeButton = screen.getByLabelText('Close');
      fireEvent.click(closeButton);

      expect(handleDismiss).toHaveBeenCalled();
    });

    it('should display alert with error severity for key rejection', () => {
      const { container } = render(
        <ErrorBanner
          error="401 unauthorized"
          onDismiss={() => {}}
        />
      );

      const alert = container.querySelector('[role="alert"]');
      expect(alert?.className).toContain('MuiAlert-standardError');
    });

    it('should display alert with warning severity for budget exceeded', () => {
      const { container } = render(
        <ErrorBanner
          error="Budget exceeded"
          onDismiss={() => {}}
        />
      );

      const alert = container.querySelector('[role="alert"]');
      expect(alert?.className).toContain('MuiAlert-standardWarning');
    });
  });
});
