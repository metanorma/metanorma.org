---
title: OGC
outline: false
---

<script setup>
import { flavors } from "../../.vitepress/data/flavors"
const flavor = flavors.find(f => f.id === "ogc")
</script>

<FlavorPage :flavor="flavor" />
