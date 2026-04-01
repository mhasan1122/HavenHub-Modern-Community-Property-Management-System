import React, { useEffect } from "react";
import { useDispatch, useSelector } from "react-redux";
import { useNavigate } from "react-router-dom";
import { setAuthFromLocalStorage } from "../../redux/slices/authSlice/authSlice";
import { fetchHeadingData } from "../../redux/slices/api/memberApi";
import { getCompanySettings } from "../../redux/slices/companySettingsSlice/companySettingsSlice";
import NotificationDropdown from "../../Components/Notifications/NotificationDropdown";
import user from "../../assets/user/user.png";
import axios from "axios";

const api = axios.create({
  baseURL: import.meta.env.VITE_BASE_API
});

const UserProfile = ({ member }) => {
  const navigate = useNavigate();
  const imageUrl = member?.photo_low_quality 
    ? `${api.defaults.baseURL}${member.photo_low_quality}` 
    : user;

  return (
    <div
      className="flex items-center space-x-2 cursor-pointer"
      onClick={() =>
        navigate(`/member-profile/${member.id}`, { replace: true })
      }
    >
      <img
        src={imageUrl}
        onError={(e) => {
          e.target.src = user;
        }}
        className="w-8 h-8 sm:w-10 sm:h-10 border border-[#3D9D9B] rounded-full object-cover flex-shrink-0"
        alt="User Avatar"
        loading="lazy"
      />
      {/* Hide user info on mobile, show on sm and up */}
      <div className="hidden sm:block">
        <h2 className="text-primary text-sm sm:text-lg font-medium truncate max-w-[120px] lg:max-w-none">
          {member.full_name}
        </h2>
        <div className="relative group inline-block">
          <p className="text-primary text-xs sm:text-sm cursor-default truncate max-w-[120px] lg:max-w-none">
            {member.roles.slice(0, 2).join(", ")}
            {member.roles.length > 2 && ", ..."}
          </p>

          <div className="absolute top-full mt-1 z-10 hidden group-hover:block bg-white border text-primary text-xs rounded p-2 max-w-xs w-fit shadow-lg whitespace-pre-line right-0">
            {member.roles.join(", ")}
          </div>
        </div>
      </div>
    </div>
  );
};

const Header = ({ toggleSidebar, isSidebarOpen = false }) => {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const { isAuthenticated } = useSelector((state) => state.auth);
  // Subscribe to headingData from the Redux member slice
  const member = useSelector((state) => state.member.headingData);
  // Subscribe to company settings
  const { settings } = useSelector((state) => state.companySettings);

  useEffect(() => {
    dispatch(setAuthFromLocalStorage());
  }, [dispatch]);

  // Fetch heading data on mount if authenticated
  useEffect(() => {
    if (isAuthenticated) {
      dispatch(fetchHeadingData());
      dispatch(getCompanySettings());
    }
  }, [dispatch, isAuthenticated]);

  return (
    <header className="bg-white/95 border-b-[3px] border-gray-200/70 px-3 sm:px-4 lg:px-6 py-3 sm:py-4 shadow-sm flex items-center justify-between gap-2 sm:gap-4 min-h-[64px]">
      {/* Left Section: Sidebar Toggle & Logo */}
      <div className="flex items-center gap-2 sm:gap-3 lg:gap-4 flex-shrink-0 min-w-0">
        <button
          className="lg:hidden relative flex h-9 w-9 sm:h-10 sm:w-10 items-center justify-center rounded-lg border border-primary/30 bg-white/90 text-primary shadow-sm transition-all duration-200 hover:border-primary hover:bg-primary hover:text-white hover:shadow-md active:scale-95 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 flex-shrink-0"
          onClick={toggleSidebar}
          aria-label="Toggle Sidebar"
          aria-expanded={isSidebarOpen}
          aria-controls="sidebar-navigation"
        >
          {isSidebarOpen ? (
            <svg
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
              strokeWidth={2.5}
              stroke="currentColor"
              className="w-5 h-5 sm:w-6 sm:h-6 transition-transform duration-200"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          ) : (
          <svg
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
              viewBox="0 0 24 24"
              strokeWidth={2.5}
            stroke="currentColor"
              className="w-5 h-5 sm:w-6 sm:h-6 transition-transform duration-200"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
                d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5"
            />
          </svg>
          )}
        </button>
        <button
          onClick={() => navigate("/", { replace: false })}
          className="flex items-center gap-2 sm:gap-3 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 rounded-md transition-opacity duration-200 hover:opacity-80 flex-shrink-0 min-w-0"
          aria-label="Go to Dashboard"
          title="Go to Dashboard"
        >
          <img
            src={
              settings?.logo_url
                ? settings.logo_url.startsWith("http") || settings.logo_url.startsWith("//")
                  ? settings.logo_url
                  : `${api.defaults.baseURL}${settings.logo_url.startsWith("/") ? "" : "/"}${settings.logo_url}`
                : "/logo.svg"
            }
            alt={settings?.company_name || "Estate Link Logo"}
            className="w-[120px] h-[30px] sm:w-[150px] sm:h-[40px] lg:w-[193.64px] lg:h-[50px] max-w-[120px] sm:max-w-[150px] lg:max-w-[193.64px] max-h-[30px] sm:max-h-[40px] lg:max-h-[50px] object-contain pointer-events-none"
            loading="lazy"
            onError={(e) => {
              // Fallback to default logo if image fails to load
              const fallbackSrc = "/logo.svg";
              if (e.target.src !== fallbackSrc && !e.target.src.includes("logo.svg")) {
                e.target.src = fallbackSrc;
              }
            }}
          />
        </button>
      </div>

      {/* Right Section: Notifications, User Profile */}
      <div className="flex items-center gap-2 sm:gap-3 lg:gap-4 flex-shrink-0">
        {/* Notifications Icon */}
        <NotificationDropdown />

        {/* User Profile or Login */}
        {isAuthenticated ? (
          <UserProfile member={member} />
        ) : (
          <button
            onClick={() => navigate("/login")}
            className="rounded-full border border-[#3D9D9B] px-3 py-1.5 sm:px-4 sm:py-2 text-xs sm:text-sm text-[#3D9D9B] transition-colors duration-200 hover:bg-primary hover:text-white whitespace-nowrap"
          >
            Login
          </button>
        )}
      </div>
    </header>
  );
};

export default Header;
