---
title: Use-After-Free
aliases: [UAF]
tags: [system-security, memory-safety]
status: seed
---

# Use-After-Free

Use-after-free happens when a program keeps using a pointer after the pointed
memory object has already been freed.

## Core Idea

- A dangling pointer still refers to an old address.
- The allocator may reuse that address for a different object.
- Later access through the stale pointer can corrupt or disclose data.

## Related Notes

- [[Page Table]]
- [[Memory Sweeper]]

#memory #security
