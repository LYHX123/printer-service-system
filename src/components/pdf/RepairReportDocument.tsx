import { Document, Page, View, Text, Image, StyleSheet } from "@react-pdf/renderer"
import { existsSync, readFileSync } from "fs"
import path from "path"
import { format } from "date-fns"
import { formatCurrency } from "@/lib/utils"
import { EQUIPMENT_TYPE_LABELS, SERVICE_TYPE_LABELS } from "@/types"
import type { ReportData } from "@/lib/data/reports"

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
    width: 180,
    justifyContent: "space-between",
    marginBottom: 2,
  },
  totalRowFinal: {
    flexDirection: "row",
    width: 180,
    justifyContent: "space-between",
    borderTop: "1px solid #1e293b",
    paddingTop: 3,
    marginTop: 2,
    fontWeight: 700,
  },
  photoGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
  },
  photoBlock: {
    width: 100,
  },
  photo: {
    width: 100,
    height: 100,
    objectFit: "cover",
    borderWidth: 1,
    borderStyle: "solid",
    borderColor: "#cbd5e1",
    borderRadius: 4,
  },
  photoPlaceholder: {
    width: 100,
    height: 100,
    borderWidth: 1,
    borderStyle: "solid",
    borderColor: "#fca5a5",
    borderRadius: 4,
    backgroundColor: "#fef2f2",
  },
  photoCaption: {
    fontSize: 6,
    color: "#64748b",
    marginTop: 2,
    textAlign: "center",
  },
  photoCaptionError: {
    fontSize: 6,
    color: "#dc2626",
    marginTop: 2,
    textAlign: "center",
  },
  signatureBox: {
    border: "1px dashed #cbd5e1",
    borderRadius: 4,
    height: 60,
    padding: 4,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 4,
  },
  signatureImage: {
    maxHeight: 50,
    maxWidth: 150,
    objectFit: "contain",
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

function getFileName(url: string): string {
  return url.split("/").pop() ?? url
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

function resolvePublicFile(url: string | null | undefined): string | undefined {
  if (!url) {
    console.log("[pdf-image] no url provided")
    return undefined
  }
  const filePath = path.join(process.cwd(), "public", url.replace(/^\//, ""))
  if (!existsSync(filePath)) {
    console.log(`[pdf-image] file does not exist: ${filePath}`)
    return undefined
  }

  const mimeType = IMAGE_MIME_TYPES[path.extname(filePath).toLowerCase()]
  if (!mimeType) {
    console.log(`[pdf-image] unsupported extension: ${filePath}`)
    return undefined
  }

  const data = readFileSync(filePath).toString("base64")
  const dataUri = `data:${mimeType};base64,${data}`
  console.log(`[pdf-image] resolved ${filePath} -> base64 length ${data.length}`)
  return dataUri
}

export function RepairReportDocument({ job }: { job: ReportData }) {
  const beforePhotos = job.photos
    .filter((p) => p.photoType === "BEFORE")
    .map((p) => ({ fileName: getFileName(p.fileUrl), src: resolvePublicFile(p.fileUrl) }))
  const afterPhotos = job.photos
    .filter((p) => p.photoType === "AFTER")
    .map((p) => ({ fileName: getFileName(p.fileUrl), src: resolvePublicFile(p.fileUrl) }))

  const customerSignature = job.signatureUrl
    ? { fileName: getFileName(job.signatureUrl), src: resolvePublicFile(job.signatureUrl) }
    : null
  const engineerSignature = job.assignedTo.signatureUrl
    ? { fileName: getFileName(job.assignedTo.signatureUrl), src: resolvePublicFile(job.assignedTo.signatureUrl) }
    : null
  const logo = resolvePublicFile(job.company.logoUrl)

  const showMeter = job.equipment.type === "PRINTER" || job.equipment.type === "COPIER"
  const currency = job.company.currency
  const vatPercent = Number(job.company.vatPercent)
  const subtotal = Number(job.labourCost) + Number(job.partsCost)
  const vatAmount = (subtotal * vatPercent) / 100
  const generatedOn = formatDateInTimezone(new Date(), job.company.timezone)

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.companyBlock}>
            {logo && <Image src={logo} style={styles.logo} />}
            <View>
              <Text style={styles.companyName}>{job.company.name}</Text>
              {job.company.address && <Text style={styles.companyMeta}>{job.company.address}</Text>}
              <Text style={styles.companyMeta}>
                {[job.company.phone, job.company.email, job.company.website].filter(Boolean).join("  •  ")}
              </Text>
              {job.company.kraPin && <Text style={styles.companyMeta}>KRA PIN: {job.company.kraPin}</Text>}
            </View>
          </View>
          <View style={styles.reportMeta}>
            <Text style={styles.reportTitle}>Repair Report</Text>
            <Text>Job Number: {job.jobNumber}</Text>
            <Text>Generated on: {generatedOn}</Text>
          </View>
        </View>

        {/* Customer & Equipment */}
        <View style={styles.twoCol}>
          <View style={[styles.col, styles.section]}>
            <Text style={styles.sectionTitle}>Customer Information</Text>
            <View style={styles.row}><Text style={styles.label}>Company</Text><Text style={styles.value}>{job.customer.companyName}</Text></View>
            {job.customer.name && (
              <View style={styles.row}><Text style={styles.label}>Contact</Text><Text style={styles.value}>{job.customer.name}</Text></View>
            )}
            {job.customer.phone && (
              <View style={styles.row}><Text style={styles.label}>Phone</Text><Text style={styles.value}>{job.customer.phone}</Text></View>
            )}
            {job.customer.location && (
              <View style={styles.row}><Text style={styles.label}>Location</Text><Text style={styles.value}>{job.customer.location}</Text></View>
            )}
            {job.branch && (
              <View style={styles.row}><Text style={styles.label}>Branch / Site</Text><Text style={styles.value}>{job.branch.name}</Text></View>
            )}
          </View>

          <View style={[styles.col, styles.section]}>
            <Text style={styles.sectionTitle}>Equipment Information</Text>
            <View style={styles.row}><Text style={styles.label}>Type</Text><Text style={styles.value}>{EQUIPMENT_TYPE_LABELS[job.equipment.type]}</Text></View>
            <View style={styles.row}><Text style={styles.label}>Brand / Model</Text><Text style={styles.value}>{job.equipment.brand} {job.equipment.model}</Text></View>
            <View style={styles.row}><Text style={styles.label}>Serial Number</Text><Text style={styles.value}>{job.equipment.serialNumber}</Text></View>
            <View style={styles.row}><Text style={styles.label}>Asset Number</Text><Text style={styles.value}>{job.equipment.assetNumber ?? "—"}</Text></View>
            <View style={styles.row}><Text style={styles.label}>Service Type</Text><Text style={styles.value}>{SERVICE_TYPE_LABELS[job.serviceType]}</Text></View>
          </View>
        </View>

        {/* Problem reported */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Problem Reported</Text>
          <Text style={styles.paragraph}>{job.problemDesc}</Text>
        </View>

        {/* Diagnosis & Work Done */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Diagnosis</Text>
          <Text style={styles.paragraph}>{job.report?.diagnosis || "—"}</Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Work Performed</Text>
          <Text style={styles.paragraph}>{job.report?.workDone || "—"}</Text>
        </View>

        {job.report?.recommendations && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Recommendations</Text>
            <Text style={styles.paragraph}>{job.report.recommendations}</Text>
          </View>
        )}

        {/* Spare parts replaced */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Spare Parts Replaced</Text>
          {job.report && job.report.parts.length > 0 ? (
            <View style={styles.table}>
              <View style={styles.tableHeader}>
                <Text style={[styles.th, styles.cellPart]}>Part</Text>
                <Text style={[styles.th, styles.cellQty]}>Qty</Text>
                <Text style={[styles.th, styles.cellPrice]}>Unit Price</Text>
                <Text style={[styles.th, styles.cellSubtotal]}>Subtotal</Text>
              </View>
              {job.report.parts.map((p) => (
                <View key={p.id} style={styles.tableRow}>
                  <Text style={styles.cellPart}>{p.partName}</Text>
                  <Text style={styles.cellQty}>{p.quantity}</Text>
                  <Text style={styles.cellPrice}>{formatCurrency(Number(p.unitPrice), currency)}</Text>
                  <Text style={styles.cellSubtotal}>{formatCurrency(Number(p.subtotal), currency)}</Text>
                </View>
              ))}
            </View>
          ) : (
            <Text style={styles.emptyText}>No spare parts replaced.</Text>
          )}

          <View style={styles.totals}>
            <View style={styles.totalRow}>
              <Text>Labour</Text>
              <Text>{formatCurrency(Number(job.labourCost), currency)}</Text>
            </View>
            <View style={styles.totalRow}>
              <Text>Parts</Text>
              <Text>{formatCurrency(Number(job.partsCost), currency)}</Text>
            </View>
            {vatPercent > 0 && (
              <View style={styles.totalRow}>
                <Text>VAT ({vatPercent}%)</Text>
                <Text>{formatCurrency(vatAmount, currency)}</Text>
              </View>
            )}
            <View style={styles.totalRowFinal}>
              <Text>Total</Text>
              <Text>{formatCurrency(Number(job.totalCost), currency)}</Text>
            </View>
          </View>
        </View>

        {/* Meter readings */}
        {showMeter && job.meterReadings.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Meter Readings</Text>
            <View style={styles.table}>
              <View style={styles.tableHeader}>
                <Text style={[styles.th, { width: "34%" }]}>Date</Text>
                <Text style={[styles.th, { width: "33%", textAlign: "right" }]}>Black</Text>
                <Text style={[styles.th, { width: "33%", textAlign: "right" }]}>Colour</Text>
              </View>
              {job.meterReadings.map((r) => (
                <View key={r.id} style={styles.tableRow}>
                  <Text style={{ width: "34%" }}>{format(new Date(r.readingDate), "dd MMM yyyy")}</Text>
                  <Text style={{ width: "33%", textAlign: "right" }}>{r.blackPages?.toLocaleString() ?? "—"}</Text>
                  <Text style={{ width: "33%", textAlign: "right" }}>{r.colorPages?.toLocaleString() ?? "—"}</Text>
                </View>
              ))}
            </View>
          </View>
        )}

        {/* Technician notes */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Technician Notes</Text>
          <Text style={job.technicianNotes ? styles.paragraph : styles.emptyText}>
            {job.technicianNotes || "No technician notes recorded."}
          </Text>
        </View>

        {/* Warranty information */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Warranty Information</Text>
          {job.completedAt ? (
            <>
              <View style={styles.row}><Text style={styles.label}>Warranty Period</Text><Text style={styles.value}>{job.warrantyPeriod ? `${job.warrantyPeriod} days` : "—"}</Text></View>
              <View style={styles.row}><Text style={styles.label}>Warranty Expires</Text><Text style={styles.value}>{job.warrantyExpires ? format(new Date(job.warrantyExpires), "dd MMM yyyy") : "—"}</Text></View>
              <View style={styles.row}><Text style={styles.label}>Status</Text><Text style={styles.value}>{job.warrantyExpires && new Date(job.warrantyExpires).getTime() > Date.now() ? "Active" : "Expired"}</Text></View>
            </>
          ) : (
            <Text style={styles.emptyText}>Warranty will be set when the job is marked Delivered.</Text>
          )}
        </View>

        {/* Before / After photos */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Before Photos</Text>
          {beforePhotos.length > 0 ? (
            <View style={styles.photoGrid}>
              {beforePhotos.map((p) => (
                <View key={p.fileName} style={styles.photoBlock}>
                  {p.src ? (
                    <>
                      <Image src={p.src} style={styles.photo} />
                      <Text style={styles.photoCaption}>Photo loaded: {p.fileName}</Text>
                    </>
                  ) : (
                    <>
                      <View style={styles.photoPlaceholder} />
                      <Text style={styles.photoCaptionError}>Image failed to render: {p.fileName}</Text>
                    </>
                  )}
                </View>
              ))}
            </View>
          ) : (
            <Text style={styles.emptyText}>No before photos uploaded.</Text>
          )}
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>After Photos</Text>
          {afterPhotos.length > 0 ? (
            <View style={styles.photoGrid}>
              {afterPhotos.map((p) => (
                <View key={p.fileName} style={styles.photoBlock}>
                  {p.src ? (
                    <>
                      <Image src={p.src} style={styles.photo} />
                      <Text style={styles.photoCaption}>Photo loaded: {p.fileName}</Text>
                    </>
                  ) : (
                    <>
                      <View style={styles.photoPlaceholder} />
                      <Text style={styles.photoCaptionError}>Image failed to render: {p.fileName}</Text>
                    </>
                  )}
                </View>
              ))}
            </View>
          ) : (
            <Text style={styles.emptyText}>No after photos uploaded.</Text>
          )}
        </View>

        {/* Signatures */}
        <View style={styles.twoCol}>
          <View style={[styles.col, styles.section]}>
            <Text style={styles.sectionTitle}>Customer Signature</Text>
            <View style={styles.signatureBox}>
              {customerSignature ? (
                customerSignature.src ? (
                  <Image src={customerSignature.src} style={styles.signatureImage} />
                ) : (
                  <Text style={styles.photoCaptionError}>Image failed to render: {customerSignature.fileName}</Text>
                )
              ) : (
                <Text style={styles.emptyText}>Not captured</Text>
              )}
            </View>
            {customerSignature?.src && (
              <Text style={styles.photoCaption}>Photo loaded: {customerSignature.fileName}</Text>
            )}
            {job.signedAt && <Text style={styles.companyMeta}>Signed on {format(new Date(job.signedAt), "dd MMM yyyy, HH:mm")}</Text>}
          </View>

          <View style={[styles.col, styles.section]}>
            <Text style={styles.sectionTitle}>Engineer Sign-Off</Text>
            <View style={styles.signatureBox}>
              {engineerSignature ? (
                engineerSignature.src ? (
                  <Image src={engineerSignature.src} style={styles.signatureImage} />
                ) : (
                  <Text style={styles.photoCaptionError}>Image failed to render: {engineerSignature.fileName}</Text>
                )
              ) : (
                <Text style={styles.emptyText}>Not captured</Text>
              )}
            </View>
            {engineerSignature?.src && (
              <Text style={styles.photoCaption}>Photo loaded: {engineerSignature.fileName}</Text>
            )}
            <Text style={{ fontWeight: 700 }}>{job.assignedTo.name}</Text>
            {job.completedAt && <Text style={styles.companyMeta}>Completed on {format(new Date(job.completedAt), "dd MMM yyyy")}</Text>}
          </View>
        </View>

        <Text style={styles.footer} fixed>
          {job.company.name} — Repair Report for {job.jobNumber} — Generated on {generatedOn}
        </Text>
      </Page>
    </Document>
  )
}
