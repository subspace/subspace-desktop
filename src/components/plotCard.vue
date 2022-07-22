<template lang="pug">
q-card(bordered flat)
  .q-pa-sm
    .row.items-center
      q-icon.q-mr-sm(color="grey" name="downloading" size="40px")
      h6.text-weight-light {{ $t('dashboard.plot') }}
    q-separator.q-mt-xs
    .row.items-center.q-mt-sm
      .col-auto.q-mr-md(v-if="store.plot.state == 'finished'")
        q-icon(color="green" name="done" size="40px")
      .col-auto.q-mr-md(v-if="store.plot.state == 'downloading'")
        q-spinner-box(color="green" size="40px")
      .col-auto.q-mr-md(v-if="store.plot.state == 'verifying'")
        q-spinner-box(color="grey" size="40px")
      .col
        .text-weight-light {{ $t('dashboard.status') }}
        p {{ $t(store.plot.message) }}
    .row.items-center.q-mt-sm
      .col-auto.q-mr-md
        q-icon(color="black" name="storage" size="40px")
      .col
        .text-weight-light {{ $t('dashboard.allocated') }}
        p {{ store.plotSizeGB }} GB
</template>

<script lang="ts" >
import { defineComponent } from "vue"
import { useStore } from '../stores/store';

export default defineComponent({
  setup() {
    const store = useStore();
    return { store };
  },
})
</script>
