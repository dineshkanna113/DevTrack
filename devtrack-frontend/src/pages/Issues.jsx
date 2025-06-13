import { useState, useEffect } from "react";
import axios from "axios";

export default function Issues() {
  const [issues, setIssues] = useState([]);
  const [form, setForm] = useState({ title: "", description: "" });
  const [filter, setFilter] = useState("all");
  const [loading, setLoading] = useState(false);

  const token = localStorage.getItem("token");

  useEffect(() => {
    axios.get("http://localhost:8000/issues", {
      headers: { Authorization: `Bearer ${token}` }
    })
    .then(res => setIssues(res.data))
    .catch(() => alert("Error loading issues"));
  }, []);

  const handleSubmit = async e => {
    e.preventDefault();

    if (!form.title.trim() || !form.description.trim()) {
      alert("Please fill in all fields");
      return;
    }

    setLoading(true);

    try {
      await axios.post("http://localhost:8000/issues", form, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setForm({ title: "", description: "" });
      alert("Issue added");
      window.location.reload();
    } catch {
      alert("Error adding issue");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ maxWidth: "800px", margin: "auto", padding: "1rem" }}>
      <h2>DevTrack – Issues</h2>
      <form onSubmit={handleSubmit}>
        <input
          style={{ width: "100%", padding: "8px" }}
          placeholder="Title"
          value={form.title}
          onChange={e => setForm({ ...form, title: e.target.value })}
        />
        <textarea
          style={{ width: "100%", height: "80px", padding: "8px" }}
          placeholder="Description"
          value={form.description}
          onChange={e => setForm({ ...form, description: e.target.value })}
        ></textarea>
        <button type="submit" disabled={loading}>
          {loading ? "Adding..." : "Add Issue"}
        </button>
      </form>

      <h3>Filter by Status</h3>
      <select onChange={e => setFilter(e.target.value)} value={filter}>
        <option value="all">All</option>
        <option value="open">Open</option>
        <option value="closed">Closed</option>
      </select>

      <h3>Issue List</h3>
      {issues
        .filter(issue => filter === "all" ? true : issue.status === filter)
        .map(issue => (
          <div key={issue.id} style={{ border: "1px solid #ccc", padding: "10px", marginTop: "10px" }}>
            <strong>{issue.title}</strong>
            <p>{issue.description}</p>
            <p>Status: <span style={{ fontWeight: 'bold', color: issue.status === "closed" ? "crimson" : "green" }}>{issue.status.toUpperCase()}</span></p>
            <button
              style={{ marginRight: "10px", backgroundColor: "#3498db", color: "white", border: "none", padding: "5px" }}
              onClick={async () => {
                await axios.patch(`http://localhost:8000/issues/${issue.id}/close`, {}, {
                  headers: { Authorization: `Bearer ${token}` }
                });
                alert("Issue status toggled");
                window.location.reload();
              }}
            >
              Mark as {issue.status === "open" ? "Closed" : "Open"}
            </button>
            <button
              style={{ backgroundColor: "#e74c3c", color: "white", border: "none", padding: "5px" }}
              onClick={async () => {
                if (window.confirm("Delete this issue?")) {
                  await axios.delete(`http://localhost:8000/issues/${issue.id}`, {
                    headers: { Authorization: `Bearer ${token}` }
                  });
                  alert("Issue deleted");
                  window.location.reload();
                }
              }}
            >
              Delete
            </button>
          </div>
        ))}
    </div>
  );
}
