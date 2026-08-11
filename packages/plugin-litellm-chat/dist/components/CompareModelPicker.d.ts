import React from 'react';
export interface CompareModelPickerProps {
    value: string[];
    onChange: (models: string[]) => void;
}
export declare const CompareModelPicker: React.FC<CompareModelPickerProps>;
