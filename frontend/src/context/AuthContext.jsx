import { createContext, useContext, useState, useEffect } from "react";
import api from "../service/api";

const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(() => {
    const savedUser = localStorage.getItem("user");
    return savedUser ? JSON.parse(savedUser) : null;
  });
  const [loading, setLoading] = useState(true);

  const login = async (email, password) => {
    const response = await api.post("/auth/login", {
      email,
      password,
    });

    const { token, refreshToken, user } = response.data;

    localStorage.setItem("token", token);
    if (refreshToken) {
      localStorage.setItem("refreshToken", refreshToken);
    }
    localStorage.setItem("user", JSON.stringify(user));

    setUser(user);

    return response.data;
  };

  const register = async (name, email, password) => {
    return await api.post("/auth/register", {
      name,
      email,
      password,
    });
  };

  const loadUser = async () => {
    const token = localStorage.getItem("token");

    if (!token) {
      setUser(null);
      setLoading(false);
      return;
    }

    try {
      const response = await api.get("/auth/me");
      const userObj = response.data.user;
      setUser(userObj);
      localStorage.setItem("user", JSON.stringify(userObj));
    } catch (error) {
      console.error("Failed to load user:", error);
      localStorage.removeItem("token");
      localStorage.removeItem("refreshToken");
      localStorage.removeItem("user");
      setUser(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadUser();
  }, []);

  const logout = () => {
    localStorage.removeItem("token");
    localStorage.removeItem("refreshToken");
    localStorage.removeItem("user");
    setUser(null);
  };

  const forgotPassword = async (email) => {
    const response = await api.post("/auth/forgot-password", { email });
    return response.data;
  };

  const resetPassword = async (token, email, password, confirmPassword) => {
    const response = await api.post("/auth/reset-password", {
      token,
      email,
      password,
      confirmPassword,
    });
    return response.data;
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        login,
        register,
        logout,
        forgotPassword,
        resetPassword,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  return useContext(AuthContext);
};