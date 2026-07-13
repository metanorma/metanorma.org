---
title: CC
outline: false
---

<script setup>
import { flavors } from "../../.vitepress/data/flavors"
const flavor = flavors.find(f => f.id === "cc")
</script>

<FlavorPage :flavor="flavor" />
