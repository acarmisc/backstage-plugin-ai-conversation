import React from 'react';
import type { Skill } from '../types';
export interface SkillPickerProps {
    value: string;
    skills: Skill[];
    onChange: (id: string) => void;
}
/**
 * Optional chat-skill selector. A skill is a catalog-authored (or bundled)
 * system-prompt preset — see the backend's `/skills`. The prompt text
 * itself never reaches the browser; picking one only sends `skill_id` with
 * the turn. Selecting a skill also prefills the model / knowledge bases it
 * declares as defaults (handled by the caller).
 *
 * Renders nothing but a disabled hint when no skills are configured, so the
 * setting doesn't look broken in an install that hasn't set any up.
 */
export declare const SkillPicker: React.FC<SkillPickerProps>;
