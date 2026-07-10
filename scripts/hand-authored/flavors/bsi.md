---
title: BSI
outline: false
---

<script setup>
import { flavors } from "../../.vitepress/data/flavors"
const flavor = flavors.find(f => f.id === "bsi")
</script>

<FlavorPage :flavor="flavor" />
