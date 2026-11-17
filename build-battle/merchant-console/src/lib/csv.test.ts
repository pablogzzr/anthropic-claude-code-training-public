import { describe, expect, it } from "vitest"
import { Payment } from "@/data/types"
import {
  DEFAULT_EXPORT_COLUMNS,
  EXPORT_COLUMNS,
  ExportColumn,
  exportFilename,
  exportScopeLabel,
  parseExportColumns,
  toCsv,
} from "./csv"

/**
 * The export is the file ops hands to a merchant, so a broken cell is a
 * support ticket rather than a stack trace. These tests pin the escaping and
 * the column contract; NWP-101 changes which columns ship, not how a cell is
 * written, and these should still pass afterwards.
 */

const payment: Payment = {
  id: "pay_0001",
  merchantId: "mch_01",
  amount: 25000,
  currency: "USD",
  status: "captured",
  method: "card",
  cardBrand: "visa",
  last4: "4242",
  createdAt: "2026-03-14T10:15:00.000Z",
  description: "Order 1180",
}

describe("toCsv", () => {
  it("writes a header row followed by one row per payment", () => {
    const lines = toCsv([payment]).split("\n")
    expect(lines).toHaveLength(2)
    expect(lines[0]).toBe(EXPORT_COLUMNS.join(","))
  })

  it("writes only the requested columns, in the order given", () => {
    expect(toCsv([payment], ["id", "amount"])).toBe(
      ["id,amount", "pay_0001,$250.00"].join("\n"),
    )
  })

  it("quotes cells containing a comma, so amounts do not split", () => {
    const large = { ...payment, amount: 123456789 }
    expect(toCsv([large], ["amount"])).toBe(['amount', '"$1,234,567.89"'].join("\n"))
  })

  it("doubles embedded quotes rather than dropping them", () => {
    const quoted = { ...payment, description: 'Order "rush"' }
    expect(toCsv([quoted], ["description"])).toBe(
      ["description", '"Order ""rush"""'].join("\n"),
    )
  })

  it("keeps a newline inside a description in one quoted cell", () => {
    const multiline = { ...payment, description: "Order 1180\nsecond line" }
    const body = toCsv([multiline], ["description"]).split("\n").slice(1).join("\n")
    expect(body).toBe('"Order 1180\nsecond line"')
  })

  it("resolves the merchant name, and falls back to the id when unknown", () => {
    expect(toCsv([payment], ["merchant"])).toContain("Lumen Coffee Roasters")
    const orphan = { ...payment, merchantId: "mch_missing" }
    expect(toCsv([orphan], ["merchant"])).toContain("mch_missing")
  })

  it("writes an empty cell for a payment with no card", () => {
    const bank: Payment = {
      ...payment,
      method: "bank_transfer",
      cardBrand: null,
      last4: null,
    }
    expect(toCsv([bank], ["card_brand", "last4"])).toBe(
      ["card_brand,last4", ","].join("\n"),
    )
  })

  it("emits a header even with no rows", () => {
    expect(toCsv([], ["id"])).toBe("id")
  })
})

describe("exportFilename", () => {
  it("stamps the UTC date, so two exports on the same day collide by design", () => {
    expect(exportFilename(new Date("2026-03-14T23:00:00.000Z"))).toBe(
      "payments-2026-03-14.csv",
    )
  })

  it("names the scope when given one", () => {
    expect(
      exportFilename(new Date("2026-08-13T12:00:00.000Z"), "disputed"),
    ).toBe("payments-disputed-2026-08-13.csv")
  })
})

/** Narrows a parse result to its columns, failing the test on an error. */
function columnsOf(raw: string | null): ExportColumn[] {
  const result = parseExportColumns(raw)
  if ("error" in result) throw new Error(result.error)
  return result.columns
}

describe("export column selection (NWP-101)", () => {
  it("writes a subset of columns in the order requested, not the allowlist order", () => {
    const columns = columnsOf("amount,status,id")
    expect(columns).toEqual(["amount", "status", "id"])
    expect(toCsv([payment], columns)).toBe(
      ["amount,status,id", "$250.00,captured,pay_0001"].join("\n"),
    )
  })

  it("drops a repeated column rather than writing it twice", () => {
    expect(columnsOf("id,amount,id")).toEqual(["id", "amount"])
  })

  it("leaves the card last four out when no columns are chosen", () => {
    const columns = columnsOf(null)
    expect(columns).toEqual([...DEFAULT_EXPORT_COLUMNS])
    expect(columns).not.toContain("last4")

    const [header, row] = toCsv([payment], columns).split("\n")
    expect(header.split(",")).not.toContain("last4")
    expect(row).not.toContain("4242")
  })

  it("still includes the last four when it is asked for explicitly", () => {
    expect(toCsv([payment], columnsOf("id,last4"))).toBe(
      ["id,last4", "pay_0001,4242"].join("\n"),
    )
  })

  it("refuses an empty selection instead of producing an empty file", () => {
    expect(parseExportColumns("")).toEqual({
      error: "Select at least one column",
    })
    expect(parseExportColumns(" , ")).toEqual({
      error: "Select at least one column",
    })
  })

  it("refuses a column name that is not on the allowlist", () => {
    expect(parseExportColumns("id,card_number")).toEqual({
      error: "Unknown column: card_number",
    })
  })

  it("keeps the default set a subset of the allowlist", () => {
    for (const column of DEFAULT_EXPORT_COLUMNS) {
      expect(EXPORT_COLUMNS).toContain(column)
    }
  })
})

describe("exportScopeLabel", () => {
  it("labels all-payments scope as all, whatever filter is active", () => {
    expect(exportScopeLabel("all", { status: "disputed" })).toBe("all")
  })

  it("labels a filtered export by its status and known merchant", () => {
    expect(exportScopeLabel("filtered", { status: "disputed" })).toBe("disputed")
    expect(
      exportScopeLabel("filtered", { status: "refunded", merchantId: "mch_01" }),
    ).toBe("refunded-mch_01")
  })

  it("never puts free-text search or an unknown merchant id in the filename", () => {
    expect(exportScopeLabel("filtered", { search: "../../etc" })).toBe("filtered")
    expect(exportScopeLabel("filtered", { merchantId: "../evil" })).toBe("all")
  })
})
