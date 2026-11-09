// Pemanggil Edge Function generate-draft. Dipakai halaman Modul Ajar dan LKPD. Butuh `db` dari supabase-config.js.
async function requestDraft(payload) {
  const { data, error } = await db.functions.invoke("generate-draft", { body: payload });
  if (error) {
    let message = "";
    try { message = (await error.context.json()).error; } catch (_) { /* respons bukan JSON */ }
    throw new Error(message || "Gagal menghubungi AI. Coba lagi.");
  }
  return data;
}

// Menonaktifkan tombol selama AI bekerja (bisa sampai satu menit).
async function withAiButton(button, task) {
  const label = button.textContent;
  button.disabled = true;
  button.textContent = "AI sedang menulis...";
  try {
    await task();
  } finally {
    button.disabled = false;
    button.textContent = label;
  }
}

function refNote(result) {
  return result && result.references ? ` Mengacu pada ${result.references} bagian panduan.` : "";
}

function selectedLabel(id) {
  const select = document.getElementById(id);
  return select && select.value ? select.options[select.selectedIndex].text : "";
}
