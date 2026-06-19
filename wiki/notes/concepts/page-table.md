---
title: "Page Table"
permalink: "/notes/concepts/page-table/"
tags: ["operating-system", "memory-management", "os", "memory"]
aliases: []
status: "seed"
note_source: "notes/concepts/page-table.md"
---

<!-- Generated from notes/. Edit the source note, then run `npm run notes:publish`. -->


# Page Table

A page table maps virtual pages to physical frames and records metadata such as
permissions, presence, and dirty/accessed state.

## Why It Matters

Page-level mechanisms are useful when memory protection needs to be enforced
without instrumenting every individual load and store.

## Related Notes

- [UAF]({{ '/notes/concepts/use-after-free/' | relative_url }})

[#os]({{ '/notes/tags/os/' | relative_url }}) [#memory]({{ '/notes/tags/memory/' | relative_url }})



---

## Backlinks

- [Memory Sweeper]({{ '/notes/papers/memory-sweeper/' | relative_url }})
- [Use-After-Free]({{ '/notes/concepts/use-after-free/' | relative_url }})
