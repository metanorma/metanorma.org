---
title: RIBOSE
outline: false
---

<script setup>
import { flavors } from "../../.vitepress/data/flavors"
const flavor = flavors.find(f => f.id === "ribose")
</script>

<FlavorPage :flavor="flavor" />
