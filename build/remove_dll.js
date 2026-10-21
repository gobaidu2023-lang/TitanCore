// build/remove_dll.js
const fs = require('fs');
const path = require('path');

exports.default = async function(context) {
    // 🟢 [Hajimi Task 4] 物理移除 D3D 组件 (Anti-AV Strategy)
    const appOutDir = context.appOutDir;
    const dllPath = path.join(appOutDir, 'd3dcompiler_47.dll');
    
    console.log(`[Titan Build] Checking for restricted DLL: ${dllPath}`);
    
    if (fs.existsSync(dllPath)) {
        try {
            fs.unlinkSync(dllPath);
            console.log('[Titan Build] ✅ Successfully removed d3dcompiler_47.dll for 360/AV compliance.');
        } catch (error) {
            console.error(`[Titan Build] ❌ Failed to remove DLL: ${error.message}`);
            // 不抛出错误，以免中断打包流程，但记录警告
        }
    } else {
        console.log('[Titan Build] ⚠️ DLL not found (skipping removal).');
    }

    // 🛡️ 物理剔除意外混入打包产物的 ost 目录（防开发环境污染进入生产发布包）
    const ostPath = path.join(appOutDir, 'ost');
    if (fs.existsSync(ostPath)) {
        try {
            fs.rmSync(ostPath, { recursive: true, force: true });
            console.log('[Titan Build] 🛡️ Successfully purged unwanted ost directory from build package.');
        } catch (error) {
            console.error(`[Titan Build] ❌ Failed to purge ost directory: ${error.message}`);
        }
    }
};