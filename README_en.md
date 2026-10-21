# TitanCore - Community Open Source Edition

<p align="center">
  <img src="build/app.ico" width="96" height="96" alt="TitanCore Logo" />
</p>

<p align="center">
  <b>A clean, transparent, and modern next-generation Steam game management and native enhancement workstation.</b>
</p>

<p align="center">
  <a href="LICENSE"><img src="https://img.shields.io/badge/License-MIT-blue.svg" alt="License" /></a>
  <a href="BUILD.md"><img src="https://img.shields.io/badge/Build-Passing-brightgreen.svg" alt="Build Status" /></a>
  <a href="package.json"><img src="https://img.shields.io/badge/Electron-v42.4.1-blueviolet.svg" alt="Electron" /></a>
  <a href="package.json"><img src="https://img.shields.io/badge/Vue-v3.5.38-42b883.svg" alt="Vue 3" /></a>
</p>

---

[中文文档 (Chinese)](README_zh.md) | [Build & Developer Guide](BUILD.md)

---

## 📖 Mission & Vision

**TitanCore** is a next-generation desktop companion engineered specifically for gamers, power users, and developers.

In an ecosystem frequently dominated by closed-source black-box utilities, unsolicited remote code execution payloads, intrusive bundling, and frequent antivirus false positives, TitanCore adheres strictly to the first principles of **"Full Open Source, Clean Codebase, Transparent Architecture, and Zero Black-Boxes"**:

1. **100% Code Transparency**: From modern frontend UI components to low-level Win32 C++ injection modules, every line of code is open for community audit;
2. **Zero-Trust & Offline-Ready**: Full standalone offline support out-of-the-box. Manage local libraries and launch routines without requiring an internet connection;
3. **Modern Technical Stack**: Powered by Vue 3, Tailwind CSS 4, Electron 42, and Win32 C++ native extensions for an ultra-responsive experience.

---

## ✨ Key Features

* 🎮 **Comprehensive Local Library**: Built-in high-performance SQLite engine (`better-sqlite3`) offering sub-millisecond retrieval of local metadata and vertical cover arts;
* ⚡ **Suspended Launch & Native Injection**: C++ native extension (`native/tc_native.cc`) implements Medium-Integrity shell token extraction and `CREATE_SUSPENDED` launch routines to prevent anti-cheat collisions;
* 🚀 **Multi-Threaded Download Engine**: Native integration with open-source `aria2c` via WebSocket JSON-RPC protocol, enabling resume capability and saturated bandwidth downloads;
* 🎨 **Dual-Mode Visual Aesthetic**:
  * **Minimal Tech**: Industrial obsidian textures, glowing borders, and clean geometric control buttons;
  * **Anime Future**: Vibrant gradients, reactive neon glow, and interactive mascot physics;
* 🛡️ **Modular Configuration**: Decoupled network and authentication keys via standard `.env` configuration.

---

## 🏛️ System Architecture

```
TitanCore Desktop Application
├── [Renderer Layer]
│   ├── Vue 3 (Composition API) + Pinia State Management
│   ├── Tailwind CSS 4 Utility-first Styles
│   └── Pixi.js 2D Graphics Canvas
│
├── [Electron Main Process]
│   ├── services/       Business Logic (Games, Downloads, Mode Switching)
│   ├── db.ts           SQLite Persistence Layer (WAL Mode)
│   └── TitanNet.ts     Network Abstraction Layer
│
└── [C++ Native Addon]
    └── native/tc_native.cc (Win32 API: Suspended launch, DLL injection, UAC de-elevation)
```

---

## 🚀 Quick Start

### 1. Clone Repository
```powershell
git clone https://github.com/YourUsername/TitanCore.git
cd TitanCore
```

### 2. Install Dependencies & Build Native Extension
```powershell
# Install dependencies & rebuild native addons
npm install

# Compile C++ native addon (tc_native.node)
npm run build:native
```

### 3. Run Development Server
```powershell
npm run dev
```

For complete compilation guidelines, prerequisites, and troubleshooting, please refer to 📖 **[BUILD.md](BUILD.md)**.

---

## ⚙️ Environment Configuration

In standalone mode, TitanCore runs with zero setup required. If you want to connect to your custom server, copy `.env.example` to `.env.local`:

```bash
cp .env.example .env.local
```

Configure your endpoints in `.env.local`:
```env
TITAN_NODE_1=https://your-server.com/titan_config.json
TITAN_SALT=YOUR_CUSTOM_SALT
```

---

## 📄 License

This project is licensed under the **[MIT License](LICENSE)**. Everyone is free to inspect, modify, and distribute this software.
