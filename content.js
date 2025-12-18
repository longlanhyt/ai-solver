let startX, startY, isSelecting = false;
let selectionDiv = null;
let overlay = null;
let fullScreenshotImage = null;

const API_KEY = "AIzaSyCU1gZVbUgouZCytYF6DQJngoVcaXVT-5U"; 

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "init_crop") {
    fullScreenshotImage = new Image();
    fullScreenshotImage.src = request.screenshotUrl;
    fullScreenshotImage.onload = () => {
      createOverlay();
    };
  }
});

function createOverlay() {
  overlay = document.createElement("div");
  overlay.style.position = "fixed";
  overlay.style.top = "0";
  overlay.style.left = "0";
  overlay.style.width = "100%";
  overlay.style.height = "100%";
  overlay.style.zIndex = "2147483646";
  overlay.style.cursor = "crosshair";
  overlay.style.userSelect = "none";
  
  overlay.addEventListener("mousedown", onMouseDown);
  document.body.appendChild(overlay);
}

function onMouseDown(e) {
  isSelecting = true;
  startX = e.clientX;
  startY = e.clientY;

  selectionDiv = document.createElement("div");

  selectionDiv.style.border = "1px dashed rgba(255, 0, 0, 0.3)"; 
  selectionDiv.style.position = "fixed";
  selectionDiv.style.left = startX + "px";
  selectionDiv.style.top = startY + "px";
  selectionDiv.style.zIndex = "2147483647";
  document.body.appendChild(selectionDiv);

  overlay.addEventListener("mousemove", onMouseMove);
  overlay.addEventListener("mouseup", onMouseUp);
}

function onMouseMove(e) {
  if (!isSelecting) return;
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
  isSelecting = false;
  const endX = e.clientX;
  const endY = e.clientY;
  
  overlay.remove();
  selectionDiv.remove();
  
  const cropWidth = Math.abs(endX - startX);
  const cropHeight = Math.abs(endY - startY);

  if (cropWidth < 10 || cropHeight < 10) return;

  const canvas = document.createElement("canvas");
  canvas.width = cropWidth;
  canvas.height = cropHeight;
  const ctx = canvas.getContext("2d");
  const dpr = window.devicePixelRatio || 1;
  const cropX = Math.min(startX, endX);
  const cropY = Math.min(startY, endY);
  
  ctx.drawImage(
    fullScreenshotImage,
    cropX * dpr, cropY * dpr, cropWidth * dpr, cropHeight * dpr,
    0, 0, cropWidth, cropHeight
  );

  const croppedDataUrl = canvas.toDataURL("image/jpeg");
    const answer = await callGemini(croppedDataUrl);
  showResult(endX, endY, answer);
}

function showResult(x, y, text) {
  const old = document.getElementById("ai-result-tag");
  if (old) old.remove();

  const el = document.createElement("div");
  el.id = "ai-result-tag";
  el.innerText = text;
  el.style.position = "fixed";
  el.style.left = (x + 5) + "px";
  el.style.top = (y + 5) + "px";
  

  el.style.fontSize = "11px";       
  el.style.color = "#888";         
  el.style.opacity = "0.25";      
  el.style.backgroundColor = "transparent"; 
  el.style.pointerEvents = "none";
  el.style.zIndex = "2147483647";
  el.style.fontFamily = "Arial, sans-serif";
  
  
  el.style.mixBlendMode = "difference"; 

  document.body.appendChild(el);
  
  
  setTimeout(() => {
      if(el) el.remove();
  }, 7000);
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

    if (data.error) return "!"; 

    const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
    return text ? text.trim() : "?";

  } catch (err) {
    return ""; 
  }
}