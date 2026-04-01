import UserThumbnail from "./UserThumbnail";

const UserThumbnailGroup = ({ userPhotos = [] }) => {
  const maxThumbnails = 5; // Maximum visible thumbnails
  const visibleThumbnails = userPhotos.slice(0, maxThumbnails); // Show only first 5
  const remainingCount = userPhotos.length - maxThumbnails; // Remaining users count

  return (
    <div className="flex items-center">
      {visibleThumbnails.map((photoUrl, index) => (
        <div
          key={index}
          className=" rounded-full border-2 mx-1  border-white bg-gray-200  first:ml-0"
          // style={{ zIndex: maxThumbnails - index }} // Ensures proper overlapping
        >
          <UserThumbnail photoUrl={photoUrl} />
        </div>
      ))}

      {remainingCount > 0 && (
        <div className="  flex items-center w-[25px] h-[25px] justify-center text-[10px] rounded-full border-2 border-white bg-gray-300 text-sm font-medium text-gray-800 ">
          +{remainingCount}
        </div>
      )}
    </div>
  );
};

export default UserThumbnailGroup;
