import React, { useState, useEffect, useCallback, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import {
    FaPlus,
    FaEdit,
    FaTrash,
    FaSave,
    FaTimes,
    FaSpinner,
    FaPuzzlePiece,
    FaChartBar,
    FaExclamationTriangle,
    FaLayerGroup,
    FaChevronLeft,
    FaHashtag,
    FaTags,
    FaCog,
    FaSearch,
    FaChartLine,
    FaBalanceScale,
    FaUniversity
} from "react-icons/fa";
import PageContainer from "../../Components/Ui/PageContainer";
import MessageBox from "../../Components/MessageBox/MessageBox";
import axiosInstance from "../../utils/axiosInstance";
import "./TrialBalance-Revised.css";

// --- MEMOIZED ACCOUNT PILL (prevents per-card re-render) ---
const AccountPill = React.memo(({ acc, isActive, occupiedBy, onToggle }) => (
    <div
        className={`account-pill ${isActive ? 'active' : ''} ${occupiedBy ? 'occupied' : ''}`}
        onClick={() => !occupiedBy && onToggle(acc.id)}
        title={occupiedBy ? `Already mapped to: ${occupiedBy}` : ''}
    >
        <div className="pill-info">
            <span className="pill-name">{acc.accountName}</span>
            <span className="pill-parent">
                {acc.accountCode} • {occupiedBy ? (
                    <span className="text-amber-600 font-bold whitespace-nowrap flex items-center gap-1">
                        <FaExclamationTriangle size={8} /> Used in {occupiedBy}
                    </span>
                ) : acc.accountTypeDisplay}
            </span>
        </div>
    </div>
));

const TrialBalanceConfig = () => {
    const navigate = useNavigate();
    const [sections, setSections] = useState([]);
    const [accounts, setAccounts] = useState([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    const [success, setSuccess] = useState(null);
    const [accountSearchTerm, setAccountSearchTerm] = useState("");
    const [isEditing, setIsEditing] = useState(null); // section ID

    const [formData, setFormData] = useState({
        sectionName: "",
        order: 0,
        moduleName: "trial_balance",
        accounts: [],
        isActive: true
    });

    const reportModules = [
        { value: "trial_balance", label: "Trial Balance", icon: <FaChartBar /> },
        { value: "income_statement", label: "Profit & Loss (P&L)", icon: <FaChartLine /> },
        { value: "balance_sheet", label: "Balance Sheet", icon: <FaBalanceScale /> },
        { value: "received_payment", label: "Received & Payment", icon: <FaUniversity /> },
    ];

    const getModuleLabel = (moduleName) => {
        return reportModules.find(m => m.value === moduleName)?.label || moduleName.replace('_', ' ');
    };

    const getModuleIcon = (moduleName) => {
        return reportModules.find(m => m.value === moduleName)?.icon || <FaLayerGroup />;
    };

    // Fetch initial data — BATCHED so everything renders at the same time
    useEffect(() => {
        const loadInitialData = async () => {
            setLoading(true);
            try {
                const [sectionsRes, accountsRes] = await Promise.all([
                    axiosInstance.get("/api/accounts/report-sections/"),
                    axiosInstance.get("/api/accounts/accounts/minimal/")
                ]);

                // Extract data from responses
                const sectionsData = sectionsRes.data.success
                    ? sectionsRes.data.data
                    : (sectionsRes.data.results || sectionsRes.data);
                const accountsData = Array.isArray(accountsRes.data)
                    ? accountsRes.data
                    : (accountsRes.data.results || []);

                // SET BOTH AT ONCE — single render, all cards + occupied status together
                setSections(Array.isArray(sectionsData) ? sectionsData : []);
                setAccounts(accountsData);
            } catch (err) {
                console.error("Load Error:", err);
                setError("Failed to load configuration data. Please refresh.");
            } finally {
                setLoading(false);
            }
        };
        loadInitialData();
    }, []);

    const fetchSections = async () => {
        try {
            const response = await axiosInstance.get("/api/accounts/report-sections/");
            const data = response.data.success ? response.data.data : (response.data.results || response.data);
            if (Array.isArray(data)) {
                setSections(data);
            }
        } catch (err) {
            console.error("Fetch Sections Error:", err);
            setError("Failed to fetch report sections. Please check your connection.");
        }
    };

    // Automatically update order when module changes
    useEffect(() => {
        if (!isEditing) {
            const moduleSections = sections.filter(s => s.moduleName === formData.moduleName);
            const maxOrder = moduleSections.length > 0 ? Math.max(...moduleSections.map(s => s.order || 0)) : -1;
            setFormData(prev => ({ ...prev, order: maxOrder + 1 }));
        }
    }, [formData.moduleName, sections, isEditing]);

    const fetchAccounts = async () => {
        try {
            const response = await axiosInstance.get("/api/accounts/accounts/minimal/");
            const data = Array.isArray(response.data) ? response.data : (response.data.results || []);
            setAccounts(data);
        } catch (err) {
            console.error("Fetch Accounts Error:", err);
        }
    };

    const handleEdit = (section) => {
        setIsEditing(section.id);
        setFormData({
            sectionName: section.sectionName,
            order: section.order,
            moduleName: section.moduleName,
            accounts: section.accounts || [],
            isActive: section.isActive
        });
        window.scrollTo({ top: 0, behavior: 'smooth' });
    };

    const handleReset = () => {
        setIsEditing(null);
        setFormData({
            sectionName: "",
            order: 0,
            moduleName: formData.moduleName, // Keep current module selection
            accounts: [],
            isActive: true
        });
        setError(null);
    };

    const handleSubmit = async (e) => {
        e.preventDefault();

        // 1. Validation: One ledger account can only belong to one section per module
        const conflictingSection = sections.find(s =>
            s.id !== isEditing &&
            s.moduleName === formData.moduleName &&
            s.accounts.some(accId => formData.accounts.includes(accId))
        );

        if (conflictingSection) {
            const firstConflictId = conflictingSection.accounts.find(id => formData.accounts.includes(id));
            const conflictingAccount = accounts.find(a => a.id === firstConflictId);
            setError(`Mapping Error: "${conflictingAccount?.accountName}" is already assigned to the "${conflictingSection.sectionName}" group in this report. A single account can only be mapped to one section.`);
            return;
        }

        setLoading(true);
        setError(null);
        try {
            if (isEditing) {
                await axiosInstance.put(`/api/accounts/report-sections/${isEditing}/`, formData);
                setSuccess("Report section updated successfully");
            } else {
                await axiosInstance.post("/api/accounts/report-sections/", formData);
                setSuccess("New report section created successfully");
            }
            handleReset();
            await fetchSections();
        } catch (err) {
            setError(err.response?.data?.message || "An error occurred while saving. Please try again.");
        } finally {
            setLoading(false);
        }
    };

    const handleDelete = async (id) => {
        if (!window.confirm("Continue with deletion? This will unassign all accounts from this section.")) return;
        try {
            setLoading(true);
            await axiosInstance.delete(`/api/accounts/report-sections/${id}/`);
            setSuccess("Section removed successfully");
            await fetchSections();
        } catch (err) {
            setError("Unable to delete section. It might be in use.");
        } finally {
            setLoading(false);
        }
    };

    const toggleAccount = (accountId) => {
        const updated = [...formData.accounts];
        const index = updated.indexOf(accountId);
        if (index > -1) {
            updated.splice(index, 1);
        } else {
            updated.push(accountId);
        }
        setFormData({ ...formData, accounts: updated });
    };

    // PRE-COMPUTE occupied status for O(1) rendering!
    const occupiedAccountsMap = useMemo(() => {
        const map = new Map();
        sections.forEach(s => {
            if (s.id !== isEditing && s.moduleName === formData.moduleName) {
                (s.accounts || []).forEach(accId => {
                    map.set(accId, s.sectionName);
                });
            }
        });
        return map;
    }, [sections, isEditing, formData.moduleName]);

    // PRE-COMPUTE active accounts as a Set for O(1) lookup
    const activeAccountIds = useMemo(() => new Set(formData.accounts), [formData.accounts]);

    // PRE-COMPUTE filtered accounts list
    const filteredAccounts = useMemo(() => {
        const term = accountSearchTerm.toLowerCase();
        if (!term) return accounts;
        return accounts.filter(acc =>
            acc.accountName.toLowerCase().includes(term) ||
            acc.accountCode.includes(accountSearchTerm)
        );
    }, [accounts, accountSearchTerm]);
    return (
        <PageContainer>
            <div className="tb-revised-container">

                {error && <MessageBox error={error} clearMessage={() => setError(null)} onOk={() => setError(null)} />}
                {success && <MessageBox message={success} clearMessage={() => setSuccess(null)} onOk={() => setSuccess(null)} />}

                {/* Unified Single Card Dashboard */}
                <div className="bg-white rounded-xl shadow-sm border border-slate-100 mb-4 flex-shrink-0 relative overflow-hidden">
                    {/* Card Header: Title */}
                    <div className="p-3 md:p-6 border-b border-gray-200">
                        <h1 className="text-2xl font-black text-slate-800 tracking-tight">Report Configuration</h1>
                        <p className="text-[13px] font-bold text-slate-500 mt-1 capitalize tracking-tight">Setup Groups & Account Mappings</p>
                    </div>

                    {/* Header: Configuration Form */}
                    <div className="config-header pt-2 pb-2 px-8">
                        <h3 className="config-section-title flex items-center mb-4">
                            {isEditing ? (
                                <div className="flex items-center gap-2">
                                    <span className="w-2 h-2 bg-primary rounded-full animate-pulse"></span>
                                    <span className="text-sm font-bold text-slate-700 tracking-tight">Modify Selection Group</span>
                                    <span className="ml-2 text-[10px] font-black uppercase text-primary bg-primary/10 px-2.5 py-0.5 rounded-md border border-primary/20">
                                        Active Editing
                                    </span>
                                </div>
                            ) : (
                                <div className="flex items-center gap-2">
                                    <span className="w-1 h-4 bg-slate-200 rounded-full"></span>
                                    <span className="text-sm font-bold text-slate-700 tracking-tight">Define New Report Section</span>
                                </div>
                            )}
                        </h3>

                        <form onSubmit={handleSubmit} className="premium-form-grid">
                            <div className="form-field">
                                <label>Section Display Name</label>
                                <input
                                    type="text"
                                    required
                                    placeholder="e.g. Current Assets, Operating Expenses..."
                                    value={formData.sectionName}
                                    onChange={(e) => setFormData({ ...formData, sectionName: e.target.value })}
                                />
                            </div>

                            <div className="form-field">
                                <label>Target Module</label>
                                <select
                                    value={formData.moduleName}
                                    onChange={(e) => {
                                        const newModule = e.target.value;
                                        const moduleSections = sections.filter(s => s.moduleName === newModule);
                                        const maxOrder = moduleSections.length > 0 ? Math.max(...moduleSections.map(s => s.order || 0)) : -1;
                                        setFormData({
                                            ...formData,
                                            moduleName: newModule,
                                            order: isEditing ? formData.order : maxOrder + 1
                                        });
                                    }}
                                >
                                    <option value="trial_balance">Trial Balance Report</option>
                                    <option value="income_statement">Profit & Loss / Income Statement</option>
                                    <option value="balance_sheet">Balance Sheet Statement</option>
                                    <option value="received_payment">Received & Payment Account</option>
                                </select>
                            </div>

                            <div className="form-field">
                                <label>Display Order</label>
                                <input
                                    type="number"
                                    value={formData.order}
                                    onChange={(e) => setFormData({ ...formData, order: parseInt(e.target.value) })}
                                />
                            </div>

                            <div className="config-actions">
                                <button type="button" className="btn-ghost" onClick={handleReset}>
                                    <FaTimes /> Reset
                                </button>
                                <button type="submit" className="btn-primary-teal" disabled={loading}>
                                    {loading ? <FaSpinner className="spin" /> : <FaSave />}
                                    {isEditing ? "Apply Changes" : "Save configuration"}
                                </button>
                            </div>

                            {/* Multi-Account Selection Area */}
                            <div className="accounts-selection-box">
                                <div className="flex items-center justify-between mb-3 px-1">
                                    <label className="flex items-center gap-2 text-xs font-extrabold text-slate-900 capitalize tracking-wide">
                                        <FaTags className="text-primary/50" />
                                        Map Ledger Accounts ({formData.accounts.length} selected)
                                    </label>

                                    <div className="relative w-48">
                                        <FaSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-300 text-xs" />
                                        <input
                                            type="text"
                                            placeholder="Search accounts..."
                                            className="search-accounts-input"
                                            value={accountSearchTerm}
                                            onChange={(e) => setAccountSearchTerm(e.target.value)}
                                        />
                                    </div>
                                </div>

                                <div className="accounts-selector-wrapper glass-scroll">
                                    {(accounts.length === 0 || sections.length === 0) && loading ? (
                                        <p className="w-full text-center py-4 text-slate-400 text-sm italic">Loading charts of accounts...</p>
                                    ) : filteredAccounts.length > 0 ? filteredAccounts.map((acc) => (
                                        <AccountPill
                                            key={acc.id}
                                            acc={acc}
                                            isActive={activeAccountIds.has(acc.id)}
                                            occupiedBy={occupiedAccountsMap.get(acc.id)}
                                            onToggle={toggleAccount}
                                        />
                                    )) : (
                                        <p className="w-full text-center py-4 text-slate-400 text-sm italic">
                                            {accounts.length === 0 ? 'No accounts found' : 'No accounts match your search'}
                                        </p>
                                    )}
                                </div>
                            </div>
                        </form>
                    </div>

                    {/* Body: Live Table of Configured Sections */}
                    <div className="config-body pt-2 pb-2 px-8">
                        <h3 className="config-section-title flex items-center mb-4">
                            <span className="w-1 h-4 bg-slate-200 rounded-full"></span>
                            <span className="text-sm font-bold text-slate-700 tracking-tight">Registered Report Groups</span>
                        </h3>

                        <div className="sections-table-wrapper">
                            {sections.filter(s => s.moduleName === formData.moduleName).length === 0 ? (
                                <div className="empty-dashboard">
                                    <FaPuzzlePiece className="icon" />
                                    <h4>{getModuleLabel(formData.moduleName)} Mapping Empty</h4>
                                    <p>Start mapping your accounts above to define groups for this report.</p>
                                </div>
                            ) : (
                                <table className="sections-table">
                                    <thead>
                                        <tr>
                                            <th className="w-16">Pos</th>
                                            <th>Group Identification</th>
                                            <th>Assigned Coverage</th>
                                            <th className="text-right">Management</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {sections
                                            .filter(s => s.moduleName === formData.moduleName)
                                            .sort((a, b) => a.order - b.order)
                                            .map((section) => (
                                                <tr key={section.id}>
                                                    <td>
                                                        <div className="order-badge-pill">#{section.order}</div>
                                                    </td>
                                                    <td>
                                                        <div className="section-display-name capitalize">{section.sectionName}</div>
                                                        <div className="section-display-module capitalize">{section.moduleNameDisplay || section.moduleName.replace('_', ' ')}</div>
                                                    </td>
                                                    <td>
                                                        <div className="acc-tag-count">
                                                            <FaChartBar size={10} />
                                                            {section.accounts?.length || 0} Accounts mapped
                                                        </div>
                                                    </td>
                                                    <td>
                                                        <div className="action-btns-group">
                                                            <button
                                                                className="icon-action-btn edit text-primary"
                                                                title="Edit Group"
                                                                onClick={() => handleEdit(section)}
                                                            >
                                                                <FaEdit />
                                                            </button>
                                                            <button
                                                                className="icon-action-btn delete text-red-500"
                                                                title="Remove Group"
                                                                onClick={() => handleDelete(section.id)}
                                                            >
                                                                <FaTrash />
                                                            </button>
                                                        </div>
                                                    </td>
                                                </tr>
                                            ))}
                                    </tbody>
                                </table>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </PageContainer>
    );
};

export default TrialBalanceConfig;
