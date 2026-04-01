import { useEffect, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import {
  FaBuilding,
  FaChartLine,
  FaBell,
  FaExclamationCircle,
  FaCheckCircle,
  FaClock
} from "react-icons/fa";
import {
  IoPeopleCircleOutline,
  IoBusinessOutline,
  IoWalletOutline,
  IoCashOutline,
  IoMegaphoneOutline,
  IoClipboardOutline
} from "react-icons/io5";
import { MdPendingActions, MdTrendingUp, MdTrendingDown } from "react-icons/md";
import { fetchMembers } from "../redux/slices/api/memberApi";
import { fetchPaymentStats } from "../redux/slices/api/paymentApi";
import axiosInstance from "../utils/axiosInstance";
import TableSkeleton from "../Components/Loaders/TableSkeleton";
import useSkeletonLoading from "../hooks/useSkeletonLoading";
import { SKELETON_MIN_DISPLAY_TIME } from "../config/skeletonLoadingConfig";

const Dashboard = () => {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const [stats, setStats] = useState({
    totalMembers: 0,
    totalTowers: 0,
    totalUnits: 0,
    totalServiceFees: 0,
    pendingPayments: 0,
    completedPayments: 0,
    overduePayments: 0,
    totalRevenue: 0,
    pendingRevenue: 0
  });
  const [recentAnnouncements, setRecentAnnouncements] = useState([]);
  const [recentNotices, setRecentNotices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [trends, setTrends] = useState({
    members: { value: 0, isPositive: true },
    payments: { value: 0, isPositive: true },
    revenue: { value: 0, isPositive: true }
  });

  const user = useSelector((state) => state.auth.user);
  const member = useSelector((state) => state.member.headingData);
  const { isAuthenticated } = useSelector((state) => state.auth);

  useEffect(() => {
    if (isAuthenticated) {
      fetchDashboardData();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAuthenticated]);

  const fetchDashboardData = async () => {
    try {
      setLoading(true);

      // Fetch members
      let totalMembers = 0;
      try {
        const membersResponse = await dispatch(fetchMembers({})).unwrap();
        // Handle different response structures
        if (Array.isArray(membersResponse)) {
          // Response is directly an array
          totalMembers = membersResponse.length;
        } else if (Array.isArray(membersResponse?.data)) {
          totalMembers = membersResponse.data.length;
        } else if (
          membersResponse?.data?.results &&
          Array.isArray(membersResponse.data.results)
        ) {
          totalMembers = membersResponse.data.results.length;
        } else if (
          membersResponse?.results &&
          Array.isArray(membersResponse.results)
        ) {
          totalMembers = membersResponse.results.length;
        } else if (typeof membersResponse?.count === "number") {
          totalMembers = membersResponse.count;
        } else if (typeof membersResponse?.data?.count === "number") {
          totalMembers = membersResponse.data.count;
        }
      } catch (error) {
        console.log("Error fetching members:", error);
      }

      // Fetch towers - try multiple endpoints
      let totalTowers = 0;
      try {
        // Try community_towers first (more permissive)
        const towersResponse = await axiosInstance.get(
          "/towers/community_towers/"
        );
        // Handle different response structures
        if (Array.isArray(towersResponse?.data)) {
          totalTowers = towersResponse.data.length;
        } else if (
          towersResponse?.data?.results &&
          Array.isArray(towersResponse.data.results)
        ) {
          totalTowers = towersResponse.data.results.length;
        } else if (
          towersResponse?.data?.data &&
          Array.isArray(towersResponse.data.data)
        ) {
          totalTowers = towersResponse.data.data.length;
        } else if (typeof towersResponse?.data?.count === "number") {
          totalTowers = towersResponse.data.count;
        }
      } catch (_error) {
        try {
          // Fallback to tower_list
          const towersResponse = await axiosInstance.get("/towers/tower_list/");
          // Handle different response structures
          if (Array.isArray(towersResponse?.data)) {
            totalTowers = towersResponse.data.length;
          } else if (
            towersResponse?.data?.results &&
            Array.isArray(towersResponse.data.results)
          ) {
            totalTowers = towersResponse.data.results.length;
          } else if (
            towersResponse?.data?.data &&
            Array.isArray(towersResponse.data.data)
          ) {
            totalTowers = towersResponse.data.data.length;
          } else if (typeof towersResponse?.data?.count === "number") {
            totalTowers = towersResponse.data.count;
          }
        } catch (error2) {
          console.log("Error fetching towers:", error2);
        }
      }

      // Fetch units - try multiple endpoints
      let totalUnits = 0;
      try {
        const unitsResponse = await axiosInstance.get(
          "/towers/community_units/"
        );
        // Handle different response structures
        if (Array.isArray(unitsResponse?.data)) {
          totalUnits = unitsResponse.data.length;
        } else if (
          unitsResponse?.data?.results &&
          Array.isArray(unitsResponse.data.results)
        ) {
          totalUnits = unitsResponse.data.results.length;
        } else if (
          unitsResponse?.data?.data &&
          Array.isArray(unitsResponse.data.data)
        ) {
          totalUnits = unitsResponse.data.data.length;
        } else if (typeof unitsResponse?.data?.count === "number") {
          totalUnits = unitsResponse.data.count;
        }
      } catch (_error) {
        try {
          // Alternative: fetch units from API endpoint
          const unitsResponse = await axiosInstance.get("/api/units/");
          // Handle different response structures
          if (Array.isArray(unitsResponse?.data)) {
            totalUnits = unitsResponse.data.length;
          } else if (
            unitsResponse?.data?.results &&
            Array.isArray(unitsResponse.data.results)
          ) {
            totalUnits = unitsResponse.data.results.length;
          } else if (
            unitsResponse?.data?.data &&
            Array.isArray(unitsResponse.data.data)
          ) {
            totalUnits = unitsResponse.data.data.length;
          } else if (typeof unitsResponse?.data?.count === "number") {
            totalUnits = unitsResponse.data.count;
          }
        } catch (error2) {
          console.log("Error fetching units:", error2);
        }
      }

      // Fetch payment stats with proper error handling
      let paymentStats = {
        totalPayments: 0,
        totalAmount: 0,
        completedCount: 0,
        pendingCount: 0,
        overdueCount: 0,
        completedAmount: 0,
        pendingAmount: 0
      };

      try {
        // Fetch service fee residents data to calculate stats
        const paymentResponse = await axiosInstance.get(
          "/api/service-fee-management/residents/",
          {
            params: { stats: true }
          }
        );

        // Handle different response structures
        let payments = [];
        if (
          paymentResponse?.data?.success &&
          paymentResponse?.data?.data?.payments
        ) {
          payments = Array.isArray(paymentResponse.data.data.payments)
            ? paymentResponse.data.data.payments
            : [];
        } else if (paymentResponse?.data?.data?.payments) {
          payments = Array.isArray(paymentResponse.data.data.payments)
            ? paymentResponse.data.data.payments
            : [];
        } else if (paymentResponse?.data?.payments) {
          payments = Array.isArray(paymentResponse.data.payments)
            ? paymentResponse.data.payments
            : [];
        } else if (Array.isArray(paymentResponse?.data)) {
          payments = paymentResponse.data;
        }

        if (Array.isArray(payments) && payments.length > 0) {
          // Calculate statistics from the data
          // Get the fee amount (original amount) or amount (paid amount)
          const totalFeeAmount = payments.reduce((sum, payment) => {
            const amount = parseFloat(
              payment.fee_amount ||
                payment.original_amount ||
                payment.amount ||
                0
            );
            return sum + amount;
          }, 0);

          // Filter payments by status
          const completedPayments = payments.filter((p) => {
            const status = (
              p.service_status ||
              p.payment_status ||
              p.status ||
              ""
            ).toLowerCase();
            return status === "paid" || status === "completed";
          });

          const pendingPayments = payments.filter((p) => {
            const status = (
              p.service_status ||
              p.payment_status ||
              p.status ||
              ""
            ).toLowerCase();
            const isOverdue =
              p.is_overdue === true ||
              p.is_overdue === "true" ||
              status === "overdue";
            return (
              (status === "pending" ||
                status === "unpaid" ||
                status === "due") &&
              !isOverdue
            );
          });

          const overduePayments = payments.filter((p) => {
            const status = (
              p.service_status ||
              p.payment_status ||
              p.status ||
              ""
            ).toLowerCase();
            const isOverdue =
              p.is_overdue === true ||
              p.is_overdue === "true" ||
              status === "overdue";
            return isOverdue || (status === "pending" && status === "overdue");
          });

          paymentStats = {
            totalPayments: payments.length,
            totalAmount: totalFeeAmount,
            completedCount: completedPayments.length,
            pendingCount: pendingPayments.length,
            overdueCount: overduePayments.length,
            completedAmount: completedPayments.reduce((sum, p) => {
              return (
                sum + parseFloat(p.paid_amount || p.amount || p.fee_amount || 0)
              );
            }, 0),
            pendingAmount: pendingPayments.reduce((sum, p) => {
              return (
                sum +
                parseFloat(p.fee_amount || p.original_amount || p.amount || 0)
              );
            }, 0)
          };
        } else {
          // Try using the Redux thunk as fallback
          try {
            const paymentResponse = await dispatch(
              fetchPaymentStats({})
            ).unwrap();
            if (paymentResponse && typeof paymentResponse === "object") {
              paymentStats = {
                totalPayments: paymentResponse.totalPayments || 0,
                totalAmount: paymentResponse.totalAmount || 0,
                completedCount: paymentResponse.completedCount || 0,
                pendingCount: paymentResponse.pendingCount || 0,
                overdueCount: paymentResponse.overdueCount || 0,
                completedAmount: paymentResponse.completedAmount || 0,
                pendingAmount: paymentResponse.pendingAmount || 0
              };
            }
          } catch (error) {
            console.log("Payment stats not available:", error);
          }
        }
      } catch (error) {
        console.log("Error fetching payment stats:", error);
        // Try using the Redux thunk as fallback
        try {
          const paymentResponse = await dispatch(
            fetchPaymentStats({})
          ).unwrap();
          if (paymentResponse && typeof paymentResponse === "object") {
            paymentStats = {
              totalPayments: paymentResponse.totalPayments || 0,
              totalAmount: paymentResponse.totalAmount || 0,
              completedCount: paymentResponse.completedCount || 0,
              pendingCount: paymentResponse.pendingCount || 0,
              overdueCount: paymentResponse.overdueCount || 0,
              completedAmount: paymentResponse.completedAmount || 0,
              pendingAmount: paymentResponse.pendingAmount || 0
            };
          }
        } catch (error2) {
          console.log("Payment stats fallback also failed:", error2);
        }
      }

      // Fetch recent announcements
      try {
        const announcementsResponse = await axiosInstance.get(
          "/api/announcements/by_status/",
          { params: { status: "active" } }
        );
        const announcements =
          announcementsResponse?.data?.data ||
          announcementsResponse?.data?.results ||
          announcementsResponse?.data ||
          [];
        const sortedAnnouncements = Array.isArray(announcements)
          ? announcements
              .sort(
                (a, b) =>
                  new Date(b.created_at || b.created_date || 0) -
                  new Date(a.created_at || a.created_date || 0)
              )
              .slice(0, 5)
          : [];
        setRecentAnnouncements(sortedAnnouncements);
      } catch (error) {
        console.log("Announcements not available:", error);
        setRecentAnnouncements([]);
      }

      // Fetch recent notices
      try {
        const noticesResponse = await axiosInstance.get(
          "/api/noticeboard/notices/by_status/",
          { params: { status: "active" } }
        );
        const notices =
          noticesResponse?.data?.data ||
          noticesResponse?.data?.results ||
          noticesResponse?.data ||
          [];
        const sortedNotices = Array.isArray(notices)
          ? notices
              .sort(
                (a, b) =>
                  new Date(b.created_at || b.created_date || 0) -
                  new Date(a.created_at || a.created_date || 0)
              )
              .slice(0, 5)
          : [];
        setRecentNotices(sortedNotices);
      } catch (error) {
        console.log("Notices not available:", error);
        setRecentNotices([]);
      }

      setStats({
        totalMembers,
        totalTowers,
        totalUnits,
        totalServiceFees: paymentStats.totalPayments,
        pendingPayments: paymentStats.pendingCount,
        completedPayments: paymentStats.completedCount,
        overduePayments: paymentStats.overdueCount,
        totalRevenue: paymentStats.completedAmount,
        pendingRevenue: paymentStats.pendingAmount
      });

      // Calculate trends based on actual data (simplified for now)
      // In a real scenario, you'd compare current month vs last month
      setTrends({
        members: { value: 0, isPositive: true },
        payments: {
          value:
            paymentStats.totalPayments > 0
              ? Math.round(
                  (paymentStats.completedCount / paymentStats.totalPayments) *
                    100
                )
              : 0,
          isPositive: true
        },
        revenue: { value: 0, isPositive: true }
      });
    } catch (error) {
      console.error("Error fetching dashboard data:", error);
    } finally {
      setLoading(false);
    }
  };

  const StatCard = ({ title, value, icon: Icon, trend, color, onClick }) => {
    const cardVariants = {
      hidden: { opacity: 0, y: 20 },
      visible: { opacity: 1, y: 0 }
    };

    return (
      <motion.div
        variants={cardVariants}
        initial="hidden"
        animate="visible"
        transition={{ duration: 0.3 }}
        onClick={onClick}
        className={`bg-white rounded-lg sm:rounded-xl shadow-sm border border-gray-100 p-4 sm:p-6 hover:shadow-md transition-all duration-300 cursor-pointer ${
          onClick ? "hover:scale-[1.02]" : ""
        }`}
      >
        <div className="flex items-start justify-between">
          <div className="flex-1 min-w-0">
            <p className="text-xs sm:text-sm font-medium text-gray-600 mb-1">{title}</p>
            <p className="text-2xl sm:text-3xl font-bold text-gray-900 mb-2 truncate">{value}</p>
            {trend && (
              <div
                className={`flex items-center gap-1 text-xs sm:text-sm ${
                  trend.isPositive ? "text-green-600" : "text-red-600"
                }`}
              >
                {trend.isPositive ? (
                  <MdTrendingUp className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                ) : (
                  <MdTrendingDown className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                )}
                <span>{Math.abs(trend.value)}%</span>
                <span className="text-gray-500 hidden sm:inline">vs last month</span>
                <span className="text-gray-500 sm:hidden">vs last mo.</span>
              </div>
            )}
          </div>
          <div
            className={`p-2 sm:p-3 rounded-lg ${color} bg-opacity-10 flex items-center justify-center flex-shrink-0`}
          >
            <Icon className={`w-5 h-5 sm:w-6 sm:h-6 ${color}`} />
          </div>
        </div>
      </motion.div>
    );
  };

  const ProgressCard = ({ title, current, total, color, icon: Icon }) => {
    const percentage = total > 0 ? (current / total) * 100 : 0;

    return (
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.3 }}
        className="bg-white rounded-lg sm:rounded-xl shadow-sm border border-gray-100 p-4 sm:p-6"
      >
        <div className="flex items-center justify-between mb-3 sm:mb-4">
          <div className="flex items-center gap-2 sm:gap-3 min-w-0">
            <div className={`p-1.5 sm:p-2 rounded-lg ${color} bg-opacity-10 flex-shrink-0`}>
              <Icon className={`w-4 h-4 sm:w-5 sm:h-5 ${color}`} />
            </div>
            <div className="min-w-0">
              <p className="text-xs sm:text-sm font-medium text-gray-600 truncate">{title}</p>
              <p className="text-xl sm:text-2xl font-bold text-gray-900">
                {current} / {total}
              </p>
            </div>
          </div>
        </div>
        <div className="w-full bg-gray-200 rounded-full h-2.5 sm:h-3 overflow-hidden">
          <motion.div
            initial={{ width: 0 }}
            animate={{ width: `${percentage}%` }}
            transition={{ duration: 1, ease: "easeOut" }}
            className={`h-full ${color.replace("text-", "bg-")} rounded-full`}
          />
        </div>
        <p className="text-xs sm:text-sm text-gray-500 mt-2">
          {percentage.toFixed(1)}% completed
        </p>
      </motion.div>
    );
  };

  const ActivityItem = ({ icon: Icon, title, description, time, color }) => {
    return (
      <motion.div
        initial={{ opacity: 0, x: -20 }}
        animate={{ opacity: 1, x: 0 }}
        className="flex items-start gap-4 p-4 hover:bg-gray-50 rounded-lg transition-colors"
      >
        <div className={`p-2 rounded-lg ${color} bg-opacity-10 flex-shrink-0`}>
          <Icon className={`w-5 h-5 ${color}`} />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-gray-900">{title}</p>
          <p className="text-sm text-gray-600 mt-1">{description}</p>
          <p className="text-xs text-gray-400 mt-1">{time}</p>
        </div>
      </motion.div>
    );
  };

  const QuickActionCard = ({ title, icon: Icon, color, onClick, count }) => {
    return (
      <motion.button
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
        onClick={onClick}
        className={`bg-white rounded-lg sm:rounded-xl shadow-sm border border-gray-100 p-4 sm:p-6 hover:shadow-md transition-all duration-300 flex flex-col items-center justify-center gap-2 sm:gap-3 ${color} group`}
      >
        <div
          className={`p-3 sm:p-4 rounded-lg ${color} bg-opacity-10 group-hover:bg-opacity-20 transition-all`}
        >
          <Icon className={`w-6 h-6 sm:w-8 sm:h-8 ${color}`} />
        </div>
        <div className="text-center">
          <p className="text-xs sm:text-sm font-medium text-gray-600">{title}</p>
          {count !== undefined && (
            <p className="text-xl sm:text-2xl font-bold text-gray-900 mt-1">{count}</p>
          )}
        </div>
      </motion.button>
    );
  };

  // Use skeleton loading hook to ensure minimum display time and data validation
  const showSkeleton = useSkeletonLoading(
    loading,
    stats, // Use stats object to validate data is loaded
    SKELETON_MIN_DISPLAY_TIME,
    (data) => data && typeof data === 'object' && Object.keys(data).length > 0
  );

  if (showSkeleton) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <TableSkeleton rows={5} columns={4} />
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-8">
      {/* Welcome Section */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-gradient-to-r from-primary to-primary/80 rounded-xl sm:rounded-2xl p-4 sm:p-6 lg:p-8 text-white shadow-lg"
      >
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 sm:gap-4">
          <div className="min-w-0">
            <h1 className="text-xl sm:text-2xl lg:text-3xl font-bold mb-1 sm:mb-2 truncate">
              Welcome back, {member?.full_name || user?.username || "User"}!
            </h1>
            <p className="text-white/90 text-xs sm:text-sm lg:text-base">
              Here's what's happening with your estate management today.
            </p>
          </div>
          <div className="flex gap-2 sm:gap-3 flex-shrink-0">
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={() => navigate("/service-fee-list")}
              className="bg-white/20 hover:bg-white/30 backdrop-blur-sm px-3 py-1.5 sm:px-4 sm:py-2 rounded-lg text-xs sm:text-sm font-medium transition-colors flex items-center gap-1.5 sm:gap-2 whitespace-nowrap"
            >
              <IoCashOutline className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
              <span className="hidden sm:inline">Record Payment</span>
              <span className="sm:hidden">Payment</span>
            </motion.button>
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={() => navigate("/announcements")}
              className="bg-white/20 hover:bg-white/30 backdrop-blur-sm px-3 py-1.5 sm:px-4 sm:py-2 rounded-lg text-xs sm:text-sm font-medium transition-colors flex items-center gap-1.5 sm:gap-2 whitespace-nowrap"
            >
              <IoMegaphoneOutline className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
              <span className="hidden sm:inline">New Announcement</span>
              <span className="sm:hidden">Announce</span>
            </motion.button>
          </div>
        </div>
      </motion.div>

      {/* KPI Cards Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 lg:gap-6">
        <StatCard
          title="Total Members"
          value={stats.totalMembers.toLocaleString()}
          icon={IoPeopleCircleOutline}
          trend={trends.members}
          color="text-blue-600"
          onClick={() => navigate("/member-list")}
        />
        <StatCard
          title="Total Units"
          value={stats.totalUnits.toLocaleString()}
          icon={IoBusinessOutline}
          color="text-purple-600"
          onClick={() => navigate("/ViewTowers")}
        />
        <StatCard
          title="Total Revenue"
          value={`৳${stats.totalRevenue.toLocaleString()}`}
          icon={IoWalletOutline}
          trend={trends.revenue}
          color="text-green-600"
          onClick={() => navigate("/service-fee-overview")}
        />
        <StatCard
          title="Pending Payments"
          value={stats.pendingPayments.toLocaleString()}
          icon={MdPendingActions}
          color="text-orange-600"
          onClick={() => navigate("/service-fee-list")}
        />
      </div>

      {/* Secondary Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 lg:gap-6">
        <StatCard
          title="Total Towers"
          value={stats.totalTowers.toLocaleString()}
          icon={FaBuilding}
          color="text-indigo-600"
          onClick={() => navigate("/ViewTowers")}
        />
        <StatCard
          title="Completed Payments"
          value={stats.completedPayments.toLocaleString()}
          icon={FaCheckCircle}
          color="text-green-600"
        />
        <StatCard
          title="Overdue Payments"
          value={stats.overduePayments.toLocaleString()}
          icon={FaExclamationCircle}
          color="text-red-600"
          onClick={() => navigate("/service-fee-list")}
        />
        <StatCard
          title="Pending Revenue"
          value={`৳${stats.pendingRevenue.toLocaleString()}`}
          icon={FaClock}
          color="text-yellow-600"
        />
      </div>

      {/* Progress Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-2 gap-3 sm:gap-4 lg:gap-6">
        <ProgressCard
          title="Payment Status"
          current={stats.completedPayments}
          total={stats.totalServiceFees}
          color="text-green-600"
          icon={IoCashOutline}
        />
        <ProgressCard
          title="Service Fee Collection"
          current={stats.totalRevenue}
          total={stats.totalRevenue + stats.pendingRevenue}
          color="text-blue-600"
          icon={IoWalletOutline}
        />
      </div>

      {/* Main Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-3 sm:gap-4 lg:gap-6">
        {/* Quick Actions */}
        <div className="lg:col-span-1">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-white rounded-lg sm:rounded-xl shadow-sm border border-gray-100 p-4 sm:p-6"
          >
            <h2 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
              <FaChartLine className="w-5 h-5 text-primary" />
              Quick Actions
            </h2>
            <div className="grid grid-cols-2 gap-3">
              <QuickActionCard
                title="Members"
                icon={IoPeopleCircleOutline}
                color="text-blue-600"
                onClick={() => navigate("/member-list")}
                count={stats.totalMembers}
              />
              <QuickActionCard
                title="Towers"
                icon={IoBusinessOutline}
                color="text-purple-600"
                onClick={() => navigate("/ViewTowers")}
                count={stats.totalTowers}
              />
              <QuickActionCard
                title="Payments"
                icon={IoCashOutline}
                color="text-green-600"
                onClick={() => navigate("/service-fee-list")}
                count={stats.pendingPayments}
              />
              <QuickActionCard
                title="Announcements"
                icon={IoMegaphoneOutline}
                color="text-orange-600"
                onClick={() => navigate("/announcements")}
              />
            </div>
          </motion.div>
        </div>

        {/* Recent Activity */}
        <div className="lg:col-span-2">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-white rounded-lg sm:rounded-xl shadow-sm border border-gray-100 p-4 sm:p-6"
          >
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                <FaBell className="w-5 h-5 text-primary" />
                Recent Activity
              </h2>
              <button
                onClick={() => navigate("/announcements")}
                className="text-sm text-primary hover:underline"
              >
                View all
              </button>
            </div>
            <div className="space-y-2 max-h-[400px] overflow-y-auto">
              {recentAnnouncements.length > 0 ? (
                recentAnnouncements.map((announcement, index) => (
                  <ActivityItem
                    key={announcement.id || index}
                    icon={IoMegaphoneOutline}
                    title={announcement.title || "Announcement"}
                    description={
                      announcement.description?.substring(0, 60) + "..." ||
                      "No description"
                    }
                    time={
                      announcement.created_at
                        ? new Date(announcement.created_at).toLocaleDateString()
                        : "Recently"
                    }
                    color="text-orange-600"
                  />
                ))
              ) : recentNotices.length > 0 ? (
                recentNotices.map((notice, index) => (
                  <ActivityItem
                    key={notice.id || index}
                    icon={IoClipboardOutline}
                    title={notice.title || "Notice"}
                    description={
                      notice.description?.substring(0, 60) + "..." ||
                      "No description"
                    }
                    time={
                      notice.created_at
                        ? new Date(notice.created_at).toLocaleDateString()
                        : "Recently"
                    }
                    color="text-blue-600"
                  />
                ))
              ) : (
                <div className="text-center py-8 text-gray-500">
                  <FaBell className="w-12 h-12 mx-auto mb-3 text-gray-300" />
                  <p>No recent activity</p>
                </div>
              )}
            </div>
          </motion.div>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 sm:gap-4 lg:gap-6">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="bg-gradient-to-br from-blue-50 to-blue-100 rounded-xl p-6 border border-blue-200"
        >
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-semibold text-blue-900">
              Active Announcements
            </h3>
            <IoMegaphoneOutline className="w-6 h-6 text-blue-600" />
          </div>
          <p className="text-3xl font-bold text-blue-900">
            {recentAnnouncements.length}
          </p>
          <p className="text-sm text-blue-700 mt-2">Currently active</p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="bg-gradient-to-br from-green-50 to-green-100 rounded-xl p-6 border border-green-200"
        >
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-semibold text-green-900">
              Payment Rate
            </h3>
            <FaCheckCircle className="w-6 h-6 text-green-600" />
          </div>
          <p className="text-3xl font-bold text-green-900">
            {stats.totalServiceFees > 0
              ? (
                  (stats.completedPayments / stats.totalServiceFees) *
                  100
                ).toFixed(1)
              : 0}
            %
          </p>
          <p className="text-sm text-green-700 mt-2">Completion rate</p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="bg-gradient-to-br from-purple-50 to-purple-100 rounded-xl p-6 border border-purple-200"
        >
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-semibold text-purple-900">
              Total Units
            </h3>
            <IoBusinessOutline className="w-6 h-6 text-purple-600" />
          </div>
          <p className="text-3xl font-bold text-purple-900">
            {stats.totalUnits}
          </p>
          <p className="text-sm text-purple-700 mt-2">Across all towers</p>
        </motion.div>
      </div>
    </div>
  );
};

export default Dashboard;
