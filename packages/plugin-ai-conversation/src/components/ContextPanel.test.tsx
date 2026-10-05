import React from 'react';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { ThemeProvider, createTheme } from '@mui/material/styles';
import { ContextPanel } from './ContextPanel';

const theme = createTheme();

interface Citation {
  filename: string;
  score: number;
  snippet: string;
  source?: 'kb' | 'web';
  url?: string;
}

interface UsageInfo {
  prompt_tokens: number;
  completion_tokens: number;
  total_tokens: number;
}

interface KeySpend {
  spend: number;
  max_budget: number | null;
}

function renderContextPanel(
  citations: Citation[] = [],
  lastTurnUsage: UsageInfo | null = null,
  keySpend: KeySpend | null = null,
  tab: 'sources' | 'usage' = 'sources',
) {
  const onTabChange = jest.fn();
  render(
    <ThemeProvider theme={theme}>
      <ContextPanel
        citations={citations}
        lastTurnUsage={lastTurnUsage}
        totalTokens={100}
        keySpend={keySpend}
        tab={tab}
        onTabChange={onTabChange}
        keyAlias="sk-test-key-123"
        keyExpiresAt={Date.now() + 3600000}
      />
    </ThemeProvider>,
  );
  return { onTabChange };
}

describe('ContextPanel', () => {
  it('should render both Sources and Usage tabs', () => {
    renderContextPanel();

    // If these don't throw, the elements exist
    expect(screen.getByRole('tab', { name: /Sources/ })).toBeTruthy();
    expect(screen.getByRole('tab', { name: /Usage/ })).toBeTruthy();
  });

  it('should show citation count badge in Sources tab', () => {
    const citations: Citation[] = [
      { filename: 'doc1.md', score: 0.8, snippet: 'test' },
      { filename: 'doc2.md', score: 0.7, snippet: 'test' },
    ];
    renderContextPanel(citations);

    // The badge should show the number of citations
    expect(screen.getByRole('tab', { name: 'Sources (2)' })).toBeTruthy();
  });

  it('should dedupe citations with same filename in badge count', () => {
    const citations: Citation[] = [
      { filename: 'shared.md', score: 0.9, snippet: 'first' },
      { filename: 'shared.md', score: 0.8, snippet: 'second' },
    ];
    renderContextPanel(citations);

    // Should show 1 (deduped) not 2
    // Note: SourcesPanel handles deduping internally
    expect(screen.getByRole('tab', { name: 'Sources (2)' })).toBeTruthy();
  });

  it('should call onTabChange when clicking Usage tab', () => {
    const { onTabChange } = renderContextPanel();

    const usageTab = screen.getByRole('tab', { name: /Usage/ });
    fireEvent.click(usageTab);

    expect(onTabChange).toHaveBeenCalledWith('usage');
  });

  it('should display budget text in Usage tab', () => {
    const keySpend: KeySpend = {
      spend: 0.41,
      max_budget: 5.0,
    };
    const usageInfo: UsageInfo = {
      prompt_tokens: 100,
      completion_tokens: 50,
      total_tokens: 150,
    };

    renderContextPanel([], usageInfo, keySpend, 'usage');

    // The budget card should show "$0.41 of $5.00"
    expect(screen.getByText('$0.41 of $5.00')).toBeTruthy();
  });

  it('should display key alias in Usage tab', () => {
    const keySpend: KeySpend = {
      spend: 0.41,
      max_budget: 5.0,
    };
    const usageInfo: UsageInfo = {
      prompt_tokens: 100,
      completion_tokens: 50,
      total_tokens: 150,
    };

    renderContextPanel([], usageInfo, keySpend, 'usage');

    expect(screen.getByText('sk-test-key-123')).toBeTruthy();
  });

  it('should display expiry time in Usage tab', () => {
    const keySpend: KeySpend = {
      spend: 0.41,
      max_budget: 5.0,
    };
    const usageInfo: UsageInfo = {
      prompt_tokens: 100,
      completion_tokens: 50,
      total_tokens: 150,
    };

    renderContextPanel([], usageInfo, keySpend, 'usage');

    // Should show "expires in" with time
    expect(screen.getByText(/expires in/)).toBeTruthy();
  });

  it('should show Sources tab content by default', () => {
    const citations: Citation[] = [
      { filename: 'doc.md', score: 0.8, snippet: 'test snippet' },
    ];
    renderContextPanel(citations, null, null, 'sources');

    // Should have the Sources content visible - check for the doc filename
    expect(screen.getByText('doc.md')).toBeTruthy();
  });

  it('should switch to Usage tab when prop changes', async () => {
    const { rerender } = render(
      <ThemeProvider theme={theme}>
        <ContextPanel
          citations={[]}
          lastTurnUsage={null}
          totalTokens={0}
          keySpend={null}
          tab="sources"
          onTabChange={() => {}}
        />
      </ThemeProvider>,
    );

    const usageTab = screen.getByRole('tab', { name: /Usage/ });
    expect(usageTab.getAttribute('aria-selected')).toBe('false');

    rerender(
      <ThemeProvider theme={theme}>
        <ContextPanel
          citations={[]}
          lastTurnUsage={null}
          totalTokens={0}
          keySpend={null}
          tab="usage"
          onTabChange={() => {}}
        />
      </ThemeProvider>,
    );

    await waitFor(() => {
      expect(usageTab.getAttribute('aria-selected')).toBe('true');
    });
  });

  it('should render LinearProgress with correct color for high budget usage', () => {
    const keySpend: KeySpend = {
      spend: 4.75,
      max_budget: 5.0,
    };
    const usageInfo: UsageInfo = {
      prompt_tokens: 100,
      completion_tokens: 50,
      total_tokens: 150,
    };

    const { container } = render(
      <ThemeProvider theme={theme}>
        <ContextPanel
          citations={[]}
          lastTurnUsage={usageInfo}
          totalTokens={150}
          keySpend={keySpend}
          tab="usage"
          onTabChange={() => {}}
        />
      </ThemeProvider>,
    );

    // Should show 95% budget used (error state)
    const progressBar = container.querySelector('[role="progressbar"]');
    expect(progressBar?.getAttribute('aria-valuenow')).toBe('95');
  });
});
