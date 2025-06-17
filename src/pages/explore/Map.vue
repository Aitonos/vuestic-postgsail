<template>
  <div class="leaflet-maps leaflet-map__full">
    <template v-if="apiError">
      <va-alert color="danger" outline class="mb-4">{{ $t('api.error') }}: {{ apiError }}</va-alert>
    </template>
    <va-inner-loading :loading="logsList && isBusy">
      <template v-if="logsList">
        <va-card>
          <MapExplorer
            id="explore-map"
            ref="exploreMap"
            :logs-list="logsListFull"
            :moorages-list="mooragesListFull"
            :tabs="['logs', 'moorages']"
            :tabs-auto-open="true"
            :control-layer="true"
            :map-zoom="7"
          >
            <template #tab-logs><va-icon name="menu-logs" /></template>
            <template #content-logs>
              <template v-if="logsList">
                <sidebarLogsList
                  v-if="logsListFull"
                  :logs-list="logsListFull"
                  :loading="isBusy"
                  @click="handleLogClick"
                />
              </template>
            </template>
          </MapExplorer>
        </va-card>
      </template>
    </va-inner-loading>
  </div>
</template>

<script setup>
  import { computed, ref, reactive, onMounted } from 'vue'
  import { useRoute, useRouter } from 'vue-router'
  import { useI18n } from 'vue-i18n'
  import { setAppTitle } from '../../utils/app.js'
  import PostgSail from '../../services/api-client'
  import { useCacheStore } from '../../stores/cache-store'
  import { dateFormatUTC, durationFormatHours, durationI18nHours, dateFormatTime } from '../../utils/dateFormatter.js'
  import { distanceFormatMiles } from '../../utils/distanceFormatter.js'
  import { speedFormatKnots } from '../../utils/speedFormatter.js'
  import { useModal, useToast } from 'vuestic-ui'
  const { confirm } = useModal()
  const { init: initToast } = useToast()
  import logBook from '../../data/logbook.json'
  import { useGlobalStore } from '../../stores/global-store'
  import { useVesselStore } from '../../stores/vessel-store'
  import L from 'leaflet'

  const { t } = useI18n()

  const { readOnly } = useGlobalStore()

  import MapExplorer from '../../components/maps/leafletMapExplorer_new.vue'
  import sidebarLogsList from './sidebars/Logs.vue'
  import sidebarMoorageList from './sidebars/Moorages.vue'
  import sidebarMonitoring from './sidebars/Monitoring.vue'
  //  import sidebarHistory from './sidebars/History.vue'

  const CacheStore = useCacheStore()
  const router = useRouter()
  const route = useRoute()
  const isBusy = ref(false)
  const apiError = ref(null)
  const apiSuccess = ref(null)
  const api_geojson = ref({})
  const mooragesLayers = ref([])
  const mooragesMakers = ref([])
  const logsLayers = ref([])
  const mooragesList = ref([])
  const logsList = ref([])
  const mapBounds = ref(null)
  const api_monitoring = ref({})
  const filter = reactive({
    dateRange: [0, 10],
    tags: [],
  })
  const stats = reactive({
    logs: {
      count: 0,
      distance: 0,
      duration: 0,
    },
    moorages: {
      count: 0,
      duration: 0,
    },
  })
  const rowsData = ref([])

  onMounted(async () => {
    isBusy.value = true
    apiError.value = null
    try {
      const api = new PostgSail()
      const response = await api.logs_mapgl()
      if (response.geojson) {
        api_geojson.value = response.geojson
        console.debug('Explore map geojson', api_geojson.value)
      } else {
        throw { response }
      }
    } catch (e) {
      if (!import.meta.env.PROD) {
        console.warn('Fallback using sample data from local json...', e)
        api_geojson.value = {}
        apiError.value = 'Error'
        isBusy.value = false
        return
      }
    } finally {
      isBusy.value = false
    }
  })

  // Extract all geometry Point from geojson to get a list of moorage geojson feature for map
  const mooragesListFull = computed(() => {
    if (!api_geojson.value?.features) return []
    return api_geojson.value.features
      .filter((feature) => feature.geometry.type === 'Point')
      .sort((a, b) => b.geometry.coordinates[1] - a.geometry.coordinates[1]) // north to south
      .map((feature, index) => {
        feature.properties['moorageIndex'] = index // keep original index
        if (feature.properties.default_stay_id == 3) {
          feature.properties['iconUrl'] = '/mooring_icon.png'
        } else if (feature.properties.default_stay_id == 4) {
          feature.properties['iconUrl'] = '/dock_icon.png'
        } else {
          feature.properties['iconUrl'] = '/anchoricon.png'
        }
        return feature
      })
  })

  // Extract all geometry LineString from geojson to get a list of log geojson feature for map
  const logsListFull = computed(() => {
    if (!api_geojson.value?.features) return []
    return api_geojson.value.features
      .filter((feature) => feature.geometry.type === 'LineString')
      .map((feature, index) => {
        feature.properties['logIndex'] = index // keep original index
        const midPoint = Math.round(feature.geometry.coordinates.length / 2)
        const centerLat = parseFloat(feature.geometry.coordinates[midPoint][1])
        const centerLng = parseFloat(feature.geometry.coordinates[midPoint][0])
        feature['properties']['centercoords'] = [centerLat, centerLng]
        return feature
      })
  })
</script>

<style lang="scss">
  #logbook-map {
    width: 100%;
    height: calc(100vh - 4.5rem);
  }
  .sidepanel {
    width: 350px;
    .sidepanel-content {
      width: 350px;
    }
  }
</style>
