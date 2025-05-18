<template>
  <n-message-provider>
    <ImageView />
  </n-message-provider>
</template>

<script setup lang="ts">
import ImageView from './components/ImageView.vue'
</script>

<style>
#app {
  font-family: Avenir, Helvetica, Arial, sans-serif;
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
  text-align: center;
  color: #2c3e50;
  margin-top: 60px;
}
</style>
