// Halaman ini sengaja tidak memakai auth.js, karena auth.js melempar orang yang sudah punya sesi ke dashboard.
const form = document.getElementById("resetForm");
const message = document.getElementById("formMessage");

function showMessage(text, isError = false) {
  message.textContent = text;
  message.style.color = isError ? "#C0392B" : "";
}

document.querySelectorAll("[data-toggle-password]").forEach(button => {
  button.addEventListener("click", () => {
    const input = document.getElementById(button.dataset.togglePassword);
    const visible = input.type === "password";
    input.type = visible ? "text" : "password";
    button.textContent = visible ? "Sembunyikan" : "Lihat";
  });
});

let formShown = false;
function showForm() {
  if (formShown) return;
  formShown = true;
  form.hidden = false;
  showMessage("");
}

// Tautan dari email membuat sesi pemulihan; tampilkan form begitu sesi ada.
db.auth.onAuthStateChange(event => {
  if (event === "PASSWORD_RECOVERY") showForm();
});

(async () => {
  const { data } = await db.auth.getSession();
  if (data.session) return showForm();
  setTimeout(() => {
    if (!formShown) showMessage("Tautan tidak valid atau sudah kedaluwarsa. Minta tautan baru dari halaman masuk.", true);
  }, 2500);
})();

form.addEventListener("submit", async event => {
  event.preventDefault();
  const password = form.password.value;
  if (password.length < 8) return showMessage("Kata sandi minimal 8 karakter.", true);
  if (password !== form.confirm.value) return showMessage("Kedua kata sandi harus sama.", true);

  const button = form.querySelector("button[type=submit]");
  button.disabled = true;
  const { error } = await db.auth.updateUser({ password });
  button.disabled = false;
  if (error) return showMessage("Gagal menyimpan. Minta tautan baru lalu coba lagi.", true);
  showMessage("Kata sandi diperbarui. Mengalihkan ke dashboard...");
  setTimeout(() => location.replace("dashboard.html"), 1500);
});
