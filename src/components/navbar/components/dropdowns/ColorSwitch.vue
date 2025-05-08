<template>
  <div style="display: flex; align-items: center">
    <va-switch
      v-model="theme"
      color="#5123a1"
      off-color="#ffd300"
      style="--va-switch-checker-background-color: #252723"
      true-value="dark"
      false-value="light"
    >
      <template #innerLabel>
        <div class="va-text-center">
          <va-icon size="24px" :name="isLightIconTheme ? 'light_mode' : 'dark_mode'" />
        </div>
      </template>
    </va-switch>
  </div>
</template>

<script setup lang="ts">
  import { useColors } from 'vuestic-ui'
  import { ref, watch, computed, onMounted, onBeforeUnmount } from 'vue'
  import { storeToRefs } from 'pinia'
  import { useGlobalStore } from '../../../../stores/global-store'

  const GlobalStore = useGlobalStore()
  const { applyPreset, currentPresetName } = useColors()
  const { currentTheme } = storeToRefs(GlobalStore)
  const isLightIconTheme = ref(true)

  const theme = computed({
    get() {
      return currentPresetName.value
    },
    set(newVal) {
      updateTheme(newVal)
    },
  })

  watch(currentPresetName, (newVal) => {
    console.log('currentPresetName changed', newVal)
    updateTheme(newVal)
  })

  function updateTheme(newVal: string) {
    //console.log('updateTheme', newVal)
    /* Update iconTheme based on the current preset */
    isLightIconTheme.value = newVal !== 'dark'
    /* Update global store on the current preset */
    currentTheme.value = newVal !== 'dark' ? 'light' : 'dark'
    /* Update Vuestic Theme based on the current preset */
    applyPreset(currentTheme.value)
    const isDark = newVal === 'dark'
    //console.log('isDark', isDark)
    syncTailwindDarkClass(isDark)
    syncSidepanelDarkClass(isDark)
  }

  // Syncs the Vuestic theme with Tailwind dark mode class
  function syncTailwindDarkClass(isDark: boolean) {
    console.log('syncTailwindDarkClass', isDark)
    const html = document.documentElement
    if (!html) return
    html.classList.toggle('dark', isDark)
  }

  // Syncs the Leaflet.sidepanel dark mode class
  function syncSidepanelDarkClass(isDark: boolean) {
    console.log('syncSidepanelDarkClass', isDark)
    const panelEl = document.getElementById('sidepanel')
    if (!panelEl) return
    panelEl.classList.toggle('sidepanel-dark', isDark)
  }

  // Syncs the system preferences with dark mode class
  function updateThemeBasedOnSystem(e: MediaQueryListEvent) {
    if (e.matches) {
      // System switched to dark
      updateTheme('dark')
    } else {
      // System switched to light
      updateTheme('light')
    }
  }

  const darkModePreference = window.matchMedia('(prefers-color-scheme: dark)')
  darkModePreference.addEventListener('change', updateThemeBasedOnSystem)

  onMounted(() => {
    //console.debug('applying theme...')
    // Initial theme sync with system preference
    updateTheme(darkModePreference.matches ? 'dark' : 'light')
  })

  onBeforeUnmount(() => {
    darkModePreference.removeEventListener('change', updateThemeBasedOnSystem)
  })
</script>
