---
title: MBx-IF
outline: false
---

<script setup>
import { flavors } from "../../.vitepress/data/flavors"
const flavor = flavors.find(f => f.id === "mbxif")
</script>

<FlavorPage :flavor="flavor" />
