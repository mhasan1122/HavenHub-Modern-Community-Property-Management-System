import { useEffect, useMemo, useState } from "react";
import PropTypes from "prop-types";
import { useNavigate } from "react-router-dom";
import { FaTrash } from "react-icons/fa";
import { MdPermContactCalendar } from "react-icons/md";

import NoData from "../../../Components/Table/NoData";
import TableSkeleton from "../../../Components/Loaders/TableSkeleton";
import SingleImageUpload from "../../../utils/SingleImageUpload";
import userPlaceholder from "../../../assets/user/user.png";

import { formatContactDate } from "../utils/contactHelpers";
import EmptyState from "../../../Components/Ui/EmptyState";

const DEFAULT_PAGE_SIZE = 10;

const ContactTable = ({
  contacts = [],
  isLoading = false,
  onDelete,
  pendingDeleteId,
  emptyStateMessage = "No contacts yet. Add your first important contact.",
}) => {
  const navigate = useNavigate();
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = DEFAULT_PAGE_SIZE;

  const totalContacts = Array.isArray(contacts) ? contacts.length : 0;
  const totalPages = Math.max(1, Math.ceil(totalContacts / pageSize));
  const hasContacts = totalContacts > 0;

  useEffect(() => {
    if (currentPage > totalPages) {
      setCurrentPage(totalPages);
    }
  }, [currentPage, totalPages]);

  const paginatedContacts = useMemo(() => {
    if (!hasContacts) {
      return [];
    }

    const startIndex = (currentPage - 1) * pageSize;
    return contacts.slice(startIndex, startIndex + pageSize);
  }, [contacts, currentPage, hasContacts, pageSize]);

  const startIndex = (currentPage - 1) * pageSize;
  const showingStart = hasContacts ? startIndex + 1 : 0;
  const showingEnd = hasContacts
    ? Math.min(totalContacts, startIndex + pageSize)
    : 0;

  const handlePreviousPage = () => {
    setCurrentPage((prev) => Math.max(1, prev - 1));
  };

  const handleNextPage = () => {
    setCurrentPage((prev) => Math.min(totalPages, prev + 1));
  };

  return (
    <div className="w-full">
      {/* Desktop Table View */}
      <div className="hidden lg:block relative overflow-x-auto max-h-[70vh] overflow-y-auto custom-scrollbar bg-white">
        <table className="w-full text-base text-left rtl:text-right">
          <thead className="bg-subprimary border-b border-subprimary sticky top-0 z-10">
            <tr className="h-11">
              <th className="px-2 py-2 text-base font-bold text-left">Photo</th>
              <th className="px-2 py-2 text-base font-bold text-left">Name</th>
              <th className="px-2 py-2 text-base font-bold text-left">Designation</th>
              <th className="px-2 py-2 text-base font-bold text-left">Phone</th>
              <th className="px-2 py-2 text-base font-bold text-left">Email</th>
              <th className="px-2 py-2 text-base font-bold text-left">Added On</th>
              <th className="px-2 py-2 text-base font-bold text-center">
                Actions
              </th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr>
                <td colSpan={7} className="px-2 py-2">
                  <div className="flex justify-center items-center py-8">
                    <TableSkeleton rows={5} columns={7} />
                  </div>
                </td>
              </tr>
            ) : !hasContacts ? (
              <tr>
                <td colSpan={7} className="text-center py-12">
                  <EmptyState
                    icon={MdPermContactCalendar}
                    title="No Contacts Found"
                    align="top"
                  />
                </td>
              </tr>
            ) : (
              paginatedContacts.map((contact) => {
                const isDeleting = pendingDeleteId === contact.id;
                const memberId = contact.org_member || contact.member;

                const handleRowClick = () => {
                  if (memberId) {
                    navigate(`/member-profile/${memberId}`);
                  }
                };

                const handleDeleteClick = (e) => {
                  e.stopPropagation();
                  onDelete?.(contact);
                };

                const handleEmailClick = (e) => {
                  e.stopPropagation();
                };

                return (
                  <tr
                    key={contact.id}
                    onClick={handleRowClick}
                    className={`bg-white border-b hover:bg-gray-50 transition-colors duration-150 h-11 ${memberId ? "cursor-pointer" : ""
                      }`}
                  >
                    <td className="px-2 py-2 text-sm whitespace-nowrap">
                      <div className="w-10 h-10 flex items-center justify-center overflow-hidden rounded-full">
                        <SingleImageUpload
                          file={contact.photo_url || contact.photo}
                          altImg={userPlaceholder}
                          customClass="w-full h-full object-cover rounded-full"
                        />
                      </div>
                    </td>
                    <td className="px-2 py-2 text-sm whitespace-nowrap">
                      {contact.name}
                    </td>
                    <td className="px-2 py-2 text-sm whitespace-nowrap">
                      {contact.designation}
                    </td>
                    <td className="px-2 py-2 text-sm whitespace-nowrap">
                      {contact.phone_number || contact.phoneNumber}
                    </td>
                    <td className="px-2 py-2 text-sm whitespace-nowrap">
                      <a
                        href={`mailto:${contact.email}`}
                        onClick={handleEmailClick}
                        className="text-primary hover:underline"
                      >
                        {contact.email}
                      </a>
                    </td>
                    <td className="px-2 py-2 text-sm whitespace-nowrap">
                      {formatContactDate(contact.created_at)}
                    </td>
                    <td className="px-2 py-2 text-center whitespace-nowrap">
                      <div className="flex items-center justify-center gap-2">
                        <button
                          onClick={handleDeleteClick}
                          disabled={isDeleting}
                          className="p-2 hover:bg-gray-100 rounded transition-colors"
                          title="Delete Contact"
                        >
                          <FaTrash className="w-5 h-5 text-error" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Mobile Card View */}
      <div className="lg:hidden space-y-4">
        {isLoading ? (
          <div className="flex justify-center items-center py-8">
            <TableSkeleton rows={3} columns={1} />
          </div>
        ) : !hasContacts ? (
          <div className="bg-white rounded-lg p-6 border border-gray-100">
            <EmptyState icon={MdPermContactCalendar} title="No Contacts Found" align="top" />
          </div>
        ) : (
          paginatedContacts.map((contact) => {
            const isDeleting = pendingDeleteId === contact.id;
            const memberId = contact.org_member || contact.member;

            const handleCardClick = () => {
              if (memberId) {
                navigate(`/member-profile/${memberId}`);
              }
            };

            const handleDeleteClick = (e) => {
              e.stopPropagation();
              onDelete?.(contact);
            };

            const handleEmailClick = (e) => {
              e.stopPropagation();
            };

            return (
              <div
                key={contact.id}
                onClick={handleCardClick}
                className={`bg-white rounded-lg border border-gray-200 p-4 relative shadow-sm hover:shadow-md transition-shadow ${memberId ? "cursor-pointer" : ""
                  }`}
              >
                <div className="flex items-start gap-3">
                  <div className="w-12 h-12 flex-shrink-0 flex items-center justify-center overflow-hidden rounded-full border border-gray-100">
                    <SingleImageUpload
                      file={contact.photo_url || contact.photo}
                      altImg={userPlaceholder}
                      customClass="w-full h-full object-cover"
                    />
                  </div>
                  <div className="flex-1 min-w-0 pr-8">
                    <div className="flex justify-between items-start">
                      <div>
                        <h3 className="font-semibold text-gray-900 truncate pr-2">{contact.name}</h3>
                        <p className="text-sm text-gray-500 truncate">{contact.designation}</p>
                      </div>
                    </div>

                    <div className="mt-3 space-y-1.5 text-sm text-gray-600">
                      {(contact.phone_number || contact.phoneNumber) && (
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-xs text-gray-400 w-12 uppercase">Phone</span>
                          <span className="truncate">{contact.phone_number || contact.phoneNumber}</span>
                        </div>
                      )}
                      {contact.email && (
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-xs text-gray-400 w-12 uppercase">Email</span>
                          <a
                            href={`mailto:${contact.email}`}
                            onClick={handleEmailClick}
                            className="text-primary truncate"
                          >
                            {contact.email}
                          </a>
                        </div>
                      )}
                      {contact.created_at && (
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-xs text-gray-400 w-12 uppercase">Added</span>
                          <span>{formatContactDate(contact.created_at)}</span>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Absolute positioned delete button for easier access */}
                  <div className="absolute top-4 right-4">
                    <button
                      onClick={handleDeleteClick}
                      disabled={isDeleting}
                      className="p-2 text-gray-400 hover:text-error hover:bg-error/10 rounded-full transition-colors"
                      title="Delete Contact"
                    >
                      <FaTrash className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      {hasContacts && totalPages > 1 && (
        <div className="flex items-center justify-between mt-4 pt-4 border-t border-gray-200">
          <div className="text-sm text-gray-600">
            Showing {showingStart} to {showingEnd} of {totalContacts} contacts
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                handlePreviousPage();
              }}
              disabled={currentPage === 1}
              className={`px-3 py-1 rounded border ${currentPage === 1
                  ? "bg-gray-100 text-gray-400 cursor-not-allowed"
                  : "bg-white text-gray-700 hover:bg-gray-50"
                }`}
            >
              Previous
            </button>
            <div className="flex items-center gap-1">
              {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => {
                if (
                  page === 1 ||
                  page === totalPages ||
                  (page >= currentPage - 1 && page <= currentPage + 1)
                ) {
                  return (
                    <button
                      key={page}
                      type="button"
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        setCurrentPage(page);
                      }}
                      className={`px-3 py-1 rounded border ${currentPage === page
                          ? "bg-primary text-white border-primary"
                          : "bg-white text-gray-700 hover:bg-gray-50"
                        }`}
                    >
                      {page}
                    </button>
                  );
                } else if (
                  page === currentPage - 2 ||
                  page === currentPage + 2
                ) {
                  return <span key={page} className="px-2">...</span>;
                }
                return null;
              })}
            </div>
            <button
              type="button"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                handleNextPage();
              }}
              disabled={currentPage === totalPages}
              className={`px-3 py-1 rounded border ${currentPage === totalPages
                  ? "bg-gray-100 text-gray-400 cursor-not-allowed"
                  : "bg-white text-gray-700 hover:bg-gray-50"
                }`}
            >
              Next
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

ContactTable.propTypes = {
  contacts: PropTypes.arrayOf(
    PropTypes.shape({
      id: PropTypes.oneOfType([PropTypes.number, PropTypes.string]).isRequired,
      org_member: PropTypes.oneOfType([PropTypes.number, PropTypes.string]),
      member: PropTypes.oneOfType([PropTypes.number, PropTypes.string]),
      name: PropTypes.string,
      designation: PropTypes.string,
      phone_number: PropTypes.string,
      phoneNumber: PropTypes.string,
      email: PropTypes.string,
      photo: PropTypes.oneOfType([PropTypes.string, PropTypes.oneOf([null])]),
      photo_url: PropTypes.oneOfType([PropTypes.string, PropTypes.oneOf([null])]),
      created_at: PropTypes.string,
    })
  ),
  isLoading: PropTypes.bool,
  onDelete: PropTypes.func,
  pendingDeleteId: PropTypes.oneOfType([PropTypes.number, PropTypes.string]),
  emptyStateMessage: PropTypes.string,
};

export default ContactTable;
