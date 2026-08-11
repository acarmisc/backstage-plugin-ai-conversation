import React from 'react';
export interface PersonaAvatarProps {
    label: string;
    isStreaming?: boolean;
    size?: number;
}
/**
 * The design system's one persistent animated element: a thin ring around
 * the persona/model avatar that shows the accent gradient rotating while
 * that column is actively streaming, and a neutral divider color at rest.
 * Reused identically per-column in multi-model compare mode (phase13).
 */
export declare const PersonaAvatar: React.FC<PersonaAvatarProps>;
