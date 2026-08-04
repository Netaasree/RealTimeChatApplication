import axios from "axios";

const getBaseUrl = () => {
  let url = import.meta.env.VITE_API_URL || "";
  url = url.trim().replace(/\/$/, "");
  return url ? `${url}/api` : "/api";
};

const API = axios.create({
  baseURL: getBaseUrl(),
  withCredentials: true,
});

// Automatically attach token to every request
API.interceptors.request.use((config) => {
  const userInfo = JSON.parse(sessionStorage.getItem("userInfo"));

  if (userInfo?.token) {
    config.headers.Authorization = `Bearer ${userInfo.token}`;
  }

  return config;
});

export default API;
