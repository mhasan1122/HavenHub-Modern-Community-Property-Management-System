import { useEffect, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { useDispatch, useSelector } from "react-redux";
import { FaPlus } from "react-icons/fa6";
import { BsBuildings } from "react-icons/bs";

import {
  fetchTowers,
  deleteTower,
  clearMessages
} from "../../../../redux/slices/towers/towerSlice";

import { checkPermission } from "../../../../utils/permissionUtils";
import Button from "../../../../Components/FormComponent/ButtonComponent/Button";
import MessageBox from "../../../../Components/MessageBox/MessageBox";
import ConfirmationMessageBox from "../../../../Components/MessageBox/ConfirmationMessageBox";
import TableSkeleton from "../../../../Components/Loaders/TableSkeleton";
import useSkeletonLoading from "../../../../hooks/useSkeletonLoading";
import { SKELETON_MIN_DISPLAY_TIME } from "../../../../config/skeletonLoadingConfig";
import TowerCard from "../components/TowerCard";
import TowerDashboardModal from "../components/TowerDashboardModal";
import Heading from "../../../../Components/HeadingComponent/Heading";
import PageContainer from "../../../../Components/Ui/PageContainer";
import EmptyState from "../../../../Components/Ui/EmptyState";

const ViewTowers = () => {
  const navigate = useNavigate();
  const dispatch = useDispatch();
  const { towers, loading, error, successMessage } = useSelector(
    (state) => state.tower
  );
  const [hasPermission, setHasPermission] = useState(false);
  const [loadingPermission, setLoadingPermission] = useState(true);
  const [showConfirmation, setShowConfirmation] = useState(false);
  const [towerIdToDelete, setTowerIdToDelete] = useState(null);
  const [showDashboardModal, setShowDashboardModal] = useState(false);
  const [selectedTowerId, setSelectedTowerId] = useState(null);

  // Fetch towers and check permission in parallel for faster loading
  useEffect(() => {
    const loadData = async () => {
      // Run permission check and data fetch in parallel
      try {
        const [permissionGranted] = await Promise.all([
          checkPermission("org", 12),
          dispatch(fetchTowers())
            .unwrap()
            .catch(() => { }) // Handle errors silently
        ]);

        setHasPermission(permissionGranted);
      } catch (error) {
        // Handle any errors
        console.error("Error loading data:", error);
      } finally {
        setLoadingPermission(false);
      }
    };

    loadData();
  }, [dispatch]);

  // Memoized handlers
  const handleDeleteClick = useCallback((towerId) => {
    setTowerIdToDelete(towerId);
    setShowConfirmation(true);
  }, []);

  const handleConfirmDelete = useCallback(() => {
    if (!towerIdToDelete) return;
    dispatch(deleteTower(towerIdToDelete)).then(() => {
      setShowConfirmation(false);
      setTowerIdToDelete(null);
    });
  }, [dispatch, towerIdToDelete]);

  const handleCancelDelete = useCallback(() => {
    setShowConfirmation(false);
    setTowerIdToDelete(null);
  }, []);

  const handleMessageBoxOk = useCallback(() => {
    dispatch(clearMessages());
    dispatch(fetchTowers());
  }, [dispatch]);

  const handleTowerNameClick = useCallback((towerId) => {
    setSelectedTowerId(towerId);
    setShowDashboardModal(true);
  }, []);

  const handleCloseDashboardModal = useCallback(() => {
    setShowDashboardModal(false);
    setSelectedTowerId(null);
  }, []);

  // Use skeleton loading hook to ensure minimum display time and data validation
  const showSkeleton = useSkeletonLoading(
    loading,
    towers,
    SKELETON_MIN_DISPLAY_TIME
  );

  // Redirect if no permission (after permission check is done)
  if (!loadingPermission && !hasPermission) {
    navigate("/not-authorized");
    return null;
  }

  // Show skeleton in content area if permission is loading OR data is loading
  const showContentSkeleton = loadingPermission || showSkeleton;

  return (
    <PageContainer className="min-h-screen bg-surfaceMuted">
      {showConfirmation && (
        <ConfirmationMessageBox
          message="Are you sure you want to delete this tower? This action cannot be undone."
          onConfirm={handleConfirmDelete}
          onCancel={handleCancelDelete}
        />
      )}

      {(error || successMessage) && (
        <MessageBox
          message={successMessage}
          error={error}
          onOk={handleMessageBoxOk}
        />
      )}

      <TowerDashboardModal
        isOpen={showDashboardModal}
        onClose={handleCloseDashboardModal}
        towerId={selectedTowerId}
      />

      <div className="relative w-full h-[calc(100vh-120px)] bg-white rounded-[16px] md:rounded-[27px] py-4 px-4 md:py-6 md:px-6 mx-auto flex flex-col overflow-hidden">
        <div className="pb-2 md:pb-4 bg-white mb-4 md:mb-6 shrink-0">
          <div className="flex flex-col md:flex-row md:justify-between md:items-center py-2 gap-3 md:gap-0">
            <div>
              <Heading title="Tower List" size="xl" color="text-black" />
            </div>
            <div className="flex items-center gap-2">
              <Button onClick={() => navigate("/addTower")}>
                <FaPlus className="mr-2" />
                Add Tower
              </Button>
            </div>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto overflow-x-hidden pb-6">
          {showContentSkeleton ? (
            <div className="flex items-center justify-center my-12">
              <TableSkeleton />
            </div>
          ) : towers.length === 0 ? (
            <EmptyState
              icon={BsBuildings}
              title="No Towers Found"
            />
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 md:gap-6">
              {towers.map((tower) => (
                <TowerCard
                  key={tower.id}
                  tower={tower}
                  onDeleteClick={handleDeleteClick}
                  onTowerNameClick={handleTowerNameClick}
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </PageContainer>
  );
};

export default ViewTowers;
