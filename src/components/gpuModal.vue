<template lang="pug">


q-dialog(@hide="onDialogHide" persistent ref="dialog")
  q-card
    q-card-section
      .row.items-center
        .text-h6 You can utilize your GPU for faster plotting!
        q-space
        q-icon(color="grey" name="info" size="40px")
    q-card-section.q-pt-none
      | We have found NVidia GTX 1060 in your system. Do you want to utilize that GPU for faster plotting?
    q-card-actions(align='right')
      q-btn(flat='', label="No, don't use it!", @click="onCancelClick" color='primary', v-close-popup='')
      q-btn(flat='', label='Ok, use it!', @click="onOKClick" color='primary', v-close-popup='')


</template>

<script>
import { defineComponent } from "vue"
const component = defineComponent({
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
      // on CANCEL, we need to
      // emit "cancel" event (with optional payload)
      // before hiding the QDialog
      this.$emit("cancel")
      this.hide()
    }
  }
})
export default component
</script>
