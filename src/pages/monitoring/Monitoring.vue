<template>
  <va-card class="leaflet-map__full">
    <template v-if="apiError">
      <va-alert color="danger" outline class="mb-4"> {{ $t('api.error') }}: {{ apiError }} </va-alert>
    </template>
    <template v-if="offline && apiSuccess && nodatayet">
      <noDataYet />
    </template>
    <template v-if="!offline && apiSuccess && !nodatayet">
      <template v-if="mapGeoJsonFeatures">
        <l-map
          id="monitoring-map"
          :tabs="['steelseries']"
          :tabs-auto-open="true"
          :geo-json-feature="Array.isArray(mapGeoJsonFeatures) ? null : mapGeoJsonFeatures"
          :geo-json-features="Array.isArray(mapGeoJsonFeatures) ? mapGeoJsonFeatures : null"
          :map-zoom="13"
          map-type="Satellite"
        >
          <template #tab-steelseries>{{ items.vessel_name }}</template>
          <template #content-steelseries>
            <h1 class="layout gutter--md text-center p-4">{{ msg_fromNow }}</h1>
            <div style="font-size: 10pt; text-align: center">
              <template v-if="sub_msg == 'Offline'">
                <va-avatar size="small" color="warning" class="mr-6" /> Offline
              </template>
              <template v-else-if="sub_msg == 'Online'">
                <va-avatar size="small" color="success" class="mr-6" /> Online
              </template>
            </div>
            <div class="flex flex-col items-center p-4">
              <div style="width: 180px; position: relative; margin: auto">
                <div
                  id="windDirection"
                  style="
                    display: true;
                    position: absolute;
                    left: 10px;
                    top: 18px;
                    height: 36px;
                    width: 36px;
                    z-index: 99;
                  "
                >
                  <img
                    id="windArrow"
                    src="/wind_direction.png"
                    style="height: 32px; width: 32px; opacity: 0.7"
                    :style="windDirection"
                  />
                </div>
                <display-lcd id="wind" :display="items.wind"></display-lcd>
              </div>
              <display-lcd id="temperature" :display="items.temperature"></display-lcd>
              <display-lcd id="humidity" :display="items.humidity"></display-lcd>
              <display-lcd id="water" :display="items.water"></display-lcd>
              <display-lcd id="pressure" :display="items.pressure"></display-lcd>
              <display-lcd id="battery" :display="items.battery"></display-lcd>
              <display-lcd id="solar" :display="items.solar"></display-lcd>
            </div>
          </template>
        </l-map>
      </template>
    </template>
  </va-card>
</template>

<script>
  import DisplayMulti from '../../components/DisplayMulti.vue'
  export default {
    name: 'Monitoring',
    components: {
      'display-lcd': DisplayMulti,
    },
  }
</script>

<script setup>
  import 'leaflet/dist/leaflet.css'
  import 'leaflet.sidepanel/dist/leaflet.sidepanel.css'
  import L from 'leaflet'
  import 'leaflet.sidepanel'

  // TODO update setup with lang="ts"
  import { computed, ref, reactive, onMounted } from 'vue'
  import { setAppTitle } from '../../utils/app.js'
  import PostgSail from '../../services/api-client'
  import lMap from '../../components/maps/leafletMap.vue'
  import { useI18n } from 'vue-i18n'
  import { kelvinToHuman } from '../../utils/temperatureFormatter.js'
  import { pascalToHectoPascal } from '../../utils/presureFormatter.js'
  import { floatToPercentage } from '../../utils/percentageFormatter.js'
  import { fromNow, nowUTC, dateFormatUTC } from '../../utils/dateFormatter.js'
  import { default as utils } from '../../utils/utils.js'
  import { decimalToDMS } from '../../utils/dms'

  import monitoringDatas from '../../data/monitoring.json'
  import useGlobalStore from '../../stores/global-store'

  import noDataYet from '../../components/noDataScreen.vue'

  const GlobalStore = useGlobalStore()
  const { t } = useI18n()

  const isBusy = ref(false)
  const apiError = ref(null)
  const apiSuccess = ref(null)
  const apiData = reactive({ row: null })
  const offline = ref(true)
  const nodatayet = ref(false)

  const items = computed(() => {
    return apiData.row
      ? {
          wind: {
            headerString: t('monitoring.wind.headerString'),
            unitString: t('monitoring.wind.unitString'),
            detailString: t('monitoring.wind.detailString'),
            detailUnitString: 'deg',
            lcdDecimals: 0,
            value: utils.metersToKnots(apiData.row.windspeedoverground) || 0,
            altValue: utils.radiantToDegrees(apiData.row.winddirectiontrue) || 0,
          },
          temperature: {
            headerString: t('monitoring.temperature.headerString'),
            unitString: tempUnit.value,
            detailString: t('monitoring.temperature.detailString'),
            detailUnitString: tempUnit.value,
            lcdDecimals: 1,
            value: kelvinToHuman(apiData.row.insidetemperature) || 0.0,
            altValue: kelvinToHuman(apiData.row.outsidetemperature) || 0.0,
          },
          water: {
            headerString: t('monitoring.water.headerString'),
            unitString: depthUnit.value,
            detailString: t('monitoring.water.detailString'),
            detailUnitString: tempUnit.value,
            lcdDecimals: 1,
            value: meterToFeet.value || 0,
            altValue: kelvinToHuman(apiData.row.watertemperature) || 0.0,
          },
          battery: {
            headerString: t('monitoring.battery.headerString'),
            unitString: t('monitoring.battery.unitString'),
            detailString: t('monitoring.battery.detailString'),
            detailUnitString: 'V',
            lcdDecimals: 1,
            value: floatToPercentage(apiData.row.batterycharge) || 0,
            altValue: apiData.row.batteryvoltage || 0,
          },
          humidity: {
            headerString: t('monitoring.humidity.headerString'),
            unitString: t('monitoring.humidity.unitString'),
            detailString: t('monitoring.humidity.detailString'),
            detailUnitString: t('monitoring.humidity.unitString'),
            lcdDecimals: 0,
            value: floatToPercentage(apiData.row.insidehumidity) || 0,
            altValue: floatToPercentage(apiData.row.outsidehumidity) || 0,
          },
          pressure: {
            headerString: t('monitoring.pressure.headerString'),
            unitString: t('monitoring.pressure.unitString'),
            detailString: t('monitoring.pressure.detailString'),
            detailUnitString: t('monitoring.pressure.unitString'),
            lcdDecimals: 1,
            value: pascalToHectoPascal(apiData.row.insidepressure) || 0.0,
            altValue: pascalToHectoPascal(apiData.row.outsidepressure) || 0.0,
          },
          solar: {
            headerString: t('monitoring.solar.headerString'),
            unitString: t('monitoring.solar.unitString'),
            detailString: t('monitoring.battery.detailString'),
            detailUnitString: 'V',
            lcdDecimals: 1,
            value: apiData.row.solarpower || 0,
            altValue: apiData.row.solarvoltage || 0,
          },
          vessel_name: apiData.row.name,
          geojson: apiData.row.geojson,
          live: apiData.row.live,
        }
      : {}
  })

  const msg_fromNow = computed(() => {
    return fromNow(apiData.row.time)
  })

  const sub_msg = computed(() => {
    return apiData.row.time && !apiData.row.offline ? 'Online' : 'Offline'
  })

  const mapGeoJsonFeatures = computed(() => {
    if (apiData.row.status != 'moored' && apiData.row.status != 'anchored') {
      return items.value.live.features
    }
    return apiData.row.live ? items.value.live : items.value.geojson
  })

  const tempUnit = computed(() => {
    return GlobalStore.imperialUnits
      ? t('monitoring.imperial_units.temperature')
      : t('monitoring.temperature.unitString')
  })

  const depthUnit = computed(() => {
    return GlobalStore.imperialUnits ? t('monitoring.imperial_units.depth') : t('monitoring.water.unitString')
  })

  const meterToFeet = computed(() => {
    return GlobalStore.imperialUnits ? (apiData.row.depth || 0) * 3.2808399 : apiData.row.depth || 0
  })

  const windDirection = computed(() => ({
    rotate: `${utils.radiantToDegrees(apiData.row.winddirectiontrue) - 180}deg`,
  }))

  onMounted(async () => {
    isBusy.value = true
    apiError.value = null
    const api = new PostgSail()
    try {
      const response = await api.monitoring_live()
      if (Array.isArray(response) && response[0]) {
        //console.log(response[0])
        apiSuccess.value = true
        offline.value = false
        nodatayet.value = false
        //offline.value = response[0].offline
        apiData.row = response[0]
        //console.log(apiData)
        //console.log(response[0].time)
        //console.log(moment.utc(response[0].time).locale('es').fromNow())
        //setTimeout(() => monitor(), 60 * 1000) // 1 min
        if (apiData.row.name) {
          document.title = setAppTitle(t('monitoring.title') + ': ' + apiData.row.name)
        }
      } else {
        console.warn('monitoring', response)
        if ((Array.isArray(response) && response.length === 0) || !response[0]) {
          apiSuccess.value = true
          offline.value = true
          nodatayet.value = true
          apiData.row = []
        }
        //throw { response }
      }
    } catch ({ response }) {
      console.log(response)
      apiError.value = t('monitoring.error')
      if (!import.meta.env.PROD) {
        console.warn('Fallback using sample data from local json...', apiError.value)
        //console.log(monitoringDatas[0].time)
        // Update time to now
        monitoringDatas[0].time = nowUTC()
        apiData.row = monitoringDatas[0]
      }
    } finally {
      isBusy.value = false
    }
  })
</script>

<style lang="scss">
  #monitoring-map {
    width: 100%;
    height: calc(100vh - 4.5rem);
  }
  .sidepanel {
    width: 240px;
    height: 100%;
    .sidepanel-content {
      width: 240px;
      height: 100%;
    }
  }
</style>
