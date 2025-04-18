// prettier-ignore
<template>
  <VaCard>
    <VaCardTitle class="flex justify-between">
      <h1 class="card-title text-secondary font-bold uppercase">{{ t('timeline.timeline') }}</h1>
      <h2>{{ t('timeline.last') }}</h2>
    </VaCardTitle>
    <VaCardContent>
      <table class="mt-4 va-table va-table--hoverable va-table--striped">
        <tbody>
          <VaTimelineItem v-for="(item, key) in items" :key="key" color="danger" active :date="item.fromnow">
            <template v-if="item.channel === 'new_account'">
              <RouterLink class="va-link link font-semibold" :to="{ name: 'profile' }"> {{ item.message }}</RouterLink>
              at {{ item.processed }}
            </template>
            <template v-else-if="item.channel === 'new_vessel'">
              <RouterLink class="va-link link font-semibold" :to="{ name: 'boats' }">
                {{ item.message }}
              </RouterLink>
              at {{ item.processed }}
            </template>
            <template v-else-if="item.channel === 'grafana'">
              <a :href="grafana_url" target="_blank"
                ><span class="va-link link font-semibold"> {{ item.message }} </span></a
              >
              at {{ item.processed }}
            </template>
            <template v-else-if="item.channel === 'new_logbook'">
              <RouterLink class="va-link link font-semibold" :to="{ name: 'log-map', params: { id: item.payload } }">{{
                item.message
              }}</RouterLink>
              at {{ item.processed }}
            </template>
            <template v-else-if="item.channel === 'new_moorage'">
              <RouterLink
                class="va-link link font-semibold"
                :to="{ name: 'moorage-details', params: { id: item.payload } }"
                >{{ item.message }}</RouterLink
              >
              at {{ item.processed }}
            </template>
            <template v-else-if="item.channel === 'maplapse_video'">
              <a :href="'/maplapse' + item.replay" target="_blank">
                <span class="va-link link font-semibold">{{ item.message }}</span>
                at {{ item.processed }}
              </a>
            </template>
            <template v-else-if="item.channel === 'new_video'">
              <a :href="'https://videos.openplotter.cloud/' + item.payload" target="_blank">
                <span class="va-link link font-semibold">{{ item.message }}</span>
                at {{ item.processed }}
              </a>
            </template>
            <template v-else-if="item.channel === 'monitoring_offline' || item.channel === 'monitoring_online'">
              <RouterLink class="va-link link font-semibold" to="/monitoring">{{ item.message }}</RouterLink>
              at {{ item.processed }}
            </template>
            <template v-else>
              <span class="font-semibold">{{ item.message }}</span>
              at {{ item.processed }}
            </template>
          </VaTimelineItem>
        </tbody>
      </table>
    </VaCardContent>
  </VaCard>
</template>

<script setup>
  import { computed, ref, onMounted } from 'vue'
  import { useI18n } from 'vue-i18n'
  import PostgSail from '../../services/api-client'
  import { dateFormatUTC } from '../../utils/dateFormatter.js'
  import moment from 'moment'
  import VaTimelineItem from '../../components/VaTimelineItem.vue'
  const { t } = useI18n()

  const isBusy = ref(false)
  const apiError = ref(null)
  const rowsData = ref([])
  const messages = computed(() => {
    return {
      new_account: t('timeline.new_account'),
      email_otp: t('timeline.email_otp'),
      new_vessel: t('timeline.new_vessel'),
      grafana: t('timeline.grafana'),
      monitoring_offline: t('timeline.monitoring_offline'),
      monitoring_online: t('timeline.monitoring_online'),
      new_logbook: t('timeline.new_logbook'),
      new_moorage: t('timeline.new_moorage'),
      maplapse_video: t('timeline.maplapse_video'),
      new_video: t('timeline.new_video'),
    }
  })
  const grafana_url = ref(import.meta.env.VITE_GRAFANA_URL)

  const items = computed(() => {
    return Array.isArray(rowsData.value)
      ? rowsData.value.map((row) => ({
          id: row['id'],
          processed: dateFormatUTC(row['processed']),
          payload: row['payload'],
          channel: row['channel'],
          fromnow: row['processed'] ? moment(row['processed']).fromNow(true) : 'Pending',
          message: row['channel'] ? messages.value[row['channel']] : 'unknown',
          replay: row['channel'] === 'maplapse_video' ? row['payload'].substring(row['payload'].indexOf('?')) : null,
        }))
      : []
  })

  onMounted(async () => {
    isBusy.value = true
    apiError.value = null
    const api = new PostgSail()
    try {
      const response = await api.eventlogs()
      //console.log('Event Logs', response)
      if (Array.isArray(response)) {
        rowsData.value.splice(0, rowsData.value.length || [])
        rowsData.value.push(...response)
        //console.log('Event Logs', rowsData.value)
      } else {
        throw { response }
      }
    } catch (e) {
      apiError.value = e
    } finally {
      isBusy.value = false
    }
  })
</script>
