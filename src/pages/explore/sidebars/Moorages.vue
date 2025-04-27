<script setup></script>

<template>
  <div v-if="mooragesList.length > 0">
    <ol>
      <li v-for="(moorage, index) in mooragesList" id="moorages-lists" :key="index" class="line-item">
        {{ index + 1 }}.
        <a
          class="va-link"
          @mouseenter="onMoorageMouseEnter(moorage.properties.moorageIndex)"
          @mouseleave="stopBouncingMarker(moorage.properties.moorageIndex)"
          @click="onMoorageClickNavigate(moorage.geometry.coordinates, moorage.properties.moorageIndex)"
          >{{ moorage.properties.name }}</a
        >
      </li>
    </ol>
  </div>
</template>
