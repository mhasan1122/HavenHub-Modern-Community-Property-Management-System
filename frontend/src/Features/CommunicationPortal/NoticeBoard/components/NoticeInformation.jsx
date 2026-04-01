import { FaEye, FaUsers, FaImage } from "react-icons/fa";

const NoticeInformation = ({ notice, userCount }) => {
  const formatCount = (count) => {
    if (count >= 1000) {
      return `${(count / 1000).toFixed(1)}k`;
    }
    return count.toString();
  };

  return (
    <div className="flex items-center justify-between text-xs text-gray-500">
      <div className="flex items-center gap-4">
        {/* Views */}
        <div className="flex items-center gap-1">
          <FaEye className="w-3 h-3" />
          <span>{formatCount(notice.views || 0)}</span>
        </div>

        {/* User Count */}
        {userCount > 0 && (
          <div className="flex items-center gap-1">
            <FaUsers className="w-3 h-3" />
            <span>{formatCount(userCount)}</span>
          </div>
        )}

        {/* Attachment Count */}
        {notice.attachments && notice.attachments.length > 0 && (
          <div className="flex items-center gap-1">
            <FaImage className="w-3 h-3" />
            <span>{notice.attachments.length}</span>
          </div>
        )}
      </div>

      {/* Created Date */}
      <div className="text-gray-400">
        {new Date(notice.createdAt || notice.created_at).toLocaleDateString('en-GB', {
          day: '2-digit',
          month: '2-digit',
          year: 'numeric'
        })}
      </div>
    </div>
  );
};

export default NoticeInformation;
