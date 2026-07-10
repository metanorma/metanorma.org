---
title: PLATEAU
outline: false
---

<script setup>
import { flavors } from "../../.vitepress/data/flavors"
const flavor = flavors.find(f => f.id === "plateau")
</script>

<FlavorPage :flavor="flavor" />
