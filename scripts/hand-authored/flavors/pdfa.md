---
title: PDF Association
outline: false
---

<script setup>
import { flavors } from "../../.vitepress/data/flavors"
const flavor = flavors.find(f => f.id === "pdfa")
</script>

<FlavorPage :flavor="flavor" />
