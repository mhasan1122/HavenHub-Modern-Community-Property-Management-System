import { useState, useEffect, useRef } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { HiMegaphone } from "react-icons/hi2";
import EmptyState from "../../../../Components/Ui/EmptyState.jsx";
import { FaPlus, FaFilePdf, FaFileWord, FaImage } from "react-icons/fa";
import { BiSearch } from "react-icons/bi";
import AnnouncementHistoryModal from "../components/AnnouncementHistoryModal";
import AnnouncementDetailModal from "../components/AnnouncementDetailModal";
import usePinPost from "../components/PinPost";
import ModernDatePicker from "../../../../Components/FormComponent/ModernDatePicker";
import ConfirmationMessageBox from "../../../../Components/MessageBox/ConfirmationMessageBox";
import MessageBox from "../../../../Components/MessageBox/MessageBox";
import ImageSlider from "../../../../Components/Modal/ImageSlider";
import DocumentViewer from "../../../../Components/FileViewer/DocumentViewer";
import { useAnnouncements } from "../../../../hooks/useAnnouncements";
import { useDispatch } from "react-redux";
import { fetchUnreadCount, fetchNotifications } from "../../../../redux/slices/api/notificationApi";
import { restoreAnnouncement } from "../../../../redux/slices/api/announcementApi";
import AnnouncementListPreview from "./AnnouncementListPreview";
import FilterSelectModal from "../../../../Components/FilterSelect/FilterSelectModal";
import TableSkeleton from "../../../../Components/Loaders/TableSkeleton";
import useSkeletonLoading from "../../../../hooks/useSkeletonLoading";
import { SKELETON_MIN_DISPLAY_TIME } from "../../../../config/skeletonLoadingConfig";
import { clearUserCountCache } from "../hooks/useUserCount";
import { checkPermission } from "../../../../utils/permissionUtils";
import { PERMISSIONS } from "../../../../constants/permissions";
import AnimatedTabs from "../../../../Components/Tabs/AnimatedTabs";
import PageContainer from "../../../../Components/Ui/PageContainer";
import ContentBox from "../../../../Components/Ui/ContentBox";
import Button from "../../../../Components/FormComponent/ButtonComponent/Button";
import FilterButton from "../../../../Components/FormComponent/ButtonComponent/FilterButton";
import Heading from "../../../../Components/HeadingComponent/Heading";
import { Div } from "../../../../Components/Ui/Div";

const AnnouncementList = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const dispatch = useDispatch();

  // Redux hooks for announcements
  const {
    announcements: reduxAnnouncements,
    loading: reduxLoading,
    deleteSuccess,
    message,
    loadAnnouncements: loadAnnouncementsRedux,
    updateAllStatuses: updateAllStatusesRedux,
    removeAnnouncement: removeAnnouncementRedux,
    moveAnnouncementToExpired: moveAnnouncementToExpiredRedux,
    restoreExpiredAnnouncement: restoreExpiredAnnouncementRedux,
    loadAnnouncement: loadAnnouncementRedux,
    clearAllSuccess: clearAllSuccessRedux,
    incrementAnnouncementViews
  } = useAnnouncements();

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
  const [openDropdownId, setOpenDropdownId] = useState(null);
  const [showDeleteConfirmation, setShowDeleteConfirmation] = useState(false);
  const [isFilterExpanded, setIsFilterExpanded] = useState(true);
  const [selectedDate, setSelectedDate] = useState("");
  const [announcementToDelete, setAnnouncementToDelete] = useState(null);
  const [showRestoreConfirmation, setShowRestoreConfirmation] = useState(false);
  const [announcementToRestore, setAnnouncementToRestore] = useState(null);
  const [showRestoreSuccess, setShowRestoreSuccess] = useState(false);
  const [restoreSuccessMessage, setRestoreSuccessMessage] = useState("");
  const [showHistoryModal, setShowHistoryModal] = useState(false);
  const [selectedAnnouncementForHistory, setSelectedAnnouncementForHistory] =
    useState(null);
  const [selectedDocument, setSelectedDocument] = useState(null);
  const [isDocumentViewerOpen, setIsDocumentViewerOpen] = useState(false);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [selectedAnnouncementForDetail, setSelectedAnnouncementForDetail] = useState(null);
  const [highlightedAnnouncementId, setHighlightedAnnouncementId] = useState(null);
  const [showMoveToExpiredConfirmation, setShowMoveToExpiredConfirmation] =
    useState(false);
  const [announcementToMoveToExpired, setAnnouncementToMoveToExpired] =
    useState(null);
  const [showMoveToExpiredSuccess, setShowMoveToExpiredSuccess] =
    useState(false);
  const [moveToExpiredSuccessMessage, setMoveToExpiredSuccessMessage] =
    useState("");
  const [lastFetchTime, setLastFetchTime] = useState(Date.now());
  const dropdownRef = useRef(null);
  const previousPathnameRef = useRef(location.pathname);
  const isInitialMountRef = useRef(true);
  const [permissionLoading, setPermissionLoading] = useState(true);
  const [hasViewPermission, setHasViewPermission] = useState(false);
  const [canCreate, setCanCreate] = useState(false);
  const [canEdit, setCanEdit] = useState(false);
  const [canExpire, setCanExpire] = useState(false);
  const [canPin, setCanPin] = useState(false);
  const [permissionError, setPermissionError] = useState(null);

  const announcements = reduxAnnouncements;
  const loading = reduxLoading;

  // Use skeleton loading hook to ensure minimum display time and data validation
  const showSkeleton = useSkeletonLoading(
    loading,
    reduxAnnouncements,
    SKELETON_MIN_DISPLAY_TIME
  );

  useEffect(() => {
    let isMounted = true;

    const loadPermissions = async () => {
      try {
        const [view, add, edit, expire, pin] = await Promise.all([
          checkPermission("org", PERMISSIONS.VIEW_ANNOUNCEMENTS),
          checkPermission("org", PERMISSIONS.ADD_ANNOUNCEMENTS),
          checkPermission("org", PERMISSIONS.EDIT_ANNOUNCEMENTS),
          checkPermission("org", PERMISSIONS.EXPIRE_ANNOUNCEMENTS),
          checkPermission("org", PERMISSIONS.PIN_ANNOUNCEMENTS)
        ]);

        if (!isMounted) return;

        const effectiveView = view || add || edit;
        setHasViewPermission(effectiveView);
        setCanCreate(add);
        setCanEdit(edit);
        setCanExpire(expire);
        setCanPin(pin);

        if (!effectiveView) {
          setPermissionError("You are not authorized to view announcements.");
          navigate("/not-authorized");
        }
      } catch (error) {
        if (!isMounted) return;
        console.error("Error checking announcement permissions:", error);
        setPermissionError("Unable to verify announcement permissions.");
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
  }, [navigate]);

  // Update available labels based on all announcements (not filtered by tab)
  useEffect(() => {
    if (announcements && announcements.length > 0) {
      // Extract unique labels from ALL announcements regardless of tab
      // Split comma-separated labels into individual labels
      const allLabels = announcements
        .map((ann) => ann.label)
        .filter((label) => label && label.trim() !== "")
        .flatMap((label) =>
          label
            .split(",")
            .map((l) => l.trim())
            .filter((l) => l !== "")
        );

      const uniqueLabels = [...new Set(allLabels)];
      setAvailableLabels(uniqueLabels);
    } else {
      setAvailableLabels([]);
    }
  }, [announcements]);

  const pinPost = usePinPost({
    announcements,
    setAnnouncements: () => { },
    onPinSuccess: (message) => console.log("Pin success:", message),
    onPinError: (message) => console.error("Pin error:", message),
    currentTab: activeTab,
    onMoveToExpired: (announcementId) => {
      console.log("Pin moved to expired:", announcementId);
      loadAnnouncements(); // Refresh the announcements list
      // Switch to expired tab to show the moved announcement
      setActiveTab(3);
      localStorage.setItem("announcementActiveTab", "3");
    }
  });

  useEffect(() => {
    if (permissionLoading || !hasViewPermission) return;
    clearUserCountCache();
    loadAnnouncements();
  }, [permissionLoading, hasViewPermission]);

  // Optimized dependency - only reload when filters change
  useEffect(() => {
    if (permissionLoading || !hasViewPermission) return;
    // Debounce search to avoid excessive API calls
    const debounceTimer = setTimeout(
      () => {
        loadAnnouncements();
      },
      searchTerm ? 500 : 0
    );

    return () => clearTimeout(debounceTimer);
  }, [
    myPostChecked,
    selectedPriority,
    searchTerm,
    permissionLoading,
    hasViewPermission
  ]);

  // Optimized status polling - only update statuses, not full reload
  useEffect(() => {
    if (permissionLoading || !hasViewPermission) return;

    const interval = setInterval(() => {
      // Only fetch if data is older than 30 seconds to reduce unnecessary calls
      const timeSinceLastFetch = Date.now() - lastFetchTime;
      if (timeSinceLastFetch > 30000) {
        updateAnnouncementStatuses();
      }
    }, 60000); // Check every 60 seconds

    return () => clearInterval(interval);
  }, [permissionLoading, hasViewPermission, lastFetchTime]);

  // Clear cache when user returns to the page/tab
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (!document.hidden) {
        // User returned to the tab, clear cache for fresh data
        clearUserCountCache();
      }
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () =>
      document.removeEventListener("visibilitychange", handleVisibilityChange);
  }, []);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setOpenDropdownId(null);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Close dropdown menu when scrolling
  useEffect(() => {
    if (!openDropdownId) return;

    const handleScroll = () => {
      setOpenDropdownId(null);
    };

    // Listen to scroll events on window and the main content area
    window.addEventListener("scroll", handleScroll, true);
    const mainContent = document.querySelector("main");
    if (mainContent) {
      mainContent.addEventListener("scroll", handleScroll, true);
    }

    return () => {
      window.removeEventListener("scroll", handleScroll, true);
      if (mainContent) {
        mainContent.removeEventListener("scroll", handleScroll, true);
      }
    };
  }, [openDropdownId]);

  useEffect(() => {
    if (!hasViewPermission || permissionLoading) {
      return;
    }

    const currentPathname = location.pathname;
    const isOnAnnouncementsPage = currentPathname.includes("announcements");

    // Check if we're navigating TO the announcements page (either first mount or coming from another page)
    const wasOnAnnouncementsPage =
      previousPathnameRef.current?.includes("announcements");
    const isNavigatingToPage =
      isInitialMountRef.current ||
      (!wasOnAnnouncementsPage && isOnAnnouncementsPage);

    // PRIORITY: Always respect location.state.activeTab if provided (e.g., from notification click)
    // This ensures tab switching works even when already on the announcements page
    if (location.state?.activeTab && isOnAnnouncementsPage) {
      setActiveTab(location.state.activeTab);
      localStorage.setItem("announcementActiveTab", location.state.activeTab.toString());
    } else if (isNavigatingToPage && isOnAnnouncementsPage) {
      // Only default to Ongoing tab when navigating to the page from outside without activeTab
      if (!location.state?.activeTab) {
        setActiveTab(1);
        localStorage.setItem("announcementActiveTab", "1");
      }
    }

    // Handle announcement ID for scrolling and highlighting
    if (location.state?.announcementId) {
      const announcementId = location.state.announcementId;
      // Store the highlighted announcement ID so we can make it clickable
      setHighlightedAnnouncementId(announcementId);
      setTimeout(() => {
        loadAnnouncements(true);
        // Scroll to the specific announcement card after loading
        setTimeout(() => {
          const cardElement = document.querySelector(
            `[data-card-id="${announcementId}"]`
          );
          if (cardElement) {
            cardElement.scrollIntoView({
              behavior: "smooth",
              block: "center"
            });
            // Add a bold border highlight effect - already applied via className
            // The border-4 class in AnnouncementListPreview will provide the bold border
          }
        }, 500);
      }, 100);
    } else {
      // Clear highlighted ID if not coming from notification
      setHighlightedAnnouncementId(null);
    }

    // Clear location state after processing (to prevent re-triggering on re-renders)
    if (location.state?.activeTab || location.state?.announcementId) {
      window.history.replaceState({}, document.title);
    }

    // Update refs for next render
    previousPathnameRef.current = currentPathname;
    isInitialMountRef.current = false;
  }, [location.pathname, location.state, hasViewPermission, permissionLoading]);

  const loadAnnouncements = async (forceRefresh = false) => {
    if (!hasViewPermission || permissionLoading) {
      return;
    }
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
      if (searchTerm) params.search = searchTerm;

      const result = await loadAnnouncementsRedux(params);

      // Update last fetch time on successful load
      if (!result.error) {
        setLastFetchTime(Date.now());
      }

      if (result.error) {
        console.error("Error loading announcements:", result.error);
      }
    } catch (error) {
      console.error("Error loading announcements:", error);
      if (
        error.message?.includes("401") ||
        error.message?.includes("unauthorized")
      ) {
        localStorage.removeItem("access_token");
        localStorage.removeItem("refresh_token");
      }
    }
  };

  const updateAnnouncementStatuses = async () => {
    try {
      await updateAllStatusesRedux();
      // Only reload if status update was successful and user is still on the page
      if (!document.hidden) {
        loadAnnouncements();
      }
    } catch (error) {
      console.error("Error updating announcement statuses:", error);
    }
  };

  const getFilteredAnnouncements = () => {
    let filtered = announcements;

    if (activeTab === 1) {
      filtered = filtered.filter((ann) => ann.status === "ongoing");
    } else if (activeTab === 2) {
      filtered = filtered.filter((ann) => ann.status === "upcoming");
    } else if (activeTab === 3) {
      // For expired tab: Show ALL expired announcements regardless of pin status
      // This includes both naturally expired and manually expired announcements
      filtered = filtered.filter((ann) => ann.status === "expired");
    }

    if (searchTerm) {
      filtered = filtered.filter(
        (ann) =>
          ann.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
          ann.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
          ann.author.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    if (selectedDate) {
      filtered = filtered.filter((ann) => {
        if (!ann.startDate || !ann.endDate) return false;
        const selectedDateObj = new Date(selectedDate);
        selectedDateObj.setHours(0, 0, 0, 0);
        const announcementStartDate = new Date(ann.startDate);
        announcementStartDate.setHours(0, 0, 0, 0);
        const announcementEndDate = new Date(ann.endDate);
        announcementEndDate.setHours(0, 0, 0, 0);
        return (
          selectedDateObj >= announcementStartDate &&
          selectedDateObj <= announcementEndDate
        );
      });
    }

    if (selectedPriority.length > 0) {
      filtered = filtered.filter(
        (ann) =>
          ann.priority &&
          selectedPriority.some(
            (priority) => ann.priority.toLowerCase() === priority.toLowerCase()
          )
      );
    }

    if (selectedLabel.length > 0) {
      filtered = filtered.filter((ann) => {
        if (!ann.label) return false;
        // Split the announcement's label by comma and check if any matches selected labels
        const announcementLabels = ann.label
          .split(",")
          .map((l) => l.trim().toLowerCase());
        return selectedLabel.some((selectedLbl) =>
          announcementLabels.includes(selectedLbl.toLowerCase())
        );
      });
    }

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
        filtered = filtered.filter(
          (ann) =>
            ann.creatorName &&
            ann.creatorName.toLowerCase() === currentUserName.toLowerCase()
        );
      } else {
        filtered = [];
      }
    }

    return pinPost.sortAnnouncementsWithPinned(filtered);
  };

  const handleCreateAnnouncement = () => {
    if (!canCreate) {
      setPermissionError("You are not authorized to create announcements.");
      return;
    }
    navigate("/create-announcement", {
      state: { sourceTab: activeTab }
    });
  };

  const handleMoveToExpired = (announcementId) => {
    if (!canExpire) {
      setPermissionError("You are not authorized to expire announcements.");
      return;
    }
    // Close detail modal if open
    if (showDetailModal) {
      setShowDetailModal(false);
      setSelectedAnnouncementForDetail(null);
    }
    setAnnouncementToMoveToExpired(announcementId);
    setShowMoveToExpiredConfirmation(true);
  };

  const confirmMoveToExpired = async () => {
    if (!canExpire) {
      setPermissionError("You are not authorized to expire announcements.");
      setShowMoveToExpiredConfirmation(false);
      return;
    }
    try {
      await moveAnnouncementToExpiredRedux(announcementToMoveToExpired);
      // Force refresh to get updated status from backend
      await loadAnnouncements(true);
      setShowMoveToExpiredConfirmation(false);
      setAnnouncementToMoveToExpired(null);
      setMoveToExpiredSuccessMessage(
        "Announcement has been successfully moved to expired!"
      );
      setShowMoveToExpiredSuccess(true);
    } catch (error) {
      console.error("Error moving announcement to expired:", error);
      setShowMoveToExpiredConfirmation(false);
      setAnnouncementToMoveToExpired(null);
    }
  };

  const cancelMoveToExpired = () => {
    setShowMoveToExpiredConfirmation(false);
    setAnnouncementToMoveToExpired(null);
  };

  const handleEditAnnouncement = (announcementId) => {
    if (!canEdit) {
      setPermissionError("You are not authorized to edit announcements.");
      return;
    }
    navigate(`/edit-announcement/${announcementId}`, {
      state: {
        sourceTab: activeTab,
        announcementId: announcementId
      }
    });
  };

  const handleAnnouncementHistory = async (announcementId) => {
    try {
      const result = await loadAnnouncementRedux(announcementId);

      // If the thunk was successful, the payload contains the full announcement data
      if (result && !result.error) {
        setSelectedAnnouncementForHistory(result.payload);
        setShowHistoryModal(true);
      } else {
        // Fallback to local data if fetch fails
        const announcement = announcements.find((ann) => ann.id === announcementId);
        if (announcement) {
          setSelectedAnnouncementForHistory(announcement);
          setShowHistoryModal(true);
        }
      }
    } catch (error) {
      console.error("Error fetching announcement for history:", error);
      // Fallback to local data if fetch fails
      const announcement = announcements.find((ann) => ann.id === announcementId);
      if (announcement) {
        setSelectedAnnouncementForHistory(announcement);
        setShowHistoryModal(true);
      }
    }
  };

  const handleReminder = (announcementId) => {
    console.log("Set reminder for announcement:", announcementId);
  };

  const handlePinPost = async (announcementId) => {
    if (!canPin) {
      setPermissionError("You are not authorized to pin announcements.");
      return;
    }
    await pinPost.handlePinPost(announcementId);
  };

  const handlePinIconClick = (announcementId, event) => {
    if (!canPin) {
      setPermissionError("You are not authorized to pin announcements.");
      return;
    }
    pinPost.handlePinIconClick(announcementId, event);
  };

  const handleDirectCommunication = (announcementId) => {
    console.log("Start direct communication for announcement:", announcementId);
  };

  const handleDeleteAnnouncement = (announcementId) => {
    if (!canEdit) {
      setPermissionError("You are not authorized to delete announcements.");
      return;
    }
    // Close detail modal if open
    if (showDetailModal) {
      setShowDetailModal(false);
      setSelectedAnnouncementForDetail(null);
    }
    setAnnouncementToDelete(announcementId);
    setShowDeleteConfirmation(true);
  };

  const handleConfirmDelete = async () => {
    if (!canEdit) {
      setPermissionError("You are not authorized to delete announcements.");
      setShowDeleteConfirmation(false);
      setAnnouncementToDelete(null);
      return;
    }
    if (announcementToDelete) {
      try {
        await removeAnnouncementRedux(announcementToDelete);
        // Reload announcements after successful delete
        await loadAnnouncements(true);
      } catch (error) {
        console.error("Error deleting announcement:", error);
      }
    }
    setShowDeleteConfirmation(false);
    setAnnouncementToDelete(null);
  };

  const handleCancelDelete = () => {
    setShowDeleteConfirmation(false);
    setAnnouncementToDelete(null);
  };

  const handleRestoreAnnouncement = (announcementId) => {
    if (!canEdit) {
      setPermissionError("You are not authorized to restore announcements.");
      return;
    }
    setAnnouncementToRestore(announcementId);
    setShowRestoreConfirmation(true);
  };

  const confirmRestoreAnnouncement = async () => {
    if (!canEdit) {
      setPermissionError("You are not authorized to restore announcements.");
      setShowRestoreConfirmation(false);
      setAnnouncementToRestore(null);
      return;
    }
    try {
      // Close detail modal if open
      if (showDetailModal) {
        setShowDetailModal(false);
        setSelectedAnnouncementForDetail(null);
      }

      const result = await restoreExpiredAnnouncementRedux(announcementToRestore);

      // Check if restore was successful
      if (!restoreAnnouncement.fulfilled.match(result)) {
        throw new Error(result.payload || 'Failed to restore announcement');
      }

      const newStatus = result.payload?.status;

      // Force refresh to get updated status from backend
      await loadAnnouncements(true);

      // Switch to the appropriate tab based on the new status from the restore response
      // The loadAnnouncements will update the list, and the tab switch will show the restored announcement
      if (newStatus === 'ongoing') {
        setActiveTab(1); // Switch to Ongoing tab
        localStorage.setItem("announcementActiveTab", "1");
      } else if (newStatus === 'upcoming') {
        setActiveTab(2); // Switch to Upcoming tab
        localStorage.setItem("announcementActiveTab", "2");
      }
      // If still expired (naturally expired), stay on expired tab

      setShowRestoreConfirmation(false);
      setAnnouncementToRestore(null);
      setRestoreSuccessMessage("Announcement has been successfully restored!");
      setShowRestoreSuccess(true);
    } catch (error) {
      console.error("Error restoring announcement:", error);
      setShowRestoreConfirmation(false);
      setAnnouncementToRestore(null);
      // Show error message to user
      setPermissionError(error.message || "Failed to restore announcement. Please try again.");
    }
  };

  const cancelRestoreAnnouncement = () => {
    setShowRestoreConfirmation(false);
    setAnnouncementToRestore(null);
  };

  const handleClearSuccessMessage = () => {
    clearAllSuccessRedux();
  };

  if (permissionLoading) {
    return null;
  }

  if (!hasViewPermission) {
    return null;
  }

  const isImage = (fileName) => {
    const extension = fileName?.split(".").pop()?.toLowerCase();
    return ["jpg", "jpeg", "png", "gif", "bmp", "webp"].includes(extension);
  };

  const handleImageClick = async (attachment, announcement) => {
    // Increment views when user views announcement (clicks on image)
    if (announcement?.id) {
      try {
        await incrementAnnouncementViews(announcement.id);
        // Refresh notification count and list after viewing announcement
        // The backend will automatically mark notifications as read
        dispatch(fetchUnreadCount());
        // Refresh notifications list to remove the read one
        dispatch(fetchNotifications({ page_size: 100 }));
      } catch (error) {
        console.error("Error incrementing views:", error);
      }
    }

    const allAttachments = announcement.attachments || [];
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

  const handleImageSliderClose = () => {
    setIsImageSliderOpen(false);
    setSelectedImages([]);
    setSelectedImageIndex(0);
  };

  const handleDocumentClick = async (attachment, announcement) => {
    // Increment views when user views announcement (clicks on document)
    if (announcement?.id) {
      try {
        await incrementAnnouncementViews(announcement.id);
        // Refresh notification count and list after viewing announcement
        // The backend will automatically mark notifications as read
        dispatch(fetchUnreadCount());
        // Refresh notifications list to remove the read one
        dispatch(fetchNotifications({ page_size: 100 }));
      } catch (error) {
        console.error("Error incrementing views:", error);
      }
    }

    setSelectedDocument(attachment);
    setIsDocumentViewerOpen(true);
  };

  const handleDocumentClose = () => {
    setIsDocumentViewerOpen(false);
    setSelectedDocument(null);
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

  const isDocument = (fileName) => {
    const extension = fileName?.split(".").pop()?.toLowerCase();
    return ["pdf", "doc", "docx"].includes(extension);
  };

  const handleHistoryModalClose = () => {
    setShowHistoryModal(false);
    setSelectedAnnouncementForHistory(null);
  };

  const handleAnnouncementCardClick = (announcementId) => {
    const announcement = announcements.find((ann) => ann.id === announcementId);
    if (announcement) {
      setSelectedAnnouncementForDetail(announcement);
      setShowDetailModal(true);
      setHighlightedAnnouncementId(null);
    }
  };

  const handleDetailModalClose = () => {
    setShowDetailModal(false);
    setSelectedAnnouncementForDetail(null);
  };

  const handleDropdownToggle = (announcementId) => {
    setOpenDropdownId(
      openDropdownId === announcementId ? null : announcementId
    );
  };

  const handleFilterToggle = () => {
    setIsFilterExpanded(!isFilterExpanded);
  };

  const handleTabChange = (tabNumber) => {
    setActiveTab(tabNumber);
    localStorage.setItem("announcementActiveTab", tabNumber.toString());
  };

  return (
    <div>
      <PageContainer>
        <ContentBox>
          {/* Header Section */}
          <Div className="sticky md:top-0 z-30 bg-white pb-3 sm:pb-4 backdrop-blur -mx-4 sm:-mx-6 lg:-mx-[13px] px-4 sm:px-6 lg:px-[13px]">
            {/* Header */}
            <Div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 sm:gap-0 py-2 sm:py-4 mb-3 sm:mb-4">
              <Heading title="Announcements List" size="xl" color="text-black" />
              <Div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 sm:gap-3 md:gap-4 w-full sm:w-auto">
                <label className="flex items-center">
                  <input
                    type="checkbox"
                    checked={myPostChecked}
                    onChange={(e) => setMyPostChecked(e.target.checked)}
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

                {canCreate && (
                  <Button
                    icon={FaPlus}
                    onClick={handleCreateAnnouncement}
                    className="bg-primary hover:bg-primary-dark text-white w-full sm:w-auto flex items-center justify-center"
                  >
                    <span className="hidden sm:inline">Create Announcement</span>
                    <span className="sm:hidden">Create</span>
                  </Button>
                )}
              </Div>
            </Div>

            {isFilterExpanded && (
              <Div className="flex flex-col md:flex-row md:justify-end items-stretch md:items-center gap-3 md:gap-4 pb-3 sm:pb-4 pt-2">
                <div className="w-full md:min-w-[160px] md:w-auto">
                  <ModernDatePicker
                    label=""
                    value={selectedDate || ""}
                    onChange={setSelectedDate}
                    placeholder="Select Date"
                    name="announcementFilterDate"
                    showIcon={false}
                    inputClassName="h-[42px] px-3 border border-primary rounded-lg focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent bg-white text-primary text-sm pl-3 placeholder:text-primary placeholder:text-sm w-full"
                    maxYearOffset={10}
                  />
                </div>

                <div className="w-full md:min-w-[160px] md:w-auto">
                  <FilterSelectModal
                    placeholder="Select Priority"
                    options={[
                      { value: "Urgent", label: "Urgent" },
                      { value: "High", label: "High" },
                      { value: "Normal", label: "Normal" },
                      { value: "Low", label: "Low" }
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
            <div className="pt-2 sm:pt-4 -mx-4 sm:-mx-6 lg:-mx-[13px] px-4 sm:px-6 lg:px-[13px]">
              <AnimatedTabs
                tabs={[
                  { id: 1, label: "Ongoing" },
                  { id: 2, label: "Upcoming" },
                  { id: 3, label: "Expired" }
                ]}
                activeTab={activeTab}
                onTabChange={handleTabChange}
                sticky={false}
                className="mb-2 sm:mb-4"
              />
            </div>
          </Div>

          {/* Main Content */}
          <div className="flex-shrink-0 pt-4">
            {showSkeleton ? (
              <TableSkeleton />
            ) : getFilteredAnnouncements().length === 0 ? (
              <EmptyState
                icon={HiMegaphone}
                title="No Announcements Found"
              />
            ) : (
              <AnnouncementListPreview
                announcements={getFilteredAnnouncements()}
                loading={loading}
                openDropdownId={openDropdownId}
                dropdownRef={dropdownRef}
                currentTab={activeTab}
                handleDropdownToggle={handleDropdownToggle}
                handleEditAnnouncement={handleEditAnnouncement}
                handleAnnouncementHistory={handleAnnouncementHistory}
                handleMoveToExpired={handleMoveToExpired}
                handleReminder={handleReminder}
                handlePinPost={handlePinPost}
                handlePinIconClick={handlePinIconClick}
                handleDirectCommunication={handleDirectCommunication}
                handleDeleteAnnouncement={handleDeleteAnnouncement}
                handleRestoreAnnouncement={handleRestoreAnnouncement}
                handleImageClick={handleImageClick}
                handleDocumentClick={handleDocumentClick}
                isDocument={isDocument}
                getFileIcon={getFileIcon}
                canEdit={canEdit}
                canExpire={canExpire}
                canPin={canPin}
                highlightedAnnouncementId={highlightedAnnouncementId}
                onAnnouncementCardClick={handleAnnouncementCardClick}
                isFiltered={
                  !!searchTerm ||
                  !!selectedDate ||
                  selectedPriority.length > 0 ||
                  selectedLabel.length > 0 ||
                  myPostChecked
                }
              />
            )}
          </div>

          {showDeleteConfirmation && (
            <ConfirmationMessageBox
              message="Are you sure you want to delete this announcement? This action cannot be undone."
              onConfirm={handleConfirmDelete}
              onCancel={handleCancelDelete}
            />
          )}

          {showRestoreConfirmation && (
            <ConfirmationMessageBox
              message="Are you sure you want to restore this announcement?"
              onConfirm={confirmRestoreAnnouncement}
              onCancel={cancelRestoreAnnouncement}
            />
          )}

          {showMoveToExpiredConfirmation && (
            <ConfirmationMessageBox
              message="Are you sure you want to move this announcement to expired?"
              onConfirm={confirmMoveToExpired}
              onCancel={cancelMoveToExpired}
            />
          )}

          {showMoveToExpiredSuccess && (
            <MessageBox
              message={moveToExpiredSuccessMessage}
              clearMessage={() => setShowMoveToExpiredSuccess(false)}
            />
          )}

          {showRestoreSuccess && (
            <MessageBox
              message={restoreSuccessMessage}
              clearMessage={() => setShowRestoreSuccess(false)}
            />
          )}

          {deleteSuccess && message && (
            <MessageBox
              message={message}
              clearMessage={handleClearSuccessMessage}
            />
          )}

          {permissionError && (
            <MessageBox
              type="error"
              error
              message={permissionError}
              onOk={() => setPermissionError(null)}
              clearMessage={() => setPermissionError(null)}
            />
          )}

          <AnnouncementHistoryModal
            isOpen={showHistoryModal}
            onClose={handleHistoryModalClose}
            announcement={selectedAnnouncementForHistory}
            currentUser={localStorage.getItem("currentUser") || "Current User"}
          />

          <AnnouncementDetailModal
            isOpen={showDetailModal}
            onClose={handleDetailModalClose}
            announcement={selectedAnnouncementForDetail}
            onImageClick={handleImageClick}
            onDocumentClick={handleDocumentClick}
            currentUser={(() => {
              try {
                const user = localStorage.getItem("currentUser");
                return user ? JSON.parse(user) : null;
              } catch {
                return null;
              }
            })()}
            onEdit={handleEditAnnouncement}
            onHistory={handleAnnouncementHistory}
            onMoveToExpired={handleMoveToExpired}
            onReminder={handleReminder}
            onPinPost={handlePinPost}
            onDirectCommunication={handleDirectCommunication}
            onDelete={handleDeleteAnnouncement}
            onRestore={handleRestoreAnnouncement}
            canEdit={canEdit}
            canExpire={canExpire}
            canPin={canPin}
          />

          <ImageSlider
            isOpen={isImageSliderOpen}
            onClose={handleImageSliderClose}
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
              onClose={handleDocumentClose}
            />
          )}
        </ContentBox>
      </PageContainer>
    </div>
  );
};

export default AnnouncementList;
