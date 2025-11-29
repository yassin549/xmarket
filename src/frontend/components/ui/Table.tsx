'use client';

/**
 * Table Component
 * 
 * Data table with sorting and responsive design.
 */

import { ReactNode } from 'react';

interface Column<T> {
    key: string;
    label: string;
    sortable?: boolean;
    render?: (value: any, row: T) => ReactNode;
}

interface TableProps<T> {
    columns: Column<T>[];
    data: T[];
    onRowClick?: (row: T) => void;
}

export function Table<T extends Record<string, any>>({
    columns,
    data,
    onRowClick,
}: TableProps<T>) {
    return (
        <div className="overflow-x-auto">
            <table className="table">
                <thead>
                    <tr>
                        {columns.map((column) => (
                            <th key={column.key}>
                                {column.label}
                            </th>
                        ))}
                    </tr>
                </thead>
                <tbody>
                    {data.map((row, index) => (
                        <tr
                            key={index}
                            onClick={() => onRowClick?.(row)}
                            className={onRowClick ? 'cursor-pointer' : ''}
                        >
                            {columns.map((column) => (
                                <td key={column.key}>
                                    {column.render
                                        ? column.render(row[column.key], row)
                                        : row[column.key]}
                                </td>
                            ))}
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
}
