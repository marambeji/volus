/**
 * NovelusPdfReport.tsx
 * Official NOVELUS HR Leave Management Report Generator & Customizer
 */

import { useState } from 'react';
import {
  FileText,
  Loader2,
  Sliders,
  X,
  Pin,
  Building2,
  Globe,
  Calendar,
  Tag,
  User,
  Users,
} from 'lucide-react';
import type { ReportRequestRow, ReportBalanceRow, ReportOverlaps } from '../../services/reportsApi';

export interface PdfReportFilters {
  dateFrom?: string;
  dateTo?: string;
  department?: string;
  country?: string;
  leaveTypeName?: string;
  status?: string;
  periodLabel?: string;
  employeeName?: string;
  isEmployeePersonal?: boolean;
}

interface PdfReportProps {
  managerName: string;
  requests: ReportRequestRow[];
  balances: ReportBalanceRow[];
  overlaps: ReportOverlaps | null;
  filters: PdfReportFilters;
  /** When true: report is scoped to the manager's direct reports only — hides dept/country filters */
  teamOnly?: boolean;
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
  const { managerName, requests, balances, overlaps, filters, teamOnly = false } = props;

  // Apply filters dynamically to dataset for calculations
  let activeRequests = requests;
  if (filters.department && filters.department !== 'All departments') {
    activeRequests = activeRequests.filter(r => r.department === filters.department);
  }
  if (filters.country && filters.country !== 'All countries') {
    activeRequests = activeRequests.filter(r => r.country === filters.country);
  }
  if (filters.leaveTypeName && filters.leaveTypeName !== 'All types') {
    activeRequests = activeRequests.filter(r => r.leaveTypeName === filters.leaveTypeName);
  }
  if (filters.employeeName && filters.employeeName !== 'All members') {
    activeRequests = activeRequests.filter(r => r.employeeName === filters.employeeName);
  }

  let activeBalances = balances;
  if (filters.department && filters.department !== 'All departments') {
    activeBalances = activeBalances.filter(b => b.department === filters.department);
  }
  if (filters.country && filters.country !== 'All countries') {
    activeBalances = activeBalances.filter(b => b.country === filters.country);
  }
  if (filters.employeeName && filters.employeeName !== 'All members') {
    activeBalances = activeBalances.filter(b => b.employeeName === filters.employeeName);
  }

  // ── Overlaps filtering ──────────────────────────────────────────────────
  let activeOverlapsClusters = overlaps?.clusters || [];

  if (filters.employeeName && filters.employeeName !== 'All members') {
    activeOverlapsClusters = activeOverlapsClusters.filter(c =>
      c.requests.some(r => r.employeeName === filters.employeeName)
    );
  }
  if (filters.department && filters.department !== 'All departments') {
    const deptEmpNames = new Set(requests.filter(r => r.department === filters.department).map(r => r.employeeName));
    activeOverlapsClusters = activeOverlapsClusters.filter(c =>
      c.requests.some(r => deptEmpNames.has(r.employeeName))
    );
  }
  if (filters.country && filters.country !== 'All countries') {
    const countryEmpNames = new Set(requests.filter(r => r.country === filters.country).map(r => r.employeeName));
    activeOverlapsClusters = activeOverlapsClusters.filter(c =>
      c.requests.some(r => countryEmpNames.has(r.employeeName))
    );
  }
  if (filters.leaveTypeName && filters.leaveTypeName !== 'All types') {
    activeOverlapsClusters = activeOverlapsClusters.filter(c =>
      c.requests.some(r => r.leaveTypeName === filters.leaveTypeName)
    );
  }
  const now = new Date();
  const generatedAtDate = now.toLocaleDateString('en-GB', { day: '2-digit', month: 'long', year: 'numeric' });
  const generatedAtTime = now.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
  const generatedAt = `${generatedAtDate} at ${generatedAtTime}`;

  // ── Global calculations ──────────────────────────────────────────────────
  const total = activeRequests.length;
  const approved = activeRequests.filter(r => r.status === 'APPROVED');
  const pending = activeRequests.filter(r => r.status === 'PENDING');
  const rejected = activeRequests.filter(r => r.status === 'REJECTED');
  const cancelled = activeRequests.filter(r => r.status === 'CANCELLED');

  const totalApprovedDays = approved.reduce((s, r) => s + (r.durationDays || 0), 0);
  const pendingDays = pending.reduce((s, r) => s + (r.durationDays || 0), 0);
  const approvalPct = pct(approved.length, total);
  const rejectionPct = pct(rejected.length, total);
  const cancellationPct = pct(cancelled.length, total);
  const pendingPct = pct(pending.length, total);

  // Unique employees
  const uniqueEmployeeIds = new Set(activeRequests.map(r => r.employeeId || r.employeeName));
  const totalEmployees = activeBalances.length > 0 ? activeBalances.length : uniqueEmployeeIds.size;

  // Negative balances
  const negativeBalances = activeBalances.filter(b =>
    (b.totalAvailable ?? 0) < 0 || Object.values(b.balances || {}).some((v: any) => (v.available ?? 0) < 0)
  );

  // Leave Type breakdown
  const byType = new Map<string, { total: number; approved: number; days: number; employees: Set<string> }>();
  activeRequests.forEach(r => {
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

  activeRequests.forEach(r => {
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
  const filterPeriod = filters.periodLabel
    ? filters.periodLabel
    : filters.dateFrom
    ? `From ${fmtShort(filters.dateFrom)} to ${filters.dateTo ? fmtShort(filters.dateTo) : 'present'}`
    : 'Full year';
  const filterDept = teamOnly ? 'My Direct Reports (Team Scope)' : (filters.department || 'All departments');
  const filterCountry = teamOnly ? 'All — scoped by manager' : (filters.country || 'All countries');
  const filterTypeLabel = filters.leaveTypeName || 'All types';
  const filterMember = filters.employeeName || 'All members';

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <title>NOVELUS — Official HR Leave Management Report</title>
  <style>
    @page {
      size: A4 portrait;
      margin: 15mm;
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
      color: #475569;
      letter-spacing: 0.5px;
    }

    /* Scope Card */
    .filter-card {
      background: #f8fafc;
      border: 1px solid #e2e8f0;
      border-radius: 8px;
      padding: 10px 14px;
      margin-bottom: 16px;
    }
    .filter-title {
      font-size: 9px;
      font-weight: 800;
      color: #0f172a;
      text-transform: uppercase;
      letter-spacing: 0.8px;
      margin-bottom: 6px;
    }
    .filter-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 4px 16px;
      font-size: 9.5px;
      color: #475569;
    }
    .filter-grid strong { color: #0f172a; }

    /* Titles & Boxes */
    .section-title {
      font-size: 11px;
      font-weight: 800;
      color: #1e1b4b;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      border-bottom: 1.5px solid #cbd5e1;
      padding-bottom: 4px;
      margin-top: 14px;
      margin-bottom: 10px;
    }
    .summary-box {
      background: #f8fafc;
      border-left: 3.5px solid #4f46e5;
      padding: 10px 12px;
      font-size: 9.5px;
      line-height: 1.55;
      color: #334155;
      margin-bottom: 14px;
      border-radius: 0 6px 6px 0;
    }
    .summary-box strong { color: #0f172a; }
    .orientation-note {
      margin-top: 8px;
      padding-top: 6px;
      border-top: 1px dashed #cbd5e1;
      font-size: 9px;
      font-style: italic;
      color: #475569;
    }

    /* Method Cards */
    .method-card {
      background: #f8fafc;
      border: 1px solid #e2e8f0;
      border-radius: 6px;
      padding: 8px 12px;
      margin-bottom: 8px;
    }
    .method-card-title {
      font-size: 9px;
      font-weight: 800;
      color: #0f172a;
      text-transform: uppercase;
      margin-bottom: 4px;
    }
    .method-list {
      padding-left: 16px;
      margin: 0;
      font-size: 9px;
      color: #475569;
    }
    .method-list li { margin-bottom: 3px; }

    /* Tables & Badges */
    table { width: 100%; border-collapse: collapse; margin: 10px 0; font-size: 9.5px; }
    th {
      font-size: 8.5px;
      font-weight: 800;
      color: #fff;
      background: #0f172a;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      padding: 6px 8px;
      text-align: left;
    }
    td { padding: 6px 8px; border-bottom: 1px solid #e2e8f0; color: #334155; }
    tr:nth-child(even) td { background: #f8fafc; }

    .badge {
      display: inline-block;
      padding: 2px 6px;
      border-radius: 4px;
      font-size: 8.5px;
      font-weight: 800;
      text-transform: uppercase;
    }
    .badge-normal { color: #16a34a; background: #dcfce7; }
    .badge-surveiller { color: #d97706; background: #fef9c3; }
    .badge-critique { color: #dc2626; background: #fee2e2; }

    .status-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 10px; margin: 12px 0; }
    .status-card {
      border-radius: 8px;
      padding: 12px;
      text-align: center;
      border: 1px solid;
    }
    .status-card.approved { background: #f0fdf4; border-color: #bbf7d0; color: #166534; }
    .status-card.pending  { background: #fffbeb; border-color: #fef08a; color: #92400e; }
    .status-card.rejected { background: #fef2f2; border-color: #fecaca; color: #991b1b; }
    .status-card.cancelled{ background: #f8fafc; border-color: #e2e8f0; color: #475569; }
    .status-val { font-size: 20px; font-weight: 900; line-height: 1.1; margin: 4px 0; }

    .overlap-box {
      border: 1px solid #e2e8f0;
      border-radius: 8px;
      padding: 10px 12px;
      margin-bottom: 10px;
    }
    .overlap-header { display: flex; justify-content: space-between; font-size: 9.5px; font-weight: 800; color: #92400e; margin-bottom: 6px; }
    .overlap-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; }
    .overlap-item {
      border: 1px solid #e2e8f0;
      border-radius: 6px;
      padding: 6px 10px;
      font-size: 9px;
      color: #334155;
    }

    .footer {
      margin-top: 20px;
      padding-top: 10px;
      border-top: 1px solid #cbd5e1;
      display: flex;
      justify-content: space-between;
      align-items: center;
      font-size: 8px;
      color: #64748b;
    }
    .signature-box {
      margin-top: 24px;
      padding: 12px;
      border: 1px dashed #94a3b8;
      border-radius: 6px;
      font-size: 9px;
      color: #475569;
    }

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

<!-- PAGE 1 -->
<div class="header">
  <div>
    <div class="brand-logo">N<span class="brand-dot">●</span>VELUS</div>
    <div class="brand-sub">HR INFORMATION & GESTION SYSTEM</div>
  </div>
  <div class="header-right">
    <div class="header-title">${filters.isEmployeePersonal ? 'Official Personal Leave Statement' : teamOnly ? 'Official Manager Team Leave Report' : 'Official HR Leave Management Report'}</div>
    <div class="header-meta">Generated on: ${generatedAt}</div>
    <div class="header-meta">${filters.isEmployeePersonal ? `Employee: ${managerName}` : `Issuer: ${managerName} (${teamOnly ? 'Direct Manager — Team Scope' : 'Human Resources Department'})`}</div>
    <div class="confidential-badge">INTERNAL &amp; CONFIDENTIAL DOCUMENT</div>
  </div>
</div>

${filters.isEmployeePersonal ? `

<div class="filter-card">
  <div class="filter-title">📌 Statement Scope &amp; Employee Information</div>
  <div class="filter-grid">
    <div>Employee name: <strong>${managerName}</strong></div>
    <div>Statement period: <strong>${filterPeriod}</strong></div>
    <div>Leave type filter: <strong>${filterTypeLabel}</strong></div>
    <div>Document classification: <strong>Official Personal Leave Statement</strong></div>
  </div>
</div>

<div class="section-title">1. Personal Leave Summary &amp; Usage Overview</div>
<div class="summary-box">
  This statement summarizes all leave entitlements, usage, and submitted requests for <strong>${managerName}</strong> during <strong>${filterPeriod}</strong>.
  <br/><br/>
  A total of <strong>${total} request(s)</strong> have been recorded in the system.
  Of these, <strong>${approved.length} request(s)</strong> were officially approved, accounting for <strong>${totalApprovedDays} day(s)</strong> of leave taken.
  ${pending.length > 0 ? `Currently, <strong>${pending.length} request(s)</strong> (${pendingDays} day(s)) are pending manager validation.` : 'All submitted requests have been processed.'}
  ${topLeaveType ? ` The primary leave type utilized is <strong>"${topLeaveType[0]}"</strong> with <strong>${topLeaveType[1].days} day(s)</strong> consumed.` : ''}
</div>

<div class="section-title">2. Calculation Rules &amp; Methodological Notes</div>
<div class="method-card">
  <div class="method-card-title">Leave Entitlement &amp; Absence Counting Rules</div>
  <ul class="method-list">
    <li><strong>Approved Absences:</strong> Only requests with status <span style="color:#16a34a;font-weight:bold">APPROVED</span> are deducted from your balance.</li>
    <li><strong>Pending &amp; Exclusions:</strong> Pending requests hold days in reserve. Rejected or cancelled requests do not affect your remaining balance.</li>
    <li><strong>Public Holidays &amp; Weekends:</strong> Weekends and recognized public holidays are automatically excluded from leave duration.</li>
    <li><strong>Remaining Balance Formula:</strong> Remaining = Annual Entitlement + Adjustments − Approved Days.</li>
  </ul>
</div>

<div class="section-title">3. Personal Leave Balances Breakdown</div>
<table>
  <thead>
    <tr>
      <th>LEAVE TYPE</th>
      <th style="text-align:center">ENTITLEMENT</th>
      <th style="text-align:center">DAYS USED</th>
      <th style="text-align:center">REMAINING BALANCE</th>
      <th style="text-align:center">STATUS</th>
    </tr>
  </thead>
  <tbody>
    ${activeBalances.length === 0 || !activeBalances[0]?.balances
      ? '<tr><td colspan="5" style="text-align:center;color:#94a3b8">No balance data available</td></tr>'
      : Object.entries(activeBalances[0].balances).map(([typeName, b]) => {
          const isNegative = b.available < 0;
          return `<tr>
            <td><strong>${typeName}</strong></td>
            <td style="text-align:center">${b.entitlement}d</td>
            <td style="text-align:center;color:#475569;font-weight:bold">${b.used}d</td>
            <td style="text-align:center;font-weight:bold;" class="${isNegative ? 'badge-critique' : 'badge-normal'}">${b.available}d</td>
            <td style="text-align:center;"><span class="badge ${isNegative ? 'badge-critique' : 'badge-normal'}">${isNegative ? 'OVERDRAWN' : 'AVAILABLE'}</span></td>
          </tr>`;
        }).join('')
    }
  </tbody>
</table>

<div class="section-title">4. Personal Request History</div>
<table>
  <thead>
    <tr>
      <th>LEAVE TYPE</th>
      <th style="text-align:center">START DATE</th>
      <th style="text-align:center">END DATE</th>
      <th style="text-align:center">DURATION</th>
      <th style="text-align:center">STATUS</th>
      <th style="text-align:center">SUBMITTED ON</th>
    </tr>
  </thead>
  <tbody>
    ${activeRequests.length === 0
      ? '<tr><td colspan="6" style="text-align:center;color:#94a3b8">No leave requests found for this period</td></tr>'
      : activeRequests.slice(0, 40).map(r => {
          const statusColor = r.status === 'APPROVED' ? '#16a34a' : r.status === 'REJECTED' ? '#dc2626' : r.status === 'PENDING' ? '#d97706' : '#64748b';
          return `<tr>
            <td><strong>${r.leaveTypeName}</strong></td>
            <td style="text-align:center">${fmtShort(r.startDate)}</td>
            <td style="text-align:center">${fmtShort(r.endDate)}</td>
            <td style="text-align:center;font-weight:bold">${r.durationDays}d</td>
            <td style="text-align:center;font-weight:bold;color:${statusColor}">${r.status}</td>
            <td style="text-align:center;color:#64748b">${r.createdAt ? fmtShort(r.createdAt) : '—'}</td>
          </tr>`;
        }).join('')
    }
  </tbody>
</table>

<div class="signature-box">
  <strong>Employee Confirmation &amp; Record</strong><br/><br/>
  Statement Date: ${generatedAt}<br/>
  Employee Signature: ___________________________
</div>

` : `

<div class="filter-card">
  <div class="filter-title">📌 Report Scope &amp; Applied Filters</div>
  <div class="filter-grid">
    <div>Report period: <strong>${filterPeriod}</strong></div>
    <div>Department: <strong>${filterDept}</strong></div>
    <div>Country / Entity: <strong>${filterCountry}</strong></div>
    <div>Leave type: <strong>${filterTypeLabel}</strong></div>
    ${teamOnly && filters.employeeName && filters.employeeName !== 'All members' ? `<div style="grid-column:1/-1">Team Member: <strong style="color:#6366f1">${filterMember}</strong></div>` : ''}
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
  ${activeOverlapsClusters.length > 0 ? `Additionally, <strong>${activeOverlapsClusters.length} overlap period(s)</strong> of simultaneous absences ${filters.employeeName && filters.employeeName !== 'All members' ? `involving <strong>${filters.employeeName}</strong>` : 'within the team'} have been identified.` : ''}

  <div class="orientation-note">
    💡 <strong>HR Guidance Note:</strong> "The recommendations in this summary aim to secure operational schedules, guarantee equitable treatment of leave entitlements, and ensure regulatory compliance of balances."
  </div>
</div>

<div class="section-title">2. Analysis Scope &amp; Methodological Rules</div>
<div class="method-card">
  <div class="method-card-title">Calculation Rules &amp; Statuses</div>
  <ul class="method-list">
    <li><strong>Effective consumption:</strong> Only requests validated in status <span style="color:#16a34a;font-weight:bold">APPROVED</span> are included in the consumed days volume.</li>
    <li><strong>Consumption exclusions:</strong> Rejected (<span style="color:#dc2626;font-weight:bold">REJECTED</span>) and cancelled (<span style="color:#64748b;font-weight:bold">CANCELLED</span>) requests are strictly excluded from the count of taken days.</li>
    <li><strong>Working days &amp; Public Holidays:</strong> The calculated absence duration automatically deducts weekends and official public holidays for the country entity.</li>
    <li><strong>Balance formula:</strong> Available balance = Annual entitlement + Accrued + Adjustments − Approved days.</li>
  </ul>
</div>

<div class="section-title">3. Key Performance Indicators (KPIs) &amp; Diagnostic</div>
<table>
  <thead>
    <tr>
      <th>HR INDICATOR</th>
      <th style="text-align:center">VALUE</th>
      <th>DEFINITION &amp; METHOD</th>
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

<div class="page-break"></div>

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
    <div style="font-size:9px">Entitlements reinstated</div>
  </div>
</div>

<div class="page-break"></div>

<div class="section-title">6. Leave Balance Summary by Employee</div>
<table>
  <thead>
    <tr>
      <th>EMPLOYEE</th>
      <th>DEPARTMENT</th>
      <th>COUNTRY</th>
      <th style="text-align:center">TOTAL AVAILABLE BALANCE</th>
      <th style="text-align:center">BALANCE STATUS</th>
    </tr>
  </thead>
  <tbody>
    ${activeBalances.length === 0
      ? '<tr><td colspan="5" style="text-align:center;color:#94a3b8">No balance data available</td></tr>'
      : activeBalances.map(b => {
          const isDecouvert = (b.totalAvailable ?? 0) < 0;
          return `<tr>
            <td><strong>${b.employeeName}</strong></td>
            <td>${b.department || '—'}</td>
            <td>${b.country || '—'}</td>
            <td style="text-align:center;font-weight:bold;" class="${isDecouvert ? 'badge-critique' : 'badge-normal'}">${b.totalAvailable ?? 0} days</td>
            <td style="text-align:center;"><span class="badge ${isDecouvert ? 'badge-critique' : 'badge-normal'}">${isDecouvert ? 'OVERDRAWN' : 'COMPLIANT'}</span></td>
          </tr>`;
        }).join('')
    }
  </tbody>
</table>

<div class="section-title">7. Simultaneous Absence Overlap Register</div>
${activeOverlapsClusters.length === 0
  ? '<div class="method-card">No simultaneous absence overlaps found for the selected scope.</div>'
  : activeOverlapsClusters.map(c => `
    <div class="overlap-box avoid-break">
      <div class="overlap-header">
        <span>Period from ${fmtShort(c.startDate)} to ${fmtShort(c.endDate)}</span>
        <span>${c.requests.length} employees absent at the same time</span>
      </div>
      <div class="overlap-grid">
        ${c.requests.map(r => {
          const isTarget = filters.employeeName && filters.employeeName !== 'All members' && r.employeeName === filters.employeeName;
          return `
          <div class="overlap-item" style="${isTarget ? 'background:#f0fdf4;border:1.5px solid #16a34a;' : ''}">
            <div><strong>👤 ${r.employeeName}</strong> ${isTarget ? '<span style="font-size:8px;color:#16a34a;font-weight:bold">(TARGET)</span>' : ''} (${r.leaveTypeName})</div>
            <div style="font-size:8.5px;color:#64748b;margin-top:2px">${fmtShort(r.startDate)} ➔ ${fmtShort(r.endDate)}</div>
          </div>`;
        }).join('')}
      </div>
    </div>
  `).join('')
}

<div class="section-title">8. Detailed Leave Request Register (Filtered Extract)</div>
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
    ${activeRequests.slice(0, 30).map(r => {
      const statusColor = r.status === 'APPROVED' ? '#16a34a' : r.status === 'REJECTED' ? '#dc2626' : r.status === 'PENDING' ? '#d97706' : '#64748b';
      return `<tr>
        <td><strong>${r.employeeName}</strong></td>
        <td>${r.department || '—'}</td>
        <td>${r.leaveTypeName}</td>
        <td style="text-align:center">${fmtShort(r.startDate)}</td>
        <td style="text-align:center">${fmtShort(r.endDate)}</td>
        <td style="text-align:center;font-weight:bold">${r.durationDays}d</td>
        <td style="text-align:center;font-weight:bold;color:${statusColor}">${r.status}</td>
      </tr>`;
    }).join('')}
  </tbody>
</table>

<div class="signature-box">
  <strong>HR Manager / Manager Signature &amp; Approval</strong><br/><br/>
  Date &amp; Signatory: ___________________________
</div>

`}

<div class="footer">
  <div>NOVELUS HR Portal — Official Leave Management Report</div>
  <div>Page 1 of 2</div>
</div>

</body>
</html>`;
}

export function generatePdfReportDirect(props: PdfReportProps) {
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
  }
}

export default function NovelusPdfReport(props: PdfReportProps) {
  const { teamOnly = false } = props;
  const [generating, setGenerating] = useState(false);
  const [showModal, setShowModal] = useState(false);

  // Manual filter state inside modal
  const [periodPreset, setPeriodPreset] = useState<string>('full_year');
  const [customPeriodText, setCustomPeriodText] = useState<string>('');
  const [department, setDepartment] = useState<string>('All departments');
  const [country, setCountry] = useState<string>('All countries');
  const [leaveTypeName, setLeaveTypeName] = useState<string>('All types');
  const [memberFilter, setMemberFilter] = useState<string>('All members');
  const [issuerName, setIssuerName] = useState<string>('');

  // Extract unique choices from current datasets
  const departmentChoices = Array.from(
    new Set(
      [
        'All departments',
        ...props.balances.map(b => b.department),
        ...props.requests.map(r => r.department),
      ].filter(Boolean) as string[]
    )
  );

  const countryChoices = Array.from(
    new Set(
      [
        'All countries',
        ...props.balances.map(b => b.country),
        ...props.requests.map(r => r.country),
      ].filter(Boolean) as string[]
    )
  );

  const leaveTypeChoices = Array.from(
    new Set(
      [
        'All types',
        ...props.requests.map(r => r.leaveTypeName),
      ].filter(Boolean) as string[]
    )
  );

  // Team member list from loaded data
  const teamMemberChoices = Array.from(
    new Set(
      [
        'All members',
        ...props.balances.map(b => b.employeeName),
        ...props.requests.map(r => r.employeeName),
      ].filter(Boolean) as string[]
    )
  ).sort((a, b) => a === 'All members' ? -1 : b === 'All members' ? 1 : a.localeCompare(b));

  function handleOpenModal() {
    // In teamOnly mode, dept/country are server-scoped — no manual override
    setDepartment(teamOnly ? 'All departments' : (props.filters.department || 'All departments'));
    setCountry(teamOnly ? 'All countries' : (props.filters.country || 'All countries'));
    setLeaveTypeName(props.filters.leaveTypeName || 'All types');
    setMemberFilter(props.filters.employeeName || 'All members');
    setIssuerName(props.managerName || 'HR Department');

    if (props.filters.periodLabel) {
      setPeriodPreset('custom');
      setCustomPeriodText(props.filters.periodLabel);
    } else if (props.filters.dateFrom) {
      setPeriodPreset('custom');
      setCustomPeriodText(`From ${fmtShort(props.filters.dateFrom)} to ${props.filters.dateTo ? fmtShort(props.filters.dateTo) : 'present'}`);
    } else {
      setPeriodPreset('full_year');
      setCustomPeriodText('');
    }

    setShowModal(true);
  }

  function getComputedPeriodLabel(): string {
    if (periodPreset === 'full_year') return 'Full year';
    if (periodPreset === 'q1') return 'Q1 (Jan - Mar)';
    if (periodPreset === 'q2') return 'Q2 (Apr - Jun)';
    if (periodPreset === 'q3') return 'Q3 (Jul - Sep)';
    if (periodPreset === 'q4') return 'Q4 (Oct - Dec)';
    if (periodPreset === 'ytd') return 'Year-to-Date (YTD)';
    if (periodPreset === 'custom') return customPeriodText || 'Custom Period';
    return props.filters.dateFrom
      ? `From ${fmtShort(props.filters.dateFrom)} to ${props.filters.dateTo ? fmtShort(props.filters.dateTo) : 'present'}`
      : 'Full year';
  }

  function handleGenerateReport() {
    setGenerating(true);
    setShowModal(false);

    const activeFilters: PdfReportFilters = {
      ...props.filters,
      periodLabel: getComputedPeriodLabel(),
      department,
      country,
      leaveTypeName,
      employeeName: memberFilter,
    };

    const effectiveProps: PdfReportProps = {
      ...props,
      managerName: issuerName || props.managerName,
      filters: activeFilters,
    };

    setTimeout(() => {
      try {
        const html = buildReportHtml(effectiveProps);
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
    <>
      <button
        onClick={handleOpenModal}
        disabled={generating || props.requests.length === 0}
        className="flex items-center gap-2 bg-gradient-to-r from-violet-700 to-indigo-700 hover:from-violet-800 hover:to-indigo-800 disabled:from-slate-400 disabled:to-slate-500 text-white font-bold px-5 py-2.5 rounded-xl text-sm shadow-lg transition-all cursor-pointer disabled:cursor-not-allowed"
        title={props.requests.length === 0 ? 'Load data before generating the report' : 'Configure & Generate NOVELUS Official PDF Report'}
      >
        {generating ? (
          <><Loader2 size={15} className="animate-spin" /> Generating…</>
        ) : (
          <><Sliders size={15} /> Smart PDF Report</>
        )}
      </button>

      {/* Manual Scope & Filter Configuration Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-200">
          <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-700 w-full max-w-lg overflow-hidden flex flex-col">
            
            {/* Modal Header */}
            <div className="px-6 py-4 bg-slate-900 text-white flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="p-2 bg-violet-600 rounded-xl text-white">
                  <Sliders size={18} />
                </div>
                <div>
                  <h3 className="font-extrabold text-base leading-tight">
                    {teamOnly ? 'Configure Team PDF Report' : 'Configure PDF Scope & Filters'}
                  </h3>
                  <p className="text-xs text-slate-400">
                    {teamOnly
                      ? 'Scoped to your direct reports only — server enforced'
                      : 'Set manual values for the official report header'}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setShowModal(false)}
                className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 transition-colors"
              >
                <X size={18} />
              </button>
            </div>

            {/* Modal Content */}
            <div className="p-6 space-y-4 text-slate-800 dark:text-slate-200 text-sm max-h-[75vh] overflow-y-auto">
              
              {/* Report Period */}
              <div>
                <label className="block text-xs font-bold text-slate-600 dark:text-slate-300 uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
                  <Calendar size={14} className="text-violet-600" /> Report Period
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <select
                    value={periodPreset}
                    onChange={(e) => setPeriodPreset(e.target.value)}
                    className="px-3 py-2 text-sm bg-slate-50 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-xl focus:ring-2 focus:ring-violet-500 outline-none"
                  >
                    <option value="full_year">Full year</option>
                    <option value="q1">Q1 (Jan - Mar)</option>
                    <option value="q2">Q2 (Apr - Jun)</option>
                    <option value="q3">Q3 (Jul - Sep)</option>
                    <option value="q4">Q4 (Oct - Dec)</option>
                    <option value="ytd">Year-to-Date (YTD)</option>
                    <option value="custom">Custom Text...</option>
                  </select>

                  {periodPreset === 'custom' ? (
                    <input
                      type="text"
                      placeholder="e.g. 01/01/2026 - 31/12/2026"
                      value={customPeriodText}
                      onChange={(e) => setCustomPeriodText(e.target.value)}
                      className="px-3 py-2 text-sm bg-slate-50 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-xl focus:ring-2 focus:ring-violet-500 outline-none"
                    />
                  ) : (
                    <div className="px-3 py-2 text-xs font-medium text-slate-500 bg-slate-100 dark:bg-slate-700/50 rounded-xl flex items-center">
                      Label: {getComputedPeriodLabel()}
                    </div>
                  )}
                </div>
              </div>

              {/* Department — hidden in teamOnly mode (server-scoped) */}
              {!teamOnly && (
              <div>
                <label className="block text-xs font-bold text-slate-600 dark:text-slate-300 uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
                  <Building2 size={14} className="text-violet-600" /> Department
                </label>
                <div className="flex gap-2">
                  <select
                    value={departmentChoices.includes(department) ? department : 'custom'}
                    onChange={(e) => {
                      if (e.target.value !== 'custom') setDepartment(e.target.value);
                    }}
                    className="flex-1 px-3 py-2 text-sm bg-slate-50 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-xl focus:ring-2 focus:ring-violet-500 outline-none"
                  >
                    {departmentChoices.map((d) => (
                      <option key={d} value={d}>{d}</option>
                    ))}
                    <option value="custom">Custom Department Name...</option>
                  </select>
                  {!departmentChoices.includes(department) && (
                    <input
                      type="text"
                      placeholder="Custom Department"
                      value={department}
                      onChange={(e) => setDepartment(e.target.value)}
                      className="flex-1 px-3 py-2 text-sm bg-slate-50 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-xl focus:ring-2 focus:ring-violet-500 outline-none"
                    />
                  )}
                </div>
              </div>
              )}

              {/* Country / Entity — hidden in teamOnly mode (server-scoped) */}
              {!teamOnly && (
              <div>
                <label className="block text-xs font-bold text-slate-600 dark:text-slate-300 uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
                  <Globe size={14} className="text-violet-600" /> Country / Entity
                </label>
                <div className="flex gap-2">
                  <select
                    value={countryChoices.includes(country) ? country : 'custom'}
                    onChange={(e) => {
                      if (e.target.value !== 'custom') setCountry(e.target.value);
                    }}
                    className="flex-1 px-3 py-2 text-sm bg-slate-50 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-xl focus:ring-2 focus:ring-violet-500 outline-none"
                  >
                    {countryChoices.map((c) => (
                      <option key={c} value={c}>{c}</option>
                    ))}
                    <option value="custom">Custom Entity/Country Name...</option>
                  </select>
                  {!countryChoices.includes(country) && (
                    <input
                      type="text"
                      placeholder="Custom Country"
                      value={country}
                      onChange={(e) => setCountry(e.target.value)}
                      className="flex-1 px-3 py-2 text-sm bg-slate-50 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-xl focus:ring-2 focus:ring-violet-500 outline-none"
                    />
                  )}
                </div>
              </div>
              )}

              {/* Leave Type */}
              <div>
                <label className="block text-xs font-bold text-slate-600 dark:text-slate-300 uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
                  <Tag size={14} className="text-violet-600" /> Leave Type
                </label>
                <div className="flex gap-2">
                  <select
                    value={leaveTypeChoices.includes(leaveTypeName) ? leaveTypeName : 'custom'}
                    onChange={(e) => {
                      if (e.target.value !== 'custom') setLeaveTypeName(e.target.value);
                    }}
                    className="flex-1 px-3 py-2 text-sm bg-slate-50 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-xl focus:ring-2 focus:ring-violet-500 outline-none"
                  >
                    {leaveTypeChoices.map((t) => (
                      <option key={t} value={t}>{t}</option>
                    ))}
                    <option value="custom">Custom Leave Type Name...</option>
                  </select>
                  {!leaveTypeChoices.includes(leaveTypeName) && (
                    <input
                      type="text"
                      placeholder="Custom Leave Type"
                      value={leaveTypeName}
                      onChange={(e) => setLeaveTypeName(e.target.value)}
                      className="flex-1 px-3 py-2 text-sm bg-slate-50 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-xl focus:ring-2 focus:ring-violet-500 outline-none"
                    />
                  )}
                </div>
              </div>

              {/* Team Member — only visible in teamOnly mode */}
              {teamOnly && (
              <div>
                <label className="block text-xs font-bold text-slate-600 dark:text-slate-300 uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
                  <Users size={14} className="text-violet-600" /> Team Member
                </label>
                <select
                  value={memberFilter}
                  onChange={(e) => setMemberFilter(e.target.value)}
                  className="w-full px-3 py-2 text-sm bg-slate-50 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-xl focus:ring-2 focus:ring-violet-500 outline-none"
                >
                  {teamMemberChoices.map((m) => (
                    <option key={m} value={m}>{m}</option>
                  ))}
                </select>
                {memberFilter !== 'All members' && (
                  <p className="text-xs text-violet-600 dark:text-violet-400 mt-1 font-medium">
                    📊 Report will be scoped to: <strong>{memberFilter}</strong>
                  </p>
                )}
              </div>
              )}

              {/* Issuer / Signatory Name */}
              <div>
                <label className="block text-xs font-bold text-slate-600 dark:text-slate-300 uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
                  <User size={14} className="text-violet-600" /> Signatory / Issuer Name
                </label>
                <input
                  type="text"
                  placeholder="Manager / HR Name"
                  value={issuerName}
                  onChange={(e) => setIssuerName(e.target.value)}
                  className="w-full px-3 py-2 text-sm bg-slate-50 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-xl focus:ring-2 focus:ring-violet-500 outline-none"
                />
              </div>

              {/* 📌 Real-time Preview Banner */}
              <div className="bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl p-3.5 mt-3 shadow-inner">
                <div className="text-[11px] font-black text-slate-900 dark:text-white flex items-center gap-1.5 mb-2 uppercase tracking-wide">
                  <Pin size={12} className="text-red-500" /> Report Scope &amp; Applied Filters (PDF Preview)
                </div>
                {teamOnly && (
                  <div className="mb-2 flex items-center gap-1.5 text-xs font-bold text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-900/30 border border-emerald-200 dark:border-emerald-700 rounded-lg px-3 py-1.5">
                    <Users size={12} /> Scope: My Direct Reports Only (server-enforced)
                  </div>
                )}
                <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-xs text-slate-600 dark:text-slate-300">
                  <div>Report period: <strong className="text-slate-900 dark:text-white font-bold">{getComputedPeriodLabel()}</strong></div>
                  {!teamOnly && <div>Department: <strong className="text-slate-900 dark:text-white font-bold">{department}</strong></div>}
                  {!teamOnly && <div>Country / Entity: <strong className="text-slate-900 dark:text-white font-bold">{country}</strong></div>}
                  <div>Leave type: <strong className="text-slate-900 dark:text-white font-bold">{leaveTypeName}</strong></div>
                  {teamOnly && <div className="col-span-2">Team Member: <strong className="text-violet-700 dark:text-violet-300 font-bold">{memberFilter}</strong></div>}
                </div>
              </div>

            </div>

            {/* Modal Actions */}
            <div className="px-6 py-4 bg-slate-50 dark:bg-slate-900/60 border-t border-slate-200 dark:border-slate-700 flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={() => setShowModal(false)}
                className="px-4 py-2 text-sm font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-xl transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleGenerateReport}
                className="flex items-center gap-2 bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-700 hover:to-indigo-700 text-white font-bold px-5 py-2 rounded-xl text-sm shadow-md transition-all cursor-pointer"
              >
                <FileText size={15} /> Generate Official PDF
              </button>
            </div>

          </div>
        </div>
      )}
    </>
  );
}
