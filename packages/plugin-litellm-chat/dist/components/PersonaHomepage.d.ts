import React from 'react';
import type { Persona } from '../types';
export interface PersonaHomepageProps {
    personas: Persona[];
    loading: boolean;
    error: string | null;
    selectedId: string;
    /** Fires with the full Persona (or undefined for "None") — same shape as
     * PersonaPicker's onChange so the parent can share one handler. */
    onSelect: (personaId: string, persona: Persona | undefined) => void;
}
export declare const PersonaHomepage: React.FC<PersonaHomepageProps>;
