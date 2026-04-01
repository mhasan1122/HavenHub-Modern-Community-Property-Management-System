import React, { useState, useEffect, useRef } from "react";
import { FaChevronDown, FaSearch } from "react-icons/fa";
import axios from "axios";

const baseURL = import.meta.env.VITE_BASE_API || "http://127.0.0.1:8000";

const MemberDropdown = ({
  value = "",
  memberId = "",
  onSelect,
  excludedMemberIds = [],
  disabled = false
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [members, setMembers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [selectedMember, setSelectedMember] = useState(null);
  const [searchTerm, setSearchTerm] = useState("");
  const dropdownRef = useRef(null);

  // Fetch members when dropdown opens
  useEffect(() => {
    if (isOpen && members.length === 0 && !loading) {
      const fetchInitialMembers = async () => {
        setLoading(true);
        setError("");
        try {
          // Fetch initial members with a broad search
          const url = `${baseURL}/towers/add_owner_search/?search=a`;
          const res = await axios.get(url);
          
          const memberData = res.data?.member_data || [];
          // Group members by ID and get unique members
          const uniqueMembers = memberData.reduce((acc, current) => {
            const existingMember = acc.find(item => item.id === current.id);
            if (!existingMember) {
              acc.push({
                id: current.id,
                full_name: current.full_name || ""
              });
            }
            return acc;
          }, []);
          
          setMembers(uniqueMembers);
        } catch (err) {
          console.error("Failed to fetch members:", err);
          setError("Failed to load members. Please try again.");
          setMembers([]);
        } finally {
          setLoading(false);
        }
      };

      fetchInitialMembers();
    }
  }, [isOpen]);

  // Fetch members when search term changes (with debounce)
  useEffect(() => {
    if (!isOpen || searchTerm.trim().length < 3) {
      // If search is less than 3 chars, keep initial members or clear if needed
      return;
    }

    const fetchSearchedMembers = async () => {
      setLoading(true);
      setError("");
      try {
        const url = `${baseURL}/towers/add_owner_search/?search=${encodeURIComponent(searchTerm)}`;
        const res = await axios.get(url);
        
        const memberData = res.data?.member_data || [];
        // Group members by ID and get unique members
        const uniqueMembers = memberData.reduce((acc, current) => {
          const existingMember = acc.find(item => item.id === current.id);
          if (!existingMember) {
            acc.push({
              id: current.id,
              full_name: current.full_name || ""
            });
          }
          return acc;
        }, []);
        
        setMembers(uniqueMembers);
      } catch (err) {
        console.error("Failed to fetch members:", err);
        setError("Failed to load members. Please try again.");
        setMembers([]);
      } finally {
        setLoading(false);
      }
    };

    // Debounce search to avoid too many API calls
    const timeoutId = setTimeout(() => {
      fetchSearchedMembers();
    }, 300);

    return () => clearTimeout(timeoutId);
  }, [searchTerm, isOpen]);

  // Update selected member when value or memberId changes
  useEffect(() => {
    if (memberId && value && members.length > 0) {
      const member = members.find(m => m.id.toString() === memberId.toString());
      if (member) {
        setSelectedMember(member);
      }
    } else if (!memberId || !value) {
      setSelectedMember(null);
    }
  }, [memberId, value, members]);

  // Handle click outside to close dropdown
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleSelect = (member) => {
    if (disabled) return;
    setSelectedMember(member);
    setIsOpen(false);
    if (onSelect) onSelect(member);
  };

  // Filter out excluded members (search is handled by API)
  const availableMembers = members.filter(member => 
    !excludedMemberIds.includes(member.id.toString())
  );

  return (
    <div className="relative w-full" ref={dropdownRef}>
      <button
        type="button"
        onClick={() => !disabled && setIsOpen(!isOpen)}
        disabled={disabled}
        className={`w-full px-3 py-2 h-[52px] rounded-lg border text-left flex items-center justify-between ${
          disabled
            ? "bg-gray-100 cursor-not-allowed border-gray-200"
            : "border-[#3D9D9B] focus:outline-none focus:ring-2 focus:ring-primary"
        } ${error ? "border-red-500" : ""}`}
      >
        <span className={selectedMember ? "text-gray-900" : "text-gray-500"}>
          {selectedMember ? selectedMember.full_name : "Select Owner"}
        </span>
        <FaChevronDown
          className={`w-4 h-4 text-gray-400 transition-transform ${
            isOpen ? "transform rotate-180" : ""
          }`}
        />
      </button>

      {isOpen && !disabled && (
        <div className="absolute z-10 w-full mt-1 bg-white border border-gray-300 rounded-lg shadow-lg max-h-60 flex flex-col">
          {/* Search input */}
          <div className="p-2 border-b border-gray-200">
            <div className="relative">
              <FaSearch className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
              <input
                type="text"
                placeholder="Search members..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-9 pr-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary text-sm"
                onClick={(e) => e.stopPropagation()}
              />
            </div>
          </div>
          
          {/* Members list */}
          <div className="overflow-y-auto max-h-[240px]">
            {loading ? (
              <div className="px-3 py-2 text-sm text-gray-500 text-center">
              </div>
            ) : error ? (
              <div className="px-3 py-2 text-sm text-red-500 text-center">
                {error}
              </div>
            ) : availableMembers.length === 0 ? (
              <div className="px-3 py-2 text-sm text-gray-500 text-center">
                {searchTerm.trim().length > 0 && searchTerm.trim().length < 3 
                  ? "Type at least 3 characters to search" 
                  : searchTerm.trim().length >= 3 
                    ? "No members found" 
                    : "No members available"}
              </div>
            ) : (
              <ul>
                {availableMembers.map((member) => (
                  <li
                    key={member.id}
                    onClick={() => handleSelect(member)}
                    className={`px-3 py-2 cursor-pointer hover:bg-gray-50 ${
                      selectedMember?.id === member.id ? "bg-primaryLight" : ""
                    }`}
                  >
                    <div className="text-sm text-gray-900">{member.full_name}</div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default MemberDropdown;

