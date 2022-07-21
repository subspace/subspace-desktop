<template lang="pug">
q-page(padding)
  .row.justify-center.q-mt-xl
    .text-h4 {{ $t('importKey.pageTitle') }}
  .row.justify-center.q-mt-md
    .text-p {{ $t('importKey.rewardAddress') }}
  .row.justify-center.q-mt-sm
    q-input(
      outlined
      dense
      class="reward-address"
      v-model="store.rewardAddress"
      input-class="text-center"
      :rules="[val => isValidSubstrateAddress(val) || $t('importKey.addressErrorMsg')]"
    )
  .row.justify-center.q-mt-sm
  .row.justify-end.items-center.q-mt-lg.absolute-bottom.q-pa-lg
    .col-auto.q-mr-md
      q-btn(
        @click="$router.replace({ name: 'index' })" 
        :label="$t('importKey.cancel')" 
        outline 
        size="lg" 
        icon-right="cancel"
      )
    q-space
    .col-auto
      q-btn(
        :disable="!isValidSubstrateAddress(store.rewardAddress)"
        :label="$t('importKey.continue')"
        @click="importKey()"
        icon-right="arrow_forward"
        outline
        size="lg"
      )
      q-tooltip.q-pa-md(v-if="!isValidSubstrateAddress(store.rewardAddress)")
        p.q-mb-lg {{ $t('importKey.tooltip') }}
</template>

<script lang="ts">
import { defineComponent } from "vue"
import { decodeAddress, encodeAddress } from "@polkadot/keyring"
import { hexToU8a, isHex } from "@polkadot/util"

import { useStore } from '../stores/store';

export default defineComponent({
  setup() {
    const store = useStore();
    return { store };
  },
  methods: {
    isValidSubstrateAddress(val: string): boolean {
      try {
        encodeAddress(isHex(val) ? hexToU8a(val) : decodeAddress(val))
        return true
      } catch (error) {
        return false
      }
    },
    async importKey() {
      await this.store.confirmRewardAddress();
      this.$router.replace({ name: "setupPlot" })
    },
  }
})
</script>


<style lang="sass">
.reward-address
  width: 500px
  font-size: 17px
  padding-top: 5px
  margin-top: 0px
</style>
