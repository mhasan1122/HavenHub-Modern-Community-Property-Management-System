
  import React, { useState } from 'react';
import axios from 'axios';
import { Link, useNavigate } from 'react-router-dom';

const Logindummy = () => {
  const [formData, setFormData] = useState({
    authenticator: '',
    password: '',
  });

  const [message, setMessage] = useState('');
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const navigate = useNavigate();

  const handleChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value,
    });
  };

  const refreshAccessToken = async () => {
    const refreshToken = localStorage.getItem('refresh_token');

    if (!refreshToken) {
      return null;
    }
    try {
      const response = await axios.post('http://127.0.0.1:8000/user/token/refresh/', {
        refresh: refreshToken,
      });

      localStorage.setItem('access_token', response.data.access);
      return response.data.access;
    } catch (error) {
      console.error('Failed to refresh token:', error);
      return null;
    }
  };

  const api = axios.create({
    baseURL: 'http://127.0.0.1:8000',
    headers: {
      'Authorization': `Bearer ${localStorage.getItem('access_token')}`,
    },
  });

  api.interceptors.response.use(
    (response) => response,
    async (error) => {
      if (error.response.status === 401) {
        const newAccessToken = await refreshAccessToken();
        if (newAccessToken) {
          error.config.headers['Authorization'] = `Bearer ${newAccessToken}`;
          return api(error.config);
        }
      }
      return Promise.reject(error);
    }
  );

  const handleLogin = async (e) => {
    e.preventDefault();

    try {
      const response = await axios.post('http://127.0.0.1:8000/user/login/', formData);
      console.log('Login response:', response.data);

      localStorage.setItem('access_token', response.data.access_token);
      localStorage.setItem('refresh_token', response.data.refresh_token);
      setIsLoggedIn(true);

    } catch (error) {
      console.error('Login error:', error);
      setMessage('Login failed: ' + (error.response?.data?.error || 'Unknown error'));
    }
  };
 


  return (
    <div className="pt-8 mt-[200px] mb-[160px]">
    
        <form onSubmit={handleLogin} className="max-w-sm mx-auto bg-white p-6 rounded-lg shadow-lg">
          <div className="mb-4">
            <label className="block text-gray-700 text-sm font-semibold mb-2" htmlFor="username">
              Username:
            </label>
            <input
              type="text"
              name="authenticator"
              value={formData.authenticator}
              onChange={handleChange}
              className="w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
          <div className="mb-6">
            <label className="block text-gray-700 text-sm font-semibold mb-2" htmlFor="password">
              Password:
            </label>
            <input
              type="password"
              name="password"
              value={formData.password}
              onChange={handleChange}
              className="w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
          <button
            type="submit"
            className="w-full py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-400"
          >
            Login
          </button>

       
        </form>




     

      {message && <p className="mt-4 text-center text-red-500">{message}</p>}
   
    </div>
  );
};

export default Logindummy;
