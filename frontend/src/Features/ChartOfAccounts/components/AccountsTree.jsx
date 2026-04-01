import { useState, useEffect, useMemo } from "react";
import { useDispatch, useSelector } from "react-redux";
import PropTypes from "prop-types";
import {
  FaPlus,
  FaEdit,
  FaTrash,
  FaChevronDown,
  FaChevronRight,
  FaFolderOpen,
  FaFolder,
  FaArrowUp
} from "react-icons/fa";
import ModernLoadingAnimation from "../../../Components/Loaders/ModernLoadingAnimation";
import MessageBox from "../../../Components/MessageBox/MessageBox";
import ConfirmationMessageBox from "../../../Components/MessageBox/ConfirmationMessageBox";
import Button from "../../../Components/FormComponent/ButtonComponent/Button";

import AccountsModal from "./AccountsModal";

import {
  fetchAccounts as fetchAccountsAction,
  deleteAccount,
  moveAccount,
  setShowAddModal,
  setShowEditModal,
  setSelectedAccount,
  setShowMoveModal,
  setAccountToMove,
  setSelectedNewParent,
  setShowMoveConfirmation,
  setShowDeleteConfirmation,
  setAccountToDelete,
  toggleNode as toggleNodeRedux,
  expandAll,
  collapseAll,
  setUserExpandedAll,
  setExpandedNodes,
  setSearchQuery,
  clearError,
  clearSuccessMessage
} from "../../../redux/slices/chartOfAccounts/chartOfAccountsSlice";

const AccountsTree = ({ fullPageLoading } = {}) => {
  const dispatch = useDispatch();

  // Get state from Redux store
  const {
    accounts,
    loading,
    error,
    successMessage,
    expandedNodes,
    userExpandedAll,
    selectedAccount,
    showAddModal,
    showEditModal,
    showMoveModal,
    accountToMove,
    showDeleteConfirmation,
    accountToDelete,
    selectedNewParent,
    showMoveConfirmation,
    operationLoading,
    searchQuery: reduxSearchQuery
  } = useSelector((state) => state.chartOfAccounts);

  const [parentAccountId, setParentAccountId] = useState(null);

  const [localSearchQuery, setLocalSearchQuery] = useState("");

  // Sync local state with Redux state
  useEffect(() => {
    setLocalSearchQuery(reduxSearchQuery || "");
  }, [reduxSearchQuery]);

  // Dispatch search query to Redux when local search changes
  useEffect(() => {
    const handler = setTimeout(() => {
      dispatch(setSearchQuery(localSearchQuery));
    }, 300); // Debounce search

    return () => {
      clearTimeout(handler);
    };
  }, [localSearchQuery, dispatch]);

  useEffect(() => {
    dispatch(fetchAccountsAction());
  }, [dispatch]);

  // Build tree structure from flat list
  const buildTree = (accountsList) => {
    const map = {};
    const tree = [];

    // Create map of accounts
    accountsList.forEach((account) => {
      map[account.id] = { ...account, children: [] };
    });

    // Build tree
    accountsList.forEach((account) => {
      if (account.parentAccount) {
        if (map[account.parentAccount]) {
          map[account.parentAccount].children.push(map[account.id]);
        }
      } else {
        tree.push(map[account.id]);
      }
    });

    return tree;
  };

  // Function to build filtered and searched tree
  const buildFilteredTree = (accountsList) => {
    if (!localSearchQuery.trim()) {
      return { tree: buildTree(accountsList), matchedNodes: new Set() };
    }

    const matchedNodes = new Set();

    // Find matching nodes
    const findMatchingNodes = (list) => {
      return list.filter(
        (account) =>
          account.accountName
            .toLowerCase()
            .includes(localSearchQuery.toLowerCase()) ||
          account.accountCode
            .toLowerCase()
            .includes(localSearchQuery.toLowerCase())
      );
    };

    const matchingAccounts = findMatchingNodes(accountsList);

    // Add matching accounts and their ancestors to matchedNodes
    const addAncestors = (account) => {
      matchedNodes.add(account.id);
      if (account.parentAccount) {
        const parent = accountsList.find(
          (acc) => acc.id === account.parentAccount
        );
        if (parent) {
          addAncestors(parent);
        }
      }
    };

    matchingAccounts.forEach(addAncestors);

    // Build a tree that includes only necessary nodes to show the hierarchy
    const allRelevantIds = new Set(matchedNodes);

    // Add children of matched nodes
    accountsList.forEach((account) => {
      if (account.parentAccount && matchedNodes.has(account.parentAccount)) {
        allRelevantIds.add(account.id);
      }
    });

    const relevantAccounts = accountsList.filter((acc) =>
      allRelevantIds.has(acc.id)
    );

    return { tree: buildTree(relevantAccounts), matchedNodes };
  };

  // Get filtered tree and matched nodes
  const { tree: displayTree, matchedNodes } = useMemo(
    () => buildFilteredTree(accounts),
    [accounts, localSearchQuery]
  );

  // Helper function to check if a node exists in a tree
  const findNodeInTree = (node, id) => {
    if (node.id === id) return true;
    if (node.children && node.children.length > 0) {
      return node.children.some((child) => findNodeInTree(child, id));
    }
    return false;
  };

  // Auto-expand nodes
  useEffect(() => {
    let newExpanded = new Set();

    // If user previously clicked expandAll, expand all nodes in the filtered tree
    if (userExpandedAll) {
      const allIds = new Set();
      const collectIdsFromTree = (nodes) => {
        nodes.forEach((node) => {
          allIds.add(node.id);
          if (node.children && node.children.length > 0) {
            collectIdsFromTree(node.children);
          }
        });
      };
      collectIdsFromTree(displayTree);
      newExpanded = allIds;

      // Add previously expanded nodes that are still in the filtered tree
      expandedNodes.forEach((id) => {
        if (displayTree.some((node) => findNodeInTree(node, id))) {
          newExpanded.add(id);
        }
      });
    }

    // Add previously expanded nodes that are still in the filtered tree
    expandedNodes.forEach((id) => {
      if (displayTree.some((node) => findNodeInTree(node, id))) {
        newExpanded.add(id);
      }
    });

    // Only update expandedNodes if there are changes
    if (
      newExpanded.size !== expandedNodes.size ||
      ![...newExpanded].every((id) => expandedNodes.has(id)) ||
      ![...expandedNodes].every((id) => newExpanded.has(id))
    ) {
      setExpandedNodes(newExpanded);
    }
  }, [displayTree, userExpandedAll, expandedNodes, findNodeInTree]);

  // Toggle expand/collapse
  const toggleNode = (id) => {
    dispatch(toggleNodeRedux(id));
    // If user manually collapses a node and userExpandedAll is true, reset the userExpandedAll flag
    if (userExpandedAll) {
      dispatch(setUserExpandedAll(false));
    }
  };

  // Handle delete account
  const handleDelete = (account) => {
    dispatch(setAccountToDelete(account));
    dispatch(setShowDeleteConfirmation(true));
  };

  // Confirm delete account
  const confirmDelete = async () => {
    if (!accountToDelete) return;

    dispatch(deleteAccount(accountToDelete.id));
  };

  // Cancel delete
  const cancelDelete = () => {
    dispatch(setShowDeleteConfirmation(false));
    dispatch(setAccountToDelete(null));
  };

  // Handle edit
  const handleEdit = (account) => {
    dispatch(setSelectedAccount(account));
    dispatch(setShowEditModal(true));
  };

  // Handle add new account
  const handleAdd = () => {
    dispatch(setSelectedAccount(null));
    setParentAccountId(null);
    dispatch(setShowAddModal(true));
  };

  // Handle add sub-account
  const handleAddSubAccount = (parentId) => {
    dispatch(setSelectedAccount(null));
    setParentAccountId(parentId);
    dispatch(setShowAddModal(true));
  };

  // Handle modal save - Update state directly for real-time updates
  const handleModalSave = () => {
    dispatch(setShowAddModal(false));
    dispatch(setShowEditModal(false));
    dispatch(setSelectedAccount(null));
    setParentAccountId(null);
  };

  // Handle success from modal
  const handleSuccess = () => {
    // Success messages are handled in the Redux store
  };

  // Handle error from modal
  const handleError = () => {
    // Error messages are handled in the Redux store
  };

  // Handle move account - open selection modal
  const handleMoveAccount = (account) => {
    dispatch(setAccountToMove(account));
    dispatch(setShowMoveModal(true));
  };

  // Move modal states are handled by Redux

  // Handle parent selection in move modal
  const handleSelectParent = (newParentId) => {
    // Check if trying to move to the same parent
    const currentParentId = accountToMove?.parentAccount || null;
    if (newParentId === currentParentId) {
      dispatch(clearError());
      setTimeout(() => dispatch(clearError()), 0); // Force update
      return;
    }
    dispatch(setSelectedNewParent(newParentId));
    dispatch(setShowMoveConfirmation(true));
  };

  // Handle confirm move to new parent
  const handleConfirmMove = async () => {
    if (!accountToMove) return;

    dispatch(
      moveAccount({ id: accountToMove.id, parentAccount: selectedNewParent })
    );
  };

  // Cancel move confirmation
  const handleCancelMoveConfirmation = () => {
    dispatch(setShowMoveConfirmation(false));
    dispatch(setSelectedNewParent(null));
  };

  // Check if targetId is a descendant of sourceId
  const isAccountDescendant = (sourceId, targetId) => {
    const source = accounts.find((acc) => acc.id === sourceId);
    if (!source) return false;

    const checkDescendants = (accountId) => {
      const acc = accounts.find((a) => a.id === accountId);
      if (!acc) return false;
      if (acc.id === targetId) return true;
      // Check all children recursively
      const children = accounts.filter((a) => a.parentAccount === acc.id);
      return children.some((child) => checkDescendants(child.id));
    };

    return checkDescendants(sourceId);
  };

  // Move Modal Component
  const MoveModal = ({ operationLoading }) => {
    MoveModal.propTypes = {
      operationLoading: PropTypes.bool
    };
    if (!showMoveModal || !accountToMove) return null;

    // Filter available parents: same account type, not self, not descendant
    const availableParents = accounts.filter(
      (acc) =>
        acc.id !== accountToMove.id &&
        acc.accountType === accountToMove.accountType &&
        !isAccountDescendant(accountToMove.id, acc.id)
    );

    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
        <div className="bg-white rounded-lg shadow-lg max-w-md w-full max-h-[90vh] flex flex-col">
          {/* Header */}
          <div className="p-4 sm:p-6 border-b border-gray-200">
            <h2 className="text-lg sm:text-xl font-bold text-gray-900">Move Account</h2>
            <div className="mt-2 p-2 sm:p-3 bg-blue-50 rounded-lg">
              <p className="text-xs sm:text-sm text-gray-700">
                <span className="font-medium">Account:</span>{" "}
                <strong className="text-gray-900">
                  {accountToMove.accountName}
                </strong>
              </p>
              <p className="text-xs sm:text-sm text-gray-600 mt-1">
                <span className="font-medium">Code:</span>{" "}
                {accountToMove.accountCode}
              </p>
              <p className="text-xs sm:text-sm text-gray-600">
                <span className="font-medium">Type:</span>{" "}
                {accountToMove.accountTypeDisplay}
              </p>
              {accountToMove.parentAccountName && (
                <p className="text-xs sm:text-sm text-gray-600">
                  <span className="font-medium">Current Parent:</span>{" "}
                  {accountToMove.parentAccountName}
                </p>
              )}
            </div>
            <p className="text-xs sm:text-sm text-gray-600 mt-3">
              Select a new parent account (must be same type:{" "}
              {accountToMove.accountTypeDisplay})
            </p>
          </div>

          {/* Body */}
          <div className="p-4 sm:p-6 max-h-96 overflow-y-auto flex-1">
            {/* Make it root account */}
            <button
              onClick={() => handleSelectParent(null)}
              disabled={!accountToMove.parentAccount || operationLoading}
              className={`w-full text-left px-4 py-3 mb-2 border rounded-lg transition-colors ${
                !accountToMove.parentAccount || operationLoading
                  ? "border-gray-200 bg-gray-50 cursor-not-allowed opacity-60"
                  : "border-gray-300 hover:bg-blue-50 hover:border-blue-300"
              }`}
            >
              <div className="font-medium text-gray-900">Make Root Account</div>
              <div className="text-xs text-gray-500">
                {!accountToMove.parentAccount
                  ? "Already at root level"
                  : "No parent account"}
              </div>
            </button>

            <div className="my-3 relative">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-gray-200"></div>
              </div>
              <div className="relative flex justify-center text-xs">
                <span className="px-2 bg-white text-gray-500">
                  Or select parent
                </span>
              </div>
            </div>

            {/* Parent accounts list */}
            <div className="space-y-2">
              {availableParents.length === 0 ? (
                <div className="text-center text-gray-500 text-sm py-4">
                  <p className="font-medium">
                    No compatible parent accounts available
                  </p>
                  <p className="text-xs mt-1">
                    Parent accounts must have the same account type (
                    {accountToMove.accountTypeDisplay})
                  </p>
                </div>
              ) : (
                availableParents.map((parent) => {
                  const isCurrentParent =
                    parent.id === accountToMove.parentAccount;
                  return (
                    <button
                      key={parent.id}
                      onClick={() => handleSelectParent(parent.id)}
                      disabled={isCurrentParent || operationLoading}
                      className={`w-full text-left px-4 py-3 border rounded-lg transition-colors ${
                        isCurrentParent || operationLoading
                          ? "border-blue-400 bg-blue-50 cursor-not-allowed"
                          : "border-gray-300 hover:bg-green-50 hover:border-green-300"
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <div className="font-medium text-gray-900">
                          {parent.accountName}
                        </div>
                        {isCurrentParent && (
                          <span className="text-xs bg-blue-100 text-blue-700 px-2 py-1 rounded">
                            Current Parent
                          </span>
                        )}
                      </div>
                      <div className="text-xs text-gray-500">
                        {parent.accountCode} • {parent.accountTypeDisplay} •
                        {formatCurrency(parent.currentBalance)}
                      </div>
                    </button>
                  );
                })
              )}
            </div>
          </div>

          {/* Footer */}
          <div className="p-4 sm:p-6 border-t border-gray-200 flex justify-end gap-2 sm:gap-3">
            <button
              onClick={() => {
                dispatch(setShowMoveModal(false));
                dispatch(setAccountToMove(null));
              }}
              disabled={operationLoading}
              className={`px-3 sm:px-4 py-1.5 sm:py-2 text-sm sm:text-base border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors ${
                operationLoading ? "opacity-50 cursor-not-allowed" : ""
              }`}
            >
              Cancel
            </button>
          </div>
        </div>
      </div>
    );
  };

  const formatCurrency = (amount) => {
    // Handle null, undefined, or non-numeric values
    const numericAmount = parseFloat(amount) || 0;
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "BDT",
      minimumFractionDigits: 2
    }).format(numericAmount);
  };

  // Tree node component - Enhanced with visual hierarchy and connection lines
  const TreeNode = ({
    node,
    level = 0,
    isLastChild = false,
    isMatch = false
  }) => {
    const isExpanded = expandedNodes.has(node.id);
    const hasChildren = node.children && node.children.length > 0;
    const canDelete =
      !node.isSystemAccount &&
      !hasChildren &&
      !node.hasVoucherEntries &&
      !node.isDefaultAccountHead;
    const canMove = !node.hasVoucherEntries && !node.isDefaultAccountHead;

    return (
      <div className="relative">
        {/* Vertical connection line for non-last children */}
        {level > 0 && !isLastChild && (
          <div
            className="absolute w-0.5 bg-gray-300"
            style={{
              left: `${level * 1.5 + 0.5}rem`,
              top: "2rem",
              bottom: "-1rem",
              pointerEvents: "none"
            }}
          />
        )}

        {/* Horizontal connection line to the node */}
        {level > 0 && (
          <div
            className="absolute h-0.5 bg-gray-300"
            style={{
              left: `${level * 1.5 + 0.5}rem`,
              top: "1.5rem",
              width: `0.5rem`,
              pointerEvents: "none"
            }}
          />
        )}

        <div
          className={`flex flex-col sm:flex-row items-start sm:items-center gap-2 sm:gap-2 px-2 sm:px-4 py-2 hover:bg-gray-100 transition-colors group relative ${
            isMatch ? "bg-yellow-100 border-l-4 border-yellow-500" : ""
          }`}
          style={{
            paddingLeft: `${level * 1.5 + 0.5}rem`,
            marginLeft: level > 0 ? "0rem" : "0"
          }}
        >
          <div className="flex items-center gap-2 flex-1 w-full sm:w-auto">
            {/* Expand/Collapse Button */}
            {hasChildren ? (
              <button
                onClick={() => toggleNode(node.id)}
                className="flex items-center justify-center min-w-5 sm:min-w-6 text-gray-600 hover:text-gray-900 transition-colors"
                title={isExpanded ? "Collapse" : "Expand"}
              >
                {isExpanded ? (
                  <FaChevronDown size={12} />
                ) : (
                  <FaChevronRight size={12} />
                )}
              </button>
            ) : (
              <div className="min-w-5 sm:min-w-6" />
            )}

            {/* Folder Icon for parent, no icon for leaf */}
            {hasChildren ? (
              <div className="text-gray-600">
                {isExpanded ? <FaFolderOpen size={12} className="sm:w-3.5 sm:h-3.5" /> : <FaFolder size={12} className="sm:w-3.5 sm:h-3.5" />}
              </div>
            ) : (
              <div className="w-3 sm:w-4" />
            )}

            {/* Account Name */}
            <div className="flex-1 flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-2 min-w-0">
              <div className="flex items-center gap-1 sm:gap-2 flex-wrap">
                <span className="text-xs text-gray-500 font-mono">
                  {node.accountCode}
                </span>
                <span className="text-xs sm:text-sm font-medium text-gray-900 break-words">
                  {node.accountName}
                </span>
              </div>
              {(node.openingDebit && parseFloat(node.openingDebit) > 0) && (
                <span className="text-xs text-gray-500 hidden sm:inline">
                  OD: {formatCurrency(node.openingDebit)}
                  {node.openingBalanceDate && ` as on ${node.openingBalanceDate}`}
                </span>
              )}
              {(node.openingCredit && parseFloat(node.openingCredit) > 0) && (
                <span className="text-xs text-gray-500 hidden sm:inline">
                  OC: {formatCurrency(node.openingCredit)}
                  {node.openingBalanceDate && ` as on ${node.openingBalanceDate}`}
                </span>
              )}
            </div>
          </div>

          {/* Action Buttons - Always visible */}
          <div className="flex items-center gap-1 ml-auto sm:ml-0">
            {/* Add Sub-Account */}
            <button
              onClick={() => handleAddSubAccount(node.id)}
              disabled={operationLoading}
              className={`p-1 sm:p-1.5 rounded transition-colors ${
                operationLoading
                  ? "text-gray-300 cursor-not-allowed"
                  : "text-green-600 hover:bg-green-50"
              }`}
              title={
                operationLoading ? "Operation in progress" : "Add sub-account"
              }
            >
              <FaPlus size={12} className="sm:w-3.5 sm:h-3.5" />
            </button>

            {/* Edit */}
            <button
              onClick={() => handleEdit(node)}
              disabled={operationLoading}
              className={`p-1 sm:p-1.5 rounded transition-colors ${
                operationLoading
                  ? "text-gray-300 cursor-not-allowed"
                  : "text-blue-600 hover:bg-blue-50"
              }`}
              title={
                operationLoading ? "Operation in progress" : "Edit account"
              }
            >
              <FaEdit size={12} className="sm:w-3.5 sm:h-3.5" />
            </button>

            {/* Move */}
            <button
              onClick={() => handleMoveAccount(node)}
              disabled={!canMove || operationLoading}
              className={`p-1 sm:p-1.5 rounded transition-colors ${
                canMove && !operationLoading
                  ? "text-purple-600 hover:bg-purple-50"
                  : "text-gray-300 cursor-not-allowed"
              }`}
              title={
                operationLoading
                  ? "Operation in progress"
                  : node.isDefaultAccountHead
                  ? "Cannot move account set as default account head"
                  : node.hasVoucherEntries
                  ? "Cannot move account with voucher entries"
                  : "Move account to different parent"
              }
            >
              <FaArrowUp size={12} className="sm:w-3.5 sm:h-3.5" />
            </button>

            {/* Delete */}
            {canDelete && (
              <button
                onClick={() => handleDelete(node)}
                disabled={operationLoading}
                className={`p-1 sm:p-1.5 rounded transition-colors ${
                  operationLoading
                    ? "text-gray-300 cursor-not-allowed"
                    : "text-red-600 hover:bg-red-50"
                }`}
                title={
                  operationLoading ? "Operation in progress" : "Delete account"
                }
              >
                <FaTrash size={12} className="sm:w-3.5 sm:h-3.5" />
              </button>
            )}
            {!canDelete && !node.isSystemAccount && (
              <button
                disabled
                className="p-1 sm:p-1.5 text-gray-300 cursor-not-allowed"
                title={
                  node.isDefaultAccountHead
                    ? "Cannot delete account set as default account head"
                    : hasChildren
                    ? "Cannot delete account with sub-accounts"
                    : node.hasVoucherEntries
                    ? "Cannot delete account with voucher entries"
                    : "Cannot delete account"
                }
              >
                <FaTrash size={12} className="sm:w-3.5 sm:h-3.5" />
              </button>
            )}
          </div>
        </div>

        {/* Child Nodes */}
        {hasChildren && isExpanded && (
          <div>
            {node.children.map((child, index) => (
              <TreeNode
                key={child.id}
                node={child}
                level={level + 1}
                isLastChild={index === node.children.length - 1}
                isMatch={matchedNodes.has(child.id)}
              />
            ))}
          </div>
        )}
      </div>
    );
  };

  // PropTypes for TreeNode
  TreeNode.propTypes = {
    node: PropTypes.shape({
      id: PropTypes.oneOfType([PropTypes.number, PropTypes.string]).isRequired,
      accountCode: PropTypes.string.isRequired,
      accountName: PropTypes.string.isRequired,
      currentBalance: PropTypes.oneOfType([PropTypes.number, PropTypes.string]),
      openingBalance: PropTypes.oneOfType([PropTypes.number, PropTypes.string]),
      openingBalanceDate: PropTypes.string,
      openingDebit: PropTypes.oneOfType([PropTypes.number, PropTypes.string]),
      openingCredit: PropTypes.oneOfType([PropTypes.number, PropTypes.string]),
      children: PropTypes.array,
      isSystemAccount: PropTypes.bool,
      hasVoucherEntries: PropTypes.bool,
      isDefaultAccountHead: PropTypes.bool
    }).isRequired,
    level: PropTypes.number,
    isLastChild: PropTypes.bool,
    isMatch: PropTypes.bool
  };

  AccountsTree.propTypes = {
    fullPageLoading: PropTypes.bool,
    setFullPageLoading: PropTypes.func
  };

  return (
    <div className="p-4 sm:p-6 bg-gray-50 min-h-screen">
      {/* Loading Overlay - Only show if parent is not handling it (fullPageLoading is undefined or true, not false) */}
      {fullPageLoading !== false && (loading || operationLoading || fullPageLoading) && (
        <div className="fixed inset-0 flex items-center justify-center bg-gray-900 bg-opacity-50 z-50">
          <ModernLoadingAnimation />
        </div>
      )}

      {/* Success/Error Messages */}
      {successMessage && (
        <MessageBox
          message={successMessage}
          clearMessage={() => dispatch(clearSuccessMessage())}
          onOk={() => dispatch(clearSuccessMessage())}
        />
      )}
      {error && (
        <MessageBox
          type="error"
          error
          message={error}
          clearMessage={() => dispatch(clearError())}
          onOk={() => dispatch(clearError())}
        />
      )}

      {/* Header */}
      <div className="mb-4 sm:mb-6">
        <h1 className="text-lg sm:text-2xl font-bold text-green-600">
          Chart of Account as on :{" "}
          <span className="block sm:inline">
            {new Date().toLocaleDateString("en-GB", {
              day: "2-digit",
              month: "short",
              year: "numeric"
            })}
          </span>
        </h1>
      </div>

      {/* Filters and Actions */}
      <div className="bg-white rounded-lg shadow-sm p-3 sm:p-4 mb-4 sm:mb-6">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3 sm:gap-4">
          <div className="relative flex-1 w-full lg:max-w-md">
            <input
              type="text"
              placeholder="Search accounts..."
              value={localSearchQuery}
              onChange={(e) => setLocalSearchQuery(e.target.value)}
              className="w-full pl-9 sm:pl-10 pr-3 sm:pr-4 py-2 text-sm sm:text-base border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
            <svg
              className="absolute left-2.5 sm:left-3 top-2.5 h-4 w-4 sm:h-5 sm:w-5 text-gray-400"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              xmlns="http://www.w3.org/2000/svg"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
              />
            </svg>
          </div>
          {/* Add Account Button - Visible on web, hidden on mobile (will use fixed button) */}
          <div className="hidden lg:block">
            <Button
              icon={FaPlus}
              onClick={handleAdd}
              className="whitespace-nowrap"
              disabled={operationLoading}
            >
              Add Account
            </Button>
          </div>
        </div>
      </div>

      {/* Tree View */}
      <div className="bg-white rounded-lg shadow-sm p-3 sm:p-6 overflow-x-auto">
        {/* Tree Nodes Container */}
        <div className="relative min-h-full">
          {accounts.length === 0 ? (
            <div className="px-3 sm:px-6 py-8 sm:py-12 text-center text-gray-500">
              <div className="flex flex-col items-center">
                <p className="text-base sm:text-lg font-medium mb-2">No accounts found</p>
                <p className="text-xs sm:text-sm">
                  Create your first account to get started
                </p>
              </div>
            </div>
          ) : (
            <>
              <div className="mb-3 sm:mb-4 flex flex-row items-center gap-2 sm:gap-3">
                <Button size="small" onClick={() => dispatch(expandAll())}>
                  Expand All
                </Button>
                <Button
                  size="small"
                  variant="transparent"
                  onClick={() => dispatch(collapseAll())}
                >
                  Collapse All
                </Button>
              </div>
              {displayTree.map((node, index) => (
                <TreeNode
                  key={node.id} // eslint-disable-line react/prop-types
                  node={node}
                  level={0}
                  isLastChild={index === displayTree.length - 1}
                  isMatch={matchedNodes.has(node.id)} // eslint-disable-line react/prop-types
                />
              ))}
            </>
          )}
        </div>
      </div>

      {/* Add Account Modal */}
      <AccountsModal
        isOpen={showAddModal}
        title={parentAccountId ? "Add Sub-Account" : "Add New Account"}
        account={null}
        parentAccountId={parentAccountId}
        parentAccountType={accounts.find(acc => acc.id === parentAccountId)?.accountType}
        onClose={() => {
          dispatch(setShowAddModal(false));
          setParentAccountId(null);
        }}
        onSave={handleModalSave}
        onSuccess={handleSuccess}
        onError={handleError}
        isEdit={false}
        operationLoading={operationLoading}
        setOperationLoading={() => {}} // Redux handles loading state
      />

      {/* Edit Account Modal */}
      <AccountsModal
        isOpen={showEditModal}
        title="Edit Account"
        account={selectedAccount}
        parentAccountId={null}
        onClose={() => {
          dispatch(setShowEditModal(false));
          dispatch(setSelectedAccount(null));
        }}
        onSave={handleModalSave}
        onSuccess={handleSuccess}
        onError={handleError}
        isEdit={true}
        operationLoading={operationLoading}
        setOperationLoading={() => {}} // Redux handles loading state
      />

      {/* Move Modal */}
      <MoveModal operationLoading={operationLoading} />

      {/* Move Confirmation Modal */}
      {showMoveConfirmation && accountToMove && (
        <ConfirmationMessageBox
          message={
            <p className="text-gray-600 text-sm">
              Are you sure you want to move this account to the new parent?
            </p>
          }
          onConfirm={handleConfirmMove}
          onCancel={handleCancelMoveConfirmation}
          confirmText="Move Account"
          cancelText="Cancel"
          isLoading={operationLoading}
        />
      )}

      {/* Delete Confirmation Modal */}
      {showDeleteConfirmation && (
        <ConfirmationMessageBox
          message={`Are you sure you want to delete the account "${accountToDelete?.accountName}"? This action cannot be undone.`}
          onConfirm={confirmDelete}
          onCancel={cancelDelete}
          confirmText="Delete"
          cancelText="Cancel"
          isLoading={operationLoading}
        />
      )}

      {/* Add Account Button - Fixed on mobile, hidden on web (shown in filters section) */}
      <div className="fixed bottom-4 right-4 sm:bottom-6 sm:right-6 lg:hidden z-10">
        <Button
          icon={FaPlus}
          onClick={handleAdd}
          className="shadow-lg hover:shadow-xl rounded-full text-sm sm:text-base"
          disabled={operationLoading}
        >
          <span className="hidden sm:inline">Add Account</span>
          <span className="sm:hidden">Add</span>
        </Button>
      </div>
    </div>
  );
};

export default AccountsTree;
