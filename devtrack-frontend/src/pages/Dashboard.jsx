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

    axios.get("http://127.0.0.1:8000/auth/me", {
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

    </div>
  );
}
