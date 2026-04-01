import { useState, useEffect } from "react";

// Debounce function with minLength check
const useDebounce = (value, delay, minLength = 0) => {
  const [debouncedValue, setDebouncedValue] = useState("");

  useEffect(() => {
    if (value.length >= minLength) {
      const handler = setTimeout(() => {
        setDebouncedValue(value);
      }, delay);

      return () => clearTimeout(handler);
    } else {
      setDebouncedValue(""); // Reset if below minLength
    }
  }, [value, delay, minLength]);

  return debouncedValue;
};

export default useDebounce;
