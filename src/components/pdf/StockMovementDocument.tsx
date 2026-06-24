import { Document, Page, View, Text, Image, StyleSheet } from "@react-pdf/renderer"
import { existsSync, readFileSync } from "fs"
import path from "path"
import { format } from "date-fns"
import { TRANSACTION_TYPE_LABELS } from "@/types"
import type { InventoryTransactionWithRelations } from "@/types"
import type { CompanySettings } from "@/lib/data/settings"
import { STOCK_TYPE_LABELS, getStockType } from "@/lib/stock-types"

const styles = StyleSheet.create({
  page: {
    padding: 28,
    fontSize: 8,
    fontFamily: "Helvetica",
    color: "#1e293b",
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    borderBottom: "2px solid #1e293b",
    paddingBottom: 10,
    marginBottom: 12,
  },
  logo: {
    width: 48,
    height: 48,
    objectFit: "contain",
    marginRight: 10,
  },
  companyBlock: {
    flexDirection: "row",
    alignItems: "center",
  },
  companyName: {
    fontSize: 14,
    fontWeight: 700,
    marginBottom: 2,
  },
  companyMeta: {
    fontSize: 8,
    color: "#64748b",
  },
  reportMeta: {
    alignItems: "flex-end",
  },
  reportTitle: {
    fontSize: 12,
    fontWeight: 700,
    marginBottom: 4,
  },
  table: {
    width: "100%",
  },
  tableHeader: {
    flexDirection: "row",
    borderBottom: "1px solid #cbd5e1",
    paddingBottom: 3,
    marginBottom: 3,
  },
  tableRow: {
    flexDirection: "row",
    paddingVertical: 3,
    borderBottom: "0.5px solid #f1f5f9",
  },
  th: {
    fontWeight: 700,
    color: "#64748b",
    fontSize: 7,
    textTransform: "uppercase",
  },
  cellDate: { width: "9%" },
  cellCategory: { width: "11%" },
  cellItem: { width: "17%" },
  cellType: { width: "10%" },
  cellQuantity: { width: "9%", textAlign: "right" },
  cellReference: { width: "12%" },
  cellRemark: { width: "20%" },
  cellCreatedBy: { width: "12%" },
  emptyText: {
    color: "#94a3b8",
    fontStyle: "italic",
    marginTop: 8,
  },
  footer: {
    position: "absolute",
    bottom: 16,
    left: 28,
    right: 28,
    fontSize: 7,
    color: "#94a3b8",
    textAlign: "center",
    borderTop: "0.5px solid #e2e8f0",
    paddingTop: 4,
  },
})

const IMAGE_MIME_TYPES: Record<string, string> = {
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".svg": "image/svg+xml",
}

function resolvePublicFile(url: string | null | undefined): string | undefined {
  if (!url) return undefined
  const filePath = path.join(process.cwd(), "public", url.replace(/^\//, ""))
  if (!existsSync(filePath)) return undefined

  const mimeType = IMAGE_MIME_TYPES[path.extname(filePath).toLowerCase()]
  if (!mimeType) return undefined

  const data = readFileSync(filePath).toString("base64")
  return `data:${mimeType};base64,${data}`
}

function formatDateInTimezone(date: Date, timezone: string): string {
  const formatter = new Intl.DateTimeFormat("en-GB", {
    timeZone: timezone,
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  })
  const parts = formatter.formatToParts(date)
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? ""
  return `${get("day")} ${get("month")} ${get("year")}, ${get("hour")}:${get("minute")}`
}

interface StockMovementDocumentProps {
  movements: InventoryTransactionWithRelations[]
  company: CompanySettings
}

export function StockMovementDocument({ movements, company }: StockMovementDocumentProps) {
  const logo = resolvePublicFile(company.logoUrl)
  const generatedOn = formatDateInTimezone(new Date(), company.timezone)

  return (
    <Document>
      <Page size="A4" orientation="landscape" style={styles.page}>
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.companyBlock}>
            {logo && <Image src={logo} style={styles.logo} />}
            <View>
              <Text style={styles.companyName}>{company.name}</Text>
              {company.address && <Text style={styles.companyMeta}>{company.address}</Text>}
              <Text style={styles.companyMeta}>
                {[company.phone, company.email, company.website].filter(Boolean).join("  •  ")}
              </Text>
              {company.kraPin && <Text style={styles.companyMeta}>KRA PIN: {company.kraPin}</Text>}
            </View>
          </View>
          <View style={styles.reportMeta}>
            <Text style={styles.reportTitle}>Stock Movement Report</Text>
            <Text>Total Movements: {movements.length}</Text>
            <Text>Generated on: {generatedOn}</Text>
          </View>
        </View>

        {/* Movements table */}
        {movements.length > 0 ? (
          <View style={styles.table}>
            <View style={styles.tableHeader} fixed>
              <Text style={[styles.th, styles.cellDate]}>Date</Text>
              <Text style={[styles.th, styles.cellCategory]}>Stock Category</Text>
              <Text style={[styles.th, styles.cellItem]}>Stock Item</Text>
              <Text style={[styles.th, styles.cellType]}>Movement Type</Text>
              <Text style={[styles.th, styles.cellQuantity]}>Quantity</Text>
              <Text style={[styles.th, styles.cellReference]}>Reference No</Text>
              <Text style={[styles.th, styles.cellRemark]}>Remark</Text>
              <Text style={[styles.th, styles.cellCreatedBy]}>Created By</Text>
            </View>
            {movements.map((m) => (
              <View key={m.id} style={styles.tableRow} wrap={false}>
                <Text style={styles.cellDate}>{format(new Date(m.createdAt), "dd MMM yyyy")}</Text>
                <Text style={styles.cellCategory}>{STOCK_TYPE_LABELS[getStockType(m.part.category)]}</Text>
                <Text style={styles.cellItem}>{m.part.name} ({m.part.partNumber})</Text>
                <Text style={styles.cellType}>{TRANSACTION_TYPE_LABELS[m.type]}</Text>
                <Text style={styles.cellQuantity}>{m.quantity > 0 ? "+" : ""}{m.quantity} {m.part.unit}</Text>
                <Text style={styles.cellReference}>{m.reference ?? "—"}</Text>
                <Text style={styles.cellRemark}>{m.remark ?? "—"}</Text>
                <Text style={styles.cellCreatedBy}>{m.performedBy.name}</Text>
              </View>
            ))}
          </View>
        ) : (
          <Text style={styles.emptyText}>No stock movements match the current filters.</Text>
        )}

        <Text style={styles.footer} fixed>
          {company.name} — Stock Movement Report — Generated on {generatedOn}
        </Text>
      </Page>
    </Document>
  )
}
