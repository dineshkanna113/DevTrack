import { useState, useEffect } from "react";
import axios from "axios";

export default function Issues() {
  const [issues, setIssues] = useState([]);
  const [form, setForm] = useState({ title: "", description: "" });

  const token = localStorage.getItem("token");

  useEffect(() => {
    axios.get("http://localhost:8000/issues", {
      headers: { Authorization: `Bearer ${token}` }
    })
    .then(res => setIssues(res.data))
    .catch(err => alert("Error loading issues"));
  }, []);

  const handleSubmit = async e => {
    e.preventDefault();
    try {
      await axios.post("http://localhost:8000/issues", form, {
        headers: { Authorization: `Bearer ${token}` }
      });
      alert("Issue added");
      window.location.reload(); // Refresh issue list
    } catch {
      alert("Error adding issue");
    }
  };

  return (
    <div style={{ padding: "1rem" }}>
      <h2>DevTrack – Issues</h2>
      <form onSubmit={handleSubmit}>
        <input placeholder="Title" onChange={e => setForm({ ...form, title: e.target.value })} />
        <textarea placeholder="Description" onChange={e => setForm({ ...form, description: e.target.value })}></textarea>
        <button type="submit">Add Issue</button>
      </form>

      <h3>Issue List</h3>
      {issues.map(issue => (
        <div key={issue.id} style={{ border: "1px solid #ccc", padding: "0.5rem", marginTop: "1rem" }}>
          <h4>{issue.title}</h4>
          <p>{issue.description}</p>
          <p>Status: {issue.status}</p>
        </div>
      ))}
    </div>
  );
}
