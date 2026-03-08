<template>
  <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
    <!-- mixedChart - Full width on all screens -->
    <va-card class="col-span-1 md:col-span-2">
      <va-card-title>
        {{ granularity === 'month' ? t('dashboard.charts.mixedMonthChart') : t('dashboard.charts.mixedWeekChart') }}
      </va-card-title>
      <template v-if="logs.length >= 1">
        <va-card-content>
          <div class="controls-row">
            <VaButtonToggle
              v-model="granularity"
              preset="primary"
              :options="[
                { label: t('dashboard.charts.byMonth'), value: 'month' },
                { label: t('dashboard.charts.byWeek'), value: 'week' },
              ]"
            />
          </div>
          <EchartsMix2 :logs="logs" :granularity="granularity" :theme="currentTheme" />
        </va-card-content>
      </template>
      <template v-else>
        <va-card-content>{{ t('nodata.nodata') }}</va-card-content>
      </template>
    </va-card>

    <!-- HeatmapChart - Full width on all screens -->
    <va-card class="col-span-1 md:col-span-2">
      <va-card-title>{{ t('dashboard.charts.HeatmapChart') }}</va-card-title>
      <template v-if="logs.length >= 1">
        <va-card-content>
          <EchartsHeatmap v-if="HeatmapChartComputed" :series="HeatmapChartComputed" :theme="currentTheme" />
        </va-card-content>
      </template>
      <template v-else>
        <va-card-content>{{ t('nodata.nodata') }}</va-card-content>
      </template>
    </va-card>

    <!-- NetworkGraph - Full width on all screens -->
    <va-card class="col-span-1 md:col-span-2">
      <va-card-title>{{ t('dashboard.charts.NetworkGraph') }}</va-card-title>
      <template v-if="logs.length >= 1">
        <va-card-content>
          <div class="controls-row">
            <div class="control-group">
              <span class="control-label">{{ t('dashboard.charts.weightBy') }}:</span>
              <VaButtonGroup preset="primary">
                <VaButton
                  v-for="option in weightByOptions"
                  :key="option.value"
                  :color="weightBy === option.value ? 'primary' : 'secondary'"
                  @click="weightBy = option.value"
                >
                  {{ option.text }}
                </VaButton>
              </VaButtonGroup>
            </div>

            <VaDivider vertical class="hidden md:block" />

            <div class="control-group">
              <span class="control-label">{{ t('dashboard.charts.minTrips') }}:</span>
              <VaCounter v-model="minTrips" :min="1" :max="20" style="width: 120px" />
            </div>

            <VaDivider vertical class="hidden md:block" />

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
      </template>
      <template v-else>
        <va-card-content>{{ t('nodata.nodata') }}</va-card-content>
      </template>
    </va-card>

    <!-- Pie Charts - Stack on mobile, side by side on desktop -->
    <va-card>
      <va-card-title>{{ t('stats.logs') }}</va-card-title>
      <va-card-content>
        <template v-if="hasLogs != 0">
          <EchartsDonught v-if="pieChartUnderway" :series="pieChartUnderway" :theme="currentTheme" />
        </template>
        <template v-else>
          {{ t('nodata.nodata') }}
        </template>
      </va-card-content>
    </va-card>

    <va-card>
      <va-card-title>{{ t('stats.moorages') }}</va-card-title>
      <va-card-content>
        <template v-if="hasLogs != 0">
          <EchartsDonught v-if="pieChartStayType" :series="pieChartStayType" :theme="currentTheme" />
        </template>
        <template v-else>
          {{ t('nodata.nodata') }}
        </template>
      </va-card-content>
    </va-card>
  </div>
</template>

<script setup>
  import { ref, computed, onMounted, defineAsyncComponent } from 'vue'
  import { useI18n } from 'vue-i18n'
  import EchartsMix from '../../components/echarts/mix.vue'
  import EchartsMix2 from '../../components/echarts/mixmerge.vue'
  //import EchartsSunburts from '../../components/echarts/sunburst.vue'
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
  //console.log('echarts logs_by_year_by_month', logs_by_year_by_month.value)
  //console.log('echarts logs_by_month_by_weekday', logs_by_month_by_weekday.value)

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

<style scoped>
  .controls-row {
    display: flex;
    flex-wrap: wrap;
    gap: 1rem;
    align-items: center;
    margin-bottom: 1rem;
    padding: 1rem;
    /*background-color: var(--va-background-element);*/
    border-radius: 0.5rem;
  }

  .control-group {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    flex-wrap: wrap;
  }

  .control-label {
    font-weight: 600;
    white-space: nowrap;
  }

  /* Mobile specific */
  @media (max-width: 768px) {
    .controls-row {
      flex-direction: column;
      align-items: stretch;
    }

    .control-group {
      width: 100%;
      justify-content: space-between;
    }
  }
</style>
