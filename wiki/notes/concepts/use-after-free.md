---
title: "Use-After-Free"
permalink: "/notes/concepts/use-after-free/"
tags: ["system-security", "memory-safety", "memory", "security"]
aliases: ["UAF"]
status: "seed"
note_source: "notes/concepts/use-after-free.md"
---

<!-- Generated from notes/. Edit the source note, then run `npm run notes:publish`. -->


# Use-After-Free

Use-after-free happens when a program keeps using a pointer after the pointed
memory object has already been freed.

## Core Idea

- A dangling pointer still refers to an old address.
- The allocator may reuse that address for a different object.
- Later access through the stale pointer can corrupt or disclose data.

## Related Notes

- [Page Table]({{ '/notes/concepts/page-table/' | relative_url }})
- [Memory Sweeper]({{ '/notes/papers/memory-sweeper/' | relative_url }})

[#memory]({{ '/notes/tags/memory/' | relative_url }}) [#security]({{ '/notes/tags/security/' | relative_url }})



---

## Backlinks

- [Memory Sweeper]({{ '/notes/papers/memory-sweeper/' | relative_url }})
- [Page Table]({{ '/notes/concepts/page-table/' | relative_url }})
