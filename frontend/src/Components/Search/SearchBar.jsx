import { useEffect, useState } from "react";
import PropTypes from "prop-types";
import { useSearchParams } from "react-router-dom";
import useDebounce from "../../hooks/useDebounce";
import { FaMagnifyingGlass } from "react-icons/fa6";

const SearchBar = ({
  placeholder = "Search List...",
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
      className={`flex items-center bg-stroke border py-2 px-4 rounded-8 shadow-sm transition-all duration-200 h-[42px] ${
        isFocused || searchQuery 
          ? "border-primary bg-white shadow-ring-primary" 
          : "border-primary bg-stroke hover:bg-white hover:shadow-ring-primary"
      }`}
    >
      <FaMagnifyingGlass className="text-primary mr-2" />
      <input
        type="text"
        name="search"
        className={`w-full outline-none text-sm placeholder:text-sm placeholder:text-primary caret-primary bg-transparent`}
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

SearchBar.propTypes = {
  placeholder: PropTypes.string,
  updateUrl: PropTypes.bool,
  onSearch: PropTypes.func
};

export default SearchBar;
