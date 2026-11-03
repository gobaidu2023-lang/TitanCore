// build/remove_dll.js
const fs = require('fs');
const path = require('path');

exports.default = async function(context) {
    const appOutDir = context.appOutDir;
    
    // 🟢 [Anti-AV & 瘦身] 物理移除易被杀软拦截的系统同名图形驱动与 Vulkan 冗余文件
    // TitanCore 前端渲染完全基于 Direct3D 11 (libEGL / libGLESv2)，全局 100% 不依赖 Vulkan
    const restrictedFiles = [
        'd3dcompiler_47.dll',
        'vulkan-1.dll',
        'vk_swiftshader.dll',
        'vk_swiftshader_icd.json'
    ];
    
    for (const rel of restrictedFiles) {
        const p = path.join(appOutDir, rel);
        if (fs.existsSync(p)) {
            try {
                fs.unlinkSync(p);
                console.log('[Titan Build] ✅ Successfully removed ' + rel + ' for 360/AV compliance & slimming.');
            } catch (error) {
                console.error('[Titan Build] ❌ Failed to remove ' + rel + ': ' + error.message);
            }
        }
    }

    // 🛡️ 物理剔除意外混入打包产物的 ost 目录（防开发环境污染进入生产发布包）
    const ostPath = path.join(appOutDir, 'ost');
    if (fs.existsSync(ostPath)) {
        try {
            fs.rmSync(ostPath, { recursive: true, force: true });
            console.log('[Titan Build] 🛡️ Successfully purged unwanted ost directory from build package.');
        } catch (error) {
            console.error('[Titan Build] ❌ Failed to purge ost directory: ' + error.message);
        }
    }
};
