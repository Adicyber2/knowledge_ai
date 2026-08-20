import { createContext, useContext, useState ,useEffect} from "react";
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

    const { token, user } = response.data;

    localStorage.setItem("token", token);
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

    setUser(response.data.user);
  } catch (error) {
    console.error("Failed to load user:", error);

    localStorage.removeItem("token");
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
    localStorage.removeItem("user");

    setUser(null);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        login,
        register,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  return useContext(AuthContext);
};