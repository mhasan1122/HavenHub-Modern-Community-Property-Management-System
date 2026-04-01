import React, { useState, useEffect, useCallback, useMemo, Fragment } from "react";
import { useNavigate } from "react-router-dom";
import {
    FaSearch,
    FaDownload,
    FaPrint,
    FaBalanceScale,
    FaChartBar,
    FaCalculator,
    FaChartLine,
    FaShieldAlt,
    FaLayerGroup
} from "react-icons/fa";
import PageContainer from "../../Components/Ui/PageContainer";
import MessageBox from "../../Components/MessageBox/MessageBox";
import axiosInstance from "../../utils/axiosInstance";
import ModernDatePicker from "../../Components/FormComponent/ModernDatePicker";
import html2pdf from "html2pdf.js";

// --- MEMOIZED ACCOUNT ROW ---
const BSAccountRow = React.memo(({ acc, formatCurrency }) => (
    <tr className="group hover:bg-slate-50/80 transition-all cursor-default">
        <td className="py-3 pl-10 border-b border-slate-50">
            <div className="flex flex-col pl-4">
                <span className="text-sm font-bold text-slate-700 group-hover:text-slate-900 leading-tight">{acc.accountName}</span>
                <span className="text-[10px] text-slate-500 font-extrabold uppercase mt-0.5 tracking-tight">{acc.accountCode} • {acc.accountTypeDisplay}</span>
            </div>
        </td>
        <td className="py-3 text-right border-b border-slate-50 text-sm font-extrabold text-slate-700">{formatCurrency(Math.abs(acc.balance))}</td>
        <td className="py-3 pr-10 border-b border-slate-50 text-right"></td>
    </tr>
));

// Cache for manual report generation
const bsCache = new Map();

const BalanceSheetPage = () => {
    const navigate = useNavigate();
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    const [hasGenerated, setHasGenerated] = useState(false);
    const [toDate, setToDate] = useState(new Date().toISOString().split('T')[0]);
    const [searchTerm, setSearchTerm] = useState("");
    const [sections, setSections] = useState([]);
    const [summary, setSummary] = useState(null);
    const [isPdfExport, setIsPdfExport] = useState(false);

    const formatCurrency = useCallback((amount) => {
        return new Intl.NumberFormat('en-BD', {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2
        }).format(amount || 0);
    }, []);

    const fetchBalanceSheetData = useCallback(async () => {
        const cacheKey = `${toDate}`;

        if (bsCache.has(cacheKey)) {
            const cached = bsCache.get(cacheKey);
            setSections(cached.sections);
            setSummary(cached.summary);
            setHasGenerated(true);
            return;
        }

        try {
            setLoading(true);
            setError(null);

            const response = await axiosInstance.get(
                `/api/accounts/balance-sheet/?to_date=${toDate}`
            );
            const data = response.data;

            if (data.success) {
                bsCache.set(cacheKey, {
                    sections: data.data || [],
                    summary: data.summary || null
                });

                setSections(data.data || []);
                setSummary(data.summary || null);
                setHasGenerated(true);
            } else {
                throw new Error(data.message || "Failed to fetch balance sheet data");
            }
        } catch (err) {
            console.error("Error fetching Balance Sheet:", err);
            setError(err.response?.data?.message || "Failed to fetch balance sheet data");
        } finally {
            setLoading(false);
        }
    }, [toDate]);

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
        const reportDate = new Date(toDate).toLocaleDateString('en-GB', { day: '2-digit', month: 'long', year: 'numeric' }).toUpperCase();

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
                        <p style="margin:2px 0 0;font-size:7.5px;font-weight:700;color:#0d9488;text-transform:uppercase;letter-spacing:0.2em;">Balance Sheet Report</p>
                    </div>
                    <div style="display:flex;flex-direction:column;align-items:flex-end;text-align:right;">
                        <span style="background:#0f172a;color:#fff;padding:3px 12px;font-size:8.5px;font-weight:900;text-transform:uppercase;letter-spacing:0.1em;border-radius:0;margin-bottom:6px;white-space:nowrap;">Financial Statement</span>
                        <p style="margin:0;font-size:8.5px;font-weight:900;color:#1e293b;text-transform:uppercase;letter-spacing:0.04em;white-space:nowrap;">As of ${reportDate}</p>
                    </div>
                </div>

                <div style="padding:10px 12px 6px;background:rgba(241,245,249,0.4);border-bottom:1px solid #e2e8f0;page-break-inside:avoid;">
                    <div style="display:flex;gap:10px;">
                        ${(() => {
                const icons = {
                    assets: `<svg viewBox="0 0 576 512" style="width:24px;height:24px;fill:#0d9488;"><path d="M264.5 5.2c14.9-6.9 32.1-6.9 47 0l218.6 101c8.5 3.9 13.9 12.4 13.9 21.8s-5.4 17.9-13.9 21.8l-218.6 101c-14.9 6.9-32.1 6.9-47 0L45.9 149.8C37.4 145.8 32 137.3 32 128s5.4-17.9 13.9-21.8L264.5 5.2zM288 304a128 128 0 1 1 0 256 128 128 0 1 1 0-256zm0 192a64 64 0 1 0 0-128 64 64 0 1 0 0 128z"/></svg>`,
                    liabilities: `<svg viewBox="0 0 512 512" style="width:24px;height:24px;fill:#475569;"><path d="M466.5 83.7l-192-80c-4.9-2-10.3-2-15.2 0l-192 80C29.4 99.4 0 122.9 0 156.4V240c0 148.2 103.5 197.6 226.7 301.6 11.2 9.4 27.4 9.4 38.6 0C388.5 437.6 492 388.2 492 240v-83.6c0-33.5-29.4-57-67.6-72.7z"/></svg>`,
                    equity: `<svg viewBox="0 0 576 512" style="width:24px;height:24px;fill:#059669;"><path d="M576 128c0-35.3-28.7-64-64-64H64C28.7 64 0 92.7 0 128v256c0 35.3 28.7 64 64 64h448c35.3 0 64-28.7 64-64V128z"/></svg>`
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
                    { label: "Total Assets", val: fc(summary.totalAssets), bg: '#ccfbf1', color: '#0d9488', icon: icons.assets },
                    { label: "Total Liabilities", val: fc(summary.totalLiabilities), bg: '#e2e8f0', color: '#475569', icon: icons.liabilities },
                    { label: "Total Equity", val: fc(summary.totalEquity), bg: '#d1fae5', color: '#059669', icon: icons.equity }
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
                                    <td colspan="2" style="padding:15px 8px 12px 12px;border-top:2.5px solid #0f172a;"><h3 style="margin:0;font-size:12px;font-weight:900;text-transform:uppercase;color:#0f172a;">Total Assets</h3></td>
                                    <td style="padding:15px 12px 12px 8px;text-align:right;font-size:13px;font-weight:900;color:#0f172a;border-top:2.5px solid #0f172a;">${fc(summary.totalAssets)}</td>
                                </tr>
                                <tr style="background:#fff;page-break-inside:avoid;">
                                    <td colspan="2" style="padding:12px 8px 15px 12px;border-top:2.5px solid #0d9488;"><h3 style="margin:0;font-size:12px;font-weight:900;text-transform:uppercase;color:#0d9488;">Total Liabilities & Equity</h3></td>
                                    <td style="padding:12px 12px 15px 8px;text-align:right;font-size:13px;font-weight:900;color:#0d9488;border-top:2.5px solid #0d9488;">${fc(summary.totalLiabilitiesAndEquity)}</td>
                                </tr>
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>`;

        html2pdf().set({
            margin: [4, 2, 4, 2],
            filename: `Balance_Sheet_${new Date().toISOString().split('T')[0]}.pdf`,
            image: { type: 'jpeg', quality: 0.98 },
            html2canvas: { scale: 2, useCORS: true },
            jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' },
            pagebreak: { mode: ['css', 'legacy'] }
        }).from(html, 'string').save();
    }, [hasGenerated, summary, displaySections, formatCurrency, toDate]);

    return (
        <PageContainer>
            {error && <MessageBox error={error} clearMessage={() => setError(null)} />}

            <div id="pdf-report-container" className="bg-white rounded-lg border border-gray-200 shadow mb-4 flex-shrink-0 print:shadow-none print:border-none print:m-0">
                {/* Header */}
                <div className="p-3 md:p-6 border-b border-gray-200 flex items-center justify-between print:hidden">
                    <div>
                        <h1 className="text-2xl font-black text-slate-800 tracking-tight">Balance Sheet</h1>
                        <p className="text-[13px] font-bold text-slate-500 mt-1 capitalize tracking-tight">Financial Position Statement</p>
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
                        <div className="flex flex-col gap-1.5 md:col-span-2 lg:col-span-1">
                            <label className="text-xs font-bold text-slate-600 ml-1 capitalize">Statement Date</label>
                            <ModernDatePicker value={toDate} onChange={setToDate} inputClassName="!h-[45px] !rounded-xl border-slate-200 bg-white transition-all text-sm font-semibold" showIcon={true} />
                        </div>
                        <div className="flex flex-col gap-1.5 lg:col-span-3">
                            <label className="text-xs font-bold text-slate-600 ml-1 capitalize">Search Account</label>
                            <div className="relative">
                                <FaSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm" />
                                <input type="text" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} placeholder="Search by name or code..." className="w-full h-[45px] pl-10 pr-4 rounded-xl border border-slate-200 focus:border-primary transition-all text-sm font-semibold outline-none bg-white" />
                            </div>
                        </div>
                        <div className="pt-2">
                            <button onClick={fetchBalanceSheetData} disabled={loading} className="w-full py-3 bg-primary text-white rounded-xl font-bold hover:shadow-lg transition-all disabled:opacity-50 flex items-center justify-center gap-2 active:scale-95">
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
                            <p className="text-sm font-bold text-primary uppercase tracking-[0.3em] mt-1">Balance Sheet</p>
                        </div>
                        <div className="text-right flex flex-col items-end">
                            <div className="bg-slate-900 text-white px-4 py-1.5 text-[11px] font-black uppercase tracking-widest rounded-none mb-2" style={{ backgroundColor: '#0f172a', color: '#fff', WebkitPrintColorAdjust: 'exact', printColorAdjust: 'exact' }}>Financial Statement</div>
                            <p className="text-[11px] font-black text-slate-700 uppercase tracking-wider">
                                As of {new Date(toDate).toLocaleDateString('en-GB', { day: '2-digit', month: 'long', year: 'numeric' }).toUpperCase()}
                            </p>
                        </div>
                    </div>
                </div>

                {hasGenerated && (
                    <>
                        <div className="p-8 pb-4 border-b border-slate-50 bg-slate-50/10 print:hidden flex items-center gap-3">
                            <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center text-primary"><FaBalanceScale className="text-xl" /></div>
                            <div>
                                <h2 className="text-xl font-black text-slate-800 tracking-tight">Financial Overview</h2>
                                <p className="text-xs font-bold text-slate-400 mt-1 uppercase tracking-widest">{summary?.period}</p>
                            </div>
                        </div>

                        {summary && (
                            <div className="p-8 pb-4 border-b border-slate-50 bg-slate-50/30 print:hidden">
                                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                    {[
                                        { label: "Total Assets", value: formatCurrency(summary.totalAssets), icon: <FaLayerGroup className="text-teal-600" />, classes: "bg-teal-50 border-teal-100" },
                                        { label: "Total Liabilities", value: formatCurrency(summary.totalLiabilities), icon: <FaShieldAlt className="text-orange-600" />, classes: "bg-orange-50 border-orange-100" },
                                        { label: "Total Equity", value: formatCurrency(summary.totalEquity), icon: <FaBalanceScale className="text-primary" />, classes: "bg-emerald-50 border-emerald-100" },
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
                                                    <BSAccountRow key={aIdx} acc={acc} formatCurrency={formatCurrency} />
                                                ))}
                                                <tr className="bg-slate-100/30">
                                                    <td colSpan={2} className="py-3 pl-10 text-xs text-slate-500 font-black capitalize tracking-wider border-b border-slate-200">Total {section.sectionName}</td>
                                                    <td className="py-3 text-right pr-10 border-b border-slate-200 font-black text-sm text-slate-900">{formatCurrency(section.total)}</td>
                                                </tr>
                                            </Fragment>
                                        ))}

                                        {summary && (
                                            <>
                                                <tr className="bg-white border-t-2 border-b-2 border-slate-900">
                                                    <td colSpan={2} className="py-5 pl-10 pt-8">
                                                        <h3 className="text-lg font-black uppercase text-slate-900 tracking-tight">Total Assets</h3>
                                                    </td>
                                                    <td className="py-5 text-right pr-10 text-xl font-black text-slate-900 pt-8">{formatCurrency(summary.totalAssets)}</td>
                                                </tr>
                                                <tr className="h-8"></tr>
                                                <tr className="bg-white border-t-2 border-b-2 border-primary">
                                                    <td colSpan={2} className="py-5 pl-10">
                                                        <h3 className="text-lg font-black uppercase text-primary tracking-tight">Total Liabilities & Equity</h3>
                                                    </td>
                                                    <td className="py-5 text-right pr-10 text-xl font-black text-primary">{formatCurrency(summary.totalLiabilitiesAndEquity)}</td>
                                                </tr>
                                            </>
                                        )}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </>
                )}

                {!hasGenerated && !loading && (
                    <div className="py-32 flex flex-col items-center justify-center text-center px-4 bg-slate-50 border-t border-slate-100">
                        <div className="w-20 h-20 rounded-full bg-white shadow-sm flex items-center justify-center text-primary mb-6 animate-pulse transition-all"><FaBalanceScale size={40} /></div>
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

export default React.memo(BalanceSheetPage);
