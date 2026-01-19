<template>
  <div class="p-4 dark:text-white">
    <va-card class="shadow-lg rounded-lg">
      <va-card-title>{{ $t('boats.boat.polar.title') }}</va-card-title>
      <va-card-content class="mb-4">
        <div class="p-4 space-y-4 rounded transition">
          <template v-if="apiError">
            <va-alert color="danger" outline class="mb-4"> {{ $t('api.error') }}: {{ apiError }} </va-alert>
          </template>
          <va-inner-loading :loading="isBusy">
            <va-textarea
              v-model="csvContent"
              type="textarea"
              :placeholder="$t('boats.boat.polar.placeholder')"
              :min-rows="10"
              :max-rows="10"
              class="w-full font-mono text-sm"
              @input="updateChartFromCSV"
            ></va-textarea>
            <p class="text-sm text-gray-400 mt-1">Last updated: {{ lastUpdated }}</p>
            <va-alert color="warning" outline class="mb-4">{{ t('boats.boat.polar.message') }}</va-alert>
            <va-button color="primary" size="medium" class="my-button pa-2 p-2" @click="handleSubmit">
              {{ t('boats.boat.polar.submit') }}
            </va-button>
          </va-inner-loading>
        </div>
      </va-card-content>
    </va-card>
    <va-card class="shadow-lg rounded-lg">
      <va-card-content class="mb-4">
        <div class="p-4 space-y-4 rounded transition">
          <va-inner-loading :loading="isBusy">
            <div ref="chartRef" class="w-full h-[500px] rounded transition"></div>
          </va-inner-loading>
        </div>
      </va-card-content>
    </va-card>
  </div>
</template>

<script setup>
  import { ref, onMounted } from 'vue'
  import { setAppTitle } from '../../utils/app.js'
  import { useI18n } from 'vue-i18n'
  import PostgSail from '../../services/api-client'
  import { dateFormatUTC } from '../../utils/dateFormatter.js'
  import { useToast } from 'vuestic-ui'

  import * as echarts from 'echarts'

  import { useGlobalStore } from '../../stores/global-store'

  const GlobalStore = useGlobalStore()
  const { t } = useI18n()
  const { init: initToast } = useToast()
  const isBusy = ref(false)
  const apiError = ref(null)
  const chartRef = ref(null)
  const csvContent = ref('')
  const lastUpdated = ref(null)

  let myChart = null

  const CSV_PREAMBLE = 'twa/tws'
  const parseCSV = (csv) => {
    csv = csv.trim()

    if (csv.indexOf(CSV_PREAMBLE) !== 0) {
      console.error('CSV should start with ' + CSV_PREAMBLE)
      apiError.value = 'Invalid CSV, CSV should start with ' + CSV_PREAMBLE
      throw new Error('Invalid CSV')
    }
    apiError.value = null
    const rows = csv
      .trim()
      .split('\n')
      .map((row) => row.split(';').map(Number.isNaN ? (val) => val : Number))
    const headers = rows[0]
    const twsLabels = headers.slice(1).map(Number)
    const rawData = rows.slice(1).map((row) => row.map(Number))
    return { twsLabels, rawData }
  }

  const buildSeries = (twsLabels, rawData) => {
    return twsLabels.map((tws, i) => ({
      name: `${tws} kt TWS`,
      type: 'line',
      smooth: true,
      showSymbol: true,
      data: rawData.filter((row) => row[i + 1] !== 0).map((row) => [row[0], row[i + 1]]),
      emphasis: {
        focus: 'series',
      },
    }))
  }

  const renderChart = (twsLabels, rawData) => {
    if (!chartRef.value) return
    if (!myChart) myChart = echarts.init(chartRef.value)
    const series = buildSeries(twsLabels, rawData)

    const option = {
      title: {
        text: 'Sailing Polar Diagram (Line)',
        left: 'center',
      },
      tooltip: {
        trigger: 'item',
        formatter: (params) =>
          `TWA: ${params.value[0]}°<br>Boat Speed: ${params.value[1]} kn<br>TWS: ${params.seriesName}`,
      },
      legend: {
        top: 'bottom',
      },
      xAxis: {
        name: 'TWA (°)',
        type: 'value',
        min: 0,
        max: 180,
      },
      yAxis: {
        name: 'Boat Speed (kn)',
        type: 'value',
      },
      series,
    }

    myChart.setOption(option)
  }

  const updateChartFromCSV = () => {
    try {
      const { twsLabels, rawData } = parseCSV(csvContent.value)
      renderChart(twsLabels, rawData)
    } catch (error) {
      console.error('CSV parsing error:', error)
    }
  }

  onMounted(async () => {
    isBusy.value = true
    apiError.value = null
    const api = new PostgSail()
    try {
      const response = await api.vessel_get_polar()
      //console.log('polarCSV', response)
      // API return null when vessel is pending metadata
      if (response && Array.isArray(response)) {
        if (response.length > 0 && response[0].polar) {
          csvContent.value = response[0].polar
          lastUpdated.value = dateFormatUTC(response[0].polar_updated_at)
          updateChartFromCSV()
        }
        apiError.value = null
        return true
      } else {
        throw { response }
      }
    } catch (err) {
      apiError.value = err
      if (!import.meta.env.PROD) {
        console.warn('Fallback using sample data from local json...', apiError.value)
      }
    } finally {
      isBusy.value = false
    }
    window.addEventListener('resize', () => myChart?.resize())
  })

  const handleSubmit = async () => {
    isBusy.value = true
    apiError.value = null

    const api = new PostgSail()
    const payload = {
      userdata: {
        polar: csvContent.value.trim(),
      },
    }
    try {
      const response = await api.vessel_update(payload)
      //console.log(response)
      if (response) {
        console.log('polarCSV success', response)
        return true
      } else {
        throw { response }
      }
    } catch (err) {
      console.log('polarCSV failed', err.message ?? err)
      apiError.value = err
    } finally {
      initToast({
        message: apiError.value ? `Error uploading PolarCSV` : `Successfully uploaded PolarCSV`,
        position: 'top-right',
        color: apiError.value ? 'warning' : 'success',
      })
      isBusy.value = false
    }
  }
</script>

<style scoped>
  .my-button {
    width: 100%;
    text-align: center;
  }
</style>
