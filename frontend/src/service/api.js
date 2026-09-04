import axios from "axios";

const api = axios.create({
  baseURL: "http://localhost:3000/api",
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem("token");

  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }

  return config;
});

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;

    // Avoid infinite loops
    if (
      error.response?.status === 401 &&
      originalRequest &&
      !originalRequest._retry &&
      !originalRequest.url?.includes("/auth/login") &&
      !originalRequest.url?.includes("/auth/refresh")
    ) {
      originalRequest._retry = true;
      const refreshToken = localStorage.getItem("refreshToken");

      if (refreshToken) {
        try {
          const res = await axios.post("http://localhost:3000/api/auth/refresh", {
            refreshToken,
          });

          if (res.data?.token) {
            localStorage.setItem("token", res.data.token);
            if (res.data.refreshToken) {
              localStorage.setItem("refreshToken", res.data.refreshToken);
            }
            originalRequest.headers.Authorization = `Bearer ${res.data.token}`;
            return api(originalRequest);
          }
        } catch (refreshError) {
          localStorage.removeItem("token");
          localStorage.removeItem("refreshToken");
          localStorage.removeItem("user");
          if (!window.location.pathname.includes("/login")) {
            window.location.href = "/login";
          }
        }
      } else {
        localStorage.removeItem("token");
        localStorage.removeItem("refreshToken");
        localStorage.removeItem("user");
        if (!window.location.pathname.includes("/login")) {
          window.location.href = "/login";
        }
      }
    }

    return Promise.reject(error);
  }
);

export default api;