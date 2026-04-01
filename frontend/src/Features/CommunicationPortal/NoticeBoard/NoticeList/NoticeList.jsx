import { useState, useEffect, useRef, useMemo, useCallback } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { HiClipboardList } from "react-icons/hi";
import EmptyState from "../../../../Components/Ui/EmptyState.jsx";
import { FaPlus, FaImage, FaFilePdf, FaFileWord } from "react-icons/fa";
import { BiSearch } from "react-icons/bi";

import usePinPost from "../components/PinPost";
import Calendar from "../../Announcements/components/Calendar";
import ModernDatePicker from "../../../../Components/FormComponent/ModernDatePicker";
import ConfirmationMessageBox from "../../../../Components/MessageBox/ConfirmationMessageBox";
import MessageBox from "../../../../Components/MessageBox/MessageBox";
import ImageSlider from "../../../../Components/Modal/ImageSlider";
import DocumentViewer from "../../../../Components/FileViewer/DocumentViewer";
import { useNotices } from "../../../../hooks/useNotices";
import NoticeListPreview from "./NoticeListPreview";
import FilterSelectModal from "../../../../Components/FilterSelect/FilterSelectModal";
import TableSkeleton from "../../../../Components/Loaders/TableSkeleton";
import useSkeletonLoading from "../../../../hooks/useSkeletonLoading";
import { SKELETON_MIN_DISPLAY_TIME } from "../../../../config/skeletonLoadingConfig";
import ModernLoadingAnimation from "../../../../Components/Loaders/ModernLoadingAnimation";
import { clearUserCountCache } from "../hooks/useUserCount";
import { useDispatch } from "react-redux";
import { fetchLabels } from "../../../../redux/slices/api/noticeApi";
import { useUserCount } from "../hooks/useUserCount";
import { checkPermission } from "../../../../utils/permissionUtils";
import { PERMISSIONS } from "../../../../constants/permissions";
import AnimatedTabs from "../../../../Components/Tabs/AnimatedTabs";
import PageContainer from "../../../../Components/Ui/PageContainer";
import ContentBox from "../../../../Components/Ui/ContentBox";
import Button from "../../../../Components/FormComponent/ButtonComponent/Button";
import FilterButton from "../../../../Components/FormComponent/ButtonComponent/FilterButton";
import Heading from "../../../../Components/HeadingComponent/Heading";
import { Div } from "../../../../Components/Ui/Div";

const NoticeList = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const dispatch = useDispatch();

  // User count hook for prefetching
  const { prefetchUserCounts } = useUserCount([]);

  // Redux hooks for notices
  const {
    notices: reduxNotices,
    loading: reduxLoading,
    deleteSuccess,
    message,
    loadNotices: loadNoticesRedux,
    updateAllStatuses: updateAllStatusesRedux,
    removeNotice: removeNoticeRedux,
    moveNoticeToExpired: moveNoticeToExpiredRedux,
    restoreExpiredNotice: restoreExpiredNoticeRedux,

    clearAllSuccess: clearAllSuccessRedux
  } = useNotices();

  const [activeTab, setActiveTab] = useState(() => {
    // Always default to Ongoing (tab 1) when navigating to the page
    // Only respect location.state.activeTab if explicitly provided (e.g., coming back from edit)
    return location.state?.activeTab || 1;
  });
  const [myPostChecked, setMyPostChecked] = useState(false);
  const [selectedPriority, setSelectedPriority] = useState([]);
  const [selectedLabel, setSelectedLabel] = useState([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [availableLabels, setAvailableLabels] = useState([]);
  const [selectedImages, setSelectedImages] = useState([]);
  const [selectedImageIndex, setSelectedImageIndex] = useState(0);
  const [isImageSliderOpen, setIsImageSliderOpen] = useState(false);
  const [selectedDocument, setSelectedDocument] = useState(null);
  const [isDocumentViewerOpen, setIsDocumentViewerOpen] = useState(false);
  const [openDropdownId, setOpenDropdownId] = useState(null);
  const dropdownRef = useRef(null);
  const previousPathnameRef = useRef(location.pathname);
  const isInitialMountRef = useRef(true);
  const [showDeleteConfirmation, setShowDeleteConfirmation] = useState(false);
  const [noticeToDelete, setNoticeToDelete] = useState(null);
  const [showExpireConfirmation, setShowExpireConfirmation] = useState(false);
  const [noticeToExpire, setNoticeToExpire] = useState(null);
  const [showRestoreConfirmation, setShowRestoreConfirmation] = useState(false);
  const [noticeToRestore, setNoticeToRestore] = useState(null);


  const [selectedDate, setSelectedDate] = useState("");
  const [showSuccessMessage, setShowSuccessMessage] = useState(false);
  const [successMessage, setSuccessMessage] = useState("");
  const [showErrorMessage, setShowErrorMessage] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [isFilterExpanded, setIsFilterExpanded] = useState(true);
  const [isPrefetchingCounts, setIsPrefetchingCounts] = useState(false);

  const { togglePin } = usePinPost();
  const searchInputRef = useRef(null);
  const loadNoticesTimerRef = useRef(null);
  const [canExpire, setCanExpire] = useState(false);
  const [permissionLoading, setPermissionLoading] = useState(true);
  const [isLoading, setIsLoading] = useState(false);
  const [hasLoadedOnce, setHasLoadedOnce] = useState(false);
  const [highlightedNoticeId, setHighlightedNoticeId] = useState(null);
  const [isActionProcessing, setIsActionProcessing] = useState(false);

  // Clear highlight when tab changes
  useEffect(() => {
    setHighlightedNoticeId(null);
  }, [activeTab]);

  // Define loadNotices before useEffects that use it
  const loadNotices = useCallback(
    async (forceRefresh = false) => {
      try {
        const accessToken = localStorage.getItem("access_token");
        if (!accessToken) {
          console.error("No access token found. User needs to login.");
          return;
        }

        const params = {};
        if (forceRefresh) params._t = Date.now();
        if (selectedPriority.length > 0)
          params.priority = selectedPriority
            .map((p) => p.toLowerCase())
            .join(",");
        if (selectedLabel.length > 0) params.label = selectedLabel.join(",");
        if (searchTerm) params.search = searchTerm;
        if (myPostChecked) params.my_posts = "true";

        await loadNoticesRedux(params);
      } catch (error) {
        console.error("Error loading notices:", error);
        setErrorMessage("Failed to load notices. Please try again.");
        setShowErrorMessage(true);
      }
    },
    [
      selectedPriority,
      selectedLabel,
      searchTerm,
      myPostChecked,
      loadNoticesRedux
    ]
  );

  // Define updateAllStatuses before useEffects that use it
  const updateAllStatuses = useCallback(async () => {
    try {
      await updateAllStatusesRedux();
      await loadNotices();
    } catch (error) {
      console.error("Error updating statuses:", error);
    }
  }, [updateAllStatusesRedux, loadNotices]);

  // Load permissions on component mount
  useEffect(() => {
    let isMounted = true;

    const loadPermissions = async () => {
      try {
        const expire = await checkPermission(
          "org",
          PERMISSIONS.EXPIRE_NOTICE_BOARD
        );

        if (!isMounted) return;

        setCanExpire(expire);
      } catch (error) {
        console.error("Error checking notice permissions:", error);
      } finally {
        if (isMounted) {
          setPermissionLoading(false);
        }
      }
    };

    loadPermissions();

    return () => {
      isMounted = false;
    };
  }, []);

  // Load notices on component mount and when filters change
  useEffect(() => {
    // Prevent multiple simultaneous loads
    if (isLoading) return;

    const loadData = async () => {
      setIsLoading(true);
      try {
        // Only update statuses on first load
        if (!hasLoadedOnce) {
          await updateAllStatuses();
          setHasLoadedOnce(true);
        } else {
          await loadNotices();
        }
      } finally {
        setIsLoading(false);
      }
    };

    loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    activeTab,
    myPostChecked,
    selectedPriority,
    selectedLabel,
    searchTerm,
    selectedDate,
    hasLoadedOnce,
    updateAllStatuses,
    loadNotices
  ]);

  // Auto-update notice statuses every 2 minutes
  useEffect(() => {
    const interval = setInterval(() => {
      updateAllStatuses();
    }, 120000); // 2 minutes

    return () => clearInterval(interval);
  }, [updateAllStatuses]);

  // Clear cache when user returns to the page/tab (same as AnnouncementList)
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (!document.hidden && hasLoadedOnce) {
        // User returned to the tab, clear cache for fresh data
        clearUserCountCache();
        // Reload notices to get latest data
        loadNotices(true); // force refresh
      }
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () =>
      document.removeEventListener("visibilitychange", handleVisibilityChange);
  }, [hasLoadedOnce, loadNotices]);

  // Load available labels from database
  useEffect(() => {
    const loadLabelsFromDatabase = async () => {
      try {
        const result = await dispatch(fetchLabels());
        if (result.payload) {
          setAvailableLabels(result.payload);
        } else {
          setAvailableLabels([]);
        }
      } catch (error) {
        console.error("Error loading labels from database:", error);
        setAvailableLabels([]);
      }
    };

    loadLabelsFromDatabase();
  }, [dispatch]);

  // Debug: Log current user info for My Post filter
  useEffect(() => {
    const member = localStorage.getItem("member");
    const user = localStorage.getItem("user");
    let currentUserName = null;

    if (member) {
      try {
        const currentUser = JSON.parse(member);
        currentUserName =
          currentUser.full_name || currentUser.fullName || currentUser.name;
      } catch (error) {
        console.error("Error parsing member data:", error);
      }
    }

    console.log("👤 Current user info for My Post filter:", {
      member,
      user,
      currentUserName,
      hasUser: !!currentUserName
    });
  }, []);

  // Handle success messages from Redux
  useEffect(() => {
    if (deleteSuccess && message) {
      setSuccessMessage(message);
      setShowSuccessMessage(true);
      clearAllSuccessRedux();
    }
  }, [deleteSuccess, message, clearAllSuccessRedux]);

  // Save active tab to localStorage
  useEffect(() => {
    localStorage.setItem("noticeActiveTab", activeTab.toString());
  }, [activeTab]);

  // Clear user count cache when component unmounts
  useEffect(() => {
    return () => {
      clearUserCountCache();
    };
  }, []);

  // Handle clicks outside dropdown
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setOpenDropdownId(null);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Reset to Ongoing tab when navigating to the page from outside
  useEffect(() => {
    const currentPathname = location.pathname;
    const isOnNoticeBoardPage = currentPathname.includes("notice-board");

    // Check if we're navigating TO the notice board page (either first mount or coming from another page)
    const wasOnNoticeBoardPage =
      previousPathnameRef.current?.includes("notice-board");
    const isNavigatingToPage =
      isInitialMountRef.current ||
      (!wasOnNoticeBoardPage && isOnNoticeBoardPage);

    // Reset to Ongoing tab (1) when navigating to the page from outside
    // Only respect location.state.activeTab if explicitly provided (e.g., coming back from edit)
    if (isNavigatingToPage && isOnNoticeBoardPage) {
      if (location.state?.activeTab) {
        setActiveTab(location.state.activeTab);
        localStorage.setItem(
          "noticeActiveTab",
          location.state.activeTab.toString()
        );
      } else {
        // Always default to Ongoing tab when navigating from other pages
        setActiveTab(1);
        localStorage.setItem("noticeActiveTab", "1");
      }
    }

    // Handle noticeId from notification click - capture it before clearing state
    const noticeIdToHighlight = location.state?.noticeId;
    let highlightTimeout = null;

    if (noticeIdToHighlight) {
      console.log('[NoticeList] Setting highlighted notice ID:', noticeIdToHighlight);
      setHighlightedNoticeId(noticeIdToHighlight);

      // Scroll to the notice with retry logic
      const scrollToNotice = (retries = 5) => {
        setTimeout(() => {
          const element = document.getElementById(`notice-${noticeIdToHighlight}`);
          console.log('[NoticeList] Scrolling to element:', element, 'retries left:', retries);
          if (element) {
            element.scrollIntoView({ behavior: "smooth", block: "center" });
          } else if (retries > 0) {
            // Retry if element not found yet (still loading)
            scrollToNotice(retries - 1);
          }
        }, 300);
      };

      scrollToNotice();

      // Clear highlight after 5 seconds
      highlightTimeout = setTimeout(() => {
        setHighlightedNoticeId(null);
        console.log('[NoticeList] Cleared highlight after timeout');
      }, 5000);
    }

    // Clear location state after processing
    if (location.state?.activeTab || location.state?.noticeId) {
      window.history.replaceState({}, document.title);
    }

    // Update refs for next render
    previousPathnameRef.current = currentPathname;
    isInitialMountRef.current = false;

    // Cleanup timeout on unmount or when effect re-runs
    return () => {
      if (highlightTimeout) {
        clearTimeout(highlightTimeout);
      }
    };
  }, [location.pathname, location.state]);

  // Memoized filtered notices - only recalculate when dependencies change
  // Use skeleton loading hook to ensure minimum display time and data validation
  const showSkeleton = useSkeletonLoading(
    reduxLoading,
    reduxNotices,
    SKELETON_MIN_DISPLAY_TIME
  );

  const filteredNotices = useMemo(() => {
    let filtered = reduxNotices || [];

    // Filter by status based on active tab
    if (activeTab === 1) {
      filtered = filtered.filter((notice) => notice.status === "ongoing");
    } else if (activeTab === 2) {
      filtered = filtered.filter((notice) => notice.status === "upcoming");
    } else if (activeTab === 3) {
      filtered = filtered.filter((notice) => notice.status === "expired");
    }

    // Filter by search term
    if (searchTerm) {
      const searchLower = searchTerm.toLowerCase();
      filtered = filtered.filter(
        (notice) =>
          (notice.internalTitle &&
            notice.internalTitle.toLowerCase().includes(searchLower)) ||
          (notice.author && notice.author.toLowerCase().includes(searchLower))
      );
    }

    // Filter by priority
    if (selectedPriority.length > 0) {
      filtered = filtered.filter((notice) => {
        const noticePriority = notice.priority?.toLowerCase();
        return selectedPriority.some(
          (selectedP) => selectedP.toLowerCase() === noticePriority
        );
      });
    }

    // Filter by label
    if (selectedLabel.length > 0) {
      filtered = filtered.filter((notice) => {
        if (!notice.label) return false;
        const noticeLabels = notice.label
          .split(",")
          .map((l) => l.trim().toLowerCase());
        return selectedLabel.some((selectedLbl) =>
          noticeLabels.includes(selectedLbl.toLowerCase())
        );
      });
    }

    // Filter by date
    if (selectedDate) {
      filtered = filtered.filter((notice) => {
        if (!notice.startDate || !notice.endDate) return false;
        const selectedDateObj = new Date(selectedDate);
        selectedDateObj.setHours(0, 0, 0, 0);
        const noticeStartDate = new Date(notice.startDate);
        noticeStartDate.setHours(0, 0, 0, 0);
        const noticeEndDate = new Date(notice.endDate);
        noticeEndDate.setHours(0, 0, 0, 0);
        return (
          selectedDateObj >= noticeStartDate && selectedDateObj <= noticeEndDate
        );
      });
    }

    // Filter by "My Posts"
    if (myPostChecked) {
      const member = localStorage.getItem("member");
      let currentUserName = null;
      if (member) {
        try {
          const currentUser = JSON.parse(member);
          currentUserName =
            currentUser.full_name || currentUser.fullName || currentUser.name;
        } catch (error) {
          console.error("Error parsing member data:", error);
        }
      }

      if (currentUserName) {
        filtered = filtered.filter((notice) => {
          return (
            notice.creatorName &&
            notice.creatorName.toLowerCase() === currentUserName.toLowerCase()
          );
        });
      } else {
        filtered = [];
      }
    }

    // Sort notices: pinned first, then by creation date (newest first)
    return [...filtered].sort((a, b) => {
      // Check pinned status (support multiple property names)
      const aIsPinned = a.pinned || a.isPinned || a.is_pinned;
      const bIsPinned = b.pinned || b.isPinned || b.is_pinned;

      // Pinned notices come first
      if (aIsPinned && !bIsPinned) return -1;
      if (!aIsPinned && bIsPinned) return 1;

      // For both pinned or both not pinned, sort by creation date (newest first)
      const aDate = new Date(a.created_at || a.createdAt || a.startDate || 0);
      const bDate = new Date(b.created_at || b.createdAt || b.startDate || 0);
      return bDate - aDate;
    });
  }, [
    reduxNotices,
    activeTab,
    searchTerm,
    selectedPriority,
    selectedLabel,
    selectedDate,
    myPostChecked
  ]);

  // Prefetch user counts for all visible notices to avoid loading delays
  useEffect(() => {
    const prefetch = async () => {
      if (filteredNotices && filteredNotices.length > 0) {
        // Extract all unique unit ID arrays from notices
        const unitIdArrays = filteredNotices
          .map(
            (notice) => notice.target_units_data?.map((unit) => unit.id) || []
          )
          .filter((arr) => arr.length > 0); // Only prefetch for notices with units

        if (unitIdArrays.length > 0) {
          setIsPrefetchingCounts(true);

          try {
            // Prefetch all user counts in ONE batch API call
            await prefetchUserCounts(unitIdArrays);
          } catch (error) {
            console.error("Error prefetching user counts:", error);
          } finally {
            setIsPrefetchingCounts(false);
          }
        } else {
          setIsPrefetchingCounts(false);
        }
      } else {
        setIsPrefetchingCounts(false);
      }
    };

    prefetch();
  }, [filteredNotices, prefetchUserCounts]);

  const handleTabChange = (tabNumber) => {
    setActiveTab(tabNumber);
  };

  const handleAddNotice = () => {
    navigate("/notice-board/add");
  };

  const handleEditNotice = (noticeId) => {
    navigate(`/notice-board/edit/${noticeId}`, {
      state: {
        sourceTab: activeTab,
        noticeId: noticeId
      }
    });
  };

  const handleDeleteNotice = (noticeId) => {
    // Find the notice in the current notices list
    const notice = reduxNotices.find((n) => n.id === noticeId);
    if (!notice) {
      console.error("Notice not found:", noticeId);
      setErrorMessage("Notice not found. Please refresh and try again.");
      setShowErrorMessage(true);
      return;
    }
    setNoticeToDelete(notice);
    setShowDeleteConfirmation(true);
  };

  const confirmDeleteNotice = async () => {
    if (noticeToDelete) {
      try {
        await removeNoticeRedux(noticeToDelete.id);
        setShowDeleteConfirmation(false);
        setNoticeToDelete(null);
      } catch (error) {
        console.error("Error deleting notice:", error);
        setErrorMessage("Failed to delete notice. Please try again.");
        setShowErrorMessage(true);
      }
    }
  };

  const handleExpireNotice = (noticeId) => {
    if (!canExpire) {
      setErrorMessage("You are not authorized to expire notices.");
      setShowErrorMessage(true);
      return;
    }
    // Find the notice in the current notices list
    const notice = reduxNotices.find((n) => n.id === noticeId);
    if (!notice) {
      console.error("Notice not found:", noticeId);
      setErrorMessage("Notice not found. Please refresh and try again.");
      setShowErrorMessage(true);
      return;
    }
    setNoticeToExpire(notice);
    setShowExpireConfirmation(true);
  };

  const confirmExpireNotice = async () => {
    if (!canExpire) {
      setErrorMessage("You are not authorized to expire notices.");
      setShowErrorMessage(true);
      setShowExpireConfirmation(false);
      setNoticeToExpire(null);
      return;
    }
    if (noticeToExpire) {
      const id = noticeToExpire.id;
      setShowExpireConfirmation(false);
      setIsActionProcessing(true);
      try {
        await moveNoticeToExpiredRedux(id);
        setNoticeToExpire(null);
        setSuccessMessage("Notice has been moved to expired.");
        setShowSuccessMessage(true);
      } catch (error) {
        console.error("Error expiring notice:", error);
        setErrorMessage("Failed to expire notice. Please try again.");
        setShowErrorMessage(true);
      } finally {
        setIsActionProcessing(false);
      }
    }
  };

  const handleRestoreNotice = (noticeId) => {
    // Find the notice in the current notices list
    const notice = reduxNotices.find((n) => n.id === noticeId);
    if (!notice) {
      console.error("Notice not found:", noticeId);
      setErrorMessage("Notice not found. Please refresh and try again.");
      setShowErrorMessage(true);
      return;
    }
    setNoticeToRestore(notice);
    setShowRestoreConfirmation(true);
  };

  const confirmRestoreNotice = async () => {
    if (noticeToRestore) {
      const id = noticeToRestore.id;
      setShowRestoreConfirmation(false);
      setIsActionProcessing(true);
      try {
        await restoreExpiredNoticeRedux(id);
        setNoticeToRestore(null);
        setSuccessMessage("Notice has been restored.");
        setShowSuccessMessage(true);
      } catch (error) {
        console.error("Error restoring notice:", error);
        setErrorMessage("Failed to restore notice. Please try again.");
        setShowErrorMessage(true);
      } finally {
        setIsActionProcessing(false);
      }
    }
  };

  const handlePinToggle = async (noticeId) => {
    try {
      // Find the notice in the current notices list
      const notice = reduxNotices.find((n) => n.id === noticeId);
      if (!notice) {
        console.error("Notice not found:", noticeId);
        setErrorMessage("Notice not found. Please refresh and try again.");
        setShowErrorMessage(true);
        return;
      }

      // Use the togglePin function from usePinPost hook
      // Redux automatically updates the state via extraReducers in noticeSlice
      // No need to reload notices - Redux state is updated immediately
      await togglePin(noticeId);

      // The useEffect hook will automatically sync selectedNoticeForDetail with updated Redux state
    } catch (error) {
      console.error("Error toggling pin:", error);
      setErrorMessage("Failed to update pin status. Please try again.");
      setShowErrorMessage(true);
    }
  };

  const handleDropdownToggle = (noticeId) => {
    setOpenDropdownId(openDropdownId === noticeId ? null : noticeId);
  };

  const handleFilterToggle = () => {
    setIsFilterExpanded(!isFilterExpanded);
    console.log("🔧 Filter panel toggled:", !isFilterExpanded);
  };

  const handleImageClick = (attachment, notice) => {
    const allAttachments = notice.attachments || [];
    const imageAttachments = allAttachments.filter(
      (att) =>
        isImage(att.file_name || att.name) ||
        (!att.file_name && !att.name && !isDocument(att.file_name || att.name))
    );
    const clickedIndex = imageAttachments.findIndex(
      (img) =>
        (img.file_url || img.url || img) ===
        (attachment.file_url || attachment.url || attachment)
    );
    const formattedImages = imageAttachments.map((img, index) => ({
      src: img.file_url || img.url || img,
      alt: img.file_name || img.name || `Image ${index + 1}`,
      name: img.file_name || img.name || `image-${index + 1}`
    }));
    setSelectedImages(formattedImages);
    setSelectedImageIndex(clickedIndex >= 0 ? clickedIndex : 0);
    setIsImageSliderOpen(true);
  };

  const handleDocumentClick = (attachment) => {
    setSelectedDocument(attachment);
    setIsDocumentViewerOpen(true);
  };

  const isImage = (fileName) => {
    const extension = fileName?.split(".").pop()?.toLowerCase();
    return ["jpg", "jpeg", "png", "gif", "bmp", "webp"].includes(extension);
  };

  const isDocument = (fileName) => {
    const extension = fileName?.split(".").pop()?.toLowerCase();
    return ["pdf", "doc", "docx"].includes(extension);
  };

  const getFileIcon = (fileName) => {
    const extension = fileName?.split(".").pop()?.toLowerCase();
    switch (extension) {
      case "pdf":
        return <FaFilePdf className="w-6 h-6 text-black font-bold" />;
      case "doc":
      case "docx":
        return <FaFileWord className="w-6 h-6 text-blue-500" />;
      default:
        return <FaImage className="w-6 h-6 text-gray-400" />;
    }
  };


  return (
    <div>
      <PageContainer className="min-h-screen bg-surfaceMuted px-4 sm:px-6 lg:px-[13px]">
        <ContentBox>
          {/* Sticky Header Section */}
          <Div className="sticky md:top-0 z-30 bg-white pb-3 sm:pb-4 backdrop-blur -mx-4 sm:-mx-6 lg:-mx-[13px] px-4 sm:px-6 lg:px-[13px]">
            {/* Header */}
            <Div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 sm:gap-0 py-2 sm:py-4 mb-3 sm:mb-4">
              <Heading title="Notice Board" size="xl" color="text-black" />
              <Div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 sm:gap-3 md:gap-4 w-full sm:w-auto">
                <label className="flex items-center">
                  <input
                    type="checkbox"
                    checked={myPostChecked}
                    onChange={(e) => {
                      console.log("👤 My Post filter toggled:", e.target.checked);
                      setMyPostChecked(e.target.checked);
                    }}
                    className="form-checkbox h-4 w-4 text-primary rounded border-gray-300 focus:ring-primary"
                  />
                  <span className="ml-2 text-xs sm:text-sm text-primary whitespace-nowrap">My Post</span>
                </label>

                <FilterButton
                  active={isFilterExpanded}
                  onClick={handleFilterToggle}
                  className="w-full sm:w-auto"
                >
                  Filter
                </FilterButton>

                <Button
                  icon={FaPlus}
                  onClick={handleAddNotice}
                  className="bg-primary hover:bg-primary-dark text-white w-full sm:w-auto flex items-center justify-center"
                >
                  <span className="hidden sm:inline">Add Notice</span>
                  <span className="sm:hidden">Add</span>
                </Button>
              </Div>
            </Div>

            {isFilterExpanded && (
              <Div className="flex flex-col md:flex-row md:justify-end items-stretch md:items-center gap-3 md:gap-4 pb-3 sm:pb-4 pt-2">
                {/* Debug info - remove in production */}
                {/* <div className="text-xs text-gray-500 bg-gray-100 p-2 rounded">
                  Filters: {selectedPriority.length > 0 ? `Priority(${selectedPriority.join(',')})` : ''} 
                  {selectedLabel.length > 0 ? ` Label(${selectedLabel.join(',')})` : ''} 
                  {searchTerm ? ` Search(${searchTerm})` : ''} 
                  {myPostChecked ? ' MyPosts' : ''}
                </div> */}
                <div className="w-full md:min-w-[160px] md:w-auto">
                  <ModernDatePicker
                    label=""
                    value={selectedDate || ""}
                    onChange={setSelectedDate}
                    placeholder="Select Date"
                    name="noticeFilterDate"
                    showIcon={false}
                    inputClassName="h-[42px] px-3 border border-primary rounded-lg focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent bg-white text-primary text-sm pl-3 placeholder:text-primary placeholder:text-sm w-full"
                    maxYearOffset={10}
                  />
                </div>

                <div className="w-full md:min-w-[160px] md:w-auto">
                  <FilterSelectModal
                    placeholder="Select Priority"
                    options={[
                      { value: "urgent", label: "Urgent" },
                      { value: "high", label: "High" },
                      { value: "normal", label: "Normal" },
                      { value: "low", label: "Low" }
                    ]}
                    value={selectedPriority}
                    onApply={setSelectedPriority}
                    className="w-full"
                  />
                </div>

                <div className="w-full md:min-w-[160px] md:w-auto">
                  <FilterSelectModal
                    placeholder="Select Label"
                    options={availableLabels.map((label) => ({
                      value: label,
                      label: label
                    }))}
                    value={selectedLabel}
                    onApply={setSelectedLabel}
                    className="w-full"
                  />
                </div>

                <div className="relative w-full md:min-w-[200px] md:max-w-[250px]">
                  <BiSearch className="absolute left-3 top-1/2 transform -translate-y-1/2 text-primary w-4 h-4" />
                  <input
                    ref={searchInputRef}
                    type="text"
                    placeholder="Search..."
                    className="w-full h-[42px] pl-10 pr-4 border border-primary rounded-lg focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent text-sm text-primary placeholder:text-primary placeholder:text-sm"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                  />
                </div>
              </Div>
            )}

            {/* Tabs */}
            <div className="pt-4">
              <AnimatedTabs
                tabs={[
                  { id: 1, label: "Ongoing" },
                  { id: 2, label: "Upcoming" },
                  { id: 3, label: "Expired" }
                ]}
                activeTab={activeTab}
                onTabChange={handleTabChange}
                sticky={false}
                className="mb-4"
              />
            </div>
          </Div>

          {/* Main Content */}
          <div className="flex-shrink-0 pt-4">
            {/* Notice List - Scrollable Content Area */}
            <div className="overflow-auto pt-4">
              {showSkeleton ? (
                <div className="flex justify-center items-center py-12">
                  <TableSkeleton rows={5} columns={4} />
                </div>
              ) : filteredNotices.length === 0 ? (
                <EmptyState
                  icon={HiClipboardList}
                  title="No Notices Found"
                >
                  {(selectedPriority.length > 0 ||
                    selectedLabel.length > 0 ||
                    searchTerm ||
                    myPostChecked ||
                    selectedDate) && (
                      <p className="text-gray-500 mt-2">
                        Try adjusting your filters or search terms.
                      </p>
                    )}
                </EmptyState>
              ) : (
                <NoticeListPreview
                  notices={filteredNotices}
                  openDropdownId={openDropdownId}
                  dropdownRef={dropdownRef}
                  currentTab={activeTab}
                  highlightedNoticeId={highlightedNoticeId}
                  handleDropdownToggle={handleDropdownToggle}
                  onEdit={handleEditNotice}
                  onDelete={handleDeleteNotice}
                  onExpire={handleExpireNotice}
                  onRestore={handleRestoreNotice}
                  onPinToggle={handlePinToggle}
                  onImageClick={handleImageClick}
                  activeTab={activeTab}
                  handleDocumentClick={handleDocumentClick}
                  isDocument={isDocument}
                  canExpire={canExpire}
                  getFileIcon={getFileIcon}
                />
              )}
            </div>
          </div>


          {/* Action Loading Overlay */}
          {isActionProcessing && (
            <div className="fixed inset-0 flex items-center justify-center bg-gray-900 bg-opacity-50 z-[60]">
              <ModernLoadingAnimation />
            </div>
          )}

          {/* Modals and Dialogs */}
          {showDeleteConfirmation && (
            <ConfirmationMessageBox
              message={`Are you sure you want to delete this notice? This action cannot be undone.`}
              onConfirm={confirmDeleteNotice}
              onCancel={() => {
                setShowDeleteConfirmation(false);
                setNoticeToDelete(null);
              }}
            />
          )}

          {showExpireConfirmation && (
            <ConfirmationMessageBox
              message={`Are you sure you want to move this notice to expired?`}
              onConfirm={confirmExpireNotice}
              onCancel={() => {
                setShowExpireConfirmation(false);
                setNoticeToExpire(null);
              }}
            />
          )}

          {showRestoreConfirmation && (
            <ConfirmationMessageBox
              message={`Are you sure you want to restore this notice?`}
              onConfirm={confirmRestoreNotice}
              onCancel={() => {
                setShowRestoreConfirmation(false);
                setNoticeToRestore(null);
              }}
            />
          )}

          {showSuccessMessage && (
            <MessageBox
              message={successMessage}
              clearMessage={() => setShowSuccessMessage(false)}
            />
          )}

          {showErrorMessage && (
            <MessageBox
              message={errorMessage}
              clearMessage={() => setShowErrorMessage(false)}
            />
          )}

          <ImageSlider
            isOpen={isImageSliderOpen}
            onClose={() => setIsImageSliderOpen(false)}
            images={selectedImages}
            initialIndex={selectedImageIndex}
          />

          {isDocumentViewerOpen && selectedDocument && (
            <DocumentViewer
              fileUrl={
                selectedDocument.file_url ||
                selectedDocument.url ||
                selectedDocument.base64
              }
              fileName={selectedDocument.file_name || selectedDocument.name}
              onClose={() => setIsDocumentViewerOpen(false)}
            />
          )}
        </ContentBox>
      </PageContainer>
    </div>
  );
};

export default NoticeList;
