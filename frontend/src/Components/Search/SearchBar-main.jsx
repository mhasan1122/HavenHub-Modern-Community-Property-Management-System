import React, { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import useDebounce from "../../hooks/useDebounce";
import { FaMagnifyingGlass } from "react-icons/fa6";

const SearchBar = ({
  placeholder = "Search list...",
  updateUrl = true,
  onSearch
}) => {
  const [searchParams, setSearchParams] = useSearchParams();
  const [searchQuery, setSearchQuery] = useState(
    searchParams.get("search") || ""
  );

  const [isFocused, setIsFocused] = useState(false);

  // MAY USE LATER - Rusaf
  // Load search query from URL on mount
  // useEffect(() => {
  // 	if (updateUrl) {
  // 		const urlSearch = searchParams.get('search') || '';
  // 		setSearchQuery(urlSearch); // Set the search input to the URL value
  // 	}
  // }, [searchParams, updateUrl, 'search']);

  // Debounced search query (updates only after user stops typing for 300ms)
  const debouncedSearch = useDebounce(searchQuery, 900, 3);

  // Apply search results (URL-based or local search)
  useEffect(() => {
    if (updateUrl) {
      // Update URL Params
      const params = new URLSearchParams(searchParams);
      if (debouncedSearch) {
        params.set("search", debouncedSearch);
      } else {
        params.delete("search");
      }
      setSearchParams(params);
    } else {
      // Call the search function directly if not updating URL
      onSearch && onSearch(debouncedSearch);
    }
  }, [debouncedSearch, updateUrl, searchParams, setSearchParams, onSearch]);

  return (
    <div
      className={`flex max-h-[40px] items-center bg-white border p-6 rounded-8 shadow-sm transition-all duration-300 ${
        isFocused || searchQuery ? "border-primary" : "border-gray-200"
      }`}
    >
      <FaMagnifyingGlass className="text-primary mr-2" />
      <input
        type="text"
        name="search"
        className={`w-50 outline-none placeholder:text-base placeholder:text-primary caret-primary`}
        placeholder={placeholder}
        value={searchQuery}
        onChange={(e) => setSearchQuery(e.target.value)}
        autoComplete="off"
        onFocus={() => setIsFocused(true)}
        onBlur={() => setIsFocused(searchQuery.length > 0)}
      />
    </div>
  );
};

export default SearchBar;
