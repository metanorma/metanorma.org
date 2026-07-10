---
title: SWF
outline: false
---

<script setup>
import { flavors } from "../../.vitepress/data/flavors"
const flavor = flavors.find(f => f.id === "swf")
</script>

<FlavorPage :flavor="flavor" />
