import React from "react";
import PropTypes from "prop-types";
import EmptyState from "../Ui/EmptyState";

/**
 * TabTable - A reusable component for tables within tabs
 * 
 * @param {string} title - Table title
 * @param {Array} columns - Array of column objects with { header, accessor, align }
 * @param {Array} data - Array of data objects to display
 * @param {Function} renderRow - Function to render each row (receives item, index)
 * @param {string} emptyMessage - Message to show when data is empty
 * @param {ReactNode} headerActions - Actions/buttons to display in the header
 * @param {number} maxHeight - Maximum height for the scrollable table (default: 400px)
 * @param {boolean} showHeaderCard - Whether to show the header card wrapper (default: true)
 * @param {string} className - Additional CSS classes
 */
const TabTable = ({
  title,
  columns,
  data,
  renderRow,
  emptyMessage = "No results found.",
  headerActions,
  maxHeight = 400,
  showHeaderCard = true,
  emptyStateIcon,
  className = ""
}) => {
  const hasData = data && data.length > 0;

  return (
    <div className={className}>
      {/* Header Section */}
      {showHeaderCard && (
        <div className="mb-4 sm:mb-6">
          <div className="bg-white shadow-sm rounded-lg py-4 sm:py-5 px-4">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 sm:gap-0">
              <h2 className="text-base sm:text-lg font-bold text-black">{title}</h2>
              {headerActions && (
                <div className="flex flex-wrap items-center gap-2 sm:gap-6 w-full sm:w-auto">{headerActions}</div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Table Section */}
      <div className={`overflow-y-auto hidden lg:block`} style={{ maxHeight: `${maxHeight}px` }}>
        <table className="w-full text-sm">
          <thead className="bg-[#3C9D9B1A]">
            <tr>
              {columns.map((column, index) => (
                <th
                  key={index}
                  className={`px-2 py-2 ${
                    column.align === "left"
                      ? "text-left"
                      : column.align === "right"
                      ? "text-right"
                      : "text-center"
                  }`}
                >
                  {column.header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {!hasData ? (
              <tr>
                <td colSpan={columns.length} className="text-center py-4">
                  <EmptyState 
                  icon={emptyStateIcon}
                  title={emptyMessage}
                  />
                </td>
              </tr>
            ) : (
              data.map((item, index) => renderRow(item, index))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

TabTable.propTypes = {
  title: PropTypes.string.isRequired,
  columns: PropTypes.arrayOf(
    PropTypes.shape({
      header: PropTypes.string.isRequired,
      accessor: PropTypes.string,
      align: PropTypes.oneOf(["left", "center", "right"])
    })
  ).isRequired,
  data: PropTypes.array.isRequired,
  renderRow: PropTypes.func.isRequired,
  emptyMessage: PropTypes.string,
  headerActions: PropTypes.node,
  maxHeight: PropTypes.number,
  showHeaderCard: PropTypes.bool,
  className: PropTypes.string
};

export default TabTable;

