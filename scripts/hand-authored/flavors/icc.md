---
title: ICC
outline: false
---

<script setup>
import { flavors } from "../../.vitepress/data/flavors"
const flavor = flavors.find(f => f.id === "icc")
</script>

<FlavorPage :flavor="flavor" />
