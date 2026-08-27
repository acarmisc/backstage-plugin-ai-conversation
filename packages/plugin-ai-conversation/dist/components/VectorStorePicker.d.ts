import React from 'react';
export interface VectorStorePickerProps {
    value: string[];
    onChange: (ids: string[]) => void;
    defaultVectorStoreIds?: string[] | null;
}
export declare const VectorStorePicker: React.FC<VectorStorePickerProps>;
