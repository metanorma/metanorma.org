---
title: IEC
outline: false
---

<script setup>
import { flavors } from "../../.vitepress/data/flavors"
const flavor = flavors.find(f => f.id === "iec")
</script>

<FlavorPage :flavor="flavor" />
