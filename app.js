const $ = id => document.getElementById(id);
$("year").textContent = new Date().getFullYear();

const bytesToMbps = (bytes, ms) => bytes * 8 / (ms / 1000) / 1e6;

async function measurePing() {
  const samples = [];
  for (let i = 0; i < 5; i++) {
    const start = performance.now();
    const response = await fetch("https://speed.cloudflare.com/__down?bytes=0&cb=" + Math.random(), { cache: "no-store" });
    if (!response.ok) throw new Error("Permintaan ping gagal (HTTP " + response.status + ")");
    await response.arrayBuffer();
    samples.push(performance.now() - start);
  }
  const ping = samples.reduce((a,b) => a+b, 0) / samples.length;
  const jitter = samples.slice(1).reduce((sum,v,i) => sum + Math.abs(v-samples[i]), 0) / (samples.length-1);
  return { ping, jitter };
}

async function measureDownload() {
  const size = 5 * 1024 * 1024;
  const start = performance.now();
  const response = await fetch("https://speed.cloudflare.com/__down?bytes=" + size + "&cb=" + Math.random(), { cache: "no-store" });
  if (!response.ok) throw new Error("Tes download gagal (HTTP " + response.status + ")");
  const blob = await response.blob();
  return bytesToMbps(blob.size, performance.now() - start);
}

async function measureUpload() {
  const size = 2 * 1024 * 1024;
  const payload = new Uint8Array(size);
  crypto.getRandomValues(payload);
  const start = performance.now();
  const response = await fetch("https://speed.cloudflare.com/__up?cb=" + Math.random(), {
    method: "POST", body: payload, headers: { "Content-Type": "application/octet-stream" }, cache: "no-store"
  });
  if (!response.ok) throw new Error("Tes upload gagal (HTTP " + response.status + ")");
  await response.arrayBuffer();
  return bytesToMbps(size, performance.now() - start);
}

function showMetric(id, value, unit) {
  $(id).innerHTML = `${value.toFixed(1)} <small>${unit}</small>`;
}

// Menggabungkan hasil aktual tes, jumlah perangkat, dan aktivitas rumah.
function makeAdvice(result) {
  const deviceFactor = Number($("devices").value);
  const usage = $("usage").value;
  const house = $("house").value;
  const usageBase = { basic: 15, stream: 30, heavy: 50, "4k": 75 }[usage];
  const deviceExtra = {1:0, 2:15, 3:35, 4:60}[deviceFactor];
  const target = usageBase + deviceExtra;
  const tiers = target <= 30 ? "30–50 Mbps" : target <= 60 ? "50–100 Mbps" : target <= 100 ? "100 Mbps" : "100–200 Mbps";
  let quality;
  if (result.download < target * 0.5) quality = "Kecepatan sekarang jauh di bawah perkiraan kebutuhan rumah. Pertimbangkan upgrade paket atau periksa router, posisi perangkat, dan gangguan WiFi.";
  else if (result.download < target) quality = "Kecepatan sekarang mendekati kebutuhan, tetapi bisa melambat saat banyak perangkat aktif. Paket dengan kapasitas lebih tinggi dapat memberi ruang tambahan.";
  else quality = "Kecepatan sekarang memenuhi perkiraan kebutuhan yang dipilih. Upgrade paket belum tentu diperlukan; periksa kestabilan saat jam sibuk.";

  let latency = result.ping < 30 ? "Ping tergolong responsif." : result.ping < 60 ? "Ping sedang; video call umumnya masih nyaman, tetapi gaming kompetitif bisa terasa." : "Ping cukup tinggi; untuk gaming/video call, coba dekatkan perangkat ke router atau gunakan kabel LAN.";
  if (result.jitter > 20) latency += " Jitter tinggi, sehingga respons bisa terasa tidak stabil.";

  const router = house === "large"
    ? "Untuk rumah besar/2 lantai: pertimbangkan sistem mesh WiFi 6 dua unit atau lebih, atau access point tambahan. Letakkan node di area yang masih mendapat sinyal baik."
    : house === "medium"
      ? "Untuk rumah sedang: router dual-band WiFi 6 (AX) dapat menjadi pilihan. Letakkan di area tengah dan terbuka."
      : "Untuk rumah kecil: router dual-band WiFi 5 (AC) atau WiFi 6 (AX) sudah dapat dipertimbangkan; pilih sesuai jumlah perangkat dan anggaran.";

  const uploadNote = result.upload < 5
    ? "Upload di bawah 5 Mbps: jika sering video call, mengirim file, atau live streaming, cari paket dengan upload lebih tinggi."
    : result.upload < 15
      ? "Upload cukup untuk penggunaan umum; untuk kerja cloud dan banyak video call, periksa kecepatan upload paket ISP."
      : "Upload terukur cukup lega untuk video call dan berbagi file dalam penggunaan rumah biasa.";

  $("recommendation").innerHTML = `<b>Target perkiraan rumah: ${tiers}</b><br>${quality}<br>${latency}<br>${uploadNote}<br><b>Catatan:</b> kebutuhan dihitung dari aktivitas dan jumlah perangkat yang kamu pilih.`;
  $("routerAdvice").innerHTML = `<b>Saran perangkat WiFi</b><br>${router}<br>Utamakan router dual-band 2,4 GHz + 5 GHz, standar WPA2-AES/WPA3, dan port Gigabit jika paket internet di atas 100 Mbps.`;
}

$("startBtn").addEventListener("click", async () => {
  const button = $("startBtn");
  button.disabled = true;
  const result = {};
  try {
    $("phase").textContent = "MENGUJI PING";
    $("status").textContent = "Mengukur waktu respons…";
    $("speed").innerHTML = "…<small>ms</small>";
    const p = await measurePing();
    result.ping = p.ping; result.jitter = p.jitter;
    showMetric("ping", p.ping, "ms"); showMetric("jitter", p.jitter, "ms");

    $("phase").textContent = "DOWNLOAD";
    $("status").textContent = "Mengukur download (sekitar 5 MB)…";
    $("speed").innerHTML = "…<small>Mbps</small>";
    result.download = await measureDownload();
    showMetric("download", result.download, "Mbps");
    $("speed").innerHTML = `${result.download.toFixed(1)}<small>Mbps</small>`;

    $("phase").textContent = "UPLOAD";
    $("status").textContent = "Mengukur upload (sekitar 2 MB data uji)…";
    result.upload = await measureUpload();
    showMetric("upload", result.upload, "Mbps");
    $("speed").innerHTML = `${result.upload.toFixed(1)}<small>Mbps</small>`;

    $("phase").textContent = "SELESAI";
    lastResult = result; makeAdvice(result);
    $("status").textContent = "Tes selesai pada " + new Date().toLocaleString("id-ID") + ".";
  } catch (error) {
    console.error(error);
    $("phase").textContent = "GAGAL";
    $("status").textContent = "Tes gagal: " + error.message + ". Periksa internet, lalu coba lagi.";
  } finally {
    button.disabled = false;
  }
});

// Perbarui saran setelah pilihan kebutuhan diubah, jika hasil tes sudah tersedia.
let lastResult = null;
const originalMakeAdvice = makeAdvice;
function updateAdvice(result) { lastResult = result; originalMakeAdvice(result); }
["devices","usage","house"].forEach(id => $(id).addEventListener("change", () => {
  if (lastResult) originalMakeAdvice(lastResult);
}));
// Ganti pemanggilan fungsi global agar hasil tes terakhir bisa dipakai ulang.
