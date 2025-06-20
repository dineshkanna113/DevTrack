import { useState } from "react";
import axios from "axios";
import { useNavigate } from 'react-router-dom';

export default function AuthForm({ isLogin }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [username, setUsername] = useState('');
  const API_URL = "https://devtrack-backend-758s.onrender.com";
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const handleSubmit = async e => {
    e.preventDefault();
    
    const endpoint = isLogin ? "/auth/login" : "/auth/register";

    const payload = isLogin
      ? { email, password }
      : { email, password }; // ← You can add username if your backend uses it

    try {
      const res = await axios.post(`${API_URL}${endpoint}`, payload, {
        headers: { "Content-Type": "application/json" },
        withCredentials: true,
      });

      console.log("✅ RESPONSE:", res.data);

      if (isLogin) {
        const token = res.data.access_token;
        localStorage.setItem("token", token);
        alert("Login successful!");
        navigate("/dashboard");
      } else {
        alert("Registration successful!");
        // NOTE: You can't call setIsLogin here because isLogin is a prop
        navigate("/login"); // redirect to login instead
      }
    } catch (err) {
      console.error("❌ Auth error:", err);
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
