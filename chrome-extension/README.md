# Chrome Extension — AI Knowledge Vault

## Installation (Developer Mode)

1. Open Chrome and go to `chrome://extensions/`
2. Enable **Developer mode** (top right toggle)
3. Click **Load unpacked**
4. Select the `chrome-extension/` folder from this project
5. The extension icon appears in your toolbar

## Features

| Feature | Description |
|---------|-------------|
| 🌐 Save Current Page | Imports the current webpage as an article via URL import |
| ▶️ Save YouTube Video | Extracts transcript + AI summary (auto-detected when on YouTube) |
| ✂️ Save Selected Text | Saves highlighted text from any webpage |
| 🖱️ Right-click menu | Save page or selection via context menu |

## Setup

1. Click the extension icon
2. Enter your Knowledge Vault email and password
3. Click **Sign In** — your JWT is stored securely in `chrome.storage.local`
4. Use the popup or right-click context menu to save content

## Notes

- The extension connects to `http://localhost:3000` (backend must be running)
- For production, update `API_BASE` in `popup.js` and `background.js`
- The extension uses the same backend API as the web app — no duplicate logic
- YouTube transcript requires captions to be enabled on the video
