// Shared between AppLayout.tsx (listens, owns ProductTour's open state) and
// Sidebar.tsx (dispatches, via "Take a tour") — a plain window event rather
// than a context provider, matching the same pattern AppLayout's own ⌘K
// search button already uses to open CommandPalette. Lives in its own module
// so the two layout components don't need to import from each other.
export const SHOW_TOUR_EVENT = 'cretos:show-tour'
