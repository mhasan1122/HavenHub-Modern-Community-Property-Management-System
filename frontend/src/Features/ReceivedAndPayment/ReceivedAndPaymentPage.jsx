import React, { useState, useEffect, useCallback, useMemo, Fragment } from "react";
import { useNavigate } from "react-router-dom";
import {
    FaSearch,
    FaDownload,
    FaPrint,
    FaUniversity,
    FaArrowDown,
    FaArrowUp
} from "react-icons/fa";
import PageContainer from "../../Components/Ui/PageContainer";
import MessageBox from "../../Components/MessageBox/MessageBox";
import axiosInstance from "../../utils/axiosInstance";
import ModernDatePicker from "../../Components/FormComponent/ModernDatePicker";
import html2pdf from "html2pdf.js";

// --- MEMOIZED ROW COMPONENT ---
const MovementRow = React.memo(({ item, index, formatCurrency }) => (
    <tr className="group hover:bg-slate-50 transition-all border-b border-slate-50">
        <td className="py-2 pl-4 text-center text-[11px] font-bold text-slate-400 group-hover:text-slate-600 w-12">{index + 1}</td>
        <td className="py-2 px-3">
            <div className="flex flex-col">
                <span className="text-xs font-bold text-slate-700 group-hover:text-slate-900 leading-tight">{item.accountName}</span>
                <span className="text-[9px] text-slate-500 font-extrabold uppercase mt-0.5 tracking-tight">{item.accountCode}</span>
            </div>
        </td>
        <td className="py-2 px-3 text-right pr-6 text-xs font-black text-slate-700">{formatCurrency(item.amount)}</td>
    </tr>
));

// Cache for manual report generation
const rpCache = new Map();

const ReceivedAndPaymentPage = () => {
    const navigate = useNavigate();
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    const [hasGenerated, setHasGenerated] = useState(false);
    const [fromDate, setFromDate] = useState(new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0]);
    const [toDate, setToDate] = useState(new Date().toISOString().split('T')[0]);
    const [data, setData] = useState({ receipts: [], payments: [] });
    const [summary, setSummary] = useState(null);

    const formatCurrency = useCallback((amount) => {
        return new Intl.NumberFormat('en-BD', {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2
        }).format(amount || 0);
    }, []);

    const fetchData = useCallback(async () => {
        const cacheKey = `${fromDate}_${toDate}`;

        if (rpCache.has(cacheKey)) {
            const cached = rpCache.get(cacheKey);
            setData(cached.data);
            setSummary(cached.summary);
            setHasGenerated(true);
            return;
        }

        try {
            setLoading(true);
            setError(null);

            const response = await axiosInstance.get(
                `/api/accounts/received-payment/?from_date=${fromDate}&to_date=${toDate}`
            );
            const resData = response.data;

            if (resData.success) {
                rpCache.set(cacheKey, {
                    data: resData.data || { receipts: [], payments: [] },
                    summary: resData.summary || null
                });

                setData(resData.data || { receipts: [], payments: [] });
                setSummary(resData.summary || null);
                setHasGenerated(true);
            } else {
                throw new Error(resData.message || "Failed to fetch report data");
            }
        } catch (err) {
            console.error("Error fetching report:", err);
            setError(err.response?.data?.message || "Failed to fetch report data");
        } finally {
            setLoading(false);
        }
    }, [fromDate, toDate]);

    const handlePrint = useCallback(() => {
        setTimeout(() => window.print(), 100);
    }, []);

    const handleSavePDF = useCallback(() => {
        if (!hasGenerated || !summary) return;

        const dt = new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'long', year: 'numeric' });
        const fc = (amt) => formatCurrency(amt);
        const dateRange = `${new Date(fromDate).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })} – ${new Date(toDate).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}`.toUpperCase();

        const buildTable = (sections, type) => {
            const tableHtml = sections.map(sec => {
                const itemRows = sec.items.map((item, idx) => `
                    <tr style="border-bottom:1px solid #f1f5f9;page-break-inside:avoid;">
                        <td style="padding:6px;text-align:center;font-size:8.5px;color:#94a3b8;font-weight:700;">${idx + 1}</td>
                        <td style="padding:6px 8px;">
                            <span style="display:block;font-size:9px;font-weight:800;color:#1e293b;">${item.accountName}</span>
                            <span style="display:block;font-size:6.5px;font-weight:700;color:#94a3b8;text-transform:uppercase;">${item.accountCode}</span>
                        </td>
                        <td style="padding:6px 20px 6px 6px;text-align:right;font-size:9px;font-weight:800;color:#1e293b;white-space:nowrap;">${fc(item.amount)}</td>
                    </tr>`).join('');

                return `
                    <tr style="background:rgba(241,245,249,0.3);page-break-inside:avoid;">
                        <td colspan="3" style="padding:8px 0 4px 10px;">
                            <span style="font-size:9px;font-weight:900;color:#0d9488;text-transform:capitalize;">${sec.sectionName}</span>
                        </td>
                    </tr>
                    ${itemRows}
                    <tr style="background:#f8fafc;border-top:1px solid #e2e8f0;page-break-inside:avoid;">
                        <td colspan="2" style="padding:8px 0 8px 10px;font-size:8.5px;font-weight:900;color:#475569;">Total ${sec.sectionName}</td>
                        <td style="padding:8px 20px 8px 6px;text-align:right;font-size:8.5px;font-weight:900;color:#0f172a;">${fc(sec.total)}</td>
                    </tr>`;
            }).join('');

            return `
                <div style="flex:1;border:1.2px solid #e2e8f0;border-radius:10px;background:#fff;box-shadow:0 1px 2px 0 rgba(0,0,0,0.05);">
                    <div style="background:${type === 'receipt' ? '#f0fdf4' : '#fff1f2'};padding:6px;text-align:center;border-bottom:1px solid #e2e8f0;">
                         <span style="font-size:9px;font-weight:900;text-transform:uppercase;letter-spacing:0.04em;color:${type === 'receipt' ? '#166534' : '#991b1b'};">${type === 'receipt' ? 'Received / Inflows' : 'Payment / Outflows'}</span>
                    </div>
                    <table style="width:100%;border-collapse:collapse;">
                        <thead>
                            <tr style="background:#f8fafc;border-bottom:1px solid #e2e8f0;">
                                <th style="padding:6px 4px;font-size:7px;font-weight:900;text-transform:uppercase;color:#64748b;width:30px;">SL</th>
                                <th style="padding:6px 8px;font-size:7px;font-weight:900;text-transform:uppercase;color:#64748b;text-align:left;">Particulars</th>
                                <th style="padding:6px 20px;font-size:7px;font-weight:900;text-transform:uppercase;color:#64748b;text-align:right;">Amount</th>
                            </tr>
                        </thead>
                        <tbody>${tableHtml}</tbody>
                    </table>
                </div>`;
        };

        const html = `
            <div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;background:#fff;width:100%;padding-bottom:20px;">
                <div style="padding:15px 12px 10px;border-bottom:1.5px solid #0f172a;display:flex;justify-content:space-between;align-items:flex-start;">
                    <div>
                        <h1 style="margin:0;font-size:18px;font-weight:900;color:#0f172a;text-transform:uppercase;letter-spacing:-0.4px;">Estate-Link Solution</h1>
                        <p style="margin:2px 0 0;font-size:7.5px;font-weight:700;color:#0d9488;text-transform:uppercase;letter-spacing:0.2em;">Received & Payment Account</p>
                    </div>
                    <div style="display:flex;flex-direction:column;align-items:flex-end;text-align:right;">
                        <span style="background:#0f172a;color:#fff;padding:3px 12px;font-size:8.5px;font-weight:900;text-transform:uppercase;letter-spacing:0.1em;border-radius:0;margin-bottom:6px;white-space:nowrap;">Financial Statement</span>
                        <p style="margin:0;font-size:8.5px;font-weight:900;color:#1e293b;text-transform:uppercase;letter-spacing:0.04em;white-space:nowrap;">Period: ${dateRange}</p>
                    </div>
                </div>

                <div style="padding:10px 12px 6px;background:rgba(241,245,249,0.4);border-bottom:1px solid #e2e8f0;display:flex;gap:12px;page-break-inside:avoid;">
                    ${(() => {
                const icons = {
                    received: `<svg viewBox="0 0 448 512" style="width:24px;height:24px;fill:#059669;"><path d="M413.1 222.5l22.2 22.2c9.4 9.4 9.4 24.6 0 33.9L241 473c-9.4 9.4-24.6 9.4-33.9 0L12.7 278.6c-9.4-9.4-9.4-24.6 0-33.9l22.2-22.2c9.5-9.5 25-9.3 34.3.4L184 343.4V56c0-13.3 10.7-24 24-24h32c13.3 0 24 10.7 24 24v287.4l114.8-120.5c9.3-9.8 24.8-10 34.3-.4z"/></svg>`,
                    payments: `<svg viewBox="0 0 448 512" style="width:24px;height:24px;fill:#e11d48;"><path d="M34.9 289.5l-22.2-22.2c-9.4-9.4-9.4-24.6 0-33.9L207 39c9.4-9.4 24.6-9.4 33.9 0l194.3 194.3c9.4 9.4 9.4 24.6 0 33.9l-22.2 22.2c-9.5 9.5-25 9.3-34.3-.4L264 168.6V456c0 13.3-10.7 24-24 24h-32c-13.3 0-24-10.7-24-24V168.6L69.2 289.1c-9.3 9.8-24.8 10-34.3.4z"/></svg>`
                };

                const cardCell = (c) => `
                    <div style="background:#fff;border:1px solid #f1f5f9;border-radius:10px;padding:12px 14px;box-shadow:0 1px 2px 0 rgba(0,0,0,0.05);display:flex;align-items:center;gap:14px;page-break-inside:avoid;">
                        <div style="width:48px;height:48px;border-radius:10px;background:${c.bg};display:flex;align-items:center;justify-content:center;flex-shrink:0;">
                            ${c.icon}
                        </div>
                        <div style="min-width:0;">
                            <p style="margin:0 0 2px;font-size:8px;font-weight:700;color:#94a3b8;text-transform:uppercase;">${c.label}</p>
                            <p style="margin:0;font-size:12px;font-weight:900;color:${c.color};">৳ ${c.val}</p>
                        </div>
                    </div>`;

                const cardDefs = [
                    { label: "Total Received", val: fc(summary.totalReceipts), bg: '#f0fdf4', color: '#059669', icon: icons.received },
                    { label: "Total Payment", val: fc(summary.totalPayments), bg: '#fff1f2', color: '#e11d48', icon: icons.payments }
                ];

                return `
                <table style="width:100%;border-collapse:collapse;">
                    <tr>
                        <td style="width:50%;padding:0 8px 0 0;">${cardCell(cardDefs[0])}</td>
                        <td style="width:50%;padding:0 0 0 8px;">${cardCell(cardDefs[1])}</td>
                    </tr>
                </table>`;
            })()}
                </div>

                <div style="padding:10px 12px;display:flex;gap:12px;align-items:flex-start;">
                    ${buildTable(data.receipts, 'receipt')}
                    ${buildTable(data.payments, 'payment')}
                </div>
            </div>`;

        html2pdf().set({
            margin: [4, 2, 4, 2],
            filename: `Received_Payment_${new Date().toISOString().split('T')[0]}.pdf`,
            image: { type: 'jpeg', quality: 0.98 },
            html2canvas: { scale: 2, useCORS: true },
            jsPDF: { unit: 'mm', format: 'a4', orientation: 'landscape' },
            pagebreak: { mode: ['css', 'legacy'] }
        }).from(html, 'string').save();
    }, [hasGenerated, summary, data, formatCurrency, fromDate, toDate]);

    return (
        <PageContainer>
            {error && <MessageBox error={error} clearMessage={() => setError(null)} />}

            <div id="pdf-report-container" className="bg-white rounded-lg border border-gray-200 shadow mb-4 flex-shrink-0 print:shadow-none print:border-none print:m-0">
                {/* Header */}
                <div className="p-3 md:p-6 border-b border-gray-200 flex items-center justify-between print:hidden">
                    <div>
                        <h1 className="text-2xl font-black text-slate-800 tracking-tight">Received & Payment</h1>
                        <p className="text-[13px] font-bold text-slate-500 mt-1 capitalize tracking-tight">Cash & Bank Movement</p>
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
                        <div className="flex flex-col gap-1.5 lg:col-span-2 invisible md:visible"></div>
                        <div className="pt-2">
                            <button onClick={fetchData} disabled={loading} className="w-full py-3 bg-primary text-white rounded-xl font-bold hover:shadow-lg transition-all disabled:opacity-50 flex items-center justify-center gap-2 active:scale-95">
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
                            <p className="text-sm font-bold text-primary uppercase tracking-[0.3em] mt-1">Received & Payment Account</p>
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
                        {/* Summary Cards */}
                        {summary && (
                            <div className="p-8 pb-4 border-b border-slate-50 bg-slate-50/30 print:hidden">
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    {[
                                        { label: "Total Received (Inflows)", value: formatCurrency(summary.totalReceipts), icon: <FaArrowDown className="text-teal-600" />, classes: "bg-teal-50 border-teal-100" },
                                        { label: "Total Payment (Outflows)", value: formatCurrency(summary.totalPayments), icon: <FaArrowUp className="text-rose-600" />, classes: "bg-rose-50 border-rose-100" }
                                    ].map((item, i) => (
                                        <div key={i} className={`p-4 rounded-xl border flex items-center gap-4 transition-all hover:shadow-md ${item.classes}`}>
                                            <div className="w-12 h-12 rounded-lg bg-white shadow-sm flex items-center justify-center text-xl shrink-0">{item.icon}</div>
                                            <div className="min-w-0">
                                                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5">{item.label}</p>
                                                <p className="text-lg font-black text-slate-800 truncate">৳ {item.value}</p>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* Split Table */}
                        <div className="p-4 print:p-0">
                            <div className="grid grid-cols-1 lg:grid-cols-2 border border-slate-200 rounded-2xl overflow-hidden print:border-none print:grid-cols-2 shadow-sm print:shadow-none">
                                {/* RECEIPTS */}
                                <div className="border-r border-slate-200 print:border-r-0">
                                    <div className="bg-emerald-50/50 p-3 border-b border-slate-200 text-center">
                                        <h3 className="text-xs font-black uppercase text-emerald-800 tracking-widest">Received / Inflows</h3>
                                    </div>
                                    <table className="w-full text-left border-collapse">
                                        <thead className="bg-slate-50 text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                                            <tr>
                                                <th className="py-2 pl-4 border-b border-slate-200 w-12 text-center">SL</th>
                                                <th className="py-2 px-3 border-b border-slate-200">Particulars</th>
                                                <th className="py-2 px-3 border-b border-slate-200 text-right pr-6">Amount</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {data.receipts.map((section, sIdx) => (
                                                <Fragment key={`rec-sec-${sIdx}`}>
                                                    <tr className="bg-slate-50/30">
                                                        <td colSpan={3} className="py-2 pl-4 border-b border-slate-100">
                                                            <span className="text-[11px] font-black text-primary capitalize tracking-tight">{section.sectionName}</span>
                                                        </td>
                                                    </tr>
                                                    {section.items.map((item, iIdx) => (
                                                        <MovementRow key={iIdx} item={item} index={iIdx} formatCurrency={formatCurrency} />
                                                    ))}
                                                    <tr className="bg-emerald-50/20">
                                                        <td colSpan={2} className="py-2 pl-4 border-b border-slate-200 text-[10px] font-black capitalize text-emerald-600">Total {section.sectionName}</td>
                                                        <td className="py-2 px-3 border-b border-slate-200 text-right pr-6 text-xs font-black text-emerald-700">{formatCurrency(section.total)}</td>
                                                    </tr>
                                                </Fragment>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>

                                {/* PAYMENTS */}
                                <div className="border-l border-slate-200 -ml-px print:border-l-0">
                                    <div className="bg-rose-50/50 p-3 border-b border-slate-200 text-center">
                                        <h3 className="text-xs font-black uppercase text-rose-800 tracking-widest">Payment / Outflows</h3>
                                    </div>
                                    <table className="w-full text-left border-collapse">
                                        <thead className="bg-slate-50 text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                                            <tr>
                                                <th className="py-2 pl-4 border-b border-slate-200 w-12 text-center">SL</th>
                                                <th className="py-2 px-3 border-b border-slate-200">Particulars</th>
                                                <th className="py-2 px-3 border-b border-slate-200 text-right pr-6">Amount</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {data.payments.map((section, sIdx) => (
                                                <Fragment key={`pay-sec-${sIdx}`}>
                                                    <tr className="bg-slate-50/30">
                                                        <td colSpan={3} className="py-2 pl-4 border-b border-slate-100">
                                                            <span className="text-[11px] font-black text-primary capitalize tracking-tight">{section.sectionName}</span>
                                                        </td>
                                                    </tr>
                                                    {section.items.map((item, iIdx) => (
                                                        <MovementRow key={iIdx} item={item} index={iIdx} formatCurrency={formatCurrency} />
                                                    ))}
                                                    <tr className="bg-rose-50/20">
                                                        <td colSpan={2} className="py-2 pl-4 border-b border-slate-200 text-[10px] font-black capitalize text-rose-600">Total {section.sectionName}</td>
                                                        <td className="py-2 px-3 border-b border-slate-200 text-right pr-6 text-xs font-black text-rose-700">{formatCurrency(section.total)}</td>
                                                    </tr>
                                                </Fragment>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            </div>

                            {summary && (
                                <div className="grid grid-cols-1 lg:grid-cols-2 border-x border-b border-slate-200 rounded-b-2xl overflow-hidden print:border-none print:grid-cols-2">
                                    <div className="bg-white text-emerald-600 p-4 flex justify-between items-center px-10 border-r border-slate-200 border-t-2 border-emerald-600">
                                        <span className="text-sm font-black uppercase tracking-widest">Total Received</span>
                                        <span className="text-xl font-black">৳ {formatCurrency(summary.totalReceipts)}</span>
                                    </div>
                                    <div className="bg-white text-rose-600 p-4 flex justify-between items-center px-10 border-t-2 border-rose-600">
                                        <span className="text-sm font-black uppercase tracking-widest">Total Payment</span>
                                        <span className="text-xl font-black">৳ {formatCurrency(summary.totalPayments)}</span>
                                    </div>
                                </div>
                            )}
                        </div>
                    </>
                )}

                {!hasGenerated && !loading && (
                    <div className="py-32 flex flex-col items-center justify-center text-center px-4 bg-slate-50 border-t border-slate-100 rounded-b-lg">
                        <div className="w-20 h-20 rounded-full bg-white shadow-sm flex items-center justify-center text-primary mb-6 animate-pulse transition-all"><FaUniversity size={40} /></div>
                        <h3 className="text-xl font-black text-slate-800 mb-2">Report Ready to Generate</h3>
                        <p className="text-slate-500 text-sm max-w-sm">Please select your date range and click <span className="text-primary font-bold">Generate Report</span> to view.</p>
                    </div>
                )}
            </div>

            <style>{`
                @media print {
                    @page { size: A4 landscape; margin: 10mm; }
                    .print\\:hidden { display: none !important; }
                    .print\\:grid-cols-2 { grid-template-columns: repeat(2, minmax(0, 1fr)) !important; }
                    .overflow-x-auto { overflow: visible !important; }
                }
            `}</style>
        </PageContainer>
    );
};

export default React.memo(ReceivedAndPaymentPage);
