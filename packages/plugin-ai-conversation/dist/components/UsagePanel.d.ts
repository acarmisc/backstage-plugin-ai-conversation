import React from 'react';
import type { KeySpend, UsageInfo } from '../types';
export interface UsagePanelProps {
    lastTurnUsage: UsageInfo | null;
    totalTokens: number;
    keySpend: KeySpend | null;
}
export declare const UsagePanel: React.FC<UsagePanelProps>;
