<template>
  <div>
    <template v-if="!gotVessel || gotLogs == 0">
      <nodatayet />
    </template>
    <template v-else>
      Grafana opened in a new window.
      <p>
        You will need to create an account on https://auth.openplotter.cloud prior to access Grafana and other services.
      </p></template
    >
  </div>
</template>
<script setup>
  import { ref, onMounted } from 'vue'
  import nodatayet from '../../components/noDataScreen.vue'

  import useGlobalStore from '../../stores/global-store'

  const GlobalStore = useGlobalStore()
  const gotVessel = ref(GlobalStore.hasVessel || false)
  const gotLogs = ref(GlobalStore.hasLogs || 0)

  onMounted(() => {
    console.log('Grafana onMounted', GlobalStore.hasLogs, gotLogs.value)
    /* redirect to grafana if we have a vessel and logs */
    if (GlobalStore.hasVessel && GlobalStore.hasLogs > 0 && import.meta.env.VITE_GRAFANA_URL) {
      window.open(import.meta.env.VITE_GRAFANA_URL, '_blank')
    }
  })
</script>
