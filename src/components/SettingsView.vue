<!-- 文件路径: src/components/SettingsView.vue -->
<template>
  <div class="w-full h-full p-8 animate-fade-in overflow-y-auto scrollbar-hide relative">

    <div class="mb-10 flex items-end justify-between border-b pb-6 transition-colors" :class="currentTheme === 'anime' ? 'border-pink-100' : 'border-white/5'">
      <div>
        <h2 
          class="text-4xl theme-header mb-2 tracking-widest transition-all"
          :class="currentTheme === 'anime' 
            ? 'text-transparent bg-clip-text bg-gradient-to-r from-[#ff66b2] via-[#a855f7] to-[#38bdf8] drop-shadow-[0_2px_10px_rgba(244,114,182,0.3)]' 
            : 'text-primary drop-shadow-[0_0_15px_rgba(var(--primary-rgb),0.3)]'"
        >
          {{ t('settings.title') }}
        </h2>
      </div>

      <!-- 右侧控制区：主题切换下拉框 + 多国语言折叠下拉框 -->
      <div class="flex items-center gap-3">
        <!-- 主题切换下拉框 (经典 / sakura / 未来) -->
        <div class="flex flex-col items-end gap-2 relative" ref="themeDropdownRef">
          <button 
            type="button" 
            @click="showThemeDropdown = !showThemeDropdown"
            class="px-5 py-2.5 rounded-lg border text-sm font-bold font-code transition-all tracking-wider flex items-center gap-3 backdrop-blur-sm shadow-sm"
            :class="currentTheme === 'anime' 
              ? 'bg-white/95 border-[#bce8ff] hover:border-[#ff85b3] text-[#1e192b]' 
              : (currentTheme === 'minimal'
                ? 'bg-[#101623]/90 border-[#00f2ff]/30 hover:border-[#00f2ff] text-white shadow-[0_0_15px_rgba(0,242,255,0.15)]'
                : 'bg-black/40 border-white/10 hover:border-[#00f3ff]/40 text-white')"
          >
            <span>{{ currentThemeLabel }}</span>
            <span class="text-xs transition-transform duration-300" :class="[{ 'rotate-180': showThemeDropdown }, currentTheme === 'anime' ? 'text-[#ff66b2]' : 'text-text-muted']">▼</span>
          </button>

          <div 
            v-if="showThemeDropdown" 
            class="absolute right-0 top-full mt-2 w-44 rounded-lg py-1.5 z-50 overflow-hidden backdrop-blur-md border shadow-xl"
            :class="currentTheme === 'anime' 
              ? 'bg-white/98 border-[#bce8ff] shadow-[0_10px_30px_rgba(180,150,230,0.25)] text-[#1e192b]' 
              : (currentTheme === 'minimal'
                ? 'bg-[#101623]/95 border-[#00f2ff]/30 shadow-[0_8px_30px_rgba(0,0,0,0.7)] text-white'
                : 'bg-[#0e0e14] border-white/10 shadow-[0_10px_30px_rgba(0,0,0,0.8)] text-gray-300')"
          >
            <button 
              type="button"
              v-for="item in availableThemes" 
              :key="item.id" 
              @click="handleSelectTheme(item.id)"
              class="w-full px-4 py-2.5 text-left text-xs font-bold font-code tracking-wider transition-colors flex items-center justify-between"
              :class="currentTheme === item.id 
                ? (currentTheme === 'anime' ? 'text-[#ff66b2] bg-pink-50 font-bold' : 'text-[#00f3ff] bg-[#00f3ff]/10 font-bold') 
                : (currentTheme === 'anime' ? 'text-[#4a425a] hover:bg-pink-50/50 hover:text-[#1e192b]' : 'text-gray-300 hover:bg-white/5 hover:text-white')"
            >
              <span>{{ item.label }}</span>
              <span v-if="currentTheme === item.id" class="w-1.5 h-1.5 rounded-full" :class="currentTheme === 'anime' ? 'bg-[#ff66b2]' : 'bg-[#00f3ff]'"></span>
            </button>
          </div>
        </div>

        <!-- 多国语言折叠下拉器（二次元高对比浅色适配） -->
        <div class="flex flex-col items-end gap-2 relative" ref="langDropdownRef">
          <button 
            type="button" 
            @click="showLangDropdown = !showLangDropdown"
            class="px-5 py-2.5 rounded-lg border text-sm font-bold font-code transition-all tracking-wider flex items-center gap-3 backdrop-blur-sm shadow-sm"
            :class="currentTheme === 'anime' 
              ? 'bg-white/95 border-[#bce8ff] hover:border-[#ff85b3] text-[#1e192b]' 
              : (currentTheme === 'minimal'
                ? 'bg-[#101623]/90 border-[#00f2ff]/30 hover:border-[#00f2ff] text-white shadow-[0_0_15px_rgba(0,242,255,0.15)]'
                : 'bg-black/40 border-white/10 hover:border-[#00f3ff]/40 text-white')"
          >
            <span>{{ currentLangLabel }}</span>
            <span class="text-xs transition-transform duration-300" :class="[{ 'rotate-180': showLangDropdown }, currentTheme === 'anime' ? 'text-[#ff66b2]' : 'text-text-muted']">▼</span>
          </button>

          <div 
            v-if="showLangDropdown" 
            class="absolute right-0 top-full mt-2 w-44 rounded-lg py-1.5 z-50 overflow-hidden backdrop-blur-md border shadow-xl"
            :class="currentTheme === 'anime' 
              ? 'bg-white/98 border-[#bce8ff] shadow-[0_10px_30px_rgba(180,150,230,0.25)] text-[#1e192b]' 
              : (currentTheme === 'minimal'
                ? 'bg-[#101623]/95 border-[#00f2ff]/30 shadow-[0_8px_30px_rgba(0,0,0,0.7)] text-white'
                : 'bg-[#0e0e14] border-white/10 shadow-[0_10px_30px_rgba(0,0,0,0.8)] text-gray-300')"
          >
            <button 
              type="button"
              v-for="lang in availableLangs" 
              :key="lang.code" 
              @click="handleSelectLang(lang.code)"
              class="w-full px-4 py-2.5 text-left text-xs font-bold font-code tracking-wider transition-colors flex items-center justify-between"
              :class="currentLang === lang.code 
                ? (currentTheme === 'anime' ? 'text-[#ff66b2] bg-pink-50 font-bold' : 'text-[#00f3ff] bg-[#00f3ff]/10') 
                : (currentTheme === 'anime' ? 'text-[#4a425a] hover:bg-pink-50/50 hover:text-[#1e192b]' : 'text-gray-300 hover:bg-white/5 hover:text-white')"
            >
              <span>{{ lang.label }}</span>
              <span v-if="currentLang === lang.code" class="w-1.5 h-1.5 rounded-full" :class="currentTheme === 'anime' ? 'bg-[#ff66b2]' : 'bg-[#00f3ff]'"></span>
            </button>
          </div>
        </div>
      </div>
    </div>

    <div class="grid grid-cols-1 gap-10 w-full pb-20">

      <!-- 节点连接区（二次元浅色适配：白底高对比粉蓝卡片） -->
      <section 
        class="group relative rounded-theme p-1 overflow-hidden transition-all border"
        :class="currentTheme === 'anime' 
          ? 'bg-white border-[#f5a3c7] shadow-[0_8px_24px_rgba(180,150,230,0.12)] hover:border-[#ff85b3]' 
          : (currentTheme === 'minimal'
            ? 'bg-[#101623]/90 border-[#00f2ff]/20 shadow-[0_8px_32px_rgba(0,0,0,0.5)] hover:border-[#00f2ff]/40 backdrop-blur-md'
            : 'bg-bg-panel border-white/5 hover:border-primary/30')"
      >
        <div 
          class="relative h-full rounded-theme p-6 md:p-8 flex flex-col gap-6"
          :class="currentTheme === 'anime' ? 'bg-white' : (currentTheme === 'minimal' ? 'bg-[#101623]/90 backdrop-blur-md' : 'bg-bg-panel')"
        >
          <h3 
            class="text-base font-bold flex items-center gap-3 tracking-widest transition-colors"
            :class="currentTheme === 'anime' ? 'text-[#1e192b]' : 'text-white'"
          >
            <span class="w-2.5 h-2.5 rounded-full shadow-[0_0_8px]" :class="authStore.isConnected ? 'bg-green-500 shadow-green-500 animate-pulse' : 'bg-red-500 shadow-red-500'"></span>
            {{ t('settings.connection.title') }}
          </h3>

          <div class="flex items-stretch gap-3 w-full flex-wrap lg:flex-nowrap">
            <button 
              type="button" 
              v-for="node in authStore.nodeList" 
              :key="node.id" 
              @click.stop.prevent="selectNode(node.id)" 
              :disabled="authStore.isProcessing" 
              class="flex-1 py-3 px-2 rounded-lg font-bold font-code text-sm tracking-widest transition-all duration-300 select-none flex items-center justify-center gap-2 min-w-[120px]" 
              :class="authStore.selectedNode === node.id 
                ? (currentTheme === 'anime' ? 'bg-pink-100 border-2 border-[#ff85b3] text-[#ff66b2] shadow-sm' : NODE_STYLES[node.id]) 
                : (currentTheme === 'anime' ? 'bg-[#f8faff] text-[#4a425a] border border-[#e2d4f0] hover:border-[#bce8ff] hover:text-[#1e192b] disabled:opacity-40' : 'bg-[#141414] text-[#888] border border-white/5 hover:border-white/20 hover:text-white disabled:opacity-40')"
            >
              <span v-if="authStore.isProcessing && authStore.selectedNode === node.id" class="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin"></span>
              {{ t(node.label) }}
            </button>

            <template v-if="!authStore.isConnected">
              <button 
                type="button" 
                @click.stop.prevent="handleConnect" 
                :disabled="authStore.isProcessing" 
                class="px-8 py-3 font-bold font-code tracking-widest rounded-lg transition-all disabled:opacity-50 text-sm whitespace-nowrap min-w-[120px]"
                :class="currentTheme === 'anime' 
                  ? 'bg-gradient-to-r from-[#ff85b3] to-[#6be5ff] text-white shadow-md hover:brightness-105' 
                  : 'bg-[#141414] border border-primary/50 text-primary hover:bg-primary hover:text-black'"
              >
                {{ authStore.isProcessing ? t('settings.connection.connecting') : t('settings.connection.connect') }}
              </button>
            </template>
            <template v-else>
              <button 
                type="button" 
                @click.stop.prevent="handleDisconnect" 
                :disabled="authStore.isProcessing" 
                class="px-8 py-3 font-bold font-code tracking-widest rounded-lg transition-colors whitespace-nowrap text-sm min-w-[120px]"
                :class="currentTheme === 'anime' 
                  ? 'bg-rose-50 border border-rose-300 text-rose-600 hover:bg-rose-500 hover:text-white' 
                  : 'bg-[#141414] border border-red-500/30 text-red-500 hover:bg-red-500 hover:text-white'"
              >
                {{ authStore.isProcessing ? t('settings.connection.disconnecting') : t('settings.connection.disconnect') }}
              </button>
            </template>
          </div>

          <div class="flex items-center gap-3">
            <template v-if="!authStore.isConnected">
              <input 
                v-model="inputKey" 
                type="text" 
                :placeholder="t('settings.connection.keyPlaceholder')" 
                class="flex-1 rounded-lg px-5 py-3 font-code text-sm focus:outline-none transition-all max-w-md border" 
                :class="currentTheme === 'anime' 
                  ? 'bg-white border-[#e2d4f0] text-[#1e192b] placeholder-[#94a3b8] focus:border-[#ff85b3]' 
                  : 'bg-[#141414] border-white/5 text-primary placeholder-gray-500 focus:border-primary'"
                @keyup.enter="handleConnect"
              />
              <span class="text-sm hidden md:block" :class="currentTheme === 'anime' ? 'text-[#64748b]' : 'text-[#888]'">
                {{ t('settings.connection.keyHint') }}
              </span>
            </template>
          </div>
        </div>
      </section>

      <!-- 身份/特权生态（二次元浅色主题高对比度适配） -->
      <section v-if="authStore.isConnected" class="flex flex-col gap-10 animate-fade-in">

        <div 
          v-if="!authStore.isLoggedIn" 
          class="group relative rounded-theme p-1 overflow-hidden transition-all border"
          :class="currentTheme === 'anime' 
            ? 'bg-white border-[#f5a3c7] shadow-[0_8px_24px_rgba(180,150,230,0.12)] hover:border-[#ff85b3]' 
            : (currentTheme === 'minimal'
              ? 'bg-[#101623]/90 border-[#00f2ff]/20 shadow-[0_8px_32px_rgba(0,0,0,0.5)] hover:border-[#00f2ff]/40 backdrop-blur-md'
              : 'bg-bg-panel border-white/5 hover:border-accent/30')"
        >
          <div 
            class="relative h-full rounded-theme p-8 flex flex-col md:flex-row gap-10"
            :class="currentTheme === 'anime' ? 'bg-white' : (currentTheme === 'minimal' ? 'bg-[#101623]/90 backdrop-blur-md' : 'bg-bg-panel')"
          >
            <div 
              class="flex-1 space-y-5 border-r pr-10"
              :class="currentTheme === 'anime' ? 'border-pink-100' : 'border-white/5'"
            >
              <div class="flex items-center justify-between mb-2">
                <h3 class="font-bold text-xl" :class="currentTheme === 'anime' ? 'text-[#1e192b]' : 'text-white'">{{ t('settings.identity.title') }}</h3>
              </div>
              <input 
                v-model="email" 
                type="text" 
                :placeholder="t('settings.identity.emailPlaceholder')" 
                class="w-full p-4 rounded-theme text-base font-code focus:outline-none border transition-colors"
                :class="currentTheme === 'anime' 
                  ? 'bg-[#f8faff] border-[#e2d4f0] text-[#1e192b] placeholder-[#94a3b8] focus:border-[#ff85b3]' 
                  : 'bg-black/20 border-white/10 text-primary placeholder-gray-500 focus:border-primary'"
              />
              <input 
                v-model="password" 
                type="password" 
                :placeholder="t('settings.identity.passwordPlaceholder')" 
                class="w-full p-4 rounded-theme text-base font-code focus:outline-none border transition-colors"
                :class="currentTheme === 'anime' 
                  ? 'bg-[#f8faff] border-[#e2d4f0] text-[#1e192b] placeholder-[#94a3b8] focus:border-[#ff85b3]' 
                  : 'bg-black/20 border-white/10 text-primary placeholder-gray-500 focus:border-primary'"
                @keyup.enter="handleLogin"
              />

              <div class="flex items-center justify-between pt-2">
                <span class="text-sm text-red-500 font-code font-bold">{{ statusMsg }}</span>
                <div class="flex items-center gap-4">
                  <button type="button" @click="openForgot" class="text-sm font-code transition-colors" :class="currentTheme === 'anime' ? 'text-[#ff66b2] hover:text-[#d6336c]' : 'text-gray-500 hover:text-[#00f3ff]'">{{ t('settings.identity.forgotPassword') }}</button>
                  <button 
                    type="button" 
                    @click="handleLogin" 
                    :disabled="authStore.isProcessing" 
                    class="px-10 py-3 font-bold rounded-theme transition-all font-code text-sm tracking-widest shadow-sm"
                    :class="currentTheme === 'anime' 
                      ? 'bg-gradient-to-r from-[#ff85b3] to-[#6be5ff] text-white hover:brightness-105' 
                      : 'bg-white/5 border border-white/10 hover:bg-primary hover:text-black hover:border-primary text-white'"
                  >
                    {{ authStore.isProcessing ? t('settings.identity.loggingIn') : t('settings.identity.login') }}
                  </button>
                </div>
              </div>
            </div>

            <div class="w-1/3 flex flex-col justify-center items-center text-center pl-4">
              <div class="w-16 h-16 mb-6 opacity-50" :class="currentTheme === 'anime' ? 'text-[#ff66b2]' : 'text-text-muted'">
                <svg xmlns="http://www.w3.org/2000/svg" fill="currentColor" viewBox="0 0 256 256"><path d="M208,32H48A16,16,0,0,0,32,56V208a16,16,0,0,0,16,16H208a16,16,0,0,0,16-16V48A16,16,0,0,0,208,32ZM64,48h32V80H64Zm128,80H128V96h64Zm0-64H128V48h64Z"></path></svg>
              </div>
              <p class="text-sm mb-6 leading-relaxed whitespace-pre-line" :class="currentTheme === 'anime' ? 'text-[#64748b]' : 'text-text-muted'">{{ t('settings.identity.noAccount') }}</p>
              <button 
                type="button" 
                @click="handleOpenRegister" 
                :disabled="authStore.isProcessing" 
                class="w-full py-4 rounded-theme font-bold font-code text-sm tracking-widest transition-all"
                :class="currentTheme === 'anime' 
                  ? 'bg-pink-50 border border-pink-300 text-[#ff66b2] hover:bg-pink-100 shadow-sm' 
                  : 'border border-primary/30 text-primary bg-primary/5 hover:bg-primary hover:text-black shadow-[0_0_15px_rgba(var(--primary-rgb),0.1)]'"
              >
                <span>{{ t('settings.identity.register') }}</span>
              </button>
            </div>
          </div>
        </div>

        <div 
          v-else 
          class="group relative rounded-theme p-1 overflow-hidden transition-all border"
          :class="currentTheme === 'anime' 
            ? 'bg-white border-[#f5a3c7] shadow-[0_8px_24px_rgba(180,150,230,0.12)] hover:border-[#ff85b3]' 
            : (currentTheme === 'minimal'
              ? 'bg-[#101623]/90 border-[#00f2ff]/20 shadow-[0_8px_32px_rgba(0,0,0,0.5)] hover:border-[#00f2ff]/40 backdrop-blur-md'
              : 'bg-bg-panel border-white/5 hover:border-accent/30')"
        >
          <div 
            class="relative h-full rounded-theme p-8 flex flex-col gap-8"
            :class="currentTheme === 'anime' ? 'bg-white' : (currentTheme === 'minimal' ? 'bg-[#101623]/90 backdrop-blur-md' : 'bg-bg-panel')"
          >
            <div class="flex items-center justify-between">
              <div class="flex items-center gap-6">
                <!-- 暗号彩蛋：点头像开启快捷键 -->
                <div 
                  class="w-20 h-20 rounded-full border-2 p-0.5 cursor-pointer transition-all duration-300 hover:scale-105" 
                  :class="currentTheme === 'anime' ? 'border-[#ff85b3] shadow-[0_0_20px_rgba(255,133,179,0.35)]' : 'border-primary shadow-[0_0_20px_rgba(var(--primary-rgb),0.3)] hover:shadow-[0_0_30px_rgba(var(--primary-rgb),0.6)] hover:border-[#00f3ff]'"
                  @click="showKeyboardSettings = true" 
                  :title="t('settings.setHotkeyTitle')"
                >
                  <div class="w-full h-full rounded-full flex items-center justify-center font-bold text-3xl" :class="currentTheme === 'anime' ? 'bg-pink-100 text-[#ff66b2]' : 'bg-gray-800 text-primary'">
                    {{ authStore.user?.username?.charAt(0).toUpperCase() }}
                  </div>
                </div>
                <div>
                  <h3 class="text-3xl font-bold mb-2" :class="currentTheme === 'anime' ? 'text-[#1e192b]' : 'text-white'">{{ authStore.user?.username }}</h3>
                  <div class="flex items-center gap-3">
                    <span 
                      class="text-sm font-code px-3 py-1 rounded border font-bold tracking-wide" 
                      :class="authStore.isVip 
                        ? (currentTheme === 'anime' ? 'border-pink-300 text-[#ff66b2] bg-pink-50' : 'border-accent text-accent bg-accent/10') 
                        : (currentTheme === 'anime' ? 'border-slate-300 text-slate-600 bg-slate-50' : 'border-gray-500 text-gray-400')"
                    >
                      {{ authStore.isVip ? t('settings.identity.vipMember') : t('settings.identity.normalUser') }}
                    </span>
                    <span class="text-sm font-code" :class="currentTheme === 'anime' ? 'text-[#64748b]' : 'text-text-muted'">ID: {{ authStore.user?.id }}</span>
                    <span v-if="authStore.isVip && authStore.user?.vipExpireDate" class="text-sm font-code border-l pl-3" :class="currentTheme === 'anime' ? 'text-[#ff66b2] border-pink-200' : 'text-accent border-white/20'">
                      {{ t('settings.identity.expire') }}: {{ authStore.user.vipExpireDate }}
                    </span>
                  </div>
                </div>
              </div>

              <div class="flex items-center gap-4">
                <!-- DOCUMENTATION 使用指南 -->
                <div 
                  class="flex items-center gap-4 border px-5 py-2.5 rounded-lg relative overflow-hidden group/dbbtn"
                  :class="currentTheme === 'anime' ? 'bg-white border-[#bce8ff] shadow-sm' : 'bg-black/40 border-white/10'"
                >
                  <div class="flex flex-col text-right z-10">
                    
                    <span class="text-sm font-bold tracking-wide" :class="currentTheme === 'anime' ? 'text-[#1e192b]' : 'text-white'">{{ t('settings.docs.btnTitle') }}</span>
                  </div>
                  <button 
                    type="button" 
                    @click="showDocs = true" 
                    class="px-4 py-2 border rounded transition-all font-bold font-code text-sm tracking-widest relative overflow-hidden z-10 whitespace-nowrap"
                    :class="currentTheme === 'anime' 
                      ? 'bg-pink-50 hover:bg-pink-100 text-[#ff66b2] border-pink-200' 
                      : 'bg-[#00f3ff]/10 hover:bg-[#00f3ff]/20 text-[#00f3ff] border-[#00f3ff]/30'"
                  >
                    <span>{{ t('settings.docs.openBtn') }}</span>
                  </button>
                </div>
                <button 
                  type="button" 
                  @click="handleLogout" 
                  :disabled="authStore.isProcessing" 
                  class="px-8 py-3 border rounded-theme font-code text-sm tracking-widest transition-all"
                  :class="currentTheme === 'anime' ? 'border-[#e2d4f0] text-[#64748b] hover:text-[#1e192b] hover:bg-slate-50' : 'border-white/20 text-text-muted hover:text-white hover:border-white'"
                >
                  {{ t('settings.identity.logout') }}
                </button>
              </div>
            </div>

            <!-- VIP 尊享流光线 -->
            <div v-if="authStore.isVip" class="vip-flow-line"></div>

            <!-- 激活与赞助支持 (二次元浅色高对比度适配) -->
            <div class="border-t pt-8 transition-colors" :class="currentTheme === 'anime' ? 'border-pink-100' : 'border-white/5'">
              <h3 class="text-xl font-bold mb-6 font-code tracking-wider flex items-center gap-2" :class="currentTheme === 'anime' ? 'text-[#1e192b]' : 'text-white'">
                {{ t('settings.redeem.title') }}
                
              </h3>
              <div class="flex flex-col md:flex-row gap-6 items-stretch">
                <div class="flex-1 flex gap-4 items-center">
                  <input 
                    v-model="redeemCode" 
                    type="text" 
                    :placeholder="t('settings.redeem.codePlaceholder')" 
                    class="flex-1 rounded-theme px-5 py-3.5 font-code text-base focus:outline-none border transition-all" 
                    :class="currentTheme === 'anime' 
                      ? 'bg-white border-[#e2d4f0] text-[#1e192b] placeholder-[#94a3b8] focus:border-[#ff85b3]' 
                      : 'bg-black/20 border-white/10 text-[#00f3ff] placeholder-gray-500 focus:border-[#00f3ff]'"
                  />
                  <input 
                    v-model="redeemContact" 
                    type="text" 
                    :placeholder="t('settings.redeem.contactPlaceholder')" 
                    class="w-56 rounded-theme px-5 py-3.5 font-code text-base focus:outline-none border transition-all" 
                    :class="currentTheme === 'anime' 
                      ? 'bg-white border-[#e2d4f0] text-[#1e192b] placeholder-[#94a3b8] focus:border-[#ff85b3]' 
                      : 'bg-black/20 border-white/10 text-white placeholder-gray-500 focus:border-[#00f3ff]'"
                  />
                  <button 
                    type="button" 
                    @click="handleRedeem" 
                    :disabled="authStore.isProcessing" 
                    class="px-8 py-3.5 min-w-[100px] font-black font-code tracking-widest rounded-theme transition-all disabled:opacity-50 whitespace-nowrap shadow-sm"
                    :class="currentTheme === 'anime' 
                      ? 'bg-gradient-to-r from-[#ff85b3] to-[#6be5ff] text-white hover:brightness-105' 
                      : 'bg-[#00f3ff] text-black hover:bg-white'"
                  >
                    {{ authStore.isProcessing ? t('settings.redeem.processing') : t('settings.redeem.activate') }}
                  </button>
                </div>
                <div class="w-px mx-2 hidden md:block" :class="currentTheme === 'anime' ? 'bg-pink-100' : 'bg-white/10'"></div>
                <button 
                  type="button" 
                  @click="handleOpenShop" 
                  class="px-8 py-3.5 min-w-[160px] border rounded-theme font-bold font-code tracking-widest transition-all whitespace-nowrap"
                  :class="currentTheme === 'anime' 
                    ? 'border-[#ff85b3] text-[#ff66b2] bg-white hover:bg-pink-50 shadow-sm' 
                    : 'border-[#00f3ff]/30 text-[#00f3ff] hover:bg-[#00f3ff] hover:text-black'"
                >
                  {{ t('settings.redeem.getKey') }}
                </button>
              </div>
            </div>
          </div>
        </div>

        <!-- ========================================================================= -->
        <!-- 下半区重构：系统核心与维护中枢（2x2 战术工控矩阵 · 二次元浅色高对比度适配） -->
        <!-- ========================================================================= -->
        <section 
          class="group relative rounded-theme p-1 overflow-hidden transition-all border animate-fade-in delay-100"
          :class="currentTheme === 'anime' 
            ? 'bg-white border-2 border-[#bce8ff] shadow-[0_8px_24px_rgba(170,205,255,0.2)]' 
            : (currentTheme === 'minimal'
              ? 'bg-[#101623]/90 border-[#00f2ff]/20 shadow-[0_8px_32px_rgba(0,0,0,0.5)] hover:border-[#00f2ff]/40 backdrop-blur-md'
              : 'bg-bg-panel border-white/5 hover:border-primary/30')"
        >
          <div 
            class="relative h-full rounded-theme p-6 md:p-8 flex flex-col gap-6"
            :class="currentTheme === 'anime' ? 'bg-white' : (currentTheme === 'minimal' ? 'bg-[#101623]/90 backdrop-blur-md' : 'bg-bg-panel')"
          >

            <!-- 标题工具栏：左侧标题 + 右侧工具组（实验功能锁定置于系统自检左侧） -->
            <div class="flex items-center justify-between border-b pb-5 transition-colors" :class="currentTheme === 'anime' ? 'border-pink-100' : 'border-white/5'">
              <h3 class="text-xl font-bold tracking-widest flex items-center gap-3" :class="currentTheme === 'anime' ? 'text-[#1e192b]' : 'text-white'">
                <span class="w-2.5 h-2.5 rounded-full" :class="currentTheme === 'anime' ? 'bg-[#ff66b2] shadow-[0_0_8px_#ff66b2]' : 'bg-[#00f3ff] shadow-[0_0_10px_#00f3ff] animate-pulse'"></span>
                <span>{{ t('settings.coreEnv.titleCore') }}</span>
              </h3>
              <div class="flex items-center gap-3">
                <!-- 实验功能 -->
                <button
                  type="button"
                  @click="showExpModal = true"
                  class="h-9 px-4 rounded-[4px] text-xs font-bold tracking-wider flex items-center border transition-all whitespace-nowrap"
                  :class="currentTheme === 'anime'
                    ? 'border-[#bce8ff] text-[#4a425a] bg-[#f8faff] hover:bg-pink-50 hover:text-[#ff66b2] hover:border-[#ff9ec7]'
                    : 'border-white/10 text-zinc-400 bg-white/[0.02] hover:bg-[#00f3ff]/[0.04] hover:text-[#00f3ff] hover:border-[#00f3ff]/30'"
                >
                  {{ t('settings.exp.btn') }}
                </button>

                <!-- 导入清单 -->
                <button 
                  type="button" 
                  v-if="prefEnableLuaImport"
                  @click="handleImportLua" 
                  :disabled="isImportingLua" 
                  class="h-9 px-4 rounded-[4px] text-xs font-bold tracking-wider flex items-center border transition-all disabled:opacity-50 whitespace-nowrap gap-2"
                  :class="currentTheme === 'anime'
                    ? 'border-[#bce8ff] text-[#4a425a] bg-[#f8faff] hover:bg-pink-50 hover:text-[#ff66b2] hover:border-[#ff9ec7]'
                    : 'border-white/10 text-zinc-400 bg-white/[0.02] hover:bg-[#00f3ff]/[0.04] hover:text-[#00f3ff] hover:border-[#00f3ff]/30'"
                >
                  <span v-if="isImportingLua" class="w-3.5 h-3.5 border-2 border-current border-t-transparent rounded-full animate-spin"></span>
                  {{ isImportingLua ? t('settings.luaImporting') : t('settings.luaImport') }}
                </button>

                <!-- 系统自检 -->
                <button 
                  type="button" 
                  @click="runSystemDiagnostics" 
                  :disabled="isRunningDiagnostics" 
                  class="h-9 px-4 rounded-[4px] text-xs font-bold tracking-wider flex items-center border transition-all disabled:opacity-50 whitespace-nowrap gap-2"
                  :class="currentTheme === 'anime'
                    ? 'border-[#bce8ff] text-[#4a425a] bg-[#f8faff] hover:bg-pink-50 hover:text-[#ff66b2] hover:border-[#ff9ec7]'
                    : 'border-white/10 text-zinc-400 bg-white/[0.02] hover:bg-[#00f3ff]/[0.04] hover:text-[#00f3ff] hover:border-[#00f3ff]/30'"
                >
                  <span v-if="isRunningDiagnostics" class="w-3.5 h-3.5 border-2 border-current border-t-transparent rounded-full animate-spin"></span>
                  {{ isRunningDiagnostics ? t('settings.diagRunning') : t('settings.diagBtn') }}
                </button>
              </div>
            </div>

            <!-- 核心 2x2 战术工控矩阵：绝对水平与对称基线（二次元浅色高对比度） -->
            <div class="grid grid-cols-1 lg:grid-cols-2 gap-5">

              <!-- 卡片 1: OST 模式与启动 -->
              <div 
                class="p-6 rounded-xl border flex flex-col justify-between min-h-[148px] transition-colors"
                :class="currentTheme === 'anime' 
                  ? 'bg-gradient-to-b from-[#ffffff] to-[#f8faff] border-[#bce8ff] shadow-sm' 
                  : (currentTheme === 'minimal'
                    ? 'bg-[#0c121d]/90 border-[#00f2ff]/20 shadow-[inset_0_1px_0_rgba(255,255,255,0.06)]'
                    : 'bg-[#0a0a0a] border-white/5 shadow-inner')"
              >
                <div class="h-9 flex items-center justify-between">
                  <span class="text-base font-bold font-code tracking-wider" :class="currentTheme === 'anime' ? 'text-[#1e192b]' : 'text-gray-300'">{{ t('settings.ostModeTitle') }}</span>
                  <span 
                    class="font-code text-sm px-3.5 py-1.5 rounded-lg border tracking-wider font-bold transition-all"
                    :class="ostMode === 'pure' 
                      ? (currentTheme === 'anime' ? 'border-sky-300 text-sky-700 bg-sky-50 shadow-sm' : 'border-[#00f3ff]/40 text-[#00f3ff] bg-[#00f3ff]/10 shadow-[0_0_12px_rgba(0,243,255,0.15)]') 
                      : (currentTheme === 'anime' ? 'border-[#e2d4f0] text-[#64748b] bg-slate-50' : 'border-white/10 text-gray-300 bg-white/5')"
                  >
                    {{ ostMode === 'pure' ? t('settings.ostModePureDesc') : t('settings.ostModeClassicDesc') }}
                  </span>
                </div>
                <!-- 底行左右对称锚定 -->
                <div class="h-9 flex items-center justify-between gap-3 mt-4">
                  <button
                    type="button"
                    @click="onSwitchModeClick(ostMode === 'pure' ? 'classic' : 'pure')"
                    :disabled="isSwitchingOstMode"
                    class="h-9 px-4 rounded-lg font-bold font-code text-sm tracking-widest transition-all disabled:opacity-50 whitespace-nowrap flex items-center justify-center border"
                    :class="currentTheme === 'anime'
                      ? 'bg-white border-[#e2d4f0] text-[#4a425a] hover:bg-pink-50 hover:text-[#ff66b2] hover:border-[#ff9ec7] shadow-sm'
                      : 'bg-[#141414] border-white/10 text-white hover:text-black hover:bg-[#00f3ff] hover:border-[#00f3ff]'"
                  >
                    <span v-if="isSwitchingOstMode" class="w-3.5 h-3.5 border-2 border-current border-t-transparent rounded-full animate-spin inline-block mr-2 align-middle"></span>
                    {{ isSwitchingOstMode ? t('settings.ostModeSwitching') : (ostMode === 'pure' ? t('settings.ostModeToClassic') : t('settings.ostModeToPure')) }}
                  </button>
                  <button
                    type="button"
                    @click="handleLaunchSteam"
                    :disabled="isLaunchingSteam"
                    class="h-9 px-4 rounded-lg font-bold font-code text-sm tracking-widest transition-all disabled:opacity-50 whitespace-nowrap flex items-center justify-center border"
                    :class="currentTheme === 'anime'
                      ? 'bg-gradient-to-r from-[#ff85b3] to-[#6be5ff] text-white shadow-sm hover:brightness-105 border-transparent'
                      : 'bg-[#141414] border-[#00f3ff]/40 text-[#00f3ff] hover:bg-[#00f3ff] hover:text-black shadow-[0_0_15px_rgba(0,243,255,0.15)]'"
                  >
                    <span v-if="isLaunchingSteam" class="w-3.5 h-3.5 border-2 border-current border-t-transparent rounded-full animate-spin inline-block mr-2 align-middle"></span>
                    {{ isLaunchingSteam ? t('settings.ostModeLaunching') : t('settings.ostModeLaunch') }}
                  </button>
                </div>
              </div>

              <!-- 卡片 2: Steam 宿主环境 -->
              <div 
                class="p-6 rounded-xl border flex flex-col justify-between min-h-[148px] transition-colors"
                :class="currentTheme === 'anime' 
                  ? 'bg-gradient-to-b from-[#ffffff] to-[#f8faff] border-[#bce8ff] shadow-sm' 
                  : (currentTheme === 'minimal'
                    ? 'bg-[#0c121d]/90 border-[#00f2ff]/20 shadow-[inset_0_1px_0_rgba(255,255,255,0.06)]'
                    : 'bg-[#0a0a0a] border-white/5 shadow-inner')"
              >
                <div class="h-9 flex items-center justify-between">
                  <span 
                    class="text-sm font-bold font-code tracking-wider uppercase" 
                    :class="steamSource === 'manual' 
                      ? (currentTheme === 'anime' ? 'text-amber-600' : 'text-[#eab308]') 
                      : (steamPath ? (currentTheme === 'anime' ? 'text-[#1e192b]' : 'text-gray-400') : 'text-red-500')"
                  >
                    {{ steamSource === 'manual' ? t('steam.sourceManual') : (steamSource !== 'none' ? t('steam.sourceAuto') : t('steam.sourceNone')) }}
                  </span>
                  <span class="w-2 h-2 rounded-full" :class="steamPath ? (currentTheme === 'anime' ? 'bg-sky-500 shadow-[0_0_6px_#0ea5e9]' : 'bg-[#00f3ff] shadow-[0_0_6px_#00f3ff]') : 'bg-red-500'"></span>
                </div>
                <div class="h-9 flex items-center justify-between gap-4 mt-4">
                  <div class="flex-1 overflow-hidden">
                    <span 
                      class="font-code text-base truncate font-medium block" 
                      :class="!steamPath 
                        ? 'text-red-500' 
                        : (currentTheme === 'anime' ? 'text-sky-700 font-bold' : 'text-[#00f3ff]')"
                    >
                      {{ steamPath || t('steam.pathNotFound') }}
                    </span>
                  </div>
                  <button 
                    type="button" 
                    @click="handleSelectSteamPath" 
                    :disabled="isDetectingSteam" 
                    class="h-9 px-4 rounded-lg font-bold font-code text-sm tracking-widest transition-all disabled:opacity-50 whitespace-nowrap shrink-0 flex items-center justify-center border"
                    :class="currentTheme === 'anime'
                      ? 'bg-white border-[#e2d4f0] text-[#4a425a] hover:bg-pink-50 hover:text-[#ff66b2] hover:border-[#ff9ec7] shadow-sm'
                      : 'bg-[#141414] border-white/10 text-white hover:text-black hover:bg-[#00f3ff] hover:border-[#00f3ff]'"
                  >
                    <span v-if="isDetectingSteam" class="w-3.5 h-3.5 border-2 border-current border-t-transparent rounded-full animate-spin inline-block mr-2 align-middle"></span>
                    {{ t('steam.manualSelect') }}
                  </button>
                </div>
              </div>

              <!-- 卡片 3: 云存档同步 & 账号隔离控制台 -->
              <div 
                class="p-6 rounded-xl border flex flex-col justify-between min-h-[148px] transition-colors"
                :class="currentTheme === 'anime' 
                  ? 'bg-gradient-to-b from-[#ffffff] to-[#f8faff] border-[#bce8ff] shadow-sm' 
                  : (currentTheme === 'minimal'
                    ? 'bg-[#0c121d]/90 border-[#00f2ff]/20 shadow-[inset_0_1px_0_rgba(255,255,255,0.06)]'
                    : 'bg-[#0a0a0a] border-white/5 shadow-inner')"
              >
                <div class="h-9 flex items-center justify-between">
                  <span class="text-base font-bold font-code tracking-wider" :class="currentTheme === 'anime' ? 'text-[#1e192b]' : 'text-gray-300'">{{ t('settings.cloudSync') }}</span>
                  <button 
                    type="button"
                    @click="handleToggleCloudSave"
                    :disabled="isTogglingCloud"
                    class="w-12 h-6 rounded-full transition-colors relative shrink-0"
                    :class="cloudSaveEnabled ? (currentTheme === 'anime' ? 'bg-[#ff66b2]' : 'bg-[#00f3ff]') : 'bg-gray-400'"
                  >
                    <div 
                      class="absolute top-0.5 w-5 h-5 rounded-full bg-white transition-all shadow-sm"
                      :class="cloudSaveEnabled ? 'left-6' : 'left-0.5'" 
                    />
                  </button>
                </div>
                <!-- 左侧放置策略状态胶囊，消除塌陷；右侧保留纯粹控制台按钮 -->
                <div class="h-9 flex items-center justify-between gap-4 mt-4">
                  <span 
                    class="text-xs px-2.5 py-1 rounded font-bold font-code tracking-wider border"
                    :class="gateActiveCount > 0 
                      ? (currentTheme === 'anime' ? 'bg-sky-50 text-sky-700 border-sky-200' : 'bg-[#00f3ff]/20 text-[#00f3ff] border-[#00f3ff]/30') 
                      : (currentTheme === 'anime' ? 'bg-slate-50 text-slate-600 border-slate-200' : 'bg-white/5 text-gray-400 border border-white/10')"
                  >
                    {{ gateActiveCount > 0 ? t('settings.gateAuthorized', { count: gateActiveCount }) : t('settings.gateGlobal') }}
                  </span>
                  <button 
                    type="button" 
                    @click="handleOpenAccountModal" 
                    class="h-9 px-4 rounded-lg font-bold font-code text-sm tracking-widest transition-all duration-300 flex items-center justify-center whitespace-nowrap shrink-0 border"
                    :class="currentTheme === 'anime'
                      ? 'bg-pink-50 border border-pink-300 text-[#ff66b2] hover:bg-pink-100 shadow-sm'
                      : 'bg-[#141414] border border-[#00f3ff]/40 text-[#00f3ff] hover:bg-[#00f3ff] hover:text-black shadow-[0_0_15px_rgba(0,243,255,0.15)]'"
                  >
                    {{ t('settings.accountConsole') }}
                  </button>
                </div>
              </div>

              <!-- 卡片 4: 客户端版本 & 检查更新 -->
              <div 
                class="p-6 rounded-xl border flex flex-col justify-between min-h-[148px] transition-colors"
                :class="currentTheme === 'anime' 
                  ? 'bg-gradient-to-b from-[#ffffff] to-[#f8faff] border-[#bce8ff] shadow-sm' 
                  : (currentTheme === 'minimal'
                    ? 'bg-[#0c121d]/90 border-[#00f2ff]/20 shadow-[inset_0_1px_0_rgba(255,255,255,0.06)]'
                    : 'bg-[#0a0a0a] border-white/5 shadow-inner')"
              >
                <div class="h-9 flex items-center justify-between">
                  <span class="text-base font-bold font-code tracking-wider" :class="currentTheme === 'anime' ? 'text-[#1e192b]' : 'text-gray-300'">{{ t('settings.version.title') }}</span>
                  <span 
                    class="text-xs px-2.5 py-0.5 rounded-full font-code tracking-widest font-bold border"
                    :class="currentTheme === 'anime' ? 'text-sky-700 border-sky-200 bg-sky-50' : 'text-[#00f3ff] border-[#00f3ff]/30 bg-[#00f3ff]/10'"
                  >
                    {{ t('settings.version.latest') }}
                  </span>
                </div>
                <div class="h-9 flex items-center justify-between gap-4 mt-4">
                  <span class="font-code text-xl font-bold tracking-wider" :class="currentTheme === 'anime' ? 'text-[#1e192b]' : 'text-white font-light'">v{{ currentAppVersion || '1.9.7' }}</span>
                  <button 
                    type="button" 
                    @click="handleCheckAppUpdate" 
                    :disabled="authStore.isProcessing" 
                    class="h-9 px-4 rounded-lg font-bold font-code text-sm tracking-widest transition-all disabled:opacity-50 whitespace-nowrap flex items-center justify-center gap-2 border"
                    :class="currentTheme === 'anime'
                      ? 'bg-white border-[#e2d4f0] text-[#4a425a] hover:bg-pink-50 hover:text-[#ff66b2] hover:border-[#ff9ec7] shadow-sm'
                      : 'bg-[#141414] border border-white/10 text-gray-300 hover:text-black hover:bg-[#00f3ff] hover:border-[#00f3ff]'"
                  >
                    <span v-if="authStore.isProcessing" class="w-3.5 h-3.5 border-2 border-current border-t-transparent rounded-full animate-spin"></span>
                    {{ authStore.isProcessing ? t('settings.version.scanning') : t('settings.version.checkUpdate') }}
                  </button>
                </div>
              </div>

            </div>

            <!-- 底槽：应急维护内聚 (二次元浅色高对比度) -->
            <div class="border-t pt-3 transition-colors" :class="currentTheme === 'anime' ? 'border-pink-100' : 'border-white/5'">
              <div 
                class="p-5 rounded-xl border flex flex-col md:flex-row items-center justify-between gap-6 transition-colors"
                :class="currentTheme === 'anime' ? 'bg-rose-50/70 border-rose-200' : 'bg-red-500/5 border-red-500/15'"
              >
                <div>
                  <div class="text-base font-bold mb-1.5 flex items-center gap-2" :class="currentTheme === 'anime' ? 'text-rose-700' : 'text-red-400'">
                    <span class="w-2 h-2 rounded-full bg-red-500"></span>
                    <span>{{ t('settings.maintain.restoreTitle') }}</span>
                  </div>
                  <p class="text-sm leading-relaxed max-w-xl font-code" :class="currentTheme === 'anime' ? 'text-slate-600' : 'text-gray-400'">{{ t('settings.maintain.restoreDesc') }}</p>
                </div>
                <button 
                  type="button" 
                  @click="handleEmergencyRestore" 
                  :disabled="isRestoring" 
                  class="px-8 py-3 rounded-lg transition-all font-code text-sm whitespace-nowrap disabled:opacity-50 flex items-center gap-2 shrink-0 border"
                  :class="currentTheme === 'anime' 
                    ? 'bg-rose-500 text-white hover:bg-rose-600 border-rose-500 shadow-sm' 
                    : 'bg-red-500/10 border border-red-500/50 hover:bg-red-500 hover:text-white text-red-500 shadow-[0_0_15px_rgba(239,68,68,0.15)]'"
                >
                  <span v-if="isRestoring" class="w-3.5 h-3.5 border-2 border-current border-t-transparent rounded-full animate-spin"></span>
                  {{ isRestoring ? t('settings.maintain.restoring') : t('settings.maintain.restoreBtn') }}
                </button>
              </div>
            </div>

          </div>
        </section>

      </section>

      <ExpFeaturesModal v-if="showExpModal" v-model:visible="showExpModal" @close="showExpModal = false" />

    </div>

    <!-- 切换模式专属提示确认弹窗 (重构: 独立组件，纯净/经典双模适配) -->
    <ModeSwitchModal
      v-model:visible="showModeSwitchModal"
      :target-mode="targetModeToSwitch"
      :is-switching="isSwitchingOstMode"
      @confirm="confirmSwitchMode"
    />

    <!-- 弹窗矩阵 (保留生产级业务组件) -->
    <AccountMatrixModal 
      :visible="showAccountMatrixModal" 
      @close="showAccountMatrixModal = false" 
      @saved="handleGateSaved"
    />

    <BaseModal 
      :visible="showForgot" 
      @close="showForgot = false" 
      :show-close="true" 
      :container-class="currentTheme === 'anime' 
        ? 'max-w-sm w-full bg-white/95 border-2 border-[#bce8ff] p-8 shadow-[0_20px_60px_rgba(180,150,230,0.25)]' 
        : 'max-w-sm w-full bg-[#0a0a0f] border border-white/10 p-8 shadow-[0_0_40px_rgba(0,243,255,0.08)]'"
    >
      <div 
        class="absolute top-0 left-0 w-full h-0.5"
        :class="currentTheme === 'anime' ? 'bg-gradient-to-r from-transparent via-[#ff85b3]/70 to-transparent' : 'bg-gradient-to-r from-transparent via-[#00f3ff]/50 to-transparent'"
      ></div>
      <div class="flex flex-col items-center mb-6">
        <div 
          class="w-12 h-12 rounded-full flex items-center justify-center mb-4 border"
          :class="currentTheme === 'anime'
            ? 'bg-pink-50 border-pink-200 text-[#ff66b2] shadow-[0_4px_12px_rgba(255,133,179,0.2)]'
            : 'bg-[#00f3ff]/10 border-[#00f3ff]/30 text-[#00f3ff] shadow-[0_0_15px_rgba(0,243,255,0.15)]'"
        >
          <svg width="22" height="22" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z" /></svg>
        </div>
        <h3 class="text-lg font-black tracking-widest uppercase font-code" :class="currentTheme === 'anime' ? 'text-[#1e192b]' : 'text-white'">{{ t('settings.forgot.title') }}</h3>
        <div class="flex items-center gap-1.5 mt-3">
          <span 
            v-for="step in 3" 
            :key="step" 
            class="h-1 rounded-full transition-all duration-300" 
            :class="forgotStep >= step 
              ? (currentTheme === 'anime' ? 'w-6 bg-[#ff66b2]' : 'w-6 bg-[#00f3ff]') 
              : (currentTheme === 'anime' ? 'w-3 bg-pink-100' : 'w-3 bg-white/10')"
          ></span>
        </div>
      </div>

      <div v-if="forgotStep === 1" class="space-y-4">
        <input 
          v-model="forgotUsername" 
          type="text" 
          :placeholder="t('settings.forgot.usernamePlaceholder')" 
          class="w-full rounded-theme px-5 py-3.5 font-code text-base transition-all border outline-none" 
          :class="currentTheme === 'anime'
            ? 'bg-white border-[#e2d4f0] text-[#1e192b] focus:border-[#ff85b3] placeholder:text-[#94a3b8]'
            : 'bg-black/20 border-white/10 text-white focus:border-[#00f3ff]'"
          @keyup.enter="handleForgotCheck"
        />
        <input 
          v-model="forgotEmail" 
          type="email" 
          :placeholder="t('settings.forgot.emailPlaceholder')" 
          class="w-full rounded-theme px-5 py-3.5 font-code text-base transition-all border outline-none" 
          :class="currentTheme === 'anime'
            ? 'bg-white border-[#e2d4f0] text-[#1e192b] focus:border-[#ff85b3] placeholder:text-[#94a3b8]'
            : 'bg-black/20 border-white/10 text-white focus:border-[#00f3ff]'"
          @keyup.enter="handleForgotCheck"
        />
        <button 
          @click="handleForgotCheck" 
          :disabled="!forgotUsername || !forgotEmail || authStore.isProcessing" 
          class="w-full py-3 font-black font-code tracking-widest rounded-theme transition-all disabled:opacity-50"
          :class="currentTheme === 'anime'
            ? 'bg-gradient-to-r from-[#ff85b3] via-[#ff9ec7] to-[#6be5ff] text-white shadow-[0_6px_16px_rgba(255,133,179,0.38)] hover:opacity-95'
            : 'bg-[#00f3ff] text-black hover:bg-white'"
        >
          {{ authStore.isProcessing ? t('settings.forgot.searching') : t('settings.forgot.next') }}
        </button>
      </div>

      <div v-if="forgotStep === 2" class="space-y-4">
        <p class="text-sm font-code" :class="currentTheme === 'anime' ? 'text-slate-600' : 'text-gray-500'">
          {{ t('settings.forgot.account') }}：<span class="font-bold" :class="currentTheme === 'anime' ? 'text-[#ff66b2]' : 'text-white'">{{ forgotUsername }}</span>
        </p>
        <input 
          v-model="forgotPass" 
          type="password" 
          :placeholder="t('settings.forgot.passwordPlaceholder')" 
          class="w-full rounded-theme px-5 py-3.5 font-code text-base transition-all border outline-none" 
          :class="currentTheme === 'anime'
            ? 'bg-white border-[#e2d4f0] text-[#1e192b] focus:border-[#ff85b3] placeholder:text-[#94a3b8]'
            : 'bg-black/20 border-white/10 text-white focus:border-[#00f3ff]'"
          @keyup.enter="handleForgotReset"
        />
        <button 
          @click="handleForgotReset" 
          :disabled="!forgotPass || forgotPass.length < 6 || authStore.isProcessing" 
          class="w-full py-3 font-black font-code tracking-widest rounded-theme transition-all disabled:opacity-50"
          :class="currentTheme === 'anime'
            ? 'bg-gradient-to-r from-[#ff85b3] via-[#ff9ec7] to-[#6be5ff] text-white shadow-[0_6px_16px_rgba(255,133,179,0.38)] hover:opacity-95'
            : 'bg-[#00f3ff] text-black hover:bg-white'"
        >
          {{ authStore.isProcessing ? t('settings.forgot.resetting') : t('settings.forgot.reset') }}
        </button>
      </div>

      <div v-if="forgotStep === 3" class="text-center space-y-4">
        <p class="font-code text-sm font-bold" :class="currentTheme === 'anime' ? 'text-emerald-600' : 'text-green-400'">{{ t('settings.forgot.success') }}</p>
        <button 
          @click="closeForgotAndLogin" 
          class="w-full py-3 font-black font-code tracking-widest rounded-theme transition-all border"
          :class="currentTheme === 'anime'
            ? 'bg-pink-50 border-[#ff9ec7] text-[#ff66b2] hover:bg-pink-100'
            : 'bg-white/5 border-white/10 hover:bg-[#00f3ff]/10 hover:border-[#00f3ff]/30 hover:text-[#00f3ff] text-white'"
        >
          {{ t('settings.forgot.goLogin') }}
        </button>
      </div>

      <p v-if="statusMsg && showForgot" class="mt-4 text-sm text-red-500 font-code text-center">{{ statusMsg }}</p>
      <button 
        @click="showForgot = false" 
        class="mt-6 w-full text-sm font-code transition-colors"
        :class="currentTheme === 'anime' ? 'text-slate-500 hover:text-[#ff66b2]' : 'text-gray-500 hover:text-white'"
      >
        {{ t('common.cancel') }}
      </button>
    </BaseModal>

    <BaseModal 
      :visible="showRegister" 
      @close="showRegister = false" 
      :show-close="true" 
      :container-class="currentTheme === 'anime'
        ? 'max-w-sm w-full bg-white/95 border-2 border-[#bce8ff] p-8 shadow-[0_20px_60px_rgba(180,150,230,0.25)]'
        : 'max-w-sm w-full bg-[#0a0a0f] border border-[#00f3ff]/20 p-8 shadow-[0_0_40px_rgba(0,243,255,0.08)]'"
    >
      <div 
        class="absolute top-0 left-0 w-full h-0.5"
        :class="currentTheme === 'anime' ? 'bg-gradient-to-r from-transparent via-[#ff85b3]/70 to-transparent' : 'bg-gradient-to-r from-transparent via-[#00f3ff]/50 to-transparent'"
      ></div>
      <div class="flex flex-col items-center mb-6">
        <div 
          class="w-12 h-12 rounded-full flex items-center justify-center mb-4 border"
          :class="currentTheme === 'anime'
            ? 'bg-pink-50 border-pink-200 text-[#ff66b2] shadow-[0_4px_12px_rgba(255,133,179,0.2)]'
            : 'bg-[#00f3ff]/10 border-[#00f3ff]/30 text-[#00f3ff] shadow-[0_0_15px_rgba(0,243,255,0.15)]'"
        >
          <svg width="22" height="22" fill="currentColor" viewBox="0 0 256 256"><path d="M256,136a8,8,0,0,1-8,8H224v24a8,8,0,0,1-16,0V144H184a8,8,0,0,1,0-16h24V104a8,8,0,0,1,16,0v24h24A8,8,0,0,1,256,136ZM140,56A44,44,0,1,1,96,100,44,44,0,0,1,140,56ZM96,112a48,48,0,0,0-33.94,14.06A76.2,76.2,0,0,0,40.2,169.73a8,8,0,0,0,7.6,5.52H96a8,8,0,0,0,0-16H57.07C64.56,139.82,79.48,128,96,128s31.44,11.82,38.93,31.23a8,8,0,0,1,14.14-7.51A64.85,64.85,0,0,0,133,143.3,48,48,0,0,0,96,112Z"/></svg>
        </div>
        <h3 class="text-xl font-code tracking-[4px] uppercase" :class="currentTheme === 'anime' ? 'text-[#1e192b] font-black' : 'text-white'">{{ t('register.title') }}</h3>
      </div>

      <div class="space-y-4">
        <input 
          v-model="regUsername" 
          type="text" 
          :placeholder="t('register.usernamePlaceholder')" 
          autocomplete="off" 
          class="w-full rounded font-code text-sm transition-all px-4 py-3 border outline-none" 
          :class="currentTheme === 'anime'
            ? 'bg-white border-[#e2d4f0] text-[#1e192b] focus:border-[#ff85b3] placeholder:text-[#94a3b8]'
            : 'bg-[#00f3ff]/5 border-[#00f3ff]/20 text-[#00f3ff] focus:border-[#00f3ff]'"
          @keyup.enter="handleRegisterSubmit"
        />
        <input 
          v-model="regEmail" 
          type="email" 
          :placeholder="t('register.emailPlaceholder')" 
          autocomplete="off" 
          class="w-full rounded font-code text-sm transition-all px-4 py-3 border outline-none" 
          :class="currentTheme === 'anime'
            ? 'bg-white border-[#e2d4f0] text-[#1e192b] focus:border-[#ff85b3] placeholder:text-[#94a3b8]'
            : 'bg-[#00f3ff]/5 border-[#00f3ff]/20 text-[#00f3ff] focus:border-[#00f3ff]'"
          @keyup.enter="handleRegisterSubmit"
        />
        <p class="text-sm text-center font-sans leading-relaxed px-4" :class="currentTheme === 'anime' ? 'text-amber-700 font-medium' : 'text-[#ffc107]'">{{ t('register.emailHint') }}</p>
        <input 
          v-model="regPassword" 
          type="password" 
          :placeholder="t('register.passwordPlaceholder')" 
          autocomplete="off" 
          class="w-full rounded font-code text-sm transition-all px-4 py-3 border outline-none" 
          :class="currentTheme === 'anime'
            ? 'bg-white border-[#e2d4f0] text-[#1e192b] focus:border-[#ff85b3] placeholder:text-[#94a3b8]'
            : 'bg-[#00f3ff]/5 border-[#00f3ff]/20 text-[#00f3ff] focus:border-[#00f3ff]'"
          @keyup.enter="handleRegisterSubmit"
        />
        <button 
          @click="handleRegisterSubmit" 
          :disabled="!regUsername || !regEmail || !regPassword || authStore.isProcessing" 
          class="w-full py-3 font-black font-code tracking-widest rounded transition-all disabled:opacity-50 mt-2"
          :class="currentTheme === 'anime'
            ? 'bg-gradient-to-r from-[#ff85b3] via-[#ff9ec7] to-[#6be5ff] text-white shadow-[0_6px_16px_rgba(255,133,179,0.38)] hover:opacity-95'
            : 'bg-[#00f3ff] text-black hover:bg-white'"
        >
          {{ t('register.confirmBtn') }}
        </button>
      </div>

      <p 
        v-if="regError" 
        class="mt-4 text-[13px] font-code text-center py-2 border rounded"
        :class="currentTheme === 'anime' ? 'bg-rose-50 border-rose-200 text-rose-600' : 'bg-[#1a1a1a] border-[#ff4444]/30 text-[#ff4444]'"
      >{{ regError }}</p>
      <button 
        @click="showRegister = false" 
        class="mt-4 w-full text-sm font-code transition-colors"
        :class="currentTheme === 'anime' ? 'text-slate-500 hover:text-[#ff66b2]' : 'text-gray-500 hover:text-white'"
      >
        {{ t('common.cancel') }}
      </button>
    </BaseModal>

    <!-- 主程序更新弹窗 (重构: 复用通用组件，桌面多分辨率自适应大卡片) -->
    <AppUpdateModal
      v-model:visible="showAppUpdateModal"
      :current-version="appUpdateInfo.currentVersion"
      :latest-version="appUpdateInfo.latestVersion"
      @confirm="startAppUpdate"
    />

    <!-- 快捷键设置（暗号彩蛋） -->
    <BaseModal 
      :visible="showKeyboardSettings" 
      @close="showKeyboardSettings = false" 
      :show-close="true" 
      :container-class="currentTheme === 'anime'
        ? 'w-[560px] bg-white/95 border-2 border-[#bce8ff] shadow-[0_20px_60px_rgba(180,150,230,0.25)] p-8'
        : 'w-[560px] bg-[#0e0e14] border border-[#00f3ff]/30 shadow-[0_0_50px_rgba(0,243,255,0.15)] p-8'"
    >
      <div class="flex flex-col gap-6">
        <div class="flex items-center justify-between">
          <h3 class="text-xl font-black tracking-widest font-code" :class="currentTheme === 'anime' ? 'text-[#1e192b]' : 'text-white'">{{ t('settings.kbTitle') }}</h3>
          <div class="flex items-center gap-3 mr-10">
            <span class="text-sm font-code font-bold" :class="currentTheme === 'anime' ? 'text-[#4a425a]' : 'text-gray-300'">{{ t('settings.kbEnable') }}</span>
            <button 
              @click="keyboardEnabled = !keyboardEnabled; keyboardDirty = true" 
              class="w-11 h-6 rounded-full transition-colors relative" 
              :class="keyboardEnabled ? (currentTheme === 'anime' ? 'bg-[#ff66b2]' : 'bg-[#00f3ff]') : 'bg-gray-400'"
            >
              <div class="absolute top-1 w-4 h-4 rounded-full bg-white transition-all shadow-sm" 
                   :class="keyboardEnabled ? 'left-6' : 'left-1'" />
            </button>
          </div>
        </div>

        <div class="grid grid-cols-7 gap-4">
          <div v-for="(item, idx) in navItemsForKeyboard" :key="item.id" class="flex flex-col items-center gap-2">
            <div 
              class="w-12 h-12 rounded-lg flex items-center justify-center text-lg font-code font-bold cursor-pointer select-none transition-all border" 
              :class="[
                bindingIndex === idx 
                  ? (currentTheme === 'anime' ? 'border-[#ff66b2] text-[#ff66b2] shadow-[0_0_15px_rgba(255,102,178,0.35)] animate-pulse bg-pink-50' : 'border-[#00f3ff] text-[#00f3ff] shadow-[0_0_15px_rgba(0,243,255,0.3)] animate-pulse bg-[#0a0a0a]')
                  : (currentTheme === 'anime' ? 'bg-[#f8f5ff] border-[#e2d4f0] text-[#1e192b] hover:border-[#ff9ec7]' : 'bg-[#0a0a0a] border-white/10 text-gray-300 hover:border-white/30'),
                bindingConflict === idx ? 'border-red-500 text-red-500 bg-red-50' : ''
              ]" 
              @click="startBinding(idx)"
            >
              {{ keyboardKeys[idx] }}
            </div>
            <span class="text-sm font-code text-center leading-tight font-bold" :class="currentTheme === 'anime' ? 'text-[#4a425a]' : 'text-gray-300'">{{ item.label }}</span>
          </div>
        </div>

        <div v-if="bindingIndex !== -1" class="text-sm font-code text-center animate-pulse font-bold" :class="currentTheme === 'anime' ? 'text-[#ff66b2]' : 'text-[#00f3ff]'">
          {{ t('settings.kbHint') }}
        </div>
        <div v-if="bindingConflict !== -1" class="text-sm text-red-500 font-code text-center font-bold">
          {{ t('settings.kbConflict') }}
        </div>

        <div class="border-t pt-4" :class="currentTheme === 'anime' ? 'border-[#e2d4f0]' : 'border-white/10'">
          <button @click="keyboardHelpOpen = !keyboardHelpOpen" class="w-full flex items-center justify-between text-sm font-bold transition-colors" :class="currentTheme === 'anime' ? 'text-[#1e192b] hover:text-[#ff66b2]' : 'text-gray-300 hover:text-white'">
            <span>{{ t('settings.kbHelp') }}</span>
            <svg width="12" height="12" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24" class="transition-transform duration-300" :class="keyboardHelpOpen ? 'rotate-180' : ''">
              <path stroke-linecap="round" stroke-linejoin="round" d="M19 9l-7 7-7-7" />
            </svg>
          </button>
          <div v-show="keyboardHelpOpen" class="mt-3 space-y-2 text-sm font-code" :class="currentTheme === 'anime' ? 'text-[#4a425a]' : 'text-gray-300'">
            <div class="flex items-center gap-3 p-2 rounded" :class="currentTheme === 'anime' ? 'bg-pink-50/50 border border-pink-100' : 'bg-white/[0.03]'">
              <span class="px-2 py-1 rounded font-bold text-xs" :class="currentTheme === 'anime' ? 'bg-white border border-[#e2d4f0] text-[#1e192b]' : 'bg-white/10 text-white'">ESC</span>
              <span>{{ t('settings.kbEscDesc') }}</span>
            </div>
            <div class="flex items-center gap-3 p-2 rounded" :class="currentTheme === 'anime' ? 'bg-pink-50/50 border border-pink-100' : 'bg-white/[0.03]'">
              <span class="px-2 py-1 rounded font-bold text-xs" :class="currentTheme === 'anime' ? 'bg-white border border-[#e2d4f0] text-[#1e192b]' : 'bg-white/10 text-white'">Enter</span>
              <span>{{ t('settings.kbEnterDesc') }}</span>
            </div>
            <div class="flex items-center gap-3 p-2 rounded" :class="currentTheme === 'anime' ? 'bg-pink-50/50 border border-pink-100' : 'bg-white/[0.03]'">
              <span class="px-2 py-1 rounded font-bold text-xs" :class="currentTheme === 'anime' ? 'bg-white border border-[#e2d4f0] text-[#1e192b]' : 'bg-white/10 text-white'">Ctrl + F</span>
              <span>{{ t('settings.kbSearchDesc') }}</span>
            </div>
            <div class="flex items-center gap-3 p-2 rounded" :class="currentTheme === 'anime' ? 'bg-pink-50/50 border border-pink-100' : 'bg-white/[0.03]'">
              <span class="px-2 py-1 rounded font-bold text-xs" :class="currentTheme === 'anime' ? 'bg-white border border-[#e2d4f0] text-[#1e192b]' : 'bg-white/10 text-white'">1 ~ 7</span>
              <span>{{ t('settings.kbNavDesc') }}</span>
            </div>
          </div>
        </div>

        <div v-if="keyboardSaveError" class="text-sm text-red-500 font-code text-center font-bold">
          {{ keyboardSaveError }}
        </div>
        <div class="flex items-center gap-4 pt-2">
          <button 
            @click="resetKeyboardDefaults" 
            class="flex-1 py-3 rounded-lg font-bold font-code text-sm tracking-wider transition-all border"
            :class="currentTheme === 'anime'
              ? 'bg-white border-[#e2d4f0] text-[#4a425a] hover:bg-pink-50 hover:text-[#ff66b2] hover:border-[#ff9ec7]'
              : 'bg-white/5 border-white/10 text-gray-300 hover:text-white hover:bg-white/10'"
          >{{ t('settings.kbReset') }}</button>
          <button 
            @click="saveKeyboardSettings" 
            :disabled="!keyboardDirty && !keyboardSaveSuccess" 
            class="flex-1 py-3 font-black font-code text-sm tracking-widest rounded-lg transition-all disabled:opacity-30 disabled:cursor-not-allowed" 
            :class="keyboardSaveSuccess 
              ? 'bg-green-500 text-white' 
              : (currentTheme === 'anime' ? 'bg-gradient-to-r from-[#ff85b3] via-[#ff9ec7] to-[#6be5ff] text-white shadow-[0_6px_16px_rgba(255,133,179,0.38)] hover:opacity-95' : 'bg-[#00f3ff] text-black hover:bg-white')"
          >
            {{ keyboardSaveSuccess ? t('settings.kbSaved') : t('settings.kbSave') }}
          </button>
        </div>
      </div>
    </BaseModal>

    <!-- 诊断弹窗 -->
    <DiagnosticsModal 
      :visible="showDiagnosticsModal" 
      :results="diagnosticResults" 
      :is-repairing="isRepairingDiagnostics" 
      @close="showDiagnosticsModal = false" 
      @repair="handleRepairDiagnostics" 
      @repair-env="handleRepairEnvironment" 
      @migrate-cr="handleMigrateCr" 
    />

    <SponsorModal :visible="showSponsor" @close="showSponsor = false" />

    <DocumentationModal :visible="showDocs" @close="showDocs = false" />

  </div>
</template>

<script setup lang="ts">
import ExpFeaturesModal from './modals/ExpFeaturesModal.vue'
import AppUpdateModal from './modals/AppUpdateModal.vue'
import ModeSwitchModal from './modals/ModeSwitchModal.vue'
import { useSteamLauncher } from '../composables/useSteamLauncher'
import { ref, computed, watch, onMounted, onUnmounted } from 'vue'

const {
  isSteamLaunching,
  launchSteamWithGuard
} = useSteamLauncher()
import { t, setLang, currentLang } from '../i18n'
import { useAuthStore } from '../stores/authStore'
import { useLibraryStore } from '../stores/libraryStore'
import BaseModal from './common/BaseModal.vue'
import DocumentationModal from './DocumentationModal.vue'
import SponsorModal from './SponsorModal.vue'
import DiagnosticsModal from './DiagnosticsModal.vue'
import AccountMatrixModal from './AccountMatrixModal.vue'
import Swal from 'sweetalert2'
import { tcToast } from '../utils/tcToast'
import { useTheme } from '../composables/useTheme'

const { currentTheme, setTheme } = useTheme()

const handleSwitchTheme = (theme: 'titan' | 'anime' | 'minimal') => {
  setTheme(theme)
  const tip = theme === 'anime' 
    ? t('theme.switchedSakura') 
    : theme === 'minimal'
      ? t('theme.switchedFuture') 
      : t('theme.switchedClassic')
  tcToast(tip, undefined, 'info')
}

// 主题切换下拉器支持（三主题命名：经典 - sakura - 未来，全语言响应式）
const showThemeDropdown = ref(false)
const themeDropdownRef = ref<HTMLElement | null>(null)
const availableThemes = computed(() => [
  { id: 'titan' as const, label: t('theme.classic') },
  { id: 'anime' as const, label: t('theme.sakura') },
  { id: 'minimal' as const, label: t('theme.future') }
])

const currentThemeLabel = computed(() => {
  const hit = availableThemes.value.find(item => item.id === currentTheme.value)
  return hit ? hit.label : t('theme.classic')
})

const handleSelectTheme = (themeId: 'titan' | 'anime' | 'minimal') => {
  handleSwitchTheme(themeId)
  showThemeDropdown.value = false
}

const authStore = useAuthStore()
const libraryStore = useLibraryStore()

const tx = (msg?: string) => (msg ? t(msg) : '')

const currentAppVersion = ref('')

// 多国语言支持：支持扩展至 6+ 门语言
const showLangDropdown = ref(false)
const langDropdownRef = ref<HTMLElement | null>(null)
const availableLangs = [
  { code: 'zh-CN', label: '简体中文' },
  { code: 'zh-TW', label: '繁體中文' },
  { code: 'en-US', label: 'English' }
]

const currentLangLabel = computed(() => {
  const hit = availableLangs.find(l => l.code === currentLang.value)
  return hit ? hit.label : '简体中文'
})

const handleSelectLang = (code: string) => {
  setLang(code)
  showLangDropdown.value = false
}

const handleDocumentClick = (e: MouseEvent) => {
  if (langDropdownRef.value && !langDropdownRef.value.contains(e.target as Node)) {
    showLangDropdown.value = false
  }
  if (themeDropdownRef.value && !themeDropdownRef.value.contains(e.target as Node)) {
    showThemeDropdown.value = false
  }
}

const NODE_STYLES: Record<string, string> = {
  node1: 'bg-[#00f3ff] text-black border border-[#00f3ff] shadow-[0_0_15px_rgba(0,243,255,0.4)]',
  node2: 'bg-[#00f3ff] text-black border border-[#00f3ff] shadow-[0_0_15px_rgba(0,243,255,0.4)]',
  node3: 'bg-[#00f3ff] text-black border border-[#00f3ff] shadow-[0_0_15px_rgba(0,243,255,0.4)]',
}
const inputKey = ref('')

const selectNode = (id: string) => !authStore.isProcessing && authStore.selectedNode !== id && authStore.connect(id)
const handleConnect = async () => {
  const res: any = await authStore.connect(authStore.selectedNode, inputKey.value.trim() || undefined)
  if (res && res.success === false && res.error === 'ERR_INVALID_NODE_KEY') {
    showNotice(t('settings.connection.invalidKey'), '', 'error')
  } else if (res && res.success) {
    inputKey.value = ''
  }
}
const handleDisconnect = () => authStore.disconnect()

const email = ref('')
const password = ref('')
const statusMsg = ref('')
const redeemCode = ref('')
const redeemContact = ref('')

const handleLogin = async () => {
  if (!email.value || !password.value) return (statusMsg.value = t('settings.identity.inputRequired'))
  statusMsg.value = ''
  const err = await authStore.login(email.value, password.value)
  err ? (statusMsg.value = tx(err)) : (email.value = password.value = '')
}

const handleLogout = () => { 
  authStore.logout()
  email.value = ''
  password.value = ''
  statusMsg.value = '' 
}

const handleRedeem = async () => {
  if (authStore.isProcessing) return
  const code = redeemCode.value.trim()
  if (!code) {
    showNotice(t('errors.emptyCodeTitle'), t('errors.emptyCodeDesc'), 'error')
    return
  }
  const res = await authStore.redeem(code, redeemContact.value.trim())
  if (res.success) {
    showNotice(t('redeem.successTitle'), `${t('settings.identity.expire')}: ${res.data?.expireDate || ''}`, 'success')
    redeemCode.value = ''
    redeemContact.value = ''
  } else {
    showNotice(t('redeem.failTitle'), tx(res.msg) || t('redeem.failDefault'), 'error')
  }
}

const handleOpenShop = () => {
  showSponsor.value = true
}

const steamPath = ref('')
const steamSource = ref('none')
const isDetectingSteam = ref(false)

// 控制台与云存档核心状态
const showAccountMatrixModal = ref(false)
const cloudSaveEnabled = ref(true)
const isTogglingCloud = ref(false)

// OST 模式与启动
const ostMode = ref<'pure' | 'classic'>('classic')
const isSwitchingOstMode = ref(false)
const isLaunchingSteam = ref(false)
const targetModeToSwitch = ref<'pure' | 'classic'>('pure')
const showModeSwitchModal = ref(false)

const loadOstMode = async () => {
  try {
    const m = await window.electron.ost.getMode()
    ostMode.value = m === 'pure' ? 'pure' : 'classic'
  } catch (e) {
    console.warn('[Settings] 获取 OST 模式失败:', e)
  }
}

const handleLaunchSteam = async () => {
  if (isLaunchingSteam.value || isSteamLaunching.value) return
  isLaunchingSteam.value = true
  try {
    await launchSteamWithGuard()
  } catch (e: any) {
    console.error('[Settings] launchSteam error:', e)
  } finally {
    isLaunchingSteam.value = false
  }
}

const onSwitchModeClick = (target: 'pure' | 'classic') => {
  targetModeToSwitch.value = target
  showModeSwitchModal.value = true
}

const confirmSwitchMode = async () => {
  const target = targetModeToSwitch.value
  showModeSwitchModal.value = false
  await handleSwitchOstMode(target)
}

const handleSwitchOstMode = async (target: 'pure' | 'classic') => {
  if (isSwitchingOstMode.value) return
  isSwitchingOstMode.value = true
  try {
    const res = await window.electron.ost.switchMode(target)
    if (res?.success) {
      ostMode.value = res.mode
      showNotice(t('settings.ostModeSwitchDoneTitle'), target === 'pure' ? t('settings.ostModeSwitchDonePure') : t('settings.ostModeSwitchDoneClassic'), 'success')
      await handleLaunchSteam()
    } else {
      showNotice(t('settings.ostModeSwitchFailTitle'), tx(res?.error) || t('settings.ostModeUnknown'), 'error')
    }
  } catch (e: any) {
    showNotice(t('settings.ostModeSwitchFailTitle'), tx(e?.message) || t('settings.ostModeUnknown'), 'error')
  } finally {
    isSwitchingOstMode.value = false
  }
}

const gateActiveCount = ref(0)
const isEngineReady = ref(false)

const showNotice = (title: string, text: string = '', type: 'success' | 'error' | 'warning' | 'info' = 'success') => {
  tcToast(title, text, type)
}

const handleDetectSteam = async () => {
  isDetectingSteam.value = true
  try {
    const res = await window.electron.invoke('steam:detect')
    steamPath.value = res.path || ''
    steamSource.value = res.source || 'none'
  } catch (e) {
    console.error('[Settings] Steam Detect Interrupted', e)
  } finally {
    isDetectingSteam.value = false
  }
}

const handleSelectSteamPath = async () => {
  if (isDetectingSteam.value) return
  isDetectingSteam.value = true
  try {
    const res = await window.electron.invoke('steam:select-folder')
    if (res.canceled) return
    if (res.success) {
      steamPath.value = res.path
      steamSource.value = res.source
      await loadGateStatus()
  loadFamilyLibraryMode()
    } else {
      showNotice(t('errors.validateFailTitle'), tx(res.msg) || t('errors.steamNotFoundExe'), 'error')
    }
  } catch (e) {
    console.error('[Settings] Steam Folder Select Error', e)
  } finally {
    isDetectingSteam.value = false
  }
}

const loadGateStatus = async () => {
  try {
    const res = await window.electron.invoke('engine:get-gate-status')
    if (res?.success && res.data) {
      isEngineReady.value = !!res.data.engineReady
      cloudSaveEnabled.value = res.data.cloudEnabled !== false
      gateActiveCount.value = res.data.gateEnabled ? (res.data.gateIds?.length || 0) : 0
    }
  } catch (e) {
    console.warn('[Settings] 获取账号闸状态失败:', e)
  }
}


const familyLibraryModeEnabled = ref(false)
const isTogglingFamilyMode = ref(false)

const loadFamilyLibraryMode = async () => {
  try {
    const res = await window.electron.ost.getFamilyLibraryMode()
    familyLibraryModeEnabled.value = !!res
  } catch (e) {
    console.warn('[Settings] 获取家庭库模式失败:', e)
  }
}

const handleToggleFamilyLibraryMode = async () => {
  if (isTogglingFamilyMode.value) return
  isTogglingFamilyMode.value = true
  try {
    const target = !familyLibraryModeEnabled.value
    const ok = await window.electron.ost.setFamilyLibraryMode(target)
    if (ok) {
      familyLibraryModeEnabled.value = target
      showNotice(
        '归属模式已切换',
        target 
          ? '已开启【家庭库模式】：显示为来自 Steam 家庭库（避险伪装/分类收拢）' 
          : '已开启【专属游戏模式】：已消除家庭库标签，与本人专属游戏完全一致',
        'success'
      )
    } else {
      showNotice('设置失败', '无法写入 opensteamtool.toml 配置，请检查文件权限', 'error')
    }
  } finally {
    isTogglingFamilyMode.value = false
  }
}

const handleToggleCloudSave = async () => {
  if (isTogglingCloud.value) return
  if (!isEngineReady.value) {
    showNotice(t('settings.noticeLimitedTitle'), t('settings.noticeLimitedDesc'), 'error')
    return
  }
  isTogglingCloud.value = true
  try {
    const target = !cloudSaveEnabled.value
    const res = await window.electron.invoke('engine:toggle-cloud-save', target)
    if (res?.success) {
      cloudSaveEnabled.value = target
    } else {
      showNotice(t('settings.noticeSetFailTitle'), t('settings.noticeSetFailDesc'), 'error')
    }
  } finally {
    isTogglingCloud.value = false
  }
}

const handleOpenAccountModal = () => {
  if (!isEngineReady.value) {
    showNotice(t('settings.noticeConsoleTitle'), t('settings.noticeConsoleDesc'), 'error')
    return
  }
  showAccountMatrixModal.value = true
}

const handleGateSaved = (count: number) => {
  gateActiveCount.value = count
  showNotice(
    t('settings.gateSavedTitle'),
    count > 0 
      ? t('settings.gateSavedOn', { count }) 
      : t('settings.gateSavedOff'),
    'success'
  )
}

const showRegister = ref(false)
const regUsername = ref('')
const regEmail = ref('')
const regPassword = ref('')
const regError = ref('')

const resetRegisterState = () => {
  regUsername.value = ''
  regEmail.value = ''
  regPassword.value = ''
  regError.value = ''
}

const handleOpenRegister = () => {
  if (authStore.isProcessing) return
  showRegister.value = true
}

const handleRegisterSubmit = async () => {
  if (!regUsername.value.trim() || !regEmail.value.trim() || !regPassword.value.trim()) {
    regError.value = t('errors.registerRequiredFields')
    return
  }
  regError.value = ''
  const err = await authStore.register(regUsername.value.trim(), regEmail.value.trim(), regPassword.value.trim())
  if (err) {
    regError.value = tx(err)
  } else {
    showRegister.value = false
    resetRegisterState()
  }
}

const showForgot = ref(false)
const forgotStep = ref(1)
const forgotUsername = ref('')
const forgotEmail = ref('')
const forgotUid = ref(0)
const forgotPass = ref('')

const resetForgotState = () => { 
  forgotStep.value = 1
  forgotUsername.value = ''
  forgotEmail.value = ''
  forgotPass.value = ''
  forgotUid.value = 0 
}

const openForgot = () => { 
  showForgot.value = true
  statusMsg.value = '' 
}

const closeForgotAndLogin = () => { 
  showForgot.value = false
  statusMsg.value = ''
  resetForgotState() 
}

const handleForgotCheck = async () => {
  if (!forgotUsername.value.trim() || !forgotEmail.value.trim()) return (statusMsg.value = t('errors.forgotInputRequired'))
  statusMsg.value = ''
  const res = await authStore.forgotSearch(forgotUsername.value.trim(), forgotEmail.value.trim())
  res.ok && res.id ? (forgotUid.value = res.id, forgotStep.value = 2, statusMsg.value = '') : (statusMsg.value = tx(res.msg) || t('errors.verifyFail'))
}

const handleForgotReset = async () => {
  if (forgotPass.value?.length < 6) return (statusMsg.value = t('errors.passwordMinLength'))
  statusMsg.value = ''
  const res = await authStore.forgotReset(forgotUid.value, forgotPass.value, forgotEmail.value)
  res.ok ? (forgotStep.value = 3, statusMsg.value = '') : (statusMsg.value = tx(res.msg) || t('errors.forgotResetFail'))
}

const showDocs = ref(false)
const showSponsor = ref(false)

const showAppUpdateModal = ref(false)
const appUpdateInfo = ref({ latestVersion: '', currentVersion: '' })

const handleCheckAppUpdate = async () => {
  if (authStore.isProcessing) return
  authStore.isProcessing = true
  try {
    const res = await window.electron.sys.checkUpdate()
    if (!res.hasUpdate) {
      showNotice(t('settings.version.latest'), t('settings.version.noUpdate'), 'success')
      return
    }
    appUpdateInfo.value = { 
      latestVersion: res.latestVersion, 
      currentVersion: res.currentVersion 
    }
    showAppUpdateModal.value = true
  } finally {
    authStore.isProcessing = false
  }
}

const startAppUpdate = async () => {
  try {
    const res = await window.electron.sys.startUpdate()
    if (res.success) {
      showNotice(t('settings.update.toastStarted'), t('settings.update.toastStartedDesc'), 'success')
      showAppUpdateModal.value = false
    } else {
      showNotice(t('settings.update.toastStartFail'), tx(res.msg), 'error')
      showAppUpdateModal.value = false
    }
  } catch (e: any) {
    showNotice(t('settings.update.toastSystemError'), e.message, 'error')
    showAppUpdateModal.value = false
  }
}

// 诊断相关
const diagnosticResults = ref<{ name: string; ok: boolean; message: string }[]>([])
const isRunningDiagnostics = ref(false)
const showDiagnosticsModal = ref(false)
const isRepairingDiagnostics = ref(false)

const handleRepairDiagnostics = async () => {
  isRepairingDiagnostics.value = true
  try {
    const repairRes = await window.electron.invoke('sys:validate-patterns')
    await runSystemDiagnostics()
    if (repairRes?.error) {
      showNotice(t('settings.repairFetchFailedTitle'), t('settings.repairFetchFailedDesc'), 'error')
    } else if (Array.isArray(repairRes?.missing) && repairRes.missing.length > 0) {
      showNotice(t('settings.repairWaitTitle'), t('settings.repairWaitDesc'), 'info')
    } else if (repairRes?.pulled > 0) {
      showNotice(t('settings.repairDoneTitle'), t('settings.repairDoneDesc', { count: repairRes.pulled }), 'success')
    }
  } catch (e: any) {
    showNotice(t('settings.repairFailedTitle'), e.message || t('app.unknownError'), 'error')
  } finally {
    isRepairingDiagnostics.value = false
  }
}

const handleRepairEnvironment = async () => {
  isRepairingDiagnostics.value = true
  try {
    const res = await window.electron.invoke('sys:repair-environment')
    await runSystemDiagnostics()
    if (res?.success) {
      showNotice(t('settings.repairEnvDoneTitle'), t('settings.repairEnvDoneDesc'), 'success')
    } else {
      showNotice(t('settings.repairEnvFailTitle'), tx(res?.error) || t('settings.repairEnvFailDesc'), 'error')
    }
  } catch (e: any) {
    showNotice(t('settings.repairEnvFailTitle'), e?.message || t('settings.repairEnvFailDesc'), 'error')
  } finally {
    isRepairingDiagnostics.value = false
  }
}

const handleMigrateCr = async () => {
  isRepairingDiagnostics.value = true
  try {
    const res = await window.electron.cloudsave.migrateCrStorage()
    await runSystemDiagnostics()
    if (res?.success) {
      showNotice(t('settings.crMigrateDoneTitle'), t('settings.crMigrateDoneDesc'), 'success')
    } else {
      showNotice(t('settings.crMigrateFailTitle'), tx(res?.error) || t('settings.ostModeUnknown'), 'error')
    }
  } catch (e: any) {
    showNotice(t('settings.crMigrateFailTitle'), tx(e?.message) || t('settings.ostModeUnknown'), 'error')
  } finally {
    isRepairingDiagnostics.value = false
  }
}

const runSystemDiagnostics = async () => {
  isRunningDiagnostics.value = true
  try {
    const res = await window.electron.invoke('titan:run-diagnostics')
    if (res.success) {
      diagnosticResults.value = res.data || []
      showDiagnosticsModal.value = true
    } else {
      showNotice(t('settings.manifest.diagFail'), tx(res.msg), 'error')
    }
  } catch (e: any) {
    showNotice(t('settings.manifest.diagFail'), e?.message || t('settings.diagErrMsg'), 'error')
  } finally {
    isRunningDiagnostics.value = false
  }
}

const isRestoring = ref(false)

const handleEmergencyRestore = async () => {
  if (isRestoring.value) return
  const confirm = await Swal.fire({
    title: t('settings.maintain.restoreConfirmTitle'),
    text: t('settings.maintain.restoreConfirmDesc'),
    icon: 'warning',
    showCancelButton: true,
    confirmButtonText: t('settings.maintain.restoreConfirmBtn'),
    cancelButtonText: t('common.cancel'),
    background: '#121212',
    color: '#fff',
    confirmButtonColor: '#ef4444'
  })
  if (!confirm.isConfirmed) return

  isRestoring.value = true
  try {
    const detectRes = await window.electron.invoke('steam:detect')
    if (!detectRes?.path) {
      showNotice(t('errors.validateFailTitle'), t('errors.steamNotFoundExe'), 'error')
      return
    }
    const res = await window.electron.invoke('titan:force-restore', detectRes.path)
    if (res?.success) {
      showNotice(
        t('settings.maintain.restoreSuccessTitle'),
        t('settings.maintain.restoreSuccessDesc'),
        'success'
      )
      await loadGateStatus()
    } else {
      showNotice(t('settings.maintain.restoreFailTitle'), tx(res?.msg) || t('settings.maintain.restoreFailDefault'), 'error')
    }
  } catch (e: any) {
    showNotice(t('settings.maintain.restoreFailTitle'), tx(e?.message) || t('settings.maintain.restoreFailDefault'), 'error')
  } finally {
    isRestoring.value = false
  }
}

const isImportingLua = ref(false)
// TITAN-EXP: 实验功能弹窗 + 导入清单显隐门（默认关，Db 扁平键持久化）
const showExpModal = ref(false)
const prefEnableLuaImport = ref(false)
async function loadLuaImportPref() {
  try { prefEnableLuaImport.value = !!(await window.electron.invoke('sys:get-config', 'pref_enable_lua_import')) } catch { /* 读取失败按默认关 */ }
}
loadLuaImportPref()
// 弹窗内可能改动 luaImport 开关：关窗回读一次，保证导入按钮显隐即时新鲜
watch(showExpModal, (v) => { if (!v) loadLuaImportPref() })


const handleImportLua = async () => {
  if (isImportingLua.value) return
  isImportingLua.value = true
  try {
    const res = await window.electron.invoke('sys:import-lua-folder')
    if (res.success) {
      showNotice(
        t('settings.importLuaTitle'),
        t('settings.importLuaResult', { imported: res.imported, skipped: res.skipped, failedPart: res.failed > 0 ? t('settings.importLuaFailedPart', { count: res.failed }) : '' }),
        'success'
      )
      libraryStore.load()
    } else {
      showNotice(t('settings.importLuaFailTitle'), tx(res.msg) || t('app.unknownError'), 'error')
    }
  } catch (e: any) {
    showNotice(t('settings.importLuaFailTitle'), e.message || t('settings.sysError'), 'error')
  } finally {
    isImportingLua.value = false
  }
}

// 键盘快捷键设置
const showKeyboardSettings = ref(false)
const keyboardEnabled = ref(true)
const keyboardKeys = ref(['1','2','3','4','5','6','7'])
const keyboardDirty = ref(false)
const bindingIndex = ref(-1)
const bindingConflict = ref(-1)
const keyboardSaveSuccess = ref(false)
const keyboardSaveError = ref('')
let saveSuccessTimer: ReturnType<typeof setTimeout> | null = null
const keyboardHelpOpen = ref(false)

const navItemsForKeyboard = [
  { id: 'discovery', label: t('nav.discovery') },
  { id: 'library', label: t('nav.library') },
  { id: 'transmissions', label: t('nav.transmissions') },
  { id: 'hajimi_beat', label: t('nav.hajimi_beat') },
  { id: 'nexus_gate', label: t('nav.nexus_gate') },
  { id: 'uplink', label: t('nav.uplink') },
  { id: 'settings', label: t('nav.settings') }
]

const loadKeyboardSettings = async () => {
  try {
    const raw = await window.electron.invoke('sys:get-config', 'keyboard_settings')
    if (raw && typeof raw === 'object') {
      keyboardEnabled.value = raw.enabled !== false
      if (Array.isArray(raw.keys) && raw.keys.length === 7) keyboardKeys.value = raw.keys
    }
  } catch {}
}

const startBinding = (idx: number) => {
  bindingIndex.value = idx
  bindingConflict.value = -1
}

const handleBindingKeydown = (e: KeyboardEvent) => {
  if (e.key === 'Escape' && bindingIndex.value === -1) {
    showKeyboardSettings.value = false
    e.preventDefault()
    return
  }
  if (bindingIndex.value === -1) return
  if (e.ctrlKey || e.altKey || e.metaKey || e.shiftKey) return
  if (e.key === 'Escape') {
    bindingIndex.value = -1
    bindingConflict.value = -1
    return
  }
  if (e.key.length !== 1 && !e.key.startsWith('F')) return

  const pressed = e.key.toLowerCase()
  const conflictIdx = keyboardKeys.value.findIndex((k, i) => i !== bindingIndex.value && k.toLowerCase() === pressed)
  if (conflictIdx !== -1) {
    bindingConflict.value = bindingIndex.value
    return
  }

  keyboardKeys.value[bindingIndex.value] = e.key.toUpperCase()
  bindingIndex.value = -1
  bindingConflict.value = -1
  keyboardDirty.value = true
  e.preventDefault()
}

const resetKeyboardDefaults = () => {
  keyboardKeys.value = ['1','2','3','4','5','6','7']
  keyboardEnabled.value = true
  keyboardDirty.value = true
  bindingIndex.value = -1
  bindingConflict.value = -1
}

const saveKeyboardSettings = async () => {
  if (saveSuccessTimer) clearTimeout(saveSuccessTimer)
  keyboardSaveError.value = ''
  try {
    await window.electron.invoke('sys:set-config', 'keyboard_settings', {
      enabled: keyboardEnabled.value,
      keys: JSON.parse(JSON.stringify(keyboardKeys.value))
    })
    keyboardDirty.value = false
    keyboardSaveSuccess.value = true
    window.dispatchEvent(new CustomEvent('titan-keyboard-updated'))
    saveSuccessTimer = setTimeout(() => { keyboardSaveSuccess.value = false }, 2000)
  } catch (e: any) {
    keyboardSaveError.value = e.message || t('settings.kbSaveFailed')
  }
}

const handleOpenDiagnostics = () => {
  runSystemDiagnostics()
}

onMounted(async () => {
  document.addEventListener('click', handleDocumentClick)
  window.addEventListener('titan:open-diagnostics', handleOpenDiagnostics)
  currentAppVersion.value = await window.electron.sys.getVersion()

  const savedPath = await window.electron.invoke('sys:get-config', 'steam_install_path')
  const savedSource = await window.electron.invoke('sys:get-config', 'steam_detect_source')
  if (savedPath) {
    steamPath.value = savedPath
    steamSource.value = savedSource || 'manual'
  }

  await loadOstMode()
  await loadKeyboardSettings()
  await loadGateStatus()

  if (!steamPath.value && !isDetectingSteam.value) {
    handleDetectSteam()
  }
})

onUnmounted(() => {
  document.removeEventListener('click', handleDocumentClick)
  window.removeEventListener('titan:open-diagnostics', handleOpenDiagnostics)
  // fix43(C3): backstop - the keydown binding listener lives in a watch that never
  // fires when the v-if view is unmounted while the panel is still open.
  document.removeEventListener('keydown', handleBindingKeydown)
})

watch(() => authStore.connectionError, (err) => {
  if (!err || authStore.isConnected) return
  const errMsg = err && err.startsWith('ERR_') ? t(err) : err
  showNotice(t('errors.connectionFailTitle'), `${errMsg}\n${t('errors.connectionFailSolution')}`, 'error')
  authStore.connectionError = null
})

watch(showKeyboardSettings, (val) => {
  if (val) {
    document.addEventListener('keydown', handleBindingKeydown)
  } else {
    document.removeEventListener('keydown', handleBindingKeydown)
    bindingIndex.value = -1
    bindingConflict.value = -1
  }
})
</script>