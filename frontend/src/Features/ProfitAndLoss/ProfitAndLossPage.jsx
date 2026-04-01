import React, { useState, useEffect, useCallback, useMemo, Fragment } from "react";
import { useNavigate } from "react-router-dom";
import {
    FaSearch,
    FaDownload,
    FaPrint,
    FaBalanceScale,
    FaChartBar,
    FaCalculator,
    FaChartLine
} from "react-icons/fa";
import PageContainer from "../../Components/Ui/PageContainer";
import MessageBox from "../../Components/MessageBox/MessageBox";
import axiosInstance from "../../utils/axiosInstance";
import ModernDatePicker from "../../Components/FormComponent/ModernDatePicker";
import html2pdf from "html2pdf.js";

// --- MEMOIZED ACCOUNT ROW ---
const PLAccountRow = React.memo(({ acc, formatCurrency }) => (
    <tr className="group hover:bg-slate-50/80 transition-all cursor-default">
        <td className="py-3 pl-10 border-b border-slate-50">
            <div className="flex flex-col pl-4">
                <span className="text-sm font-bold text-slate-700 group-hover:text-slate-900 leading-tight">{acc.accountName}</span>
                <span className="text-[10px] text-slate-500 font-extrabold uppercase mt-0.5 tracking-tight">{acc.accountCode} • {acc.accountTypeDisplay}</span>
            </div>
        </td>
        <td className="py-3 text-right border-b border-slate-50 text-sm font-extrabold text-slate-700">{formatCurrency(Math.abs(acc.netBalance))}</td>
        <td className="py-3 pr-10 border-b border-slate-50 text-right"></td>
    </tr>
));

// Cache for manual report generation
const plCache = new Map();

const ProfitAndLossPage = () => {
    const navigate = useNavigate();
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    const [hasGenerated, setHasGenerated] = useState(false);
    const [fromDate, setFromDate] = useState(new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0]);
    const [toDate, setToDate] = useState(new Date().toISOString().split('T')[0]);
    const [searchTerm, setSearchTerm] = useState("");
    const [sections, setSections] = useState([]);
    const [summary, setSummary] = useState(null);
    const [isConfigured, setIsConfigured] = useState(true);

    const formatCurrency = useCallback((amount) => {
        return new Intl.NumberFormat('en-BD', {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2
        }).format(amount || 0);
    }, []);

    const fetchPLData = useCallback(async () => {
        const cacheKey = `${fromDate}_${toDate}`;

        if (plCache.has(cacheKey)) {
            const cached = plCache.get(cacheKey);
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
                `/api/accounts/profit-loss/?from_date=${fromDate}&to_date=${toDate}`
            );
            const data = response.data;

            if (data.success) {
                plCache.set(cacheKey, {
                    sections: data.data || [],
                    summary: data.summary || null,
                    isConfigured: data.isConfigured
                });

                setSections(data.data || []);
                setSummary(data.summary || null);
                setIsConfigured(data.isConfigured);
                setHasGenerated(true);
            } else {
                throw new Error(data.message || "Failed to fetch profit & loss data");
            }
        } catch (err) {
            console.error("Error fetching P&L:", err);
            setError(err.response?.data?.message || "Failed to fetch profit & loss data");
        } finally {
            setLoading(false);
        }
    }, [fromDate, toDate]);

    const handlePrint = useCallback(() => {
        setTimeout(() => window.print(), 100);
    }, []);

    const displaySections = useMemo(() => {
        return sections.map(section => ({
            ...section,
            filteredAccounts: (section.accounts || []).filter(acc =>
                acc.accountName.toLowerCase().includes(searchTerm.toLowerCase()) ||
                acc.accountCode.toLowerCase().includes(searchTerm.toLowerCase())
            )
        })).filter(section => section.filteredAccounts.length > 0);
    }, [sections, searchTerm]);

    const handleSavePDF = useCallback(() => {
        if (!hasGenerated || !summary) return;

        const dt = new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'long', year: 'numeric' });
        const fc = (amt) => formatCurrency(amt);
        const dateRange = `${new Date(fromDate).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })} – ${new Date(toDate).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}`.toUpperCase();

        const bodyHtml = displaySections.map(sec => {
            const acctRows = sec.filteredAccounts.map(acc => `
                <tr style="border-bottom:1px solid #f1f5f9;page-break-inside:avoid;">
                    <td style="padding:8px 8px 8px 12px;vertical-align:middle;">
                        <span style="display:block;font-size:9.5px;font-weight:800;color:#1e293b;line-height:1.2;">${acc.accountName}</span>
                        <span style="display:block;font-size:7px;font-weight:700;color:#94a3b8;text-transform:uppercase;letter-spacing:0.04em;margin-top:1px;">${acc.accountCode} &bull; ${acc.accountTypeDisplay}</span>
                    </td>
                    <td style="padding:8px 30px 8px 8px;text-align:right;vertical-align:middle;white-space:nowrap;font-size:9.5px;font-weight:700;color:#1e293b;">
                        ${fc(Math.abs(acc.balance))}
                    </td>
                    <td style="padding:8px 12px 8px 8px;text-align:right;vertical-align:middle;width:80px;"></td>
                </tr>`).join('');

            return `
                <tr style="background:rgba(241,245,249,0.3);page-break-inside:avoid;">
                    <td colspan="2" style="padding:12px 0 4px 12px;">
                        <span style="display:inline-block;width:2.5px;height:10px;background:#0d9488;border-radius:99px;vertical-align:middle;margin-right:6px;"></span>
                        <span style="font-size:9.5px;font-weight:900;color:#0d9488;text-transform:capitalize;vertical-align:middle;">${sec.sectionName}</span>
                    </td>
                    <td style="padding:12px 12px 4px 0;"></td>
                </tr>
                ${acctRows}
                <tr style="background:#f8fafc;border-top:1.2px solid #e2e8f0;page-break-inside:avoid;">
                    <td colspan="2" style="padding:10px 8px 10px 12px;font-size:9.5px;font-weight:900;color:#334155;">Total ${sec.sectionName}</td>
                    <td style="padding:10px 12px 10px 8px;text-align:right;white-space:nowrap;font-size:9.5px;font-weight:900;color:#0f172a;">${fc(sec.total)}</td>
                </tr>`;
        }).join('');

        const html = `
            <div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;background:#fff;width:100%;padding-bottom:20px;">
                <div style="padding:15px 12px 10px;border-bottom:1.5px solid #0f172a;display:flex;justify-content:space-between;align-items:flex-start;">
                    <div>
                        <h1 style="margin:0;font-size:18px;font-weight:900;color:#0f172a;text-transform:uppercase;letter-spacing:-0.4px;">Estate-Link Solution</h1>
                        <p style="margin:2px 0 0;font-size:7.5px;font-weight:700;color:#0d9488;text-transform:uppercase;letter-spacing:0.2em;">Profit & Loss Report</p>
                    </div>
                    <div style="display:flex;flex-direction:column;align-items:flex-end;text-align:right;">
                        <span style="background:#0f172a;color:#fff;padding:3px 12px;font-size:8.5px;font-weight:900;text-transform:uppercase;letter-spacing:0.1em;border-radius:0;margin-bottom:6px;white-space:nowrap;">Financial Statement</span>
                        <p style="margin:0;font-size:8.5px;font-weight:900;color:#1e293b;text-transform:uppercase;letter-spacing:0.04em;white-space:nowrap;">Period: ${dateRange}</p>
                    </div>
                </div>

                <div style="padding:10px 12px 6px;background:rgba(241,245,249,0.4);border-bottom:1px solid #e2e8f0;page-break-inside:avoid;">
                    <div style="display:flex;gap:10px;">
                        ${(() => {
                const icons = {
                    income: `<svg viewBox="0 0 512 512" style="width:24px;height:24px;fill:#0d9488;"><path d="M512 80c0 18-14.3 34.6-38.4 48c-24.5 13.6-58.4 24-97.6 24s-73.1-10.4-97.6-24c-24.1-13.4-38.4-30-38.4-48s14.3-34.6 38.4-48C303.7 10.4 337.6 0 376.8 0s73.1 10.4 97.6 24c24.1 13.4 38.4 30 38.4 48zM376.8 192c-39.2 0-73.1-10.4-97.6-24C255 154.5 240.6 137.9 240 120v14.4c.1 17.5 13.1 33.3 35.1 46c24.4 14.1 59.9 25.1 101.7 25.1s77.3-11.1 101.7-25.1c22-12.7 35-28.5 35.1-46V120c-.6 17.9-15 34.5-39.2 48c-24.5 13.6-58.4 24-97.6 24z"/></svg>`,
                    expense: `<svg viewBox="0 0 512 512" style="width:24px;height:24px;fill:#e11d48;"><path d="M474 192H40a24 24 0 0 0-24 24v264a24 24 0 0 0 24 24h434a24 24 0 0 0 24-24V216a24 24 0 0 0-24-24zM128 400a32 32 0 1 1 32-32 32 32 0 0 1-32 32zm0-112a32 32 0 1 1 32-32 32 32 0 0 1-32 32zm128 112a32 32 0 1 1 32-32 32 32 0 0 1-32 32zm0-112a32 32 0 1 1 32-32 32 32 0 0 1-32 32zm128 112a32 32 0 1 1 32-32 32 32 0 0 1-32 32zm0-112a32 32 0 1 1 32-32 32 32 0 0 1-32 32zM432 120H80V48a16 16 0 0 1 16-16h320a16 16 0 0 1 16 16z"/></svg>`,
                    net: `<svg viewBox="0 0 576 512" style="width:24px;height:24px;fill:${summary.netProfit >= 0 ? '#059669' : '#e11d48'};"><path d="M288 128a128 128 0 1 1 0 256 128 128 0 1 1 0-256zm0 192a64 64 0 1 0 0-128 64 64 0 1 0 0 128z"/></svg>`
                };

                const cardCell = (c) => `
                    <div style="background:#fff;border:1px solid #f1f5f9;border-radius:10px;padding:12px 14px;box-shadow:0 1px 2px 0 rgba(0,0,0,0.05);display:flex;align-items:center;gap:14px;page-break-inside:avoid;">
                        <div style="width:48px;height:48px;border-radius:10px;background:${c.bg};display:flex;align-items:center;justify-content:center;flex-shrink:0;">
                            ${c.icon}
                        </div>
                        <div style="min-width:0;">
                            <p style="margin:0 0 2px;font-size:8px;font-weight:700;color:#94a3b8;text-transform:uppercase;letter-spacing:0.1em;">${c.label}</p>
                            <p style="margin:0;font-size:12px;font-weight:900;color:#334155;">৳ ${c.val}</p>
                        </div>
                    </div>`;

                const cardDefs = [
                    { label: "Total Income", val: fc(summary.totalIncome), bg: '#ccfbf1', color: '#0d9488', icon: icons.income },
                    { label: "Total Expense", val: fc(summary.totalExpense), bg: '#ffe4e6', color: '#e11d48', icon: icons.expense },
                    { label: summary.netProfit >= 0 ? "Net Profit" : "Net Loss", val: fc(Math.abs(summary.netProfit)), bg: summary.netProfit >= 0 ? '#d1fae5' : '#ffe4e6', color: summary.netProfit >= 0 ? '#059669' : '#e11d48', icon: icons.net }
                ];

                return `
                <table style="width:100%;border-collapse:collapse;">
                    <tr>
                        <td style="width:33.33%;padding:0 8px 0 0;">${cardCell(cardDefs[0])}</td>
                        <td style="width:33.33%;padding:0 4px 0 4px;">${cardCell(cardDefs[1])}</td>
                        <td style="width:33.33%;padding:0 0 0 8px;">${cardCell(cardDefs[2])}</td>
                    </tr>
                </table>`;
            })()}
                </div>

                <div style="padding:10px 12px;">
                    <div style="border:1.2px solid #e2e8f0;border-radius:10px;box-shadow:0 1px 3px 0 rgba(0,0,0,0.05);">
                        <table style="width:100%;border-collapse:collapse;table-layout:fixed;">
                            <thead style="display:table-header-group;">
                                <tr style="background:#f8fafc;page-break-inside:avoid;break-inside:avoid;">
                                    <th style="padding:10px 8px 10px 12px;text-align:left;font-size:8px;font-weight:900;color:#0f172a;text-transform:uppercase;letter-spacing:0.04em;border-bottom:1.2px solid #e2e8f0;width:60%;">Particular</th>
                                    <th style="padding:10px 30px 10px 8px;text-align:right;font-size:8px;font-weight:900;color:#0f172a;text-transform:uppercase;letter-spacing:0.04em;border-bottom:1.2px solid #e2e8f0;width:20%;">Sub Total</th>
                                    <th style="padding:10px 12px 10px 8px;text-align:right;font-size:8px;font-weight:900;color:#0f172a;text-transform:uppercase;letter-spacing:0.04em;border-bottom:1.2px solid #e2e8f0;width:20%;">Total</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${bodyHtml}
                                <tr style="background:#fff;page-break-inside:avoid;">
                                    <td colspan="2" style="padding:15px 8px 12px 12px;border-top:2.5px solid #0f172a;"><h3 style="margin:0;font-size:12px;font-weight:900;text-transform:uppercase;color:#0f172a;">${summary.netProfit >= 0 ? 'Net Profit' : 'Net Loss'}</h3></td>
                                    <td style="padding:15px 12px 12px 8px;text-align:right;font-size:13px;font-weight:900;color:${summary.netProfit >= 0 ? '#059669' : '#e11d48'};border-top:2.5px solid #0f172a;">${fc(Math.abs(summary.netProfit))}</td>
                                </tr>
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>`;

        html2pdf().set({
            margin: [4, 2, 4, 2],
            filename: `Profit_Loss_${new Date().toISOString().split('T')[0]}.pdf`,
            image: { type: 'jpeg', quality: 0.98 },
            html2canvas: { scale: 2, useCORS: true },
            jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' },
            pagebreak: { mode: ['css', 'legacy'] }
        }).from(html, 'string').save();
    }, [hasGenerated, summary, displaySections, formatCurrency, fromDate, toDate]);

    return (
        <PageContainer>
            {error && <MessageBox error={error} clearMessage={() => setError(null)} />}

            <div id="pdf-report-container" className="bg-white rounded-lg border border-gray-200 shadow mb-4 flex-shrink-0 print:shadow-none print:border-none print:m-0">
                {/* Header */}
                <div className="p-3 md:p-6 border-b border-gray-200 flex items-center justify-between print:hidden">
                    <div>
                        <h1 className="text-2xl font-black text-slate-800 tracking-tight">Profit & Loss</h1>
                        <p className="text-[13px] font-bold text-slate-500 mt-1 capitalize tracking-tight">Revenue & Expenditure Statement</p>
                    </div>
                    <div className="flex gap-3">
                        <button onClick={handleSavePDF} className="flex items-center gap-2 px-5 py-2.5 bg-primary text-white rounded-xl hover:bg-primary/90 transition-all font-bold text-sm shadow-sm active:scale-95">
                            <FaDownload className="text-white/80" /> Download PDF
                        </button>
                        <button onClick={handlePrint} className="flex items-center gap-2 px-5 py-2.5 bg-primary text-white rounded-xl hover:bg-primary/90 transition-all font-bold text-sm shadow-sm active:scale-95">
                            <FaPrint className="text-white/80" /> Print Report
                        </button>
                    </div>
                </div>

                {/* Filters */}
                <div className="p-8 pb-6 border-b border-slate-50 bg-white print:hidden">
                    <div className="grid grid-cols-1 md:grid-cols-4 lg:grid-cols-5 gap-6 items-end">
                        <div className="flex flex-col gap-1.5">
                            <label className="text-xs font-bold text-slate-600 ml-1 capitalize">From Date</label>
                            <ModernDatePicker value={fromDate} onChange={setFromDate} inputClassName="!h-[45px] !rounded-xl border-slate-200 bg-white transition-all text-sm font-semibold" showIcon={true} />
                        </div>
                        <div className="flex flex-col gap-1.5">
                            <label className="text-xs font-bold text-slate-600 ml-1 capitalize">To Date</label>
                            <ModernDatePicker value={toDate} onChange={setToDate} inputClassName="!h-[45px] !rounded-xl border-slate-200 bg-white transition-all text-sm font-semibold" showIcon={true} />
                        </div>
                        <div className="flex flex-col gap-1.5 lg:col-span-2">
                            <label className="text-xs font-bold text-slate-600 ml-1 capitalize">Search Account</label>
                            <div className="relative">
                                <FaSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm" />
                                <input type="text" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} placeholder="Search by name or code..." className="w-full h-[45px] pl-10 pr-4 rounded-xl border border-slate-200 focus:border-primary transition-all text-sm font-semibold outline-none bg-white" />
                            </div>
                        </div>
                        <div className="pt-2">
                            <button onClick={fetchPLData} disabled={loading} className="w-full py-3 bg-primary text-white rounded-xl font-bold hover:shadow-lg transition-all disabled:opacity-50 flex items-center justify-center gap-2 active:scale-95">
                                {loading ? <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : "Generate Report"}
                            </button>
                        </div>
                    </div>
                </div>

                {/* Professional Print Header */}
                <div className={`p-8 border-b-2 border-slate-900 mb-6 report-header hidden print:block`}>
                    <div className="flex justify-between items-start">
                        <div>
                            <h1 className="text-3xl font-black text-slate-900 uppercase tracking-tight">Estate-Link Solution</h1>
                            <p className="text-sm font-bold text-primary uppercase tracking-[0.3em] mt-1">Profit & Loss Statement</p>
                        </div>
                        <div className="text-right flex flex-col items-end">
                            <div className="bg-slate-900 text-white px-4 py-1.5 text-[11px] font-black uppercase tracking-widest rounded-none mb-2" style={{ backgroundColor: '#0f172a', color: '#fff', WebkitPrintColorAdjust: 'exact', printColorAdjust: 'exact' }}>Financial Statement</div>
                            <p className="text-[11px] font-black text-slate-700 uppercase tracking-wider">
                                Period: {new Date(fromDate).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }).toUpperCase()} &ndash; {new Date(toDate).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }).toUpperCase()}
                            </p>
                        </div>
                    </div>
                </div>

                {hasGenerated && (
                    <>
                        <div className="p-8 pb-4 border-b border-slate-50 bg-slate-50/10 print:hidden flex items-center gap-3">
                            <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center text-primary"><FaChartLine className="text-xl" /></div>
                            <div>
                                <h2 className="text-xl font-black text-slate-800 tracking-tight">Report Overview</h2>
                                <p className="text-xs font-bold text-slate-400 mt-1 uppercase tracking-widest">{summary?.period}</p>
                            </div>
                        </div>

                        {summary && (
                            <div className="p-8 pb-4 border-b border-slate-50 bg-slate-50/30 print:hidden">
                                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                    {[
                                        { label: "Total Income", value: formatCurrency(summary.totalIncome), icon: <FaChartBar className="text-teal-600" />, classes: "bg-teal-50 border-teal-100" },
                                        { label: "Total Expense", value: formatCurrency(summary.totalExpense), icon: <FaCalculator className="text-rose-600" />, classes: "bg-rose-50 border-rose-100" },
                                        { label: summary.netProfit >= 0 ? "Net Profit" : "Net Loss", value: formatCurrency(Math.abs(summary.netProfit)), icon: <FaBalanceScale className={summary.netProfit >= 0 ? "text-primary" : "text-rose-600"} />, classes: summary.netProfit >= 0 ? "bg-emerald-50 border-emerald-100" : "bg-rose-50 border-rose-100" },
                                    ].map((item, i) => (
                                        <div key={i} className={`p-4 rounded-xl border flex items-center gap-4 transition-all hover:shadow-md ${item.classes}`}>
                                            <div className="w-12 h-12 rounded-lg bg-white shadow-sm flex items-center justify-center text-xl shrink-0">{item.icon}</div>
                                            <div className="min-w-0">
                                                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest leading-none mb-1.5">{item.label}</p>
                                                <p className="text-lg font-black text-slate-800 truncate">৳ {item.value}</p>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        <div className="p-8 min-h-[400px] print:p-0">
                            <div className="overflow-x-auto bg-white rounded-xl border border-slate-100 print:border-none">
                                <table className="w-full min-w-[800px] print:min-w-0 print:w-full text-left border-separate border-spacing-0">
                                    <thead>
                                        <tr className="text-slate-900 text-xs font-black bg-slate-100/80 uppercase tracking-wider">
                                            <th className="w-[60%] py-4 pl-10 border-b border-slate-200 text-left">Particular</th>
                                            <th className="w-[20%] py-4 text-right border-b border-slate-200">Sub Total</th>
                                            <th className="w-[20%] py-4 text-right pr-10 border-b border-slate-200">Total</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {displaySections.map((section, sIdx) => (
                                            <Fragment key={sIdx}>
                                                <tr className="bg-slate-50/10">
                                                    <td colSpan={2} className="py-4 pl-4 border-b border-slate-100/50">
                                                        <h3 className="text-[13px] font-black capitalize text-primary flex items-center gap-2 tracking-tight">
                                                            <span className="w-1.5 h-4 bg-primary rounded-full"></span>
                                                            {section.sectionName}
                                                        </h3>
                                                    </td>
                                                    <td className="py-4 text-right pr-10 border-b border-slate-100/50"></td>
                                                </tr>
                                                {section.filteredAccounts.map((acc, aIdx) => (
                                                    <PLAccountRow key={aIdx} acc={acc} formatCurrency={formatCurrency} />
                                                ))}
                                                <tr className="bg-slate-100/30">
                                                    <td colSpan={2} className="py-3 pl-10 text-xs text-slate-500 font-black capitalize tracking-wider border-b border-slate-200">Total {section.sectionName}</td>
                                                    <td className="py-3 text-right pr-10 border-b border-slate-200 font-black text-sm text-slate-900">{formatCurrency(section.total)}</td>
                                                </tr>
                                            </Fragment>
                                        ))}

                                        {summary && (
                                            <tr className="bg-white">
                                                <td colSpan={2} className="py-6 pl-10 border-t-2 border-slate-900">
                                                    <h3 className="text-lg font-black text-slate-900 uppercase tracking-tighter">{summary.netProfit >= 0 ? "Net Profit for the period" : "Net Loss for the period"}</h3>
                                                    <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest mt-1">Transferred to Retained Earnings</p>
                                                </td>
                                                <td className="py-6 text-right pr-10 text-2xl font-black text-slate-900 border-t-2 border-slate-900">{formatCurrency(Math.abs(summary.netProfit))}</td>
                                            </tr>
                                        )}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </>
                )}

                {!hasGenerated && !loading && (
                    <div className="py-32 flex flex-col items-center justify-center text-center px-4 bg-slate-50 border-t border-slate-100">
                        <div className="w-20 h-20 rounded-full bg-white shadow-sm flex items-center justify-center text-primary mb-6 animate-pulse transition-all"><FaChartLine size={40} /></div>
                        <h3 className="text-xl font-black text-slate-800 mb-2">Report Ready to Generate</h3>
                        <p className="text-slate-500 text-sm max-w-sm">Please select your date range and click <span className="text-primary font-bold">Generate Report</span> to view.</p>
                    </div>
                )}
            </div>

            <style>{`
                @media print {
                    @page { size: A4 portrait; margin: 10mm; }
                    .print\\:hidden { display: none !important; }
                    .overflow-x-auto { overflow: visible !important; }
                }
            `}</style>
        </PageContainer >
    );
};

export default React.memo(ProfitAndLossPage);
