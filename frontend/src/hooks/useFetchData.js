import { useState, useCallback } from "react";
import axios from "axios";
import { getAccessToken } from "../utils/tokenUtils"; // JWT Token Utility

const BASE_URL = "http://localhost:8000";  // Django backend URL

const useApi = () => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [response, setResponse] = useState(null);

  // axios instance
  const reactInstance = axios.create({
    baseURL: BASE_URL,
    headers: {
      Authorization: `Bearer ${getAccessToken()}`,
    },
  });

  // Request function for API calls (GET, POST, DELETE, etc.)
  const request = useCallback(
    async (method, url, data = null) => {
      setLoading(true);
      setError(null);
      setResponse(null);

      try {
        let result;
        if (method === "GET") {
          result = await reactInstance.get(url);
        } else if (method === "POST") {
          result = await reactInstance.post(url, data);
        } else if (method === "PUT") {
          result = await reactInstance.put(url, data);
        } else if (method === "DELETE") {
          result = await reactInstance.delete(url);
        }
        setResponse(result.data);  // Set the API response
      } catch (err) {
        setError(err.response?.data || err.message);  // Set the error response
      } finally {
        setLoading(false);  // Set loading to false after request completion
      }
    },
    []
  );

  // GET Request
  const get = (url) => request("GET", url);

  // POST Request
  const post = (url, data) => request("POST", url, data);

  // PUT Request
  const put = (url, data) => request("PUT", url, data);

  // DELETE Request
  const del = (url) => request("DELETE", url);

  return {
    loading,
    error,
    response,
    get,
    post,
    put,
    del,
  };
};

export default useApi;
