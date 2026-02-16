<template>
  <div class="charts">
    <div class="grid grid-cols-12 gap-6">
      <!-- mixedChart 
      <va-card class="chart-widget col-span-12">
        <va-card-title>{{ t('dashboard.charts.mixedMonthChart') }}</va-card-title>
        <va-card-content v-if="logs.length >= 1">
          <EchartsMix v-if="mixedChartDataComputed" :series="mixedChartDataComputed" :theme="currentTheme" />
        </va-card-content>
      </va-card> -->
      <!-- mixedChart -->
      <va-card class="chart-widget col-span-12">
        <va-card-title>
          {{
            granularity === 'month' ? t('dashboard.charts.mixedMonthChart') : t('dashboard.charts.mixedWeekChart')
          }}</va-card-title
        >
        <va-card-content v-if="logs.length >= 1">
          <VaButtonGroup preset="primary">
            <VaButton :class="{ active: granularity === 'month' }" @click="granularity = 'month'">
              {{ t('dashboard.charts.byMonth') }}
            </VaButton>
            <VaButton :class="{ active: granularity === 'week' }" @click="granularity = 'week'">
              {{ t('dashboard.charts.byWeek') }}
            </VaButton>
          </VaButtonGroup>
          <EchartsMix2 :logs="logs" :granularity="granularity" :theme="currentTheme" />
        </va-card-content>
      </va-card>
      <!-- HeatmapChart -->
      <va-card class="chart-widget col-span-12">
        <va-card-title>{{ t('dashboard.charts.HeatmapChart') }}</va-card-title>
        <va-card-content>
          <EchartsHeatmap v-if="HeatmapChartComputed" :series="HeatmapChartComputed" :theme="currentTheme" />
        </va-card-content>
      </va-card>
      <!-- NetworkGraph -->
      <va-card class="chart-widget col-span-12">
        <va-card-title>{{ t('dashboard.charts.NetworkGraph') }}</va-card-title>
        <va-card-content v-if="logs.length >= 1">
          <div class="controls-row">
            <div class="control-group">
              <span class="control-label">{{ t('dashboard.charts.weightBy') }}:</span>
              <VaButtonGroup preset="primary">
                <VaButton
                  v-for="option in weightByOptions"
                  :key="option.value"
                  :color="weightBy === option.value ? 'primary' : 'secondary'"
                  size="small"
                  @click="weightBy = option.value"
                >
                  {{ option.text }}
                </VaButton>
              </VaButtonGroup>
            </div>

            <VaDivider vertical />

            <div class="control-group">
              <span class="control-label">{{ t('dashboard.charts.minTrips') }}:</span>
              <VaCounter v-model="minTrips" :min="1" :max="20" style="width: 120px" />
            </div>

            <VaDivider vertical />

            <VaSwitch v-model="showLabels" :label="t('dashboard.charts.showLabels')" size="small" />
          </div>
          <EchartsGraph
            :logs="logs"
            :weight-by="weightBy"
            :min-trips="minTrips"
            :show-labels="showLabels"
            :theme="currentTheme"
          />
        </va-card-content>
      </va-card>
    </div>
    <!-- From stats -->
    <div class="dashboard flex flex-auto col-span-12 mt-4 gap-4">
      <va-card class="flex-auto card-width">
        <va-card-title>{{ t('stats.logs') }}</va-card-title>
        <va-card-content style="width: 100%">
          <template v-if="hasLogs != 0">
            <EchartsDonught v-if="pieChartUnderway" :series="pieChartUnderway" :theme="currentTheme" />
          </template>
          <template v-else>
            <va-card-content>{{ t('nodata.nodata') }}</va-card-content>
          </template>
        </va-card-content>
      </va-card>
      <va-card class="flex-auto card-width">
        <va-card-title>{{ t('stats.moorages') }}</va-card-title>
        <va-card-content style="width: 100%">
          <template v-if="hasLogs != 0">
            <EchartsDonught v-if="pieChartStayType" :series="pieChartStayType" :theme="currentTheme" />
          </template>
          <template v-else>
            <va-card-content>{{ t('nodata.nodata') }}</va-card-content>
          </template>
        </va-card-content>
      </va-card>
    </div>
  </div>
</template>

<script setup>
  import { ref, computed, onMounted, defineAsyncComponent } from 'vue'
  import { useI18n } from 'vue-i18n'
  import EchartsMix from '../../components/echarts/mix.vue'
  import EchartsMix2 from '../../components/echarts/mixmerge.vue'
  import EchartsSunburts from '../../components/echarts/sunburst.vue'
  import EchartsDonught from '../../components/echarts/donught.vue'
  import EchartsHeatmap from '../../components/echarts/heatmap.vue'
  import EchartsGraph from '../../components/echarts/seriesgraph.vue'
  import { useCacheStore } from '../../stores/cache-store'
  import { storeToRefs } from 'pinia'
  import moment from 'moment/min/moment-with-locales'
  import { useGlobalStore } from '../../stores/global-store'

  const GlobalStore = useGlobalStore()
  const { hasLogs, stats_logs, stats_moorages, currentTheme } = storeToRefs(GlobalStore)
  const { t } = useI18n()

  const CacheStore = useCacheStore()
  const { logs, moorages, stays, logs_by_month, logs_by_year_by_month, logs_by_month_by_weekday } =
    storeToRefs(CacheStore)
  console.log('echarts logs_by_year_by_month', logs_by_year_by_month.value)
  console.log('echarts logs_by_month_by_weekday', logs_by_month_by_weekday.value)

  const granularity = ref('week')
  const showLabels = ref(true)
  const weightBy = ref('frequency')
  const minTrips = ref(1)
  const weightByOptions = computed(() => [
    { value: 'frequency', text: t('dashboard.charts.tripFrequency') },
    { value: 'distance', text: t('dashboard.charts.totalDistance') },
    { value: 'duration', text: t('dashboard.charts.totalDuration') },
  ])

  const series = [
    {
      name: 'Bar Dataset',
      type: 'bar',
      smooth: true,
      tooltip: {
        valueFormatter: function (value) {
          return value
        },
      },
      data: [1, 2, 4, 4, 3, 4, 0, 5, 1, 3, 0, 0],
    },
  ]
  const mixedChartDataComputed = computed(() => {
    if (logs_by_month.value.length == 0) return {}
    let mymixedChartData = [...series]
    mymixedChartData[0].data = logs_by_month.value
    mymixedChartData[0].name = 'Total'
    Object.entries(logs_by_year_by_month.value).forEach((elm, ind) => {
      const line = structuredClone({
        type: 'line',
        smooth: true,
      })
      line.name = elm[0]
      line.data = elm[1]
      mymixedChartData[ind + 1] = line
    })
    return mymixedChartData
  })
  const HeatmapChartComputed = computed(() => {
    let matrix_data = []
    if (logs_by_month_by_weekday.value.length != 0) {
      logs_by_month_by_weekday.value.forEach((elm, ind) => {
        matrix_data.push([elm.x, elm.y, elm.v])
      })
    }
    return matrix_data
  })
  const pieChartUnderway = computed(() => {
    //console.log('stats_logs', stats_logs.value)
    //console.log('stats_moorages', stats_moorages.value)
    if (!stats_logs.value || !stats_moorages.value || !stats_logs.value.count) {
      return []
    }
    return [
      {
        value: moment.duration(stats_logs.value.sum_duration).as('days').toFixed(1),
        name: t('stats.underway'),
      },
      {
        value: moment.duration(stats_moorages.value.time_spent_away).as('days').toFixed(1),
        name: t('stats.away'),
      },
      {
        value: moment.duration(stats_moorages.value.time_at_home_ports).as('days').toFixed(1),
        name: t('stats.home'),
      },
    ]
  })

  const timeSpentAwayByType = computed(() => {
    if (
      !stats_moorages.value ||
      !Array.isArray(stats_moorages.value.time_spent_away_arr) ||
      stats_moorages.value.time_spent_away_arr.length === 0
    ) {
      return {
        /*
      1: { durationMs: 25, percentage: 25, duration: 'PT25S' },
      2: { durationMs: 25, percentage: 25, duration: 'PT25S' },
      3: { durationMs: 25, percentage: 25, duration: 'PT25S' },
      4: { durationMs: 25, percentage: 25, duration: 'PT25S' },
      */
      }
    }

    let totalDurationMs = 0
    const stayMap = {}

    stats_moorages.value.time_spent_away_arr.forEach((entry) => {
      const stayCode = entry.stay_code
      const durationMs = moment.duration(entry.stay_duration).asMilliseconds()

      totalDurationMs += durationMs
      if (!stayMap[stayCode]) {
        stayMap[stayCode] = { durationMs: 0 }
      }
      stayMap[stayCode].durationMs += durationMs
    })

    Object.keys(stayMap).forEach((stayCode) => {
      const durationMs = stayMap[stayCode].durationMs

      stayMap[stayCode].percentage = Math.round((durationMs / totalDurationMs) * 100)

      const durationObj = moment.duration(durationMs)
      stayMap[stayCode].duration = durationObj.toISOString()
    })
    //console.debug('timeSpentAwayByType', stayMap)
    return stayMap
  })

  const pieChartStayType = computed(() => {
    const timeData = timeSpentAwayByType.value
    const data = []
    Object.keys(timeData).forEach((stayCode) => {
      const value = timeData[stayCode]
      if (value.durationMs > 0) {
        data.push({
          value: moment.duration(value.duration).as('days').toFixed(1),
          name: t('id.stay_code.' + stayCode),
        })
      }
    })
    //console.debug('pieChartStayType', data)
    return data
  })
</script>

<style lang="scss">
  .dashboard {
    .va-icon {
      fill: var(--va-text-primary);
    }

    .va-card {
      margin-bottom: 0 !important;

      &__title {
        display: flex;
        justify-content: space-between;
      }
    }

    .card-width {
      width: 100%;

      @media (min-width: 768px) {
        width: calc((100% - 2rem) / 2);
      }

      @media (min-width: 1024px) {
        width: calc((100% - 2rem) / 3);
      }
    }
  }

  .controls-row {
    display: flex;
    align-items: center;
    gap: 16px;
    padding: 12px 16px;
    //background: var(--va-background-element);
    border-radius: 8px;
    margin-bottom: 16px;
    flex-wrap: wrap;
  }

  .control-group {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .control-label {
    font-size: 0.875rem;
    font-weight: 500;
    color: var(--va-text-primary);
    white-space: nowrap;
  }
</style>
