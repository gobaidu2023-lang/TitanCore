# TitanCore 构建与开发全景指南 (Build & Developer Guide)

本文档面向开源贡献者与开发者，详细说明了从零拉取源码到成功编译、调试及打包发布 TitanCore 桌面端应用的全部前置依赖、环境要求及标准操作步骤。

---

## 1. 宿主系统与环境要求

TitanCore 的核心 Native 扩展深度集成 Win32 底层 API，目前推荐在以下环境下进行编译与调试：

* **操作系统**：Windows 10 64-bit / Windows 11 64-bit (x64)
* **Node.js**：`>= 20.x` 或 `22.x LTS` (推荐使用 Node 22)
* **包管理器**：`npm` (>= 10.x)
* **Python**：`3.10+`（供 `node-gyp` 和 Native 重编译构建系统寻址）
* **C++ 构建工具链**：
  * **Visual Studio 2022** (Community / Professional / Enterprise)
  * 必须在 Visual Studio Installer 中勾选安装：
    * **使用 C++ 的桌面开发** (Desktop development with C++)
    * **MSVC v143 - VS 2022 C++ x64/x86 生成工具**
    * **Windows 10 SDK** (或 Windows 11 SDK)
    * **用于 Windows 的 C++ CMake 工具**

---

## 2. 核心技术栈与依赖包清单

TitanCore 采用现代前后端分离与原生 Native 扩展架构，核心依赖及精确版本声明如下：

### 2.1 运行时生产依赖 (Dependencies)
| 依赖项 | 声明版本 | 核心职责说明 |
| :--- | :--- | :--- |
| **`better-sqlite3`** | `^12.11.1` | 高性能嵌入式 SQLite 引擎，驱动本地游戏元数据与资源索引 |
| **`ws`** | `^8.18.0` | 高性能 WebSocket 客户端，与本地 aria2c 下载器进行 JSON-RPC 通信 |
| **`bufferutil`** | `^4.1.0` | C++ 原生 WebSocket Buffer 性能加速模块 |
| **`utf-8-validate`** | `^6.0.6` | C++ 原生 UTF-8 编码合法性校验 |
| **`node-addon-api`** | `^8.3.0` | C++ 与 Node.js/Electron 的 N-API 标准封装桥接库 |

### 2.2 开发与构建工具链 (DevDependencies)
| 工具项 | 声明版本 | 核心职责说明 |
| :--- | :--- | :--- |
| **`electron`** | `^42.4.1` | 跨平台桌面运行时底座 |
| **`vite`** | `^7.3.5` | 次时代前端极速构建与 HMR 热重载工具 |
| **`vite-plugin-electron`** | `^0.29.0` | Vite 与 Electron 主进程/预加载脚本无缝胶水层 |
| **`vue`** | `^3.5.38` | Vue 3 核心前端响应式框架 |
| **`tailwindcss`** | `^4.3.1` | Tailwind CSS 4 原子化样式引擎 |
| **`@tailwindcss/vite`** | `^4.3.1` | Tailwind CSS 4 官方 Vite 原生集成插件 |
| **`pinia`** | `^3.0.4` | 前端状态管理核心 |
| **`pixi.js`** | `^8.19.0` | WebGL 2D 图形与小游戏渲染引擎 |
| **`cmake-js`** | `^7.3.0` | 驱动 CMake 编译 C++ 原生模块 (`tc_native.node`) |
| **`@electron/rebuild`** | `^4.0.4` | 针对当前 Electron 内部 ABI 自动重编译 Native 依赖 |
| **`electron-builder`** | `^26.15.3` | 自动化打包器，生成标准 NSIS 安装包与免安装便携版 |
| **`typescript`** | `^6.0.3` | 全局静态类型检查与类型推导 |
| **`axios`** | `^1.18.0` | 主进程网络通信工具 |

---

## 3. 标准编译与运行三步走

### 步骤一：克隆代码与安装依赖
```powershell
# 1. 进入项目根目录
cd TitanCore_OpenSource

# 2. 安装全部 npm 依赖（将自动触发 postinstall 编译 better-sqlite3）
npm install
```

### 步骤二：编译 C++ 原生模块 (`tc_native.node`)
TitanCore 的挂起启动与 DLL 注入由 `native/tc_native.cc` 实现，需通过 `cmake-js` 进行编译：
```powershell
# 编译 C++ 扩展，产物会自动复制至 resources/bin/tc_native.node
npm run build:native
```

### 步骤三：启动开发调试 / 正式打包

#### 选项 A：启动开发调试模式 (Dev Mode)
```powershell
npm run dev
```
此命令将启动 Vite 本地服务并自动拉起 Electron 窗口，支持前端代码热重载 (HMR)。

#### 选项 B：打包生产安装包 (Distribution)
```powershell
npm run dist
```
构建产物将输出至 `release/` 目录，包括：
1. **NSIS 安装包** (`TitanCore Setup <version>.exe`)
2. **免安装便携版** (`TitanCore <version>.exe`)

---

## 4. 常见构建故障排除 (FAQ)

### Q1: `better-sqlite3` 报 `was compiled against a different Node.js version using NODE_MODULE_VERSION ...`
* **原因**：本地是用系统 Node.js 编译的模块，但 Electron 拥有自己独立的 Node ABI 版本。
* **解决方案**：执行以下命令手动重编：
  ```powershell
  npx @electron/rebuild -f -w better-sqlite3 -w bufferutil -w utf-8-validate
  ```

### Q2: 编译 `tc_native` 时提示找不到 MSVC 或 CMake
* **原因**：未安装 VS2022 C++ 工作负荷，或未在管理员命令行中正确配置环境变量。
* **解决方案**：
  1. 打开 Visual Studio Installer，确认已勾选“使用 C++ 的桌面开发”；
  2. 可使用 VS 自带的 **x64 Native Tools Command Prompt for VS 2022** 打开终端执行 `npm run build:native`。

### Q3: 提示 `node-addon-api 头文件缺失`
* **原因**：尚未执行 `npm install`。`native/CMakeLists.txt` 会直接从项目根的 `node_modules/node-addon-api` 寻址。
* **解决方案**：先执行 `npm install`，确认 `node_modules/node-addon-api/napi.h` 存在后再构建 Native 模块。
