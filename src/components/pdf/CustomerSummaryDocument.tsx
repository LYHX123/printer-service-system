import { Document, Page, View, Text, Image, StyleSheet } from "@react-pdf/renderer"
import { existsSync, readFileSync } from "fs"
import path from "path"
import type { CustomerListItem } from "@/lib/data/customers"
import type { CompanySettings } from "@/lib/data/settings"

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
    fontSize: 8,
    textTransform: "uppercase",
  },
  cellCompanyName: { width: "30%" },
  cellPinNumber: { width: "16%" },
  cellContactName: { width: "20%" },
  cellPhone: { width: "16%" },
  cellLocation: { width: "18%" },
  emptyText: {
    color: "#94a3b8",
    fontStyle: "italic",
    marginTop: 8,
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

interface CustomerSummaryDocumentProps {
  customers: CustomerListItem[]
  company: CompanySettings
}

export function CustomerSummaryDocument({ customers, company }: CustomerSummaryDocumentProps) {
  const logo = resolvePublicFile(company.logoUrl)
  const generatedOn = formatDateInTimezone(new Date(), company.timezone)

  return (
    <Document>
      <Page size="A4" style={styles.page}>
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
            <Text style={styles.reportTitle}>Customer Summary Report</Text>
            <Text>Total Active Customers: {customers.length}</Text>
            <Text>Generated on: {generatedOn}</Text>
          </View>
        </View>

        {/* Customer table */}
        {customers.length > 0 ? (
          <View style={styles.table}>
            <View style={styles.tableHeader} fixed>
              <Text style={[styles.th, styles.cellCompanyName]}>Company Name</Text>
              <Text style={[styles.th, styles.cellPinNumber]}>PIN No</Text>
              <Text style={[styles.th, styles.cellContactName]}>Contact Name</Text>
              <Text style={[styles.th, styles.cellPhone]}>Phone Number</Text>
              <Text style={[styles.th, styles.cellLocation]}>Location</Text>
            </View>
            {customers.map((customer) => (
              <View key={customer.id} style={styles.tableRow} wrap={false}>
                <Text style={styles.cellCompanyName}>{customer.companyName}</Text>
                <Text style={styles.cellPinNumber}>{customer.pinNumber ?? "—"}</Text>
                <Text style={styles.cellContactName}>{customer.name ?? "—"}</Text>
                <Text style={styles.cellPhone}>{customer.phone}</Text>
                <Text style={styles.cellLocation}>{customer.location ?? "—"}</Text>
              </View>
            ))}
          </View>
        ) : (
          <Text style={styles.emptyText}>No active customers to report.</Text>
        )}

        <Text style={styles.footer} fixed>
          {company.name} — Customer Summary Report — Generated on {generatedOn}
        </Text>
      </Page>
    </Document>
  )
}
