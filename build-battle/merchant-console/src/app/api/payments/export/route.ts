import { filterPayments, parseFilters, sortPayments } from "@/data/queries"
import { PaymentFilters } from "@/data/types"
import {
  exportFilename,
  exportScopeLabel,
  parseExportColumns,
  parseExportScope,
  toCsv,
} from "@/lib/csv"
import { NextRequest, NextResponse } from "next/server"

/**
 * Exports the payments table as CSV.
 *
 * Ops chooses the columns and the scope (NWP-101). Both arrive from the
 * client, so both are checked against an allowlist before anything runs.
 * Rows always come from the shared query builder, never from the page.
 */
export function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams

  const parsed = parseExportColumns(params.get("columns"))
  if ("error" in parsed) {
    return NextResponse.json({ error: parsed.error }, { status: 400 })
  }

  const scope = parseExportScope(params.get("scope"))
  const requested = parseFilters(params)
  const filters: PaymentFilters =
    scope === "all"
      ? { sort: requested.sort, direction: requested.direction }
      : requested

  const rows = sortPayments(
    filterPayments(filters),
    filters.sort,
    filters.direction,
  )
  const filename = exportFilename(new Date(), exportScopeLabel(scope, filters))

  return new Response(toCsv(rows, parsed.columns), {
    headers: {
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": `attachment; filename="${filename}"`,
    },
  })
}
