chrome.commands.onCommand.addListener((command) => {
  if (command === "activate_sniper") {
    // 1. Chụp màn hình tab hiện tại
    chrome.tabs.captureVisibleTab(null, { format: "png" }, (dataUrl) => {
      // 2. Gửi ảnh xuống tab đang mở để người dùng cắt
      chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        if (tabs[0]) {
          chrome.tabs.sendMessage(tabs[0].id, {
            action: "init_crop",
            screenshotUrl: dataUrl
          });
        }
      });
    });
  }
});