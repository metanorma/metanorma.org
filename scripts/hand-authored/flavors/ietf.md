---
title: IETF
outline: false
---

<script setup>
import { flavors } from "../../.vitepress/data/flavors"
const flavor = flavors.find(f => f.id === "ietf")
</script>

<FlavorPage :flavor="flavor" />
