---
title: IHO
outline: false
---

<script setup>
import { flavors } from "../../.vitepress/data/flavors"
const flavor = flavors.find(f => f.id === "iho")
</script>

<FlavorPage :flavor="flavor" />
