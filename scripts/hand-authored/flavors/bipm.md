---
title: BIPM
outline: false
---

<script setup>
import { flavors } from "../../.vitepress/data/flavors"
const flavor = flavors.find(f => f.id === "bipm")
</script>

<FlavorPage :flavor="flavor" />
