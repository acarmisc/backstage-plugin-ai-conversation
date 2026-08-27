import React from 'react';
export interface OptionPickerOption {
    id: string;
    label: string;
}
export interface OptionPickerProps {
    label: string;
    value: string;
    options: OptionPickerOption[];
    onChange: (id: string) => void;
    loading?: boolean;
    /** Label for the empty/unset choice. Defaults to "Default". */
    noneLabel?: string;
}
/**
 * Generic small Select for a single trait pick (tone/focus/verbosity/
 * reasoning effort) — same shape as PersonaPicker/ModelPicker, factored out
 * because those four pickers are otherwise identical apart from their
 * option list.
 */
export declare const OptionPicker: React.FC<OptionPickerProps>;
