function escapeCsvCell(value: unknown): string {
  const str = value === null || value === undefined ? "" : String(value)
  if (/[",\n]/.test(str)) {
    return `"${str.replace(/"/g, '""')}"`
  }
  return str
}

/** Builds a CSV string from a header row and an array of row arrays. */
export function toCsv(header: string[], rows: (string | number)[][]): string {
  const lines = [header, ...rows].map((row) => row.map(escapeCsvCell).join(","))
  return lines.join("\r\n")
}

/** Returns a Response with the appropriate CSV headers for file download. */
export function csvResponse(csv: string, filename: string): Response {
  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  })
}
