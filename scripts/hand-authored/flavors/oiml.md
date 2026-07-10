---
title: OIML
outline: false
---

<script setup>
import { flavors } from "../../.vitepress/data/flavors"
const flavor = flavors.find(f => f.id === "oiml")
</script>

<FlavorPage :flavor="flavor" />
