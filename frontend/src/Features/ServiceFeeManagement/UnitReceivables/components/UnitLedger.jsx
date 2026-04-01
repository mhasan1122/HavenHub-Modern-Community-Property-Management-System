import { useState, useEffect, useMemo } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useNavigate, useParams } from 'react-router-dom';
import { FaArrowLeft, FaDownload } from 'react-icons/fa';
import ModernLoadingAnimation from '../../../../Components/Loaders/ModernLoadingAnimation';
import TableSkeleton from '../../../../Components/Loaders/TableSkeleton';
import { fetchUnitLedger } from '../../../../redux/slices/api/serviceFeeManagement/serviceFeeManagementApi';
import { unitDetails } from '../../../../redux/slices/units/unitSlice';
import PageContainer from '../../../../Components/Ui/PageContainer';
import ContentBox from '../../../../Components/Ui/ContentBox';
import Heading from '../../../../Components/HeadingComponent/Heading';
import UnpaidBillsModal from '../../../../Components/Modal/UnpaidBillsModal';
import calculateDaysOverdue from '../../utils/feeUtils';

const UnitLedgerPage = () => {
    const dispatch = useDispatch();
    const navigate = useNavigate();
    const { unitId } = useParams();

    // Redux state
    const serviceFeeState = useSelector(state => state.serviceFeeManagement) || {};
    const unitState = useSelector(state => state.unit) || {};

    const {
        unitLedger = [],
        unitLedgerBills = [],
        unitLedgerLoading: ledgerLoading = false,
        unitLedgerSummary: summary = {},
        unitLedgerPagination: pagination = {},
        unitLedgerCache = {}, // Cached data per unit
        outstandingSummary = [], // Parent data
    } = serviceFeeState;

    // Local data derivation
    const { displayLedger, displaySummary, displayLoading } = useMemo(() => {
        // 1. Check if we have specific cached data for THIS unit
        const cached = unitLedgerCache[unitId];
        if (cached && cached.results?.length > 0) {
            return {
                displayLedger: cached.results,
                displaySummary: cached.summary,
                displayLoading: false
            };
        }

        // 2. Fallback to parent data (summary results) if available
        const unitVouchers = outstandingSummary.filter(item => String(item.unit_id) === String(unitId));

        let unitSummary = summary;
        if (unitVouchers.length > 0) {
            const totalDr = unitVouchers.reduce((sum, v) => sum + (Number(v.debit) || 0), 0);
            const totalCr = unitVouchers.reduce((sum, v) => sum + (Number(v.credit) || 0), 0);
            unitSummary = {
                total_dr: totalDr,
                total_cr: totalCr,
                total_outstanding: totalDr - totalCr,
                unpaid_bills_count: 0
            };
        }

        return {
            displayLedger: unitVouchers,
            displaySummary: unitSummary,
            displayLoading: ledgerLoading && unitVouchers.length === 0
        };
    }, [unitLedgerCache, unitId, outstandingSummary, summary, ledgerLoading]);

    const {
        selectedUnitDetails: unitDetailsData = null,
    } = unitState;

    // Local state
    const [isInitialLoad, setIsInitialLoad] = useState(true);
    const [isUnpaidBillsModalOpen, setIsUnpaidBillsModalOpen] = useState(false);
    const [currentPage, setCurrentPage] = useState(1);
    const itemsPerPage = 1000;

    // Filter bills for unpaid status
    const unpaidPayments = useMemo(() => {
        // If we have bills from unitLedgerBills, use them
        if (unitLedgerBills.length > 0) {
            return unitLedgerBills.filter(bill =>
                ['due', 'partial', 'overdue'].includes(bill.service_status)
            );
        }
        // Otherwise try to identify them from the ledger
        return displayLedger.filter(v => {
            const type = (v.type || '').toLowerCase();
            const isBillType = type === 'servicefeebill' || type === 'service fee bill' || (v.referenceNumber && v.referenceNumber.startsWith('BILL-'));
            const isUnpaid = ['due', 'partial', 'overdue'].includes(v.service_status);
            return isBillType && isUnpaid;
        });
    }, [unitLedgerBills, displayLedger]);

    // Fetch ledger data ONLY if we don't already have it in store
    useEffect(() => {
        // 1. Check if we have specific cached ledger for this unit
        const hasSpecificCache = !!unitLedgerCache[unitId];

        // 2. Check if we have data for this unit in the parent summary list (from Receivables page)
        // We look for any vouchers belonging to this unitId in the outstandingSummary (which contains all vouchers)
        const hasDataInSummary = outstandingSummary &&
            outstandingSummary.length > 0 &&
            outstandingSummary.some(item => String(item.unit_id) === String(unitId));

        // Skip fetch if we already have detailed vouchers from either the specific cache OR the consolidated list
        const canSkipFetch = hasSpecificCache || hasDataInSummary;

        if (unitId && !canSkipFetch && !ledgerLoading) {
            dispatch(fetchUnitLedger({
                unit_id: unitId,
                page: currentPage,
                page_size: itemsPerPage,
                stats: true,
                include_payment_details: false
            }));
        }
    }, [dispatch, unitId, currentPage, unitLedgerCache, outstandingSummary, ledgerLoading]);

    // Handle initial load completion
    useEffect(() => {
        if (!displayLoading && (unitDetailsData || displayLedger.length > 0)) {
            setIsInitialLoad(false);
        }
    }, [displayLoading, unitDetailsData, displayLedger.length]);

    const formatCurrency = (value) => {
        const numericValue = Number(value);
        if (Number.isNaN(numericValue)) return '৳ 0.00';
        return `৳ ${Math.abs(numericValue).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    };

    const formatDate = (dateString) => {
        if (!dateString) return 'N/A';
        try {
            const date = new Date(dateString);
            return date.toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' });
        } catch { return 'N/A'; }
    };

    // Process vouchers for running balance
    const processedTransactions = useMemo(() => {
        if (!displayLedger || displayLedger.length === 0) return [];

        let balance = 0;
        // Sort oldest first (voucherDate or entryDate), fallback to ID
        const sorted = [...displayLedger].sort((a, b) => {
            const dateA = new Date(a.voucherDate || a.voucher_date || 0);
            const dateB = new Date(b.voucherDate || b.voucher_date || 0);
            if (dateA.getTime() !== dateB.getTime()) return dateA - dateB;

            // Stable tie-breaker
            const idA = Number(a.voucher_detail_id || a.id || 0);
            const idB = Number(b.voucher_detail_id || b.id || 0);
            if (idA !== idB) return idA - idB;

            return (a.id || a.voucher_id || 0) - (b.id || b.voucher_id || 0);
        });

        return sorted.map(v => {
            let dr = Number(v.debit || 0);
            let cr = Number(v.credit || 0);

            // ONLY if both are 0, try to infer from details (Legacy/Fallback)
            if (dr === 0 && cr === 0) {
                if (Array.isArray(v.details) && v.details.length > 0) {
                    const arLine = v.details.find(d =>
                        d.account_code === '1200' ||
                        (d.account_name && d.account_name.toLowerCase().includes('receivable'))
                    );

                    if (arLine) {
                        dr = Number(arLine.debit || 0);
                        cr = Number(arLine.credit || 0);
                    } else {
                        // Infer from Voucher Type
                        const type = (v.type || '').toLowerCase();
                        const amount = Number(v.total_amount || v.total_debit || 0);
                        if (type.includes('bill') || type.includes('invoice')) dr = amount;
                        else cr = amount;
                    }
                } else if (v.total_amount) {
                    // Final fallback
                    const type = (v.type || '').toLowerCase();
                    if (type.includes('bill') || type.includes('invoice')) dr = Number(v.total_amount);
                    else cr = Number(v.total_amount);
                }
            }

            const net = dr - cr;
            balance += net;

            const type = v.type || v.voucherType?.name || (dr > 0 ? 'Bill' : 'Receipt');
            const is_advance = !v.service_period_month && (type.includes('Payment') || type.includes('Receipt') || type.includes('ServiceFeePayment'));

            return {
                ...v,
                unit_dr: dr,
                unit_cr: cr,
                running_balance: balance,
                type: type,
                display_type: v.display_name || type,
                is_advance: is_advance,
                date: v.voucherDate || v.voucher_date || v.date,
                reference: v.referenceNumber || v.reference || v.voucher_id || '',
                description: v.narration || v.description || ''
            };
        });
    }, [displayLedger]);

    if (isInitialLoad) {
        return (
            <div className="flex items-center justify-center min-h-screen">
                <ModernLoadingAnimation />
            </div>
        );
    }

    return (
        <PageContainer>
            <ContentBox>
                {/* Header Section */}
                <div className="flex items-center justify-between py-4 mb-4">
                    <div className="flex items-center gap-4">
                        <button
                            onClick={() => navigate('/unit-receivables')}
                            className="p-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-full transition-colors"
                        >
                            <FaArrowLeft size={20} />
                        </button>
                        <div>
                            <h1 className="text-2xl font-bold text-black">{unitDetailsData?.unit_name || displayLedger[0]?.unit_display || 'Unit Ledger'}</h1>
                            <p className="text-sm text-gray-600">
                                {unitDetailsData?.tower_name || displayLedger[0]?.tower_name || 'N/A'} •
                                {unitDetailsData?.resident_name || displayLedger[0]?.resident_name || 'N/A'} •
                                Complete financial ledger
                            </p>
                        </div>
                    </div>
                    <button className="px-4 py-2 bg-primary text-white rounded-md hover:bg-primaryHover transition-colors flex items-center gap-2">
                        <FaDownload className="w-4 h-4" />
                        <span>Export PDF</span>
                    </button>
                </div>

                {/* Financial Summary Cards */}
                {/* Financial Summary Cards */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
                    {/* Current Balance */}
                    {/* Current Balance */}
                    <div className={`${(displaySummary.total_outstanding || displaySummary.balance || 0) < 0 ? 'bg-[#ECFDF5] border-[#D1FAE5]' : 'bg-[#FEF2F2] border-[#FEE2E2]'} border p-4 rounded-xl shadow-sm`}>
                        <div className={`text-sm font-medium ${(displaySummary.total_outstanding || displaySummary.balance || 0) < 0 ? 'text-[#065F46]' : 'text-[#991B1B]'}`}>Current Balance</div>
                        <div className={`text-2xl font-bold ${(displaySummary.total_outstanding || displaySummary.balance || 0) < 0 ? 'text-[#065F46]' : 'text-[#991B1B]'} mt-1`}>{formatCurrency(displaySummary.total_outstanding || displaySummary.balance || 0)}</div>
                        <div className={`text-sm ${(displaySummary.total_outstanding || displaySummary.balance || 0) < 0 ? 'text-[#065F46]' : 'text-[#991B1B]'} mt-1`}>{(displaySummary.total_outstanding || displaySummary.balance || 0) >= 0 ? 'Outstanding (Dr)' : 'Advance (Cr)'}</div>
                    </div>

                    {/* Total Debit */}
                    <div className="bg-[#EFF6FF] border border-[#DBEAFE] p-4 rounded-xl shadow-sm">
                        <div className="text-sm font-medium text-[#1E40AF]">Total Debit</div>
                        <div className="text-2xl font-bold text-[#1E40AF] mt-1">{formatCurrency(displaySummary.total_dr || 0)}</div>
                        <div className="text-sm text-[#1E40AF] mt-1">Total debits charged</div>
                    </div>

                    {/* Total Credit */}
                    <div className="bg-[#ECFDF5] border border-[#D1FAE5] p-4 rounded-xl shadow-sm">
                        <div className="text-sm font-medium text-[#065F46]">Total Credit</div>
                        <div className="text-2xl font-bold text-[#065F46] mt-1">{formatCurrency(displaySummary.total_cr || 0)}</div>
                        <div className="text-sm text-[#065F46] mt-1">Total payments/credits</div>
                    </div>

                    {/* Unpaid Bills (Interactive) */}
                    <div
                        onClick={() => (displaySummary.unpaid_bills_count > 0 || unpaidPayments.length > 0) && setIsUnpaidBillsModalOpen(true)}
                        className={`bg-[#FFFBEB] border border-[#FEF3C7] p-4 rounded-xl shadow-sm ${(displaySummary.unpaid_bills_count > 0 || unpaidPayments.length > 0) ? 'cursor-pointer hover:shadow-md transition-shadow' : ''}`}
                    >
                        <div className="text-sm font-medium text-[#92400E]">Unpaid Bills</div>
                        <div className="text-2xl font-bold text-[#92400E] mt-1">{displaySummary.unpaid_bills_count || unpaidPayments.length}</div>
                        <div className="text-sm text-[#92400E] mt-1">{(displaySummary.unpaid_bills_count > 0 || unpaidPayments.length > 0) ? 'Click to view details' : 'All bills settled'}</div>
                    </div>
                </div>

                {/* Transaction History Table */}
                <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden flex flex-col">
                    <div className="px-6 py-4 border-b border-gray-100 bg-gray-50/30">
                        <h2 className="text-lg font-semibold text-gray-900">Transaction History</h2>
                        <p className="text-xs text-gray-500">Complete ledger with running balance</p>
                    </div>

                    <div className="relative overflow-hidden flex flex-col min-h-0">
                        <div className="overflow-auto flex-1">
                            <table className="min-w-full">
                                <thead className="bg-[#E7F3F2] sticky top-0 z-10 shadow-sm">
                                    <tr className="h-11">
                                        <th className="px-6 py-3 text-sm font-bold text-gray-700 text-left">Date</th>
                                        <th className="px-6 py-3 text-sm font-bold text-gray-700 text-left">Type</th>
                                        <th className="px-6 py-3 text-sm font-bold text-gray-700 text-left">Reference</th>
                                        <th className="px-6 py-3 text-sm font-bold text-gray-700 text-left">Description</th>
                                        <th className="px-6 py-3 text-sm font-bold text-gray-700 text-right">Debit (Dr)</th>
                                        <th className="px-6 py-3 text-sm font-bold text-gray-700 text-right">Credit (Cr)</th>
                                        <th className="px-6 py-3 text-sm font-bold text-gray-700 text-right">Balance</th>
                                    </tr>
                                </thead>
                                <tbody className="bg-white divide-y divide-gray-50">
                                    {ledgerLoading ? (
                                        <tr><td colSpan="7" className="px-6 py-8"><TableSkeleton rows={10} columns={7} /></td></tr>
                                    ) : processedTransactions.length === 0 ? (
                                        <tr><td colSpan="7" className="px-6 py-12 text-center text-gray-400">No Transactions Found</td></tr>
                                    ) : (
                                        processedTransactions.map((v) => (
                                            <tr key={v.id} className="hover:bg-gray-50/50 transition-colors">
                                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{formatDate(v.date)}</td>
                                                <td className="px-6 py-4 whitespace-nowrap">
                                                    <span className={`inline-block px-3 py-1 text-xs font-semibold rounded-full ${v.is_advance ? 'bg-blue-50 text-blue-700 border border-blue-200' :
                                                        (v.type || '').includes('Bill') || (v.display_type || '').includes('Bill') ? 'bg-red-50 text-red-700 border border-red-200' :
                                                            (v.type || '').includes('Receipt') || (v.type || '').includes('Payment') || (v.display_type || '').includes('Receipt') ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' :
                                                                (v.type || '').includes('Penalty') ? 'bg-orange-50 text-orange-700 border border-orange-200' :
                                                                    (v.type || '').includes('Waiver') ? 'bg-green-50 text-green-700 border border-green-200' :
                                                                        'bg-gray-50 text-gray-700 border border-gray-200'
                                                        }`}>
                                                        {v.display_type}
                                                        {v.is_advance && v.advance_status && (
                                                            <span className="ml-1 text-xs opacity-75">({v.advance_status})</span>
                                                        )}
                                                    </span>
                                                    {v.contra_account_name && v.type !== v.contra_account_name && (
                                                        <div className="text-[10px] text-gray-400 mt-1 ml-1">{v.type}</div>
                                                    )}
                                                </td>
                                                <td className="px-6 py-4 text-sm text-gray-900 font-medium">{v.reference}</td>
                                                <td className="px-6 py-4 text-sm text-gray-600 max-w-xs truncate" title={v.description || v.narration}>
                                                    {v.description || v.narration}
                                                    {v.is_advance && v.advance_remaining > 0 && (
                                                        <div className="text-xs text-blue-600 mt-1">
                                                            Available: {formatCurrency(v.advance_remaining)}
                                                        </div>
                                                    )}
                                                </td>
                                                <td className="px-6 py-4 whitespace-nowrap text-sm text-right text-red-600 font-medium">
                                                    {v.unit_dr > 0 ? `${formatCurrency(v.unit_dr)} Dr` : '—'}
                                                </td>
                                                <td className="px-6 py-4 whitespace-nowrap text-sm text-right text-emerald-600 font-medium">
                                                    {v.unit_cr > 0 ? `${formatCurrency(v.unit_cr)} Cr` : '—'}
                                                </td>
                                                <td className={`px-6 py-4 whitespace-nowrap text-sm text-right font-bold ${v.running_balance > 0 ? 'text-red-600' : v.running_balance < 0 ? 'text-emerald-600' : 'text-gray-900'}`}>
                                                    {formatCurrency(v.running_balance)} {v.running_balance > 0 ? 'Dr' : v.running_balance < 0 ? 'Cr' : ''}
                                                </td>
                                            </tr>
                                        ))
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>

                {/* Pagination - Simplified since we show all mostly */}
                {pagination.total_pages > 1 && (
                    <div className="flex items-center justify-between mt-4 px-2">
                        <span className="text-sm text-gray-500">Page {pagination.page} of {pagination.total_pages}</span>
                        <div className="flex gap-2">
                            <button
                                disabled={currentPage === 1}
                                onClick={() => setCurrentPage(p => p - 1)}
                                className="px-4 py-1.5 border border-gray-200 rounded text-sm hover:bg-gray-50 disabled:opacity-50"
                            >Previous</button>
                            <button
                                disabled={currentPage === pagination.total_pages}
                                onClick={() => setCurrentPage(p => p + 1)}
                                className="px-4 py-1.5 border border-gray-200 rounded text-sm hover:bg-gray-50 disabled:opacity-50"
                            >Next</button>
                        </div>
                    </div>
                )}
            </ContentBox>

            <UnpaidBillsModal
                isOpen={isUnpaidBillsModalOpen}
                onClose={() => setIsUnpaidBillsModalOpen(false)}
                unpaidBills={unpaidPayments.map(p => {
                    const months = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
                    const period = (p.service_period_month && p.service_period_year)
                        ? `${months[p.service_period_month - 1]} ${p.service_period_year}`
                        : 'N/A';

                    return {
                        ...p,
                        id: p.payment_id || p.id,
                        description: `Service Fee - ${period}`,
                        dueDate: p.due_date,
                        status: p.service_status || 'due', // CRITICAL: Map service_status to status
                        remainingAmount: parseFloat(p.remaining_amount || 0)
                    };
                })}
                formatCurrency={formatCurrency}
                formatDate={formatDate}
                calculateDaysOverdue={calculateDaysOverdue}
            />
        </PageContainer>
    );
};

export default UnitLedgerPage;
