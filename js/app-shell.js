// Bagian bersama untuk semua halaman setelah login (dashboard, ATP, dst).
// Urutan script: supabase CDN > supabase-config.js > app-shell.js > skrip halaman.
const sidebar = document.getElementById("sidebar");
const sidebarToggle = document.getElementById("sidebarToggle");
const toast = document.getElementById("toast");
let toastTimer;

function showToast(message) {
  if (!toast) return;
  toast.textContent = message;
  toast.classList.add("show");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.classList.remove("show"), 2600);
}

function setText(id, text) {
  const node = document.getElementById(id);
  if (node) node.textContent = text;
}

// Resolve dengan { session, profile } kalau sudah login. Kalau belum, diarahkan ke login.
const appReady = (async () => {
  const { data: { session } } = await db.auth.getSession();
  if (!session) {
    location.replace("login.html");
    return new Promise(() => {});
  }

  const { data: profile } = await db
    .from("profiles")
    .select("full_name, role")
    .eq("id", session.user.id)
    .single();

  const fullName = (profile && profile.full_name) || session.user.email.split("@")[0];
  const firstName = fullName.split(" ")[0];
  const initial = fullName.charAt(0).toUpperCase();

  setText("welcomeName", `Halo, ${firstName}!`);
  setText("profileName", fullName);
  setText("profileRole", profile && profile.role === "admin" ? "Admin" : "Guru");
  document.querySelectorAll(".profile-avatar, .top-avatar").forEach(el => (el.textContent = initial));

  return { session, profile };
})();

// Keluar
const logoutButton = document.getElementById("logoutButton");
if (logoutButton) {
  logoutButton.addEventListener("click", async event => {
    event.preventDefault();
    await db.auth.signOut();
    location.replace("login.html");
  });
}

// Menu yang belum jadi
document.querySelectorAll(".demo-nav, .demo-card").forEach(item => {
  item.addEventListener("click", event => {
    event.preventDefault();
    showToast("Fitur ini segera hadir.");
  });
});

// Sidebar di HP
if (sidebarToggle && sidebar) {
  sidebarToggle.addEventListener("click", () => sidebar.classList.toggle("open"));
}
document.addEventListener("click", event => {
  if (window.innerWidth <= 700 && sidebar && sidebar.classList.contains("open") &&
      !sidebar.contains(event.target) && !(sidebarToggle && sidebarToggle.contains(event.target))) {
    sidebar.classList.remove("open");
  }
});