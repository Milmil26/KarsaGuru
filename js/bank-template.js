// Halaman Bank Template: cari, lihat, pakai, dan kelola template.
// Butuh: material-config.js (LKPD_SECTIONS, MEDIA_TYPES), app-shell.js (appReady, showToast), ui-helpers.js ($, el, must, fillSelect, formatDate), modul-komponen.js (MODULE_TEMPLATES)
const STATUS_CHIP = {
  draft: ["Pribadi", "chip-draft"],
  pending: ["Menunggu tinjauan", "chip-processing"],
  approved: ["Publik", "chip-ready"],
  rejected: ["Ditolak", "chip-failed"]
};

let me = null;
let isAdmin = false;
let all = [];
let levelNames = new Map();
let tab = "all";
let kind = "modul";
let myModules = [];
const KIND_LABEL = { modul: "Modul Ajar", lkpd: "LKPD", media: "Media" };
const PRIVATE_KEYS = { modul: ["identitas_modul"], lkpd: ["identitas"], media: [] };
let current = null;

// ---------- data ----------
// Filter "jenis": format dokumen untuk modul, jenis media untuk media, disembunyikan untuk LKPD.
function fillKeyFilter() {
  $("fKey").closest(".field").hidden = kind === "lkpd";
  if (kind === "modul") {
    fillSelect($("fKey"), Object.entries(MODULE_TEMPLATES).map(([id, t]) => ({ id, label: t.shortLabel })), "Semua jenis");
  } else if (kind === "media") {
    fillSelect($("fKey"), MEDIA_TYPES.map(t => ({ id: t.key, label: t.label })), "Semua jenis media");
  }
  $("fKey").value = "";
}
function formatLabel(t) {
  if (t.kind === "lkpd") return "LKPD";
  if (t.kind === "media") {
    const m = MEDIA_TYPES.find(x => x.key === t.media_type);
    return m ? m.label : "Media";
  }
  const f = MODULE_TEMPLATES[t.template_key];
  return f && f.shortLabel;
}
function componentLabels(t) {
  if (t.kind === "lkpd") return LKPD_SECTIONS.map(s => [s.key, s.label]);
  if (t.kind === "media") return [["deskripsi", "Deskripsi atau ide"], ["tautan", "Tautan"]];
  return ((MODULE_TEMPLATES[t.template_key] || {}).components || []).map(c => [c.key, c.label]);
}
async function loadReference() {
  const [levels, curriculums, subjects] = await Promise.all([
    db.from("education_levels").select("id, name").order("name").then(must),
    db.from("curriculums").select("id, name, version").order("name").then(must),
    db.from("subjects").select("id, name").order("name").then(must)
  ]);
  levels.forEach(l => levelNames.set(l.id, l.name));
  fillSelect($("fLevel"), levels.map(l => ({ id: l.id, label: l.name })), "Semua jenjang");
  fillSelect($("fCurriculum"), curriculums.map(c => ({ id: c.id, label: c.version ? `${c.name} ${c.version}` : c.name })), "Semua kurikulum");
  fillKeyFilter();
  fillSelect($("fSubject"), subjects.map(s => ({ id: s.id, label: s.name })), "Semua mapel");
  fillSelect($("useGrade"), Array.from({ length: 9 }, (_, i) => ({ id: String(i + 1), label: `Kelas ${i + 1}` })), "Pilih kelas");
}

async function loadTemplates() {
  all = must(await db.from("templates")
    .select("*, curriculum:curriculums(name, version), phase:phases(name), subject:subjects(name), levels:template_levels(education_level_id)")
    .order("updated_at", { ascending: false })
    .limit(500));
  render();
}

// ---------- tampilan daftar ----------
function matches(t) {
  if (t.kind !== kind) return false;
  const isPublic = t.visibility === "public";
  if (tab === "all" && !(isPublic && t.status === "approved")) return false;
  if (tab === "mine" && t.user_id !== me) return false;
  if (tab === "pending" && !(isPublic && t.status === "pending")) return false;

  const q = $("fQuery").value.trim().toLowerCase();
  if (q && !`${t.title} ${t.description || ""}`.toLowerCase().includes(q)) return false;
  const level = $("fLevel").value;
  if (level && !t.levels.some(l => l.education_level_id === level)) return false;
  if ($("fCurriculum").value && t.curriculum_id !== $("fCurriculum").value) return false;
  const key = $("fKey").value;
  if (key && (kind === "media" ? t.media_type !== key : t.template_key !== key)) return false;
  if ($("fSubject").value && t.subject_id !== $("fSubject").value) return false;
  return true;
}

function render() {
  const rows = all.filter(matches).sort((a, b) =>
    (b.is_verified - a.is_verified) || (b.use_count - a.use_count) || (new Date(b.updated_at) - new Date(a.updated_at)));
  const list = $("templateList");
  list.replaceChildren(...rows.map(renderCard));
  const status = $("listStatus");
  status.hidden = rows.length > 0;
  if (!rows.length) {
    status.textContent = tab === "mine"
      ? "Belum ada template. Buka modul, LKPD, atau media-mu, lalu klik Simpan sebagai template."
      : tab === "pending" ? "Tidak ada template yang menunggu tinjauan."
      : "Belum ada template yang cocok. Coba ubah filter.";
  }
}

function renderCard(t) {
  const curriculum = t.curriculum && (t.curriculum.version ? `${t.curriculum.name} ${t.curriculum.version}` : t.curriculum.name);
  const levels = t.levels.map(l => levelNames.get(l.education_level_id)).filter(Boolean).join(", ");
  const meta = [formatLabel(t), levels, curriculum, t.phase && t.phase.name, t.subject && t.subject.name]
    .filter(Boolean).join(" · ");
  const mine = t.user_id === me;
  const [statusText, statusClass] = t.visibility === "private" ? STATUS_CHIP.draft : STATUS_CHIP[t.status] || STATUS_CHIP.draft;

  const chips = el("div", { class: "bt-chips" });
  if (t.is_verified) chips.append(el("span", { class: "chip chip-ready", text: "Terverifikasi" }));
  if (mine || isAdmin) chips.append(el("span", { class: `chip ${statusClass}`, text: statusText }));

  const credit = [t.author_name && `oleh ${t.author_name}`, t.visibility === "public" && `dipakai ${t.use_count}×`]
    .filter(Boolean).join(" · ");

  const actions = el("div", { class: "atp-card-actions" },
    el("button", { class: "button button-quiet", type: "button", text: "Lihat dan pakai", onclick: () => openUse(t) }));
  if (mine) {
    actions.append(el("button", {
      class: "button button-quiet", type: "button",
      text: t.visibility === "public" ? "Jadikan pribadi" : "Bagikan",
      onclick: () => toggleVisibility(t)
    }));
    actions.append(el("button", { class: "icon-danger", type: "button", text: "Hapus", "aria-label": `Hapus ${t.title}`, onclick: () => removeTemplate(t) }));
  }
  if (isAdmin && t.visibility === "public") {
    if (t.status !== "approved") actions.append(el("button", { class: "button button-quiet", type: "button", text: "Setujui", onclick: () => adminSet(t, { status: "approved" }) }));
    if (t.status !== "rejected") actions.append(el("button", { class: "button button-quiet", type: "button", text: "Tolak", onclick: () => adminSet(t, { status: "rejected" }) }));
    if (t.status === "approved") actions.append(el("button", {
      class: "button button-quiet", type: "button",
      text: t.is_verified ? "Cabut verifikasi" : "Verifikasi",
      onclick: () => adminSet(t, { is_verified: !t.is_verified })
    }));
  }

  return el("article", { class: "atp-card" },
    el("div", { class: "atp-card-main" },
      el("h3", { text: t.title }),
      t.description ? el("p", { text: t.description }) : null,
      el("small", { text: meta || "Belum dilengkapi" }),
      credit ? el("small", { text: credit }) : null,
      chips),
    actions);
}

// ---------- aksi ----------
async function toggleVisibility(t) {
  const goingPublic = t.visibility !== "public";
  const text = goingPublic
    ? `Bagikan "${t.title}" ke guru lain?\n\nBagian "Identitas" akan dihapus dari template supaya data pribadimu tidak ikut. Template baru tampil di katalog setelah ditinjau. Pastikan isinya karyamu sendiri atau boleh dibagikan, dan tanpa nama siswa, sekolah, atau NIP.`
    : `Jadikan "${t.title}" pribadi lagi? Template ini hilang dari katalog.`;
  if (!confirm(text)) return;
  try {
    if (goingPublic) {
      const priv = PRIVATE_KEYS[t.kind] || [];
      if (priv.length) {
        must(await db.from("template_components").delete().eq("template_id", t.id).in("component_key", priv));
      }
    }
    must(await db.from("templates").update({ visibility: goingPublic ? "public" : "private" }).eq("id", t.id));
    showToast(goingPublic ? "Dikirim untuk ditinjau." : "Template sekarang pribadi.");
    await loadTemplates();
  } catch (error) {
    console.error(error);
    showToast("Gagal mengubah. Coba lagi.");
  }
}

async function removeTemplate(t) {
  if (!confirm(`Hapus template "${t.title}"? Modul yang sudah dibuat dari template ini tidak terpengaruh.`)) return;
  try {
    must(await db.from("templates").delete().eq("id", t.id));
    showToast("Template dihapus.");
    await loadTemplates();
  } catch (error) {
    console.error(error);
    showToast("Gagal menghapus. Coba lagi.");
  }
}

async function adminSet(t, patch) {
  try {
    must(await db.from("templates").update(patch).eq("id", t.id));
    showToast("Tersimpan.");
    await loadTemplates();
  } catch (error) {
    console.error(error);
    showToast("Gagal menyimpan. Coba lagi.");
  }
}

// ---------- dialog pakai template ----------
function useMessage(text, isError = false) {
  const node = $("useMessage");
  node.textContent = text;
  node.style.color = isError ? "#B3382A" : "";
}

async function openUse(t) {
  current = t;
  useMessage("");
  $("useHead").textContent = t.title;
  $("useMeta").textContent = [t.author_name && `Oleh ${t.author_name}`, t.kind === "modul" ? (MODULE_TEMPLATES[t.template_key] && MODULE_TEMPLATES[t.template_key].label) : KIND_LABEL[t.kind]]
    .filter(Boolean).join(" · ");
  $("useDesc").textContent = t.description || "";
  $("useName").value = t.title;
  $("useTopic").value = "";
  $("useGrade").value = "";
  const isModul = t.kind === "modul";
  $("useNameLabel").textContent = `Judul ${KIND_LABEL[t.kind].toLowerCase()}`;
  $("useTopicField").hidden = !isModul;
  $("useGradeField").hidden = !isModul;
  $("useModuleField").hidden = isModul;
  fillSelect($("useModule"), myModules.map(m => ({
    id: m.id,
    label: [m.title, m.subject && m.subject.name, m.grade && `Kelas ${m.grade}`].filter(Boolean).join(" · ")
  })), "Pilih modul");
  $("useModule").value = "";
  $("useSubmit").disabled = !isModul && !myModules.length;
  if (!isModul && !myModules.length) useMessage(`${KIND_LABEL[t.kind]} dibuat untuk sebuah modul. Buat modul dulu di halaman Modul Ajar.`, true);
  $("usePreview").replaceChildren(el("p", { class: "hint", text: "Memuat isi template..." }));
  $("useDialog").showModal();

  try {
    const comps = must(await db.from("template_components")
      .select("component_key, content, sequence_order").eq("template_id", t.id).order("sequence_order"));
    const labels = new Map(componentLabels(t));
    const filled = comps.filter(c => c.content && c.content.text && c.content.text.trim());
    $("usePreview").replaceChildren(...(filled.length
      ? filled.map(c => el("details", { class: "comp" },
          el("summary", {}, el("span", { text: labels.get(c.component_key) || c.component_key })),
          el("div", { class: "comp-body" }, el("p", { class: "bt-text", text: c.content.text }))))
      : [el("p", { class: "hint", text: "Template ini belum punya isi." })]));
  } catch (error) {
    console.error(error);
    $("usePreview").replaceChildren(el("p", { class: "hint", text: "Gagal memuat isi template." }));
  }
}

$("useForm").addEventListener("submit", async event => {
  event.preventDefault();
  if (!current) return;
  const t = current;
  const moduleId = $("useModule").value;
  if (t.kind !== "modul" && !moduleId) return useMessage("Pilih modul dulu.", true);
  const button = $("useSubmit");
  button.disabled = true;
  button.textContent = "Membuat...";
  useMessage("");
  try {
    const title = $("useName").value.trim() || null;
    let id;
    let page;
    if (t.kind === "lkpd") {
      id = must(await db.rpc("create_lkpd_from_template", { p_template_id: t.id, p_module_id: moduleId, p_title: title }));
      page = "lkpd.html";
    } else if (t.kind === "media") {
      id = must(await db.rpc("create_media_from_template", { p_template_id: t.id, p_module_id: moduleId, p_title: title }));
      page = "media.html";
    } else {
      id = must(await db.rpc("create_module_from_template", {
        p_template_id: t.id,
        p_title: title,
        p_topic: $("useTopic").value.trim() || null,
        p_grade: $("useGrade").value ? Number($("useGrade").value) : null
      }));
      page = "modul.html";
    }
    location.href = `${page}?buka=${encodeURIComponent(id)}`;
  } catch (error) {
    console.error(error);
    useMessage(`Gagal membuat ${KIND_LABEL[t.kind].toLowerCase()}. Coba lagi.`, true);
    button.disabled = false;
    button.textContent = "Pakai template ini";
  }
});
$("useCancel").addEventListener("click", () => $("useDialog").close());

// ---------- filter dan tab ----------
document.querySelectorAll(".bt-kind").forEach(button => {
  button.addEventListener("click", () => {
    kind = button.dataset.kind;
    document.querySelectorAll(".bt-kind").forEach(b => b.classList.toggle("active", b === button));
    fillKeyFilter();
    render();
  });
});
document.querySelectorAll(".bt-tab").forEach(button => {
  button.addEventListener("click", () => {
    tab = button.dataset.tab;
    document.querySelectorAll(".bt-tab").forEach(b => b.classList.toggle("active", b === button));
    render();
  });
});
["fLevel", "fCurriculum", "fKey", "fSubject"].forEach(id => $(id).addEventListener("change", render));
$("fQuery").addEventListener("input", render);

// ---------- mulai ----------
(async () => {
  const { session, profile } = await appReady;
  me = session.user.id;
  isAdmin = !!profile && profile.role === "admin";
  $("pendingTab").hidden = !isAdmin;
  try {
    await loadReference();
    await loadTemplates();
    // Modul milik pengguna: dibutuhkan untuk memakai template LKPD dan media
    try {
      myModules = must(await db.from("teaching_modules")
        .select("id, title, grade, subject:subjects(name)").order("updated_at", { ascending: false }));
    } catch (error) {
      console.warn("Daftar modul tidak terbaca", error);
    }
  } catch (error) {
    console.error(error);
    $("listStatus").hidden = false;
    $("listStatus").textContent = "Gagal memuat template. Pastikan bank-template.sql sudah dijalankan, lalu muat ulang.";
  }
})();
