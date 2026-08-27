import React from 'react';
export interface BarListProps {
    rows: Array<{
        key: string;
        count: number;
    }>;
    emptyLabel?: string;
}
export declare const BarList: React.FC<BarListProps>;
