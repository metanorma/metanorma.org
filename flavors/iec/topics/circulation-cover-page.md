---
title: "Circulation cover page for IEC"
layout: page
---

<div ref="contentRef"></div>

<script client-only setup>
import { ref, onMounted } from 'vue'

const contentRef = ref(null)
const outputKey = 'author/iec/topics/circulation-cover-page'

onMounted(async () => {
  try {
    const mod = await import('../../../../.vitepress/mirror-json/author/iec/topics/circulation-cover-page.json')
    const docData = mod.default || mod
    if (docData && docData.mirror_json && contentRef.value) {
      const { renderProseMirrorToHtml } = await import('../../../../.vitepress/theme/prosemirror-renderer.ts')
      const parsed = typeof docData.mirror_json === 'string' ? JSON.parse(docData.mirror_json) : docData.mirror_json
      contentRef.value.innerHTML = renderProseMirrorToHtml(parsed)
    }
  } catch (e) { console.error('Content render error:', e) }
})
</script>
