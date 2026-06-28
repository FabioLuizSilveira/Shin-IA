import type { Operation, OperationStatus } from "./types.js";

export function computeOperationStatus(op: Operation): OperationStatus {
  if (op.status === "completed" || op.status === "cancelled") return op.status;
  if (op.dueDate && new Date(op.dueDate) < new Date()) {
    return "overdue";
  }
  return op.status;
}

export function sortByPriority(operations: Operation[]): Operation[] {
  return [...operations].sort((a, b) => b.priority - a.priority);
}

export function countByStatus(operations: Operation[]): Record<OperationStatus, number> {
  const counts: Record<OperationStatus, number> = {
    pending: 0,
    in_progress: 0,
    completed: 0,
    cancelled: 0,
    overdue: 0,
  };
  for (const op of operations) {
    const status = computeOperationStatus(op);
    counts[status]++;
  }
  return counts;
}

export function filterByAssignee(operations: Operation[], assignedTo: string): Operation[] {
  return operations.filter((op) => op.assignedTo === assignedTo);
}
