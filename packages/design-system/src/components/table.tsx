// Table (doc 10 Grupo E). Sem zebra, linhas separadas por border.subtle,
// densidade confortável, tabular-nums em números.

import type { ReactNode } from "react";
import { cn } from "../utils/cn";

export interface TableColumn<T> {
  key: string;
  header: string;
  render: (row: T) => ReactNode;
  numeric?: boolean;
}

export interface TableProps<T> {
  columns: TableColumn<T>[];
  rows: T[];
  rowKey: (row: T) => string;
  emptyState?: ReactNode;
  onRowClick?: (row: T) => void;
  className?: string;
}

export function Table<T>({
  columns,
  rows,
  rowKey,
  emptyState,
  onRowClick,
  className,
}: TableProps<T>) {
  if (rows.length === 0 && emptyState) return <>{emptyState}</>;

  return (
    <div className={cn("overflow-x-auto", className)}>
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-[var(--shina-border-subtle)]">
            {columns.map((col) => (
              <th
                key={col.key}
                className={cn(
                  "text-left px-4 py-3 text-xs font-semibold uppercase tracking-wide text-[var(--shina-text-tertiary)]",
                  col.numeric && "text-right",
                )}
              >
                {col.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr
              key={rowKey(row)}
              onClick={() => onRowClick?.(row)}
              className={cn(
                "border-b border-[var(--shina-border-subtle)] transition-colors duration-fast",
                onRowClick && "cursor-pointer hover:bg-[var(--shina-surface-glass-hover)]",
              )}
              style={{ height: 44 }}
            >
              {columns.map((col) => (
                <td
                  key={col.key}
                  className={cn(
                    "px-4 py-3 text-[var(--shina-text-primary)]",
                    col.numeric && "text-right tabular-nums",
                  )}
                >
                  {col.render(row)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
