import React from 'react';
import { FaEye, FaEdit } from 'react-icons/fa';
import { HiUserCircle } from "react-icons/hi";
import { FaUserGroup } from "react-icons/fa6";
import TableSkeleton from "../../../../Components/Loaders/TableSkeleton";
import EmptyState from "../../../../Components/Ui/EmptyState";
import { HiDocumentText } from "react-icons/hi";
import useCurrentUser from "../hooks/useCurrentUser";

/**
 * BulletinTableView Component
 * Table-style view for pending bulletins matching the design in the provided image
 */
const BulletinTableView = ({
  bulletins,
  loading,
  handleBulletinHistory,
  handleEditBulletin,
  highlightedBulletinId,
  isFiltered = false
}) => {
  // Get current user
  const { currentUser } = useCurrentUser();
  
  if (loading) {
    return (
      <div className="col-span-full flex justify-center items-center py-12">
        <TableSkeleton rows={5} columns={3} />
      </div>
    );
  }

  // Format date and time
  const formatDateTime = (dateString) => {
    if (!dateString) return "";
    const date = new Date(dateString);
    const day = date.getDate().toString().padStart(2, "0");
    const month = (date.getMonth() + 1).toString().padStart(2, "0");
    const year = date.getFullYear();
    const hours = date.getHours();
    const minutes = date.getMinutes().toString().padStart(2, "0");
    const hour12 = hours === 0 ? 12 : hours > 12 ? hours - 12 : hours;
    const period = hours >= 12 ? "pm" : "am";
    return `${day}-${month}-${year} at ${hour12}:${minutes}${period}`;
  };

  // Get tower and unit info
  const getTowerUnitInfo = (bulletin) => {
    if (bulletin.target_towers_data && bulletin.target_towers_data.length > 0) {
      // Show all towers if multiple, otherwise show the single tower
      const towerNames = bulletin.target_towers_data.map(
        (tower) => tower.tower_name || tower.name || `Tower ${tower.id}`
      );
      const towerDisplay = towerNames.length > 1
        ? `${towerNames.slice(0, 2).join(', ')}${towerNames.length > 2 ? ` +${towerNames.length - 2} more` : ''}`
          : towerNames[0];

      const unit = bulletin.target_units_data && bulletin.target_units_data.length > 0
          ? bulletin.target_units_data[0]
          : null;

      return {
        tower: towerDisplay,
        unit: unit ? unit.unit_name || unit.unit_number || unit.id : ""
      };
    }
    return { tower: "", unit: "" };
  };

  // Get display name and icon based on post_as field
  const getDisplayInfo = (bulletin) => {
    console.log("[BulletinTableView] Bulletin data for display:", {
      id: bulletin.id,
      post_as: bulletin.post_as,
      postAs: bulletin.postAs,
      group_name: bulletin.group_name,
      member_name: bulletin.member_name,
      creator_name: bulletin.creator_name,
      creatorName: bulletin.creatorName,
      author: bulletin.author
    });

    const postAsValue = bulletin.post_as || bulletin.postAs;

    switch (postAsValue) {
      case "group":
        return {
          name: bulletin.group_name || bulletin.author || "Unknown Group",
          icon: <FaUserGroup className="w-6 h-6 text-gray-500" />
        };
      case "member":
        return {
          name: bulletin.member_name || bulletin.author || "Unknown Member",
          icon: <FaUserGroup className="w-6 h-6 text-gray-500" />
        };
      default: // 'creator' or any other value
        return {
          name: bulletin.creator_name || bulletin.creatorName || bulletin.author || 'Unknown User',
          icon: <HiUserCircle className="w-6 h-6 text-gray-500" />
        };
    }
  };

  return (
    <div className="w-full bg-white rounded-lg shadow-sm border border-gray-200 max-h-[70vh] overflow-auto">
      {/* Table Header */}
      <div className="sticky top-0 z-10 grid grid-cols-4 gap-6 px-6 py-4 border-b border-gray-200 text-sm font-semibold text-gray-700 bg-primaryLight">
        <div className="flex items-center">Name</div>
        <div className="flex items-center">Bulletin Title</div>
        <div className="flex items-center">Date & Time</div>
        <div className="flex items-center justify-center">Actions</div>
      </div>

      {/* Table Body */}
      <div className="divide-y divide-gray-100">
        {bulletins.map((bulletin, index) => {
          const { name, icon } = getDisplayInfo(bulletin);
          
          // Check if current user is the creator of the bulletin
          const isCreator = currentUser && bulletin.creator && 
                           (currentUser.id.toString() === bulletin.creator.toString());

          return (
            <div
              id={`bulletin-${bulletin.id}`}
              key={bulletin.id}
              className={`grid grid-cols-4 gap-6 px-6 py-5 items-center transition-all duration-300 ${
                highlightedBulletinId === bulletin.id
                  ? 'bg-primaryLight border-l-4 border-primary shadow-lg ring-2 ring-primary ring-opacity-30'
                  : index % 2 === 0 ? 'bg-white hover:bg-gray-50' : 'bg-gray-50/30 hover:bg-gray-50'
              }`}
            >
              {/* Name - Shows based on post_as field */}
              <div 
                onClick={() => handleBulletinHistory(bulletin.id)}
                className="flex items-center space-x-3 min-w-0 cursor-pointer"
              >
                <div className="flex-shrink-0">
                  {icon}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-medium text-gray-900 truncate" title={name}>
                    {name}
                  </div>
                </div>
              </div>

              {/* Bulletin Title */}
              <div 
                onClick={() => handleBulletinHistory(bulletin.id)}
                className="min-w-0 cursor-pointer"
              >
                <div className="text-sm text-gray-900 line-clamp-2 leading-relaxed" title={bulletin.title}>
                  {bulletin.title}
                </div>
              </div>

              {/* Date & Time - Shows when bulletin was created */}
              <div 
                onClick={() => handleBulletinHistory(bulletin.id)}
                className="text-sm text-gray-600 font-medium cursor-pointer"
              >
                {formatDateTime(bulletin.created_at || bulletin.createdAt)}
              </div>

              {/* Actions - Edit Button (only show if current user is creator) */}
              <div className="flex items-center justify-center">
                {isCreator && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleEditBulletin(bulletin.id);
                    }}
                    className="flex items-center justify-center w-8 h-8 rounded-md bg-primary text-white hover:bg-primary-dark transition-colors"
                    title="Edit Bulletin"
                  >
                    <FaEdit className="w-4 h-4" />
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {bulletins.length === 0 && (
        <div className="py-12">
          <EmptyState
            icon={HiDocumentText}
            title={
              isFiltered ? "No results found" : "No pending bulletins found"
            }
            message={
              isFiltered
                ? "We couldn't find any pending bulletins matching your current filters. Try adjusting them."
                : "Pending bulletins will appear here when they are submitted for review."
            }
          />
        </div>
      )}
    </div>
  );
};

export default BulletinTableView;
