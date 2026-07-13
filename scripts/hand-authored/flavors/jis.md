---
title: JIS
outline: false
---

<script setup>
import { flavors } from "../../.vitepress/data/flavors"
const flavor = flavors.find(f => f.id === "jis")
</script>

<FlavorPage :flavor="flavor" />
