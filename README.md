# iPod Transfer 🎶

A sleek, offline-first native desktop application for extracting all of your music, podcasts, photos, and voice memos from an old or disconnected iPod—without needing iTunes syncing!

<div align="center">
  <img src="frontend/src/assets/hero.png" width="600" alt="iPod Transfer App Screenshot" />
</div>

## Features ✨

*   **Autodetects your iPod:** Automatically scans your Volumes and deeply analyzes the hidden folders for media.
*   **Intelligent Discovery:** Sorts through raw bytes to bring back proper metadata including artists, track names, durations, and sizes.
*   **Selective Extraction:** Don't want everything? No problem! Use checkboxes to selectively extract individual songs or select an entire category (like just your Podcasts).
*   **Fully Native Desktop App:** Bundled with Electron for a buttery-smooth desktop experience.
*   **Safe Extraction:** Copies files perfectly without modifying, deleting, or altering your iPod's database in any way. Never lose a track to iTunes Sync again.

## Getting Started 🚀

### For General Users (Download & Run)
You can directly download the fully compiled application for your operating system:
1. Navigate to the **[Releases / Actions tab](../../actions)** of this repository.
2. Under the most recent completed build, scroll down to the **Artifacts** section.
3. Download the version for your computer:
   * **Mac:** Download the `.dmg` and drag to your Applications folder.
   * **Windows:** Download the `.exe` and run the installer.

### For Developers (Run Locally)

If you'd like to tweak the UI or add your own extraction rules, it's very easy to run locally:

1. **Clone the repository:**
   ```bash
   git clone https://github.com/Daymolad/ipod-transfer.git
   cd ipod-transfer
   ```
2. **Install dependencies:**
   ```bash
   npm install
   ```
3. **Start the local desktop app:**
   ```bash
   npm start
   ```

## How To Use The App 📸

### Step 1: Scan Your Device
Plug in your iPod via USB. Ensure your computer recognizes it as an external drive (it should appear in your device folder/finder).
Select it from the configuration menu on the left side of the app and click **Scan Device**.

> *Note: Scanning might take a minute if you have 10,000+ songs as the app is reading ID3 tags locally!*

### Step 2: Select Your Media
Once scanned, your media will populate on the right panel.
- **Filter by Category:** Click the tabs (Music, Podcast, Voice Recording) at the top to filter items.
- **Select Media:** Check the boxes next to individual items you want to keep, or click the **Select All** checkbox to grab the entire folder.

### Step 3: Extract!
1. Set an extraction path on your local drive (e.g., `/Users/Daymo/Music/Extracted`).
2. Hit **Start Transfer**.
3. Watch the progress bar as your files orchestrate their way to safety. 

Your extracted items will be automatically placed into folders based on their `Category / Artist / Title` so they are fully organized!

---
*Created with Electron, Vite, React, and Node.*
