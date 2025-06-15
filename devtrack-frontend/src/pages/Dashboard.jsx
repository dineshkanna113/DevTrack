import { useEffect, useState } from "react";
import axios from "axios";
import { useNavigate } from "react-router-dom";

export default function Dashboard() {
  const [email, setEmail] = useState("");
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
    })
    .catch(err => {
      alert("Invalid session. Please login again.");
      localStorage.removeItem("token");
      navigate("/login");
    });
  }, []);

  return (
    <div style={{ textAlign: "center" }}>
      <h1>Welcome to DevTrack</h1>
      <h2>Logged in as: {email}</h2>
      <a href="/issues">View Issues</a>
    <button
  onClick={() => {
    localStorage.removeItem("token");
    alert("Logged out");
    window.location.href = "/login";
  }}
  style={{ marginTop: "1rem", backgroundColor: "#e74c3c", color: "white", padding: "10px", border: "none", cursor: "pointer" }}
>
  Logout
</button>

    </div>
    
  );
}
