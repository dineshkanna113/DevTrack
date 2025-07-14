import { useEffect, useState } from "react";
import axios from "axios";
import { useNavigate } from "react-router-dom";

export default function Dashboard() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    const token = localStorage.getItem("token");
    if (!token) {
      navigate("/login");
      return;
    }

    axios.get("https://devtrack-backend-758s.onrender.com/auth/me", {
      headers: {
        Authorization: `Bearer ${token}`
      }
    })
    .then(res => {
      setEmail(res.data.email);
      setLoading(false);
    })
    .catch(() => {
      alert("Session expired. Please login again.");
      localStorage.removeItem("token");
      navigate("/login");
    });
  }, []);

  const handleLogout = () => {
    localStorage.removeItem("token");
    alert("Logged out successfully");
    navigate("/login");
  };

  if (loading) {
    return <div style={{ textAlign: "center", marginTop: "2rem" }}>🔄 Loading your dashboard...</div>;
  }

  return (
    <div style={{ maxWidth: "900px", margin: "auto", textAlign: "center", padding: "2rem" }}>
      <h1>🚀 Welcome to DevTrack</h1>
      <h2>👤 Logged in as: <span style={{ color: "#3498db" }}>{email}</span></h2>

      <div style={{ marginTop: "1.5rem" }}>
        <a href="/issues" style={{ textDecoration: "none", color: "#2ecc71", fontWeight: "bold" }}>
          👉 View Issues
        </a>
      </div>

      <button
        onClick={handleLogout}
        style={{
          marginTop: "2rem",
          backgroundColor: "#e74c3c",
          color: "white",
          padding: "10px 20px",
          border: "none",
          borderRadius: "4px",
          cursor: "pointer"
        }}
      >
        🔓 Logout
      </button>
    </div>
  );
}
