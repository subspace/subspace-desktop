<template lang="pug">


q-dialog(@hide="onDialogHide" persistent ref="dialog")
  q-card
    q-card-section
      .row.items-center
        .text-h6 {{ $t('disclaimer.title') }}
        q-space
        q-icon(color="grey" name="info" size="40px")
    q-card-section.q-pt-none {{ $t('disclaimer.text') }}
    q-card-actions(align='right')
      q-btn(
        flat='', 
        :label="$t('disclaimer.confirm')", 
        color='primary', 
        v-close-popup=''
      )

</template>

<script>
import { defineComponent } from "vue"
const component = defineComponent({
  emits: ['ok', 'hide'],
  methods: {
    // following method is REQUIRED
    // (don't change its name --> "show")
    show() {
      this.$refs.dialog.show()
    },
    // following method is REQUIRED
    // (don't change its name --> "hide")
    hide() {
      this.$refs.dialog.hide()
    },
    onDialogHide() {
      // required to be emitted
      // when QDialog emits "hide" event
      this.$emit("hide")
    },
    onOKClick() {
      // on OK, it is REQUIRED to
      // emit "ok" event (with optional payload)
      // before hiding the QDialog
      this.$emit("ok")
      // or with payload: this.$emit('ok', { ... })
      // then hiding dialog
      this.hide()
    },
    onCancelClick() {
      // we just need to hide the dialog
      this.hide()
    }
  }
})
export default component
</script>
