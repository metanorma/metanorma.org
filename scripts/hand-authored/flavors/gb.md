---
title: GB
outline: false
---

<script setup>
import { flavors } from "../../.vitepress/data/flavors"
const flavor = flavors.find(f => f.id === "gb")
</script>

<FlavorPage :flavor="flavor" />
