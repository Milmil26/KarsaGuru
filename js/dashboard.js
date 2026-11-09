// Tanggal hari ini
const todayDate = document.getElementById("todayDate");
if (todayDate) {
  todayDate.textContent = new Date().toLocaleDateString("id-ID", {
    weekday: "long", day: "numeric", month: "long", year: "numeric"
  });
}

// Dokumen terbaru: gabungan modul, LKPD, media, dan ATP (butuh ui-helpers.js)
const RECENT_SOURCES = [
  { table: "teaching_modules", label: "Modul Ajar", href: "modul.html" },
  { table: "worksheets", label: "LKPD", href: "lkpd.html" },
  { table: "learning_media", label: "Media", href: "media.html" }
];

async function loadRecent() {
  const list = $("recentList");
  const empty = $("recentEmpty");
  if (!list || !empty) return;

  const results = await Promise.all(RECENT_SOURCES.map(async source => {
    const { data, error } = await db.from(source.table)
      .select("id, title, updated_at")
      .order("updated_at", { ascending: false })
      .limit(5);
    if (error) {
      console.error(source.table, error);
      return [];
    }
    return data.map(row => ({ ...row, source }));
  }));

  const rows = results.flat()
    .sort((a, b) => new Date(b.updated_at) - new Date(a.updated_at))
    .slice(0, 6);
  if (!rows.length) return; // tetap tampilkan empty state

  list.replaceChildren(...rows.map(row => el("a", { class: "recent-item", href: row.source.href },
    el("b", { text: row.title }),
    el("small", { text: `${row.source.label} · ${formatDate(row.updated_at)}` })
  )));
  list.hidden = false;
  empty.hidden = true;
}

(async () => {
  await appReady;
  try {
    await loadRecent();
  } catch (error) {
    console.error(error);
  }
})();
