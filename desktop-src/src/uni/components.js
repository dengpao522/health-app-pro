import { defineComponent, h, Teleport } from 'vue'

// view → div
export const View = defineComponent({
  name: 'view',
  setup(_, { slots, attrs }) {
    return () => h('div', attrs, slots.default?.())
  }
})

// text → span
export const Text = defineComponent({
  name: 'text',
  setup(_, { slots, attrs }) {
    return () => h('span', attrs, slots.default?.())
  }
})

// image → img
export const Image = defineComponent({
  name: 'image',
  props: ['src', 'mode'],
  setup(props, { attrs }) {
    return () => h('img', {
      src: props.src,
      style: props.mode === 'aspectFill' ? 'width:100%;height:100%;object-fit:cover;' : '',
      ...attrs
    })
  }
})

// button → button
export const Button = defineComponent({
  name: 'button',
  emits: ['click'],
  setup(_, { slots, attrs, emit }) {
    return () => h('button', {
      ...attrs,
      onClick: (e) => emit('click', e),
    }, slots.default?.())
  }
})

// input → input
export const Input = defineComponent({
  name: 'input',
  props: ['modelValue', 'placeholder', 'password', 'type', 'confirmType', 'placeholderStyle'],
  emits: ['update:modelValue', 'confirm'],
  setup(props, { attrs, emit }) {
    return () => h('input', {
      type: props.password ? 'password' : (props.type || 'text'),
      value: props.modelValue,
      placeholder: props.placeholder,
      style: props.placeholderStyle ? `--placeholder:${props.placeholderStyle}` : '',
      ...attrs,
      onInput: (e) => emit('update:modelValue', e.target.value),
      onKeyup: (e) => { if (e.key === 'Enter') emit('confirm', e) },
    })
  }
})

// picker → select
export const Picker = defineComponent({
  name: 'picker',
  props: ['range', 'value'],
  emits: ['change'],
  setup(props, { slots, attrs, emit }) {
    return () => h('select', {
      ...attrs,
      onChange: (e) => emit('change', { detail: { value: e.target.selectedIndex } }),
    }, [
      ...(props.range || []).map((label, i) =>
        h('option', { value: i, selected: i === props.value }, label)
      )
    ])
  }
})

// canvas → canvas with canvas-id
export const Canvas = defineComponent({
  name: 'canvas',
  props: ['canvasId'],
  setup(props, { attrs }) {
    return () => h('canvas', {
      'canvas-id': props.canvasId,
      ...attrs,
    })
  }
})

// block → template (fragments)
export const Block = defineComponent({
  name: 'block',
  setup(_, { slots }) {
    return () => slots.default?.()
  }
})

// scroll-view → div with overflow
export const ScrollView = defineComponent({
  name: 'scroll-view',
  props: ['scrollY', 'scrollX'],
  setup(props, { slots, attrs }) {
    const style = []
    if (props.scrollY) style.push('overflow-y:auto')
    if (props.scrollX) style.push('overflow-x:auto')
    return () => h('div', {
      style: style.join(';'),
      ...attrs,
    }, slots.default?.())
  }
})
