/* ================================================================
   coi-serviceworker.js
   ----------------------------------------------------------------
   File PHỤ, TÙY CHỌN cho chess-analysis.html.

   Mục đích: bật "cross-origin isolation" (COOP/COEP) bằng một Service
   Worker cùng nguồn gốc, để trình duyệt cấp SharedArrayBuffer — điều
   kiện bắt buộc để chạy bản Stockfish ĐA LUỒNG (nhanh hơn nhiều lần so
   với bản 1 luồng). Cách này không cần cấu hình header phía server.

   HOÀN TOÀN TÙY CHỌN:
   - Nếu bạn đặt file này cùng thư mục với chess-analysis.html và mở
     trang qua http:// hoặc https:// (không phải file://), engine sẽ tự
     phát hiện và dùng bản đa luồng.
   - Nếu không có file này (hoặc mở trang bằng file://, nơi Service
     Worker bị trình duyệt chặn), trang vẫn hoạt động bình thường với
     bản Stockfish 1 luồng đã được tối ưu — không có gì bị hỏng.

   Kỹ thuật dựa trên mẫu "coi-serviceworker" được cộng đồng WebAssembly
   dùng phổ biến (đăng ký SW cùng nguồn gốc để tự thêm header COOP/COEP
   vào các response, sau đó tải lại trang đúng một lần).
   ================================================================ */
(function () {
  const RELOAD_FLAG = 'coiReloadedOnce';

  if (typeof window !== 'undefined') {
    // ---- Ngữ cảnh trang chính ----
    if (window.crossOriginIsolated === true) return; // đã bật rồi, không cần làm gì
    if (!('serviceWorker' in navigator)) return; // trình duyệt/ngữ cảnh không hỗ trợ (vd. file://)

    const scriptUrl = document.currentScript && document.currentScript.src;
    if (!scriptUrl) return;

    navigator.serviceWorker.register(scriptUrl).then(function () {
      return navigator.serviceWorker.ready;
    }).then(function () {
      // Chỉ tải lại một lần cho mỗi phiên tab, tránh vòng lặp tải lại vô hạn
      // nếu vì lý do nào đó crossOriginIsolated vẫn không lên được true.
      if (!window.crossOriginIsolated && !sessionStorage.getItem(RELOAD_FLAG)) {
        sessionStorage.setItem(RELOAD_FLAG, '1');
        window.location.reload();
      }
    }).catch(function (err) {
      console.warn('[coi-serviceworker] Không đăng ký được — sẽ dùng Stockfish 1 luồng.', err);
    });
  } else {
    // ---- Ngữ cảnh Service Worker ----
    self.addEventListener('install', function () { self.skipWaiting(); });
    self.addEventListener('activate', function (event) { event.waitUntil(self.clients.claim()); });
    self.addEventListener('fetch', function (event) {
      const req = event.request;
      if (req.cache === 'only-if-cached' && req.mode !== 'same-origin') return;
      event.respondWith(
        fetch(req).then(function (response) {
          if (response.status === 0) return response; // response opaque, không đụng vào
          const headers = new Headers(response.headers);
          headers.set('Cross-Origin-Embedder-Policy', 'credentialless');
          headers.set('Cross-Origin-Opener-Policy', 'same-origin');
          return new Response(response.body, {
            status: response.status,
            statusText: response.statusText,
            headers: headers
          });
        }).catch(function (err) {
          console.error('[coi-serviceworker] fetch lỗi:', err);
          return fetch(req);
        })
      );
    });
  }
})();
