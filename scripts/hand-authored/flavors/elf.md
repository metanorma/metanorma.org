---
title: ELF
outline: false
---

<script setup>
import { flavors } from "../../.vitepress/data/flavors"
const flavor = flavors.find(f => f.id === "elf")
</script>

<FlavorPage :flavor="flavor" />
