import React from 'react';
import type { ChatConfig, ChatTraits, ReasoningEffort } from '../types';
export interface ChatSettingsPanelProps {
    showSettings: boolean;
    onToggleShowSettings: () => void;
    configError: string | null;
    config: ChatConfig;
    traits: ChatTraits;
    traitsLoading: boolean;
    toneId: string;
    onToneChange: (id: string) => void;
    focusId: string;
    onFocusChange: (id: string) => void;
    customSystemPrompt: string;
    onCustomSystemPromptChange: (value: string) => void;
    model: string;
    onModelChange: (model: string) => void;
    vectorStoreIds: string[];
    onVectorStoreIdsChange: (ids: string[]) => void;
    webSearch: boolean;
    onWebSearchChange: (enabled: boolean) => void;
    verbosityId: string;
    onVerbosityChange: (id: string) => void;
    reasoningEffort: ReasoningEffort | '';
    onReasoningEffortChange: (value: ReasoningEffort | '') => void;
}
export declare const ChatSettingsPanel: React.FC<ChatSettingsPanelProps>;
