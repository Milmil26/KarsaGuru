const STATUS_LABEL = {
  draft: ["Draf", "chip-draft"],
  generating: ["Diproses", "chip-processing"],
  ready: ["Siap", "chip-ready"],
  failed: ["Gagal", "chip-failed"]
};
const OWN_GROUP = "TP buatanmu";

const $ = id => document.getElementById(id);
let userId = null;
let state = null;
let objectives = [];
let kbcValues = [];

// ---------- helper ----------
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
function setMessage(text, isError = false) {
  const node = $("moduleMessage");
  node.textContent = text;
  node.style.color = isError ? "#B3382A" : "";
}
function templateKey() {
  const key = $("modTemplate").value;
  return MODULE_TEMPLATES[key] ? key : DEFAULT_TEMPLATE;
}
function currentComponents() {
  return MODULE_TEMPLATES[templateKey()].components;
}
function fillTemplates() {
  $("modTemplate").replaceChildren(
    ...Object.entries(MODULE_TEMPLATES).map(([key, t]) => el("option", { value: key, text: t.label }))
  );
  updateTemplateHint();
}
function updateTemplateHint() {
  $("templateHint").textContent = MODULE_TEMPLATES[templateKey()].description;
}
function fillSelect(select, rows, placeholder) {
  select.replaceChildren(
    el("option", { value: "", text: placeholder }),
    ...rows.map(r => el("option", { value: r.id, text: r.label }))
  );
}

// ---------- data referensi ----------
async function loadReference() {
  const [curriculums, phases, subjects, schools] = await Promise.all([
    db.from("curriculums").select("id, name, version, is_active").order("name").then(must),
    db.from("phases").select("id, name, grade_range").order("name").then(must),
    db.from("subjects").select("id, name").order("name").then(must),
    db.from("schools").select("id, name").order("name").then(must)
  ]);
  fillSelect($("modCurriculum"), curriculums.map(c => ({
    id: c.id, label: c.version ? `${c.name} ${c.version}` : c.name
  })), "Pilih kurikulum");
  fillSelect($("modPhase"), phases.map(p => ({
    id: p.id, label: p.grade_range ? `${p.name} (${p.grade_range})` : p.name
  })), "Pilih fase");
  fillSelect($("modSubject"), subjects.map(s => ({ id: s.id, label: s.name })), "Pilih mapel");
  fillSelect($("modGrade"), Array.from({ length: 9 }, (_, i) => ({ id: String(i + 1), label: `Kelas ${i + 1}` })), "Pilih kelas");
  fillSelect($("modSchool"), schools.map(s => ({ id: s.id, label: s.name })), "Tanpa sekolah");
  fillTemplates();
  $("schoolField").hidden = schools.length === 0;
  const active = curriculums.find(c => c.is_active) || curriculums[0];
  $("modCurriculum").dataset.defaultId = active ? active.id : "";
}

async function loadObjectives() {
  const rows = must(await db
    .from("learning_objectives")
    .select("id, objective_text, source_type, sequence_order, atp_item:atp_items(atp_document:atp_documents(id, title, phase_id, subject_id))")
    .order("sequence_order"));
  objectives = rows.map(r => {
    const doc = r.atp_item && r.atp_item.atp_document;
    return {
      id: r.id,
      text: r.objective_text,
      order: r.sequence_order,
      atpTitle: doc ? doc.title : null,
      phaseId: doc ? doc.phase_id : null,
      subjectId: doc ? doc.subject_id : null
    };
  });
}

// Nilai KBC bersifat tambahan: kalau tahap 5 belum dijalankan, halaman tetap jalan tanpa KBC.
async function loadKbc() {
  try {
    const rows = must(await db
      .from("kbc_values")
      .select("id, name, sequence_order, reference:kbc_references(id, title)")
      .order("sequence_order"));
    kbcValues = rows.map(r => ({
      id: r.id, name: r.name, order: r.sequence_order,
      group: r.reference ? r.reference.title : "KBC"
    }));
  } catch (error) {
    console.warn("KBC belum tersedia", error);
    kbcValues = [];
  }
}

// ---------- daftar modul ----------
async function loadList() {
  $("listStatus").textContent = "Memuat...";
  $("listStatus").hidden = false;
  const rows = must(await db
    .from("teaching_modules")
    .select("id, title, status, grade, template_key, updated_at, phase:phases(name), subject:subjects(name)")
    .order("updated_at", { ascending: false }));

  const list = $("moduleList");
  list.replaceChildren();
  if (!rows.length) {
    $("listStatus").textContent = "Belum ada modul. Klik Buat modul untuk mulai.";
    return;
  }
  $("listStatus").hidden = true;
  rows.forEach(row => list.append(renderCard(row)));
}
function renderCard(row) {
  const [statusText, statusClass] = STATUS_LABEL[row.status] || STATUS_LABEL.draft;
  const template = MODULE_TEMPLATES[row.template_key];
  const meta = [template && template.shortLabel, row.grade && `Kelas ${row.grade}`, row.phase && row.phase.name, row.subject && row.subject.name]
    .filter(Boolean).join(" · ");
  const date = new Date(row.updated_at).toLocaleDateString("id-ID", {
    day: "numeric", month: "short", year: "numeric"
  });
  return el("article", { class: "atp-card" },
    el("div", { class: "atp-card-main" },
      el("h3", { text: row.title }),
      el("p", { text: meta || "Belum dilengkapi" }),
      el("small", { text: `Diperbarui ${date}` }),
      el("small", { class: "card-links" },
        el("a", { class: "text-link", href: `lkpd.html?modul=${row.id}`, text: "+ LKPD" }),
        " · ",
        el("a", { class: "text-link", href: `media.html?modul=${row.id}`, text: "+ Media" })
      )
    ),
    el("span", { class: `chip ${statusClass}`, text: statusText }),
    el("div", { class: "atp-card-actions" },
      el("button", { class: "button button-quiet", type: "button", text: "Buka", onclick: () => openEditor(row.id) }),
      el("a", { class: "button button-quiet", href: `cetak.html?type=modul&id=${row.id}`, text: "Cetak" }),
      el("button", { class: "icon-danger", type: "button", "aria-label": `Hapus ${row.title}`, text: "Hapus", onclick: () => removeModule(row) })
    )
  );
}
async function removeModule(row) {
  if (!confirm(`Hapus modul "${row.title}"? LKPD, media, dan riwayat versinya ikut terhapus.`)) return;
  try {
    must(await db.from("teaching_modules").delete().eq("id", row.id));
    showToast("Modul dihapus.");
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
async function openEditor(id) {
  setMessage("");
  $("moduleForm").reset();
  $("matchFilter").checked = true;
  $("historySection").hidden = true;
  state = {
    id: null, texts: {},
    selected: new Set(), original: new Set(),
    kbcSelected: new Set(), kbcOriginal: new Set()
  };
  let versions = [];

  try {
    if (id) {
      const [mod, picked, comps, kbcPicked, vers] = await Promise.all([
        db.from("teaching_modules").select("*").eq("id", id).single().then(must),
        db.from("module_objectives").select("learning_objective_id").eq("module_id", id).then(must),
        db.from("module_components").select("component_key, content").eq("module_id", id).then(must),
        db.from("module_kbc_values").select("kbc_value_id").eq("module_id", id).then(must).catch(() => []),
        db.from("document_versions").select("id, version_number, created_at, snapshot")
          .eq("module_id", id).order("version_number", { ascending: false }).then(must).catch(() => [])
      ]);
      state.id = mod.id;
      picked.forEach(p => state.selected.add(p.learning_objective_id));
      state.original = new Set(state.selected);
      kbcPicked.forEach(p => state.kbcSelected.add(p.kbc_value_id));
      state.kbcOriginal = new Set(state.kbcSelected);
      comps.forEach(c => (state.texts[c.component_key] = (c.content && c.content.text) || ""));
      versions = vers;

      $("editorTitle").textContent = "Edit modul";
      $("modTemplate").value = MODULE_TEMPLATES[mod.template_key] ? mod.template_key : DEFAULT_TEMPLATE;
      $("modTitle").value = mod.title;
      $("modTopic").value = mod.topic || "";
      $("modCurriculum").value = mod.curriculum_id || "";
      $("modPhase").value = mod.phase_id || "";
      $("modSubject").value = mod.subject_id || "";
      $("modGrade").value = mod.grade ? String(mod.grade) : "";
      $("modMeetings").value = mod.meeting_count || "";
      $("modStatus").value = mod.status === "ready" ? "ready" : "draft";
      $("modSchool").value = mod.school_id || "";
    } else {
      $("editorTitle").textContent = "Modul baru";
      $("modTemplate").value = DEFAULT_TEMPLATE;
      $("modCurriculum").value = $("modCurriculum").dataset.defaultId || "";
    }
  } catch (error) {
    console.error(error);
    showToast("Gagal membuka modul.");
    return;
  }
  updateTemplateHint();
  renderPicker();
  renderKbc();
  renderComponents();
  renderHistory(versions);
  showEditor();
}

// ---------- pilih TP ----------
function renderPicker() {
  const box = $("tpPicker");
  box.replaceChildren();
  updateTpCount();

  if (!objectives.length) {
    box.append(el("p", { class: "hint" },
      "Belum ada TP. Tulis TP sendiri di kolom di bawah."));
    return;
  }

  const phaseId = $("modPhase").value;
  const subjectId = $("modSubject").value;
  const filterOn = $("matchFilter").checked && phaseId && subjectId;
  const visible = objectives.filter(o =>
    !filterOn || !o.atpTitle || state.selected.has(o.id) ||
    (o.phaseId === phaseId && o.subjectId === subjectId));

  if (!visible.length) {
    box.append(el("p", { class: "hint", text: "Belum ada TP untuk fase dan mapel ini. Matikan filter untuk melihat semua." }));
    return;
  }

  const groups = new Map();
  visible.forEach(o => {
    const key = o.atpTitle || OWN_GROUP;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(o);
  });
  const names = [...groups.keys()].sort((a, b) =>
    a === OWN_GROUP ? 1 : b === OWN_GROUP ? -1 : a.localeCompare(b, "id"));

  names.forEach(name => {
    const group = el("fieldset", { class: "tp-group" }, el("legend", { text: name }));
    groups.get(name).forEach(o => {
      const check = el("input", { type: "checkbox" });
      check.checked = state.selected.has(o.id);
      check.addEventListener("change", () => {
        if (check.checked) state.selected.add(o.id);
        else state.selected.delete(o.id);
        updateTpCount();
      });
      group.append(el("label", { class: "tp-option" }, check, el("span", { text: o.text })));
    });
    box.append(group);
  });
}
function updateTpCount() {
  const n = state.selected.size;
  $("tpCount").textContent = n ? `(${n} dipilih)` : "";
}
async function addOwnObjective() {
  const input = $("ownTp");
  const text = input.value.trim();
  if (!text) return;
  try {
    const row = must(await db.from("learning_objectives")
      .insert({ user_id: userId, objective_text: text, source_type: "guru", sequence_order: objectives.length })
      .select("id, objective_text, sequence_order").single());
    objectives.push({ id: row.id, text: row.objective_text, order: row.sequence_order, atpTitle: null, phaseId: null, subjectId: null });
    state.selected.add(row.id);
    input.value = "";
    renderPicker();
  } catch (error) {
    console.error(error);
    setMessage("Gagal menambah TP. Coba lagi.", true);
  }
}

// ---------- nilai KBC ----------
function renderKbc() {
  const box = $("kbcPicker");
  box.replaceChildren();
  $("kbcField").hidden = kbcValues.length === 0;
  if (!kbcValues.length) return;

  const groups = new Map();
  kbcValues.forEach(v => {
    if (!groups.has(v.group)) groups.set(v.group, []);
    groups.get(v.group).push(v);
  });
  groups.forEach((values, name) => {
    const options = el("div", { class: "kbc-options" });
    values.forEach(v => {
      const check = el("input", { type: "checkbox" });
      check.checked = state.kbcSelected.has(v.id);
      check.addEventListener("change", () => {
        if (check.checked) state.kbcSelected.add(v.id);
        else state.kbcSelected.delete(v.id);
      });
      options.append(el("label", { class: "kbc-chip" }, check, el("span", { text: v.name })));
    });
    box.append(el("fieldset", { class: "kbc-group" }, el("legend", { text: name }), options));
  });
}

// ---------- komponen ----------
function renderComponents() {
  const box = $("componentList");
  box.replaceChildren();
  let lastGroup = null;
  currentComponents().forEach(comp => {
    if (comp.group !== lastGroup) {
      box.append(el("h3", { class: "comp-group", text: comp.group }));
      lastGroup = comp.group;
    }
    const area = el("textarea", { rows: "6", "aria-label": comp.label });
    area.value = state.texts[comp.key] || "";
    const badge = el("span", { class: "comp-badge", text: "Terisi" });
    badge.hidden = !area.value.trim();
    area.addEventListener("input", () => {
      state.texts[comp.key] = area.value;
      badge.hidden = !area.value.trim();
    });
    box.append(el("details", { class: "comp" },
      el("summary", {}, el("span", { text: comp.label }), badge),
      el("div", { class: "comp-body" }, el("p", { class: "hint", text: comp.hint }), area)
    ));
  });
}

// ---------- draf AI ----------
async function generateDraft() {
  setMessage("");
  const title = $("modTitle").value.trim();
  if (!title) return setMessage("Isi judul modul dulu.", true);
  if (!$("modPhase").value || !$("modSubject").value) return setMessage("Pilih fase dan mapel dulu.", true);

  const tps = objectives.filter(o => state.selected.has(o.id)).map(o => o.text);
  if (!tps.length) return setMessage("Pilih atau tulis minimal satu TP dulu supaya drafnya nyambung.", true);

  const empty = currentComponents().filter(c => !(state.texts[c.key] || "").trim());
  if (!empty.length) return setMessage("Semua komponen sudah terisi. Kosongkan yang mau dibuat AI.", true);

  const existing = {};
  currentComponents().forEach(c => {
    const text = (state.texts[c.key] || "").trim();
    if (text) existing[c.key] = text;
  });

  await withAiButton($("aiButton"), async () => {
    try {
      const result = await requestDraft({
        kind: "modul",
        context: {
          title,
          topic: $("modTopic").value.trim(),
          curriculum: selectedLabel("modCurriculum"),
          phase: selectedLabel("modPhase"),
          subject: selectedLabel("modSubject"),
          grade: selectedLabel("modGrade"),
          meetings: $("modMeetings").value.trim(),
          objectives: tps,
          kbc: kbcValues.filter(v => state.kbcSelected.has(v.id)).map(v => v.name)
        },
        keys: empty.map(({ key, label, hint }) => ({ key, label, hint })),
        existing
      });
      let filled = 0;
      empty.forEach(c => {
        const text = result.sections && result.sections[c.key];
        if (typeof text === "string" && text.trim() && !(state.texts[c.key] || "").trim()) {
          state.texts[c.key] = text.trim();
          filled++;
        }
      });
      renderComponents();
      setMessage(result.partial
        ? `Draf terisi di ${filled} dari ${empty.length} komponen. Klik tombol AI lagi untuk melengkapi sisanya.${refNote(result)}`
        : `Draf terisi di ${filled} komponen. Periksa dan revisi dulu, lalu klik Simpan.${refNote(result)}`);
    } catch (error) {
      console.error(error);
      setMessage(error.message, true);
    }
  });
}

// ---------- riwayat versi ----------
function renderHistory(versions) {
  const list = $("historyList");
  list.replaceChildren();
  $("historySection").hidden = versions.length === 0;
  versions.forEach(v => {
    const when = new Date(v.created_at).toLocaleString("id-ID", {
      day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit"
    });
    list.append(el("div", { class: "version-row" },
      el("div", {}, el("b", { text: `Versi ${v.version_number}` }), el("small", { text: when })),
      el("button", {
        class: "button button-quiet", type: "button", text: "Muat ke form",
        onclick: () => applySnapshot(v)
      })
    ));
  });
}
// Memuat isi versi lama ke form. Belum tersimpan sampai kamu klik Simpan.
function applySnapshot(version) {
  const snap = version.snapshot || {};
  const mod = snap.module || {};
  $("modTemplate").value = MODULE_TEMPLATES[mod.template_key] ? mod.template_key : DEFAULT_TEMPLATE;
  updateTemplateHint();
  $("modTitle").value = mod.title || "";
  $("modTopic").value = mod.topic || "";
  $("modCurriculum").value = mod.curriculum_id || "";
  $("modPhase").value = mod.phase_id || "";
  $("modSubject").value = mod.subject_id || "";
  $("modGrade").value = mod.grade ? String(mod.grade) : "";
  $("modMeetings").value = mod.meeting_count || "";
  $("modStatus").value = mod.status === "ready" ? "ready" : "draft";
  $("modSchool").value = mod.school_id || "";

  state.selected = new Set((snap.objectives || []).map(o => o.id).filter(id => objectives.some(o => o.id === id)));
  state.kbcSelected = new Set((snap.kbc_values || []).map(v => v.id).filter(id => kbcValues.some(k => k.id === id)));
  state.texts = {};
  (snap.components || []).forEach(c => (state.texts[c.key] = (c.content && c.content.text) || ""));

  renderPicker();
  renderKbc();
  renderComponents();
  setMessage(`Versi ${version.version_number} dimuat ke form. Klik Simpan untuk menerapkannya.`);
  window.scrollTo({ top: 0, behavior: "smooth" });
}

// ---------- simpan ----------
function setBusy(busy) {
  const button = $("saveButton");
  button.disabled = busy;
  button.textContent = busy ? "Menyimpan..." : "Simpan";
}

async function syncSet(table, column, current, original) {
  const toAdd = [...current].filter(id => !original.has(id));
  const toRemove = [...original].filter(id => !current.has(id));
  if (toAdd.length) {
    must(await db.from(table).insert(toAdd.map(id => ({ module_id: state.id, [column]: id }))));
  }
  if (toRemove.length) {
    must(await db.from(table).delete().eq("module_id", state.id).in(column, toRemove));
  }
}

async function save(event) {
  event.preventDefault();
  setMessage("");

  const title = $("modTitle").value.trim();
  const phaseId = $("modPhase").value;
  const subjectId = $("modSubject").value;
  const meetings = $("modMeetings").value.trim();
  if (!title) return setMessage("Isi judul modul dulu.", true);
  if (!phaseId || !subjectId) return setMessage("Pilih fase dan mapel dulu.", true);
  if (meetings && (!Number.isInteger(Number(meetings)) || Number(meetings) < 1)) {
    return setMessage("Jumlah pertemuan harus angka bulat minimal 1.", true);
  }

  setBusy(true);
  try {
    const payload = {
      template_key: templateKey(),
      title,
      topic: $("modTopic").value.trim() || null,
      curriculum_id: $("modCurriculum").value || null,
      phase_id: phaseId,
      subject_id: subjectId,
      grade: $("modGrade").value ? Number($("modGrade").value) : null,
      meeting_count: meetings ? Number(meetings) : null,
      school_id: $("modSchool").value || null,
      status: $("modStatus").value
    };

    if (state.id) {
      must(await db.from("teaching_modules").update(payload).eq("id", state.id));
    } else {
      const created = must(await db.from("teaching_modules")
        .insert({ ...payload, user_id: userId }).select("id").single());
      state.id = created.id;
    }

    await syncSet("module_objectives", "learning_objective_id", state.selected, state.original);
    state.original = new Set(state.selected);
    await syncSet("module_kbc_values", "kbc_value_id", state.kbcSelected, state.kbcOriginal);
    state.kbcOriginal = new Set(state.kbcSelected);

    // Komponen: simpan yang terisi, hapus yang dikosongkan
    const filled = [];
    const emptied = [];
    currentComponents().forEach((comp, index) => {
      const text = (state.texts[comp.key] || "").trim();
      if (text) filled.push({ module_id: state.id, component_key: comp.key, content: { text }, sequence_order: index });
      else emptied.push(comp.key);
    });
    if (filled.length) {
      must(await db.from("module_components").upsert(filled, { onConflict: "module_id,component_key" }));
    }
    if (emptied.length) {
      must(await db.from("module_components").delete().eq("module_id", state.id).in("component_key", emptied));
    }

    // Riwayat versi: kegagalan di sini tidak membatalkan penyimpanan
    let versionOk = true;
    try {
      must(await db.rpc("create_module_version", { p_module_id: state.id }));
    } catch (error) {
      console.error(error);
      versionOk = false;
    }

    showToast(versionOk ? "Modul tersimpan." : "Modul tersimpan, tapi riwayat versi belum bisa dibuat.");
    showList();
    await loadList();
  } catch (error) {
    console.error(error);
    setMessage("Gagal menyimpan. Coba lagi.", true);
  } finally {
    setBusy(false);
  }
}

// ---------- event ----------
$("newModuleButton").addEventListener("click", () => { location.href = "modul-baru.html"; });
$("backButton").addEventListener("click", showList);
$("cancelButton").addEventListener("click", showList);
$("moduleForm").addEventListener("submit", save);
$("modTemplate").addEventListener("change", () => {
  updateTemplateHint();
  renderComponents();
});
$("modPhase").addEventListener("change", renderPicker);
$("modSubject").addEventListener("change", renderPicker);
$("matchFilter").addEventListener("change", renderPicker);
$("addOwnTp").addEventListener("click", addOwnObjective);
$("aiButton").addEventListener("click", generateDraft);
$("ownTp").addEventListener("keydown", event => {
  if (event.key === "Enter") { event.preventDefault(); addOwnObjective(); }
});

// ---------- mulai ----------
(async () => {
  const { session } = await appReady;
  userId = session.user.id;
  try {
    await Promise.all([loadReference(), loadObjectives(), loadKbc()]);
    await loadList();
    const openId = new URLSearchParams(location.search).get("buka"); // dari Bank Template
    if (openId) await openEditor(openId);
  } catch (error) {
    console.error(error);
    $("listStatus").textContent = "Gagal memuat data. Muat ulang halaman.";
  }
})();