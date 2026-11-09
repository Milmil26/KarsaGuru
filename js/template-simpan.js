// Tombol "Simpan sebagai template" untuk halaman Modul Ajar, LKPD, dan Media.
// Jenisnya dibaca dari atribut data-tpl-kind di <body> (modul, lkpd, atau media).
// Dimuat SETELAH skrip halamannya dan memakai variabelnya: $, el, must, state, userId, setMessage, showToast.
const TPL_KIND = document.body.dataset.tplKind || "modul";
let tplLevelsLoaded = false;
let tplIsAdmin = false;
let tplSource = null;

(async () => {
  const { profile } = await appReady;
  tplIsAdmin = !!profile && profile.role === "admin";
})();

async function moduleMeta(moduleId) {
  return must(await db.from("teaching_modules")
    .select("topic, curriculum_id, phase_id, subject_id").eq("id", moduleId).single());
}

// Tiap jenis menyiapkan: judul, topik (untuk diganti jadi {topik}), bagian isi, dan kolom tambahan templates.
// Mengembalikan { error } kalau belum layak disimpan.
const TPL_SOURCES = {
  modul: async () => {
    const title = $("modTitle").value.trim();
    if (!title) return { error: "Isi judul modul dulu sebelum disimpan sebagai template." };
    const comps = currentComponents();
    if (!comps.some(c => (state.texts[c.key] || "").trim())) {
      return { error: "Isi minimal satu komponen dulu supaya templatenya ada isinya." };
    }
    return {
      title,
      topic: $("modTopic").value.trim(),
      parts: comps.map((c, i) => ({ key: c.key, text: (state.texts[c.key] || "").trim(), order: i })),
      extra: {
        template_key: templateKey(),
        curriculum_id: $("modCurriculum").value || null,
        phase_id: $("modPhase").value || null,
        subject_id: $("modSubject").value || null
      },
      privateKeys: ["identitas_modul"]
    };
  },

  lkpd: async () => {
    const title = $("itemTitle").value.trim();
    if (!title) return { error: "Isi judul LKPD dulu sebelum disimpan sebagai template." };
    if (!$("itemModule").value) return { error: "Pilih modul dulu." };
    const parts = LKPD_SECTIONS.map((s, i) => ({ key: s.key, text: (state.texts[s.key] || "").trim(), order: i }));
    if (!parts.some(p => p.text)) return { error: "Isi minimal satu bagian dulu supaya templatenya ada isinya." };
    const meta = await moduleMeta($("itemModule").value);
    return {
      title,
      topic: meta.topic || "",
      parts,
      extra: { template_key: "lkpd", curriculum_id: meta.curriculum_id, phase_id: meta.phase_id, subject_id: meta.subject_id },
      privateKeys: ["identitas"]
    };
  },

  media: async () => {
    const title = $("itemTitle").value.trim();
    const description = $("itemDescription").value.trim();
    const link = $("itemLink").value.trim();
    if (!title) return { error: "Isi judul media dulu sebelum disimpan sebagai template." };
    if (!$("itemModule").value) return { error: "Pilih modul dulu." };
    if (!$("itemType").value) return { error: "Pilih jenis media dulu." };
    if (link && !/^https?:\/\/\S+$/i.test(link)) return { error: "Tautan harus diawali http:// atau https://." };
    if (!description && !link) return { error: "Isi deskripsi atau tautan dulu supaya templatenya ada isinya." };
    const meta = await moduleMeta($("itemModule").value);
    return {
      title,
      topic: meta.topic || "",
      parts: [{ key: "deskripsi", text: description, order: 0 }, { key: "tautan", text: link, order: 1 }],
      extra: {
        template_key: "media", media_type: $("itemType").value,
        curriculum_id: meta.curriculum_id, phase_id: meta.phase_id, subject_id: meta.subject_id
      },
      privateKeys: []
    };
  }
};

async function loadTplLevels() {
  if (tplLevelsLoaded) return;
  const levels = must(await db.from("education_levels").select("id, name").order("name"));
  $("tplLevels").replaceChildren(...levels.map(l =>
    el("label", {}, el("input", { type: "checkbox", value: l.id }), el("span", { text: l.name }))));
  tplLevelsLoaded = true;
}

function tplMessage(text, isError = false) {
  const node = $("tplMessage");
  node.textContent = text;
  node.style.color = isError ? "#B3382A" : "";
}
function tplVisibility() {
  return document.querySelector("input[name=tplVisibility]:checked").value;
}
function syncTplVisibility() {
  $("tplOwnWrap").hidden = tplVisibility() !== "public";
}

// Ganti topik yang diketik jadi {topik}, supaya template bisa dipakai untuk topik lain.
function toVariables(text, topic) {
  if (!topic || topic.length < 3) return text;
  return text.split(topic).join("{topik}");
}

async function openTemplateDialog() {
  setMessage("");
  try {
    tplSource = await TPL_SOURCES[TPL_KIND]();
  } catch (error) {
    console.error(error);
    return setMessage("Gagal menyiapkan template. Coba lagi.", true);
  }
  if (tplSource.error) return setMessage(tplSource.error, true);
  try {
    await loadTplLevels();
  } catch (error) {
    console.error(error);
    return setMessage("Gagal membuka dialog template. Pastikan bank-template.sql sudah dijalankan.", true);
  }
  tplMessage("");
  $("tplTitle").value = tplSource.title;
  $("tplDesc").value = "";
  $("tplNote").textContent = TPL_KIND === "media"
    ? "Hanya deskripsi dan tautan yang dibagikan. File lampiran tidak ikut."
    : "";
  $("tplLevels").querySelectorAll("input").forEach(i => (i.checked = false));
  document.querySelector("input[name=tplVisibility][value=private]").checked = true;
  $("tplOwn").checked = false;
  syncTplVisibility();
  $("tplDialog").showModal();
}

async function submitTemplate(event) {
  event.preventDefault();
  const title = $("tplTitle").value.trim();
  const visibility = tplVisibility();
  if (!title) return tplMessage("Isi judul template dulu.", true);
  if (visibility === "public" && !$("tplOwn").checked) {
    return tplMessage("Centang pernyataan bahwa isinya karyamu sendiri atau boleh dibagikan.", true);
  }

  const source = tplSource;
  const rows = source.parts
    .filter(p => p.text)
    .filter(p => !(visibility === "public" && source.privateKeys.includes(p.key))) // buang data pribadi
    .map(p => ({
      component_key: p.key,
      content: { text: p.key === "tautan" ? p.text : toVariables(p.text, source.topic) },
      sequence_order: p.order
    }));
  if (!rows.length) return tplMessage("Tidak ada isi yang bisa disimpan.", true);

  const button = $("tplSubmit");
  button.disabled = true;
  button.textContent = "Menyimpan...";
  let createdId = null;
  try {
    const official = tplIsAdmin && visibility === "public";
    const created = must(await db.from("templates").insert({
      user_id: userId,
      kind: TPL_KIND,
      title: toVariables(title, source.topic),
      description: $("tplDesc").value.trim() || null,
      ...source.extra,
      visibility,
      ...(official ? { status: "approved", is_verified: true } : {})
    }).select("id").single());
    createdId = created.id;

    must(await db.from("template_components").insert(rows.map(r => ({ ...r, template_id: createdId }))));
    const levelIds = [...$("tplLevels").querySelectorAll("input:checked")].map(i => i.value);
    if (levelIds.length) {
      must(await db.from("template_levels").insert(levelIds.map(id => ({ template_id: createdId, education_level_id: id }))));
    }

    $("tplDialog").close();
    showToast(visibility === "public" && !official
      ? "Template dikirim untuk ditinjau."
      : "Template tersimpan di Bank Template.");
  } catch (error) {
    console.error(error);
    if (createdId) await db.from("templates").delete().eq("id", createdId); // jangan sisakan template setengah jadi
    tplMessage("Gagal menyimpan template. Coba lagi.", true);
  } finally {
    button.disabled = false;
    button.textContent = "Simpan template";
  }
}

$("saveTemplateButton").addEventListener("click", openTemplateDialog);
$("tplForm").addEventListener("submit", submitTemplate);
$("tplCancel").addEventListener("click", () => $("tplDialog").close());
document.querySelectorAll("input[name=tplVisibility]").forEach(r => r.addEventListener("change", syncTplVisibility));
