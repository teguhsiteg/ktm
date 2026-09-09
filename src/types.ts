export interface Mahasiswa {
  id: string;
  nama: string;
  nim: string;
  prodi: string;
  ttl?: string; // Tanggal Lahir / TTL (legacy)
  upcm?: string; // No. UPCM
  status_ktm: 'Tersedia' | 'Belum tersedia' | 'Sudah diambil';
  catatan_ktm?: string; // Catatan untuk KTM Belum Tersedia
  tanggal_ambil?: any; // Waktu pengambilan KTM
  created_at?: any;
  updated_at?: any;
}

export interface Jadwal {
  id: string;
  tanggal: string; // YYYY-MM-DD
  jam_mulai: string; // HH:mm
  jam_selesai: string; // HH:mm
  kuota: number;
  status: 'Aktif' | 'Tidak aktif';
  booked_count?: number;
}

export interface Booking {
  id: string;
  booking_id: string;
  mahasiswa_id: string;
  jadwal_id: string;
  tanggal: string;
  jam: string;
  wa: string;
  status: 'Belum Diambil' | 'Sudah Diambil' | 'Hangus';
  qr_token: string;
  created_at: any;
  updated_at: any;
}

export interface Distribusi {
  id: string;
  booking_id: string;
  admin_id: string;
  waktu_pengambilan: any;
  status: string;
  nim?: string;
}

export interface Admin {
  id: string;
  nama: string;
  email: string;
  role: string;
}

export interface ProdiMapping {
  id?: string;
  prodi: string;
  fakultas: string;
  lokasi: string;
  created_at?: any;
  updated_at?: any;
}
