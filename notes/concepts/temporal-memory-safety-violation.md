---
title: Temporal Memory Safety Violation
aliases: [Temporal Safety Violation, Temporal Memory Safety, Temporal Bug]
tags: [system-security, memory-safety, vulnerability]
status: growing
---

# Temporal Memory Safety Violation

Temporal memory safety is the property that a memory object is accessed only
during its valid lifetime: after allocation and before deallocation. A temporal
memory safety violation happens when a program keeps using a reference after
the referenced object is no longer alive.

The most representative example is [[Use-After-Free]], where a pointer remains
reachable after the heap object it points to has been freed.

## Core Idea

Memory safety has two commonly separated dimensions:

- Spatial safety: a pointer should refer only to the memory region it is allowed
  to access.
- Temporal safety: a pointer should be used only while the pointed object is
  still alive.

Temporal violations are about lifetime, not just address range. A stale pointer
may still contain an address that looks valid, especially after the allocator
reuses the same address for another object. That is what makes these bugs
dangerous: the program can appear to access allocated memory while actually
using an old authority to a different lifetime.

## Typical Use-After-Free Pattern

```c
struct item *p = malloc(sizeof(*p));
free(p);

struct item *q = malloc(sizeof(*q));
p->field = attacker_controlled_value;
```

If `q` reuses the same address that `p` used to point to, the dangling pointer
`p` can corrupt the new object. Depending on what the new object represents,
this can lead to control-flow hijacking, privilege escalation, information
leakage, or logic corruption.

## Why It Is Hard

C and C++ make pointer lifetime difficult to enforce because pointers can be
copied, stored, cast, passed across module boundaries, and placed in many memory
regions. When an object is freed, the allocator usually knows that the object is
dead, but it does not know whether every pointer to the old address has also
disappeared.

The difficult question is:

> Is there any remaining reachable pointer to this freed object?

Answering this question precisely is expensive because the pointer may be in
the stack, heap, globals, registers, or memory acquired directly through system
calls. In multithreaded programs, the answer can also change while a protection
mechanism is checking memory.

## Attack Surface

A temporal memory safety violation becomes exploitable when an attacker can
influence at least one of these steps:

- Create or trigger a dangling pointer.
- Cause the allocator to reuse the freed address for a useful target object.
- Access the target object through the stale pointer.
- Shape the corrupted object so the later program behavior benefits the
  attacker.

The allocator's reuse policy is therefore central. Reusing a freed address too
early can turn a dangling pointer into a powerful primitive.

## Research Taxonomy

Temporal memory safety work can be organized along two axes.

The first axis is the defended event:

- Access-time defenses check whether a pointer is still valid when the program
  dereferences it.
- Copy-time defenses track pointer propagation so dangling pointers can be
  found or invalidated later.
- Free-time defenses change what happens when an object is freed.
- Reuse-time defenses delay or prevent address reuse until stale pointers are
  unlikely or known not to exist.

The second axis is the defended resource:

- Pointer metadata: attach lifetime information to pointers or capabilities.
- Object metadata: attach generation, lock, type, or allocation-state metadata
  to objects.
- Address reuse: prevent a stale pointer from becoming meaningful by avoiding
  reuse of the same virtual address.
- Memory reachability: scan memory to find whether any reachable value still
  points into freed storage.

These axes explain why the same bug class has many families of defenses. Some
systems try to make every stale access fail. Others try to ensure that stale
pointers never point to newly allocated objects. Still others try to remove the
stale pointers themselves.

## Defense Strategies

### Validate Accesses

Access-validation schemes check whether a pointer is still authorized when it
is dereferenced. Lock-and-key approaches attach metadata to both objects and
pointers, then compare them on access. This can catch stale pointers directly,
but the cost is tied to pointer dereference frequency.

Representative works include CETS, PTAuth, PACMem, xTag, Fat Pointers for C,
RTT-UAF, and ViK. These systems differ in how they encode and protect metadata:
compiler-managed metadata, pointer authentication, software pointer tagging,
object identifiers, fat pointers, or reuse-time tracking. The common shape is
that a stale pointer should fail a metadata check before it can be used as
ordinary authority to memory.

### Remove Dangling Pointers

Escape-tracking and pointer-nullification approaches try to maintain the set of
locations that point to each object. When the object is freed, the system
invalidates or nullifies those locations. This attacks the root cause directly,
but it requires tracking pointer copies and maintaining potentially large
metadata.

DangNull, FreeSentry, DangSan, CRCount, HeapExpo, CAMP, and Fast Pointer
Nullification belong near this family. They vary in how they track references:
explicit points-to sets, shadow/log-structured metadata, reference counts,
compiler assistance, allocator cooperation, or faster invalidation paths.
Their central challenge is coverage: a pointer may live in stack slots, heap
objects, globals, registers, optimized compiler temporaries, or concurrently
modified locations.

### Delay Reuse

Delayed-reuse approaches quarantine freed memory and allow reuse only after the
system believes no dangling pointer still refers to it. Mark-sweep-style
systems scan memory for references to quarantined objects. If no reference is
found, the allocator can safely recycle the memory.

This strategy shifts the problem from "check every access" to "decide when
reuse is safe." It can be practical, but it introduces tradeoffs in scanning
cost, stop-the-world latency, memory usage, and allocation locality.

MarkUs and MineSweeper are representative drop-in mark-sweep approaches. They
delay reuse and scan memory to decide which freed objects can be recycled.
SwiftSweeper follows the same high-level safety goal, but focuses on removing
stop-the-world sweeping from the critical path by using concurrent, batched, and
adaptive reclamation.

### Avoid Virtual Address Reuse

One-time allocation avoids reusing virtual addresses after free. A dangling
pointer may still exist, but it does not become a pointer to a newly allocated
object. The downside is virtual address pressure, which matters for long-running
programs or programs with intense allocation behavior.

Oscar, FFmalloc, and BUDAlloc are examples of virtual-address-oriented designs.
Their shared intuition is simple: if the allocator never gives a freed virtual
address to another object, a stale pointer cannot silently become authority to a
new object. The hard part is making this practical under finite virtual address
space, kernel metadata costs, and long-running workloads.

### Page-Level Reuse

Page-level delayed reuse treats virtual pages as the unit of safe reuse. A
runtime can detach physical pages from freed virtual pages, keep the virtual
addresses quarantined, and later reuse only pages that are no longer referenced
by reachable pointers.

This connects temporal memory safety with [[Page Table]] behavior: the system
can separate virtual address reuse from physical memory reuse. It also motivates
sweeping mechanisms such as [[Memory Sweeper]], where the runtime searches for
remaining references before recycling memory.

## Design Tradeoffs

Temporal safety defenses usually choose a point in the execution where they pay
overhead:

- Pointer dereference: precise checks, but frequent.
- Pointer copy: tracks aliases, but metadata can grow.
- Free/reuse: avoids checking every access, but may increase memory usage.
- Periodic scan: amortizes cost, but must handle concurrency and latency.
- Virtual-address policy: weakens dangling pointers by avoiding reuse, but
  consumes address space.

No single strategy dominates every workload. Allocation-intensive programs are
especially sensitive because delaying reuse can reduce locality and increase
fragmentation. A useful defense has to preserve the safety property while
keeping allocator behavior close enough to what real programs expect.

## Related Work Map

| Category | Representative Works | Main Idea | Main Pressure Point |
| --- | --- | --- | --- |
| Access validation | CETS, PTAuth, PACMem, xTag, Fat Pointers for C, RTT-UAF, ViK | Check metadata when a pointer is used | Per-dereference or metadata-propagation overhead |
| Pointer tracking / nullification | DangNull, FreeSentry, DangSan, CRCount, HeapExpo, CAMP, Fast Pointer Nullification | Track aliases and invalidate stale references | Complete and scalable pointer coverage |
| Mark-sweep delayed reuse | MarkUs, MineSweeper, SwiftSweeper, CHERIvoke | Reuse freed memory only after reachability/revocation checks | Scan cost, concurrency, stop-the-world latency |
| Virtual address management | Oscar, FFmalloc, BUDAlloc | Avoid or decouple virtual address reuse | Address-space pressure and kernel metadata costs |
| Allocator hardening | DieHard, DieHarder, FreeGuard, Guarder | Reduce exploitability through randomized or hardened allocation | Usually probabilistic mitigation, not full temporal safety |

## Selected References

- Santosh Nagarakatte, Jianzhou Zhao, Milo M. K. Martin, and Steve Zdancewic.
  "CETS: Compiler Enforced Temporal Safety for C." ISMM, 2010.
- Byoungyoung Lee, Chengyu Song, Yeongjin Jang, Tielei Wang, Taesoo Kim, Long
  Lu, and Wenke Lee. "Preventing Use-after-free with Dangling Pointers
  Nullification." NDSS, 2015.
- Yves Younan. "FreeSentry: Protecting Against Use-After-Free Vulnerabilities
  Due to Dangling Pointers." NDSS, 2015.
- Erik van der Kouwe, Vinod Nigade, and Cristiano Giuffrida. "DangSan:
  Scalable Use-after-Free Detection." EuroSys, 2017.
- Thurston H. Y. Dang, Petros Maniatis, and David A. Wagner. "Oscar: A
  Practical Page-Permissions-Based Scheme for Thwarting Dangling Pointers."
  USENIX Security, 2017.
- Daiping Liu, Mingwei Zhang, and Haining Wang. "A Robust and Efficient Defense
  Against Use-after-Free Exploits via Concurrent Pointer Sweeping." CCS, 2018.
- Sam Ainsworth and Timothy M. Jones. "MarkUs: Drop-in Use-After-Free
  Prevention for Low-Level Languages." IEEE S&P, 2020.
- Zekun Shen and Brendan Dolan-Gavitt. "HeapExpo: Pinpointing Promoted Pointers
  to Prevent Use-After-Free Vulnerabilities." ACSAC, 2020.
- Brian Wickman, Hong Hu, Insu Yun, Daehee Jang, JungWon Lim, Sanidhya Kashyap,
  and Taesoo Kim. "Preventing Use-After-Free Attacks with Fast Forward
  Allocation." USENIX Security, 2021.
- Reza Mirzazade Farkhani, Mansour Ahmadi, and Long Lu. "PTAuth: Temporal
  Memory Safety via Robust Points-to Authentication." USENIX Security, 2021.
- Marton Erdos, Sam Ainsworth, and Timothy M. Jones. "MineSweeper: A Clean
  Sweep for Drop-in Use-After-Free Prevention." ASPLOS, 2022.
- Yuan Li, Wende Tan, Zhizheng Lv, Songtao Yang, Mathias Payer, Ying Liu, and
  Chao Zhang. "PACMem: Enforcing Spatial and Temporal Memory Safety via ARM
  Pointer Authentication." CCS, 2022.
- Lukas Bernhard, Michael Rodler, Thorsten Holz, and Lucas Davi. "xTag:
  Mitigating Use-After-Free Vulnerabilities via Software-Based Pointer Tagging
  on Intel x86-64." EuroS&P, 2022.
- Haehyun Cho, Jinbum Park, Adam Oest, Tiffany Bao, Ruoyu Wang, Yan
  Shoshitaishvili, Adam Doupe, and Gail-Joon Ahn. "ViK: Practical Mitigation of
  Temporal Memory Safety Violations Through Object ID Inspection." ASPLOS,
  2022.
- Jie Zhou, John Criswell, and Michael Hicks. "Fat Pointers for Temporal Memory
  Safety of C." OOPSLA, 2023.
- Junho Ahn, Jaehyeon Lee, Kanghyuk Lee, Wooseok Gwak, Minseong Hwang, and
  Youngjin Kwon. "BUDAlloc: Defeating Use-After-Free Bugs by Decoupling Virtual
  Address Management from Kernel." USENIX Security, 2024.
- Zhenpeng Lin, Zheng Yu, Ziyi Guo, Simone Campanoni, Peter Dinda, and Xinyu
  Xing. "CAMP: Compiler and Allocator-Based Heap Memory Protection." USENIX
  Security, 2024.
- Yubo Du, Yanan Guo, Youtao Zhang, and Jun Yang. "RTT-UAF: Reuse Time Tracking
  for Use-After-Free Detection." ICS, 2024.
- Junho Ahn, Kanghyuk Lee, Chanyoung Park, Hyungon Moon, and Youngjin Kwon.
  "SwiftSweeper: Defeating Use-After-Free Bugs Using Memory Sweeper Without
  Stop-the-World." IEEE S&P, 2025.
- Yubo Du, Youtao Zhang, and Jun Yang. "Fast Pointer Nullification for
  Use-After-Free Prevention." NDSS, 2026.

## Related Notes

- [[Use-After-Free]]
- [[Page Table]]
- [[Memory Sweeper]]

#memory #security
