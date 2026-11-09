// Aturan jenjang, kurikulum, dan format dokumen. Dimuat SETELAH modul-komponen.js.
// Dipakai halaman Modul Ajar dan wizard. Butuh $, el, fillSelect dari halaman yang memakainya.
//
// Aturan yang berlaku:
//   SD, SMP, SMA      : Kurikulum Merdeka, tanpa KBC, format Modul Ajar.
//   MI, MTs, MA       : boleh Kurikulum Berbasis Cinta (KBC) dengan format Modul Ajar KBC atau PPM.
//   Pilih kurikulum non-KBC : bagian KBC dan format KBC disembunyikan.
const JENJANG = [
  { key: "SD", label: "SD", madrasah: false, grades: [1, 2, 3, 4, 5, 6], phases: ["A", "B", "C"] },
  { key: "SMP", label: "SMP", madrasah: false, grades: [7, 8, 9], phases: ["D"] },
  { key: "SMA", label: "SMA", madrasah: false, grades: [10, 11, 12], phases: ["E", "F"] },
  { key: "MI", label: "MI", madrasah: true, grades: [1, 2, 3, 4, 5, 6], phases: ["A", "B", "C"] },
  { key: "MTs", label: "MTs", madrasah: true, grades: [7, 8, 9], phases: ["D"] },
  { key: "MA", label: "MA", madrasah: true, grades: [10, 11, 12], phases: ["E", "F"] }
];

function jenjangInfo(key) {
  return JENJANG.find(j => j.key === key) || null;
}
function isKbcLabel(label) {
  return /cinta|kbc/i.test(label || "");
}
function curriculumText(c) {
  return c.version ? `${c.name} ${c.version}` : c.name;
}
function phaseText(p) {
  return p.grade_range ? `${p.name} (${p.grade_range})` : p.name;
}
function gradesFor(key) {
  const info = jenjangInfo(key);
  return info ? info.grades : Array.from({ length: 12 }, (_, i) => i + 1);
}
function phaseAllowed(key, phaseName) {
  const info = jenjangInfo(key);
  const m = /fase\s*([a-f])/i.exec(phaseName || "");
  return !info || !m || info.phases.includes(m[1].toUpperCase());
}
function curriculumAllowed(key, label) {
  const info = jenjangInfo(key);
  return !info || info.madrasah || !isKbcLabel(label);
}
function defaultCurriculum(list, key) {
  const info = jenjangInfo(key);
  const kbc = list.find(c => isKbcLabel(curriculumText(c)));
  if (info && info.madrasah && kbc) return kbc;
  const plain = list.filter(c => !isKbcLabel(curriculumText(c)));
  return plain.find(c => c.is_active) || plain[0] || list[0] || null;
}

// Isi ulang pilihan kurikulum, fase, dan kelas sesuai jenjang. Nilai yang masih valid dipertahankan.
//   ids   : { jenjang, curriculum, phase, grade } berisi id elemen <select>
//   data  : { curriculums, phases }
//   force : { curriculum, phase, grade } nilai yang harus tetap ada (mis. milik modul lama)
function applyJenjangFilters(ids, data, force = {}) {
  const j = $(ids.jenjang).value;
  const keep = { c: $(ids.curriculum).value, p: $(ids.phase).value, g: $(ids.grade).value };

  const curs = data.curriculums.filter(c => curriculumAllowed(j, curriculumText(c)) || c.id === force.curriculum);
  fillSelect($(ids.curriculum), curs.map(c => ({ id: c.id, label: curriculumText(c) })), "Pilih kurikulum");
  const wantC = force.curriculum || keep.c;
  const chosen = curs.find(c => c.id === wantC) || defaultCurriculum(curs, j);
  $(ids.curriculum).value = chosen ? chosen.id : "";

  const phases = data.phases.filter(p => phaseAllowed(j, p.name) || p.id === force.phase);
  fillSelect($(ids.phase), phases.map(p => ({ id: p.id, label: phaseText(p) })), "Pilih fase");
  const wantP = force.phase || keep.p;
  $(ids.phase).value = phases.some(p => p.id === wantP) ? wantP : (phases.length === 1 ? phases[0].id : "");

  const grades = gradesFor(j).slice();
  if (force.grade && !grades.includes(Number(force.grade))) grades.push(Number(force.grade));
  fillSelect($(ids.grade), grades.map(g => ({ id: String(g), label: `Kelas ${g}` })), "Pilih kelas");
  const wantG = force.grade ? String(force.grade) : keep.g;
  $(ids.grade).value = grades.map(String).includes(wantG) ? wantG : "";
}

// Isi pilihan format dokumen sesuai kurikulum (KBC atau bukan).
//   wanted     : format yang diinginkan; dipakai kalau masih cocok
//   keepLegacy : true agar format milik modul lama tetap muncul walau tidak cocok
function fillFormatSelect(select, curriculumLabel, hasCurriculum, wanted, keepLegacy) {
  const kbc = isKbcLabel(curriculumLabel);
  const keys = Object.keys(MODULE_TEMPLATES).filter(k => !hasCurriculum || MODULE_TEMPLATES[k].kbc === kbc);
  if (keepLegacy && wanted && MODULE_TEMPLATES[wanted] && !keys.includes(wanted)) keys.push(wanted);
  select.replaceChildren(...keys.map(k => el("option", { value: k, text: MODULE_TEMPLATES[k].label })));
  select.value = keys.includes(wanted) ? wanted : keys[0];
}