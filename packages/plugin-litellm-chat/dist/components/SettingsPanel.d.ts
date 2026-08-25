import React from 'react';
import type { ChatConfig, ChatTraits, Persona, ReasoningEffort } from '../types';
export interface SettingsPanelProps {
    configError: string | null;
    personaId: string;
    personas: Persona[];
    personasLoading: boolean;
    personasError: string | null;
    onPersonaChange: (id: string, persona: Persona | undefined) => void;
    toneId: string;
    onToneChange: (id: string) => void;
    traits: ChatTraits;
    traitsLoading: boolean;
    focusId: string;
    onFocusChange: (id: string) => void;
    customSystemPrompt: string;
    onCustomSystemPromptChange: (prompt: string) => void;
    keyVal: {
        alias: string;
        token: string;
    };
    onKeyChange: (keyVal: {
        alias: string;
        token: string;
    }) => void;
    onDeleteKey: () => void;
    compareMode: boolean;
    onCompareModeChange: (mode: boolean) => void;
    compareModelsSel: string[];
    onCompareModelsChange: (models: string[]) => void;
    model: string;
    onModelChange: (model: string) => void;
    config: ChatConfig;
    vectorStoreIds: string[];
    onVectorStoreIdsChange: (ids: string[]) => void;
    webSearch: boolean;
    onWebSearchChange: (enabled: boolean) => void;
    verbosityId: string;
    onVerbosityChange: (id: string) => void;
    reasoningEffort: ReasoningEffort | '';
    onReasoningEffortChange: (effort: ReasoningEffort | '') => void;
}
export declare const SettingsPanel: React.FC<SettingsPanelProps>;
