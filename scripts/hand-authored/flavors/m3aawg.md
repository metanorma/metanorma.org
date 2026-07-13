---
title: M3AAWG
outline: false
---

<script setup>
import { flavors } from "../../.vitepress/data/flavors"
const flavor = flavors.find(f => f.id === "m3aawg")
</script>

<FlavorPage :flavor="flavor" />
