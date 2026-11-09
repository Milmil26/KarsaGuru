// Format dokumen yang bisa dipilih guru per modul. Halaman Modul Ajar, wizard, dan cetak membaca daftar ini.
//
// Tiap format punya:
//   label / shortLabel / description : teks yang tampil
//   kbc        : true untuk format Kurikulum Berbasis Cinta (madrasah), false untuk Kurikulum Merdeka umum
//   print      : cara judul dan penomoran dicetak
//                  title, titleWithSubject, subtitle ({tahun} diganti tahun ajaran),
//                  groupNumbering ("roman", "letters", atau "none"), signatureRole
//   groups     : pengaturan per kelompok (opsional)
//                  style: "blocks" (A. JUDUL), "inline" (label tebal: isi), "lower" (a. judul),
//                         "numbers" (1. judul), "sections" (kelompok berisi bagian A., B.)
//                  appendix: true untuk kelompok yang dicetak setelah tanda tangan
//   components : daftar komponen, masing-masing berisi
//     key     : slug unik (huruf kecil, angka, underscore). Jangan diubah kalau sudah ada data.
//     group   : judul kelompok di halaman
//     section : (opsional) bagian di dalam kelompok bergaya "sections"
//     label   : nama yang tampil
//     hint    : petunjuk singkat (juga dipakai sebagai arahan untuk AI)
//
// Key yang sama di beberapa format berbagi isi (identitas_modul, tujuan_pembelajaran, dst),
// jadi tidak perlu mengetik ulang saat berpindah format.
// Mau menambah format baru? Tambahkan satu objek lagi di sini, tanpa perubahan database.
const DEFAULT_TEMPLATE = "modul_ajar";

const MODULE_TEMPLATES = {
  // Contoh: Modul Ajar Kurikulum Merdeka untuk SD, SMP, SMA (tanpa KBC)
  modul_ajar: {
    label: "Modul Ajar (Kurikulum Merdeka)",
    shortLabel: "Modul Ajar",
    kbc: false,
    description: "Modul Ajar Kurikulum Merdeka untuk SD, SMP, dan SMA: informasi umum, komponen inti, dan lampiran.",
    print: { title: "MODUL AJAR", titleWithSubject: true, groupNumbering: "none", signatureRole: "Guru Mata Pelajaran" },
    groups: {
      "Informasi umum": { style: "blocks" },
      "Komponen inti": { style: "blocks" },
      "Lampiran": { style: "blocks", appendix: true }
    },
    components: [
      { key: "identitas_modul", group: "Informasi umum", label: "Identitas modul", hint: "Satu baris per isian, berformat 'Label: isi'. Penyusun, tahun penyusunan, jenjang sekolah, mata pelajaran, fase dan kelas, bab atau tema, materi pembelajaran, alokasi waktu." },
      { key: "kompetensi_awal", group: "Informasi umum", label: "Kompetensi awal", hint: "Kemampuan yang sudah dimiliki siswa sebelum mempelajari materi ini." },
      { key: "profil_lulusan", group: "Informasi umum", label: "Profil Pelajar Pancasila", hint: "Dimensi profil yang ingin dikuatkan lewat pembelajaran ini." },
      { key: "sarana_prasarana", group: "Informasi umum", label: "Sarana dan prasarana", hint: "Sumber belajar, alat, bahan, dan media yang dibutuhkan." },
      { key: "target_peserta_didik", group: "Informasi umum", label: "Target peserta didik", hint: "Peserta didik reguler dan berpencapaian tinggi, beserta ciri-cirinya." },
      { key: "jumlah_peserta_didik", group: "Informasi umum", label: "Jumlah peserta didik", hint: "Jumlah minimum dan maksimum peserta didik." },
      { key: "model_pembelajaran", group: "Informasi umum", label: "Model pembelajaran", hint: "Jenis pembelajaran (tatap muka), model, pendekatan, dan metode." },

      { key: "capaian_pembelajaran", group: "Komponen inti", label: "Capaian pembelajaran", hint: "Capaian Pembelajaran (CP) sesuai fase dan mata pelajaran." },
      { key: "tujuan_pembelajaran", group: "Komponen inti", label: "Tujuan kegiatan pembelajaran", hint: "Bisa disalin dari TP yang kamu pilih. Disusun dengan kata kerja operasional." },
      { key: "pemahaman_bermakna", group: "Komponen inti", label: "Pemahaman bermakna", hint: "Manfaat yang akan dirasakan siswa setelah belajar." },
      { key: "pertanyaan_pemantik", group: "Komponen inti", label: "Pertanyaan pemantik", hint: "Pertanyaan untuk memancing rasa ingin tahu dan diskusi." },
      { key: "kegiatan_pembelajaran", group: "Komponen inti", label: "Kegiatan pembelajaran", hint: "Pendahuluan, inti (sesuai sintaks model), dan penutup dengan alokasi menit, per pertemuan." },
      { key: "refleksi", group: "Komponen inti", label: "Refleksi", hint: "Pertanyaan refleksi untuk guru dan siswa. Boleh berbentuk tabel." },
      { key: "asesmen", group: "Komponen inti", label: "Asesmen / penilaian", hint: "Penilaian sikap, pengetahuan, dan keterampilan beserta contoh instrumen atau rubriknya." },
      { key: "pengayaan_remedial", group: "Komponen inti", label: "Kegiatan pengayaan dan remedial", hint: "Kegiatan lanjutan untuk siswa yang sudah dan belum mencapai tujuan." },
      { key: "bahan_bacaan", group: "Komponen inti", label: "Bahan bacaan guru dan peserta didik", hint: "Materi singkat yang ramah siswa." },
      { key: "glosarium", group: "Komponen inti", label: "Glosarium", hint: "Daftar istilah penting beserta artinya." },
      { key: "daftar_pustaka", group: "Komponen inti", label: "Daftar pustaka", hint: "Sumber rujukan yang dipakai." },

      { key: "lampiran", group: "Lampiran", label: "Lampiran", hint: "Media pembelajaran, LKPD, dan lembar evaluasi (soal beserta pilihan jawaban) yang dipakai." }
    ]
  },

  // Disusun dari empat contoh RPP di Lampiran 2 Panduan KBC (SK Dirjen Pendis No. 6077 Tahun 2025).
  // Tema KBC diambil dari pilihan "Nilai KBC" di form, jadi tidak ada komponen terpisah untuknya.
  rpp_kbc: {
    label: "Modul Ajar KBC (format Panduan KBC)",
    shortLabel: "Modul Ajar KBC",
    kbc: true,
    description: "Format RPP contoh Panduan KBC madrasah: identitas, tujuan, kegiatan, dan asesmen.",
    print: { title: "RENCANA PELAKSANAAN PEMBELAJARAN", subtitle: "Kurikulum Berbasis Cinta", groupNumbering: "none", signatureRole: "Guru Mata Pelajaran" },
    groups: {
      "Identitas": { style: "inline" },
      "Tujuan pembelajaran": { style: "inline" },
      "Kegiatan pembelajaran": { style: "inline" },
      "Asesmen dan evaluasi": { style: "inline" }
    },
    components: [
      { key: "identitas_modul", group: "Identitas", label: "Identitas", hint: "Satu baris per isian, berformat 'Label: isi'. Mata pelajaran, fase dan kelas, materi pokok, alokasi waktu." },
      { key: "materi_insersi", group: "Identitas", label: "Materi insersi KBC", hint: "Materi cinta yang disisipkan. Tema KBC-nya dipilih di bagian Nilai KBC di atas." },

      { key: "tujuan_pembelajaran", group: "Tujuan pembelajaran", label: "Tujuan pembelajaran", hint: "Bisa disalin dari TP yang kamu pilih di atas." },
      { key: "iktp", group: "Tujuan pembelajaran", label: "Indikator ketercapaian tujuan pembelajaran (IKTP)", hint: "Indikator yang menunjukkan tujuan sudah tercapai." },

      { key: "model_pembelajaran", group: "Kegiatan pembelajaran", label: "Model pembelajaran", hint: "Contoh: Discovery Learning, Project Based Learning." },
      { key: "kegiatan_pendahuluan", group: "Kegiatan pembelajaran", label: "Pendahuluan", hint: "Salam, doa, apersepsi, dan penyampaian tujuan." },
      { key: "kegiatan_inti", group: "Kegiatan pembelajaran", label: "Kegiatan inti", hint: "Langkah-langkah sesuai model yang dipilih." },
      { key: "kegiatan_penutup", group: "Kegiatan pembelajaran", label: "Penutup", hint: "Kesimpulan, refleksi, tugas, doa, dan salam." },

      { key: "asesmen_formatif", group: "Asesmen dan evaluasi", label: "Asesmen formatif", hint: "Kuis singkat, observasi proses, dan sejenisnya." },
      { key: "asesmen_sumatif", group: "Asesmen dan evaluasi", label: "Asesmen sumatif", hint: "Produk atau tugas akhir yang dinilai." },
      { key: "asesmen_sikap", group: "Asesmen dan evaluasi", label: "Asesmen sikap", hint: "Observasi sikap dan penilaian komitmen siswa." }
    ]
  },

  // Contoh: Perencanaan Pembelajaran Mendalam (PPM) berbasis KBC untuk MI, MTs, MA
  ppm_kbc: {
    label: "Perencanaan Pembelajaran Mendalam (PPM) + KBC",
    shortLabel: "PPM",
    kbc: true,
    description: "PPM untuk MI, MTs, dan MA: identifikasi, desain pembelajaran, pengalaman belajar (berkesadaran, bermakna, menggembirakan), dan asesmen.",
    print: { title: "PERENCANAAN PEMBELAJARAN MENDALAM (PPM)", subtitle: "TAHUN PELAJARAN {tahun}", groupNumbering: "roman", signatureRole: "Guru Mata Pelajaran" },
    groups: {
      "Identifikasi": { style: "sections" },
      "Desain pembelajaran": { style: "inline" },
      "Pengalaman belajar": { style: "lower" },
      "Asesmen": { style: "inline" },
      "Tambahan pendukung": { style: "numbers" },
      "Lampiran": { style: "blocks", appendix: true }
    },
    components: [
      { key: "identitas_modul", group: "Identifikasi", section: "Identifikasi umum", label: "Identifikasi umum", hint: "Satu baris per isian, berformat 'Label: isi'. Nama pendidik, nama madrasah, mata pelajaran, fase dan kelas, materi pokok, bab, tema Kurikulum Berbasis Cinta, alokasi waktu, model pembelajaran, semester, jumlah anak." },
      { key: "target_peserta_didik", group: "Identifikasi", section: "Identifikasi khusus", label: "Identifikasi peserta didik", hint: "Karakteristik peserta didik pada kelas ini dan cara belajar yang cocok bagi mereka." },
      { key: "identifikasi_materi", group: "Identifikasi", section: "Identifikasi khusus", label: "Identifikasi materi pelajaran", hint: "Tujuan materi dan contoh penerapannya dalam kehidupan siswa." },
      { key: "profil_lulusan", group: "Identifikasi", section: "Identifikasi khusus", label: "Dimensi profil pelajar", hint: "Dimensi profil yang dikuatkan lewat pembelajaran ini." },
      { key: "materi_insersi", group: "Identifikasi", section: "Identifikasi khusus", label: "Materi insersi Kurikulum Berbasis Cinta", hint: "Nilai cinta yang disisipkan, misalnya sikap teliti, jujur, dan rasa syukur." },

      { key: "capaian_pembelajaran", group: "Desain pembelajaran", label: "Capaian pembelajaran", hint: "Capaian Pembelajaran (CP) sesuai fase dan mata pelajaran." },
      { key: "topik_pembelajaran", group: "Desain pembelajaran", label: "Topik pembelajaran", hint: "Topik dalam satu kalimat yang dekat dengan kehidupan sehari-hari siswa." },
      { key: "tujuan_pembelajaran", group: "Desain pembelajaran", label: "Tujuan pembelajaran", hint: "Bisa disalin dari TP yang kamu pilih." },
      { key: "kktp", group: "Desain pembelajaran", label: "Kriteria ketercapaian tujuan pembelajaran (KKTP)", hint: "Daftar kriteria yang menunjukkan tujuan tercapai, satu butir per baris." },
      { key: "praktik_pedagogis", group: "Desain pembelajaran", label: "Praktik pedagogis", hint: "Model dan metode yang dipakai dalam pembelajaran mendalam." },
      { key: "sarana_prasarana", group: "Desain pembelajaran", label: "Sarana", hint: "Buku, alat, dan benda konkret yang dibutuhkan." },
      { key: "lingkungan_pembelajaran", group: "Desain pembelajaran", label: "Lingkungan pembelajaran", hint: "Tempat belajar, misalnya halaman madrasah atau kelas." },
      { key: "pemanfaatan_media", group: "Desain pembelajaran", label: "Pemanfaatan media", hint: "Media yang dipakai dan fungsinya." },
      { key: "kemitraan_pembelajaran", group: "Desain pembelajaran", label: "Kemitraan pembelajaran", hint: "Pihak yang dilibatkan, misalnya orang tua, dan bentuk keterlibatannya." },

      { key: "pengalaman_awal", group: "Pengalaman belajar", label: "Tahap awal: berkesadaran dan bermakna", hint: "Dengan alokasi menit: dukungan guru (mindful), pernyataan guru, pertanyaan pemantik, dan insersi nilai cinta." },
      { key: "pengalaman_inti", group: "Pengalaman belajar", label: "Tahap inti: meaningful, model pembelajaran, joyful", hint: "Dengan alokasi menit: memahami (conceptual), mengaplikasi (sesuai model), dan merefleksi (deep thinking)." },
      { key: "pengalaman_penutup", group: "Pengalaman belajar", label: "Tahap penutup: penguatan karakter", hint: "Dengan alokasi menit: berkesadaran, bermakna, dan menggembirakan." },

      { key: "asesmen", group: "Asesmen", label: "Asesmen", hint: "Asesmen awal, asesmen proses, dan asesmen akhir." },

      { key: "lka", group: "Tambahan pendukung", label: "Lembar kerja anak (LKA)", hint: "Isi lembar kerja yang dikerjakan siswa." },
      { key: "instrumen_asesmen", group: "Tambahan pendukung", label: "Instrumen asesmen", hint: "Penilaian sikap, pengetahuan, dan keterampilan beserta tabel pengamatan dan rubrik skor 4 sampai 1." },
      { key: "pengayaan_remedial", group: "Tambahan pendukung", label: "Pengayaan dan remedial", hint: "Kegiatan lanjutan untuk siswa yang sudah dan belum tuntas." },
      { key: "refleksi", group: "Tambahan pendukung", label: "Refleksi guru dan peserta didik", hint: "Pertanyaan refleksi untuk guru dan untuk peserta didik." },

      { key: "lampiran", group: "Lampiran", label: "Lampiran", hint: "Materi pembelajaran (bahan ajar) dan media yang dipakai." }
    ]
  }
};