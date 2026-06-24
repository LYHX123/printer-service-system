import { Document, Page, View, Text, Image, StyleSheet } from "@react-pdf/renderer"
import { existsSync, readFileSync } from "fs"
import path from "path"
import { format } from "date-fns"
import { formatCurrency } from "@/lib/utils"
import { EQUIPMENT_TYPE_LABELS, SERVICE_TYPE_LABELS, QUOTATION_STATUS_LABELS } from "@/types"
import type { QuotationPdfData } from "@/lib/data/quotations"

const styles = StyleSheet.create({
  page: {
    padding: 32,
    fontSize: 9,
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
  section: {
    marginBottom: 10,
    breakInside: "avoid",
  },
  sectionTitle: {
    fontSize: 10,
    fontWeight: 700,
    marginBottom: 4,
    backgroundColor: "#f1f5f9",
    padding: 4,
  },
  row: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 2,
  },
  label: {
    color: "#64748b",
  },
  value: {
    fontWeight: 700,
    maxWidth: "65%",
    textAlign: "right",
  },
  twoCol: {
    flexDirection: "row",
    gap: 10,
  },
  col: {
    flex: 1,
  },
  paragraph: {
    lineHeight: 1.5,
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
    paddingVertical: 2,
    borderBottom: "0.5px solid #f1f5f9",
  },
  th: {
    fontWeight: 700,
    color: "#64748b",
    fontSize: 8,
    textTransform: "uppercase",
  },
  cellPart: { width: "46%" },
  cellQty: { width: "12%", textAlign: "right" },
  cellPrice: { width: "21%", textAlign: "right" },
  cellSubtotal: { width: "21%", textAlign: "right" },
  totals: {
    marginTop: 6,
    alignItems: "flex-end",
  },
  totalRow: {
    flexDirection: "row",
    width: 200,
    justifyContent: "space-between",
    marginBottom: 2,
  },
  totalRowFinal: {
    flexDirection: "row",
    width: 200,
    justifyContent: "space-between",
    borderTop: "1px solid #1e293b",
    paddingTop: 3,
    marginTop: 2,
    fontWeight: 700,
  },
  emptyText: {
    color: "#94a3b8",
    fontStyle: "italic",
  },
  footer: {
    position: "absolute",
    bottom: 20,
    left: 32,
    right: 32,
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

export function QuotationDocument({ quotation }: { quotation: QuotationPdfData }) {
  const logo = resolvePublicFile(quotation.company.logoUrl)
  const currency = quotation.company.currency
  const generatedOn = formatDateInTimezone(new Date(), quotation.company.timezone)

  const labourCost = Number(quotation.labourCost)
  const partsCost = Number(quotation.partsCost)
  const diagnosisFee = Number(quotation.diagnosisFee)
  const transportFee = Number(quotation.transportFee)
  const vatPercent = Number(quotation.vatPercent)
  const discountAmount = Number(quotation.discountAmount)
  const totalCost = Number(quotation.totalCost)
  const subtotal = labourCost + partsCost + diagnosisFee + transportFee
  const vatAmount = (subtotal * vatPercent) / 100

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.companyBlock}>
            {logo && <Image src={logo} style={styles.logo} />}
            <View>
              <Text style={styles.companyName}>{quotation.company.name}</Text>
              {quotation.company.address && <Text style={styles.companyMeta}>{quotation.company.address}</Text>}
              <Text style={styles.companyMeta}>
                {[quotation.company.phone, quotation.company.email, quotation.company.website].filter(Boolean).join("  •  ")}
              </Text>
              {quotation.company.kraPin && <Text style={styles.companyMeta}>KRA PIN: {quotation.company.kraPin}</Text>}
            </View>
          </View>
          <View style={styles.reportMeta}>
            <Text style={styles.reportTitle}>Quotation</Text>
            <Text>Quotation No: {quotation.quotationNumber}</Text>
            <Text>Status: {QUOTATION_STATUS_LABELS[quotation.status]}</Text>
            <Text>Generated on: {generatedOn}</Text>
          </View>
        </View>

        {/* Customer & Equipment */}
        <View style={styles.twoCol}>
          <View style={[styles.col, styles.section]}>
            <Text style={styles.sectionTitle}>Customer Information</Text>
            <View style={styles.row}><Text style={styles.label}>Company</Text><Text style={styles.value}>{quotation.customer.companyName}</Text></View>
            {quotation.customer.name && (
              <View style={styles.row}><Text style={styles.label}>Contact</Text><Text style={styles.value}>{quotation.customer.name}</Text></View>
            )}
            {quotation.customer.phone && (
              <View style={styles.row}><Text style={styles.label}>Phone</Text><Text style={styles.value}>{quotation.customer.phone}</Text></View>
            )}
            {quotation.customer.location && (
              <View style={styles.row}><Text style={styles.label}>Location</Text><Text style={styles.value}>{quotation.customer.location}</Text></View>
            )}
            {quotation.branch && (
              <View style={styles.row}><Text style={styles.label}>Branch / Site</Text><Text style={styles.value}>{quotation.branch.name}</Text></View>
            )}
          </View>

          <View style={[styles.col, styles.section]}>
            <Text style={styles.sectionTitle}>Quotation Details</Text>
            <View style={styles.row}><Text style={styles.label}>Service Type</Text><Text style={styles.value}>{SERVICE_TYPE_LABELS[quotation.serviceType]}</Text></View>
            {quotation.equipment && (
              <>
                <View style={styles.row}><Text style={styles.label}>Equipment</Text><Text style={styles.value}>{EQUIPMENT_TYPE_LABELS[quotation.equipment.type]}</Text></View>
                <View style={styles.row}><Text style={styles.label}>Brand / Model</Text><Text style={styles.value}>{quotation.equipment.brand} {quotation.equipment.model}</Text></View>
                <View style={styles.row}><Text style={styles.label}>Serial Number</Text><Text style={styles.value}>{quotation.equipment.serialNumber}</Text></View>
              </>
            )}
            <View style={styles.row}><Text style={styles.label}>Created</Text><Text style={styles.value}>{format(new Date(quotation.createdAt), "dd MMM yyyy")}</Text></View>
            {quotation.validUntil && (
              <View style={styles.row}><Text style={styles.label}>Valid Until</Text><Text style={styles.value}>{format(new Date(quotation.validUntil), "dd MMM yyyy")}</Text></View>
            )}
          </View>
        </View>

        {/* Problem description */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Problem Description</Text>
          <Text style={styles.paragraph}>{quotation.problemDesc}</Text>
        </View>

        {/* Spare parts */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Spare Parts</Text>
          {quotation.items.length > 0 ? (
            <View style={styles.table}>
              <View style={styles.tableHeader}>
                <Text style={[styles.th, styles.cellPart]}>Description</Text>
                <Text style={[styles.th, styles.cellQty]}>Qty</Text>
                <Text style={[styles.th, styles.cellPrice]}>Unit Price</Text>
                <Text style={[styles.th, styles.cellSubtotal]}>Subtotal</Text>
              </View>
              {quotation.items.map((item) => (
                <View key={item.id} style={styles.tableRow}>
                  <Text style={styles.cellPart}>{item.description}</Text>
                  <Text style={styles.cellQty}>{item.quantity}</Text>
                  <Text style={styles.cellPrice}>{formatCurrency(Number(item.unitPrice), currency)}</Text>
                  <Text style={styles.cellSubtotal}>{formatCurrency(Number(item.subtotal), currency)}</Text>
                </View>
              ))}
            </View>
          ) : (
            <Text style={styles.emptyText}>No spare parts listed.</Text>
          )}

          <View style={styles.totals}>
            {labourCost > 0 && (
              <View style={styles.totalRow}>
                <Text>Labour</Text>
                <Text>{formatCurrency(labourCost, currency)}</Text>
              </View>
            )}
            {partsCost > 0 && (
              <View style={styles.totalRow}>
                <Text>Parts ({quotation.items.length} item{quotation.items.length !== 1 ? "s" : ""})</Text>
                <Text>{formatCurrency(partsCost, currency)}</Text>
              </View>
            )}
            {diagnosisFee > 0 && (
              <View style={styles.totalRow}>
                <Text>Diagnosis Fee</Text>
                <Text>{formatCurrency(diagnosisFee, currency)}</Text>
              </View>
            )}
            {transportFee > 0 && (
              <View style={styles.totalRow}>
                <Text>Transport Fee</Text>
                <Text>{formatCurrency(transportFee, currency)}</Text>
              </View>
            )}
            <View style={styles.totalRow}>
              <Text>Subtotal</Text>
              <Text>{formatCurrency(subtotal, currency)}</Text>
            </View>
            {vatPercent > 0 && (
              <View style={styles.totalRow}>
                <Text>VAT ({vatPercent}%)</Text>
                <Text>{formatCurrency(vatAmount, currency)}</Text>
              </View>
            )}
            {discountAmount > 0 && (
              <View style={styles.totalRow}>
                <Text>Discount</Text>
                <Text>({formatCurrency(discountAmount, currency)})</Text>
              </View>
            )}
            <View style={styles.totalRowFinal}>
              <Text>Total</Text>
              <Text>{formatCurrency(totalCost, currency)}</Text>
            </View>
          </View>
        </View>

        {/* Remarks */}
        {quotation.remarks && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Remarks</Text>
            <Text style={styles.paragraph}>{quotation.remarks}</Text>
          </View>
        )}

        <Text style={styles.footer} fixed>
          {quotation.company.name} — Quotation {quotation.quotationNumber} — Generated on {generatedOn}
        </Text>
      </Page>
    </Document>
  )
}
