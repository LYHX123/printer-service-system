import { Document, Page, View, Text, Image, StyleSheet } from "@react-pdf/renderer"
import { existsSync, readFileSync } from "fs"
import path from "path"
import { format } from "date-fns"
import type { QuotationPdfData } from "@/lib/data/quotations"
import type { QuotationItemWithPart } from "@/lib/data/quotations"

const MIN_VISIBLE_ROWS = 5

const styles = StyleSheet.create({
  page: {
    padding: 32,
    fontSize: 9,
    fontFamily: "Helvetica",
    color: "#1e293b",
  },
  headerWrap: {
    position: "relative",
    alignItems: "center",
    marginBottom: 8,
  },
  logoTopRight: {
    position: "absolute",
    top: 0,
    right: 0,
    width: 50,
    height: 50,
    objectFit: "contain",
  },
  companyName: {
    fontSize: 13,
    fontWeight: 700,
    textAlign: "center",
  },
  companyMeta: {
    fontSize: 8.5,
    color: "#334155",
    textAlign: "center",
    marginTop: 2,
  },
  titleBlock: {
    alignItems: "center",
    borderTop: "1.5px solid #1e293b",
    borderBottom: "1.5px solid #1e293b",
    paddingVertical: 4,
    marginBottom: 10,
  },
  titleText: {
    fontSize: 12,
    fontWeight: 700,
    letterSpacing: 1,
  },
  metaRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 12,
  },
  customerLabel: {
    fontSize: 9,
    fontWeight: 700,
    marginBottom: 2,
  },
  customerValue: {
    fontSize: 9,
    marginBottom: 1,
  },
  dateBlock: {
    alignItems: "flex-end",
  },
  dateRow: {
    fontSize: 9,
    marginBottom: 1,
  },
  table: {
    width: "100%",
  },
  tableHeader: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#f1f5f9",
    borderTop: "1px solid #1e293b",
    borderBottom: "1px solid #1e293b",
    paddingVertical: 4,
  },
  tableRow: {
    flexDirection: "row",
    alignItems: "center",
    minHeight: 34,
    borderBottom: "0.5px solid #cbd5e1",
    paddingVertical: 2,
  },
  th: {
    fontWeight: 700,
    color: "#1e293b",
    fontSize: 7.5,
    textTransform: "uppercase",
    textAlign: "center",
  },
  cellNo: { width: "6%", textAlign: "center", fontSize: 8.5 },
  cellItemNo: { width: "12%", textAlign: "center", fontSize: 8 },
  cellDesc: { width: "26%", fontSize: 8.5, paddingHorizontal: 2 },
  cellUnit: { width: "8%", textAlign: "center", fontSize: 8.5 },
  cellQty: { width: "7%", textAlign: "center", fontSize: 8.5 },
  cellPrice: { width: "14%", textAlign: "right", fontSize: 8.5, paddingRight: 4 },
  cellAmount: { width: "14%", textAlign: "right", fontSize: 8.5, paddingRight: 4 },
  cellSample: { width: "13%", alignItems: "center" },
  itemImage: {
    width: 28,
    height: 28,
    objectFit: "cover",
    borderRadius: 2,
  },
  bottomRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 12,
  },
  noteBlock: {
    maxWidth: "55%",
  },
  noteTitle: {
    fontSize: 9,
    fontWeight: 700,
    marginBottom: 2,
  },
  noteItem: {
    fontSize: 8,
    color: "#334155",
  },
  totals: {
    alignItems: "flex-end",
  },
  totalRow: {
    flexDirection: "row",
    width: 190,
    justifyContent: "space-between",
    marginBottom: 2,
    fontSize: 9,
  },
  totalRowFinal: {
    flexDirection: "row",
    width: 190,
    justifyContent: "space-between",
    borderTop: "1px solid #1e293b",
    paddingTop: 3,
    marginTop: 2,
    fontWeight: 700,
    fontSize: 9.5,
  },
  remarksBlock: {
    marginTop: 14,
  },
  remarksTitle: {
    fontSize: 9,
    fontWeight: 700,
    marginBottom: 2,
  },
  remarksText: {
    fontSize: 8.5,
    lineHeight: 1.4,
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

function formatAmount(amount: number): string {
  return new Intl.NumberFormat("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount)
}

export function QuotationDocument({ quotation }: { quotation: QuotationPdfData }) {
  const logo = resolvePublicFile(quotation.company.logoUrl)
  const generatedOn = formatDateInTimezone(new Date(), quotation.company.timezone)

  const vatPercent = Number(quotation.vatPercent)
  const totalCost = Number(quotation.totalCost)
  const subtotal = Number(quotation.subtotal)
  const vatAmount = (subtotal * vatPercent) / 100

  const rows: (QuotationItemWithPart | null)[] = [...quotation.items]
  while (rows.length < MIN_VISIBLE_ROWS) rows.push(null)

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        {/* Header */}
        <View style={styles.headerWrap}>
          {logo && <Image src={logo} style={styles.logoTopRight} />}
          <Text style={styles.companyName}>{quotation.company.name}</Text>
          {quotation.company.address && (
            <Text style={styles.companyMeta}>{quotation.company.address}</Text>
          )}
          {quotation.company.kraPin && (
            <Text style={styles.companyMeta}>PIN: {quotation.company.kraPin}</Text>
          )}
        </View>

        <View style={styles.titleBlock}>
          <Text style={styles.titleText}>QUOTATION LIST</Text>
        </View>

        {/* Customer + Date/Quotation No */}
        <View style={styles.metaRow}>
          <View>
            <Text style={styles.customerLabel}>CUSTOMER:</Text>
            <Text style={styles.customerValue}>{quotation.customer.companyName}</Text>
            <Text style={styles.customerValue}>PIN: {quotation.customer.pinNumber || "—"}</Text>
          </View>
          <View style={styles.dateBlock}>
            <Text style={styles.dateRow}>Date: {format(new Date(quotation.createdAt), "dd MMM yyyy")}</Text>
            <Text style={styles.dateRow}>Quotation No.: {quotation.quotationNumber}</Text>
          </View>
        </View>

        {/* Items table */}
        <View style={styles.table}>
          <View style={styles.tableHeader}>
            <Text style={[styles.th, styles.cellNo]}>No.</Text>
            <Text style={[styles.th, styles.cellItemNo]}>Item No</Text>
            <Text style={[styles.th, styles.cellDesc]}>Description</Text>
            <Text style={[styles.th, styles.cellUnit]}>Unit</Text>
            <Text style={[styles.th, styles.cellQty]}>Qty</Text>
            <Text style={[styles.th, styles.cellPrice]}>Unit Price (KES)</Text>
            <Text style={[styles.th, styles.cellAmount]}>Amount (KES)</Text>
            <Text style={[styles.th, styles.cellSample]}>Sample</Text>
          </View>
          {rows.map((item, index) => {
            const itemImage = item ? resolvePublicFile(item.part?.imageUrl) : undefined
            return (
              <View key={item?.id ?? `blank-${index}`} style={styles.tableRow}>
                <Text style={styles.cellNo}>{index + 1}</Text>
                <Text style={styles.cellItemNo}>{item?.part?.partNumber ?? ""}</Text>
                <Text style={styles.cellDesc}>
                  {item
                    ? item.part
                      ? (item.part.brand ? `${item.part.brand} — ${item.part.name}` : item.part.name)
                      : item.description
                    : ""}
                </Text>
                <Text style={styles.cellUnit}>{item?.part?.unit ?? ""}</Text>
                <Text style={styles.cellQty}>{item ? item.quantity : ""}</Text>
                <Text style={styles.cellPrice}>{item ? formatAmount(Number(item.unitPrice)) : ""}</Text>
                <Text style={styles.cellAmount}>{item ? formatAmount(Number(item.subtotal)) : ""}</Text>
                <View style={styles.cellSample}>
                  {itemImage && <Image src={itemImage} style={styles.itemImage} />}
                </View>
              </View>
            )
          })}
        </View>

        {/* Note + Totals */}
        <View style={styles.bottomRow}>
          <View style={styles.noteBlock}>
            <Text style={styles.noteTitle}>NOTE:</Text>
            <Text style={styles.noteItem}>1. QUOTATION VALIDITY SHALL BE WITHIN 15 DAYS</Text>
          </View>
          <View style={styles.totals}>
            <View style={styles.totalRow}>
              <Text>Subtotal (KES)</Text>
              <Text>{formatAmount(subtotal)}</Text>
            </View>
            <View style={styles.totalRow}>
              <Text>VAT {vatPercent > 0 ? `(${vatPercent}%)` : ""}</Text>
              <Text>{formatAmount(vatAmount)}</Text>
            </View>
            <View style={styles.totalRowFinal}>
              <Text>Total (KES)</Text>
              <Text>{formatAmount(totalCost)}</Text>
            </View>
          </View>
        </View>

        {/* Remarks (only shown when filled in) */}
        {quotation.remarks && (
          <View style={styles.remarksBlock}>
            <Text style={styles.remarksTitle}>Remarks</Text>
            <Text style={styles.remarksText}>{quotation.remarks}</Text>
          </View>
        )}

        <Text style={styles.footer} fixed>
          {quotation.company.name} — Quotation {quotation.quotationNumber} — Generated on {generatedOn}
        </Text>
      </Page>
    </Document>
  )
}
