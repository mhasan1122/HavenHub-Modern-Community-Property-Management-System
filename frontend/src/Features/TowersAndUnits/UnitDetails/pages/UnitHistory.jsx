import { useEffect, useMemo, useState, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useDispatch, useSelector } from "react-redux";
import { motion, AnimatePresence } from "framer-motion";
import { FaArrowLeft, FaUser, FaCalendar, FaPhone, FaEnvelope, FaChartLine, FaExchangeAlt, FaHistory, FaUserPlus, FaUserMinus, FaUserTag, FaMoneyBillWave, FaClock } from "react-icons/fa";
import PageContainer from "../../../../Components/Ui/PageContainer";
import ModernLoadingAnimation from "../../../../Components/Loaders/ModernLoadingAnimation";
import EmptyState from "../../../../Components/Ui/EmptyState";
import AnimatedTabs from "../../../../Components/Tabs/AnimatedTabs";
import ImageSlider from "../../../../Components/Modal/ImageSlider";
import DocumentViewer from "../../../../Components/FileViewer/DocumentViewer";
import { fetchUnitOwnershipHistory, clearOwnershipHistory } from "../../../../redux/slices/owner/ownerSlice";
import { fetchUnitStaffHistory, clearStaffHistory } from "../../../../redux/slices/unitStaff/unitStaffSlice";
import { fetchUnitResidentHistory, clearResidentHistory } from "../../../../redux/slices/residents/residentSlice";

// ========== UTILS & CONSTANTS ==========

const formatDate = (dateString) => {
  if (!dateString) return "";
  const date = new Date(dateString);
  const months = [
    "Jan", "Feb", "Mar", "Apr", "May", "Jun",
    "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"
  ];
  return `${months[date.getMonth()]} ${date.getDate()}, ${date.getFullYear()}`;
};

const getOwnerEntryTypeInfo = (type) => {
  switch (type) {
    case "initial_ownership":
    case "initial_ownership_list":
      return {
        title: type === "initial_ownership" ? "Initial Ownership" : "Initial Ownership List",
        badge: "Ownership",
        badgeColor: "bg-primary text-white",
        icon: <FaChartLine className="w-5 h-5 text-white" />,
        iconBg: "bg-primary"
      };
    case "ownership_transfer":
      return {
        title: "Ownership Transfer",
        badge: "Transfer",
        badgeColor: "bg-indigo-100 text-indigo-800 border border-indigo-200",
        icon: <FaExchangeAlt className="w-5 h-5 text-indigo-600" />,
        iconBg: "bg-indigo-50 border border-indigo-200"
      };
    case "ownership_updated":
    case "ownership_list_updated":
      return {
        title: type === "ownership_updated" ? "Ownership Updated" : "Ownership List Updated",
        badge: "Ownership",
        badgeColor: "bg-primary text-white",
        icon: <FaChartLine className="w-5 h-5 text-white" />,
        iconBg: "bg-primary"
      };
    case "attachment_added":
    case "attachment_removed":
      return {
        title: type === "attachment_added" ? "Attachment Added" : "Attachment Removed",
        badge: "Attachment",
        badgeColor: "bg-amber-100 text-amber-800 border border-amber-200",
        icon: <FaHistory className="w-5 h-5 text-amber-600" />,
        iconBg: "bg-amber-50 border border-amber-200"
      };
    default:
      return {
        title: type,
        badge: "Ownership",
        badgeColor: "bg-gray-200 text-gray-700",
        icon: <FaChartLine className="w-5 h-5 text-white" />,
        iconBg: "bg-gray-500"
      };
  }
};

const getResidentEntryTypeInfo = (type, description = "") => {
  // Check if this is an info update with specific field changes
  const isInfoUpdate = type === "resident_info_updated";

  // Detect specific change types from description
  const descLower = description.toLowerCase();
  const hasRentChange = descLower.includes("rent amount changed") || descLower.includes("rent");
  const hasAdvanceChange = descLower.includes("advance payment") || descLower.includes("advance");
  const hasNoticePeriodChange = descLower.includes("notice period");
  const hasAttachmentChange = descLower.includes("attachment");
  const hasProfileChange = descLower.includes("name changed") || descLower.includes("contact changed") || descLower.includes("email changed");

  switch (type) {
    case "resident_assigned":
      return {
        title: "Resident Assigned",
        badge: "Assignment",
        badgeColor: "bg-teal-100 text-teal-800 border border-teal-200",
        icon: <FaUserPlus className="w-5 h-5 text-teal-600" />,
        iconBg: "bg-teal-50 border border-teal-200"
      };
    case "resident_removed":
      return {
        title: "Resident Removed",
        badge: "Removal",
        badgeColor: "bg-orange-100 text-orange-800 border border-orange-200",
        icon: <FaUserMinus className="w-5 h-5 text-orange-500" />,
        iconBg: "bg-orange-50 border border-orange-200"
      };
    case "resident_status_changed":
      return {
        title: "Resident Status Changed",
        badge: "Status Change",
        badgeColor: "bg-purple-100 text-purple-800 border border-purple-200",
        icon: <FaExchangeAlt className="w-5 h-5 text-purple-500" />,
        iconBg: "bg-purple-50 border border-purple-200"
      };
    case "attachment_added":
      return {
        title: "Attachment Added",
        badge: "Attachment",
        badgeColor: "bg-amber-100 text-amber-800 border border-amber-200",
        icon: <FaHistory className="w-5 h-5 text-amber-600" />,
        iconBg: "bg-amber-50 border border-amber-200"
      };
    case "attachment_removed":
      return {
        title: "Attachment Removed",
        badge: "Attachment",
        badgeColor: "bg-amber-100 text-amber-800 border border-amber-200",
        icon: <FaHistory className="w-5 h-5 text-amber-600" />,
        iconBg: "bg-amber-50 border border-amber-200"
      };
    case "resident_info_updated":
      // Determine specific change type for better labeling
      if (hasRentChange && !hasAdvanceChange && !hasNoticePeriodChange && !hasAttachmentChange) {
        return {
          title: "Rent Amount Changed",
          badge: "Status Change",
          badgeColor: "bg-emerald-100 text-emerald-800 border border-emerald-200",
          icon: <FaExchangeAlt className="w-5 h-5 text-emerald-500" />,
          iconBg: "bg-emerald-50 border border-emerald-200",
          changeType: "rent"
        };
      } else if (hasAdvanceChange && !hasRentChange && !hasNoticePeriodChange && !hasAttachmentChange) {
        return {
          title: "Advance Payment Changed",
          badge: "Status Change",
          badgeColor: "bg-cyan-100 text-cyan-800 border border-cyan-200",
          icon: <FaExchangeAlt className="w-5 h-5 text-cyan-500" />,
          iconBg: "bg-cyan-50 border border-cyan-200",
          changeType: "advance"
        };
      } else if (hasNoticePeriodChange && !hasRentChange && !hasAdvanceChange && !hasAttachmentChange) {
        return {
          title: "Notice Period Changed",
          badge: "Status Change",
          badgeColor: "bg-violet-100 text-violet-800 border border-violet-200",
          icon: <FaExchangeAlt className="w-5 h-5 text-violet-500" />,
          iconBg: "bg-violet-50 border border-violet-200",
          changeType: "notice_period"
        };
      } else if (hasAttachmentChange && !hasRentChange && !hasAdvanceChange && !hasNoticePeriodChange && !hasProfileChange) {
        return {
          title: "Attachments Updated",
          badge: "Status Change",
          badgeColor: "bg-amber-100 text-amber-800 border border-amber-200",
          icon: <FaHistory className="w-5 h-5 text-amber-500" />,
          iconBg: "bg-amber-50 border border-amber-200",
          changeType: "attachment"
        };
      } else if (hasProfileChange) {
        return {
          title: "Profile Information Updated",
          badge: "Profile Update",
          badgeColor: "bg-indigo-100 text-indigo-800 border border-indigo-200",
          icon: <FaUserTag className="w-5 h-5 text-indigo-500" />,
          iconBg: "bg-indigo-50 border border-indigo-200",
          changeType: "profile"
        };
      } else {
        // Multiple changes or general update
        return {
          title: "Resident Info Updated",
          badge: "Update",
          badgeColor: "bg-blue-100 text-blue-800 border border-blue-200",
          icon: <FaHistory className="w-5 h-5 text-blue-500" />,
          iconBg: "bg-blue-50 border border-blue-200",
          changeType: "multiple"
        };
      }
    default:
      return {
        title: type,
        badge: "Resident",
        badgeColor: "bg-gray-100 text-gray-800 border border-gray-200",
        icon: <FaUser className="w-5 h-5 text-gray-700" />,
        iconBg: "bg-gray-50 border border-gray-200"
      };
  }
};

const getStaffEntryTypeInfo = (type) => {
  switch (type) {
    case "staff_assigned":
      return {
        title: "Staff Assigned",
        badge: "Assignment",
        badgeColor: "bg-primary text-white",
        badgeStyle: { backgroundColor: "#3C9D9B", color: "#ffffff" },
        icon: <FaUserPlus className="w-5 h-5" style={{ color: "#ffffff" }} />,
        iconBg: "bg-primary",
        iconBgStyle: { backgroundColor: "#3C9D9B" }
      };
    case "staff_removed":
      return {
        title: "Staff Removed",
        badge: "Removal",
        badgeColor: "bg-red-100 text-red-800 border border-red-200",
        badgeStyle: {},
        icon: <FaUserMinus className="w-5 h-5 text-red-500" />,
        iconBg: "bg-red-50 border border-red-200",
        iconBgStyle: {}
      };
    case "staff_status_changed":
      return {
        title: "Staff Status Changed",
        badge: "Status Change",
        badgeColor: "bg-blue-100 text-blue-800 border border-blue-200",
        badgeStyle: {},
        icon: <FaExchangeAlt className="w-5 h-5 text-blue-500" />,
        iconBg: "bg-blue-50 border border-blue-200",
        iconBgStyle: {}
      };
    default:
      return {
        title: type,
        badge: "Staff",
        badgeColor: "bg-gray-100 text-gray-800 border border-gray-200",
        badgeStyle: {},
        icon: <FaUser className="w-5 h-5 text-gray-700" />,
        iconBg: "bg-gray-50 border border-gray-200",
        iconBgStyle: {}
      };
  }
};

// ========== SHARED UI COMPONENTS ==========

const HistoryCard = ({ name, statusLabel, date, contact, email, isResidentOrTenant, isStaff, attachments, onAttachmentClick, unitRentFee, advancePayment, noticePeriod }) => {
  return (
  <div className="bg-slate-50 rounded-lg p-4 space-y-3 border border-slate-200 h-full">
    <div className="flex items-center gap-2">
      <FaUser className="w-4 h-4 text-gray-500" />
      <span className="text-sm text-gray-600">Name</span>
      <span className="text-sm font-medium text-gray-900 ml-2">{name || "Unknown"}</span>
    </div>
    {statusLabel && (
      <div className="flex items-center gap-2">
        {isStaff ? <FaExchangeAlt className="w-4 h-4 text-gray-500" /> : <FaUserTag className="w-4 h-4 text-gray-500" />}
        <span className="text-sm text-gray-600">Status</span>
        <span className={`text-sm font-medium ml-2 ${isResidentOrTenant ? 'text-teal-600' : isStaff ? 'text-blue-600' : 'text-orange-600'}`}>
          {statusLabel}
        </span>
      </div>
    )}
    {date && (
      <div className="flex items-center gap-2">
        <FaCalendar className="w-4 h-4 text-gray-500" />
        <span className="text-sm text-gray-600">Date</span>
        <span className="text-sm font-medium text-gray-900 ml-2">{formatDate(date)}</span>
      </div>
    )}
    {contact && (
      <div className="flex items-center gap-2">
        <FaPhone className="w-4 h-4 text-gray-500" />
        <span className="text-sm text-gray-600">Contact</span>
        <span className="text-sm font-medium text-gray-900 ml-2">{contact}</span>
      </div>
    )}
    {email && (
      <div className="flex items-center gap-2">
        <FaEnvelope className="w-4 h-4 text-gray-500" />
        <span className="text-sm text-gray-600">Email</span>
        <span className="text-sm font-medium text-gray-900 ml-2 text-ellipsis overflow-hidden">{email}</span>
      </div>
    )}
    {/* Tenant-specific fields - only show for tenants (isResidentOrTenant === false), not regular residents or staff */}
    {!isStaff && isResidentOrTenant === false && (unitRentFee !== undefined && unitRentFee !== null) && (
      <div className="flex items-center gap-2">
        <FaMoneyBillWave className="w-4 h-4 text-gray-500" />
        <span className="text-sm text-gray-600">Rent</span>
        <span className="text-sm font-medium text-gray-900 ml-2">BDT {parseFloat(unitRentFee || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
      </div>
    )}
    {!isStaff && isResidentOrTenant === false && (advancePayment !== undefined && advancePayment !== null) && (
      <div className="flex items-center gap-2">
        <FaMoneyBillWave className="w-4 h-4 text-gray-500" />
        <span className="text-sm text-gray-600">Advance</span>
        <span className="text-sm font-medium text-gray-900 ml-2">BDT {parseFloat(advancePayment || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
      </div>
    )}
    {!isStaff && isResidentOrTenant === false && (noticePeriod !== undefined && noticePeriod !== null) && noticePeriod > 0 && (
      <div className="flex items-center gap-2">
        <FaClock className="w-4 h-4 text-gray-500" />
        <span className="text-sm text-gray-600">Notice Period</span>
        <span className="text-sm font-medium text-gray-900 ml-2">{noticePeriod} month(s)</span>
      </div>
    )}
    {attachments && Array.isArray(attachments) && attachments.length > 0 && (
      <div className="flex flex-col gap-2 pt-2 border-t border-slate-300">
        <div className="flex items-center gap-2">
          <FaHistory className="w-4 h-4 text-amber-600" />
          <span className="text-sm text-gray-600">Attachments</span>
        </div>
        <div className="space-y-1">
          {attachments.map((attachment, idx) => {
            const fileName = attachment.name || `Attachment ${idx + 1}`;
            return (
              <button
                type="button"
                key={attachment.id || idx}
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  if (onAttachmentClick) {
                    onAttachmentClick(attachment, attachments);
                  } else {
                    const fileUrl = attachment.url || attachment.file_url || attachment.src;
                    if (fileUrl) {
                      window.open(fileUrl, '_blank', 'noopener,noreferrer');
                    }
                  }
                }}
                className="text-sm text-amber-700 hover:text-amber-900 hover:underline flex items-center gap-1 cursor-pointer text-left bg-transparent border-none p-0"
              >
                <span className="truncate">{fileName}</span>
              </button>
            );
          })}
        </div>
      </div>
    )}
  </div>
  );
};

const OwnerCard = ({ name, share, date, contact, email, attachments, onAttachmentClick }) => {
  return (
  <div className="bg-slate-50 rounded-lg p-4 space-y-3 border border-slate-200">
    <div className="flex items-center gap-2">
      <FaUser className="w-4 h-4 text-gray-500" />
      <span className="text-sm text-gray-600">Name</span>
      <span className="text-sm font-medium text-gray-900 ml-2">{name || "Unknown"}</span>
    </div>
    <div className="flex items-center gap-2">
      <FaChartLine className="w-4 h-4 text-gray-500" />
      <span className="text-sm text-gray-600">Ownership Share</span>
      <span className="text-sm font-medium text-gray-900 ml-2">
        {typeof share === "number" ? share.toFixed(2) : parseFloat(share || 0).toFixed(2)}%
      </span>
    </div>
    {date && (
      <div className="flex items-center gap-2">
        <FaCalendar className="w-4 h-4 text-gray-500" />
        <span className="text-sm text-gray-600">Purchase</span>
        <span className="text-sm font-medium text-gray-900 ml-2">{formatDate(date)}</span>
      </div>
    )}
    {contact && (
      <div className="flex items-center gap-2">
        <FaPhone className="w-4 h-4 text-gray-500" />
        <span className="text-sm text-gray-600">Contact</span>
        <span className="text-sm font-medium text-gray-900 ml-2">{contact}</span>
      </div>
    )}
    {email && (
      <div className="flex items-center gap-2">
        <FaEnvelope className="w-4 h-4 text-gray-500" />
        <span className="text-sm text-gray-600">Email</span>
        <span className="text-sm font-medium text-gray-900 ml-2">{email}</span>
      </div>
    )}
    {attachments && Array.isArray(attachments) && attachments.length > 0 && (
      <div className="flex flex-col gap-2 pt-2 border-t border-slate-300">
        <div className="flex items-center gap-2">
          <FaHistory className="w-4 h-4 text-amber-600" />
          <span className="text-sm text-gray-600">Attachments</span>
        </div>
        <div className="space-y-1">
          {attachments.map((attachment, idx) => {
            const fileName = attachment.name || `Attachment ${idx + 1}`;
            const fileUrl = attachment.url;
            const isImage = /\.(jpg|jpeg|png|gif|bmp|webp)$/i.test(fileName);
            const isPDF = /\.pdf$/i.test(fileName);
            const isDocument = /\.(doc|docx)$/i.test(fileName);
            
            return (
              <button
                type="button"
                key={attachment.id || idx}
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  console.log('🔍 OwnerCard: Button clicked for attachment:', attachment);
                  console.log('🔍 OwnerCard: Handler available:', !!onAttachmentClick);
                  if (onAttachmentClick) {
                    onAttachmentClick(attachment, attachments);
                  } else {
                    console.error('❌ OwnerCard: onAttachmentClick handler not provided');
                    // Fallback: open directly
                    const fileUrl = attachment.url || attachment.file_url || attachment.src;
                    if (fileUrl) {
                      window.open(fileUrl, '_blank', 'noopener,noreferrer');
                    }
                  }
                }}
                className="text-sm text-amber-700 hover:text-amber-900 hover:underline flex items-center gap-1 cursor-pointer text-left bg-transparent border-none p-0"
              >
                <span className="truncate">{fileName}</span>
              </button>
            );
          })}
        </div>
      </div>
    )}
  </div>
  );
};

// ========== ENTRY COMPONENTS ==========

const ResidentHistoryEntry = ({ entry, onAttachmentClick }) => {
  const typeInfo = getResidentEntryTypeInfo(entry.type, entry.description);
  const residentMember = entry.resident_member;
  const isStatusChange = entry.type === "resident_status_changed";
  const isRemoval = entry.type === "resident_removed";
  const isAssignment = entry.type === "resident_assigned";
  const isUpdate = entry.type === "resident_info_updated";

  const displayInfo = useMemo(() => {
    // Determine snapshot first to retrieve assignment_date if available
    const before = entry.resident_state_before || [];
    const after = entry.resident_state_after || [];
    let snapshot = null;

    // For attachment entries, find the resident that matches the entry's resident_member
    if (entry.type === "attachment_added" || entry.type === "attachment_removed") {
      if (entry.resident_member) {
        snapshot = after.find(r => 
          r.member_id === entry.resident_member.id || 
          r.resident_id === entry.resident_member.id ||
          r.name === (entry.resident_member.name || entry.resident_member.full_name)
        ) || after[0];
      } else {
        snapshot = after[0];
      }
    } else if (isRemoval) {
      // Find the one in 'before' that's not in 'after'
      snapshot = before.find(b => !after.some(a => (a.member_id === b.member_id || a.resident_id === b.resident_id))) || before[0];
    } else {
      snapshot = after[0];
    }

    const assignmentDate = snapshot?.assignment_date || null;

    // 1. Try top-level standalone fields from API (best for deleted members)
    if (entry.resident_name) {
      return {
        name: entry.resident_name,
        contact: entry.resident_contact,
        email: entry.resident_email,
        isResidentOrTenant: entry.is_resident_or_tenant,
        statusLabel: entry.status_label,
        assignment_date: assignmentDate,
        unitRentFee: snapshot?.unit_rent_fee,
        advancePayment: snapshot?.advance_payment,
        noticePeriod: snapshot?.notice_period
      };
    }

    // 2. Try nested member object
    if (residentMember) {
      return {
        name: residentMember.name || residentMember.full_name,
        contact: residentMember.contact || residentMember.general_contact,
        email: residentMember.email || residentMember.general_email,
        isResidentOrTenant: entry.is_resident_or_tenant,
        statusLabel: entry.status_label,
        assignment_date: assignmentDate,
        unitRentFee: snapshot?.unit_rent_fee,
        advancePayment: snapshot?.advance_payment,
        noticePeriod: snapshot?.notice_period
      };
    }

    // 3. Fallback to snapshots
    if (snapshot) {
      return {
        name: snapshot.name,
        contact: snapshot.contact,
        email: snapshot.email,
        isResidentOrTenant: snapshot.is_resident_or_tenant,
        statusLabel: snapshot.status_label,
        assignment_date: snapshot.assignment_date,
        unitRentFee: snapshot.unit_rent_fee,
        advancePayment: snapshot.advance_payment,
        noticePeriod: snapshot.notice_period
      };
    }

    return null;
  }, [entry, residentMember, isRemoval]);

  // Extract field change data from resident state
  const fieldChanges = useMemo(() => {
    if (!isUpdate || !entry.resident_state_before || !entry.resident_state_after) return null;

    const before = entry.resident_state_before.find(r =>
      r.name === displayInfo?.name || r.resident_id === entry.resident_member?.id
    );
    const after = entry.resident_state_after.find(r =>
      r.name === displayInfo?.name || r.resident_id === entry.resident_member?.id
    );

    if (!before || !after) return null;

    return {
      rent: {
        before: before.unit_rent_fee,
        after: after.unit_rent_fee,
        changed: before.unit_rent_fee !== after.unit_rent_fee
      },
      advance: {
        before: before.advance_payment,
        after: after.advance_payment,
        changed: before.advance_payment !== after.advance_payment
      },
      noticePeriod: {
        before: before.notice_period,
        after: after.notice_period,
        changed: before.notice_period !== after.notice_period
      },
      attachments: {
        before: before.attachment_count,
        after: after.attachment_count,
        changed: before.attachment_count !== after.attachment_count
      },
      name: {
        before: before.name,
        after: after.name,
        changed: before.name !== after.name
      },
      contact: {
        before: before.contact,
        after: after.contact,
        changed: before.contact !== after.contact
      },
      email: {
        before: before.email,
        after: after.email,
        changed: before.email !== after.email
      }
    };
  }, [isUpdate, entry, displayInfo]);

  // Calculate duration for removed residents
  const duration = useMemo(() => {
    if (!isRemoval || !displayInfo?.assignment_date || !entry.date) return null;

    const start = new Date(displayInfo.assignment_date);
    const end = new Date(entry.date);
    const diffTime = Math.abs(end - start);
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    // Calculate precise duration
    let years = end.getFullYear() - start.getFullYear();
    let months = end.getMonth() - start.getMonth();
    let days = end.getDate() - start.getDate();

    if (days < 0) {
      months--;
      // Approximate days in previous month
      days += new Date(end.getFullYear(), end.getMonth(), 0).getDate();
    }
    if (months < 0) {
      years--;
      months += 12;
    }

    const parts = [];
    if (years > 0) parts.push(`${years} year${years > 1 ? 's' : ''}`);
    if (months > 0) parts.push(`${months} month${months > 1 ? 's' : ''}`);
    if (days > 0 && years === 0) parts.push(`${days} day${days > 1 ? 's' : ''}`); // Only show days if less than a year

    if (parts.length === 0) return "Less than 1 day";
    return parts.join(', ');
  }, [isRemoval, displayInfo, entry.date]);

  return (
    <div className="bg-white rounded-lg border border-gray-200 p-5 mb-4 shadow-sm hover:shadow-md transition-shadow">
      <div className="flex items-start gap-3 mb-3">
        <div className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 ${typeInfo.iconBg}`}>
          {typeInfo.icon}
        </div>
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-1">
            <h3 className="text-lg font-semibold text-gray-900">{typeInfo.title}</h3>
            {typeInfo.badge && (
              <span className={`text-xs px-2 py-1 rounded-full font-medium ${typeInfo.badgeColor}`}>
                {typeInfo.badge}
              </span>
            )}
          </div>
          <p className="text-sm text-gray-500">{formatDate(entry.date)}</p>
          {displayInfo && (
            <p className="text-sm text-gray-700 mt-1">
              Resident: <span className="font-medium">{displayInfo.name}</span>
            </p>
          )}
        </div>
      </div>
      {entry.description && (
        <div className="ml-12 mb-3 text-sm text-gray-600 italic">
          {entry.description.replace(/^Resident\s+/i, '').replace(/\s+via Excel upload$/i, '')}
        </div>
      )}
      <div className="ml-12">
        {isStatusChange ? (
          <div className="space-y-4">
            <div className="space-y-2">
              <div className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Before</div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {(entry.resident_state_before || [])
                  .filter(r => displayInfo && (
                    r.member_id === entry.resident_member?.id || 
                    r.name === displayInfo.name ||
                    r.resident_id === entry.resident_member?.id
                  ))
                  .map((res, idx) => (
                    <HistoryCard 
                      key={idx} 
                      name={res.name} 
                      statusLabel={res.status_label} 
                      date={res.assignment_date} 
                      contact={res.contact} 
                      email={res.email} 
                      isResidentOrTenant={res.is_resident_or_tenant}
                      attachments={res.attachments || []}
                      onAttachmentClick={onAttachmentClick}
                      unitRentFee={res.unit_rent_fee}
                      advancePayment={res.advance_payment}
                      noticePeriod={res.notice_period}
                    />
                  ))}
              </div>
            </div>
            <div className="flex items-center justify-center py-1">
              <div className="flex items-center gap-2 text-purple-600">
                <FaExchangeAlt className="w-4 h-4" />
                <span className="text-xs font-medium">Status Changed</span>
              </div>
            </div>
            <div className="space-y-2">
              <div className="text-xs font-semibold text-gray-500 uppercase tracking-wider">After</div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {(entry.resident_state_after || [])
                  .filter(r => displayInfo && (
                    r.member_id === entry.resident_member?.id || 
                    r.name === displayInfo.name ||
                    r.resident_id === entry.resident_member?.id
                  ))
                  .map((res, idx) => (
                    <HistoryCard 
                      key={idx} 
                      name={res.name} 
                      statusLabel={res.status_label} 
                      date={res.assignment_date} 
                      contact={res.contact} 
                      email={res.email} 
                      isResidentOrTenant={res.is_resident_or_tenant}
                      attachments={res.attachments || []}
                      onAttachmentClick={onAttachmentClick}
                      unitRentFee={res.unit_rent_fee}
                      advancePayment={res.advance_payment}
                      noticePeriod={res.notice_period}
                    />
                  ))}
              </div>
            </div>
          </div>
        ) : isUpdate && fieldChanges && (fieldChanges.rent.changed || fieldChanges.advance.changed || fieldChanges.noticePeriod.changed || fieldChanges.attachments.changed || fieldChanges.name.changed || fieldChanges.contact.changed || fieldChanges.email.changed) ? (
          <div className="space-y-4">
            {/* Show field-specific before/after only for fields that changed */}
            {(fieldChanges.rent.changed || fieldChanges.advance.changed || fieldChanges.noticePeriod.changed || fieldChanges.name.changed || fieldChanges.contact.changed || fieldChanges.email.changed) && (
              <>
                <div className="space-y-2">
                  <div className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Previous Values</div>
                  <div className="bg-slate-50 rounded-lg p-4 border border-slate-200 space-y-2">
                    {fieldChanges.rent.changed && (
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-gray-600">Rent Amount:</span>
                        <span className="text-sm font-medium text-gray-900">BDT {fieldChanges.rent.before?.toLocaleString() || '0'}</span>
                      </div>
                    )}
                    {fieldChanges.advance.changed && (
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-gray-600">Advance Payment:</span>
                        <span className="text-sm font-medium text-gray-900">BDT {fieldChanges.advance.before?.toLocaleString() || '0'}</span>
                      </div>
                    )}
                    {fieldChanges.noticePeriod.changed && (
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-gray-600">Notice Period:</span>
                        <span className="text-sm font-medium text-gray-900">{fieldChanges.noticePeriod.before} month(s)</span>
                      </div>
                    )}
                    {fieldChanges.name.changed && (
                      <div className="flex flex-col">
                        <span className="text-xs text-gray-500">Name:</span>
                        <span className="text-sm font-medium text-gray-900">{fieldChanges.name.before}</span>
                      </div>
                    )}
                    {fieldChanges.contact.changed && (
                      <div className="flex flex-col">
                        <span className="text-xs text-gray-500">Contact:</span>
                        <span className="text-sm font-medium text-gray-900">{fieldChanges.contact.before}</span>
                      </div>
                    )}
                    {fieldChanges.email.changed && (
                      <div className="flex flex-col">
                        <span className="text-xs text-gray-500">Email:</span>
                        <span className="text-sm font-medium text-gray-900 break-all">{fieldChanges.email.before}</span>
                      </div>
                    )}
                  </div>
                </div>
                <div className="flex items-center justify-center py-1">
                  <div className="flex items-center gap-2 text-blue-600">
                    <FaExchangeAlt className="w-4 h-4" />
                    <span className="text-xs font-medium">Changed To</span>
                  </div>
                </div>
                <div className="space-y-2">
                  <div className="text-xs font-semibold text-gray-500 uppercase tracking-wider">New Values</div>
                  <div className="bg-blue-50 rounded-lg p-4 border border-blue-200 space-y-2">
                    {fieldChanges.rent.changed && (
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-gray-600">Rent Amount:</span>
                        <span className="text-sm font-bold text-blue-700">BDT {fieldChanges.rent.after?.toLocaleString() || '0'}</span>
                      </div>
                    )}
                    {fieldChanges.advance.changed && (
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-gray-600">Advance Payment:</span>
                        <span className="text-sm font-bold text-blue-700">BDT {fieldChanges.advance.after?.toLocaleString() || '0'}</span>
                      </div>
                    )}
                    {fieldChanges.noticePeriod.changed && (
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-gray-600">Notice Period:</span>
                        <span className="text-sm font-bold text-blue-700">{fieldChanges.noticePeriod.after} month(s)</span>
                      </div>
                    )}
                    {fieldChanges.name.changed && (
                      <div className="flex flex-col">
                        <span className="text-xs text-blue-600">Name:</span>
                        <span className="text-sm font-bold text-blue-700">{fieldChanges.name.after}</span>
                      </div>
                    )}
                    {fieldChanges.contact.changed && (
                      <div className="flex flex-col">
                        <span className="text-xs text-blue-600">Contact:</span>
                        <span className="text-sm font-bold text-blue-700">{fieldChanges.contact.after}</span>
                      </div>
                    )}
                    {fieldChanges.email.changed && (
                      <div className="flex flex-col">
                        <span className="text-xs text-blue-600">Email:</span>
                        <span className="text-sm font-bold text-blue-700 break-all">{fieldChanges.email.after}</span>
                      </div>
                    )}
                  </div>
                </div>
              </>
            )}
            {/* Show attachment changes if present */}
            {fieldChanges.attachments.changed && (
              <div className="bg-amber-50 rounded-lg p-4 border border-amber-200">
                <div className="flex items-center gap-2 text-sm">
                  <FaHistory className="w-4 h-4 text-amber-600" />
                  <span className="font-medium text-amber-900">
                    Attachments: {fieldChanges.attachments.before} → {fieldChanges.attachments.after}
                  </span>
                </div>
              </div>
            )}
          </div>
        ) : entry.type === "attachment_added" || entry.type === "attachment_removed" ? (
          <div>
            {/* Display user card for the resident whose attachment was changed */}
            {entry.resident_state_after && entry.resident_state_after.length > 0 && (() => {
              // Extract removed attachment names from description for attachment_removed entries
              const removedAttachmentNames = entry.type === "attachment_removed" && entry.description
                ? entry.description.match(/'([^']+)'/g)?.map(match => match.replace(/'/g, '')) || []
                : [];
              
              return (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-3 justify-items-start">
                  {entry.resident_state_after
                    .filter(res => {
                      // Find the resident that matches the entry's resident_member
                      if (entry.resident_member) {
                        return res.member_id === entry.resident_member.id || 
                               res.resident_id === entry.resident_member.id ||
                               res.name === (entry.resident_member.name || entry.resident_member.full_name);
                      }
                      // If no resident_member, show the first one with attachments
                      return (res.attachments || []).length > 0;
                    })
                    .map((resident, idx) => {
                      // Filter out removed attachments for attachment_removed entries
                      let filteredAttachments = resident.attachments || [];
                      if (entry.type === "attachment_removed" && removedAttachmentNames.length > 0) {
                        filteredAttachments = filteredAttachments.filter(att => {
                          const attName = att.name || '';
                          return !removedAttachmentNames.some(removedName => attName === removedName);
                        });
                      }
                      
                      return (
                        <HistoryCard
                          key={idx}
                          name={resident.name}
                          statusLabel={resident.status_label}
                          date={resident.assignment_date}
                          contact={resident.contact}
                          email={resident.email}
                          isResidentOrTenant={resident.is_resident_or_tenant}
                          attachments={filteredAttachments}
                          onAttachmentClick={onAttachmentClick}
                          unitRentFee={resident.unit_rent_fee}
                          advancePayment={resident.advance_payment}
                          noticePeriod={resident.notice_period}
                        />
                      );
                    })}
                </div>
              );
            })()}
            {/* Fallback: If no state data, try to show basic info from entry */}
            {(!entry.resident_state_after || entry.resident_state_after.length === 0) && displayInfo && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-3 justify-items-start">
                <HistoryCard
                  name={displayInfo.name}
                  statusLabel={displayInfo.statusLabel || (displayInfo.isResidentOrTenant ? "Resident" : "Tenant")}
                  date={null}
                  contact={displayInfo.contact}
                  email={displayInfo.email}
                  isResidentOrTenant={displayInfo.isResidentOrTenant}
                  attachments={[]}
                  onAttachmentClick={onAttachmentClick}
                  unitRentFee={displayInfo.unitRentFee}
                  advancePayment={displayInfo.advancePayment}
                  noticePeriod={displayInfo.noticePeriod}
                />
              </div>
            )}
          </div>
        ) : (isAssignment || isUpdate || isRemoval) && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {displayInfo ? (
              <HistoryCard
                attachments={(entry.resident_state_after?.[0] || entry.resident_state_before?.[0])?.attachments || []}
                onAttachmentClick={onAttachmentClick}
                name={displayInfo.name}
                statusLabel={displayInfo.statusLabel || (displayInfo.isResidentOrTenant ? "Resident" : "Tenant")}
                date={isAssignment ? entry.date : null}
                contact={displayInfo.contact}
                email={displayInfo.email}
                isResidentOrTenant={displayInfo.isResidentOrTenant}
                unitRentFee={displayInfo.unitRentFee}
                advancePayment={displayInfo.advancePayment}
                noticePeriod={displayInfo.noticePeriod}
              />
            ) : isRemoval && (
              <div className="text-sm text-gray-500 italic">Resident removed from unit.</div>
            )}
            {isRemoval && duration && (
              <div className="bg-orange-50 rounded-lg p-4 space-y-2 border border-orange-200 h-full flex flex-col justify-center">
                <div className="flex items-center gap-2 text-orange-800 font-medium">
                  <FaHistory className="w-4 h-4" />
                  <span>Duration of Stay</span>
                </div>
                <div className="text-2xl font-bold text-orange-600">
                  {duration}
                </div>
                <div className="text-xs text-orange-700">
                  {formatDate(displayInfo?.assignment_date)} - {formatDate(entry.date)}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

const StaffHistoryEntry = ({ entry }) => {
  const typeInfo = getStaffEntryTypeInfo(entry.type);
  const staffMember = entry.staff_member;
  const isStatusChange = entry.type === "staff_status_changed";
  const isRemoval = entry.type === "staff_removed";
  const isAssignment = entry.type === "staff_assigned";

  const displayInfo = useMemo(() => {
    const before = entry.staff_state_before || [];
    const after = entry.staff_state_after || [];

    // Helper function to find staff in snapshots by member_id or name
    const findStaffInSnapshots = (memberId, memberName) => {
      // Try to find by member_id first
      if (memberId) {
        const foundById = [...before, ...after].find(s =>
          s.member_id === memberId
        );
        if (foundById) return foundById;
      }

      // Fallback to finding by name
      if (memberName) {
        const foundByName = [...before, ...after].find(s =>
          s.name === memberName || s.name === staffMember?.full_name
        );
        if (foundByName) return foundByName;
      }

      return null;
    };

    // Try nested member object first
    if (staffMember) {
      const name = staffMember.name || staffMember.full_name;
      const contact = staffMember.contact || staffMember.general_contact;
      const email = staffMember.email || staffMember.general_email;

      // Try to get status from entry.staff_status first
      let status = entry.staff_status;

      // If status is not available or is null/undefined, look in snapshots
      if (!status) {
        const snapshot = findStaffInSnapshots(staffMember.id, name);
        status = snapshot?.status;
      }

      return {
        name,
        contact,
        email,
        status: status || "Unknown"
      };
    }

    // Fallback to snapshots when staffMember is not available
    let snapshot = null;

    if (isRemoval) {
      // For removal, find the staff that was removed (in before but not in after)
      snapshot = before.find(b =>
        !after.some(a =>
          (a.member_id && b.member_id && a.member_id === b.member_id) ||
          (a.staff_id && b.staff_id && a.staff_id === b.staff_id)
        )
      ) || before[0];
    } else if (isStatusChange) {
      // For status change, prefer 'after' snapshot as it has the updated status
      // But also check 'before' if 'after' doesn't have status
      snapshot = after.find(s => s.status) || before.find(s => s.status) || after[0] || before[0];
    } else {
      // For assignment, use after snapshot
      snapshot = after[0];
    }

    if (snapshot) {
      return {
        name: snapshot.name,
        contact: snapshot.contact,
        email: snapshot.email,
        status: snapshot.status || "Unknown"
      };
    }

    return null;
  }, [staffMember, isRemoval, isStatusChange, entry.staff_state_before, entry.staff_state_after, entry.staff_status]);

  return (
    <div className="bg-white rounded-lg border border-gray-200 p-5 mb-4 shadow-sm hover:shadow-md transition-shadow">
      <div className="flex items-start gap-3 mb-3">
        <div
          className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 ${typeInfo.iconBg}`}
          style={typeInfo.iconBgStyle}
        >
          {typeInfo.icon}
        </div>
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-1">
            <h3 className="text-lg font-semibold text-gray-900">{typeInfo.title}</h3>
            {typeInfo.badge && (
              <span
                className={`text-xs px-2 py-1 rounded-full font-medium ${typeInfo.badgeColor}`}
                style={typeInfo.badgeStyle}
              >
                {typeInfo.badge}
              </span>
            )}
          </div>
          <p className="text-sm text-gray-500">{formatDate(entry.date)}</p>
          {displayInfo && (
            <p className="text-sm text-gray-700 mt-1">
              Staff: <span className="font-medium">{displayInfo.name}</span>
            </p>
          )}
        </div>
      </div>
      {entry.description && (
        <div className="ml-12 mb-3 text-sm text-gray-600">
          {entry.description.replace(/^Resident\s+/i, '').replace(/\s+via Excel upload$/i, '')}
        </div>
      )}
      <div className="ml-12">
        {isStatusChange ? (
          <div className="space-y-4">
            <div className="space-y-2">
              <div className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Before</div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {(entry.staff_state_before || [])
                  .filter(s => displayInfo && (s.name === displayInfo.name))
                  .map((staff, idx) => (
                    <HistoryCard key={idx} name={staff.name} statusLabel={staff.status} date={staff.assignment_date} contact={staff.contact} email={staff.email} isStaff={true} />
                  ))}
              </div>
            </div>
            <div className="flex items-center justify-center py-1">
              <div className="flex items-center gap-2 text-primary">
                <FaExchangeAlt className="w-4 h-4" />
                <span className="text-xs font-medium">Changed To</span>
              </div>
            </div>
            <div className="space-y-2">
              <div className="text-xs font-semibold text-gray-500 uppercase tracking-wider">After</div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {(entry.staff_state_after || [])
                  .filter(s => displayInfo && (s.name === displayInfo.name))
                  .map((staff, idx) => (
                    <HistoryCard key={idx} name={staff.name} statusLabel={staff.status} date={staff.assignment_date} contact={staff.contact} email={staff.email} isStaff={true} />
                  ))}
              </div>
            </div>
          </div>
        ) : (isRemoval || isAssignment) && displayInfo && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <HistoryCard
              name={displayInfo.name}
              statusLabel={displayInfo.status}
              date={isAssignment ? entry.date : null}
              contact={displayInfo.contact}
              email={displayInfo.email}
              isStaff={true}
            />
          </div>
        )}
      </div>
    </div>
  );
};

// Component to display individual owner change in transfer
const OwnerTransferChangeCard = ({ name, beforeShare, afterShare, isSource, isLeaving, isJoining, contact, email }) => {
  const change = afterShare - beforeShare;
  const changeText = change >= 0 ? `+${change.toFixed(2)}%` : `${change.toFixed(2)}%`;
  const changeColor = change >= 0 ? "text-emerald-600" : "text-red-500";
  const changeBgColor = change >= 0 ? "bg-emerald-50" : "bg-red-50";
  const borderColor = isLeaving ? "border-red-300" : isJoining ? "border-emerald-300" : (isSource ? "border-amber-200" : "border-blue-200");
  const bgColor = isLeaving ? "bg-red-50" : isJoining ? "bg-emerald-50" : (isSource ? "bg-amber-50" : "bg-blue-50");
  
  // Determine status badge
  let statusBadge = null;
  if (isLeaving) {
    statusBadge = <span className="text-xs px-2 py-0.5 rounded-full bg-red-100 text-red-700 font-medium">Exited</span>;
  } else if (isJoining) {
    statusBadge = <span className="text-xs px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700 font-medium">New Owner</span>;
  } else if (isSource) {
    statusBadge = <span className="text-xs px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 font-medium">Transferred Out</span>;
  } else {
    statusBadge = <span className="text-xs px-2 py-0.5 rounded-full bg-blue-100 text-blue-700 font-medium">Received</span>;
  }
  
  return (
    <div className={`rounded-lg p-4 border ${borderColor} ${bgColor}`}>
      {/* Owner Name and Status */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <FaUser className="w-4 h-4 text-gray-500" />
          <span className="text-sm font-semibold text-gray-900">{name}</span>
        </div>
        {statusBadge}
      </div>
      
      {/* Ownership Change Visualization */}
      <div className="flex items-center justify-between gap-3 mb-2">
        <div className="flex-1">
          <div className="text-xs text-gray-500 mb-1">Before</div>
          <div className="text-lg font-bold text-gray-700">{beforeShare.toFixed(2)}%</div>
        </div>
        
        <div className="flex items-center gap-1 px-2">
          <FaExchangeAlt className="w-4 h-4 text-gray-400" />
        </div>
        
        <div className="flex-1 text-right">
          <div className="text-xs text-gray-500 mb-1">After</div>
          <div className={`text-lg font-bold ${isLeaving ? "text-red-500" : "text-gray-700"}`}>
            {isLeaving ? "0.00%" : `${afterShare.toFixed(2)}%`}
          </div>
        </div>
      </div>
      
      {/* Change Badge */}
      <div className="flex justify-center">
        <div className={`inline-flex items-center gap-1 px-3 py-1 rounded-full ${changeBgColor}`}>
          <span className={`text-sm font-bold ${changeColor}`}>{changeText}</span>
        </div>
      </div>
      
      {/* Contact Info (optional) */}
      {(contact || email) && (
        <div className="mt-3 pt-3 border-t border-gray-200/50 space-y-1">
          {contact && (
            <div className="flex items-center gap-2 text-xs text-gray-500">
              <FaPhone className="w-3 h-3" />
              <span>{contact}</span>
            </div>
          )}
          {email && (
            <div className="flex items-center gap-2 text-xs text-gray-500">
              <FaEnvelope className="w-3 h-3" />
              <span className="truncate">{email}</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

const OwnerHistoryEntry = ({ entry, onAttachmentClick }) => {
  const typeInfo = getOwnerEntryTypeInfo(entry.type);
  const isTransfer = entry.type === "ownership_transfer";
  const ownersList = entry.owners || entry.ownership_state_after || [];
  const hasOwners = Array.isArray(ownersList) && ownersList.length > 0;
  const isMultipleOwners = ownersList.length > 1;
  const isInitialOwnership = entry.type === "initial_ownership" || entry.type === "initial_ownership_list";
  
  // Extract transfer_date for transfer entries
  // The transfer_date is in the purchase_date field of new owners (those joining)
  // or in the last_transfer_date field if available
  const transferDate = useMemo(() => {
    if (!isTransfer) return null;
    
    // First, try to find owners that are joining (new owners)
    const ownershipStateAfter = entry.ownership_state_after || [];
    const ownershipStateBefore = entry.ownership_state_before || [];
    const beforeMemberIds = new Set(ownershipStateBefore.map(o => o.member_id || o.owner_id));
    
    // Find new owners (in after but not in before)
    const newOwner = ownershipStateAfter.find(o => {
      const memberId = o.member_id || o.owner_id;
      return !beforeMemberIds.has(memberId) || o.is_joining === true;
    });
    
    if (newOwner && newOwner.purchase_date) {
      return newOwner.purchase_date;
    }
    
    // Fallback: check if any owner in 'after' has a different purchase_date than in 'before'
    // This handles cases where existing owners received transfers
    for (const afterOwner of ownershipStateAfter) {
      const beforeOwner = ownershipStateBefore.find(b => 
        (b.member_id || b.owner_id) === (afterOwner.member_id || afterOwner.owner_id)
      );
      if (beforeOwner && afterOwner.purchase_date && afterOwner.purchase_date !== beforeOwner.purchase_date) {
        return afterOwner.purchase_date;
      }
    }
    
    // Fallback to 'to' array
    const toOwners = entry.to || [];
    const joiningOwner = toOwners.find(o => o.is_joining === true) || toOwners[0];
    if (joiningOwner && joiningOwner.purchase_date) {
      return joiningOwner.purchase_date;
    }
    
    return null;
  }, [isTransfer, entry]);

  // Calculate ownership changes for transfer entries
  // The actual transfer relationship is identified by is_leaving/is_joining flags
  const ownershipChanges = useMemo(() => {
    if (!isTransfer) return null;
    
    // Use ownership_state_before and ownership_state_after (or fallback to from/to)
    const beforeState = entry.ownership_state_before || entry.from || [];
    const afterState = entry.ownership_state_after || entry.to || [];
    
    if (beforeState.length === 0 && afterState.length === 0) return null;
    
    // STEP 1: Find the ACTUAL source (who transferred out)
    // Look for owners marked with is_leaving: true, or owners who went to 0%
    // IMPORTANT: With the backend fix, ownership_state_before should ONLY contain the source and recipient
    // So we should always find the source here for internal transfers
    const sources = [];
    
    beforeState.forEach(owner => {
      const id = owner.member_id || owner.owner_id || owner.name;
      const beforeShare = parseFloat(owner.share || owner.ownership_percentage || 0);
      
      // Check if this owner is leaving (marked as is_leaving or not in after state)
      const afterOwner = afterState.find(a => 
        (a.member_id || a.owner_id) === id || a.name === owner.name
      );
      const afterShare = afterOwner ? parseFloat(afterOwner.share || afterOwner.ownership_percentage || 0) : 0;
      
      // Owner is a source if: is_leaving is true, OR their share decreased, OR they're not in after state
      const isLeaving = owner.is_leaving === true || !afterOwner || afterShare === 0;
      const shareDecreased = beforeShare > afterShare;
      
      // Only include as source if they actually transferred out (share decreased or leaving)
      if (isLeaving || shareDecreased) {
        const transferredAmount = beforeShare - (isLeaving ? 0 : afterShare);
        
        // Only add if they actually transferred something
        if (transferredAmount > 0.01) {
          sources.push({
            id,
            name: owner.name || owner.full_name || 'Unknown',
            beforeShare,
            afterShare: isLeaving ? 0 : afterShare,
            contact: owner.contact || owner.phone || '',
            email: owner.email || '',
            isLeaving,
            isJoining: false,
            isSource: true,
            isTarget: false,
            role: 'source',
            transferredAmount
          });
        }
      }
    });
    
    // STEP 2: Find the ACTUAL receiver (who received the transfer)
    // Look for owners marked with is_joining: true, or owners whose share increased
    // IMPORTANT: There should only be ONE receiver per transfer
    const receivers = [];
    
    afterState.forEach(owner => {
      const id = owner.member_id || owner.owner_id || owner.name;
      const afterShare = parseFloat(owner.share || owner.ownership_percentage || 0);
      
      // Check if this owner existed before
      const beforeOwner = beforeState.find(b => 
        (b.member_id || b.owner_id) === id || b.name === owner.name
      );
      const beforeShare = beforeOwner ? parseFloat(beforeOwner.share || beforeOwner.ownership_percentage || 0) : 0;
      
      // Owner is a receiver if: is_joining is true, OR they're new, OR their share increased
      const isJoining = owner.is_joining === true;
      const isNew = !beforeOwner;
      const shareIncreased = afterShare > beforeShare;
      
      // Only include as receiver if they actually gained ownership in THIS transfer
      // Prioritize owners marked with is_joining (the actual transfer recipient)
      if (isJoining) {
        receivers.push({
          id,
          name: owner.name || owner.full_name || 'Unknown',
          beforeShare,
          afterShare,
          contact: owner.contact || owner.phone || '',
          email: owner.email || '',
          isLeaving: false,
          isJoining: true,
          isSource: false,
          isTarget: true,
          role: 'receiver',
          receivedAmount: afterShare - beforeShare
        });
      }
    });
    
    // If no receiver found with is_joining flag, fall back to finding who gained ownership
    // This handles edge cases where the flag might not be set, OR when source is not in the data
    if (receivers.length === 0) {
      const totalTransferred = sources.reduce((sum, s) => sum + s.transferredAmount, 0);
      
      // Find the owner(s) who gained ownership
      const potentialReceivers = [];
      afterState.forEach(owner => {
        const id = owner.member_id || owner.owner_id || owner.name;
        const afterShare = parseFloat(owner.share || owner.ownership_percentage || 0);
        const beforeOwner = beforeState.find(b => 
          (b.member_id || b.owner_id) === id || b.name === owner.name
        );
        const beforeShare = beforeOwner ? parseFloat(beforeOwner.share || beforeOwner.ownership_percentage || 0) : 0;
        
        if (afterShare > beforeShare) {
          potentialReceivers.push({
            id,
            name: owner.name || owner.full_name || 'Unknown',
            beforeShare,
            afterShare,
            contact: owner.contact || owner.phone || '',
            email: owner.email || '',
            isLeaving: false,
            isJoining: !beforeOwner,
            isSource: false,
            isTarget: true,
            role: 'receiver',
            receivedAmount: afterShare - beforeShare
          });
        }
      });
      
      // Sort by received amount descending and take the one who received the most
      potentialReceivers.sort((a, b) => b.receivedAmount - a.receivedAmount);
      
      if (sources.length > 0 && totalTransferred > 0) {
        // Find the receiver whose received amount matches the total transferred (within tolerance)
        const matchingReceiver = potentialReceivers.find(r => 
          Math.abs(r.receivedAmount - totalTransferred) < 0.1
        );
        
        if (matchingReceiver) {
          receivers.push(matchingReceiver);
        } else if (potentialReceivers.length > 0) {
          // If no exact match, take the one who received the most
          receivers.push(potentialReceivers[0]);
        }
      } else if (potentialReceivers.length > 0) {
        // No sources identified, but someone gained ownership - add them as receiver
        receivers.push(...potentialReceivers);
      }
    }
    
    // Calculate total transferred amount
    const transferredAmount = sources.reduce((sum, s) => sum + s.transferredAmount, 0);
    
    return { 
      transferDetails: [...sources, ...receivers], 
      transferredAmount,
      sources,
      receivers
    };
  }, [isTransfer, entry]);

  return (
    <div className="bg-white rounded-lg border border-gray-200 p-5 mb-4 shadow-sm hover:shadow-md transition-shadow">
      <div className="flex items-start gap-3 mb-3">
        <div className={`w-10 h-10 rounded-full flex items-center justify-center ${typeInfo.iconBg}`}>
          {typeInfo.icon}
        </div>
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-1">
            <h3 className="text-lg font-semibold text-gray-900">{typeInfo.title}</h3>
            <span className={`text-xs px-2 py-1 rounded-full ${typeInfo.badgeColor}`}>
              {typeInfo.badge}
            </span>
            {isInitialOwnership && isMultipleOwners && (
              <span className="text-xs px-2 py-1 rounded-full bg-blue-100 text-blue-700 font-medium">
                {ownersList.length} Owners
              </span>
            )}
          </div>
          <p className="text-sm text-gray-500">{formatDate(entry.date)}</p>
          {/* Show owner name for attachment entries */}
          {(entry.type === "attachment_added" || entry.type === "attachment_removed") && entry.ownership_state_after && entry.ownership_state_after.length > 0 && (() => {
            // Find the owner that matches (try to match by owner_member if available, otherwise use first owner with attachments)
            const matchingOwner = entry.ownership_state_after.find(owner => {
              if (entry.owner_member) {
                return owner.member_id === entry.owner_member.id || 
                       owner.owner_id === entry.owner_member.id ||
                       owner.name === (entry.owner_member.name || entry.owner_member.full_name);
              }
              // If no owner_member, use first owner with attachments
              return (owner.attachments || []).length > 0;
            }) || entry.ownership_state_after[0];
            
            const ownerName = matchingOwner?.name || matchingOwner?.full_name || "Unknown";
            return (
              <p className="text-sm text-gray-700 mt-1">
                Owner: <span className="font-medium">{ownerName}</span>
              </p>
            );
          })()}
          {isTransfer && transferDate && (
            <div className="flex items-center gap-2 mt-1">
              <FaCalendar className="w-3 h-3 text-gray-400" />
              <span className="text-xs text-gray-600">Transfer Date: </span>
              <span className="text-xs font-medium text-gray-900">{formatDate(transferDate)}</span>
            </div>
          )}
        </div>
      </div>
      {entry.description && (entry.type === "attachment_added" || entry.type === "attachment_removed") && (
        <div className="ml-12 mb-3 text-sm text-gray-600 italic">
          {entry.description}
        </div>
      )}
      {isTransfer && ownershipChanges ? (
        <div className="ml-12 space-y-5">
          {/* Ownership Transfer Summary - Shows only actual source and receiver */}
          <div className="bg-gradient-to-r from-indigo-50 to-purple-50 rounded-xl p-4 border border-indigo-100">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <FaExchangeAlt className="w-4 h-4 text-indigo-600" />
                <span className="text-sm font-semibold text-indigo-800">Ownership Transfer Details</span>
              </div>
              {ownershipChanges.transferredAmount > 0 && (
                <span className="text-xs px-3 py-1 rounded-full bg-indigo-100 text-indigo-700 font-bold">
                  {ownershipChanges.transferredAmount.toFixed(2)}% Transferred
                </span>
              )}
            </div>
            
            {/* Source Owner(s) - Who transferred out */}
            {ownershipChanges.sources && ownershipChanges.sources.length > 0 ? (
              <div className="mb-4">
                <div className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2 flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-red-400"></span>
                  Source (Transferred Out)
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {ownershipChanges.sources.map((owner, idx) => (
                    <OwnerTransferChangeCard
                      key={owner.id || idx}
                      name={owner.name}
                      beforeShare={owner.beforeShare}
                      afterShare={owner.afterShare}
                      isSource={true}
                      isLeaving={owner.isLeaving}
                      isJoining={false}
                      contact={owner.contact}
                      email={owner.email}
                    />
                  ))}
                </div>
              </div>
            ) : ownershipChanges.receivers && ownershipChanges.receivers.length > 0 ? (
              <div className="mb-4">
                <div className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2 flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-gray-400"></span>
                  Source (External Transfer)
                </div>
                <div className="text-sm text-gray-500 italic">
                  Ownership transferred from an external source
                </div>
              </div>
            ) : null}
            
            {/* Arrow indicator */}
            {ownershipChanges.sources && ownershipChanges.sources.length > 0 && 
             ownershipChanges.receivers && ownershipChanges.receivers.length > 0 && (
              <div className="flex items-center justify-center py-2">
                <div className="flex items-center gap-2 text-indigo-500">
                  <div className="h-px w-12 bg-indigo-300"></div>
                  <FaExchangeAlt className="w-5 h-5" />
                  <div className="h-px w-12 bg-indigo-300"></div>
                </div>
              </div>
            )}
            
            {/* Receiver Owner(s) - Who received the transfer */}
            {ownershipChanges.receivers && ownershipChanges.receivers.length > 0 && (
              <div>
                <div className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2 flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-emerald-400"></span>
                  Receiver (Received Ownership)
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {ownershipChanges.receivers.map((owner, idx) => (
                    <OwnerTransferChangeCard
                      key={owner.id || idx}
                      name={owner.name}
                      beforeShare={owner.beforeShare}
                      afterShare={owner.afterShare}
                      isSource={false}
                      isLeaving={false}
                      isJoining={owner.isJoining}
                      contact={owner.contact}
                      email={owner.email}
                    />
                  ))}
                </div>
              </div>
            )}
          </div>
          
          {/* Legacy From/To display as fallback if no ownership changes calculated */}
          {(!ownershipChanges.sources || ownershipChanges.sources.length === 0) && 
           (!ownershipChanges.receivers || ownershipChanges.receivers.length === 0) && (
            <>
              <div className="space-y-2">
                <div className="text-xs font-semibold text-gray-500 uppercase tracking-wider">From</div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {(entry.from || []).map((f, idx) => (
                    <div key={idx} className="bg-gray-50 rounded-lg p-4 space-y-2 border border-gray-200">
                      <div className="flex items-center gap-2">
                        <FaUser className="w-4 h-4 text-gray-500" />
                        <span className="text-sm font-medium text-gray-900">{f.name}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <FaChartLine className="w-4 h-4 text-gray-500" />
                        <span className="text-sm text-gray-900">{typeof f.share === "number" ? f.share.toFixed(2) : f.share}%</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
              <div className="flex items-center justify-center py-1">
                <FaExchangeAlt className="w-5 h-5 text-primary" />
              </div>
              <div className="space-y-2">
                <div className="text-xs font-semibold text-gray-500 uppercase tracking-wider">To</div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {(entry.to || []).map((t, idx) => (
                    <div key={idx} className="bg-gray-50 rounded-lg p-4 space-y-2 border border-gray-200">
                      <div className="flex items-center gap-2">
                        <FaUser className="w-4 h-4 text-gray-500" />
                        <span className="text-sm font-medium text-gray-900">{t.name}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <FaChartLine className="w-4 h-4 text-gray-500" />
                        <span className="text-sm text-gray-900">{typeof t.share === "number" ? t.share.toFixed(2) : t.share}%</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </>
          )}
        </div>
      ) : hasOwners ? (
        <div className="ml-12 grid grid-cols-1 md:grid-cols-2 gap-3">
          {ownersList.map((owner, index) => (
            <OwnerCard 
              key={index} 
              name={owner.name || owner.full_name} 
              share={owner.share || owner.ownership_percentage} 
              date={owner.purchase_date || owner.last_transfer_date || owner.date_of_ownership} 
              contact={owner.contact || owner.phone} 
              email={owner.email}
              attachments={owner.attachments || []}
              onAttachmentClick={onAttachmentClick}
            />
          ))}
        </div>
      ) : entry.type === "attachment_added" || entry.type === "attachment_removed" ? (
        <div className="ml-12">
          {/* Display owner card ONLY for the specific owner whose attachment was changed */}
          {entry.ownership_state_after && entry.ownership_state_after.length > 0 && (() => {
            // Extract owner name and attachment names from description
            // Description format: "Attachment 'filename' added/removed for Owner Name"
            const descriptionParts = entry.description || '';
            const attachmentNames = descriptionParts.match(/'([^']+)'/g)?.map(match => match.replace(/'/g, '')) || [];
            const ownerNameMatch = descriptionParts.match(/for\s+(.+)$/);
            const ownerNameFromDesc = ownerNameMatch ? ownerNameMatch[1].trim() : null;
            
            const stateToUse = entry.ownership_state_after;
            
            // Find the SPECIFIC owner whose attachment was changed
            // Priority: 1. entry.owner_member, 2. owner name from description
            let matchingOwner = null;
            
            if (entry.owner_member) {
              // Use owner_member if available (most reliable)
              matchingOwner = stateToUse.find(owner => 
                owner.member_id === entry.owner_member.id || 
                owner.owner_id === entry.owner_member.id ||
                owner.name === (entry.owner_member.name || entry.owner_member.full_name)
              );
            } else if (ownerNameFromDesc) {
              // Fall back to matching by owner name from description
              matchingOwner = stateToUse.find(owner => 
                owner.name === ownerNameFromDesc || 
                owner.full_name === ownerNameFromDesc ||
                owner.name?.toLowerCase() === ownerNameFromDesc.toLowerCase() ||
                owner.full_name?.toLowerCase() === ownerNameFromDesc.toLowerCase()
              );
            }
            
            // If still no match, don't show any owner card (avoid showing all owners)
            if (!matchingOwner) {
              return null;
            }
            
            // Single matching owner only
            const matchingOwners = [matchingOwner];
            
            // For attachment_removed entries, filter out the removed attachments
            let attachmentsToShow = matchingOwner.attachments || [];
            
            if (entry.type === "attachment_removed" && attachmentNames.length > 0) {
              attachmentsToShow = attachmentsToShow.filter(att => {
                const attName = att.name || att.file_name || '';
                const shouldExclude = attachmentNames.some(removedName => {
                  const normalizedAttName = attName.toLowerCase().trim();
                  const normalizedRemovedName = removedName.toLowerCase().trim();
                  return normalizedAttName === normalizedRemovedName ||
                         normalizedAttName.includes(normalizedRemovedName) ||
                         normalizedRemovedName.includes(normalizedAttName);
                });
                return !shouldExclude;
              });
            }
            
            return (
              <div className="grid grid-cols-1 gap-3 mb-3" style={{ maxWidth: '400px' }}>
                <OwnerCard
                  name={matchingOwner.name || matchingOwner.full_name}
                  share={matchingOwner.share || matchingOwner.ownership_percentage}
                  date={matchingOwner.purchase_date || matchingOwner.last_transfer_date || matchingOwner.date_of_ownership}
                  contact={matchingOwner.contact || matchingOwner.phone}
                  email={matchingOwner.email}
                  attachments={attachmentsToShow}
                  onAttachmentClick={onAttachmentClick}
                />
              </div>
            );
          })()}
        </div>
      ) : (
        <div className="ml-12 text-sm text-gray-500 italic">No owner information available.</div>
      )}
    </div>
  );
};

// ========== MAIN COMPONENT ==========

const UnitHistory = () => {
  const { id: unitId } = useParams();
  const navigate = useNavigate();
  const dispatch = useDispatch();
  const [activeTab, setActiveTab] = useState(1);
  
  // State for image and document viewers
  const [isImageSliderOpen, setIsImageSliderOpen] = useState(false);
  const [selectedImages, setSelectedImages] = useState([]);
  const [selectedImageIndex, setSelectedImageIndex] = useState(0);
  const [isDocumentViewerOpen, setIsDocumentViewerOpen] = useState(false);
  const [selectedDocument, setSelectedDocument] = useState(null);

  const { ownershipHistory, ownershipHistoryLoading, ownershipHistoryError } = useSelector(state => state.owner);
  const { staffHistory, staffHistoryLoading, staffHistoryError } = useSelector(state => state.unitStaff);
  const { residentHistory, residentHistoryLoading, residentHistoryError } = useSelector(state => state.resident);

  // Debug logging
  useEffect(() => {
    if (activeTab === 1) {
      console.log('🔍 Ownership History State:', {
        ownershipHistory,
        loading: ownershipHistoryLoading,
        error: ownershipHistoryError
      });
    }
  }, [activeTab, ownershipHistory, ownershipHistoryLoading, ownershipHistoryError]);

  // Debug modal state changes
  useEffect(() => {
    console.log('🖼️ Image Slider State:', { isImageSliderOpen, imagesCount: selectedImages.length, selectedImageIndex });
  }, [isImageSliderOpen, selectedImages, selectedImageIndex]);

  useEffect(() => {
    console.log('📄 Document Viewer State:', { isDocumentViewerOpen, selectedDocument });
  }, [isDocumentViewerOpen, selectedDocument]);

  useEffect(() => {
    if (unitId && activeTab === 1) dispatch(fetchUnitOwnershipHistory(unitId));
    return () => { if (activeTab === 1) dispatch(clearOwnershipHistory()); };
  }, [dispatch, unitId, activeTab]);

  useEffect(() => {
    if (unitId && activeTab === 3) dispatch(fetchUnitStaffHistory(unitId));
    return () => { if (activeTab === 3) dispatch(clearStaffHistory()); };
  }, [dispatch, unitId, activeTab]);

  useEffect(() => {
    if (unitId && activeTab === 2) dispatch(fetchUnitResidentHistory(unitId));
    return () => { if (activeTab === 2) dispatch(clearResidentHistory()); };
  }, [dispatch, unitId, activeTab]);

  const groupedOwnerHistoryByYear = useMemo(() => {
    console.log('🔍 Ownership History Data:', ownershipHistory);
    console.log('🔍 Entries:', ownershipHistory?.entries);
    console.log('🔍 Entries Length:', ownershipHistory?.entries?.length);
    console.log('🔍 Entries Type:', typeof ownershipHistory?.entries);
    
    // Check if entries exists and is an array
    if (!ownershipHistory || !ownershipHistory.entries) {
      console.log('⚠️ No ownership history or entries property');
      return {};
    }
    
    if (!Array.isArray(ownershipHistory.entries)) {
      console.log('⚠️ Entries is not an array:', ownershipHistory.entries);
      return {};
    }
    
    if (ownershipHistory.entries.length === 0) {
      console.log('⚠️ No entries found in ownership history array');
      return {};
    }
    const consolidatedEntries = [];
    const initialOwnershipMap = new Map();
    ownershipHistory.entries.forEach(entry => {
      if (entry.type === "initial_ownership" || entry.type === "initial_ownership_list") {
        const list = initialOwnershipMap.get(entry.date) || [];
        list.push(...(entry.owners || entry.ownership_state_after || []));
        initialOwnershipMap.set(entry.date, list);
      } else consolidatedEntries.push(entry);
    });
    initialOwnershipMap.forEach((owners, date) => {
      const unique = Array.from(new Map(owners.map(o => [o.id || o.member_id || o.name, o])).values());
      consolidatedEntries.push({ id: `initial_${date}`, type: unique.length === 1 ? "initial_ownership" : "initial_ownership_list", date, ownership_state_after: unique });
    });
    const groups = {};
    consolidatedEntries.forEach(entry => {
      const year = new Date(entry.date).getFullYear();
      if (!groups[year]) groups[year] = [];
      groups[year].push(entry);
    });
    // Sort entries within each year group by date (newest first) - so most recent entries appear at the top
    // For entries with the same date, maintain the order from API (by comparing IDs as fallback)
    // Transfer entries appear right behind (below) their corresponding ownership updates
    Object.values(groups).forEach(g => g.sort((a, b) => {
      const dateDiff = new Date(b.date) - new Date(a.date);
      if (dateDiff !== 0) return dateDiff;
      // If dates are equal, maintain API order (entries come in correct order from backend)
      // Use ID comparison as fallback to ensure consistent ordering
      return (b.id || '').localeCompare(a.id || '');
    }));
    return groups;
  }, [ownershipHistory?.entries]);

  const groupedResidentHistoryByYear = useMemo(() => {
    if (!residentHistory?.entries?.length) return {};
    const groups = {};
    residentHistory.entries.forEach(entry => {
      const year = new Date(entry.date).getFullYear();
      if (!groups[year]) groups[year] = [];
      groups[year].push(entry);
    });
    Object.values(groups).forEach(g => g.sort((a, b) => new Date(b.date) - new Date(a.date)));
    return groups;
  }, [residentHistory?.entries]);

  const groupedStaffHistoryByYear = useMemo(() => {
    if (!staffHistory?.entries?.length) return {};
    const groups = {};
    staffHistory.entries.forEach(entry => {
      const year = new Date(entry.date).getFullYear();
      if (!groups[year]) groups[year] = [];
      groups[year].push(entry);
    });
    Object.values(groups).forEach(g => g.sort((a, b) => new Date(b.date) - new Date(a.date)));
    return groups;
  }, [staffHistory?.entries]);

  const sortedOwnerYears = useMemo(() => Object.keys(groupedOwnerHistoryByYear).sort((a, b) => b - a), [groupedOwnerHistoryByYear]);
  const sortedResidentYears = useMemo(() => Object.keys(groupedResidentHistoryByYear).sort((a, b) => b - a), [groupedResidentHistoryByYear]);
  const sortedStaffYears = useMemo(() => Object.keys(groupedStaffHistoryByYear).sort((a, b) => b - a), [groupedStaffHistoryByYear]);

  // Handler for attachment clicks
  const handleAttachmentClick = (attachment, allAttachments) => {
    console.log('🔍 handleAttachmentClick called');
    console.log('🔍 Attachment clicked:', attachment);
    console.log('🔍 All attachments:', allAttachments);
    
    if (!attachment) {
      console.error('❌ No attachment provided');
      return;
    }
    
    const fileName = attachment.name || attachment.file_name || 'attachment';
    let fileUrl = attachment.url || attachment.file_url || attachment.src;
    
    console.log('📄 Initial file info:', { fileName, fileUrl });
    
    if (!fileUrl) {
      console.error('❌ No file URL found in attachment:', attachment);
      return;
    }
    
    // Ensure URL is absolute - if it's relative, make it absolute
    if (fileUrl && !fileUrl.startsWith('http://') && !fileUrl.startsWith('https://') && !fileUrl.startsWith('data:')) {
      // If it starts with /, it's already a path from root
      if (!fileUrl.startsWith('/')) {
        fileUrl = '/' + fileUrl;
      }
      // Get the base URL from window.location
      const baseUrl = window.location.origin;
      fileUrl = baseUrl + fileUrl;
    }
    
    console.log('📄 Final file info:', { fileName, fileUrl });
    
    // Check file type from both filename and URL
    const isImage = /\.(jpg|jpeg|png|gif|bmp|webp)$/i.test(fileName) || /\.(jpg|jpeg|png|gif|bmp|webp)$/i.test(fileUrl);
    const isPDF = /\.pdf$/i.test(fileName) || /\.pdf$/i.test(fileUrl);
    const isDocument = /\.(doc|docx)$/i.test(fileName) || /\.(doc|docx)$/i.test(fileUrl);
    
    console.log('📄 File type detection:', { isImage, isPDF, isDocument, fileName, fileUrl });
    
    if (isImage) {
      console.log('🖼️ Opening image viewer');
      // Find all image attachments
      const imageAttachments = (allAttachments || []).filter(att => {
        const attName = att.name || att.file_name || '';
        const attUrl = att.url || att.file_url || att.src || '';
        return /\.(jpg|jpeg|png|gif|bmp|webp)$/i.test(attName) || /\.(jpg|jpeg|png|gif|bmp|webp)$/i.test(attUrl);
      });
      console.log('🖼️ Image attachments found:', imageAttachments.length);
      
      const clickedIndex = imageAttachments.findIndex(att => {
        const attId = att.id || att.url || att.file_url || att.src;
        const clickedId = attachment.id || attachment.url || attachment.file_url || attachment.src;
        return attId === clickedId;
      });
      
      const formattedImages = imageAttachments.map((img) => {
        let imgUrl = img.url || img.file_url || img.src;
        // Ensure image URL is absolute
        if (imgUrl && !imgUrl.startsWith('http://') && !imgUrl.startsWith('https://') && !imgUrl.startsWith('data:')) {
          if (!imgUrl.startsWith('/')) {
            imgUrl = '/' + imgUrl;
          }
          const baseUrl = window.location.origin;
          imgUrl = baseUrl + imgUrl;
        }
        return {
          src: imgUrl,
          alt: img.name || img.file_name || `Image`,
          name: img.name || img.file_name || `image`
        };
      });
      console.log('🖼️ Formatted images:', formattedImages);
      console.log('🖼️ Selected index:', clickedIndex >= 0 ? clickedIndex : 0);
      console.log('🖼️ Setting image slider state...');
      setSelectedImages(formattedImages);
      setSelectedImageIndex(clickedIndex >= 0 ? clickedIndex : 0);
      setIsImageSliderOpen(true);
      console.log('🖼️ Image slider state set, isImageSliderOpen should be true');
    } else if (isPDF || isDocument) {
      console.log('📄 Opening document viewer');
      console.log('📄 Setting document:', { fileUrl, fileName });
      setSelectedDocument({
        fileUrl: fileUrl,
        fileName: fileName
      });
      setIsDocumentViewerOpen(true);
      console.log('📄 Document viewer state set, isDocumentViewerOpen should be true');
    } else {
      console.log('🔗 File type not supported, opening in new tab');
      // For other file types, open in new tab
      window.open(fileUrl, '_blank', 'noopener,noreferrer');
    }
  };

  const renderTimeline = (years, groups, EntryComponent) => {
    if (years.length === 0) return <EmptyState icon={FaHistory} title="No History Available" message="Data will appear once changes are made." />;
    return years.map(year => (
      <div key={year} className="mb-8">
        <div className="flex items-center gap-4 mb-4">
          <div className="flex-1 h-px bg-gray-300"></div>
          <div className="bg-gray-200 px-4 py-1 rounded-full"><span className="text-sm font-medium text-gray-700">{year}</span></div>
          <div className="flex-1 h-px bg-gray-300"></div>
        </div>
        {groups[year].map(entry => <EntryComponent key={entry.id} entry={entry} onAttachmentClick={handleAttachmentClick} />)}
      </div>
    ));
  };

  // Stabilize unitInfo to prevent header glitching when switching tabs
  const unitInfoRef = useRef(null);
  const currentUnitInfo = ownershipHistory?.unit || staffHistory?.unit || residentHistory?.unit;

  useEffect(() => {
    if (currentUnitInfo && !unitInfoRef.current) {
      unitInfoRef.current = currentUnitInfo;
    }
  }, [currentUnitInfo]);

  const unitInfo = unitInfoRef.current || currentUnitInfo;
  const isLoading = (activeTab === 1 && ownershipHistoryLoading) || (activeTab === 2 && residentHistoryLoading) || (activeTab === 3 && staffHistoryLoading);

  return (
    <PageContainer className="h-full bg-surfaceMuted flex flex-col min-h-0">
      <motion.div
        className="bg-primary text-white px-6 py-6 rounded-t-[32px]"
        initial={false}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.2 }}
      >
        <div className="flex items-center gap-4 mb-4">
          <button onClick={() => navigate(`/unit-details/${unitId}`)} className="text-white hover:text-gray-200 transition-colors"><FaArrowLeft className="w-5 h-5" /></button>
          <h1 className="text-2xl font-bold">Unit History</h1>
        </div>
        <div className="min-h-[28px] flex items-center">
          {unitInfo && (
            <motion.p
              key="unit-info"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.2, ease: "easeInOut" }}
              className="text-white/90 text-lg"
            >
              {unitInfo.unit_name} • Tower {unitInfo.tower_number} - {unitInfo.tower_name}
            </motion.p>
          )}
        </div>
      </motion.div>
      <div className="flex-1 overflow-y-auto bg-gray-50 py-6">
        <div className="max-w-4xl mx-auto px-6">
          <AnimatedTabs
            tabs={[{ id: 1, label: "Owner" }, { id: 2, label: "Resident" }, { id: 3, label: "Staff" }]}
            activeTab={activeTab}
            onTabChange={setActiveTab}
            className="mb-6"
          />
          {isLoading ? <ModernLoadingAnimation /> : (
            <>
              {activeTab === 1 && renderTimeline(sortedOwnerYears, groupedOwnerHistoryByYear, OwnerHistoryEntry)}
              {activeTab === 2 && renderTimeline(sortedResidentYears, groupedResidentHistoryByYear, ResidentHistoryEntry)}
              {activeTab === 3 && renderTimeline(sortedStaffYears, groupedStaffHistoryByYear, StaffHistoryEntry)}
            </>
          )}
        </div>
      </div>
      
      {/* Image Slider Modal */}
      <ImageSlider
        isOpen={isImageSliderOpen}
        onClose={() => {
          console.log('🖼️ Closing image slider');
          setIsImageSliderOpen(false);
          setSelectedImages([]);
          setSelectedImageIndex(0);
        }}
        images={selectedImages}
        initialIndex={selectedImageIndex}
      />
      
      {/* Document Viewer Modal */}
      {isDocumentViewerOpen && selectedDocument && (
        <DocumentViewer
          fileUrl={selectedDocument.fileUrl}
          fileName={selectedDocument.fileName}
          onClose={() => {
            console.log('📄 Closing document viewer');
            setIsDocumentViewerOpen(false);
            setSelectedDocument(null);
          }}
        />
      )}
    </PageContainer>
  );
};

export default UnitHistory;
