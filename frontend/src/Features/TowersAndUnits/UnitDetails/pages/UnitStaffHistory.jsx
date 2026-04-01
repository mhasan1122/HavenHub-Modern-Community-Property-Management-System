import { useEffect, useMemo } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useDispatch, useSelector } from "react-redux";
import { FaArrowLeft, FaUser, FaCalendar, FaPhone, FaEnvelope, FaUserPlus, FaUserMinus, FaExchangeAlt, FaHistory } from "react-icons/fa";
import PageContainer from "../../../../Components/Ui/PageContainer";
import ModernLoadingAnimation from "../../../../Components/Loaders/ModernLoadingAnimation";
import EmptyState from "../../../../Components/Ui/EmptyState";
import { fetchUnitStaffHistory, clearStaffHistory } from "../../../../redux/slices/unitStaff/unitStaffSlice";

/**
 * UnitStaffHistory Component
 * 
 * Displays staff history timeline with 3 status types:
 * 1. Staff Assigned - When a staff member is assigned to a unit
 * 2. Staff Removed - When a staff member is removed from a unit
 * 3. Staff Status Changed - When a staff member's status (Live-in/Part-time) changes
 */
const UnitStaffHistory = () => {
  const { id: unitId } = useParams();
  const navigate = useNavigate();
  const dispatch = useDispatch();

  const { staffHistory, staffHistoryLoading, staffHistoryError } = useSelector(
    (state) => state.unitStaff
  );

  useEffect(() => {
    if (unitId) {
      dispatch(fetchUnitStaffHistory(unitId));
    }

    return () => {
      dispatch(clearStaffHistory());
    };
  }, [dispatch, unitId]);

  // Group entries by year for timeline display
  const groupedByYear = useMemo(() => {
    if (!staffHistory?.entries?.length) return {};

    const groups = {};
    staffHistory.entries.forEach((entry) => {
      const year = new Date(entry.date).getFullYear();
      if (!groups[year]) {
        groups[year] = [];
      }
      groups[year].push(entry);
    });

    // Sort entries within each year by date descending (newest first)
    Object.keys(groups).forEach((year) => {
      groups[year].sort((a, b) => new Date(b.date) - new Date(a.date));
    });

    return groups;
  }, [staffHistory?.entries]);

  // Sort years descending (newest first)
  const sortedYears = useMemo(() => {
    return Object.keys(groupedByYear).sort((a, b) => parseInt(b) - parseInt(a));
  }, [groupedByYear]);

  // Format date for display
  const formatDate = (dateString) => {
    const date = new Date(dateString);
    const months = [
      "Jan", "Feb", "Mar", "Apr", "May", "Jun",
      "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"
    ];
    return `${months[date.getMonth()]} ${date.getDate()}, ${date.getFullYear()}`;
  };

  // Get entry type display info
  const getEntryTypeInfo = (type) => {
    switch (type) {
      case "staff_assigned":
        return {
          title: "Staff Assigned",
          badge: "Assignment",
          badgeColor: "bg-green-500 text-white",
          icon: <FaUserPlus className="w-5 h-5 text-white" />,
          iconBg: "bg-green-500"
        };
      case "staff_removed":
        return {
          title: "Staff Removed",
          badge: "Removal",
          badgeColor: "bg-red-500 text-white",
          icon: <FaUserMinus className="w-5 h-5 text-white" />,
          iconBg: "bg-red-500"
        };
      case "staff_status_changed":
        return {
          title: "Staff Status Changed",
          badge: "Status Change",
          badgeColor: "bg-blue-500 text-white",
          icon: <FaExchangeAlt className="w-5 h-5 text-white" />,
          iconBg: "bg-blue-500"
        };
      default:
        return {
          title: type,
          badge: "Staff",
          badgeColor: "bg-gray-200 text-gray-700",
          icon: <FaUser className="w-5 h-5 text-white" />,
          iconBg: "bg-gray-500"
        };
    }
  };

  // Render staff card
  const renderStaffCard = (staff) => {
    const staffName = staff.name || "Unknown";
    const contact = staff.contact || null;
    const email = staff.email || null;
    const status = staff.status || "Unknown";
    const assignmentDate = staff.assignment_date || null;

    return (
      <div
        className="bg-slate-50 rounded-lg p-4 space-y-3 border border-slate-200"
      >
        <div className="flex items-center gap-2">
          <FaUser className="w-4 h-4 text-gray-500" />
          <span className="text-sm text-gray-600">Name</span>
          <span className="text-sm font-medium text-gray-900 ml-2">{staffName}</span>
        </div>

        <div className="flex items-center gap-2">
          <FaExchangeAlt className="w-4 h-4 text-gray-500" />
          <span className="text-sm text-gray-600">Status</span>
          <span className="text-sm font-medium text-gray-900 ml-2">{status}</span>
        </div>

        {assignmentDate && (
          <div className="flex items-center gap-2">
            <FaCalendar className="w-4 h-4 text-gray-500" />
            <span className="text-sm text-gray-600">Assignment Date</span>
            <span className="text-sm font-medium text-gray-900 ml-2">
              {formatDate(assignmentDate)}
            </span>
          </div>
        )}

        {contact && (
          <div className="flex items-center gap-2">
            <FaPhone className="w-4 h-4 text-gray-500" />
            <span className="text-sm text-gray-600">Contact</span>
            <span className="text-sm font-medium text-gray-900 ml-2">
              {contact}
            </span>
          </div>
        )}

        {email && (
          <div className="flex items-center gap-2">
            <FaEnvelope className="w-4 h-4 text-gray-500" />
            <span className="text-sm text-gray-600">Email</span>
            <span className="text-sm font-medium text-gray-900 ml-2">
              {email}
            </span>
          </div>
        )}
      </div>
    );
  };

  // Render entry based on type
  const renderEntry = (entry) => {
    const typeInfo = getEntryTypeInfo(entry.type);
    const staffMember = entry.staff_member;
    const staffStateAfter = entry.staff_state_after || [];
    const staffStateBefore = entry.staff_state_before || [];
    
    const isStatusChange = entry.type === "staff_status_changed";
    const isRemoval = entry.type === "staff_removed";
    const isAssignment = entry.type === "staff_assigned";

    return (
      <div
        key={entry.id}
        className="bg-white rounded-lg border border-gray-200 p-5 mb-4 shadow-sm hover:shadow-md transition-shadow max-w-full"
      >
        {/* Header */}
        <div className="flex items-start gap-3 mb-3">
          <div
            className={`w-10 h-10 rounded-full flex items-center justify-center ${typeInfo.iconBg}`}
          >
            {typeInfo.icon}
          </div>
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-1">
              <h3 className="text-lg font-semibold text-gray-900">{typeInfo.title}</h3>
              <span
                className={`text-xs px-2 py-1 rounded-full ${typeInfo.badgeColor}`}
              >
                {typeInfo.badge}
              </span>
            </div>
            <p className="text-sm text-gray-500">{formatDate(entry.date)}</p>
            {staffMember && (
              <p className="text-sm text-gray-700 mt-1">
                Staff: <span className="font-medium">{staffMember.name}</span>
              </p>
            )}
            {entry.staff_status && (
              <p className="text-sm text-gray-700 mt-1">
                Status: <span className="font-medium">{entry.staff_status}</span>
              </p>
            )}
          </div>
        </div>

        {/* Description */}
        {entry.description && (
          <div className="ml-12 mb-3">
            <p className="text-sm text-gray-600">{entry.description}</p>
          </div>
        )}

        {/* Content based on type */}
        {isStatusChange ? (
          // Status change: show before and after
          <div className="ml-12 space-y-4">
            <div className="space-y-2">
              <div className="text-sm font-semibold text-gray-700 uppercase tracking-wide">
                Before
              </div>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
                {staffStateBefore
                  .filter(s => s.member_id === staffMember?.id)
                  .map((staff, idx) => (
                    <div key={idx}>
                      {renderStaffCard(staff)}
                    </div>
                  ))}
              </div>
            </div>

            <div className="flex items-center justify-center py-2">
              <div className="flex items-center gap-2 text-primary">
                <FaExchangeAlt className="w-5 h-5" />
                <span className="text-sm font-medium">Changed To</span>
              </div>
            </div>

            <div className="space-y-2">
              <div className="text-sm font-semibold text-gray-700 uppercase tracking-wide">
                After
              </div>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
                {staffStateAfter
                  .filter(s => s.member_id === staffMember?.id)
                  .map((staff, idx) => (
                    <div key={idx}>
                      {renderStaffCard(staff)}
                    </div>
                  ))}
              </div>
            </div>
          </div>
        ) : isRemoval ? (
          // Removal: show removed staff
          <div className="ml-12 space-y-3">
            {staffMember && (
              <div>
                {renderStaffCard({
                  name: staffMember.name,
                  contact: staffMember.contact,
                  email: staffMember.email,
                  status: entry.staff_status || "Unknown",
                  assignment_date: null
                })}
              </div>
            )}
          </div>
        ) : isAssignment ? (
          // Assignment: show assigned staff
          <div className="ml-12 space-y-3">
            {staffMember && (
              <div>
                {renderStaffCard({
                  name: staffMember.name,
                  contact: staffMember.contact,
                  email: staffMember.email,
                  status: entry.staff_status || "Unknown",
                  assignment_date: entry.date
                })}
              </div>
            )}
          </div>
        ) : null}
      </div>
    );
  };

  // Loading state
  if (staffHistoryLoading) {
    return (
      <PageContainer className="h-full bg-surfaceMuted flex flex-col min-h-0">
        <ModernLoadingAnimation />
      </PageContainer>
    );
  }

  // Error state
  if (staffHistoryError) {
    return (
      <PageContainer className="h-full bg-surfaceMuted flex flex-col min-h-0">
        <div className="bg-primary text-white px-6 py-6 rounded-t-[32px]">
          <div className="flex items-center gap-4">
            <button
              onClick={() => navigate(`/unit-details/${unitId}`)}
              className="text-white hover:text-gray-200 transition-colors"
            >
              <FaArrowLeft className="w-5 h-5" />
            </button>
            <h1 className="text-2xl font-bold">Unit Staff History</h1>
          </div>
        </div>
        <div className="flex-1 flex items-center justify-center bg-gray-50">
          <div className="text-center text-red-500">
            <p className="text-lg">Failed to load staff history</p>
            <p className="text-sm text-gray-500 mt-2">{staffHistoryError}</p>
          </div>
        </div>
      </PageContainer>
    );
  }

  const unitInfo = staffHistory?.unit;

  return (
    <PageContainer className="h-full bg-surfaceMuted flex flex-col min-h-0">
      {/* Header */}
      <div className="bg-primary text-white px-6 py-6 rounded-t-[32px]">
        <div className="flex items-center gap-4 mb-4">
          <button
            onClick={() => navigate(`/unit-details/${unitId}`)}
            className="text-white hover:text-gray-200 transition-colors"
          >
            <FaArrowLeft className="w-5 h-5" />
          </button>
          <h1 className="text-2xl font-bold">Unit Staff History</h1>
        </div>
        {unitInfo && (
          <p className="text-white/90 text-lg">
            {unitInfo.unit_name} • Tower {unitInfo.tower_number} - {unitInfo.tower_name}
          </p>
        )}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto bg-gray-50 py-6">
        <div className="max-w-4xl mx-auto px-6">
          {sortedYears.length === 0 ? (
            <EmptyState
              icon={FaHistory}
              title="No Staff History Available"
              message="Add staff to this unit to see staff history."
            />
          ) : (
            sortedYears.map((year) => (
              <div key={year} className="mb-8">
                {/* Year Separator */}
                <div className="flex items-center gap-4 mb-4">
                  <div className="flex-1 h-px bg-gray-300"></div>
                  <div className="bg-gray-200 px-4 py-1 rounded-full">
                    <span className="text-sm font-medium text-gray-700">{year}</span>
                  </div>
                  <div className="flex-1 h-px bg-gray-300"></div>
                </div>

                {/* History entries for this year */}
                <div>
                  {groupedByYear[year].map((entry) => renderEntry(entry))}
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </PageContainer>
  );
};

export default UnitStaffHistory;

