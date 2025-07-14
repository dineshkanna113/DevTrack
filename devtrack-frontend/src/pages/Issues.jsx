import { useState, useEffect } from "react";
import axios from "axios";

export default function Issues() {
  const [issues, setIssues] = useState([]);
  const [form, setForm] = useState({
    title: "",
    description: "",
    label: "task",
    assigned_to: ""
  });
  const [filter, setFilter] = useState("all");
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  const token = localStorage.getItem("token");

  useEffect(() => {
    if (!token || token === "null") {
      alert("Session expired. Redirecting to login.");
      window.location.href = "/login";
    }
  }, []);

  const fetchIssues = async () => {
    setLoading(true);
    try {
      const res = await axios.get(
        `https://devtrack-backend-758s.onrender.com/issues?page=${page}`,
        {
          headers: { Authorization: `Bearer ${token}` }
        }
      );
      setIssues(res.data.items);
      setTotalPages(res.data.total_pages);
    } catch (err) {
      console.error("Error fetching issues:", err);
    } finally {
      setLoading(false);
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
      await axios.post("https://devtrack-backend-758s.onrender.com/issues", form, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setForm({ title: "", description: "", label: "task", assigned_to: "" });
      alert("✅ Issue added successfully");
      setPage(1);
      fetchIssues();
    } catch (err) {
      console.error("Error adding issue:", err);
      alert("❌ Error adding issue");
    } finally {
      setLoading(false);
    }
  };

  const labelColor = {
    task: "#2980b9",
    bug: "#e74c3c",
    feature: "#f39c12",
    urgent: "#8e44ad"
  };

  return (
    <div style={{
      maxWidth: "700px",
      margin: "2rem auto",
      padding: "2rem",
      fontFamily: "Segoe UI, sans-serif",
      color: "#ecf0f1",
      boxSizing: "border-box"
    }}>
      <h1 style={{ textAlign: "center", color: "#2ecc71" }}>🐛 DevTrack – Issues</h1>

      {/* Form */}
      <form onSubmit={handleSubmit} style={{
        backgroundColor: "#2c3e50",
        padding: "20px",
        borderRadius: "10px",
        boxShadow: "0 0 15px #000"
      }}>
        <input
          placeholder="🔤 Title"
          value={form.title}
          onChange={e => setForm({ ...form, title: e.target.value })}
          style={{
            width: "100%",
            padding: "10px",
            marginBottom: "10px",
            borderRadius: "5px",
            backgroundColor: "#1e1e1e",
            color: "#fff",
            border: "1px solid #444"
          }}
        />
        <textarea
          placeholder="📝 Description"
          value={form.description}
          onChange={e => setForm({ ...form, description: e.target.value })}
          style={{
            width: "100%",
            height: "100px",
            padding: "10px",
            marginBottom: "10px",
            borderRadius: "5px",
            backgroundColor: "#1e1e1e",
            color: "#fff",
            border: "1px solid #444"
          }}
        />
        <select
          value={form.label}
          onChange={e => setForm({ ...form, label: e.target.value })}
          style={{
            width: "100%",
            padding: "10px",
            marginBottom: "10px",
            borderRadius: "5px",
            backgroundColor: "#1e1e1e",
            color: "#fff",
            border: "1px solid #444"
          }}
        >
          <option value="task">🗂️ Task</option>
          <option value="bug">🐞 Bug</option>
          <option value="feature">🌟 Feature</option>
          <option value="urgent">🚨 Urgent</option>
        </select>
        <input
          type="email"
          placeholder="📧 Assign to (email)"
          value={form.assigned_to}
          onChange={e => setForm({ ...form, assigned_to: e.target.value })}
          style={{
            width: "100%",
            padding: "10px",
            marginBottom: "10px",
            borderRadius: "5px",
            backgroundColor: "#1e1e1e",
            color: "#fff",
            border: "1px solid #444"
          }}
        />
        <button
          type="submit"
          disabled={loading}
          style={{
            width: "100%",
            backgroundColor: "#27ae60",
            color: "white",
            padding: "10px",
            border: "none",
            borderRadius: "5px",
            fontWeight: "bold",
            cursor: "pointer"
          }}
        >
          {loading ? "Adding..." : "➕ Add Issue"}
        </button>
      </form>

      {/* Filter */}
      <div style={{ marginTop: "20px", marginBottom: "10px" }}>
        <label style={{ fontWeight: "bold" }}>📌 Filter by Status: </label>
        <select
          value={filter}
          onChange={e => setFilter(e.target.value)}
          style={{
            marginLeft: "10px",
            padding: "6px",
            borderRadius: "5px",
            backgroundColor: "#1e1e1e",
            color: "#fff",
            border: "1px solid #444"
          }}
        >
          <option value="all">All</option>
          <option value="open">Open</option>
          <option value="closed">Closed</option>
        </select>
      </div>

      {/* Issues */}
      <h2>🗒️ Issue List</h2>
      {loading ? (
        <p>🔄 Loading issues...</p>
      ) : issues.length === 0 ? (
        <p>🎉 No issues found.</p>
      ) : (
        issues
          .filter(issue =>
            filter === "all" ||
            (filter === "open" && issue.status === "open") ||
            (filter === "closed" && issue.status === "closed")
          )
          .map(issue => (
            <div key={issue.id} style={{
              backgroundColor: "#34495e",
              margin: "10px 0",
              padding: "15px",
              borderRadius: "8px"
            }}>
              <h3 style={{ color: "#1abc9c" }}>{issue.title}</h3>
              <p>{issue.description}</p>
              <p>
                <strong style={{ color: labelColor[issue.label] }}>
                  🏷️ {issue.label}
                </strong>{" "}
                | 👤 {issue.assigned_to}
              </p>
              <p>
                Status:{" "}
                <span style={{
                  fontWeight: "bold",
                  color: issue.status === "open" ? "#2ecc71" : "#e74c3c"
                }}>
                  {issue.status.toUpperCase()}
                </span>
              </p>
              <div style={{ marginTop: "10px" }}>
                <button
                  onClick={async () => {
                    await axios.patch(
                      `https://devtrack-backend-758s.onrender.com/issues/${issue.id}/close`,
                      {},
                      {
                        headers: { Authorization: `Bearer ${token}` }
                      }
                    );
                    alert("Status toggled");
                    fetchIssues();
                  }}
                  style={{
                    backgroundColor: "#3498db",
                    color: "#fff",
                    border: "none",
                    padding: "6px 12px",
                    marginRight: "10px",
                    borderRadius: "5px"
                  }}
                >
                  Mark as {issue.status === "open" ? "Closed" : "Open"}
                </button>
                <button
                  onClick={async () => {
                    if (window.confirm("Are you sure to delete this issue?")) {
                      await axios.delete(
                        `https://devtrack-backend-758s.onrender.com/issues/${issue.id}`,
                        {
                          headers: { Authorization: `Bearer ${token}` }
                        }
                      );
                      alert("Deleted");
                      fetchIssues();
                    }
                  }}
                  style={{
                    backgroundColor: "#c0392b",
                    color: "#fff",
                    border: "none",
                    padding: "6px 12px",
                    borderRadius: "5px"
                  }}
                >
                  🗑️ Delete
                </button>
              </div>
            </div>
          ))
      )}

      {/* Pagination */}
      <div style={{ marginTop: "20px", textAlign: "center" }}>
        <button
          onClick={() => setPage(prev => Math.max(prev - 1, 1))}
          disabled={page === 1}
          style={{
            padding: "8px",
            marginRight: "10px",
            backgroundColor: "#95a5a6",
            border: "none",
            borderRadius: "4px",
            cursor: page === 1 ? "not-allowed" : "pointer"
          }}
        >
          ⬅ Prev
        </button>
        <span>
          Page <strong>{page}</strong> of {totalPages}
        </span>
        <button
          onClick={() => setPage(prev => (page < totalPages ? prev + 1 : prev))}
          disabled={page >= totalPages}
          style={{
            padding: "8px",
            marginLeft: "10px",
            backgroundColor: "#95a5a6",
            border: "none",
            borderRadius: "4px",
            cursor: page >= totalPages ? "not-allowed" : "pointer"
          }}
        >
          Next ➡
        </button>
      </div>
    </div>
  );
}
