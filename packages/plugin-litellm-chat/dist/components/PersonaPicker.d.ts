import React from 'react';
import type { Persona } from '../types';
export interface PersonaPickerProps {
    value: string;
    /** Fires with the full Persona (or undefined for "None") so the parent
     * can prefill model/knowledge-base pickers from its defaults. */
    onChange: (personaId: string, persona: Persona | undefined) => void;
}
export declare const PersonaPicker: React.FC<PersonaPickerProps>;
