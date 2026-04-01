import PropTypes from 'prop-types';
import { FaBuilding, FaUser, FaCalendarAlt, FaFileAlt, FaCheckCircle, FaExclamationCircle, FaDownload, FaEye } from 'react-icons/fa';
import EmptyState from '../../../../Components/Ui/EmptyState';
import { useMemo } from 'react';

const PaymentHistoryList = ({ history, onViewReceipt, onDownload }) => {
    if (!history || history.length === 0) {
        return (
            <div className="py-12">
                <EmptyState
                    title="No Payment History Found"
                    description="We couldn't find any recorded payments for this selection."
                    icon={FaFileAlt}
                />
            </div>
        );
    }

    const formatCurrency = (amount) => {
        return new Intl.NumberFormat('en-BD', {
            style: 'currency',
            currency: 'BDT',
            minimumFractionDigits: 0,
            maximumFractionDigits: 0,
        }).format(amount).replace('BDT', '৳');
    };

    const formatDate = (dateString, includeTime = false) => {
        if (!dateString) return 'N/A';
        const date = new Date(dateString);
        if (includeTime) {
            return date.toLocaleString('en-US', {
                month: 'short',
                day: 'numeric',
                year: 'numeric',
                hour: 'numeric',
                minute: '2-digit',
                hour12: true
            });
        }
        return date.toLocaleDateString('en-US', {
            month: 'short',
            day: 'numeric',
            year: 'numeric'
        });
    };

    // Group payments by receipt_id
    const groupedHistory = useMemo(() => {
        const grouped = {};

        history.forEach((record) => {
            // Parse payment details to get receipt_id
            let paymentDetails = [];
            try {
                paymentDetails = typeof record.payment_details === 'string'
                    ? JSON.parse(record.payment_details)
                    : (record.payment_details || []);
            } catch (e) {
                console.error('Error parsing payment_details:', e);
            }

            const primaryTxn = paymentDetails[0] || {};
            const receiptId = primaryTxn.receipt_id || record.receipt_id || record.transaction_id || `txn-${record.payment_id || record.id}`;

            if (!grouped[receiptId]) {
                grouped[receiptId] = {
                    receiptId,
                    records: [],
                    totalAmount: 0,
                    displayDate: primaryTxn.payment_date || record.payment_date || record.created_at,
                    displayMethod: primaryTxn.payment_method || record.payment_method || 'N/A',
                    displayReceipt: receiptId,
                    towerName: record.tower_name,
                    unitDisplay: record.unit_display,
                    primaryName: record.primary_name || record.resident_name || 'N/A',
                    primaryTxn,
                    paymentDetails,
                    advanceAmount: 0,
                };
            }

            grouped[receiptId].records.push(record);
            grouped[receiptId].totalAmount += parseFloat(record.paid_amount || record.total_paid || record.amount || 0);

            // Aggregating advance amount - include if record has advance_amount set
            // or if it's a pure advance (payment_type === 'advance_payment')
            const adv = parseFloat(record.advance_amount || 0);
            if (adv > 0) {
                // For consolidated records, the first record usually has the total advance
                // For expanded records, each allocation might have its own advance portion
                // We use += but ensure we don't overcount if the record itself is just an advance record
                grouped[receiptId].advanceAmount += adv;
            } else if (record.payment_type === 'advance_payment') {
                grouped[receiptId].advanceAmount += parseFloat(record.amount || 0);
            }
        });

        return Object.values(grouped);
    }, [history]);

    return (
        <div className="space-y-4 pb-8">
            {groupedHistory.map((group) => {
                // Aggregate allocations from all records in this group
                const allAllocations = [];

                group.records.forEach((record) => {
                    // Parse allocation data 
                    let allocations = [];
                    try {
                        allocations = typeof record.allocation_details === 'string'
                            ? JSON.parse(record.allocation_details)
                            : (record.allocation_details || []);
                    } catch (e) {
                        console.error('Error parsing allocations:', e);
                    }

                    // Fallback: If no allocations array, check payment_details for individual month breakdowns
                    if (allocations.length === 0) {
                        // Parse payment_details to extract individual month payments
                        let paymentDetails = [];
                        try {
                            paymentDetails = typeof record.payment_details === 'string'
                                ? JSON.parse(record.payment_details)
                                : (record.payment_details || []);
                        } catch (e) {
                            console.error('Error parsing payment_details:', e);
                        }

                        // Create allocation for each payment detail if available
                        if (paymentDetails.length > 0) {
                            paymentDetails.forEach(pd => {
                                const isAdvance = pd.payment_type === 'advance_payment';
                                const monthName = isAdvance ? 'Advance Payment' : (pd.month_name || record.month_name);
                                const month = pd.service_period_month || record.service_period_month;
                                const year = pd.service_period_year || record.service_period_year;

                                if ((monthName && month && year) || isAdvance) {
                                    allocations.push({
                                        month_name: monthName,
                                        month: month,
                                        year: year,
                                        // Use pd.amount, fallback to original_amount, then service_fee_amount
                                        amount: parseFloat(pd.amount  || 0),
                                        // pd.amount_paid = what was actually paid for this bill
                                        paid_amount: parseFloat(pd.amount_paid || 0),
                                        penalty: parseFloat(pd.penalty_amount || 0),
                                        grossPenalty: parseFloat(pd.gross_penalty_amount || pd.penalty_amount || 0),
                                        waived: parseFloat(pd.waived_amount || 0),
                                        status: isAdvance ? 'advance' : (pd.service_status || 'paid')
                                    });
                                }
                            });
                        }

                        // If no valid allocations were created, fall back to single allocation
                        if (allocations.length === 0) {
                            const isAdvance = record.payment_type === 'advance_payment';
                            allocations.push({
                                month_name: isAdvance ? 'Advance Payment' : record.month_name,
                                month: record.service_period_month,
                                year: record.service_period_year,
                                // Fallback to original_amount / service_fee_amount before bill_amount
                                amount: parseFloat(record.original_amount || 0),
                                // record.total_paid_amount = what was paid
                                paid_amount: parseFloat(record.total_paid_amount || record.paid_amount || 0),
                                penalty: parseFloat(record.penalty_amount || 0),
                                grossPenalty: parseFloat(record.gross_penalty_amount || record.penalty_amount || 0),
                                waived: parseFloat(record.waived_amount || 0),
                                status: isAdvance ? 'advance' : (record.service_status || 'paid')
                            });
                        }
                    }

                    allAllocations.push(...allocations);
                });

                // Sort allocations by year and month (FIFO order: oldest first)
                allAllocations.sort((a, b) => {
                    const yearA = parseInt(a.year || a.service_period_year || 0);
                    const yearB = parseInt(b.year || b.service_period_year || 0);
                    const monthA = parseInt(a.month || a.service_period_month || 0);
                    const monthB = parseInt(b.month || b.service_period_month || 0);

                    if (yearA !== yearB) return yearA - yearB;
                    return monthA - monthB;
                });

                const hasAdvance = group.advanceAmount > 0;

                // Create enriched record for receipt modal (use first record as base)
                const baseRecord = group.records[0];
                const enrichedRecord = {
                    ...baseRecord,
                    receipt_id: group.displayReceipt,
                    transaction_id: group.primaryTxn.transaction_id || baseRecord.transaction_id || 'N/A',
                    payment_date: group.displayDate,
                    payment_method: group.displayMethod,
                    resident_email: baseRecord.primary_email || baseRecord.resident_email || 'N/A',
                    paid_amount: group.totalAmount,
                    advance_amount: group.advanceAmount,
                    // Include all records for comprehensive receipt view
                    grouped_records: group.records,
                    parsed_payment_details: group.paymentDetails,
                    parsed_allocations: allAllocations
                };

                return (
                    <div key={group.receiptId} className="bg-white border border-gray-200 rounded-xl shadow-sm hover:shadow-md transition-shadow overflow-x-auto custom-scrollbar">
                        <div className="p-6 relative min-w-[850px] lg:min-w-full">
                            {/* Checkmark Icon - Positioned Absolutely */}
                            <div className="absolute left-6 top-7 w-10 h-10 bg-emerald-50 rounded-lg flex items-center justify-center">
                                <FaCheckCircle className="w-5 h-5 text-emerald-500" />
                            </div>

                            {/* Card Header - Tower Info and Buttons */}
                            <div className="flex justify-between items-start mb-6 pl-14">
                                <div className="flex-1 max-w-[90%]">
                                    <div className="flex items-center gap-2 mb-2">
                                        <h3 className="text-base font-bold text-gray-900">
                                            {group.towerName} - Unit {group.unitDisplay}
                                        </h3>
                                        <span className={`px-2 py-0.5 rounded text-xs font-semibold ${group.displayMethod === 'Cash' ? 'bg-emerald-100 text-emerald-700' : 'bg-blue-100 text-blue-700'
                                            }`}>
                                            {group.displayMethod}
                                        </span>
                                        {hasAdvance && (
                                            <span className="bg-purple-50 text-purple-600 px-2 py-0.5 rounded text-xs font-semibold flex items-center gap-1">
                                                <span className="text-[10px]">↗</span> {formatCurrency(group.advanceAmount)} advance
                                            </span>
                                        )}
                                    </div>

                                    {/* Info Grid */}
                                    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-gray-600">
                                        <div className="flex items-center gap-1.5">
                                            <FaUser className="w-3 h-3 text-gray-400" />
                                            <span className="font-medium text-gray-700">{group.primaryName}</span>
                                        </div>
                                        <div className="flex items-center gap-1.5">
                                            <FaCalendarAlt className="w-3 h-3 text-gray-400" />
                                            <span className="font-medium text-gray-700">{formatDate(group.displayDate)}</span>
                                        </div>
                                        <div className="flex items-center gap-1.5">
                                            <FaFileAlt className="w-3 h-3 text-gray-400" />
                                            <span className="font-medium text-gray-700 uppercase tracking-tight">
                                                {group.displayReceipt}
                                            </span>
                                        </div>
                                        <div className="flex items-center gap-1.5">
                                            <FaBuilding className="w-3 h-3 text-gray-400" />
                                            <span className="font-medium text-gray-700">
                                                {(() => {
                                                    const billCount = allAllocations.filter(a => a.month_name !== 'Advance Payment').length;
                                                    return `${billCount} ${billCount === 1 ? 'bill' : 'bills'} paid`;
                                                })()}
                                            </span>
                                        </div>
                                    </div>
                                </div>

                                {/* Right Side - Amount and Buttons */}
                                <div className="flex items-start gap-3 flex-shrink-0">
                                    <div className="text-right">
                                        <div className="text-[10px] text-gray-500 uppercase tracking-wider mb-1 font-semibold">Total Amount</div>
                                        <div className="text-2xl font-extrabold text-[#3D9D9B]">
                                            {formatCurrency(group.totalAmount)}
                                        </div>
                                        <div className="text-[10px] text-gray-400 font-medium mt-0.5">
                                            {formatDate(group.displayDate, true)}
                                        </div>
                                    </div>

                                    {/* Action Buttons */}
                                    <div className="flex flex-col gap-2">
                                        <button
                                            onClick={() => onViewReceipt(enrichedRecord)}
                                            className="flex items-center justify-center gap-2 px-4 py-2 border border-teal-600 rounded-lg text-xs font-semibold text-teal-600 hover:bg-teal-50 transition-colors bg-white shadow-sm whitespace-nowrap"
                                        >
                                            <FaEye className="w-3.5 h-3.5" />
                                            View Receipt
                                        </button>
                                        <button
                                            onClick={() => onDownload && onDownload(enrichedRecord)}
                                            className="flex items-center justify-center gap-2 px-4 py-2 border border-teal-600 rounded-lg text-xs font-semibold text-teal-600 hover:bg-teal-50 transition-colors bg-white shadow-sm whitespace-nowrap"
                                        >
                                            <FaDownload className="w-3.5 h-3.5" />
                                            Download
                                        </button>
                                    </div>
                                </div>
                            </div>

                            {/* Payment Allocation Section */}
                            <div className="mt-6 lg:pl-14">
                                <div className="bg-[#f8fafc] rounded-2xl p-6 border border-slate-200 shadow-sm max-w-5xl">
                                    <div className="flex items-center gap-2 mb-4">
                                        <div className="w-8 h-8 bg-white border border-slate-200 rounded-lg flex items-center justify-center shadow-sm">
                                            <FaFileAlt className="text-teal-600" />
                                        </div>
                                        <div className="text-xs font-black text-slate-800 tracking-widest">Payment Allocation</div>
                                    </div>

                                    <div className="overflow-hidden border border-slate-200 rounded-xl bg-white mb-6">
                                        <table className="w-full text-xs">
                                            <thead>
                                                <tr className="bg-slate-50 text-slate-500 border-b border-slate-200">
                                                    <th className="text-left py-3 px-4 font-bold uppercase tracking-wider">Bill Month</th>
                                                    <th className="text-right py-3 px-2 font-bold uppercase tracking-wider">Bill Amount</th>
                                                    <th className="text-right py-3 px-2 font-bold uppercase tracking-wider">Gross Penalty</th>
                                                    <th className="text-right py-3 px-2 font-bold uppercase tracking-wider">Waived</th>
                                                    <th className="text-right py-3 px-2 font-bold uppercase tracking-wider">Amount Paid</th>
                                                    <th className="text-center py-3 px-4 font-bold uppercase tracking-wider">Status</th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-slate-100">
                                                {allAllocations.map((alloc, idx) => (
                                                    <tr key={idx} className="group transition-colors">
                                                        <td className="py-4 px-4 font-bold text-slate-800 whitespace-nowrap text-sm">{alloc.month_name}</td>
                                                        <td className="text-right py-4 px-2 text-slate-600 font-medium">{formatCurrency(alloc.amount)}</td>
                                                        <td className="text-right py-4 px-2 text-red-400 font-medium">{alloc.grossPenalty > 0 ? formatCurrency(alloc.grossPenalty) : '-'}</td>
                                                        <td className="text-right py-4 px-2 text-emerald-500 font-medium">{alloc.waived > 0 ? formatCurrency(alloc.waived) : '-'}</td>
                                                        <td className="text-right py-4 px-2 font-bold text-teal-600 text-sm">{formatCurrency(alloc.paid_amount)}</td>
                                                        <td className="text-center py-4 px-4">
                                                            <span className={`inline-flex items-center px-2.5 py-0.5 rounded-md text-[10px] font-black uppercase tracking-tighter ${alloc.status === 'paid' ? 'bg-emerald-100 text-emerald-700'
                                                                : alloc.status === 'partial' ? 'bg-amber-100 text-amber-700'
                                                                    : alloc.status === 'overdue' ? 'bg-red-100 text-red-700'
                                                                        : alloc.status === 'advance' ? 'bg-purple-100 text-purple-700'
                                                                            : 'bg-emerald-100 text-emerald-700'
                                                                }`}>
                                                                {alloc.status === 'paid' ? 'Paid'
                                                                    : alloc.status === 'partial' ? 'Partial'
                                                                        : alloc.status === 'overdue' ? 'Overdue'
                                                                            : alloc.status === 'advance' ? 'Advance'
                                                                                : alloc.status || 'Paid'}
                                                            </span>
                                                        </td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>

                                    {/* Detailed Summary Section */}
                                    <div className="bg-white border border-slate-100 rounded-xl p-5 space-y-3 shadow-sm">
                                        <div className="flex justify-between items-center text-sm font-bold text-slate-500">
                                            <span>Subtotal (Bills Payment)</span>
                                            <span className="text-slate-900 font-black">{formatCurrency(parseFloat(group.totalAmount) - parseFloat(group.advanceAmount))}</span>
                                        </div>

                                        {parseFloat(group.advanceAmount) > 0 && (
                                            <div className="flex justify-between items-center text-sm font-bold text-slate-500">
                                                <span>Advance Payment (Future Bills)</span>
                                                <span className="text-purple-600 font-black">{formatCurrency(group.advanceAmount)}</span>
                                            </div>
                                        )}

                                        <div className="pt-3 border-t border-slate-100 flex justify-between items-center">
                                            <span className="text-base font-black text-slate-800 tracking-tight">Total Amount Paid</span>
                                            <span className="text-2xl font-black text-teal-600 tracking-tighter">
                                                {formatCurrency(group.totalAmount)}
                                            </span>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                );
            })}
        </div>
    );
};

PaymentHistoryList.propTypes = {
    history: PropTypes.array.isRequired,
    onViewReceipt: PropTypes.func.isRequired,
    onDownload: PropTypes.func
};

export default PaymentHistoryList;
