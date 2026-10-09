import { jsPDF } from 'jspdf'

/**
 * Sentinel Incident PDF Engine
 * Generates forensic PDF reports for threat analysis with IoCs, redirect chains, and timestamps
 */

/**
 * Generates a professional forensic PDF report for a scan result
 *
 * @param {object} scanData - The complete scan result object
 * @returns {Buffer} PDF as buffer
 */
export async function generateIncidentPDF(scanData) {
  const doc = new jsPDF()
  const analysis = scanData.analysis || scanData || {}
  const telemetry = scanData.telemetry || {}
  const pageWidth = doc.internal.pageSize.getWidth()
  const pageHeight = doc.internal.pageSize.getHeight()
  const margin = 20
  let yPosition = margin

  // Helper function for safe text wrapping
  const addWrappedText = (text, x, y, maxWidth, fontSize = 10, fontStyle = 'normal') => {
    doc.setFontSize(fontSize)
    doc.setFont('helvetica', fontStyle)
    const lines = doc.splitTextToSize(String(text || ''), maxWidth)
    doc.text(lines, x, y)
    return y + (lines.length * (fontSize * 0.5))
  }

  // ============================================
  // HEADER SECTION
  // ============================================
  // Branding
  doc.setFillColor(99, 102, 241)
  doc.rect(0, 0, pageWidth, 40, 'F')
  doc.setTextColor(255, 255, 255)
  doc.setFontSize(22)
  doc.setFont('helvetica', 'bold')
  doc.text('SENTINEL / SHIELD AI', margin, 20)
  doc.setFontSize(10)
  doc.setFont('helvetica', 'normal')
  doc.text('Forensic Threat Intelligence & Incident Analysis Report', margin, 28)

  // Risk Score Badge
  const riskScore = Number(analysis.risk_score ?? scanData.risk_score) || 0
  let riskColor = [16, 185, 129] // green
  let riskLabel = 'LOW RISK'
  if (riskScore >= 70) {
    riskColor = [244, 63, 94] // red
    riskLabel = 'CRITICAL'
  } else if (riskScore >= 35) {
    riskColor = [245, 158, 11] // amber
    riskLabel = 'ELEVATED'
  }

  doc.setFillColor(...riskColor)
  doc.roundedRect(pageWidth - 70, 15, 55, 20, 3, 3, 'F')
  doc.setTextColor(255, 255, 255)
  doc.setFontSize(14)
  doc.setFont('helvetica', 'bold')
  doc.text(riskScore.toString(), pageWidth - 55, 27)
  doc.setFontSize(8)
  doc.setFont('helvetica', 'normal')
  doc.text(riskLabel, pageWidth - 55, 33)

  // Reset text color
  doc.setTextColor(0, 0, 0)
  yPosition = 55

  // ============================================
  // INCIDENT METADATA
  // ============================================
  doc.setFontSize(12)
  doc.setFont('helvetica', 'bold')
  doc.text('INCIDENT REPORT METADATA', margin, yPosition)
  yPosition += 10

  doc.setFontSize(9)
  doc.setFont('helvetica', 'normal')
  const metadata = [
    ['Report ID:', scanData.id || 'N/A'],
    ['Generated:', new Date().toISOString()],
    ['Verdict / Threat:', analysis.threat_type || analysis.verdict || scanData.verdict || 'Unknown'],
    ['Input Vector:', telemetry.input_vector || scanData.input_type || 'text'],
    ['Execution Time:', telemetry.execution_time_ms ? `${(telemetry.execution_time_ms / 1000).toFixed(2)}s` : 'N/A'],
  ]

  metadata.forEach(([label, value]) => {
    doc.setFont('helvetica', 'bold')
    doc.text(label, margin, yPosition)
    doc.setFont('helvetica', 'normal')
    doc.text(value, margin + 35, yPosition)
    yPosition += 6
  })

  yPosition += 5

  // ============================================
  // EXECUTIVE SUMMARY
  // ============================================
  doc.setDrawColor(99, 102, 241)
  doc.setLineWidth(0.5)
  doc.line(margin, yPosition, pageWidth - margin, yPosition)
  yPosition += 10

  doc.setFontSize(12)
  doc.setFont('helvetica', 'bold')
  doc.text('EXECUTIVE SUMMARY', margin, yPosition)
  yPosition += 8

  yPosition = addWrappedText(
    analysis.summary || scanData.summary || 'No summary available.',
    margin,
    yPosition,
    pageWidth - (margin * 2),
    10,
    'normal',
  )

  yPosition += 8

  // ============================================
  // BRAND IMPERSONATION
  // ============================================
  const brand = analysis.impersonated_brand || scanData.impersonated_brand
  if (brand) {
    doc.setFontSize(12)
    doc.setFont('helvetica', 'bold')
    doc.text('IMPERSONATED BRAND TARGET', margin, yPosition)
    yPosition += 6

    doc.setFontSize(10)
    doc.setFont('helvetica', 'normal')
    doc.text(brand, margin, yPosition)
    yPosition += 10
  }

  // ============================================
  // RED FLAGS / DETECTED INDICATORS
  // ============================================
  const redFlags = Array.isArray(analysis.red_flags)
    ? analysis.red_flags
    : Array.isArray(scanData.flags)
      ? scanData.flags.map((f) => `[${f.type}] ${f.text_snippet}: ${f.explanation}`)
      : []

  if (redFlags.length > 0) {
    doc.setFontSize(12)
    doc.setFont('helvetica', 'bold')
    doc.text('INDICATORS OF COMPROMISE (IoCs)', margin, yPosition)
    yPosition += 8

    doc.setFontSize(9)
    doc.setFont('helvetica', 'normal')
    redFlags.forEach((flag, idx) => {
      if (yPosition > pageHeight - 35) {
        doc.addPage()
        yPosition = margin
      }
      yPosition = addWrappedText(
        `${idx + 1}. ${flag}`,
        margin + 5,
        yPosition,
        pageWidth - (margin * 2) - 5,
        9,
      )
      yPosition += 2
    })
    yPosition += 5
  }

  // ============================================
  // ANALYZED CONTENT
  // ============================================
  const analyzedContent = scanData.analyzed_text || scanData.content || scanData.input
  if (analyzedContent) {
    if (yPosition > pageHeight - 80) {
      doc.addPage()
      yPosition = margin
    }

    doc.setDrawColor(99, 102, 241)
    doc.line(margin, yPosition, pageWidth - margin, yPosition)
    yPosition += 10

    doc.setFontSize(12)
    doc.setFont('helvetica', 'bold')
    doc.text('ANALYZED CONTENT SNIPPET', margin, yPosition)
    yPosition += 8

    const maxContentLength = 1500
    const content = analyzedContent.slice(0, maxContentLength) +
      (analyzedContent.length > maxContentLength ? '... [truncated]' : '')

    yPosition = addWrappedText(
      content,
      margin,
      yPosition,
      pageWidth - (margin * 2),
      8,
      'normal',
    )
    yPosition += 5
  }

  // ============================================
  // URL TELEMETRY & REDIRECT CHAINS
  // ============================================
  const urlReports = telemetry.urls_inspected || scanData.urls_inspected || []
  if (urlReports.length > 0) {
    if (yPosition > pageHeight - 100) {
      doc.addPage()
      yPosition = margin
    }

    doc.setDrawColor(99, 102, 241)
    doc.line(margin, yPosition, pageWidth - margin, yPosition)
    yPosition += 10

    doc.setFontSize(12)
    doc.setFont('helvetica', 'bold')
    doc.text('URL TELEMETRY & SECURITY SIGNALS', margin, yPosition)
    yPosition += 8

    urlReports.forEach((report, idx) => {
      if (yPosition > pageHeight - 60) {
        doc.addPage()
        yPosition = margin
      }

      doc.setFontSize(10)
      doc.setFont('helvetica', 'bold')
      doc.text(`URL #${idx + 1}`, margin, yPosition)
      yPosition += 6

      doc.setFontSize(8)
      doc.setFont('helvetica', 'normal')
      const original = report.original || report.scanned_url || 'N/A'
      const finalUrl = report.final || report.final_url || original
      doc.text(`Original: ${original}`, margin + 5, yPosition)
      yPosition += 5
      doc.text(`Final: ${finalUrl}`, margin + 5, yPosition)
      yPosition += 5
      doc.text(`Redirect Hops: ${report.hops || (report.chain?.length ?? 1)}`, margin + 5, yPosition)
      yPosition += 5

      // VirusTotal stats
      const vt = report.virustotal || {}
      const maliciousCount = vt.malicious ?? vt.malicious_votes ?? 0
      const totalCount = vt.total_engines ?? 70
      doc.text(`VirusTotal: ${maliciousCount}/${totalCount} malicious engines`, margin + 5, yPosition)
      yPosition += 5

      // Safe Browsing
      const sb = report.safe_browsing || {}
      const sbMatches = report.safe_browsing_matches || (sb.matched ? [{ threatType: 'MALICIOUS' }] : [])
      if (sbMatches.length > 0) {
        doc.setTextColor(244, 63, 94)
        doc.text(`Safe Browsing: DETECTED (${sbMatches.length} threat matches)`, margin + 5, yPosition)
        doc.setTextColor(0, 0, 0)
      } else {
        doc.text('Safe Browsing: Clean', margin + 5, yPosition)
      }
      yPosition += 8

      // Redirect chain
      if (report.chain && report.chain.length > 0) {
        doc.setFontSize(8)
        doc.setFont('helvetica', 'bold')
        doc.text('Redirect Trace Chain:', margin + 5, yPosition)
        yPosition += 5

        doc.setFont('helvetica', 'normal')
        report.chain.forEach((hop, hopIdx) => {
          if (yPosition > pageHeight - 30) {
            doc.addPage()
            yPosition = margin
          }
          doc.text(`  ${hopIdx + 1}. [HTTP ${hop.status || 302}] ${hop.url}`, margin + 10, yPosition)
          yPosition += 4
        })
        yPosition += 5
      }
    })
  }

  // ============================================
  // RECOMMENDED MITIGATION ACTIONS
  // ============================================
  const recAction = analysis.recommended_action || scanData.recommended_action
  if (recAction) {
    if (yPosition > pageHeight - 50) {
      doc.addPage()
      yPosition = margin
    }

    doc.setDrawColor(99, 102, 241)
    doc.line(margin, yPosition, pageWidth - margin, yPosition)
    yPosition += 10

    doc.setFontSize(12)
    doc.setFont('helvetica', 'bold')
    doc.text('RECOMMENDED MITIGATION', margin, yPosition)
    yPosition += 8

    const actionText = typeof recAction === 'string' ? recAction : recAction.type || 'Exercise caution.'
    yPosition = addWrappedText(actionText, margin, yPosition, pageWidth - (margin * 2), 10, 'normal')
    yPosition += 6

    if (typeof recAction === 'object' && recAction.draft_report) {
      yPosition = addWrappedText(`Action Plan: ${recAction.draft_report}`, margin, yPosition, pageWidth - (margin * 2), 9, 'normal')
    }
  }

  // ============================================
  // FOOTER
  // ============================================
  const totalPages = doc.internal.getNumberOfPages()
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i)
    doc.setFontSize(8)
    doc.setFont('helvetica', 'normal')
    doc.setTextColor(128, 128, 128)
    doc.text(
      `Sentinel / Shield AI - Generated ${new Date().toISOString()} - Page ${i} of ${totalPages}`,
      margin,
      pageHeight - 10,
    )
    doc.text(
      'Confidential Security Incident Report',
      pageWidth - margin - 60,
      pageHeight - 10,
    )
  }

  return Buffer.from(doc.output('arraybuffer'))
}
