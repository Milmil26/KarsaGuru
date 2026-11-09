// Tombol lihat/sembunyikan kata sandi
document.querySelectorAll("[data-toggle-password]").forEach(button => {
  button.addEventListener("click", () => {
    const input = document.getElementById(button.dataset.togglePassword);
    if (!input) return;
    const visible = input.type === "password";
    input.type = visible ? "text" : "password";
    button.textContent = visible ? "Sembunyikan" : "Lihat";
  });
});

const loginForm = document.getElementById("loginForm");
const registerForm = document.getElementById("registerForm");
const message = document.getElementById("formMessage");

function showMessage(text, isError = false) {
  message.textContent = text;
  message.style.color = isError ? "#C0392B" : "";
}

function friendlyError(error) {
  const text = (error.message || "").toLowerCase();
  if (text.includes("invalid login credentials")) return "Email atau kata sandi salah.";
  if (text.includes("email not confirmed")) return "Email belum dikonfirmasi. Cek kotak masukmu.";
  if (text.includes("already registered")) return "Email ini sudah terdaftar. Coba masuk.";
  if (text.includes("password")) return "Kata sandi minimal 8 karakter.";
  if (text.includes("rate limit")) return "Terlalu banyak percobaan. Coba lagi sebentar.";
  return "Terjadi kendala. Coba lagi.";
}

async function withLoading(form, task) {
  const button = form.querySelector("button[type=submit]");
  const label = button.textContent;
  button.disabled = true;
  button.textContent = "Memproses...";
  try {
    await task();
  } finally {
    button.disabled = false;
    button.textContent = label;
  }
}

// Sudah login? langsung ke dashboard
db.auth.getSession().then(({ data }) => {
  if (data.session) location.replace("dashboard.html");
});

if (loginForm) {
  loginForm.addEventListener("submit", event => {
    event.preventDefault();
    withLoading(loginForm, async () => {
      showMessage("");
      const { error } = await db.auth.signInWithPassword({
        email: loginForm.email.value.trim(),
        password: loginForm.password.value
      });
      if (error) return showMessage(friendlyError(error), true);
      location.href = "dashboard.html";
    });
  });
}

if (registerForm) {
  registerForm.addEventListener("submit", event => {
    event.preventDefault();
    withLoading(registerForm, async () => {
      showMessage("");
      const { data, error } = await db.auth.signUp({
        email: registerForm.email.value.trim(),
        password: registerForm.password.value,
        options: { data: { full_name: registerForm.fullName.value.trim() } }
      });
      if (error) return showMessage(friendlyError(error), true);
      if (data.session) {
        location.href = "dashboard.html";
      } else {
        showMessage("Akun dibuat. Cek email untuk konfirmasi, lalu masuk.");
        registerForm.reset();
      }
    });
  });
}

const forgotLink = document.getElementById("forgotLink");
if (forgotLink && loginForm) {
  forgotLink.addEventListener("click", async event => {
    event.preventDefault();
    const email = loginForm.email.value.trim();
    if (!email) return showMessage("Isi emailmu dulu, lalu klik Lupa kata sandi lagi.", true);
    showMessage("Mengirim tautan...");
    const { error } = await db.auth.resetPasswordForEmail(email, {
      redirectTo: new URL("reset-password.html", location.href).href
    });
    if (error) return showMessage(friendlyError(error), true);
    showMessage("Tautan reset dikirim. Cek emailmu.");
  });
}
