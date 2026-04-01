// src/routes/ProtectedRoute.jsx
import { useEffect, useState, useRef } from "react";
import { useSelector, useDispatch } from "react-redux";
import { Navigate, useParams, useLocation } from "react-router-dom";
import PropTypes from "prop-types";
import axiosInstance from "../utils/axiosInstance";
import ModernLoadingAnimation from "../Components/Loaders/ModernLoadingAnimation";
import { fetchHeadingData } from "../redux/slices/api/memberApi";

const ProtectedRoute = ({
  children,
  requiredPermission = null,
  requiredRole = null
}) => {
  const dispatch = useDispatch();
  const user = useSelector((state) => state.auth.user);
  const headingData = useSelector((state) => state.member?.headingData);
  const params = useParams();
  const location = useLocation();
  const [centralPermissionGranted, setCentralPermissionGranted] = useState(null);
  const [loading, setLoading] = useState(true);
  const lastCheckedRoute = useRef(null);

  // Fetch headingData once if needed (for member-profile, general-info-edit, and login-credential-edit routes)
  // Use a ref to prevent multiple fetches
  const headingDataFetchAttempted = useRef(false);

  useEffect(() => {
    const routePath = location.pathname;
    const isMemberProfileRoute = routePath.includes('/member-profile/');
    const isGeneralInfoEditRoute = routePath.includes('/general-information-edit/');
    const isLoginCredentialEditRoute = routePath.includes('/login-credential-edit/');
    const needsHeadingData = isMemberProfileRoute || isGeneralInfoEditRoute || isLoginCredentialEditRoute;

    // Reset ref when route changes
    if (!needsHeadingData) {
      headingDataFetchAttempted.current = false;
    }

    if (user && needsHeadingData && !headingData?.id && !headingDataFetchAttempted.current) {
      headingDataFetchAttempted.current = true;
      dispatch(fetchHeadingData());
    }
  }, [user, location.pathname, headingData?.id, dispatch]);

  useEffect(() => {
    // If there's no user, no need to check permissions; finish loading.
    if (!user) {
      setLoading(false);
      return;
    }

    // If no permission or role required, allow access
    if (!requiredPermission && !requiredRole) {
      setCentralPermissionGranted(true);
      setLoading(false);
      return;
    }

    const checkPermissions = async () => {
      try {
        // Special case: Check if user is accessing their own profile
        // For member-profile, general-information-edit, and login-credential-edit routes,
        // allow users to access their own profile without special permissions
        const routePath = location.pathname;
        const isMemberProfileRoute = routePath.includes('/member-profile/');
        const isGeneralInfoEditRoute = routePath.includes('/general-information-edit/');
        const isLoginCredentialEditRoute = routePath.includes('/login-credential-edit/');
        const isOwnProfileRoute = isMemberProfileRoute || isGeneralInfoEditRoute || isLoginCredentialEditRoute;
        const currentRoute = `${routePath}-${params.id}`;

        // Reset check if route changed
        if (lastCheckedRoute.current !== currentRoute) {
          lastCheckedRoute.current = currentRoute;
        }

        if (isOwnProfileRoute && params.id) {
          const viewedMemberId = Number(params.id);

          // Try to get current user ID - prioritize localStorage (always available, synchronous, no async issues)
          let currentUserId = null;

          // Priority 1: localStorage (always available, synchronous, most reliable for this check)
          try {
            const storedUser = JSON.parse(localStorage.getItem('user'));
            if (storedUser?.id) {
              currentUserId = Number(storedUser.id);
            }
          } catch (e) {
            // Ignore localStorage errors
          }

          // Priority 2: headingData.id (if available)
          if (!currentUserId && headingData?.id) {
            currentUserId = Number(headingData.id);
          }
          // Priority 3: user.id from Redux (fallback)
          else if (!currentUserId && user?.id) {
            currentUserId = Number(user.id);
          }

          // If we have both IDs and they match, allow access immediately
          if (currentUserId && viewedMemberId && currentUserId === viewedMemberId) {
            const routeType = isMemberProfileRoute ? 'viewing' : isGeneralInfoEditRoute ? 'editing general info for' : 'editing login credentials for';
            console.log(`✅ ProtectedRoute: User ${routeType} own profile - allowing access without permission check`);
            setCentralPermissionGranted(true);
            setLoading(false);
            return;
          }

          // If we don't have currentUserId yet and headingData is not loaded,
          // the useEffect will re-run when headingData loads (due to headingData?.id in dependencies)
          // So we proceed with permission check - if it's their own profile, the next render will catch it
        }

        let hasPermission = true;
        let hasRole = true;

        // Check permission if required
        if (requiredPermission) {
          const reqPermissions = Array.isArray(requiredPermission) ? requiredPermission : [requiredPermission];
          let results = [];

          for (const p of reqPermissions) {
            let centralCheckPassed = null; // null = not checked, true/false = result
            let localCheckPassed = false;

            // Check local permission_ids first
            if (user?.permission_ids && Array.isArray(user.permission_ids)) {
              const permissionIds = user.permission_ids.map(String);
              localCheckPassed = permissionIds.includes(String(p));
            }

            // Check central API for permission
            try {
              const response = await axiosInstance.get(
                `/user/cental_permission_checker/?type_of_member=org&permission_id=${p}`
              );
              centralCheckPassed = response.status === 200;
            } catch (error) {
              console.warn(`Central permission check failed for ${p}, using local check:`, error);
              centralCheckPassed = null;
            }

            if (centralCheckPassed !== null) {
              results.push(centralCheckPassed && localCheckPassed);
            } else {
              results.push(localCheckPassed);
            }
          }

          // If it was an array, we use OR logic (at least one permission)
          hasPermission = Array.isArray(requiredPermission)
            ? results.some(res => res === true)
            : results[0] === true;
        }

        // Check role if required
        if (requiredRole && hasPermission) {
          const normalizedRole = requiredRole.toLowerCase();
          const userRoles =
            user?.member_roles?.map((role) =>
              (role.role_name || "").toLowerCase()
            ) || [];
          hasRole = userRoles.includes(normalizedRole);
        }

        setCentralPermissionGranted(hasPermission && hasRole);
      } catch (error) {
        console.error("Permission check error:", error);
        setCentralPermissionGranted(false);
      } finally {
        setLoading(false);
      }
    };

    checkPermissions();
  }, [user, requiredPermission, requiredRole, params.id, location.pathname, headingData?.id]);

  // If user is not authenticated, redirect to login.
  if (!user) {
    return <Navigate to="/login" replace />;
  }

  // Show a loading state while checking permissions.
  if (loading) {
    return <ModernLoadingAnimation className="min-h-screen" />;
  }

  // If permission check fails, redirect to not authorized.
  if (centralPermissionGranted === false) {
    return <Navigate to="/not-authorized" replace />;
  }

  // If permission check passed, render children
  if (centralPermissionGranted === true) {
    return children;
  }

  // Default: show loading (shouldn't reach here, but safety check)
  return <ModernLoadingAnimation className="min-h-screen" />;
};

ProtectedRoute.propTypes = {
  children: PropTypes.node.isRequired,
  requiredPermission: PropTypes.oneOfType([
    PropTypes.number,
    PropTypes.arrayOf(PropTypes.number)
  ]),
  requiredRole: PropTypes.string,
};

export default ProtectedRoute;
