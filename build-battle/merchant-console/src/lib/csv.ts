import { merchantById } from "@/data/merchants"
import { Payment, PaymentFilters } from "@/data/types"
import { formatMoney } from "./money"

/**
 * CSV export for the payments table.
 *
 * Ops chooses the columns (NWP-101). The route validates the choice with
 * parseExportColumns; the card last four is off unless asked for.
 */

export const EXPORT_COLUMNS = [
  "id",
  "created_at",
  "merchant",
  "description",
  "status",
  "method",
  "card_brand",
  "last4",
  "amount",
  "currency",
] as const

export type ExportColumn = (typeof EXPORT_COLUMNS)[number]

/**
 * What an export contains when ops does not choose. The card last four is
 * left out so a file can go to a merchant without hand-editing.
 */
export const DEFAULT_EXPORT_COLUMNS: readonly ExportColumn[] =
  EXPORT_COLUMNS.filter((column) => column !== "last4")

export type ExportScope = "filtered" | "all"

function isExportColumn(value: string): value is ExportColumn {
  return (EXPORT_COLUMNS as readonly string[]).includes(value)
}

/**
 * Validates the `columns` query param against the EXPORT_COLUMNS allowlist.
 * Absent means the defaults. Present but empty, or naming any column not on
 * the list, is an error: the route refuses rather than guessing.
 */
export function parseExportColumns(
  raw: string | null,
): { columns: ExportColumn[] } | { error: string } {
  if (raw === null) return { columns: [...DEFAULT_EXPORT_COLUMNS] }

  const requested = raw
    .split(",")
    .map((name) => name.trim())
    .filter(Boolean)
  if (requested.length === 0) return { error: "Select at least one column" }

  const columns: ExportColumn[] = []
  for (const name of requested) {
    if (!isExportColumn(name)) return { error: `Unknown column: ${name}` }
    if (!columns.includes(name)) columns.push(name)
  }
  return { columns }
}

export function parseExportScope(raw: string | null): ExportScope {
  return raw === "all" ? "all" : "filtered"
}

/**
 * The scope part of the filename, built only from values that have already
 * passed an allowlist. Free-text search never reaches a filename.
 */
export function exportScopeLabel(
  scope: ExportScope,
  filters: PaymentFilters,
): string {
  if (scope === "all") return "all"

  const parts: string[] = []
  if (filters.status && filters.status !== "all") parts.push(filters.status)
  if (filters.merchantId && merchantById(filters.merchantId)) {
    parts.push(filters.merchantId)
  }
  if (parts.length > 0) return parts.join("-")
  return filters.search ? "filtered" : "all"
}

function escapeCell(value: string): string {
  if (/[",\n]/.test(value)) return `"${value.replace(/"/g, '""')}"`
  return value
}

function cell(payment: Payment, column: ExportColumn): string {
  switch (column) {
    case "id":
      return payment.id
    case "created_at":
      return payment.createdAt
    case "merchant":
      return merchantById(payment.merchantId)?.name ?? payment.merchantId
    case "description":
      return payment.description
    case "status":
      return payment.status
    case "method":
      return payment.method
    case "card_brand":
      return payment.cardBrand ?? ""
    case "last4":
      return payment.last4 ?? ""
    case "amount":
      return formatMoney(payment.amount, payment.currency)
    case "currency":
      return payment.currency
  }
}

export function toCsv(
  payments: Payment[],
  columns: readonly ExportColumn[] = EXPORT_COLUMNS,
): string {
  const header = columns.join(",")
  const rows = payments.map((payment) =>
    columns.map((column) => escapeCell(cell(payment, column))).join(","),
  )
  return [header, ...rows].join("\n")
}

export function exportFilename(date = new Date(), label?: string): string {
  const prefix = label ? `payments-${label}` : "payments"
  return `${prefix}-${date.toISOString().slice(0, 10)}.csv`
}
