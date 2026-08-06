/**
 * NovelusPdfReport.tsx
 * Reproduction exacte à 100% du Rapport Officiel de Gestion des Congés NOVELUS
 * basé sur le document de référence : NOVELUS — HR Leave Portal.pdf
 */

import { useState } from 'react';
import { FileText, Loader2 } from 'lucide-react';
import type { ReportRequestRow, ReportBalanceRow, ReportOverlaps } from '../../services/reportsApi';

export interface PdfReportFilters {
  dateFrom?: string;
  dateTo?: string;
  department?: string;
  country?: string;
  leaveTypeName?: string;
  status?: string;
}

interface PdfReportProps {
  managerName: string;
  requests: ReportRequestRow[];
  balances: ReportBalanceRow[];
  overlaps: ReportOverlaps | null;
  filters: PdfReportFilters;
}

function fmtShort(dateStr: string): string {
  if (!dateStr) return '—';
  try {
    return new Date(dateStr).toISOString().split('T')[0];
  } catch { return dateStr; }
}

function pct(part: number, total: number): string {
  if (!total) return '0%';
  return `${Math.round((part / total) * 100)}%`;
}

function avg(values: number[]): string {
  if (!values.length) return '0.0';
  return (values.reduce((a, b) => a + b, 0) / values.length).toFixed(1);
}

function buildReportHtml(props: PdfReportProps): string {
  const { managerName, requests, balances, overlaps, filters } = props;

  const now = new Date();
  const generatedAtDate = now.toLocaleDateString('en-GB', { day: '2-digit', month: 'long', year: 'numeric' });
  const generatedAtTime = now.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
  const generatedAt = `${generatedAtDate} at ${generatedAtTime}`;

  // ── Global calculations ──────────────────────────────────────────────────
  const total = requests.length;
  const approved = requests.filter(r => r.status === 'APPROVED');
  const pending = requests.filter(r => r.status === 'PENDING');
  const rejected = requests.filter(r => r.status === 'REJECTED');
  const cancelled = requests.filter(r => r.status === 'CANCELLED');

  const totalApprovedDays = approved.reduce((s, r) => s + (r.durationDays || 0), 0);
  const pendingDays = pending.reduce((s, r) => s + (r.durationDays || 0), 0);
  const approvalPct = pct(approved.length, total);
  const rejectionPct = pct(rejected.length, total);
  const cancellationPct = pct(cancelled.length, total);
  const pendingPct = pct(pending.length, total);

  // Unique employees
  const uniqueEmployeeIds = new Set(requests.map(r => r.employeeId || r.employeeName));
  const totalEmployees = balances.length > 0 ? balances.length : uniqueEmployeeIds.size;

  // Negative balances
  const negativeBalances = balances.filter(b =>
    (b.totalAvailable ?? 0) < 0 || Object.values(b.balances || {}).some((v: any) => (v.available ?? 0) < 0)
  );

  // Leave Type breakdown
  const byType = new Map<string, { total: number; approved: number; days: number; employees: Set<string> }>();
  requests.forEach(r => {
    const t = r.leaveTypeName || 'Annual Leave';
    if (!byType.has(t)) byType.set(t, { total: 0, approved: 0, days: 0, employees: new Set() });
    const entry = byType.get(t)!;
    entry.total++;
    if (r.status === 'APPROVED') {
      entry.approved++;
      entry.days += r.durationDays || 0;
    }
    if (r.employeeName) entry.employees.add(r.employeeName);
  });
  const typeRows = Array.from(byType.entries()).sort((a, b) => b[1].days - a[1].days);
  const topLeaveType = typeRows.length > 0 ? typeRows[0] : null;

  // Monthly breakdown
  const monthNames = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
  const byMonthMap = new Map<string, { monthName: string; year: number; total: number; approvedDays: number; pendingCount: number }>();

  requests.forEach(r => {
    if (!r.startDate) return;
    const d = new Date(r.startDate);
    if (isNaN(d.getTime())) return;
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    const monthName = `${monthNames[d.getMonth()]} ${d.getFullYear()}`;
    if (!byMonthMap.has(key)) {
      byMonthMap.set(key, { monthName, year: d.getFullYear(), total: 0, approvedDays: 0, pendingCount: 0 });
    }
    const m = byMonthMap.get(key)!;
    m.total++;
    if (r.status === 'APPROVED') m.approvedDays += r.durationDays || 0;
    if (r.status === 'PENDING') m.pendingCount++;
  });

  const monthEntries = Array.from(byMonthMap.entries())
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(e => e[1]);

  const peakMonth = monthEntries.length > 0
    ? monthEntries.reduce((max, cur) => cur.approvedDays > max.approvedDays ? cur : max, monthEntries[0])
    : null;

  // Filter labels
  const filterPeriod = filters.dateFrom
    ? `From ${fmtShort(filters.dateFrom)} to ${filters.dateTo ? fmtShort(filters.dateTo) : 'present'}`
    : 'Full year';
  const filterDept = filters.department || 'All departments';
  const filterCountry = filters.country || 'All countries';
  const filterTypeLabel = filters.leaveTypeName || 'All types';

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <title>NOVELUS — Official HR Leave Management Report</title>
  <style>
    @page {
      size: A4 portrait;
      margin: 15mm 15mm 15mm 15mm;
    }
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
      font-size: 10.5px;
      color: #1e293b;
      line-height: 1.5;
      background: #fff;
    }
    .page-break { page-break-before: always; break-before: page; }
    .avoid-break { page-break-inside: avoid; break-inside: avoid; }
    
    /* Header */
    .header {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      padding-bottom: 12px;
      border-bottom: 2px solid #1e293b;
      margin-bottom: 16px;
    }
    .brand-logo {
      font-size: 22px;
      font-weight: 900;
      letter-spacing: 2px;
      color: #0f172a;
    }
    .brand-dot { color: #10b981; }
    .brand-sub {
      font-size: 8.5px;
      font-weight: 700;
      color: #475569;
      letter-spacing: 0.5px;
      margin-top: 3px;
    }
    .header-right { text-align: right; }
    .header-title { font-size: 13px; font-weight: 800; color: #0f172a; text-transform: uppercase; letter-spacing: 0.5px; }
    .header-meta { font-size: 9.5px; color: #475569; margin-top: 3px; }
    .confidential-badge {
      display: inline-block;
      margin-top: 6px;
      padding: 3px 8px;
      border: 1px solid #cbd5e1;
      border-radius: 4px;
      font-size: 8px;
      font-weight: 800;
      color: #334155;
      letter-spacing: 0.5px;
    }

    /* Filter card */
    .filter-card {
      border: 1px solid #e2e8f0;
      border-radius: 8px;
      padding: 10px 14px;
      margin-bottom: 18px;
      background: #fff;
    }
    .filter-title { font-size: 10px; font-weight: 800; color: #0f172a; text-transform: uppercase; margin-bottom: 6px; }
    .filter-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 6px 20px; font-size: 9.5px; color: #334155; }

    /* Section titles */
    .section-title {
      font-size: 12.5px;
      font-weight: 800;
      color: #6366f1;
      text-transform: uppercase;
      margin: 20px 0 10px 0;
      padding-bottom: 4px;
      border-bottom: 1px solid #e2e8f0;
    }

    /* Executive summary box */
    .summary-box {
      border: 1px solid #e2e8f0;
      border-radius: 8px;
      padding: 14px;
      background: #fff;
      font-size: 10px;
      line-height: 1.6;
      color: #334155;
    }
    .orientation-note {
      margin-top: 10px;
      padding-top: 10px;
      border-top: 1px solid #f1f5f9;
      font-size: 9.5px;
      color: #475569;
      font-style: italic;
    }

    /* Methodology cards */
    .method-card {
      border: 1px solid #e2e8f0;
      border-radius: 8px;
      padding: 12px 14px;
      margin-bottom: 12px;
      background: #fff;
    }
    .method-card-title { font-size: 10.5px; font-weight: 800; color: #0f172a; margin-bottom: 6px; }
    .method-list { list-style: none; font-size: 9.5px; color: #334155; }
    .method-list li { margin-bottom: 4px; padding-left: 10px; position: relative; }
    .method-list li::before { content: "•"; position: absolute; left: 0; color: #6366f1; font-weight: bold; }

    /* Tables */
    table { width: 100%; border-collapse: collapse; margin: 10px 0; font-size: 9.5px; }
    th {
      font-size: 8.5px;
      font-weight: 800;
      color: #475569;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      border-bottom: 1px solid #cbd5e1;
      padding: 8px 6px;
      text-align: left;
    }
    td { padding: 7px 6px; border-bottom: 1px solid #f1f5f9; vertical-align: middle; }
    tr:last-child td { border-bottom: none; }

    /* Badges */
    .badge {
      display: inline-block;
      padding: 2px 6px;
      border-radius: 4px;
      font-size: 8.5px;
      font-weight: 800;
      text-transform: uppercase;
    }
    .badge-normal { color: #16a34a; }
    .badge-surveiller { color: #d97706; }
    .badge-critique { color: #dc2626; }
    .badge-conforme { color: #16a34a; font-weight: 800; }
    .badge-decouvert { color: #dc2626; font-weight: 800; }

    /* Status 4-cards grid */
    .status-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin: 12px 0; }
    .status-card {
      border-radius: 8px;
      padding: 16px;
      text-align: center;
      border: 1px solid;
    }
    .status-card.approved { background: #f0fdf4; border-color: #bbf7d0; color: #166534; }
    .status-card.pending  { background: #fffbeb; border-color: #fef08a; color: #92400e; }
    .status-card.rejected { background: #fef2f2; border-color: #fecaca; color: #991b1b; }
    .status-card.cancelled{ background: #f8fafc; border-color: #e2e8f0; color: #475569; }
    .status-val { font-size: 26px; font-weight: 900; line-height: 1; margin: 4px 0; }

    /* Overlap cards grid */
    .overlap-box {
      border: 1px solid #e2e8f0;
      border-radius: 8px;
      padding: 12px;
      margin-bottom: 12px;
    }
    .overlap-header { display: flex; justify-content: space-between; font-size: 10px; font-weight: 800; color: #92400e; margin-bottom: 8px; }
    .overlap-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; }
    .overlap-item {
      border: 1px solid #e2e8f0;
      border-radius: 6px;
      padding: 6px 10px;
      font-size: 9px;
      color: #334155;
    }
    .overlap-item-name { font-weight: 700; color: #0f172a; }

    /* Print control button */
    .print-btn {
      position: fixed; top: 15px; right: 15px; z-index: 9999;
      background: #6366f1; color: #fff; border: none; border-radius: 6px;
      padding: 8px 16px; font-size: 12px; font-weight: 700; cursor: pointer;
      box-shadow: 0 4px 12px rgba(0,0,0,0.15);
    }
    @media print { .no-print { display: none !important; } }
  </style>
</head>
<body>

<button class="print-btn no-print" onclick="window.print()">⬇ Print / Save as PDF</button>

<!-- ══════════════════════════════════════════════════════ -->
<!-- PAGE 1                                                 -->
<!-- ══════════════════════════════════════════════════════ -->
<div class="header">
  <div>
    <div class="brand-logo">N<span class="brand-dot">●</span>VELUS</div>
    <div class="brand-sub">HR INFORMATION & GESTION SYSTEM</div>
  </div>
  <div class="header-right">
    <div class="header-title">Official HR Leave Management Report</div>
    <div class="header-meta">Generated on: ${generatedAt}</div>
    <div class="header-meta">Issuer: ${managerName} (Human Resources Department)</div>
    <div class="confidential-badge">INTERNAL & CONFIDENTIAL DOCUMENT</div>
  </div>
</div>

<div class="filter-card">
  <div class="filter-title">📌 Report Scope & Applied Filters</div>
  <div class="filter-grid">
    <div>Report period: <strong>${filterPeriod}</strong></div>
    <div>Department: <strong>${filterDept}</strong></div>
    <div>Country / Entity: <strong>${filterCountry}</strong></div>
    <div>Leave type: <strong>${filterTypeLabel}</strong></div>
  </div>
</div>

<div class="section-title">1. Executive Summary &amp; Managerial Analysis</div>
<div class="summary-box">
  This report consolidates the leave management analysis for the NOVELUS organization covering
  <strong>${totalEmployees} employee(s)</strong> and a total of <strong>${total} request(s)</strong> recorded.
  Of all submissions, <strong>${approved.length} request(s)</strong> were officially approved (<strong>${approvalPct}</strong>),
  totalling <strong>${totalApprovedDays} day(s)</strong> of absence consumed. The rejection rate stands at <strong>${rejectionPct}</strong> (${rejected.length} request(s)) and <strong>${cancelled.length} request(s)</strong> were cancelled (${cancellationPct}).
  As of today, <strong>${pending.length} request(s)</strong> are still pending approval (<strong>${pendingPct}</strong> of total volume), representing a potential of <strong>${pendingDays} day(s)</strong> of leave not yet definitively scheduled.
  The predominant leave type is "<strong>${topLeaveType ? topLeaveType[0] : 'Annual Leave'}</strong>", representing <strong>${topLeaveType ? pct(topLeaveType[1].days, totalApprovedDays) : '0%'}</strong> of approved absence days (${topLeaveType ? topLeaveType[1].days : 0} days across ${topLeaveType ? topLeaveType[1].approved : 0} request(s)).
  ${peakMonth ? `The peak absence period identified is <strong>${peakMonth.monthName}</strong> with <strong>${peakMonth.approvedDays} day(s)</strong> granted. This concentration requires advance planning to maintain service continuity.` : ''}
  Priority attention points: ${negativeBalances.length > 0 ? `A negative leave balance is recorded for <strong>${negativeBalances.length} employee(s): ${negativeBalances.map(b => `${b.employeeName} (${b.totalAvailable}d)`).join(', ')}</strong>. An audit of adjustment entries and advance authorisations is strongly recommended.` : 'No negative balances to report.'}
  ${overlaps && overlaps.clusters.length > 0 ? `Additionally, <strong>${overlaps.clusters.length} overlap period(s)</strong> of simultaneous absences within the team have been identified, with a maximum peak of <strong>${overlaps.peakConcurrent} employee(s)</strong> absent on the same day.` : ''}

  <div class="orientation-note">
    💡 <strong>HR Guidance Note:</strong> "The recommendations in this summary aim to secure operational schedules, guarantee equitable treatment of leave entitlements, and ensure regulatory compliance of balances."
  </div>
</div>

<div class="section-title">2. Analysis Scope & Methodological Rules</div>
<div class="method-card">
  <div class="method-card-title">Calculation Rules & Statuses</div>
  <ul class="method-list">
    <li><strong>Effective consumption:</strong> Only requests validated in status <span style="color:#16a34a;font-weight:bold">APPROVED</span> are included in the consumed days volume.</li>
    <li><strong>Consumption exclusions:</strong> Rejected (<span style="color:#dc2626;font-weight:bold">REJECTED</span>) and cancelled (<span style="color:#64748b;font-weight:bold">CANCELLED</span>) requests are strictly excluded from the count of taken days.</li>
    <li><strong>Working days & Public Holidays:</strong> The calculated absence duration automatically deducts weekends and official public holidays for the country entity.</li>
  </ul>
</div>

<div class="method-card">
  <div class="method-card-title">Data Traceability & Quality</div>
  <ul class="method-list">
    <li><strong>Extraction source:</strong> Central PostgreSQL database via the NOVELUS HR portal NestJS API.</li>
    <li><strong>Scope completeness:</strong> Totals are calculated over all filtered records (not just the displayed page).</li>
    <li><strong>Balance formula:</strong> Available balance = Annual entitlement + Accrued + Adjustments − Approved days.</li>
  </ul>
</div>

<!-- ══════════════════════════════════════════════════════ -->
<!-- PAGE 2                                                 -->
<!-- ══════════════════════════════════════════════════════ -->
<div class="page-break"></div>

<div class="section-title">3. Key Performance Indicators (KPIs) & Diagnostic</div>
<table>
  <thead>
    <tr>
      <th>HR INDICATOR</th>
      <th style="text-align:center">VALUE</th>
      <th>DEFINITION & METHOD</th>
      <th style="text-align:center">RISK LEVEL</th>
      <th>RECOMMENDED ACTION</th>
    </tr>
  </thead>
  <tbody>
    <tr>
      <td><strong>Total analyzed headcount</strong></td>
      <td style="text-align:center;font-weight:bold">${totalEmployees}</td>
      <td>Active employees under supervision</td>
      <td style="text-align:center"><span class="badge badge-normal">NORMAL</span></td>
      <td>Monitoring nominal scope</td>
    </tr>
    <tr>
      <td><strong>Requests volume</strong></td>
      <td style="text-align:center;font-weight:bold">${total}</td>
      <td>Requests submitted over the period</td>
      <td style="text-align:center"><span class="badge badge-normal">NORMAL</span></td>
      <td>Regular activity review</td>
    </tr>
    <tr>
      <td><strong>Approval rate</strong></td>
      <td style="text-align:center;font-weight:bold;color:#16a34a">${approvalPct} (${approved.length})</td>
      <td>Validated requests / Total requests</td>
      <td style="text-align:center"><span class="badge badge-normal">NORMAL</span></td>
      <td>Validated planning</td>
    </tr>
    <tr>
      <td><strong>Pending requests</strong></td>
      <td style="text-align:center;font-weight:bold;color:#d97706">${pending.length} (${pendingPct})</td>
      <td>Absences submitted without final decision</td>
      <td style="text-align:center"><span class="badge badge-surveiller">MONITOR</span></td>
      <td>Validate requests before deadline</td>
    </tr>
    <tr>
      <td><strong>Negative balances observed</strong></td>
      <td style="text-align:center;font-weight:bold;color:#dc2626">${negativeBalances.length}</td>
      <td>Employees with available balance &lt; 0</td>
      <td style="text-align:center"><span class="badge badge-critique">CRITICAL</span></td>
      <td>Verify entitlement history and regularize</td>
    </tr>
    <tr>
      <td><strong>Absence overlaps</strong></td>
      <td style="text-align:center;font-weight:bold;color:#d97706">${overlaps ? overlaps.clusters.length : 0} cluster(s)</td>
      <td>Simultaneous approved absences</td>
      <td style="text-align:center"><span class="badge badge-surveiller">MONITOR</span></td>
      <td>Check team coverage during peak</td>
    </tr>
  </tbody>
</table>

<div class="section-title">4. Leave Type Breakdown</div>
<table>
  <thead>
    <tr>
      <th>LEAVE TYPE</th>
      <th style="text-align:center">REQUESTS SUBMITTED</th>
      <th style="text-align:center">REQUESTS APPROVED</th>
      <th style="text-align:center">APPROVED DAYS</th>
      <th style="text-align:center">% OF TOTAL DAYS</th>
      <th style="text-align:center">AVG DURATION</th>
      <th style="text-align:center">EMPLOYEES</th>
    </tr>
  </thead>
  <tbody>
    ${typeRows.map(([typeName, data]) => {
      const avgDur = avg(approved.filter(r => (r.leaveTypeName || 'Annual Leave') === typeName).map(r => r.durationDays || 0));
      return `<tr>
        <td><strong>${typeName}</strong></td>
        <td style="text-align:center">${data.total}</td>
        <td style="text-align:center;color:#16a34a;font-weight:bold">${data.approved}</td>
        <td style="text-align:center;font-weight:bold">${data.days}d</td>
        <td style="text-align:center">${pct(data.days, totalApprovedDays)}</td>
        <td style="text-align:center">${avgDur}d</td>
        <td style="text-align:center">${data.employees.size}</td>
      </tr>`;
    }).join('')}
  </tbody>
</table>

<div class="method-card" style="margin-top:10px;">
  📝 <strong>HR Analysis by leave type:</strong> The "<strong>${topLeaveType ? topLeaveType[0] : 'Annual Leave'}</strong>" leave type is the main cause of absence with <strong>${topLeaveType ? pct(topLeaveType[1].days, totalApprovedDays) : '0%'}</strong> of the total granted volume (${topLeaveType ? topLeaveType[1].days : 0} days). Its average duration is ${topLeaveType ? avg(approved.filter(r => (r.leaveTypeName || 'Annual Leave') === topLeaveType[0]).map(r => r.durationDays || 0)) : '0'} day(s) per request.
</div>

<div class="section-title">5. Validation Status Distribution</div>
<div class="status-grid">
  <div class="status-card approved">
    <div style="font-size:9px;font-weight:800;text-transform:uppercase">APPROVED</div>
    <div class="status-val">${approved.length}</div>
    <div style="font-size:9px">${totalApprovedDays} days total</div>
  </div>
  <div class="status-card pending">
    <div style="font-size:9px;font-weight:800;text-transform:uppercase">PENDING</div>
    <div class="status-val">${pending.length}</div>
    <div style="font-size:9px">${pendingDays} days reserved</div>
  </div>
  <div class="status-card rejected">
    <div style="font-size:9px;font-weight:800;text-transform:uppercase">REJECTED</div>
    <div class="status-val">${rejected.length}</div>
    <div style="font-size:9px">Rejection rate: ${rejectionPct}</div>
  </div>
  <div class="status-card cancelled">
    <div style="font-size:9px;font-weight:800;text-transform:uppercase">CANCELLED</div>
    <div class="status-val">${cancelled.length}</div>
    <div style="font-size:9px">Entitlements reinstated to balance</div>
  </div>
</div>

<!-- ══════════════════════════════════════════════════════ -->
<!-- PAGE 3                                                 -->
<!-- ══════════════════════════════════════════════════════ -->
<div class="page-break"></div>

<div class="section-title">6. Évolution Mensuelle & Profil Temporel d'Absence</div>
<table>
  <thead>
    <tr>
      <th>MOIS D'ABSENCE</th>
      <th style="text-align:center">DEMANDES TOTALES</th>
      <th style="text-align:center">JOURS APPROUVÉS</th>
      <th style="text-align:center">DEMANDES EN ATTENTE</th>
      <th>DIAGNOSTIC TEMPOREL</th>
    </tr>
  </thead>
  <tbody>
    ${monthEntries.length === 0
      ? '<tr><td colspan="5" style="text-align:center;color:#94a3b8">Aucune donnée mensuelle disponible</td></tr>'
      : monthEntries.map(m => {
          const isPeak = peakMonth && m.monthName === peakMonth.monthName;
          return `<tr ${isPeak ? 'style="background:#fefce8"' : ''}>
            <td><strong>${m.monthName}</strong> ${isPeak ? '<span style="color:#d97706;font-weight:bold">(PIC)</span>' : ''}</td>
            <td style="text-align:center">${m.total}</td>
            <td style="text-align:center;font-weight:bold">${m.approvedDays}j</td>
            <td style="text-align:center;color:#d97706;font-weight:bold">${m.pendingCount}</td>
            <td>${isPeak ? 'Forte concentration d\'absences. Vigilance sur la continuité opérationnelle.' : 'Charge d\'absence modérée.'}</td>
          </tr>`;
        }).join('')
    }
  </tbody>
</table>

<div class="section-title">7. Leave Balance Summary by Employee</div>
<table>
  <thead>
    <tr>
      <th>EMPLOYEE</th>
      <th>DEPARTMENT</th>
      <th>COUNTRY</th>
      <th>ANNUAL LEAVE BALANCE</th>
      <th style="text-align:center">TOTAL AVAILABLE BALANCE</th>
      <th style="text-align:center">BALANCE STATUS</th>
    </tr>
  </thead>
  <tbody>
    ${balances.length === 0
      ? '<tr><td colspan="6" style="text-align:center;color:#94a3b8">No balance data available</td></tr>'
      : balances.map(b => {
          const isDecouvert = (b.totalAvailable ?? 0) < 0;
          const annual = b.balances?.annual || b.balances?.Annual;
          const annualBal = annual ? `${annual.available}d (used: ${annual.used}d)` : '—';
          return `<tr>
            <td><strong>${b.employeeName}</strong></td>
            <td>${b.department || 'Engineering'}</td>
            <td>${b.country || 'Lebanon'}</td>
            <td>${annualBal}</td>
            <td style="text-align:center;" class="${isDecouvert ? 'badge-decouvert' : 'badge-conforme'}">${b.totalAvailable ?? 0}d</td>
            <td style="text-align:center;"><span class="${isDecouvert ? 'badge-decouvert' : 'badge-conforme'}">${isDecouvert ? 'OVERDRAWN' : 'COMPLIANT'}</span></td>
          </tr>`;
        }).join('')
    }
  </tbody>
</table>

<!-- ══════════════════════════════════════════════════════ -->
<!-- PAGE 4 & 5 — CHEVAUCHEMENTS                            -->
<!-- ══════════════════════════════════════════════════════ -->
<div class="page-break"></div>

<div class="section-title">8. Simultaneous Absence Overlap Register</div>
${!overlaps || overlaps.clusters.length === 0
  ? '<div class="method-card">No simultaneous absence overlaps found for the period.</div>'
  : overlaps.clusters.map(c => `
    <div class="overlap-box avoid-break">
      <div class="overlap-header">
        <span>Period from ${fmtShort(c.startDate)} to ${fmtShort(c.endDate)}</span>
        <span>${c.requests.length} employees absent at the same time</span>
      </div>
      <div class="overlap-grid">
        ${c.requests.map(r => `
          <div class="overlap-item">
            <div class="overlap-item-name">👤 ${r.employeeName} (${r.leaveTypeName})</div>
            <div style="font-size:8.5px;color:#64748b;margin-top:2px">${fmtShort(r.startDate)} ➔ ${fmtShort(r.endDate)}</div>
          </div>
        `).join('')}
      </div>
    </div>
  `).join('')
}

<div class="section-title" style="margin-top:24px;">9. Prioritized Action Plan & HR Directives</div>
<table>
  <thead>
    <tr>
      <th>PRIORITY</th>
      <th>FINDING & EVIDENCE</th>
      <th>HR / OPERATIONAL IMPACT</th>
      <th>RECOMMENDED ACTION</th>
      <th>RESPONSIBLE</th>
    </tr>
  </thead>
  <tbody>
    <tr>
      <td><span class="badge badge-critique">CRITICAL</span></td>
      <td><strong>${negativeBalances.length} employee(s) with negative leave balance.</strong></td>
      <td>Risk of legal non-compliance and acquisition error.</td>
      <td>Audit balance ledger and HR regularization.</td>
      <td>Central HR Team</td>
    </tr>
    <tr>
      <td><span class="badge badge-surveiller">HIGH</span></td>
      <td><strong>${pending.length} request(s) awaiting decision.</strong></td>
      <td>Uncertainty on team planning and dissatisfaction.</td>
      <td>Remind validating managers to close within 48h.</td>
      <td>Manager N+1</td>
    </tr>
    <tr>
      <td><span class="badge badge-surveiller" style="color:#7c3aed">MEDIUM</span></td>
      <td><strong>${overlaps ? overlaps.clusters.length : 0} period(s) of overlapping absences.</strong></td>
      <td>Risk of temporary understaffing on key skills.</td>
      <td>Coordinate activity handovers and service continuity.</td>
      <td>Project Lead / N+1</td>
    </tr>
    <tr>
      <td><span class="badge badge-normal">LOW</span></td>
      <td><strong>Periodic monitoring of leave entitlements.</strong></td>
      <td>Maintaining HR data quality.</td>
      <td>Quarterly dashboard review.</td>
      <td>HR Admin</td>
    </tr>
  </tbody>
</table>

<!-- ══════════════════════════════════════════════════════ -->
<!-- PAGE 6 — REGISTRE DÉTAILLÉ                            -->
<!-- ══════════════════════════════════════════════════════ -->
<div class="page-break"></div>

<div class="section-title">10. Detailed Leave Request Register (Filtered Extract)</div>
<table>
  <thead>
    <tr>
      <th>EMPLOYEE</th>
      <th>DEPARTMENT</th>
      <th>LEAVE TYPE</th>
      <th style="text-align:center">START</th>
      <th style="text-align:center">END</th>
      <th style="text-align:center">DURATION</th>
      <th style="text-align:center">STATUS</th>
    </tr>
  </thead>
  <tbody>
    ${requests.slice(0, 30).map(r => {
      const statusColor = r.status === 'APPROVED' ? '#16a34a' : r.status === 'REJECTED' ? '#dc2626' : r.status === 'PENDING' ? '#d97706' : '#64748b';
      return `<tr>
        <td><strong>${r.employeeName}</strong></td>
        <td>${r.department || 'Engineering'}</td>
        <td>${r.leaveTypeName}</td>
        <td style="text-align:center">${fmtShort(r.startDate)}</td>
        <td style="text-align:center">${fmtShort(r.endDate)}</td>
        <td style="text-align:center;font-weight:bold">${r.durationDays}d</td>
        <td style="text-align:center;font-weight:bold;color:${statusColor}">${r.status}</td>
      </tr>`;
    }).join('')}
  </tbody>
</table>
<div style="font-size:8.5px;color:#64748b;font-style:italic;margin-top:6px;text-align:center">
  * Register limited to the first 30 requests for the printable summary. The CSV export contains all ${total} rows.
</div>

<!-- ══════════════════════════════════════════════════════ -->
<!-- PAGE 7 — SIGNATURES                                    -->
<!-- ══════════════════════════════════════════════════════ -->
<div class="page-break"></div>

<div style="margin-top:40px;padding-top:20px;border-top:1px solid #cbd5e1;display:flex;justify-content:space-between;align-items:flex-start;">
  <div style="font-size:9.5px;color:#334155;max-width:380px;">
    <strong>NOVELUS Human Resources & Executive Management System</strong><br/>
    Document automatically generated for HR management and compliance purposes.<br/>
    <span style="color:#64748b;font-size:8.5px">Confidential — Reproduction and distribution strictly reserved for authorized personnel.</span>
  </div>
  <div style="font-size:9.5px;color:#334155;text-align:right">
    <strong>HR Manager / Manager Signature & Approval</strong><br/><br/>
    Date & Signatory: ___________________________
  </div>
</div>

</body>
</html>`;
}

export default function NovelusPdfReport(props: PdfReportProps) {
  const [generating, setGenerating] = useState(false);

  function handleGenerate() {
    setGenerating(true);
    setTimeout(() => {
      try {
        const html = buildReportHtml(props);
        const iframe = document.createElement('iframe');
        iframe.style.position = 'fixed';
        iframe.style.right = '0';
        iframe.style.bottom = '0';
        iframe.style.width = '0';
        iframe.style.height = '0';
        iframe.style.border = '0';
        iframe.style.visibility = 'hidden';
        document.body.appendChild(iframe);

        const doc = iframe.contentWindow?.document;
        if (doc) {
          doc.open();
          doc.write(html);
          doc.close();
          setTimeout(() => {
            iframe.contentWindow?.focus();
            iframe.contentWindow?.print();
            setTimeout(() => {
              if (document.body.contains(iframe)) {
                document.body.removeChild(iframe);
              }
            }, 1000);
          }, 300);
        }
      } catch (err) {
        console.error('PDF generation error:', err);
        alert('Erreur lors de la génération du rapport.');
      } finally {
        setGenerating(false);
      }
    }, 50);
  }

  return (
    <button
      onClick={handleGenerate}
      disabled={generating || props.requests.length === 0}
      className="flex items-center gap-2 bg-gradient-to-r from-violet-700 to-indigo-700 hover:from-violet-800 hover:to-indigo-800 disabled:from-slate-400 disabled:to-slate-500 text-white font-bold px-5 py-2.5 rounded-xl text-sm shadow-lg transition-all cursor-pointer disabled:cursor-not-allowed"
      title={props.requests.length === 0 ? 'Load data before generating the report' : 'Generate NOVELUS Official PDF Report'}
    >
      {generating ? (
        <><Loader2 size={15} className="animate-spin" /> Generating…</>
      ) : (
        <><FileText size={15} /> Smart PDF Report</>
      )}
    </button>
  );
}
