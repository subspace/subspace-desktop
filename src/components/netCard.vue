<template lang="pug">
q-card(bordered flat)
  .q-pa-sm
    .row.items-center
      q-icon.q-mr-sm(color="grey" name="settings_ethernet" size="40px")
      h6.text-weight-light {{ $t('dashboard.network') }}
    q-separator.q-mt-xs
    .row.items-center.q-mt-sm
      .col-auto.q-mr-md(v-if="store.network.state == 'finished'")
        q-icon(color="green" name="done" size="40px")
      .col-auto.q-mr-md(v-if="store.network.state == 'verifying'")
        q-spinner-orbit(color="grey" name="done" size="40px")
      .col
        .text-weight-light Status:
        p {{ $t(store.networkMessage.string, store.networkMessage.values) }}
    .row.items-center.q-mt-sm
      .col
        .row.items-center
          .col-auto.q-mr-md
            q-icon(color="black" name="group" size="40px")
          .col
            .text-weight-light Peers:
            p {{ store.network.peers }}
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


<style>
</style>
