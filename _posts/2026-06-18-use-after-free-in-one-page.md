---
title: "Use-after-free, in one page"
date: 2026-06-18
category: Security
tags: [security, memory-safety]
description: "A quick, high-level tour of what use-after-free bugs are and why they are so stubborn to eliminate."
---

A **use-after-free (UAF)** bug is what it sounds like: a program frees a chunk
of memory, then keeps using a pointer that still refers to it. The pointer is
now *dangling* — it points at an address the allocator considers free.

Why is that dangerous? Because the allocator will happily hand that same address
to the next allocation. Now two pieces of code believe they own the same bytes.
A read through the stale pointer can leak whatever the new owner put there; a
write can corrupt it. With careful heap grooming, that primitive turns into
control-flow hijacking.

What makes UAF stubborn is that the *bug* and the *exploit* are separated in
time. Freeing early is often correct; the mistake is holding a reference you
forgot about. Static analysis struggles with aliasing, and purely runtime
defenses have to decide the hard question: when is it truly safe to reuse an
address?

That "when is it safe to reuse" question is exactly what a lot of my work is
about — sweeping the heap to confirm no dangling references remain before an
address is recycled. If you want the longer version, the
[Use-After-Free note]({{ '/notes/concepts/use-after-free/' | relative_url }})
has more, and the [CV]({{ '/cv/' | relative_url }}) links the papers.
