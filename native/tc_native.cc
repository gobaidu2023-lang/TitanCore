// 文件名: native/tc_native.cc
// TC 侧适配 第3批: 挂起注入 + 握手等待(原生插件, 全部 Win32 调用在 TitanCore 主进程内执行)
#include <napi.h>
#include <windows.h>
#include <tlhelp32.h>
#include <string>
#include <vector>
#include <queue>
#include <unordered_set>
#include <algorithm>
#include <cwctype>

#pragma comment(lib, "user32.lib")
#pragma comment(lib, "advapi32.lib")

// 尝试获取当前交互桌面用户的标准（非提升 Medium Integrity）令牌，
// 杜绝子进程 steam.exe 及其渲染进程、游戏进程继承 TC 的管理员 UAC 权限导致反作弊报错与沙箱失效
static HANDLE GetMediumIntegrityShellToken() {
  HWND hShellWnd = GetShellWindow();
  if (!hShellWnd) return NULL;

  DWORD shellPid = 0;
  GetWindowThreadProcessId(hShellWnd, &shellPid);
  if (!shellPid) return NULL;

  HANDLE hShellProcess = OpenProcess(PROCESS_QUERY_INFORMATION, FALSE, shellPid);
  if (!hShellProcess) return NULL;

  HANDLE hShellToken = NULL;
  if (!OpenProcessToken(hShellProcess, TOKEN_DUPLICATE, &hShellToken)) {
    CloseHandle(hShellProcess);
    return NULL;
  }
  CloseHandle(hShellProcess);

  HANDLE hToken = NULL;
  if (!DuplicateTokenEx(hShellToken, TOKEN_ALL_ACCESS, NULL, SecurityImpersonation, TokenPrimary, &hToken)) {
    CloseHandle(hShellToken);
    return NULL;
  }
  CloseHandle(hShellToken);
  return hToken;
}

static std::wstring Widen(const std::string& s) {
  if (s.empty()) return std::wstring();
  int len = MultiByteToWideChar(CP_UTF8, 0, s.c_str(), (int)s.size(), NULL, 0);
  if (len <= 0) return std::wstring();
  std::wstring w((size_t)len, L'\0');
  MultiByteToWideChar(CP_UTF8, 0, s.c_str(), (int)s.size(), &w[0], len);
  return w;
}

static std::string Narrow(const std::wstring& w) {
  if (w.empty()) return std::string();
  int len = WideCharToMultiByte(CP_UTF8, 0, w.c_str(), (int)w.size(), NULL, 0, NULL, NULL);
  if (len <= 0) return std::string();
  std::string s((size_t)len, '\0');
  WideCharToMultiByte(CP_UTF8, 0, w.c_str(), (int)w.size(), &s[0], len, NULL, NULL);
  return s;
}

struct LaunchOutcome {
  DWORD pid = 0;
  BOOL handshake = FALSE;
  BOOL injected = FALSE;
  std::string error;
};

// 环境块: 收集父进程环境变量与 OST_BASE_DIR / CR_STATE_DIR / OST_RDV_EVENT，
// 遵循 Win32 API 契约执行不区分大小写的标准字母序排序 (std::sort + _wcsicmp)
static std::wstring BuildEnvBlock(const std::wstring& baseDir, const std::wstring& rdvEvent) {
  std::vector<std::wstring> entries;
  entries.push_back(L"OST_BASE_DIR=" + baseDir);
  entries.push_back(L"CR_STATE_DIR=" + baseDir);
  entries.push_back(L"OST_RDV_EVENT=" + rdvEvent);

  wchar_t* parent = GetEnvironmentStringsW();
  if (parent) {
    for (wchar_t* p = parent; *p; p += wcslen(p) + 1) {
      std::wstring entry(p);
      if (entry.rfind(L"OST_BASE_DIR=", 0) == 0) continue;
      if (entry.rfind(L"CR_STATE_DIR=", 0) == 0) continue;
      if (entry.rfind(L"OST_RDV_EVENT=", 0) == 0) continue;
      entries.push_back(std::move(entry));
    }
    FreeEnvironmentStringsW(parent);
  }

  // Win32 API 契约: 环境块必须按不区分大小写的字母序排序
  std::sort(entries.begin(), entries.end(), [](const std::wstring& a, const std::wstring& b) {
    return _wcsicmp(a.c_str(), b.c_str()) < 0;
  });

  std::wstring result;
  for (const auto& item : entries) {
    result += item + L'\0';
  }
  result += L'\0';
  return result;
}

// 判断路径是否处于 Windows 受保护的 Program Files (含 x86) 目录下
static bool IsProtectedProgramFilesPath(const std::wstring& p) {
  if (p.empty()) return false;
  std::wstring lower = p;
  std::transform(lower.begin(), lower.end(), lower.begin(), ::towlower);
  return lower.find(L"program files") != std::wstring::npos;
}

static LaunchOutcome DoLaunch(const std::wstring& steamExe, const std::wstring& dllPath,
                              const std::wstring& baseDir, const std::wstring& eventName,
                              DWORD timeoutMs) {
  LaunchOutcome out;

  // 1. 具名事件(每次先复位, 防上次残留信号)
  HANDLE hEvent = CreateEventW(NULL, TRUE, FALSE, eventName.c_str());
  if (!hEvent) { out.error = "CreateEvent failed: " + std::to_string(GetLastError()); return out; }
  ResetEvent(hEvent);

  // 2. 挂起创建 steam.exe 并注入环境变量
  std::wstring env = BuildEnvBlock(baseDir, eventName);
  std::wstring workDir = steamExe.substr(0, steamExe.find_last_of(L"\\/"));
  STARTUPINFOW si = { sizeof(si) };
  PROCESS_INFORMATION pi = {};
  BOOL created = FALSE;

  // 智能构造命令行：强制注入 -websocket 参数，杜绝国内运营商 UDP 丢包及保障 OST 协议拦截
  std::wstring cmdLine = L"\"" + steamExe + L"\" -websocket";
  std::vector<wchar_t> cmdLineBuf(cmdLine.begin(), cmdLine.end());
  cmdLineBuf.push_back(L'\0');

  // 智能降权判断：若 Steam 或 TC(baseDir/dllPath) 任一安装在 Program Files 下，
  // 必须保留当前管理员权限以保障目录读写畅通；仅当均不在 Program Files 下时才降权启动。
  const bool skipDeElevation = IsProtectedProgramFilesPath(steamExe) ||
                               IsProtectedProgramFilesPath(baseDir) ||
                               IsProtectedProgramFilesPath(dllPath);
  if (!skipDeElevation) {
    HANDLE hMediumToken = GetMediumIntegrityShellToken();
    if (hMediumToken) {
      // 优先尝试以降权普通令牌启动，使 Steam 及其游戏进程免受管理员权限反噬
      created = CreateProcessWithTokenW(hMediumToken, 0, steamExe.c_str(), cmdLineBuf.data(),
                                        CREATE_SUSPENDED | CREATE_UNICODE_ENVIRONMENT,
                                        (LPVOID)env.c_str(), workDir.c_str(), &si, &pi);
      CloseHandle(hMediumToken);
    }
  }

  if (!created) {
    // 精简系统防御：若降权尝试失败或服务缺失，彻底复位结构体，零延迟回退至原生创建
    memset(&si, 0, sizeof(si));
    si.cb = sizeof(si);
    memset(&pi, 0, sizeof(pi));
    created = CreateProcessW(steamExe.c_str(), cmdLineBuf.data(), NULL, NULL, FALSE,
                             CREATE_SUSPENDED | CREATE_UNICODE_ENVIRONMENT,
                             (LPVOID)env.c_str(), workDir.c_str(), &si, &pi);
  }

  if (!created) {
    out.error = "CreateProcess failed: " + std::to_string(GetLastError());
    CloseHandle(hEvent);
    return out;
  }
  out.pid = pi.dwProcessId;

  LPVOID remoteMem_ = NULL;
  HANDLE hThread = NULL;
  auto abortLaunch = [&](const char* what) {
    out.error = std::string(what) + " failed: " + std::to_string(GetLastError());
    if (remoteMem_) VirtualFreeEx(pi.hProcess, remoteMem_, 0, MEM_RELEASE);
    TerminateProcess(pi.hProcess, 1);
    CloseHandle(pi.hThread); CloseHandle(pi.hProcess); CloseHandle(hEvent);
  };

  // 3. 远程线程 LoadLibraryW
  SIZE_T pathBytes = (dllPath.size() + 1) * sizeof(wchar_t);
  remoteMem_ = VirtualAllocEx(pi.hProcess, NULL, pathBytes, MEM_COMMIT | MEM_RESERVE, PAGE_READWRITE);
  HMODULE hKernel = GetModuleHandleW(L"kernel32.dll");
  FARPROC pLoadLib = hKernel ? GetProcAddress(hKernel, "LoadLibraryW") : NULL;
  if (!remoteMem_ || !pLoadLib) { abortLaunch("PrepareInjection"); return out; }
  if (!WriteProcessMemory(pi.hProcess, remoteMem_, dllPath.c_str(), pathBytes, NULL)) { abortLaunch("WriteProcessMemory"); return out; }

  hThread = CreateRemoteThread(pi.hProcess, NULL, 0, (LPTHREAD_START_ROUTINE)pLoadLib, remoteMem_, 0, NULL);
  if (!hThread) { abortLaunch("CreateRemoteThread"); return out; }

  // 4. 等 LoadLibrary 返回, 用返回值判注入成败
  DWORD waitRes = WaitForSingleObject(hThread, 10000);
  if (waitRes == WAIT_OBJECT_0) {
    DWORD loadLibRet = 0;
    GetExitCodeThread(hThread, &loadLibRet);
    out.injected = (loadLibRet != 0);
  } else {
    out.injected = FALSE;
    out.error = "LoadLibrary wait timed out or failed";
  }

  // TC-P11: 注入失败时跳过握手等待(事件永不会来, 避免白等超时)
  if (out.injected) {
    // 5. 等 OST 握手事件(超时照样放行, 由调用方决策)
    DWORD wfso = WaitForSingleObject(hEvent, timeoutMs);
    out.handshake = (wfso == WAIT_OBJECT_0);
  }

  // 6. 放行主线程并收尾
  ResumeThread(pi.hThread);
  VirtualFreeEx(pi.hProcess, remoteMem_, 0, MEM_RELEASE);
  CloseHandle(hThread);
  CloseHandle(pi.hThread);
  CloseHandle(pi.hProcess);
  CloseHandle(hEvent);
  if (!out.injected && out.error.empty()) out.error = "LoadLibrary returned NULL";
  return out;
}

class LaunchWorker : public Napi::AsyncWorker {
 public:
  LaunchWorker(Napi::Function& cb, std::wstring exe, std::wstring dll, std::wstring base, std::wstring evt, DWORD timeout)
      : Napi::AsyncWorker(cb), steamExe_(std::move(exe)), dllPath_(std::move(dll)),
        baseDir_(std::move(base)), eventName_(std::move(evt)), timeoutMs_(timeout) {}

  void Execute() override {
    outcome_ = DoLaunch(steamExe_, dllPath_, baseDir_, eventName_, timeoutMs_);
    if (!outcome_.injected) SetError(outcome_.error.empty() ? "LoadLibrary returned NULL" : outcome_.error);
  }

  void OnOK() override {
    Napi::Object r = Napi::Object::New(Env());
    r.Set("pid", Napi::Number::New(Env(), (double)outcome_.pid));
    r.Set("handshake", Napi::Boolean::New(Env(), outcome_.handshake != 0));
    r.Set("injected", Napi::Boolean::New(Env(), outcome_.injected != 0));
    r.Set("error", Napi::String::New(Env(), outcome_.error));
    Callback().Call({ Env().Null(), r });
  }

 private:
  std::wstring steamExe_, dllPath_, baseDir_, eventName_;
  DWORD timeoutMs_;
  LaunchOutcome outcome_;
};

// launchSuspended(steamExe, dllPath, baseDir, eventName, timeoutMs, callback)
Napi::Value LaunchSuspended(const Napi::CallbackInfo& info) {
  Napi::Env env = info.Env();
  if (info.Length() < 6 || !info[0].IsString() || !info[1].IsString() || !info[2].IsString() ||
      !info[3].IsString() || !info[4].IsNumber() || !info[5].IsFunction()) {
    Napi::TypeError::New(env, "expected (steamExe, dllPath, baseDir, eventName, timeoutMs, callback)").ThrowAsJavaScriptException();
    return env.Null();
  }
  std::wstring exe = Widen(info[0].As<Napi::String>().Utf8Value());
  std::wstring dll = Widen(info[1].As<Napi::String>().Utf8Value());
  std::wstring base = Widen(info[2].As<Napi::String>().Utf8Value());
  std::wstring evt = Widen(info[3].As<Napi::String>().Utf8Value());
  DWORD timeout = (DWORD)info[4].As<Napi::Number>().Uint32Value();
  Napi::Function cb = info[5].As<Napi::Function>();
  (new LaunchWorker(cb, exe, dll, base, evt, timeout))->Queue();
  return env.Undefined();
}

// TC-P13: 广播 WM_SETTINGCHANGE(Environment), 使 Explorer 新启动的进程无需重启即可拿到新环境变量
Napi::Value BroadcastSettingChange(const Napi::CallbackInfo& info) {
  Napi::Env env = info.Env();
  DWORD_PTR result = 0;
  SendMessageTimeoutW(HWND_BROADCAST, WM_SETTINGCHANGE, 0, (LPARAM)L"Environment",
                      SMTO_ABORTIFHUNG | SMTO_NOTIMEOUTIFNOTHUNG, 5000, &result);
  return Napi::Boolean::New(env, true);
}

// ─── Native Process Snapshot & Tree Termination ────────────────────────────────────
struct ProcEntry {
  DWORD pid;
  DWORD ppid;
  std::wstring exe;
};

static std::vector<ProcEntry> SnapshotProcesses() {
  std::vector<ProcEntry> procs;
  HANDLE hSnap = CreateToolhelp32Snapshot(TH32CS_SNAPPROCESS, 0);
  if (hSnap == INVALID_HANDLE_VALUE) return procs;
  PROCESSENTRY32W pe = {};
  pe.dwSize = sizeof(pe);
  if (Process32FirstW(hSnap, &pe)) {
    do {
      procs.push_back({ pe.th32ProcessID, pe.th32ParentProcessID, pe.szExeFile });
    } while (Process32NextW(hSnap, &pe));
  }
  CloseHandle(hSnap);
  return procs;
}

static int TerminatePidList(const std::vector<ProcEntry>& procs, const std::vector<DWORD>& seedPids, bool includeTree) {
  if (seedPids.empty()) return 0;
  const DWORD selfPid = GetCurrentProcessId();
  std::unordered_set<DWORD> toKill;
  std::queue<DWORD> q;

  for (DWORD pid : seedPids) {
    if (pid == 0 || pid == 4 || pid == selfPid) continue;
    if (toKill.insert(pid).second) q.push(pid);
  }

  if (includeTree) {
    while (!q.empty()) {
      DWORD parent = q.front();
      q.pop();
      for (const auto& p : procs) {
        if (p.ppid == parent && p.pid != 0 && p.pid != 4 && p.pid != selfPid) {
          if (toKill.insert(p.pid).second) q.push(p.pid);
        }
      }
    }
  }

  int killed = 0;
  for (DWORD pid : toKill) {
    HANDLE hProc = OpenProcess(PROCESS_TERMINATE, FALSE, pid);
    if (hProc) {
      if (TerminateProcess(hProc, 1)) killed++;
      CloseHandle(hProc);
    }
  }
  return killed;
}

// isProcessRunning(imageName: string): boolean
Napi::Value IsProcessRunning(const Napi::CallbackInfo& info) {
  Napi::Env env = info.Env();
  if (info.Length() < 1 || !info[0].IsString()) return Napi::Boolean::New(env, false);
  std::wstring target = Widen(info[0].As<Napi::String>().Utf8Value());
  if (target.empty()) return Napi::Boolean::New(env, false);

  auto procs = SnapshotProcesses();
  for (const auto& p : procs) {
    if (_wcsicmp(p.exe.c_str(), target.c_str()) == 0) {
      return Napi::Boolean::New(env, true);
    }
  }
  return Napi::Boolean::New(env, false);
}

// killProcesses(imageNames: string[], includeTree?: boolean): number
Napi::Value KillProcesses(const Napi::CallbackInfo& info) {
  Napi::Env env = info.Env();
  if (info.Length() < 1 || !info[0].IsArray()) return Napi::Number::New(env, 0);

  Napi::Array arr = info[0].As<Napi::Array>();
  std::vector<std::wstring> targets;
  targets.reserve(arr.Length());
  for (uint32_t i = 0; i < arr.Length(); i++) {
    Napi::Value v = arr.Get(i);
    if (v.IsString()) {
      std::wstring w = Widen(v.As<Napi::String>().Utf8Value());
      if (!w.empty()) targets.push_back(std::move(w));
    }
  }
  if (targets.empty()) return Napi::Number::New(env, 0);

  bool includeTree = (info.Length() >= 2 && info[1].IsBoolean()) ? info[1].As<Napi::Boolean>().Value() : true;
  auto procs = SnapshotProcesses();
  std::vector<DWORD> seeds;
  for (const auto& p : procs) {
    for (const auto& t : targets) {
      if (_wcsicmp(p.exe.c_str(), t.c_str()) == 0) {
        seeds.push_back(p.pid);
        break;
      }
    }
  }
  int killed = TerminatePidList(procs, seeds, includeTree);
  return Napi::Number::New(env, killed);
}

// killProcessByPid(pid: number, expectedImage?: string, includeTree?: boolean): boolean
Napi::Value KillProcessByPid(const Napi::CallbackInfo& info) {
  Napi::Env env = info.Env();
  if (info.Length() < 1 || !info[0].IsNumber()) return Napi::Boolean::New(env, false);
  DWORD targetPid = (DWORD)info[0].As<Napi::Number>().Uint32Value();
  if (targetPid == 0 || targetPid == 4 || targetPid == GetCurrentProcessId()) {
    return Napi::Boolean::New(env, false);
  }

  std::wstring expectedImg;
  if (info.Length() >= 2 && info[1].IsString()) {
    expectedImg = Widen(info[1].As<Napi::String>().Utf8Value());
  }
  bool includeTree = (info.Length() >= 3 && info[2].IsBoolean()) ? info[2].As<Napi::Boolean>().Value() : true;

  auto procs = SnapshotProcesses();
  bool matched = false;
  for (const auto& p : procs) {
    if (p.pid == targetPid) {
      if (expectedImg.empty() || _wcsicmp(p.exe.c_str(), expectedImg.c_str()) == 0) {
        matched = true;
      }
      break;
    }
  }
  if (!matched) return Napi::Boolean::New(env, false);

  int killed = TerminatePidList(procs, { targetPid }, includeTree);
  return Napi::Boolean::New(env, killed > 0);
}

// ─── Native Win32 Registry Helpers ─────────────────────────────────────────────────
static HKEY ParseRootKey(const std::string& root) {
  if (_stricmp(root.c_str(), "HKCU") == 0 || _stricmp(root.c_str(), "HKEY_CURRENT_USER") == 0) return HKEY_CURRENT_USER;
  if (_stricmp(root.c_str(), "HKLM") == 0 || _stricmp(root.c_str(), "HKEY_LOCAL_MACHINE") == 0) return HKEY_LOCAL_MACHINE;
  if (_stricmp(root.c_str(), "HKCR") == 0 || _stricmp(root.c_str(), "HKEY_CLASSES_ROOT") == 0) return HKEY_CLASSES_ROOT;
  return nullptr;
}

static bool QueryRegStringValue(HKEY hKey, const wchar_t* valueName, std::wstring& out) {
  DWORD type = 0;
  DWORD cbData = 0;
  LONG rc = RegQueryValueExW(hKey, valueName, nullptr, &type, nullptr, &cbData);
  if (rc != ERROR_SUCCESS || cbData == 0) return false;
  if (type != REG_SZ && type != REG_EXPAND_SZ) return false;

  std::vector<wchar_t> buf((cbData / sizeof(wchar_t)) + 2, L'\0');
  DWORD actualBytes = (DWORD)(buf.size() * sizeof(wchar_t));
  rc = RegQueryValueExW(hKey, valueName, nullptr, &type, reinterpret_cast<LPBYTE>(buf.data()), &actualBytes);
  if (rc != ERROR_SUCCESS) return false;

  buf.back() = L'\0';
  out = std::wstring(buf.data());
  return true;
}

// regReadString(root: string, subKey: string, valueName: string): string | null
Napi::Value RegReadString(const Napi::CallbackInfo& info) {
  Napi::Env env = info.Env();
  if (info.Length() < 3 || !info[0].IsString() || !info[1].IsString() || !info[2].IsString()) {
    return env.Null();
  }
  HKEY hRoot = ParseRootKey(info[0].As<Napi::String>().Utf8Value());
  if (!hRoot) return env.Null();
  std::wstring subKey = Widen(info[1].As<Napi::String>().Utf8Value());
  std::wstring valueName = Widen(info[2].As<Napi::String>().Utf8Value());

  HKEY hKey = nullptr;
  if (RegOpenKeyExW(hRoot, subKey.c_str(), 0, KEY_READ, &hKey) != ERROR_SUCCESS) {
    return env.Null();
  }
  std::wstring val;
  bool ok = QueryRegStringValue(hKey, valueName.empty() ? nullptr : valueName.c_str(), val);
  RegCloseKey(hKey);
  return ok ? Napi::String::New(env, Narrow(val)) : env.Null();
}

// regQuerySubkeyStrings(root: string, subKey: string, valueName: string): string[]
Napi::Value RegQuerySubkeyStrings(const Napi::CallbackInfo& info) {
  Napi::Env env = info.Env();
  Napi::Array outArr = Napi::Array::New(env);
  if (info.Length() < 3 || !info[0].IsString() || !info[1].IsString() || !info[2].IsString()) {
    return outArr;
  }
  HKEY hRoot = ParseRootKey(info[0].As<Napi::String>().Utf8Value());
  if (!hRoot) return outArr;
  std::wstring subKey = Widen(info[1].As<Napi::String>().Utf8Value());
  std::wstring valueName = Widen(info[2].As<Napi::String>().Utf8Value());

  HKEY hParent = nullptr;
  if (RegOpenKeyExW(hRoot, subKey.c_str(), 0, KEY_READ, &hParent) != ERROR_SUCCESS) {
    return outArr;
  }

  wchar_t childName[512];
  DWORD idx = 0;
  uint32_t outIdx = 0;
  while (true) {
    DWORD childLen = (DWORD)(sizeof(childName) / sizeof(wchar_t));
    LONG rc = RegEnumKeyExW(hParent, idx++, childName, &childLen, nullptr, nullptr, nullptr, nullptr);
    if (rc == ERROR_NO_MORE_ITEMS) break;
    if (rc != ERROR_SUCCESS) continue;

    HKEY hChild = nullptr;
    if (RegOpenKeyExW(hParent, childName, 0, KEY_READ, &hChild) == ERROR_SUCCESS) {
      std::wstring val;
      if (QueryRegStringValue(hChild, valueName.empty() ? nullptr : valueName.c_str(), val) && !val.empty()) {
        outArr.Set(outIdx++, Napi::String::New(env, Narrow(val)));
      }
      RegCloseKey(hChild);
    }
  }
  RegCloseKey(hParent);
  return outArr;
}

// regWriteString(root: string, subKey: string, valueName: string, value: string): boolean
Napi::Value RegWriteString(const Napi::CallbackInfo& info) {
  Napi::Env env = info.Env();
  if (info.Length() < 4 || !info[0].IsString() || !info[1].IsString() || !info[2].IsString() || !info[3].IsString()) {
    return Napi::Boolean::New(env, false);
  }
  HKEY hRoot = ParseRootKey(info[0].As<Napi::String>().Utf8Value());
  if (!hRoot) return Napi::Boolean::New(env, false);
  std::wstring subKey = Widen(info[1].As<Napi::String>().Utf8Value());
  std::wstring valueName = Widen(info[2].As<Napi::String>().Utf8Value());
  std::wstring value = Widen(info[3].As<Napi::String>().Utf8Value());

  HKEY hKey = nullptr;
  if (RegCreateKeyExW(hRoot, subKey.c_str(), 0, nullptr, REG_OPTION_NON_VOLATILE, KEY_SET_VALUE, nullptr, &hKey, nullptr) != ERROR_SUCCESS) {
    return Napi::Boolean::New(env, false);
  }
  const DWORD byteLen = (DWORD)((value.size() + 1) * sizeof(wchar_t));
  LONG rc = RegSetValueExW(hKey, valueName.empty() ? nullptr : valueName.c_str(), 0, REG_SZ,
                           reinterpret_cast<const BYTE*>(value.c_str()), byteLen);
  RegCloseKey(hKey);
  return Napi::Boolean::New(env, rc == ERROR_SUCCESS);
}

// regWriteBinary(root: string, subKey: string, valueName: string, data: Buffer): boolean
Napi::Value RegWriteBinary(const Napi::CallbackInfo& info) {
  Napi::Env env = info.Env();
  if (info.Length() < 4 || !info[0].IsString() || !info[1].IsString() || !info[2].IsString() || !info[3].IsBuffer()) {
    return Napi::Boolean::New(env, false);
  }
  HKEY hRoot = ParseRootKey(info[0].As<Napi::String>().Utf8Value());
  if (!hRoot) return Napi::Boolean::New(env, false);
  std::wstring subKey = Widen(info[1].As<Napi::String>().Utf8Value());
  std::wstring valueName = Widen(info[2].As<Napi::String>().Utf8Value());
  Napi::Buffer<uint8_t> buf = info[3].As<Napi::Buffer<uint8_t>>();

  HKEY hKey = nullptr;
  if (RegCreateKeyExW(hRoot, subKey.c_str(), 0, nullptr, REG_OPTION_NON_VOLATILE, KEY_SET_VALUE, nullptr, &hKey, nullptr) != ERROR_SUCCESS) {
    return Napi::Boolean::New(env, false);
  }
  LONG rc = RegSetValueExW(hKey, valueName.empty() ? nullptr : valueName.c_str(), 0, REG_BINARY,
                           buf.Data(), (DWORD)buf.Length());
  RegCloseKey(hKey);
  return Napi::Boolean::New(env, rc == ERROR_SUCCESS);
}

// regDeleteValue(root: string, subKey: string, valueName: string): boolean
Napi::Value RegDeleteValueExport(const Napi::CallbackInfo& info) {
  Napi::Env env = info.Env();
  if (info.Length() < 3 || !info[0].IsString() || !info[1].IsString() || !info[2].IsString()) {
    return Napi::Boolean::New(env, false);
  }
  HKEY hRoot = ParseRootKey(info[0].As<Napi::String>().Utf8Value());
  if (!hRoot) return Napi::Boolean::New(env, false);
  std::wstring subKey = Widen(info[1].As<Napi::String>().Utf8Value());
  std::wstring valueName = Widen(info[2].As<Napi::String>().Utf8Value());

  HKEY hKey = nullptr;
  LONG openRc = RegOpenKeyExW(hRoot, subKey.c_str(), 0, KEY_SET_VALUE, &hKey);
  if (openRc == ERROR_FILE_NOT_FOUND) return Napi::Boolean::New(env, true);
  if (openRc != ERROR_SUCCESS) return Napi::Boolean::New(env, false);

  LONG rc = RegDeleteValueW(hKey, valueName.empty() ? nullptr : valueName.c_str());
  RegCloseKey(hKey);
  return Napi::Boolean::New(env, rc == ERROR_SUCCESS || rc == ERROR_FILE_NOT_FOUND);
}

Napi::Object Init(Napi::Env env, Napi::Object exports) {
  exports.Set("launchSuspended", Napi::Function::New(env, LaunchSuspended));
  exports.Set("broadcastSettingChange", Napi::Function::New(env, BroadcastSettingChange));
  exports.Set("isProcessRunning", Napi::Function::New(env, IsProcessRunning));
  exports.Set("killProcesses", Napi::Function::New(env, KillProcesses));
  exports.Set("killProcessByPid", Napi::Function::New(env, KillProcessByPid));
  exports.Set("regReadString", Napi::Function::New(env, RegReadString));
  exports.Set("regQuerySubkeyStrings", Napi::Function::New(env, RegQuerySubkeyStrings));
  exports.Set("regWriteString", Napi::Function::New(env, RegWriteString));
  exports.Set("regWriteBinary", Napi::Function::New(env, RegWriteBinary));
  exports.Set("regDeleteValue", Napi::Function::New(env, RegDeleteValueExport));
  return exports;
}

NODE_API_MODULE(tc_native, Init)
