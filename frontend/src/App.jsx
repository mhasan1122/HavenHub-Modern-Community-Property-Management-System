import { useEffect } from "react";
import { useDispatch, useSelector } from "react-redux";
import { setAuthFromLocalStorage } from "./redux/slices/authSlice/authSlice";
import { RouterProvider } from "react-router-dom";
import { router } from "./Routes/Routes.jsx";
import ErrorBoundary from "./Components/Error/ErrorBoundary";

const App = () => {
  const dispatch = useDispatch();

  useEffect(() => {
    dispatch(setAuthFromLocalStorage()); // Load authentication state from localStorage
  }, [dispatch]);

  return (
    <ErrorBoundary>
      <RouterProvider router={router} />
    </ErrorBoundary>
  );
};

export default App;
