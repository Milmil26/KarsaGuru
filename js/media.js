const BUCKET = "teacher-files";
const MAX_FILE_BYTES = 10 * 1024 * 1024;
const MIME_BY_EXT = {
  pdf: "application/pdf",
  doc: "application/msword",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  pptx: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  webp: "image/webp"
};
const IMAGE_EXT = ["png", "jpg", "jpeg", "webp"];

let userId = null;
let state = null;
let modules = [];

function setMessage(text, isError = false) {
  const node = $("itemMessage");
  node.textContent = text;
  node.style.color = isError ? "#B3382A" : "";
}
function typeLabel(key) {
  const type = MEDIA_TYPES.find(t => t.key === key);
  return type ? type.label : key;
}

// ---------- data ----------
async function loadModules() {
  modules = must(await db
    .from("teaching_modules")
    .select("id, title, grade, subject:subjects(name)")
    .order("updated_at", { ascending: false }));
  fillSelect($("itemModule"), modules.map(m => ({
    id: m.id,
    label: [m.title, m.subject && m.subject.name, m.grade && `Kelas ${m.grade}`].filter(Boolean).join(" · ")
  })), "Pilih modul");
  fillSelect($("itemType"), MEDIA_TYPES.map(t => ({ id: t.key, label: t.label })), "Pilih jenis media");
}

async function loadList() {
  $("listStatus").textContent = "Memuat...";
  $("listStatus").hidden = false;
  const rows = must(await db
    .from("learning_media")
    .select("id, title, media_type, storage_path, content, updated_at, module:teaching_modules(title)")
    .order("updated_at", { ascending: false }));

  const list = $("itemList");
  list.replaceChildren();
  if (!rows.length) {
    $("listStatus").replaceChildren(modules.length
      ? "Belum ada media. Klik Buat media untuk mulai."
      : el("span", {}, "Media dibuat untuk sebuah modul. ", el("a", { href: "modul.html", class: "text-link", text: "Buat modul dulu" }), "."));
    return;
  }
  $("listStatus").hidden = true;
  rows.forEach(row => list.append(renderCard(row)));
}

function renderCard(row) {
  const extras = [];
  if (row.storage_path) extras.push("File terlampir");
  if (row.content && row.content.link) extras.push("Ada tautan");
  const meta = [typeLabel(row.media_type), row.module && row.module.title, ...extras].filter(Boolean).join(" · ");
  return el("article", { class: "atp-card" },
    el("div", { class: "atp-card-main" },
      el("h3", { text: row.title }),
      el("p", { text: meta }),
      el("small", { text: `Diperbarui ${formatDate(row.updated_at)}` })
    ),
    el("div", { class: "atp-card-actions" },
      el("button", { class: "button button-quiet", type: "button", text: "Buka", onclick: () => openEditor(row.id) }),
      el("button", { class: "icon-danger", type: "button", "aria-label": `Hapus ${row.title}`, text: "Hapus", onclick: () => removeItem(row) })
    )
  );
}

async function removeItem(row) {
  if (!confirm(`Hapus media "${row.title}"?`)) return;
  try {
    must(await db.from("learning_media").delete().eq("id", row.id));
    if (row.storage_path) await db.storage.from(BUCKET).remove([row.storage_path]);
    showToast("Media dihapus.");
    await loadList();
  } catch (error) {
    console.error(error);
    showToast("Gagal menghapus. Coba lagi.");
  }
}

// ---------- tampilan ----------
function showList() {
  $("editorView").hidden = true;
  $("listView").hidden = false;
  window.scrollTo({ top: 0 });
}
function showEditor() {
  $("listView").hidden = true;
  $("editorView").hidden = false;
  window.scrollTo({ top: 0 });
}

// ---------- editor ----------
async function openEditor(id, presetModuleId) {
  if (!id && !modules.length) {
    return showToast("Buat modul dulu di halaman Modul Ajar.");
  }
  setMessage("");
  $("itemForm").reset();
  $("itemFile").value = "";
  state = { id: null, file: null, filePath: null, removeFile: false };

  try {
    if (id) {
      const row = must(await db.from("learning_media").select("*").eq("id", id).single());
      state.id = row.id;
      state.filePath = row.storage_path;
      $("editorTitle").textContent = "Edit media";
      $("itemTitle").value = row.title;
      $("itemModule").value = row.module_id;
      $("itemType").value = row.media_type;
      $("itemDescription").value = (row.content && row.content.description) || "";
      $("itemLink").value = (row.content && row.content.link) || "";
    } else {
      $("editorTitle").textContent = "Media baru";
      if (presetModuleId && modules.some(m => m.id === presetModuleId)) {
        $("itemModule").value = presetModuleId;
      }
    }
  } catch (error) {
    console.error(error);
    showToast("Gagal membuka media.");
    return;
  }
  renderFile();
  showEditor();
}

function renderFile() {
  const info = $("fileInfo");
  info.replaceChildren();
  $("filePreview").replaceChildren();
  if (state.file) {
    info.append(`Akan diunggah: ${state.file.name}`);
  } else if (state.filePath && !state.removeFile) {
    info.append(
      `Terlampir: ${shownFileName(state.filePath)} `,
      el("button", { type: "button", class: "text-link", text: "Lihat", onclick: viewFile }),
      " · ",
      el("button", { type: "button", class: "text-link", text: "Hapus lampiran", onclick: () => { state.removeFile = true; renderFile(); } })
    );
    if (IMAGE_EXT.includes(fileExt(state.filePath))) showPreview(state.filePath);
  } else if (state.removeFile) {
    info.append("Lampiran akan dihapus saat disimpan.");
  }
}
async function showPreview(path) {
  const { data, error } = await db.storage.from(BUCKET).createSignedUrl(path, 300);
  if (error || state.filePath !== path || state.removeFile || state.file) return;
  $("filePreview").replaceChildren(el("img", { src: data.signedUrl, alt: "Pratinjau media" }));
}
async function viewFile() {
  const { data, error } = await db.storage.from(BUCKET).createSignedUrl(state.filePath, 60);
  if (error) return showToast("Gagal membuka file.");
  window.open(data.signedUrl, "_blank", "noopener");
}

// ---------- simpan ----------
function setBusy(busy) {
  const button = $("saveButton");
  button.disabled = busy;
  button.textContent = busy ? "Menyimpan..." : "Simpan";
}

async function save(event) {
  event.preventDefault();
  setMessage("");
  const title = $("itemTitle").value.trim();
  const moduleId = $("itemModule").value;
  const mediaType = $("itemType").value;
  const link = $("itemLink").value.trim();
  if (!title) return setMessage("Isi judul media dulu.", true);
  if (!moduleId) return setMessage("Pilih modul dulu.", true);
  if (!mediaType) return setMessage("Pilih jenis media dulu.", true);
  if (link && !/^https?:\/\/\S+$/i.test(link)) return setMessage("Tautan harus diawali http:// atau https://.", true);

  setBusy(true);
  let uploadedPath = null;
  let rowWritten = false;
  try {
    let storagePath = state.removeFile ? null : state.filePath;
    if (state.file) {
      uploadedPath = `${userId}/media/${crypto.randomUUID()}-${safeName(state.file.name)}`;
      const { error } = await db.storage.from(BUCKET)
        .upload(uploadedPath, state.file, { contentType: MIME_BY_EXT[fileExt(state.file.name)] });
      if (error) throw error;
      storagePath = uploadedPath;
    }

    const content = {};
    const description = $("itemDescription").value.trim();
    if (description) content.description = description;
    if (link) content.link = link;

    const payload = { title, module_id: moduleId, media_type: mediaType, content, storage_path: storagePath };
    if (state.id) {
      must(await db.from("learning_media").update(payload).eq("id", state.id));
    } else {
      const created = must(await db.from("learning_media")
        .insert({ ...payload, user_id: userId }).select("id").single());
      state.id = created.id;
    }
    rowWritten = true;

    const oldPath = state.filePath;
    if (oldPath && oldPath !== storagePath) {
      await db.storage.from(BUCKET).remove([oldPath]);
    }
    state.filePath = storagePath;
    state.file = null;
    state.removeFile = false;

    showToast("Media tersimpan.");
    showList();
    await loadList();
  } catch (error) {
    console.error(error);
    if (uploadedPath && !rowWritten) await db.storage.from(BUCKET).remove([uploadedPath]);
    setMessage("Gagal menyimpan. Coba lagi.", true);
  } finally {
    setBusy(false);
  }
}

// ---------- event ----------
$("newButton").addEventListener("click", () => openEditor(null));
$("backButton").addEventListener("click", showList);
$("cancelButton").addEventListener("click", showList);
$("itemForm").addEventListener("submit", save);
$("itemFile").addEventListener("change", event => {
  const file = event.target.files[0];
  if (!file) {
    state.file = null;
  } else if (!MIME_BY_EXT[fileExt(file.name)]) {
    event.target.value = "";
    state.file = null;
    setMessage("Jenis file belum didukung. Pakai PDF, Word, PowerPoint, atau gambar.", true);
  } else if (file.size > MAX_FILE_BYTES) {
    event.target.value = "";
    state.file = null;
    setMessage("Ukuran file maksimal 10 MB.", true);
  } else {
    state.file = file;
    state.removeFile = false;
    setMessage("");
  }
  renderFile();
});

// ---------- mulai ----------
(async () => {
  const { session } = await appReady;
  userId = session.user.id;
  try {
    await loadModules();
    await loadList();
    const preset = new URLSearchParams(location.search).get("modul");
    if (preset) openEditor(null, preset);
    const openId = new URLSearchParams(location.search).get("buka");
    if (openId) await openEditor(openId);
  } catch (error) {
    console.error(error);
    $("listStatus").textContent = "Gagal memuat data. Muat ulang halaman.";
  }
})();