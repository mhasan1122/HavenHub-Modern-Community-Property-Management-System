import { FaUser, FaUsers, FaUserTie } from "react-icons/fa";

const NoticeAuthor = ({ notice }) => {
  const getAuthorIcon = () => {
    switch (notice.postAs) {
      case 'group':
        return <FaUsers className="w-3 h-3" />;
      case 'member':
        return <FaUserTie className="w-3 h-3" />;
      default:
        return <FaUser className="w-3 h-3" />;
    }
  };

  const getAuthorName = () => {
    switch (notice.postAs) {
      case 'group':
        return notice.postedGroupName || notice.group_name || "Unknown Group";
      case 'member':
        return notice.postedMemberName || notice.member_name || "Unknown Member";
      default:
        return notice.creatorName || notice.creator_name || "Unknown Author";
    }
  };

  const getAuthorType = () => {
    switch (notice.postAs) {
      case 'group':
        return "Group";
      case 'member':
        return "Member";
      default:
        return "Creator";
    }
  };

  return (
    <div className="flex items-center gap-2 text-xs text-gray-600">
      <div className="flex items-center gap-1">
        {getAuthorIcon()}
        <span className="font-medium">{getAuthorName()}</span>
      </div>
      <span className="text-gray-400">•</span>
      <span className="text-gray-500">{getAuthorType()}</span>
    </div>
  );
};

export default NoticeAuthor;
