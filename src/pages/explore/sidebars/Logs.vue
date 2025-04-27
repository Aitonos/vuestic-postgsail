<script setup></script>

<template>
  <div v-if="logsList.length > 0">
    <ol>
      <li v-for="(log, index) in logsList" id="logs-lists" :key="index" class="line-item">
        {{ index + 1 }}.
        <a
          class="va-link"
          @mouseenter="onLogMouseEnter(log.properties.logIndex)"
          @click="onLogClickNavigate(log.properties.centercoords, log.properties.logIndex)"
          >{{ log.properties.name }} • {{ durationFormatHours(log.properties.duration) }}H •
          {{ distanceFormatMiles(log.properties.distance) }}
        </a>
      </li>
    </ol>
  </div>
</template>
