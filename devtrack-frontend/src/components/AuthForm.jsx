import { useState } from "react";
import axios from "axios";
import { useNavigate } from 'react-router-dom'

export default function AuthForm({ isLogin }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [username, setUsername] = useState('');
  const API_URL = "https://devtrack-backend-758s.onrender.com";
  const navigate = useNavigate();
  const handleSubmit = async e => {
  e.preventDefault();
  const endpoint = isLogin ? "/auth/login" : "/auth/register";
  const payload = { email, password };
const handleSubmit = async (e) => {
  e.preventDefault();
  const endpoint = isLogin ? "/auth/login" : "/auth/register";
  const payload = { email, password };

  try {
    const res = await axios.post(`${API_URL}${endpoint}`, payload, {
      headers: { "Content-Type": "application/json" },
      withCredentials: true
    });

    console.log("✅ SUCCESS RESPONSE:", res);  // <-- See what comes back

    if (isLogin) {
      const token = res.data.access_token;
      localStorage.setItem("token", token);
      alert("Login successful!");
      navigate("/dashboard");
    } else {
      alert("Registration successful!");
    }

  } catch (err) {
    console.error("❌ Network/Auth error:", err);
    alert("Auth failed: " + (err.response?.data?.detail || err.message));
  }
};
  try {
    const res = await axios.post(`${API_URL}${endpoint}`, payload, {
      headers: { "Content-Type": "application/json" }
    });

    if (isLogin) {
      const token = res.data.access_token;
      localStorage.setItem("token", token);
      alert("Login successful!");
      navigate("/dashboard");
    } else {
      alert("Registration successful!");
    }

  } catch (err) {
    console.error("Network/Auth error:", err);
    alert("Auth failed: " + (err.response?.data?.detail || err.message));
  }
};


  return (
    <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '10px', maxWidth: '300px', margin: 'auto' }}>
      <h2>{isLogin ? "Login" : "Register"}</h2>

      {!isLogin && (
        <input
          type="text"
          placeholder="Username"
          value={username}
          onChange={e => setUsername(e.target.value)}
          required
        />
      )}

      <input
        type="email"
        placeholder="Email"
        value={email}
        onChange={e => setEmail(e.target.value)}
        required
      />
      <input
        type="password"
        placeholder="Password"
        value={password}
        onChange={e => setPassword(e.target.value)}
        required
      />
      <button type="submit">{isLogin ? "Login" : "Register"}</button>
    </form>
  );
}
