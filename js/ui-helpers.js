// Helper kecil yang dipakai halaman LKPD dan Media.
const $ = id => document.getElementById(id);

function el(tag, props = {}, ...children) {
  const node = document.createElement(tag);
  for (const [key, value] of Object.entries(props)) {
    if (key === "class") node.className = value;
    else if (key === "text") node.textContent = value;
    else if (key.startsWith("on")) node.addEventListener(key.slice(2), value);
    else node.setAttribute(key, value);
  }
  children.flat().forEach(child => child && node.append(child));
  return node;
}
function must({ data, error }) {
  if (error) throw error;
  return data;
}
function fillSelect(select, rows, placeholder) {
  select.replaceChildren(
    el("option", { value: "", text: placeholder }),
    ...rows.map(r => el("option", { value: r.id, text: r.label }))
  );
}
function formatDate(value) {
  return new Date(value).toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" });
}
function fileExt(name) {
  return (name.split(".").pop() || "").toLowerCase();
}
function safeName(name) {
  return name.replace(/[^a-zA-Z0-9._-]+/g, "-");
}
function shownFileName(path) {
  return path.split("/").pop().replace(/^[0-9a-f-]{36}-/, "");
}