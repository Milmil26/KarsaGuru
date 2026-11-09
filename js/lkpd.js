const BUCKET = "teacher-files";
const MAX_FILE_BYTES = 10 * 1024 * 1024;
const IMAGE_MIME = { png: "image/png", jpg: "image/jpeg", jpeg: "image/jpeg", webp: "image/webp" };

const STATUS_LABEL = {
  draft: ["Draf", "chip-draft"],
  generating: ["Diproses", "chip-processing"],
  ready: ["Siap", "chip-ready"],
  failed: ["Gagal", "chip-failed"]
};

let userId = null;
let state = null;
let modules = [];

function setMessage(text, isError = false) {
  const node = $("itemMessage");
  node.textContent = text;
  node.style.color = isError ? "#B3382A" : "";
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
}

async function loadList() {
  $("listStatus").textContent = "Memuat...";
  $("listStatus").hidden = false;
  const rows = must(await db
    .from("worksheets")
    .select("id, title, status, updated_at, content, module:teaching_modules(title)")
    .order("updated_at", { ascending: false }));

  const list = $("itemList");
  list.replaceChildren();
  if (!rows.length) {
    $("listStatus").replaceChildren(modules.length
      ? "Belum ada LKPD. Klik Buat LKPD untuk mulai."
      : el("span", {}, "LKPD dibuat untuk sebuah modul. ", el("a", { href: "modul.html", class: "text-link", text: "Buat modul dulu" }), "."));
    return;
  }
  $("listStatus").hidden = true;
  rows.forEach(row => list.append(renderCard(row)));
}

function renderCard(row) {
  const [statusText, statusClass] = STATUS_LABEL[row.status] || STATUS_LABEL.draft;
  return el("article", { class: "atp-card" },
    el("div", { class: "atp-card-main" },
      el("h3", { text: row.title }),
      el("p", { text: row.module ? `Modul: ${row.module.title}` : "" }),
      el("small", { text: `Diperbarui ${formatDate(row.updated_at)}` })
    ),
    el("span", { class: `chip ${statusClass}`, text: statusText }),
    el("div", { class: "atp-card-actions" },
      el("button", { class: "button button-quiet", type: "button", text: "Buka", onclick: () => openEditor(row.id) }),
      el("a", { class: "button button-quiet", href: `cetak.html?type=lkpd&id=${row.id}`, text: "Cetak" }),
      el("button", { class: "icon-danger", type: "button", "aria-label": `Hapus ${row.title}`, text: "Hapus", onclick: () => removeItem(row) })
    )
  );
}

async function removeItem(row) {
  if (!confirm(`Hapus LKPD "${row.title}"?`)) return;
  try {
    must(await db.from("worksheets").delete().eq("id", row.id));
    const cover = row.content && row.content.cover_path;
    if (cover) await db.storage.from(BUCKET).remove([cover]);
    showToast("LKPD dihapus.");
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
  $("itemCover").value = "";
  state = { id: null, texts: {}, coverPath: null, coverFile: null, removeCover: false };

  try {
    if (id) {
      const row = must(await db.from("worksheets").select("*").eq("id", id).single());
      state.id = row.id;
      state.texts = { ...((row.content && row.content.sections) || {}) };
      state.coverPath = (row.content && row.content.cover_path) || null;
      $("itemTheme").value = (row.content && row.content.theme) || LKPD_THEMES[0].key;
      $("editorTitle").textContent = "Edit LKPD";
      $("itemTitle").value = row.title;
      $("itemModule").value = row.module_id;
      $("itemStatus").value = row.status === "ready" ? "ready" : "draft";
    } else {
      $("editorTitle").textContent = "LKPD baru";
      if (presetModuleId && modules.some(m => m.id === presetModuleId)) {
        $("itemModule").value = presetModuleId;
      }
    }
  } catch (error) {
    console.error(error);
    showToast("Gagal membuka LKPD.");
    return;
  }
  renderCover();
  renderSections();
  showEditor();
}

// ---------- gambar sampul ----------
function fillThemes() {
  $("itemTheme").replaceChildren(...LKPD_THEMES.map(t => el("option", { value: t.key, text: t.label })));
}
function renderCover() {
  const info = $("coverInfo");
  info.replaceChildren();
  $("coverPreview").replaceChildren();
  if (state.coverFile) {
    info.append(`Akan diunggah: ${state.coverFile.name}`);
  } else if (state.coverPath && !state.removeCover) {
    info.append(
      `Terlampir: ${shownFileName(state.coverPath)} `,
      el("button", { type: "button", class: "text-link", text: "Hapus gambar", onclick: () => { state.removeCover = true; renderCover(); } })
    );
    showCoverPreview(state.coverPath);
  } else if (state.removeCover) {
    info.append("Gambar akan dihapus saat disimpan.");
  }
}
async function showCoverPreview(path) {
  const { data, error } = await db.storage.from(BUCKET).createSignedUrl(path, 300);
  if (error || state.coverPath !== path || state.removeCover || state.coverFile) return;
  $("coverPreview").replaceChildren(el("img", { src: data.signedUrl, alt: "Pratinjau sampul LKPD" }));
}

function renderSections() {
  const box = $("sectionList");
  box.replaceChildren();
  LKPD_SECTIONS.forEach(section => {
    const area = el("textarea", { rows: "6", "aria-label": section.label });
    area.value = state.texts[section.key] || "";
    const badge = el("span", { class: "comp-badge", text: "Terisi" });
    badge.hidden = !area.value.trim();
    area.addEventListener("input", () => {
      state.texts[section.key] = area.value;
      badge.hidden = !area.value.trim();
    });
    box.append(el("details", { class: "comp" },
      el("summary", {}, el("span", { text: section.label }), badge),
      el("div", { class: "comp-body" }, el("p", { class: "hint", text: section.hint }), area)
    ));
  });
}

// ---------- isi dari modul (tanpa AI) ----------
// Menyalin TP dan bagian yang cocok dari modul ke bagian LKPD yang masih kosong.
const MODULE_TO_LKPD = [
  { section: "informasi", keys: ["bahan_bacaan"] },
  { section: "alat_bahan", keys: ["sarana_prasarana"] },
  { section: "kegiatan", keys: ["kegiatan_inti", "kegiatan_pembelajaran"] },
  { section: "soal", keys: ["pertanyaan_pemantik"] }
];

async function fillFromModule() {
  setMessage("");
  const moduleId = $("itemModule").value;
  if (!moduleId) return setMessage("Pilih modul dulu.", true);
  const button = $("fromModuleButton");
  button.disabled = true;
  try {
    const links = must(await db.from("module_objectives").select("learning_objective_id").eq("module_id", moduleId));
    const ids = links.map(l => l.learning_objective_id);
    const tps = ids.length
      ? must(await db.from("learning_objectives").select("objective_text, sequence_order")
          .in("id", ids).order("sequence_order")).map(o => o.objective_text)
      : [];
    const comps = must(await db.from("module_components").select("component_key, content").eq("module_id", moduleId));
    const byKey = {};
    comps.forEach(c => (byKey[c.component_key] = (c.content && c.content.text) || ""));

    const filled = [];
    const put = (key, text) => {
      if (text && text.trim() && !(state.texts[key] || "").trim()) {
        state.texts[key] = text.trim();
        filled.push(key);
      }
    };
    put("tujuan", tps.map((t, i) => `${i + 1}. ${t}`).join("\n"));
    MODULE_TO_LKPD.forEach(m => {
      const key = m.keys.find(k => (byKey[k] || "").trim());
      if (key) put(m.section, byKey[key]);
    });
    if (!filled.length) return setMessage("Tidak ada bagian kosong yang bisa diisi dari modul ini.", true);

    renderSections();
    const labels = filled.map(k => LKPD_SECTIONS.find(s => s.key === k).label).join(", ");
    setMessage(`Terisi dari modul: ${labels}. Sesuaikan untuk siswa, lalu klik Simpan.`);
  } catch (error) {
    console.error(error);
    setMessage("Gagal membaca modul. Coba lagi.", true);
  } finally {
    button.disabled = false;
  }
}

// ---------- draf AI ----------
async function generateDraft() {
  setMessage("");
  const title = $("itemTitle").value.trim();
  const moduleId = $("itemModule").value;
  if (!title) return setMessage("Isi judul LKPD dulu.", true);
  if (!moduleId) return setMessage("Pilih modul dulu.", true);

  const empty = LKPD_SECTIONS.filter(s => s.key !== "identitas" && !(state.texts[s.key] || "").trim());
  if (!empty.length) return setMessage("Semua bagian sudah terisi. Kosongkan yang mau dibuat AI.", true);

  const existing = {};
  LKPD_SECTIONS.forEach(s => {
    const text = (state.texts[s.key] || "").trim();
    if (text) existing[s.key] = text;
  });

  await withAiButton($("aiButton"), async () => {
    try {
      const mod = must(await db.from("teaching_modules")
        .select("title, topic, grade, phase:phases(name), subject:subjects(name)").eq("id", moduleId).single());
      const picked = must(await db.from("module_objectives").select("learning_objective_id").eq("module_id", moduleId));
      const ids = picked.map(p => p.learning_objective_id);
      const tps = ids.length
        ? must(await db.from("learning_objectives").select("objective_text, sequence_order")
            .in("id", ids).order("sequence_order")).map(o => o.objective_text)
        : [];
      if (!tps.length) {
        return setMessage("Modul ini belum punya TP. Pilih TP di halaman Modul Ajar dulu.", true);
      }

      const result = await requestDraft({
        kind: "lkpd",
        context: {
          title,
          topic: mod.topic || mod.title,
          phase: mod.phase && mod.phase.name,
          subject: mod.subject && mod.subject.name,
          grade: mod.grade ? `Kelas ${mod.grade}` : "",
          objectives: tps
        },
        keys: empty.map(({ key, label, hint }) => ({ key, label, hint })),
        existing
      });
      let filled = 0;
      empty.forEach(s => {
        const text = result.sections && result.sections[s.key];
        if (typeof text === "string" && text.trim() && !(state.texts[s.key] || "").trim()) {
          state.texts[s.key] = text.trim();
          filled++;
        }
      });
      renderSections();
      setMessage(result.partial
        ? `Draf terisi di ${filled} dari ${empty.length} bagian. Klik tombol AI lagi untuk melengkapi sisanya.${refNote(result)}`
        : `Draf terisi di ${filled} bagian. Periksa dan revisi dulu, lalu klik Simpan.${refNote(result)}`);
    } catch (error) {
      console.error(error);
      setMessage(error.message || "Gagal membuat draf. Coba lagi.", true);
    }
  });
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
  if (!title) return setMessage("Isi judul LKPD dulu.", true);
  if (!moduleId) return setMessage("Pilih modul dulu.", true);

  setBusy(true);
  let uploadedPath = null;
  let rowWritten = false;
  try {
    let coverPath = state.removeCover ? null : state.coverPath;
    if (state.coverFile) {
      uploadedPath = `${userId}/lkpd/${crypto.randomUUID()}-${safeName(state.coverFile.name)}`;
      const { error } = await db.storage.from(BUCKET)
        .upload(uploadedPath, state.coverFile, { contentType: IMAGE_MIME[fileExt(state.coverFile.name)] });
      if (error) throw error;
      coverPath = uploadedPath;
    }
    const sections = {};
    LKPD_SECTIONS.forEach(section => {
      const text = (state.texts[section.key] || "").trim();
      if (text) sections[section.key] = text;
    });
    const payload = {
      title,
      module_id: moduleId,
      status: $("itemStatus").value,
      content: { sections, theme: $("itemTheme").value || LKPD_THEMES[0].key, ...(coverPath ? { cover_path: coverPath } : {}) }
    };
    if (state.id) {
      must(await db.from("worksheets").update(payload).eq("id", state.id));
    } else {
      const created = must(await db.from("worksheets")
        .insert({ ...payload, user_id: userId }).select("id").single());
      state.id = created.id;
    }
    rowWritten = true;
    const oldPath = state.coverPath;
    if (oldPath && oldPath !== coverPath) await db.storage.from(BUCKET).remove([oldPath]);
    state.coverPath = coverPath;
    state.coverFile = null;
    state.removeCover = false;
    showToast("LKPD tersimpan.");
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
$("aiButton").addEventListener("click", generateDraft);
$("fromModuleButton").addEventListener("click", fillFromModule);
$("itemCover").addEventListener("change", event => {
  const file = event.target.files[0];
  if (!file) {
    state.coverFile = null;
  } else if (!IMAGE_MIME[fileExt(file.name)]) {
    event.target.value = "";
    state.coverFile = null;
    setMessage("Gambar harus PNG, JPG, atau WebP.", true);
  } else if (file.size > MAX_FILE_BYTES) {
    event.target.value = "";
    state.coverFile = null;
    setMessage("Ukuran gambar maksimal 10 MB.", true);
  } else {
    state.coverFile = file;
    state.removeCover = false;
    setMessage("");
  }
  renderCover();
});

// ---------- mulai ----------
(async () => {
  const { session } = await appReady;
  userId = session.user.id;
  fillThemes();
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