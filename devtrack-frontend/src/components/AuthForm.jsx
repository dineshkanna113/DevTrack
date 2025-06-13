import { useState } from "react";
import axios from "axios";
import { useNavigate } from 'react-router-dom'

export default function AuthForm({ isLogin }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [username, setUsername] = useState('');
  const navigate = useNavigate();
  const handleSubmit = async e => {
    e.preventDefault();
    const endpoint = isLogin ? "/auth/login" : "/auth/register";

    const payload = isLogin
      ? { email, password }
      : { username, email, password };

    try {
      const res = await axios.post(`https://devtrack-backend-tkdg.onrender.com${endpoint}`, payload);

      if (isLogin) {
        const token = res.data.access_token;
        localStorage.setItem("token", token);
        alert("Login successful!");
        navigate("/Dashboard");
      } else {
        alert(res.data.message);  // e.g., "User registered successfully"
      }
    } catch (err) {
      console.error("Error:", err);
      if (err.response && err.response.data && err.response.data.detail) {
        alert("Auth failed: " + err.response.data.detail);
      } else {
        alert("Auth failed: " + err.message);
      }
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
