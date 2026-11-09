// Halaman cetak: /cetak.html?type=modul&id=... atau ?type=lkpd&id=...
// Butuh: ui-helpers.js ($, el, must, formatDate), material-config.js, modul-komponen.js
const params = new URLSearchParams(location.search);
const docType = params.get("type");
const docId = params.get("id");

function textBlock(text) {
  return el("p", { class: "text-block", text });
}
function metaTable(pairs) {
  const rows = pairs.filter(([, value]) => value);
  if (!rows.length) return null;
  return el("table", { class: "meta-table" },
    el("tbody", {}, rows.map(([label, value]) => el("tr", {}, el("th", { text: label }), el("td", { text: String(value) }))))
  );
}
function heading(tag, text) {
  return el(tag, { text });
}

async function nameOf(table, id, build) {
  if (!id) return null;
  const { data, error } = await db.from(table).select("*").eq("id", id).maybeSingle();
  if (error || !data) return null;
  return build(data);
}

// ---------- modul ----------
async function renderModule() {
  const mod = must(await db.from("teaching_modules")
    .select("*, phase:phases(name, grade_range), subject:subjects(name)").eq("id", docId).single());
  const [school, curriculum, picked, comps, kbcPicked] = await Promise.all([
    nameOf("schools", mod.school_id, s => s.name),
    nameOf("curriculums", mod.curriculum_id, c => (c.version ? `${c.name} ${c.version}` : c.name)),
    db.from("module_objectives").select("learning_objective_id").eq("module_id", docId).then(must),
    db.from("module_components").select("component_key, content, sequence_order").eq("module_id", docId).then(must),
    db.from("module_kbc_values").select("kbc_value_id").eq("module_id", docId).then(must).catch(() => [])
  ]);

  const tpIds = picked.map(p => p.learning_objective_id);
  const objectives = tpIds.length
    ? must(await db.from("learning_objectives").select("id, objective_text, sequence_order").in("id", tpIds).order("sequence_order"))
    : [];
  let kbcNames = [];
  if (kbcPicked.length) {
    try {
      kbcNames = must(await db.from("kbc_values").select("name, sequence_order")
        .in("id", kbcPicked.map(k => k.kbc_value_id)).order("sequence_order")).map(k => k.name);
    } catch (error) {
      console.warn("Nilai KBC tidak terbaca", error);
    }
  }

  const template = MODULE_TEMPLATES[mod.template_key] || MODULE_TEMPLATES[DEFAULT_TEMPLATE];
  const texts = {};
  comps.forEach(c => (texts[c.component_key] = (c.content && c.content.text) || ""));

  const sheet = $("sheet");
  sheet.replaceChildren(
    el("h1", { text: mod.title }),
    el("p", { class: "doc-kind", text: template.label }),
    metaTable([
      ["Topik", mod.topic],
      ["Kurikulum", curriculum],
      ["Fase", mod.phase && (mod.phase.grade_range ? `${mod.phase.name} (${mod.phase.grade_range})` : mod.phase.name)],
      ["Mata pelajaran", mod.subject && mod.subject.name],
      ["Kelas", mod.grade && `Kelas ${mod.grade}`],
      ["Jumlah pertemuan", mod.meeting_count],
      ["Satuan pendidikan", school]
    ])
  );

  if (objectives.length) {
    sheet.append(heading("h2", "Tujuan pembelajaran"),
      el("ol", { class: "tp-print" }, objectives.map(o => el("li", { text: o.objective_text }))));
  }
  if (kbcNames.length) {
    sheet.append(heading("h2", "Nilai KBC yang dikuatkan"), textBlock(kbcNames.join(", ")));
  }

  let lastGroup = null;
  template.components.forEach(comp => {
    const text = (texts[comp.key] || "").trim();
    if (!text) return;
    if (comp.group !== lastGroup) {
      sheet.append(heading("h2", comp.group));
      lastGroup = comp.group;
    }
    sheet.append(el("section", {}, heading("h3", comp.label), textBlock(text)));
  });

  document.title = `${mod.title} — KarsaGuru`;
  $("backLink").href = "modul.html";
}

// ---------- LKPD ----------
const LKPD_BUCKET = "teacher-files";
// Ikon garis sederhana per bagian LKPD (markup statis, bukan dari input pengguna)
const SECTION_ICONS = {
  identitas: '<path d="M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM4 21a8 8 0 0 1 16 0"/>',
  tujuan: '<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="4"/>',
  petunjuk: '<path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01"/>',
  informasi: '<circle cx="12" cy="12" r="9"/><path d="M12 8h.01M11 12h1v5h1"/>',
  alat_bahan: '<path d="M14.7 6.3a4 4 0 0 0-5.4 5.4L3 18l3 3 6.3-6.3a4 4 0 0 0 5.4-5.4l-2.4 2.4-2.6-.6-.6-2.6z"/>',
  kegiatan: '<path d="M5 21V4M5 4h12l-2 4 2 4H5"/>',
  soal: '<circle cx="12" cy="12" r="9"/><path d="M9.5 9.5a2.5 2.5 0 1 1 3.5 2.3c-.7.4-1 1-1 1.7M12 17h.01"/>',
  refleksi: '<path d="M9 18h6M10 21h4M12 3a6 6 0 0 0-3.5 10.9c.3.3.5.7.5 1.1V16h6v-1c0-.4.2-.8.5-1.1A6 6 0 0 0 12 3z"/>'
};
const ANSWER_LINES = { soal: 3, refleksi: 3 };

function sectionIcon(key) {
  const icon = el("span", { class: "sec-icon" });
  icon.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${SECTION_ICONS[key] || SECTION_ICONS.informasi}</svg>`;
  return icon;
}
function answerLines(count) {
  return el("div", { class: "answer-lines" }, Array.from({ length: count }, () => el("i")));
}
// Pecah isi soal/refleksi jadi butir. Kalau ada baris bernomor (1. atau 1)), baris lain dianggap lanjutan.
function splitItems(text) {
  const lines = text.split("\n").map(l => l.trimEnd()).filter(l => l.trim());
  const numbered = /^\s*\d+[.)]\s+/;
  const bullet = /^\s*[-•*]\s+/;
  if (lines.some(l => numbered.test(l))) {
    const items = [];
    lines.forEach(line => {
      if (numbered.test(line) || !items.length) items.push(line.replace(numbered, ""));
      else items[items.length - 1] += "\n" + line;
    });
    return items;
  }
  return lines.map(l => l.replace(bullet, ""));
}
function worksheetCard(section, text) {
  const body = [];
  if (ANSWER_LINES[section.key]) {
    body.push(el("ol", { class: "q-list" }, splitItems(text).map(item =>
      el("li", {}, el("p", { class: "text-block", text: item }), answerLines(ANSWER_LINES[section.key])))));
  } else {
    body.push(textBlock(text));
  }
  return el("section", { class: "ws-card" },
    el("h2", {}, sectionIcon(section.key), el("span", { text: section.label })),
    body);
}
function waitForImage(img) {
  return new Promise(resolve => {
    if (img.complete) return resolve();
    img.addEventListener("load", resolve);
    img.addEventListener("error", resolve);
    setTimeout(resolve, 5000);
  });
}

async function renderWorksheet() {
  const row = must(await db.from("worksheets")
    .select("*, module:teaching_modules(title, grade, subject:subjects(name))").eq("id", docId).single());
  const content = row.content || {};
  const sections = content.sections || {};
  const module = row.module;
  const theme = LKPD_THEMES.some(t => t.key === content.theme) ? content.theme : LKPD_THEMES[0].key;

  const chips = [
    module && module.subject && module.subject.name,
    module && module.grade && `Kelas ${module.grade}`,
    module && module.title
  ].filter(Boolean).map(text => el("span", { class: "ws-chip", text }));

  let cover = null;
  if (content.cover_path) {
    const { data, error } = await db.storage.from(LKPD_BUCKET).createSignedUrl(content.cover_path, 3600);
    if (!error) cover = el("img", { class: "ws-cover", src: data.signedUrl, alt: "" });
  }

  const sheet = $("sheet");
  sheet.className = `sheet sheet-lkpd theme-${theme}`;
  sheet.replaceChildren(
    el("header", { class: "ws-banner" },
      el("div", { class: "ws-banner-text" },
        el("span", { class: "ws-badge", text: "LKPD" }),
        el("h1", { text: row.title }),
        el("div", { class: "ws-chips" }, chips)),
      cover)
  );

  // Kotak isian nama, kelas, tanggal. Kalau guru mengisi bagian Identitas, pakai isinya.
  const identity = (sections.identitas || "").trim();
  const identitySection = LKPD_SECTIONS.find(s => s.key === "identitas");
  if (identity) {
    sheet.append(worksheetCard(identitySection, identity));
  } else {
    sheet.append(el("section", { class: "ws-card ws-identity" },
      ["Nama", "Kelas", "Tanggal"].map(label => el("div", {}, el("span", { text: label }), el("i")))));
  }

  LKPD_SECTIONS.filter(s => s.key !== "identitas").forEach(section => {
    const text = (sections[section.key] || "").trim();
    if (text) sheet.append(worksheetCard(section, text));
  });

  if (cover) await waitForImage(cover);
  document.title = `${row.title} — KarsaGuru`;
  $("backLink").href = "lkpd.html";
}

// ---------- mulai ----------
(async () => {
  await appReady;
  const status = $("printStatus");
  if (!docId || !["modul", "lkpd"].includes(docType)) {
    status.textContent = "Dokumen tidak ditemukan. Buka dari tombol Cetak di daftar.";
    return;
  }
  try {
    if (docType === "modul") await renderModule();
    else await renderWorksheet();
    status.hidden = true;
    $("sheet").hidden = false;
    $("printButton").disabled = false;
    $("wordButton").hidden = docType !== "modul";
  } catch (error) {
    console.error(error);
    status.textContent = "Gagal memuat dokumen. Muat ulang halaman.";
  }
})();

// Unduh sebagai file yang dibuka Word. Ini HTML berekstensi .doc, bukan .docx asli:
// Word membukanya dengan baik dan bisa langsung Save As .docx.
function escapeHtml(text) {
  return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}
function downloadWord() {
  const clone = $("sheet").cloneNode(true);
  clone.querySelectorAll(".text-block").forEach(p => {
    p.innerHTML = escapeHtml(p.textContent).replace(/\n/g, "<br>");
  });
  const title = document.title.replace(/ — KarsaGuru$/, "");
  const style = "body{font-family:Calibri,Arial,sans-serif;font-size:11pt;line-height:1.4}h1{font-size:20pt}" +
    "h2{font-size:14pt;border-bottom:1px solid #000}h3{font-size:11.5pt}" +
    "table{border-collapse:collapse;width:100%}th,td{border:1px solid #999;padding:4px;text-align:left;vertical-align:top}";
  const html = `<!DOCTYPE html><html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:w="urn:schemas-microsoft-com:office:word" xmlns="http://www.w3.org/TR/REC-html40"><head><meta charset="utf-8"><title>${escapeHtml(title)}</title><style>${style}</style></head><body>${clone.innerHTML}</body></html>`;
  const url = URL.createObjectURL(new Blob(["\ufeff", html], { type: "application/msword" }));
  const link = el("a", { href: url, download: `${safeName(title) || "modul"}.doc` });
  document.body.append(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
$("wordButton").addEventListener("click", downloadWord);
$("printButton").addEventListener("click", () => window.print());
