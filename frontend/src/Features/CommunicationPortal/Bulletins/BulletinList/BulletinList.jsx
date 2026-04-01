import { useState, useEffect, useRef } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { HiDocumentText } from "react-icons/hi2";
import EmptyState from "../../../../Components/Ui/EmptyState.jsx";
import { FaPlus, FaFilePdf, FaFileWord, FaImage } from "react-icons/fa";
import { BiSearch } from "react-icons/bi";
import BulletinHistoryModal from "../components/BulletinHistoryModal";
import usePinPost from "../components/PinPost";
import Calendar from "../../Announcements/components/Calendar";
import ModernDatePicker from "../../../../Components/FormComponent/ModernDatePicker";
import ConfirmationMessageBox from "../../../../Components/MessageBox/ConfirmationMessageBox";
import MessageBox from "../../../../Components/MessageBox/MessageBox";
import ImageSlider from "../../../../Components/Modal/ImageSlider";
import DocumentViewer from "../../../../Components/FileViewer/DocumentViewer";
import useBulletins from "../../../../hooks/useBulletins";
import BulletinListPreview from "./BulletinListPreview";
import BulletinDetailModal from "../components/BulletinDetailModal";
import BulletinTableView from "./BulletinTableView";
import FilterSelectModal from "../../../../Components/FilterSelect/FilterSelectModal";
import TableSkeleton from "../../../../Components/Loaders/TableSkeleton";
import useSkeletonLoading from "../../../../hooks/useSkeletonLoading";
import { SKELETON_MIN_DISPLAY_TIME } from "../../../../config/skeletonLoadingConfig";
import { fetchBulletinLabels } from "../../../../redux/slices/api/bulletinApi";
import { useDispatch } from "react-redux";
import { checkPermission } from "../../../../utils/permissionUtils";
import { PERMISSIONS } from "../../../../constants/permissions";
import AnimatedTabs from "../../../../Components/Tabs/AnimatedTabs";
import PageContainer from "../../../../Components/Ui/PageContainer";
import ContentBox from "../../../../Components/Ui/ContentBox";
import Button from "../../../../Components/FormComponent/ButtonComponent/Button";
import FilterButton from "../../../../Components/FormComponent/ButtonComponent/FilterButton";
import Heading from "../../../../Components/HeadingComponent/Heading";
import { Div } from "../../../../Components/Ui/Div";

const BulletinList = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const dispatch = useDispatch();

  // Redux hooks for bulletins
  const {
    bulletins: reduxBulletins,
    loading: reduxLoading,
    deleteSuccess,
    message,
    loadBulletins: loadBulletinsRedux,
    removeBulletin: removeBulletinRedux,
    moveBulletinToArchive: moveBulletinToArchiveRedux,
    restoreArchivedBulletin: restoreArchivedBulletinRedux,
    loadBulletin: loadBulletinRedux,
    clearAllSuccess: clearAllSuccessRedux
  } = useBulletins();

  const bulletins = reduxBulletins;
  const loading = reduxLoading;

  // Use skeleton loading hook to ensure minimum display time and data validation
  const showSkeleton = useSkeletonLoading(
    loading,
    reduxBulletins,
    SKELETON_MIN_DISPLAY_TIME
  );

  const [activeTab, setActiveTab] = useState(() => {
    // Check if we're coming from a notification with a specific tab
    const initialTab = location.state?.activeTab || 1;
    console.log('[BulletinList] Initializing activeTab to:', initialTab, 'from location.state:', location.state);
    // Clear any existing localStorage entry to ensure fresh start
    localStorage.removeItem("bulletinActiveTab");
    return initialTab;
  });
  const [myPostChecked, setMyPostChecked] = useState(false);
  const [selectedLabel, setSelectedLabel] = useState([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [availableLabels, setAvailableLabels] = useState([]);
  const [selectedImages, setSelectedImages] = useState([]);
  const [selectedImageIndex, setSelectedImageIndex] = useState(0);
  const [isImageSliderOpen, setIsImageSliderOpen] = useState(false);
  const [selectedDocument, setSelectedDocument] = useState(null);
  const [isDocumentViewerOpen, setIsDocumentViewerOpen] = useState(false);
  const [showDeleteConfirmation, setShowDeleteConfirmation] = useState(false);
  const [bulletinToDelete, setBulletinToDelete] = useState(null);
  const [showRestoreConfirmation, setShowRestoreConfirmation] = useState(false);
  const [bulletinToRestore, setBulletinToRestore] = useState(null);
  const [showRestoreSuccess, setShowRestoreSuccess] = useState(false);
  const [restoreSuccessMessage, setRestoreSuccessMessage] = useState("");
  const [showHistoryModal, setShowHistoryModal] = useState(false);
  const [selectedBulletinForHistory, setSelectedBulletinForHistory] = useState(null);
  const [isFilterExpanded, setIsFilterExpanded] = useState(true);
  const [selectedDate, setSelectedDate] = useState("");
  const [openDropdownId, setOpenDropdownId] = useState(null);
  // Detail Modal state
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [selectedBulletinForDetail, setSelectedBulletinForDetail] = useState(null);

  const [showMoveToArchiveConfirmation, setShowMoveToArchiveConfirmation] = useState(false);
  const [bulletinToMoveToArchive, setBulletinToMoveToArchive] = useState(null);
  const [showMoveToArchiveSuccess, setShowMoveToArchiveSuccess] = useState(false);
  const [moveToArchiveSuccessMessage, setMoveToArchiveSuccessMessage] = useState("");
  const dropdownRef = useRef(null);
  const [permissionLoading, setPermissionLoading] = useState(true);
  const [canArchive, setCanArchive] = useState(false);
  const [canApproveReject, setCanApproveReject] = useState(false);
  const [highlightedBulletinId, setHighlightedBulletinId] = useState(null);
  const [isInitialLoad, setIsInitialLoad] = useState(true);
  const highlightTimeoutRef = useRef(null);
  const processedLocationStateRef = useRef(null);

  // Auto-clear highlight after 5 seconds
  useEffect(() => {
    if (highlightedBulletinId) {
      // Clear any existing timeout
      if (highlightTimeoutRef.current) {
        clearTimeout(highlightTimeoutRef.current);
      }

      // Set new timeout to clear highlight after 5 seconds
      highlightTimeoutRef.current = setTimeout(() => {
        console.log('[BulletinList] Auto-clearing highlight after 5 seconds');
        setHighlightedBulletinId(null);
      }, 5000);
    }

    return () => {
      if (highlightTimeoutRef.current) {
        clearTimeout(highlightTimeoutRef.current);
      }
    };
  }, [highlightedBulletinId]);

  // Clear highlight when tab changes (but not on initial load from notification)
  useEffect(() => {
    if (!isInitialLoad) {
      setHighlightedBulletinId(null);
    }
  }, [activeTab, isInitialLoad]);

  // Load permissions on component mount
  useEffect(() => {
    let isMounted = true;

    const loadPermissions = async () => {
      try {
        const [archive, approveReject] = await Promise.all([
          checkPermission("org", PERMISSIONS.ARCHIVE_BULLETIN_BOARD),
          checkPermission("org", PERMISSIONS.APPROVE_REJECT_BULLETIN_BOARD)
        ]);

        if (!isMounted) return;

        setCanArchive(archive);
        setCanApproveReject(approveReject);
      } catch (error) {
        console.error("Error checking bulletin permissions:", error);
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

  // Load available labels from database
  useEffect(() => {
    const loadLabelsFromDatabase = async () => {
      try {
        const result = await dispatch(fetchBulletinLabels());
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

  const [pinErrorMessage, setPinErrorMessage] = useState("");
  const [showPinError, setShowPinError] = useState(false);

  const pinPost = usePinPost({
    bulletins: bulletins,
    setBulletins: () => {
      // No need to update local state - Redux handles this automatically
      // The togglePinBulletin action updates the Redux store directly
    },
    onPinSuccess: (message) => {
      console.log("Pin success:", message);
      // No need to reload - Redux state is updated automatically
    },
    onPinError: (message) => {
      setPinErrorMessage(message);
      setShowPinError(true);
      // Auto-hide error after 5 seconds
      setTimeout(() => {
        setShowPinError(false);
        setPinErrorMessage("");
      }, 5000);
    },
    currentTab: activeTab,
    onMoveToArchive: (bulletinId) => {
      console.log("Pin moved to archive:", bulletinId);
      // Redux state is already updated, no need to reload
      // Switch to archive tab to show the moved bulletin
      setActiveTab(3);
      // Removed localStorage storage to always default to Current tab on return
    }
  });

  // State to track if we're coming from edit
  const [isFromEdit, setIsFromEdit] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  // Load bulletins on component mount and when filters change
  useEffect(() => {
    // Prevent multiple simultaneous calls
    if (isLoading) return;

    const loadData = async () => {
      setIsLoading(true);
      try {
        await loadBulletins(isFromEdit); // Force refresh if coming from edit
      } finally {
        setIsLoading(false);
        if (isFromEdit) {
          setIsFromEdit(false); // Reset the flag after load starts
        }
      }
    };

    loadData();
  }, [myPostChecked, selectedLabel, searchTerm, selectedDate, isFromEdit]);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setOpenDropdownId(null);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Handle location state changes (navigation from edit or notification)
  useEffect(() => {
    // Check if we've already processed this exact location state
    const currentStateKey = location.state ?
      `${location.state.bulletinId}-${location.state.activeTab}-${location.state.timestamp || 'notification'}` :
      null;

    if (!location.state || processedLocationStateRef.current === currentStateKey) {
      // No location state or already processed - mark initial load as complete
      setIsInitialLoad(false);
      return;
    }

    console.log('[BulletinList] Location state changed:', location.state);
    console.log('[BulletinList] Current activeTab state:', activeTab);

    // Mark this state as processed immediately to prevent reprocessing
    processedLocationStateRef.current = currentStateKey;

    // Clear location state immediately to prevent infinite loops
    window.history.replaceState({}, document.title);

    if (location.state?.bulletinId) {
      if (location.state?.timestamp) {
        // Mark that we're coming from edit to trigger refresh
        console.log('[BulletinList] Coming from edit, triggering refresh');
        setIsFromEdit(true);
        setIsInitialLoad(false);
      } else {
        // Coming from notification - highlight the bulletin
        const bulletinIdToHighlight = location.state.bulletinId;
        const targetTab = location.state.activeTab;

        console.log('[BulletinList] Setting highlighted bulletin ID:', bulletinIdToHighlight);
        console.log('[BulletinList] Target tab from notification:', targetTab);

        // Update active tab if specified (from notification)
        if (targetTab !== undefined && targetTab !== activeTab) {
          console.log('[BulletinList] Switching to target tab:', targetTab);
          setActiveTab(targetTab);
        }

        // Mark that we've processed the initial load from notification
        setIsInitialLoad(false);

        // Set highlight with a small delay to ensure tab switch and data load complete
        setTimeout(() => {
          console.log('[BulletinList] Setting highlight after tab switch');
          setHighlightedBulletinId(bulletinIdToHighlight);

          // Scroll to the bulletin with retry logic
          const scrollToBulletin = (retries = 10) => {
            setTimeout(() => {
              const element = document.getElementById(`bulletin-${bulletinIdToHighlight}`);
              console.log('[BulletinList] Scrolling attempt - element:', element, 'retries left:', retries);
              if (element) {
                element.scrollIntoView({ behavior: 'smooth', block: 'center' });
                console.log('[BulletinList] Successfully scrolled to bulletin');
              } else if (retries > 0) {
                // Retry if element not found yet (still loading)
                scrollToBulletin(retries - 1);
              } else {
                console.log('[BulletinList] Failed to find bulletin element after all retries');
              }
            }, 300);
          };

          scrollToBulletin();
        }, 200);
      }
    } else {
      setIsInitialLoad(false);
    }
  }, [location.state, bulletins]);

  const loadBulletins = async (forceRefresh = false) => {
    try {
      const accessToken = localStorage.getItem("access_token");
      if (!accessToken) {
        console.error("No access token found. User needs to login.");
        return;
      }

      const params = {};
      if (forceRefresh) params._t = Date.now();
      if (selectedLabel.length > 0) params.labels = selectedLabel.join(",");
      if (searchTerm) params.search = searchTerm;

      // Add date filtering to backend request
      if (selectedDate) {
        params.date_from = selectedDate;
        params.date_to = selectedDate;
      }

      const result = await loadBulletinsRedux(params);
      if (result.error) {
        console.error("Error loading bulletins:", result.error);
      }
    } catch (error) {
      console.error("Error loading bulletins:", error);
      if (error.message?.includes("401") || error.message?.includes("unauthorized")) {
        localStorage.removeItem("access_token");
        localStorage.removeItem("refresh_token");
      }
    }
  };

  const getFilteredBulletins = () => {
    let filtered = bulletins;

    if (activeTab === 1) {
      filtered = filtered.filter((bulletin) => bulletin.status === "current");
    } else if (activeTab === 2) {
      filtered = filtered.filter((bulletin) => bulletin.status === "pending");
    } else if (activeTab === 3) {
      filtered = filtered.filter((bulletin) => bulletin.status === "archive");
    }

    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      filtered = filtered.filter(
        (bulletin) =>
          (bulletin.title ?? "").toLowerCase().includes(term) ||
          (bulletin.description ?? "").toLowerCase().includes(term) ||
          (bulletin.author ?? "").toLowerCase().includes(term)
      );
    }

    if (selectedDate) {
      filtered = filtered.filter((bulletin) => {
        if (!bulletin.created_at) return false;
        const selectedDateObj = new Date(selectedDate);
        selectedDateObj.setHours(0, 0, 0, 0);
        const bulletinDate = new Date(bulletin.created_at);
        bulletinDate.setHours(0, 0, 0, 0);
        return selectedDateObj.getTime() === bulletinDate.getTime();
      });
    }

    if (selectedLabel.length > 0) {
      filtered = filtered.filter(
        (bulletin) => {
          if (!bulletin.label) return false;
          // Split the bulletin's label by comma and check if any matches selected labels
          const bulletinLabels = bulletin.label.split(',').map(l => l.trim().toLowerCase());
          return selectedLabel.some(selectedLbl =>
            bulletinLabels.includes(selectedLbl.toLowerCase())
          );
        }
      );
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
          (bulletin) =>
            bulletin.creatorName &&
            bulletin.creatorName.toLowerCase() === currentUserName.toLowerCase()
        );
      } else {
        filtered = [];
      }
    }

    return pinPost.sortAnnouncementsWithPinned(filtered);
  };

  const handleCreateBulletin = () => {
    navigate("/create-bulletin", {
      state: { sourceTab: activeTab }
    });
  };

  const handleEditBulletin = (bulletinId) => {
    navigate(`/edit-bulletin/${bulletinId}`, {
      state: {
        sourceTab: activeTab,
        bulletinId: bulletinId
      }
    });
  };

  // Handle delete bulletin
  const handleDeleteBulletin = (bulletinId) => {
    setBulletinToDelete(bulletinId);
    setShowDeleteConfirmation(true);
  };

  const confirmDeleteBulletin = async () => {
    if (bulletinToDelete) {
      try {
        await removeBulletinRedux(bulletinToDelete);      // Redux state is already updated, bulletin removed from state
      } catch (error) {
        console.error('Error deleting bulletin:', error);
      }
    }
    setShowDeleteConfirmation(false);
    setBulletinToDelete(null);
  };

  const handleBulletinHistory = async (bulletinId) => {
    // Close detail modal first if it's open
    const isDetailModalOpen = showDetailModal;
    if (isDetailModalOpen) {
      setShowDetailModal(false);
      setSelectedBulletinForDetail(null);
    }

    // Function to open history modal after detail modal closes
    const openHistoryModal = (bulletinData) => {
      setSelectedBulletinForHistory(bulletinData);
      // Use setTimeout to ensure detail modal closes before opening history modal
      setTimeout(() => {
        setShowHistoryModal(true);
      }, isDetailModalOpen ? 200 : 0);
    };

    try {
      // Always fetch the latest bulletin data to ensure comments are up-to-date
      const result = await loadBulletinRedux(bulletinId);

      if (result && result.payload) {
        // Use the fresh data from the server
        console.log('[BulletinList] Selected bulletin for history (fresh data):', {
          id: result.payload.id,
          post_as: result.payload.post_as,
          stAs: result.payload.postAs,
          group_name: result.payload.group_name,
          mber_name: result.payload.member_name,
          creator_name: result.payload.creator_name,
          eatorName: result.payload.creatorName,
          athor: result.payload.author,
          storyCount: result.payload.history?.length || 0
        });
        openHistoryModal(result.payload);
      } else {
        // Fallback to cached data if server fetch fails
        const bulletin = bulletins.find(
          (bull) => bull.id === bulletinId
        );
        if (bulletin) {
          console.log('[BulletinList] Selected bulletin for history (fallback to cached):', {
            id: bulletin.id,
            post_as: bulletin.post_as,
            postAs: bulletin.postAs,
            group_name: bulletin.group_name,
            member_name: bulletin.member_name,
            creator_name: bulletin.creator_name,
            creatorName: bulletin.creatorName,
            author: bulletin.author
          });
          openHistoryModal(bulletin);
        }
      }
    } catch (error) {
      console.error('Error loading bulletin for history:', error);
      // Fallback to cached data if there's an error
      const bulletin = bulletins.find((bull) => bull.id === bulletinId);
      if (bulletin) {
        openHistoryModal(bulletin);
      }
    }
  };

  const handleReminder = (bulletinId) => {
    console.log("Set reminder for bulletin:", bulletinId);
  };

  const handlePinPost = pinPost.handlePinPost;

  const handleMoveToArchive = (bulletinId) => {
    if (!canArchive) {
      console.error("You are not authorized to archive bulletins.");
      return;
    }
    setBulletinToMoveToArchive(bulletinId);
    setShowMoveToArchiveConfirmation(true);
  };

  const confirmMoveToArchive = async () => {
    if (!canArchive) {
      console.error("You are not authorized to archive bulletins.");
      setShowMoveToArchiveConfirmation(false);
      setBulletinToMoveToArchive(null);
      return;
    }
    try {
      await moveBulletinToArchiveRedux(bulletinToMoveToArchive);
      // Redux state is already updated, no need to reload
      setShowMoveToArchiveConfirmation(false);
      setBulletinToMoveToArchive(null);
      setMoveToArchiveSuccessMessage("Bulletin has been successfully moved to archive!");
      setShowMoveToArchiveSuccess(true);
    } catch (error) {
      console.error("Error moving bulletin to archive:", error);
      setShowMoveToArchiveConfirmation(false);
      setBulletinToMoveToArchive(null);
    }
  };

  const cancelMoveToArchive = () => {
    setShowMoveToArchiveConfirmation(false);
    setBulletinToMoveToArchive(null);
  };

  const handleDirectCommunication = (bulletinId) => {
    console.log("Start direct communication for bulletin:", bulletinId);
  };

  const handleRestoreBulletin = (bulletinId) => {
    setBulletinToRestore(bulletinId);
    setShowRestoreConfirmation(true);
  };

  const confirmRestoreBulletin = async () => {
    try {
      await restoreArchivedBulletinRedux(bulletinToRestore);
      // Redux state is already updated, no need to reload
      setShowRestoreConfirmation(false);
      setBulletinToRestore(null);
      setRestoreSuccessMessage("Bulletin has been successfully restored!");
      setShowRestoreSuccess(true);
    } catch (error) {
      console.error("Error restoring bulletin:", error);
      setShowRestoreConfirmation(false);
      setBulletinToRestore(null);
    }
  };

  const cancelRestoreBulletin = () => {
    setShowRestoreConfirmation(false);
    setBulletinToRestore(null);
  };

  const handleClearSuccessMessage = () => {
    clearAllSuccessRedux();
  };

  const isImage = (fileName) => {
    const extension = fileName?.split(".").pop()?.toLowerCase();
    return ["jpg", "jpeg", "png", "gif", "bmp", "webp"].includes(extension);
  };

  const handleImageClick = (attachment, bulletin) => {
    const allAttachments = bulletin.attachments || [];
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

  const handleDocumentClick = (attachment) => {
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
    setSelectedBulletinForHistory(null);
  };

  const handleRefreshBulletin = async (bulletinId) => {
    try {
      // Reload the specific bulletin to get updated history
      const result = await loadBulletinRedux(bulletinId);

      // If the load was successful, update the selected bulletin
      if (result && result.payload) {
        setSelectedBulletinForHistory(result.payload);
      } else {
        // Fallback: refresh the bulletins list and find the updated bulletin
        await loadBulletinsRedux();
        const refreshedBulletin = bulletins.find(bull => bull.id === bulletinId);
        if (refreshedBulletin) {
          setSelectedBulletinForHistory(refreshedBulletin);
        }
      }
    } catch (error) {
      console.error("Error refreshing bulletin:", error);
    }
  };

  const handleBulletinCardClick = (bulletinId) => {
    const bulletin = bulletins.find((b) => b.id === bulletinId);
    if (bulletin) {
      setSelectedBulletinForDetail(bulletin);
      setShowDetailModal(true);
    }
  };

  const handleDetailModalClose = () => {
    setShowDetailModal(false);
    setSelectedBulletinForDetail(null);
  };

  const handleDropdownToggle = (bulletinId) => {
    setOpenDropdownId(
      openDropdownId === bulletinId ? null : bulletinId
    );
  };

  const handleFilterToggle = () => {
    setIsFilterExpanded(!isFilterExpanded);
  };

  const handleTabChange = (tabNumber) => {
    setActiveTab(tabNumber);
    // Removed localStorage storage to always default to Current tab on return
  };

  return (
    <div>
      <PageContainer className="min-h-screen bg-surfaceMuted px-4 sm:px-6 lg:px-[13px]">
        <ContentBox>
          {/* Sticky Header Section */}
          <Div className="sticky md:top-0 z-30 bg-white pb-3 sm:pb-4 backdrop-blur -mx-4 sm:-mx-6 lg:-mx-[13px] px-4 sm:px-6 lg:px-[13px]">
            {/* Header */}
            <Div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 sm:gap-0 py-2 sm:py-4 mb-3 sm:mb-4">
              <Heading title="Bulletins List" size="xl" color="text-black" />
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

                <Button
                  icon={FaPlus}
                  onClick={handleCreateBulletin}
                  className="bg-primary hover:bg-primary-dark text-white w-full sm:w-auto flex items-center justify-center"
                >
                  <span className="hidden sm:inline">Create Bulletin</span>
                  <span className="sm:hidden">Create</span>
                </Button>
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
                    name="bulletinFilterDate"
                    showIcon={false}
                    inputClassName="h-[42px] px-3 border border-primary rounded-lg focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent bg-white text-primary text-sm pl-3 placeholder:text-primary placeholder:text-sm w-full"
                    maxYearOffset={10}
                  />
                </div>

                <div className="w-full md:min-w-[160px] md:w-auto">
                  <FilterSelectModal
                    placeholder="Select Label"
                    options={availableLabels.map(label => ({ value: label, label: label }))}
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
            <div className="pt-4">
              <AnimatedTabs
                tabs={[
                  { id: 1, label: "Current Bulletin" },
                  { id: 2, label: "Pending Bulletin" },
                  { id: 3, label: "Archive" }
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
            {/* Bulletins List - Scrollable Content Area */}
            <div className="overflow-auto pt-4">
              {showSkeleton ? (
                <div className="flex justify-center items-center py-12">
                  <TableSkeleton rows={5} columns={4} />
                </div>
              ) : getFilteredBulletins().length === 0 ? (
                <EmptyState
                  icon={HiDocumentText}
                  title="No Bulletins Found"
                // message="There are currently no bulletins in this category."
                />
              ) : activeTab === 2 ? (
                // Table view for pending bulletins
                (() => {
                  const filteredBulletins = getFilteredBulletins();
                  console.log('[BulletinList] Filtered bulletins for table view:', filteredBulletins);
                  console.log('[BulletinList] First bulletin attachments:', filteredBulletins[0]?.attachments);
                  return (
                    <BulletinTableView
                      bulletins={filteredBulletins}
                      loading={loading}
                      handleBulletinHistory={handleBulletinHistory}
                      handleEditBulletin={handleEditBulletin}
                      highlightedBulletinId={highlightedBulletinId}
                    />
                  );
                })()
              ) : (
                // Card view for current and archive bulletins
                <BulletinListPreview
                  bulletins={getFilteredBulletins()}
                  loading={loading}
                  openDropdownId={openDropdownId}
                  dropdownRef={dropdownRef}
                  currentTab={activeTab}
                  highlightedBulletinId={highlightedBulletinId}
                  handleDropdownToggle={handleDropdownToggle}
                  handleEditBulletin={handleEditBulletin}
                  handleBulletinHistory={handleBulletinHistory}
                  handleMoveToArchive={handleMoveToArchive}
                  handleReminder={handleReminder}
                  handlePinPost={handlePinPost}
                  handleDirectCommunication={handleDirectCommunication}
                  handleDeleteBulletin={handleDeleteBulletin}
                  handleRestoreBulletin={handleRestoreBulletin}
                  canArchive={canArchive}
                  handleImageClick={handleImageClick}
                  handleDocumentClick={handleDocumentClick}
                  isDocument={isDocument}
                  getFileIcon={getFileIcon}
                  onBulletinCardClick={handleBulletinCardClick}
                />
              )}
            </div>
          </div>

          <ImageSlider
            isOpen={isImageSliderOpen}
            onClose={handleImageSliderClose}
            images={selectedImages}
            initialIndex={selectedImageIndex}
          />

          <BulletinDetailModal
            isOpen={showDetailModal}
            onClose={handleDetailModalClose}
            bulletin={selectedBulletinForDetail}
            currentUser={(() => {
              try {
                const user = localStorage.getItem("currentUser");
                return user ? JSON.parse(user) : null;
              } catch {
                return null;
              }
            })()}
            onImageClick={handleImageClick}
            onDocumentClick={handleDocumentClick}
            onEdit={handleEditBulletin}
            onHistory={handleBulletinHistory}
            onMoveToArchive={handleMoveToArchive}
            onReminder={handleReminder}
            onPinPost={handlePinPost}
            onDirectCommunication={handleDirectCommunication}
            onDelete={handleDeleteBulletin}
            onRestore={handleRestoreBulletin}
            canArchive={canArchive}
          />

          {showDeleteConfirmation && (
            <ConfirmationMessageBox
              message="Are you sure you want to delete this bulletin? This action cannot be undone."
              onConfirm={confirmDeleteBulletin}
              onCancel={() => setShowDeleteConfirmation(false)}
            />
          )}

          {showRestoreConfirmation && (
            <ConfirmationMessageBox
              message="Are you sure you want to restore this bulletin?"
              onConfirm={confirmRestoreBulletin}
              onCancel={cancelRestoreBulletin}
            />
          )}

          {showMoveToArchiveConfirmation && (
            <ConfirmationMessageBox
              message="Are you sure you want to move this bulletin to archive?"
              onConfirm={confirmMoveToArchive}
              onCancel={cancelMoveToArchive}
            />
          )}

          {showMoveToArchiveSuccess && (
            <MessageBox
              message={moveToArchiveSuccessMessage}
              clearMessage={() => setShowMoveToArchiveSuccess(false)}
            />
          )}

          {showRestoreSuccess && (
            <MessageBox
              message={restoreSuccessMessage}
              clearMessage={() => setShowRestoreSuccess(false)}
            />
          )}

          {showPinError && pinErrorMessage && (
            <MessageBox
              error={pinErrorMessage}
              clearMessage={() => {
                setShowPinError(false);
                setPinErrorMessage("");
              }}
            />
          )}

          {showHistoryModal && selectedBulletinForHistory && (
            <BulletinHistoryModal
              bulletin={selectedBulletinForHistory}
              onClose={handleHistoryModalClose}
              onRefresh={handleRefreshBulletin}
              canApproveReject={canApproveReject}
            />
          )}

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

export default BulletinList;