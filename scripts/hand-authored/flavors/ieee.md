---
title: IEEE
outline: false
---

<script setup>
import { flavors } from "../../.vitepress/data/flavors"
const flavor = flavors.find(f => f.id === "ieee")
</script>

<FlavorPage :flavor="flavor" />
