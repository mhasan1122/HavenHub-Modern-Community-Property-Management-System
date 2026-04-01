import { useState, useEffect } from 'react';
import { fetchDatabaseTables, truncateDatabaseTables, exportDatabase, importDatabase } from '../api/databaseApi';
import ModernLoadingAnimation from '../Components/Loaders/ModernLoadingAnimation';
import MessageBox from '../Components/MessageBox/MessageBox';
import { AlertTriangle, Database, Trash2, Filter, SortAsc, ChevronDown, ChevronUp, Download, Upload } from 'lucide-react';

const DatabaseTruncatePage = () => {
  const [tables, setTables] = useState([]);
  const [selectedTables, setSelectedTables] = useState(new Set());
  const [loading, setLoading] = useState(true);
  const [truncating, setTruncating] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [importing, setImporting] = useState(false);
  const [importFile, setImportFile] = useState(null);
  const [showImportModal, setShowImportModal] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [rowCountFilter, setRowCountFilter] = useState('all'); // 'all', 'empty', 'has_data', 'small', 'medium', 'large'
  const [sortBy, setSortBy] = useState('name'); // 'name', 'name_desc', 'rows', 'rows_desc'
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [message, setMessage] = useState({ message: '', error: '' });
  const [databaseInfo, setDatabaseInfo] = useState(null);
  const [collapsedSections, setCollapsedSections] = useState(new Set());

  // Fetch tables on component mount
  useEffect(() => {
    loadTables();
  }, []);

  const loadTables = async () => {
    try {
      setLoading(true);
      // Clear any previous error messages when refreshing
      setMessage({ message: '', error: '' });
      const data = await fetchDatabaseTables();
      setTables(data.tables || []);
      setDatabaseInfo({
        name: data.database_name,
        engine: data.database_engine
      });
    } catch (error) {
      setMessage({
        message: '',
        error: typeof error === 'string' ? error : error?.error || 'Failed to load database tables'
      });
    } finally {
      setLoading(false);
    }
  };

  const handleExportDatabase = async () => {
    try {
      setExporting(true);
      setMessage({ message: '', error: '' });
      
      // Fetch the SQL dump as a blob with filename
      const { blob, filename: serverFilename } = await exportDatabase();
      
      // Use server-provided filename, or generate one with industry-standard format
      let filename = serverFilename;
      if (!filename) {
        // Generate filename: database_name_YYYY-MM-DD_HH-MM-SS.sql
        const now = new Date();
        const timestamp = now.toISOString().slice(0, 19).replace(/[:.]/g, '-').replace('T', '_');
        const safeDbName = databaseInfo?.name 
          ? databaseInfo.name.replace(/[^a-zA-Z0-9_-]/g, '_') 
          : 'database';
        filename = `${safeDbName}_${timestamp}.sql`;
      }
      
      // Create a download link and trigger download
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      
      // Clean up
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
      
      setMessage({
        message: `Database exported successfully as "${filename}"`,
        error: ''
      });
    } catch (error) {
      setMessage({
        message: '',
        error: typeof error === 'string' ? error : error?.error || 'Failed to export database'
      });
    } finally {
      setExporting(false);
    }
  };

  const handleImportFileChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      if (file.type === 'application/sql' || file.name.endsWith('.sql')) {
        setImportFile(file);
      } else {
        setMessage({
          message: '',
          error: 'Please select a valid SQL file (.sql)'
        });
      }
    }
  };

  const handleImportDatabase = async () => {
    if (!importFile) {
      setMessage({
        message: '',
        error: 'Please select a SQL file to import'
      });
      return;
    }

    try {
      setImporting(true);
      setMessage({ message: '', error: '' });
      
      const formData = new FormData();
      formData.append('file', importFile);
      
      const response = await importDatabase(formData);
      
      // Check if import was successful
      if (response.success) {
        const fileName = importFile.name;
        
        setMessage({
          message: `Database imported successfully from "${fileName}"`,
          error: ''
        });
        
        // Reset file input and close modal
        setImportFile(null);
        setShowImportModal(false);
        
        // Reload tables after import
        await loadTables();
      } else {
        // Handle case where response has error field or partial failure
        let errorMessage = response.error || 'Database import failed';
        
        // Add details if available
        if (response.errors && Array.isArray(response.errors) && response.errors.length > 0) {
          const errorDetails = response.errors.slice(0, 3).map(e => e.error || e).join('; ');
          errorMessage += ` Details: ${errorDetails}`;
          if (response.errors.length > 3) {
            errorMessage += ` ... and ${response.errors.length - 3} more error(s).`;
          }
        }
        
        setMessage({
          message: '',
          error: errorMessage
        });
      }
    } catch (error) {
      // Extract error message from various possible formats (similar to export)
      let errorMessage = 'Failed to import database';
      
      if (typeof error === 'string') {
        errorMessage = error;
      } else if (error?.response?.data) {
        const errorData = error.response.data;
        if (typeof errorData === 'string') {
          errorMessage = errorData;
        } else if (errorData.error) {
          errorMessage = errorData.error;
        } else if (errorData.message) {
          errorMessage = errorData.message;
        } else if (errorData.detail) {
          errorMessage = errorData.detail;
        }
      } else if (error?.error) {
        errorMessage = error.error;
      } else if (error?.message) {
        errorMessage = error.message;
      }
      
      setMessage({
        message: '',
        error: errorMessage
      });
    } finally {
      setImporting(false);
    }
  };

  const handleToggleTable = (tableName) => {
    const newSelected = new Set(selectedTables);
    if (newSelected.has(tableName)) {
      newSelected.delete(tableName);
    } else {
      newSelected.add(tableName);
    }
    setSelectedTables(newSelected);
  };

  const handleSelectAllInCategory = (categoryTables) => {
    const categoryTableNames = categoryTables.map(t => t.name);
    const allSelected = categoryTableNames.every(name => selectedTables.has(name));
    
    const newSelected = new Set(selectedTables);
    if (allSelected) {
      // Deselect all in this category
      categoryTableNames.forEach(name => newSelected.delete(name));
    } else {
      // Select all in this category
      categoryTableNames.forEach(name => newSelected.add(name));
    }
    setSelectedTables(newSelected);
  };

  const toggleSection = (category) => {
    const newCollapsed = new Set(collapsedSections);
    if (newCollapsed.has(category)) {
      newCollapsed.delete(category);
    } else {
      newCollapsed.add(category);
    }
    setCollapsedSections(newCollapsed);
  };

  const toggleAllSections = () => {
    const categories = getCategorizedTables().map(item => item.category);
    const allExpanded = categories.every(category => !collapsedSections.has(category));
    
    if (allExpanded) {
      // Collapse all
      setCollapsedSections(new Set(categories));
    } else {
      // Expand all
      setCollapsedSections(new Set());
    }
  };

  const handleTruncate = async () => {
    if (selectedTables.size === 0) {
      setMessage({
        message: '',
        error: 'Please select at least one table to truncate'
      });
      return;
    }

    setShowConfirmModal(true);
  };

  const confirmTruncate = async () => {
    try {
      setTruncating(true);
      setShowConfirmModal(false);
      
      const tablesArray = Array.from(selectedTables);
      const result = await truncateDatabaseTables(tablesArray, true);
      
      if (result.error_count > 0) {
        setMessage({
          message: `Truncated ${result.truncated_count} table(s) successfully. ${result.error_count} table(s) had errors.`,
          error: ''
        });
      } else {
        setMessage({
          message: `Successfully truncated ${result.truncated_count} table(s)!`,
          error: ''
        });
      }
      
      // Clear selection and reload tables
      setSelectedTables(new Set());
      await loadTables();
    } catch (error) {
      setMessage({
        message: '',
        error: typeof error === 'string' ? error : error?.error || 'Failed to truncate tables'
      });
    } finally {
      setTruncating(false);
    }
  };

  const getFilteredTables = () => {
    let filtered = [...tables];

    // Search filter
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      filtered = filtered.filter(table => 
        table.name.toLowerCase().includes(term)
      );
    }

    // Row count filter
    if (rowCountFilter !== 'all') {
      filtered = filtered.filter(table => {
        const rowCount = table.row_count || 0;
        switch (rowCountFilter) {
          case 'empty':
            return rowCount === 0;
          case 'has_data':
            return rowCount > 0;
          case 'small':
            return rowCount > 0 && rowCount < 1000;
          case 'medium':
            return rowCount >= 1000 && rowCount < 100000;
          case 'large':
            return rowCount >= 100000;
          default:
            return true;
        }
      });
    }

    // Sort
    filtered.sort((a, b) => {
      switch (sortBy) {
        case 'name':
          return a.name.localeCompare(b.name);
        case 'name_desc':
          return b.name.localeCompare(a.name);
        case 'rows':
          return (a.row_count || 0) - (b.row_count || 0);
        case 'rows_desc':
          return (b.row_count || 0) - (a.row_count || 0);
        default:
          return 0;
      }
    });

    return filtered;
  };

  const filteredTables = getFilteredTables();

  const formatNumber = (num) => {
    if (num === null || num === undefined) return 'N/A';
    return num.toLocaleString();
  };

  const categorizeTable = (tableName) => {
    const name = tableName.toLowerCase();
    
    // Special handling for specific accounting tables that should not go to Authentication & Users
    if (name === 'accounts_account' || name === 'accounts_defaultaccounthead') {
      return 'Finance & Accounting';
    }
    
    // Finance & Accounting tables (Chart of Accounts and Vouchers)
    if (name.includes('chart') || name.includes('account_head') || name.includes('voucher') || 
        name.includes('journal') || name.includes('ledger') || name.includes('financial')) {
      return 'Finance & Accounting';
    }
    // Global Options tables
    if (name.includes('global_option') || name.includes('globaloption')) {
      return 'Global Options';
    }
    // Common table prefixes/patterns
    // Exclude accounts_account and accounts_defaultaccounthead from this category
    if (name.startsWith('auth_') || name.includes('user')) {
      return 'Authentication & Users';
    }
    if (name.startsWith('service_') || name.includes('fee') || name.includes('payment')) {
      return 'Service & Payments';
    }
    if (name.includes('contact') || name.includes('customer') || name.includes('client')) {
      return 'Contacts & Clients';
    }
    if (name.includes('tower') || name.includes('building') || name.includes('unit') || name.includes('property')) {
      return 'Properties & Units';
    }
    if (name.includes('announcement') || name.includes('bulletin') || name.includes('notice')) {
      return 'Announcements & Notices';
    }
    if (name.includes('audit') || name.includes('log') || name.includes('history')) {
      return 'Audit & Logs';
    }
    if (name.includes('company') || name.includes('setting') || name.includes('config')) {
      return 'Company & Settings';
    }
    if (name.includes('group') || name.includes('role') || name.includes('permission')) {
      return 'Groups & Permissions';
    }
    if (name.startsWith('django_') || name === 'django_migrations' || name.includes('migration')) {
      return 'Django System';
    }
    
    return 'Other Tables';
  };

  const getCategorizedTables = () => {
    const categorized = {};
    
    filteredTables.forEach(table => {
      const category = categorizeTable(table.name);
      if (!categorized[category]) {
        categorized[category] = [];
      }
      categorized[category].push(table);
    });
    
    // Sort categories alphabetically
    const sortedCategories = Object.keys(categorized).sort((a, b) => {
      return a.localeCompare(b);
    });
    
    return sortedCategories.map(category => ({
      category,
      tables: categorized[category]
    }));
  };

  if (loading && tables.length === 0) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <ModernLoadingAnimation />
      </div>
    );
  }

  return (
    <div className="min-h-full bg-gray-50 p-2 sm:p-4">
      {(truncating || exporting || importing) && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30">
          <ModernLoadingAnimation />
        </div>
      )}

      {/* Header */}
      <div className="mb-4 sm:mb-6 pb-3 sm:pb-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 sm:gap-0">
          <div className="flex items-center gap-2 sm:gap-3">
            <Database className="w-5 h-5 sm:w-6 sm:h-6 text-primary flex-shrink-0" />
            <h1 className="text-lg sm:text-xl font-semibold text-gray-900">
              Database Table Management
            </h1>
          </div>
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 sm:gap-3">
            <button
              onClick={() => setShowImportModal(true)}
              disabled={importing || loading || exporting || truncating}
              className="flex items-center justify-center gap-2 px-3 sm:px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed shadow-md text-sm sm:text-base"
            >
              <Upload className={`w-4 h-4 ${importing ? 'animate-bounce' : ''}`} />
              <span className="hidden sm:inline">{importing ? 'Importing...' : 'Import Database'}</span>
              <span className="sm:hidden">{importing ? 'Importing...' : 'Import'}</span>
            </button>
            <button
              onClick={handleExportDatabase}
              disabled={exporting || loading || importing || truncating}
              className="flex items-center justify-center gap-2 px-3 sm:px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed shadow-md text-sm sm:text-base"
            >
              <Download className={`w-4 h-4 ${exporting ? 'animate-bounce' : ''}`} />
              <span className="hidden sm:inline">{exporting ? 'Exporting...' : 'Export Database'}</span>
              <span className="sm:hidden">{exporting ? 'Exporting...' : 'Export'}</span>
            </button>
          </div>
        </div>
        {databaseInfo && (
          <div className="mt-2 text-xs sm:text-sm text-gray-600">
            <span className="block sm:inline">Database: <span className="font-medium">{databaseInfo.name}</span></span>
            <span className="hidden sm:inline"> | </span>
            <span className="block sm:inline mt-1 sm:mt-0">Engine: <span className="font-medium">{databaseInfo.engine.split('.').pop() || databaseInfo.engine}</span></span>
          </div>
        )}
      </div>

      {/* Warning Banner */}
      <div className="mb-4 p-3 sm:p-4 bg-red-50 border border-red-200 rounded-lg flex items-start gap-2 sm:gap-3">
        <AlertTriangle className="w-4 h-4 sm:w-5 sm:h-5 text-red-600 flex-shrink-0 mt-0.5" />
        <div className="flex-1 min-w-0">
          <h3 className="font-semibold text-sm sm:text-base text-red-900 mb-1">Warning: Destructive Operation</h3>
          <p className="text-xs sm:text-sm text-red-700">
            Truncating tables will permanently delete ALL data from the selected tables. This action cannot be undone.
            Make sure you have a backup before proceeding.
          </p>
        </div>
      </div>

      {/* Main Content */}
      <div className="rounded-lg sm:rounded-[27px] bg-white">
        <div className="p-3 sm:p-6">
          {/* Filters Section */}
          <div className="mb-4 space-y-3 sm:space-y-4">
            {/* Search and Expand All */}
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 sm:gap-4">
              <input
                type="text"
                placeholder="Search tables..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="flex-1 px-3 sm:px-4 py-2 text-sm sm:text-base border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
              />
              <button
                onClick={toggleAllSections}
                className="flex items-center justify-center gap-2 px-3 sm:px-4 py-2 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors text-xs sm:text-sm font-medium whitespace-nowrap"
              >
                {getCategorizedTables().every(item => !collapsedSections.has(item.category)) ? (
                  <>
                    <ChevronUp className="w-4 h-4" />
                    <span className="hidden sm:inline">Collapse All</span>
                    <span className="sm:hidden">Collapse</span>
                  </>
                ) : (
                  <>
                    <ChevronDown className="w-4 h-4" />
                    <span className="hidden sm:inline">Expand All</span>
                    <span className="sm:hidden">Expand</span>
                  </>
                )}
              </button>
            </div>

            {/* Additional Filters */}
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 sm:gap-4">
              <div className="flex items-center gap-2">
                <Filter className="w-4 h-4 text-gray-500 flex-shrink-0" />
                <label className="text-xs sm:text-sm font-medium text-gray-700 whitespace-nowrap">Row Count:</label>
                <select
                  value={rowCountFilter}
                  onChange={(e) => setRowCountFilter(e.target.value)}
                  className="flex-1 sm:flex-none px-2 sm:px-3 py-1.5 text-xs sm:text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
                >
                  <option value="all">All Tables</option>
                  <option value="empty">Empty (0 rows)</option>
                  <option value="has_data">Has Data</option>
                  <option value="small">Small (&lt; 1K rows)</option>
                  <option value="medium">Medium (1K - 100K rows)</option>
                  <option value="large">Large (&gt; 100K rows)</option>
                </select>
              </div>

              <div className="flex items-center gap-2">
                <SortAsc className="w-4 h-4 text-gray-500 flex-shrink-0" />
                <label className="text-xs sm:text-sm font-medium text-gray-700 whitespace-nowrap">Sort By:</label>
                <select
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value)}
                  className="flex-1 sm:flex-none px-2 sm:px-3 py-1.5 text-xs sm:text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
                >
                  <option value="name">Name (A-Z)</option>
                  <option value="name_desc">Name (Z-A)</option>
                  <option value="rows">Row Count (Low-High)</option>
                  <option value="rows_desc">Row Count (High-Low)</option>
                </select>
              </div>
            </div>
          </div>

          {/* Selection Info */}
          {selectedTables.size > 0 && (
            <div className="mb-4 p-2 sm:p-3 bg-blue-50 border border-blue-200 rounded-lg">
              <p className="text-xs sm:text-sm text-blue-900">
                <span className="font-semibold">{selectedTables.size}</span> table(s) selected for truncation
              </p>
            </div>
          )}

          {/* Tables Grid */}
          <div className="border border-gray-200 rounded-lg p-2 sm:p-3">
            {filteredTables.length === 0 ? (
              <div className="p-6 sm:p-8 text-center text-gray-500 text-sm sm:text-base">
                No tables found matching your filters
              </div>
            ) : (
              <div className="space-y-4 sm:space-y-6">
                {getCategorizedTables().map(({ category, tables }) => {
                  const categoryTableNames = tables.map(t => t.name);
                  const allCategorySelected = categoryTableNames.length > 0 && categoryTableNames.every(name => selectedTables.has(name));
                  const isExpanded = !collapsedSections.has(category);
                  
                  return (
                  <div key={category} className="space-y-2 sm:space-y-3">
                    {/* Category Header */}
                    <div className="pb-2 border-b-2 border-gray-300 flex items-center justify-between gap-2">
                      <div className="flex items-center gap-1 sm:gap-2 flex-1 min-w-0">
                        <button
                          onClick={() => toggleSection(category)}
                          className="flex items-center gap-1 sm:gap-2 hover:bg-gray-100 rounded px-1 sm:px-2 py-1 transition-colors min-w-0 flex-1"
                        >
                          {isExpanded ? (
                            <ChevronUp className="w-3 h-3 sm:w-4 sm:h-4 text-gray-600 flex-shrink-0" />
                          ) : (
                            <ChevronDown className="w-3 h-3 sm:w-4 sm:h-4 text-gray-600 flex-shrink-0" />
                          )}
                          <h3 className="text-sm sm:text-base font-semibold text-gray-800 flex items-center gap-1 sm:gap-2 min-w-0">
                            <Database className="w-3 h-3 sm:w-4 sm:h-4 text-primary flex-shrink-0" />
                            <span className="truncate">{category}</span>
                            <span className="text-xs sm:text-sm font-normal text-gray-500 flex-shrink-0">
                              ({tables.length} {tables.length === 1 ? 'table' : 'tables'})
                            </span>
                          </h3>
                        </button>
                      </div>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleSelectAllInCategory(tables);
                        }}
                        className="px-2 sm:px-3 py-1 text-xs font-medium bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors whitespace-nowrap flex-shrink-0"
                      >
                        {allCategorySelected ? 'Deselect' : 'Select All'}
                      </button>
                    </div>
                    
                    {/* Tables Grid - 2 columns */}
                    {isExpanded && (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 sm:gap-3">
                      {tables.map((table) => {
                        const isSelected = selectedTables.has(table.name);
                        return (
                          <div
                            key={table.name}
                            className={`p-2 sm:p-2.5 border-2 rounded-md transition-all cursor-pointer ${
                              isSelected 
                                ? 'border-blue-500 bg-blue-50 shadow-md' 
                                : 'border-gray-200 hover:border-gray-300 hover:shadow-sm bg-white'
                            }`}
                            onClick={() => handleToggleTable(table.name)}
                          >
                            <div className="flex items-start gap-2">
                              <input
                                type="checkbox"
                                checked={isSelected}
                                onChange={() => handleToggleTable(table.name)}
                                onClick={(e) => e.stopPropagation()}
                                className="w-4 h-4 mt-0.5 text-primary border-gray-300 rounded focus:ring-primary cursor-pointer flex-shrink-0"
                              />
                              <div className="flex-1 min-w-0">
                                <div className="text-xs sm:text-sm font-medium text-gray-900 break-words mb-0.5 leading-tight">
                                  {table.name}
                                </div>
                                <div className="text-xs text-gray-500">
                                  {formatNumber(table.row_count)} rows
                                </div>
                              </div>
                              {isSelected && (
                                <Trash2 className="w-3 h-3 sm:w-4 sm:h-4 text-red-600 flex-shrink-0 mt-0.5" />
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                    )}
                  </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Action Buttons */}
          <div className="mt-4 sm:mt-6 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 sm:gap-0 pt-3 sm:pt-4 border-t border-gray-200">
            <div className="text-xs sm:text-sm text-gray-600">
              <span className="block sm:inline">Total tables: <span className="font-medium">{tables.length}</span></span>
              <span className="hidden sm:inline"> | </span>
              <span className="block sm:inline">Filtered: <span className="font-medium">{filteredTables.length}</span></span>
            </div>
            <button
              onClick={handleTruncate}
              disabled={selectedTables.size === 0 || truncating}
              className={`px-4 sm:px-6 py-2 text-sm sm:text-base font-semibold rounded-lg transition-all duration-200 flex items-center justify-center gap-2 ${
                selectedTables.size === 0 || truncating
                  ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                  : 'bg-red-600 hover:bg-red-700 text-white'
              }`}
            >
              <Trash2 className="w-4 h-4 sm:w-5 sm:h-5" />
              <span className="hidden sm:inline">Truncate Selected ({selectedTables.size})</span>
              <span className="sm:hidden">Truncate ({selectedTables.size})</span>
            </button>
          </div>
        </div>
      </div>

      {/* Import Database Modal */}
      {showImportModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-lg p-4 sm:p-6 max-w-md w-full shadow-xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-start gap-3 sm:gap-4 mb-4">
              <div className="flex-shrink-0">
                <Upload className="w-6 h-6 sm:w-8 sm:h-8 text-blue-600" />
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="text-base sm:text-lg font-semibold text-gray-900 mb-2">
                  Import Database
                </h3>
                <p className="text-xs sm:text-sm text-gray-600 mb-4">
                  Select a SQL file to import into the database. This will execute all SQL statements in the file.
                </p>
                <div className="bg-yellow-50 border border-yellow-200 rounded p-2 sm:p-3 mb-4">
                  <p className="text-xs font-medium text-yellow-900 mb-1">⚠️ Warning:</p>
                  <p className="text-xs text-yellow-700">
                    Importing will execute all SQL statements in the file. This may overwrite existing data. Make sure you have a backup.
                  </p>
                </div>
                <div className="mb-4">
                  <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-2">
                    Select SQL File
                  </label>
                  <input
                    type="file"
                    accept=".sql,application/sql"
                    onChange={handleImportFileChange}
                    className="block w-full text-xs sm:text-sm text-gray-500 file:mr-2 sm:file:mr-4 file:py-1.5 sm:file:py-2 file:px-2 sm:file:px-4 file:rounded-lg file:border-0 file:text-xs sm:file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100 cursor-pointer"
                  />
                  {importFile && (
                    <p className="mt-2 text-xs sm:text-sm text-gray-600 break-words">
                      Selected: <span className="font-medium">{importFile.name}</span> ({(importFile.size / 1024).toFixed(2)} KB)
                    </p>
                  )}
                </div>
              </div>
            </div>
            <div className="flex flex-col-reverse sm:flex-row gap-2 sm:gap-3 justify-end">
              <button
                onClick={() => {
                  setShowImportModal(false);
                  setImportFile(null);
                }}
                disabled={importing}
                className="px-4 py-2 text-sm sm:text-base border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={handleImportDatabase}
                disabled={!importFile || importing}
                className="px-4 py-2 text-sm sm:text-base bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-semibold disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {importing ? 'Importing...' : 'Import Database'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Confirmation Modal */}
      {showConfirmModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-lg p-4 sm:p-6 max-w-md w-full shadow-xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-start gap-3 sm:gap-4 mb-4">
              <div className="flex-shrink-0">
                <AlertTriangle className="w-6 h-6 sm:w-8 sm:h-8 text-red-600" />
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="text-base sm:text-lg font-semibold text-gray-900 mb-2">
                  Confirm Truncation
                </h3>
                <p className="text-xs sm:text-sm text-gray-600 mb-4">
                  You are about to permanently delete all data from <span className="font-semibold text-red-600">{selectedTables.size} table(s)</span>.
                  This action cannot be undone.
                </p>
                <div className="bg-red-50 border border-red-200 rounded p-2 sm:p-3 mb-4">
                  <p className="text-xs font-medium text-red-900 mb-2">Selected tables:</p>
                  <ul className="text-xs text-red-700 space-y-1 max-h-32 overflow-y-auto break-words">
                    {Array.from(selectedTables).map((tableName) => (
                      <li key={tableName}>• {tableName}</li>
                    ))}
                  </ul>
                </div>
                <p className="text-xs sm:text-sm font-semibold text-red-600 mb-4">
                  Are you absolutely sure you want to proceed?
                </p>
              </div>
            </div>
            <div className="flex flex-col-reverse sm:flex-row gap-2 sm:gap-3 justify-end">
              <button
                onClick={() => setShowConfirmModal(false)}
                className="px-4 py-2 text-sm sm:text-base border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={confirmTruncate}
                className="px-4 py-2 text-sm sm:text-base bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors font-semibold"
              >
                Yes, Truncate Tables
              </button>
            </div>
          </div>
        </div>
      )}

      <MessageBox
        message={message.message}
        error={message.error}
        clearMessage={() => setMessage({ message: '', error: '' })}
      />
    </div>
  );
};

export default DatabaseTruncatePage;

