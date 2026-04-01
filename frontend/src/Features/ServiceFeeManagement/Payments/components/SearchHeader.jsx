import PropTypes from 'prop-types';

const SearchHeader = ({ onSearch, searchQuery }) => {
  const handleSearchChange = (e) => {
    onSearch(e.target.value);
  };

  return (
    <div className="search-header">
      <div className="header-left">
        <div className="brand-info">
          <div className="brand-logo">
            <img src="/estate_link.png" alt="Estate Link" className="logo-icon" />
            <span className="brand-text">EstateLink • Service Fee Mgmt</span>
          </div>
        </div>
      </div>

      <div className="header-center">
        <div className="search-container">
          <img src="/search-head.png" alt="Search" className="search-icon" />
          <input
            type="text"
            placeholder="Search towers, units, invoice..."
            value={searchQuery}
            onChange={handleSearchChange}
            className="search-input"
          />
        </div>
        <select className="month-filter">
          <option value="this-month">This Month</option>
          <option value="last-month">Last Month</option>
          <option value="last-3-months">Last 3 Months</option>
        </select>
      </div>

      <div className="header-right">
        <div className="theme-selector">
          <span>Theme</span>
        </div>
        <button className="record-payment-btn">
          Record Payment
        </button>
      </div>
    </div>
  );
};

SearchHeader.propTypes = {
  onSearch: PropTypes.func.isRequired,
  searchQuery: PropTypes.string.isRequired,
};

export default SearchHeader;
