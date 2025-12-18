let startX, startY, isSelecting = false;
let selectionDiv = null;
let overlay = null;
let fullScreenshotImage = null;

const API_KEY = "AIzaSyCU1gZVbUgouZCytYF6DQJngoVcaXVT-5U"; 

// Lắng nghe lệnh từ background
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "init_crop") {
    // PHÒNG VỆ: Xóa sạch dấu vết cũ trước khi chạy mới
    forceCleanup();
    
    fullScreenshotImage = new Image();
    fullScreenshotImage.src = request.screenshotUrl;
    fullScreenshotImage.onload = () => {
      createOverlay();
    };
  }
});

// Hàm dọn dẹp mọi thứ liên quan đến extension đang hiện trên màn hình
function forceCleanup() {
  const ids = ["ai-sniper-overlay", "ai-selection-rect"];
  ids.forEach(id => {
    const el = document.getElementById(id);
    if (el) el.remove();
  });
  isSelecting = false;
}

// Cho phép bấm phím ESC để thoát chế độ chụp ngay lập tức
document.addEventListener('keydown', (e) => {
  if (e.key === "Escape") forceCleanup();
});

function createOverlay() {
  overlay = document.createElement("div");
  overlay.id = "ai-sniper-overlay"; // Đặt ID để dễ quản lý
  overlay.style.cssText = `
    position: fixed; top: 0; left: 0; width: 100%; height: 100%;
    z-index: 2147483646; cursor: crosshair; user-select: none;
    background: rgba(0,0,0,0.01);
  `;
  
  overlay.addEventListener("mousedown", onMouseDown);
  document.body.appendChild(overlay);
}

function onMouseDown(e) {
  if (e.button !== 0) return; // Chỉ nhận chuột trái
  isSelecting = true;
  startX = e.clientX;
  startY = e.clientY;

  selectionDiv = document.createElement("div");
  selectionDiv.id = "ai-selection-rect";
  selectionDiv.style.cssText = `
    border: 1px dashed rgba(255, 0, 0, 0.3);
    position: fixed; z-index: 2147483647; pointer-events: none;
    left: ${startX}px; top: ${startY}px;
  `;
  document.body.appendChild(selectionDiv);

  overlay.addEventListener("mousemove", onMouseMove);
  overlay.addEventListener("mouseup", onMouseUp);
}

function onMouseMove(e) {
  if (!isSelecting || !selectionDiv) return;
  const currentX = e.clientX;
  const currentY = e.clientY;
  
  const width = Math.abs(currentX - startX);
  const height = Math.abs(currentY - startY);
  const left = Math.min(currentX, startX);
  const top = Math.min(currentY, startY);

  selectionDiv.style.width = width + "px";
  selectionDiv.style.height = height + "px";
  selectionDiv.style.left = left + "px";
  selectionDiv.style.top = top + "px";
}

async function onMouseUp(e) {
  if (!isSelecting) return;
  isSelecting = false;
  
  const endX = e.clientX;
  const endY = e.clientY;
  
  const cropWidth = Math.abs(endX - startX);
  const cropHeight = Math.abs(endY - startY);
  const cropX = Math.min(startX, endX);
  const cropY = Math.min(startY, endY);

  // Dọn dẹp giao diện ngay sau khi lấy tọa độ xong
  forceCleanup();
  
  if (cropWidth < 10 || cropHeight < 10) return;

  const canvas = document.createElement("canvas");
  canvas.width = cropWidth;
  canvas.height = cropHeight;
  const ctx = canvas.getContext("2d");
  const dpr = window.devicePixelRatio || 1;
  
  try {
    ctx.drawImage(
      fullScreenshotImage,
      cropX * dpr, cropY * dpr, cropWidth * dpr, cropHeight * dpr,
      0, 0, cropWidth, cropHeight
    );

    const croppedDataUrl = canvas.toDataURL("image/jpeg", 0.8);
    const answer = await callGemini(croppedDataUrl);
    showResult(endX, endY, answer);
  } catch (err) {
    console.error("Lỗi cắt ảnh:", err);
  } finally {
    fullScreenshotImage = null; // Giải phóng bộ nhớ
  }
}

function showResult(x, y, text) {
  const old = document.getElementById("ai-result-tag");
  if (old) old.remove();

  const el = document.createElement("div");
  el.id = "ai-result-tag";
  el.innerText = text;
  el.style.cssText = `
    position: fixed; left: ${x + 5}px; top: ${y + 5}px;
    font-size: 11px; color: #888; opacity: 0.25;
    background: transparent; pointer-events: none;
    z-index: 2147483647; font-family: Arial;
    mix-blend-mode: difference;
  `;
  document.body.appendChild(el);
  setTimeout(() => el && el.remove(), 7000);
}

async function callGemini(base64Image) {
  try {
    const rawBase64 = base64Image.split(",")[1];
    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${API_KEY}`;
    
    const payload = {
      contents: [{
        parts: [
          { text: "Solve. Return ONLY the letter (A, B, C, or D)." },
          { inline_data: { mime_type: "image/jpeg", data: rawBase64 } }
        ]
      }]
    };

    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });

    const data = await response.json();
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
    return text ? text.trim() : "?";
  } catch (err) {
    return ""; 
  }
}

