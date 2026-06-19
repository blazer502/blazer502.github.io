---
title: Page Table
tags: [operating-system, memory-management]
status: seed
---

# Page Table

A page table maps virtual pages to physical frames and records metadata such as
permissions, presence, and dirty/accessed state.

## Why It Matters

Page-level mechanisms are useful when memory protection needs to be enforced
without instrumenting every individual load and store.

## Related Notes

- [[Use-After-Free|UAF]]

#os #memory
