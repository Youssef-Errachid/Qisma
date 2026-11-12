# ScrollArea

Scrolling patterns: an inner scroll area with a sticky header that gains a shadow, and a horizontal snap carousel.

`.q-scroll`: thin themed scrollbar (`scrollbar-thumb`, darker on hover) and `overscroll-behavior: contain`. `.q-sticky` header gets `shadow-sticky` once `scrollTop > 0` (toggle `is-scrolled`). `.q-scroll-x` snaps cards horizontally. All smooth scrolling stops under reduced motion.
