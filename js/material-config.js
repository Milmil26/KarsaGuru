// Daftar isian LKPD dan jenis media. Ubah di sini kalau formatmu berbeda.
//
// LKPD_SECTIONS: struktur umum LKPD (bukan template resmi).
//   key   : slug unik, jangan diubah kalau sudah ada data
//   label : nama yang tampil
//   hint  : petunjuk singkat
const LKPD_SECTIONS = [
  { key: "identitas", label: "Identitas", hint: "Nama siswa atau kelompok, kelas, dan tanggal." },
  { key: "tujuan", label: "Tujuan", hint: "Apa yang akan dicapai siswa lewat lembar kerja ini." },
  { key: "petunjuk", label: "Petunjuk pengerjaan", hint: "Cara mengerjakan lembar kerja, langkah demi langkah." },
  { key: "informasi", label: "Informasi pendukung", hint: "Ringkasan materi atau bahan singkat yang dibutuhkan siswa." },
  { key: "alat_bahan", label: "Alat dan bahan", hint: "Kosongkan kalau tidak diperlukan." },
  { key: "kegiatan", label: "Langkah kegiatan atau tugas", hint: "Kegiatan yang dikerjakan siswa." },
  { key: "soal", label: "Soal atau pertanyaan", hint: "Pertanyaan untuk menguji pemahaman." },
  { key: "refleksi", label: "Refleksi", hint: "Pertanyaan agar siswa merenungkan apa yang sudah dipelajari." }
];

// MEDIA_TYPES: jenis media. key disimpan di database, label yang tampil.
const MEDIA_TYPES = [
  { key: "presentasi", label: "Presentasi" },
  { key: "poster", label: "Poster atau infografis" },
  { key: "video", label: "Video" },
  { key: "permainan", label: "Permainan atau kuis" },
  { key: "alat_peraga", label: "Alat peraga" },
  { key: "lainnya", label: "Lainnya" }
];
// LKPD_THEMES: tema warna LKPD saat dicetak. key disimpan di content.theme, label yang tampil.
// Warnanya didefinisikan di css/cetak.css (kelas theme-<key>).
const LKPD_THEMES = [
  { key: "biru", label: "Biru" },
  { key: "koral", label: "Koral" },
  { key: "mint", label: "Hijau mint" },
  { key: "matahari", label: "Kuning" }
];
