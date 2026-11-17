"use client"

import { Button } from "@/components/Button"
import {
  Drawer,
  DrawerBody,
  DrawerClose,
  DrawerContent,
  DrawerDescription,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
  DrawerTrigger,
} from "@/components/Drawer"
import type { ExportColumn, ExportScope } from "@/lib/csv"
import { Download } from "lucide-react"
import { useState } from "react"

const COLUMN_LABELS: Record<ExportColumn, string> = {
  id: "Payment ID",
  created_at: "Created (UTC)",
  merchant: "Merchant",
  description: "Description",
  status: "Status",
  method: "Method",
  card_brand: "Card brand",
  last4: "Card last four",
  amount: "Amount",
  currency: "Currency",
}

/**
 * Export options for the payments table (NWP-101). The choices here are
 * convenience only; the export route validates columns and scope again.
 */
export function ExportDialog({
  query,
  filteredCount,
  allCount,
  columns,
  defaultColumns,
}: {
  /** The current filter query, without the page number. */
  query: string
  filteredCount: number
  allCount: number
  columns: readonly ExportColumn[]
  defaultColumns: readonly ExportColumn[]
}) {
  const [selected, setSelected] = useState<ExportColumn[]>([...defaultColumns])
  const [scope, setScope] = useState<ExportScope>("filtered")

  const ordered = columns.filter((column) => selected.includes(column))
  const rowCount = scope === "all" ? allCount : filteredCount

  const toggle = (column: ExportColumn, checked: boolean) =>
    setSelected((current) =>
      checked
        ? [...current, column]
        : current.filter((value) => value !== column),
    )

  const href = (() => {
    const params = new URLSearchParams(query)
    params.set("scope", scope)
    params.set("columns", ordered.join(","))
    return `/api/payments/export?${params.toString()}`
  })()

  return (
    <Drawer>
      <DrawerTrigger asChild>
        <Button variant="secondary" className="w-full gap-2 py-1.5 sm:w-fit">
          <Download
            className="-ml-0.5 size-4 shrink-0 text-gray-400 dark:text-gray-600"
            aria-hidden="true"
          />
          Export
        </Button>
      </DrawerTrigger>
      <DrawerContent className="sm:max-w-md">
        <DrawerHeader>
          <DrawerTitle>Export payments</DrawerTitle>
          <DrawerDescription>
            Choose what goes into the CSV file.
          </DrawerDescription>
        </DrawerHeader>

        <DrawerBody className="flex flex-col gap-6">
          <fieldset>
            <legend className="text-sm font-medium text-gray-900 dark:text-gray-50">
              Scope
            </legend>
            <div className="mt-2 flex flex-col gap-2">
              {(
                [
                  ["filtered", "Current filter", filteredCount],
                  ["all", "All payments", allCount],
                ] as const
              ).map(([value, label, count]) => (
                <label
                  key={value}
                  className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300"
                >
                  <input
                    type="radio"
                    name="export-scope"
                    value={value}
                    checked={scope === value}
                    onChange={() => setScope(value)}
                    className="size-4 accent-blue-600"
                  />
                  {label}
                  <span className="text-gray-500">
                    ({count.toLocaleString()} rows)
                  </span>
                </label>
              ))}
            </div>
          </fieldset>

          <fieldset>
            <legend className="text-sm font-medium text-gray-900 dark:text-gray-50">
              Columns
            </legend>
            <div className="mt-2 grid grid-cols-2 gap-2">
              {columns.map((column) => (
                <label
                  key={column}
                  className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300"
                >
                  <input
                    type="checkbox"
                    name="export-columns"
                    value={column}
                    checked={selected.includes(column)}
                    onChange={(event) => toggle(column, event.target.checked)}
                    className="size-4 accent-blue-600"
                  />
                  {COLUMN_LABELS[column]}
                </label>
              ))}
            </div>
            {ordered.length === 0 && (
              <p role="status" className="mt-2 text-sm text-red-600 dark:text-red-500">
                Select at least one column to download.
              </p>
            )}
          </fieldset>
        </DrawerBody>

        <DrawerFooter className="items-center gap-2">
          <p className="mr-auto text-sm text-gray-500">
            {rowCount.toLocaleString()} rows · {ordered.length} columns
          </p>
          <DrawerClose asChild>
            <Button variant="secondary" className="py-1.5">
              Cancel
            </Button>
          </DrawerClose>
          {ordered.length > 0 ? (
            <Button className="py-1.5" asChild>
              <a href={href} download>
                Download CSV
              </a>
            </Button>
          ) : (
            <Button className="py-1.5" disabled>
              Download CSV
            </Button>
          )}
        </DrawerFooter>
      </DrawerContent>
    </Drawer>
  )
}
