import PropTypes from 'prop-types';
import { Link } from 'react-router-dom';
import editIcon from "../../../assets/edit-02.png";
import { useEffect } from 'react';
import { MdEdit } from "react-icons/md";
// import editIcon from "../../../assets/edit/edit-02.png";


const DynamicLinkEditButton = ({
  basePath,
  resourceId,
  params = {},
  label = "Edit",
  icon = editIcon,
  onClick,
  className = "",
  ariaLabel = "Edit button"
}) => {
  const generateUrl = () => {
    if (Object.keys(params).length > 0) {
      let generatedPath = basePath;
      Object.entries(params).forEach(([key, value]) => {
        generatedPath = generatedPath.replace(`:${key}`, value);
      });
      return generatedPath;
    }

    return `/${basePath}/${resourceId}`.replace(/\/+/g, '/');
  };

  useEffect(() => {
    if (!resourceId && Object.keys(params).length === 0) {
      console.error("Error: Either resourceId or params must be provided");
    }
  }, [resourceId, params]);

  return (
    <Link
      to={generateUrl()}
      className={`inline-block ${className}`}
      aria-label={ariaLabel}
      style={{ cursor: "pointer" }}
    >
      <button
        onClick={onClick}
        className="flex items-center bg-white text-grey100 rounded-md border border-grey100 py-1 px-3 text-sm cursor-pointer"
        type="button"
      >
        <span className="text-[19px] px-1 ">
          <img src={editIcon} alt="Edit" />
        </span>
        <span className="text-grey100  text-base px-1">
          {label}
        </span>
      </button>
    </Link>
  );
};

DynamicLinkEditButton.propTypes = {
  basePath: PropTypes.string.isRequired,
  resourceId: PropTypes.oneOfType([
    PropTypes.string,
    PropTypes.number
  ]),
  params: PropTypes.object,
  label: PropTypes.string,
  icon: PropTypes.string,
  onClick: PropTypes.func,
  className: PropTypes.string,
  ariaLabel: PropTypes.string
};

export default DynamicLinkEditButton;




// <button
//                 className="flex items-center bg-primary  rounded-md py-2 px-5 text-sm cursor-pointer"
//               >
// <span className="text-[19px] px-1 ">
//   <img src={editIcon} alt="Edit" />
// </span>
//                 <span className="px-1 text-base text-white">Edit</span>
//               </button>