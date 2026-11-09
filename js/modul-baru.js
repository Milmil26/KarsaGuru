// Wizard modul baru: kelas dan mapel > TP > model pembelajaran > draf.
// Butuh: app-shell.js (appReady, showToast), ui-helpers.js ($, el, must, fillSelect),
//        modul-komponen.js (MODULE_TEMPLATES, DEFAULT_TEMPLATE), ai-draft.js (requestDraft, withAiButton, selectedLabel, refNote)
const MODELS = [
  "Discovery Learning",
  "Problem Based Learning (PBL)",
  "Project Based Learning (PjBL)",
  "Project Based Learning dengan alur FIDS (Feel, Imagine, Do, Share)",
  "Inquiry Learning",
  "Cooperative Learning",
  "Contextual Teaching and Learning (CTL)",
  "Experiential Learning dengan alur ARKA (Aktivitas, Refleksi, Konsep, Aplikasi)"
];

let userId = null;
let fullName = "";
let objectives = [];
let kbcValues = [];
const picked = new Set();
const pickedKbc = new Set();
let mod = null;    // modul yang sudah dibuat: { id, title, topic, key }
let texts = {};    // isi komponen yang sudah tersimpan: key -> teks

// ---------- helper ----------
function say(id, text, isError = false) {
  const node = $(id);
  node.textContent = text;
  node.style.color = isError ? "#B3382A" : "";
}
function templateKey() {
  const key = $("wTemplate").value;
  return MODULE_TEMPLATES[key] ? key : DEFAULT_TEMPLATE;
}
function comps() {
  return MODULE_TEMPLATES[(mod && mod.key) || templateKey()].components;
}
function emptyComps() {
  return comps().filter(c => !(texts[c.key] || "").trim());
}
function pickedTexts() {
  return objectives.filter(o => picked.has(o.id)).map(o => o.text);
}
function showStep(n) {
  ["wzStep1", "wzStep2", "wzStep3", "wzDraft"].forEach((id, i) => ($(id).hidden = i + 1 !== n));
  document.querySelectorAll(".wz-step").forEach(li => {
    const s = Number(li.dataset.step);
    li.classList.toggle("active", s === n);
    li.classList.toggle("done", s < n);
  });
  window.scrollTo({ top: 0 });
}

// ---------- data ----------
async function loadReference() {
  const [curriculums, phases, subjects] = await Promise.all([
    db.from("curriculums").select("id, name, version, is_active").order("name").then(must),
    db.from("phases").select("id, name, grade_range").order("name").then(must),
    db.from("subjects").select("id, name").order("name").then(must)
  ]);
  fillSelect($("wCurriculum"), curriculums.map(c => ({ id: c.id, label: c.version ? `${c.name} ${c.version}` : c.name })), "Pilih kurikulum");
  fillSelect($("wPhase"), phases.map(p => ({ id: p.id, label: p.grade_range ? `${p.name} (${p.grade_range})` : p.name })), "Pilih fase");
  fillSelect($("wSubject"), subjects.map(s => ({ id: s.id, label: s.name })), "Pilih mapel");
  fillSelect($("wGrade"), Array.from({ length: 9 }, (_, i) => ({ id: String(i + 1), label: `Kelas ${i + 1}` })), "Pilih kelas");
  $("wTemplate").replaceChildren(...Object.entries(MODULE_TEMPLATES).map(([key, t]) => el("option", { value: key, text: t.label })));
  $("wTemplateHint").textContent = MODULE_TEMPLATES[templateKey()].description;
  const active = curriculums.find(c => c.is_active) || curriculums[0];
  if (active) $("wCurriculum").value = active.id;
  fillSelect($("wModel"), MODELS.map(m => ({ id: m, label: m })), "Biar saya tentukan nanti");
}

async function loadObjectives() {
  const rows = must(await db.from("learning_objectives")
    .select("id, objective_text, sequence_order, atp_item:atp_items(atp_document:atp_documents(id, title, phase_id, subject_id))")
    .order("sequence_order"));
  objectives = rows.map(r => {
    const doc = r.atp_item && r.atp_item.atp_document;
    return {
      id: r.id, text: r.objective_text, order: r.sequence_order,
      atpTitle: doc ? doc.title : null, phaseId: doc ? doc.phase_id : null, subjectId: doc ? doc.subject_id : null
    };
  });
}

// Nilai KBC bersifat tambahan: kalau belum tersedia, langkah 3 tetap jalan tanpa KBC.
async function loadKbc() {
  try {
    const rows = must(await db.from("kbc_values").select("id, name, sequence_order").order("sequence_order"));
    kbcValues = rows.map(r => ({ id: r.id, name: r.name }));
  } catch (error) {
    console.warn("KBC belum tersedia", error);
    kbcValues = [];
  }
}

// ---------- langkah 1 ----------
function validateStep1() {
  const meetings = $("wMeetings").value.trim();
  if (!$("wTopic").value.trim()) return "Isi topik atau judul modul dulu.";
  if (!$("wPhase").value || !$("wSubject").value) return "Pilih fase dan mapel dulu.";
  if (meetings && (!Number.isInteger(Number(meetings)) || Number(meetings) < 1)) return "Jumlah pertemuan harus angka bulat minimal 1.";
  return "";
}

// ---------- langkah 2 ----------
function renderTPs() {
  const box = $("wTpList");
  const phaseId = $("wPhase").value;
  const subjectId = $("wSubject").value;
  const visible = objectives.filter(o => picked.has(o.id) || !o.atpTitle || (o.phaseId === phaseId && o.subjectId === subjectId));
  if (!visible.length) {
    box.replaceChildren(el("p", { class: "hint", text: "Belum ada TP yang tersimpan. Tulis TP sendiri di kolom di bawah." }));
    return;
  }
  box.replaceChildren(...visible.map(o => {
    const input = el("input", { type: "checkbox" });
    input.checked = picked.has(o.id);
    input.addEventListener("change", () => (input.checked ? picked.add(o.id) : picked.delete(o.id)));
    return el("label", { class: "wz-check" }, input,
      el("span", {}, o.text, o.atpTitle ? el("small", { text: o.atpTitle }) : null));
  }));
}

async function addOwnTp() {
  const text = $("wOwnTp").value.trim();
  if (!text) return;
  try {
    const row = must(await db.from("learning_objectives")
      .insert({ user_id: userId, objective_text: text, source_type: "guru", sequence_order: objectives.length })
      .select("id, objective_text, sequence_order").single());
    objectives.push({ id: row.id, text: row.objective_text, order: row.sequence_order, atpTitle: null, phaseId: null, subjectId: null });
    picked.add(row.id);
    $("wOwnTp").value = "";
    renderTPs();
  } catch (error) {
    console.error(error);
    say("wzMessage2", "Gagal menambah TP. Coba lagi.", true);
  }
}

// ---------- langkah 3 ----------
function renderKbc() {
  $("wKbcField").hidden = kbcValues.length === 0;
  $("wKbcList").replaceChildren(...kbcValues.map(v => {
    const input = el("input", { type: "checkbox" });
    input.checked = pickedKbc.has(v.id);
    input.addEventListener("change", () => (input.checked ? pickedKbc.add(v.id) : pickedKbc.delete(v.id)));
    return el("label", { class: "wz-check" }, input, el("span", { text: v.name }));
  }));
}

// ---------- buat modul ----------
function baseComponents(topic) {
  const lines = [
    `Penyusun: ${fullName || "-"}`,
    `Mata pelajaran: ${selectedLabel("wSubject")}`,
    `Fase: ${selectedLabel("wPhase")}`,
    `Kelas: ${selectedLabel("wGrade") || "-"}`,
    `Materi pokok: ${topic}`,
    `Alokasi waktu: ${$("wMeetings").value.trim() ? `${$("wMeetings").value.trim()} pertemuan` : "-"}`
  ];
  const base = {
    identitas_modul: lines.join("\n"),
    tujuan_pembelajaran: pickedTexts().map((t, i) => `${i + 1}. ${t}`).join("\n")
  };
  if ($("wModel").value) base.model_pembelajaran = $("wModel").value;
  return base;
}

async function createModule() {
  const button = $("wzCreate");
  say("wzMessage3", "");
  button.disabled = true;
  button.textContent = "Membuat modul...";
  let createdId = null;
  try {
    const topic = $("wTopic").value.trim();
    const meetings = $("wMeetings").value.trim();
    const key = templateKey();
    const created = must(await db.from("teaching_modules").insert({
      user_id: userId,
      template_key: key,
      title: topic,
      topic,
      curriculum_id: $("wCurriculum").value || null,
      phase_id: $("wPhase").value,
      subject_id: $("wSubject").value,
      grade: $("wGrade").value ? Number($("wGrade").value) : null,
      meeting_count: meetings ? Number(meetings) : null,
      status: "draft"
    }).select("id").single());
    createdId = created.id;

    must(await db.from("module_objectives").insert([...picked].map(id => ({ module_id: createdId, learning_objective_id: id }))));
    if (pickedKbc.size) {
      must(await db.from("module_kbc_values").insert([...pickedKbc].map(id => ({ module_id: createdId, kbc_value_id: id }))));
    }

    const base = baseComponents(topic);
    const order = MODULE_TEMPLATES[key].components.map(c => c.key);
    const rows = Object.entries(base).filter(([k, v]) => v && order.includes(k))
      .map(([k, v]) => ({ module_id: createdId, component_key: k, content: { text: v }, sequence_order: order.indexOf(k) }));
    if (rows.length) must(await db.from("module_components").upsert(rows, { onConflict: "module_id,component_key" }));

    mod = { id: createdId, title: topic, topic, key };
    texts = {};
    rows.forEach(r => (texts[r.component_key] = r.content.text));
    await snapshot();

    $("draftTitle").textContent = `Modul "${topic}" dibuat`;
    $("openEditorLink").href = `modul.html?buka=${encodeURIComponent(createdId)}`;
    refreshDraftStatus();
    showStep(4);
  } catch (error) {
    console.error(error);
    // Jangan sisakan modul setengah jadi
    if (createdId) await db.from("teaching_modules").delete().eq("id", createdId);
    say("wzMessage3", "Gagal membuat modul. Coba lagi.", true);
  } finally {
    button.disabled = false;
    button.textContent = "Buat modul";
  }
}

async function snapshot() {
  try {
    must(await db.rpc("create_module_version", { p_module_id: mod.id }));
  } catch (error) {
    console.warn("Riwayat versi belum bisa dibuat", error);
  }
}

// ---------- draf ----------
function refreshDraftStatus() {
  const total = comps().length;
  const left = emptyComps().length;
  $("draftStatus").textContent = left ? `Terisi ${total - left} dari ${total} bagian.` : `Semua ${total} bagian sudah terisi.`;
}

function context() {
  return {
    title: mod.title,
    topic: mod.topic,
    curriculum: selectedLabel("wCurriculum"),
    phase: selectedLabel("wPhase"),
    subject: selectedLabel("wSubject"),
    grade: selectedLabel("wGrade"),
    meetings: $("wMeetings").value.trim(),
    objectives: pickedTexts(),
    kbc: kbcValues.filter(v => pickedKbc.has(v.id)).map(v => v.name)
  };
}

// Simpan hasil ke database. Hanya bagian yang masih kosong yang terisi.
async function applySections(sections, allowed) {
  const order = comps().map(c => c.key);
  const rows = allowed
    .filter(c => typeof sections[c.key] === "string" && sections[c.key].trim())
    .map(c => ({ module_id: mod.id, component_key: c.key, content: { text: sections[c.key].trim() }, sequence_order: order.indexOf(c.key) }));
  if (!rows.length) return 0;
  must(await db.from("module_components").upsert(rows, { onConflict: "module_id,component_key" }));
  rows.forEach(r => (texts[r.component_key] = r.content.text));
  await snapshot();
  refreshDraftStatus();
  return rows.length;
}

function buildPrompt() {
  const ctx = context();
  const empty = emptyComps();
  const format = MODULE_TEMPLATES[mod.key].label;
  const lines = [
    `Kamu membantu guru di Indonesia menyusun draf ${format}.`,
    "",
    "Aturan:",
    "1. Hasilmu draf awal yang akan diperiksa guru.",
    "2. Pakai konteks apa adanya. Jangan mengubah atau menambah tujuan pembelajaran.",
    "3. Jangan mengarang nomor regulasi, nama buku, kutipan, atau data. Jangan menulis teks ayat Al-Qur'an atau hadis dari ingatan; tulis petunjuk [guru: tambahkan dalil dan sumbernya].",
    "4. Teks polos: tanpa markdown (tanpa #, **, tabel). Daftar memakai \"1.\" atau \"-\", satu butir per baris.",
    "5. Sesuaikan bahasa dan kegiatan dengan usia siswa. Kegiatan harus konkret dan bisa dilakukan di kelas dengan sumber daya sederhana.",
    "6. Kegiatan pembelajaran dibagi per pertemuan dengan pendahuluan, inti, penutup, dan perkiraan menit.",
    ctx.kbc.length ? "7. Wujudkan nilai KBC (Kurikulum Berbasis Cinta) dalam kegiatan dan asesmen secara wajar, bukan sekadar menyebut namanya." : "",
    "",
    "KONTEKS",
    `Judul: ${ctx.title}`,
    `Kurikulum: ${ctx.curriculum || "-"}`,
    `Fase: ${ctx.phase || "-"}`,
    `Mapel: ${ctx.subject || "-"}`,
    `Kelas: ${ctx.grade || "-"}`,
    ctx.meetings ? `Jumlah pertemuan: ${ctx.meetings}` : "",
    texts.model_pembelajaran ? `Model pembelajaran: ${texts.model_pembelajaran}` : "",
    "Tujuan pembelajaran:",
    ...ctx.objectives.map((o, i) => `${i + 1}. ${o}`),
    ctx.kbc.length ? `Nilai KBC yang dikuatkan: ${ctx.kbc.join(", ")}` : "",
    "",
    "TUGAS",
    "Tulis draf untuk bagian-bagian di bawah. Balas HANYA dengan format ini, tanpa kata pengantar dan tanpa penutup.",
    "Tiap bagian diawali baris \"### nama_bagian\" (persis seperti di bawah), lalu isinya sebagai teks polos.",
    "Baris dalam kurung hanya petunjuk, jangan disalin.",
    ""
  ];
  empty.forEach(c => lines.push(`### ${c.key}`, `(${c.label}. ${c.hint})`, ""));
  return lines.filter((l, i, a) => !(l === "" && a[i - 1] === "")).join("\n");
}

// Pecah jawaban AI menjadi { kunci: teks } berdasarkan baris "### kunci".
function parseSections(raw, allowedKeys) {
  const result = {};
  let current = null;
  raw.replace(/\r/g, "").split("\n").forEach(line => {
    if (/^\s*```/.test(line)) return;
    const m = line.match(/^\s*#{1,4}\s*`?([a-z0-9_]+)`?\s*:?\s*$/i);
    if (m && allowedKeys.includes(m[1].toLowerCase())) {
      current = m[1].toLowerCase();
      result[current] = [];
    } else if (m) {
      current = null; // judul bagian yang tidak dikenal: berhenti, jangan ikut terbawa
    } else if (current) {
      result[current].push(line);
    }
  });
  Object.keys(result).forEach(k => {
    result[k] = result[k].join("\n").replace(/\*\*/g, "").trim();
  });
  return result;
}

async function copyPrompt() {
  const empty = emptyComps();
  if (!empty.length) return say("draftMessage", "Semua bagian sudah terisi.");
  const prompt = buildPrompt();
  try {
    await navigator.clipboard.writeText(prompt);
    say("draftMessage", "Prompt disalin. Tempel ke ChatGPT, Gemini, atau Claude, lalu tempel jawabannya di kotak Jawaban dari AI.");
  } catch (error) {
    // Cadangan kalau clipboard diblokir: tampilkan di kotak yang bisa disalin manual
    $("pasteBox").value = prompt;
    $("pasteBox").select();
    say("draftMessage", "Browser menolak menyalin otomatis. Prompt ditaruh di kotak di bawah: salin manual, lalu kosongkan kotaknya sebelum menempel jawaban.", true);
  }
}

async function applyPaste() {
  const raw = $("pasteBox").value.trim();
  if (!raw) return say("draftMessage", "Tempel jawaban dari AI dulu.", true);
  const empty = emptyComps();
  if (!empty.length) return say("draftMessage", "Semua bagian sudah terisi.");
  const button = $("applyPaste");
  button.disabled = true;
  try {
    const sections = parseSections(raw, empty.map(c => c.key));
    const filled = await applySections(sections, empty);
    if (!filled) return say("draftMessage", "Jawabannya belum terbaca. Pastikan tiap bagian diawali baris ### nama_bagian seperti di prompt.", true);
    $("pasteBox").value = "";
    say("draftMessage", `${filled} bagian terisi. Periksa dan revisi di editor.`);
  } catch (error) {
    console.error(error);
    say("draftMessage", "Gagal menyimpan jawaban. Coba lagi.", true);
  } finally {
    button.disabled = false;
  }
}

async function runAi() {
  const empty = emptyComps();
  if (!empty.length) return say("draftMessage", "Semua bagian sudah terisi.");
  await withAiButton($("aiRun"), async () => {
    try {
      const result = await requestDraft({
        kind: "modul",
        context: context(),
        keys: empty.map(({ key, label, hint }) => ({ key, label, hint })),
        existing: texts
      });
      const filled = await applySections(result.sections || {}, empty);
      say("draftMessage", result.partial
        ? `Terisi ${filled} dari ${empty.length} bagian. Klik lagi untuk melengkapi sisanya.${refNote(result)}`
        : `${filled} bagian terisi. Periksa dan revisi di editor.${refNote(result)}`);
    } catch (error) {
      console.error(error);
      say("draftMessage", `${error.message} Kamu bisa pakai cara 1 (salin prompt).`, true);
    }
  });
}

// ---------- event ----------
$("wzBackToList").addEventListener("click", () => (location.href = "modul.html"));
$("wTemplate").addEventListener("change", () => ($("wTemplateHint").textContent = MODULE_TEMPLATES[templateKey()].description));
$("wzNext1").addEventListener("click", () => {
  const problem = validateStep1();
  if (problem) return say("wzMessage1", problem, true);
  say("wzMessage1", "");
  renderTPs();
  showStep(2);
});
$("wAddOwnTp").addEventListener("click", addOwnTp);
$("wOwnTp").addEventListener("keydown", event => {
  if (event.key === "Enter") { event.preventDefault(); addOwnTp(); }
});
$("wzBack2").addEventListener("click", () => showStep(1));
$("wzNext2").addEventListener("click", () => {
  if (!picked.size) return say("wzMessage2", "Pilih atau tulis minimal satu TP dulu.", true);
  say("wzMessage2", "");
  renderKbc();
  showStep(3);
});
$("wzBack3").addEventListener("click", () => showStep(2));
$("wzCreate").addEventListener("click", createModule);
$("copyPrompt").addEventListener("click", copyPrompt);
$("applyPaste").addEventListener("click", applyPaste);
$("aiRun").addEventListener("click", runAi);

// ---------- mulai ----------
(async () => {
  const { session, profile } = await appReady;
  userId = session.user.id;
  fullName = (profile && profile.full_name) || "";
  try {
    await Promise.all([loadReference(), loadObjectives(), loadKbc()]);
  } catch (error) {
    console.error(error);
    say("wzMessage1", "Gagal memuat data. Muat ulang halaman.", true);
  }
})();
