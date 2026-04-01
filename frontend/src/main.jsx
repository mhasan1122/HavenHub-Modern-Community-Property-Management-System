import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
// Import form component styles globally to ensure they load on page refresh
// This fixes the issue where form field styles disappear on refresh
import "./Components/FormComponent/FormComponent.css";
import App from "./App.jsx";

import { Provider } from "react-redux";
import store from "./redux/store";

createRoot(document.getElementById("root")).render(
  // <StrictMode>
    <Provider store={store}>
      <App />
    </Provider>
  // </StrictMode>
);
