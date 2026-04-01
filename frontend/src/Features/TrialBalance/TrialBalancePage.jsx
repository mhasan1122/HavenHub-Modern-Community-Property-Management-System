// Force refresh for UI synchronization
import React, { useState, useEffect, useCallback, useMemo, Fragment } from "react";
import { useNavigate } from "react-router-dom";
import {
  FaSearch,
  FaPrint,
  FaChartBar,
  FaCoins,
  FaBalanceScale,
  FaCog,
  FaChevronDown,
  FaChevronUp,
  FaDownload,
  FaFileInvoiceDollar
} from "react-icons/fa";
import PageContainer from "../../Components/Ui/PageContainer";
import MessageBox from "../../Components/MessageBox/MessageBox";
import FilterButton from "../../Components/FormComponent/ButtonComponent/FilterButton";
import MonthYearPicker from "../ServiceFeeManagement/components/MonthYearPicker";
import ModernDatePicker from "../../Components/FormComponent/ModernDatePicker";
import axiosInstance from "../../utils/axiosInstance";
import html2pdf from "html2pdf.js";
import "./print-styles.css";

// --- MEMOIZED COMPONENTS FOR PERFORMANCE ---

const AccountRow = React.memo(({ account, formatCurrency }) => {
  const closingBalance = account.closingBalance || 0;
  return (
    <tr className="group hover:bg-slate-50/80 transition-all border-b border-slate-50">
      <td className="py-5 pl-10 border-b border-slate-100 sticky left-0 bg-white group-hover:bg-slate-50/80 transition-all z-10 min-w-[300px]">
        <div className="flex flex-col">
          <span className="text-slate-800 text-sm font-black leading-tight mb-1 group-hover:text-primary transition-colors">{account.accountName}</span>
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest flex items-center gap-2">
            {account.accountCode}
            <span className="w-1 h-1 rounded-full bg-slate-200"></span>
            {account.accountType}
          </span>
        </div>
      </td>
      <td className="py-3 px-6 border-b border-slate-100 text-center relative pr-12">
        <div className="flex justify-end items-center gap-2">
          <span className="text-slate-800 text-[13px] font-black w-full text-right">
            {formatCurrency(Math.abs(account.openingBalance))}
          </span>
          <span className="w-6 text-[11px] font-black opacity-50 uppercase text-left shrink-0 text-slate-500">
            {account.openingBalance >= 0 ? "Dr" : "Cr"}
          </span>
        </div>
      </td>
      <td className="py-3 px-6 border-b border-slate-100 text-center relative pr-12">
        <div className="flex justify-end items-center">
          <span className={`text-[13px] font-black w-full text-right ${account.movementDebit > 0 ? "text-emerald-700" : "text-slate-300"}`}>
            {account.movementDebit > 0 ? formatCurrency(account.movementDebit) : "-"}
          </span>
        </div>
      </td>
      <td className="py-3 px-6 border-b border-slate-100 text-center relative pr-12">
        <div className="flex justify-end items-center">
          <span className={`text-[13px] font-black w-full text-right ${account.movementCredit > 0 ? "text-rose-700" : "text-slate-300"}`}>
            {account.movementCredit > 0 ? formatCurrency(account.movementCredit) : "-"}
          </span>
        </div>
      </td>
      <td className="py-3 px-6 border-b border-slate-100 text-right pr-12">
        <div className="flex justify-end items-center gap-2">
          <span className="text-slate-900 text-[13px] font-black w-full text-right">
            {formatCurrency(Math.abs(closingBalance))}
          </span>
          <span className="w-6 text-[11px] font-black opacity-50 uppercase text-left shrink-0 text-slate-500">
            {closingBalance >= 0 ? "Dr" : "Cr"}
          </span>
        </div>
      </td>
    </tr>
  );
});

// --- MAIN COMPONENT ---

// In-memory cache for report data
const reportCache = new Map();

const TrialBalancePage = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  const [isPdfExport, setIsPdfExport] = useState(false);

  // Filter states
  const [searchTerm, setSearchTerm] = useState("");

  // Date range states
  const [fromDate, setFromDate] = useState(`${new Date().getFullYear()}-01-01`);
  const [toDate, setToDate] = useState(new Date().toISOString().split('T')[0]);

  // Trial balance data
  const [sections, setSections] = useState([]);
  const [summary, setSummary] = useState(null);
  const [isConfigured, setIsConfigured] = useState(false);
  const [hasGenerated, setHasGenerated] = useState(false);

  const formatCurrency = useCallback((amount) => {
    return new Intl.NumberFormat("en-US", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(amount);
  }, []);

  const fetchTrialBalanceData = useCallback(async () => {
    const cacheKey = `${fromDate}_${toDate}`;

    // 1. Check Cache First
    if (reportCache.has(cacheKey)) {
      const cached = reportCache.get(cacheKey);
      setSections(cached.sections);
      setSummary(cached.summary);
      setIsConfigured(cached.isConfigured);
      setHasGenerated(true);
      return;
    }

    try {
      setLoading(true);
      setError(null);

      const response = await axiosInstance.get(
        `/api/accounts/trial-balance/?from_date=${fromDate}&to_date=${toDate}`
      );
      const data = response.data;

      if (data.success) {

        // --- Process Raw Backend Data in Frontend ---
        const rawAccounts = data.data || [];
        const sectionMap = new Map();

        let totalOpeningDebit = 0;
        let totalOpeningCredit = 0;
        let totalMovementDebit = 0;
        let totalMovementCredit = 0;
        let totalClosingDebit = 0;
        let totalClosingCredit = 0;

        rawAccounts.forEach(acc => {
          const openingDebit = Number(acc.op_dr || 0);
          const openingCredit = Number(acc.op_cr || 0);
          const movementDebit = Number(acc.mov_dr || 0);
          const movementCredit = Number(acc.mov_cr || 0);

          const netOpening = openingDebit - openingCredit;
          const netClosing = netOpening + movementDebit - movementCredit;

          acc.openingBalance = netOpening;
          acc.movementDebit = movementDebit;
          acc.movementCredit = movementCredit;
          acc.closingBalance = netClosing;

          if (netOpening > 0) totalOpeningDebit += netOpening; else totalOpeningCredit += Math.abs(netOpening);
          totalMovementDebit += movementDebit;
          totalMovementCredit += movementCredit;
          if (netClosing > 0) totalClosingDebit += netClosing; else totalClosingCredit += Math.abs(netClosing);

          const sectionName = acc.section_name || acc.accountType.toUpperCase();
          const sectionOrder = (acc.section_order !== null && acc.section_order !== undefined) ? acc.section_order : 9999;

          if (!sectionMap.has(sectionName)) {
            sectionMap.set(sectionName, {
              sectionName: sectionName,
              order: sectionOrder,
              accounts: []
            });
          }
          sectionMap.get(sectionName).accounts.push(acc);
        });

        const sortedSections = Array.from(sectionMap.values()).sort((a, b) => {
          const isAUnassigned = a.sectionName?.toUpperCase() === "UNASSIGNED ACCOUNTS";
          const isBUnassigned = b.sectionName?.toUpperCase() === "UNASSIGNED ACCOUNTS";
          if (isAUnassigned && !isBUnassigned) return 1;
          if (!isAUnassigned && isBUnassigned) return -1;
          return (a.order || 0) - (b.order || 0);
        });

        const dynamicSummary = {
          period: data.summary?.period || '',
          totalAccounts: rawAccounts.length,
          totalOpeningBalance: totalOpeningDebit > totalOpeningCredit ? totalOpeningDebit - totalOpeningCredit : totalOpeningCredit - totalOpeningDebit,
          totalPeriodDebit: totalMovementDebit,
          totalPeriodCredit: totalMovementCredit,
          totalClosingBalance: totalClosingDebit > totalClosingCredit ? totalClosingDebit - totalClosingCredit : totalClosingCredit - totalClosingDebit,
        };

        // 2. Store in Cache
        reportCache.set(cacheKey, {
          sections: sortedSections,
          summary: dynamicSummary,
          isConfigured: data.isConfigured
        });

        setSections(sortedSections);
        setSummary(dynamicSummary);
        setIsConfigured(data.isConfigured);
        setHasGenerated(true);
      } else {
        throw new Error(data.message || "Failed to fetch trial balance data");
      }
    } catch (err) {
      console.error("Error fetching trial balance:", err);
      setError(err.response?.data?.message || "Failed to fetch trial balance data");
    } finally {
      setLoading(false);
    }
  }, [fromDate, toDate]);

  // ---- MEMOIZED DATA (must be above callbacks that reference them) ----

  const displaySections = useMemo(() => {
    return sections.map(section => {
      const filteredAccounts = section.accounts.filter(acc =>
        String(acc.accountName).toLowerCase().includes(searchTerm.toLowerCase()) ||
        String(acc.accountCode).toLowerCase().includes(searchTerm.toLowerCase())
      );
      const filteredOpeningBalance = filteredAccounts.reduce((sum, acc) => sum + (Number(acc.openingBalance) || 0), 0);
      const filteredPeriodDebit = filteredAccounts.reduce((sum, acc) => sum + (Number(acc.movementDebit) || 0), 0);
      const filteredPeriodCredit = filteredAccounts.reduce((sum, acc) => sum + (Number(acc.movementCredit) || 0), 0);
      const filteredClosingBalance = filteredAccounts.reduce((sum, acc) => sum + (Number(acc.closingBalance) || 0), 0);
      return { ...section, filteredAccounts, filteredOpeningBalance, filteredPeriodDebit, filteredPeriodCredit, filteredClosingBalance };
    }).filter(sec => sec.filteredAccounts.length > 0);
  }, [sections, searchTerm]);

  const displaySummary = useMemo(() => {
    if (!summary) return null;
    const s = {
      ...summary,
      totalAccounts: displaySections.reduce((n, sec) => n + sec.filteredAccounts.length, 0),
      totalOpeningBalance: displaySections.reduce((n, sec) => n + sec.filteredOpeningBalance, 0),
      totalPeriodDebit: displaySections.reduce((n, sec) => n + sec.filteredPeriodDebit, 0),
      totalPeriodCredit: displaySections.reduce((n, sec) => n + sec.filteredPeriodCredit, 0),
      totalClosingBalance: displaySections.reduce((n, sec) => n + sec.filteredClosingBalance, 0),
    };
    s.isBalanced = Math.abs(s.totalPeriodDebit - s.totalPeriodCredit) < 0.01;
    return s;
  }, [summary, displaySections]);

  // ---- HANDLERS ----

  const handlePrint = useCallback(() => {
    if (!hasGenerated) { setError("Please generate the report first."); return; }
    setTimeout(() => window.print(), 100);
  }, [hasGenerated]);

  const handleSavePDF = useCallback(() => {
    if (!hasGenerated || !displaySummary) { setError("Please generate the report first."); return; }

    const dt = new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'long', year: 'numeric' });
    const fc = formatCurrency;
    const dcr = v => v >= 0 ? 'Dr' : 'Cr';
    const dateRange = `${new Date(fromDate).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })} – ${new Date(toDate).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}`.toUpperCase();

    // Summary cards — 2-column grid matching print layout (grid-cols-2)
    const icons = {
      accounts: `<svg viewBox="0 0 448 512" style="width:24px;height:24px;fill:currentColor;"><path d="M160 80c0-26.5 21.5-48 48-48h32c26.5 0 48 21.5 48 48V432c0 26.5-21.5 48-48 48H208c-26.5 0-48-21.5-48-48V80zM0 272c0-26.5 21.5-48 48-48H80c26.5 0 48 21.5 48 48V432c0 26.5-21.5 48-48 48H48c-26.5 0-48-21.5-48-48V272zM368 176c0-26.5 21.5-48 48-48V432c0 26.5-21.5 48-48 48H416c-26.5 0-48-21.5-48-48V176z"/></svg>`,
      coins: `<svg viewBox="0 0 512 512" style="width:24px;height:24px;fill:currentColor;"><path d="M512 80c0 18-14.3 34.6-38.4 48c-24.5 13.6-58.4 24-97.6 24s-73.1-10.4-97.6-24c-24.1-13.4-38.4-30-38.4-48s14.3-34.6 38.4-48C303.7 10.4 337.6 0 376.8 0s73.1 10.4 97.6 24c24.1 13.4 38.4 30 38.4 48zM376.8 192c-39.2 0-73.1-10.4-97.6-24C255 154.5 240.6 137.9 240 120v14.4c.1 17.5 13.1 33.3 35.1 46c24.4 14.1 59.9 25.1 101.7 25.1s77.3-11.1 101.7-25.1c22-12.7 35-28.5 35.1-46V120c-.6 17.9-15 34.5-39.2 48c-24.5 13.6-58.4 24-97.6 24z"/></svg>`,
      balance: `<svg viewBox="0 0 576 512" style="width:24px;height:24px;fill:currentColor;"><path d="M288 128a128 128 0 1 1 0 256 128 128 0 1 1 0-256zm0 192a64 64 0 1 0 0-128 64 64 0 1 0 0 128z"/></svg>`
    };

    const cardDefs = [
      { label: 'Accounts', val: String(displaySummary.totalAccounts), bg: '#f0fdfa', color: '#0d9488', icon: icons.accounts },
      { label: 'Net Opening', val: `${fc(Math.abs(displaySummary.totalOpeningBalance))} ${dcr(displaySummary.totalOpeningBalance)}`, bg: '#f1f5f9', color: '#475569', icon: icons.coins },
      { label: 'Period Dr', val: fc(displaySummary.totalPeriodDebit), bg: '#ecfdf5', color: '#059669', icon: icons.coins },
      { label: 'Period Cr', val: fc(displaySummary.totalPeriodCredit), bg: '#fff1f2', color: '#e11d48', icon: icons.coins },
      { label: 'Net Closing', val: `${fc(Math.abs(displaySummary.totalClosingBalance))} ${dcr(displaySummary.totalClosingBalance)}`, bg: displaySummary.isBalanced ? '#ecfdf5' : '#fff1f2', color: displaySummary.isBalanced ? '#059669' : '#e11d48', icon: icons.balance },
    ];

    const cardCell = (c) => `
      <div style="background:#fff;border:1px solid #f1f5f9;border-radius:12px;padding:16px 18px;display:flex;align-items:center;gap:16px;box-shadow:0 1px 2px 0 rgba(0,0,0,0.05);">
        <div style="width:48px;height:48px;border-radius:12px;background:${c.bg};color:${c.color};display:flex;align-items:center;justify-content:center;flex-shrink:0;">
          ${c.icon}
        </div>
        <div style="min-width:0;">
          <p style="margin:0 0 4px;font-size:9px;font-weight:700;color:#94a3b8;text-transform:uppercase;letter-spacing:0.1em;">${c.label}</p>
          <p style="margin:0;font-size:13px;font-weight:900;color:#334155;">${c.val}</p>
        </div>
      </div>`;

    const cardsHtml = `
      <table style="width:100%;border-collapse:collapse;">
        <tr>
          <td style="width:50%;padding:0 8px 12px 0;">${cardCell(cardDefs[0])}</td>
          <td style="width:50%;padding:0 0 12px 8px;">${cardCell(cardDefs[1])}</td>
        </tr>
        <tr>
          <td style="padding:0 8px 12px 0;">${cardCell(cardDefs[2])}</td>
          <td style="padding:0 0 12px 8px;">${cardCell(cardDefs[3])}</td>
        </tr>
        <tr>
          <td style="padding:0 8px 0 0;">${cardCell(cardDefs[4])}</td>
          <td style="padding:0 0 0 8px;"></td>
        </tr>
      </table>`;


    // Account rows — exact inline-style mirror of AccountRow JSX + section header + total row
    const bodyHtml = displaySections.map(sec => {
      const acctRows = sec.filteredAccounts.map(acc => {
        const cb = acc.closingBalance || 0;
        return `
        <tr style="border-bottom:1px solid #f1f5f9;page-break-inside:avoid;break-inside:avoid;">
          <td style="padding:8px 6px 8px 10px;vertical-align:middle;">
            <span style="display:block;font-size:9.5px;font-weight:800;color:#1e293b;line-height:1.2;">${acc.accountName}</span>
            <span style="display:block;font-size:7px;font-weight:700;color:#94a3b8;text-transform:uppercase;letter-spacing:0.04em;margin-top:1px;">${acc.accountCode} &bull; ${acc.accountType}</span>
          </td>
          <td style="padding:6px 20px 6px 6px;text-align:right;vertical-align:middle;white-space:nowrap;">
            <span style="font-size:9.5px;font-weight:700;color:#1e293b;">${fc(Math.abs(acc.openingBalance))}</span>
            <span style="font-size:7px;font-weight:800;opacity:0.5;color:#64748b;text-transform:uppercase;margin-left:2px;">${dcr(acc.openingBalance)}</span>
          </td>
          <td style="padding:6px 20px 6px 6px;text-align:right;vertical-align:middle;white-space:nowrap;font-size:9.5px;font-weight:700;color:${acc.movementDebit > 0 ? '#059669' : '#cbd5e1'};">
            ${acc.movementDebit > 0 ? fc(acc.movementDebit) : '&ndash;'}
          </td>
          <td style="padding:6px 20px 6px 6px;text-align:right;vertical-align:middle;white-space:nowrap;font-size:9.5px;font-weight:700;color:${acc.movementCredit > 0 ? '#e11d48' : '#cbd5e1'};">
            ${acc.movementCredit > 0 ? fc(acc.movementCredit) : '&ndash;'}
          </td>
          <td style="padding:6px 10px 6px 6px;text-align:right;vertical-align:middle;white-space:nowrap;">
            <span style="font-size:9.5px;font-weight:700;color:#0f172a;">${fc(Math.abs(cb))}</span>
            <span style="font-size:7px;font-weight:800;opacity:0.5;color:#64748b;text-transform:uppercase;margin-left:2px;">${dcr(cb)}</span>
          </td>
        </tr>`;
      }).join('');

      const totalRow = `
        <tr style="background:#f8fafc;border-top:1px solid #e2e8f0;page-break-inside:avoid;break-inside:avoid;">
          <td style="padding:10px 6px 10px 10px;font-size:9.5px;font-weight:900;color:#334155;text-transform:capitalize;">Total ${sec.sectionName}</td>
          <td style="padding:10px 20px 10px 6px;text-align:right;white-space:nowrap;">
            <span style="font-size:9.5px;font-weight:800;color:#1e293b;">${fc(Math.abs(sec.filteredOpeningBalance))}</span>
            <span style="font-size:7px;font-weight:800;opacity:0.5;color:#64748b;text-transform:uppercase;margin-left:2px;">${dcr(sec.filteredOpeningBalance)}</span>
          </td>
          <td style="padding:10px 20px 10px 6px;text-align:right;white-space:nowrap;font-size:9.5px;font-weight:800;color:#059669;">${fc(sec.filteredPeriodDebit)}</td>
          <td style="padding:10px 20px 10px 6px;text-align:right;white-space:nowrap;font-size:9.5px;font-weight:800;color:#e11d48;">${fc(sec.filteredPeriodCredit)}</td>
          <td style="padding:10px 10px 10px 6px;text-align:right;white-space:nowrap;">
            <span style="font-size:9.5px;font-weight:800;color:#0f172a;">${fc(Math.abs(sec.filteredClosingBalance))}</span>
            <span style="font-size:7px;font-weight:800;opacity:0.5;color:#64748b;text-transform:uppercase;margin-left:2px;">${dcr(sec.filteredClosingBalance)}</span>
          </td>
        </tr>`;

      return `
        <tr style="background:rgba(241,245,249,0.3);page-break-inside:avoid;break-inside:avoid;">
          <td colspan="5" style="padding:12px 0 4px 10px;">
            <span style="display:inline-block;width:2.5px;height:10px;background:#0d9488;border-radius:99px;vertical-align:middle;margin-right:5px;"></span>
            <span style="font-size:9.5px;font-weight:900;color:#0d9488;text-transform:capitalize;vertical-align:middle;">${sec.sectionName}</span>
          </td>
        </tr>
        ${acctRows}
        ${totalRow}`;
    }).join('');

    const html = `
      <div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;background:#fff;width:100%;padding-bottom:20px;">
        <div style="padding:15px 12px 10px;border-bottom:1.5px solid #0f172a;display:flex;justify-content:space-between;align-items:flex-start;">
          <div>
            <h1 style="margin:0;font-size:18px;font-weight:900;color:#0f172a;text-transform:uppercase;letter-spacing:-0.4px;">Estate-Link Solution</h1>
            <p style="margin:2px 0 0;font-size:7.5px;font-weight:700;color:#0d9488;text-transform:uppercase;letter-spacing:0.2em;">Trial Balance Report</p>
          </div>
          <div style="display:flex;flex-direction:column;align-items:flex-end;text-align:right;">
            <span style="background:#0f172a;color:#fff;padding:3px 12px;font-size:8.5px;font-weight:900;text-transform:uppercase;letter-spacing:0.1em;border-radius:0;margin-bottom:6px;white-space:nowrap;">Financial Statement</span>
            <p style="margin:0;font-size:8.5px;font-weight:900;color:#1e293b;text-transform:uppercase;letter-spacing:0.04em;white-space:nowrap;">Period: ${dateRange}</p>
          </div>
        </div>
        <div style="padding:10px 12px 6px;background:rgba(241,245,249,0.4);border-bottom:1px solid #e2e8f0;page-break-inside:avoid;break-inside:avoid;">
          ${cardsHtml}
        </div>

        <div style="padding:10px 12px;">
          <div style="border:1px solid #e2e8f0;border-radius:8px;">
            <table style="width:100%;border-collapse:collapse;table-layout:fixed;">
              <colgroup><col style="width:34%;"><col style="width:16.5%;"><col style="width:16.5%;"><col style="width:16.5%;"><col style="width:16.5%;"></colgroup>
              <thead style="display:table-header-group;">
                <tr style="background:#f8fafc;page-break-inside:avoid;break-inside:avoid;">
                  <th style="padding:10px 6px 10px 10px;text-align:left;font-size:8px;font-weight:900;color:#0f172a;text-transform:uppercase;letter-spacing:0.04em;border-bottom:1px solid #e2e8f0;">Account Selection</th>
                  <th style="padding:10px 20px 10px 6px;text-align:right;font-size:8px;font-weight:900;color:#0f172a;text-transform:uppercase;letter-spacing:0.04em;border-bottom:1px solid #e2e8f0;">Opening</th>
                  <th style="padding:10px 20px 10px 6px;text-align:right;font-size:8px;font-weight:900;color:#0f172a;text-transform:uppercase;letter-spacing:0.04em;border-bottom:1px solid #e2e8f0;">Debit</th>
                  <th style="padding:10px 20px 10px 6px;text-align:right;font-size:8px;font-weight:900;color:#0f172a;text-transform:uppercase;letter-spacing:0.04em;border-bottom:1px solid #e2e8f0;">Credit</th>
                  <th style="padding:10px 10px 10px 6px;text-align:right;font-size:8px;font-weight:900;color:#0f172a;text-transform:uppercase;letter-spacing:0.04em;border-bottom:1px solid #e2e8f0;">Closing</th>
                </tr>
              </thead>
              <tbody>${bodyHtml}</tbody>
            </table>
          </div>
        </div>
      </div>`;


    html2pdf()
      .set({
        margin: [4, 2, 4, 2],




        filename: `Trial_Balance_Report_${new Date().toISOString().split('T')[0]}.pdf`,
        image: { type: 'jpeg', quality: 0.98 },
        html2canvas: { scale: 2, useCORS: true, logging: false },
        jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait', compress: true },
        pagebreak: { mode: ['css', 'legacy'] }
      })
      .from(html, 'string')
      .save()
      .catch(err => { console.error('PDF error:', err); setError('Failed to generate PDF.'); });
  }, [hasGenerated, displaySections, displaySummary, formatCurrency, fromDate, toDate]);

  return (
    <PageContainer className="pt-0 pb-0">
      {error && <MessageBox error={error} clearMessage={() => setError(null)} onOk={() => setError(null)} />}
      {success && <MessageBox message={success} clearMessage={() => setSuccess(null)} onOk={() => setSuccess(null)} />}

      <div className="px-2 pb-4 print:p-0">
        <div className="w-full mx-auto">
          <div id="pdf-report-container" className="bg-white rounded-lg border border-gray-200 shadow print-container print:overflow-visible print:border-none print:shadow-none">


            {/* Header */}
            <div className={`p-3 md:p-6 border-b border-gray-200 flex items-center justify-between ${isPdfExport ? 'hidden' : 'print:hidden'}`}>
              <div>
                <h1 className="text-2xl font-black text-slate-800 tracking-tight">Trial Balance</h1>
                <p className="text-[13px] font-bold text-slate-500 mt-1 capitalize tracking-tight">Financial statement showing all account balances</p>
              </div>
              <div className="flex gap-3">
                {hasGenerated && (
                  <Fragment>
                    <button onClick={handleSavePDF} className="flex items-center gap-2 px-5 py-2.5 bg-primary text-white rounded-xl hover:bg-primary/90 transition-all font-bold text-sm shadow-sm active:scale-95">
                      <FaDownload className="text-white/80" /> Download PDF
                    </button>
                    <button onClick={handlePrint} className="flex items-center gap-2 px-5 py-2.5 bg-primary text-white rounded-xl hover:bg-primary/90 transition-all font-bold text-sm shadow-sm active:scale-95">
                      <FaPrint className="text-white/80" /> Print
                    </button>
                  </Fragment>
                )}
              </div>
            </div>

            {/* Professional Print Header */}
            <div className={`p-8 border-b-2 border-slate-900 mb-6 report-header ${isPdfExport ? 'block' : 'hidden print:block'}`}>
              <div className="flex justify-between items-start">
                <div>
                  <h1 className="text-3xl font-black text-slate-900 uppercase tracking-tight">Estate-Link Solution</h1>
                  <p className="text-sm font-bold text-primary uppercase tracking-[0.3em] mt-1">Trial Balance Report</p>
                </div>
                <div className="text-right flex flex-col items-end">
                  <div className="bg-slate-900 text-white px-4 py-1.5 text-[11px] font-black uppercase tracking-widest rounded-none mb-2" style={{ backgroundColor: '#0f172a', color: '#fff', WebkitPrintColorAdjust: 'exact', printColorAdjust: 'exact' }}>Financial Statement</div>
                  <p className="text-[11px] font-black text-slate-700 uppercase tracking-wider">
                    Period: {new Date(fromDate).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }).toUpperCase()} &ndash; {new Date(toDate).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }).toUpperCase()}
                  </p>
                </div>
              </div>
            </div>

            {/* Filters */}
            <div className={`p-8 pb-6 border-b border-slate-50 bg-white ${isPdfExport ? 'hidden' : 'print:hidden'}`}>
              <div className="grid grid-cols-1 md:grid-cols-4 lg:grid-cols-5 gap-6 items-end">
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-bold text-slate-600 ml-1 capitalize">From Date</label>
                  <ModernDatePicker value={fromDate} onChange={setFromDate} inputClassName="!rounded-xl border-slate-200 bg-white !h-[45px] transition-all text-sm font-semibold" showIcon={true} />
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-bold text-slate-600 ml-1 capitalize">To Date</label>
                  <ModernDatePicker value={toDate} onChange={setToDate} inputClassName="!rounded-xl border-slate-200 bg-white !h-[45px] transition-all text-sm font-semibold" showIcon={true} />
                </div>
                <div className="flex flex-col gap-1.5 lg:col-span-2">
                  <label className="text-xs font-bold text-slate-600 ml-1 capitalize">Search Account</label>
                  <div className="relative group">
                    <FaSearch className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-primary transition-colors" />
                    <input type="text" placeholder="Code or name..." className="w-full pl-11 pr-4 py-2.5 bg-white border border-slate-200 rounded-xl outline-none transition-all text-sm font-medium" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
                  </div>
                </div>
                <div className="pt-2">
                  <button onClick={fetchTrialBalanceData} disabled={loading} className="w-full py-3 bg-primary text-white rounded-xl font-bold hover:shadow-lg disabled:opacity-50 flex items-center justify-center gap-2 active:scale-95 transition-all">
                    {loading ? <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : "Generate Report"}
                  </button>
                </div>
              </div>
            </div>

            {/* Summary */}
            {hasGenerated && displaySummary && (
              <div className="p-8 pb-4 border-b border-slate-50 bg-slate-50/30">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
                  {[
                    { label: "Accounts", value: displaySummary.totalAccounts, icon: <FaChartBar />, classes: "bg-teal-50 text-teal-600" },
                    { label: "Net Opening", value: `${formatCurrency(Math.abs(displaySummary.totalOpeningBalance))} ${displaySummary.totalOpeningBalance >= 0 ? 'Dr' : 'Cr'}`, icon: <FaCoins />, classes: "bg-slate-100 text-slate-600" },
                    { label: "Period Dr", value: formatCurrency(displaySummary.totalPeriodDebit), icon: <FaCoins />, classes: "bg-emerald-50 text-emerald-600" },
                    { label: "Period Cr", value: formatCurrency(displaySummary.totalPeriodCredit), icon: <FaCoins />, classes: "bg-rose-50 text-rose-600" },
                    { label: "Net Closing", value: `${formatCurrency(Math.abs(displaySummary.totalClosingBalance))} ${displaySummary.totalClosingBalance >= 0 ? 'Dr' : 'Cr'}`, icon: <FaBalanceScale />, classes: displaySummary.isBalanced ? "bg-emerald-50 text-emerald-600" : "bg-rose-50 text-rose-600" },
                  ].map((item, i) => (
                    <div key={i} className="bg-white p-4 rounded-xl border border-slate-100 flex items-center gap-4 shadow-sm transition-all hover:shadow-md">
                      <div className={`w-10 h-10 rounded-lg flex items-center justify-center shrink-0 ${item.classes}`}>{item.icon}</div>
                      <div className="min-w-0 overflow-hidden">
                        <p className="text-[10px] font-bold text-slate-400 tracking-widest uppercase mb-1">{item.label}</p>
                        <p className="text-sm font-black text-slate-700 truncate">{item.value}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Table */}
            <div className="p-8">
              {hasGenerated ? (
                <div className="overflow-x-auto bg-white rounded-2xl border border-slate-100 custom-scrollbar relative">
                  <table className="w-full min-w-[1200px] text-left border-separate border-spacing-0">
                    <thead className="sticky top-0 z-30 print:static print:table-header-group">
                      <tr className="text-slate-900 text-[11px] font-black bg-slate-100 uppercase tracking-widest print:bg-slate-100">
                        <th className="py-5 pl-10 border-b border-slate-200 sticky left-0 top-0 bg-slate-100 z-40 print:static print:bg-slate-100">Account Selection</th>
                        <th className="py-5 px-6 border-b border-slate-200 text-right pr-12 sticky top-0 bg-slate-100 print:static print:bg-slate-100">Opening</th>
                        <th className="py-5 px-6 border-b border-slate-200 text-right pr-12 sticky top-0 bg-slate-100 print:static print:bg-slate-100">Debit</th>
                        <th className="py-5 px-6 border-b border-slate-200 text-right pr-12 sticky top-0 bg-slate-100 print:static print:bg-slate-100">Credit</th>
                        <th className="py-5 px-6 border-b border-slate-200 text-right pr-12 sticky top-0 bg-slate-100 print:static print:bg-slate-100">Closing</th>
                      </tr>
                    </thead>
                    <tbody>
                      {displaySections.length === 0 ? (
                        <tr><td colSpan="5" className="py-32 text-center text-slate-400 font-medium">No results found</td></tr>
                      ) : (
                        displaySections.map((section, sIdx) => (
                          <Fragment key={sIdx}>
                            <tr className="bg-slate-50/30">
                              <td colSpan="5" className="py-6 pl-10 border-b border-slate-100">
                                <h3 className="text-[13px] font-black capitalize text-primary flex items-center gap-2">
                                  <span className="w-1.5 h-4 bg-primary rounded-full"></span>
                                  {section.sectionName}
                                </h3>
                              </td>
                            </tr>
                            {section.filteredAccounts.map((account, aIdx) => (
                              <AccountRow key={aIdx} account={account} formatCurrency={formatCurrency} />
                            ))}
                            <tr className="bg-slate-50/60 border-t border-slate-100">
                              <td className="py-5 pl-10 text-[13px] font-black capitalize text-slate-700">Total {section.sectionName}</td>
                              <td className="py-5 px-6 text-center text-[13px] font-black relative pr-12">
                                <div className="flex justify-end items-center gap-2 text-slate-800">
                                  <span className="w-full text-right">{formatCurrency(Math.abs(section.filteredOpeningBalance))}</span>
                                  <span className="w-6 text-[11px] font-black opacity-50 uppercase text-left shrink-0">{section.filteredOpeningBalance >= 0 ? "Dr" : "Cr"}</span>
                                </div>
                              </td>
                              <td className="py-5 px-6 text-[13px] font-black text-emerald-700 text-center relative pr-12">
                                <div className="flex justify-end items-center">
                                  <span className="w-full text-right">{formatCurrency(section.filteredPeriodDebit)}</span>
                                </div>
                              </td>
                              <td className="py-5 px-6 text-[13px] font-black text-rose-700 text-center relative pr-12">
                                <div className="flex justify-end items-center">
                                  <span className="w-full text-right">{formatCurrency(section.filteredPeriodCredit)}</span>
                                </div>
                              </td>
                              <td className="py-5 px-6 text-right text-[13px] font-black relative pr-12">
                                <div className="flex justify-end items-center gap-2 text-slate-900">
                                  <span className="w-full text-right">{formatCurrency(Math.abs(section.filteredClosingBalance))}</span>
                                  <span className="w-6 text-[11px] font-black opacity-50 uppercase text-left shrink-0">{section.filteredClosingBalance >= 0 ? "Dr" : "Cr"}</span>
                                </div>
                              </td>
                            </tr>
                          </Fragment>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              ) : (
                !isConfigured && hasGenerated ? (
                  <div className="py-32 flex flex-col items-center justify-center text-center px-4">
                    <div className="w-20 h-20 rounded-full bg-orange-50 flex items-center justify-center text-orange-500 mb-6 animate-pulse"><FaCog size={40} /></div>
                    <h3 className="text-xl font-black text-slate-800 mb-2">Report Not Configured</h3>
                    <p className="text-slate-500 text-sm max-w-sm">No sections have been defined for the Trial Balance. Please go to <span className="text-primary font-bold">Report Configuration</span> to set up your report structure.</p>
                  </div>
                ) : (
                  <div className="py-32 flex flex-col items-center justify-center text-center px-4">
                    <div className="w-20 h-20 rounded-full bg-slate-50 flex items-center justify-center text-primary mb-6 animate-pulse"><FaChartBar size={40} /></div>
                    <h3 className="text-xl font-black text-slate-800 mb-2">Report Ready to Generate</h3>
                    <p className="text-slate-500 text-sm max-w-sm">Please select your date range and click <span className="text-primary font-bold">Generate Report</span> to view.</p>
                  </div>
                )
              )}
            </div>
          </div>
        </div>
      </div>
      <style>{`
        @media print {
          .print\\:hidden { display: none !important; }
          .overflow-x-auto { overflow: visible !important; }
          @page { size: A4; margin: 10mm; }
        }
      `}</style>
    </PageContainer>
  );
};

export default React.memo(TrialBalancePage);
