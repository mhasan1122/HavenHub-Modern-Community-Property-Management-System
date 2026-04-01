const SearchField = ({ placeholder = "Search...", onSearch, className = "" }) => {
  return (
    <input
      type="text"
      name="search"
      className={`outline-none border ${className} placeholder:text-base placeholder:text-primary `}
      placeholder={placeholder}
      onChange={(e) => onSearch && onSearch(e.target.value)}
    />
  );
};

export default SearchField;
