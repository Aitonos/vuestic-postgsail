<template>
  <va-card>
    <va-card-title>{{ title }}</va-card-title>
    <va-card-content>
      <div class="flex flex-col lg:flex-row gap-4 mb-2 justify-between">
        <div class="flex flex-col lg:flex-row gap-2 justify-start">
          <va-button-toggle
            v-model="doShowAsCards"
            preset="secondary"
            border-color="primary"
            size="large"
            :options="[
              { label: 'Cards', value: 1 },
              { label: 'Table', value: 2 },
              //{ label: 'Map', value: 3 },
              //{ label: 'Mapgl', value: 4 },
              //{ label: 'MapLibre-gl', value: 5 },
            ]"
          />
        </div>
        <div v-if="doShowAsCards < 3" class="layout flex flex-col lg:flex-row gap-4 justify-between">
          <va-input v-model="filter.name" :clearable="true" :placeholder="$t('logs.list.filter.name')" />
          <va-date-input
            v-model="filter.dateRange"
            style="width: 100%"
            :clearable="true"
            :placeholder="$t('logs.list.filter.date_range')"
            mode="range"
          />
          <va-select
            v-model="filter.tags"
            :placeholder="$t('logs.list.filter.tags')"
            :options="tagsOptions"
            style="height: 100%"
            multiple
            text-by="text"
          >
            <template #content="{ value }">
              <va-chip
                v-for="chip in value"
                :key="chip.text"
                size="small"
                class="xs-chip mr-2"
                outline
                closeable
                @update:modelValue="deleteChip(chip)"
              >
                {{ chip }}
              </va-chip>
            </template>
          </va-select>
        </div>
        <div v-if="doShowAsCards == 3" class="layout flex">
          <p class="text-center">Showing only last 10 logs.</p>
        </div>
        <div v-if="doShowAsCards >= 4" class="layout flex">
          <p class="text-center">Explore your logbooks and moorages</p>
        </div>
      </div>

      <logbook-cards
        v-if="doShowAsCards === 1"
        :logbook="items"
        :loading="isBusy"
        @edit="editTrip"
        @delete="onTripDeleted"
        @replay="replayTrip"
        @replay3d="replayTrip3D"
        @merge="mergeTrip"
      />
      <logbook-table
        v-if="doShowAsCards === 2"
        v-model:sort-by="sorting.sortBy"
        v-model:sorting-order="sorting.sortingOrder"
        v-model:pagination="pagination"
        :logbook="items"
        :loading="isBusy"
        @edit="editTrip"
        @delete="onTripDeleted"
        @replay="replayTrip"
        @replay3d="replayTrip3D"
        @merge="mergeTrip"
      />
      <!--
      <logbook-map v-if="doShowAsCards === 3" :loading="isBusy" />
      <LogbookMapGl v-if="doShowAsCards === 4" :loading="isBusy" />
      <LogbookMapLibreGl v-if="doShowAsCards === 5" :loading="isBusy" />
      -->
      <template v-if="items.length > 0">
        <div class="flex flex-col-reverse md:flex-row gap-2 justify-between items-center py-2">
          <div>
            <strong>{{ $t('stats.count') }}:</strong> {{ stats.totalTrips }}
            <strong>{{ $t('stats.sum_duration') }}:</strong> {{ stats.sumDuration }}
            <strong>{{ $t('stats.total_duration') }}:</strong> {{ stats.totalDuration }}
            <strong>{{ $t('stats.sum_distance') }}:</strong> {{ stats.totalDistance }}
          </div>
        </div>
      </template>
      <div v-if="doShowAsCards < 3" class="flex mt-4">
        <va-icon
          v-if="items.length > 0"
          name="csv"
          outline
          :size="34"
          style="grid-column-end: 12"
          class="themed"
          @click="handleCSV_all(items)"
        ></va-icon>
      </div>
    </va-card-content>
  </va-card>

  <va-modal v-model="showModal" no-padding>
    <template #content="{ cancel }">
      <va-card-title>
        {{ t('logs.list.merge_modal.title') }}
      </va-card-title>
      <va-card-content>
        <va-inner-loading :loading="isBusy">
          <p class="mb-3 font-bold text-warning">⚠️ {{ t('logs.list.merge_modal.title') }}</p>
          <va-alert color="warning" outline class="mb-3">
            {{ t('logs.list.merge_modal.message') }}
          </va-alert>

          <va-alert color="danger" outline class="mb-3">
            {{ t('logs.list.merge_modal.danger') }}
          </va-alert>

          <template v-if="apiError">
            <va-alert color="danger" outline class="mb-4"> {{ t('api.error') }}: {{ apiError }} </va-alert>
          </template>

          <div class="mb-4">
            from/start log:
            {{ start_trip.name }} - {{ dateFormatUTC(start_trip.fromTime) }}
          </div>
          <div class="mb-4">
            to/end log:
            {{ end_trip.name }} - {{ dateFormatUTC(end_trip.fromTime) }}
          </div>
        </va-inner-loading>
      </va-card-content>
      <va-card-actions style="display: flex; justify-content: flex-end !important; gap: 0.5rem">
        <va-button color="danger" @click="cancel">
          {{ t('vuestic.cancel') }}
        </va-button>
        <va-button color="primary" @click="handleMerge">
          {{ t('vuestic.ok') }} {{ t('logs.list.merge_modal.title') }}
        </va-button>
      </va-card-actions>
    </template>
  </va-modal>
</template>

<script setup>
  import { computed, ref, reactive, onMounted, watch } from 'vue'
  import { areIntervalsOverlapping } from 'date-fns'
  import { useI18n } from 'vue-i18n'
  import { useCacheStore } from '../../stores/cache-store'
  import { setAppTitle } from '../../utils/app.js'
  import { distanceFormat, distanceFormatMiles } from '../../utils/distanceFormatter.js'
  import {
    durationFormatHours,
    dateFormatUTC,
    durationHours,
    hoursToHumanMoment,
    durationFromTS,
  } from '../../utils/dateFormatter.js'
  import { asBusy, handleExport } from '../../utils/handleExports'
  import { useRoute } from 'vue-router'
  import logsData from '../../data/logs.json'
  import LogbookCards from './widgets/Cards.vue'
  import LogbookTable from './widgets/Table.vue'
  //import LogbookMap from './widgets/Map.vue'
  //import LogbookMapGl from '../../components/maps/leafletMapgl.vue'
  //import LogbookMapLibreGl from '../../components/maps/MaplibreglDeckgl.vue'
  import { useModal, useToast } from 'vuestic-ui'
  import { useRouter } from 'vue-router'
  import { useGlobalStore } from '../../stores/global-store'
  import { storeToRefs } from 'pinia'
  import PostgSail from '../../services/api-client'
  import { useVesselStore } from '../../stores/vessel-store'

  const { vesselName, vesselType } = useVesselStore()

  const GlobalStore = useGlobalStore()
  const { isMobile, doShowAsCards, readOnly } = storeToRefs(GlobalStore)

  const CacheStore = useCacheStore()
  const router = useRouter()
  const { t } = useI18n()
  const sorting = ref({ sortBy: 'started', sortingOrder: 'desc' })
  const { confirm } = useModal()
  const { init: notify } = useToast()
  const showModal = ref(false)
  const start_trip = ref(null)
  const end_trip = ref(null)
  const perPage = ref(20)
  const currentPage = ref(1)
  const totalPages = computed(() => {
    return Math.ceil(items.value.length / perPage.value)
  })

  const stats = computed(() => {
    // Stats summary
    const distance = items.value.reduce((acc, trip) => acc + trip.distance, 0)
    const duration = items.value.reduce((acc, trip) => acc + durationHours(trip.duration), 0)
    return {
      totalTrips: items.value.length,
      totalDistance: distanceFormatMiles(distance),
      sumDuration: hoursToHumanMoment(duration),
      totalDuration: durationFromTS(items.value[0].fromTime, items.value[items.value.length - 1].toTime),
    }
  })

  // If mobile display as card by default.
  if (isMobile.value) {
    doShowAsCards.value = 1
  }
  watch(doShowAsCards, () => {
    console.debug('doShowAsCards ref changed!')
    console.debug('doShowAsCards:', doShowAsCards.value)
    GlobalStore.$state.doShowAsCards = doShowAsCards.value
  })

  const onTripDeleted = async (log) => {
    const response = await confirm({
      title: 'Delete trip',
      message: `Are you sure you want to delete trip "${log.name}"? This will permanently delete the Log Entry and any associated Stays. Do you really want to continue?`,
      okText: 'Delete',
      size: 'small',
      maxWidth: '380px',
    })

    if (!response) {
      return
    }

    if (GlobalStore.readOnly) {
      notify({
        message: `Demo account readonly`,
        position: 'top-right',
        color: 'warning',
      })
      return
    }

    const api = new PostgSail()
    try {
      const response = await api.log_delete(log.id)
      if (response) {
        console.log('log_delete success', response)
        // Remove from layout
        const indexToRemove = rowsData.value.findIndex((trip) => trip.id === log.id)
        rowsData.value.splice(indexToRemove, 1)
        // Clean CacheStore and force refresh
        await CacheStore.resetCache()
        const resp = await CacheStore.getAPI('logs')
        if (Array.isArray(resp)) {
          rowsData.value.splice(0, rowsData.value.length || [])
          rowsData.value.push(...resp)
          console.log('Logs list', rowsData.value)
        }
        CacheStore.refresh = 'false' // restore network cache, default 5min form api.
      } else {
        throw { response }
      }
    } catch (err) {
      const { response } = err
      console.log('log_delete failed', err)
      apiError.value = response.message
    } finally {
      isBusy.value = false
      notify({
        message: apiError.value ? `Error deleting log entry` : `Successfully deleted log entry`,
        position: 'top-right',
        color: apiError.value ? 'warning' : 'success',
      })
    }
  }

  const editTrip = async (log) => {
    router.push({ name: 'log-map', params: { id: log.id } })
    return
  }

  const replayTrip = async (log) => {
    router.push({ name: 'timelapse-replay', params: { id: log.id } })
    return
  }

  const replayTrip3D = async (log) => {
    router.push({ name: 'timelapse3d-replay', params: { id: log.id } })
    return
  }

  const exportGPX = async (log) => {
    handleGPX({ _id: log.id })
  }

  const action_options = [
      {
        value: null,
        text: '...',
      },
      {
        value: handleCSV,
        text: t('logs.log.export') + ' CSV',
      },
      {
        value: handleGPX,
        text: t('logs.log.export') + ' GPX',
      },
    ],
    action_verbs = {
      handleCSV,
      handleGPX,
    }

  const getDefaultFilter = () => {
    return {
      name: null,
      dateRange: null,
      tags: [],
    }
  }

  const route = useRoute()
  const isBusy = ref(false)
  const apiError = ref(null)
  const rowsData = ref([])
  const filter = reactive(getDefaultFilter())
  const filter_moorage_id = route.params.id || null
  const items = computed(() => {
    return Array.isArray(rowsData.value)
      ? rowsData.value
          .map((row) => ({
            id: row.id,
            name: row.name,
            from: row.from,
            to: row.to,
            fromTime: row.started,
            toTime: row.ended,
            distance: row.distance,
            distance_nm: distanceFormat(row.distance),
            duration: row.duration,
            duration_h: durationFormatHours(row.duration),
            fromMoorageId: row._from_moorage_id,
            toMoorageId: row._to_moorage_id,
            tags: row.tags,
          }))
          .filter((row) => {
            if (filter_moorage_id) {
              console.log('filter on moorage id')
              if (row.fromMoorageId == filter_moorage_id || row.toMoorageId == filter_moorage_id) {
                return true
              }
              return false
            } else {
              const f = filter
              if (Object.keys(f).every((fkey) => !f[fkey])) {
                return true
              }
              return Object.keys(f).every((fkey) => {
                if (!f[fkey]) {
                  return true
                }
                switch (fkey) {
                  case 'name':
                    return (
                      row.name.toLowerCase().includes(f[fkey].toLowerCase()) ||
                      row.from.toLowerCase().includes(f[fkey].toLowerCase()) ||
                      row.to.toLowerCase().includes(f[fkey].toLowerCase())
                    )
                  case 'dateRange':
                    // TODO: temp fix for Vuestic date range bug
                    if (!f[fkey].start || !f[fkey].end) {
                      return true
                    }
                    return areIntervalsOverlapping(
                      { start: new Date(row.fromTime), end: new Date(row.toTime) },
                      f[fkey],
                    )
                  case 'tags':
                    if (f[fkey].length == 0) return true // no filter -> return all
                    if (!Array.isArray(row.tags) && f[fkey].length == 0) return true // no tags and no filter -> return all
                    if (!Array.isArray(row.tags) && f[fkey].length > 0) return false // no tags and filter -> return none
                    //console.log(row.tags, Object.values(row.tags))
                    //console.log(f[fkey])
                    for (let tag of Object.values(row.tags)) {
                      //console.log(tag, f[fkey].indexOf(tag))
                      if (f[fkey].indexOf(tag) > -1) return true
                    }
                    return false
                }
              })
            }
          })
      : []
  })

  const pagination = reactive({ page: 1, perPage: 10, total: items.value.length })

  watch(filter, () => {
    console.debug('filter ref changed!')
    pagination.page = 1
  })

  const title = t('logs.list.title') + ' ' + vesselName

  onMounted(async () => {
    document.title = setAppTitle(title)

    isBusy.value = true
    apiError.value = null
    try {
      const response = await CacheStore.getAPI('logs')
      if (Array.isArray(response)) {
        rowsData.value.splice(0, rowsData.value.length || [])
        rowsData.value.push(...response)
        console.log('Logs list', rowsData.value)
      } else {
        throw { response }
      }
    } catch (e) {
      apiError.value = e
      if (!import.meta.env.PROD) {
        console.warn('Fallback using sample data from local json...', apiError.value)
        rowsData.value.splice(0, rowsData.value.length || [])
        rowsData.value.push(...logsData)
      }
    } finally {
      isBusy.value = false
    }
  })

  function runBusy(fn, ...args) {
    asBusy(isBusy, apiError, fn, ...args)
  }

  function handleCSV_all(items) {
    runBusy(handleExport, 'csv', 'logs', items)
  }
  function handleCSV(item) {
    runBusy(handleExport, 'csv', 'log', [item])
  }
  function handleGPX(item) {
    runBusy(handleExport, 'gpx', 'log', item)
  }
  function handleAction({ value }, id) {
    value(id)
  }

  const tagsOptions = CacheStore.getTags()
  function deleteChip(chip) {
    filter.tags = filter.tags.filter((v) => v !== chip)
  }

  function findAdjacentLogs(logId) {
    const index = items.value.findIndex((log) => log.id === logId)
    if (index === -1) return null

    return items.value[index - 1] ?? null
  }

  const mergeTrip = async (log) => {
    console.log('mergeTrip', log)
    start_trip.value = log
    end_trip.value = findAdjacentLogs(log.id)
    if (!end_trip.value) {
      notify({
        message: `No adjacent log found`,
        position: 'top-right',
        color: 'warning',
      })
      return
    }
    console.log('mergeTrip', start_trip.value, end_trip.value)
    showModal.value = true
    return
  }

  async function handleMerge() {
    if (!start_trip.value || !end_trip.value) {
      notify({
        message: `handleMerge ignore`,
        position: 'top-right',
        color: 'warning',
      })
      return
    }
    if (start_trip.value.id > end_trip.value.id) {
      notify({
        message: `handleMerge ignore`,
        position: 'top-right',
        color: 'warning',
      })
      return
    }
    console.log('mergeTrip', start_trip.value, end_trip.value)
    const api = new PostgSail()
    try {
      const response = await api.logs_merge({ id_start: start_trip.value.id, id_end: end_trip.value.id })
      if (response) {
        console.log('log_merge success', response)
        // Clean CacheStore and force refresh
        await CacheStore.resetCache()
        const resp = await CacheStore.getAPI('logs')
        if (Array.isArray(resp)) {
          rowsData.value.splice(0, rowsData.value.length || [])
          rowsData.value.push(...resp)
          console.log('Logs list', rowsData.value)
        }
        CacheStore.refresh = 'false' // restore network cache, default 5min form api.
      } else {
        throw { response }
      }
    } catch (err) {
      console.log('log_merge failed', err)
      apiError.value = err.message
    } finally {
      isBusy.value = false
      notify({
        message: apiError.value ? `Error merging log entry` : `Successfully merged log entry`,
        position: 'top-right',
        color: apiError.value ? 'warning' : 'success',
      })
    }
  }
</script>

<style lang="scss">
  .xs-chip {
    padding: 0.25rem 0.25rem;
    font-size: 0.75rem;
    line-height: 1;
    height: 1.1rem;
  }
</style>
