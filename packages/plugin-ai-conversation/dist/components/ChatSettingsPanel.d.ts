import React from 'react';
import type { AiConversationApiInterface } from '../api';
import type { ChatConfig, ChatTraits, Persona, ReasoningEffort } from '../types';
export interface ChatSettingsPanelProps {
    chatApi: AiConversationApiInterface;
    showSettings: boolean;
    onToggleShowSettings: () => void;
    configError: string | null;
    config: ChatConfig;
    personas: Persona[];
    personasLoading: boolean;
    personasError: string | null;
    personaId: string;
    onPersonaChange: (id: string, persona: Persona | undefined) => void;
    traits: ChatTraits;
    traitsLoading: boolean;
    toneId: string;
    onToneChange: (id: string) => void;
    focusId: string;
    onFocusChange: (id: string) => void;
    customSystemPrompt: string;
    onCustomSystemPromptChange: (value: string) => void;
    compareMode: boolean;
    onCompareModeChange: (enabled: boolean) => void;
    compareModelsSel: string[];
    onCompareModelsChange: (models: string[]) => void;
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
    keyVal: {
        alias: string;
        token: string;
    };
    onKeyChange: (value: {
        alias: string;
        token: string;
    }) => void;
    activeThreadKeyToken?: string;
}
/**
 * Settings panel extracted from ChatPage.tsx (HANDOFF-ai-sdk-migration.md
 * Phase 21 "UI tidy-up") — persona/tone/focus/model/compare/KB/web-search/
 * verbosity/reasoning/key pickers. Mechanical extraction, not a redesign:
 * same fields, same layout, just moved out of ChatPage's Collapse. State
 * ownership stays lifted in ChatPage (passed into useThreads), since these
 * values feed the active send request, not just this panel's own rendering.
 */
export declare const ChatSettingsPanel: React.FC<ChatSettingsPanelProps>;
