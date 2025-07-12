import { useState, useEffect } from "react";
import axios from "axios";

export default function Issues() {
  const [issues, setIssues] = useState([]);
  const [form, setForm] = useState({
    title: "",
    description: "",
    label: "task",
    assigned_to: "unassigned"
  });
  const [filter, setFilter] = useState("all");
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(1);
  const [limit] = useState(5);
  const [hasMore, setHasMore] = useState(true); // optional for disabling "Next"

  const token = localStorage.getItem("token");

  const fetchIssues = async () => {
    setLoading(true);
    try {
      const res = await axios.get(`https://devtrack-backend-758s.onrender.com/issues?page=${page}&limit=${limit}`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      setIssues(res.data);
      setHasMore(res.data.length === limit);
    } catch (err) {
  console.error("Error adding issue:", err);
  if (err.response) {
    console.error("Server responded with:", err.response.status, err.response.data);
    alert("Backend Error: " + JSON.stringify(err.response.data));
  } else {
    alert("Network Error: " + err.message);
  }
}
  };

  useEffect(() => {
    fetchIssues();
  }, [page]);

  const handleSubmit = async e => {
    e.preventDefault();
    if (!form.title.trim() || !form.description.trim()) {
      alert("Please fill in all fields");
      return;
    }

    setLoading(true);
    try {
      await axios.post("https://devtrack-backend-758s.onrender.com/issues", {
        title: form.title,
        description: form.description,
        label: form.label,
        assigned_to: form.assigned_to,
        // status: "open"
      }, {
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json"
        }
      });
      setForm({ title: "", description: "", label: "task", assigned_to: "unassigned" });
      alert("Issue added");
      fetchIssues();
    } catch (err) {
      console.error("Error adding issue:", err);
      alert("Error adding issue");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ maxWidth: "800px", margin: "auto", padding: "1rem" }}>
      <h2>DevTrack – Issues</h2>

      {/* Form */}
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
        <select
          value={form.label}
          onChange={e => setForm({ ...form, label: e.target.value })}
          style={{ padding: "8px", width: "100%" }}
        >
          <option value="task">Task</option>
          <option value="bug">Bug</option>
          <option value="feature">Feature</option>
          <option value="urgent">Urgent</option>
        </select>
        <input
          type="email"
          placeholder="Assign to (email)"
          value={form.assigned_to}
          onChange={e => setForm({ ...form, assigned_to: e.target.value })}
          style={{ padding: "8px", width: "100%" }}
        />
        <button type="submit" disabled={loading}>
          {loading ? "Adding..." : "Add Issue"}
        </button>
      </form>

      {/* Filter */}
      <h3>Filter by Status</h3>
      <select onChange={e => setFilter(e.target.value)} value={filter}>
        <option value="all">All</option>
        <option value="open">Open</option>
        <option value="closed">Closed</option>
      </select>

      {/* Issues */}
      <h3>Issue List</h3>
      {issues
        .filter(issue =>
          filter === "all" ||
          (filter === "open" && issue.status === true) ||
          (filter === "closed" && issue.status === false)
        )
        .map(issue => (
          <div key={issue.id} style={{ border: "1px solid #ccc", padding: "10px", marginTop: "10px" }}>
            <strong>{issue.title}</strong>
            <p>{issue.description}</p>
            <p>Label: {issue.label}</p>
            <p>Assigned to: {issue.assigned_to}</p>
            <p>Status: <span style={{ fontWeight: 'bold', color: issue.status ? "green" : "crimson" }}>{issue.status ? "OPEN" : "CLOSED"}</span></p>
            <button
              style={{ marginRight: "10px", backgroundColor: "#3498db", color: "white", border: "none", padding: "5px" }}
              onClick={async () => {
                await axios.patch(`https://devtrack-backend-758s.onrender.com/issues/${issue.id}/close`, {}, {
                  headers: { Authorization: `Bearer ${token}` }
                });
                alert("Issue status toggled");
                fetchIssues();
              }}
            >
              Mark as {issue.status ? "Closed" : "Open"}
            </button>
            <button
              style={{ backgroundColor: "#e74c3c", color: "white", border: "none", padding: "5px" }}
              onClick={async () => {
                if (window.confirm("Delete this issue?")) {
                  await axios.delete(`https://devtrack-backend-758s.onrender.com/issues/${issue.id}`, {
                    headers: { Authorization: `Bearer ${token}` }
                  });
                  alert("Issue deleted");
                  fetchIssues();
                }
              }}
            >
              Delete
            </button>
          </div>
        ))}

      {/* Pagination */}
      <div style={{ display: "flex", justifyContent: "space-between", marginTop: "20px" }}>
        <button
          onClick={() => setPage(prev => Math.max(prev - 1, 1))}
          disabled={page === 1}
        >
          Previous
        </button>
        <span>Page {page}</span>
        <button
          onClick={() => setPage(prev => prev + 1)}
          disabled={!hasMore}
        >
          Next
        </button>
      </div>
    </div>
  );
}
