// Cloudflare Pages Function
// Shortlink redirect + UTM forwarding
// Destination: https://v-dey.com/player/player.html

const DEST_BASE = "https://v-dey.com/player/player.html";

// Hanya parameter UTM berikut yang boleh diteruskan.
const ALLOWED_UTM = new Set([
  "utm_source",
  "utm_medium",
  "utm_campaign",
  "utm_content",
  "utm_term"
]);

// Metadata campaign opsional untuk setiap shortlink.
//
// Contoh:
// "abc123": {
//   utm_source: "telegram",
//   utm_medium: "social",
//   utm_campaign: "organic_share"
// }

const CAMPAIGNS = {};

/**
 * Membersihkan nilai UTM.
 * - Hanya menerima string.
 * - Menghapus spasi di awal dan akhir.
 * - Mengabaikan nilai kosong.
 * - Membatasi panjang nilai menjadi 200 karakter.
 */
function cleanUtmValue(value) {
  if (typeof value !== "string") {
    return "";
  }

  const trimmed = value.trim();

  if (!trimmed) {
    return "";
  }

  return trimmed.slice(0, 200);
}

/**
 * Handler utama Cloudflare Pages Function.
 */
export async function onRequest(context) {
  const { request } = context;
  const url = new URL(request.url);

  // Pertahankan perilaku URL root.
  const rawPath = url.pathname.replace(/^\/+|\/+$/g, "");

  // Root dan /index.html tetap menggunakan file statis.
  if (rawPath === "" || rawPath === "index.html") {
    return context.next();
  }

  // Pertahankan perilaku :splat dari rule lama.
  // Seluruh path setelah slash menjadi nilai ID.
  const id = rawPath;

  // Validasi ID.
  if (
    id.length > 256 ||
    /[\u0000-\u001F\u007F]/.test(id)
  ) {
    return new Response("Invalid shortlink ID", {
      status: 400,
      headers: {
        "Content-Type": "text/plain; charset=UTF-8",
        "Cache-Control": "no-store"
      }
    });
  }

  // Destination selalu menggunakan domain tetap.
  // Parameter pengunjung tidak dapat mengubah host tujuan.
  const destination = new URL(DEST_BASE);

  // Pasang ID shortlink.
  destination.searchParams.set("id", id);

  // Ambil metadata campaign yang telah ditentukan.
  // Metadata ini memiliki prioritas dibandingkan UTM pengunjung.
  const predefined = CAMPAIGNS[id] || {};

  for (const [key, value] of Object.entries(predefined)) {
    if (!ALLOWED_UTM.has(key)) {
      continue;
    }

    const clean = cleanUtmValue(value);

    if (clean) {
      destination.searchParams.set(key, clean);
    }
  }

  // Teruskan hanya parameter UTM yang diizinkan.
  // Jangan timpa nilai UTM yang telah ditentukan oleh campaign.
  for (const key of ALLOWED_UTM) {
    if (destination.searchParams.has(key)) {
      continue;
    }

    const clean = cleanUtmValue(
      url.searchParams.get(key)
    );

    if (clean) {
      destination.searchParams.set(key, clean);
    }
  }

  // Gunakan redirect 301 untuk mempertahankan perilaku lama.
  return Response.redirect(destination.toString(), 301);
}
